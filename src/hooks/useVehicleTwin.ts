'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Vehicle, TelemetryReading, MetricType } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface VehicleTwinState {
  vehicle: Vehicle | null;
  latestTelemetry: Record<MetricType, TelemetryReading>;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

const METRIC_TYPES: MetricType[] = [
  'speed',
  'engine_temp',
  'fuel_level',
  'tire_pressure',
  'battery_voltage',
  'rpm',
  'oil_pressure',
  'odometer',
];

export function useVehicleTwin(vehicleId: string) {
  const [state, setState] = useState<VehicleTwinState>({
    vehicle: null,
    latestTelemetry: {} as Record<MetricType, TelemetryReading>,
    isConnected: false,
    isLoading: true,
    error: null,
  });

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    const supabase = supabaseRef.current;

    try {
      // Fetch vehicle
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (vehicleError) throw vehicleError;

      // Fetch latest telemetry per metric type
      // We fetch the most recent reading for each metric type
      const telemetryMap: Record<string, TelemetryReading> = {};

      for (const metricType of METRIC_TYPES) {
        const { data } = await supabase
          .from('telemetry_readings')
          .select('*')
          .eq('vehicle_id', vehicleId)
          .eq('metric_type', metricType)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          telemetryMap[metricType] = data as TelemetryReading;
        }
      }

      setState((prev) => ({
        ...prev,
        vehicle: vehicle as Vehicle,
        latestTelemetry: telemetryMap as Record<MetricType, TelemetryReading>,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch vehicle data',
      }));
    }
  }, [vehicleId]);

  // Set up Realtime subscriptions
  useEffect(() => {
    const supabase = supabaseRef.current;

    fetchInitialData();

    // Create a single channel for this vehicle twin
    const channel = supabase
      .channel(`vehicle-twin-${vehicleId}`)
      // Listen for telemetry inserts
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'telemetry_readings',
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        (payload) => {
          const reading = payload.new as TelemetryReading;
          setState((prev) => ({
            ...prev,
            latestTelemetry: {
              ...prev.latestTelemetry,
              [reading.metric_type]: reading,
            },
          }));
        }
      )
      // Listen for vehicle updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vehicles',
          filter: `id=eq.${vehicleId}`,
        },
        (payload) => {
          setState((prev) => ({
            ...prev,
            vehicle: payload.new as Vehicle,
          }));
        }
      )
      .subscribe((status) => {
        setState((prev) => ({
          ...prev,
          isConnected: status === 'SUBSCRIBED',
        }));
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [vehicleId, fetchInitialData]);

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    fetchInitialData();
  }, [fetchInitialData]);

  return {
    vehicle: state.vehicle,
    latestTelemetry: state.latestTelemetry,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
  };
}
