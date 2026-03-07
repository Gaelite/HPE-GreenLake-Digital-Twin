// ============================================================
// Anomaly Detection Engine
// Checks telemetry readings against detection rules and
// computes vehicle risk scores from active anomalies.
// ============================================================

import type {
  TelemetryReading,
  DetectionRule,
  Anomaly,
  Severity,
  MetricType,
} from '@/types';

// ----- Types for anomaly creation (before DB insert) -----
export interface AnomalyInsert {
  vehicle_id: string;
  telemetry_reading_id: string | null;
  anomaly_type: 'threshold_breach';
  metric_type: MetricType;
  expected_range: { min?: number; max?: number };
  actual_value: number;
  severity: Severity;
  status: 'active';
  description: string;
  timestamp: string;
}

// ----- Unit labels for human-readable descriptions -----
const METRIC_UNITS: Record<string, string> = {
  speed: 'km/h',
  engine_temp: '°C',
  fuel_level: '%',
  tire_pressure: 'PSI',
  battery_voltage: 'V',
  rpm: 'RPM',
  oil_pressure: 'kPa',
  odometer: 'km',
};

/**
 * Determines whether a telemetry reading violates a detection rule.
 *
 * Rule interpretation based on the seeded detection_rules schema:
 *
 *  1. max_value only (min_value is null):
 *     "Above threshold" — e.g., engine_temp > 110°C, speed > 160 km/h, rpm > 6500.
 *     Triggers when value > max_value.
 *     Expected safe range: { max: max_value }.
 *
 *  2. Both min_value (0) and max_value set:
 *     "Below threshold" — e.g., fuel_level < 5%, tire_pressure < 22 PSI,
 *     battery_voltage < 11.5V. The max_value IS the threshold below which
 *     the reading is dangerous.
 *     Triggers when value < max_value (since min_value is 0, the danger
 *     zone is [0, max_value)).
 *     Expected safe range: { min: max_value }.
 *
 *  3. min_value only (max_value is null):
 *     Triggers when value < min_value.
 *     Expected safe range: { min: min_value }.
 */
function doesRuleMatch(
  value: number,
  rule: DetectionRule
): { matches: boolean; expectedRange: { min?: number; max?: number } } {
  const hasMin = rule.min_value !== null && rule.min_value !== undefined;
  const hasMax = rule.max_value !== null && rule.max_value !== undefined;

  // Case 2: Both min and max set
  if (hasMin && hasMax) {
    if (rule.min_value! === 0) {
      // "Below threshold" rule — value is dangerous when below max_value
      const threshold = rule.max_value!;
      return {
        matches: value < threshold,
        expectedRange: { min: threshold },
      };
    }
    // True range rule — value is dangerous when outside [min_value, max_value]
    return {
      matches: value < rule.min_value! || value > rule.max_value!,
      expectedRange: { min: rule.min_value!, max: rule.max_value! },
    };
  }

  // Case 1: Only max set — "above threshold" rule
  if (hasMax && !hasMin) {
    return {
      matches: value > rule.max_value!,
      expectedRange: { max: rule.max_value! },
    };
  }

  // Case 3: Only min set — value should not go below min
  if (hasMin && !hasMax) {
    return {
      matches: value < rule.min_value!,
      expectedRange: { min: rule.min_value! },
    };
  }

  // Neither set — rule is misconfigured, skip
  return { matches: false, expectedRange: {} };
}

/**
 * Checks a single telemetry reading against all applicable detection rules.
 * Returns an array of anomaly objects ready for database insertion.
 *
 * Rules are matched when:
 *  - rule.is_active is true
 *  - rule.metric_type matches the reading's metric_type
 *  - rule.vehicle_type is null (global) or matches the provided vehicleType
 */
export function checkTelemetryForAnomalies(
  reading: TelemetryReading,
  rules: DetectionRule[],
  vehicleType?: string
): AnomalyInsert[] {
  const anomalies: AnomalyInsert[] = [];

  for (const rule of rules) {
    // Skip inactive rules
    if (!rule.is_active) continue;

    // Must match metric type
    if (rule.metric_type !== reading.metric_type) continue;

    // Vehicle type filter: null means applies to all
    if (rule.vehicle_type !== null && rule.vehicle_type !== vehicleType) continue;

    const { matches, expectedRange } = doesRuleMatch(reading.value, rule);

    if (matches) {
      const unit = METRIC_UNITS[reading.metric_type] || '';
      anomalies.push({
        vehicle_id: reading.vehicle_id,
        telemetry_reading_id: reading.id,
        anomaly_type: 'threshold_breach',
        metric_type: reading.metric_type,
        expected_range: expectedRange,
        actual_value: reading.value,
        severity: rule.severity,
        status: 'active',
        description: `${rule.description}: actual value ${reading.value}${unit}`,
        timestamp: reading.timestamp || new Date().toISOString(),
      });
    }
  }

  return anomalies;
}

// ----- Severity weights for risk score calculation -----
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 40,
  warning: 20,
  info: 5,
};

/**
 * Computes a 0–100 risk score from a collection of active anomalies.
 *
 * Scoring:
 *  - Each critical anomaly adds 40 points
 *  - Each warning anomaly adds 20 points
 *  - Each info anomaly adds 5 points
 *  - Score is capped at 100
 *
 * Only anomalies with status 'active' or 'acknowledged' are counted.
 * Resolved anomalies are excluded.
 */
export function calculateRiskScore(anomalies: Anomaly[]): number {
  const activeAnomalies = anomalies.filter(
    (a) => a.status === 'active' || a.status === 'acknowledged'
  );

  const rawScore = activeAnomalies.reduce((total, anomaly) => {
    return total + (SEVERITY_WEIGHTS[anomaly.severity] || 0);
  }, 0);

  return Math.min(rawScore, 100);
}
