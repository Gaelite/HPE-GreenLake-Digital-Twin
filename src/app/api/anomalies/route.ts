import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

/**
 * GET /api/anomalies
 *
 * List anomalies with optional filters:
 *  - vehicle_id: filter by vehicle
 *  - severity: 'info' | 'warning' | 'critical'
 *  - status: 'active' | 'acknowledged' | 'resolved'
 *  - limit: max number of results (default 100)
 *  - offset: pagination offset (default 0)
 *
 * Results are ordered by timestamp DESC (most recent first).
 * Includes joined vehicle name for display convenience.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const vehicleId = searchParams.get('vehicle_id');
  const severity = searchParams.get('severity');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = supabase!
    .from('anomalies')
    .select('*, vehicles(name, plate_number, type)', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  if (severity && ['info', 'warning', 'critical'].includes(severity)) {
    query = query.eq('severity', severity);
  }

  if (status && ['active', 'acknowledged', 'resolved'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch anomalies', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, count });
}
