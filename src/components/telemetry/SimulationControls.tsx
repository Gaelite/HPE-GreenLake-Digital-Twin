'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SimStatus = 'stopped' | 'running' | 'starting' | 'stopping';

interface SimStats {
  tickCount: number;
  vehicleCount: number;
  activeIncidents: number;
  totalAnomalies: number;
  totalInsights: number;
  totalEvents: number;
}

const EMPTY_STATS: SimStats = {
  tickCount: 0,
  vehicleCount: 0,
  activeIncidents: 0,
  totalAnomalies: 0,
  totalInsights: 0,
  totalEvents: 0,
};

export default function SimulationControls() {
  const [status, setStatus] = useState<SimStatus>('stopped');
  const [message, setMessage] = useState<string>('');
  const [stats, setStats] = useState<SimStats>(EMPTY_STATS);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/simulator/start', { method: 'GET' });
      const json = await res.json();
      if (json.running) {
        setStatus('running');
        setStats({
          tickCount: json.tickCount ?? 0,
          vehicleCount: json.vehicleCount ?? 0,
          activeIncidents: json.activeIncidents ?? 0,
          totalAnomalies: json.totalAnomalies ?? 0,
          totalInsights: json.totalInsights ?? 0,
          totalEvents: json.totalEvents ?? 0,
        });
      } else {
        setStatus((prev) => (prev === 'running' ? 'stopped' : prev));
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial check + polling while running
  useEffect(() => {
    pollStatus();
  }, [pollStatus]);

  useEffect(() => {
    if (status === 'running') {
      pollRef.current = setInterval(pollStatus, 5_000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, pollStatus]);

  const handleStart = useCallback(async () => {
    setStatus('starting');
    setMessage('');
    try {
      const res = await fetch('/api/simulator/start', { method: 'POST' });
      const json = await res.json();

      if (json.status === 'started' || json.status === 'already_running') {
        setStatus('running');
        setStats({
          tickCount: json.tickCount ?? 0,
          vehicleCount: json.vehicleCount ?? 0,
          activeIncidents: json.activeIncidents ?? 0,
          totalAnomalies: json.totalAnomalies ?? 0,
          totalInsights: json.totalInsights ?? 0,
          totalEvents: json.totalEvents ?? 0,
        });
      } else {
        setStatus('stopped');
      }
      setMessage(json.message || '');
    } catch (err) {
      console.error('Failed to start simulator:', err);
      setStatus('stopped');
      setMessage('Failed to start simulator');
    }
  }, []);

  const handleStop = useCallback(async () => {
    setStatus('stopping');
    setMessage('');
    try {
      const res = await fetch('/api/simulator/stop', { method: 'POST' });
      const json = await res.json();
      setStatus('stopped');
      setStats(EMPTY_STATS);
      setMessage(json.message || '');
    } catch (err) {
      console.error('Failed to stop simulator:', err);
      setStatus('running');
      setMessage('Failed to stop simulator');
    }
  }, []);

  const isRunning = status === 'running';
  const isBusy = status === 'starting' || status === 'stopping';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">World Simulation</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Telemetry, incidents, anomalies &amp; insights
          </p>
        </div>

        {/* Status indicator */}
        <div
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
            isRunning
              ? 'bg-green-50 text-green-700'
              : isBusy
              ? 'bg-yellow-50 text-yellow-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning
                ? 'bg-green-500 animate-pulse'
                : isBusy
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-gray-400'
            }`}
          />
          {status === 'running' && 'Running'}
          {status === 'stopped' && 'Stopped'}
          {status === 'starting' && 'Starting...'}
          {status === 'stopping' && 'Stopping...'}
        </div>
      </div>

      {/* Stats grid */}
      {isRunning && stats.vehicleCount > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">Vehicles</span>
            <p className="text-sm font-semibold text-gray-900">{stats.vehicleCount}</p>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">Ticks</span>
            <p className="text-sm font-semibold text-gray-900">{stats.tickCount}</p>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">Incidents</span>
            <p className="text-sm font-semibold text-gray-900">{stats.activeIncidents}</p>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">Events</span>
            <p className="text-sm font-semibold text-gray-900">{stats.totalEvents}</p>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">Anomalies</span>
            <p className="text-sm font-semibold text-gray-900">{stats.totalAnomalies}</p>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">Insights</span>
            <p className="text-sm font-semibold text-gray-900">{stats.totalInsights}</p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={isRunning || isBusy}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all
            ${
              isRunning || isBusy
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm'
            }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
          Start
        </button>

        <button
          onClick={handleStop}
          disabled={!isRunning || isBusy}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all
            ${
              !isRunning || isBusy
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm'
            }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
              clipRule="evenodd"
            />
          </svg>
          Stop
        </button>
      </div>

      {/* Message */}
      {message && (
        <p className="mt-3 text-xs text-gray-500 text-center">{message}</p>
      )}
    </div>
  );
}
