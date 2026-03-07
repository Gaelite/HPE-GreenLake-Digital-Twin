'use client';

import type { SimulationResult, Scenario } from '@/types';

interface Props {
  result: SimulationResult;
  scenario?: Scenario;
  compact?: boolean;
}

const riskColor = (delta: number) => {
  if (delta >= 30) return 'text-red-600 bg-red-50';
  if (delta >= 15) return 'text-orange-600 bg-orange-50';
  if (delta >= 5) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
};

const riskLabel = (delta: number) => {
  if (delta >= 30) return 'Critical';
  if (delta >= 15) return 'High';
  if (delta >= 5) return 'Medium';
  return 'Low';
};

const responseTimeColor = (time: number) => {
  if (time > 20) return 'text-red-600';
  if (time > 12) return 'text-orange-600';
  if (time > 8) return 'text-yellow-600';
  return 'text-green-600';
};

export default function SimulationResultCard({
  result,
  scenario,
  compact = false,
}: Props) {
  const data = result.result_data;
  const scenarioType = scenario?.scenario_type;

  const hasResponseTime =
    scenarioType !== 'resource_depletion' && data.estimated_response_time > 0;
  const hasFuelUsage =
    scenarioType !== 'traffic_impact' && data.fuel_consumption > 0;

  // Read delay_minutes directly from result_data (stored by the backend)
  const delayMinutes = data.delay_minutes ?? 0;

  // Resource depletion: fuel_consumption = fuel_at_arrival_litres
  const fuelAtArrival = data.fuel_consumption;

  // Read vehicle_name directly from result_data JSONB (stored by the backend)
  const vehicleLabel = data.vehicle_name ?? result.vehicle_id.slice(-8);

  if (compact) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900 truncate">
            {scenario?.name || 'Simulation Result'}
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskColor(data.risk_delta)}`}
          >
            {riskLabel(data.risk_delta)} Risk
          </span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2">
          {data.outcome_summary}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {scenario?.name || 'Simulation Result'}
            </h3>
            {scenario?.description && (
              <p className="text-sm text-gray-500 mt-0.5">
                {scenario.description}
              </p>
            )}
          </div>
          <span
            className={`text-sm font-medium px-3 py-1 rounded-full ${riskColor(data.risk_delta)}`}
          >
            {riskLabel(data.risk_delta)} Risk
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

          {/* Slot 1: Response Time / Fuel at Arrival */}
          {scenarioType === 'resource_depletion' ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Fuel at Arrival
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {fuelAtArrival > 0 ? fuelAtArrival.toFixed(1) : '--'}
                <span className="text-sm font-normal text-gray-500 ml-1">L</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Response Time
              </div>
              <div
                className={`text-2xl font-bold ${hasResponseTime ? responseTimeColor(data.estimated_response_time) : 'text-gray-400'}`}
              >
                {hasResponseTime ? data.estimated_response_time.toFixed(1) : '--'}
                <span className="text-sm font-normal ml-1">min</span>
              </div>
            </div>
          )}

          {/* Slot 2: Fuel Usage / Added Delay */}
          {scenarioType === 'traffic_impact' ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Added Delay
              </div>
              <div
                className={`text-2xl font-bold ${delayMinutes > 10 ? 'text-red-600' : delayMinutes > 5 ? 'text-orange-600' : 'text-yellow-600'}`}
              >
                {delayMinutes > 0 ? `+${delayMinutes}` : '--'}
                <span className="text-sm font-normal ml-1">min</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Fuel Usage
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {hasFuelUsage ? data.fuel_consumption.toFixed(1) : '--'}
                <span className="text-sm font-normal text-gray-500 ml-1">L</span>
              </div>
            </div>
          )}

          {/* Risk Delta */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Risk Delta
            </div>
            <div
              className={`text-2xl font-bold ${riskColor(data.risk_delta).split(' ')[0]}`}
            >
              {data.risk_delta > 0 ? '+' : ''}
              {data.risk_delta.toFixed(0)}
            </div>
          </div>

          {/* Coverage Impact */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Coverage Impact
            </div>
            <div
              className={`text-2xl font-bold ${
                data.coverage_impact > 10
                  ? 'text-red-600'
                  : data.coverage_impact > 0
                    ? 'text-yellow-600'
                    : 'text-green-600'
              }`}
            >
              {data.coverage_impact > 0 ? '+' : ''}
              {data.coverage_impact.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Outcome Summary */}
        <div
          className={`rounded-lg p-4 ${
            data.risk_delta >= 30
              ? 'bg-red-50 border border-red-200'
              : data.risk_delta >= 15
                ? 'bg-orange-50 border border-orange-200'
                : data.risk_delta >= 5
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-green-50 border border-green-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {data.risk_delta >= 15 ? (
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Outcome Summary
              </h4>
              <p className="text-sm text-gray-700">{data.outcome_summary}</p>
            </div>
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          <span>
            Vehicle: <span className="text-gray-600 font-medium">{vehicleLabel}</span>
          </span>
          {scenario && (
            <span>
              Type: <span className="text-gray-600">{scenario.scenario_type.replace(/_/g, ' ')}</span>
            </span>
          )}
          <span>Ran: {new Date(result.created_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}