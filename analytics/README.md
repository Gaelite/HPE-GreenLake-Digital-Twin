# Analytics Engineering — HPE Digital Twin

> Role 3 deliverable for the capstone project. Builds an AWS-native analytics
> layer on top of the existing Digital Twin platform without modifying the
> production system.

## What this is

The Digital Twin platform (Next.js + Supabase) generates real-time telemetry,
events, incidents, and anomalies for an emergency vehicle fleet in Madrid.
This `analytics/` folder takes that operational data and turns it into
queryable insights through an AWS data lake architecture.

## Architecture

```
┌─────────────────┐  export    ┌─────────────────┐
│ Supabase        │ ─────────▶ │ data/raw/       │
│ (operational)   │            │ (CSV files)     │
└─────────────────┘            └────────┬────────┘
                                        │ python convert_to_parquet.py
                                        ▼
                              ┌─────────────────┐  upload   ┌──────────────┐
                              │ data/processed/ │ ────────▶ │ S3 processed │
                              │ Parquet + parts │           │ (Parquet)    │
                              └─────────────────┘           └──────┬───────┘
                                                                   │
                                                                   ▼
                                                           ┌──────────────┐
                                                           │ Glue Catalog │
                                                           └──────┬───────┘
                                                                  │
                                              ┌───────────────────┼───────────────────┐
                                              ▼                   ▼                   ▼
                                       ┌────────────┐     ┌────────────┐     ┌──────────────┐
                                       │   Athena   │     │   Athena   │     │   Grafana    │
                                       │   Views    │     │ Benchmark  │     │  Dashboard   │
                                       └────────────┘     └────────────┘     └──────────────┘
```

## Dataset

| Table | Rows | Source |
|---|---|---|
| `telemetry_readings` | 914,548 | 7,348 real + 907,200 synthetic |
| `events` | 3,037 | 37 real + 3,000 synthetic |
| `incidents` | 406 | 6 real + 400 synthetic |
| `anomalies` | 607 | 7 real + 600 synthetic |
| **Total** | **918,598** | — |

The real data comes from the production simulator. The synthetic data
follows the **exact same generation rules** as `world-simulation.ts`
(same metric ranges, same Madrid coordinates, same anomaly detection
thresholds). Synthetic data is augmentation, not fake data — it
extends the time coverage from ~1 hour to ~1 day.

## Folder layout

```
analytics/
├── README.md                       — this file
├── partitioning_decision.md        — design decision record
├── benchmark.md                    — performance comparison results
├── export/
│   ├── export_supabase.py          — pulls real data from Supabase
│   ├── generate_synthetic.py       — augments with synthetic history
│   ├── combine_data.py             — merges real + synthetic
│   └── convert_to_parquet.py       — CSV → partitioned Parquet
├── sql/
│   ├── 01_views.sql                — the 5 analytical views
│   ├── 02_benchmark.sql            — the 6 benchmark queries
│   └── 03_csv_table.sql            — external table for CSV (benchmark baseline)
├── dashboard/
│   ├── overview.png                — full dashboard screenshot
│   ├── panel1_kpis.png
│   ├── panel2_anomalies.png
│   ├── panel3_risk_table.png
│   └── panel4_incidents_map.png
└── data/                           — local CSV + Parquet (gitignored)
```

## How to reproduce

### Prerequisites

- Python 3.11+
- AWS account with S3, Glue, Athena access
- AWS CLI configured (`aws configure`)
- Supabase credentials (URL + service_role key)

### Step-by-step

```bash
# 1. Setup
cd analytics
python3 -m venv venv
source venv/bin/activate
pip install supabase pandas pyarrow python-dateutil

# 2. Export real data from Supabase
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
python export/export_supabase.py

# 3. Generate synthetic historical data
python export/generate_synthetic.py

# 4. Combine real + synthetic
python export/combine_data.py

# 5. Convert to Parquet with partitioning
python export/convert_to_parquet.py

# 6. Upload to S3
export BUCKET_NAME="your-bucket-name"
aws s3 cp data/raw/combined/ "s3://$BUCKET_NAME/raw/" --recursive
aws s3 cp data/processed/ "s3://$BUCKET_NAME/processed/" --recursive

# 7. Run Glue Crawler (one-time)
aws glue start-crawler --name digital-twin-crawler

# 8. Create views in Athena
# Open Athena console → digital_twin_db → paste sql/01_views.sql
```

## Deliverables checklist

- [x] Partitioning strategy with justification → `partitioning_decision.md`
- [x] 5+ non-trivial Athena views → `sql/01_views.sql`
- [x] Benchmark: 3 queries, before/after → `benchmark.md`
- [x] Dashboard with 4+ visualizations → `dashboard/`
- [x] Documentation → this README

## Tech stack

- **Storage:** Amazon S3 (raw / processed / curated zones)
- **Catalog:** AWS Glue Data Catalog
- **Query engine:** Amazon Athena (Trino-based)
- **Visualization:** Grafana Cloud Free (Amazon Athena data source plugin)
- **Format:** Apache Parquet with Snappy compression
- **Partition scheme:** Hive-style `metric_type=X/dt=YYYY-MM-DD/`

## Notes for graders

- No credentials in repo. All secrets go through environment variables.
- IAM follows least-privilege: dedicated `grafana-athena-reader` user with
  scoped policies (`AmazonAthenaFullAccess`, `S3ReadOnlyAccess`, plus an
  inline policy for write access to the `athena-results/` prefix only).
- The Digital Twin codebase was not modified. The analytics layer is
  fully decoupled from the operational system.
