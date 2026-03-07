'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from 'recharts';

interface KPIData {
  value: number;
  unit: string;
  trend: number;
  sparkline: number[];
}

interface KPIsResponse {
  kpis: {
    avgResponseTime: KPIData;
    fleetUtilization: KPIData;
    vehiclesInService: KPIData;
    activeAlerts: KPIData;
  };
}

interface KPICardConfig {
  key: keyof KPIsResponse['kpis'];
  label: string;
  icon: React.ReactNode;
  color: string;
  sparklineColor: string;
  invertTrend?: boolean; // true = lower is better (e.g. response time)
}

const KPI_CONFIGS: KPICardConfig[] = [
  {
    key: 'avgResponseTime',
    label: 'Avg Response Time',
    color: 'from-violet-500 to-purple-600',
    sparklineColor: '#a78bfa',
    invertTrend: true,
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'fleetUtilization',
    label: 'Fleet Utilization',
    color: 'from-emerald-500 to-green-600',
    sparklineColor: '#6ee7b7',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
  },
  {
    key: 'vehiclesInService',
    label: 'Vehicles In Service',
    color: 'from-blue-500 to-indigo-600',
    sparklineColor: '#93c5fd',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    key: 'activeAlerts',
    label: 'Active Alerts',
    color: 'from-orange-500 to-red-600',
    sparklineColor: '#fca5a5',
    invertTrend: true,
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
];

export default function KPIDashboard() {
  const [kpis, setKpis] = useState<KPIsResponse['kpis'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchKpis() {
      try {
        const res = await fetch('/api/insights/kpis');
        if (!res.ok) throw new Error('Failed to fetch KPIs');
        const data: KPIsResponse = await res.json();
        setKpis(data.kpis);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchKpis();
    // Refresh every 30 seconds
    const interval = setInterval(fetchKpis, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-white p-6 shadow-sm"
          >
            <div className="h-4 w-24 rounded bg-gray-200 mb-4" />
            <div className="h-8 w-20 rounded bg-gray-200 mb-3" />
            <div className="h-10 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center text-red-600">
        <p className="font-medium">Failed to load KPIs</p>
        <p className="text-sm mt-1">{error ?? 'No data available'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_CONFIGS.map((config) => {
        const kpi = kpis[config.key];
        return (
          <KPICard
            key={config.key}
            config={config}
            kpi={kpi}
          />
        );
      })}
    </div>
  );
}

function KPICard({
  config,
  kpi,
}: {
  config: KPICardConfig;
  kpi: KPIData;
}) {
  const sparkData = kpi.sparkline.map((value, index) => ({ value, index }));
  const isPositiveTrend = config.invertTrend ? kpi.trend < 0 : kpi.trend > 0;
  const isNeutralTrend = kpi.trend === 0;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-gray-200">
      {/* Top gradient accent */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${config.color}`} />

      <div className="p-5 pt-4">
        {/* Header: icon + label */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${config.color} text-white`}>
              {config.icon}
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {config.label}
            </span>
          </div>
          {/* Trend indicator */}
          {!isNeutralTrend && (
            <div
              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                isPositiveTrend
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {kpi.trend > 0 ? (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {Math.abs(kpi.trend)}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-3xl font-bold tracking-tight text-gray-900">
            {typeof kpi.value === 'number' && kpi.value % 1 !== 0
              ? kpi.value.toFixed(1)
              : kpi.value}
          </span>
          <span className="text-sm font-medium text-gray-400">{kpi.unit}</span>
        </div>

        {/* Sparkline */}
        <div className="h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.sparklineColor}
                strokeWidth={2}
                dot={false}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
