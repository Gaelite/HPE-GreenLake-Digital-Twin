-- Add oil pressure detection rule (from Feature-3 spec)
-- Triggers when oil pressure is outside the normal 25-65 PSI range.
-- Idle/at_scene vehicles typically have 0-15 PSI, so this fires for them.
INSERT INTO detection_rules (vehicle_type, metric_type, min_value, max_value, severity, description)
VALUES (NULL, 'oil_pressure', 25, 65, 'warning', 'Oil pressure outside normal range (25-65 PSI)');
