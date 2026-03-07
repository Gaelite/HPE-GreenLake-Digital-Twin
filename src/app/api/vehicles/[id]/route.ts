import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { VehicleType } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/vehicles/[id] — fetch single vehicle by ID
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
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

// PUT /api/vehicles/[id] — update a vehicle (admin only)
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const auth = await requireAuth(['admin']);
    if ('error' in auth && auth.error) return auth.error;

    const { supabase } = auth;
    const body = await request.json();

    const { name, plate_number, type, year, make, model, status, specifications } = body;

    // Validate vehicle type if provided
    if (type) {
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
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (plate_number !== undefined) updateData.plate_number = plate_number;
    if (type !== undefined) updateData.type = type;
    if (year !== undefined) updateData.year = parseInt(String(year), 10);
    if (make !== undefined) updateData.make = make;
    if (model !== undefined) updateData.model = model;
    if (status !== undefined) updateData.status = status;
    if (specifications !== undefined) updateData.specifications = specifications;
    updateData.updated_at = new Date().toISOString();

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase!
      .from('vehicles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A vehicle with this plate number already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update vehicle' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
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

// DELETE /api/vehicles/[id] — delete a vehicle (admin only)
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const auth = await requireAuth(['admin']);
    if ('error' in auth && auth.error) return auth.error;

    const { supabase } = auth;

    const { error } = await supabase!
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting vehicle:', error);
      return NextResponse.json(
        { error: 'Failed to delete vehicle' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
