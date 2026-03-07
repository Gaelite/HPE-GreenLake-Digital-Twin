'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import { createClient } from '@/lib/supabase/client';
import type { Vehicle, Incident, VehicleType, VehicleStatus } from '@/types';

import VehicleMarker from './VehicleMarker';
import IncidentMarker from './IncidentMarker';
import TrafficObstacleMarker from './TrafficObstacleMarker';
import MapControls, { type MapFilters } from './MapControls';
import NearestVehicleFinder from './NearestVehicleFinder';

// ---------- Constants ----------

const MADRID_CENTER: [number, number] = [40.4168, -3.7038];
const DEFAULT_ZOOM = 12;

const ALL_VEHICLE_TYPES = new Set<VehicleType>([
  'police',
  'ambulance',
  'fire_truck',
  'civil_protection',
  'hybrid',
]);

const ALL_STATUSES = new Set<VehicleStatus>([
  'available',
  'in_service',
  'en_route',
  'at_scene',
  'maintenance',
  'offline',
]);

// ---------- Component ----------

interface FleetMapProps {
  showControls?: boolean;
}

export default function FleetMap({ showControls = true }: FleetMapProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // vehicle id -> ordered [lat, lng] waypoints from OSRM street routing
  const [activeRoutes, setActiveRoutes] = useState<Map<string, [number, number][]>>(new Map());
  // vehicle id -> { distanceMetres, durationSeconds, vehicleName, incidentTitle }
  const [routeMeta, setRouteMeta] = useState<Map<string, {
    distanceMetres: number;
    durationSeconds: number;
    vehicleName: string;
    incidentTitle: string;
    avoidedObstacles?: number;
    routingEngine?: string;
  }>>(new Map());
  // vehicle ids currently being fetched
  const [routeLoading, setRouteLoading] = useState<Set<string>>(new Set());

  // Dynamic route demo mode
  const [demoMode, setDemoMode] = useState(false);
  // Ref to track active-route vehicle IDs without re-triggering effects
  const activeRouteKeysRef = useRef(new Set<string>());
  // Track incident count for change detection
  const prevIncidentCountRef = useRef(0);


  const [filters, setFilters] = useState<MapFilters>({
    vehicleTypes: new Set(ALL_VEHICLE_TYPES),
    vehicleStatuses: new Set(ALL_STATUSES),
    showVehicles: true,
    showIncidents: true,
    showGeofences: false,
  });

  // ---------- Fetch initial data ----------

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/map/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchVehicles(), fetchIncidents()]);
      setIsLoading(false);
    };
    load();
  }, [fetchVehicles, fetchIncidents]);

  // ---------- Supabase Realtime ----------

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('fleet-map-vehicles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicles',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newVehicle = payload.new as Vehicle;
            if (newVehicle.current_latitude != null && newVehicle.current_longitude != null) {
              setVehicles((prev) => [...prev, newVehicle]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Vehicle;
            setVehicles((prev) =>
              prev.map((v) => (v.id === updated.id ? updated : v)).filter(
                (v) => v.current_latitude != null && v.current_longitude != null,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setVehicles((prev) => prev.filter((v) => v.id !== deleted.id));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newIncident = payload.new as Incident;
            if (newIncident.status !== 'resolved') {
              setIncidents((prev) => [newIncident, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Incident;
            if (updated.status === 'resolved') {
              setIncidents((prev) => prev.filter((i) => i.id !== updated.id));
            } else {
              setIncidents((prev) =>
                prev.map((i) => (i.id === updated.id ? updated : i)),
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setIncidents((prev) => prev.filter((i) => i.id !== deleted.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---------- Polling fallback (ensures updates even if Realtime silently fails) ----------

  useEffect(() => {
    const interval = setInterval(() => {
      fetchVehicles();
      fetchIncidents();
    }, 5_000);
    return () => clearInterval(interval);
  }, [fetchVehicles, fetchIncidents]);

  // ---------- Filtered data ----------

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter(
        (v) =>
          filters.vehicleTypes.has(v.type) && filters.vehicleStatuses.has(v.status),
      ),
    [vehicles, filters.vehicleTypes, filters.vehicleStatuses],
  );

  // Separate traffic obstacles (road_closure) from real emergency incidents
  const trafficObstacles = useMemo(
    () => incidents.filter((i): i is Incident & { incident_type: 'road_closure' } => i.incident_type === 'road_closure'),
    [incidents],
  );

  const regularIncidents = useMemo(
    () => incidents.filter((i) => i.incident_type !== 'road_closure') as Incident[],
    [incidents],
  );

  // ---------- Routes ----------

  // Refresh a single route (always writes, never toggles off)
  const refreshRoute = useCallback(async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/simulator/route/${vehicleId}`);
      if (!res.ok) return;
      const data = await res.json() as {
        route: { lat: number; lng: number }[];
        distanceMetres?: number;
        durationSeconds?: number;
        vehicleName?: string;
        incident?: { title: string };
        avoidedObstacles?: number;
        routingEngine?: string;
        status: string;
      };

      if (data.route && data.route.length >= 2) {
        const coords: [number, number][] = data.route.map(
          (p: { lat: number; lng: number }) => [p.lat, p.lng],
        );
        setActiveRoutes((prev) => new Map(prev).set(vehicleId, coords));
        setRouteMeta((prev) => new Map(prev).set(vehicleId, {
          distanceMetres: data.distanceMetres ?? 0,
          durationSeconds: data.durationSeconds ?? 0,
          vehicleName: data.vehicleName ?? vehicleId,
          incidentTitle: data.incident?.title ?? 'Incident',
          avoidedObstacles: data.avoidedObstacles,
          routingEngine: data.routingEngine,
        }));
      }
    } catch (err) {
      console.error('Failed to refresh route:', err);
    }
  }, []);

  const handleVehicleRouteRequest = useCallback(async (vehicleId: string) => {
    // Toggle off
    if (activeRoutes.has(vehicleId)) {
      setActiveRoutes((prev) => { const n = new Map(prev); n.delete(vehicleId); return n; });
      setRouteMeta((prev) => { const n = new Map(prev); n.delete(vehicleId); return n; });
      return;
    }

    // Mark loading
    setRouteLoading((prev) => new Set(prev).add(vehicleId));

    try {
      await refreshRoute(vehicleId);
    } catch (err) {
      console.error('Failed to fetch vehicle route:', err);
    } finally {
      setRouteLoading((prev) => { const n = new Set(prev); n.delete(vehicleId); return n; });
    }
  }, [activeRoutes, refreshRoute]);

  const handleIncidentRouteRequest = useCallback(async (vehicleIds: string[]) => {
    await Promise.all(vehicleIds.map((vid) => handleVehicleRouteRequest(vid)));
  }, [handleVehicleRouteRequest]);

  const clearAllRoutes = useCallback(() => {
    setActiveRoutes(new Map());
    setRouteMeta(new Map());
  }, []);

  // Keep ref in sync with active route keys
  useEffect(() => {
    activeRouteKeysRef.current = new Set(activeRoutes.keys());
  }, [activeRoutes]);

  // Track how many obstacles have been spawned per vehicle during this demo session
  const obstacleCountRef = useRef<Map<string, number>>(new Map());

  // Reset obstacle counts when demo mode is toggled off
  useEffect(() => {
    if (!demoMode) obstacleCountRef.current.clear();
  }, [demoMode]);

  // ── Dynamic Route Demo: spawn obstacles + auto-refresh ──────────────
  useEffect(() => {
    if (!demoMode) return;

    const MAX_OBSTACLES_PER_VEHICLE = 2;

    const interval = setInterval(async () => {
      const vehicleIds = Array.from(activeRouteKeysRef.current);
      if (vehicleIds.length === 0) return;

      let spawned = false;

      // 1. Spawn an obstacle on each active route (max 2 per vehicle)
      for (const vid of vehicleIds) {
        const count = obstacleCountRef.current.get(vid) ?? 0;
        if (count >= MAX_OBSTACLES_PER_VEHICLE) continue;

        // Send the displayed route coords so the obstacle lands on the visible line
        const routeCoords = activeRoutes.get(vid)?.map(([lat, lng]) => ({ lat, lng }));

        try {
          const res = await fetch('/api/simulator/route-obstacle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleId: vid, routeCoords }),
          });
          const data = await res.json();
          if (data.success) {
            obstacleCountRef.current.set(vid, count + 1);
            spawned = true;
          }
        } catch { /* best-effort */ }
      }

      if (!spawned) return; // nothing new — don't bother re-fetching

      // 2. Wait briefly for the incident to propagate in Supabase
      await new Promise((r) => setTimeout(r, 2_000));

      // 3. Re-fetch routes — they now include the new avoid areas
      for (const vid of vehicleIds) {
        await refreshRoute(vid);
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [demoMode, refreshRoute, activeRoutes]);

  // ── Auto-refresh routes when the incident count increases ───────────
  useEffect(() => {
    const count = incidents.length;
    if (count > prevIncidentCountRef.current && activeRouteKeysRef.current.size > 0) {
      // New incident(s) appeared — refresh active routes so avoid areas update
      for (const vid of activeRouteKeysRef.current) {
        refreshRoute(vid);
      }
    }
    prevIncidentCountRef.current = count;
  }, [incidents.length, refreshRoute]);

  // Route polyline colours — one per vehicle
  const ROUTE_COLORS = ['#4F46E5', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6'];

  // ---------- Render ----------

  return (
    <div className="relative h-full w-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white/90 px-8 py-6 shadow-xl">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
            <p className="text-sm font-medium text-gray-700">Loading fleet data...</p>
          </div>
        </div>
      )}

      <MapContainer
        center={MADRID_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Vehicle markers */}
        {filters.showVehicles &&
          filteredVehicles.map((vehicle) => {
            const tel = (vehicle as Vehicle & { _telemetry?: { speed?: number; fuel_level?: number } })._telemetry;
            const inc = (vehicle as Vehicle & { _incident?: { id: string; title: string; incident_type: string; status: string } })._incident;
            return (
              <VehicleMarker
                key={vehicle.id}
                vehicle={vehicle}
                speed={tel?.speed}
                fuelLevel={tel?.fuel_level}
                assignedIncident={inc}
                onRouteRequest={handleVehicleRouteRequest}
                hasActiveRoute={activeRoutes.has(vehicle.id)}
                isLoadingRoute={routeLoading.has(vehicle.id)}
              />
            );
          })}

        {/* A*-graph routes: one polyline per active vehicle route */}
        {Array.from(activeRoutes.entries()).map(([vehicleId, coords], index) => (
          <Polyline
            key={`route-${vehicleId}`}
            positions={coords}
            pathOptions={{
              color: ROUTE_COLORS[index % ROUTE_COLORS.length],
              weight: 5,
              opacity: 0.85,
              dashArray: '12, 8',
            }}
          />
        ))}

        {/* Emergency incident markers */}
        {filters.showIncidents &&
          regularIncidents.map((incident) => (
            <IncidentMarker
              key={incident.id}
              incident={incident}
              onRouteRequest={handleIncidentRouteRequest}
            />
          ))}

        {/* Traffic obstacle markers (road closures) */}
        {filters.showIncidents &&
          trafficObstacles.map((obstacle) => (
            <TrafficObstacleMarker key={obstacle.id} incident={obstacle} />
          ))}

        {/* Nearest vehicle finder (renders inside MapContainer for useMapEvents) */}
        {showControls && <NearestVehicleFinder vehicles={vehicles} />}
      </MapContainer>

      {/* Map controls overlay (outside MapContainer to avoid leaflet event issues) */}
      {showControls && (
        <MapControls
          filters={filters}
          onFiltersChange={setFilters}
          vehicleCount={filteredVehicles.length}
          incidentCount={regularIncidents.length}
        />
      )}

      {/* Active route legend */}
      {(activeRoutes.size > 0 || routeLoading.size > 0) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 rounded-2xl bg-white/95 px-5 py-3 shadow-xl ring-1 ring-black/10 backdrop-blur-sm min-w-[280px]">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-xs font-bold text-gray-700 tracking-wide uppercase">Active Routes</span>
            <div className="flex items-center gap-1.5">
              {activeRoutes.size > 0 && (
                <button
                  onClick={() => setDemoMode((prev) => !prev)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    demoMode
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                  }`}
                >
                  {demoMode ? '⏸ Stop Demo' : '▶ Route Demo'}
                </button>
              )}
              <button
                onClick={() => { clearAllRoutes(); setDemoMode(false); }}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>
          {demoMode && (
            <div className="flex items-center gap-2 text-[10px] text-indigo-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Demo active — spawning obstacles every 15 s
            </div>
          )}
          {routeLoading.size > 0 && (
            <div className="flex items-center gap-2 text-xs text-indigo-600">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Fetching street route…
            </div>
          )}
          {Array.from(activeRoutes.keys()).map((vid, i) => {
            const meta = routeMeta.get(vid);
            const km = meta ? (meta.distanceMetres / 1000).toFixed(1) : '?';
            const min = meta ? Math.round(meta.durationSeconds / 60) : '?';
            const avoided = meta?.avoidedObstacles;
            return (
              <div key={vid} className="flex w-full items-center gap-3">
                <div
                  className="h-1 w-8 flex-shrink-0 rounded-full"
                  style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-800">
                    {meta?.vehicleName ?? vid}
                  </p>
                  <p className="truncate text-[10px] text-gray-500">
                    {meta?.incidentTitle} • {km} km • ~{min} min
                    {avoided != null && avoided > 0 && (
                      <span className="text-amber-600"> • {avoided} avoided</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleVehicleRouteRequest(vid)}
                  className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Traffic Obstacles Panel (bottom-right) */}
      {trafficObstacles.length > 0 && (
        <div className="absolute bottom-6 right-4 z-[1000] w-64 max-h-60 overflow-y-auto rounded-2xl bg-white/95 shadow-xl ring-1 ring-black/10 backdrop-blur-sm">
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-4 py-2.5 border-b border-orange-100 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="text-sm">🚧</span>
              <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                Traffic Obstacles
              </span>
              <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                {trafficObstacles.length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-orange-50">
            {trafficObstacles.map((obstacle) => (
              <div key={obstacle.id} className="px-4 py-2.5 hover:bg-orange-50/50 transition-colors">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {obstacle.title}
                </p>
                {obstacle.description && (
                  <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                    {obstacle.description}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {Number(obstacle.latitude).toFixed(4)}, {Number(obstacle.longitude).toFixed(4)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
