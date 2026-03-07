'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VehicleEquipment, EquipmentStatus } from '@/types';

const STATUS_STYLES: Record<EquipmentStatus, string> = {
  operational: 'bg-green-100 text-green-700',
  needs_repair: 'bg-yellow-100 text-yellow-700',
  missing: 'bg-red-100 text-red-700',
  replaced: 'bg-gray-100 text-gray-700',
};

interface Props {
  equipment: VehicleEquipment[];
}

export default function EquipmentSection({ equipment: initialEquipment }: Props) {
  const router = useRouter();
  const [equipment, setEquipment] = useState(initialEquipment);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateStatus = async (id: string, newStatus: EquipmentStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/equipment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update');
        return;
      }

      const { data } = await res.json();
      setEquipment((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...data } : e))
      );
      router.refresh();
    } catch {
      alert('An unexpected error occurred');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipment</h3>
      {equipment.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No equipment records found for this vehicle.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.equipment_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Last checked: {new Date(item.last_checked).toLocaleDateString()}
              </p>

              {/* Action buttons */}
              <div className="mt-3 flex items-center gap-2">
                {item.status === 'needs_repair' && (
                  <button
                    onClick={() => updateStatus(item.id, 'operational')}
                    disabled={updatingId === item.id}
                    className="inline-flex items-center rounded-md border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    Mark Fixed
                  </button>
                )}
                {item.status === 'missing' && (
                  <>
                    <button
                      onClick={() => updateStatus(item.id, 'replaced')}
                      disabled={updatingId === item.id}
                      className="inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      Mark Replaced
                    </button>
                    <button
                      onClick={() => updateStatus(item.id, 'operational')}
                      disabled={updatingId === item.id}
                      className="inline-flex items-center rounded-md border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                    >
                      Mark Found
                    </button>
                  </>
                )}
                {item.status === 'operational' && (
                  <button
                    onClick={() => updateStatus(item.id, 'needs_repair')}
                    disabled={updatingId === item.id}
                    className="inline-flex items-center rounded-md border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                  >
                    Report Issue
                  </button>
                )}
                {item.status === 'replaced' && (
                  <span className="text-xs text-gray-400">Replaced</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
