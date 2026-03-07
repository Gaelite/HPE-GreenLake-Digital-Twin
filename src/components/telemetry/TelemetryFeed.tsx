'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TelemetryReading, MetricType } from '@/types';

// Color mapping for each metric type
const METRIC_COLORS: Record<MetricType, string> = {
  speed: 'text-blue-600 bg-blue-50 border-blue-200',
  engine_temp: 'text-orange-600 bg-orange-50 border-orange-200',
  fuel_level: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  tire_pressure: 'text-purple-600 bg-purple-50 border-purple-200',
  battery_voltage: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  rpm: 'text-rose-600 bg-rose-50 border-rose-200',
  oil_pressure: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  odometer: 'text-gray-600 bg-gray-50 border-gray-200',
};

const METRIC_BADGE_COLORS: Record<MetricType, string> = {
  speed: 'bg-blue-100 text-blue-700',
  engine_temp: 'bg-orange-100 text-orange-700',
  fuel_level: 'bg-emerald-100 text-emerald-700',
  tire_pressure: 'bg-purple-100 text-purple-700',
  battery_voltage: 'bg-yellow-100 text-yellow-700',
  rpm: 'bg-rose-100 text-rose-700',
  oil_pressure: 'bg-cyan-100 text-cyan-700',
  odometer: 'bg-gray-100 text-gray-700',
};

const METRIC_LABELS: Record<MetricType, string> = {
  speed: 'Speed',
  engine_temp: 'Engine Temp',
  fuel_level: 'Fuel Level',
  tire_pressure: 'Tire Pressure',
  battery_voltage: 'Battery',
  rpm: 'RPM',
  oil_pressure: 'Oil Pressure',
  odometer: 'Odometer',
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface TelemetryFeedProps {
  /** Optionally filter feed to one vehicle */
  vehicleId?: string;
  /** Max items shown in the scrolling list */
  maxItems?: number;
}

export default function TelemetryFeed({ vehicleId, maxItems = 60 }: TelemetryFeedProps) {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    // Build realtime filter
    const channelName = vehicleId
      ? `telemetry-feed-${vehicleId}`
      : 'telemetry-feed-all';

    let channel = supabase.channel(channelName);

    const filterConfig: {
      event: 'INSERT';
      schema: string;
      table: string;
      filter?: string;
    } = {
      event: 'INSERT' as const,
      schema: 'public',
      table: 'telemetry_readings',
    };

    if (vehicleId) {
      filterConfig.filter = `vehicle_id=eq.${vehicleId}`;
    }

    channel = channel.on(
      'postgres_changes' as never,
      filterConfig,
      (payload: { new: TelemetryReading }) => {
        setReadings((prev) => {
          const updated = [payload.new, ...prev];
          return updated.slice(0, maxItems);
        });
      }
    );

    channel.subscribe((status: string) => {
      setConnected(status === 'SUBSCRIBED');
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vehicleId, maxItems]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [readings]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Live Telemetry Feed</h3>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              connected
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {connected ? 'Live' : 'Connecting...'}
          </span>
        </div>
        <span className="text-xs text-gray-400">{readings.length} readings</span>
      </div>

      {/* Scrolling list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto divide-y divide-gray-50 min-h-0"
      >
        {readings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 py-12">
            Waiting for telemetry data...
          </div>
        ) : (
          readings.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors border-l-2 ${
                METRIC_COLORS[r.metric_type]?.split(' ').pop() || 'border-gray-200'
              }`}
            >
              {/* Metric badge */}
              <span
                className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${
                  METRIC_BADGE_COLORS[r.metric_type] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {METRIC_LABELS[r.metric_type] || r.metric_type}
              </span>

              {/* Value */}
              <span className="text-sm font-mono font-semibold text-gray-900 tabular-nums">
                {typeof r.value === 'number' ? r.value.toLocaleString() : r.value}
              </span>
              <span className="text-xs text-gray-400">{r.unit}</span>

              {/* Spacer */}
              <span className="flex-1" />

              {/* Vehicle ID (truncated) — only when not filtered */}
              {!vehicleId && r.vehicle_id && (
                <span className="text-[11px] text-gray-400 font-mono truncate max-w-[80px]">
                  {r.vehicle_id.slice(0, 8)}
                </span>
              )}

              {/* Timestamp */}
              <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap">
                {formatTimestamp(r.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
