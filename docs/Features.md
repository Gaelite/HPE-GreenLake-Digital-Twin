# Digital Twin - Emergency Vehicles POC — Features Overview

> **Tech Stack:** Next.js + Supabase
> **Scope:** Proof of Concept (POC)
> **Total Features:** 8

---

## Feature 1: Vehicle State Dashboard

**The core "twin" view — a digital mirror of the physical vehicle.**

A real-time representation of an emergency vehicle's current state, including engine status, fuel/battery level, speed, location, equipment status, and operational readiness. This dashboard serves as the primary interface for operators to monitor the live condition of any vehicle in the fleet at a glance. All data is synchronized via Supabase real-time subscriptions so the twin stays in sync with the physical asset.

### Key Capabilities

- Display real-time engine status (running, idle, off, fault)
- Show current fuel/battery level with threshold warnings
- Present live speed, heading, and GPS coordinates
- Render equipment checklist with operational/fault indicators
- Calculate and display overall operational readiness score
- Toggle between summary view and detailed subsystem breakdowns

### Primary UI Components

- `VehicleTwinCard` — condensed overview card per vehicle
- `VehicleDetailPanel` — full-screen detailed state view
- `ReadinessGauge` — circular gauge for operational readiness score
- `EquipmentStatusList` — checklist of onboard equipment with status icons

### Supabase Tables Involved

- `vehicles` — core vehicle profile and metadata
- `vehicle_state` — current snapshot of vehicle state (latest telemetry)
- `equipment` — equipment inventory linked to each vehicle

### Priority

**P0** — Must-have for POC

### Assigned to

**Agent 1**

---

## Feature 2: Telemetry & Event Processing

**The data backbone — ingestion, storage, and streaming of all sensor and event data.**

Handles the ingestion and processing of telemetry data streams from simulated sensors (GPS, speed, engine temperature, fuel level, tire pressure, etc.) and discrete events (dispatch, arrival on scene, maintenance alerts). All data is stored in Supabase with real-time subscriptions pushing updates to connected clients. A simulation engine generates realistic telemetry for POC demonstration purposes.

### Key Capabilities

- Ingest simulated telemetry at configurable intervals (1–10 second ticks)
- Store time-series telemetry data with vehicle and timestamp indexing
- Process and store discrete events (dispatch, arrival, maintenance, alert)
- Push real-time updates to subscribed dashboard clients via Supabase Realtime
- Provide a telemetry simulation toggle for demo/POC scenarios
- Support batch queries for historical telemetry retrieval

### Primary UI Components

- `TelemetryFeed` — scrolling live feed of incoming data points
- `EventTimeline` — chronological timeline of discrete events per vehicle
- `SimulationControls` — start/stop/configure the telemetry simulator

### Supabase Tables Involved

- `telemetry` — time-series telemetry records (GPS, speed, temp, fuel, pressure)
- `events` — discrete event log (dispatch, arrival, maintenance, alerts)
- `vehicles` — foreign key reference for all telemetry and events

### Priority

**P0** — Must-have for POC

### Assigned to

**Agent 2**

---

## Feature 3: Anomaly & Risk Detection

**Automated detection of problems before they become failures.**

Rule-based and threshold-based detection of anomalies such as engine overheating, tire pressure drops, unusual route deviations, and equipment failures. The system calculates a risk score per vehicle and automatically generates alerts when thresholds are breached. Processing logic runs in Supabase Edge Functions triggered by new telemetry inserts.

### Key Capabilities

- Define configurable threshold rules (e.g., engine temp > 110°C, tire pressure < 28 PSI)
- Detect route deviation beyond acceptable corridor using geospatial comparison
- Calculate composite risk score (0–100) per vehicle based on active anomalies
- Automatically generate and store alerts with severity levels (info, warning, critical)
- Trigger Supabase Edge Functions on telemetry insert for near-real-time detection
- Support alert acknowledgment and resolution workflow

### Primary UI Components

- `AlertBanner` — top-of-page banner for critical active alerts
- `AnomalyList` — filterable list of detected anomalies per vehicle
- `RiskScoreBadge` — color-coded risk indicator on vehicle cards
- `ThresholdConfigPanel` — admin interface for managing detection rules

### Supabase Tables Involved

- `alerts` — generated alerts with severity, status, and linked vehicle/telemetry
- `anomaly_rules` — configurable threshold and rule definitions
- `telemetry` — source data triggering anomaly checks
- `vehicle_state` — updated risk score written back to vehicle state

### Priority

**P0** — Must-have for POC

### Assigned to

**Agent 3**

---

## Feature 4: Scenario Simulation ("What If")

**Explore hypothetical outcomes without real-world consequences.**

Allows operators to simulate hypothetical scenarios against the current digital twin state. Examples include: "What if we dispatch Vehicle X instead of Y?", "What if traffic increases by 30%?", "What if fuel drops below threshold mid-route?". The system projects outcomes such as estimated response times, fuel consumption, and risk levels based on the current twin state and configurable parameters.

### Key Capabilities

- Run dispatch comparison simulations (Vehicle X vs. Vehicle Y for a given incident)
- Model traffic condition changes and their impact on response times
- Simulate fuel/battery depletion scenarios for mid-route feasibility checks
- Display projected outcomes side-by-side with current baseline
- Save and replay simulation configurations for training purposes
- Compute projected risk scores under simulated conditions

### Primary UI Components

- `ScenarioBuilder` — form-based interface to define simulation parameters
- `OutcomeComparisonPanel` — side-by-side projected vs. baseline results
- `SimulationResultCard` — summary card for each simulation run
- `ScenarioHistoryList` — saved/past simulation runs

### Supabase Tables Involved

- `simulations` — saved simulation configurations and results
- `vehicles` — source data for vehicle capabilities and current state
- `vehicle_state` — baseline state used as simulation starting point
- `telemetry` — historical data used to inform projections

### Priority

**P1** — Important

### Assigned to

**Agent 4**

---

## Feature 5: Actionable Insights & Reporting

**Turn raw data into decisions with KPIs, charts, and recommendations.**

A reporting dashboard presenting key performance indicators, charts, and data-driven recommendations derived from telemetry and event history. Covers response time analytics, vehicle utilization rates, maintenance predictions, and fleet efficiency metrics. Includes export capability for offline analysis and stakeholder reporting.

### Key Capabilities

- Display KPI cards for average response time, fleet utilization, and uptime
- Render time-series charts for telemetry trends (fuel usage, mileage, response times)
- Generate maintenance prediction estimates based on telemetry patterns
- Provide fleet efficiency comparison across vehicle types
- Export reports as CSV or PDF
- Support date range filtering and vehicle/type grouping

### Primary UI Components

- `KPIDashboard` — grid of key metric cards with sparklines
- `TrendChart` — configurable time-series chart component (Chart.js or Recharts)
- `ReportTable` — tabular data view with sorting and filtering
- `ExportButton` — CSV/PDF export trigger
- `DateRangeFilter` — date picker for scoping report data

### Supabase Tables Involved

- `telemetry` — source data for trend analysis and KPI computation
- `events` — event data for response time and utilization calculations
- `vehicles` — vehicle metadata for grouping and categorization
- `reports` — saved/generated report snapshots (optional)

### Priority

**P1** — Important

### Assigned to

**Agent 5**

---

## Feature 6: Vehicle Fleet Management

**The operational backbone — manage every vehicle in the fleet.**

Full CRUD operations for managing a fleet of emergency vehicles. Each vehicle has a detailed profile including type, specs, maintenance schedule, assignment history, and current status. Supports five vehicle types: Police, Ambulance, Fire Truck, Civil Protection, and Hybrid/Specialized. This feature provides the foundational data layer that all other features depend on.

### Key Capabilities

- Create, read, update, and delete vehicle records
- Assign vehicle type from predefined categories (Police, Ambulance, Fire Truck, Civil Protection, Hybrid/Specialized)
- Track maintenance schedules with upcoming and overdue indicators
- Record assignment history (which incidents a vehicle has been dispatched to)
- Set and update vehicle operational status (available, dispatched, maintenance, out-of-service)
- Bulk import/export vehicle data via CSV

### Primary UI Components

- `FleetTable` — sortable, filterable table of all vehicles in the fleet
- `VehicleForm` — create/edit form for vehicle profiles
- `MaintenanceSchedulePanel` — upcoming and past maintenance entries
- `AssignmentHistoryTimeline` — chronological dispatch/assignment log
- `VehicleTypeFilter` — filter fleet view by vehicle type

### Supabase Tables Involved

- `vehicles` — core vehicle records (type, specs, status, metadata)
- `maintenance_logs` — scheduled and completed maintenance entries
- `assignments` — dispatch and assignment history per vehicle
- `equipment` — linked equipment inventory per vehicle

### Priority

**P0** — Must-have for POC

### Assigned to

**Agent 6**

---

## Feature 7: Real-time Map & Geolocation

**See where every vehicle is, right now, on a live map.**

An interactive map displaying vehicle positions in real-time, updated via Supabase real-time subscriptions. Supports route visualization, geofencing (defining zones of interest), proximity alerts, and coverage area analysis. Built with Leaflet and OpenStreetMap tiles to keep the POC dependency-free from commercial map providers.

### Key Capabilities

- Render all fleet vehicles on an interactive Leaflet map with real-time position updates
- Visualize active and historical routes as polylines on the map
- Define and display geofence zones (hospitals, stations, coverage areas)
- Trigger proximity alerts when vehicles enter or leave geofenced areas
- Analyze fleet coverage by overlaying radius circles from vehicle positions
- Cluster vehicle markers at lower zoom levels for readability

### Primary UI Components

- `FleetMap` — main Leaflet map container with vehicle markers
- `VehicleMarker` — custom marker with vehicle type icon and status color
- `RouteOverlay` — polyline layer for active/historical routes
- `GeofenceEditor` — draw and manage geofence zones on the map
- `CoverageHeatmap` — overlay showing fleet coverage density

### Supabase Tables Involved

- `vehicles` — vehicle metadata for marker rendering
- `vehicle_state` — latest GPS coordinates for real-time positioning
- `telemetry` — historical GPS data for route reconstruction
- `geofences` — defined geofence zone geometries and metadata

### Priority

**P0** — Must-have for POC

### Assigned to

**Agent 7**

---

## Feature 8: Auth & Role-Based Access Control

**Secure the system — right people, right access, right actions.**

Authentication and authorization using Supabase Auth with email/password login. Four roles define access levels: Admin (full access to all features and configuration), Dispatcher (operations and simulation access), Operator (read access with limited actions such as acknowledging alerts), and Viewer (read-only access). Row Level Security (RLS) policies in Supabase enforce access control at the database level.

### Key Capabilities

- Email/password authentication via Supabase Auth
- Role assignment and management (Admin, Dispatcher, Operator, Viewer)
- Enforce Row Level Security policies per table based on user role
- Protect API routes and UI components based on authenticated role
- Support session management with automatic token refresh
- Provide an admin interface for user and role management

### Primary UI Components

- `LoginPage` — email/password login form
- `RoleGuard` — wrapper component that restricts child rendering by role
- `UserManagementTable` — admin view for listing and editing users/roles
- `ProfileMenu` — user avatar dropdown with role display and logout

### Supabase Tables Involved

- `auth.users` — Supabase managed auth table
- `profiles` — extended user profile with role assignment
- `roles` — role definitions and permission mappings

### Priority

**P0** — Must-have for POC

### Assigned to

**Agent 8**

---

## Priority Summary

| Priority | Features | Count |
|----------|----------|-------|
| **P0** — Must-have | Vehicle State Dashboard, Telemetry & Event Processing, Anomaly & Risk Detection, Vehicle Fleet Management, Real-time Map & Geolocation, Auth & RBAC | 6 |
| **P1** — Important | Scenario Simulation ("What If"), Actionable Insights & Reporting | 2 |
| **P2** — Nice-to-have | — | 0 |

## Agent Assignment Summary

| Agent | Feature |
|-------|---------|
| Agent 1 | Vehicle State Dashboard |
| Agent 2 | Telemetry & Event Processing |
| Agent 3 | Anomaly & Risk Detection |
| Agent 4 | Scenario Simulation ("What If") |
| Agent 5 | Actionable Insights & Reporting |
| Agent 6 | Vehicle Fleet Management |
| Agent 7 | Real-time Map & Geolocation |
| Agent 8 | Auth & Role-Based Access Control |
