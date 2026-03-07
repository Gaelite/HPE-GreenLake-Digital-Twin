'use client';

import { useMemo } from 'react';

interface MetricGaugeProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  warningThreshold: number;
  criticalThreshold: number;
  /** If true, values BELOW thresholds are bad (e.g. fuel level, battery voltage) */
  invertThresholds?: boolean;
  /** Compact mode for card-level display */
  compact?: boolean;
}

export default function MetricGauge({
  label,
  value,
  unit,
  min,
  max,
  warningThreshold,
  criticalThreshold,
  invertThresholds = false,
  compact = false,
}: MetricGaugeProps) {
  const clampedValue = Math.max(min, Math.min(max, value));
  const percentage = ((clampedValue - min) / (max - min)) * 100;

  const color = useMemo(() => {
    if (invertThresholds) {
      // Lower is worse (fuel, battery)
      if (value <= criticalThreshold) return 'critical';
      if (value <= warningThreshold) return 'warning';
      return 'normal';
    } else {
      // Higher is worse (temp, RPM)
      if (value >= criticalThreshold) return 'critical';
      if (value >= warningThreshold) return 'warning';
      return 'normal';
    }
  }, [value, warningThreshold, criticalThreshold, invertThresholds]);

  const colorClasses = {
    normal: {
      bar: 'bg-emerald-500',
      text: 'text-emerald-600',
      glow: 'shadow-emerald-500/20',
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-200',
    },
    warning: {
      bar: 'bg-amber-500',
      text: 'text-amber-600',
      glow: 'shadow-amber-500/20',
      bg: 'bg-amber-50',
      ring: 'ring-amber-200',
    },
    critical: {
      bar: 'bg-red-500',
      text: 'text-red-600',
      glow: 'shadow-red-500/20',
      bg: 'bg-red-50',
      ring: 'ring-red-200',
    },
  };

  const c = colorClasses[color];

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500 truncate">{label}</span>
          <span className={`text-sm font-semibold ${c.text}`}>
            {value.toFixed(value % 1 === 0 ? 0 : 1)}
            <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${c.bar}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  // Format large numbers for gauge labels
  function formatLabel(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(n);
  }

  // Full gauge display
  // Arc gauge using SVG
  const radius = 50;
  const strokeWidth = 10;
  const center = 60;
  const startAngle = 135;
  const endAngle = 405;
  const totalArc = endAngle - startAngle;
  const valueAngle = startAngle + (percentage / 100) * totalArc;

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, r: number, startA: number, endA: number) {
    const start = polarToCartesian(cx, cy, r, endA);
    const end = polarToCartesian(cx, cy, r, startA);
    const largeArc = endA - startA > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  const bgArcPath = describeArc(center, center, radius, startAngle, endAngle);
  const valueArcPath =
    percentage > 0.5
      ? describeArc(center, center, radius, startAngle, valueAngle)
      : '';

  return (
    <div
      className={`relative flex flex-col items-center p-4 rounded-xl ring-1 ${c.ring} ${c.bg} transition-colors duration-300`}
    >
      <svg viewBox="0 0 120 90" className="w-full max-w-[160px]">
        {/* Background arc */}
        <path
          d={bgArcPath}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {valueArcPath && (
          <path
            d={valueArcPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={
              color === 'normal'
                ? 'text-emerald-500'
                : color === 'warning'
                ? 'text-amber-500'
                : 'text-red-500'
            }
          />
        )}

        {/* Center text */}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          style={{ fontSize: '20px', fontWeight: 700 }}
          fill="currentColor"
          className={
            color === 'normal'
              ? 'text-emerald-600'
              : color === 'warning'
              ? 'text-amber-600'
              : 'text-red-600'
          }
        >
          {value.toFixed(value % 1 === 0 ? 0 : 1)}
        </text>
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          style={{ fontSize: '10px' }}
          fill="#9ca3af"
        >
          {unit}
        </text>
      </svg>

      {/* Min / Max labels + metric name below the gauge */}
      <div className="flex items-center justify-between w-full px-1 -mt-1">
        <span className="text-[10px] text-gray-400">{formatLabel(min)}</span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-[10px] text-gray-400">{formatLabel(max)}</span>
      </div>
    </div>
  );
}
