// ============================================================
// Recommendation Engine — Generates automated insights
// ============================================================

import type {
  Insight,
  InsightType,
  Severity,
  Vehicle,
  Anomaly,
  TelemetryReading,
  VehicleEvent,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ----- Helper: create an Insight object -----
function createInsight(
  type: InsightType,
  title: string,
  description: string,
  severity: Severity,
  vehicleId: string | null = null,
  metadata: Record<string, unknown> = {}
): Insight {
  return {
    id: uuidv4(),
    insight_type: type,
    title,
    description,
    severity,
    vehicle_id: vehicleId,
    metadata,
    created_at: new Date().toISOString(),
    is_dismissed: false,
    status: 'active',
    read_at: null,
  };
}

// ----- Check: Maintenance Due (based on mileage / odometer) -----
export function checkMaintenanceDue(
  vehicles: Vehicle[],
  telemetryReadings: TelemetryReading[]
): Insight[] {
  const insights: Insight[] = [];
  const MAINTENANCE_THRESHOLD_KM = 10000;
  const WARNING_THRESHOLD_KM = 8000;

  for (const vehicle of vehicles) {
    // Get most recent odometer reading for this vehicle
    const odometerReadings = telemetryReadings
      .filter((r) => r.vehicle_id === vehicle.id && r.metric_type === 'odometer')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (odometerReadings.length === 0) continue;

    const latestOdometer = odometerReadings[0].value;
    // Assume metadata stores last_maintenance_odometer, otherwise use modulo logic
    const lastMaintenanceOdometer =
      (vehicle.specifications?.last_maintenance_odometer as number) ?? 0;
    const kmSinceMaintenance = latestOdometer - lastMaintenanceOdometer;

    if (kmSinceMaintenance >= MAINTENANCE_THRESHOLD_KM) {
      insights.push(
        createInsight(
          'maintenance_due',
          `Maintenance Overdue: ${vehicle.name}`,
          `Vehicle ${vehicle.name} (${vehicle.plate_number}) has traveled ${kmSinceMaintenance.toLocaleString()} km since last maintenance. Immediate service recommended.`,
          'critical',
          vehicle.id,
          { km_since_maintenance: kmSinceMaintenance, odometer: latestOdometer }
        )
      );
    } else if (kmSinceMaintenance >= WARNING_THRESHOLD_KM) {
      insights.push(
        createInsight(
          'maintenance_due',
          `Maintenance Approaching: ${vehicle.name}`,
          `Vehicle ${vehicle.name} (${vehicle.plate_number}) has traveled ${kmSinceMaintenance.toLocaleString()} km since last maintenance. Schedule service soon.`,
          'warning',
          vehicle.id,
          { km_since_maintenance: kmSinceMaintenance, odometer: latestOdometer }
        )
      );
    }
  }

  return insights;
}

// ----- Check: Anomaly Spikes (>3 anomalies in 7 days) -----
export function checkAnomalySpikes(
  vehicles: Vehicle[],
  anomalies: Anomaly[]
): Insight[] {
  const insights: Insight[] = [];
  const SPIKE_THRESHOLD = 3;
  const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = Date.now();

  for (const vehicle of vehicles) {
    const recentAnomalies = anomalies.filter(
      (a) =>
        a.vehicle_id === vehicle.id &&
        now - new Date(a.timestamp).getTime() < WINDOW_MS
    );

    if (recentAnomalies.length > SPIKE_THRESHOLD) {
      const criticalCount = recentAnomalies.filter((a) => a.severity === 'critical').length;
      const severity: Severity = criticalCount > 1 ? 'critical' : 'warning';

      insights.push(
        createInsight(
          'anomaly_spike',
          `Anomaly Spike: ${vehicle.name}`,
          `Vehicle ${vehicle.name} has ${recentAnomalies.length} anomalies in the past 7 days (${criticalCount} critical). Investigate sensor data and vehicle condition.`,
          severity,
          vehicle.id,
          {
            anomaly_count: recentAnomalies.length,
            critical_count: criticalCount,
            window_days: 7,
          }
        )
      );
    }
  }

  return insights;
}

// ----- Check: Response Time Trends -----
export function checkResponseTimeTrends(
  events: VehicleEvent[]
): Insight[] {
  const insights: Insight[] = [];
  const RESPONSE_TIME_WARNING_MINUTES = 12;
  const RESPONSE_TIME_CRITICAL_MINUTES = 20;

  // Group dispatch/arrived event pairs by vehicle
  const dispatchEvents = events
    .filter((e) => e.event_type === 'dispatch')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const arrivedEvents = events
    .filter((e) => e.event_type === 'arrived')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Group by vehicle for pairing
  const vehicleResponseTimes: Record<string, number[]> = {};

  for (const dispatch of dispatchEvents) {
    const arrival = arrivedEvents.find(
      (a) =>
        a.vehicle_id === dispatch.vehicle_id &&
        new Date(a.timestamp).getTime() > new Date(dispatch.timestamp).getTime()
    );
    if (arrival) {
      const responseTimeMin =
        (new Date(arrival.timestamp).getTime() - new Date(dispatch.timestamp).getTime()) /
        (1000 * 60);
      if (!vehicleResponseTimes[dispatch.vehicle_id]) {
        vehicleResponseTimes[dispatch.vehicle_id] = [];
      }
      vehicleResponseTimes[dispatch.vehicle_id].push(responseTimeMin);
    }
  }

  for (const [vehicleId, times] of Object.entries(vehicleResponseTimes)) {
    if (times.length < 2) continue;
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;

    if (avgTime >= RESPONSE_TIME_CRITICAL_MINUTES) {
      insights.push(
        createInsight(
          'response_time_trend',
          'Critical Response Time Degradation',
          `Vehicle ${vehicleId.slice(0, 8)} average response time is ${avgTime.toFixed(1)} min over ${times.length} dispatches. Well above target.`,
          'critical',
          vehicleId,
          { avg_response_time: avgTime, dispatch_count: times.length }
        )
      );
    } else if (avgTime >= RESPONSE_TIME_WARNING_MINUTES) {
      insights.push(
        createInsight(
          'response_time_trend',
          'Elevated Response Times',
          `Vehicle ${vehicleId.slice(0, 8)} average response time is ${avgTime.toFixed(1)} min over ${times.length} dispatches. Monitor closely.`,
          'warning',
          vehicleId,
          { avg_response_time: avgTime, dispatch_count: times.length }
        )
      );
    }
  }

  return insights;
}

// ----- Check: Low Utilization -----
export function checkLowUtilization(
  vehicles: Vehicle[],
  events: VehicleEvent[]
): Insight[] {
  const insights: Insight[] = [];
  const LOW_UTILIZATION_THRESHOLD = 0.15; // Less than 15% utilization
  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = Date.now();

  for (const vehicle of vehicles) {
    if (vehicle.status === 'offline' || vehicle.status === 'maintenance') continue;

    const recentDispatches = events.filter(
      (e) =>
        e.vehicle_id === vehicle.id &&
        e.event_type === 'dispatch' &&
        now - new Date(e.timestamp).getTime() < WINDOW_MS
    );

    // Estimate: each dispatch cycle ~2 hours, 30 days = 720 hours
    const hoursUtilized = recentDispatches.length * 2;
    const totalHours = 720;
    const utilization = hoursUtilized / totalHours;

    if (utilization < LOW_UTILIZATION_THRESHOLD && vehicle.status === 'available') {
      insights.push(
        createInsight(
          'utilization_alert',
          `Low Utilization: ${vehicle.name}`,
          `Vehicle ${vehicle.name} has only ${recentDispatches.length} dispatches in 30 days (${(utilization * 100).toFixed(1)}% utilization). Consider reallocation or rotation.`,
          'info',
          vehicle.id,
          {
            dispatch_count: recentDispatches.length,
            utilization_pct: utilization * 100,
            window_days: 30,
          }
        )
      );
    }
  }

  return insights;
}

// ----- Check: Fuel Efficiency -----
export function checkFuelEfficiency(
  vehicles: Vehicle[],
  telemetryReadings: TelemetryReading[]
): Insight[] {
  const insights: Insight[] = [];
  const LOW_FUEL_THRESHOLD = 20; // percentage

  for (const vehicle of vehicles) {
    const fuelReadings = telemetryReadings
      .filter((r) => r.vehicle_id === vehicle.id && r.metric_type === 'fuel_level')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (fuelReadings.length < 2) continue;

    const latestFuel = fuelReadings[0].value;
    const previousFuel = fuelReadings[Math.min(4, fuelReadings.length - 1)].value;
    const fuelDropRate = previousFuel - latestFuel;

    if (latestFuel < LOW_FUEL_THRESHOLD) {
      insights.push(
        createInsight(
          'fuel_efficiency',
          `Low Fuel: ${vehicle.name}`,
          `Vehicle ${vehicle.name} fuel level is at ${latestFuel.toFixed(0)}%. Refueling needed soon.`,
          latestFuel < 10 ? 'critical' : 'warning',
          vehicle.id,
          { fuel_level: latestFuel, fuel_drop_rate: fuelDropRate }
        )
      );
    } else if (fuelDropRate > 30) {
      insights.push(
        createInsight(
          'fuel_efficiency',
          `Unusual Fuel Consumption: ${vehicle.name}`,
          `Vehicle ${vehicle.name} has an unusual fuel drop of ${fuelDropRate.toFixed(1)}% over recent readings. Check for leaks or driving patterns.`,
          'warning',
          vehicle.id,
          { fuel_level: latestFuel, fuel_drop_rate: fuelDropRate }
        )
      );
    }
  }

  return insights;
}

// ----- Master: Generate All Insights -----
export function generateAllInsights(
  vehicles: Vehicle[],
  telemetryReadings: TelemetryReading[],
  anomalies: Anomaly[],
  events: VehicleEvent[]
): Insight[] {
  const allInsights: Insight[] = [
    ...checkMaintenanceDue(vehicles, telemetryReadings),
    ...checkAnomalySpikes(vehicles, anomalies),
    ...checkResponseTimeTrends(events),
    ...checkLowUtilization(vehicles, events),
    ...checkFuelEfficiency(vehicles, telemetryReadings),
  ];

  // Sort by severity priority: critical > warning > info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  allInsights.sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return allInsights;
}
