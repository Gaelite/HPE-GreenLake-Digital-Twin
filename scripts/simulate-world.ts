/**
 * ============================================================
 * Digital Twin — Real-Time World Simulation
 * ============================================================
 *
 * Comprehensive simulation script that brings the digital twin to life:
 *  1. Telemetry & Movement — vehicles move realistically through Madrid
 *  2. Incident Lifecycle — incidents appear, vehicles dispatch, arrive, resolve
 *  3. Anomaly Detection — threshold breaches detected and risk scores updated
 *  4. Insight Generation — actionable insights for anticipation and decision-making
 *
 * Usage:
 *   npm run simulate
 *   npx tsx scripts/simulate-world.ts
 *
 * Environment variables (via .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL  — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS)
 *
 * ============================================================
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Configuration
// ============================================================

const TICK_INTERVAL_MS = 5_000;                   // 5s between ticks
const INCIDENT_CREATE_MIN_TICKS = 6;              // ~30s minimum between incidents
const INCIDENT_CREATE_MAX_TICKS = 18;             // ~90s maximum
const MAX_ACTIVE_INCIDENTS = 5;
const INCIDENT_DISPATCH_DELAY_TICKS = 2;          // 1-3 ticks after creation
const INCIDENT_RESOLVE_MIN_TICKS = 20;            // ~100s at scene minimum
const INCIDENT_RESOLVE_MAX_TICKS = 60;            // ~300s at scene maximum
const ANOMALY_THROTTLE_SECONDS = 30;              // 1 per vehicle+metric per 30s
const INSIGHT_INTERVAL_TICKS = 12;                // ~60s between insight checks
const ARRIVAL_DISTANCE_THRESHOLD = 0.002;         // ~200m in degrees
const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };
const POSITION_DRIFT_MAX = 0.0008;                // ~80m per tick

// ============================================================
// Types (standalone — no app imports)
// ============================================================

type VehicleType = 'police' | 'ambulance' | 'fire_truck' | 'civil_protection' | 'hybrid';
type VehicleStatus = 'available' | 'in_service' | 'en_route' | 'at_scene' | 'maintenance' | 'offline';
type MetricType = 'speed' | 'engine_temp' | 'fuel_level' | 'tire_pressure' | 'battery_voltage' | 'rpm' | 'oil_pressure' | 'odometer';
type EventType = 'dispatch' | 'en_route' | 'arrived' | 'completed' | 'maintenance_alert' | 'refuel' | 'equipment_check';
type Severity = 'info' | 'warning' | 'critical';
type IncidentType = 'fire' | 'medical' | 'crime' | 'accident' | 'natural_disaster';
type IncidentStatus = 'reported' | 'dispatched' | 'in_progress' | 'resolved';
type InsightType = 'maintenance_due' | 'response_time_trend' | 'anomaly_spike' | 'utilization_alert' | 'fuel_efficiency';

interface VehicleRow {
  id: string;
  type: VehicleType;
  name: string;
  plate_number: string;
  status: VehicleStatus;
  current_latitude: number | null;
  current_longitude: number | null;
  specifications: Record<string, unknown>;
}

interface VehicleState {
  vehicle: VehicleRow;
  speed: number;
  engineTemp: number;
  fuelLevel: number;
  tirePressure: number;
  batteryVoltage: number;
  rpm: number;
  oilPressure: number;
  odometer: number;
  latitude: number;
  longitude: number;
  heading: number;
  isMoving: boolean;
  ticksSinceLastEvent: number;
  // Incident assignment
  assignedIncidentId: string | null;
  targetLat: number | null;
  targetLng: number | null;
  ticksAtScene: number;
  resolveAfterTicks: number;
}

interface DetectionRule {
  id: string;
  vehicle_type: VehicleType | null;
  metric_type: MetricType;
  min_value: number | null;
  max_value: number | null;
  severity: Severity;
  description: string;
  is_active: boolean;
}

interface ActiveIncident {
  id: string;
  incident_type: IncidentType;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  ticksSinceCreation: number;
  assignedVehicleIds: string[];
  dispatchedAt: number | null;  // tick number
}

interface TelemetryRow {
  vehicle_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface EventRow {
  vehicle_id: string;
  event_type: EventType;
  description: string;
  severity: Severity;
  metadata: Record<string, unknown>;
  timestamp: string;
}

interface SpeedProfile {
  maxSpeed: number;
  cruiseMin: number;
  cruiseMax: number;
  accelRate: number;
  decelRate: number;
  stopProbability: number;
}

// ============================================================
// Supabase client
// ============================================================

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      '\n[ERROR] Missing Supabase credentials.\n' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n'
    );
    process.exit(1);
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ============================================================
// Utility helpers
// ============================================================

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function jitter(magnitude: number): number {
  const u = Math.random() + Math.random() + Math.random();
  return (u / 3 - 0.5) * 2 * magnitude;
}

function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function distanceDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
}

function bearingTo(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  return (Math.atan2(dLng, dLat) * 180) / Math.PI;
}

// ============================================================
// Speed profiles per vehicle type
// ============================================================

const SPEED_PROFILES: Record<VehicleType, SpeedProfile> = {
  police: { maxSpeed: 120, cruiseMin: 40, cruiseMax: 80, accelRate: 15, decelRate: 20, stopProbability: 0.05 },
  ambulance: { maxSpeed: 110, cruiseMin: 50, cruiseMax: 95, accelRate: 12, decelRate: 18, stopProbability: 0.03 },
  fire_truck: { maxSpeed: 80, cruiseMin: 30, cruiseMax: 60, accelRate: 8, decelRate: 12, stopProbability: 0.06 },
  civil_protection: { maxSpeed: 90, cruiseMin: 35, cruiseMax: 70, accelRate: 10, decelRate: 15, stopProbability: 0.07 },
  hybrid: { maxSpeed: 70, cruiseMin: 25, cruiseMax: 55, accelRate: 7, decelRate: 10, stopProbability: 0.08 },
};

// ============================================================
// Vehicle-to-incident type affinity
// ============================================================

const INCIDENT_VEHICLE_AFFINITY: Record<IncidentType, VehicleType[]> = {
  fire: ['fire_truck', 'civil_protection'],
  medical: ['ambulance'],
  crime: ['police'],
  accident: ['police', 'ambulance', 'civil_protection'],
  natural_disaster: ['civil_protection', 'fire_truck', 'hybrid'],
};

// ============================================================
// Incident generation data
// ============================================================

const INCIDENT_TEMPLATES: Record<IncidentType, { titles: string[]; descriptions: string[] }> = {
  fire: {
    titles: ['Building Fire', 'Vehicle Fire', 'Forest Fire', 'Industrial Fire', 'Kitchen Fire'],
    descriptions: [
      'Flames reported at residential building, multiple floors affected',
      'Vehicle engulfed in flames on major road',
      'Brush fire spreading near residential area',
      'Industrial facility reporting fire in storage area',
      'Kitchen fire in commercial establishment, smoke visible',
    ],
  },
  medical: {
    titles: ['Medical Emergency', 'Cardiac Arrest', 'Traffic Accident Injury', 'Respiratory Distress', 'Fall Injury'],
    descriptions: [
      'Person collapsed, unresponsive, CPR being administered',
      'Cardiac event reported, patient conscious but in distress',
      'Multiple injuries from traffic collision, ambulance requested',
      'Elderly patient with severe breathing difficulty',
      'Person fell from height, possible spinal injury',
    ],
  },
  crime: {
    titles: ['Armed Robbery', 'Domestic Disturbance', 'Suspicious Activity', 'Assault Report', 'Burglary in Progress'],
    descriptions: [
      'Armed robbery at commercial establishment, suspects on scene',
      'Domestic violence call, neighbors report loud altercation',
      'Suspicious individuals observed near school premises',
      'Physical assault reported, victim requires assistance',
      'Break-in in progress at residential property',
    ],
  },
  accident: {
    titles: ['Multi-Vehicle Collision', 'Pedestrian Struck', 'Bus Accident', 'Construction Accident', 'Motorcycle Crash'],
    descriptions: [
      'Multi-vehicle collision blocking major intersection',
      'Pedestrian struck at crosswalk, injuries unknown',
      'Bus collision with property damage, passengers injured',
      'Construction site accident, worker trapped',
      'Motorcycle crash on highway, rider down',
    ],
  },
  natural_disaster: {
    titles: ['Flooding Report', 'Structural Collapse Risk', 'Severe Storm Damage', 'Landslide Warning', 'Gas Leak'],
    descriptions: [
      'Street flooding after heavy rain, vehicles stranded',
      'Building showing structural damage after tremor',
      'Storm damage with fallen trees blocking roads',
      'Landslide risk in hillside area, evacuation advised',
      'Gas leak detected, area evacuation in progress',
    ],
  },
};

// Madrid locations for incidents
const MADRID_INCIDENT_LOCATIONS = [
  { lat: 40.4168, lng: -3.7038, area: 'Puerta del Sol' },
  { lat: 40.4233, lng: -3.7126, area: 'Gran Vía' },
  { lat: 40.4530, lng: -3.6883, area: 'Chamartín' },
  { lat: 40.3930, lng: -3.6940, area: 'Vallecas' },
  { lat: 40.4380, lng: -3.6950, area: 'Salamanca' },
  { lat: 40.4075, lng: -3.7130, area: 'Lavapiés' },
  { lat: 40.4250, lng: -3.7200, area: 'Malasaña' },
  { lat: 40.4450, lng: -3.7100, area: 'Tetuán' },
  { lat: 40.4350, lng: -3.7050, area: 'Alonso Martínez' },
  { lat: 40.4100, lng: -3.6800, area: 'Retiro' },
  { lat: 40.3850, lng: -3.7150, area: 'Usera' },
  { lat: 40.4600, lng: -3.7000, area: 'Fuencarral' },
  { lat: 40.4000, lng: -3.7250, area: 'Carabanchel' },
  { lat: 40.4400, lng: -3.6700, area: 'Ciudad Lineal' },
  { lat: 40.4150, lng: -3.7400, area: 'Casa de Campo' },
];

// ============================================================
// Metric units for anomaly descriptions
// ============================================================

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

// ============================================================
// Severity weights for risk score calculation
// ============================================================

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 40,
  warning: 20,
  info: 5,
};

// ============================================================
// State initialization
// ============================================================

function initState(v: VehicleRow): VehicleState {
  const isMoving = v.status === 'in_service' || v.status === 'en_route';
  const profile = SPEED_PROFILES[v.type];

  return {
    vehicle: v,
    speed: isMoving ? rand(profile.cruiseMin, profile.cruiseMax) : 0,
    engineTemp: isMoving ? rand(85, 95) : rand(35, 55),
    fuelLevel: rand(20, 85),
    tirePressure: rand(30, 36),
    batteryVoltage: isMoving ? rand(13.5, 14.4) : rand(12.2, 12.8),
    rpm: isMoving ? rand(1800, 3500) : 0,
    oilPressure: isMoving ? rand(35, 55) : rand(0, 10),
    odometer: rand(10000, 90000),
    latitude: v.current_latitude ?? MADRID_CENTER.lat + jitter(0.03),
    longitude: v.current_longitude ?? MADRID_CENTER.lng + jitter(0.03),
    heading: rand(0, 360),
    isMoving,
    ticksSinceLastEvent: 0,
    assignedIncidentId: null,
    targetLat: null,
    targetLng: null,
    ticksAtScene: 0,
    resolveAfterTicks: 0,
  };
}

// ============================================================
// Subsystem 1: Telemetry & Movement Simulation
// ============================================================

function simulateTick(state: VehicleState): void {
  const profile = SPEED_PROFILES[state.vehicle.type];
  state.ticksSinceLastEvent++;

  // Maintenance / offline vehicles never move
  if (state.vehicle.status === 'maintenance' || state.vehicle.status === 'offline') {
    state.isMoving = false;
    state.speed = 0;
    state.rpm = 0;
    state.engineTemp = clamp(state.engineTemp + jitter(0.3), 20, 45);
    state.batteryVoltage = clamp(state.batteryVoltage + jitter(0.02), 11.0, 12.8);
    state.oilPressure = clamp(state.oilPressure + jitter(0.5), 0, 10);
    return;
  }

  // Vehicles at_scene stay put
  if (state.vehicle.status === 'at_scene') {
    state.isMoving = false;
    state.speed = 0;
    state.rpm = rand(700, 900); // idling
    state.engineTemp = clamp(state.engineTemp - rand(0.1, 0.5) + jitter(0.3), 60, 95);
    state.batteryVoltage = clamp(13.5 + jitter(0.2), 13.0, 14.0);
    state.oilPressure = clamp(15 + jitter(2), 10, 25);
    state.ticksAtScene++;
    return;
  }

  // Available vehicles occasionally start moving
  if (state.vehicle.status === 'available') {
    if (!state.isMoving && Math.random() < 0.02) {
      state.isMoving = true;
      state.speed = rand(10, 30);
      state.engineTemp = clamp(state.engineTemp + 5, 60, 80);
    } else if (state.isMoving && Math.random() < 0.01) {
      state.isMoving = false;
      state.speed = 0;
    }

    // Base station maintenance: refuel, inflate tires, charge battery when idle at base
    if (!state.isMoving) {
      if (state.fuelLevel < 90) {
        state.fuelLevel = clamp(state.fuelLevel + rand(0.3, 0.7), 0, 95);
      }
      if (state.tirePressure < 32) {
        state.tirePressure = clamp(state.tirePressure + rand(0.1, 0.3), 20, 36);
      }
      if (state.batteryVoltage < 12.6) {
        state.batteryVoltage = clamp(state.batteryVoltage + rand(0.01, 0.03), 10.5, 12.8);
      }
    }
  }

  // en_route vehicles are always moving
  if (state.vehicle.status === 'en_route' || state.vehicle.status === 'in_service') {
    state.isMoving = true;
  }

  // Speed simulation
  if (state.isMoving) {
    if (Math.random() < profile.stopProbability) {
      state.speed = clamp(state.speed - profile.decelRate * 2, 0, profile.maxSpeed);
    } else if (state.speed < profile.cruiseMin) {
      state.speed = clamp(state.speed + rand(5, profile.accelRate), 0, profile.maxSpeed);
    } else if (state.speed > profile.cruiseMax) {
      state.speed = clamp(state.speed - rand(3, profile.decelRate), 0, profile.maxSpeed);
    } else {
      state.speed = clamp(state.speed + jitter(8), 0, profile.maxSpeed);
    }
    // Emergency acceleration bursts
    if (state.vehicle.status === 'en_route' && Math.random() < 0.06) {
      state.speed = clamp(state.speed + rand(15, 30), 0, profile.maxSpeed * 1.4);
    } else if (Math.random() < 0.03) {
      state.speed = clamp(state.speed + rand(15, 30), 0, profile.maxSpeed);
    }
  } else {
    state.speed = 0;
  }

  // Engine temperature
  if (state.isMoving) {
    const targetTemp = 85 + (state.speed / profile.maxSpeed) * 15;
    state.engineTemp = clamp(
      state.engineTemp + (targetTemp - state.engineTemp) * 0.1 + jitter(1.5),
      70, 120
    );
    const spikeChance = (state.vehicle.status === 'en_route' || state.vehicle.status === 'at_scene') ? 0.04 : 0.015;
    if (Math.random() < spikeChance) {
      state.engineTemp = clamp(state.engineTemp + rand(5, 12), 70, 120);
    }
  } else {
    state.engineTemp = clamp(state.engineTemp - rand(0.2, 1.0) + jitter(0.3), 20, 65);
  }

  // RPM
  if (state.isMoving) {
    const baseRpm = 800 + (state.speed / profile.maxSpeed) * 5000;
    state.rpm = clamp(baseRpm + jitter(300), 700, 6800);
  } else {
    state.rpm = state.speed > 0 ? rand(700, 900) : 0;
  }

  // Fuel level (slowly decreasing)
  if (state.isMoving) {
    const consumptionRate = 0.05 + (state.speed / profile.maxSpeed) * 0.12;
    state.fuelLevel = clamp(state.fuelLevel - consumptionRate + jitter(0.005), 0, 100);
  } else {
    state.fuelLevel = clamp(state.fuelLevel - 0.005, 0, 100);
  }

  // Tire pressure
  if (state.isMoving) {
    state.tirePressure -= 0.01;
  }
  state.tirePressure = clamp(state.tirePressure + jitter(0.1), 20, 40);
  if (Math.random() < 0.005) {
    state.tirePressure = clamp(state.tirePressure - rand(1.0, 3.0), 20, 40);
  }

  // Battery voltage
  if (state.isMoving) {
    state.batteryVoltage = clamp(13.8 + jitter(0.3), 13.0, 14.8);
  } else {
    state.batteryVoltage = clamp(state.batteryVoltage - 0.008 + jitter(0.02), 10.5, 12.8);
  }

  // Oil pressure
  if (state.isMoving) {
    state.oilPressure = clamp(40 + (state.rpm / 6000) * 20 + jitter(3), 25, 65);
  } else {
    state.oilPressure = clamp(state.oilPressure + jitter(0.5), 0, 15);
  }

  // Odometer
  if (state.isMoving) {
    const kmPerTick = (state.speed / 3600) * (TICK_INTERVAL_MS / 1000);
    state.odometer += kmPerTick;
  }

  // GPS position — bearing-based movement toward incident target, or random drift
  if (state.isMoving && state.speed > 0) {
    const driftScale = (state.speed / profile.maxSpeed) * POSITION_DRIFT_MAX;

    if (state.targetLat !== null && state.targetLng !== null) {
      // Move toward assigned incident
      const bearing = bearingTo(state.latitude, state.longitude, state.targetLat, state.targetLng);
      state.heading = bearing + jitter(10); // slight variation
      const headingRad = (state.heading * Math.PI) / 180;
      state.latitude += Math.cos(headingRad) * driftScale;
      state.longitude += Math.sin(headingRad) * driftScale;
    } else {
      // Random drift
      const headingRad = (state.heading * Math.PI) / 180;
      state.latitude += Math.cos(headingRad) * driftScale + jitter(0.00005);
      state.longitude += Math.sin(headingRad) * driftScale + jitter(0.00005);
      state.heading = (state.heading + jitter(15) + 360) % 360;
    }

    // Keep within Madrid bounds
    state.latitude = clamp(state.latitude, 40.38, 40.46);
    state.longitude = clamp(state.longitude, -3.76, -3.64);
  }
}

function buildTelemetryRows(state: VehicleState): TelemetryRow[] {
  const ts = new Date().toISOString();
  const lat = round(state.latitude, 6);
  const lng = round(state.longitude, 6);

  const rows: TelemetryRow[] = [
    { vehicle_id: state.vehicle.id, metric_type: 'speed', value: round(state.speed, 1), unit: 'km/h', latitude: lat, longitude: lng, timestamp: ts },
    { vehicle_id: state.vehicle.id, metric_type: 'engine_temp', value: round(state.engineTemp, 1), unit: 'celsius', latitude: lat, longitude: lng, timestamp: ts },
    { vehicle_id: state.vehicle.id, metric_type: 'fuel_level', value: round(state.fuelLevel, 2), unit: 'percent', latitude: lat, longitude: lng, timestamp: ts },
    { vehicle_id: state.vehicle.id, metric_type: 'tire_pressure', value: round(state.tirePressure, 1), unit: 'psi', latitude: lat, longitude: lng, timestamp: ts },
    { vehicle_id: state.vehicle.id, metric_type: 'battery_voltage', value: round(state.batteryVoltage, 2), unit: 'volts', latitude: lat, longitude: lng, timestamp: ts },
  ];

  if (state.isMoving || state.speed > 0) {
    rows.push(
      { vehicle_id: state.vehicle.id, metric_type: 'rpm', value: round(state.rpm, 0), unit: 'rpm', latitude: lat, longitude: lng, timestamp: ts },
      { vehicle_id: state.vehicle.id, metric_type: 'oil_pressure', value: round(state.oilPressure, 1), unit: 'psi', latitude: lat, longitude: lng, timestamp: ts },
    );
  }

  if (Math.random() < 0.17) {
    rows.push(
      { vehicle_id: state.vehicle.id, metric_type: 'odometer', value: round(state.odometer, 1), unit: 'km', latitude: lat, longitude: lng, timestamp: ts },
    );
  }

  return rows;
}

// ============================================================
// Subsystem 2: Incident Lifecycle
// ============================================================

let nextIncidentTick = 0; // tick at which next incident can be created

function maybeCreateIncident(
  tickCount: number,
  activeIncidents: ActiveIncident[]
): { incident: ActiveIncident; dbRow: Record<string, unknown> } | null {
  if (tickCount < nextIncidentTick) return null;
  if (activeIncidents.length >= MAX_ACTIVE_INCIDENTS) return null;

  const incidentType = pickRandom<IncidentType>(['fire', 'medical', 'crime', 'accident', 'natural_disaster']);
  const template = INCIDENT_TEMPLATES[incidentType];
  const title = pickRandom(template.titles);
  const description = pickRandom(template.descriptions);
  const location = pickRandom(MADRID_INCIDENT_LOCATIONS);
  const severity = pickRandom<Severity>(['warning', 'critical', 'critical']); // bias toward critical
  const lat = location.lat + jitter(0.003);
  const lng = location.lng + jitter(0.003);

  // Schedule next incident
  nextIncidentTick = tickCount + randInt(INCIDENT_CREATE_MIN_TICKS, INCIDENT_CREATE_MAX_TICKS);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const incident: ActiveIncident = {
    id,
    incident_type: incidentType,
    latitude: lat,
    longitude: lng,
    status: 'reported',
    ticksSinceCreation: 0,
    assignedVehicleIds: [],
    dispatchedAt: null,
  };

  const dbRow = {
    id,
    title: `${title} — ${location.area}`,
    description: `${description}. Location: ${location.area}, Madrid.`,
    incident_type: incidentType,
    severity,
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    status: 'reported' as const,
    assigned_vehicle_ids: [],
    reported_at: now,
  };

  return { incident, dbRow };
}

function findBestVehicleForIncident(
  incident: ActiveIncident,
  states: VehicleState[]
): VehicleState | null {
  const preferredTypes = INCIDENT_VEHICLE_AFFINITY[incident.incident_type];

  // Find available vehicles with type affinity, sorted by distance
  const candidates = states
    .filter(
      (s) =>
        s.vehicle.status === 'available' &&
        s.assignedIncidentId === null &&
        preferredTypes.includes(s.vehicle.type)
    )
    .sort(
      (a, b) =>
        distanceDeg(a.latitude, a.longitude, incident.latitude, incident.longitude) -
        distanceDeg(b.latitude, b.longitude, incident.latitude, incident.longitude)
    );

  if (candidates.length > 0) return candidates[0];

  // Fallback: any available vehicle (nearest)
  const fallbackCandidates = states
    .filter((s) => s.vehicle.status === 'available' && s.assignedIncidentId === null)
    .sort(
      (a, b) =>
        distanceDeg(a.latitude, a.longitude, incident.latitude, incident.longitude) -
        distanceDeg(b.latitude, b.longitude, incident.latitude, incident.longitude)
    );

  return fallbackCandidates.length > 0 ? fallbackCandidates[0] : null;
}

async function processIncidentLifecycle(
  supabase: SupabaseClient,
  tickCount: number,
  activeIncidents: ActiveIncident[],
  states: VehicleState[]
): Promise<{ events: EventRow[]; logs: string[] }> {
  const events: EventRow[] = [];
  const logs: string[] = [];
  const now = new Date().toISOString();

  // Try to create a new incident
  const newIncident = maybeCreateIncident(tickCount, activeIncidents);
  if (newIncident) {
    const { error } = await supabase.from('incidents').insert(newIncident.dbRow);
    if (!error) {
      activeIncidents.push(newIncident.incident);
      logs.push(`  🔴 NEW INCIDENT: ${newIncident.dbRow.title} (${newIncident.incident.incident_type})`);
    }
  }

  // Process each active incident
  const resolvedIds: string[] = [];

  for (const incident of activeIncidents) {
    incident.ticksSinceCreation++;

    // Phase 1: Dispatch (1-3 ticks after creation)
    if (incident.status === 'reported' && incident.ticksSinceCreation >= INCIDENT_DISPATCH_DELAY_TICKS) {
      const vehicle = findBestVehicleForIncident(incident, states);
      if (vehicle) {
        // Update vehicle state
        vehicle.vehicle.status = 'en_route';
        vehicle.isMoving = true;
        vehicle.assignedIncidentId = incident.id;
        vehicle.targetLat = incident.latitude;
        vehicle.targetLng = incident.longitude;

        // Update incident
        incident.status = 'dispatched';
        incident.assignedVehicleIds.push(vehicle.vehicle.id);
        incident.dispatchedAt = tickCount;

        // Update DB
        await supabase
          .from('vehicles')
          .update({ status: 'en_route', updated_at: now })
          .eq('id', vehicle.vehicle.id);

        await supabase
          .from('incidents')
          .update({
            status: 'dispatched',
            assigned_vehicle_ids: incident.assignedVehicleIds,
          })
          .eq('id', incident.id);

        events.push({
          vehicle_id: vehicle.vehicle.id,
          event_type: 'dispatch',
          description: `${vehicle.vehicle.name} dispatched to ${incident.incident_type} incident`,
          severity: 'info',
          metadata: {
            incident_id: incident.id,
            incident_type: incident.incident_type,
            destination_lat: incident.latitude,
            destination_lng: incident.longitude,
          },
          timestamp: now,
        });

        events.push({
          vehicle_id: vehicle.vehicle.id,
          event_type: 'en_route',
          description: `${vehicle.vehicle.name} en route to incident`,
          severity: 'info',
          metadata: {
            incident_id: incident.id,
            distance_km: round(distanceDeg(vehicle.latitude, vehicle.longitude, incident.latitude, incident.longitude) * 111, 1),
          },
          timestamp: now,
        });

        logs.push(`  🚨 DISPATCHED: ${vehicle.vehicle.name} → ${incident.incident_type} incident`);
      }
    }

    // Phase 2: Arrival check — has the vehicle reached the incident?
    if (incident.status === 'dispatched') {
      for (const vehicleId of incident.assignedVehicleIds) {
        const vehicleState = states.find((s) => s.vehicle.id === vehicleId);
        if (!vehicleState || vehicleState.vehicle.status !== 'en_route') continue;

        const dist = distanceDeg(
          vehicleState.latitude, vehicleState.longitude,
          incident.latitude, incident.longitude
        );

        if (dist < ARRIVAL_DISTANCE_THRESHOLD) {
          // Vehicle arrived
          vehicleState.vehicle.status = 'at_scene';
          vehicleState.isMoving = false;
          vehicleState.speed = 0;
          vehicleState.targetLat = null;
          vehicleState.targetLng = null;
          vehicleState.ticksAtScene = 0;
          vehicleState.resolveAfterTicks = randInt(INCIDENT_RESOLVE_MIN_TICKS, INCIDENT_RESOLVE_MAX_TICKS);

          incident.status = 'in_progress';

          const responseTimeSec = incident.dispatchedAt
            ? (tickCount - incident.dispatchedAt) * (TICK_INTERVAL_MS / 1000)
            : 0;

          await supabase
            .from('vehicles')
            .update({ status: 'at_scene', updated_at: now })
            .eq('id', vehicleId);

          await supabase
            .from('incidents')
            .update({ status: 'in_progress' })
            .eq('id', incident.id);

          events.push({
            vehicle_id: vehicleId,
            event_type: 'arrived',
            description: `${vehicleState.vehicle.name} arrived at scene`,
            severity: 'info',
            metadata: {
              incident_id: incident.id,
              response_time_seconds: responseTimeSec,
              response_time_min: round(responseTimeSec / 60, 1),
            },
            timestamp: now,
          });

          logs.push(`  ✅ ARRIVED: ${vehicleState.vehicle.name} at scene (${round(responseTimeSec / 60, 1)} min response time)`);
        }
      }
    }

    // Phase 3: Resolution — vehicle has been at scene long enough
    if (incident.status === 'in_progress') {
      let allResolved = true;

      for (const vehicleId of incident.assignedVehicleIds) {
        const vehicleState = states.find((s) => s.vehicle.id === vehicleId);
        if (!vehicleState) continue;

        if (vehicleState.vehicle.status === 'at_scene' && vehicleState.ticksAtScene >= vehicleState.resolveAfterTicks) {
          // Vehicle done — release it
          vehicleState.vehicle.status = 'available';
          vehicleState.assignedIncidentId = null;
          vehicleState.ticksAtScene = 0;

          await supabase
            .from('vehicles')
            .update({ status: 'available', updated_at: now })
            .eq('id', vehicleId);

          events.push({
            vehicle_id: vehicleId,
            event_type: 'completed',
            description: `${vehicleState.vehicle.name} completed assignment and returning to base`,
            severity: 'info',
            metadata: {
              incident_id: incident.id,
              duration_at_scene_ticks: vehicleState.resolveAfterTicks,
              duration_at_scene_min: round((vehicleState.resolveAfterTicks * TICK_INTERVAL_MS) / 60000, 1),
            },
            timestamp: now,
          });

          logs.push(`  🏁 COMPLETED: ${vehicleState.vehicle.name} returning to base`);
        } else if (vehicleState.vehicle.status === 'at_scene') {
          allResolved = false;
        }
      }

      if (allResolved) {
        incident.status = 'resolved' as IncidentStatus;
        resolvedIds.push(incident.id);

        await supabase
          .from('incidents')
          .update({ status: 'resolved', resolved_at: now })
          .eq('id', incident.id);

        logs.push(`  ✅ INCIDENT RESOLVED: ${incident.incident_type} (${incident.id.slice(0, 8)})`);
      }
    }
  }

  // Remove resolved incidents from active list
  for (const id of resolvedIds) {
    const idx = activeIncidents.findIndex((i) => i.id === id);
    if (idx !== -1) activeIncidents.splice(idx, 1);
  }

  return { events, logs };
}

// ============================================================
// Subsystem 3: Anomaly Detection
// ============================================================

// Throttle map: `${vehicleId}:${metricType}` → last anomaly timestamp
const anomalyThrottleMap = new Map<string, number>();

function doesRuleMatch(
  value: number,
  rule: DetectionRule
): { matches: boolean; expectedRange: { min?: number; max?: number } } {
  const hasMin = rule.min_value !== null && rule.min_value !== undefined;
  const hasMax = rule.max_value !== null && rule.max_value !== undefined;

  // Both min and max set
  if (hasMin && hasMax) {
    if (rule.min_value! === 0) {
      // "Below threshold" rule — value is dangerous when below max_value
      const threshold = rule.max_value!;
      return { matches: value < threshold, expectedRange: { min: threshold } };
    }
    // True range rule — value is dangerous when outside [min_value, max_value]
    return {
      matches: value < rule.min_value! || value > rule.max_value!,
      expectedRange: { min: rule.min_value!, max: rule.max_value! },
    };
  }

  // Only max set — "above threshold" rule
  if (hasMax && !hasMin) {
    return { matches: value > rule.max_value!, expectedRange: { max: rule.max_value! } };
  }

  // Only min set — value should not go below min
  if (hasMin && !hasMax) {
    return { matches: value < rule.min_value!, expectedRange: { min: rule.min_value! } };
  }

  return { matches: false, expectedRange: {} };
}

interface AnomalyInsert {
  vehicle_id: string;
  telemetry_reading_id: string | null;
  anomaly_type: 'threshold_breach';
  metric_type: string;
  expected_range: { min?: number; max?: number };
  actual_value: number;
  severity: Severity;
  status: 'active';
  description: string;
  timestamp: string;
}

function checkReadingsForAnomalies(
  readings: (TelemetryRow & { id?: string })[],
  rules: DetectionRule[],
  vehicleType: VehicleType
): AnomalyInsert[] {
  const anomalies: AnomalyInsert[] = [];
  const now = Date.now();

  for (const reading of readings) {
    for (const rule of rules) {
      if (!rule.is_active) continue;
      if (rule.metric_type !== reading.metric_type) continue;
      if (rule.vehicle_type !== null && rule.vehicle_type !== vehicleType) continue;

      const { matches, expectedRange } = doesRuleMatch(reading.value, rule);

      if (matches) {
        // Throttle check
        const throttleKey = `${reading.vehicle_id}:${reading.metric_type}`;
        const lastAnomalyTime = anomalyThrottleMap.get(throttleKey) || 0;
        if (now - lastAnomalyTime < ANOMALY_THROTTLE_SECONDS * 1000) continue;

        anomalyThrottleMap.set(throttleKey, now);

        const unit = METRIC_UNITS[reading.metric_type] || '';
        anomalies.push({
          vehicle_id: reading.vehicle_id,
          telemetry_reading_id: reading.id || null,
          anomaly_type: 'threshold_breach',
          metric_type: reading.metric_type,
          expected_range: expectedRange,
          actual_value: reading.value,
          severity: rule.severity,
          status: 'active',
          description: `${rule.description}: actual value ${reading.value}${unit}`,
          timestamp: reading.timestamp,
        });
      }
    }
  }

  return anomalies;
}

async function processAnomalyDetection(
  supabase: SupabaseClient,
  states: VehicleState[],
  allTelemetry: TelemetryRow[],
  rules: DetectionRule[]
): Promise<{ anomalyCount: number; logs: string[] }> {
  const logs: string[] = [];
  let anomalyCount = 0;

  // Group telemetry by vehicle
  const byVehicle = new Map<string, TelemetryRow[]>();
  for (const row of allTelemetry) {
    const existing = byVehicle.get(row.vehicle_id) || [];
    existing.push(row);
    byVehicle.set(row.vehicle_id, existing);
  }

  for (const state of states) {
    const vehicleTelemetry = byVehicle.get(state.vehicle.id) || [];
    if (vehicleTelemetry.length === 0) continue;

    // Fetch existing active anomalies to prevent duplicates for same vehicle+metric
    const { data: existingActive } = await supabase
      .from('anomalies')
      .select('metric_type')
      .eq('vehicle_id', state.vehicle.id)
      .in('status', ['active', 'acknowledged']);

    const activeMetrics = new Set((existingActive || []).map((a: { metric_type: string }) => a.metric_type));

    let anomalies = checkReadingsForAnomalies(vehicleTelemetry, rules, state.vehicle.type);
    // Skip creating anomalies for metrics that already have an active anomaly
    anomalies = anomalies.filter((a) => !activeMetrics.has(a.metric_type));

    // Track metrics that triggered new anomalies this tick — skip auto-resolve for those
    const newAnomalyMetrics = new Set<string>();

    if (anomalies.length > 0) {
      // Insert anomalies
      const { error } = await supabase.from('anomalies').insert(anomalies);
      if (error) {
        logs.push(`  [ANOMALY ERROR] ${state.vehicle.plate_number}: ${error.message}`);
      } else {
        anomalyCount += anomalies.length;
        for (const anomaly of anomalies) {
          newAnomalyMetrics.add(anomaly.metric_type);
          const severityIcon = anomaly.severity === 'critical' ? '🔴' : anomaly.severity === 'warning' ? '🟡' : '🔵';
          logs.push(`  ${severityIcon} ANOMALY: ${state.vehicle.plate_number} — ${anomaly.description}`);
        }
      }
    }

    // Auto-resolve anomalies whose metric no longer breaches any rule
    const latestByMetric = new Map<string, number>();
    for (const row of vehicleTelemetry) {
      latestByMetric.set(row.metric_type, row.value);
    }

    const { data: activeAnomalies } = await supabase
      .from('anomalies')
      .select('id, severity, status, metric_type')
      .eq('vehicle_id', state.vehicle.id)
      .in('status', ['active', 'acknowledged']);

    if (activeAnomalies) {
      for (const anomaly of activeAnomalies) {
        // Don't auto-resolve anomalies for metrics that just triggered this tick
        if (newAnomalyMetrics.has(anomaly.metric_type)) continue;
        const currentValue = latestByMetric.get(anomaly.metric_type);
        if (currentValue === undefined) continue;

        const applicableRules = rules.filter(
          (r) => r.is_active && r.metric_type === anomaly.metric_type &&
            (r.vehicle_type === null || r.vehicle_type === state.vehicle.type)
        );

        const stillBreaching = applicableRules.some(
          (r) => doesRuleMatch(currentValue, r).matches
        );

        if (!stillBreaching) {
          await supabase
            .from('anomalies')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', anomaly.id);
          logs.push(`  ✅ AUTO-RESOLVE: ${state.vehicle.plate_number} — ${anomaly.metric_type} back to normal (${currentValue})`);
        }
      }

      // Recalculate risk score from remaining active anomalies
      const { data: remainingAnomalies } = await supabase
        .from('anomalies')
        .select('severity')
        .eq('vehicle_id', state.vehicle.id)
        .in('status', ['active', 'acknowledged']);

      const riskScore = Math.min(
        (remainingAnomalies || []).reduce((total: number, a: { severity: Severity }) => {
          return total + (SEVERITY_WEIGHTS[a.severity] || 0);
        }, 0),
        100
      );

      await supabase
        .from('vehicles')
        .update({ risk_score: riskScore, updated_at: new Date().toISOString() })
        .eq('id', state.vehicle.id);
    }
  }

  return { anomalyCount, logs };
}

// ============================================================
// Subsystem 4: Insight Auto-Generation
// ============================================================

// Track recent insights to deduplicate
const recentInsights = new Map<string, number>(); // key → timestamp

interface InsightInsert {
  insight_type: InsightType;
  title: string;
  description: string;
  severity: Severity;
  vehicle_id: string | null;
  metadata: Record<string, unknown>;
}

function isDuplicateInsight(key: string): boolean {
  const lastTime = recentInsights.get(key);
  if (!lastTime) return false;
  return Date.now() - lastTime < 5 * 60 * 1000; // 5 minutes
}

function recordInsight(key: string): void {
  recentInsights.set(key, Date.now());
  // Cleanup old entries
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of recentInsights) {
    if (v < cutoff) recentInsights.delete(k);
  }
}

async function generateInsights(
  supabase: SupabaseClient,
  states: VehicleState[],
  activeIncidents: ActiveIncident[],
  tickCount: number
): Promise<{ insightCount: number; logs: string[] }> {
  const insights: InsightInsert[] = [];
  const logs: string[] = [];
  const now = new Date().toISOString();

  // ── Insight 1: Low fuel alerts ──
  for (const state of states) {
    if (state.fuelLevel < 20 && state.vehicle.status !== 'maintenance' && state.vehicle.status !== 'offline') {
      const key = `fuel:${state.vehicle.id}`;
      if (isDuplicateInsight(key)) continue;

      const severity: Severity = state.fuelLevel < 10 ? 'critical' : 'warning';
      insights.push({
        insight_type: 'fuel_efficiency',
        title: `Low Fuel Alert — ${state.vehicle.name}`,
        description: `${state.vehicle.name} (${state.vehicle.plate_number}) has fuel at ${round(state.fuelLevel, 1)}%. ` +
          (state.fuelLevel < 10
            ? 'Immediate refueling required to maintain operational readiness. Risk of operational failure if dispatched.'
            : 'Schedule refueling soon to avoid compromising response capability. Vehicle may not complete a long-distance dispatch.'),
        severity,
        vehicle_id: state.vehicle.id,
        metadata: {
          fuel_level_percent: round(state.fuelLevel, 1),
          vehicle_status: state.vehicle.status,
          vehicle_type: state.vehicle.type,
          recommendation: state.fuelLevel < 10 ? 'refuel_immediately' : 'schedule_refuel',
          estimated_range_km: round(state.fuelLevel * 3.5, 0), // rough estimate
        },
      });
      recordInsight(key);
    }
  }

  // ── Insight 2: Anomaly spike detection ──
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  for (const state of states) {
    const key = `anomaly_spike:${state.vehicle.id}`;
    if (isDuplicateInsight(key)) continue;

    const { data: recentAnomalies, error } = await supabase
      .from('anomalies')
      .select('id, severity, metric_type, actual_value')
      .eq('vehicle_id', state.vehicle.id)
      .gte('timestamp', fiveMinAgo);

    if (error || !recentAnomalies || recentAnomalies.length < 3) continue;

    const criticalCount = recentAnomalies.filter((a: { severity: string }) => a.severity === 'critical').length;
    const metricTypes = [...new Set(recentAnomalies.map((a: { metric_type: string }) => a.metric_type))];

    insights.push({
      insight_type: 'anomaly_spike',
      title: `Anomaly Spike Detected — ${state.vehicle.name}`,
      description: `${state.vehicle.name} has triggered ${recentAnomalies.length} anomalies in the last 5 minutes` +
        (criticalCount > 0 ? ` (${criticalCount} critical)` : '') +
        `. Affected metrics: ${metricTypes.join(', ')}. ` +
        'Recommend immediate inspection to prevent potential equipment failure or safety risk. ' +
        (criticalCount >= 2
          ? 'Consider taking vehicle offline for preventive maintenance.'
          : 'Monitor closely and prepare maintenance team if situation escalates.'),
      severity: criticalCount >= 2 ? 'critical' : 'warning',
      vehicle_id: state.vehicle.id,
      metadata: {
        anomaly_count: recentAnomalies.length,
        critical_count: criticalCount,
        affected_metrics: metricTypes,
        vehicle_type: state.vehicle.type,
        recommendation: criticalCount >= 2 ? 'take_offline_inspect' : 'monitor_closely',
        time_window_minutes: 5,
      },
    });
    recordInsight(key);
  }

  // ── Insight 3: Response time trend analysis ──
  {
    const key = 'response_time_trend:global';
    if (!isDuplicateInsight(key)) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: recentEvents } = await supabase
        .from('events')
        .select('vehicle_id, event_type, metadata, timestamp')
        .eq('event_type', 'arrived')
        .gte('timestamp', tenMinAgo);

      if (recentEvents && recentEvents.length >= 2) {
        const responseTimes = recentEvents
          .filter((e: { metadata: Record<string, unknown> | null }) => e.metadata && typeof e.metadata === 'object' && 'response_time_min' in e.metadata)
          .map((e: { metadata: { response_time_min?: number; response_time_seconds?: number } }) =>
            e.metadata.response_time_min ?? (e.metadata.response_time_seconds ? e.metadata.response_time_seconds / 60 : 0)
          )
          .filter((t: number) => t > 0);

        if (responseTimes.length >= 2) {
          const avgResponse = round(responseTimes.reduce((s: number, t: number) => s + t, 0) / responseTimes.length, 1);
          const maxResponse = round(Math.max(...responseTimes), 1);
          const minResponse = round(Math.min(...responseTimes), 1);

          const severity: Severity = avgResponse > 10 ? 'critical' : avgResponse > 5 ? 'warning' : 'info';

          insights.push({
            insight_type: 'response_time_trend',
            title: 'Response Time Analysis',
            description: `Average response time in the last 10 minutes: ${avgResponse} min ` +
              `(range: ${minResponse}–${maxResponse} min across ${responseTimes.length} responses). ` +
              (avgResponse > 10
                ? 'Response times are critically above target. Consider repositioning available units or activating reserve vehicles.'
                : avgResponse > 5
                  ? 'Response times trending above target. Review vehicle positioning strategy and consider pre-deploying units to high-demand areas.'
                  : 'Response times are within acceptable range. Fleet positioning is effective.'),
            severity,
            vehicle_id: null,
            metadata: {
              avg_response_min: avgResponse,
              max_response_min: maxResponse,
              min_response_min: minResponse,
              sample_size: responseTimes.length,
              time_window_minutes: 10,
              recommendation: avgResponse > 10 ? 'reposition_units' : avgResponse > 5 ? 'review_positioning' : 'maintain_current',
            },
          });
          recordInsight(key);
        }
      }
    }
  }

  // ── Insight 4: Fleet utilization alert ──
  {
    const key = 'utilization:global';
    if (!isDuplicateInsight(key)) {
      const totalVehicles = states.filter(
        (s) => s.vehicle.status !== 'maintenance' && s.vehicle.status !== 'offline'
      ).length;
      const busyVehicles = states.filter(
        (s) => s.vehicle.status === 'en_route' || s.vehicle.status === 'at_scene' || s.vehicle.status === 'in_service'
      ).length;
      const utilizationPct = totalVehicles > 0 ? round((busyVehicles / totalVehicles) * 100, 0) : 0;

      if (utilizationPct > 60) {
        const availableByType: Record<string, number> = {};
        for (const s of states) {
          if (s.vehicle.status === 'available') {
            availableByType[s.vehicle.type] = (availableByType[s.vehicle.type] || 0) + 1;
          }
        }

        insights.push({
          insight_type: 'utilization_alert',
          title: 'High Fleet Utilization Warning',
          description: `Fleet utilization at ${utilizationPct}% — ${busyVehicles} of ${totalVehicles} operational vehicles are currently deployed. ` +
            `Active incidents: ${activeIncidents.length}. ` +
            (utilizationPct > 80
              ? 'Critical capacity threshold reached. Any new major incident may not receive timely response. Recommend activating reserve units and notifying mutual aid partners.'
              : 'Utilization is elevated. Monitor for new incidents and prepare contingency dispatching plans.') +
            ` Available by type: ${Object.entries(availableByType).map(([t, c]) => `${t}: ${c}`).join(', ') || 'none'}.`,
          severity: utilizationPct > 80 ? 'critical' : 'warning',
          vehicle_id: null,
          metadata: {
            utilization_percent: utilizationPct,
            busy_vehicles: busyVehicles,
            total_operational: totalVehicles,
            active_incidents: activeIncidents.length,
            available_by_type: availableByType,
            recommendation: utilizationPct > 80 ? 'activate_reserves' : 'monitor_capacity',
          },
        });
        recordInsight(key);
      }
    }
  }

  // ── Insight 5: Maintenance due (high-mileage vehicles) ──
  for (const state of states) {
    if (state.odometer > 50000) {
      const key = `maintenance:${state.vehicle.id}`;
      if (isDuplicateInsight(key)) continue;

      insights.push({
        insight_type: 'maintenance_due',
        title: `Maintenance Due — ${state.vehicle.name}`,
        description: `${state.vehicle.name} (${state.vehicle.plate_number}) has reached ${round(state.odometer, 0)} km. ` +
          'Scheduled maintenance interval exceeded. Recommend scheduling preventive maintenance to avoid unexpected breakdowns during operations. ' +
          'Key areas to inspect: engine oil, brake pads, tire wear, and fluid levels.',
        severity: state.odometer > 75000 ? 'warning' : 'info',
        vehicle_id: state.vehicle.id,
        metadata: {
          odometer_km: round(state.odometer, 0),
          vehicle_type: state.vehicle.type,
          vehicle_status: state.vehicle.status,
          recommendation: 'schedule_maintenance',
          maintenance_items: ['engine_oil', 'brake_pads', 'tire_wear', 'fluid_levels'],
        },
      });
      recordInsight(key);
    }
  }

  // ── Insight 6: Engine overheating trend ──
  for (const state of states) {
    if (state.engineTemp > 100 && state.isMoving) {
      const key = `overheat:${state.vehicle.id}`;
      if (isDuplicateInsight(key)) continue;

      insights.push({
        insight_type: 'maintenance_due',
        title: `Engine Overheating Risk — ${state.vehicle.name}`,
        description: `${state.vehicle.name} engine temperature at ${round(state.engineTemp, 1)}°C, exceeding safe operating range. ` +
          (state.engineTemp > 108
            ? 'Critical temperature reached. Recommend immediately reducing vehicle load or stopping the engine to prevent permanent damage. Check coolant levels and radiator condition.'
            : 'Temperature is elevated. Monitor closely and consider reducing speed. Ensure cooling system is functioning properly.'),
        severity: state.engineTemp > 108 ? 'critical' : 'warning',
        vehicle_id: state.vehicle.id,
        metadata: {
          engine_temp_celsius: round(state.engineTemp, 1),
          vehicle_status: state.vehicle.status,
          recommendation: state.engineTemp > 108 ? 'stop_engine_immediately' : 'reduce_speed_monitor',
        },
      });
      recordInsight(key);
    }
  }

  // ── Insight 7: Incident clustering pattern ──
  if (activeIncidents.length >= 3) {
    const key = 'incident_cluster:global';
    if (!isDuplicateInsight(key)) {
      // Check if incidents are geographically clustered
      const centroidLat = activeIncidents.reduce((s, i) => s + i.latitude, 0) / activeIncidents.length;
      const centroidLng = activeIncidents.reduce((s, i) => s + i.longitude, 0) / activeIncidents.length;
      const avgDist = activeIncidents.reduce(
        (s, i) => s + distanceDeg(i.latitude, i.longitude, centroidLat, centroidLng), 0
      ) / activeIncidents.length;

      if (avgDist < 0.02) { // ~2km cluster
        const types = [...new Set(activeIncidents.map((i) => i.incident_type))];
        insights.push({
          insight_type: 'response_time_trend',
          title: 'Incident Clustering Detected',
          description: `${activeIncidents.length} active incidents detected in a concentrated area (avg ${round(avgDist * 111, 1)} km spread). ` +
            `Incident types: ${types.join(', ')}. ` +
            'This clustering pattern may indicate a cascading event or a high-risk zone. ' +
            'Recommend deploying additional units to the area and establishing a forward command post for coordinated response.',
          severity: 'warning',
          vehicle_id: null,
          metadata: {
            incident_count: activeIncidents.length,
            centroid_lat: round(centroidLat, 6),
            centroid_lng: round(centroidLng, 6),
            avg_spread_km: round(avgDist * 111, 1),
            incident_types: types,
            recommendation: 'deploy_forward_command',
          },
        });
        recordInsight(key);
      }
    }
  }

  // Insert insights
  if (insights.length > 0) {
    const { error } = await supabase.from('insights').insert(
      insights.map((i) => ({ ...i, created_at: now, is_dismissed: false }))
    );
    if (error) {
      logs.push(`  [INSIGHT ERROR] ${error.message}`);
    } else {
      for (const insight of insights) {
        const icon = insight.severity === 'critical' ? '💡🔴' : insight.severity === 'warning' ? '💡🟡' : '💡🔵';
        logs.push(`  ${icon} INSIGHT: ${insight.title}`);
      }
    }
  }

  return { insightCount: insights.length, logs };
}

// ============================================================
// Main simulation loop
// ============================================================

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('  Digital Twin — Real-Time World Simulation');
  console.log('  Telemetry • Incidents • Anomalies • Insights');
  console.log('  Generating data every 5 seconds. Press Ctrl+C to stop.');
  console.log('============================================================\n');

  // Load .env.local
  try {
    const { config } = await import('dotenv');
    config({ path: '.env.local' });
    config({ path: '.env' });
  } catch {
    // dotenv not available
  }

  const supabase = getSupabaseClient();

  // ── Load vehicles ──
  console.log('[INIT] Fetching vehicles...');
  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .select('id, type, name, plate_number, status, current_latitude, current_longitude, specifications')
    .order('plate_number');

  if (vErr || !vehicles || vehicles.length === 0) {
    console.error('[ERROR] Failed to fetch vehicles:', vErr?.message ?? 'No vehicles found');
    process.exit(1);
  }

  console.log(`[INIT] Found ${vehicles.length} vehicles.`);

  // ── Load detection rules ──
  console.log('[INIT] Fetching detection rules...');
  const { data: rulesData, error: rErr } = await supabase
    .from('detection_rules')
    .select('*')
    .eq('is_active', true);

  if (rErr) {
    console.error('[ERROR] Failed to fetch detection rules:', rErr.message);
    process.exit(1);
  }

  const rules: DetectionRule[] = (rulesData || []) as DetectionRule[];
  console.log(`[INIT] Loaded ${rules.length} active detection rules.`);

  // ── Reset vehicles to available (clean start) ──
  console.log('[INIT] Resetting vehicle statuses to available...');
  for (const v of vehicles) {
    if (v.status !== 'maintenance' && v.status !== 'offline') {
      await supabase
        .from('vehicles')
        .update({ status: 'available', risk_score: 0, updated_at: new Date().toISOString() })
        .eq('id', v.id);
      v.status = 'available';
    }
  }

  // ── Resolve any lingering incidents from previous runs ──
  await supabase
    .from('incidents')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .in('status', ['reported', 'dispatched', 'in_progress']);

  // ── Resolve old active anomalies ──
  await supabase
    .from('anomalies')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .in('status', ['active', 'acknowledged']);

  // Initialize state
  const states: VehicleState[] = vehicles.map((v) => initState(v as VehicleRow));
  const activeIncidents: ActiveIncident[] = [];

  // Print vehicle summary
  console.log('\n  Fleet Status:');
  for (const s of states) {
    const status = s.isMoving ? 'MOVING' : 'PARKED';
    console.log(`    [${s.vehicle.plate_number}] ${s.vehicle.name} (${s.vehicle.type}) — ${status}`);
  }
  console.log(`\n  Subsystems: Telemetry ✓ | Incidents ✓ | Anomalies ✓ | Insights ✓\n`);

  // Schedule first incident soon
  nextIncidentTick = randInt(2, 5);

  let tickCount = 0;

  const tick = async () => {
    tickCount++;
    const tickLogs: string[] = [];

    // ── 1. Simulate telemetry & movement ──
    const allTelemetry: TelemetryRow[] = [];
    const positionUpdates: { id: string; lat: number; lng: number }[] = [];

    for (const state of states) {
      simulateTick(state);
      allTelemetry.push(...buildTelemetryRows(state));

      // Emergency refuel (vehicle ran completely dry mid-mission)
      if (state.fuelLevel <= 1) {
        state.fuelLevel = rand(30, 50);
      }

      if (state.isMoving) {
        positionUpdates.push({
          id: state.vehicle.id,
          lat: round(state.latitude, 6),
          lng: round(state.longitude, 6),
        });
      }
    }

    // Insert telemetry
    const { error: telError } = await supabase.from('telemetry_readings').insert(allTelemetry);
    if (telError) {
      console.error(`[TICK ${tickCount}] Telemetry error:`, telError.message);
    }

    // Update positions
    for (const pos of positionUpdates) {
      await supabase
        .from('vehicles')
        .update({ current_latitude: pos.lat, current_longitude: pos.lng, updated_at: new Date().toISOString() })
        .eq('id', pos.id);
    }

    // ── 2. Incident lifecycle ──
    const { events: incidentEvents, logs: incidentLogs } = await processIncidentLifecycle(
      supabase, tickCount, activeIncidents, states
    );
    tickLogs.push(...incidentLogs);

    // Insert events from incident lifecycle
    if (incidentEvents.length > 0) {
      const { error: evtError } = await supabase.from('events').insert(incidentEvents);
      if (evtError) {
        console.error(`[TICK ${tickCount}] Event insert error:`, evtError.message);
      }
    }

    // ── 3. Anomaly detection ──
    const { anomalyCount, logs: anomalyLogs } = await processAnomalyDetection(
      supabase, states, allTelemetry, rules
    );
    tickLogs.push(...anomalyLogs);

    // ── 4. Insight generation (every INSIGHT_INTERVAL_TICKS) ──
    let insightCount = 0;
    if (tickCount % INSIGHT_INTERVAL_TICKS === 0) {
      const { insightCount: ic, logs: insightLogs } = await generateInsights(
        supabase, states, activeIncidents, tickCount
      );
      insightCount = ic;
      tickLogs.push(...insightLogs);
    }

    // ── Log summary ──
    const movingCount = states.filter((s) => s.isMoving).length;
    const avgSpeed = round(states.reduce((sum, s) => sum + s.speed, 0) / states.length, 1);
    const avgFuel = round(states.reduce((sum, s) => sum + s.fuelLevel, 0) / states.length, 1);
    const enRouteCount = states.filter((s) => s.vehicle.status === 'en_route').length;
    const atSceneCount = states.filter((s) => s.vehicle.status === 'at_scene').length;

    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `[${timestamp}] Tick #${tickCount} | ` +
      `${allTelemetry.length} readings | ` +
      `${incidentEvents.length} events | ` +
      `${anomalyCount} anomalies | ` +
      `${insightCount} insights | ` +
      `${activeIncidents.length} incidents | ` +
      `${movingCount} moving (${enRouteCount} en_route, ${atSceneCount} at_scene) | ` +
      `avg speed: ${avgSpeed} km/h | ` +
      `avg fuel: ${avgFuel}%`
    );

    for (const log of tickLogs) {
      console.log(log);
    }
  };

  // Run first tick immediately
  await tick();

  // Schedule subsequent ticks
  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error('[ERROR] Tick failed:', err);
    }
  }, TICK_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[SHUTDOWN] Stopping world simulation...');
    console.log(`[SHUTDOWN] Generated ${tickCount} ticks.`);

    // Reset vehicle statuses
    for (const state of states) {
      if (state.vehicle.status !== 'maintenance' && state.vehicle.status !== 'offline') {
        await supabase
          .from('vehicles')
          .update({ status: 'available', updated_at: new Date().toISOString() })
          .eq('id', state.vehicle.id);
      }
    }

    // Resolve active incidents
    for (const incident of activeIncidents) {
      await supabase
        .from('incidents')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', incident.id);
    }

    console.log('[SHUTDOWN] Cleanup complete.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ============================================================
// Entry point
// ============================================================

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
