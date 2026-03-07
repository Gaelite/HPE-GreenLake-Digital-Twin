import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EventType } from '@/types';

// ----- POST: Log a vehicle event -----
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.vehicle_id || !body.event_type) {
      return NextResponse.json(
        { error: 'vehicle_id and event_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        id: body.id,
        vehicle_id: body.vehicle_id,
        event_type: body.event_type,
        description: body.description || '',
        severity: body.severity || 'info',
        metadata: body.metadata || {},
        timestamp: body.timestamp || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Events POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error('[Events POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- GET: Query vehicle events -----
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const vehicleId = searchParams.get('vehicle_id');
    const eventType = searchParams.get('event_type') as EventType | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = supabase
      .from('events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    if (from) {
      query = query.gte('timestamp', from);
    }
    if (to) {
      query = query.lte('timestamp', to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Events GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    console.error('[Events GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
