import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/simulator/route/[vehicleId]
 *
 * Returns a real street-level route for a vehicle en route to an incident.
 *
 * Routing priority:
 *  1. TomTom Routing API (if TOMTOM_API_KEY is set)  — supports dynamic
 *     "avoid areas" built from active incidents near the route.
 *  2. OSRM public API (fallback)  — no avoid-area support but works
 *     without any API key.
 *
 * Steps:
 *  1. Look up the vehicle's current GPS position from the DB.
 *  2. Find the active incident assigned to this vehicle.
 *  3. Fetch other active incidents to use as avoid areas.
 *  4. Call the routing engine and return ordered { lat, lng } waypoints.
 */

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;

/** ~200 m in degrees at Madrid's latitude — used to build avoid rectangles. */
const AVOID_RADIUS_LAT = 0.002;
const AVOID_RADIUS_LNG = 0.003;

// ── TomTom routing helper ─────────────────────────────────────────────────

interface RouteResult {
  route: { lat: number; lng: number }[];
  distanceMetres: number;
  durationSeconds: number;
}

async function fetchTomTomRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  obstacles: Array<{ latitude: number; longitude: number }>,
): Promise<RouteResult> {
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${originLat},${originLng}:${destLat},${destLng}/json` +
    `?key=${TOMTOM_API_KEY}` +
    `&routeType=fastest` +
    `&traffic=true` +
    `&travelMode=car`;

  let res: Response;

  if (obstacles.length > 0) {
    const body = {
      avoidAreas: {
        rectangles: obstacles.map((obs) => ({
          southWestCorner: {
            latitude: Number(obs.latitude) - AVOID_RADIUS_LAT,
            longitude: Number(obs.longitude) - AVOID_RADIUS_LNG,
          },
          northEastCorner: {
            latitude: Number(obs.latitude) + AVOID_RADIUS_LAT,
            longitude: Number(obs.longitude) + AVOID_RADIUS_LNG,
          },
        })),
      },
    };

    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
  } else {
    res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TomTom returned HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    routes?: Array<{
      summary?: { lengthInMeters?: number; travelTimeInSeconds?: number };
      legs?: Array<{ points?: Array<{ latitude: number; longitude: number }> }>;
    }>;
  };

  const best = data.routes?.[0];
  if (!best) return { route: [], distanceMetres: 0, durationSeconds: 0 };

  const points: { lat: number; lng: number }[] = [];
  for (const leg of best.legs ?? []) {
    for (const pt of leg.points ?? []) {
      points.push({ lat: pt.latitude, lng: pt.longitude });
    }
  }

  return {
    route: points,
    distanceMetres: best.summary?.lengthInMeters ?? 0,
    durationSeconds: best.summary?.travelTimeInSeconds ?? 0,
  };
}

// ── OSRM routing helper (fallback) ───────────────────────────────────────

async function fetchOsrmRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<RouteResult> {
  const osrmUrl =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${originLng},${originLat};${destLng},${destLat}` +
    `?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(osrmUrl, {
    headers: { 'User-Agent': 'emergency-vehicles-poc/1.0' },
    signal: AbortSignal.timeout(6_000),
  });

  if (!res.ok) throw new Error(`OSRM returned HTTP ${res.status}`);

  const data = (await res.json()) as {
    code: string;
    routes?: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
    }>;
  };

  if (data.code !== 'Ok' || !data.routes?.[0]) {
    return { route: [], distanceMetres: 0, durationSeconds: 0 };
  }

  const best = data.routes[0];
  const route = best.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => ({ lat, lng }),
  );

  return {
    route,
    distanceMetres: Math.round(best.distance),
    durationSeconds: Math.round(best.duration),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  const { vehicleId } = await params;
  if (!vehicleId) {
    return NextResponse.json({ error: 'Missing vehicleId' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // ── 1. Vehicle current position ────────────────────────────────────
    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .select('id, name, status, current_latitude, current_longitude')
      .eq('id', vehicleId)
      .single();

    if (vErr || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    if (vehicle.current_latitude == null || vehicle.current_longitude == null) {
      return NextResponse.json(
        { vehicleId, status: 'no_position', route: [] },
        { status: 200 },
      );
    }

    // ── 2. Find the active incident this vehicle is assigned to ────────
    const { data: assignedIncidents } = await supabase
      .from('incidents')
      .select('id, title, incident_type, latitude, longitude, status')
      .in('status', ['reported', 'dispatched', 'in_progress'])
      .contains('assigned_vehicle_ids', [vehicleId])
      .limit(1);

    const incident = assignedIncidents?.[0];

    if (!incident) {
      return NextResponse.json(
        { vehicleId, status: 'no_active_incident', route: [] },
        { status: 200 },
      );
    }

    const originLat = vehicle.current_latitude;
    const originLng = vehicle.current_longitude;
    const destLat = incident.latitude;
    const destLng = incident.longitude;

    // ── 3. Collect active incidents as avoid areas ──────────────────────
    //   Exclude the target incident itself. Only include obstacles that
    //   fall within a bounding box around the origin → destination route
    //   (expanded by ~2 km so nearby obstacles are still considered).
    const { data: obstacleIncidents } = await supabase
      .from('incidents')
      .select('id, latitude, longitude')
      .in('status', ['reported', 'dispatched', 'in_progress'])
      .neq('id', incident.id);

    const BBOX_PAD = 0.02; // ~2 km padding
    const minLat = Math.min(originLat, destLat) - BBOX_PAD;
    const maxLat = Math.max(originLat, destLat) + BBOX_PAD;
    const minLng = Math.min(originLng, destLng) - BBOX_PAD;
    const maxLng = Math.max(originLng, destLng) + BBOX_PAD;

    const obstacles = (obstacleIncidents ?? []).filter(
      (obs) =>
        Number(obs.latitude) >= minLat &&
        Number(obs.latitude) <= maxLat &&
        Number(obs.longitude) >= minLng &&
        Number(obs.longitude) <= maxLng,
    );

    // TomTom allows at most ~20 avoid rectangles. Keep the 10 closest to
    // the route midpoint so the most relevant obstacles are avoided.
    const midLat = (originLat + destLat) / 2;
    const midLng = (originLng + destLng) / 2;
    const sortedObstacles = obstacles
      .map((obs) => ({
        ...obs,
        _dist: (Number(obs.latitude) - midLat) ** 2 + (Number(obs.longitude) - midLng) ** 2,
      }))
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 10);

    // ── 4. Compute route ───────────────────────────────────────────────
    let result: RouteResult;
    let avoidedObstacles = 0;
    let routingEngine: string;

    if (TOMTOM_API_KEY) {
      result = await fetchTomTomRoute(
        originLat, originLng, destLat, destLng, sortedObstacles,
      );
      avoidedObstacles = sortedObstacles.length;
      routingEngine = 'tomtom';
    } else {
      result = await fetchOsrmRoute(originLat, originLng, destLat, destLng);
      routingEngine = 'osrm';
    }

    return NextResponse.json({
      vehicleId,
      vehicleName: vehicle.name,
      incident: {
        id: incident.id,
        title: incident.title,
        type: incident.incident_type,
      },
      status: 'en_route',
      distanceMetres: Math.round(result.distanceMetres),
      durationSeconds: Math.round(result.durationSeconds),
      avoidedObstacles,
      routingEngine,
      route: result.route,
    });
  } catch (err) {
    console.error(`[route/${vehicleId}] Error:`, err);
    return NextResponse.json(
      { error: 'Failed to compute route', detail: String(err) },
      { status: 500 },
    );
  }
}
