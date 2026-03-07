'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface KPIData {
  value: number;
  unit: string;
  trend: number;
}

interface KPIsResponse {
  kpis: {
    avgResponseTime: KPIData;
    fleetUtilization: KPIData;
    vehiclesInService: KPIData;
    activeAlerts: KPIData;
  };
}

interface KPIConfig {
  key: keyof KPIsResponse['kpis'];
  label: string;
  color: string;
  invertTrend?: boolean;
  icon: React.ReactNode;
}

const KPI_CONFIGS: KPIConfig[] = [
  {
    key: 'avgResponseTime',
    label: 'Avg Response',
    color: 'from-violet-500 to-purple-600',
    invertTrend: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'fleetUtilization',
    label: 'Utilization',
    color: 'from-emerald-500 to-green-600',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
  },
  {
    key: 'vehiclesInService',
    label: 'In Service',
    color: 'from-blue-500 to-indigo-600',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    key: 'activeAlerts',
    label: 'Active Alerts',
    color: 'from-orange-500 to-red-600',
    invertTrend: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
];

export default function MiniKPIStrip() {
  const [kpis, setKpis] = useState<KPIsResponse['kpis'] | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchKpis() {
      try {
        const res = await fetch('/api/insights/kpis');
        if (!res.ok) return;
        const data: KPIsResponse = await res.json();
        if (active) setKpis(data.kpis);
      } catch {
        // silently ignore polling errors
      }
    }

    fetchKpis();
    const interval = setInterval(fetchKpis, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!kpis) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-white p-3 shadow-sm h-[68px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {KPI_CONFIGS.map((config) => {
        const kpi = kpis[config.key];
        const isPositive = config.invertTrend ? kpi.trend < 0 : kpi.trend > 0;
        const isNeutral = kpi.trend === 0;

        return (
          <Link
            key={config.key}
            href="/insights"
            className="group flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-gray-200"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${config.color} text-white`}>
              {config.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 truncate">
                {config.label}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-gray-900">
                  {typeof kpi.value === 'number' && kpi.value % 1 !== 0
                    ? kpi.value.toFixed(1)
                    : kpi.value}
                </span>
                <span className="text-xs text-gray-400">{kpi.unit}</span>
                {!isNeutral && (
                  <span
                    className={`ml-auto text-[10px] font-semibold ${
                      isPositive ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {kpi.trend > 0 ? '+' : ''}{kpi.trend}%
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
