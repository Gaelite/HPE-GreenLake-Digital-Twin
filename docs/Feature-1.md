# Feature 1: Vehicle State Dashboard

## Overview

The core "digital twin" view. A real-time dashboard that mirrors the physical state of an emergency vehicle. This is the heart of the POC — showing that we can represent a vehicle digitally with live-updating data.

Every emergency vehicle in the fleet gets a corresponding digital representation that stays in sync with the physical asset. When an engine's RPM changes, when fuel drops, when equipment is checked or fails — the dashboard reflects it within seconds.

## Assigned To

**Agent 1** — Senior Frontend/Dashboard Engineer

---

## User Stories

| # | Role       | Story                                                                 | Priority |
|---|------------|-----------------------------------------------------------------------|----------|
| 1 | Dispatcher | I want to see the current state of any vehicle at a glance           | High     |
| 2 | Operator   | I want to monitor my vehicle's vitals in real-time                   | High     |
| 3 | Admin      | I want to verify the digital twin accurately reflects vehicle data   | Medium   |

---

## Key Capabilities

### Vehicle Status Display
- Real-time status tracking with the following states:
  - `online` — vehicle is powered on and transmitting
  - `offline` — vehicle is not transmitting data
  - `in-service` — vehicle is available for dispatch
  - `en-route` — vehicle is responding to a call
  - `at-scene` — vehicle has arrived at the incident
  - `maintenance` — vehicle is undergoing maintenance or repair

### Engine Metrics
- **RPM** — current engine revolutions per minute
- **Temperature** — engine coolant temperature (Fahrenheit/Celsius)
- **Oil Pressure** — engine oil pressure (PSI)
- **Battery Voltage** — vehicle battery level (Volts)

### Fuel / Battery Level
- Visual gauge component showing current fuel or battery level
- Color-coded thresholds (green > 50%, yellow 20–50%, red < 20%)
- Estimated range remaining (if speed and consumption data are available)

### Speed and Odometer
- Current speed (MPH/KPH)
- Total odometer reading
- Trip odometer (since last dispatch)

### Equipment Checklist Status
- Lights (operational / faulty)
- Sirens (operational / faulty)
- Radio (operational / faulty)
- Medical gear (ambulance-specific)
- Hoses and nozzles (fire truck-specific)
- Other vehicle-type-specific equipment

### Operational Readiness Score
- Calculated composite score (0–100) derived from:
  - Engine health metrics (weighted 30%)
  - Fuel/battery level (weighted 20%)
  - Equipment status — all items operational (weighted 30%)
  - Maintenance status — no overdue maintenance (weighted 20%)
- Displayed as a circular progress indicator with color coding

### Vehicle-Type-Specific Panels
- **Ambulance**: medical equipment inventory, oxygen tank level, stretcher status
- **Fire Truck**: water tank level, pump pressure, ladder status, hose inventory
- **Police Vehicle**: radio channels active, dash cam status, in-car computer status
- **Command Vehicle**: communications array status, generator fuel level

---

## UI Components

### `VehicleTwinCard`
Summary card displayed in the fleet overview. Shows at-a-glance info for a single vehicle.

```
┌─────────────────────────────────┐
│ 🚑 Ambulance A-12    [ONLINE]  │
│ Status: In-Service              │
│ Fuel: ████████░░ 78%            │
│ Readiness: 92/100               │
│ Last Update: 3s ago             │
└─────────────────────────────────┘
```

**Props:**
- `vehicleId: string`
- `name: string`
- `type: 'ambulance' | 'fire_truck' | 'police' | 'command'`
- `status: VehicleStatus`
- `fuelLevel: number`
- `readinessScore: number`
- `lastUpdate: Date`

**Location:** `src/components/dashboard/VehicleTwinCard.tsx`

---

### `VehicleDetailPanel`
Full digital twin view with all metrics, gauges, and equipment status for a single vehicle.

**Props:**
- `vehicleId: string`

**Responsibilities:**
- Fetches full vehicle data on mount (server component initial load)
- Subscribes to real-time updates via `useVehicleTwin` hook
- Renders all sub-components (gauges, checklists, readiness score)
- Handles vehicle-type-specific panel rendering

**Location:** `src/components/dashboard/VehicleDetailPanel.tsx`

---

### `MetricGauge`
Reusable gauge component for displaying a single numeric metric with a visual indicator.

**Props:**
- `label: string`
- `value: number`
- `min: number`
- `max: number`
- `unit: string`
- `thresholds?: { warning: number; critical: number }`
- `size?: 'sm' | 'md' | 'lg'`

**Usage Examples:**
- Fuel level gauge (0–100%)
- Engine temperature gauge (0–300 F)
- Speed gauge (0–120 MPH)
- Oil pressure gauge (0–80 PSI)

**Location:** `src/components/dashboard/MetricGauge.tsx`

---

### `StatusIndicator`
Small colored dot or badge indicating the current status of a vehicle or piece of equipment.

**Props:**
- `status: string`
- `variant?: 'dot' | 'badge'`
- `size?: 'sm' | 'md' | 'lg'`

**Color Mapping:**
- `online` / `operational` — green
- `in-service` — blue
- `en-route` — amber/yellow
- `at-scene` — orange
- `maintenance` — purple
- `offline` / `faulty` — red

**Location:** `src/components/dashboard/StatusIndicator.tsx`

---

### `EquipmentChecklist`
List of equipment items for the vehicle with individual status indicators.

**Props:**
- `vehicleId: string`
- `equipment: EquipmentItem[]`

**Behavior:**
- Renders a scrollable list of equipment items
- Each item shows name, status (operational/faulty/missing), and last checked timestamp
- Faulty or missing items are highlighted and sorted to the top
- Count summary at the top (e.g., "14/16 items operational")

**Location:** `src/components/dashboard/EquipmentChecklist.tsx`

---

### `ReadinessScore`
Circular progress component showing the vehicle's operational readiness as a percentage.

**Props:**
- `score: number` (0–100)
- `size?: 'sm' | 'md' | 'lg'`
- `showBreakdown?: boolean`

**Color Coding:**
- 80–100: green (ready)
- 60–79: yellow (limited readiness)
- 0–59: red (not ready)

**Location:** `src/components/dashboard/ReadinessScore.tsx`

---

## Pages / Routes

### `/dashboard` — Main Dashboard

The primary landing page after login. Displays a grid of `VehicleTwinCard` components for all vehicles the user has access to.

**Behavior:**
- Server component fetches initial vehicle list from Supabase
- Client-side filtering by vehicle type, status, and readiness
- Search bar to filter by vehicle name or plate number
- Click on a card navigates to `/dashboard/vehicle/[id]`
- Real-time status badge updates via Supabase subscription

**File:** `src/app/dashboard/page.tsx`

---

### `/dashboard/vehicle/[id]` — Vehicle Detail (Digital Twin View)

Full detailed view of a single vehicle's digital twin.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  [Back]   Ambulance A-12          Status: ONLINE │
├──────────────┬───────────────────────────────────┤
│              │                                   │
│  Readiness   │   Engine Metrics                  │
│  Score       │   ┌─────┐ ┌─────┐ ┌─────┐       │
│  ┌───┐       │   │ RPM │ │ Temp│ │ Oil │       │
│  │92 │       │   └─────┘ └─────┘ └─────┘       │
│  └───┘       │                                   │
│              │   Fuel Level                      │
│              │   ████████████░░░ 78%             │
│              │                                   │
│              │   Speed: 0 MPH | Odo: 45,231 mi  │
├──────────────┼───────────────────────────────────┤
│  Equipment   │   Vehicle-Specific Panel          │
│  Checklist   │   (Medical Equipment for          │
│  14/16 OK    │    Ambulance, Water Tank for      │
│  ☑ Lights    │    Fire Truck, etc.)              │
│  ☑ Sirens    │                                   │
│  ☑ Radio     │                                   │
│  ☒ Defib     │                                   │
└──────────────┴───────────────────────────────────┘
```

**File:** `src/app/dashboard/vehicle/[id]/page.tsx`

---

## Supabase Tables

### `vehicles`

Primary vehicle record. One row per physical vehicle.

| Column         | Type        | Constraints              | Description                        |
|----------------|-------------|--------------------------|------------------------------------|
| `id`           | `uuid`      | PK, default `gen_random_uuid()` | Unique vehicle identifier    |
| `type`         | `text`      | NOT NULL                 | Vehicle type: `ambulance`, `fire_truck`, `police`, `command` |
| `name`         | `text`      | NOT NULL                 | Human-readable name (e.g., "Ambulance A-12") |
| `plate_number` | `text`      | UNIQUE, NOT NULL         | License plate number               |
| `status`       | `text`      | NOT NULL, default `'offline'` | Current vehicle status        |
| `created_at`   | `timestamptz` | default `now()`        | Record creation timestamp          |

```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('ambulance', 'fire_truck', 'police', 'command')),
  name TEXT NOT NULL,
  plate_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'offline', 'in-service', 'en-route', 'at-scene', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### `telemetry_readings`

Time-series telemetry data. Each row is a single metric reading from a vehicle.

| Column        | Type          | Constraints              | Description                          |
|---------------|---------------|--------------------------|--------------------------------------|
| `id`          | `uuid`        | PK, default `gen_random_uuid()` | Unique reading identifier      |
| `vehicle_id`  | `uuid`        | FK -> `vehicles.id`, NOT NULL | Associated vehicle              |
| `metric_type` | `text`        | NOT NULL                 | Type of metric (e.g., `rpm`, `temperature`, `fuel_level`) |
| `value`       | `numeric`     | NOT NULL                 | Numeric value of the reading         |
| `unit`        | `text`        | NOT NULL                 | Unit of measurement (e.g., `rpm`, `fahrenheit`, `percent`) |
| `timestamp`   | `timestamptz` | default `now()`          | When the reading was recorded        |

```sql
CREATE TABLE telemetry_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by vehicle and time
CREATE INDEX idx_telemetry_vehicle_time ON telemetry_readings (vehicle_id, timestamp DESC);

-- Index for fast lookups by metric type
CREATE INDEX idx_telemetry_metric ON telemetry_readings (vehicle_id, metric_type, timestamp DESC);
```

**Common `metric_type` values:**
- `rpm` — engine RPM
- `engine_temp` — engine temperature
- `oil_pressure` — oil pressure
- `battery_voltage` — battery voltage
- `fuel_level` — fuel percentage
- `speed` — current speed
- `odometer` — total mileage
- `water_tank_level` — fire truck water tank (vehicle-specific)
- `oxygen_level` — ambulance oxygen tank (vehicle-specific)

---

### `vehicle_equipment`

Equipment inventory and status for each vehicle.

| Column          | Type          | Constraints              | Description                        |
|-----------------|---------------|--------------------------|------------------------------------|
| `id`            | `uuid`        | PK, default `gen_random_uuid()` | Unique equipment record ID   |
| `vehicle_id`    | `uuid`        | FK -> `vehicles.id`, NOT NULL | Associated vehicle            |
| `equipment_name`| `text`        | NOT NULL                 | Name of equipment item             |
| `status`        | `text`        | NOT NULL, default `'operational'` | Current status              |
| `last_checked`  | `timestamptz` | default `now()`          | When the item was last inspected   |

```sql
CREATE TABLE vehicle_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  equipment_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'operational'
    CHECK (status IN ('operational', 'faulty', 'missing')),
  last_checked TIMESTAMPTZ DEFAULT now(),
  UNIQUE (vehicle_id, equipment_name)
);
```

---

## Real-time Subscriptions

### Telemetry Updates

Subscribe to new telemetry readings for the currently viewed vehicle.

```typescript
// Subscribe to telemetry changes for a specific vehicle
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
      // Update local state with new reading
      handleTelemetryUpdate(payload.new as TelemetryReading);
    }
  )
  .subscribe();
```

### Vehicle Status Updates

Subscribe to status changes on the `vehicles` table.

```typescript
// Subscribe to vehicle status changes
const channel = supabase
  .channel('vehicle-status')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'vehicles',
      filter: `id=eq.${vehicleId}`,
    },
    (payload) => {
      handleStatusUpdate(payload.new as Vehicle);
    }
  )
  .subscribe();
```

---

## Technical Implementation Notes

### Custom Hook: `useVehicleTwin(vehicleId)`

Central hook that encapsulates all real-time data for a vehicle's digital twin.

**Location:** `src/hooks/useVehicleTwin.ts`

```typescript
interface VehicleTwinState {
  vehicle: Vehicle | null;
  telemetry: Record<string, TelemetryReading>;
  equipment: EquipmentItem[];
  readinessScore: number;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

function useVehicleTwin(vehicleId: string): VehicleTwinState {
  // 1. Fetch initial data from Supabase
  // 2. Set up real-time subscriptions for telemetry_readings
  // 3. Set up real-time subscriptions for vehicle status
  // 4. Calculate readiness score from current state
  // 5. Clean up subscriptions on unmount
  // 6. Return consolidated state
}
```

### Server/Client Component Split

- **Server Components** (initial data load, SEO-friendly):
  - `src/app/dashboard/page.tsx` — fetches vehicle list
  - `src/app/dashboard/vehicle/[id]/page.tsx` — fetches vehicle detail

- **Client Components** (real-time updates, interactivity):
  - All components in `src/components/dashboard/` — handle real-time state
  - Wrapped with `'use client'` directive

### Styling

- **Tailwind CSS** for all layout and styling
- Responsive grid: 1 column on mobile, 2 on tablet, 3–4 on desktop
- Dark mode support via Tailwind `dark:` variants (optional for POC)
- Consistent spacing using Tailwind's spacing scale

### Visualizations

- **Recharts** for gauge-style visualizations:
  - `RadialBarChart` for readiness score
  - `RadialBarChart` with custom angles for fuel/speed gauges
  - Color-coded thresholds via custom tick rendering

### Readiness Score Calculation

```typescript
function calculateReadinessScore(
  telemetry: Record<string, TelemetryReading>,
  equipment: EquipmentItem[],
  vehicle: Vehicle
): number {
  let score = 0;

  // Engine health (30%)
  const engineScore = calculateEngineHealth(telemetry);
  score += engineScore * 0.3;

  // Fuel level (20%)
  const fuelScore = telemetry['fuel_level']?.value ?? 0;
  score += fuelScore * 0.2;

  // Equipment status (30%)
  const operationalCount = equipment.filter(e => e.status === 'operational').length;
  const equipmentScore = equipment.length > 0
    ? (operationalCount / equipment.length) * 100
    : 0;
  score += equipmentScore * 0.3;

  // Maintenance status (20%)
  const maintenanceScore = vehicle.status !== 'maintenance' ? 100 : 0;
  score += maintenanceScore * 0.2;

  return Math.round(score);
}
```

---

## API Endpoints

### `GET /api/vehicles/[id]`

Returns full vehicle details including current status.

**File:** `src/app/api/vehicles/[id]/route.ts`

**Response:**
```json
{
  "id": "uuid",
  "type": "ambulance",
  "name": "Ambulance A-12",
  "plate_number": "EMT-1234",
  "status": "in-service",
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

### `GET /api/vehicles/[id]/telemetry`

Returns the latest telemetry readings for a vehicle, one per metric type.

**File:** `src/app/api/vehicles/[id]/telemetry/route.ts`

**Query Parameters:**
- `metric` (optional) — filter by specific metric type
- `since` (optional) — only readings after this timestamp

**Response:**
```json
{
  "vehicle_id": "uuid",
  "readings": [
    {
      "metric_type": "rpm",
      "value": 2400,
      "unit": "rpm",
      "timestamp": "2025-01-15T14:30:00Z"
    },
    {
      "metric_type": "fuel_level",
      "value": 78,
      "unit": "percent",
      "timestamp": "2025-01-15T14:30:00Z"
    }
  ]
}
```

---

### Supabase Realtime Channel

**Channel:** `telemetry:vehicle_id=eq.[id]`

Pushes new telemetry readings as they are inserted. The client subscribes to this channel when viewing a specific vehicle's detail page and unsubscribes on navigation away.

---

## Acceptance Criteria

- [ ] Can select a vehicle from the dashboard and navigate to its detail view
- [ ] Vehicle detail page shows the full digital twin state (status, engine metrics, fuel, speed, equipment)
- [ ] Data updates in real-time — changes appear within 2 seconds of a new telemetry reading being inserted
- [ ] Vehicle-type-specific panels render correctly (ambulance shows medical equipment, fire truck shows water tank, etc.)
- [ ] Operational readiness score is calculated from engine health, fuel level, equipment status, and maintenance status
- [ ] Readiness score updates automatically as underlying data changes
- [ ] Dashboard page shows a grid of vehicle summary cards with live status indicators
- [ ] Responsive layout works correctly on desktop (1024px and above)
- [ ] Loading states are handled gracefully (skeleton loaders or spinners)
- [ ] Error states are handled (vehicle not found, connection lost, etc.)

---

## Dependencies

| Feature | Dependency Type | Description |
|---------|----------------|-------------|
| Feature 6 — Fleet Management | Data | Provides the vehicle records and CRUD operations for the `vehicles` table |
| Feature 2 — Telemetry Pipeline | Data | Feeds real-time telemetry data into the `telemetry_readings` table |
| Feature 8 — Auth & RBAC | Access Control | Controls which vehicles a user can view based on their role and organization |

### Dependency Notes

- **Feature 6** must create the `vehicles` table and seed it with test data before this feature can display vehicles.
- **Feature 2** must be inserting telemetry readings for the real-time subscriptions to have data to display. For early development, use seed data or a mock telemetry script.
- **Feature 8** is a soft dependency for the POC — the dashboard can function without auth initially, but should be wired up before demo.

---

## Development Notes

### Getting Started

1. Ensure the Supabase tables (`vehicles`, `telemetry_readings`, `vehicle_equipment`) are created
2. Seed the database with sample vehicles and telemetry data (see `scripts/seed.ts`)
3. Start the Next.js dev server: `npm run dev`
4. Navigate to `/dashboard` to see the vehicle grid
5. Click a vehicle to see the full digital twin view

### Testing Strategy

- **Unit tests** for `calculateReadinessScore` and other pure utility functions
- **Component tests** for `MetricGauge`, `StatusIndicator`, and `ReadinessScore` using React Testing Library
- **Integration tests** for `useVehicleTwin` hook with mocked Supabase client
- **Manual testing** with the telemetry simulator script to verify real-time updates

### File Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                          # Main dashboard (server component)
│   │   └── vehicle/
│   │       └── [id]/
│   │           └── page.tsx                  # Vehicle detail (server component)
│   └── api/
│       └── vehicles/
│           └── [id]/
│               ├── route.ts                  # GET vehicle details
│               └── telemetry/
│                   └── route.ts              # GET telemetry readings
├── components/
│   └── dashboard/
│       ├── VehicleTwinCard.tsx
│       ├── VehicleDetailPanel.tsx
│       ├── MetricGauge.tsx
│       ├── StatusIndicator.tsx
│       ├── EquipmentChecklist.tsx
│       └── ReadinessScore.tsx
├── hooks/
│   └── useVehicleTwin.ts
├── lib/
│   └── readiness.ts                          # Readiness score calculation
└── types/
    └── vehicle.ts                            # TypeScript types and interfaces
```
