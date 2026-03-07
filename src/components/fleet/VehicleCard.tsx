'use client';

import { useRouter } from 'next/navigation';
import { Vehicle, VEHICLE_TYPE_LABELS } from '@/types';
import StatusBadge from './StatusBadge';
import VehicleTypeIcon from './VehicleTypeIcon';

interface VehicleCardProps {
  vehicle: Vehicle;
}

function getRiskColor(score: number): string {
  if (score <= 30) return 'text-green-600';
  if (score <= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getRiskBg(score: number): string {
  if (score <= 30) return 'bg-green-50';
  if (score <= 60) return 'bg-yellow-50';
  return 'bg-red-50';
}

export default function VehicleCard({ vehicle }: VehicleCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/fleet/${vehicle.id}`)}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
            <VehicleTypeIcon type={vehicle.type} size="md" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {vehicle.name}
            </h3>
            <p className="text-sm text-gray-500">
              {VEHICLE_TYPE_LABELS[vehicle.type]}
            </p>
          </div>
        </div>
        <StatusBadge status={vehicle.status} size="sm" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Plate</p>
          <p className="text-sm font-medium text-gray-900">
            {vehicle.plate_number}
          </p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${getRiskBg(vehicle.risk_score)}`}>
          <p className="text-xs text-gray-500">Risk Score</p>
          <p className={`text-sm font-bold ${getRiskColor(vehicle.risk_score)}`}>
            {vehicle.risk_score}/100
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </span>
        <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
          View Details &rarr;
        </span>
      </div>
    </div>
  );
}
