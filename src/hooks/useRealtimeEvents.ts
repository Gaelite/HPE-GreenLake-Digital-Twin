'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { VehicleEvent } from '@/types';

interface UseRealtimeEventsOptions {
  /** Vehicle ID to subscribe to */
  vehicleId: string;
  /** Maximum number of events to keep in state (default 50) */
  maxEvents?: number;
  /** Whether the subscription is active (default true) */
  enabled?: boolean;
}

interface UseRealtimeEventsReturn {
  /** Latest events (newest first) */
  events: VehicleEvent[];
  /** Whether the realtime channel is connected */
  connected: boolean;
  /** Clear all stored events */
  clear: () => void;
}

/**
 * Custom hook that subscribes to Supabase Realtime for vehicle_events
 * inserts for a specific vehicle_id.
 */
export function useRealtimeEvents({
  vehicleId,
  maxEvents = 50,
  enabled = true,
}: UseRealtimeEventsOptions): UseRealtimeEventsReturn {
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!enabled || !vehicleId) {
      setConnected(false);
      return;
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`realtime-events-${vehicleId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT' as const,
          schema: 'public',
          table: 'events',
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        (payload: { new: VehicleEvent }) => {
          setEvents((prev) => {
            const updated = [payload.new, ...prev];
            return updated.slice(0, maxEvents);
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
  }, [vehicleId, maxEvents, enabled]);

  return { events, connected, clear };
}
