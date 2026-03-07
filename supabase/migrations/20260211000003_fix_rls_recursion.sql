-- ============================================================
-- Fix: Infinite recursion in RLS policies
-- ============================================================
-- The original policies on profiles referenced the profiles table
-- in a subquery (to check admin role), causing infinite recursion.
-- Solution: Use a SECURITY DEFINER function to bypass RLS for role checks.
-- ============================================================

-- Helper function: get current user's role without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (public.get_user_role() = 'admin');

-- Recreate all other policies that referenced profiles table directly
DROP POLICY IF EXISTS "Admin write vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin delete vehicles" ON vehicles;
CREATE POLICY "Admin write vehicles" ON vehicles FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "Admin update vehicles" ON vehicles FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin delete vehicles" ON vehicles FOR DELETE USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin/dispatcher insert telemetry" ON telemetry_readings;
CREATE POLICY "Admin/dispatcher insert telemetry" ON telemetry_readings FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'dispatcher'));

DROP POLICY IF EXISTS "Admin/dispatcher insert events" ON events;
CREATE POLICY "Admin/dispatcher insert events" ON events FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'dispatcher'));

DROP POLICY IF EXISTS "Ops update anomalies" ON anomalies;
CREATE POLICY "Ops update anomalies" ON anomalies FOR UPDATE USING (public.get_user_role() IN ('admin', 'dispatcher', 'operator'));

DROP POLICY IF EXISTS "Admin manage rules" ON detection_rules;
CREATE POLICY "Admin manage rules" ON detection_rules FOR ALL USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin/dispatcher create scenarios" ON scenarios;
CREATE POLICY "Admin/dispatcher create scenarios" ON scenarios FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'dispatcher'));

DROP POLICY IF EXISTS "Admin manage equipment" ON vehicle_equipment;
CREATE POLICY "Admin manage equipment" ON vehicle_equipment FOR ALL USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin manage maintenance" ON maintenance_records;
CREATE POLICY "Admin manage maintenance" ON maintenance_records FOR ALL USING (public.get_user_role() IN ('admin', 'dispatcher'));

DROP POLICY IF EXISTS "Admin manage geofences" ON geofences;
CREATE POLICY "Admin manage geofences" ON geofences FOR ALL USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Ops manage incidents" ON incidents;
CREATE POLICY "Ops manage incidents" ON incidents FOR ALL USING (public.get_user_role() IN ('admin', 'dispatcher', 'operator'));
