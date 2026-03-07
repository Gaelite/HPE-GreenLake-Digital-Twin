'use client';

import { Vehicle } from '@/types';
import VehicleCard from './VehicleCard';

interface FleetGridProps {
  vehicles: Vehicle[];
}

export default function FleetGrid({ vehicles }: FleetGridProps) {
  if (vehicles.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-gray-500">No vehicles found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  );
}
