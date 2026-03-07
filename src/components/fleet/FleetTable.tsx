'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Vehicle, VEHICLE_TYPE_LABELS } from '@/types';
import StatusBadge from './StatusBadge';
import VehicleTypeIcon from './VehicleTypeIcon';

type SortField = 'name' | 'type' | 'plate_number' | 'status' | 'risk_score';
type SortDirection = 'asc' | 'desc';

interface FleetTableProps {
  vehicles: Vehicle[];
}

export default function FleetTable({ vehicles }: FleetTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'type':
          aVal = VEHICLE_TYPE_LABELS[a.type];
          bVal = VEHICLE_TYPE_LABELS[b.type];
          break;
        case 'plate_number':
          aVal = a.plate_number.toLowerCase();
          bVal = b.plate_number.toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'risk_score':
          aVal = a.risk_score;
          bVal = b.risk_score;
          break;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [vehicles, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg
          className="ml-1 h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return (
      <svg
        className="ml-1 h-4 w-4 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
        />
      </svg>
    );
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-700 bg-green-50';
    if (score <= 60) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  if (vehicles.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-gray-500">No vehicles found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                { field: 'name' as SortField, label: 'Vehicle Name' },
                { field: 'type' as SortField, label: 'Type' },
                { field: 'plate_number' as SortField, label: 'Plate' },
                { field: 'status' as SortField, label: 'Status' },
                { field: 'risk_score' as SortField, label: 'Risk Score' },
              ].map(({ field, label }) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-900 select-none"
                >
                  <div className="flex items-center">
                    {label}
                    <SortIcon field={field} />
                  </div>
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedVehicles.map((vehicle) => (
              <tr
                key={vehicle.id}
                onClick={() => router.push(`/fleet/${vehicle.id}`)}
                className="cursor-pointer transition-colors hover:bg-gray-50"
              >
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                      <VehicleTypeIcon type={vehicle.type} size="sm" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{vehicle.name}</p>
                      <p className="text-xs text-gray-500">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {VEHICLE_TYPE_LABELS[vehicle.type]}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-sm font-mono text-gray-800">
                    {vehicle.plate_number}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={vehicle.status} size="sm" />
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-bold ${getRiskColor(
                      vehicle.risk_score
                    )}`}
                  >
                    {vehicle.risk_score}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/fleet/${vehicle.id}`);
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
