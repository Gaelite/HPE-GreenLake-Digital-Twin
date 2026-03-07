import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import type { Vehicle, TelemetryReading, MetricType } from '@/types';
import DashboardGrid from './DashboardGrid';
import FleetMLReport from '@/components/telemetry/FleetMLReport'; 
import SimulationControls from '@/components/telemetry/SimulationControls';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const METRIC_TYPES: MetricType[] = [
  'speed',
  'engine_temp',
  'fuel_level',
  'tire_pressure',
  'battery_voltage',
  'rpm',
  'oil_pressure',
];

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch all vehicles
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('*')
    .order('name', { ascending: true });

  if (vehiclesError) {
    console.error('Error fetching vehicles:', vehiclesError);
  }

  const vehicleList: Vehicle[] = (vehicles ?? []) as Vehicle[];

  // Fetch latest telemetry per vehicle
  // We get the latest reading for each metric type for each vehicle
  const telemetryMap: Record<string, Record<string, TelemetryReading>> = {};

  if (vehicleList.length > 0) {
    // Batch fetch: get recent telemetry for all vehicles, ordered by timestamp desc
    // We fetch enough to cover all metric types for all vehicles
    const { data: telemetryData } = await supabase
      .from('telemetry_readings')
      .select('*')
      .in(
        'vehicle_id',
        vehicleList.map((v) => v.id)
      )
      .in('metric_type', METRIC_TYPES)
      .order('timestamp', { ascending: false })
      .limit(vehicleList.length * METRIC_TYPES.length * 2);

    if (telemetryData) {
      for (const reading of telemetryData as TelemetryReading[]) {
        if (!telemetryMap[reading.vehicle_id]) {
          telemetryMap[reading.vehicle_id] = {};
        }
        // Only keep the first (most recent) reading per metric type
        if (!telemetryMap[reading.vehicle_id][reading.metric_type]) {
          telemetryMap[reading.vehicle_id][reading.metric_type] = reading;
        }
      }
    }
  }

  // Compute fleet summary stats
  const totalVehicles = vehicleList.length;
  const inService = vehicleList.filter(
    (v) => v.status === 'in_service' || v.status === 'en_route' || v.status === 'at_scene'
  ).length;
  const available = vehicleList.filter((v) => v.status === 'available').length;
  const maintenance = vehicleList.filter((v) => v.status === 'maintenance').length;
  const offline = vehicleList.filter((v) => v.status === 'offline').length;
  const alertCount = vehicleList.filter((v) => v.risk_score >= 60).length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time digital twin overview of all emergency vehicles
          </p>
        </div>

        {/* Fleet summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard
            label="Total Vehicles"
            value={totalVehicles}
            icon="🚒"
            color="bg-gray-900 text-white"
          />
          <SummaryCard
            label="In Service"
            value={inService}
            icon="🟢"
            color="bg-blue-600 text-white"
          />
          <SummaryCard
            label="Available"
            value={available}
            icon="✓"
            color="bg-emerald-600 text-white"
          />
          <SummaryCard
            label="Maintenance"
            value={maintenance}
            icon="🔧"
            color="bg-gray-500 text-white"
          />
          <SummaryCard
            label="Alerts"
            value={alertCount}
            icon="⚠"
            color={alertCount > 0 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}
          />
        </div>

        {/* Simulation controls */}
        <div className="grid grid-cols-2 gap-4 max-w-2xl items-stretch">
          <SimulationControls />
          <FleetMLReport
            vehicleIds={vehicleList.map((v) => ({
              id:   v.id,
              name: v.name,
              type: v.type,
            }))}
          />
        </div>

        {/* Vehicle grid */}
        {vehicleList.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No vehicles found</p>
            <p className="text-gray-400 text-sm mt-1">
              Add vehicles to your fleet to see them here.
            </p>
          </div>
        ) : (
          <DashboardGrid vehicles={vehicleList} telemetryMap={telemetryMap} />
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-4 shadow-sm ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <p className="text-sm mt-2 opacity-80">{label}</p>
    </div>
  );
}
