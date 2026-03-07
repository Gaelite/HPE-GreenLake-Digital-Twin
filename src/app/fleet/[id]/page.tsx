import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import VehicleForm from '@/components/fleet/VehicleForm';
import VehicleDetailClient from './VehicleDetailClient';
import MaintenanceSection from './MaintenanceSection';
import EquipmentSection from './EquipmentSection';
import type { Vehicle, MaintenanceRecord, VehicleEquipment } from '@/types';

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

  // Fetch maintenance records
  const { data: maintenanceRecords } = await supabase
    .from('maintenance_records')
    .select('*')
    .eq('vehicle_id', id)
    .order('scheduled_date', { ascending: false });

  // Fetch equipment
  const { data: equipment } = await supabase
    .from('vehicle_equipment')
    .select('*')
    .eq('vehicle_id', id)
    .order('equipment_name', { ascending: true });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/fleet" className="hover:text-gray-700 transition-colors">
            Fleet
          </Link>
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-gray-900 font-medium">
            {(vehicle as Vehicle).name}
          </span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {(vehicle as Vehicle).name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Edit vehicle details, view maintenance history and equipment
            </p>
          </div>
          <VehicleDetailClient vehicleId={id} />
        </div>

        {/* Edit Form */}
        <VehicleForm vehicle={vehicle as Vehicle} mode="edit" />

        {/* Maintenance Records */}
        <MaintenanceSection records={(maintenanceRecords ?? []) as MaintenanceRecord[]} />

        {/* Equipment */}
        <EquipmentSection equipment={(equipment ?? []) as VehicleEquipment[]} />
      </div>
    </AppShell>
  );
}
