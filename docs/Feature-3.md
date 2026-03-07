# Feature 3: Anomaly & Risk Detection

## Overview

Intelligence layer that monitors telemetry streams and detects anomalies, risks, or critical situations. Uses rule-based / threshold-based detection (no ML for POC). Generates alerts and risk scores. Implemented via Supabase Edge Functions or database triggers.

> **POC Scope:** All detection is deterministic and threshold-driven. Machine-learning-based anomaly detection is out of scope but the schema is designed so it can be added later without breaking changes.

---

## Assigned To

**Agent 3** — Senior Backend / Intelligence Engineer

---

## User Stories

| # | Role | Story | Priority |
|---|------|-------|----------|
| US-3.1 | Dispatcher | I want to be alerted when a vehicle has a critical issue so I can reassign or dispatch support | Must-have |
| US-3.2 | Operator | I want to see warnings about my vehicle's condition so I can take preventive action | Must-have |
| US-3.3 | Fleet Manager | I want to see a risk overview across all vehicles so I can prioritize maintenance | Must-have |
| US-3.4 | Admin | I want to configure detection thresholds so the system adapts to different operational contexts | Should-have |

---

## Key Capabilities

### Threshold-Based Anomaly Detection Rules

The following default rules ship with the POC seed data. All thresholds are configurable at runtime via the `detection_rules` table.

| Metric | Warning Threshold | Critical Threshold | Notes |
|--------|-------------------|---------------------|-------|
| Engine temperature | — | > 110 °C | Immediate critical alert |
| Fuel level | < 15 % | < 5 % | Two-tier alert |
| Tire pressure | < 28 psi | < 22 psi | Per-tire if data available |
| Speed | > 160 km/h | — | Even for emergency vehicles |
| Battery voltage | < 11.5 V | — | Warning only in POC |
| Oil pressure | Outside normal range | — | Range defined per vehicle type |
| Route deviation | — | — | > 2 km from expected path triggers **info** |

### Risk Scoring

Each vehicle carries a **risk score** from **0** (healthy) to **100** (critical). The score is recalculated every time an anomaly is created or resolved.

**Scoring algorithm (POC):**

```
risk_score = min(100, SUM of severity weights for all ACTIVE anomalies)

Severity weights:
  info     =  5
  warning  = 20
  critical = 40
```

If no active anomalies exist, the score resets to **0**.

### Alert Lifecycle

```
┌──────────┐    acknowledge    ┌──────────────┐    resolve    ┌──────────┐
│  active   │ ───────────────► │ acknowledged  │ ────────────► │ resolved │
└──────────┘                   └──────────────┘               └──────────┘
      │                                                             ▲
      └─────────────────── auto-resolve ────────────────────────────┘
            (when metric returns to normal range)
```

- **Active** — just detected, no human interaction yet.
- **Acknowledged** — a user has seen and accepted the alert.
- **Resolved** — the underlying condition is no longer present, or a user manually resolved it.

### Additional Capabilities

- Alert generation with severity levels: `info`, `warning`, `critical`.
- Historical anomaly log — all anomalies are persisted; resolved anomalies remain queryable.
- Configurable thresholds per vehicle type (e.g., ambulance vs. fire truck may have different engine temp limits).

---

## Detection Engine

The detection pipeline runs **synchronously on every telemetry INSERT**. Two implementation strategies are acceptable for the POC; choose based on deployment constraints.

### Option A: Supabase Database Function (PL/pgSQL trigger) — Recommended

```
telemetry_readings INSERT
        │
        ▼
 pg_trigger (AFTER INSERT)
        │
        ▼
 detect_anomalies(NEW.vehicle_id, NEW.metric_type, NEW.value)
        │
        ├──► Lookup matching detection_rules for metric_type + vehicle_type
        ├──► Compare value against min_value / max_value
        ├──► INSERT into anomalies if threshold breached
        ├──► UPDATE vehicles SET risk_score = recalculate(vehicle_id)
        └──► pg_notify('anomaly_channel', payload)  ← picked up by Supabase Realtime
```

**Advantages:** Zero additional infrastructure, runs inside the database transaction, guaranteed consistency.

### Option B: Supabase Edge Function (Deno)

```
telemetry_readings INSERT (via API)
        │
        ▼
 Edge Function: /functions/v1/detect-anomalies
        │
        ├──► Query detection_rules from Supabase
        ├──► Evaluate reading against rules
        ├──► Insert anomaly record via Supabase client
        ├──► Update vehicle risk_score
        └──► Broadcast via Supabase Realtime channel
```

**Advantages:** Easier to debug and test locally, supports more complex logic if needed later.

### Detection Logic (Pseudocode)

```sql
-- For each incoming telemetry reading:
SELECT * FROM detection_rules
WHERE metric_type = NEW.metric_type
  AND is_active = true
  AND (vehicle_type IS NULL OR vehicle_type = (
    SELECT type FROM vehicles WHERE id = NEW.vehicle_id
  ));

-- For each matching rule:
IF (rule.max_value IS NOT NULL AND NEW.value > rule.max_value)
   OR (rule.min_value IS NOT NULL AND NEW.value < rule.min_value)
THEN
  INSERT INTO anomalies (...);
  -- Recalculate risk score
  UPDATE vehicles
  SET risk_score = (
    SELECT LEAST(100, COALESCE(SUM(
      CASE severity
        WHEN 'info' THEN 5
        WHEN 'warning' THEN 20
        WHEN 'critical' THEN 40
      END
    ), 0))
    FROM anomalies
    WHERE vehicle_id = NEW.vehicle_id AND status = 'active'
  )
  WHERE id = NEW.vehicle_id;
END IF;
```

---

## Supabase Tables

### `anomalies`

Stores every detected anomaly. Rows are never deleted; resolved anomalies serve as historical log.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique anomaly identifier |
| `vehicle_id` | `uuid` | FK → `vehicles.id`, NOT NULL | Vehicle that triggered the anomaly |
| `telemetry_reading_id` | `uuid` | FK → `telemetry_readings.id`, nullable | The specific reading that caused detection (nullable for manual entries) |
| `anomaly_type` | `text` | NOT NULL | One of: `threshold_breach`, `pattern_anomaly`, `route_deviation` |
| `metric_type` | `text` | NOT NULL | e.g., `engine_temp`, `fuel_level`, `tire_pressure`, `speed`, `battery_voltage`, `oil_pressure`, `route_deviation` |
| `expected_range` | `jsonb` | NOT NULL | `{ "min": <number or null>, "max": <number or null> }` |
| `actual_value` | `numeric` | NOT NULL | The value that triggered the anomaly |
| `severity` | `text` | NOT NULL | One of: `info`, `warning`, `critical` |
| `status` | `text` | NOT NULL, default `'active'` | One of: `active`, `acknowledged`, `resolved` |
| `description` | `text` | NOT NULL | Human-readable description, e.g., "Engine temperature exceeded 110°C (actual: 118°C)" |
| `timestamp` | `timestamptz` | NOT NULL, default `now()` | When the anomaly was detected |
| `resolved_at` | `timestamptz` | nullable | When the anomaly was resolved |

**Indexes:**

```sql
CREATE INDEX idx_anomalies_vehicle_id ON anomalies (vehicle_id);
CREATE INDEX idx_anomalies_status ON anomalies (status);
CREATE INDEX idx_anomalies_severity ON anomalies (severity);
CREATE INDEX idx_anomalies_timestamp ON anomalies (timestamp DESC);
CREATE INDEX idx_anomalies_vehicle_status ON anomalies (vehicle_id, status);
```

**RLS Policies:**

- Authenticated users can SELECT anomalies for vehicles they have access to.
- Only the detection engine (service role) can INSERT.
- Authenticated users can UPDATE `status` and `resolved_at` (for acknowledge/resolve workflow).

### `detection_rules`

Configurable rules that drive the detection engine. Seeded with default thresholds.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique rule identifier |
| `vehicle_type` | `text` | nullable | If NULL, rule applies to all vehicle types. Otherwise matches `vehicles.type`. |
| `metric_type` | `text` | NOT NULL | The telemetry metric this rule evaluates |
| `min_value` | `numeric` | nullable | Lower bound — breach if reading < min_value |
| `max_value` | `numeric` | nullable | Upper bound — breach if reading > max_value |
| `severity` | `text` | NOT NULL | Severity assigned when this rule fires: `info`, `warning`, `critical` |
| `description` | `text` | NOT NULL | Human-readable explanation of the rule |
| `is_active` | `boolean` | NOT NULL, default `true` | Toggle to enable/disable without deleting |

**Indexes:**

```sql
CREATE INDEX idx_detection_rules_metric ON detection_rules (metric_type);
CREATE INDEX idx_detection_rules_active ON detection_rules (is_active) WHERE is_active = true;
```

**RLS Policies:**

- Authenticated users can SELECT all rules.
- Only admin role can INSERT, UPDATE, DELETE.

### Modification to `vehicles` Table

Add the following column to the existing `vehicles` table (owned by Feature 1):

```sql
ALTER TABLE vehicles ADD COLUMN risk_score integer NOT NULL DEFAULT 0
  CHECK (risk_score >= 0 AND risk_score <= 100);
```

---

## Seed Data: Default Detection Rules

```sql
INSERT INTO detection_rules (vehicle_type, metric_type, min_value, max_value, severity, description) VALUES
  (NULL, 'engine_temp',      NULL,  110,   'critical', 'Engine temperature exceeds 110°C'),
  (NULL, 'fuel_level',       5,     NULL,  'critical', 'Fuel level below 5%'),
  (NULL, 'fuel_level',       15,    NULL,  'warning',  'Fuel level below 15%'),
  (NULL, 'tire_pressure',    22,    NULL,  'critical', 'Tire pressure below 22 psi'),
  (NULL, 'tire_pressure',    28,    NULL,  'warning',  'Tire pressure below 28 psi'),
  (NULL, 'speed',            NULL,  160,   'warning',  'Speed exceeds 160 km/h'),
  (NULL, 'battery_voltage',  11.5,  NULL,  'warning',  'Battery voltage below 11.5V'),
  (NULL, 'oil_pressure',     25,    65,    'warning',  'Oil pressure outside normal range (25-65 psi)'),
  (NULL, 'route_deviation',  NULL,  2,     'info',     'Route deviation exceeds 2 km from expected path');
```

---

## UI Components

### `AlertBanner`

- **Location:** Top of every page (layout-level).
- **Behavior:** Displays the most severe active, unacknowledged alert across the fleet. Automatically appears/disappears via Supabase Realtime subscription.
- **Visual:**
  - `critical` — red background, white text, pulsing icon.
  - `warning` — amber background, dark text.
  - `info` — blue background, dark text.
- **Actions:** "View" navigates to the anomaly detail; "Acknowledge" transitions status.

### `AnomalyList`

- Filterable, sortable table of anomalies for a specific vehicle.
- Filters: severity, status, metric type, date range.
- Columns: timestamp, metric type, severity badge, actual value, expected range, status, actions.
- Actions per row: Acknowledge, Resolve (based on current status).

### `RiskScoreBadge`

- Compact badge showing the vehicle's current risk score.
- Color scale:
  - 0–20: green
  - 21–50: yellow
  - 51–75: orange
  - 76–100: red
- Used on vehicle cards, vehicle detail pages, and fleet overview.

### `DetectionRulesTable`

- Admin-only component.
- Displays all detection rules with inline editing.
- Columns: vehicle type (or "All"), metric type, min, max, severity, active toggle, description.
- Supports adding new rules and deactivating existing ones.

### `AnomalyTimeline`

- Chronological vertical timeline of anomalies for a vehicle.
- Each entry shows: timestamp, severity icon, description, status.
- Resolved anomalies shown with muted styling.
- Useful on the vehicle detail page for at-a-glance history.

---

## Pages / Routes

### `/alerts`

- **Purpose:** Fleet-wide active alerts dashboard.
- **Content:** All active and acknowledged anomalies across all vehicles, sorted by severity (critical first) then timestamp (newest first).
- **Features:** Bulk acknowledge, filter by severity/vehicle, real-time updates.

### `/dashboard/vehicle/[id]/anomalies`

- **Purpose:** Anomaly history and current status for a specific vehicle.
- **Content:** `AnomalyList` + `AnomalyTimeline` + `RiskScoreBadge`.
- **Features:** Full CRUD on anomaly status, historical view.

### `/admin/detection-rules`

- **Purpose:** Admin configuration of detection thresholds.
- **Content:** `DetectionRulesTable`.
- **Access:** Admin role only (enforced by Feature 8 auth).

---

## API Endpoints

### `GET /api/anomalies`

Query anomalies with optional filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vehicle_id` | `uuid` | No | Filter by vehicle |
| `severity` | `string` | No | Filter by severity: `info`, `warning`, `critical` |
| `status` | `string` | No | Filter by status: `active`, `acknowledged`, `resolved` |
| `limit` | `integer` | No | Max results (default 50) |
| `offset` | `integer` | No | Pagination offset (default 0) |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "vehicle_id": "uuid",
      "telemetry_reading_id": "uuid | null",
      "anomaly_type": "threshold_breach",
      "metric_type": "engine_temp",
      "expected_range": { "min": null, "max": 110 },
      "actual_value": 118.5,
      "severity": "critical",
      "status": "active",
      "description": "Engine temperature exceeded 110°C (actual: 118.5°C)",
      "timestamp": "2025-01-15T14:32:00Z",
      "resolved_at": null
    }
  ],
  "count": 1
}
```

### `PATCH /api/anomalies/[id]/acknowledge`

Acknowledge an active alert.

**Request Body:** None required (optionally accepts `{ "note": "string" }` for future use).

**Response:** `200 OK` — returns updated anomaly object.

**Error:** `400` if anomaly is not in `active` status.

### `PATCH /api/anomalies/[id]/resolve`

Resolve an anomaly (manually or via auto-resolve).

**Request Body:** None required.

**Response:** `200 OK` — returns updated anomaly object with `resolved_at` set.

**Error:** `400` if anomaly is already `resolved`.

### `GET /api/detection-rules`

List all detection rules.

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "vehicle_type": null,
      "metric_type": "engine_temp",
      "min_value": null,
      "max_value": 110,
      "severity": "critical",
      "description": "Engine temperature exceeds 110°C",
      "is_active": true
    }
  ]
}
```

### `PUT /api/detection-rules/[id]`

Update a detection rule. Admin only.

**Request Body:**

```json
{
  "min_value": 100,
  "max_value": 115,
  "severity": "critical",
  "is_active": true
}
```

**Response:** `200 OK` — returns updated rule object.

**Error:** `403` if user is not admin.

---

## Real-Time Integration

### Supabase Realtime Channels

```typescript
// Client-side subscription for live anomaly alerts
const channel = supabase
  .channel('anomalies')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'anomalies',
    },
    (payload) => {
      // Show alert banner, play sound for critical, update anomaly list
      handleNewAnomaly(payload.new);
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'anomalies',
    },
    (payload) => {
      // Update anomaly status in UI (acknowledged, resolved)
      handleAnomalyUpdate(payload.new);
    }
  )
  .subscribe();
```

### Vehicle Risk Score Updates

```typescript
// Subscribe to vehicle risk score changes
const vehicleChannel = supabase
  .channel('vehicle-risk')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'vehicles',
      filter: 'risk_score=neq.0', // Only non-zero changes
    },
    (payload) => {
      updateRiskScoreBadge(payload.new.id, payload.new.risk_score);
    }
  )
  .subscribe();
```

---

## Acceptance Criteria

- [ ] Anomalies are automatically detected when telemetry exceeds thresholds
- [ ] Detection runs on every telemetry INSERT (via trigger or edge function)
- [ ] Alerts appear in real-time on the dashboard (< 2 second latency)
- [ ] Risk score updates when anomalies are created or resolved
- [ ] Risk score correctly sums severity weights and caps at 100
- [ ] Alerts can be acknowledged and resolved via API and UI
- [ ] Detection rules are configurable by admin users
- [ ] Non-admin users cannot modify detection rules
- [ ] Different severity levels are visually distinct (color-coded)
- [ ] Historical anomalies are preserved and queryable
- [ ] Default detection rules are seeded on initial deployment
- [ ] Auto-resolve fires when a subsequent reading falls back within normal range

---

## Dependencies

| Dependency | Feature | Reason |
|------------|---------|--------|
| Telemetry data stream | Feature 2 (Telemetry) | Anomaly detection is triggered by incoming telemetry readings |
| Dashboard shell & vehicle cards | Feature 1 (Dashboard) | Alert banner and risk score badge are displayed within the dashboard |
| Auth & role management | Feature 8 (Auth) | Admin-only access to detection rule configuration |

---

## File Structure (Suggested)

```
src/
├── app/
│   ├── alerts/
│   │   └── page.tsx                  # Fleet-wide alerts page
│   ├── dashboard/vehicle/[id]/
│   │   └── anomalies/
│   │       └── page.tsx              # Vehicle-specific anomaly view
│   ├── admin/
│   │   └── detection-rules/
│   │       └── page.tsx              # Admin rule management
│   └── api/
│       ├── anomalies/
│       │   ├── route.ts              # GET /api/anomalies
│       │   └── [id]/
│       │       ├── acknowledge/
│       │       │   └── route.ts      # PATCH acknowledge
│       │       └── resolve/
│       │           └── route.ts      # PATCH resolve
│       └── detection-rules/
│           ├── route.ts              # GET /api/detection-rules
│           └── [id]/
│               └── route.ts          # PUT /api/detection-rules/[id]
├── components/
│   ├── alerts/
│   │   ├── AlertBanner.tsx
│   │   ├── AnomalyList.tsx
│   │   ├── AnomalyTimeline.tsx
│   │   └── RiskScoreBadge.tsx
│   └── admin/
│       └── DetectionRulesTable.tsx
├── hooks/
│   ├── useAnomalies.ts               # Fetch + real-time anomaly subscription
│   └── useDetectionRules.ts          # Fetch + mutate detection rules
├── lib/
│   └── detection/
│       ├── engine.ts                 # Core detection logic (shared by trigger & edge fn)
│       └── risk-score.ts             # Risk score calculation
└── types/
    └── anomaly.ts                    # TypeScript types for anomalies & rules

supabase/
├── migrations/
│   ├── XXXXXX_create_anomalies.sql
│   ├── XXXXXX_create_detection_rules.sql
│   ├── XXXXXX_add_risk_score_to_vehicles.sql
│   └── XXXXXX_create_detect_anomalies_trigger.sql
├── functions/
│   └── detect-anomalies/
│       └── index.ts                  # Edge Function (Option B)
└── seed.sql                          # Default detection rules
```

---

## Testing Strategy

| Test Type | What to Test | Tool |
|-----------|-------------|------|
| Unit | Risk score calculation with various anomaly combinations | Jest / Vitest |
| Unit | Detection logic: value vs. threshold comparison edge cases | Jest / Vitest |
| Integration | Telemetry INSERT triggers anomaly creation | Supabase local (Docker) |
| Integration | Acknowledge and resolve API endpoints update status correctly | Supertest / Playwright API |
| E2E | Alert banner appears when critical anomaly is injected | Playwright |
| E2E | Admin can modify a detection rule and new threshold takes effect | Playwright |

---

## Open Questions / Future Considerations

1. **Rate limiting:** Should we suppress duplicate anomalies if the same metric breaches on consecutive readings? (Recommended: yes — deduplicate within a 5-minute window.)
2. **Notification channels:** POC is UI-only. Future: email, SMS, push notifications.
3. **ML upgrade path:** The `anomaly_type` field supports `pattern_anomaly` for future ML-based detection that can coexist with threshold rules.
4. **Composite rules:** e.g., "engine temp > 100 AND oil pressure < 30" — out of scope for POC but the rule schema can be extended with a `conditions` jsonb field.
