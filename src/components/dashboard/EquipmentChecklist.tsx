'use client';

import type { VehicleEquipment, EquipmentStatus } from '@/types';

interface EquipmentChecklistProps {
  equipment: VehicleEquipment[];
}

const STATUS_CONFIG: Record<
  EquipmentStatus,
  { icon: string; label: string; textClass: string; bgClass: string }
> = {
  operational: {
    icon: '\u2713',
    label: 'Operational',
    textClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50 border-emerald-200',
  },
  needs_repair: {
    icon: '\u26A0',
    label: 'Needs Repair',
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50 border-amber-200',
  },
  replaced: {
    icon: '\u21BB',
    label: 'Replaced',
    textClass: 'text-blue-700',
    bgClass: 'bg-blue-50 border-blue-200',
  },
  missing: {
    icon: '\u2717',
    label: 'Missing',
    textClass: 'text-red-700',
    bgClass: 'bg-red-50 border-red-200',
  },
};

function groupByCategory(equipment: VehicleEquipment[]) {
  const groups: Record<string, VehicleEquipment[]> = {};
  for (const item of equipment) {
    const cat = item.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

export default function EquipmentChecklist({ equipment }: EquipmentChecklistProps) {
  if (equipment.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">No equipment records available</p>
      </div>
    );
  }

  const grouped = groupByCategory(equipment);
  const totalOperational = equipment.filter((e) => e.status === 'operational').length;
  const totalItems = equipment.length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-gray-700">
          Equipment Status
        </span>
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-emerald-600">{totalOperational}</span>
          /{totalItems} operational
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${(totalOperational / totalItems) * 100}%` }}
        />
      </div>

      {/* Grouped checklist */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            {category}
          </h4>
          <ul className="space-y-1.5">
            {items.map((item) => {
              const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.operational;
              return (
                <li
                  key={item.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${config.bgClass} transition-colors`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${config.textClass}`}
                    >
                      {config.icon}
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {item.equipment_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${config.textClass}`}>
                      {config.label}
                    </span>
                    {item.last_checked && (
                      <span className="text-xs text-gray-400">
                        {new Date(item.last_checked).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
