import {
  checkTelemetryForAnomalies,
  calculateRiskScore,
  type AnomalyInsert,
} from '@/lib/anomaly-engine';
import type {
  TelemetryReading,
  DetectionRule,
  Anomaly,
  MetricType,
  Severity,
  AnomalyStatus,
} from '@/types';

// ============================================================
// Factory helpers for building test fixtures
// ============================================================

/** Creates a minimal TelemetryReading with sensible defaults. */
function makeReading(
  overrides: Partial<TelemetryReading> & { metric_type: MetricType; value: number }
): TelemetryReading {
  return {
    id: 'reading-1',
    vehicle_id: 'vehicle-1',
    unit: '',
    latitude: null,
    longitude: null,
    timestamp: '2026-01-15T10:00:00Z',
    created_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

/** Creates a minimal DetectionRule with sensible defaults. */
function makeRule(
  overrides: Partial<DetectionRule> & { metric_type: MetricType }
): DetectionRule {
  return {
    id: 'rule-1',
    vehicle_type: null,
    min_value: null,
    max_value: null,
    severity: 'warning',
    description: 'Test rule',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Creates a minimal Anomaly with sensible defaults. */
function makeAnomaly(
  overrides: Partial<Anomaly> & { severity: Severity; status: AnomalyStatus }
): Anomaly {
  return {
    id: 'anomaly-1',
    vehicle_id: 'vehicle-1',
    telemetry_reading_id: 'reading-1',
    anomaly_type: 'threshold_breach',
    metric_type: 'engine_temp',
    expected_range: { max: 110 },
    actual_value: 120,
    description: 'Test anomaly',
    timestamp: '2026-01-15T10:00:00Z',
    resolved_at: null,
    created_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// ============================================================
// checkTelemetryForAnomalies
// ============================================================

describe('checkTelemetryForAnomalies', () => {
  // ----------------------------------------------------------
  // No match scenarios
  // ----------------------------------------------------------

  it('returns an empty array when no rules are provided', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 90 });
    const result = checkTelemetryForAnomalies(reading, []);
    expect(result).toEqual([]);
  });

  it('returns an empty array when value is within the safe range (above-threshold rule)', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 100 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  it('returns an empty array when value equals the max_value exactly (not strictly greater)', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 110 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  it('returns an empty array when fuel level is above the threshold (below-threshold rule)', () => {
    const reading = makeReading({ metric_type: 'fuel_level', value: 50 });
    const rule = makeRule({
      metric_type: 'fuel_level',
      min_value: 0,
      max_value: 5,
      severity: 'warning',
      description: 'Low fuel',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------
  // Above threshold detection (max_value only, min_value null)
  // ----------------------------------------------------------

  it('detects an "above threshold" anomaly when engine_temp exceeds max_value', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 120 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      vehicle_id: 'vehicle-1',
      telemetry_reading_id: 'reading-1',
      anomaly_type: 'threshold_breach',
      metric_type: 'engine_temp',
      expected_range: { max: 110 },
      actual_value: 120,
      severity: 'critical',
      status: 'active',
    });
    expect(result[0].description).toContain('Engine overheating');
    expect(result[0].description).toContain('120');
  });

  it('detects an "above threshold" anomaly for speed exceeding limit', () => {
    const reading = makeReading({ metric_type: 'speed', value: 170 });
    const rule = makeRule({
      metric_type: 'speed',
      min_value: null,
      max_value: 160,
      severity: 'warning',
      description: 'Speed limit exceeded',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0].metric_type).toBe('speed');
    expect(result[0].expected_range).toEqual({ max: 160 });
    expect(result[0].actual_value).toBe(170);
    expect(result[0].severity).toBe('warning');
  });

  // ----------------------------------------------------------
  // Below threshold detection (both min_value=0 and max_value set)
  // ----------------------------------------------------------

  it('detects a "below threshold" anomaly when fuel_level is below max_value', () => {
    const reading = makeReading({ metric_type: 'fuel_level', value: 3 });
    const rule = makeRule({
      metric_type: 'fuel_level',
      min_value: 0,
      max_value: 5,
      severity: 'warning',
      description: 'Low fuel level',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      vehicle_id: 'vehicle-1',
      anomaly_type: 'threshold_breach',
      metric_type: 'fuel_level',
      expected_range: { min: 5 },
      actual_value: 3,
      severity: 'warning',
      status: 'active',
    });
    expect(result[0].description).toContain('Low fuel level');
    expect(result[0].description).toContain('3');
  });

  it('detects a "below threshold" anomaly when tire_pressure is dangerously low', () => {
    const reading = makeReading({ metric_type: 'tire_pressure', value: 18 });
    const rule = makeRule({
      metric_type: 'tire_pressure',
      min_value: 0,
      max_value: 22,
      severity: 'critical',
      description: 'Low tire pressure',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0].expected_range).toEqual({ min: 22 });
    expect(result[0].actual_value).toBe(18);
  });

  it('does not trigger "below threshold" when value equals the threshold exactly', () => {
    const reading = makeReading({ metric_type: 'fuel_level', value: 5 });
    const rule = makeRule({
      metric_type: 'fuel_level',
      min_value: 0,
      max_value: 5,
      severity: 'warning',
      description: 'Low fuel level',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------
  // Min-only rule (min_value set, max_value null)
  // ----------------------------------------------------------

  it('detects anomaly when value falls below min_value (min-only rule)', () => {
    const reading = makeReading({ metric_type: 'battery_voltage', value: 10 });
    const rule = makeRule({
      metric_type: 'battery_voltage',
      min_value: 11.5,
      max_value: null,
      severity: 'critical',
      description: 'Low battery voltage',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0].expected_range).toEqual({ min: 11.5 });
    expect(result[0].actual_value).toBe(10);
  });

  it('does not trigger min-only rule when value is at or above min_value', () => {
    const reading = makeReading({ metric_type: 'battery_voltage', value: 12 });
    const rule = makeRule({
      metric_type: 'battery_voltage',
      min_value: 11.5,
      max_value: null,
      severity: 'critical',
      description: 'Low battery voltage',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------
  // Inactive rules
  // ----------------------------------------------------------

  it('skips inactive rules even when the value would trigger them', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 200 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
      is_active: false,
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------
  // Metric type filtering
  // ----------------------------------------------------------

  it('skips rules with a non-matching metric_type', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 200 });
    const rule = makeRule({
      metric_type: 'speed',
      min_value: null,
      max_value: 160,
      severity: 'warning',
      description: 'Speed limit exceeded',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------
  // Vehicle type filtering
  // ----------------------------------------------------------

  it('applies rules with vehicle_type=null to all vehicle types', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 120 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
      vehicle_type: null,
    });

    const resultNoType = checkTelemetryForAnomalies(reading, [rule]);
    const resultAmbulance = checkTelemetryForAnomalies(reading, [rule], 'ambulance');
    const resultPolice = checkTelemetryForAnomalies(reading, [rule], 'police');

    expect(resultNoType).toHaveLength(1);
    expect(resultAmbulance).toHaveLength(1);
    expect(resultPolice).toHaveLength(1);
  });

  it('applies rules with a specific vehicle_type only when the type matches', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 120 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
      vehicle_type: 'ambulance',
    });

    const resultMatch = checkTelemetryForAnomalies(reading, [rule], 'ambulance');
    const resultMismatch = checkTelemetryForAnomalies(reading, [rule], 'police');
    const resultNoType = checkTelemetryForAnomalies(reading, [rule]);

    expect(resultMatch).toHaveLength(1);
    expect(resultMismatch).toEqual([]);
    expect(resultNoType).toEqual([]);
  });

  // ----------------------------------------------------------
  // Multiple rules matching
  // ----------------------------------------------------------

  it('returns multiple anomalies when multiple rules match the same reading', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 130 });
    const warningRule = makeRule({
      id: 'rule-warning',
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'warning',
      description: 'Engine temp elevated',
    });
    const criticalRule = makeRule({
      id: 'rule-critical',
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 120,
      severity: 'critical',
      description: 'Engine critical overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [warningRule, criticalRule]);

    expect(result).toHaveLength(2);
    expect(result[0].severity).toBe('warning');
    expect(result[1].severity).toBe('critical');
  });

  it('only returns anomalies for rules that actually match (mixed match/no-match)', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 115 });
    const matchingRule = makeRule({
      id: 'rule-1',
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'warning',
      description: 'Engine temp elevated',
    });
    const nonMatchingRule = makeRule({
      id: 'rule-2',
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 120,
      severity: 'critical',
      description: 'Engine critical overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [matchingRule, nonMatchingRule]);

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('warning');
  });

  // ----------------------------------------------------------
  // Output field correctness
  // ----------------------------------------------------------

  it('sets anomaly_type to "threshold_breach" for all generated anomalies', () => {
    const reading = makeReading({ metric_type: 'rpm', value: 7000 });
    const rule = makeRule({
      metric_type: 'rpm',
      min_value: null,
      max_value: 6500,
      severity: 'warning',
      description: 'RPM too high',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0].anomaly_type).toBe('threshold_breach');
  });

  it('sets status to "active" for all generated anomalies', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 120 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
  });

  it('builds description from rule description and actual value with unit', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 120 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result[0].description).toBe('Engine overheating: actual value 120\u00B0C');
  });

  it('includes the correct unit for fuel_level in the description', () => {
    const reading = makeReading({ metric_type: 'fuel_level', value: 3 });
    const rule = makeRule({
      metric_type: 'fuel_level',
      min_value: 0,
      max_value: 5,
      severity: 'warning',
      description: 'Low fuel level',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result[0].description).toBe('Low fuel level: actual value 3%');
  });

  it('includes the correct unit for speed in the description', () => {
    const reading = makeReading({ metric_type: 'speed', value: 170 });
    const rule = makeRule({
      metric_type: 'speed',
      min_value: null,
      max_value: 160,
      severity: 'warning',
      description: 'Speed limit exceeded',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result[0].description).toBe('Speed limit exceeded: actual value 170km/h');
  });

  it('uses reading.timestamp for the anomaly timestamp', () => {
    const reading = makeReading({
      metric_type: 'engine_temp',
      value: 120,
      timestamp: '2026-06-15T14:30:00Z',
    });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result[0].timestamp).toBe('2026-06-15T14:30:00Z');
  });

  it('sets vehicle_id and telemetry_reading_id from the reading', () => {
    const reading = makeReading({
      id: 'reading-abc',
      vehicle_id: 'vehicle-xyz',
      metric_type: 'engine_temp',
      value: 120,
    });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: 110,
      severity: 'critical',
      description: 'Engine overheating',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result[0].vehicle_id).toBe('vehicle-xyz');
    expect(result[0].telemetry_reading_id).toBe('reading-abc');
  });

  // ----------------------------------------------------------
  // Edge case: misconfigured rule (neither min nor max)
  // ----------------------------------------------------------

  it('skips rules where both min_value and max_value are null', () => {
    const reading = makeReading({ metric_type: 'engine_temp', value: 120 });
    const rule = makeRule({
      metric_type: 'engine_temp',
      min_value: null,
      max_value: null,
      severity: 'critical',
      description: 'Misconfigured rule',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------
  // Range-based rules (min_value > 0 AND max_value set)
  // ----------------------------------------------------------

  it('detects anomaly when value is below min_value of a range rule (oil_pressure)', () => {
    const reading = makeReading({ metric_type: 'oil_pressure', value: 10 });
    const rule = makeRule({
      metric_type: 'oil_pressure',
      min_value: 25,
      max_value: 65,
      severity: 'warning',
      description: 'Oil pressure outside normal range',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0].expected_range).toEqual({ min: 25, max: 65 });
    expect(result[0].actual_value).toBe(10);
  });

  it('detects anomaly when value is above max_value of a range rule', () => {
    const reading = makeReading({ metric_type: 'oil_pressure', value: 80 });
    const rule = makeRule({
      metric_type: 'oil_pressure',
      min_value: 25,
      max_value: 65,
      severity: 'warning',
      description: 'Oil pressure outside normal range',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);

    expect(result).toHaveLength(1);
    expect(result[0].expected_range).toEqual({ min: 25, max: 65 });
    expect(result[0].actual_value).toBe(80);
  });

  it('does not trigger range rule when value is within [min_value, max_value]', () => {
    const reading = makeReading({ metric_type: 'oil_pressure', value: 45 });
    const rule = makeRule({
      metric_type: 'oil_pressure',
      min_value: 25,
      max_value: 65,
      severity: 'warning',
      description: 'Oil pressure outside normal range',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  it('does not trigger range rule when value equals min_value exactly', () => {
    const reading = makeReading({ metric_type: 'oil_pressure', value: 25 });
    const rule = makeRule({
      metric_type: 'oil_pressure',
      min_value: 25,
      max_value: 65,
      severity: 'warning',
      description: 'Oil pressure outside normal range',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  it('does not trigger range rule when value equals max_value exactly', () => {
    const reading = makeReading({ metric_type: 'oil_pressure', value: 65 });
    const rule = makeRule({
      metric_type: 'oil_pressure',
      min_value: 25,
      max_value: 65,
      severity: 'warning',
      description: 'Oil pressure outside normal range',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toEqual([]);
  });

  it('still treats min_value=0 rules as "below threshold" (not range)', () => {
    const reading = makeReading({ metric_type: 'fuel_level', value: 3 });
    const rule = makeRule({
      metric_type: 'fuel_level',
      min_value: 0,
      max_value: 5,
      severity: 'warning',
      description: 'Low fuel level',
    });

    const result = checkTelemetryForAnomalies(reading, [rule]);
    expect(result).toHaveLength(1);
    expect(result[0].expected_range).toEqual({ min: 5 });
  });
});

// ============================================================
// calculateRiskScore
// ============================================================

describe('calculateRiskScore', () => {
  // ----------------------------------------------------------
  // Empty / zero scenarios
  // ----------------------------------------------------------

  it('returns 0 for an empty array of anomalies', () => {
    const result = calculateRiskScore([]);
    expect(result).toBe(0);
  });

  it('returns 0 when all anomalies are resolved', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'resolved' }),
      makeAnomaly({ id: 'a2', severity: 'warning', status: 'resolved' }),
      makeAnomaly({ id: 'a3', severity: 'info', status: 'resolved' }),
    ];

    const result = calculateRiskScore(anomalies);
    expect(result).toBe(0);
  });

  // ----------------------------------------------------------
  // Individual severity scores
  // ----------------------------------------------------------

  it('returns 40 for a single active critical anomaly', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ severity: 'critical', status: 'active' }),
    ];

    const result = calculateRiskScore(anomalies);
    expect(result).toBe(40);
  });

  it('returns 20 for a single active warning anomaly', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ severity: 'warning', status: 'active' }),
    ];

    const result = calculateRiskScore(anomalies);
    expect(result).toBe(20);
  });

  it('returns 5 for a single active info anomaly', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ severity: 'info', status: 'active' }),
    ];

    const result = calculateRiskScore(anomalies);
    expect(result).toBe(5);
  });

  // ----------------------------------------------------------
  // Combining multiple severities
  // ----------------------------------------------------------

  it('combines scores: 2 critical + 1 warning = 100 (capped)', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a2', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a3', severity: 'warning', status: 'active' }),
    ];

    // 2*40 + 1*20 = 100, capped at 100
    const result = calculateRiskScore(anomalies);
    expect(result).toBe(100);
  });

  it('combines scores: 1 critical + 1 warning + 1 info = 65', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a2', severity: 'warning', status: 'active' }),
      makeAnomaly({ id: 'a3', severity: 'info', status: 'active' }),
    ];

    // 40 + 20 + 5 = 65
    const result = calculateRiskScore(anomalies);
    expect(result).toBe(65);
  });

  // ----------------------------------------------------------
  // Cap at 100
  // ----------------------------------------------------------

  it('caps the score at 100 even when raw total exceeds it', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a2', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a3', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a4', severity: 'critical', status: 'active' }),
    ];

    // 4 * 40 = 160, capped to 100
    const result = calculateRiskScore(anomalies);
    expect(result).toBe(100);
  });

  it('returns 100 when raw score exceeds cap (3 critical + 2 info)', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a2', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a3', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a4', severity: 'info', status: 'active' }),
      makeAnomaly({ id: 'a5', severity: 'info', status: 'active' }),
    ];

    // 3 * 40 + 2 * 5 = 130, capped to 100
    const result = calculateRiskScore(anomalies);
    expect(result).toBe(100);
  });

  // ----------------------------------------------------------
  // Status filtering: acknowledged vs resolved
  // ----------------------------------------------------------

  it('includes "acknowledged" anomalies in the risk score', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'acknowledged' }),
    ];

    const result = calculateRiskScore(anomalies);
    expect(result).toBe(40);
  });

  it('counts both "active" and "acknowledged" anomalies together', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a2', severity: 'warning', status: 'acknowledged' }),
    ];

    // 40 + 20 = 60
    const result = calculateRiskScore(anomalies);
    expect(result).toBe(60);
  });

  it('excludes "resolved" anomalies from the risk score while counting others', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', severity: 'critical', status: 'active' }),
      makeAnomaly({ id: 'a2', severity: 'critical', status: 'resolved' }),
      makeAnomaly({ id: 'a3', severity: 'warning', status: 'acknowledged' }),
      makeAnomaly({ id: 'a4', severity: 'warning', status: 'resolved' }),
    ];

    // Only a1 (40) + a3 (20) = 60
    const result = calculateRiskScore(anomalies);
    expect(result).toBe(60);
  });
});
