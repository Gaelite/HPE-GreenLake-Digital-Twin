/**
 * ============================================================
 * Digital Twin - Emergency Vehicles POC — Telemetry Simulator
 * ============================================================
 *
 * Standalone script that generates continuous, realistic telemetry
 * data for all vehicles in the fleet. Pushes readings to Supabase
 * every 5 seconds.
 *
 * Usage:
 *   npx tsx scripts/generate-telemetry.ts
 *
 * Environment variables (via .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Service role key (bypasses RLS)
 *
 * ============================================================
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TICK_INTERVAL_MS = 5_000; // 5 seconds between telemetry bursts
const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };
const POSITION_DRIFT_MAX = 0.0008; // ~80 m per tick for moving vehicles

// ---------------------------------------------------------------------------
// Types (local to this script — avoids import issues in standalone mode)
// ---------------------------------------------------------------------------

type VehicleType = 'police' | 'ambulance' | 'fire_truck' | 'civil_protection' | 'hybrid';
type VehicleStatus = 'available' | 'in_service' | 'en_route' | 'at_scene' | 'maintenance' | 'offline';
type MetricType = 'speed' | 'engine_temp' | 'fuel_level' | 'tire_pressure' | 'battery_voltage' | 'rpm' | 'oil_pressure' | 'odometer';
type EventType = 'dispatch' | 'en_route' | 'arrived' | 'completed' | 'maintenance_alert' | 'refuel' | 'equipment_check';
type Severity = 'info' | 'warning' | 'critical';

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
  // Simulated sensor state
  speed: number;           // km/h
  engineTemp: number;      // celsius
  fuelLevel: number;       // percent 0-100
  tirePressure: number;    // psi
  batteryVoltage: number;  // volts
  rpm: number;             // revolutions per minute
  oilPressure: number;     // psi
  odometer: number;        // km
  latitude: number;
  longitude: number;
  // Movement simulation
  heading: number;         // degrees 0-360
  isMoving: boolean;
  ticksSinceLastEvent: number;
}

// ---------------------------------------------------------------------------
// Supabase Client
// ---------------------------------------------------------------------------

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      '\n[ERROR] Missing Supabase credentials.\n' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.\n' +
      'You can export them or create a .env.local file in the project root.\n'
    );
    process.exit(1);
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Random float in [min, max] */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max] */
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Small gaussian-ish jitter centered on 0 */
function jitter(magnitude: number): number {
  // Box-Muller approximation with 3 uniforms
  const u = Math.random() + Math.random() + Math.random();
  return (u / 3 - 0.5) * 2 * magnitude;
}

/** Round to N decimal places */
function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

// ---------------------------------------------------------------------------
// Speed profiles per vehicle type
// ---------------------------------------------------------------------------

interface SpeedProfile {
  maxSpeed: number;       // km/h
  cruiseMin: number;
  cruiseMax: number;
  accelRate: number;      // km/h per tick
  decelRate: number;      // km/h per tick
  stopProbability: number;// chance of stopping each tick (traffic light)
}

const SPEED_PROFILES: Record<VehicleType, SpeedProfile> = {
  police: {
    maxSpeed: 120,
    cruiseMin: 40,
    cruiseMax: 80,
    accelRate: 15,
    decelRate: 20,
    stopProbability: 0.05,
  },
  ambulance: {
    maxSpeed: 110,
    cruiseMin: 50,
    cruiseMax: 95,
    accelRate: 12,
    decelRate: 18,
    stopProbability: 0.03, // sirens on, fewer stops
  },
  fire_truck: {
    maxSpeed: 80,
    cruiseMin: 30,
    cruiseMax: 60,
    accelRate: 8,
    decelRate: 12,
    stopProbability: 0.06,
  },
  civil_protection: {
    maxSpeed: 90,
    cruiseMin: 35,
    cruiseMax: 70,
    accelRate: 10,
    decelRate: 15,
    stopProbability: 0.07,
  },
  hybrid: {
    maxSpeed: 70,
    cruiseMin: 25,
    cruiseMax: 55,
    accelRate: 7,
    decelRate: 10,
    stopProbability: 0.08,
  },
};

// ---------------------------------------------------------------------------
// Initialize vehicle state from database row
// ---------------------------------------------------------------------------

function initState(v: VehicleRow): VehicleState {
  const isMoving = v.status === 'in_service' || v.status === 'en_route';
  const profile = SPEED_PROFILES[v.type];

  return {
    vehicle: v,
    speed: isMoving ? rand(profile.cruiseMin, profile.cruiseMax) : 0,
    engineTemp: isMoving ? rand(85, 95) : rand(35, 55),
    fuelLevel: rand(40, 95),
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
  };
}

// ---------------------------------------------------------------------------
// Simulate one tick for a vehicle
// ---------------------------------------------------------------------------

function simulateTick(state: VehicleState): void {
  const profile = SPEED_PROFILES[state.vehicle.type];
  state.ticksSinceLastEvent++;

  // --- Decide movement ---
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

  // Available vehicles might start moving (dispatched) or stay parked
  if (state.vehicle.status === 'available') {
    if (!state.isMoving && Math.random() < 0.02) {
      // 2% chance per tick to get dispatched
      state.isMoving = true;
      state.speed = rand(10, 30);
      state.engineTemp = clamp(state.engineTemp + 5, 60, 80);
    } else if (state.isMoving && Math.random() < 0.01) {
      // 1% chance to return to station
      state.isMoving = false;
      state.speed = 0;
    }
  }

  // Vehicles in_service or en_route are always moving
  if (state.vehicle.status === 'in_service' || state.vehicle.status === 'en_route') {
    state.isMoving = true;
  }

  // --- Speed simulation ---
  if (state.isMoving) {
    // Random traffic stop
    if (Math.random() < profile.stopProbability) {
      state.speed = clamp(state.speed - profile.decelRate * 2, 0, profile.maxSpeed);
    } else if (state.speed < profile.cruiseMin) {
      // Accelerate
      state.speed = clamp(state.speed + rand(5, profile.accelRate), 0, profile.maxSpeed);
    } else if (state.speed > profile.cruiseMax) {
      // Decelerate to cruise range
      state.speed = clamp(state.speed - rand(3, profile.decelRate), 0, profile.maxSpeed);
    } else {
      // Small random fluctuation within cruise range
      state.speed = clamp(state.speed + jitter(8), 0, profile.maxSpeed);
    }

    // Occasional burst (emergency acceleration)
    if (Math.random() < 0.03) {
      state.speed = clamp(state.speed + rand(15, 30), 0, profile.maxSpeed);
    }
  } else {
    state.speed = 0;
  }

  // --- Engine temperature ---
  if (state.isMoving) {
    // Base temp correlates with speed/RPM
    const targetTemp = 85 + (state.speed / profile.maxSpeed) * 15;
    state.engineTemp = clamp(
      state.engineTemp + (targetTemp - state.engineTemp) * 0.1 + jitter(1.5),
      70,
      115
    );
    // Occasional spike
    if (Math.random() < 0.008) {
      state.engineTemp = clamp(state.engineTemp + rand(5, 12), 70, 115);
    }
  } else {
    // Cooling down towards ambient
    state.engineTemp = clamp(state.engineTemp - rand(0.2, 1.0) + jitter(0.3), 20, 65);
  }

  // --- RPM ---
  if (state.isMoving) {
    // RPM roughly proportional to speed
    const baseRpm = 800 + (state.speed / profile.maxSpeed) * 5000;
    state.rpm = clamp(baseRpm + jitter(300), 700, 6800);
  } else {
    state.rpm = state.speed > 0 ? rand(700, 900) : 0;
  }

  // --- Fuel level (slowly decreasing) ---
  if (state.isMoving) {
    // Faster consumption at higher speeds
    const consumptionRate = 0.02 + (state.speed / profile.maxSpeed) * 0.06;
    state.fuelLevel = clamp(state.fuelLevel - consumptionRate + jitter(0.005), 0, 100);
  } else {
    // Idle consumption (very slow)
    state.fuelLevel = clamp(state.fuelLevel - 0.002, 0, 100);
  }

  // --- Tire pressure (mostly stable) ---
  state.tirePressure = clamp(state.tirePressure + jitter(0.1), 22, 40);
  // Occasional slow leak
  if (Math.random() < 0.002) {
    state.tirePressure = clamp(state.tirePressure - rand(0.5, 2.0), 22, 40);
  }

  // --- Battery voltage ---
  if (state.isMoving) {
    // Alternator charging
    state.batteryVoltage = clamp(13.8 + jitter(0.3), 13.0, 14.8);
  } else {
    // Slow discharge
    state.batteryVoltage = clamp(state.batteryVoltage - 0.003 + jitter(0.02), 11.0, 12.8);
  }

  // --- Oil pressure ---
  if (state.isMoving) {
    state.oilPressure = clamp(40 + (state.rpm / 6000) * 20 + jitter(3), 25, 65);
  } else {
    state.oilPressure = clamp(state.oilPressure + jitter(0.5), 0, 15);
  }

  // --- Odometer ---
  if (state.isMoving) {
    // km traveled in 5 seconds at current speed
    const kmPerTick = (state.speed / 3600) * (TICK_INTERVAL_MS / 1000);
    state.odometer += kmPerTick;
  }

  // --- GPS position drift ---
  if (state.isMoving && state.speed > 0) {
    // Move in heading direction proportional to speed
    const driftScale = (state.speed / profile.maxSpeed) * POSITION_DRIFT_MAX;
    const headingRad = (state.heading * Math.PI) / 180;

    state.latitude += Math.cos(headingRad) * driftScale + jitter(0.00005);
    state.longitude += Math.sin(headingRad) * driftScale + jitter(0.00005);

    // Gradually adjust heading (simulating turns)
    state.heading = (state.heading + jitter(15) + 360) % 360;

    // Keep within Madrid bounds
    state.latitude = clamp(state.latitude, 40.38, 40.46);
    state.longitude = clamp(state.longitude, -3.76, -3.64);
  }
}

// ---------------------------------------------------------------------------
// Build telemetry rows for insertion
// ---------------------------------------------------------------------------

interface TelemetryRow {
  vehicle_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  latitude: number;
  longitude: number;
  timestamp: string;
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

  // Only emit RPM and oil pressure for moving vehicles
  if (state.isMoving || state.speed > 0) {
    rows.push(
      { vehicle_id: state.vehicle.id, metric_type: 'rpm', value: round(state.rpm, 0), unit: 'rpm', latitude: lat, longitude: lng, timestamp: ts },
      { vehicle_id: state.vehicle.id, metric_type: 'oil_pressure', value: round(state.oilPressure, 1), unit: 'psi', latitude: lat, longitude: lng, timestamp: ts },
    );
  }

  // Emit odometer every ~6th tick (30 seconds)
  if (Math.random() < 0.17) {
    rows.push(
      { vehicle_id: state.vehicle.id, metric_type: 'odometer', value: round(state.odometer, 1), unit: 'km', latitude: lat, longitude: lng, timestamp: ts },
    );
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Occasional event generation
// ---------------------------------------------------------------------------

interface EventRow {
  vehicle_id: string;
  event_type: EventType;
  description: string;
  severity: Severity;
  metadata: Record<string, unknown>;
  timestamp: string;
}

function maybeGenerateEvent(state: VehicleState): EventRow | null {
  // Only generate events occasionally (every ~60 ticks = 5 min avg)
  if (state.ticksSinceLastEvent < 30) return null;
  if (Math.random() > 0.02) return null;

  state.ticksSinceLastEvent = 0;
  const ts = new Date().toISOString();
  const vid = state.vehicle.id;

  const eventOptions: EventRow[] = [
    {
      vehicle_id: vid,
      event_type: 'dispatch',
      description: `${state.vehicle.name} dispatched to new incident.`,
      severity: 'info',
      metadata: {
        location: `Madrid sector ${randInt(1, 12)}`,
        priority: ['low', 'medium', 'high'][randInt(0, 2)],
      },
      timestamp: ts,
    },
    {
      vehicle_id: vid,
      event_type: 'arrived',
      description: `${state.vehicle.name} arrived at scene.`,
      severity: 'info',
      metadata: {
        response_time_min: randInt(4, 18),
        distance_km: round(rand(1, 10), 1),
      },
      timestamp: ts,
    },
    {
      vehicle_id: vid,
      event_type: 'completed',
      description: `${state.vehicle.name} completed assignment and returning to base.`,
      severity: 'info',
      metadata: {
        duration_min: randInt(15, 90),
        outcome: 'resolved',
      },
      timestamp: ts,
    },
    {
      vehicle_id: vid,
      event_type: 'refuel',
      description: `${state.vehicle.name} refueling at station.`,
      severity: 'info',
      metadata: {
        liters: randInt(30, 120),
        station: ['Central', 'North', 'South', 'East'][randInt(0, 3)],
      },
      timestamp: ts,
    },
  ];

  // If fuel is low, generate a warning event
  if (state.fuelLevel < 20) {
    return {
      vehicle_id: vid,
      event_type: 'maintenance_alert',
      description: `${state.vehicle.name} fuel level critically low at ${round(state.fuelLevel, 1)}%.`,
      severity: state.fuelLevel < 10 ? 'critical' : 'warning',
      metadata: {
        fuel_level_percent: round(state.fuelLevel, 1),
        recommendation: 'refuel_immediately',
      },
      timestamp: ts,
    };
  }

  // If engine temp is high, generate a warning
  if (state.engineTemp > 100) {
    return {
      vehicle_id: vid,
      event_type: 'maintenance_alert',
      description: `${state.vehicle.name} engine temperature elevated at ${round(state.engineTemp, 1)}C.`,
      severity: state.engineTemp > 108 ? 'critical' : 'warning',
      metadata: {
        engine_temp_celsius: round(state.engineTemp, 1),
        recommendation: 'reduce_load_or_stop',
      },
      timestamp: ts,
    };
  }

  return eventOptions[randInt(0, eventOptions.length - 1)];
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('  Digital Twin — Telemetry Simulator');
  console.log('  Generating data every 5 seconds. Press Ctrl+C to stop.');
  console.log('============================================================\n');

  // Load .env.local if present (for local development)
  try {
    const { config } = await import('dotenv');
    config({ path: '.env.local' });
    config({ path: '.env' });
  } catch {
    // dotenv not available, rely on environment variables
  }

  const supabase = getSupabaseClient();

  // Fetch all vehicles
  console.log('[INIT] Fetching vehicles from database...');
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, type, name, plate_number, status, current_latitude, current_longitude, specifications')
    .order('plate_number');

  if (error || !vehicles || vehicles.length === 0) {
    console.error('[ERROR] Failed to fetch vehicles:', error?.message ?? 'No vehicles found');
    console.error('Make sure the seed data has been applied first.');
    process.exit(1);
  }

  console.log(`[INIT] Found ${vehicles.length} vehicles. Initializing state...\n`);

  // Initialize state for each vehicle
  const states: VehicleState[] = vehicles.map((v) => initState(v as VehicleRow));

  // Print vehicle summary
  for (const s of states) {
    const status = s.isMoving ? 'MOVING' : 'PARKED';
    console.log(`  [${s.vehicle.plate_number}] ${s.vehicle.name} (${s.vehicle.type}) — ${status}`);
  }
  console.log('');

  let tickCount = 0;

  // Simulation loop
  const tick = async () => {
    tickCount++;
    const allTelemetry: TelemetryRow[] = [];
    const allEvents: EventRow[] = [];
    const positionUpdates: { id: string; lat: number; lng: number }[] = [];

    // Simulate each vehicle
    for (const state of states) {
      simulateTick(state);

      const telemetry = buildTelemetryRows(state);
      allTelemetry.push(...telemetry);

      const event = maybeGenerateEvent(state);
      if (event) allEvents.push(event);

      // If fuel runs out, refuel (simulation convenience)
      if (state.fuelLevel <= 1) {
        state.fuelLevel = rand(70, 95);
        allEvents.push({
          vehicle_id: state.vehicle.id,
          event_type: 'refuel',
          description: `${state.vehicle.name} auto-refueled (simulation).`,
          severity: 'info',
          metadata: { auto_refuel: true, new_level: round(state.fuelLevel, 1) },
          timestamp: new Date().toISOString(),
        });
      }

      // Collect position updates for vehicles table
      if (state.isMoving) {
        positionUpdates.push({
          id: state.vehicle.id,
          lat: round(state.latitude, 6),
          lng: round(state.longitude, 6),
        });
      }
    }

    // Batch insert telemetry
    const { error: telError } = await supabase
      .from('telemetry_readings')
      .insert(allTelemetry);

    if (telError) {
      console.error(`[TICK ${tickCount}] Telemetry insert error:`, telError.message);
    }

    // Insert events
    if (allEvents.length > 0) {
      const { error: evtError } = await supabase
        .from('events')
        .insert(allEvents);

      if (evtError) {
        console.error(`[TICK ${tickCount}] Event insert error:`, evtError.message);
      }
    }

    // Update vehicle positions
    for (const pos of positionUpdates) {
      await supabase
        .from('vehicles')
        .update({
          current_latitude: pos.lat,
          current_longitude: pos.lng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pos.id);
    }

    // Log summary
    const movingCount = states.filter((s) => s.isMoving).length;
    const avgSpeed = round(
      states.reduce((sum, s) => sum + s.speed, 0) / states.length,
      1
    );
    const avgFuel = round(
      states.reduce((sum, s) => sum + s.fuelLevel, 0) / states.length,
      1
    );

    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `[${timestamp}] Tick #${tickCount} | ` +
      `${allTelemetry.length} readings | ` +
      `${allEvents.length} events | ` +
      `${movingCount}/${states.length} moving | ` +
      `avg speed: ${avgSpeed} km/h | ` +
      `avg fuel: ${avgFuel}%`
    );

    // Log any notable events
    for (const evt of allEvents) {
      const vehicle = states.find((s) => s.vehicle.id === evt.vehicle_id);
      const prefix = evt.severity === 'critical' ? '  !! ' : evt.severity === 'warning' ? '  !  ' : '     ';
      console.log(`${prefix}[${vehicle?.vehicle.plate_number}] ${evt.event_type}: ${evt.description}`);
    }
  };

  // Run the first tick immediately
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
  const shutdown = () => {
    console.log('\n[SHUTDOWN] Stopping telemetry simulator...');
    console.log(`[SHUTDOWN] Generated ${tickCount} ticks of telemetry data.`);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
