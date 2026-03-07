import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { MetricType, TelemetryReading } from '@/types';

const VALID_METRIC_TYPES: MetricType[] = [
  'speed',
  'engine_temp',
  'fuel_level',
  'tire_pressure',
  'battery_voltage',
  'rpm',
  'oil_pressure',
  'odometer',
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vehicles/[id]/telemetry
 *
 * Query params:
 *   - metric_type: filter to a specific metric type (optional)
 *   - limit: number of readings per metric type (default: 1 = latest only)
 *
 * Returns: object keyed by metric_type, each containing an array of readings
 * Example: { "speed": [{ ... }], "fuel_level": [{ ... }] }
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase } = auth;
  if (!supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: vehicleId } = await context.params;
  const { searchParams } = request.nextUrl;
  const metricTypeParam = searchParams.get('metric_type');
  const limitParam = searchParams.get('limit');
  const limit = Math.max(1, Math.min(100, parseInt(limitParam ?? '1', 10) || 1));

  // Validate metric_type if provided
  if (metricTypeParam && !VALID_METRIC_TYPES.includes(metricTypeParam as MetricType)) {
    return NextResponse.json(
      {
        error: `Invalid metric_type. Must be one of: ${VALID_METRIC_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  // Verify vehicle exists
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .single();

  if (vehicleError || !vehicle) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
  }

  const metricTypes: MetricType[] = metricTypeParam
    ? [metricTypeParam as MetricType]
    : VALID_METRIC_TYPES;

  // Build result object keyed by metric_type
  const result: Record<string, TelemetryReading[]> = {};

  for (const metricType of metricTypes) {
    const { data, error } = await supabase
      .from('telemetry_readings')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('metric_type', metricType)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching ${metricType} telemetry:`, error);
      result[metricType] = [];
    } else {
      result[metricType] = (data ?? []) as TelemetryReading[];
    }
  }

  return NextResponse.json(result);
}
