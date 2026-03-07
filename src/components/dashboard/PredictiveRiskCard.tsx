'use client';

// ============================================================
// PredictiveRiskCard — Calls the ML endpoint and displays P(failure)
// Usage: <PredictiveRiskCard vehicleId={id} />
// ============================================================

import { useState, useCallback } from 'react';

interface PredictiveRiskResult {
  vehicle_id:          string;
  failure_probability: number;
  risk_level:          'CRITICAL' | 'WARNING' | 'NORMAL';
  severity:            'critical' | 'warning' | 'info';
  recommendation:      string;
  metrics_analyzed:    number;
  confidence_note:     string;
  evaluated_at:        string;
  source:              string;
}

interface Props {
  vehicleId: string;
  telemetryWindow?: Array<{
    engine_temp:     number;
    oil_pressure:    number;
    fuel_level:      number;
    battery_voltage: number;
    tire_pressure:   number;
  }>;
}

const RISK_COLORS = {
  CRITICAL: {
    bar:    'bg-red-500',
    badge:  'bg-red-100 text-red-800',
    border: 'border-red-200',
    icon:   'text-red-500',
  },
  WARNING: {
    bar:    'bg-amber-400',
    badge:  'bg-amber-100 text-amber-800',
    border: 'border-amber-200',
    icon:   'text-amber-500',
  },
  NORMAL: {
    bar:    'bg-emerald-400',
    badge:  'bg-emerald-100 text-emerald-800',
    border: 'border-emerald-200',
    icon:   'text-emerald-500',
  },
};

export default function PredictiveRiskCard({ vehicleId, telemetryWindow }: Props) {
  const [result, setResult]   = useState<PredictiveRiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Fetch prediction from ML service via Next.js API route
  const fetchPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ml/maintenance-risk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          vehicle_id:       vehicleId,
          telemetry_window: telemetryWindow ?? [],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? `Error ${response.status}`);
      }

      const data: PredictiveRiskResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [vehicleId, telemetryWindow]);

  const colors = result ? RISK_COLORS[result.risk_level] : null;
  const pct    = result ? Math.round(result.failure_probability * 100) : 0;

  return (
    <div className={`rounded-xl bg-white shadow-sm ring-1 p-5 ${colors ? `ring-1 ${colors.border}` : 'ring-gray-100'}`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
            <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Predictive Risk</p>
            <p className="text-xs text-gray-400">ML Maintenance Assessment</p>
          </div>
        </div>

        {/* Refresh / Run button */}
        <button
          onClick={fetchPrediction}
          disabled={loading}
          title={result ? 'Refresh prediction' : 'Run ML assessment for this vehicle'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {result ? 'Refresh' : 'Run Assessment'}
            </>
          )}
        </button>
      </div>

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <svg className="h-10 w-10 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-gray-400">
            Click <span className="font-medium text-indigo-600">Run Assessment</span> to analyze this vehicle
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600 font-medium">⚠️ {error}</p>
          <p className="text-xs text-red-400 mt-0.5">
            Verify that the ML service is running on localhost:8000
          </p>
        </div>
      )}

      {/* Result */}
      {result && colors && (
        <div className="space-y-4">

          {/* Probability bar */}
          <div>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">Failure Probability</span>
              <span className="text-2xl font-bold text-gray-900">{pct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Risk badge */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
              {result.risk_level === 'CRITICAL' && '⛔ '}
              {result.risk_level === 'WARNING'  && '⚠️ '}
              {result.risk_level === 'NORMAL'   && '✅ '}
              {result.risk_level}
            </span>
            <span className="text-xs text-gray-400">{result.metrics_analyzed} readings analyzed</span>
          </div>

          {/* Recommendation — background color matches risk level */}
          <div className={`rounded-lg px-3 py-2.5 ${
            result.risk_level === 'CRITICAL' ? 'bg-red-50 border border-red-200' :
            result.risk_level === 'WARNING'  ? 'bg-amber-50 border border-amber-200' :
                                               'bg-emerald-50 border border-emerald-200'
          }`}>
            <p className={`text-sm font-medium ${
              result.risk_level === 'CRITICAL' ? 'text-red-700' :
              result.risk_level === 'WARNING'  ? 'text-amber-700' :
                                                 'text-emerald-700'
            }`}>
              {result.recommendation}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-50">
            <p className="text-xs text-gray-400">{result.confidence_note}</p>
            <p className="text-xs text-gray-300">
              {new Date(result.evaluated_at).toLocaleTimeString()}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}