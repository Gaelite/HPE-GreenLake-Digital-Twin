/**
 * World Simulation Engine
 *
 * Self-contained singleton that runs the full digital-twin simulation
 * (telemetry, incidents, anomalies, insights) inside the Next.js server
 * process via setInterval. Used by the /api/simulator/* routes.
 *
 * Mirrors the logic in scripts/simulate-world.ts but packaged as a
 * reusable class instead of a CLI entry-point.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Configuration
// ============================================================

const TICK_INTERVAL_MS = 5_000;
const INCIDENT_CREATE_MIN_TICKS = 6;
const INCIDENT_CREATE_MAX_TICKS = 18;
const MAX_ACTIVE_INCIDENTS = 5;
const INCIDENT_DISPATCH_DELAY_TICKS = 2;
const INCIDENT_RESOLVE_MIN_TICKS = 20;
const INCIDENT_RESOLVE_MAX_TICKS = 60;
const ANOMALY_THROTTLE_SECONDS = 30;
const INSIGHT_INTERVAL_TICKS = 12;
const ARRIVAL_DISTANCE_THRESHOLD = 0.002;
const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };
/** Approximate km per degree at Madrid's latitude (~40°).
 *  Used to convert vehicle speed (km/h) to degree-space progress along graph edges. */
const KM_PER_DEG = 85.0;

// ============================================================
// Types
// ============================================================

type VehicleType = 'police' | 'ambulance' | 'fire_truck' | 'civil_protection' | 'hybrid';
type VehicleStatus = 'available' | 'in_service' | 'en_route' | 'at_scene' | 'maintenance' | 'offline';
type MetricType = 'speed' | 'engine_temp' | 'fuel_level' | 'tire_pressure' | 'battery_voltage' | 'rpm' | 'oil_pressure' | 'odometer';
type EventType = 'dispatch' | 'en_route' | 'arrived' | 'completed' | 'maintenance_alert' | 'refuel' | 'equipment_check';
type Severity = 'info' | 'warning' | 'critical';
type EmergencyIncidentType = 'fire' | 'medical' | 'crime' | 'accident' | 'natural_disaster';
type TrafficObstacleType = 'road_closure';
type IncidentType = EmergencyIncidentType | TrafficObstacleType;
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
  assignedIncidentId: string | null;
  targetLat: number | null;
  targetLng: number | null;
  ticksAtScene: number;
  resolveAfterTicks: number;
  // Road network navigation
  currentNodeId: string;
  nextNodeId: string | null;
  edgeProgress: number;
  routePath: string[];
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
  dispatchedAt: number | null;
}

function isTrafficObstacle(incident: ActiveIncident): boolean {
  return incident.incident_type === 'road_closure';
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

interface InsightInsert {
  insight_type: InsightType;
  title: string;
  description: string;
  severity: Severity;
  vehicle_id: string | null;
  metadata: Record<string, unknown>;
}

export interface SimulationStatus {
  running: boolean;
  tickCount: number;
  vehicleCount: number;
  activeIncidents: number;
  totalAnomalies: number;
  totalInsights: number;
  totalEvents: number;
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
  police: { maxSpeed: 80, cruiseMin: 30, cruiseMax: 60, accelRate: 15, decelRate: 20, stopProbability: 0.05 },
  ambulance: { maxSpeed: 80, cruiseMin: 35, cruiseMax: 65, accelRate: 12, decelRate: 18, stopProbability: 0.03 },
  fire_truck: { maxSpeed: 70, cruiseMin: 30, cruiseMax: 55, accelRate: 8, decelRate: 12, stopProbability: 0.06 },
  civil_protection: { maxSpeed: 80, cruiseMin: 30, cruiseMax: 60, accelRate: 10, decelRate: 15, stopProbability: 0.07 },
  hybrid: { maxSpeed: 65, cruiseMin: 25, cruiseMax: 50, accelRate: 7, decelRate: 10, stopProbability: 0.08 },
};

// ============================================================
// Vehicle-to-incident type affinity
// ============================================================

const INCIDENT_VEHICLE_AFFINITY: Record<EmergencyIncidentType, VehicleType[]> = {
  fire: ['fire_truck', 'civil_protection'],
  medical: ['ambulance'],
  crime: ['police'],
  accident: ['police', 'ambulance', 'civil_protection'],
  natural_disaster: ['civil_protection', 'fire_truck', 'hybrid'],
};

// ============================================================
// Incident generation data
// ============================================================

const INCIDENT_TEMPLATES: Record<EmergencyIncidentType, { titles: string[]; descriptions: string[] }> = {
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

const ROAD_OBSTACLE_TEMPLATES = {
  titles: [
    'Road Closure — Accident',
    'Traffic Accident Ahead',
    'Street Blocked by Debris',
    'Emergency Construction Zone',
    'Fallen Tree on Road',
    'Overturned Vehicle',
    'Water Main Break',
  ],
  descriptions: [
    'Multi-vehicle accident blocking the road, traffic being diverted',
    'Emergency construction blocking main thoroughfare, expect delays',
    'Fallen tree blocking road, emergency crews dispatched to clear',
    'Water main break causing road closure, detour required',
    'Overturned vehicle blocking intersection, lane closures in effect',
    'Debris from building works blocking traffic, clean-up in progress',
    'Road surface damage making route impassable, avoid area',
  ],
};

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
// Road Network Graph — Madrid streets
// ============================================================

interface RoadNode { id: string; lat: number; lng: number; }
interface RoadEdge { from: string; to: string; }

const ROAD_NODES: RoadNode[] = [
  // ── Paseo de la Castellana / Recoletos / Prado (main N-S spine) ─────────
  { id: 'CAS00', lat: 40.4720, lng: -3.6863 }, // Manoteras / A-1 norte
  { id: 'CAS01', lat: 40.4657, lng: -3.6887 }, // Plaza de Castilla
  { id: 'CAS02', lat: 40.4575, lng: -3.6900 }, // Cuzco
  { id: 'CAS03', lat: 40.4530, lng: -3.6893 }, // Santiago Bernabéu
  { id: 'CAS04', lat: 40.4467, lng: -3.6920 }, // Nuevos Ministerios
  { id: 'CAS05', lat: 40.4400, lng: -3.6925 }, // Gregorio Marañón
  { id: 'CAS06', lat: 40.4340, lng: -3.6930 }, // Rubén Darío
  { id: 'CAS07', lat: 40.4256, lng: -3.6908 }, // Colón
  { id: 'CAS08', lat: 40.4197, lng: -3.6937 }, // Cibeles
  { id: 'CAS09', lat: 40.4155, lng: -3.6940 }, // Neptuno / Prado
  { id: 'CAS10', lat: 40.4068, lng: -3.6935 }, // Atocha

  // ── Gran Vía (W→E) ─────────────────────────────────────────────────────
  { id: 'GV01', lat: 40.4234, lng: -3.7138 }, // Plaza de España
  { id: 'GV02', lat: 40.4215, lng: -3.7078 }, // Callao
  { id: 'GV03', lat: 40.4202, lng: -3.7015 }, // Red de San Luis
  { id: 'GV04', lat: 40.4196, lng: -3.6970 }, // Gran Vía / Alcalá junction

  // ── Central (Sol area) ─────────────────────────────────────────────────
  { id: 'SOL',     lat: 40.4168, lng: -3.7038 }, // Puerta del Sol
  { id: 'MAY01',   lat: 40.4155, lng: -3.7080 }, // Calle Mayor / Opera
  { id: 'HUE',     lat: 40.4140, lng: -3.7000 }, // Huertas / Ángel
  { id: 'LAV',     lat: 40.4080, lng: -3.7025 }, // Tirso de Molina
  { id: 'LAV2',    lat: 40.4070, lng: -3.7130 }, // Lavapiés
  { id: 'EMB',     lat: 40.4050, lng: -3.7060 }, // Embajadores
  { id: 'PTO_TOL', lat: 40.4020, lng: -3.7100 }, // Puerta de Toledo

  // ── Calle de Toledo (Sol → south) ─────────────────────────────────────
  { id: 'TOL01', lat: 40.4128, lng: -3.7095 }, // Toledo / Latina
  { id: 'TOL02', lat: 40.4075, lng: -3.7105 }, // Toledo mid

  // ── Calle de Segovia / Imperial (SW from Sol) ──────────────────────────
  { id: 'SEG01', lat: 40.4148, lng: -3.7188 }, // Segovia / Viaducto
  { id: 'IMP01', lat: 40.4000, lng: -3.7210 }, // Paseo Imperial
  { id: 'IMP02', lat: 40.3960, lng: -3.7240 }, // Imperial / Oporto

  // ── Bilbao / Sagasta / Fuencarral street ───────────────────────────────
  { id: 'BIL',   lat: 40.4286, lng: -3.6991 }, // Glorieta de Bilbao
  { id: 'SAG01', lat: 40.4316, lng: -3.6985 }, // Sagasta / Almagro
  { id: 'FC01',  lat: 40.4240, lng: -3.7015 }, // Fuencarral street (south)
  { id: 'GEN',   lat: 40.4305, lng: -3.6955 }, // Génova / Castellana connector

  // ── Alonso Martínez / Malasaña ─────────────────────────────────────────
  { id: 'AMA',  lat: 40.4350, lng: -3.7050 }, // Alonso Martínez
  { id: 'MAL',  lat: 40.4267, lng: -3.7005 }, // Tribunal
  { id: 'MAL2', lat: 40.4255, lng: -3.7100 }, // San Bernardo
  { id: 'NOV',  lat: 40.4235, lng: -3.7155 }, // Noviciado

  // ── Princesa / Argüelles / Moncloa ─────────────────────────────────────
  { id: 'PRI',  lat: 40.4262, lng: -3.7178 }, // Princesa
  { id: 'AG01', lat: 40.4297, lng: -3.7185 }, // Alberto Aguilera (E of Moncloa)
  { id: 'ARG',  lat: 40.4320, lng: -3.7120 }, // Argüelles
  { id: 'MON',  lat: 40.4345, lng: -3.7196 }, // Moncloa
  { id: 'MON2', lat: 40.4400, lng: -3.7300 }, // A-6 / Casa de Campo entrance

  // ── Cuatro Caminos / Tetuán / Bravo Murillo corridor ───────────────────
  { id: 'CC',    lat: 40.4460, lng: -3.7018 }, // Cuatro Caminos
  { id: 'RR',    lat: 40.4422, lng: -3.7010 }, // Ríos Rosas
  { id: 'TET01', lat: 40.4450, lng: -3.7100 }, // Tetuán
  { id: 'TET02', lat: 40.4500, lng: -3.7050 }, // Bravo Murillo / Alvarado
  { id: 'BM01',  lat: 40.4540, lng: -3.7055 }, // Bravo Murillo north

  // ── Fuencarral ─────────────────────────────────────────────────────────
  { id: 'FUE01', lat: 40.4600, lng: -3.7000 }, // Fuencarral
  { id: 'FUE02', lat: 40.4550, lng: -3.6950 }, // Fuencarral south

  // ── Calle de Hortaleza / Santa Engracia (N-S) ──────────────────────────
  { id: 'HOR01', lat: 40.4320, lng: -3.6965 }, // Hortaleza / Génova
  { id: 'SE01',  lat: 40.4380, lng: -3.6972 }, // Santa Engracia / Alonso Cano
  { id: 'SE02',  lat: 40.4422, lng: -3.6980 }, // Santa Engracia north

  // ── Calle de Alcalá (W→E) ──────────────────────────────────────────────
  { id: 'ALC01', lat: 40.4200, lng: -3.6880 }, // Puerta de Alcalá
  { id: 'ALC02', lat: 40.4262, lng: -3.6786 }, // Goya / Alcalá
  { id: 'ALC03', lat: 40.4310, lng: -3.6640 }, // Ventas

  // ── Salamanca district (N-S: Serrano / Velázquez / Francisco Silvela) ──
  { id: 'SAL03', lat: 40.4380, lng: -3.6950 }, // Príncipe de Vergara / Lista
  { id: 'SAL01', lat: 40.4380, lng: -3.6860 }, // Serrano / Lista
  { id: 'SAL02', lat: 40.4330, lng: -3.6860 }, // Serrano / Goya
  { id: 'VEL01', lat: 40.4362, lng: -3.6800 }, // Velázquez / Lista
  { id: 'VEL02', lat: 40.4300, lng: -3.6810 }, // Velázquez / Goya
  { id: 'DL01',  lat: 40.4378, lng: -3.6760 }, // Diego de León / Serrano
  { id: 'JB01',  lat: 40.4336, lng: -3.6765 }, // Juan Bravo / Velázquez
  { id: 'SIL01', lat: 40.4420, lng: -3.6730 }, // Francisco Silvela / Lista
  { id: 'SIL02', lat: 40.4365, lng: -3.6720 }, // Francisco Silvela / Juan Bravo
  { id: 'CPE01', lat: 40.4325, lng: -3.6830 }, // Conde de Peñalver (E-W connector)

  // ── Retiro / O'Donnell / Narváez / Dr. Esquerdo ────────────────────────
  { id: 'RET01', lat: 40.4100, lng: -3.6800 }, // Ibiza / O'Donnell
  { id: 'NAR01', lat: 40.4168, lng: -3.6800 }, // Narváez / Montalbán
  { id: 'NAR02', lat: 40.4133, lng: -3.6785 }, // Narváez south
  { id: 'ODO01', lat: 40.4193, lng: -3.6750 }, // O'Donnell / Alcalá
  { id: 'ESQ01', lat: 40.4055, lng: -3.6785 }, // Dr. Esquerdo north
  { id: 'ESQ02', lat: 40.4010, lng: -3.6770 }, // Dr. Esquerdo mid
  { id: 'MEN',   lat: 40.4100, lng: -3.6740 }, // Menéndez Pelayo

  // ── Paseo de las Delicias (south from Atocha) ──────────────────────────
  { id: 'DEL01', lat: 40.4020, lng: -3.6908 }, // Delicias / Méndez Álvaro
  { id: 'DEL02', lat: 40.3965, lng: -3.6895 }, // Méndez Álvaro hub
  { id: 'PAC',   lat: 40.4070, lng: -3.6860 }, // Pacífico / Atocha

  // ── Southern: Legazpi ──────────────────────────────────────────────────
  { id: 'LEG',  lat: 40.3920, lng: -3.6948 }, // Legazpi

  // ── Southern: Vallecas ─────────────────────────────────────────────────
  { id: 'VAL02', lat: 40.3980, lng: -3.6940 }, // Puente de Vallecas
  { id: 'VAL01', lat: 40.3930, lng: -3.6940 }, // Vallecas
  { id: 'VAL03', lat: 40.3870, lng: -3.6910 }, // Vallecas south

  // ── Southern: Usera ────────────────────────────────────────────────────
  { id: 'USE02', lat: 40.3920, lng: -3.7100 }, // Usera north
  { id: 'USE01', lat: 40.3850, lng: -3.7150 }, // Usera

  // ── Southern: Carabanchel ──────────────────────────────────────────────
  { id: 'CAR02', lat: 40.4020, lng: -3.7180 }, // Carabanchel east
  { id: 'CAR01', lat: 40.4000, lng: -3.7250 }, // Carabanchel
  { id: 'CAR03', lat: 40.3940, lng: -3.7280 }, // Carabanchel south

  // ── M-30 ring road (full circuit) ──────────────────────────────────────
  { id: 'M30N',  lat: 40.4600, lng: -3.6780 }, // M-30 north / A-1
  { id: 'M30NE', lat: 40.4450, lng: -3.6650 }, // M-30 northeast
  { id: 'M30E',  lat: 40.4300, lng: -3.6580 }, // M-30 east
  { id: 'M30SE', lat: 40.4050, lng: -3.6700 }, // M-30 southeast
  { id: 'M30S',  lat: 40.3900, lng: -3.6850 }, // M-30 south
  { id: 'M30SW', lat: 40.3920, lng: -3.7050 }, // M-30 southwest
  { id: 'M30W',  lat: 40.4140, lng: -3.7480 }, // M-30 west / A-5
  { id: 'M30NW', lat: 40.4420, lng: -3.7350 }, // M-30 northwest

  // ── Casa de Campo ──────────────────────────────────────────────────────
  { id: 'CDC01', lat: 40.4150, lng: -3.7400 }, // Casa de Campo interior
  { id: 'CDC02', lat: 40.4190, lng: -3.7300 }, // Casa de Campo east

  // ── Northwest: Moncloa / Pozuelo access ────────────────────────────────
  { id: 'CEA01', lat: 40.4380, lng: -3.7380 }, // Cea Bermúdez / A-6

  // ── Ciudad Lineal / Arturo Soria ───────────────────────────────────────
  { id: 'CLI01', lat: 40.4400, lng: -3.6700 }, // Ciudad Lineal
  { id: 'CLI02', lat: 40.4350, lng: -3.6680 }, // Ciudad Lineal south
  { id: 'AS01',  lat: 40.4560, lng: -3.6570 }, // Arturo Soria north
  { id: 'AS02',  lat: 40.4480, lng: -3.6600 }, // Arturo Soria south

  // ── Moratalaz / Entrevías ───────────────────────────────────────────────
  { id: 'MOR01', lat: 40.4100, lng: -3.6620 }, // Moratalaz / Pavones
  { id: 'ENT01', lat: 40.3850, lng: -3.6750 }, // Entrevías
];

const ROAD_EDGES: RoadEdge[] = [
  // ── Paseo de la Castellana / Recoletos / Prado ─────────────────────────
  { from: 'CAS00', to: 'CAS01' },
  { from: 'CAS01', to: 'CAS02' },
  { from: 'CAS02', to: 'CAS03' },
  { from: 'CAS03', to: 'CAS04' },
  { from: 'CAS04', to: 'CAS05' },
  { from: 'CAS05', to: 'CAS06' },
  { from: 'CAS06', to: 'CAS07' },
  { from: 'CAS07', to: 'CAS08' },
  { from: 'CAS08', to: 'CAS09' },
  { from: 'CAS09', to: 'CAS10' },

  // ── Gran Vía ───────────────────────────────────────────────────────────
  { from: 'GV01', to: 'GV02' },
  { from: 'GV02', to: 'GV03' },
  { from: 'GV03', to: 'GV04' },
  { from: 'GV04', to: 'CAS08' }, // joins Cibeles

  // ── Sol and nearby ─────────────────────────────────────────────────────
  { from: 'SOL', to: 'GV02' },   // Sol → Callao
  { from: 'SOL', to: 'GV03' },   // Sol → Red de San Luis
  { from: 'SOL', to: 'HUE' },    // Sol → Huertas
  { from: 'SOL', to: 'MAY01' },  // Sol → Mayor/Opera
  { from: 'SOL', to: 'FC01' },   // Sol → Fuencarral street (N)
  { from: 'HUE', to: 'CAS09' },  // Huertas → Neptuno
  { from: 'HUE', to: 'LAV' },    // Huertas → Tirso
  { from: 'MAY01', to: 'TOL01' },// Mayor → Toledo
  { from: 'MAY01', to: 'SEG01' },// Mayor → Segovia/Viaducto
  { from: 'MAY01', to: 'GV01' }, // Opera → Plaza de España

  // ── Calle de Toledo ────────────────────────────────────────────────────
  { from: 'TOL01', to: 'TOL02' },
  { from: 'TOL02', to: 'PTO_TOL' },
  { from: 'TOL01', to: 'LAV2' },

  // ── Calle de Segovia / Imperial ────────────────────────────────────────
  { from: 'SEG01', to: 'CDC02' }, // Segovia → Casa de Campo east
  { from: 'SEG01', to: 'IMP01' },
  { from: 'IMP01', to: 'IMP02' },
  { from: 'IMP01', to: 'CAR02' },
  { from: 'IMP02', to: 'CAR03' },
  { from: 'IMP02', to: 'USE02' },

  // ── Lavapiés / Embajadores ─────────────────────────────────────────────
  { from: 'LAV', to: 'LAV2' },
  { from: 'LAV', to: 'EMB' },
  { from: 'LAV', to: 'CAS10' },  // Tirso → Atocha
  { from: 'EMB', to: 'LAV2' },
  { from: 'EMB', to: 'CAS10' },
  { from: 'EMB', to: 'PTO_TOL' },
  { from: 'PTO_TOL', to: 'CAR02' },
  { from: 'PTO_TOL', to: 'USE02' },

  // ── Bilbao / Sagasta / Hortaleza / Génova ─────────────────────────────
  { from: 'BIL', to: 'FC01' },   // Bilbao → Fuencarral street south
  { from: 'BIL', to: 'MAL' },    // Bilbao → Tribunal
  { from: 'BIL', to: 'SAG01' },  // Bilbao → Sagasta
  { from: 'BIL', to: 'AMA' },    // Bilbao → Alonso Martínez
  { from: 'SAG01', to: 'CAS06' },// Sagasta → Rubén Darío
  { from: 'SAG01', to: 'GEN' },
  { from: 'GEN', to: 'CAS06' },  // Génova → Rubén Darío
  { from: 'GEN', to: 'HOR01' },
  { from: 'HOR01', to: 'CAS07' },// Hortaleza → Colón
  { from: 'HOR01', to: 'SAG01' },
  { from: 'FC01', to: 'GV03' },  // Fuencarral street → Red de San Luis
  { from: 'FC01', to: 'MAL' },   // Fuencarral street → Tribunal

  // ── Alonso Martínez / Malasaña ─────────────────────────────────────────
  { from: 'AMA', to: 'CAS06' },
  { from: 'AMA', to: 'MAL' },
  { from: 'AMA', to: 'ARG' },
  { from: 'AMA', to: 'TET01' },
  { from: 'AMA', to: 'RR' },     // Alonso Martínez → Ríos Rosas
  { from: 'MAL', to: 'GV03' },
  { from: 'MAL', to: 'MAL2' },
  { from: 'MAL2', to: 'NOV' },
  { from: 'NOV', to: 'GV02' },
  { from: 'MAL2', to: 'PRI' },
  { from: 'PRI', to: 'GV01' },

  // ── Princesa / Argüelles / Moncloa ─────────────────────────────────────
  { from: 'ARG', to: 'MAL2' },
  { from: 'ARG', to: 'MON' },
  { from: 'ARG', to: 'AG01' },
  { from: 'AG01', to: 'PRI' },
  { from: 'AG01', to: 'MON' },
  { from: 'MON', to: 'PRI' },
  { from: 'MON', to: 'MON2' },
  { from: 'MON', to: 'CEA01' },
  { from: 'MON2', to: 'CDC02' },

  // ── Cuatro Caminos / Tetuán / Bravo Murillo ────────────────────────────
  { from: 'CC', to: 'AMA' },
  { from: 'CC', to: 'TET01' },
  { from: 'CC', to: 'RR' },
  { from: 'CC', to: 'CAS04' },   // Cuatro Caminos → Nuevos Ministerios
  { from: 'RR', to: 'CAS05' },   // Ríos Rosas → Gregorio Marañón
  { from: 'RR', to: 'SE02' },
  { from: 'TET01', to: 'TET02' },
  { from: 'TET01', to: 'CAS04' },
  { from: 'TET01', to: 'ARG' },
  { from: 'TET02', to: 'BM01' },
  { from: 'TET02', to: 'FUE02' },
  { from: 'BM01', to: 'FUE01' },

  // ── Santa Engracia / Hortaleza N-S ─────────────────────────────────────
  { from: 'SE01', to: 'AMA' },
  { from: 'SE01', to: 'CAS06' },
  { from: 'SE01', to: 'SE02' },
  { from: 'SE02', to: 'CAS04' },
  { from: 'SE02', to: 'TET01' },

  // ── Fuencarral ─────────────────────────────────────────────────────────
  { from: 'FUE01', to: 'FUE02' },
  { from: 'FUE02', to: 'CAS02' },
  { from: 'FUE01', to: 'CAS01' },
  { from: 'FUE01', to: 'M30N' },

  // ── Calle de Alcalá ────────────────────────────────────────────────────
  { from: 'CAS08', to: 'ALC01' },
  { from: 'CAS09', to: 'ALC01' }, // Neptuno → Puerta de Alcalá
  { from: 'ALC01', to: 'ALC02' },
  { from: 'ALC02', to: 'ALC03' },
  { from: 'ALC02', to: 'SAL02' }, // Goya–Serrano

  // ── Salamanca district ─────────────────────────────────────────────────
  // Príncipe de Vergara (N-S)
  { from: 'SAL03', to: 'CAS05' },
  { from: 'SAL03', to: 'SAL01' },
  { from: 'SAL03', to: 'CPE01' },
  // Serrano (N-S)
  { from: 'SAL01', to: 'CAS05' },
  { from: 'SAL01', to: 'SAL02' },
  { from: 'SAL01', to: 'VEL01' },
  { from: 'SAL02', to: 'CAS07' },
  { from: 'SAL02', to: 'ALC01' },
  { from: 'SAL02', to: 'VEL02' },
  // Velázquez (N-S)
  { from: 'VEL01', to: 'DL01' },
  { from: 'VEL01', to: 'SIL01' },
  { from: 'VEL02', to: 'JB01' },
  { from: 'VEL02', to: 'SIL02' },
  { from: 'VEL02', to: 'CPE01' },
  // Diego de León / Juan Bravo (E-W)
  { from: 'DL01', to: 'SAL01' },
  { from: 'DL01', to: 'SIL01' },
  { from: 'JB01', to: 'SAL02' },
  { from: 'JB01', to: 'SIL02' },
  { from: 'JB01', to: 'ALC02' },
  // Francisco Silvela (N-S)
  { from: 'SIL01', to: 'SIL02' },
  { from: 'SIL01', to: 'CLI01' },
  { from: 'SIL02', to: 'ALC03' },
  { from: 'SIL02', to: 'CLI02' },
  // Conde de Peñalver (E-W connector)
  { from: 'CPE01', to: 'ALC02' },
  { from: 'CPE01', to: 'CAS07' },

  // ── Narváez / O'Donnell / Dr. Esquerdo ────────────────────────────────
  { from: 'NAR01', to: 'CAS08' }, // Narváez → Cibeles
  { from: 'NAR01', to: 'ALC01' },
  { from: 'NAR01', to: 'NAR02' },
  { from: 'NAR01', to: 'ODO01' },
  { from: 'NAR02', to: 'RET01' },
  { from: 'ODO01', to: 'ALC02' }, // O'Donnell → Goya
  { from: 'ODO01', to: 'MEN' },
  { from: 'RET01', to: 'ALC01' },
  { from: 'RET01', to: 'PAC' },
  { from: 'RET01', to: 'MEN' },
  { from: 'RET01', to: 'ESQ01' },
  { from: 'ESQ01', to: 'MEN' },
  { from: 'ESQ01', to: 'PAC' },
  { from: 'ESQ01', to: 'ESQ02' },
  { from: 'ESQ02', to: 'DEL01' },
  { from: 'ESQ02', to: 'M30SE' },

  // ── Paseo de las Delicias / Méndez Álvaro ─────────────────────────────
  { from: 'PAC', to: 'CAS10' },
  { from: 'PAC', to: 'DEL01' },
  { from: 'DEL01', to: 'CAS10' },
  { from: 'DEL01', to: 'DEL02' },
  { from: 'DEL02', to: 'LEG' },
  { from: 'DEL02', to: 'M30S' },

  // ── Atocha connectors ──────────────────────────────────────────────────
  { from: 'CAS10', to: 'LEG' },
  { from: 'CAS10', to: 'VAL02' },
  { from: 'CAS07', to: 'SOL' },

  // ── Legazpi / Vallecas / Entrevías ────────────────────────────────────
  { from: 'LEG', to: 'M30S' },
  { from: 'LEG', to: 'VAL02' },
  { from: 'LEG', to: 'USE02' },
  { from: 'VAL02', to: 'VAL01' },
  { from: 'VAL01', to: 'VAL03' },
  { from: 'VAL01', to: 'M30S' },
  { from: 'VAL03', to: 'ENT01' },
  { from: 'ENT01', to: 'M30SE' }, // Entrevías → M-30 southeast

  // ── Usera ──────────────────────────────────────────────────────────────
  { from: 'USE01', to: 'USE02' },
  { from: 'USE02', to: 'M30SW' },
  { from: 'USE02', to: 'PTO_TOL' },
  { from: 'USE01', to: 'CAR03' },

  // ── Carabanchel ────────────────────────────────────────────────────────
  { from: 'CAR01', to: 'CAR02' },
  { from: 'CAR01', to: 'CAR03' },
  { from: 'CAR02', to: 'EMB' },
  { from: 'CAR02', to: 'M30SW' },
  { from: 'CAR03', to: 'M30SW' },
  { from: 'CAR03', to: 'IMP02' },

  // ── M-30 full ring ────────────────────────────────────────────────────
  { from: 'M30N',  to: 'M30NE' },
  { from: 'M30NE', to: 'M30E' },
  { from: 'M30E',  to: 'M30SE' },
  { from: 'M30SE', to: 'M30S' },
  { from: 'M30S',  to: 'M30SW' },
  { from: 'M30SW', to: 'M30W' },
  { from: 'M30W',  to: 'M30NW' },
  { from: 'M30NW', to: 'M30N' },
  // M-30 ↔ inner city spurs
  { from: 'M30N',  to: 'CAS01' },
  { from: 'M30N',  to: 'FUE01' },
  { from: 'M30NE', to: 'CLI01' },
  { from: 'M30SE', to: 'MEN' },
  { from: 'M30SE', to: 'ESQ02' },
  { from: 'M30SW', to: 'CAR02' },
  { from: 'M30SW', to: 'USE02' },
  { from: 'M30W',  to: 'CDC01' },
  { from: 'M30NW', to: 'CEA01' },
  { from: 'M30NW', to: 'MON2' },

  // ── Casa de Campo ─────────────────────────────────────────────────────
  { from: 'CDC01', to: 'CDC02' },
  { from: 'CDC02', to: 'GV01' },
  { from: 'CDC02', to: 'PRI' },
  { from: 'CDC02', to: 'MON' },
  { from: 'CDC02', to: 'SEG01' },

  // ── CEA01 / Pozuelo area ──────────────────────────────────────────────
  { from: 'CEA01', to: 'MON' },
  { from: 'CEA01', to: 'TET01' },

  // ── Ciudad Lineal / Arturo Soria ──────────────────────────────────────
  { from: 'CLI01', to: 'CLI02' },
  { from: 'CLI01', to: 'M30NE' },
  { from: 'CLI01', to: 'AS02' },
  { from: 'CLI02', to: 'ALC03' },
  { from: 'M30E',  to: 'CLI02' },
  { from: 'AS01',  to: 'AS02' },
  { from: 'AS01',  to: 'M30N' },
  { from: 'AS02',  to: 'M30NE' },
  { from: 'AS02',  to: 'SIL01' },

  // ── Moratalaz ─────────────────────────────────────────────────────────
  { from: 'MOR01', to: 'ALC03' },
  { from: 'MOR01', to: 'M30SE' },
  { from: 'MOR01', to: 'M30E' },
];

// ============================================================
// Graph densification — insert intermediate nodes every ~200 m
// ============================================================

const DENSIFY_MAX_KM = 0.20; // max 200 m between adjacent nodes
const DENSIFY_MAX_DEG = DENSIFY_MAX_KM / KM_PER_DEG; // ≈ 0.00235 degrees

function densifyGraph(
  nodes: RoadNode[],
  edges: RoadEdge[],
): { nodes: RoadNode[]; edges: RoadEdge[] } {
  const nodeMap = new Map<string, RoadNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const denseNodes: RoadNode[] = [...nodes];
  const denseEdges: RoadEdge[] = [];

  for (const edge of edges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) { denseEdges.push(edge); continue; }

    const dlat = to.lat - from.lat;
    const dlng = to.lng - from.lng;
    const dist = Math.sqrt(dlat * dlat + dlng * dlng);

    if (dist <= DENSIFY_MAX_DEG) {
      // Edge is already short enough — keep as-is
      denseEdges.push(edge);
      continue;
    }

    // Split into segments of ≤ DENSIFY_MAX_DEG
    const segments = Math.ceil(dist / DENSIFY_MAX_DEG);
    let prevId = edge.from;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const id = `${edge.from}_${edge.to}_${i}`;
      denseNodes.push({
        id,
        lat: +(from.lat + dlat * t).toFixed(6),
        lng: +(from.lng + dlng * t).toFixed(6),
      });
      denseEdges.push({ from: prevId, to: id });
      prevId = id;
    }
    denseEdges.push({ from: prevId, to: edge.to });
  }

  return { nodes: denseNodes, edges: denseEdges };
}

const { nodes: DENSE_NODES, edges: DENSE_EDGES } = densifyGraph(ROAD_NODES, ROAD_EDGES);

// Pre-computed lookups (built at module load from densified graph)
const NODE_BY_ID = new Map<string, RoadNode>();
for (const n of DENSE_NODES) NODE_BY_ID.set(n.id, n);

const ADJACENCY = new Map<string, Set<string>>();
for (const n of DENSE_NODES) ADJACENCY.set(n.id, new Set());
for (const e of DENSE_EDGES) {
  ADJACENCY.get(e.from)!.add(e.to);
  ADJACENCY.get(e.to)!.add(e.from); // bidirectional
}

function findNearestNode(lat: number, lng: number): RoadNode {
  let best = DENSE_NODES[0];
  let bestDist = Infinity;
  for (const n of DENSE_NODES) {
    const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

/** Euclidean distance between two graph nodes (degree-space, fine for relative comparison) */
function nodeDistance(aId: string, bId: string): number {
  const a = NODE_BY_ID.get(aId)!;
  const b = NODE_BY_ID.get(bId)!;
  if (!a || !b) return Infinity;
  return Math.sqrt((b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2);
}

/**
 * Weighted A* on the road graph.
 * Returns node IDs from start (exclusive) to end (inclusive).
 * Correctly uses a closed set so each node is settled at most once.
 */
function astarPath(startId: string, endId: string): string[] {
  if (startId === endId) return [];

  // [fScore, nodeId]
  const open: Array<[number, string]> = [[0, startId]];
  const gScore = new Map<string, number>([[startId, 0]]);
  const parent = new Map<string, string>();
  const closed = new Set<string>();

  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0]);
    const [, cur] = open.shift()!;

    if (closed.has(cur)) continue;
    closed.add(cur);

    if (cur === endId) {
      // Reconstruct path — guard against missing parent entries
      const path: string[] = [];
      let node: string | undefined = endId;
      let safety = 0;
      while (node && node !== startId && safety++ < 500) {
        path.push(node);
        node = parent.get(node);
      }
      return path.reverse();
    }

    const curG = gScore.get(cur) ?? Infinity;
    for (const neighbor of ADJACENCY.get(cur) ?? []) {
      if (closed.has(neighbor)) continue;
      const tentativeG = curG + nodeDistance(cur, neighbor);
      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        gScore.set(neighbor, tentativeG);
        parent.set(neighbor, cur);
        const h = nodeDistance(neighbor, endId);
        open.push([tentativeG + h, neighbor]);
      }
    }
  }
  return [];
}

/**
 * Dijkstra shortest-path distance between two graph nodes.
 * Used for vehicle ranking — doesn't need the path itself, only the cost.
 */
function graphPathDistance(startId: string, endId: string): number {
  if (startId === endId) return 0;

  const dist = new Map<string, number>([[startId, 0]]);
  const open: Array<[number, string]> = [[0, startId]];
  const closed = new Set<string>();

  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0]);
    const [d, cur] = open.shift()!;
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (cur === endId) return d;
    for (const neighbor of ADJACENCY.get(cur) ?? []) {
      if (closed.has(neighbor)) continue;
      const nd = d + nodeDistance(cur, neighbor);
      if (nd < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, nd);
        open.push([nd, neighbor]);
      }
    }
  }
  return Infinity;
}

function pickRandomNeighbor(nodeId: string): string | null {
  const neighbors = ADJACENCY.get(nodeId);
  if (!neighbors || neighbors.size === 0) return null;
  const arr = [...neighbors];
  return arr[Math.floor(Math.random() * arr.length)];
}

function edgeLength(fromId: string, toId: string): number {
  const a = NODE_BY_ID.get(fromId)!;
  const b = NODE_BY_ID.get(toId)!;
  return Math.sqrt((b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2);
}

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

  const rawLat = v.current_latitude ?? MADRID_CENTER.lat + jitter(0.03);
  const rawLng = v.current_longitude ?? MADRID_CENTER.lng + jitter(0.03);
  const nearestNode = findNearestNode(rawLat, rawLng);

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
    latitude: nearestNode.lat,
    longitude: nearestNode.lng,
    heading: rand(0, 360),
    isMoving,
    ticksSinceLastEvent: 0,
    assignedIncidentId: null,
    targetLat: null,
    targetLng: null,
    ticksAtScene: 0,
    resolveAfterTicks: 0,
    currentNodeId: nearestNode.id,
    nextNodeId: null,
    edgeProgress: 0,
    routePath: [],
  };
}

// ============================================================
// Subsystem 1: Telemetry & Movement Simulation
// ============================================================

function simulateTick(state: VehicleState): void {
  const profile = SPEED_PROFILES[state.vehicle.type];
  state.ticksSinceLastEvent++;

  if (state.vehicle.status === 'maintenance' || state.vehicle.status === 'offline') {
    state.isMoving = false;
    state.speed = 0;
    state.rpm = 0;
    state.engineTemp = clamp(state.engineTemp + jitter(0.3), 20, 45);
    state.batteryVoltage = clamp(state.batteryVoltage + jitter(0.02), 11.0, 12.8);
    state.oilPressure = clamp(state.oilPressure + jitter(0.5), 0, 10);
    return;
  }

  if (state.vehicle.status === 'at_scene') {
    state.isMoving = false;
    state.speed = 0;
    state.rpm = rand(700, 900);
    state.engineTemp = clamp(state.engineTemp - rand(0.1, 0.5) + jitter(0.3), 60, 95);
    state.batteryVoltage = clamp(13.5 + jitter(0.2), 13.0, 14.0);
    state.oilPressure = clamp(15 + jitter(2), 10, 25);
    state.ticksAtScene++;
    return;
  }

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
      // Gradual refueling (station pump ~0.5% per tick)
      if (state.fuelLevel < 90) {
        state.fuelLevel = clamp(state.fuelLevel + rand(0.3, 0.7), 0, 95);
      }
      // Tire inflation toward normal 32-35 psi
      if (state.tirePressure < 32) {
        state.tirePressure = clamp(state.tirePressure + rand(0.1, 0.3), 20, 36);
      }
      // Battery charging (plugged in at station)
      if (state.batteryVoltage < 12.6) {
        state.batteryVoltage = clamp(state.batteryVoltage + rand(0.01, 0.03), 10.5, 12.8);
      }
    }
  }

  if (state.vehicle.status === 'en_route' || state.vehicle.status === 'in_service') {
    state.isMoving = true;
  }

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
    if (state.vehicle.status === 'en_route' && Math.random() < 0.06) {
      state.speed = clamp(state.speed + rand(15, 30), 0, profile.maxSpeed * 1.4);
    } else if (Math.random() < 0.03) {
      state.speed = clamp(state.speed + rand(15, 30), 0, profile.maxSpeed);
    }
  } else {
    state.speed = 0;
  }

  if (state.isMoving) {
    const targetTemp = 85 + (state.speed / profile.maxSpeed) * 15;
    state.engineTemp = clamp(
      state.engineTemp + (targetTemp - state.engineTemp) * 0.1 + jitter(1.5),
      70, 120
    );
    const spikeChance = state.vehicle.status === 'en_route' ? 0.04 : 0.015;
    if (Math.random() < spikeChance) {
      state.engineTemp = clamp(state.engineTemp + rand(5, 12), 70, 120);
    }
  } else {
    state.engineTemp = clamp(state.engineTemp - rand(0.2, 1.0) + jitter(0.3), 20, 65);
  }

  if (state.isMoving) {
    const baseRpm = 800 + (state.speed / profile.maxSpeed) * 5000;
    state.rpm = clamp(baseRpm + jitter(300), 700, 6800);
  } else {
    state.rpm = state.speed > 0 ? rand(700, 900) : 0;
  }

  if (state.isMoving) {
    const consumptionRate = 0.05 + (state.speed / profile.maxSpeed) * 0.12;
    state.fuelLevel = clamp(state.fuelLevel - consumptionRate + jitter(0.005), 0, 100);
  } else {
    state.fuelLevel = clamp(state.fuelLevel - 0.005, 0, 100);
  }

  if (state.isMoving) {
    state.tirePressure -= 0.01;
  }
  state.tirePressure = clamp(state.tirePressure + jitter(0.1), 20, 40);
  if (Math.random() < 0.005) {
    state.tirePressure = clamp(state.tirePressure - rand(1.0, 3.0), 20, 40);
  }

  if (state.isMoving) {
    state.batteryVoltage = clamp(13.8 + jitter(0.3), 13.0, 14.8);
  } else {
    state.batteryVoltage = clamp(state.batteryVoltage - 0.008 + jitter(0.02), 10.5, 12.8);
  }

  if (state.isMoving) {
    state.oilPressure = clamp(40 + (state.rpm / 6000) * 20 + jitter(3), 25, 65);
  } else {
    state.oilPressure = clamp(state.oilPressure + jitter(0.5), 0, 15);
  }

  if (state.isMoving) {
    const kmPerTick = (state.speed / 3600) * (TICK_INTERVAL_MS / 1000);
    state.odometer += kmPerTick;
  }

  if (state.isMoving && state.speed > 0) {
    // Distance covered this tick in degree-space (used for edge progress).
    // speed is km/h → km per tick → degrees (using KM_PER_DEG at Madrid lat).
    const kmPerTick = state.speed * (TICK_INTERVAL_MS / 1000) / 3600;
    const degPerTick = kmPerTick / KM_PER_DEG;

    // Pick next road segment if at a node (no current edge to follow)
    if (state.nextNodeId === null) {
      if (state.routePath.length > 0) {
        // Follow the pre-computed A* route path
        state.nextNodeId = state.routePath.shift()!;
        state.edgeProgress = 0;
      } else if (state.targetLat !== null && state.targetLng !== null) {
        // Route was not pre-computed — compute it now (fallback)
        const destNode = findNearestNode(state.targetLat, state.targetLng);
        if (destNode.id !== state.currentNodeId) {
          state.routePath = astarPath(state.currentNodeId, destNode.id);
          if (state.routePath.length > 0) {
            state.nextNodeId = state.routePath.shift()!;
            state.edgeProgress = 0;
          }
        }
        // else: already at dest node — arrival check will handle it
      } else {
        // No destination — random graph walk (patrol / available vehicles)
        const neighbor = pickRandomNeighbor(state.currentNodeId);
        if (neighbor) {
          state.nextNodeId = neighbor;
          state.edgeProgress = 0;
        }
      }
    }

    // Advance along current edge using actual km/h speed
    if (state.nextNodeId !== null) {
      const fromNode = NODE_BY_ID.get(state.currentNodeId)!;
      const toNode = NODE_BY_ID.get(state.nextNodeId)!;
      const len = edgeLength(state.currentNodeId, state.nextNodeId); // degrees
      // Progress fraction covered this tick based on real speed
      const progressIncrement = len > 0 ? degPerTick / len : 1;
      state.edgeProgress = Math.min(state.edgeProgress + progressIncrement, 1.0);

      if (state.edgeProgress >= 1.0) {
        // Arrived at the next graph node — snap to exact node coordinates
        state.currentNodeId = state.nextNodeId;
        state.nextNodeId = null;
        state.edgeProgress = 0;
        const arrivedNode = NODE_BY_ID.get(state.currentNodeId)!;
        state.latitude = arrivedNode.lat;
        state.longitude = arrivedNode.lng;
      } else {
        // Interpolate position along the edge
        state.latitude = fromNode.lat + (toNode.lat - fromNode.lat) * state.edgeProgress;
        state.longitude = fromNode.lng + (toNode.lng - fromNode.lng) * state.edgeProgress;
      }

      // Heading always follows the current road segment direction
      state.heading = bearingTo(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
    }
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

function maybeCreateIncident(
  tickCount: number,
  nextIncidentTick: number,
  activeIncidents: ActiveIncident[]
): { incident: ActiveIncident; dbRow: Record<string, unknown>; nextTick: number } | null {
  if (tickCount < nextIncidentTick) return null;
  // Traffic obstacles don't count towards the incident cap
  if (activeIncidents.filter((i) => !isTrafficObstacle(i)).length >= MAX_ACTIVE_INCIDENTS) return null;

  const incidentType = pickRandom<EmergencyIncidentType>(['fire', 'medical', 'crime', 'accident', 'natural_disaster']);
  const template = INCIDENT_TEMPLATES[incidentType];
  const title = pickRandom(template.titles);
  const description = pickRandom(template.descriptions);
  const location = pickRandom(MADRID_INCIDENT_LOCATIONS);
  const severity = pickRandom<Severity>(['warning', 'critical', 'critical']);
  const lat = location.lat + jitter(0.003);
  const lng = location.lng + jitter(0.003);

  const newNextTick = tickCount + randInt(INCIDENT_CREATE_MIN_TICKS, INCIDENT_CREATE_MAX_TICKS);

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

  return { incident, dbRow, nextTick: newNextTick };
}

function findBestVehicleForIncident(
  incident: ActiveIncident,
  states: VehicleState[]
): VehicleState | null {
  const preferredTypes = INCIDENT_VEHICLE_AFFINITY[incident.incident_type as EmergencyIncidentType];
  if (!preferredTypes) return null;
  const destNodeId = findNearestNode(incident.latitude, incident.longitude).id;

  // Rank by A* road-graph distance — not straight-line — so road topology matters
  const rankByGraphDist = (pool: VehicleState[]) =>
    pool
      .map((s) => ({ s, dist: graphPathDistance(s.currentNodeId, destNodeId) }))
      .sort((a, b) => a.dist - b.dist)
      .map(({ s }) => s);

  const preferred = rankByGraphDist(
    states.filter(
      (s) =>
        s.vehicle.status === 'available' &&
        s.assignedIncidentId === null &&
        preferredTypes.includes(s.vehicle.type)
    )
  );
  if (preferred.length > 0) return preferred[0];

  const fallback = rankByGraphDist(
    states.filter((s) => s.vehicle.status === 'available' && s.assignedIncidentId === null)
  );
  return fallback.length > 0 ? fallback[0] : null;
}

async function processIncidentLifecycle(
  supabase: SupabaseClient,
  tickCount: number,
  nextIncidentTick: number,
  activeIncidents: ActiveIncident[],
  states: VehicleState[]
): Promise<{ events: EventRow[]; logs: string[]; nextIncidentTick: number }> {
  const events: EventRow[] = [];
  const logs: string[] = [];
  const now = new Date().toISOString();
  let updatedNextIncidentTick = nextIncidentTick;

  const newIncident = maybeCreateIncident(tickCount, nextIncidentTick, activeIncidents);
  if (newIncident) {
    const { error } = await supabase.from('incidents').insert(newIncident.dbRow);
    if (!error) {
      activeIncidents.push(newIncident.incident);
      updatedNextIncidentTick = newIncident.nextTick;
      logs.push(`  [INCIDENT] NEW: ${newIncident.dbRow.title} (${newIncident.incident.incident_type})`);
    }
  }

  const resolvedIds: string[] = [];

  for (const incident of activeIncidents) {
    incident.ticksSinceCreation++;

    // Traffic obstacles are passive — no dispatch or resolution lifecycle
    if (isTrafficObstacle(incident)) continue;

    // Phase 1: Dispatch
    if (incident.status === 'reported' && incident.ticksSinceCreation >= INCIDENT_DISPATCH_DELAY_TICKS) {
      const vehicle = findBestVehicleForIncident(incident, states);
      if (vehicle) {
        vehicle.vehicle.status = 'en_route';
        vehicle.isMoving = true;
        vehicle.assignedIncidentId = incident.id;
        vehicle.targetLat = incident.latitude;
        vehicle.targetLng = incident.longitude;
        // Give the vehicle an initial speed so it starts moving on the very next tick
        const dispatchProfile = SPEED_PROFILES[vehicle.vehicle.type];
        vehicle.speed = rand(dispatchProfile.cruiseMin, dispatchProfile.cruiseMax);

        // Compute road route to incident using A* (weighted shortest path)
        const destNode = findNearestNode(incident.latitude, incident.longitude);
        vehicle.routePath = astarPath(vehicle.currentNodeId, destNode.id);
        if (vehicle.nextNodeId === null && vehicle.routePath.length > 0) {
          vehicle.nextNodeId = vehicle.routePath.shift()!;
          vehicle.edgeProgress = 0;
        }
        logs.push(`  [ROUTE] ${vehicle.vehicle.name}: A* path with ${vehicle.routePath.length + (vehicle.nextNodeId ? 1 : 0)} nodes`);

        incident.status = 'dispatched';
        incident.assignedVehicleIds.push(vehicle.vehicle.id);
        incident.dispatchedAt = tickCount;

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

        logs.push(`  [INCIDENT] DISPATCHED: ${vehicle.vehicle.name} -> ${incident.incident_type}`);
      }
    }

    // Phase 2: Arrival check
    if (incident.status === 'dispatched') {
      for (const vehicleId of incident.assignedVehicleIds) {
        const vehicleState = states.find((s) => s.vehicle.id === vehicleId);
        if (!vehicleState || vehicleState.vehicle.status !== 'en_route') continue;

        const dist = distanceDeg(
          vehicleState.latitude, vehicleState.longitude,
          incident.latitude, incident.longitude
        );

        const routeComplete = vehicleState.routePath.length === 0 && vehicleState.nextNodeId === null;
        if (dist < ARRIVAL_DISTANCE_THRESHOLD || routeComplete) {
          vehicleState.vehicle.status = 'at_scene';
          vehicleState.isMoving = false;
          vehicleState.speed = 0;
          vehicleState.targetLat = null;
          vehicleState.targetLng = null;
          vehicleState.routePath = [];
          vehicleState.nextNodeId = null;
          vehicleState.edgeProgress = 0;
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

          logs.push(`  [INCIDENT] ARRIVED: ${vehicleState.vehicle.name} (${round(responseTimeSec / 60, 1)} min)`);
        }
      }
    }

    // Phase 3: Resolution
    if (incident.status === 'in_progress') {
      let allResolved = true;

      for (const vehicleId of incident.assignedVehicleIds) {
        const vehicleState = states.find((s) => s.vehicle.id === vehicleId);
        if (!vehicleState) continue;

        if (vehicleState.vehicle.status === 'at_scene' && vehicleState.ticksAtScene >= vehicleState.resolveAfterTicks) {
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

          logs.push(`  [INCIDENT] COMPLETED: ${vehicleState.vehicle.name} returning to base`);
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

        logs.push(`  [INCIDENT] RESOLVED: ${incident.incident_type} (${incident.id.slice(0, 8)})`);
      }
    }
  }

  for (const id of resolvedIds) {
    const idx = activeIncidents.findIndex((i) => i.id === id);
    if (idx !== -1) activeIncidents.splice(idx, 1);
  }

  return { events, logs, nextIncidentTick: updatedNextIncidentTick };
}

// ============================================================
// Subsystem 3: Anomaly Detection
// ============================================================

function doesRuleMatch(
  value: number,
  rule: DetectionRule
): { matches: boolean; expectedRange: { min?: number; max?: number } } {
  const hasMin = rule.min_value !== null && rule.min_value !== undefined;
  const hasMax = rule.max_value !== null && rule.max_value !== undefined;

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

  if (hasMax && !hasMin) {
    return { matches: value > rule.max_value!, expectedRange: { max: rule.max_value! } };
  }

  if (hasMin && !hasMax) {
    return { matches: value < rule.min_value!, expectedRange: { min: rule.min_value! } };
  }

  return { matches: false, expectedRange: {} };
}

function checkReadingsForAnomalies(
  readings: TelemetryRow[],
  rules: DetectionRule[],
  vehicleType: VehicleType,
  anomalyThrottleMap: Map<string, number>
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
        const throttleKey = `${reading.vehicle_id}:${reading.metric_type}`;
        const lastAnomalyTime = anomalyThrottleMap.get(throttleKey) || 0;
        if (now - lastAnomalyTime < ANOMALY_THROTTLE_SECONDS * 1000) continue;

        anomalyThrottleMap.set(throttleKey, now);

        const unit = METRIC_UNITS[reading.metric_type] || '';
        anomalies.push({
          vehicle_id: reading.vehicle_id,
          telemetry_reading_id: null,
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
  rules: DetectionRule[],
  anomalyThrottleMap: Map<string, number>
): Promise<{ anomalyCount: number; logs: string[] }> {
  const logs: string[] = [];
  let anomalyCount = 0;

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

    let anomalies = checkReadingsForAnomalies(vehicleTelemetry, rules, state.vehicle.type, anomalyThrottleMap);
    // Skip creating anomalies for metrics that already have an active anomaly
    anomalies = anomalies.filter((a) => !activeMetrics.has(a.metric_type));

    // Track metrics that triggered new anomalies this tick — skip auto-resolve for those
    const newAnomalyMetrics = new Set<string>();
    if (anomalies.length > 0) {
      const { error } = await supabase.from('anomalies').insert(anomalies);
      if (error) {
        logs.push(`  [ANOMALY ERROR] ${state.vehicle.plate_number}: ${error.message}`);
      } else {
        anomalyCount += anomalies.length;
        for (const anomaly of anomalies) {
          newAnomalyMetrics.add(anomaly.metric_type);
          logs.push(`  [ANOMALY] ${state.vehicle.plate_number} — ${anomaly.description}`);
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
          logs.push(`  [AUTO-RESOLVE] ${state.vehicle.plate_number} — ${anomaly.metric_type} back to normal (${currentValue})`);
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

function isDuplicateInsight(key: string, recentInsights: Map<string, number>): boolean {
  const lastTime = recentInsights.get(key);
  if (!lastTime) return false;
  return Date.now() - lastTime < 5 * 60 * 1000;
}

function recordInsight(key: string, recentInsights: Map<string, number>): void {
  recentInsights.set(key, Date.now());
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of recentInsights) {
    if (v < cutoff) recentInsights.delete(k);
  }
}

async function generateInsights(
  supabase: SupabaseClient,
  states: VehicleState[],
  activeIncidents: ActiveIncident[],
  _tickCount: number,
  recentInsights: Map<string, number>
): Promise<{ insightCount: number; logs: string[] }> {
  const insights: InsightInsert[] = [];
  const logs: string[] = [];
  const now = new Date().toISOString();

  // Insight 1: Low fuel alerts
  for (const state of states) {
    if (state.fuelLevel < 20 && state.vehicle.status !== 'maintenance' && state.vehicle.status !== 'offline') {
      const key = `fuel:${state.vehicle.id}`;
      if (isDuplicateInsight(key, recentInsights)) continue;

      const severity: Severity = state.fuelLevel < 10 ? 'critical' : 'warning';
      insights.push({
        insight_type: 'fuel_efficiency',
        title: `Low Fuel Alert — ${state.vehicle.name}`,
        description: `${state.vehicle.name} (${state.vehicle.plate_number}) has fuel at ${round(state.fuelLevel, 1)}%. ` +
          (state.fuelLevel < 10
            ? 'Immediate refueling required to maintain operational readiness.'
            : 'Schedule refueling soon to avoid compromising response capability.'),
        severity,
        vehicle_id: state.vehicle.id,
        metadata: {
          fuel_level_percent: round(state.fuelLevel, 1),
          vehicle_status: state.vehicle.status,
          vehicle_type: state.vehicle.type,
          recommendation: state.fuelLevel < 10 ? 'refuel_immediately' : 'schedule_refuel',
          estimated_range_km: round(state.fuelLevel * 3.5, 0),
        },
      });
      recordInsight(key, recentInsights);
    }
  }

  // Insight 2: Anomaly spike detection
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  for (const state of states) {
    const key = `anomaly_spike:${state.vehicle.id}`;
    if (isDuplicateInsight(key, recentInsights)) continue;

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
    recordInsight(key, recentInsights);
  }

  // Insight 3: Response time trend analysis
  {
    const key = 'response_time_trend:global';
    if (!isDuplicateInsight(key, recentInsights)) {
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
                ? 'Response times are critically above target. Consider repositioning available units.'
                : avgResponse > 5
                  ? 'Response times trending above target. Review vehicle positioning strategy.'
                  : 'Response times are within acceptable range.'),
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
          recordInsight(key, recentInsights);
        }
      }
    }
  }

  // Insight 4: Fleet utilization alert
  {
    const key = 'utilization:global';
    if (!isDuplicateInsight(key, recentInsights)) {
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

        const realIncidentCount = activeIncidents.filter((i) => !isTrafficObstacle(i)).length;
        insights.push({
          insight_type: 'utilization_alert',
          title: 'High Fleet Utilization Warning',
          description: `Fleet utilization at ${utilizationPct}% — ${busyVehicles} of ${totalVehicles} operational vehicles deployed. ` +
            `Active incidents: ${realIncidentCount}. ` +
            (utilizationPct > 80
              ? 'Critical capacity threshold reached. Recommend activating reserve units.'
              : 'Utilization is elevated. Monitor for new incidents.') +
            ` Available by type: ${Object.entries(availableByType).map(([t, c]) => `${t}: ${c}`).join(', ') || 'none'}.`,
          severity: utilizationPct > 80 ? 'critical' : 'warning',
          vehicle_id: null,
          metadata: {
            utilization_percent: utilizationPct,
            busy_vehicles: busyVehicles,
            total_operational: totalVehicles,
            active_incidents: realIncidentCount,
            available_by_type: availableByType,
            recommendation: utilizationPct > 80 ? 'activate_reserves' : 'monitor_capacity',
          },
        });
        recordInsight(key, recentInsights);
      }
    }
  }

  // Insight 5: Maintenance due (high-mileage vehicles)
  for (const state of states) {
    if (state.odometer > 50000) {
      const key = `maintenance:${state.vehicle.id}`;
      if (isDuplicateInsight(key, recentInsights)) continue;

      insights.push({
        insight_type: 'maintenance_due',
        title: `Maintenance Due — ${state.vehicle.name}`,
        description: `${state.vehicle.name} (${state.vehicle.plate_number}) has reached ${round(state.odometer, 0)} km. ` +
          'Scheduled maintenance interval exceeded. Recommend scheduling preventive maintenance.',
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
      recordInsight(key, recentInsights);
    }
  }

  // Insight 6: Engine overheating trend
  for (const state of states) {
    if (state.engineTemp > 100 && state.isMoving) {
      const key = `overheat:${state.vehicle.id}`;
      if (isDuplicateInsight(key, recentInsights)) continue;

      insights.push({
        insight_type: 'maintenance_due',
        title: `Engine Overheating Risk — ${state.vehicle.name}`,
        description: `${state.vehicle.name} engine temperature at ${round(state.engineTemp, 1)}°C, exceeding safe operating range. ` +
          (state.engineTemp > 108
            ? 'Critical temperature. Recommend immediately reducing vehicle load or stopping.'
            : 'Temperature is elevated. Monitor closely and consider reducing speed.'),
        severity: state.engineTemp > 108 ? 'critical' : 'warning',
        vehicle_id: state.vehicle.id,
        metadata: {
          engine_temp_celsius: round(state.engineTemp, 1),
          vehicle_status: state.vehicle.status,
          recommendation: state.engineTemp > 108 ? 'stop_engine_immediately' : 'reduce_speed_monitor',
        },
      });
      recordInsight(key, recentInsights);
    }
  }

  // Insight 7: Incident clustering pattern
  const realIncidentsForCluster = activeIncidents.filter((i) => !isTrafficObstacle(i));
  if (realIncidentsForCluster.length >= 3) {
    const key = 'incident_cluster:global';
    if (!isDuplicateInsight(key, recentInsights)) {
      const centroidLat = realIncidentsForCluster.reduce((s, i) => s + i.latitude, 0) / realIncidentsForCluster.length;
      const centroidLng = realIncidentsForCluster.reduce((s, i) => s + i.longitude, 0) / realIncidentsForCluster.length;
      const avgDist = realIncidentsForCluster.reduce(
        (s, i) => s + distanceDeg(i.latitude, i.longitude, centroidLat, centroidLng), 0
      ) / realIncidentsForCluster.length;

      if (avgDist < 0.02) {
        const types = [...new Set(realIncidentsForCluster.map((i) => i.incident_type))];
        insights.push({
          insight_type: 'response_time_trend',
          title: 'Incident Clustering Detected',
          description: `${realIncidentsForCluster.length} active incidents detected in a concentrated area (avg ${round(avgDist * 111, 1)} km spread). ` +
            `Incident types: ${types.join(', ')}. ` +
            'Recommend deploying additional units to the area.',
          severity: 'warning',
          vehicle_id: null,
          metadata: {
            incident_count: realIncidentsForCluster.length,
            centroid_lat: round(centroidLat, 6),
            centroid_lng: round(centroidLng, 6),
            avg_spread_km: round(avgDist * 111, 1),
            incident_types: types,
            recommendation: 'deploy_forward_command',
          },
        });
        recordInsight(key, recentInsights);
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
        logs.push(`  [INSIGHT] ${insight.title}`);
      }
    }
  }

  return { insightCount: insights.length, logs };
}

// ============================================================
// WorldSimulation — Singleton class
// ============================================================

// Persist singleton on globalThis so it survives Next.js HMR in development.
// The version string is bumped whenever new public methods are added so that
// a stale cached instance (missing those methods) is discarded automatically.
const SIM_VERSION = '3';
const globalForSim = globalThis as unknown as {
  __worldSimulation?: WorldSimulation;
  __worldSimulationVersion?: string;
};

export class WorldSimulation {
  private interval: ReturnType<typeof setInterval> | null = null;
  private supabase: SupabaseClient | null = null;
  private states: VehicleState[] = [];
  private activeIncidents: ActiveIncident[] = [];
  private rules: DetectionRule[] = [];
  private tickCount = 0;
  private nextIncidentTick = 0;
  private anomalyThrottleMap = new Map<string, number>();
  private recentInsights = new Map<string, number>();
  private stats = { telemetry: 0, events: 0, anomalies: 0, insights: 0 };
  private tickInProgress = false;

  private constructor() {}

  static getInstance(): WorldSimulation {
    // Discard a cached instance that predates the current class version
    // (this happens after Next.js HMR re-evaluates this module).
    if (
      globalForSim.__worldSimulation &&
      globalForSim.__worldSimulationVersion !== SIM_VERSION
    ) {
      console.warn('[WorldSimulation] Stale singleton detected — discarding cached instance.');
      delete globalForSim.__worldSimulation;
    }
    if (!globalForSim.__worldSimulation) {
      globalForSim.__worldSimulation = new WorldSimulation();
      globalForSim.__worldSimulationVersion = SIM_VERSION;
    }
    return globalForSim.__worldSimulation;
  }

  isRunning(): boolean {
    return this.interval !== null;
  }

  /**
   * Returns the full remaining route of a vehicle as lat/lng coordinates.
   * Includes: current position → all remaining nodes → target location.
   * Returns an empty array if the vehicle has no active route.
   */
  getVehicleRoutePath(vehicleId: string): Array<{ lat: number; lng: number }> {
    const state = this.states.find((s) => s.vehicle.id === vehicleId);
    if (!state || state.vehicle.status !== 'en_route') return [];

    const coords: Array<{ lat: number; lng: number }> = [];

    // Start from actual current position
    coords.push({ lat: state.latitude, lng: state.longitude });

    // Next node being approached (partially traversed edge)
    if (state.nextNodeId) {
      const n = NODE_BY_ID.get(state.nextNodeId);
      if (n) coords.push({ lat: n.lat, lng: n.lng });
    }

    // Remaining queued nodes
    for (const nodeId of state.routePath) {
      const n = NODE_BY_ID.get(nodeId);
      if (n) coords.push({ lat: n.lat, lng: n.lng });
    }

    // Exact target location
    if (state.targetLat !== null && state.targetLng !== null) {
      coords.push({ lat: state.targetLat, lng: state.targetLng });
    }

    return coords;
  }

  /**
   * Spawns a new "road obstacle" incident on a vehicle's route.
   *
   * If `routeCoords` (the displayed TomTom/OSRM route) is provided the
   * obstacle is placed 30-60% ahead along that polyline so it actually
   * sits on the visible route line.
   *
   * Falls back to the internal A* graph path when no coords are given.
   */
  async spawnObstacleOnRoute(
    vehicleId: string,
    routeCoords?: { lat: number; lng: number }[],
  ): Promise<{
    id: string;
    latitude: number;
    longitude: number;
    title: string;
  } | null> {
    if (!this.supabase) return null;

    const state = this.states.find((s) => s.vehicle.id === vehicleId);
    if (!state || state.vehicle.status !== 'en_route') return null;

    let lat: number;
    let lng: number;

    if (routeCoords && routeCoords.length >= 4) {
      // Pick a point 30-60 % along the displayed route polyline
      const idx = Math.floor(routeCoords.length * (0.3 + Math.random() * 0.3));
      const pt = routeCoords[Math.min(idx, routeCoords.length - 1)];
      lat = round(pt.lat + jitter(0.0003), 6);
      lng = round(pt.lng + jitter(0.0003), 6);
    } else {
      // Fallback: pick from internal A* graph path
      const remainingNodes: string[] = [];
      if (state.nextNodeId) remainingNodes.push(state.nextNodeId);
      remainingNodes.push(...state.routePath);
      if (remainingNodes.length < 3) return null;

      const idx = Math.floor(remainingNodes.length * (0.3 + Math.random() * 0.2));
      const nodeId = remainingNodes[idx];
      const node = NODE_BY_ID.get(nodeId);
      if (!node) return null;
      lat = round(node.lat + jitter(0.0005), 6);
      lng = round(node.lng + jitter(0.0005), 6);
    }

    const id = crypto.randomUUID();
    const title = pickRandom(ROAD_OBSTACLE_TEMPLATES.titles);
    const description = pickRandom(ROAD_OBSTACLE_TEMPLATES.descriptions);
    const now = new Date().toISOString();

    const dbRow = {
      id,
      title,
      description,
      incident_type: 'road_closure' as TrafficObstacleType,
      severity: 'warning' as const,
      latitude: lat,
      longitude: lng,
      status: 'reported' as const,
      assigned_vehicle_ids: [] as string[],
      reported_at: now,
    };

    const { error } = await this.supabase.from('incidents').insert(dbRow);
    if (error) {
      console.error('[WorldSimulation] Failed to spawn route obstacle:', error.message);
      return null;
    }

    // Track in memory — will be managed by the normal incident lifecycle
    this.activeIncidents.push({
      id,
      incident_type: 'road_closure',
      latitude: lat,
      longitude: lng,
      status: 'reported',
      ticksSinceCreation: 0,
      assignedVehicleIds: [],
      dispatchedAt: null,
    });

    console.log(`[WorldSimulation] Route obstacle spawned: ${title} at (${lat}, ${lng})`);

    return { id, latitude: lat, longitude: lng, title };
  }

  /**
   * Returns all active incident IDs with their assigned vehicle IDs.
   */
  getActiveIncidentAssignments(): Array<{ incidentId: string; vehicleIds: string[] }> {
    return this.activeIncidents
      .filter((i) => i.status !== 'resolved' && i.assignedVehicleIds.length > 0)
      .map((i) => ({ incidentId: i.id, vehicleIds: i.assignedVehicleIds }));
  }

  getStatus(): SimulationStatus {
    return {
      running: this.isRunning(),
      tickCount: this.tickCount,
      vehicleCount: this.states.length,
      activeIncidents: this.activeIncidents.filter((i) => !isTrafficObstacle(i)).length,
      totalAnomalies: this.stats.anomalies,
      totalInsights: this.stats.insights,
      totalEvents: this.stats.events,
    };
  }

  async start(): Promise<{ vehicleCount: number }> {
    if (this.interval) {
      return { vehicleCount: this.states.length };
    }

    // Create a service-role Supabase client (no request context needed)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Load vehicles
    const { data: vehicles, error: vErr } = await this.supabase
      .from('vehicles')
      .select('id, type, name, plate_number, status, current_latitude, current_longitude, specifications')
      .order('plate_number');

    if (vErr || !vehicles || vehicles.length === 0) {
      throw new Error(vErr?.message ?? 'No vehicles found');
    }

    // Load detection rules
    const { data: rulesData, error: rErr } = await this.supabase
      .from('detection_rules')
      .select('*')
      .eq('is_active', true);

    if (rErr) {
      throw new Error(`Failed to fetch detection rules: ${rErr.message}`);
    }

    this.rules = (rulesData || []) as DetectionRule[];

    // Reset vehicles to available (clean start)
    const now = new Date().toISOString();
    for (const v of vehicles) {
      if (v.status !== 'maintenance' && v.status !== 'offline') {
        await this.supabase
          .from('vehicles')
          .update({ status: 'available', risk_score: 0, updated_at: now })
          .eq('id', v.id);
        v.status = 'available';
      }
    }

    // Resolve lingering incidents from previous runs
    await this.supabase
      .from('incidents')
      .update({ status: 'resolved', resolved_at: now })
      .in('status', ['reported', 'dispatched', 'in_progress']);

    // Resolve old active anomalies
    await this.supabase
      .from('anomalies')
      .update({ status: 'resolved', resolved_at: now })
      .in('status', ['active', 'acknowledged']);

    // Initialize state
    this.states = vehicles.map((v) => initState(v as VehicleRow));
    this.activeIncidents = [];
    this.tickCount = 0;
    this.nextIncidentTick = randInt(2, 5);
    this.anomalyThrottleMap.clear();
    this.recentInsights.clear();
    this.stats = { telemetry: 0, events: 0, anomalies: 0, insights: 0 };

    console.log(`[WorldSimulation] Started with ${vehicles.length} vehicles, ${this.rules.length} detection rules`);

    // Run first tick immediately
    this.executeTick();

    // Schedule subsequent ticks
    this.interval = setInterval(() => {
      this.executeTick();
    }, TICK_INTERVAL_MS);

    return { vehicleCount: vehicles.length };
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.supabase && this.states.length > 0) {
      const now = new Date().toISOString();

      // Reset vehicle statuses
      for (const state of this.states) {
        if (state.vehicle.status !== 'maintenance' && state.vehicle.status !== 'offline') {
          await this.supabase
            .from('vehicles')
            .update({ status: 'available', updated_at: now })
            .eq('id', state.vehicle.id);
        }
      }

      // Resolve active incidents
      for (const incident of this.activeIncidents) {
        await this.supabase
          .from('incidents')
          .update({ status: 'resolved', resolved_at: now })
          .eq('id', incident.id);
      }
    }

    console.log(`[WorldSimulation] Stopped after ${this.tickCount} ticks`);

    // Reset state
    this.states = [];
    this.activeIncidents = [];
    this.rules = [];
    this.tickCount = 0;
    this.anomalyThrottleMap.clear();
    this.recentInsights.clear();
    this.supabase = null;
  }

  private async executeTick(): Promise<void> {
    if (!this.supabase) return;
    // Prevent overlapping ticks (OSRM fetches can take a few seconds)
    if (this.tickInProgress) return;
    this.tickInProgress = true;

    try {
      this.tickCount++;
      const supabase = this.supabase;

      // 1. Simulate telemetry & movement
      const allTelemetry: TelemetryRow[] = [];
      const positionUpdates: { id: string; lat: number; lng: number }[] = [];

      for (const state of this.states) {
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
        console.error(`[WorldSimulation] Tick #${this.tickCount} telemetry error:`, telError.message);
      } else {
        this.stats.telemetry += allTelemetry.length;
      }

      // Update positions
      for (const pos of positionUpdates) {
        const { error: posError } = await supabase
          .from('vehicles')
          .update({ current_latitude: pos.lat, current_longitude: pos.lng, updated_at: new Date().toISOString() })
          .eq('id', pos.id);
        if (posError) {
          console.error(`[WorldSimulation] Tick #${this.tickCount} position error for ${pos.id}:`, posError.message);
        }
      }

      // 2. Incident lifecycle
      const { events: incidentEvents, logs: incidentLogs, nextIncidentTick } =
        await processIncidentLifecycle(
          supabase, this.tickCount, this.nextIncidentTick, this.activeIncidents, this.states
        );
      this.nextIncidentTick = nextIncidentTick;

      if (incidentEvents.length > 0) {
        const { error: evtError } = await supabase.from('events').insert(incidentEvents);
        if (evtError) {
          console.error(`[WorldSimulation] Tick #${this.tickCount} event error:`, evtError.message);
        } else {
          this.stats.events += incidentEvents.length;
        }
      }

      // 3. Anomaly detection
      const { anomalyCount, logs: anomalyLogs } = await processAnomalyDetection(
        supabase, this.states, allTelemetry, this.rules, this.anomalyThrottleMap
      );
      this.stats.anomalies += anomalyCount;

      // 4. Insight generation (every INSIGHT_INTERVAL_TICKS)
      let insightCount = 0;
      const insightLogs: string[] = [];
      if (this.tickCount % INSIGHT_INTERVAL_TICKS === 0) {
        const result = await generateInsights(
          supabase, this.states, this.activeIncidents, this.tickCount, this.recentInsights
        );
        insightCount = result.insightCount;
        insightLogs.push(...result.logs);
        this.stats.insights += insightCount;
      }

      // Log summary
      const movingCount = this.states.filter((s) => s.isMoving).length;
      console.log(
        `[WorldSimulation] Tick #${this.tickCount} | ` +
        `${allTelemetry.length} readings | ` +
        `${incidentEvents.length} events | ` +
        `${anomalyCount} anomalies | ` +
        `${insightCount} insights | ` +
        `${this.activeIncidents.filter((i) => !isTrafficObstacle(i)).length} incidents | ` +
        `${movingCount} moving`
      );

      for (const log of [...incidentLogs, ...anomalyLogs, ...insightLogs]) {
        console.log(log);
      }
    } catch (err) {
      console.error(`[WorldSimulation] Tick #${this.tickCount} error:`, err);
    } finally {
      this.tickInProgress = false;
    }
  }
}
