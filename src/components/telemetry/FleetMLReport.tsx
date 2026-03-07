'use client';

// ============================================================
// FleetMLReport — Identical structure to SimulationControls
// Features:
//   - Results cached in localStorage — persists across navigation
//   - Modal shows real-time progress while running
//   - Each vehicle row links to /dashboard/vehicle/[id] (new tab)
// Usage: <FleetMLReport vehicleIds={[{ id, name, type }]} />
// ============================================================

import { useState, useCallback, useEffect } from 'react';

interface VehiclePrediction {
  vehicle_id:          string;
  vehicle_name:        string;
  vehicle_type:        string;
  failure_probability: number;
  risk_level:          'CRITICAL' | 'WARNING' | 'NORMAL';
  recommendation:      string;
  error?:              string;
}

interface CachedReport {
  results: VehiclePrediction[];
  lastRun: string;
  savedAt: number;
}

interface Props {
  vehicleIds: Array<{ id: string; name: string; type: string }>;
}

const CACHE_KEY    = 'fleet_ml_report';
const CACHE_MAX_MS = 1000 * 60 * 60; // 1 hour

const RISK_ORDER = { CRITICAL: 0, WARNING: 1, NORMAL: 2 };

const RISK_STYLES = {
  CRITICAL: { row: 'bg-red-50',   badge: 'bg-red-100 text-red-700',         bar: 'bg-red-500',    left: 'border-l-red-400',    icon: '⛔' },
  WARNING:  { row: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700',     bar: 'bg-amber-400',  left: 'border-l-amber-400',  icon: '⚠️' },
  NORMAL:   { row: 'bg-white',    badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400', left: 'border-l-emerald-400', icon: '✅' },
};

type AssessmentStatus = 'idle' | 'running' | 'ready';

export default function FleetMLReport({ vehicleIds }: Props) {
  const [status, setStatus]     = useState<AssessmentStatus>('idle');
  const [open, setOpen]         = useState(false);
  const [results, setResults]   = useState<VehiclePrediction[]>([]);
  const [progress, setProgress] = useState(0);
  const [lastRun, setLastRun]   = useState<string | null>(null);

  const isRunning = status === 'running';
  const isReady   = status === 'ready';

  const critical = results.filter((r) => r.risk_level === 'CRITICAL').length;
  const warning  = results.filter((r) => r.risk_level === 'WARNING').length;
  const normal   = results.filter((r) => r.risk_level === 'NORMAL').length;

  // Load cached report on mount — persists across navigation
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cached: CachedReport = JSON.parse(raw);
      if (Date.now() - cached.savedAt > CACHE_MAX_MS) {
        localStorage.removeItem(CACHE_KEY);
        return;
      }
      setResults(cached.results);
      setLastRun(cached.lastRun);
      setStatus('ready');
    } catch {
      // Ignore corrupted cache
    }
  }, []);

  const runAssessment = useCallback(async () => {
    setStatus('running');
    setProgress(0);
    setResults([]);

    const predictions: VehiclePrediction[] = [];

    for (let i = 0; i < vehicleIds.length; i++) {
      const vehicle = vehicleIds[i];
      try {
        const res  = await fetch('/api/ml/maintenance-risk', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ vehicle_id: vehicle.id }),
        });
        const data = await res.json();
        predictions.push({
          vehicle_id:          vehicle.id,
          vehicle_name:        data.vehicle_name ?? vehicle.name,
          vehicle_type:        data.vehicle_type ?? vehicle.type,
          failure_probability: data.failure_probability ?? 0,
          risk_level:          data.risk_level     ?? 'NORMAL',
          recommendation:      data.recommendation ?? 'Normal operation',
          error:               res.ok ? undefined : data.error,
        });
      } catch {
        predictions.push({
          vehicle_id: vehicle.id, vehicle_name: vehicle.name, vehicle_type: vehicle.type,
          failure_probability: 0, risk_level: 'NORMAL',
          recommendation: 'Could not reach ML service', error: 'Connection error',
        });
      }

      // Update results in real-time so modal shows partial results as they come in
      const sorted = [...predictions].sort(
        (a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level] || b.failure_probability - a.failure_probability
      );
      setResults(sorted);
      setProgress(Math.round(((i + 1) / vehicleIds.length) * 100));
    }

    const runTime = new Date().toLocaleTimeString();
    setLastRun(runTime);
    setStatus('ready');

    // Cache results in localStorage so report survives navigation
    try {
      const cache: CachedReport = {
        results:  predictions,
        lastRun:  runTime,
        savedAt:  Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Ignore storage errors
    }
  }, [vehicleIds]);

  return (
    <>
      {/* ── Card — identical structure to SimulationControls ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Fleet ML Report</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Flags units at risk of failure using the LSTM model · {results.length} vehicles
            </p>
          </div>

          {/* Status pill */}
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${
            isRunning ? 'bg-yellow-50 text-yellow-700' :
            isReady   ? 'bg-green-50 text-green-700'   :
                        'bg-gray-100 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              isRunning ? 'bg-yellow-500 animate-pulse' :
              isReady   ? 'bg-green-500'                :
                          'bg-gray-400'
            }`} />
            {isRunning ? `Running ${progress}%` : isReady ? 'Ready' : 'Not run'}
          </div>
        </div>

        {!isRunning && <div className="mb-4" />}

        {/* Buttons */}
        <div className="flex items-center gap-3">

          {/* Run / Re-run */}
          <button
            onClick={runAssessment}
            disabled={isRunning}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all
              ${isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm'
              }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd" />
            </svg>
            {isRunning ? `${progress}%` : isReady ? 'Re-run' : 'Run'}
          </button>

          {/* View Report — enabled while running (shows progress) or when ready */}
          <button
            onClick={() => setOpen(true)}
            disabled={status === 'idle'}
            title={status === 'idle' ? 'Run the assessment first' : 'View full prediction report'}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all
              ${status === 'idle'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm'
              }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                clipRule="evenodd" />
            </svg>
            Report
            {isReady && critical > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                {critical}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Fleet ML Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  LSTM predictive maintenance · {results.length} vehicles · Last run: {lastRun}
                  {lastRun && ` · Last run: ${lastRun}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runAssessment}
                  disabled={isRunning}
                  title="Re-run predictions for all vehicles"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <svg className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-run
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Progress bar — visible while running */}
            {isRunning && (
              <div className="px-6 py-3 border-b border-gray-100 bg-indigo-50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-indigo-600 font-medium">Analyzing fleet...</span>
                  <span className="text-xs font-bold text-indigo-700">{progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-indigo-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-indigo-400 mt-1.5">
                  {results.length} of {vehicleIds.length} analyzed — results appear in real-time below
                </p>
              </div>
            )}

            {isReady && results.length > 0 && (
              <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-gray-100">
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">Vehicles</span>
                  <p className="text-sm font-semibold text-gray-900">{results.length}</p>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">Critical</span>
                  <p className={`text-sm font-semibold ${critical > 0 ? 'text-red-600' : 'text-gray-900'}`}>{critical}</p>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">Warning</span>
                  <p className={`text-sm font-semibold ${warning > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{warning}</p>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">Normal</span>
                  <p className="text-sm font-semibold text-emerald-600">{normal}</p>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">Last run</span>
                  <p className="text-sm font-semibold text-gray-900">{lastRun}</p>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">Model</span>
                  <p className="text-sm font-semibold text-gray-900">LSTM</p>
                </div>
              </div>
            )}

            {/* Summary pills */}
            {results.length > 0 && (
              <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
                <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">⛔ {critical} Critical</span>
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">⚠️ {warning} Warning</span>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">✅ {normal} Normal</span>
                {isRunning && <span className="ml-auto text-xs text-gray-400 animate-pulse">updating...</span>}
              </div>
            )}

            {/* Vehicle list */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">

              {/* Empty state while first predictions load */}
              {results.length === 0 && isRunning && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <svg className="h-7 w-7 animate-spin text-indigo-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <p className="text-sm text-gray-400">Waiting for first results...</p>
                  </div>
                </div>
              )}

              {/* Results — each row is a link to the vehicle detail page */}
              {results.map((r) => {
                const styles = RISK_STYLES[r.risk_level];
                const pct    = Math.round(r.failure_probability * 100);
                return (
                  <a
                    key={r.vehicle_id}
                    href={`/dashboard/vehicle/${r.vehicle_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${r.vehicle_name} in new tab`}
                    className={`flex items-center gap-4 px-6 py-3.5 border-l-4 ${styles.row} ${styles.left} hover:brightness-95 transition-all group cursor-pointer`}
                  >
                    <span className="text-lg shrink-0">{styles.icon}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.vehicle_name}</p>
                        {/* External link icon — visible on hover */}
                        <svg className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-400 capitalize">{r.vehicle_type.replace('_', ' ')}</p>
                    </div>

                    <div className="w-24 shrink-0">
                      <p className="text-xs font-bold text-gray-700 mb-1">{pct}%</p>
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>
                      {r.risk_level}
                    </span>
                  </a>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 text-center">
                LSTM model trained on synthetic data — use as a supporting signal only · Click any row to open vehicle detail
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}