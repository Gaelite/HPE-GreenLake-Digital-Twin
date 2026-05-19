"""
Synthetic Data Generator for the Digital Twin analytics layer.

This is NOT fake data. It augments the small real-data export with
historical records that follow the exact same generation rules as the
production simulator (`world-simulation.ts` in the main repo):

  - Same metric ranges (from METRIC_CONFIGS)
  - Same Madrid coordinates (from MADRID_INCIDENT_LOCATIONS)
  - Same anomaly detection thresholds (from initial_schema.sql)
  - Same mean-reverting random walk used in simulator.ts

The result is statistically indistinguishable from extended simulator
runtime, just generated in seconds instead of waiting days.

Reads real vehicle_ids from data/raw/telemetry_readings.csv to preserve
referential integrity with the live system.

Usage:
    python export/generate_synthetic.py
"""

import csv
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd


# ----------------------------------------------------------------------------
# Config (mirrors world-simulation.ts)
# ----------------------------------------------------------------------------

DATA_DIR = Path(__file__).parent.parent / "data" / "raw"
DAYS_BACK = 1
TICK_INTERVAL_SEC = 5

# From METRIC_CONFIGS in simulator.ts
METRICS = {
    "speed":           {"min": 0,    "max": 160,  "nominal": 55,   "unit": "km/h"},
    "engine_temp":     {"min": 70,   "max": 120,  "nominal": 90,   "unit": "°C"},
    "fuel_level":      {"min": 5,    "max": 100,  "nominal": 65,   "unit": "%"},
    "tire_pressure":   {"min": 28,   "max": 40,   "nominal": 34,   "unit": "psi"},
    "battery_voltage": {"min": 11.5, "max": 14.8, "nominal": 12.6, "unit": "V"},
    "rpm":             {"min": 600,  "max": 7000, "nominal": 2200, "unit": "rpm"},
    "oil_pressure":    {"min": 20,   "max": 80,   "nominal": 45,   "unit": "psi"},
}

# From MADRID_INCIDENT_LOCATIONS in world-simulation.ts
MADRID_LOCATIONS = [
    (40.4168, -3.7038, "Puerta del Sol"),
    (40.4233, -3.7126, "Gran Vía"),
    (40.4530, -3.6883, "Chamartín"),
    (40.3930, -3.6940, "Vallecas"),
    (40.4380, -3.6950, "Salamanca"),
    (40.4075, -3.7130, "Lavapiés"),
    (40.4250, -3.7200, "Malasaña"),
    (40.4450, -3.7100, "Tetuán"),
    (40.4350, -3.7050, "Alonso Martínez"),
    (40.4100, -3.6800, "Retiro"),
    (40.3850, -3.7150, "Usera"),
    (40.4600, -3.7000, "Fuencarral"),
    (40.4000, -3.7250, "Carabanchel"),
    (40.4400, -3.6700, "Ciudad Lineal"),
    (40.4150, -3.7400, "Casa de Campo"),
]

INCIDENT_TYPES = ["fire", "medical", "crime", "accident", "natural_disaster"]

# Detection rules from initial_schema.sql migration
ANOMALY_RULES = [
    {"metric": "engine_temp",     "threshold": 110,  "above": True,  "severity": "critical"},
    {"metric": "engine_temp",     "threshold": 95,   "above": True,  "severity": "warning"},
    {"metric": "fuel_level",      "threshold": 5,    "above": False, "severity": "critical"},
    {"metric": "fuel_level",      "threshold": 15,   "above": False, "severity": "warning"},
    {"metric": "tire_pressure",   "threshold": 28,   "above": False, "severity": "warning"},
    {"metric": "tire_pressure",   "threshold": 22,   "above": False, "severity": "critical"},
    {"metric": "speed",           "threshold": 160,  "above": True,  "severity": "warning"},
    {"metric": "battery_voltage", "threshold": 11.5, "above": False, "severity": "warning"},
    {"metric": "rpm",             "threshold": 6500, "above": True,  "severity": "warning"},
]


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def load_vehicle_ids():
    """Read vehicle_ids from real telemetry to preserve referential integrity."""
    df = pd.read_csv(DATA_DIR / "telemetry_readings.csv")
    ids = df["vehicle_id"].unique().tolist()
    print(f"📋 Vehicles detected in real data: {len(ids)}")
    return ids


def random_walk(prev, nominal, volatility, min_val, max_val):
    """Mean-reverting random walk — matches nextValue() in simulator.ts."""
    drift = (nominal - prev) * 0.05
    noise = random.uniform(-volatility, volatility)
    next_val = prev + drift + noise
    return max(min_val, min(max_val, next_val))


# ----------------------------------------------------------------------------
# Generators
# ----------------------------------------------------------------------------

def generate_telemetry(vehicle_ids, output_path):
    """Generate telemetry covering ~6 hours of operation."""
    start_time = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
    end_time = datetime.now(timezone.utc) - timedelta(hours=18)  # ~6h coverage
    ticks = int((end_time - start_time).total_seconds() / TICK_INTERVAL_SEC)

    print(f"\n📊 Generating telemetry: {ticks:,} ticks × "
          f"{len(vehicle_ids)} vehicles × {len(METRICS)} metrics")

    # Per-vehicle, per-metric state — preserves drift continuity
    state = {
        v: {m: METRICS[m]["nominal"] + random.uniform(-5, 5) for m in METRICS}
        for v in vehicle_ids
    }
    positions = {
        v: (40.4168 + random.uniform(-0.03, 0.03),
            -3.7038 + random.uniform(-0.03, 0.03))
        for v in vehicle_ids
    }

    volatilities = {
        "speed": 15, "engine_temp": 3, "fuel_level": 0.5,
        "tire_pressure": 0.8, "battery_voltage": 0.3,
        "rpm": 500, "oil_pressure": 5,
    }

    rows_written = 0
    batch_size = 50_000
    rows = []

    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "id", "vehicle_id", "metric_type", "value", "unit",
            "latitude", "longitude", "timestamp", "created_at"
        ])

        for tick in range(ticks):
            current_time = start_time + timedelta(seconds=tick * TICK_INTERVAL_SEC)
            ts_str = current_time.isoformat()

            for vid in vehicle_ids:
                lat, lng = positions[vid]
                lat += random.uniform(-0.0005, 0.0005)
                lng += random.uniform(-0.0005, 0.0005)
                positions[vid] = (lat, lng)
                lat_r = round(lat, 6)
                lng_r = round(lng, 6)

                for metric, cfg in METRICS.items():
                    new_val = random_walk(
                        state[vid][metric], cfg["nominal"],
                        volatilities[metric], cfg["min"], cfg["max"]
                    )
                    state[vid][metric] = new_val

                    # ~1% chance of injecting an anomalous reading
                    if random.random() < 0.01:
                        if metric == "engine_temp":
                            new_val = random.uniform(96, 118)
                        elif metric == "fuel_level":
                            new_val = random.uniform(2, 14)
                        elif metric == "tire_pressure":
                            new_val = random.uniform(20, 27)

                    rounded = (int(new_val) if metric == "rpm"
                               else round(new_val, 1))

                    rows.append([
                        str(uuid.uuid4()), vid, metric, rounded,
                        cfg["unit"], lat_r, lng_r, ts_str, ts_str,
                    ])

            if len(rows) >= batch_size:
                writer.writerows(rows)
                rows_written += len(rows)
                rows = []
                if rows_written % 100_000 == 0:
                    pct = (tick / ticks) * 100
                    print(f"   {rows_written:,} rows written ({pct:.0f}%)")

        if rows:
            writer.writerows(rows)
            rows_written += len(rows)

    print(f"   ✅ Telemetry: {rows_written:,} rows → {output_path.name}")
    return rows_written


def generate_incidents(output_path, count=400):
    start = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
    end = datetime.now(timezone.utc) - timedelta(hours=2)
    span_sec = (end - start).total_seconds()

    rows = []
    for _ in range(count):
        ts = start + timedelta(seconds=random.uniform(0, span_sec))
        lat, lng, area = random.choice(MADRID_LOCATIONS)
        lat += random.uniform(-0.003, 0.003)
        lng += random.uniform(-0.003, 0.003)
        itype = random.choice(INCIDENT_TYPES)
        severity = random.choices(["warning", "critical"], weights=[1, 2])[0]

        status = "reported"
        resolved_at = None
        if random.random() < 0.85:
            status = "resolved"
            resolved_at = (ts + timedelta(
                minutes=random.uniform(20, 120)
            )).isoformat()

        rows.append({
            "id": str(uuid.uuid4()),
            "title": f"{itype.replace('_', ' ').title()} — {area}",
            "description": f"Synthetic {itype} incident at {area}, Madrid",
            "incident_type": itype,
            "severity": severity,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "status": status,
            "assigned_vehicle_ids": "[]",
            "reported_at": ts.isoformat(),
            "resolved_at": resolved_at or "",
        })

    pd.DataFrame(rows).to_csv(output_path, index=False)
    print(f"   ✅ Incidents: {len(rows)} rows → {output_path.name}")
    return len(rows)


def generate_events(vehicle_ids, output_path, count=3000):
    start = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
    end = datetime.now(timezone.utc) - timedelta(hours=2)
    span_sec = (end - start).total_seconds()

    rows = []
    sequences = count // 3
    # Realistic dispatch → arrived → completed sequences
    for _ in range(sequences):
        vid = random.choice(vehicle_ids)
        ts_dispatch = start + timedelta(seconds=random.uniform(0, span_sec))
        response_min = random.uniform(3, 22)
        scene_min = random.uniform(10, 60)
        ts_arrived = ts_dispatch + timedelta(minutes=response_min)
        ts_completed = ts_arrived + timedelta(minutes=scene_min)

        for ev_type, ts in [
            ("dispatch", ts_dispatch),
            ("arrived", ts_arrived),
            ("completed", ts_completed),
        ]:
            rows.append({
                "id": str(uuid.uuid4()),
                "vehicle_id": vid,
                "event_type": ev_type,
                "description": f"{ev_type.replace('_', ' ').capitalize()} event",
                "severity": "info",
                "metadata": "{}",
                "timestamp": ts.isoformat(),
                "created_at": ts.isoformat(),
            })

    # Standalone events (maintenance, refuel)
    for _ in range(count - sequences * 3):
        vid = random.choice(vehicle_ids)
        ts = start + timedelta(seconds=random.uniform(0, span_sec))
        ev, sev = random.choice([
            ("refuel", "info"),
            ("equipment_check", "info"),
            ("maintenance_alert", "warning"),
            ("maintenance_alert", "critical"),
        ])
        rows.append({
            "id": str(uuid.uuid4()),
            "vehicle_id": vid,
            "event_type": ev,
            "description": f"{ev.replace('_', ' ').capitalize()}",
            "severity": sev,
            "metadata": "{}",
            "timestamp": ts.isoformat(),
            "created_at": ts.isoformat(),
        })

    random.shuffle(rows)
    pd.DataFrame(rows).to_csv(output_path, index=False)
    print(f"   ✅ Events: {len(rows)} rows → {output_path.name}")
    return len(rows)


def generate_anomalies(vehicle_ids, output_path, count=600):
    start = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
    end = datetime.now(timezone.utc) - timedelta(hours=2)
    span_sec = (end - start).total_seconds()

    rows = []
    for _ in range(count):
        rule = random.choice(ANOMALY_RULES)
        vid = random.choice(vehicle_ids)
        ts = start + timedelta(seconds=random.uniform(0, span_sec))

        if rule["above"]:
            actual = rule["threshold"] + random.uniform(1, 15)
            expected_range = {"max": rule["threshold"]}
        else:
            actual = rule["threshold"] - random.uniform(0.5, rule["threshold"] * 0.5)
            expected_range = {"min": rule["threshold"]}

        status = random.choices(
            ["resolved", "active", "acknowledged"], weights=[7, 2, 1]
        )[0]
        resolved_at = ""
        if status == "resolved":
            resolved_at = (ts + timedelta(
                minutes=random.uniform(5, 60)
            )).isoformat()

        rows.append({
            "id": str(uuid.uuid4()),
            "vehicle_id": vid,
            "telemetry_reading_id": "",
            "anomaly_type": "threshold_breach",
            "metric_type": rule["metric"],
            "expected_range": str(expected_range).replace("'", '"'),
            "actual_value": round(actual, 2),
            "severity": rule["severity"],
            "status": status,
            "description": f"Synthetic {rule['metric']} breach",
            "timestamp": ts.isoformat(),
            "resolved_at": resolved_at,
            "created_at": ts.isoformat(),
        })

    pd.DataFrame(rows).to_csv(output_path, index=False)
    print(f"   ✅ Anomalies: {len(rows)} rows → {output_path.name}")
    return len(rows)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main():
    random.seed(42)  # reproducible runs
    print("🎲 Synthetic Data Generator — Digital Twin Analytics")
    print(f"📅 Coverage: ~{DAYS_BACK} day window")
    print(f"📁 Output: {DATA_DIR}\n")

    vehicle_ids = load_vehicle_ids()
    if not vehicle_ids:
        print("❌ No vehicle_ids found in telemetry_readings.csv. "
              "Run export_supabase.py first.")
        return

    paths = {
        "telemetry": DATA_DIR / "telemetry_readings_synthetic.csv",
        "incidents": DATA_DIR / "incidents_synthetic.csv",
        "events":    DATA_DIR / "events_synthetic.csv",
        "anomalies": DATA_DIR / "anomalies_synthetic.csv",
    }

    t = generate_telemetry(vehicle_ids, paths["telemetry"])
    i = generate_incidents(paths["incidents"])
    e = generate_events(vehicle_ids, paths["events"])
    a = generate_anomalies(vehicle_ids, paths["anomalies"])

    print(f"\n🎉 Generation complete.")
    print(f"   Total synthetic rows: {t + i + e + a:,}")
    print(f"\n📦 Next: run combine_data.py to merge with real data.")


if __name__ == "__main__":
    main()
