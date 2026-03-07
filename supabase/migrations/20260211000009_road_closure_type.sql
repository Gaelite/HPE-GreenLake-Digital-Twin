-- Add 'road_closure' to the incident_type check constraint
-- Used by the dynamic route demo to distinguish traffic obstacles from real incidents.

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_incident_type_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_incident_type_check
  CHECK (incident_type IN ('fire', 'medical', 'crime', 'accident', 'natural_disaster', 'road_closure'));
