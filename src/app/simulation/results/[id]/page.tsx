'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import SimulationResultCard from '@/components/simulation/SimulationResultCard';
import ComparisonView from '@/components/simulation/ComparisonView';
import type { SimulationResult, Scenario } from '@/types';

export default function SimulationResultPage() {
  const params = useParams();
  const id = params.id as string;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/simulation/results/${id}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch result');
        }
        const data = await res.json();
        setScenario(data.scenario);
        setResults(data.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchResult();
    }
  }, [id]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/simulation"
            className="hover:text-blue-600 transition-colors"
          >
            Simulation
          </Link>
          <svg
            className="w-4 h-4"
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
          <span className="text-gray-900 font-medium">
            {scenario?.name || 'Result Details'}
          </span>
        </nav>

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <div className="animate-pulse bg-gray-100 rounded-xl h-64" />
            <div className="animate-pulse bg-gray-100 rounded-xl h-48" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <svg
              className="w-10 h-10 text-red-400 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <h3 className="text-base font-semibold text-red-700 mb-1">
              Failed to load simulation result
            </h3>
            <p className="text-sm text-red-600">{error}</p>
            <Link
              href="/simulation"
              className="inline-block mt-4 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Back to Simulation
            </Link>
          </div>
        )}

        {/* Loaded state */}
        {!loading && !error && scenario && (
          <>
            {/* Page Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {scenario.name}
                  </h1>
                  {scenario.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {scenario.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                      {scenario.scenario_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                    <span className="text-xs text-gray-400">
                      Created{' '}
                      {new Date(scenario.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs text-gray-400">
                      {results.length} result{results.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <Link
                  href="/simulation"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back
                </Link>
              </div>
            </div>

            {/* Comparison view for dispatch scenarios */}
            {results.length >= 2 && (
              <ComparisonView
                results={results}
                title={`Comparison: ${scenario.name}`}
              />
            )}

            {/* Individual Result Cards */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {results.length >= 2
                  ? 'Individual Vehicle Results'
                  : 'Simulation Result'}
              </h2>
              <div
                className={`grid gap-4 ${results.length >= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}
              >
                {results.map((result, idx) => (
                  <SimulationResultCard
                    key={result.id || idx}
                    result={result}
                    scenario={scenario}
                  />
                ))}
              </div>
            </div>

            {/* Raw Parameters (collapsible) */}
            <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                View Scenario Parameters (JSON)
              </summary>
              <div className="px-6 pb-4">
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 overflow-x-auto">
                  {JSON.stringify(scenario.parameters, null, 2)}
                </pre>
              </div>
            </details>
          </>
        )}
      </div>
    </AppShell>
  );
}
