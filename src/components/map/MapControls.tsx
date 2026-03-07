'use client';

import { useState } from 'react';
import type { VehicleType, VehicleStatus } from '@/types';

const VEHICLE_TYPES: { value: VehicleType; label: string; emoji: string }[] = [
  { value: 'police', label: 'Police', emoji: '\uD83D\uDE93' },
  { value: 'ambulance', label: 'Ambulance', emoji: '\uD83D\uDE91' },
  { value: 'fire_truck', label: 'Fire Truck', emoji: '\uD83D\uDE92' },
  { value: 'civil_protection', label: 'Civil Protection', emoji: '\uD83D\uDEE1\uFE0F' },
  { value: 'hybrid', label: 'Hybrid', emoji: '\u2699\uFE0F' },
];

const VEHICLE_STATUSES: { value: VehicleStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: 'bg-green-500' },
  { value: 'in_service', label: 'In Service', color: 'bg-blue-500' },
  { value: 'en_route', label: 'En Route', color: 'bg-yellow-500' },
  { value: 'at_scene', label: 'At Scene', color: 'bg-orange-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-gray-500' },
  { value: 'offline', label: 'Offline', color: 'bg-red-500' },
];

export interface MapFilters {
  vehicleTypes: Set<VehicleType>;
  vehicleStatuses: Set<VehicleStatus>;
  showVehicles: boolean;
  showIncidents: boolean;
  showGeofences: boolean;
}

interface MapControlsProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  vehicleCount: number;
  incidentCount: number;
}

export default function MapControls({
  filters,
  onFiltersChange,
  vehicleCount,
  incidentCount,
}: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleVehicleType = (type: VehicleType) => {
    const next = new Set(filters.vehicleTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onFiltersChange({ ...filters, vehicleTypes: next });
  };

  const toggleStatus = (status: VehicleStatus) => {
    const next = new Set(filters.vehicleStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onFiltersChange({ ...filters, vehicleStatuses: next });
  };

  const toggleLayer = (layer: 'showVehicles' | 'showIncidents' | 'showGeofences') => {
    onFiltersChange({ ...filters, [layer]: !filters[layer] });
  };

  return (
    <div className="absolute right-3 top-3 z-[1000] w-64">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-1 ml-auto flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-lg hover:bg-gray-50 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        {isExpanded ? 'Hide Controls' : 'Map Controls'}
      </button>

      {isExpanded && (
        <div className="rounded-xl bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200 overflow-hidden">
          {/* Summary bar */}
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              {vehicleCount} vehicles
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              {incidentCount} incidents
            </span>
          </div>

          {/* Layers */}
          <div className="border-b border-gray-100 px-4 py-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Layers
            </h4>
            <div className="flex flex-col gap-1.5">
              {[
                { key: 'showVehicles' as const, label: 'Vehicles', icon: '\uD83D\uDE97' },
                { key: 'showIncidents' as const, label: 'Incidents', icon: '\uD83D\uDEA8' },
                { key: 'showGeofences' as const, label: 'Geofences', icon: '\uD83D\uDDFA\uFE0F' },
              ].map(({ key, label, icon }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters[key]}
                    onChange={() => toggleLayer(key)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">{icon}</span>
                  <span className="text-xs text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Vehicle type filters */}
          <div className="border-b border-gray-100 px-4 py-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Vehicle Type
            </h4>
            <div className="flex flex-col gap-1">
              {VEHICLE_TYPES.map(({ value, label, emoji }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.vehicleTypes.has(value)}
                    onChange={() => toggleVehicleType(value)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">{emoji}</span>
                  <span className="text-xs text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status filters */}
          <div className="px-4 py-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Status
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {VEHICLE_STATUSES.map(({ value, label, color }) => {
                const active = filters.vehicleStatuses.has(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleStatus(value)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                      active
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
