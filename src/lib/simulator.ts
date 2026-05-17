// ============================================================
// Telemetry Data Simulator
// Generates realistic telemetry readings and events for vehicles
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  TelemetryReading,
  MetricType,
  VehicleEvent,
  EventType,
  Severity,
} from '@/types';

// ----- Metric Configuration -----
interface MetricConfig {
  min: number;
  max: number;
  unit: string;
  /** How much the value can change per tick (absolute) */
  volatility: number;
  /** Typical resting / cruising value */
  nominal: number;
}

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  speed: {
    min: 0,
    max: 160,
    unit: 'km/h',
    volatility: 15,
    nominal: 55,
  },
  engine_temp: {
    min: 70,
    max: 120,
    unit: '°C',
    volatility: 3,
    nominal: 90,
  },
  fuel_level: {
    min: 5,
    max: 100,
    unit: '%',
    volatility: 0.5,
    nominal: 65,
  },
  tire_pressure: {
    min: 28,
    max: 40,
    unit: 'psi',
    volatility: 0.8,
    nominal: 34,
  },
  battery_voltage: {
    min: 11.5,
    max: 14.8,
    unit: 'V',
    volatility: 0.3,
    nominal: 12.6,
  },
  rpm: {
    min: 600,
    max: 7000,
    unit: 'rpm',
    volatility: 500,
    nominal: 2200,
  },
  oil_pressure: {
    min: 20,
    max: 80,
    unit: 'psi',
    volatility: 5,
    nominal: 45,
  },
  odometer: {
    min: 0,
    max: 999999,
    unit: 'km',
    volatility: 0.5,
    nominal: 45000,
  },
};

// // Base position (approximately center of a city — configurable)
// const BASE_LAT = 40.4168; // Madrid, Spain
// const BASE_LNG = -3.7038;
// const POSITION_JITTER = 0.015; // ~1.5 km radius

// Base position (approximately center of a city — configurable)
const BASE_LAT = 20.7214; // Zapopan/Guadalajara, Jalisco, Mexico
const BASE_LNG = -103.3918;
const POSITION_JITTER = 0.015; // ~1.5 km radius

// Track last-known values per vehicle so readings drift realistically
const lastValues: Record<string, Record<MetricType, number>> = {};
const lastPositions: Record<string, { lat: number; lng: number }> = {};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns the next realistic value for a metric,
 * drifting from the previous reading.
 */
function nextValue(vehicleId: string, metric: MetricType): number {
  const cfg = METRIC_CONFIGS[metric];

  if (!lastValues[vehicleId]) {
    lastValues[vehicleId] = {} as Record<MetricType, number>;
  }

  // Seed with a random value near nominal if first call
  if (lastValues[vehicleId][metric] === undefined) {
    lastValues[vehicleId][metric] =
      cfg.nominal + randomBetween(-cfg.volatility * 2, cfg.volatility * 2);
  }

  const prev = lastValues[vehicleId][metric];

  // Random walk with mean-reversion towards nominal
  const drift = (cfg.nominal - prev) * 0.05; // gentle pull
  const noise = randomBetween(-cfg.volatility, cfg.volatility);
  const next = clamp(prev + drift + noise, cfg.min, cfg.max);

  // Round to reasonable precision
  const rounded = metric === 'rpm' || metric === 'odometer'
    ? Math.round(next)
    : parseFloat(next.toFixed(1));

  lastValues[vehicleId][metric] = rounded;
  return rounded;
}

/**
 * Returns a position near the base, drifting slightly each tick.
 */
function nextPosition(vehicleId: string): { lat: number; lng: number } {
  if (!lastPositions[vehicleId]) {
    lastPositions[vehicleId] = {
      lat: BASE_LAT + randomBetween(-POSITION_JITTER, POSITION_JITTER),
      lng: BASE_LNG + randomBetween(-POSITION_JITTER, POSITION_JITTER),
    };
  }

  const pos = lastPositions[vehicleId];
  pos.lat = pos.lat + randomBetween(-0.001, 0.001);
  pos.lng = pos.lng + randomBetween(-0.001, 0.001);

  return { lat: parseFloat(pos.lat.toFixed(6)), lng: parseFloat(pos.lng.toFixed(6)) };
}

// Metrics we actually simulate each tick (odometer excluded — rarely changes)
const SIMULATED_METRICS: MetricType[] = [
  'speed',
  'engine_temp',
  'fuel_level',
  'tire_pressure',
  'battery_voltage',
  'rpm',
  'oil_pressure',
];

/**
 * Generate a full batch of telemetry readings for one vehicle.
 * Returns one reading per simulated metric type.
 */
export function generateTelemetryBatch(vehicleId: string): Omit<TelemetryReading, 'created_at'>[] {
  const now = new Date().toISOString();
  const pos = nextPosition(vehicleId);

  return SIMULATED_METRICS.map((metric) => ({
    id: uuidv4(),
    vehicle_id: vehicleId,
    metric_type: metric,
    value: nextValue(vehicleId, metric),
    unit: METRIC_CONFIGS[metric].unit,
    latitude: pos.lat,
    longitude: pos.lng,
    timestamp: now,
  }));
}

// ----- Event Generation -----

const EVENT_TEMPLATES: {
  event_type: EventType;
  descriptions: string[];
  severity: Severity;
}[] = [
  {
    event_type: 'dispatch',
    descriptions: [
      'Vehicle dispatched to emergency call',
      'Unit assigned to incident report',
      'Dispatched for priority response',
    ],
    severity: 'info',
  },
  {
    event_type: 'en_route',
    descriptions: [
      'Unit en route to scene',
      'Vehicle proceeding to incident location',
      'Responding to dispatch — en route',
    ],
    severity: 'info',
  },
  {
    event_type: 'arrived',
    descriptions: [
      'Unit arrived at scene',
      'Vehicle on-site at incident',
      'Arrival confirmed at location',
    ],
    severity: 'info',
  },
  {
    event_type: 'completed',
    descriptions: [
      'Incident response completed',
      'Mission finished — returning to base',
      'Task completed successfully',
    ],
    severity: 'info',
  },
  {
    event_type: 'maintenance_alert',
    descriptions: [
      'Engine temperature above normal range',
      'Tire pressure low — inspection needed',
      'Oil change overdue — maintenance required',
      'Battery voltage dropping below threshold',
    ],
    severity: 'warning',
  },
  {
    event_type: 'maintenance_alert',
    descriptions: [
      'Critical engine fault detected',
      'Brake system failure warning',
      'Transmission overheating — stop immediately',
    ],
    severity: 'critical',
  },
  {
    event_type: 'refuel',
    descriptions: [
      'Vehicle refueled to full capacity',
      'Fuel stop completed',
      'Refueling in progress',
    ],
    severity: 'info',
  },
  {
    event_type: 'equipment_check',
    descriptions: [
      'Daily equipment inspection completed',
      'Medical supplies verified',
      'Emergency gear check — all items accounted for',
    ],
    severity: 'info',
  },
];

/**
 * Generate a single random event for a vehicle.
 */
export function generateEvent(vehicleId: string): Omit<VehicleEvent, 'created_at'> {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const description =
    template.descriptions[Math.floor(Math.random() * template.descriptions.length)];

  return {
    id: uuidv4(),
    vehicle_id: vehicleId,
    event_type: template.event_type,
    description,
    severity: template.severity,
    metadata: {},
    timestamp: new Date().toISOString(),
  };
}
