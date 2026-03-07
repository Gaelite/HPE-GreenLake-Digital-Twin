// ============================================================
// Digital Twin - Emergency Vehicles POC — Shared Types
// ============================================================

// ----- Vehicle Types -----
export type VehicleType = 'police' | 'ambulance' | 'fire_truck' | 'civil_protection' | 'hybrid';

export type VehicleStatus =
  | 'available'
  | 'in_service'
  | 'en_route'
  | 'at_scene'
  | 'maintenance'
  | 'offline';

export type EngineStatus = 'off' | 'idle' | 'running' | 'warning' | 'critical';

export interface Vehicle {
  id: string;
  type: VehicleType;
  name: string;
  plate_number: string;
  status: VehicleStatus;
  year: number;
  make: string;
  model: string;
  specifications: Record<string, unknown>;
  current_latitude: number | null;
  current_longitude: number | null;
  risk_score: number;
  created_at: string;
  updated_at: string;
}

// ----- Telemetry -----
export type MetricType =
  | 'speed'
  | 'engine_temp'
  | 'fuel_level'
  | 'tire_pressure'
  | 'battery_voltage'
  | 'rpm'
  | 'oil_pressure'
  | 'odometer';

export interface TelemetryReading {
  id: string;
  vehicle_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  created_at: string;
}

// ----- Events -----
export type EventType =
  | 'dispatch'
  | 'en_route'
  | 'arrived'
  | 'completed'
  | 'maintenance_alert'
  | 'refuel'
  | 'equipment_check';

export type Severity = 'info' | 'warning' | 'critical';

export interface VehicleEvent {
  id: string;
  vehicle_id: string;
  event_type: EventType;
  description: string;
  severity: Severity;
  metadata: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

// ----- Anomalies -----
export type AnomalyType = 'threshold_breach' | 'pattern_anomaly' | 'route_deviation';
export type AnomalyStatus = 'active' | 'acknowledged' | 'resolved';

export interface Anomaly {
  id: string;
  vehicle_id: string;
  telemetry_reading_id: string | null;
  anomaly_type: AnomalyType;
  metric_type: MetricType;
  expected_range: { min?: number; max?: number };
  actual_value: number;
  severity: Severity;
  status: AnomalyStatus;
  description: string;
  timestamp: string;
  resolved_at: string | null;
  created_at: string;
}

// ----- Detection Rules -----
export interface DetectionRule {
  id: string;
  vehicle_type: VehicleType | null;
  metric_type: MetricType;
  min_value: number | null;
  max_value: number | null;
  severity: Severity;
  description: string;
  is_active: boolean;
  created_at: string;
}

// ----- Scenarios & Simulation -----
export type ScenarioType =
  | 'dispatch_comparison'
  | 'resource_depletion'
  | 'traffic_impact'
  | 'equipment_failure'
  | 'multi_vehicle';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  scenario_type: ScenarioType;
  parameters: Record<string, unknown>;
  created_by: string;
  is_template: boolean;
  created_at: string;
}

export interface SimulationResult {
  id: string;
  scenario_id: string;
  vehicle_id: string;
  result_data: {
    estimated_response_time: number;
    fuel_consumption: number;
    risk_delta: number;
    coverage_impact: number;
    outcome_summary: string;
    vehicle_name: string;
    delay_minutes: number;
    remaining_distance_km: number;
  };
  created_at: string;
}

// ----- Insights -----
export type InsightType =
  | 'maintenance_due'
  | 'response_time_trend'
  | 'anomaly_spike'
  | 'utilization_alert'
  | 'fuel_efficiency';

export type InsightStatus = 'active' | 'acknowledged' | 'resolved';

export interface Insight {
  id: string;
  insight_type: InsightType;
  title: string;
  description: string;
  severity: Severity;
  vehicle_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  is_dismissed: boolean;
  status: InsightStatus;
  read_at: string | null;
}

// ----- Geofences & Incidents -----
export type ZoneType = 'district' | 'high_risk' | 'restricted' | 'coverage';
export type EmergencyIncidentType = 'fire' | 'medical' | 'crime' | 'accident' | 'natural_disaster';
export type TrafficObstacleType = 'road_closure';
export type IncidentType = EmergencyIncidentType | TrafficObstacleType;
export type IncidentStatus = 'reported' | 'dispatched' | 'in_progress' | 'resolved';

export interface Geofence {
  id: string;
  name: string;
  description: string;
  zone_type: ZoneType;
  coordinates: GeoJSON.Polygon;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  incident_type: IncidentType;
  severity: Severity;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  assigned_vehicle_ids: string[] | null;
  reported_at: string;
  resolved_at: string | null;
}

// ----- Maintenance -----
export type MaintenanceType = 'scheduled' | 'emergency' | 'inspection';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed';

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  status: MaintenanceStatus;
  scheduled_date: string;
  completed_date: string | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

// ----- Equipment -----
export type EquipmentStatus = 'operational' | 'needs_repair' | 'replaced' | 'missing';

export interface VehicleEquipment {
  id: string;
  vehicle_id: string;
  equipment_name: string;
  category: string;
  status: EquipmentStatus;
  last_checked: string;
}

// ----- Auth / Profiles -----
export type UserRole = 'admin' | 'dispatcher' | 'operator' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// ----- UI Helpers -----
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  police: 'Police',
  ambulance: 'Ambulance',
  fire_truck: 'Fire Truck',
  civil_protection: 'Civil Protection',
  hybrid: 'Hybrid/Specialized',
};

export const STATUS_COLORS: Record<VehicleStatus, string> = {
  available: 'bg-green-500',
  in_service: 'bg-blue-500',
  en_route: 'bg-yellow-500',
  at_scene: 'bg-orange-500',
  maintenance: 'bg-gray-500',
  offline: 'bg-red-500',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
};