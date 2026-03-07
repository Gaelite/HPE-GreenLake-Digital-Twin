import type { Metadata } from 'next';
import AppShell from '@/components/layout/AppShell';
import VehicleForm from '@/components/fleet/VehicleForm';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Add Vehicle' };

export default function NewVehiclePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
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
          <span className="text-gray-900 font-medium">Add Vehicle</span>
        </nav>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Vehicle</h1>
          <p className="mt-1 text-sm text-gray-500">
            Register a new emergency vehicle to the fleet
          </p>
        </div>

        {/* Form */}
        <VehicleForm mode="create" />
      </div>
    </AppShell>
  );
}
