'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TelemetryReading } from '@/types';

interface UseRealtimeTelemetryOptions {
  /** Vehicle ID to subscribe to */
  vehicleId: string;
  /** Maximum number of readings to keep in state (default 100) */
  maxReadings?: number;
  /** Whether the subscription is active (default true) */
  enabled?: boolean;
}

interface UseRealtimeTelemetryReturn {
  /** Latest telemetry readings (newest first) */
  readings: TelemetryReading[];
  /** Whether the realtime channel is connected */
  connected: boolean;
  /** Clear all stored readings */
  clear: () => void;
}

/**
 * Custom hook that subscribes to Supabase Realtime for telemetry_readings
 * inserts for a specific vehicle_id.
 */
export function useRealtimeTelemetry({
  vehicleId,
  maxReadings = 100,
  enabled = true,
}: UseRealtimeTelemetryOptions): UseRealtimeTelemetryReturn {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [connected, setConnected] = useState(false);

  const clear = useCallback(() => {
    setReadings([]);
  }, []);

  useEffect(() => {
    if (!enabled || !vehicleId) {
      setConnected(false);
      return;
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`realtime-telemetry-${vehicleId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT' as const,
          schema: 'public',
          table: 'telemetry_readings',
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        (payload: { new: TelemetryReading }) => {
          setReadings((prev) => {
            const updated = [payload.new, ...prev];
            return updated.slice(0, maxReadings);
          });
        }
      )
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [vehicleId, maxReadings, enabled]);

  return { readings, connected, clear };
}
