"""
Combine real exported data with synthetic historical data.

The real data covers ~1 hour of simulator operation (~7,400 telemetry
rows). The synthetic data covers a full day (~900,000 rows) using
the exact same generation rules as the simulator. Combining them gives
a dataset large enough to demonstrate partitioning impact while staying
faithful to the operational schema.

Output: data/raw/combined/<table>.csv (ready for S3 upload)

Usage:
    python export/combine_data.py
"""

from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data" / "raw"
OUT_DIR = DATA_DIR / "combined"
OUT_DIR.mkdir(exist_ok=True)

TABLES = ["telemetry_readings", "events", "incidents", "anomalies"]


def main():
    print("🔀 Merging real + synthetic data\n")
    summary = []

    for table in TABLES:
        real_path = DATA_DIR / f"{table}.csv"
        synth_path = DATA_DIR / f"{table}_synthetic.csv"
        out_path = OUT_DIR / f"{table}.csv"

        if not real_path.exists():
            print(f"⚠️  Skipping {table}: {real_path.name} not found")
            continue
        if not synth_path.exists():
            print(f"⚠️  Skipping {table}: {synth_path.name} not found")
            continue

        real = pd.read_csv(real_path)
        synth = pd.read_csv(synth_path)

        print(f"📥 {table}")
        print(f"   real:       {len(real):>8,} rows")
        print(f"   synthetic:  {len(synth):>8,} rows")

        # Both DataFrames have identical column structures by design
        combined = pd.concat([real, synth], ignore_index=True)

        # Sort by primary timestamp column — helps Parquet row-group locality
        if "timestamp" in combined.columns:
            combined["timestamp"] = pd.to_datetime(
                combined["timestamp"], errors="coerce", utc=True
            )
            combined = combined.sort_values("timestamp").reset_index(drop=True)
            combined["timestamp"] = combined["timestamp"].dt.strftime(
                "%Y-%m-%dT%H:%M:%S.%f%z"
            )
        elif "reported_at" in combined.columns:
            combined["reported_at"] = pd.to_datetime(
                combined["reported_at"], errors="coerce", utc=True
            )
            combined = combined.sort_values("reported_at").reset_index(drop=True)
            combined["reported_at"] = combined["reported_at"].dt.strftime(
                "%Y-%m-%dT%H:%M:%S.%f%z"
            )

        combined.to_csv(out_path, index=False)
        print(f"   ✅ combined: {len(combined):>8,} rows → {out_path.name}\n")

        summary.append((table, len(real), len(synth), len(combined)))

    print("=" * 60)
    print(f"{'Table':<25} {'Real':>10} {'Synth':>10} {'Total':>10}")
    print("=" * 60)
    grand_total = 0
    for table, r, s, t in summary:
        print(f"{table:<25} {r:>10,} {s:>10,} {t:>10,}")
        grand_total += t
    print("=" * 60)
    print(f"{'GRAND TOTAL':<25} {'':>10} {'':>10} {grand_total:>10,}")

    if grand_total >= 500_000:
        print(f"\n✅ Meets 500k row minimum (margin: {grand_total - 500_000:,})")
    else:
        print(f"\n❌ Below 500k minimum (short by {500_000 - grand_total:,})")


if __name__ == "__main__":
    main()
