'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import ScenarioBuilder from '@/components/simulation/ScenarioBuilder';
import ScenarioTemplateSelector from '@/components/simulation/ScenarioTemplateSelector';
import ScenarioHistory from '@/components/simulation/ScenarioHistory';
import SimulationResultCard from '@/components/simulation/SimulationResultCard';
import ComparisonView from '@/components/simulation/ComparisonView';
import type { SimulationResult, Scenario } from '@/types';

export default function SimulationPage() {
  const [latestResult, setLatestResult] = useState<{
    scenario: Scenario;
    results: SimulationResult[];
    simulation_output: Record<string, unknown>;
  } | null>(null);

  const handleResult = (data: Record<string, unknown>) => {
    setLatestResult(
      data as unknown as {
        scenario: Scenario;
        results: SimulationResult[];
        simulation_output: Record<string, unknown>;
      }
    );
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Scenario Simulation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Run &quot;What If&quot; scenarios to evaluate dispatch options, resource
            constraints, and traffic impact.
          </p>
        </div>

        {/* Scenario Builder */}
        <ScenarioBuilder onResult={handleResult} />

        {/* Latest Result */}
        {latestResult && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-gray-900">
                Latest Simulation Result
              </h2>
            </div>

            {/* Comparison view for dispatch scenarios with 2 results */}
            {latestResult.results.length >= 2 && (
              <ComparisonView
                results={latestResult.results}
                title={`Comparison: ${latestResult.scenario.name}`}
              />
            )}

            {/* Individual result cards */}
            <div
              className={`grid gap-4 ${latestResult.results.length >= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}
            >
              {latestResult.results.map((result, idx) => (
                <SimulationResultCard
                  key={result.id || idx}
                  result={result}
                  scenario={latestResult.scenario}
                />
              ))}
            </div>
          </div>
        )}

        {/* Scenario Templates */}
        <ScenarioTemplateSelector />

        {/* History */}
        <ScenarioHistory />
      </div>
    </AppShell>
  );
}
