# Dashboard — Digital Twin Fleet Analytics

Built in **Grafana Cloud Free** with the **Amazon Athena** data source plugin.

## Why Grafana (not QuickSight)

The original plan was QuickSight, but the AWS account used was too new to be
eligible for QuickSight subscription (the AWS console returned
*"Account is not eligible to subscribe to AmazonQuickSight"*). Grafana
Cloud Free was chosen as the alternative because:

- Connects natively to Athena via the official Grafana plugin
- Free tier is permanent (not a trial)
- Produces dashboards that are at least equivalent to QuickSight in
  visual quality and analytical capability
- Hosted (no infrastructure to manage)

The deliverable requirement is "dashboard with 4+ visualizations telling a
story" — that requirement is met regardless of the tool.

## The story this dashboard tells

> *"How is the emergency fleet operating right now, where are the risks,
> and what should the dispatcher do next?"*

Each panel answers part of that question.

## Panels

### Panel 1 — Operational KPIs (top row)

Four key numbers at a glance, color-coded by health:

| KPI | Source | Meaning |
|---|---|---|
| **Total Anomalies** | `anomalies` table | How many threshold breaches across the fleet |
| **Total Incidents** | `incidents` table | Emergencies the fleet has been dispatched to |
| **Active Vehicles** | `telemetry_readings` (distinct vehicle_id) | Fleet capacity available |
| **Avg Resolution (min)** | computed from `incidents` reported_at vs resolved_at | Operational responsiveness |

### Panel 2 — Anomalies by Metric

Bar chart from view `v_anomaly_frequency_by_metric`. Shows which mechanical
or operational metric is misbehaving most often. Bars are color-coded by
severity:

- Red bars (high count, critical breaches) → engine_temp, fuel_level, tire_pressure
- Green bars (no critical breaches) → speed, battery_voltage, rpm

Operational meaning: maintenance teams should prioritize the red metrics.

### Panel 3 — Top 10 Vehicles at Risk

Table from view `v_vehicle_risk_ranking`. The composite risk score
penalizes:

- Critical anomalies (5x weight)
- Total anomaly count (1x weight)
- Overheating events (`max_engine_temp > 110°C` → +10)
- Near-empty fuel events (`min_fuel_level < 10%` → +5)

Operational meaning: dispatchers should avoid sending the top-ranked
vehicles to new incidents until they're serviced.

### Panel 4 — Incident Hotspots in Madrid

Geographic map from view `v_incident_hotspots`. Each marker is a 100m × 100m
grid cell that has seen 2 or more incidents. Marker size = incident count.
Hovering a marker shows the breakdown by type and severity.

Operational meaning: resource pre-positioning. Areas with persistent hotspots
should have units pre-staged nearby.

## Screenshots

- `overview.png` — full dashboard view
- `panel1_kpis.png` — KPI cards detail
- `panel2_anomalies.png` — bar chart detail
- `panel3_risk_table.png` — risk ranking detail
- `panel4_incidents_map.png` — Madrid geomap detail

## How to reproduce in a fresh Grafana Cloud account

1. Sign up at https://grafana.com (Free tier)
2. **Connections → Data sources → Add** → choose **Amazon Athena**
3. Install the plugin if prompted
4. Configure:
   - **Authentication:** Access & secret key (using the dedicated
     `grafana-athena-reader` IAM user)
   - **Default Region:** `us-east-1`
   - **Catalog:** `AwsDataCatalog`
   - **Database:** `digital_twin_db`
   - **Workgroup:** `primary`
   - **Output Location:** `s3://<your-bucket>/athena-results/`
5. **Save & test** → should report "Data source is working"
6. **Dashboards → New dashboard** → **+ Add → Visualization**
7. Paste the SQL queries from the panel descriptions above, one per panel
8. For each panel, choose its visualization type and configure as
   described above.

## IAM setup for the Grafana user

```bash
# Create dedicated user (do NOT reuse personal credentials)
aws iam create-user --user-name grafana-athena-reader

# Read access to Athena and S3
aws iam attach-user-policy \
  --user-name grafana-athena-reader \
  --policy-arn arn:aws:iam::aws:policy/AmazonAthenaFullAccess

aws iam attach-user-policy \
  --user-name grafana-athena-reader \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Write access ONLY to the athena-results/ prefix (least privilege)
aws iam put-user-policy \
  --user-name grafana-athena-reader \
  --policy-name S3WriteAthenaResults \
  --policy-document file://grafana-s3-write.json

# Generate access keys to paste into Grafana
aws iam create-access-key --user-name grafana-athena-reader
```

The inline policy `grafana-s3-write.json` should grant `s3:PutObject` and
`s3:DeleteObject` scoped to `arn:aws:s3:::<bucket>/athena-results/*` only —
not to the entire bucket, and not to other prefixes.
