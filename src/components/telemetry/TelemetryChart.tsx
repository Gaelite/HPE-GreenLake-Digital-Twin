'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { MetricType } from '@/types';

// ----- Metric display config -----
const METRIC_CHART_CONFIG: Record<
  MetricType,
  { label: string; color: string; unit: string }
> = {
  speed: { label: 'Speed', color: '#3B82F6', unit: 'km/h' },
  engine_temp: { label: 'Engine Temp', color: '#F97316', unit: '°C' },
  fuel_level: { label: 'Fuel Level', color: '#10B981', unit: '%' },
  tire_pressure: { label: 'Tire Pressure', color: '#8B5CF6', unit: 'psi' },
  battery_voltage: { label: 'Battery Voltage', color: '#EAB308', unit: 'V' },
  rpm: { label: 'RPM', color: '#F43F5E', unit: 'rpm' },
  oil_pressure: { label: 'Oil Pressure', color: '#06B6D4', unit: 'psi' },
  odometer: { label: 'Odometer', color: '#6B7280', unit: 'km' },
};

interface ChartDataPoint {
  timestamp: string;
  displayTime: string;
  value: number;
}

interface TelemetryChartProps {
  vehicleId: string;
  metricType: MetricType;
  /** ISO string or relative shorthand like '1h', '6h', '24h' */
  timeRange?: string;
}

function resolveTimeRange(range?: string): string {
  if (!range) {
    // Default: last 1 hour
    return new Date(Date.now() - 60 * 60 * 1000).toISOString();
  }
  const match = range.match(/^(\d+)([hmd])$/);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const ms =
      unit === 'h'
        ? amount * 60 * 60 * 1000
        : unit === 'm'
        ? amount * 60 * 1000
        : amount * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms).toISOString();
  }
  // Assume it's already an ISO string
  return range;
}

export default function TelemetryChart({
  vehicleId,
  metricType,
  timeRange,
}: TelemetryChartProps) {
  const [rawData, setRawData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = METRIC_CHART_CONFIG[metricType];

  // Fetch data from API
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const from = resolveTimeRange(timeRange);
        const params = new URLSearchParams({
          vehicle_id: vehicleId,
          metric_type: metricType,
          from,
          limit: '500',
        });

        const res = await fetch(`/api/telemetry?${params.toString()}`);
        const json = await res.json();

        if (!cancelled && json.data) {
          // API returns newest first — reverse for charting
          const points: ChartDataPoint[] = json.data
            .reverse()
            .map((r: { timestamp: string; value: number }) => ({
              timestamp: r.timestamp,
              displayTime: new Date(r.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }),
              value: r.value,
            }));
          setRawData(points);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch telemetry chart data:', err);
          setError('Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();

    // Re-fetch every 10 seconds for near-real-time updates
    const interval = setInterval(fetchData, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [vehicleId, metricType, timeRange]);

  // Compute Y-axis domain with some padding
  const yDomain = useMemo(() => {
    if (rawData.length === 0) return [0, 100];
    const values = rawData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 5;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [rawData]);

  if (loading && rawData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <h3 className="text-sm font-semibold text-gray-900">{config.label}</h3>
          <span className="text-xs text-gray-400">({config.unit})</span>
        </div>
        {rawData.length > 0 && (
          <span className="text-xs text-gray-400">
            {rawData.length} point{rawData.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error ? (
        <div className="flex items-center justify-center h-48 text-sm text-red-500">
          {error}
        </div>
      ) : rawData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          No telemetry data available for this time range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rawData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="displayTime"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#6B7280', fontWeight: 600 }}
              formatter={(value: number | undefined) => [
                `${value ?? '-'} ${config.unit}`,
                config.label,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', color: '#6B7280' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={config.label}
              stroke={config.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: config.color }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
