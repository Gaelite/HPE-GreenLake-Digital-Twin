'use client';

import { VehicleType } from '@/types';

const TYPE_ICONS: Record<VehicleType, string> = {
  police: '\uD83D\uDE94',
  ambulance: '\uD83D\uDE91',
  fire_truck: '\uD83D\uDE92',
  civil_protection: '\uD83D\uDEE1\uFE0F',
  hybrid: '\u2699\uFE0F',
};

interface VehicleTypeIconProps {
  type: VehicleType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function VehicleTypeIcon({
  type,
  size = 'md',
  showLabel = false,
}: VehicleTypeIconProps) {
  const icon = TYPE_ICONS[type] ?? '\uD83D\uDE97';

  const sizeClasses: Record<string, string> = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  const LABELS: Record<VehicleType, string> = {
    police: 'Police',
    ambulance: 'Ambulance',
    fire_truck: 'Fire Truck',
    civil_protection: 'Civil Protection',
    hybrid: 'Hybrid',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses[size]}`}>
      <span role="img" aria-label={LABELS[type]}>
        {icon}
      </span>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700">
          {LABELS[type]}
        </span>
      )}
    </span>
  );
}
