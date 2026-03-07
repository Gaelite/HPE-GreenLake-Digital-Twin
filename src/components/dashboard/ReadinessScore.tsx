'use client';

import { useMemo } from 'react';
import type { VehicleEquipment, TelemetryReading } from '@/types';

interface ReadinessScoreProps {
  /** Direct score override (0-100). If provided, other props are ignored. */
  score?: number;
  /** Fuel level reading for calculation */
  fuelLevel?: number;
  /** Equipment list for calculation */
  equipment?: VehicleEquipment[];
  /** Whether there are active critical anomalies */
  hasCriticalAnomalies?: boolean;
  /** Engine temperature for health check */
  engineTemp?: number;
  /** Size of the circular gauge */
  size?: 'sm' | 'md' | 'lg';
}

export default function ReadinessScore({
  score: scoreProp,
  fuelLevel,
  equipment = [],
  hasCriticalAnomalies = false,
  engineTemp,
  size = 'lg',
}: ReadinessScoreProps) {
  const computedScore = useMemo(() => {
    if (scoreProp !== undefined) return Math.max(0, Math.min(100, scoreProp));

    let points = 0;
    let maxPoints = 0;

    // Fuel check: > 20% = full points, > 10% = half, else 0
    maxPoints += 25;
    if (fuelLevel !== undefined) {
      if (fuelLevel > 20) points += 25;
      else if (fuelLevel > 10) points += 12;
    }

    // Equipment: all operational = full points
    maxPoints += 35;
    if (equipment.length > 0) {
      const operational = equipment.filter((e) => e.status === 'operational').length;
      points += Math.round((operational / equipment.length) * 35);
    } else {
      points += 35; // No equipment data = assume OK
    }

    // No critical anomalies
    maxPoints += 20;
    if (!hasCriticalAnomalies) points += 20;

    // Engine temp within normal range (< 100C)
    maxPoints += 20;
    if (engineTemp !== undefined) {
      if (engineTemp < 100) points += 20;
      else if (engineTemp < 110) points += 10;
    } else {
      points += 20; // No data = assume OK
    }

    return maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  }, [scoreProp, fuelLevel, equipment, hasCriticalAnomalies, engineTemp]);

  const color = useMemo(() => {
    if (computedScore > 70) return { stroke: '#10b981', text: 'text-emerald-600', label: 'Good' };
    if (computedScore > 40) return { stroke: '#f59e0b', text: 'text-amber-600', label: 'Fair' };
    return { stroke: '#ef4444', text: 'text-red-600', label: 'Critical' };
  }, [computedScore]);

  const dimensions = {
    sm: { svgSize: 80, radius: 30, strokeWidth: 6, fontSize: 16, labelSize: 8 },
    md: { svgSize: 120, radius: 46, strokeWidth: 8, fontSize: 24, labelSize: 10 },
    lg: { svgSize: 160, radius: 62, strokeWidth: 10, fontSize: 32, labelSize: 12 },
  };

  const d = dimensions[size];
  const circumference = 2 * Math.PI * d.radius;
  const dashOffset = circumference - (computedScore / 100) * circumference;
  const center = d.svgSize / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg
          width={d.svgSize}
          height={d.svgSize}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={d.radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={d.strokeWidth}
          />
          {/* Value circle */}
          <circle
            cx={center}
            cy={center}
            r={d.radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={d.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold ${color.text}`}
            style={{ fontSize: `${d.fontSize}px`, lineHeight: 1 }}
          >
            {computedScore}
          </span>
          <span
            className="text-gray-400 font-medium"
            style={{ fontSize: `${d.labelSize}px` }}
          >
            %
          </span>
        </div>
      </div>
      {size !== 'sm' && (
        <div className="text-center">
          <p className={`text-sm font-semibold ${color.text}`}>{color.label}</p>
          <p className="text-xs text-gray-500">Operational Readiness</p>
        </div>
      )}
    </div>
  );
}
