'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Anomaly, Severity, AnomalyStatus } from '@/types';

interface AnomalyWithVehicle extends Anomaly {
  vehicles?: {
    name: string;
    plate_number: string;
    type: string;
  };
}

const SEVERITY_DOT: Record<Severity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

const SEVERITY_BADGE: Record<Severity, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
};

const METRIC_LABELS: Record<string, string> = {
  speed: 'Speed',
  engine_temp: 'Engine Temp',
  fuel_level: 'Fuel Level',
  tire_pressure: 'Tire Pressure',
  battery_voltage: 'Battery',
  rpm: 'RPM',
  oil_pressure: 'Oil Pressure',
  odometer: 'Odometer',
};

const METRIC_UNITS: Record<string, string> = {
  speed: 'km/h',
  engine_temp: '°C',
  fuel_level: '%',
  tire_pressure: 'PSI',
  battery_voltage: 'V',
  rpm: 'RPM',
  oil_pressure: 'kPa',
  odometer: 'km',
};

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

export default function CompactAlertPanel() {
  const [anomalies, setAnomalies] = useState<AnomalyWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnomalies = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/anomalies?status=active&limit=10');
      if (!res.ok) return;
      const json = await res.json();
      setAnomalies(json.data ?? []);
    } catch {
      // silently ignore polling errors
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnomalies(true);
  }, [fetchAnomalies]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchAnomalies(false), 5_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAnomalies]);

  const updateStatus = async (id: string, newStatus: AnomalyStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/anomalies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      const { data } = await res.json();
      setAnomalies((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: data.status, resolved_at: data.resolved_at } : a
        ).filter((a) => a.status === 'active')
      );
    } catch (err) {
      console.error('Error updating anomaly:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Active Alerts</h3>
          {anomalies.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {anomalies.length}
            </span>
          )}
        </div>
        <Link
          href="/alerts"
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          View All
        </Link>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-gray-50 p-3 h-16" />
            ))}
          </div>
        ) : anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
              >
                {/* Row 1: severity dot + vehicle + metric + time */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[anomaly.severity]}`} />
                  <span className="text-xs font-semibold text-gray-900 truncate">
                    {anomaly.vehicles?.name || anomaly.vehicle_id.slice(0, 8)}
                  </span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[anomaly.severity]}`}>
                    {METRIC_LABELS[anomaly.metric_type] || anomaly.metric_type}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                    {formatTimeAgo(anomaly.timestamp)}
                  </span>
                </div>

                {/* Row 2: value vs range + actions */}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-500">
                    <span className="font-mono font-medium text-gray-700">
                      {anomaly.actual_value}{METRIC_UNITS[anomaly.metric_type] || ''}
                    </span>
                    {' '}
                    (expected{' '}
                    {anomaly.expected_range.min !== undefined && anomaly.expected_range.max !== undefined
                      ? `${anomaly.expected_range.min}–${anomaly.expected_range.max}`
                      : anomaly.expected_range.min !== undefined
                      ? `>= ${anomaly.expected_range.min}`
                      : `<= ${anomaly.expected_range.max}`}
                    {METRIC_UNITS[anomaly.metric_type] ? ` ${METRIC_UNITS[anomaly.metric_type]}` : ''})
                  </p>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Link
                      href={`/fleet/${anomaly.vehicle_id}`}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      Vehicle
                    </Link>
                    <button
                      onClick={() => updateStatus(anomaly.id, 'acknowledged')}
                      disabled={updatingId === anomaly.id}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      Ack
                    </button>
                    <button
                      onClick={() => updateStatus(anomaly.id, 'resolved')}
                      disabled={updatingId === anomaly.id}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
