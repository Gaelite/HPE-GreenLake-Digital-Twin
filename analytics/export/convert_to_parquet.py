"""
Convert combined CSVs to Parquet with strategic partitioning.

Strategy (see partitioning_decision.md for full rationale):

  - telemetry_readings: partitioned by (metric_type, dt)
      99% of analytical queries filter by metric_type and most also
      filter by date. metric_type has cardinality 8 → ideal first-level
      partition. dt grows linearly with time → good secondary partition.

  - events, incidents, anomalies: NOT partitioned.
      Combined size is under 1 MB. Partitioning would add overhead
      with no measurable query speedup. Rule of thumb: don't partition
      tables smaller than ~100 MB.

Output: data/processed/<table>/... ready to upload to S3.

Usage:
    python export/convert_to_parquet.py
"""

from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

DATA_DIR = Path(__file__).parent.parent / "data"
IN_DIR = DATA_DIR / "raw" / "combined"
OUT_DIR = DATA_DIR / "processed"
OUT_DIR.mkdir(exist_ok=True)


def convert_telemetry():
    """Largest table — partition by metric_type + dt."""
    print("📊 telemetry_readings (partitioned by metric_type + dt)")
    df = pd.read_csv(IN_DIR / "telemetry_readings.csv")
    print(f"   read: {len(df):,} rows")

    # Parse timestamps and derive the dt partition column
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
    df = df.dropna(subset=["timestamp"])
    df["dt"] = df["timestamp"].dt.strftime("%Y-%m-%d")

    # Force numeric types. Parquet and Athena are strict; an inferred
    # 'object' dtype for a numeric column will break queries later.
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df.dropna(subset=["value"])

    out_path = OUT_DIR / "telemetry_readings"
    out_path.mkdir(exist_ok=True)

    table = pa.Table.from_pandas(df, preserve_index=False)
    pq.write_to_dataset(
        table,
        root_path=str(out_path),
        partition_cols=["metric_type", "dt"],
        compression="snappy",  # good speed/size tradeoff, Athena-compatible
    )

    parquets = list(out_path.rglob("*.parquet"))
    total_bytes = sum(p.stat().st_size for p in parquets)
    csv_bytes = (IN_DIR / "telemetry_readings.csv").stat().st_size

    print(f"   → {len(parquets)} parquet files")
    print(f"   → {total_bytes / 1024 / 1024:.1f} MB total "
          f"(CSV was {csv_bytes / 1024 / 1024:.1f} MB)")
    compression_pct = (1 - total_bytes / csv_bytes) * 100
    print(f"   → {compression_pct:.0f}% size reduction\n")


def convert_simple(table_name):
    """Small tables — no partitioning."""
    print(f"📄 {table_name} (no partitioning)")
    df = pd.read_csv(IN_DIR / f"{table_name}.csv")
    print(f"   read: {len(df):,} rows")

    # Parse any timestamp-like columns
    for col in ("timestamp", "created_at", "reported_at", "resolved_at"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    out_path = OUT_DIR / table_name
    out_path.mkdir(exist_ok=True)

    table = pa.Table.from_pandas(df, preserve_index=False)
    pq.write_table(
        table,
        out_path / "data.parquet",
        compression="snappy",
    )
    size_kb = (out_path / "data.parquet").stat().st_size / 1024
    print(f"   → 1 parquet file ({size_kb:.1f} KB)\n")


def main():
    print("🔄 Converting CSV → Parquet\n")
    convert_telemetry()
    convert_simple("events")
    convert_simple("incidents")
    convert_simple("anomalies")
    print("🎉 Conversion complete.\n")
    print("📦 Next step: upload data/processed/ to s3://<bucket>/processed/")


if __name__ == "__main__":
    main()
