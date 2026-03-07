'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Vehicle, VehicleType, VehicleStatus, VEHICLE_TYPE_LABELS } from '@/types';
import FleetTable from '@/components/fleet/FleetTable';
import FleetGrid from '@/components/fleet/FleetGrid';

interface FleetPageClientProps {
  vehicles: Vehicle[];
}

const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_service', label: 'In Service' },
  { value: 'en_route', label: 'En Route' },
  { value: 'at_scene', label: 'At Scene' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'offline', label: 'Offline' },
];

const TYPE_OPTIONS: VehicleType[] = [
  'police',
  'ambulance',
  'fire_truck',
  'civil_protection',
  'hybrid',
];

export default function FleetPageClient({ vehicles }: FleetPageClientProps) {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [typeFilter, setTypeFilter] = useState<VehicleType | ''>('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (typeFilter && v.type !== typeFilter) return false;
      if (statusFilter && v.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          v.plate_number.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vehicles, typeFilter, statusFilter, searchQuery]);

  // Summary stats
  const totalCount = vehicles.length;
  const availableCount = vehicles.filter((v) => v.status === 'available').length;
  const inServiceCount = vehicles.filter(
    (v) => v.status === 'in_service' || v.status === 'en_route' || v.status === 'at_scene'
  ).length;
  const maintenanceCount = vehicles.filter((v) => v.status === 'maintenance').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor your emergency vehicle fleet
          </p>
        </div>
        <Link
          href="/fleet/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Vehicle
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Vehicles</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Available</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{availableCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active Duty</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{inServiceCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Maintenance</p>
          <p className="mt-1 text-2xl font-bold text-gray-600">{maintenanceCount}</p>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as VehicleType | '')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {VEHICLE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | '')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Clear filters */}
          {(typeFilter || statusFilter || searchQuery) && (
            <button
              onClick={() => {
                setTypeFilter('');
                setStatusFilter('');
                setSearchQuery('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-gray-300 p-0.5">
          <button
            onClick={() => setView('table')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'table'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
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
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
          </button>
          <button
            onClick={() => setView('grid')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'grid'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
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
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        Showing {filteredVehicles.length} of {vehicles.length} vehicles
      </p>

      {/* Fleet View */}
      {view === 'table' ? (
        <FleetTable vehicles={filteredVehicles} />
      ) : (
        <FleetGrid vehicles={filteredVehicles} />
      )}
    </div>
  );
}
