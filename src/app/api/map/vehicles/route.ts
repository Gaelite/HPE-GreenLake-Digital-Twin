import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, name, type, status, plate_number, current_latitude, current_longitude, risk_score, make, model, year, specifications, created_at, updated_at')
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null);

    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 });
    }

    const vehicleList = vehicles ?? [];
    const vehicleIds = vehicleList.map((v: { id: string }) => v.id);

    // Fetch latest speed and fuel_level telemetry for each vehicle
    const telemetryMap: Record<string, { speed?: number; fuel_level?: number }> = {};

    if (vehicleIds.length > 0) {
      const { data: telemetry } = await supabase
        .from('telemetry_readings')
        .select('vehicle_id, metric_type, value')
        .in('vehicle_id', vehicleIds)
        .in('metric_type', ['speed', 'fuel_level'])
        .order('timestamp', { ascending: false })
        .limit(vehicleIds.length * 4); // 2 metrics * 2x buffer

      if (telemetry) {
        for (const row of telemetry) {
          if (!telemetryMap[row.vehicle_id]) {
            telemetryMap[row.vehicle_id] = {};
          }
          const entry = telemetryMap[row.vehicle_id];
          if (row.metric_type === 'speed' && entry.speed === undefined) {
            entry.speed = row.value;
          } else if (row.metric_type === 'fuel_level' && entry.fuel_level === undefined) {
            entry.fuel_level = row.value;
          }
        }
      }
    }

    // Fetch active incidents with assigned vehicles
    const { data: activeIncidents } = await supabase
      .from('incidents')
      .select('id, title, incident_type, status, assigned_vehicle_ids')
      .in('status', ['reported', 'dispatched', 'in_progress']);

    // Build a vehicle -> incident map
    const vehicleIncidentMap: Record<string, { id: string; title: string; incident_type: string; status: string }> = {};
    if (activeIncidents) {
      for (const inc of activeIncidents) {
        const assignedIds = (inc.assigned_vehicle_ids as string[]) || [];
        for (const vid of assignedIds) {
          vehicleIncidentMap[vid] = {
            id: inc.id,
            title: inc.title,
            incident_type: inc.incident_type,
            status: inc.status,
          };
        }
      }
    }

    // Merge telemetry and incident info into vehicle objects
    const enrichedVehicles = vehicleList.map((v: { id: string }) => ({
      ...v,
      _telemetry: telemetryMap[v.id] || null,
      _incident: vehicleIncidentMap[v.id] || null,
    }));

    return NextResponse.json({ vehicles: enrichedVehicles });
  } catch (err) {
    console.error('Unexpected error in GET /api/map/vehicles:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
