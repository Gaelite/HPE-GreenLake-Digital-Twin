import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import VehicleDetailPanel from '@/components/dashboard/VehicleDetailPanel';
import type { Vehicle, TelemetryReading, VehicleEquipment, MetricType } from '@/types';
import PredictiveRiskCard from '@/components/dashboard/PredictiveRiskCard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('name')
    .eq('id', id)
    .single();

  return { title: vehicle?.name ?? 'Vehicle Details' };
}

const METRIC_TYPES: MetricType[] = [
  'speed',
  'engine_temp',
  'fuel_level',
  'tire_pressure',
  'battery_voltage',
  'rpm',
  'oil_pressure',
  'odometer',
];

export default async function VehicleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch vehicle
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single();

  if (vehicleError || !vehicle) {
    notFound();
  }

  const typedVehicle = vehicle as Vehicle;

  // Fetch latest telemetry per metric type
  const telemetryMap: Record<string, TelemetryReading> = {};

  for (const metricType of METRIC_TYPES) {
    const { data } = await supabase
      .from('telemetry_readings')
      .select('*')
      .eq('vehicle_id', id)
      .eq('metric_type', metricType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      telemetryMap[metricType] = data as TelemetryReading;
    }
  }

  // Fetch equipment
  const { data: equipment } = await supabase
    .from('vehicle_equipment')
    .select('*')
    .eq('vehicle_id', id)
    .order('category', { ascending: true });

  const typedEquipment: VehicleEquipment[] = (equipment ?? []) as VehicleEquipment[];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-800 font-medium">{typedVehicle.name}</span>
        </nav>

        {/* Detail panel with realtime */}
        <VehicleDetailPanel
          initialVehicle={typedVehicle}
          initialTelemetry={telemetryMap}
          equipment={typedEquipment}
        />
        <PredictiveRiskCard vehicleId={id} />
      </div>
    </AppShell>
  );
}
