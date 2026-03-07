'use client';

import Link from 'next/link';
import type { Vehicle, VehicleType, VehicleStatus } from '@/types';

const TYPE_EMOJI: Record<VehicleType, string> = {
  police: '\uD83D\uDE93',
  ambulance: '\uD83D\uDE91',
  fire_truck: '\uD83D\uDE92',
  civil_protection: '\uD83D\uDEE1\uFE0F',
  hybrid: '\u2699\uFE0F',
};

const TYPE_LABELS: Record<VehicleType, string> = {
  police: 'Police',
  ambulance: 'Ambulance',
  fire_truck: 'Fire Truck',
  civil_protection: 'Civil Protection',
  hybrid: 'Hybrid',
};

const STATUS_BADGE: Record<VehicleStatus, { bg: string; text: string; label: string }> = {
  available: { bg: 'bg-green-100', text: 'text-green-800', label: 'Available' },
  in_service: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Service' },
  en_route: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En Route' },
  at_scene: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'At Scene' },
  maintenance: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Maintenance' },
  offline: { bg: 'bg-red-100', text: 'text-red-800', label: 'Offline' },
};

interface AssignedIncident {
  id: string;
  title: string;
  incident_type: string;
  status: string;
}

interface VehiclePopupProps {
  vehicle: Vehicle;
  speed?: number | null;
  fuelLevel?: number | null;
  assignedIncident?: AssignedIncident | null;
}

export default function VehiclePopup({ vehicle, speed, fuelLevel, assignedIncident }: VehiclePopupProps) {
  const status = STATUS_BADGE[vehicle.status] || STATUS_BADGE.offline;

  return (
    <div className="min-w-[220px] p-1">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xl">{TYPE_EMOJI[vehicle.type]}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{vehicle.name}</h3>
          <span
            className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Type badge */}
      <div className="mb-2">
        <span className="inline-block rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
          {TYPE_LABELS[vehicle.type]}
        </span>
        <span className="ml-1 text-[10px] text-gray-500">{vehicle.plate_number}</span>
      </div>

      {/* Metrics */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-gray-50 p-2">
          <p className="text-[10px] text-gray-500">Speed</p>
          <p className="text-sm font-semibold text-gray-900">
            {speed != null ? `${Math.round(speed)} km/h` : '--'}
          </p>
        </div>
        <div className="rounded-md bg-gray-50 p-2">
          <p className="text-[10px] text-gray-500">Fuel</p>
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-gray-900">
              {fuelLevel != null ? `${Math.round(fuelLevel)}%` : '--'}
            </p>
            {fuelLevel != null && fuelLevel < 25 && (
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" title="Low fuel" />
            )}
          </div>
        </div>
      </div>

      {/* Assigned incident */}
      {assignedIncident && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2">
          <p className="text-[10px] font-medium text-amber-800 uppercase tracking-wide">
            {vehicle.status === 'en_route' ? 'En Route To' : vehicle.status === 'at_scene' ? 'At Scene' : 'Assigned'}
          </p>
          <p className="text-xs font-semibold text-amber-900 mt-0.5 truncate">{assignedIncident.title}</p>
          <span className="inline-block mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
            {assignedIncident.incident_type} &middot; {assignedIncident.status}
          </span>
        </div>
      )}

      {/* Risk score */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Risk Score</span>
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              vehicle.risk_score > 70
                ? 'bg-red-500'
                : vehicle.risk_score > 40
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(vehicle.risk_score, 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-gray-700">{vehicle.risk_score}</span>
      </div>

      {/* Action link */}
      <Link
        href={`/dashboard/vehicle/${vehicle.id}`}
        className="block w-full rounded-md bg-indigo-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
      >
        View Digital Twin
      </Link>
    </div>
  );
}
