'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MaintenanceRecord, MaintenanceStatus } from '@/types';

const STATUS_STYLES: Record<MaintenanceStatus, string> = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-gray-100 text-gray-700',
};

interface Props {
  records: MaintenanceRecord[];
}

export default function MaintenanceSection({ records: initialRecords }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateStatus = async (id: string, newStatus: MaintenanceStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
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
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Maintenance Records
      </h3>
      {records.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No maintenance records found for this vehicle.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        record.maintenance_type === 'emergency'
                          ? 'bg-red-100 text-red-700'
                          : record.maintenance_type === 'scheduled'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {record.maintenance_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {record.description}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[record.status]}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {new Date(record.scheduled_date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {record.cost != null ? `$${record.cost.toLocaleString()}` : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {record.status === 'scheduled' && (
                        <button
                          onClick={() => updateStatus(record.id, 'in_progress')}
                          disabled={updatingId === record.id}
                          className="inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {(record.status === 'scheduled' || record.status === 'in_progress') && (
                        <button
                          onClick={() => updateStatus(record.id, 'completed')}
                          disabled={updatingId === record.id}
                          className="inline-flex items-center rounded-md border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          Mark Completed
                        </button>
                      )}
                      {record.status === 'completed' && (
                        <span className="text-xs text-gray-400">Done</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
