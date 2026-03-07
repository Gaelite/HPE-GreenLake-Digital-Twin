import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { ZoneType } from '@/types';

// GET — list active geofences
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: geofences, error } = await supabase
      .from('geofences')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching geofences:', error);
      return NextResponse.json({ error: 'Failed to fetch geofences' }, { status: 500 });
    }

    return NextResponse.json({ geofences: geofences ?? [] });
  } catch (err) {
    console.error('Unexpected error in GET /api/geofences:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a new geofence (admin only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['admin']);
    if ('error' in auth && auth.error) return auth.error;

    const body = await request.json();

    const {
      name,
      description,
      zone_type,
      coordinates,
      color,
    } = body as {
      name?: string;
      description?: string;
      zone_type?: ZoneType;
      coordinates?: GeoJSON.Polygon;
      color?: string;
    };

    // Validation
    if (!name || !zone_type || !coordinates) {
      return NextResponse.json(
        { error: 'Missing required fields: name, zone_type, coordinates' },
        { status: 400 },
      );
    }

    const validTypes: ZoneType[] = ['district', 'high_risk', 'restricted', 'coverage'];
    if (!validTypes.includes(zone_type)) {
      return NextResponse.json(
        { error: `Invalid zone_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Basic GeoJSON Polygon validation
    if (
      !coordinates.type ||
      coordinates.type !== 'Polygon' ||
      !Array.isArray(coordinates.coordinates) ||
      coordinates.coordinates.length === 0
    ) {
      return NextResponse.json(
        { error: 'coordinates must be a valid GeoJSON Polygon' },
        { status: 400 },
      );
    }

    const supabase = auth.supabase!;

    const { data: geofence, error } = await supabase
      .from('geofences')
      .insert({
        name,
        description: description || '',
        zone_type,
        coordinates,
        color: color || '#3B82F6',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating geofence:', error);
      return NextResponse.json({ error: 'Failed to create geofence' }, { status: 500 });
    }

    return NextResponse.json({ geofence }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/geofences:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
