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

interface StatusBadgeProps {
  status: VehicleStatus;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const bgColor = STATUS_COLORS[status] ?? 'bg-gray-500';

  const sizeClasses: Record<string, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium text-white ${bgColor} ${sizeClasses[size]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
