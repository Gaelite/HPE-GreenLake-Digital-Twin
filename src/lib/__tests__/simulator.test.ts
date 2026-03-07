import { v4 as uuidv4 } from 'uuid';
import { generateTelemetryBatch, generateEvent } from '@/lib/simulator';
import type { MetricType, EventType, Severity } from '@/types';

// ---------------------------------------------------------------------------
// Mock uuid so every call returns a deterministic but unique value
// ---------------------------------------------------------------------------
jest.mock('uuid', () => {
  let counter = 0;
  return {
    v4: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-a000-${String(counter).padStart(12, '0')}`;
    }),
  };
});

// ---------------------------------------------------------------------------
// Constants mirrored from the module under test for validation
// ---------------------------------------------------------------------------
const SIMULATED_METRICS: MetricType[] = [
  'speed',
  'engine_temp',
  'fuel_level',
  'tire_pressure',
  'battery_voltage',
  'rpm',
  'oil_pressure',
];

const METRIC_RANGES: Record<MetricType, { min: number; max: number; unit: string }> = {
  speed:           { min: 0,    max: 160,    unit: 'km/h' },
  engine_temp:     { min: 70,   max: 120,    unit: '°C' },
  fuel_level:      { min: 5,    max: 100,    unit: '%' },
  tire_pressure:   { min: 28,   max: 40,     unit: 'psi' },
  battery_voltage: { min: 11.5, max: 14.8,   unit: 'V' },
  rpm:             { min: 600,  max: 7000,   unit: 'rpm' },
  oil_pressure:    { min: 20,   max: 80,     unit: 'psi' },
  odometer:        { min: 0,    max: 999999, unit: 'km' },
};

const VALID_EVENT_TYPES: EventType[] = [
  'dispatch',
  'en_route',
  'arrived',
  'completed',
  'maintenance_alert',
  'refuel',
  'equipment_check',
];

const VALID_SEVERITIES: Severity[] = ['info', 'warning', 'critical'];

// Madrid coordinates and tolerance
const BASE_LAT = 40.4168;
const BASE_LNG = -3.7038;
const POSITION_TOLERANCE = 0.05;

// UUID v4 pattern (accepts the deterministic mock format as well)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 timestamp pattern
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

// ---------------------------------------------------------------------------
// generateTelemetryBatch
// ---------------------------------------------------------------------------
describe('generateTelemetryBatch', () => {
  const vehicleId = 'vehicle-test-001';

  it('returns exactly 7 readings (one per simulated metric)', () => {
    const batch = generateTelemetryBatch(vehicleId);
    expect(batch).toHaveLength(7);
  });

  it('includes the correct vehicle_id on every reading', () => {
    const batch = generateTelemetryBatch(vehicleId);
    for (const reading of batch) {
      expect(reading.vehicle_id).toBe(vehicleId);
    }
  });

  it('contains each simulated metric_type exactly once', () => {
    const batch = generateTelemetryBatch(vehicleId);
    const metricTypes = batch.map((r) => r.metric_type);

    for (const metric of SIMULATED_METRICS) {
      expect(metricTypes).toContain(metric);
    }
    // No duplicates
    expect(new Set(metricTypes).size).toBe(SIMULATED_METRICS.length);
  });

  it('produces values within the defined range for each metric', () => {
    // Generate several batches to exercise the random walk
    for (let i = 0; i < 20; i++) {
      const batch = generateTelemetryBatch(`range-test-vehicle-${i}`);
      for (const reading of batch) {
        const range = METRIC_RANGES[reading.metric_type];
        expect(reading.value).toBeGreaterThanOrEqual(range.min);
        expect(reading.value).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it('assigns the correct unit for each metric', () => {
    const batch = generateTelemetryBatch(vehicleId);
    for (const reading of batch) {
      const expected = METRIC_RANGES[reading.metric_type];
      expect(reading.unit).toBe(expected.unit);
    }
  });

  it('produces latitude values near Madrid (within tolerance)', () => {
    const batch = generateTelemetryBatch(vehicleId);
    for (const reading of batch) {
      expect(reading.latitude).toBeGreaterThanOrEqual(BASE_LAT - POSITION_TOLERANCE);
      expect(reading.latitude).toBeLessThanOrEqual(BASE_LAT + POSITION_TOLERANCE);
    }
  });

  it('produces longitude values near Madrid (within tolerance)', () => {
    const batch = generateTelemetryBatch(vehicleId);
    for (const reading of batch) {
      expect(reading.longitude).toBeGreaterThanOrEqual(BASE_LNG - POSITION_TOLERANCE);
      expect(reading.longitude).toBeLessThanOrEqual(BASE_LNG + POSITION_TOLERANCE);
    }
  });

  it('assigns every reading a valid UUID as id', () => {
    const batch = generateTelemetryBatch(vehicleId);
    for (const reading of batch) {
      expect(reading.id).toMatch(UUID_REGEX);
    }
  });

  it('assigns every reading a unique id', () => {
    const batch = generateTelemetryBatch(vehicleId);
    const ids = batch.map((r) => r.id);
    expect(new Set(ids).size).toBe(batch.length);
  });

  it('includes a valid ISO 8601 timestamp on every reading', () => {
    const batch = generateTelemetryBatch(vehicleId);
    for (const reading of batch) {
      expect(reading.timestamp).toMatch(ISO_TIMESTAMP_REGEX);
      // Also verify it parses to a valid Date
      expect(new Date(reading.timestamp).getTime()).not.toBeNaN();
    }
  });

  it('shares the same timestamp across all readings in a single batch', () => {
    const batch = generateTelemetryBatch(vehicleId);
    const timestamps = new Set(batch.map((r) => r.timestamp));
    expect(timestamps.size).toBe(1);
  });

  it('shares the same lat/lng across all readings in a single batch', () => {
    const batch = generateTelemetryBatch(vehicleId);
    const lats = new Set(batch.map((r) => r.latitude));
    const lngs = new Set(batch.map((r) => r.longitude));
    expect(lats.size).toBe(1);
    expect(lngs.size).toBe(1);
  });

  it('does NOT include a created_at property', () => {
    const batch = generateTelemetryBatch(vehicleId);
    for (const reading of batch) {
      expect(reading).not.toHaveProperty('created_at');
    }
  });

  it('produces drifting (non-identical) values across consecutive calls for the same vehicle', () => {
    const driftVehicle = 'drift-vehicle-001';
    const batch1 = generateTelemetryBatch(driftVehicle);
    const batch2 = generateTelemetryBatch(driftVehicle);

    // Build value maps keyed by metric_type for easy comparison
    const values1 = new Map(batch1.map((r) => [r.metric_type, r.value]));
    const values2 = new Map(batch2.map((r) => [r.metric_type, r.value]));

    // At least one metric should have changed between the two batches.
    // Statistically, with 7 independent random walks, it is essentially
    // impossible for all 7 to stay identical.
    let anyDifferent = false;
    for (const metric of SIMULATED_METRICS) {
      if (values1.get(metric) !== values2.get(metric)) {
        anyDifferent = true;
        break;
      }
    }
    expect(anyDifferent).toBe(true);
  });

  it('produces different values for different vehicle ids', () => {
    const batchA = generateTelemetryBatch('vehicle-A-unique');
    const batchB = generateTelemetryBatch('vehicle-B-unique');

    const valuesA = new Map(batchA.map((r) => [r.metric_type, r.value]));
    const valuesB = new Map(batchB.map((r) => [r.metric_type, r.value]));

    let anyDifferent = false;
    for (const metric of SIMULATED_METRICS) {
      if (valuesA.get(metric) !== valuesB.get(metric)) {
        anyDifferent = true;
        break;
      }
    }
    expect(anyDifferent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateEvent
// ---------------------------------------------------------------------------
describe('generateEvent', () => {
  const vehicleId = 'vehicle-event-001';

  it('returns an object with all required properties', () => {
    const event = generateEvent(vehicleId);

    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('vehicle_id');
    expect(event).toHaveProperty('event_type');
    expect(event).toHaveProperty('description');
    expect(event).toHaveProperty('severity');
    expect(event).toHaveProperty('metadata');
    expect(event).toHaveProperty('timestamp');
  });

  it('assigns the correct vehicle_id', () => {
    const event = generateEvent(vehicleId);
    expect(event.vehicle_id).toBe(vehicleId);
  });

  it('has a valid UUID as id', () => {
    const event = generateEvent(vehicleId);
    expect(event.id).toMatch(UUID_REGEX);
  });

  it('returns an event_type that is a valid EventType', () => {
    const event = generateEvent(vehicleId);
    expect(VALID_EVENT_TYPES).toContain(event.event_type);
  });

  it('returns a severity that is a valid Severity', () => {
    const event = generateEvent(vehicleId);
    expect(VALID_SEVERITIES).toContain(event.severity);
  });

  it('includes a non-empty description string', () => {
    const event = generateEvent(vehicleId);
    expect(typeof event.description).toBe('string');
    expect(event.description.length).toBeGreaterThan(0);
  });

  it('includes metadata as an object', () => {
    const event = generateEvent(vehicleId);
    expect(typeof event.metadata).toBe('object');
    expect(event.metadata).not.toBeNull();
  });

  it('includes a valid ISO 8601 timestamp', () => {
    const event = generateEvent(vehicleId);
    expect(event.timestamp).toMatch(ISO_TIMESTAMP_REGEX);
    expect(new Date(event.timestamp).getTime()).not.toBeNaN();
  });

  it('does NOT include a created_at property', () => {
    const event = generateEvent(vehicleId);
    expect(event).not.toHaveProperty('created_at');
  });

  it('produces varied events across multiple invocations', () => {
    const eventTypes = new Set<EventType>();
    const descriptions = new Set<string>();

    // Generate enough events to get variety (statistically near-certain
    // with 8 templates and multiple descriptions each)
    for (let i = 0; i < 50; i++) {
      const event = generateEvent(vehicleId);
      eventTypes.add(event.event_type);
      descriptions.add(event.description);
    }

    // With 7 distinct event types and 50 draws, we expect multiple types
    expect(eventTypes.size).toBeGreaterThan(1);
    // And multiple distinct description strings
    expect(descriptions.size).toBeGreaterThan(1);
  });

  it('always selects event_type from the valid set across many calls', () => {
    for (let i = 0; i < 30; i++) {
      const event = generateEvent(`stress-vehicle-${i}`);
      expect(VALID_EVENT_TYPES).toContain(event.event_type);
      expect(VALID_SEVERITIES).toContain(event.severity);
    }
  });
});
