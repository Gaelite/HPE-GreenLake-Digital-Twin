-- =============================================================================
-- File:        02_benchmark.sql
-- Purpose:     The 6 queries used to measure the impact of Parquet
--              + partitioning vs raw CSV. Three logical queries, run
--              against both configurations.
-- Setup:       Requires the CSV external table from 03_csv_table.sql
--              and the Parquet table from the Glue Crawler.
-- =============================================================================
-- For each pair (1A/1B, 2A/2B, 3A/3B), record from Athena UI:
--   * Execution time
--   * Data scanned
-- See benchmark.md for results.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- QUERY 1 — Filter by metric type
-- Business question: average engine temperature across all readings?
-- -----------------------------------------------------------------------------

-- 1A: CSV (before optimization)
SELECT COUNT(*) AS total, AVG(CAST(value AS DOUBLE)) AS avg_value
FROM telemetry_readings_csv
WHERE metric_type = 'engine_temp';

-- 1B: Parquet + partitioning (after optimization)
SELECT COUNT(*) AS total, AVG(value) AS avg_value
FROM telemetry_readings
WHERE metric_type = 'engine_temp';


-- -----------------------------------------------------------------------------
-- QUERY 2 — Filter by metric + date
-- Business question: per-vehicle average engine temp on May 17?
-- -----------------------------------------------------------------------------

-- 2A: CSV (filter on raw timestamp column, scans full file)
SELECT vehicle_id, ROUND(AVG(CAST(value AS DOUBLE)), 2) AS avg_engine_temp
FROM telemetry_readings_csv
WHERE metric_type = 'engine_temp'
  AND timestamp >= '2026-05-17'
GROUP BY vehicle_id
ORDER BY avg_engine_temp DESC;

-- 2B: Parquet + partitioning (uses dt partition column for pruning)
SELECT vehicle_id, ROUND(AVG(value), 2) AS avg_engine_temp
FROM telemetry_readings
WHERE metric_type = 'engine_temp'
  AND dt = '2026-05-17'
GROUP BY vehicle_id
ORDER BY avg_engine_temp DESC;


-- -----------------------------------------------------------------------------
-- QUERY 3 — Aggregate across all metrics (no partition filter)
-- Business question: p95 and p99 for every metric type?
-- This is the worst case for partition pruning — touches every partition.
-- -----------------------------------------------------------------------------

-- 3A: CSV
SELECT metric_type,
       COUNT(*) AS total,
       ROUND(APPROX_PERCENTILE(CAST(value AS DOUBLE), 0.95), 2) AS p95,
       ROUND(APPROX_PERCENTILE(CAST(value AS DOUBLE), 0.99), 2) AS p99,
       ROUND(MAX(CAST(value AS DOUBLE)), 2) AS max_val
FROM telemetry_readings_csv
GROUP BY metric_type
ORDER BY total DESC;

-- 3B: Parquet + partitioning
SELECT metric_type,
       COUNT(*) AS total,
       ROUND(APPROX_PERCENTILE(value, 0.95), 2) AS p95,
       ROUND(APPROX_PERCENTILE(value, 0.99), 2) AS p99,
       ROUND(MAX(value), 2) AS max_val
FROM telemetry_readings
GROUP BY metric_type
ORDER BY total DESC;
