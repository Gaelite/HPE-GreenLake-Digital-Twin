# Data Quality Validation - Emergency Vehicles Digital Twin

**Role**: Data Quality Engineer  
**Author**: Eduardo Gael Garcia Zuviria
**Dataset**: Emergency vehicle telemetry and operations data

---

## Overview

Implements 9 validation rules to ensure data integrity and reliability across the emergency vehicles digital twin dataset.

**Validation Rules**:
- DQ-01: Primary Key Uniqueness (CRITICAL)
- DQ-02: Foreign Key Integrity (CRITICAL)
- DQ-03: Enum Value Validity (HIGH)
- DQ-04: Telemetry Value Ranges (CRITICAL)
- DQ-05: Timestamp Validity (HIGH)
- DQ-06: Required Field Completeness (CRITICAL)
- DQ-07: Risk Score Range (CRITICAL)
- DQ-08: Event Sequence Logic (MEDIUM)
- DQ-09: Geospatial Validity (HIGH)

---

## Execution

### Run Validation
```bash
python data_quality/validate.py
```

**Output**: JSON report in `data_quality/logs/validation_report_YYYYMMDD_HHMMSS.json`

### Generate HTML Report
```bash
python data_quality/generate_html.py
```

**Output**: HTML report in `data_quality/logs/validation_report_YYYYMMDD_HHMMSS.html`

---

## Latest Validation Results

**Execution Date**: 2026-05-17  
**Total Checks**: 61  
**Passed**: 60  
**Failed**: 1  
**Pass Rate**: 98.36%

### Critical Finding
- **Issue**: 45 orphaned foreign key references in `anomalies.telemetry_reading_id`
- **Impact**: Anomaly records reference non-existent telemetry readings
- **Severity**: CRITICAL (DQ-02 violation)
- **Recommendation**: Re-generate anomalies with valid FK references or implement CASCADE delete

---

## Demo Report (S3)

**Live HTML Report**:  
[https://emergency-vehicles-reports.s3.amazonaws.com/data-quality/html/validation_report_20260517_144921.html]

Example:
https://emergency-vehicles-reports.s3.amazonaws.com/data-quality/html/validation_report_20260517_140540.html

**Note**: Report uploaded manually for demonstration. In production, Role 4 (Orchestration Engineer) would automate S3 uploads via Lambda + EventBridge.

---

## Data Source

**Primary**: S3 Parquet files  
**Location**: `s3://emergency-vehicles-processed/processed/`  
**Format**: Parquet with Snappy compression  
**Partitioning**: `year=YYYY/month=MM/day=DD/data.parquet`

---

## Rule Documentation

See `rules.md` for complete documentation of each validation rule including:
- Business justification
- Validation logic
- Remediation steps
- Severity classification

---

## Integration

**Consumes**: Output from Role 1 (Data Engineer) - Parquet files in S3 processed zone  
**Produces**: Validation reports (JSON + HTML) demonstrating data quality metrics  
**Next Step**: Role 3 (Analytics Engineer) can confidently use validated data for insights
---

## S3 Upload (Optional - For Demo)

### Script: validate_and_upload.py

Automates the full pipeline: validation → HTML generation → S3 upload.

**Usage** (executed manually for demonstration):
```bash
python data_quality/validate_and_upload.py
```

**What it does**:
1. Runs `validate.py` (reads from S3, validates data)
2. Runs `generate_html.py` (creates HTML report)
3. Uploads JSON + HTML to `s3://emergency-vehicles-reports/`
4. Returns public URL for HTML report

**Execution**: Manual only (not scheduled)  
**Purpose**: Demonstration for stakeholders  
**Production**: Role 4 would implement this with Lambda + EventBridge

---

## Demo Report (S3)

**Live HTML Report**:  
https://emergency-vehicles-reports.s3.amazonaws.com/data-quality/html/validation_report_20260517_144921.html

**Uploaded**: 2026-05-17 14:44:54 UTC  
**Pass Rate**: 98.36% (60/61 checks passed)  
**Critical Finding**: 45 orphaned foreign key references detected

**Note**: This report was uploaded manually to demonstrate S3 integration capability. The HTML dashboard shows:
- Overall validation summary (61 checks across 9 rules)
- Pass/fail indicators for each validation check
- Detailed messages for failed checks
- Interactive visualization for stakeholder review

In a production environment, Role 4 (Orchestration Engineer) would automate this process using:
- AWS Lambda to execute the validation pipeline
- EventBridge to trigger daily at 3:10 AM
- SNS to send alerts if pass_rate < 95%
- S3 lifecycle policies to manage report retention

The scripts are ready for automation - just need the scheduling infrastructure.

---