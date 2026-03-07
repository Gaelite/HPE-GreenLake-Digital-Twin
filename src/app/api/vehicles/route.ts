import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { VehicleType, VehicleStatus } from '@/types';

// GET /api/vehicles — list all vehicles with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const typeFilter = searchParams.get('type') as VehicleType | null;
    const statusFilter = searchParams.get('status') as VehicleStatus | null;

    let query = supabase
      .from('vehicles')
      .select('*')
      .order('name', { ascending: true });

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json(
        { error: 'Failed to fetch vehicles' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/vehicles — create a new vehicle (admin only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['admin']);
    if ('error' in auth && auth.error) return auth.error;

    const { supabase } = auth;
    const body = await request.json();

    const { name, plate_number, type, year, make, model, status, specifications } = body;

    // Validate required fields
    if (!name || !plate_number || !type || !year || !make || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: name, plate_number, type, year, make, model' },
        { status: 400 }
      );
    }

    // Validate vehicle type
    const validTypes: VehicleType[] = [
      'police',
      'ambulance',
      'fire_truck',
      'civil_protection',
      'hybrid',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid vehicle type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase!
      .from('vehicles')
      .insert({
        name,
        plate_number,
        type,
        year: parseInt(year, 10),
        make,
        model,
        status: status || 'available',
        specifications: specifications || {},
        risk_score: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating vehicle:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A vehicle with this plate number already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create vehicle' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
