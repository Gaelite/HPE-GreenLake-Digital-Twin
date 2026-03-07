# Digital Twin - Emergency Vehicles POC — Project Plan

## 1. Vision

Design and build a functional prototype (POC) of a **Digital Twin for Emergency Services Vehicles** (Police, Ambulance, Fire Truck, Civil Protection, Hybrid/Specialized), capable of simulating behavior in critical situations and providing operational intelligence.

The Digital Twin will serve as a virtual replica of each physical vehicle, continuously reflecting its state, processing telemetry, detecting anomalies, and enabling "what if" scenario simulations — all through a modern web interface backed by real-time data infrastructure.

This is a **proof of concept**. The goal is to demonstrate the core value proposition with simulated data, a clean architecture, and a working end-to-end flow — not to build a production-grade fleet management system.

---

## 2. What the Digital Twin Does

A Digital Twin in this context is a live, data-driven virtual representation of an emergency vehicle. It goes beyond a simple dashboard by maintaining a continuous model of each vehicle's state and behavior.

| Capability | Description |
|---|---|
| **Vehicle State Representation** | Mirrors the current state of each vehicle (location, speed, fuel, engine status, equipment, deployment status) from real or simulated data sources. |
| **Telemetry & Event Processing** | Ingests streams of telemetry readings (GPS, speed, engine metrics, environmental sensors) and discrete events (dispatch, arrival, equipment deployment) to keep the twin synchronized. |
| **Anomaly & Risk Detection** | Applies rule-based and threshold-based logic to detect anomalies (overheating engine, excessive speed, fuel critically low) and assess risk levels in real time. |
| **Scenario Simulation ("What If")** | Allows operators to run hypothetical scenarios — e.g., "What if this ambulance is rerouted?", "What if fuel runs out in 15 minutes?", "What if two units respond instead of one?" — and see projected outcomes. |
| **Actionable Insights** | Aggregates data into meaningful, decision-ready insights: maintenance predictions, response time analysis, resource optimization suggestions, and operational summaries. |

---

## 3. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router, React Server Components) | Modern React framework with SSR, file-based routing, and server components for performance. |
| **Backend / API** | Next.js API Routes + Supabase Edge Functions | API routes for frontend-specific logic; Edge Functions for background processing, simulation engines, and webhook handlers. |
| **Database** | Supabase (PostgreSQL) with Row Level Security (RLS) | Robust relational DB with built-in security policies. PostgreSQL extensions (PostGIS for geo, pg_cron for scheduling) available. |
| **Real-time** | Supabase Realtime (WebSocket subscriptions) | Push-based updates for telemetry, vehicle state changes, and anomaly alerts without polling. |
| **Authentication** | Supabase Auth (email/password, role-based) | Built-in auth with JWT tokens, integrates directly with RLS policies for row-level access control. |
| **Maps** | Leaflet or Mapbox GL JS (free tier) | Interactive maps for vehicle geolocation, route visualization, and coverage areas. |
| **Charts** | Recharts or Chart.js | Lightweight charting for telemetry trends, fleet statistics, and simulation results. |
| **Styling** | Tailwind CSS | Utility-first CSS for rapid, consistent UI development. |
| **State Management** | React Context + Supabase Realtime subscriptions | Context for app-level state; Supabase subscriptions for live data sync — no need for Redux in a POC. |
| **Deployment** | Vercel (frontend) + Supabase Cloud (backend) | Zero-config deployment for Next.js on Vercel; managed Supabase instance for DB, Auth, and Realtime. |

---

## 4. Architecture Overview

The architecture follows a straightforward client-server model with Supabase providing the entire backend infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
│                                                                 │
│   Next.js App Router (React Server Components + Client)         │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│   │Dashboard │ │  Maps    │ │Simulation│ │ Fleet Management │  │
│   │  Views   │ │  View    │ │  Engine  │ │     Views        │  │
│   └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬──────────┘  │
│        │             │            │                │             │
│   ┌────┴─────────────┴────────────┴────────────────┴──────────┐ │
│   │              Next.js API Routes (middleware)               │ │
│   └────────────────────────┬──────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────┼────────────────────────────────────┐
│                    SUPABASE CLOUD                                │
│                            │                                    │
│   ┌────────────────────────┴──────────────────────────────────┐ │
│   │                    Supabase API Gateway                   │ │
│   └──┬──────────┬──────────────┬───────────────┬──────────────┘ │
│      │          │              │               │                │
│   ┌──┴───┐  ┌──┴───────┐  ┌──┴────────┐  ┌───┴─────────────┐  │
│   │ Auth │  │ Realtime  │  │  Edge     │  │   PostgreSQL    │  │
│   │(JWT) │  │(WebSocket)│  │ Functions │  │   + PostGIS     │  │
│   └──────┘  └──────────┘  └───────────┘  │   + RLS         │  │
│                                           │   + pg_cron     │  │
│                                           └─────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Simulated telemetry** is generated by a Supabase Edge Function (or seeded via a script) and written to PostgreSQL.
2. **Supabase Realtime** pushes changes to subscribed clients via WebSocket.
3. **Next.js Server Components** fetch initial data directly from Supabase on the server (SSR).
4. **Client Components** subscribe to real-time channels for live updates (telemetry, alerts, state changes).
5. **API Routes** handle orchestration tasks: triggering simulations, aggregating insights, and managing complex queries.
6. **Edge Functions** run background logic: anomaly detection rules, simulation calculations, and data aggregation jobs.

---

## 5. Database Schema (High-Level)

All tables live in Supabase PostgreSQL with RLS policies applied.

### Core Tables

```sql
-- Vehicle registry and current state
vehicles
  id              UUID PRIMARY KEY
  type            ENUM ('police', 'ambulance', 'fire_truck', 'civil_protection', 'hybrid_specialized')
  call_sign       TEXT UNIQUE
  status          ENUM ('available', 'dispatched', 'en_route', 'on_scene', 'returning', 'out_of_service')
  current_lat     DOUBLE PRECISION
  current_lng     DOUBLE PRECISION
  fuel_level      NUMERIC
  speed           NUMERIC
  engine_status   ENUM ('off', 'idle', 'running', 'warning', 'critical')
  equipment       JSONB
  metadata        JSONB
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

-- Time-series telemetry from vehicles
telemetry_readings
  id              UUID PRIMARY KEY
  vehicle_id      UUID REFERENCES vehicles(id)
  timestamp       TIMESTAMPTZ
  lat             DOUBLE PRECISION
  lng             DOUBLE PRECISION
  speed           NUMERIC
  fuel_level      NUMERIC
  engine_temp     NUMERIC
  tire_pressure   JSONB
  battery_voltage NUMERIC
  odometer        NUMERIC
  payload         JSONB           -- extensible sensor data
  created_at      TIMESTAMPTZ

-- Discrete operational events
events
  id              UUID PRIMARY KEY
  vehicle_id      UUID REFERENCES vehicles(id)
  event_type      TEXT             -- 'dispatch', 'arrival', 'departure', 'equipment_deploy', etc.
  severity        ENUM ('info', 'warning', 'critical')
  description     TEXT
  payload         JSONB
  timestamp       TIMESTAMPTZ
  created_at      TIMESTAMPTZ

-- Detected anomalies and risk assessments
anomalies
  id              UUID PRIMARY KEY
  vehicle_id      UUID REFERENCES vehicles(id)
  anomaly_type    TEXT             -- 'overheating', 'low_fuel', 'excessive_speed', etc.
  severity        ENUM ('low', 'medium', 'high', 'critical')
  description     TEXT
  threshold       JSONB            -- the rule that triggered it
  current_value   NUMERIC
  status          ENUM ('active', 'acknowledged', 'resolved')
  detected_at     TIMESTAMPTZ
  resolved_at     TIMESTAMPTZ
  created_at      TIMESTAMPTZ

-- "What if" scenario definitions
scenarios
  id              UUID PRIMARY KEY
  name            TEXT
  description     TEXT
  scenario_type   TEXT             -- 'reroute', 'resource_change', 'failure', 'demand_surge'
  parameters      JSONB            -- input parameters for the simulation
  created_by      UUID REFERENCES profiles(id)
  created_at      TIMESTAMPTZ

-- Results from running a scenario simulation
simulation_results
  id              UUID PRIMARY KEY
  scenario_id     UUID REFERENCES scenarios(id)
  vehicle_id      UUID REFERENCES vehicles(id)
  result_data     JSONB            -- projected outcomes, timelines, metrics
  summary         TEXT
  risk_score      NUMERIC
  created_at      TIMESTAMPTZ

-- User profiles (extends Supabase Auth)
profiles
  id              UUID PRIMARY KEY REFERENCES auth.users(id)
  email           TEXT
  full_name       TEXT
  role            ENUM ('admin', 'operator', 'analyst', 'viewer')
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

### Key Indexes

- `telemetry_readings(vehicle_id, timestamp DESC)` — fast lookups for latest readings per vehicle.
- `events(vehicle_id, timestamp DESC)` — chronological event log per vehicle.
- `anomalies(vehicle_id, status)` — quick filter for active anomalies.
- `vehicles(type, status)` — fleet filtering.

### RLS Policy Summary

| Table | Admin | Operator | Analyst | Viewer |
|---|---|---|---|---|
| vehicles | CRUD | Read + Update status | Read | Read |
| telemetry_readings | CRUD | Read + Insert | Read | Read |
| events | CRUD | Read + Insert | Read | Read |
| anomalies | CRUD | Read + Update status | Read | Read |
| scenarios | CRUD | CRUD | Read + Create | Read |
| simulation_results | CRUD | Read | Read | Read |
| profiles | CRUD | Read own | Read own | Read own |

---

## 6. Feature Breakdown (8 Features)

### Feature 1: Vehicle State Dashboard

The primary view of each vehicle's digital twin. Displays real-time state — location, speed, fuel, engine health, deployment status, and equipped resources — in a unified, at-a-glance dashboard. Each vehicle type has contextual data fields (e.g., water tank level for fire trucks, patient bay status for ambulances).

### Feature 2: Telemetry & Event Processing

Ingestion and display of time-series telemetry data (GPS, speed, engine metrics, fuel) and discrete operational events (dispatch, arrival, equipment deployment). Includes historical charts, event timelines, and the data pipeline that keeps the digital twin synchronized.

### Feature 3: Anomaly & Risk Detection

Rule-based engine that continuously evaluates telemetry against configurable thresholds to detect anomalies (overheating, low fuel, excessive speed, tire pressure drop). Each anomaly is classified by severity, logged, and triggers real-time alerts. A risk score is computed per vehicle.

### Feature 4: Scenario Simulation ("What If")

Interactive tool allowing operators and analysts to define hypothetical scenarios — rerouting a vehicle, simulating a mechanical failure, changing resource allocation — and project outcomes. Displays estimated response times, risk impacts, and resource utilization under each scenario.

### Feature 5: Actionable Insights & Reporting

Aggregated intelligence layer: maintenance predictions, fleet utilization trends, response time analytics, and operational summaries. Presents data-driven recommendations (e.g., "Vehicle P-03 is due for maintenance based on engine temperature trends over the past 48 hours").

### Feature 6: Vehicle Fleet Management

Administrative interface for managing the vehicle registry: adding/editing vehicles, updating equipment loadouts, changing deployment status, and viewing the fleet as a filterable/sortable table. Supports all 5 vehicle types with type-specific metadata.

### Feature 7: Real-time Map & Geolocation

Live map view showing all active vehicles with real-time position updates. Supports filtering by vehicle type and status, click-to-inspect for vehicle details, route history trails, and coverage area visualization. Uses Leaflet/Mapbox with Supabase Realtime for live positions.

### Feature 8: Auth & Role-Based Access Control

Complete authentication flow (sign up, sign in, sign out, password reset) using Supabase Auth. Role-based access (Admin, Operator, Analyst, Viewer) enforced at both the UI layer (conditional rendering, route guards) and the database layer (RLS policies). Profile management included.

---

## 7. Development Phases

### Phase 1: Foundation (Week 1)

**Goal**: Project scaffolding, authentication, database, and the skeleton of the application.

| Task | Details |
|---|---|
| Project setup | Initialize Next.js 14+ with App Router, Tailwind CSS, Supabase client library. |
| Supabase configuration | Create project, configure Auth (email/password), set up database tables and RLS policies. |
| Auth flow (Feature 8) | Sign up, sign in, sign out, route guards, role assignment. |
| Database schema | Create all tables, indexes, RLS policies, and seed data script. |
| Layout & navigation | App shell with sidebar, header, role-aware navigation. |
| Seed data | Script to populate 10-15 vehicles across all 5 types with initial telemetry. |

### Phase 2: Core Twin (Week 2)

**Goal**: The digital twin comes alive — vehicle state, real-time telemetry, and live updates.

| Task | Details |
|---|---|
| Vehicle State Dashboard (Feature 1) | Build the single-vehicle twin view with all state indicators. |
| Telemetry pipeline (Feature 2) | Simulated telemetry generator (Edge Function or script), ingestion, real-time subscriptions. |
| Event processing (Feature 2) | Event logging, timeline display, event-driven state updates. |
| Fleet Management (Feature 6) | Vehicle CRUD, fleet table, type-specific forms. |
| Real-time infrastructure | Supabase Realtime channels, subscription hooks, optimistic UI updates. |

### Phase 3: Intelligence (Week 3)

**Goal**: The twin becomes smart — detecting anomalies, running simulations, and generating insights.

| Task | Details |
|---|---|
| Anomaly detection (Feature 3) | Rule engine, threshold configuration, anomaly logging, real-time alerts. |
| Scenario simulation (Feature 4) | Scenario builder UI, simulation logic (Edge Function), result visualization. |
| Insights & reporting (Feature 5) | Aggregation queries, trend charts, recommendation engine, exportable reports. |
| Risk scoring | Per-vehicle risk computation based on active anomalies and telemetry trends. |

### Phase 4: Polish (Week 4)

**Goal**: Visual layer, integration, and demo readiness.

| Task | Details |
|---|---|
| Map view (Feature 7) | Leaflet/Mapbox integration, live vehicle markers, route trails, click-to-inspect. |
| Dashboard polish | Fleet overview dashboard with KPI cards, charts, and status summaries. |
| Cross-feature integration | Anomalies visible on map, simulation results in dashboard, insights linked to vehicles. |
| Demo data & scenarios | Curated seed data and pre-built scenarios for a compelling demo walkthrough. |
| Testing & bug fixes | End-to-end testing of all features, edge cases, and error handling. |

---

## 8. Agent Assignment

Each feature is owned by a dedicated senior agent responsible for implementation end-to-end.

| Agent | Feature | Scope |
|---|---|---|
| **Agent 1** | Vehicle State Dashboard | Single-vehicle twin view, state indicators, type-specific displays, real-time state sync. |
| **Agent 2** | Telemetry & Event Processing | Telemetry generator, ingestion pipeline, time-series charts, event timeline, data retention. |
| **Agent 3** | Anomaly & Risk Detection | Rule engine, threshold config, anomaly CRUD, severity classification, real-time alerts, risk scoring. |
| **Agent 4** | Scenario Simulation ("What If") | Scenario builder UI, simulation parameters, Edge Function logic, result projection and visualization. |
| **Agent 5** | Actionable Insights & Reporting | Aggregation queries, trend analysis, recommendation engine, report views, export functionality. |
| **Agent 6** | Vehicle Fleet Management | Vehicle CRUD, fleet table/grid, type-specific metadata forms, equipment management, status workflows. |
| **Agent 7** | Real-time Map & Geolocation | Map component, live markers, route history, coverage zones, vehicle type filters, click-to-inspect. |
| **Agent 8** | Auth & Role-Based Access Control | Supabase Auth setup, sign up/in/out flows, role management, RLS policies, route guards, profile management. |

### Cross-Cutting Responsibilities

- **Agent 8** (Auth) delivers first — all other agents depend on auth and role context.
- **Agent 6** (Fleet) and **Agent 2** (Telemetry) deliver the data layer that **Agent 1** (Dashboard), **Agent 3** (Anomaly), and **Agent 7** (Map) depend on.
- **Agent 3** (Anomaly) outputs feed into **Agent 5** (Insights) and **Agent 4** (Simulation).
- All agents share a common component library (UI primitives, layout components, Supabase client utilities).

---

## 9. POC Constraints

This is a proof of concept. The following constraints apply to keep scope manageable and delivery realistic.

| Constraint | Implication |
|---|---|
| **Simulated data only** | No real vehicle hardware, OBD-II adapters, or IoT integrations. All telemetry is generated by scripts or Edge Functions on a timer. |
| **Single-tenant** | One organization, one Supabase project. No multi-tenancy, no organization switching. |
| **5 vehicle types only** | Police, Ambulance, Fire Truck, Civil Protection, Hybrid/Specialized. No custom type creation. |
| **No mobile-specific UI** | Responsive design via Tailwind, but no dedicated mobile layout, PWA, or native app. Desktop-first. |
| **Focus on concept demonstration** | Favor breadth over depth. Each feature should work end-to-end but does not need to cover every edge case. |
| **No production hardening** | No rate limiting, no advanced caching, no CI/CD pipeline, no load testing. Acceptable for a demo environment. |
| **Limited simulation complexity** | Simulation logic uses simplified models (linear projections, basic heuristics) rather than physics engines or ML models. |
| **English only** | No internationalization (i18n). All UI text and data in English. |

---

## 10. Success Criteria

The POC is considered successful when the following criteria are demonstrably met.

| # | Criterion | Validation |
|---|---|---|
| 1 | **Real-time vehicle twin visualization** | Open a vehicle's dashboard and see its state update live (position, speed, fuel, engine) as simulated telemetry streams in. |
| 2 | **"What if" scenario simulation** | Create a scenario (e.g., "reroute ambulance A-02 to a farther hospital"), run it, and see projected impact on response time and fuel. |
| 3 | **Anomaly detection and alerting** | Simulate a condition that triggers an anomaly (e.g., engine overheating), see it detected in real time, classified by severity, and displayed as an alert. |
| 4 | **Actionable insights on dashboard** | View a dashboard that shows aggregated fleet health, maintenance predictions, and at least one data-driven recommendation. |
| 5 | **Multi-role access control** | Log in as different roles (Admin, Operator, Analyst, Viewer) and confirm that UI elements and data access are correctly restricted per role. |
| 6 | **Fleet map with live positions** | Open the map view and see all active vehicles plotted with real-time position updates and type-based icons. |
| 7 | **End-to-end data flow** | Trace a complete flow: telemetry generated, twin updated, anomaly detected, alert raised, insight generated — all without manual intervention. |
| 8 | **Clean, navigable UI** | A non-technical stakeholder can navigate the application, understand the vehicle state, and interpret the insights without guidance. |

---

## Appendix: Vehicle Types Reference

| Type | Code | Example Equipment | Specific Telemetry |
|---|---|---|---|
| **Police** | `police` | Radio, MDT, lights/sirens, weapons locker | Pursuit mode, dash cam status |
| **Ambulance** | `ambulance` | Stretcher, defibrillator, oxygen supply, IV kit | Patient bay temp, medical equipment charge levels |
| **Fire Truck** | `fire_truck` | Hose reels, water tank, ladder, SCBA sets | Water tank level, pump pressure, ladder extension |
| **Civil Protection** | `civil_protection` | Generator, flood barriers, rescue tools, comms relay | Generator fuel, deployed barrier count |
| **Hybrid/Specialized** | `hybrid_specialized` | Configurable loadout | Custom sensor array, multi-role status |
