'use client';

import { useState } from 'react';
import TelemetryTrendChart from '@/components/insights/TelemetryTrendChart';
import type { MetricType, Severity } from '@/types';

interface AnomalyRow {
  severity: Severity;
  anomaly_type: string;
  metric_type: MetricType;
  timestamp: string;
  description: string;
}

interface VehicleAnalyticsClientProps {
  vehicleId: string;
  recentAnomalies: AnomalyRow[];
}

const METRIC_OPTIONS: { value: MetricType; label: string }[] = [
  { value: 'speed', label: 'Speed' },
  { value: 'engine_temp', label: 'Engine Temp' },
  { value: 'fuel_level', label: 'Fuel Level' },
  { value: 'rpm', label: 'RPM' },
  { value: 'battery_voltage', label: 'Battery Voltage' },
  { value: 'tire_pressure', label: 'Tire Pressure' },
  { value: 'oil_pressure', label: 'Oil Pressure' },
  { value: 'odometer', label: 'Odometer' },
];

const SEVERITY_STYLES: Record<Severity, { dot: string; text: string }> = {
  critical: { dot: 'bg-red-400', text: 'text-red-700' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-700' },
  info: { dot: 'bg-blue-400', text: 'text-blue-700' },
};

export default function VehicleAnalyticsClient({
  vehicleId,
  recentAnomalies,
}: VehicleAnalyticsClientProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('speed');
  const [secondaryMetric, setSecondaryMetric] = useState<MetricType>('engine_temp');

  return (
    <div className="space-y-6">
      {/* Telemetry charts */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Telemetry Trends</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-medium text-gray-500">Primary:</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label className="text-xs font-medium text-gray-500 ml-2">Secondary:</label>
            <select
              value={secondaryMetric}
              onChange={(e) => setSecondaryMetric(e.target.value as MetricType)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {METRIC_OPTIONS.filter((m) => m.value !== selectedMetric).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TelemetryTrendChart
            vehicleId={vehicleId}
            metricType={selectedMetric}
            timeRange="24h"
          />
          <TelemetryTrendChart
            vehicleId={vehicleId}
            metricType={secondaryMetric}
            timeRange="24h"
          />
        </div>
      </div>

      {/* Anomaly Frequency Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Recent Anomalies
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Last 10 anomalies detected for this vehicle
        </p>

        {recentAnomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <svg className="h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">No anomalies detected</p>
            <p className="text-xs mt-0.5">This vehicle is operating within normal parameters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Severity
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Metric
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentAnomalies.map((anomaly, idx) => {
                  const styles = SEVERITY_STYLES[anomaly.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                          <span className={`text-xs font-medium capitalize ${styles.text}`}>
                            {anomaly.severity}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 text-xs">
                        {anomaly.anomaly_type.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 text-xs">
                        {anomaly.metric_type.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs max-w-xs truncate">
                        {anomaly.description}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(anomaly.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Anomaly frequency summary */}
        {recentAnomalies.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Frequency by Metric
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                recentAnomalies.reduce<Record<string, number>>((acc, a) => {
                  acc[a.metric_type] = (acc[a.metric_type] ?? 0) + 1;
                  return acc;
                }, {})
              )
                .sort(([, a], [, b]) => b - a)
                .map(([metric, count]) => (
                  <span
                    key={metric}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                  >
                    {metric.replace('_', ' ')}
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold">
                      {count}
                    </span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
