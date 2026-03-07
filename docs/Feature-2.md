# Feature 2: Telemetry & Event Processing

## Overview

The data backbone of the digital twin. This feature handles ingestion, storage, and real-time distribution of **telemetry data** (sensor readings) and **discrete events** (dispatch, arrival, alerts). In the POC, data is simulated but the pipeline is real.

Telemetry flows through a single ingestion API, gets persisted to Supabase, and is immediately broadcast over Supabase Realtime channels so that every connected dashboard receives updates without polling.

---

## Assigned To

**Agent 2** — Senior Backend / Data Engineer

---

## User Stories

| # | Role | Story |
|---|------|-------|
| 1 | System | As the system, I need to ingest telemetry data from vehicles continuously so the digital twin stays in sync. |
| 2 | Developer | As a developer, I want a data simulator that generates realistic vehicle telemetry so I can demo and test without real hardware. |
| 3 | Dispatcher | As a dispatcher, I want to see events (dispatch, arrival) logged in real-time so I can monitor fleet operations. |
| 4 | Operator | As an operator, I want historical telemetry for troubleshooting so I can investigate past incidents. |

---

## Key Capabilities

- **Telemetry data ingestion** — API endpoint that accepts batches of sensor readings.
- **Event logging and processing** — API endpoint for discrete, typed events with severity levels.
- **Data simulator script** — Generates realistic telemetry for demo purposes.
- **Supabase Realtime broadcast** — New readings and events are pushed to subscribers instantly.
- **Historical data queries** — Time-range filtering with metric-type scoping.
- **Multiple metric types supported:**
  - `gps` (lat/lng)
  - `speed`
  - `engine_temp`
  - `fuel_level`
  - `tire_pressure`
  - `battery_voltage`
  - `rpm`
  - `oil_pressure`
- **Event types supported:**
  - `dispatch`
  - `en_route`
  - `arrived`
  - `completed`
  - `maintenance_alert`
  - `refuel`
  - `equipment_check`

---

## Supabase Tables

### `telemetry_readings`

Stores every individual sensor reading. High-write table — batch inserts are the norm.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `vehicle_id` | `uuid` | FK -> `vehicles.id`, NOT NULL | Links to Feature 6 fleet records |
| `metric_type` | `text` | NOT NULL | One of: `speed`, `engine_temp`, `fuel_level`, `tire_pressure`, `battery_voltage`, `rpm`, `oil_pressure`, `gps` |
| `value` | `numeric` | NOT NULL | The sensor value (for `gps`, store speed or 0; use lat/lng columns for position) |
| `unit` | `text` | NOT NULL | `km/h`, `°C`, `%`, `psi`, `V`, `rpm`, `kPa`, etc. |
| `latitude` | `numeric` | nullable | Present for every reading if GPS is available |
| `longitude` | `numeric` | nullable | Present for every reading if GPS is available |
| `timestamp` | `timestamptz` | NOT NULL | When the reading was taken on the vehicle |
| `created_at` | `timestamptz` | default `now()` | When the row was inserted into the DB |

**Indexes:**

```sql
CREATE INDEX idx_telemetry_vehicle_ts ON telemetry_readings (vehicle_id, timestamp DESC);
CREATE INDEX idx_telemetry_metric ON telemetry_readings (vehicle_id, metric_type, timestamp DESC);
```

### `events`

Stores discrete, typed events with severity and optional metadata.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `vehicle_id` | `uuid` | FK -> `vehicles.id`, NOT NULL | |
| `event_type` | `text` | NOT NULL | One of the supported event types listed above |
| `description` | `text` | NOT NULL | Human-readable description |
| `severity` | `text` | NOT NULL, default `'info'` | `info`, `warning`, or `critical` |
| `metadata` | `jsonb` | default `'{}'` | Arbitrary structured data (e.g., incident details, coordinates, related vehicle IDs) |
| `timestamp` | `timestamptz` | NOT NULL | When the event occurred |
| `created_at` | `timestamptz` | default `now()` | When the row was inserted |

**Indexes:**

```sql
CREATE INDEX idx_events_vehicle_ts ON events (vehicle_id, timestamp DESC);
CREATE INDEX idx_events_type ON events (event_type, timestamp DESC);
```

### SQL Migration

```sql
-- telemetry_readings
CREATE TABLE telemetry_readings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  value       numeric NOT NULL,
  unit        text NOT NULL,
  latitude    numeric,
  longitude   numeric,
  timestamp   timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_telemetry_vehicle_ts ON telemetry_readings (vehicle_id, timestamp DESC);
CREATE INDEX idx_telemetry_metric ON telemetry_readings (vehicle_id, metric_type, timestamp DESC);

-- events
CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  description text NOT NULL,
  severity    text NOT NULL DEFAULT 'info',
  metadata    jsonb DEFAULT '{}',
  timestamp   timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_events_vehicle_ts ON events (vehicle_id, timestamp DESC);
CREATE INDEX idx_events_type ON events (event_type, timestamp DESC);

-- Enable Realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE telemetry_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

---

## API Endpoints

### `POST /api/telemetry` — Ingest Telemetry Batch

Accepts an array of telemetry readings and inserts them in a single batch operation.

**Request Body:**

```json
{
  "readings": [
    {
      "vehicle_id": "uuid",
      "metric_type": "speed",
      "value": 72.5,
      "unit": "km/h",
      "latitude": 40.7128,
      "longitude": -74.006,
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "vehicle_id": "uuid",
      "metric_type": "engine_temp",
      "value": 92.3,
      "unit": "°C",
      "latitude": 40.7128,
      "longitude": -74.006,
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ]
}
```

**Response (201):**

```json
{
  "inserted": 2,
  "timestamp": "2025-01-15T10:30:01Z"
}
```

**Validation:**
- `readings` array must contain 1-100 items.
- Each reading must include `vehicle_id`, `metric_type`, `value`, `unit`, and `timestamp`.
- `metric_type` must be one of the supported types.
- `vehicle_id` must reference an existing vehicle.

**File:** `src/app/api/telemetry/route.ts`

---

### `GET /api/telemetry/[vehicleId]` — Query Historical Telemetry

Returns telemetry readings for a specific vehicle, filtered by time range and optional metric type.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `from` | ISO 8601 string | No | 1 hour ago | Start of time range |
| `to` | ISO 8601 string | No | now | End of time range |
| `metric` | string | No | all | Filter by metric type |
| `limit` | number | No | 500 | Max rows returned |
| `order` | `asc` or `desc` | No | `desc` | Sort by timestamp |

**Response (200):**

```json
{
  "vehicle_id": "uuid",
  "readings": [
    {
      "id": "uuid",
      "metric_type": "speed",
      "value": 72.5,
      "unit": "km/h",
      "latitude": 40.7128,
      "longitude": -74.006,
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "from": "2025-01-15T09:30:00Z",
  "to": "2025-01-15T10:30:00Z"
}
```

**File:** `src/app/api/telemetry/[vehicleId]/route.ts`

---

### `POST /api/events` — Log an Event

Creates a new event record.

**Request Body:**

```json
{
  "vehicle_id": "uuid",
  "event_type": "dispatch",
  "description": "Unit dispatched to 123 Main St for medical emergency",
  "severity": "info",
  "metadata": {
    "incident_id": "INC-2025-0042",
    "destination": { "lat": 40.7128, "lng": -74.006 },
    "priority": "high"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "event_type": "dispatch",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Validation:**
- `event_type` must be one of the supported types.
- `severity` must be `info`, `warning`, or `critical`.
- `vehicle_id` must reference an existing vehicle.

**File:** `src/app/api/events/route.ts`

---

### `GET /api/events/[vehicleId]` — Query Events

Returns events for a specific vehicle, filtered by time range and optional event type.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `from` | ISO 8601 string | No | 24 hours ago | Start of time range |
| `to` | ISO 8601 string | No | now | End of time range |
| `type` | string | No | all | Filter by event type |
| `severity` | string | No | all | Filter by severity |
| `limit` | number | No | 100 | Max rows returned |

**Response (200):**

```json
{
  "vehicle_id": "uuid",
  "events": [
    {
      "id": "uuid",
      "event_type": "dispatch",
      "description": "Unit dispatched to 123 Main St",
      "severity": "info",
      "metadata": {},
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "from": "2025-01-14T10:30:00Z",
  "to": "2025-01-15T10:30:00Z"
}
```

**File:** `src/app/api/events/[vehicleId]/route.ts`

---

### `POST /api/simulator/start` — Start Data Simulator

Starts the telemetry simulator. The simulator runs server-side and generates data at a configurable interval.

**Request Body (optional):**

```json
{
  "interval_ms": 5000,
  "vehicle_ids": ["uuid1", "uuid2"],
  "anomaly_probability": 0.05
}
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `interval_ms` | number | `5000` | Milliseconds between telemetry batches |
| `vehicle_ids` | string[] | all active vehicles | Subset of vehicles to simulate |
| `anomaly_probability` | number | `0.05` | Chance (0-1) of injecting an anomaly per reading cycle |

**Response (200):**

```json
{
  "status": "started",
  "vehicle_count": 5,
  "interval_ms": 5000
}
```

**File:** `src/app/api/simulator/start/route.ts`

---

### `POST /api/simulator/stop` — Stop Data Simulator

Stops the running simulator.

**Response (200):**

```json
{
  "status": "stopped",
  "readings_generated": 1250,
  "events_generated": 12,
  "uptime_seconds": 300
}
```

**File:** `src/app/api/simulator/stop/route.ts`

---

## Data Simulator

### Architecture

The simulator runs as an in-process `setInterval` loop inside the Next.js server. For the POC this is sufficient; in production you would use a dedicated worker or Supabase Edge Function.

**File:** `src/lib/simulator.ts`

### Simulation Logic

```
On each tick (every interval_ms):
  For each vehicle:
    1. Compute new GPS position (move along a predefined route or random walk)
    2. Compute speed (0-120 km/h, varies realistically based on vehicle status)
    3. Compute engine_temp (80-110°C normal range, fluctuates)
    4. Compute fuel_level (decreases slowly, resets on refuel event)
    5. Compute tire_pressure (30-35 psi normal, slow drift)
    6. Compute battery_voltage (12.0-14.5V normal range)
    7. Compute rpm (700-5000, correlates with speed)
    8. Compute oil_pressure (25-65 psi, correlates with rpm)
    9. Roll for anomaly injection (per anomaly_probability)
    10. Batch insert all readings via POST /api/telemetry
    11. If anomaly occurred, log event via POST /api/events
```

### Realistic Patterns

| Metric | Normal Range | Behavior | Anomaly |
|--------|-------------|----------|---------|
| `speed` | 0-120 km/h | Accelerates/decelerates smoothly, stops at incidents | Sudden spike to 150+ |
| `engine_temp` | 80-110 °C | Gradual rise during operation, cools when idle | Spike above 130 °C |
| `fuel_level` | 0-100 % | Decreases ~0.1% per tick; refuel event resets to ~95% | Sudden drop (leak) |
| `tire_pressure` | 30-35 psi | Slow random drift within range | Drop below 25 psi |
| `battery_voltage` | 12.0-14.5 V | Stable with minor fluctuation | Drop below 11.5 V |
| `rpm` | 700-5000 | Correlates with speed; idle at ~700 | Spike or stall to 0 |
| `oil_pressure` | 25-65 psi | Correlates with RPM | Drop below 20 psi |

### Vehicle State Machine

Each simulated vehicle maintains internal state:

```
IDLE -> DISPATCHED -> EN_ROUTE -> ON_SCENE -> RETURNING -> IDLE
```

- **IDLE:** Parked at station. Minimal telemetry variation. Speed = 0.
- **DISPATCHED:** Event logged. Transition to EN_ROUTE.
- **EN_ROUTE:** Speed increases, fuel decreases faster, engine temp rises.
- **ON_SCENE:** Speed = 0, engine may idle or shut off. Events logged.
- **RETURNING:** Similar to EN_ROUTE but lower urgency (lower speed).

---

## Real-time Subscriptions

### Channel Design

Clients subscribe to vehicle-specific channels for targeted updates:

```typescript
// Subscribe to telemetry for a specific vehicle
const channel = supabase
  .channel(`telemetry:${vehicleId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'telemetry_readings',
      filter: `vehicle_id=eq.${vehicleId}`,
    },
    (payload) => {
      // Handle new telemetry reading
      console.log('New reading:', payload.new);
    }
  )
  .subscribe();
```

```typescript
// Subscribe to events for a specific vehicle
const eventChannel = supabase
  .channel(`events:${vehicleId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'events',
      filter: `vehicle_id=eq.${vehicleId}`,
    },
    (payload) => {
      // Handle new event
      console.log('New event:', payload.new);
    }
  )
  .subscribe();
```

### Broadcast Channels (Alternative for High Throughput)

If Postgres changes become a bottleneck, use Supabase Broadcast as a secondary fan-out:

```typescript
// Server-side: broadcast after insert
await supabase.channel('telemetry-broadcast').send({
  type: 'broadcast',
  event: 'new-reading',
  payload: { vehicle_id, readings },
});

// Client-side: listen
supabase
  .channel('telemetry-broadcast')
  .on('broadcast', { event: 'new-reading' }, (payload) => {
    // Handle broadcast
  })
  .subscribe();
```

---

## Technical Implementation Details

### Project Structure

```
src/
  app/
    api/
      telemetry/
        route.ts                    # POST /api/telemetry
        [vehicleId]/
          route.ts                  # GET /api/telemetry/[vehicleId]
      events/
        route.ts                    # POST /api/events
        [vehicleId]/
          route.ts                  # GET /api/events/[vehicleId]
      simulator/
        start/
          route.ts                  # POST /api/simulator/start
        stop/
          route.ts                  # POST /api/simulator/stop
  lib/
    simulator.ts                    # Simulator engine
    simulator-patterns.ts           # Realistic data generation patterns
    telemetry-types.ts              # TypeScript types for telemetry
```

### TypeScript Types

```typescript
// src/lib/telemetry-types.ts

export type MetricType =
  | 'speed'
  | 'engine_temp'
  | 'fuel_level'
  | 'tire_pressure'
  | 'battery_voltage'
  | 'rpm'
  | 'oil_pressure'
  | 'gps';

export type EventType =
  | 'dispatch'
  | 'en_route'
  | 'arrived'
  | 'completed'
  | 'maintenance_alert'
  | 'refuel'
  | 'equipment_check';

export type Severity = 'info' | 'warning' | 'critical';

export interface TelemetryReading {
  id?: string;
  vehicle_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  latitude?: number | null;
  longitude?: number | null;
  timestamp: string;
  created_at?: string;
}

export interface VehicleEvent {
  id?: string;
  vehicle_id: string;
  event_type: EventType;
  description: string;
  severity: Severity;
  metadata?: Record<string, unknown>;
  timestamp: string;
  created_at?: string;
}

export interface SimulatorConfig {
  interval_ms: number;
  vehicle_ids: string[];
  anomaly_probability: number;
}

export interface SimulatorStatus {
  running: boolean;
  vehicle_count: number;
  interval_ms: number;
  readings_generated: number;
  events_generated: number;
  started_at: string | null;
}
```

### Batch Insert Strategy

For performance, telemetry is always inserted in batches:

```typescript
// Insert all readings for all vehicles in a single DB call
const { data, error } = await supabase
  .from('telemetry_readings')
  .insert(readings)  // array of TelemetryReading objects
  .select();
```

A single tick with 5 vehicles and 8 metrics produces 40 rows. Batch insert keeps this to one DB round-trip per tick.

### Data Retention

For the POC, a simple cleanup function deletes data older than 7 days:

```sql
-- Run periodically (e.g., via pg_cron or a scheduled API call)
DELETE FROM telemetry_readings WHERE timestamp < now() - INTERVAL '7 days';
DELETE FROM events WHERE timestamp < now() - INTERVAL '7 days';
```

Expose as an API endpoint or Supabase database function:

```typescript
// src/app/api/telemetry/cleanup/route.ts
export async function POST() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('telemetry_readings').delete().lt('timestamp', cutoff);
  await supabase.from('events').delete().lt('timestamp', cutoff);

  return Response.json({ status: 'cleaned', cutoff });
}
```

### Error Handling

All API routes follow a consistent pattern:

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.readings || !Array.isArray(body.readings)) {
      return Response.json(
        { error: 'readings array is required' },
        { status: 400 }
      );
    }

    // Process
    const { data, error } = await supabase
      .from('telemetry_readings')
      .insert(body.readings)
      .select();

    if (error) {
      return Response.json(
        { error: 'Database insert failed', details: error.message },
        { status: 500 }
      );
    }

    return Response.json(
      { inserted: data.length, timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (err) {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Acceptance Criteria

- [ ] **Telemetry ingestion** — `POST /api/telemetry` accepts a batch of readings and stores them in `telemetry_readings`.
- [ ] **Telemetry queries** — `GET /api/telemetry/[vehicleId]` returns readings filtered by time range and metric type.
- [ ] **Event logging** — `POST /api/events` accepts and stores events in the `events` table.
- [ ] **Event queries** — `GET /api/events/[vehicleId]` returns events filtered by time range, type, and severity.
- [ ] **Data simulator** — Simulator generates realistic telemetry for multiple vehicles with configurable interval.
- [ ] **Anomaly injection** — Simulator occasionally injects anomalies that produce warning/critical events.
- [ ] **Real-time delivery** — Supabase Realtime subscriptions deliver new telemetry and events to clients within 2 seconds of insertion.
- [ ] **Simulator control** — Simulator can be started and stopped via API endpoints.
- [ ] **Data validation** — API rejects malformed requests with appropriate 400-level error responses.
- [ ] **Data retention** — Cleanup mechanism removes data older than 7 days.

---

## Dependencies

| Dependency | Feature | What's Needed |
|------------|---------|---------------|
| Fleet Management | Feature 6 | `vehicles` table and vehicle records (vehicle_id FK target) |
| Auth & RBAC | Feature 8 | API authentication middleware to protect endpoints |

---

## Performance Considerations

- **Write throughput:** With 5 vehicles and 5-second intervals, expect ~480 inserts/minute. Supabase free tier handles this comfortably.
- **Read throughput:** Historical queries should use the composite indexes. Default limit of 500 rows per query prevents accidental large fetches.
- **Realtime:** Supabase Realtime supports up to 100 concurrent connections on the free tier. Sufficient for POC.
- **Storage:** At ~480 rows/minute, 7 days of data is approximately 4.8 million rows. The POC should run the cleanup job daily.

---

## Testing Notes

- Use the simulator to populate data, then verify via the query endpoints.
- Test real-time by opening two browser tabs: one running the simulator, one subscribed to a vehicle.
- Verify anomaly injection by checking for `warning` and `critical` severity events after running the simulator for a few minutes.
- Test edge cases: empty batch, invalid metric type, non-existent vehicle ID, overlapping time ranges.
