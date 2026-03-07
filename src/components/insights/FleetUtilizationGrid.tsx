'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { VehicleType, VehicleStatus } from '@/types';

interface VehicleCell {
  id: string;
  name: string;
  type: VehicleType;
  status: VehicleStatus;
  plate_number: string;
  utilization: number; // 0–100
  dispatches: number;
}

const VEHICLE_TYPE_ICONS: Record<VehicleType, string> = {
  police: '\u{1F693}',
  ambulance: '\u{1F691}',
  fire_truck: '\u{1F692}',
  civil_protection: '\u{1F6E1}',
  hybrid: '\u{1F697}',
};

function getUtilizationColor(utilization: number): {
  bg: string;
  ring: string;
  text: string;
  label: string;
} {
  if (utilization >= 70) {
    return {
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-200 hover:ring-emerald-300',
      text: 'text-emerald-700',
      label: 'High',
    };
  }
  if (utilization >= 35) {
    return {
      bg: 'bg-amber-50',
      ring: 'ring-amber-200 hover:ring-amber-300',
      text: 'text-amber-700',
      label: 'Medium',
    };
  }
  return {
    bg: 'bg-red-50',
    ring: 'ring-red-200 hover:ring-red-300',
    text: 'text-red-700',
    label: 'Low',
  };
}

function getStatusDot(status: VehicleStatus): string {
  const colors: Record<VehicleStatus, string> = {
    available: 'bg-green-400',
    in_service: 'bg-blue-400',
    en_route: 'bg-yellow-400',
    at_scene: 'bg-orange-400',
    maintenance: 'bg-gray-400',
    offline: 'bg-red-400',
  };
  return colors[status] ?? 'bg-gray-400';
}

export default function FleetUtilizationGrid() {
  const [vehicles, setVehicles] = useState<VehicleCell[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const supabase = createClient();

      const [vehiclesRes, eventsRes] = await Promise.all([
        supabase.from('vehicles').select('id, name, type, status, plate_number'),
        supabase
          .from('events')
          .select('vehicle_id, event_type, timestamp')
          .eq('event_type', 'dispatch')
          .gte(
            'timestamp',
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          ),
      ]);

      const vehiclesList = vehiclesRes.data ?? [];
      const eventsList = eventsRes.data ?? [];

      // Count dispatches per vehicle in last 30 days
      const dispatchCounts: Record<string, number> = {};
      for (const e of eventsList) {
        dispatchCounts[e.vehicle_id] = (dispatchCounts[e.vehicle_id] ?? 0) + 1;
      }

      // Max dispatches for relative utilization
      const maxDispatches = Math.max(1, ...Object.values(dispatchCounts));

      const cells: VehicleCell[] = vehiclesList.map((v) => {
        const dispatches = dispatchCounts[v.id] ?? 0;
        // Utilization: relative to max + bonus for being in active status
        let utilization = Math.round((dispatches / maxDispatches) * 80);
        if (['in_service', 'en_route', 'at_scene'].includes(v.status)) {
          utilization = Math.min(100, utilization + 20);
        }
        if (v.status === 'offline' || v.status === 'maintenance') {
          utilization = 0;
        }

        return {
          id: v.id,
          name: v.name,
          type: v.type as VehicleType,
          status: v.status as VehicleStatus,
          plate_number: v.plate_number,
          utilization,
          dispatches,
        };
      });

      // Sort by utilization descending
      cells.sort((a, b) => b.utilization - a.utilization);
      setVehicles(cells);
    } catch (err) {
      console.error('Failed to fetch fleet utilization:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Poll every 15 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(false), 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
        <div className="mb-4">
          <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-56 rounded bg-gray-100 animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Fleet Utilization Overview
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Click any vehicle for detailed analytics. Color indicates utilization level (30-day window).
          </p>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            Low
          </span>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          <p className="text-sm">No vehicles found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {vehicles.map((vehicle) => {
            const colors = getUtilizationColor(vehicle.utilization);
            return (
              <button
                key={vehicle.id}
                onClick={() => router.push(`/insights/vehicle/${vehicle.id}`)}
                className={`relative rounded-lg ${colors.bg} ring-1 ${colors.ring} p-3 text-left transition-all hover:shadow-md cursor-pointer`}
              >
                {/* Status dot */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`block h-2 w-2 rounded-full ${getStatusDot(vehicle.status)}`}
                    title={vehicle.status}
                  />
                </div>

                {/* Vehicle icon + name */}
                <div className="text-lg mb-1">
                  {VEHICLE_TYPE_ICONS[vehicle.type]}
                </div>
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {vehicle.name}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {vehicle.plate_number}
                </p>

                {/* Utilization bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[10px] font-semibold ${colors.text}`}>
                      {vehicle.utilization}%
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {vehicle.dispatches}d
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        vehicle.utilization >= 70
                          ? 'bg-emerald-500'
                          : vehicle.utilization >= 35
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${vehicle.utilization}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
