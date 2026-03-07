'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Anomaly } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeAnomaliesOptions {
  /** Only subscribe to anomalies for this vehicle. Null = all vehicles. */
  vehicleId?: string | null;
  /** Maximum number of recent anomalies to keep in state. Default 50. */
  maxItems?: number;
}

interface UseRealtimeAnomaliesReturn {
  /** Most recent anomalies, newest first */
  anomalies: Anomaly[];
  /** Count of active (non-resolved) anomalies */
  activeCount: number;
  /** Count of critical active anomalies */
  criticalCount: number;
  /** Whether the realtime subscription is connected */
  isConnected: boolean;
  /** Clear all anomalies from local state */
  clearAnomalies: () => void;
}

/**
 * useRealtimeAnomalies — Custom hook that subscribes to Supabase Realtime
 * for INSERT events on the anomalies table.
 *
 * Returns the latest anomalies and counts of active/critical alerts.
 * Automatically cleans up subscription on unmount.
 */
export function useRealtimeAnomalies(
  options: UseRealtimeAnomaliesOptions = {}
): UseRealtimeAnomaliesReturn {
  const { vehicleId = null, maxItems = 50 } = options;

  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ----- Fetch initial active anomalies -----
  const fetchInitial = useCallback(async () => {
    const supabase = createClient();

    let query = supabase
      .from('anomalies')
      .select('*')
      .in('status', ['active', 'acknowledged'])
      .order('timestamp', { ascending: false })
      .limit(maxItems);

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch initial anomalies:', error);
      return;
    }

    setAnomalies((data as Anomaly[]) || []);
  }, [vehicleId, maxItems]);

  // ----- Subscribe to realtime inserts -----
  useEffect(() => {
    const supabase = createClient();
    fetchInitial();

    // Build the channel filter
    const channelName = vehicleId
      ? `anomalies-${vehicleId}`
      : 'anomalies-all';

    const filterConfig: {
      event: 'INSERT';
      schema: string;
      table: string;
      filter?: string;
    } = {
      event: 'INSERT' as const,
      schema: 'public',
      table: 'anomalies',
    };

    if (vehicleId) {
      filterConfig.filter = `vehicle_id=eq.${vehicleId}`;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        filterConfig,
        (payload) => {
          const newAnomaly = payload.new as Anomaly;

          setAnomalies((prev) => {
            // Add to front, deduplicate, and trim to maxItems
            const updated = [newAnomaly, ...prev.filter((a) => a.id !== newAnomaly.id)];
            return updated.slice(0, maxItems);
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [vehicleId, maxItems, fetchInitial]);

  // ----- Computed counts -----
  const activeCount = anomalies.filter(
    (a) => a.status === 'active' || a.status === 'acknowledged'
  ).length;

  const criticalCount = anomalies.filter(
    (a) => a.severity === 'critical' && a.status === 'active'
  ).length;

  // ----- Clear -----
  const clearAnomalies = useCallback(() => {
    setAnomalies([]);
  }, []);

  return {
    anomalies,
    activeCount,
    criticalCount,
    isConnected,
    clearAnomalies,
  };
}
