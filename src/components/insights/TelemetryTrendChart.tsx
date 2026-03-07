'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import type { MetricType } from '@/types';

interface TelemetryTrendChartProps {
  vehicleId: string;
  metricType: MetricType;
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
}

interface DataPoint {
  timestamp: string;
  value: number;
  label: string;
}

const METRIC_CONFIG: Record<MetricType, { label: string; unit: string; color: string }> = {
  speed: { label: 'Speed', unit: 'km/h', color: '#6366f1' },
  engine_temp: { label: 'Engine Temp', unit: '\u00B0C', color: '#ef4444' },
  fuel_level: { label: 'Fuel Level', unit: '%', color: '#22c55e' },
  tire_pressure: { label: 'Tire Pressure', unit: 'PSI', color: '#f59e0b' },
  battery_voltage: { label: 'Battery Voltage', unit: 'V', color: '#8b5cf6' },
  rpm: { label: 'RPM', unit: 'rpm', color: '#3b82f6' },
  oil_pressure: { label: 'Oil Pressure', unit: 'PSI', color: '#d946ef' },
  odometer: { label: 'Odometer', unit: 'km', color: '#64748b' },
};

const TIME_RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export default function TelemetryTrendChart({
  vehicleId,
  metricType,
  timeRange = '24h',
}: TelemetryTrendChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const config = METRIC_CONFIG[metricType];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const fromDate = new Date(Date.now() - TIME_RANGE_MS[selectedRange]).toISOString();

      const { data: readings, error } = await supabase
        .from('telemetry_readings')
        .select('value, timestamp')
        .eq('vehicle_id', vehicleId)
        .eq('metric_type', metricType)
        .gte('timestamp', fromDate)
        .order('timestamp', { ascending: true })
        .limit(500);

      if (error) throw error;

      const formatted: DataPoint[] = (readings ?? []).map((r) => ({
        timestamp: r.timestamp,
        value: r.value,
        label: formatTimestamp(r.timestamp, selectedRange),
      }));

      setData(formatted);
    } catch (err) {
      console.error('Failed to fetch telemetry trend:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, metricType, selectedRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {config.label} Trend
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time {config.label.toLowerCase()} readings ({config.unit})
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                selectedRange === range
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Loading telemetry data...</span>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">No data available for this time range</p>
          </div>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(value: number) => `${value}${config.unit.length <= 2 ? config.unit : ''}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)} ${config.unit}`, config.label]}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="value"
                name={config.label}
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: config.color }}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(ts: string, range: string): string {
  const d = new Date(ts);
  if (range === '1h' || range === '6h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
