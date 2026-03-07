# Feature 4: Scenario Simulation ("What If")

## Overview

Allows operators and dispatchers to run hypothetical scenarios against the current digital twin state. "What if we dispatch Vehicle X instead of Y?" "What if fuel drops below threshold mid-route?" "What if traffic increases 30%?" The simulator uses current twin data, applies modifications, and projects outcomes.

This feature is central to the value proposition of the Digital Twin: rather than reacting to events after the fact, operators can proactively model decisions before committing to them.

## Assigned To: Agent 4 (Senior Simulation Engineer)

---

## User Stories

- **As a dispatcher**, I want to simulate dispatching different vehicles to compare outcomes so I can choose the optimal vehicle for each emergency.
- **As a fleet manager**, I want to model "what if" fuel/maintenance scenarios so I can anticipate resource constraints before they become critical.
- **As an operator**, I want to see projected outcomes before making decisions so I can reduce risk and improve response times.

---

## Key Capabilities

### Scenario Templates (Predefined Common Scenarios)
- Pre-built scenarios for the most frequent "what if" questions.
- Templates are stored in the `scenarios` table with `is_template = true`.
- Users can clone a template, adjust parameters, and run it.

### Custom Scenario Builder
- Form-based interface to manually define scenario parameters.
- Select a scenario type, pick vehicles, and adjust variables (speed, fuel level, traffic multiplier, etc.).

### Side-by-Side Comparison
- Compare the outcomes of 2 or more scenarios in a tabular/card layout.
- Highlight differences in key metrics (response time, fuel, risk).

### Scenario Types

| Scenario Type | Description | Key Parameters |
|---|---|---|
| **Vehicle Dispatch Comparison** | Compare response times for different vehicles dispatched to the same incident | `vehicle_ids[]`, `incident_location`, `priority` |
| **Resource Depletion** | "What if fuel runs out mid-route?" | `vehicle_id`, `current_fuel`, `fuel_consumption_rate`, `route_distance` |
| **Traffic Impact** | "What if travel time increases by X%?" | `vehicle_id`, `traffic_multiplier` (e.g., 1.3 for 30% increase), `route_id` |
| **Equipment Failure** | "What if medical equipment fails on an ambulance?" | `vehicle_id`, `equipment_type`, `failure_point_in_route` |
| **Multi-Vehicle Coordination** | "What if we send 2 vehicles instead of 1?" | `vehicle_ids[]`, `incident_location`, `coordination_strategy` |

### Save and Replay
- All scenarios and their results are persisted in Supabase.
- Users can revisit past simulations from the Scenario History view.

### Outcome Metrics
Each simulation run produces the following projected metrics:
- **Estimated Response Time** (minutes)
- **Fuel Consumption** (liters/gallons)
- **Risk Score Delta** (change in risk relative to baseline)
- **Coverage Impact** (effect on overall fleet coverage if this vehicle is dispatched)
- **Outcome Summary** (text summary of the projected result)

---

## Supabase Tables

### `scenarios`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique scenario identifier |
| `name` | `text` | Human-readable scenario name |
| `description` | `text` | Longer description of the scenario |
| `scenario_type` | `text` | One of: `dispatch_comparison`, `resource_depletion`, `traffic_impact`, `equipment_failure`, `multi_vehicle` |
| `parameters` | `jsonb` | Scenario-specific parameters (varies by type) |
| `created_by` | `uuid` (FK -> users) | User who created the scenario |
| `created_at` | `timestamptz` | Creation timestamp |
| `is_template` | `boolean` | Whether this is a reusable template (default: `false`) |

### `simulation_results`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique result identifier |
| `scenario_id` | `uuid` (FK -> scenarios) | The scenario that was run |
| `vehicle_id` | `uuid` (FK -> vehicles) | The vehicle evaluated in this result |
| `result_data` | `jsonb` | Outcome metrics object (see structure below) |
| `created_at` | `timestamptz` | When the simulation was executed |

#### `result_data` JSONB Structure

```json
{
  "estimated_response_time": 12.5,
  "fuel_consumption": 8.3,
  "risk_delta": -0.15,
  "coverage_impact": "minimal",
  "outcome_summary": "Vehicle 7 can reach the incident in 12.5 minutes with adequate fuel reserves."
}
```

### SQL Migration

```sql
-- Create scenarios table
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN (
    'dispatch_comparison', 'resource_depletion', 'traffic_impact',
    'equipment_failure', 'multi_vehicle'
  )),
  parameters JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_template BOOLEAN DEFAULT false
);

-- Create simulation_results table
CREATE TABLE simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  result_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scenarios_type ON scenarios(scenario_type);
CREATE INDEX idx_scenarios_template ON scenarios(is_template) WHERE is_template = true;
CREATE INDEX idx_scenarios_created_by ON scenarios(created_by);
CREATE INDEX idx_simulation_results_scenario ON simulation_results(scenario_id);

-- RLS Policies
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all scenarios"
  ON scenarios FOR SELECT USING (true);

CREATE POLICY "Dispatchers and above can create scenarios"
  ON scenarios FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view all simulation results"
  ON simulation_results FOR SELECT USING (true);

CREATE POLICY "System can insert simulation results"
  ON simulation_results FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );
```

---

## UI Components

### ScenarioBuilder

- **Location**: `src/components/simulation/ScenarioBuilder.tsx`
- **Description**: Form to create or modify scenario parameters.
- **Fields**: Scenario name, type selector (dropdown), dynamic parameter fields based on selected type, vehicle selector(s).
- **Actions**: "Run Simulation" button, "Save as Template" toggle.

### ScenarioTemplateSelector

- **Location**: `src/components/simulation/ScenarioTemplateSelector.tsx`
- **Description**: Grid or list of predefined scenario templates.
- **Behavior**: Clicking a template populates the ScenarioBuilder with its parameters.

### SimulationResultCard

- **Location**: `src/components/simulation/SimulationResultCard.tsx`
- **Description**: Displays outcome metrics for a single simulation run.
- **Content**: Response time, fuel consumption, risk delta (with color coding), coverage impact, outcome summary text.

### ComparisonView

- **Location**: `src/components/simulation/ComparisonView.tsx`
- **Description**: Side-by-side layout comparing 2 or more scenario results.
- **Layout**: Columns for each scenario, rows for each metric. Highlights best/worst values.

### ScenarioHistory

- **Location**: `src/components/simulation/ScenarioHistory.tsx`
- **Description**: Paginated list of past simulations.
- **Columns**: Name, type, date, quick result summary.
- **Actions**: View details, re-run, compare (checkbox to select multiple).

---

## Pages / Routes

### `/simulation` -- Scenario Builder & Template Selector

- **File**: `src/app/simulation/page.tsx`
- **Layout**: Two-column layout. Left: ScenarioTemplateSelector. Right: ScenarioBuilder.
- **Behavior**: Selecting a template pre-fills the builder. Running a simulation redirects to the result page.

### `/simulation/results/[id]` -- View Simulation Result

- **File**: `src/app/simulation/results/[id]/page.tsx`
- **Layout**: SimulationResultCard(s) for each vehicle in the scenario. If multiple vehicles, displayed in a grid.
- **Actions**: "Compare with another scenario" button, "Re-run with modifications" button.

### `/simulation/compare` -- Compare Multiple Results

- **File**: `src/app/simulation/compare/page.tsx`
- **Query Params**: `?ids=uuid1,uuid2,uuid3`
- **Layout**: ComparisonView component with selected scenarios.

---

## API Endpoints

### `POST /api/simulation/run`

Execute a scenario simulation.

- **File**: `src/app/api/simulation/run/route.ts`
- **Auth**: Dispatcher+ role required.
- **Request Body**:
  ```json
  {
    "name": "Compare Engine 5 vs Engine 7",
    "scenario_type": "dispatch_comparison",
    "parameters": {
      "vehicle_ids": ["uuid-1", "uuid-2"],
      "incident_location": { "lat": 40.7128, "lng": -74.006 },
      "priority": "high"
    },
    "save_as_template": false
  }
  ```
- **Response**: `201 Created` with scenario ID and result IDs.
- **Logic**:
  1. Validate input parameters.
  2. Fetch current vehicle state(s) from `vehicles` table.
  3. Run simulation engine (see below).
  4. Save scenario to `scenarios` table.
  5. Save result(s) to `simulation_results` table.
  6. Return results.

### `GET /api/simulation/templates`

List available scenario templates.

- **File**: `src/app/api/simulation/templates/route.ts`
- **Auth**: Authenticated users.
- **Response**: Array of scenarios where `is_template = true`.

### `GET /api/simulation/results/[id]`

Get a specific simulation result.

- **File**: `src/app/api/simulation/results/[id]/route.ts`
- **Auth**: Authenticated users.
- **Response**: Scenario + associated simulation results.

### `GET /api/simulation/history`

List past simulations for the current user.

- **File**: `src/app/api/simulation/history/route.ts`
- **Auth**: Authenticated users.
- **Query Params**: `?page=1&limit=20&type=dispatch_comparison`
- **Response**: Paginated list of scenarios with summary data.

---

## Simulation Engine (Simplified for POC)

The simulation engine is a deterministic calculation function, not a physics engine. It lives server-side in a utility module.

### File: `src/lib/simulation-engine.ts`

### Core Logic

```typescript
interface SimulationInput {
  scenario_type: string;
  parameters: Record<string, any>;
  vehicles: Vehicle[];  // current state from DB
}

interface SimulationOutput {
  vehicle_id: string;
  estimated_response_time: number;  // minutes
  fuel_consumption: number;         // liters
  risk_delta: number;               // -1.0 to 1.0
  coverage_impact: string;          // "none" | "minimal" | "moderate" | "significant"
  outcome_summary: string;
}

function runSimulation(input: SimulationInput): SimulationOutput[] {
  switch (input.scenario_type) {
    case 'dispatch_comparison':
      return simulateDispatch(input);
    case 'resource_depletion':
      return simulateResourceDepletion(input);
    case 'traffic_impact':
      return simulateTrafficImpact(input);
    case 'equipment_failure':
      return simulateEquipmentFailure(input);
    case 'multi_vehicle':
      return simulateMultiVehicle(input);
    default:
      throw new Error(`Unknown scenario type: ${input.scenario_type}`);
  }
}
```

### Formulas (POC-simple)

| Calculation | Formula |
|---|---|
| **Response Time** | `distance_km / avg_speed_kmh * 60` (minutes) |
| **Fuel Consumption** | `fuel_consumption_rate_per_km * distance_km` |
| **Risk Delta** | Based on vehicle condition, fuel level, and equipment status. Simple weighted score. |
| **Coverage Impact** | If dispatched vehicle is 1 of N in zone: `"minimal"` if N > 3, `"moderate"` if N == 2-3, `"significant"` if N == 1 |
| **Traffic Adjustment** | `response_time * traffic_multiplier` |

### Distance Calculation (Haversine)

For POC, use the Haversine formula to estimate straight-line distance between vehicle location and incident location. No real routing.

```typescript
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---

## Predefined Scenario Templates

The following templates should be seeded into the `scenarios` table on initial setup:

### Template 1: "Nearest Vehicle Dispatch"
- **Type**: `dispatch_comparison`
- **Parameters**: `{ "vehicle_count": 3, "selection_strategy": "nearest", "incident_location": null }` (incident location provided at runtime)
- **Description**: Compare the 3 nearest available vehicles for dispatch.

### Template 2: "Low Fuel Risk Assessment"
- **Type**: `resource_depletion`
- **Parameters**: `{ "fuel_threshold_percent": 20, "route_distance_km": 15 }` (vehicle selected at runtime)
- **Description**: Check if a vehicle can complete a 15km route with less than 20% fuel.

### Template 3: "Rush Hour Traffic Impact"
- **Type**: `traffic_impact`
- **Parameters**: `{ "traffic_multiplier": 1.5, "time_window": "17:00-19:00" }`
- **Description**: Model response times during rush hour with 50% increased travel time.

---

## Error Handling

| Error | HTTP Status | Message |
|---|---|---|
| Invalid scenario type | 400 | "Invalid scenario type. Must be one of: ..." |
| Vehicle not found | 404 | "Vehicle {id} not found" |
| Missing required parameters | 400 | "Missing required parameter: {param}" |
| Simulation engine failure | 500 | "Simulation failed: {reason}" |
| Unauthorized | 401 | "Authentication required" |
| Forbidden | 403 | "Dispatcher role or above required" |

---

## Acceptance Criteria

- [ ] Can create and run a "what if" scenario from the ScenarioBuilder form
- [ ] At least 3 scenario templates are available and selectable
- [ ] Results show projected metrics (estimated response time, fuel consumption, risk delta)
- [ ] Can compare two scenarios side-by-side in the ComparisonView
- [ ] Scenario history is saved to Supabase and queryable from the ScenarioHistory view
- [ ] Simulation engine handles all 5 scenario types
- [ ] Error states are handled gracefully (invalid input, missing vehicles, etc.)

---

## Dependencies

- **Feature 1 (Dashboard)** -- for current vehicle state (location, status)
- **Feature 2 (Telemetry)** -- for historical data to inform projections (avg speed, fuel consumption rates)
- **Feature 8 (Auth)** -- dispatcher+ role required to run simulations

---

## File Structure

```
src/
  app/
    simulation/
      page.tsx                          # Scenario builder + template selector
      results/
        [id]/
          page.tsx                      # View simulation result
      compare/
        page.tsx                        # Compare multiple results
    api/
      simulation/
        run/
          route.ts                      # POST - execute simulation
        templates/
          route.ts                      # GET - list templates
        results/
          [id]/
            route.ts                    # GET - get result
        history/
          route.ts                      # GET - list past simulations
  components/
    simulation/
      ScenarioBuilder.tsx
      ScenarioTemplateSelector.tsx
      SimulationResultCard.tsx
      ComparisonView.tsx
      ScenarioHistory.tsx
  lib/
    simulation-engine.ts                # Core simulation logic
```
