import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

type ExportType = 'telemetry' | 'events' | 'anomalies';

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',');
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase } = auth as Exclude<typeof auth, { error: NextResponse }>;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as ExportType | null;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const vehicleId = searchParams.get('vehicle_id');

  if (!type || !['telemetry', 'events', 'anomalies'].includes(type)) {
    return NextResponse.json(
      { error: 'Invalid or missing type parameter. Must be: telemetry, events, or anomalies' },
      { status: 400 }
    );
  }

  try {
    const lines: string[] = [];

    if (type === 'telemetry') {
      // ----- Telemetry Export -----
      let query = supabase
        .from('telemetry_readings')
        .select('id, vehicle_id, metric_type, value, unit, latitude, longitude, timestamp')
        .order('timestamp', { ascending: false })
        .limit(10000);

      if (from) query = query.gte('timestamp', from);
      if (to) query = query.lte('timestamp', to);
      if (vehicleId) query = query.eq('vehicle_id', vehicleId);

      const { data, error } = await query;
      if (error) throw error;

      // Header
      lines.push('id,vehicle_id,metric_type,value,unit,latitude,longitude,timestamp');

      for (const row of data ?? []) {
        lines.push(
          toCsvRow([
            row.id,
            row.vehicle_id,
            row.metric_type,
            row.value,
            row.unit,
            row.latitude,
            row.longitude,
            row.timestamp,
          ])
        );
      }
    } else if (type === 'events') {
      // ----- Events Export -----
      let query = supabase
        .from('events')
        .select('id, vehicle_id, event_type, description, severity, timestamp')
        .order('timestamp', { ascending: false })
        .limit(10000);

      if (from) query = query.gte('timestamp', from);
      if (to) query = query.lte('timestamp', to);
      if (vehicleId) query = query.eq('vehicle_id', vehicleId);

      const { data, error } = await query;
      if (error) throw error;

      lines.push('id,vehicle_id,event_type,description,severity,timestamp');

      for (const row of data ?? []) {
        lines.push(
          toCsvRow([
            row.id,
            row.vehicle_id,
            row.event_type,
            row.description,
            row.severity,
            row.timestamp,
          ])
        );
      }
    } else if (type === 'anomalies') {
      // ----- Anomalies Export -----
      let query = supabase
        .from('anomalies')
        .select(
          'id, vehicle_id, anomaly_type, metric_type, actual_value, severity, status, description, timestamp, resolved_at'
        )
        .order('timestamp', { ascending: false })
        .limit(10000);

      if (from) query = query.gte('timestamp', from);
      if (to) query = query.lte('timestamp', to);
      if (vehicleId) query = query.eq('vehicle_id', vehicleId);

      const { data, error } = await query;
      if (error) throw error;

      lines.push(
        'id,vehicle_id,anomaly_type,metric_type,actual_value,severity,status,description,timestamp,resolved_at'
      );

      for (const row of data ?? []) {
        lines.push(
          toCsvRow([
            row.id,
            row.vehicle_id,
            row.anomaly_type,
            row.metric_type,
            row.actual_value,
            row.severity,
            row.status,
            row.description,
            row.timestamp,
            row.resolved_at,
          ])
        );
      }
    }

    const csv = lines.join('\n');
    const filename = `${type}_export_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
