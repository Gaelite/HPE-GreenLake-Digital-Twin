'use client';

import { VehicleStatus, STATUS_COLORS } from '@/types';

const STATUS_LABELS: Record<VehicleStatus, string> = {
  available: 'Available',
  in_service: 'In Service',
  en_route: 'En Route',
  at_scene: 'At Scene',
  maintenance: 'Maintenance',
  offline: 'Offline',
};

// Map Tailwind bg classes to matching dot-friendly classes
const DOT_COLORS: Record<VehicleStatus, string> = {
  available: 'bg-green-500',
  in_service: 'bg-blue-500',
  en_route: 'bg-yellow-500',
  at_scene: 'bg-orange-500',
  maintenance: 'bg-gray-500',
  offline: 'bg-red-500',
};

const TEXT_COLORS: Record<VehicleStatus, string> = {
  available: 'text-green-700',
  in_service: 'text-blue-700',
  en_route: 'text-yellow-700',
  at_scene: 'text-orange-700',
  maintenance: 'text-gray-600',
  offline: 'text-red-700',
};

interface StatusIndicatorProps {
  status: VehicleStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulse?: boolean;
}

export default function StatusIndicator({
  status,
  size = 'md',
  showLabel = true,
  pulse = false,
}: StatusIndicatorProps) {
  const dotColor = DOT_COLORS[status] ?? 'bg-gray-500';
  const textColor = TEXT_COLORS[status] ?? 'text-gray-600';

  const dotSizes: Record<string, string> = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  const textSizes: Record<string, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const isActive = status === 'in_service' || status === 'en_route' || status === 'at_scene';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex">
        {(pulse || isActive) && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${dotColor} ${dotSizes[size]}`} />
      </span>
      {showLabel && (
        <span className={`font-medium ${textColor} ${textSizes[size]}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
      )}
    </span>
  );
}
