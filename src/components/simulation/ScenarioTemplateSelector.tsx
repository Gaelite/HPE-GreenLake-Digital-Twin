'use client';

import { useEffect, useState } from 'react';
import type { ScenarioType } from '@/types';

interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  scenario_type: ScenarioType;
  icon: string;
  parameters: Record<string, unknown>;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  truck: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  clock: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  fuel: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
    </svg>
  ),
  traffic: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  ),
};

const TYPE_BADGE_COLORS: Record<ScenarioType, string> = {
  dispatch_comparison: 'bg-blue-100 text-blue-700',
  resource_depletion: 'bg-orange-100 text-orange-700',
  traffic_impact: 'bg-purple-100 text-purple-700',
  equipment_failure: 'bg-red-100 text-red-700',
  multi_vehicle: 'bg-green-100 text-green-700',
};

const TYPE_LABELS: Record<ScenarioType, string> = {
  dispatch_comparison: 'Dispatch',
  resource_depletion: 'Fuel',
  traffic_impact: 'Traffic',
  equipment_failure: 'Equipment',
  multi_vehicle: 'Multi-Vehicle',
};

export default function ScenarioTemplateSelector() {
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/simulation/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates);
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleSelect = (template: ScenarioTemplate) => {
    // Call the global loader registered by ScenarioBuilder
    const loader = (
      window as unknown as Record<string, unknown>
    ).__loadScenarioTemplate as
      | ((tpl: {
          scenario_type: ScenarioType;
          name?: string;
          description?: string;
          parameters: Record<string, unknown>;
        }) => void)
      | undefined;

    if (loader) {
      loader({
        scenario_type: template.scenario_type,
        name: template.name,
        description: template.description,
        parameters: template.parameters,
      });
    }

    // Scroll to the builder
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Scenario Templates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-100 rounded-lg h-36"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Scenario Templates
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Click a template to load it into the builder above.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handleSelect(tpl)}
            className="text-left border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all group bg-white"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                {ICON_MAP[tpl.icon] || ICON_MAP.truck}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {tpl.name}
                  </h3>
                </div>
                <span
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${TYPE_BADGE_COLORS[tpl.scenario_type]}`}
                >
                  {TYPE_LABELS[tpl.scenario_type]}
                </span>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {tpl.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
