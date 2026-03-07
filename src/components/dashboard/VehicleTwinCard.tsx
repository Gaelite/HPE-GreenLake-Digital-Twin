'use client';

import { useRouter } from 'next/navigation';
import type { Vehicle, TelemetryReading, MetricType } from '@/types';
import VehicleTypeIcon from '@/components/fleet/VehicleTypeIcon';
import StatusBadge from '@/components/fleet/StatusBadge';
import MetricGauge from './MetricGauge';
import ReadinessScore from './ReadinessScore';
import StatusIndicator from './StatusIndicator';

interface VehicleTwinCardProps {
  vehicle: Vehicle;
  telemetry?: Record<string, TelemetryReading>;
}

export default function VehicleTwinCard({ vehicle, telemetry = {} }: VehicleTwinCardProps) {
  const router = useRouter();

  const speed = telemetry.speed?.value;
  const fuel = telemetry.fuel_level?.value;
  const engineTemp = telemetry.engine_temp?.value;

  // Compute a simple readiness score for the mini gauge
  const readinessScore = computeQuickReadiness(fuel, engineTemp, vehicle.risk_score);

  const riskColor =
    vehicle.risk_score >= 70
      ? 'text-red-600 bg-red-50'
      : vehicle.risk_score >= 40
      ? 'text-amber-600 bg-amber-50'
      : 'text-emerald-600 bg-emerald-50';

  return (
    <div
      onClick={() => router.push(`/dashboard/vehicle/${vehicle.id}`)}
      className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden"
    >
      {/* Dark header strip */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <VehicleTypeIcon type={vehicle.type} size="md" />
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">
              {vehicle.name}
            </h3>
            <p className="text-xs text-gray-400">{vehicle.plate_number}</p>
          </div>
        </div>
        <StatusBadge status={vehicle.status} size="sm" />
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <MetricGauge
            label="Speed"
            value={speed ?? 0}
            unit="km/h"
            min={0}
            max={200}
            warningThreshold={120}
            criticalThreshold={160}
            compact
          />
          <MetricGauge
            label="Fuel"
            value={fuel ?? 0}
            unit="%"
            min={0}
            max={100}
            warningThreshold={25}
            criticalThreshold={10}
            invertThresholds
            compact
          />
          <MetricGauge
            label="Temp"
            value={engineTemp ?? 0}
            unit={'\u00B0C'}
            min={0}
            max={150}
            warningThreshold={100}
            criticalThreshold={120}
            compact
          />
        </div>

        {/* Bottom row: risk score + readiness */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Risk</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${riskColor}`}
            >
              {vehicle.risk_score}
            </span>
          </div>
          <ReadinessScore score={readinessScore} size="sm" />
        </div>
      </div>

      {/* Hover indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    </div>
  );
}

function computeQuickReadiness(
  fuelLevel?: number,
  engineTemp?: number,
  riskScore?: number
): number {
  let score = 100;

  // Fuel check
  if (fuelLevel !== undefined) {
    if (fuelLevel <= 10) score -= 40;
    else if (fuelLevel <= 20) score -= 20;
    else if (fuelLevel <= 30) score -= 5;
  }

  // Engine temp check
  if (engineTemp !== undefined) {
    if (engineTemp >= 120) score -= 35;
    else if (engineTemp >= 100) score -= 15;
  }

  // Risk score impact
  if (riskScore !== undefined) {
    if (riskScore >= 70) score -= 25;
    else if (riskScore >= 40) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}
