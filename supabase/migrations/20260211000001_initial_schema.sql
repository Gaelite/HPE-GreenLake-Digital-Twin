-- ============================================================
-- Digital Twin - Emergency Vehicles POC — Database Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'dispatcher', 'operator', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('police', 'ambulance', 'fire_truck', 'civil_protection', 'hybrid')),
  name TEXT NOT NULL,
  plate_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'in_service', 'en_route', 'at_scene', 'maintenance', 'offline')),
  year INTEGER,
  make TEXT,
  model TEXT,
  specifications JSONB NOT NULL DEFAULT '{}',
  current_latitude NUMERIC,
  current_longitude NUMERIC,
  risk_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicles_type_status ON vehicles(type, status);

-- ============================================================
-- VEHICLE EQUIPMENT
-- ============================================================
CREATE TABLE vehicle_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  equipment_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'operational'
    CHECK (status IN ('operational', 'needs_repair', 'replaced', 'missing')),
  last_checked TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_vehicle ON vehicle_equipment(vehicle_id);

-- ============================================================
-- TELEMETRY READINGS
-- ============================================================
CREATE TABLE telemetry_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_telemetry_vehicle_time ON telemetry_readings(vehicle_id, timestamp DESC);
CREATE INDEX idx_telemetry_metric ON telemetry_readings(metric_type);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  metadata JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_vehicle_time ON events(vehicle_id, timestamp DESC);

-- ============================================================
-- ANOMALIES
-- ============================================================
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  telemetry_reading_id UUID REFERENCES telemetry_readings(id),
  anomaly_type TEXT NOT NULL DEFAULT 'threshold_breach',
  metric_type TEXT NOT NULL,
  expected_range JSONB NOT NULL DEFAULT '{}',
  actual_value NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'acknowledged', 'resolved')),
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_anomalies_vehicle_status ON anomalies(vehicle_id, status);

-- ============================================================
-- DETECTION RULES
-- ============================================================
CREATE TABLE detection_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_type TEXT,
  metric_type TEXT NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SCENARIOS
-- ============================================================
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SIMULATION RESULTS
-- ============================================================
CREATE TABLE simulation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  result_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sim_results_scenario ON simulation_results(scenario_id);

-- ============================================================
-- INSIGHTS
-- ============================================================
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  is_dismissed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_insights_type ON insights(insight_type);
CREATE INDEX idx_insights_dismissed ON insights(is_dismissed) WHERE is_dismissed = false;

-- ============================================================
-- MAINTENANCE RECORDS
-- ============================================================
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('scheduled', 'emergency', 'inspection')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_maintenance_vehicle ON maintenance_records(vehicle_id);

-- ============================================================
-- GEOFENCES
-- ============================================================
CREATE TABLE geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('district', 'high_risk', 'restricted', 'coverage')),
  coordinates JSONB NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INCIDENTS
-- ============================================================
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('fire', 'medical', 'crime', 'accident', 'natural_disaster')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'reported'
    CHECK (status IN ('reported', 'dispatched', 'in_progress', 'resolved')),
  assigned_vehicle_ids UUID[],
  reported_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Vehicles: all authenticated read, admin write
CREATE POLICY "Authenticated read vehicles" ON vehicles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin write vehicles" ON vehicles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin update vehicles" ON vehicles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin delete vehicles" ON vehicles FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Read-all policies for data tables
CREATE POLICY "Authenticated read equipment" ON vehicle_equipment FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read telemetry" ON telemetry_readings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read events" ON events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read anomalies" ON anomalies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read rules" ON detection_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read scenarios" ON scenarios FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read results" ON simulation_results FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read insights" ON insights FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read maintenance" ON maintenance_records FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read geofences" ON geofences FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read incidents" ON incidents FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert policies for operational tables
CREATE POLICY "Admin/dispatcher insert telemetry" ON telemetry_readings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
);
CREATE POLICY "Admin/dispatcher insert events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
);
CREATE POLICY "Admin/dispatcher create scenarios" ON scenarios FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
);
CREATE POLICY "Admin manage rules" ON detection_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Anomaly update (acknowledge/resolve)
CREATE POLICY "Ops update anomalies" ON anomalies FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher', 'operator'))
);

-- Insert policies for anomalies, results, insights (system/admin)
CREATE POLICY "System insert anomalies" ON anomalies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "System insert results" ON simulation_results FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "System insert insights" ON insights FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage equipment" ON vehicle_equipment FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage maintenance" ON maintenance_records FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
);
CREATE POLICY "Admin manage geofences" ON geofences FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Ops manage incidents" ON incidents FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher', 'operator'))
);

-- ============================================================
-- DEFAULT DETECTION RULES (seed)
-- ============================================================
INSERT INTO detection_rules (metric_type, max_value, severity, description) VALUES
  ('engine_temp', 110, 'critical', 'Engine temperature exceeds 110°C'),
  ('engine_temp', 95, 'warning', 'Engine temperature exceeds 95°C'),
  ('fuel_level', NULL, 'critical', 'Fuel level below 5%'),
  ('fuel_level', NULL, 'warning', 'Fuel level below 15%'),
  ('tire_pressure', NULL, 'warning', 'Tire pressure below 28 PSI'),
  ('tire_pressure', NULL, 'critical', 'Tire pressure below 22 PSI'),
  ('speed', 160, 'warning', 'Speed exceeds 160 km/h'),
  ('battery_voltage', NULL, 'warning', 'Battery voltage below 11.5V'),
  ('rpm', 6500, 'warning', 'RPM exceeds 6500');

-- Set min values for fuel/tire/battery rules
UPDATE detection_rules SET min_value = 0, max_value = 5 WHERE description LIKE '%below 5%';
UPDATE detection_rules SET min_value = 0, max_value = 15 WHERE description LIKE '%below 15%';
UPDATE detection_rules SET min_value = 0, max_value = 28 WHERE description LIKE '%28 PSI%';
UPDATE detection_rules SET min_value = 0, max_value = 22 WHERE description LIKE '%22 PSI%';
UPDATE detection_rules SET min_value = 0, max_value = 11.5 WHERE description LIKE '%11.5V%';

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE telemetry_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE anomalies;
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
