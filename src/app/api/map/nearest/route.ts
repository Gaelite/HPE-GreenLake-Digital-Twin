import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Vehicle, VehicleType } from '@/types';

const EARTH_RADIUS_KM = 6371;

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const type = searchParams.get('type') as VehicleType | null;
    const limitStr = searchParams.get('limit');

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: 'Missing required query parameters: lat, lng' },
        { status: 400 },
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng must be valid numbers' },
        { status: 400 },
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'lat must be between -90 and 90, lng between -180 and 180' },
        { status: 400 },
      );
    }

    const limit = Math.min(Math.max(parseInt(limitStr || '3', 10) || 3, 1), 20);

    const supabase = await createClient();

    let query = supabase
      .from('vehicles')
      .select('id, name, type, status, plate_number, current_latitude, current_longitude, risk_score, make, model, year, specifications, created_at, updated_at')
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null)
      .eq('status', 'available');

    if (type) {
      query = query.eq('type', type);
    }

    const { data: vehicles, error } = await query;

    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 });
    }

    const withDistance = (vehicles ?? [])
      .map((v: Vehicle) => ({
        ...v,
        distance_km: haversineDistance(lat, lng, v.current_latitude!, v.current_longitude!),
      }))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return NextResponse.json({
      origin: { lat, lng },
      vehicles: withDistance,
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/map/nearest:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
