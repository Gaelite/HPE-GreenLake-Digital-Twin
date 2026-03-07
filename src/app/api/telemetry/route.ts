import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MetricType } from '@/types';

// ----- POST: Ingest a batch of telemetry readings -----
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Accept both a single reading and an array
    const readings = Array.isArray(body) ? body : [body];

    if (readings.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain at least one telemetry reading' },
        { status: 400 }
      );
    }

    // Validate required fields on each reading
    for (const r of readings) {
      if (!r.vehicle_id || !r.metric_type || r.value === undefined) {
        return NextResponse.json(
          { error: 'Each reading must include vehicle_id, metric_type, and value' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('telemetry_readings')
      .insert(readings)
      .select();

    if (error) {
      console.error('[Telemetry POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count: data.length }, { status: 201 });
  } catch (err) {
    console.error('[Telemetry POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- GET: Query telemetry readings -----
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const vehicleId = searchParams.get('vehicle_id');
    const metricType = searchParams.get('metric_type') as MetricType | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let query = supabase
      .from('telemetry_readings')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }
    if (metricType) {
      query = query.eq('metric_type', metricType);
    }
    if (from) {
      query = query.gte('timestamp', from);
    }
    if (to) {
      query = query.lte('timestamp', to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Telemetry GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    console.error('[Telemetry GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
