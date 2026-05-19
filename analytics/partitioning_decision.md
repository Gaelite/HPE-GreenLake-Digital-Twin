# Partitioning Decision Record

## Context

The `telemetry_readings` table contains ~914,000 rows of sensor data from 30
emergency vehicles operating in Madrid. Each row represents a single metric
reading (engine temperature, fuel level, speed, etc.) timestamped at 5-second
intervals.

Without partitioning, every Athena query that touches this table has to scan
the full 156 MB of CSV. With proper partitioning, scans can be reduced by
**1,000x or more** depending on the query pattern.

## Decision

Partition the `telemetry_readings` table on disk using a **two-level
Hive-style partition scheme**:

```
processed/telemetry_readings/
├── metric_type=battery_voltage/
│   ├── dt=2026-05-09/data.parquet
│   ├── dt=2026-05-14/data.parquet
│   ├── dt=2026-05-16/data.parquet
│   └── dt=2026-05-17/data.parquet
├── metric_type=engine_temp/
│   ├── dt=2026-05-09/data.parquet
│   ├── ...
├── metric_type=fuel_level/
├── metric_type=odometer/
├── metric_type=oil_pressure/
├── metric_type=rpm/
├── metric_type=speed/
└── metric_type=tire_pressure/
```

Primary partition key: **`metric_type`** (cardinality = 8).
Secondary partition key: **`dt`** (cardinality grows linearly with time;
currently 4 distinct days).

The other three tables (`events`, `incidents`, `anomalies`) are **not
partitioned**. Their combined size is under 1 MB and partitioning would add
overhead with no measurable benefit.

## Alternatives considered

### Alternative A — `(dt, metric_type)` (date first)

Same two columns, opposite order. Considered because temporal queries are
common in operational dashboards.

**Rejected because:**

- 100% of the analytical views filter by `metric_type`, but only ~60% filter
  by date. Putting the more selective predicate first gives better pruning
  on average.
- The Grafana dashboard queries the `v_anomaly_frequency_by_metric` and
  `v_vehicle_risk_ranking` views with no date filter at all. With `dt`
  first, these queries would scan every date partition. With `metric_type`
  first, Athena can prune to the relevant metrics regardless.

### Alternative B — Single partition on `vehicle_id` (cardinality = 30)

Considered because some queries filter by vehicle.

**Rejected because:**

- Cardinality is too high for current data volume. 30 partitions of ~5 MB
  each is acceptable, but as data grows the per-partition file size shrinks
  and Athena hits the "small file problem" (overhead of opening many small
  files exceeds the benefit of partition pruning).
- Vehicle-filtered queries are a minority of the workload. Most dashboard
  panels aggregate across vehicles.
- An index-style optimization would be better served by Parquet's built-in
  row group statistics, which we already get for free.

### Alternative C — No partitioning, just Parquet

Considered because Parquet alone gives huge wins on columnar compression
and predicate pushdown via row group statistics.

**Rejected because:**

- The benchmark shows partitioning adds an additional 10-30x reduction in
  bytes scanned on top of what Parquet alone provides. See `benchmark.md`.
- Cost matters: Athena charges $5 per TB scanned. At production scale
  (1 year ≈ 50 GB of telemetry), partition pruning is the difference
  between $0.25/query and $0.0003/query.

## Justification (why `metric_type` first works for this workload)

**1. Query pattern alignment.** Every view in `sql/01_views.sql` either:
- filters explicitly by `metric_type` (e.g., `WHERE metric_type = 'engine_temp'`), or
- aggregates per-metric (e.g., `GROUP BY metric_type`).

When the partition column appears in a `WHERE` clause that Athena can
push down, the engine reads only the matching folders. With `metric_type`
as the primary partition, this happens on every analytical query.

**2. Cardinality is well-tuned.** 8 distinct values for `metric_type` ×
4 days of data = 32 partition folders. Each folder holds ~5 MB of Parquet.
This is in the "Goldilocks zone" recommended by AWS:

- Too few partitions (< 5): no real pruning
- Too many partitions (> 10,000): manifest overhead dominates
- Sweet spot (10–1,000 partitions, each 100 MB+): ideal

We're at the low end of the sweet spot for current data, with room to grow
to ~3,000 partitions after a year of operation (8 metrics × 365 days)
without issue.

**3. Compression friendliness.** Each metric type has its own
distribution of values (engine_temp is always near 90, RPM is in the
thousands, fuel_level is 0-100). Grouping values of the same metric
into a single Parquet file gives Snappy/dictionary encoding much better
ratios than mixing all metrics in one file.

**Result:** the 156 MB CSV becomes ~30 MB of Parquet after partitioning
(~5x smaller).

## Measurement

See `benchmark.md` for hard numbers, but in summary:

| Query type | CSV bytes scanned | Parquet+partition bytes scanned | Reduction |
|---|---|---|---|
| Filter by metric only | 155.69 MB | 187 KB | **850x** |
| Filter by metric + date | 155.69 MB | 124 KB | **1,279x** |
| Aggregate across all metrics | 155.69 MB | 1.38 MB | **113x** |

## Trade-offs accepted

1. **Aggregations without filters are slower.** Query 3 in the benchmark
   takes longer in Parquet (1.7s vs 1.0s in CSV) because Athena opens 30+
   small Parquet files instead of 1 large CSV. We accept this because:
   - Bytes scanned still drops 113x — the cost ratio still favors Parquet.
   - This query pattern is < 5% of the dashboard workload.
   - At larger scale (>10 GB), the file overhead amortizes and Parquet
     wins on both axes.

2. **`dt` partition grows unboundedly.** With one new `dt` value per day,
   we'll reach 1,000+ partitions per metric in ~3 years. Beyond that,
   monthly archival or partition compaction would be needed. Not a
   concern for the current capstone scope.

3. **Schema evolution is harder.** Adding a new column means rewriting
   Parquet files. Mitigated by Parquet's tolerance for missing columns
   on read, but a true schema migration would require a one-time
   reprocess. Acceptable: telemetry schemas rarely change.

## Implementation

Partitioning is applied at write time via `pyarrow.parquet.write_to_dataset`
with `partition_cols=["metric_type", "dt"]`. See
`export/convert_to_parquet.py`.

Glue Crawler then discovers the partitions automatically by reading the
`key=value/` folder names. No manual `ALTER TABLE ADD PARTITION` is
needed.
