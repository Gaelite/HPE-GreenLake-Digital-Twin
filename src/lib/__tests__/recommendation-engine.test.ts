// ============================================================
// Unit Tests — Recommendation Engine
// ============================================================

let mockUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `mock-uuid-${++mockUuidCounter}`,
}));

import {
  checkMaintenanceDue,
  checkAnomalySpikes,
  checkResponseTimeTrends,
  checkLowUtilization,
  checkFuelEfficiency,
  generateAllInsights,
} from '@/lib/recommendation-engine';

import type {
  Vehicle,
  TelemetryReading,
  Anomaly,
  VehicleEvent,
  Insight,
} from '@/types';

// ============================================================
// Helpers — Factory functions for mock data
// ============================================================

const VEHICLE_ID_1 = 'a1b2c3d4-0001-4000-8000-000000000001';
const VEHICLE_ID_2 = 'a1b2c3d4-0002-4000-8000-000000000002';
const VEHICLE_ID_3 = 'a1b2c3d4-0003-4000-8000-000000000003';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: VEHICLE_ID_1,
    type: 'ambulance',
    name: 'Ambulance-01',
    plate_number: 'EMG-1001',
    status: 'available',
    year: 2022,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    specifications: {},
    current_latitude: 40.4168,
    current_longitude: -3.7038,
    risk_score: 25,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTelemetry(overrides: Partial<TelemetryReading> = {}): TelemetryReading {
  return {
    id: 'tel-00000000-0000-4000-8000-000000000001',
    vehicle_id: VEHICLE_ID_1,
    metric_type: 'odometer',
    value: 50000,
    unit: 'km',
    latitude: null,
    longitude: null,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'anom-0000-0000-4000-8000-000000000001',
    vehicle_id: VEHICLE_ID_1,
    telemetry_reading_id: null,
    anomaly_type: 'threshold_breach',
    metric_type: 'engine_temp',
    expected_range: { min: 80, max: 110 },
    actual_value: 125,
    severity: 'warning',
    status: 'active',
    description: 'Engine temperature above normal',
    timestamp: new Date().toISOString(),
    resolved_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<VehicleEvent> = {}): VehicleEvent {
  return {
    id: 'evt-00000000-0000-4000-8000-000000000001',
    vehicle_id: VEHICLE_ID_1,
    event_type: 'dispatch',
    description: 'Dispatched to incident',
    severity: 'info',
    metadata: {},
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUuidCounter = 0;
});

/** Return an ISO string for `daysAgo` days in the past from now. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Return an ISO string for `minutesAgo` minutes in the past from now. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// ============================================================
// checkMaintenanceDue
// ============================================================

describe('checkMaintenanceDue', () => {
  it('should return a critical insight when km since maintenance >= 10000', () => {
    const vehicle = makeVehicle({
      specifications: { last_maintenance_odometer: 40000 },
    });
    const telemetry = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 50500, timestamp: daysAgo(0) }),
    ];

    const insights = checkMaintenanceDue([vehicle], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('critical');
    expect(insights[0].insight_type).toBe('maintenance_due');
    expect(insights[0].vehicle_id).toBe(vehicle.id);
    expect(insights[0].title).toContain('Overdue');
    expect(insights[0].metadata.km_since_maintenance).toBe(10500);
  });

  it('should return a warning insight when km since maintenance >= 8000 and < 10000', () => {
    const vehicle = makeVehicle({
      specifications: { last_maintenance_odometer: 42000 },
    });
    const telemetry = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 50500, timestamp: daysAgo(0) }),
    ];

    const insights = checkMaintenanceDue([vehicle], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].insight_type).toBe('maintenance_due');
    expect(insights[0].title).toContain('Approaching');
    expect(insights[0].metadata.km_since_maintenance).toBe(8500);
  });

  it('should return no insight when km since maintenance is below 8000', () => {
    const vehicle = makeVehicle({
      specifications: { last_maintenance_odometer: 46000 },
    });
    const telemetry = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 50000, timestamp: daysAgo(0) }),
    ];

    const insights = checkMaintenanceDue([vehicle], telemetry);

    expect(insights).toHaveLength(0);
  });

  it('should skip vehicles with no odometer readings', () => {
    const vehicle = makeVehicle();
    // Provide only non-odometer telemetry
    const telemetry = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 80 }),
    ];

    const insights = checkMaintenanceDue([vehicle], telemetry);

    expect(insights).toHaveLength(0);
  });

  it('should use the most recent odometer reading when multiple exist', () => {
    const vehicle = makeVehicle({
      specifications: { last_maintenance_odometer: 30000 },
    });
    const telemetry = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 35000, timestamp: daysAgo(5) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 41000, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 33000, timestamp: daysAgo(10) }),
    ];

    const insights = checkMaintenanceDue([vehicle], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('critical');
    expect(insights[0].metadata.km_since_maintenance).toBe(11000);
    expect(insights[0].metadata.odometer).toBe(41000);
  });

  it('should default last_maintenance_odometer to 0 when not specified', () => {
    const vehicle = makeVehicle({ specifications: {} });
    const telemetry = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 10000, timestamp: daysAgo(0) }),
    ];

    const insights = checkMaintenanceDue([vehicle], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('critical');
    expect(insights[0].metadata.km_since_maintenance).toBe(10000);
  });

  it('should handle multiple vehicles independently', () => {
    const v1 = makeVehicle({
      id: VEHICLE_ID_1,
      name: 'V1',
      plate_number: 'P1',
      specifications: { last_maintenance_odometer: 0 },
    });
    const v2 = makeVehicle({
      id: VEHICLE_ID_2,
      name: 'V2',
      plate_number: 'P2',
      specifications: { last_maintenance_odometer: 0 },
    });

    const telemetry = [
      makeTelemetry({ vehicle_id: VEHICLE_ID_1, metric_type: 'odometer', value: 12000 }),
      makeTelemetry({ vehicle_id: VEHICLE_ID_2, metric_type: 'odometer', value: 5000 }),
    ];

    const insights = checkMaintenanceDue([v1, v2], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].vehicle_id).toBe(VEHICLE_ID_1);
  });
});

// ============================================================
// checkAnomalySpikes
// ============================================================

describe('checkAnomalySpikes', () => {
  it('should return a warning insight when more than 3 anomalies in 7 days with <= 1 critical', () => {
    const vehicle = makeVehicle();
    const anomalies = [
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'warning', timestamp: daysAgo(1) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'warning', timestamp: daysAgo(2) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'critical', timestamp: daysAgo(3) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'info', timestamp: daysAgo(4) }),
    ];

    const insights = checkAnomalySpikes([vehicle], anomalies);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].insight_type).toBe('anomaly_spike');
    expect(insights[0].vehicle_id).toBe(vehicle.id);
    expect(insights[0].metadata.anomaly_count).toBe(4);
    expect(insights[0].metadata.critical_count).toBe(1);
  });

  it('should return a critical insight when more than 3 anomalies with > 1 critical', () => {
    const vehicle = makeVehicle();
    const anomalies = [
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'critical', timestamp: daysAgo(1) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'critical', timestamp: daysAgo(2) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'warning', timestamp: daysAgo(3) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'info', timestamp: daysAgo(4) }),
    ];

    const insights = checkAnomalySpikes([vehicle], anomalies);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('critical');
    expect(insights[0].metadata.critical_count).toBe(2);
  });

  it('should return no insight when exactly 3 anomalies (threshold is > 3)', () => {
    const vehicle = makeVehicle();
    const anomalies = [
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(1) }),
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(2) }),
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(3) }),
    ];

    const insights = checkAnomalySpikes([vehicle], anomalies);

    expect(insights).toHaveLength(0);
  });

  it('should ignore anomalies older than 7 days', () => {
    const vehicle = makeVehicle();
    const anomalies = [
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(1) }),
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(2) }),
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(8) }),
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(10) }),
      makeAnomaly({ vehicle_id: vehicle.id, timestamp: daysAgo(15) }),
    ];

    const insights = checkAnomalySpikes([vehicle], anomalies);

    // Only 2 anomalies within 7 days, which is <= 3
    expect(insights).toHaveLength(0);
  });

  it('should handle multiple vehicles independently', () => {
    const v1 = makeVehicle({ id: VEHICLE_ID_1, name: 'V1' });
    const v2 = makeVehicle({ id: VEHICLE_ID_2, name: 'V2' });

    const anomalies = [
      // V1: 4 anomalies (spike)
      makeAnomaly({ vehicle_id: VEHICLE_ID_1, severity: 'warning', timestamp: daysAgo(0) }),
      makeAnomaly({ vehicle_id: VEHICLE_ID_1, severity: 'warning', timestamp: daysAgo(1) }),
      makeAnomaly({ vehicle_id: VEHICLE_ID_1, severity: 'warning', timestamp: daysAgo(2) }),
      makeAnomaly({ vehicle_id: VEHICLE_ID_1, severity: 'warning', timestamp: daysAgo(3) }),
      // V2: 1 anomaly (no spike)
      makeAnomaly({ vehicle_id: VEHICLE_ID_2, severity: 'warning', timestamp: daysAgo(1) }),
    ];

    const insights = checkAnomalySpikes([v1, v2], anomalies);

    expect(insights).toHaveLength(1);
    expect(insights[0].vehicle_id).toBe(VEHICLE_ID_1);
  });

  it('should return no insight for an empty anomaly list', () => {
    const vehicle = makeVehicle();
    const insights = checkAnomalySpikes([vehicle], []);

    expect(insights).toHaveLength(0);
  });
});

// ============================================================
// checkResponseTimeTrends
// ============================================================

describe('checkResponseTimeTrends', () => {
  it('should return a critical insight when avg response time >= 20 min', () => {
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(100) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(75) }),  // 25 min
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(60) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(38) }),  // 22 min
    ];

    const insights = checkResponseTimeTrends(events);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('critical');
    expect(insights[0].insight_type).toBe('response_time_trend');
    expect(insights[0].title).toContain('Critical');
    expect(insights[0].vehicle_id).toBe(VEHICLE_ID_1);
    expect((insights[0].metadata.avg_response_time as number)).toBeGreaterThanOrEqual(20);
  });

  it('should return a warning insight when avg response time >= 12 min and < 20 min', () => {
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(100) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(85) }),   // 15 min
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(70) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(57) }),   // 13 min
    ];

    const insights = checkResponseTimeTrends(events);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].insight_type).toBe('response_time_trend');
    expect(insights[0].title).toContain('Elevated');
    const avgTime = insights[0].metadata.avg_response_time as number;
    expect(avgTime).toBeGreaterThanOrEqual(12);
    expect(avgTime).toBeLessThan(20);
  });

  it('should return no insight when avg response time is below 12 min', () => {
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(50) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(45) }),  // 5 min
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(30) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(23) }),  // 7 min
    ];

    const insights = checkResponseTimeTrends(events);

    expect(insights).toHaveLength(0);
  });

  it('should skip vehicles with fewer than 2 dispatch/arrival pairs', () => {
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(50) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(25) }),  // only 1 pair, 25 min
    ];

    const insights = checkResponseTimeTrends(events);

    expect(insights).toHaveLength(0);
  });

  it('should handle dispatch events with no matching arrival', () => {
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(100) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(50) }),
      // No arrival events at all
    ];

    const insights = checkResponseTimeTrends(events);

    expect(insights).toHaveLength(0);
  });

  it('should handle multiple vehicles independently', () => {
    const events: VehicleEvent[] = [
      // Vehicle 1: avg ~23 min -> critical
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(200) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(175) }),  // 25 min
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'dispatch', timestamp: minutesAgo(150) }),
      makeEvent({ vehicle_id: VEHICLE_ID_1, event_type: 'arrived', timestamp: minutesAgo(129) }),  // 21 min
      // Vehicle 2: avg ~5 min -> no insight
      makeEvent({ vehicle_id: VEHICLE_ID_2, event_type: 'dispatch', timestamp: minutesAgo(200) }),
      makeEvent({ vehicle_id: VEHICLE_ID_2, event_type: 'arrived', timestamp: minutesAgo(195) }),  // 5 min
      makeEvent({ vehicle_id: VEHICLE_ID_2, event_type: 'dispatch', timestamp: minutesAgo(150) }),
      makeEvent({ vehicle_id: VEHICLE_ID_2, event_type: 'arrived', timestamp: minutesAgo(145) }),  // 5 min
    ];

    const insights = checkResponseTimeTrends(events);

    expect(insights).toHaveLength(1);
    expect(insights[0].vehicle_id).toBe(VEHICLE_ID_1);
    expect(insights[0].severity).toBe('critical');
  });

  it('should return no insight for an empty events list', () => {
    const insights = checkResponseTimeTrends([]);

    expect(insights).toHaveLength(0);
  });
});

// ============================================================
// checkLowUtilization
// ============================================================

describe('checkLowUtilization', () => {
  it('should return an info insight when utilization < 15% for an available vehicle', () => {
    const vehicle = makeVehicle({ status: 'available' });
    // 5 dispatches => 10h / 720h = 1.4% utilization
    const events: VehicleEvent[] = Array.from({ length: 5 }, (_, i) =>
      makeEvent({
        vehicle_id: vehicle.id,
        event_type: 'dispatch',
        timestamp: daysAgo(i + 1),
      })
    );

    const insights = checkLowUtilization([vehicle], events);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('info');
    expect(insights[0].insight_type).toBe('utilization_alert');
    expect(insights[0].vehicle_id).toBe(vehicle.id);
    expect(insights[0].title).toContain('Low Utilization');
    expect(insights[0].metadata.dispatch_count).toBe(5);
  });

  it('should return no insight when utilization is >= 15%', () => {
    const vehicle = makeVehicle({ status: 'available' });
    // 54 dispatches => 108h / 720h = 15%
    const events: VehicleEvent[] = Array.from({ length: 55 }, (_, i) =>
      makeEvent({
        vehicle_id: vehicle.id,
        event_type: 'dispatch',
        timestamp: daysAgo(i % 29 + 1), // spread within 30-day window
      })
    );

    const insights = checkLowUtilization([vehicle], events);

    expect(insights).toHaveLength(0);
  });

  it('should skip vehicles with offline status', () => {
    const vehicle = makeVehicle({ status: 'offline' });
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(5) }),
    ];

    const insights = checkLowUtilization([vehicle], events);

    expect(insights).toHaveLength(0);
  });

  it('should skip vehicles with maintenance status', () => {
    const vehicle = makeVehicle({ status: 'maintenance' });
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(5) }),
    ];

    const insights = checkLowUtilization([vehicle], events);

    expect(insights).toHaveLength(0);
  });

  it('should not flag a non-available vehicle even with low dispatches (e.g., in_service)', () => {
    // The code checks vehicle.status === 'available' for the insight push
    const vehicle = makeVehicle({ status: 'in_service' });
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(5) }),
    ];

    const insights = checkLowUtilization([vehicle], events);

    expect(insights).toHaveLength(0);
  });

  it('should only count dispatch events within the 30-day window', () => {
    const vehicle = makeVehicle({ status: 'available' });
    const events: VehicleEvent[] = [
      // Recent dispatches (within 30 days)
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(1) }),
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(10) }),
      // Old dispatches (outside 30-day window)
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(35) }),
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(60) }),
    ];

    const insights = checkLowUtilization([vehicle], events);

    expect(insights).toHaveLength(1);
    expect(insights[0].metadata.dispatch_count).toBe(2);
  });

  it('should flag a vehicle with zero dispatches as low utilization', () => {
    const vehicle = makeVehicle({ status: 'available' });

    const insights = checkLowUtilization([vehicle], []);

    expect(insights).toHaveLength(1);
    expect(insights[0].metadata.dispatch_count).toBe(0);
    expect(insights[0].metadata.utilization_pct).toBe(0);
  });
});

// ============================================================
// checkFuelEfficiency
// ============================================================

describe('checkFuelEfficiency', () => {
  it('should return a critical insight when fuel level < 10%', () => {
    const vehicle = makeVehicle();
    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 8, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 30, timestamp: daysAgo(1) }),
    ];

    const insights = checkFuelEfficiency([vehicle], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('critical');
    expect(insights[0].insight_type).toBe('fuel_efficiency');
    expect(insights[0].title).toContain('Low Fuel');
    expect(insights[0].vehicle_id).toBe(vehicle.id);
    expect(insights[0].metadata.fuel_level).toBe(8);
  });

  it('should return a warning insight when fuel level >= 10% and < 20%', () => {
    const vehicle = makeVehicle();
    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 15, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 40, timestamp: daysAgo(1) }),
    ];

    const insights = checkFuelEfficiency([vehicle], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].title).toContain('Low Fuel');
  });

  it('should return a warning when fuel drop > 30% over recent readings even if level is ok', () => {
    const vehicle = makeVehicle();
    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 45, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 55, timestamp: daysAgo(1) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 65, timestamp: daysAgo(2) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 70, timestamp: daysAgo(3) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 80, timestamp: daysAgo(4) }),
    ];

    const insights = checkFuelEfficiency([vehicle], telemetry);

    // latestFuel=45, previousFuel (index min(4, 4)=4) => 80, drop=35 > 30
    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].title).toContain('Unusual Fuel Consumption');
    expect(insights[0].metadata.fuel_drop_rate).toBe(35);
  });

  it('should return no insight when fuel level is healthy and drop is small', () => {
    const vehicle = makeVehicle();
    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 75, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 80, timestamp: daysAgo(1) }),
    ];

    const insights = checkFuelEfficiency([vehicle], telemetry);

    expect(insights).toHaveLength(0);
  });

  it('should skip vehicles with fewer than 2 fuel readings', () => {
    const vehicle = makeVehicle();
    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 5, timestamp: daysAgo(0) }),
    ];

    const insights = checkFuelEfficiency([vehicle], telemetry);

    expect(insights).toHaveLength(0);
  });

  it('should prioritize low fuel insight over fuel drop insight', () => {
    // When fuel < 20, the low fuel branch fires and the else-if for drop is not reached.
    const vehicle = makeVehicle();
    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 5, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 90, timestamp: daysAgo(4) }),
    ];

    const insights = checkFuelEfficiency([vehicle], telemetry);

    // Even though drop is 85%, we get "Low Fuel" (critical), not "Unusual Fuel Consumption"
    expect(insights).toHaveLength(1);
    expect(insights[0].title).toContain('Low Fuel');
    expect(insights[0].severity).toBe('critical');
  });

  it('should handle multiple vehicles independently', () => {
    const v1 = makeVehicle({ id: VEHICLE_ID_1, name: 'V1' });
    const v2 = makeVehicle({ id: VEHICLE_ID_2, name: 'V2' });

    const telemetry: TelemetryReading[] = [
      // V1: low fuel
      makeTelemetry({ vehicle_id: VEHICLE_ID_1, metric_type: 'fuel_level', value: 7, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: VEHICLE_ID_1, metric_type: 'fuel_level', value: 50, timestamp: daysAgo(1) }),
      // V2: healthy fuel
      makeTelemetry({ vehicle_id: VEHICLE_ID_2, metric_type: 'fuel_level', value: 85, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: VEHICLE_ID_2, metric_type: 'fuel_level', value: 90, timestamp: daysAgo(1) }),
    ];

    const insights = checkFuelEfficiency([v1, v2], telemetry);

    expect(insights).toHaveLength(1);
    expect(insights[0].vehicle_id).toBe(VEHICLE_ID_1);
  });

  it('should use index min(4, length-1) for previousFuel with fewer than 5 readings', () => {
    const vehicle = makeVehicle();
    // 3 readings: previousFuel is index min(4, 2)=2
    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 40, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 60, timestamp: daysAgo(1) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 72, timestamp: daysAgo(2) }),
    ];

    const insights = checkFuelEfficiency([vehicle], telemetry);

    // drop = 72 - 40 = 32 > 30 => warning
    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].title).toContain('Unusual Fuel Consumption');
    expect(insights[0].metadata.fuel_drop_rate).toBe(32);
  });
});

// ============================================================
// generateAllInsights
// ============================================================

describe('generateAllInsights', () => {
  it('should combine insights from all check functions', () => {
    const vehicle = makeVehicle({
      status: 'available',
      specifications: { last_maintenance_odometer: 0 },
    });

    const telemetry: TelemetryReading[] = [
      // Trigger maintenance critical (10000 km)
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 15000, timestamp: daysAgo(0) }),
      // Trigger fuel low (critical)
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 5, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 60, timestamp: daysAgo(1) }),
    ];

    const anomalies: Anomaly[] = [
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'critical', timestamp: daysAgo(0) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'critical', timestamp: daysAgo(1) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'warning', timestamp: daysAgo(2) }),
      makeAnomaly({ vehicle_id: vehicle.id, severity: 'warning', timestamp: daysAgo(3) }),
    ];

    // Low utilization: only 1 dispatch in 30 days
    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: daysAgo(5) }),
    ];

    const insights = generateAllInsights([vehicle], telemetry, anomalies, events);

    // Expected insights:
    // 1. maintenance_due (critical) - 15000 km since last maintenance
    // 2. anomaly_spike (critical) - 4 anomalies, 2 critical
    // 3. fuel_efficiency (critical) - fuel at 5%
    // 4. utilization_alert (info) - 1 dispatch in 30 days
    // No response_time_trend - only 1 dispatch event, no pairs
    expect(insights.length).toBeGreaterThanOrEqual(4);

    const types = insights.map((i) => i.insight_type);
    expect(types).toContain('maintenance_due');
    expect(types).toContain('anomaly_spike');
    expect(types).toContain('fuel_efficiency');
    expect(types).toContain('utilization_alert');
  });

  it('should sort insights by severity: critical first, then warning, then info', () => {
    const v1 = makeVehicle({ id: VEHICLE_ID_1, name: 'V1', plate_number: 'P1', status: 'available' });
    const v2 = makeVehicle({
      id: VEHICLE_ID_2,
      name: 'V2',
      plate_number: 'P2',
      status: 'available',
      specifications: { last_maintenance_odometer: 0 },
    });

    const telemetry: TelemetryReading[] = [
      // V2: maintenance warning (8500 km)
      makeTelemetry({ vehicle_id: VEHICLE_ID_2, metric_type: 'odometer', value: 8500, timestamp: daysAgo(0) }),
    ];

    // V1: low utilization info
    const events: VehicleEvent[] = [];

    const insights = generateAllInsights([v1, v2], telemetry, [], events);

    // V2 gets maintenance warning, V1 gets utilization info
    // Ensure warnings come before info
    if (insights.length >= 2) {
      const severities = insights.map((i) => i.severity);
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      for (let i = 0; i < severities.length - 1; i++) {
        expect(severityOrder[severities[i]]).toBeLessThanOrEqual(severityOrder[severities[i + 1]]);
      }
    }
  });

  it('should return an empty array when no conditions are met', () => {
    const vehicle = makeVehicle({
      status: 'offline', // skips utilization
      specifications: { last_maintenance_odometer: 49000 },
    });

    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 50000, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 80, timestamp: daysAgo(0) }),
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'fuel_level', value: 85, timestamp: daysAgo(1) }),
    ];

    const insights = generateAllInsights([vehicle], telemetry, [], []);

    expect(insights).toHaveLength(0);
  });

  it('should return an empty array when all inputs are empty', () => {
    const insights = generateAllInsights([], [], [], []);

    expect(insights).toHaveLength(0);
  });

  it('should set correct insight structure properties on all returned insights', () => {
    const vehicle = makeVehicle({
      specifications: { last_maintenance_odometer: 0 },
    });

    const telemetry: TelemetryReading[] = [
      makeTelemetry({ vehicle_id: vehicle.id, metric_type: 'odometer', value: 12000, timestamp: daysAgo(0) }),
    ];

    const insights = generateAllInsights([vehicle], telemetry, [], []);

    for (const insight of insights) {
      expect(insight).toHaveProperty('id');
      expect(typeof insight.id).toBe('string');
      expect(insight.id.length).toBeGreaterThan(0);
      expect(insight).toHaveProperty('insight_type');
      expect(insight).toHaveProperty('title');
      expect(insight).toHaveProperty('description');
      expect(insight).toHaveProperty('severity');
      expect(['critical', 'warning', 'info']).toContain(insight.severity);
      expect(insight).toHaveProperty('vehicle_id');
      expect(insight).toHaveProperty('metadata');
      expect(typeof insight.metadata).toBe('object');
      expect(insight).toHaveProperty('created_at');
      expect(insight.is_dismissed).toBe(false);
    }
  });

  it('should include response time trend insights when qualifying events exist', () => {
    const vehicle = makeVehicle({ status: 'available' });

    const events: VehicleEvent[] = [
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: minutesAgo(200) }),
      makeEvent({ vehicle_id: vehicle.id, event_type: 'arrived', timestamp: minutesAgo(175) }),  // 25 min
      makeEvent({ vehicle_id: vehicle.id, event_type: 'dispatch', timestamp: minutesAgo(100) }),
      makeEvent({ vehicle_id: vehicle.id, event_type: 'arrived', timestamp: minutesAgo(78) }),   // 22 min
    ];

    const insights = generateAllInsights([vehicle], [], [], events);

    const responseTimeInsights = insights.filter((i) => i.insight_type === 'response_time_trend');
    expect(responseTimeInsights).toHaveLength(1);
    expect(responseTimeInsights[0].severity).toBe('critical');
  });
});
