"""
Export Supabase tables to CSV for the AWS analytics pipeline.

Uses paginated reads to handle large tables (Supabase caps responses
at 1,000 rows per request). Outputs go to analytics/data/raw/<table>.csv.

Credentials are read from environment variables — never hardcoded.

Usage:
    export SUPABASE_URL='https://<project>.supabase.co'
    export SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
    python export/export_supabase.py
"""

import os
import sys
from pathlib import Path

from supabase import create_client


# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

TABLES = [
    "telemetry_readings",
    "events",
    "incidents",
    "anomalies",
]

PAGE_SIZE = 1000  # Supabase per-request limit
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "raw"


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.")
        print("   Run:")
        print("     export SUPABASE_URL='https://<project>.supabase.co'")
        print("     export SUPABASE_SERVICE_ROLE_KEY='<key>'")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"🔗 Connected to Supabase: {SUPABASE_URL}")
    print(f"📁 Writing to: {OUTPUT_DIR}\n")

    for table in TABLES:
        print(f"📥 Exporting: {table}")
        all_rows = []
        offset = 0

        while True:
            response = (
                client.table(table)
                .select("*")
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )

            batch = response.data
            if not batch:
                break

            all_rows.extend(batch)
            print(f"   batch {offset // PAGE_SIZE + 1}: "
                  f"{len(batch)} rows (running total: {len(all_rows)})")

            if len(batch) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

        if not all_rows:
            print(f"   ⚠️  table is empty: {table}\n")
            continue

        # Import pandas lazily so the script can fail fast on missing env vars
        import pandas as pd
        df = pd.DataFrame(all_rows)
        output_path = OUTPUT_DIR / f"{table}.csv"
        df.to_csv(output_path, index=False)
        print(f"   ✅ wrote {len(df):,} rows → {output_path.name}\n")

    print("🎉 Export complete.")


if __name__ == "__main__":
    main()
