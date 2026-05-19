-- =============================================================================
-- File:        01_views.sql
-- Purpose:     The 5 non-trivial Athena views for the Digital Twin analytics
--              layer. Each answers a real business question about how the
--              emergency fleet is operating.
-- Engine:      Amazon Athena (Trino)
-- Database:    digital_twin_db
-- =============================================================================
-- Notes on "non-trivial":
--   - Every view uses at least one of: window functions, CTEs, conditional
--     aggregations (COUNT_IF / CASE), percentiles, geographic bucketing,
--     or multi-table joins.
--   - These are not "SELECT * FROM table" — each one answers a question
--     that requires the engine to do real work.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- View 1: v_response_time_by_vehicle
-- Question: Which vehicles take the longest to arrive after being dispatched?
-- Techniques: window function (LEAD), CTE chain, p95 percentile.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_response_time_by_vehicle AS
WITH ordered_events AS (
  -- For each event, look ahead to the next event for the same vehicle.
  -- LEAD() lets us pair each "dispatch" with its subsequent "arrived".
  SELECT
    vehicle_id,
    event_type,
    timestamp,
    LEAD(event_type) OVER (PARTITION BY vehicle_id ORDER BY timestamp) AS next_event,
    LEAD(timestamp)  OVER (PARTITION BY vehicle_id ORDER BY timestamp) AS next_ts
  FROM events
  WHERE event_type IN ('dispatch', 'arrived')
),
response_pairs AS (
  -- Keep only valid (dispatch → arrived) pairs and compute seconds elapsed.
  -- The BETWEEN guard discards anomalies (negative time, multi-hour gaps).
  SELECT
    vehicle_id,
    timestamp AS dispatch_ts,
    next_ts   AS arrival_ts,
    date_diff('second', timestamp, next_ts) AS response_seconds
  FROM ordered_events
  WHERE event_type = 'dispatch'
    AND next_event = 'arrived'
    AND date_diff('second', timestamp, next_ts) BETWEEN 0 AND 3600
)
SELECT
  vehicle_id,
  COUNT(*)                                            AS total_dispatches,
  ROUND(AVG(response_seconds), 0)                     AS avg_response_sec,
  ROUND(AVG(response_seconds) / 60, 2)                AS avg_response_min,
  MIN(response_seconds)                               AS min_response_sec,
  MAX(response_seconds)                               AS max_response_sec,
  ROUND(APPROX_PERCENTILE(response_seconds, 0.95), 0) AS p95_response_sec
FROM response_pairs
GROUP BY vehicle_id
ORDER BY avg_response_sec DESC;


-- -----------------------------------------------------------------------------
-- View 2: v_incident_hotspots
-- Question: Which areas of Madrid have the most emergency incidents?
-- Techniques: geographic bucketing (rounded lat/lng = ~100m grid),
--             conditional aggregation, ARRAY_AGG for distinct types.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_incident_hotspots AS
SELECT
  ROUND(latitude, 3)              AS lat_bucket,
  ROUND(longitude, 3)             AS lng_bucket,
  COUNT(*)                        AS total_incidents,
  COUNT_IF(severity = 'critical') AS critical_count,
  COUNT_IF(severity = 'warning')  AS warning_count,
  ARRAY_JOIN(ARRAY_AGG(DISTINCT incident_type), ', ') AS incident_types,
  COUNT_IF(status = 'resolved')   AS resolved_count,
  ROUND(100.0 * COUNT_IF(status = 'resolved') / COUNT(*), 1) AS resolution_rate_pct
FROM incidents
GROUP BY ROUND(latitude, 3), ROUND(longitude, 3)
HAVING COUNT(*) >= 2  -- show only repeat-incident locations
ORDER BY total_incidents DESC
LIMIT 50;


-- -----------------------------------------------------------------------------
-- View 3: v_anomaly_frequency_by_metric
-- Question: Which metric breaches thresholds most often, and how severely?
-- Techniques: pivot via COUNT_IF, percentage calculation, MTBF estimate.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_anomaly_frequency_by_metric AS
SELECT
  metric_type,
  COUNT(*)                                AS total_anomalies,
  COUNT_IF(severity = 'critical')         AS critical_count,
  COUNT_IF(severity = 'warning')          AS warning_count,
  ROUND(100.0 * COUNT_IF(severity = 'critical') / COUNT(*), 1) AS pct_critical,
  COUNT_IF(status = 'resolved')           AS resolved_count,
  COUNT_IF(status = 'active')             AS still_active,
  ROUND(AVG(actual_value), 2)             AS avg_breach_value,
  COUNT(DISTINCT vehicle_id)              AS vehicles_affected,
  -- MTBF estimate (Mean Time Between Failures) in hours
  ROUND(
    date_diff('hour', MIN(timestamp), MAX(timestamp)) * 1.0 / NULLIF(COUNT(*), 0),
    2
  ) AS mtbf_hours
FROM anomalies
GROUP BY metric_type
ORDER BY total_anomalies DESC;


-- -----------------------------------------------------------------------------
-- View 4: v_fleet_utilization_hourly
-- Question: At what hours of the day is the fleet most active?
-- Techniques: time bucketing (EXTRACT HOUR), conditional aggregation,
--             distinct vehicle counting, multi-dimensional summary.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_fleet_utilization_hourly AS
SELECT
  EXTRACT(HOUR FROM CAST(timestamp AS timestamp)) AS hour_of_day,
  COUNT(DISTINCT vehicle_id)                       AS active_vehicles,
  COUNT(*)                                         AS total_readings,
  ROUND(AVG(CASE WHEN metric_type = 'speed'       THEN value END), 2) AS avg_speed,
  ROUND(AVG(CASE WHEN metric_type = 'fuel_level'  THEN value END), 2) AS avg_fuel,
  ROUND(AVG(CASE WHEN metric_type = 'engine_temp' THEN value END), 2) AS avg_engine_temp,
  COUNT_IF(metric_type = 'speed' AND value > 80)   AS high_speed_readings
FROM telemetry_readings
WHERE timestamp IS NOT NULL
GROUP BY EXTRACT(HOUR FROM CAST(timestamp AS timestamp))
ORDER BY hour_of_day;


-- -----------------------------------------------------------------------------
-- View 5: v_vehicle_risk_ranking
-- Question: Which vehicles are in the worst shape and should be prioritized
--           for maintenance?
-- Techniques: 2-table JOIN, composite risk scoring formula, ROW_NUMBER
--             ranking. This is the most complex view in the set.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_vehicle_risk_ranking AS
WITH anomaly_stats AS (
  SELECT
    vehicle_id,
    COUNT(*)                        AS anomaly_count,
    COUNT_IF(severity = 'critical') AS critical_anomalies,
    COUNT(DISTINCT metric_type)     AS distinct_metrics_failing
  FROM anomalies
  GROUP BY vehicle_id
),
telemetry_stats AS (
  SELECT
    vehicle_id,
    ROUND(AVG(CASE WHEN metric_type = 'engine_temp'  THEN value END), 1) AS avg_engine_temp,
    ROUND(MAX(CASE WHEN metric_type = 'engine_temp'  THEN value END), 1) AS max_engine_temp,
    ROUND(MIN(CASE WHEN metric_type = 'fuel_level'   THEN value END), 1) AS min_fuel_level,
    ROUND(AVG(CASE WHEN metric_type = 'oil_pressure' THEN value END), 1) AS avg_oil_pressure
  FROM telemetry_readings
  GROUP BY vehicle_id
)
SELECT
  t.vehicle_id,
  COALESCE(a.anomaly_count, 0)            AS total_anomalies,
  COALESCE(a.critical_anomalies, 0)       AS critical_anomalies,
  COALESCE(a.distinct_metrics_failing, 0) AS metrics_failing,
  t.avg_engine_temp,
  t.max_engine_temp,
  t.min_fuel_level,
  t.avg_oil_pressure,
  -- Composite risk score:
  --   - critical anomalies weighted 5x
  --   - any anomaly counts 1x
  --   - +10 penalty for overheating (>110°C)
  --   - +5 penalty for near-empty fuel (<10%)
  (COALESCE(a.critical_anomalies, 0) * 5
   + COALESCE(a.anomaly_count, 0)
   + CASE WHEN t.max_engine_temp > 110 THEN 10 ELSE 0 END
   + CASE WHEN t.min_fuel_level  < 10  THEN 5  ELSE 0 END
  ) AS risk_score,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(a.critical_anomalies, 0) * 5
      + COALESCE(a.anomaly_count, 0)
      + CASE WHEN t.max_engine_temp > 110 THEN 10 ELSE 0 END
      + CASE WHEN t.min_fuel_level  < 10  THEN 5  ELSE 0 END
      DESC
  ) AS risk_rank
FROM telemetry_stats t
LEFT JOIN anomaly_stats a ON t.vehicle_id = a.vehicle_id
ORDER BY risk_score DESC;
