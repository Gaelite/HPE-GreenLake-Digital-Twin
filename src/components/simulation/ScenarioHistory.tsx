'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Scenario } from '@/types';

const TYPE_BADGES: Record<string, string> = {
  dispatch_comparison: 'bg-blue-100 text-blue-700',
  resource_depletion: 'bg-orange-100 text-orange-700',
  traffic_impact: 'bg-purple-100 text-purple-700',
  equipment_failure: 'bg-red-100 text-red-700',
  multi_vehicle: 'bg-green-100 text-green-700',
};

const TYPE_LABELS: Record<string, string> = {
  dispatch_comparison: 'Dispatch Comparison',
  resource_depletion: 'Resource Depletion',
  traffic_impact: 'Traffic Impact',
  equipment_failure: 'Equipment Failure',
  multi_vehicle: 'Multi-Vehicle',
};

export default function ScenarioHistory() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('scenarios')
          .select('*')
          .eq('is_template', false)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          setScenarios(data as Scenario[]);
        }
      } catch (err) {
        console.error('Failed to fetch scenario history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Scenario History
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse h-12 bg-gray-100 rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Scenario History
        </h2>
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-sm text-gray-500">
            No simulations yet. Run your first scenario above!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Scenario History
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">
                Name
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">
                Type
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">
                Date
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {scenarios.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="text-sm font-medium text-gray-900">
                    {s.name}
                  </div>
                  {s.description && (
                    <div className="text-xs text-gray-500 truncate max-w-xs">
                      {s.description}
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGES[s.scenario_type] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {TYPE_LABELS[s.scenario_type] || s.scenario_type}
                  </span>
                </td>
                <td className="py-3 pr-4 text-sm text-gray-500">
                  {new Date(s.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/simulation/results/${s.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    View
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
