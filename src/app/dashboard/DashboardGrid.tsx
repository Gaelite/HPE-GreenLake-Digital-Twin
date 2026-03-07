'use client';

import type { Vehicle, TelemetryReading } from '@/types';
import VehicleTwinCard from '@/components/dashboard/VehicleTwinCard';

interface DashboardGridProps {
  vehicles: Vehicle[];
  telemetryMap: Record<string, Record<string, TelemetryReading>>;
}

export default function DashboardGrid({ vehicles, telemetryMap }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {vehicles.map((vehicle) => (
        <VehicleTwinCard
          key={vehicle.id}
          vehicle={vehicle}
          telemetry={telemetryMap[vehicle.id]}
        />
      ))}
    </div>
  );
}
