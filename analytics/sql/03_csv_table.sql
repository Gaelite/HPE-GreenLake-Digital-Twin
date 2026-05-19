-- =============================================================================
-- File:        03_csv_table.sql
-- Purpose:     External Athena table over the raw CSV. Used as the
--              "before" baseline in the benchmark.
-- Engine:      Amazon Athena (Trino)
-- Database:    digital_twin_db
-- =============================================================================
-- Why this table exists:
--   The benchmark needs to compare CSV vs Parquet. The Parquet table is
--   auto-created by the Glue Crawler from the processed/ zone. The CSV
--   table is created manually here so it can be queried the same way.
--
-- Important:
--   OpenCSVSerde requires all columns to be STRING. Numeric operations
--   in queries against this table must explicitly CAST(value AS DOUBLE).
--   This is a SerDe limitation, not a query design choice.
-- =============================================================================

-- Drop existing table if rerunning the setup
DROP TABLE IF EXISTS digital_twin_db.telemetry_readings_csv;

CREATE EXTERNAL TABLE digital_twin_db.telemetry_readings_csv (
  id              STRING,
  vehicle_id      STRING,
  metric_type     STRING,
  value           STRING,
  unit            STRING,
  latitude        STRING,
  longitude       STRING,
  timestamp       STRING,
  created_at      STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES (
  'separatorChar' = ',',
  'quoteChar'     = '"',
  'escapeChar'    = '\\'
)
STORED AS TEXTFILE
LOCATION 's3://<YOUR_BUCKET>/raw/telemetry_csv/'
TBLPROPERTIES (
  'skip.header.line.count' = '1'
);

-- Sanity check
SELECT COUNT(*) FROM telemetry_readings_csv;
-- Expected: 914,548
