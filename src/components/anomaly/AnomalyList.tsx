'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Anomaly, Severity, AnomalyStatus } from '@/types';

// ----- Severity badge styles -----
const SEVERITY_BADGE: Record<Severity, string> = {
  info: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  warning: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  critical: 'bg-red-100 text-red-800 ring-red-600/20',
};

// ----- Status badge styles -----
const STATUS_BADGE: Record<AnomalyStatus, string> = {
  active: 'bg-red-50 text-red-700 ring-red-600/20',
  acknowledged: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  resolved: 'bg-green-50 text-green-700 ring-green-600/20',
};

// ----- Metric display names -----
const METRIC_LABELS: Record<string, string> = {
  speed: 'Speed',
  engine_temp: 'Engine Temp',
  fuel_level: 'Fuel Level',
  tire_pressure: 'Tire Pressure',
  battery_voltage: 'Battery Voltage',
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

interface AnomalyWithVehicle extends Anomaly {
  vehicles?: {
    name: string;
    plate_number: string;
    type: string;
  };
}

interface AnomalyListProps {
  initialAnomalies: AnomalyWithVehicle[];
  initialSeverity?: string;
  initialStatus?: string;
}

/**
 * AnomalyList - Filterable table of anomalies.
 *
 * Columns: Vehicle, Metric, Value, Expected Range, Severity, Status, Time.
 * Actions: Acknowledge, Resolve buttons.
 */
export default function AnomalyList({
  initialAnomalies,
  initialSeverity = '',
  initialStatus = '',
}: AnomalyListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [anomalies, setAnomalies] = useState<AnomalyWithVehicle[]>(initialAnomalies);
  const [severityFilter, setSeverityFilter] = useState(initialSeverity);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----- Poll for live anomaly updates every 5s -----
  useEffect(() => {
    async function pollAnomalies() {
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (severityFilter) params.set('severity', severityFilter);
        // Default to active + acknowledged if no status filter
        if (statusFilter) {
          params.set('status', statusFilter);
        } else {
          params.set('status', 'active');
        }

        const res = await fetch(`/api/anomalies?${params.toString()}`);
        if (!res.ok) return;
        const json = await res.json();
        const fetched: AnomalyWithVehicle[] = json.data ?? [];

        setAnomalies((prev) => {
          // Merge: keep local status overrides for items being updated
          const prevMap = new Map(prev.map((a) => [a.id, a]));
          const merged = fetched.map((a) => {
            const existing = prevMap.get(a.id);
            // If we're currently updating this item, keep the local version
            if (existing && updatingId === a.id) return existing;
            return a;
          });
          return merged;
        });
      } catch {
        // silently ignore polling errors
      }
    }

    intervalRef.current = setInterval(pollAnomalies, 5_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [severityFilter, statusFilter, updatingId]);

  // ----- Apply filters via URL params -----
  const applyFilters = useCallback(
    (severity: string, status: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (severity) params.set('severity', severity);
      else params.delete('severity');
      if (status) params.set('status', status);
      else params.delete('status');
      router.push(`/alerts?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSeverityChange = (value: string) => {
    setSeverityFilter(value);
    applyFilters(value, statusFilter);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    applyFilters(severityFilter, value);
  };

  // ----- Update anomaly status -----
  const updateAnomalyStatus = async (id: string, newStatus: AnomalyStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/anomalies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to update anomaly:', err);
        return;
      }

      const { data } = await res.json();

      // Update local state
      setAnomalies((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: data.status, resolved_at: data.resolved_at }
            : a
        )
      );
    } catch (err) {
      console.error('Error updating anomaly:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // ----- Format expected range for display -----
  const formatExpectedRange = (range: { min?: number; max?: number }, metricType: string) => {
    const unit = METRIC_UNITS[metricType] || '';
    if (range.min !== undefined && range.max !== undefined) {
      return `${range.min}${unit} - ${range.max}${unit}`;
    }
    if (range.min !== undefined) {
      return `>= ${range.min}${unit}`;
    }
    if (range.max !== undefined) {
      return `<= ${range.max}${unit}`;
    }
    return '-';
  };

  // ----- Format timestamp -----
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="severity-filter" className="text-sm font-medium text-gray-700">
            Severity
          </label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => handleSeverityChange(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-500">
          {anomalies.length} result{anomalies.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Vehicle
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Metric
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Expected Range
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Time
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {anomalies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="h-10 w-10 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>No anomalies found matching your filters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                anomalies.map((anomaly) => (
                  <tr
                    key={anomaly.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    {/* Vehicle */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {anomaly.vehicles?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {anomaly.vehicles?.plate_number || anomaly.vehicle_id.slice(0, 8)}
                      </div>
                    </td>

                    {/* Metric */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {METRIC_LABELS[anomaly.metric_type] || anomaly.metric_type}
                    </td>

                    {/* Value */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {anomaly.actual_value}
                      <span className="ml-0.5 text-xs text-gray-500">
                        {METRIC_UNITS[anomaly.metric_type] || ''}
                      </span>
                    </td>

                    {/* Expected Range */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatExpectedRange(anomaly.expected_range, anomaly.metric_type)}
                    </td>

                    {/* Severity Badge */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${SEVERITY_BADGE[anomaly.severity]}`}
                      >
                        {anomaly.severity.charAt(0).toUpperCase() + anomaly.severity.slice(1)}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_BADGE[anomaly.status]}`}
                      >
                        {anomaly.status.charAt(0).toUpperCase() + anomaly.status.slice(1)}
                      </span>
                    </td>

                    {/* Time */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatTime(anomaly.timestamp)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {anomaly.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => updateAnomalyStatus(anomaly.id, 'acknowledged')}
                            disabled={updatingId === anomaly.id}
                            className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingId === anomaly.id ? (
                              <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24">
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                            ) : null}
                            Acknowledge
                          </button>
                        )}
                        {(anomaly.status === 'active' || anomaly.status === 'acknowledged') && (
                          <button
                            type="button"
                            onClick={() => updateAnomalyStatus(anomaly.id, 'resolved')}
                            disabled={updatingId === anomaly.id}
                            className="inline-flex items-center rounded-md border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingId === anomaly.id ? (
                              <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24">
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                            ) : null}
                            Resolve
                          </button>
                        )}
                        {anomaly.status === 'resolved' && (
                          <span className="text-xs text-gray-400">Resolved</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
