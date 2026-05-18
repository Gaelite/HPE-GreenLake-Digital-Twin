# Digital Twin Operational Workflow

## Overview

The orchestration layer coordinates telemetry ingestion, anomaly detection,
real-time synchronization, simulation services, and AI-driven route optimization.

The system is deployed using a distributed cloud-native architecture based on:

- Vercel (Next.js frontend + API routes)
- Supabase Cloud (database, authentication, realtime)
- Python FastAPI microservice (A3T-GCN model)

---

# Workflow Stages

## 1. Telemetry Generation

The world simulation engine generates telemetry readings every 5 seconds
for active emergency vehicles.

Generated metrics include:

- Speed
- Engine temperature
- Fuel level
- Tire pressure
- Battery voltage
- RPM
- Oil pressure
- Odometer

---

## 2. Telemetry Ingestion

Telemetry data is sent through Next.js API routes and inserted into
Supabase PostgreSQL tables.

Updated vehicle coordinates are stored simultaneously.

---

## 3. Realtime Synchronization

Supabase Realtime broadcasts INSERT and UPDATE events through WebSockets
to subscribed frontend clients.

Affected UI modules include:

- FleetMap
- VehicleTwin
- TelemetryFeed
- EventTimeline

---

## 4. Anomaly Detection

The anomaly engine evaluates telemetry against configurable detection rules.

If thresholds are violated:

- anomaly records are created
- risk_score is recalculated
- alerts are propagated in realtime

---

## 5. Incident Simulation

The simulation engine generates incidents such as:

- accidents
- fires
- road closures
- medical emergencies

Vehicles are dispatched dynamically.

---

## 6. AI Route Optimization

Traffic-related incidents trigger requests to the Python FastAPI microservice.

The A3T-GCN model:

- recalculates graph edge weights
- predicts congestion propagation
- generates optimized routes using A* / Dijkstra

---

## 7. Frontend Visualization

Updated routes, telemetry, and incidents are rendered live in the frontend map
and dashboard components.

---

# Error Handling

## Telemetry Failure

If telemetry insertion fails:

- the request is logged
- the simulation cycle continues
- failed batches may be retried manually

## Microservice Failure

If the AI optimization service becomes unavailable:

- the simulation falls back to default routing
- the incident workflow continues
- route optimization is skipped temporarily

## Realtime Failure

If realtime synchronization disconnects:

- frontend clients reconnect automatically
- cached state remains visible

---

# Deployment Coordination

## Frontend Deployment

Hosted on Vercel.

## Database + Realtime

Hosted on Supabase Cloud.

## AI Microservice

Hosted separately using FastAPI infrastructure.
