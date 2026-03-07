'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import type { VehicleType } from '@/types';

interface ResponseTimeData {
  vehicleType: string;
  label: string;
  avg: number;
  p95: number;
}

const VEHICLE_TYPE_COLORS: Record<VehicleType, string> = {
  police: '#6366f1',
  ambulance: '#ef4444',
  fire_truck: '#f59e0b',
  civil_protection: '#22c55e',
  hybrid: '#8b5cf6',
};

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  police: 'Police',
  ambulance: 'Ambulance',
  fire_truck: 'Fire Truck',
  civil_protection: 'Civil Protection',
  hybrid: 'Hybrid',
};

export default function ResponseTimeChart() {
  const [data, setData] = useState<ResponseTimeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        // Get vehicles with type info
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('id, type');

        // Get dispatch and arrival events
        const { data: events } = await supabase
          .from('events')
          .select('vehicle_id, event_type, timestamp')
          .in('event_type', ['dispatch', 'arrived'])
          .order('timestamp', { ascending: true });

        if (!vehicles || !events) {
          setData([]);
          return;
        }

        // Build vehicle type lookup
        const vehicleTypeMap: Record<string, VehicleType> = {};
        for (const v of vehicles) {
          vehicleTypeMap[v.id] = v.type as VehicleType;
        }

        // Pair dispatch→arrived and compute response times per type
        const responseTimesByType: Record<string, number[]> = {};
        const dispatches = events.filter((e) => e.event_type === 'dispatch');
        const arrivals = events.filter((e) => e.event_type === 'arrived');

        for (const dispatch of dispatches) {
          const arrival = arrivals.find(
            (a) =>
              a.vehicle_id === dispatch.vehicle_id &&
              new Date(a.timestamp).getTime() > new Date(dispatch.timestamp).getTime()
          );
          if (arrival) {
            const timeMin =
              (new Date(arrival.timestamp).getTime() -
                new Date(dispatch.timestamp).getTime()) /
              (1000 * 60);
            const vType = vehicleTypeMap[dispatch.vehicle_id] ?? 'hybrid';
            if (!responseTimesByType[vType]) responseTimesByType[vType] = [];
            responseTimesByType[vType].push(timeMin);
          }
        }

        // Compute avg and p95 per type
        const chartData: ResponseTimeData[] = Object.entries(responseTimesByType).map(
          ([type, times]) => {
            const sorted = [...times].sort((a, b) => a - b);
            const avg = times.reduce((s, t) => s + t, 0) / times.length;
            const p95Index = Math.floor(sorted.length * 0.95);
            const p95 = sorted[Math.min(p95Index, sorted.length - 1)];

            return {
              vehicleType: type,
              label: VEHICLE_TYPE_LABELS[type as VehicleType] ?? type,
              avg: Math.round(avg * 10) / 10,
              p95: Math.round(p95 * 10) / 10,
            };
          }
        );

        // Sort by label for consistent display
        chartData.sort((a, b) => a.label.localeCompare(b.label));
        setData(chartData);
      } catch (err) {
        console.error('Failed to fetch response time data:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Response Time by Vehicle Type
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Average and 95th percentile response times (minutes)
        </p>
      </div>

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Loading response time data...</span>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">No dispatch/arrival data available</p>
          </div>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              barGap={4}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={45}
                tickFormatter={(value: number) => `${value}m`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  `${(value ?? 0).toFixed(1)} min`,
                  name === 'avg' ? 'Average' : 'P95',
                ]}
                labelStyle={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                formatter={(value: string) => (value === 'avg' ? 'Average' : '95th Percentile')}
              />
              <Bar dataKey="avg" name="avg" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.vehicleType}
                    fill={VEHICLE_TYPE_COLORS[entry.vehicleType as VehicleType] ?? '#6366f1'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
              <Bar dataKey="p95" name="p95" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.vehicleType}
                    fill={VEHICLE_TYPE_COLORS[entry.vehicleType as VehicleType] ?? '#6366f1'}
                    fillOpacity={0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
