# Feature 5: Actionable Insights & Reporting

## Overview

Analytics dashboard providing KPIs, charts, trends, and data-driven recommendations. Turns raw telemetry and event data into operational intelligence. Includes fleet-wide metrics and per-vehicle analytics.

This feature transforms the data collected by other features (telemetry, anomalies, events) into visual, digestible, and actionable information that supports better operational decisions.

## Assigned To: Agent 5 (Senior Analytics/BI Engineer)

---

## User Stories

- **As a fleet manager**, I want to see fleet-wide KPIs at a glance so I can understand overall operational health without digging through raw data.
- **As a dispatcher**, I want response time analytics to optimize dispatch decisions and identify bottlenecks in our response pipeline.
- **As an admin**, I want to export reports for stakeholders so I can share performance data in meetings and reviews.
- **As a manager**, I want maintenance prediction insights so I can schedule preventive maintenance and avoid unexpected breakdowns.

---

## Key Capabilities

### Fleet KPI Dashboard
Top-level metrics displayed as cards with sparklines:
- **Average Response Time** (minutes) -- across all dispatches in the selected time range
- **Fleet Utilization %** -- percentage of vehicles that were dispatched at least once in the period
- **Vehicles In Service** -- count of vehicles with status `available` or `dispatched`
- **Active Alerts** -- count of unresolved anomalies/alerts

### Per-Vehicle Analytics
Drill-down view for a specific vehicle:
- **Usage Hours** -- total hours the vehicle was in `dispatched` or `en_route` status
- **Fuel Efficiency** -- average fuel consumption per km/mile
- **Maintenance History** -- timeline of past maintenance events
- **Anomaly Frequency** -- count and trend of anomalies detected

### Time-Series Charts
Interactive line charts (built with Recharts) showing telemetry trends over time:
- Fuel level over time
- Speed over time
- Engine temperature over time
- Configurable time range (last 1h, 6h, 24h, 7d, 30d)

### Response Time Analytics
- Average, P50, P95 response times per vehicle type (ambulance, fire engine, etc.)
- Trend over time (improving or degrading)
- Breakdown by zone/area if location data is available

### Maintenance Prediction (Simple)
POC-level prediction based on straightforward rules:
- Mileage since last service exceeds threshold
- Hours of operation since last service exceeds threshold
- Number of anomalies in recent period exceeds threshold
- Output: "Vehicle X is due for maintenance" insight

### Fleet Utilization Heatmap
Grid or heatmap visualization showing:
- Which vehicles are most/least used
- Color-coded by utilization level (low/medium/high)
- Helps identify over-utilized and under-utilized assets

### Automated Recommendations
System-generated insight cards based on data analysis:
- "Vehicle X is due for maintenance (5,200 km since last service)"
- "Response times improving in Zone A (down 12% this week)"
- "Vehicle Y has had 4 anomalies this week -- consider inspection"
- "Fleet utilization is at 38% -- consider reducing active fleet size"

### Export to CSV/PDF
- Export telemetry data as CSV for further analysis
- Date range filtering on exports
- Column selection for CSV exports

---

## Supabase Tables

### Existing Tables Used
- `vehicles` -- vehicle metadata and current state
- `telemetry_readings` -- time-series sensor data
- `events` -- dispatch events, status changes
- `anomalies` -- detected anomalies and alerts

### New Table: `insights`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique insight identifier |
| `insight_type` | `text` | Type of insight (see types below) |
| `title` | `text` | Short title for the insight card |
| `description` | `text` | Detailed explanation of the insight |
| `severity` | `text` | `info`, `warning`, `critical` |
| `vehicle_id` | `uuid` (FK -> vehicles, nullable) | Associated vehicle, if applicable |
| `metadata` | `jsonb` | Additional structured data specific to the insight type |
| `created_at` | `timestamptz` | When the insight was generated |
| `is_dismissed` | `boolean` | Whether the user has dismissed this insight (default: `false`) |

#### Insight Types

| Type | Description | Example |
|---|---|---|
| `maintenance_due` | Vehicle approaching maintenance threshold | "Engine 5: 5,200 km since last service" |
| `response_time_trend` | Response times trending up or down | "Zone A response times down 12%" |
| `anomaly_spike` | Unusual number of anomalies detected | "Vehicle 3: 4 anomalies this week" |
| `utilization_alert` | Fleet or vehicle utilization outside normal range | "Fleet utilization at 38%" |
| `fuel_efficiency` | Fuel efficiency degradation detected | "Vehicle 9 fuel efficiency down 15%" |

### SQL Migration

```sql
-- Create insights table
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'maintenance_due', 'response_time_trend', 'anomaly_spike',
    'utilization_alert', 'fuel_efficiency'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  is_dismissed BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_insights_type ON insights(insight_type);
CREATE INDEX idx_insights_severity ON insights(severity);
CREATE INDEX idx_insights_vehicle ON insights(vehicle_id);
CREATE INDEX idx_insights_dismissed ON insights(is_dismissed) WHERE is_dismissed = false;
CREATE INDEX idx_insights_created ON insights(created_at DESC);

-- RLS Policies
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view insights"
  ON insights FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert insights"
  ON insights FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can dismiss insights"
  ON insights FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

### Aggregation Functions (PostgreSQL / Supabase)

```sql
-- Fleet KPIs: Average response time
CREATE OR REPLACE FUNCTION get_avg_response_time(time_from TIMESTAMPTZ, time_to TIMESTAMPTZ)
RETURNS NUMERIC AS $$
  SELECT AVG(
    EXTRACT(EPOCH FROM (
      (result_data->>'arrived_at')::TIMESTAMPTZ -
      (result_data->>'dispatched_at')::TIMESTAMPTZ
    )) / 60
  )
  FROM events
  WHERE event_type = 'dispatch'
    AND created_at BETWEEN time_from AND time_to;
$$ LANGUAGE sql STABLE;

-- Fleet KPIs: Fleet utilization percentage
CREATE OR REPLACE FUNCTION get_fleet_utilization(time_from TIMESTAMPTZ, time_to TIMESTAMPTZ)
RETURNS NUMERIC AS $$
  SELECT (
    COUNT(DISTINCT vehicle_id) FILTER (
      WHERE event_type = 'dispatch' AND created_at BETWEEN time_from AND time_to
    )::NUMERIC /
    NULLIF(COUNT(DISTINCT id), 0) * 100
  )
  FROM vehicles;
$$ LANGUAGE sql STABLE;

-- Response time percentiles
CREATE OR REPLACE FUNCTION get_response_time_percentiles(
  time_from TIMESTAMPTZ,
  time_to TIMESTAMPTZ
)
RETURNS TABLE (p50 NUMERIC, p95 NUMERIC, avg_time NUMERIC) AS $$
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_minutes) AS p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_minutes) AS p95,
    AVG(response_minutes) AS avg_time
  FROM (
    SELECT EXTRACT(EPOCH FROM (
      (result_data->>'arrived_at')::TIMESTAMPTZ -
      (result_data->>'dispatched_at')::TIMESTAMPTZ
    )) / 60 AS response_minutes
    FROM events
    WHERE event_type = 'dispatch'
      AND created_at BETWEEN time_from AND time_to
  ) sub;
$$ LANGUAGE sql STABLE;
```

---

## UI Components

### KPIDashboard

- **Location**: `src/components/insights/KPIDashboard.tsx`
- **Description**: Grid of KPI cards, each showing a metric value, label, trend indicator (up/down arrow), and optional sparkline.
- **KPI Cards**:
  - Average Response Time (minutes)
  - Fleet Utilization (%)
  - Vehicles In Service (count)
  - Active Alerts (count)
- **Sparkline**: Small inline chart showing the metric over the last 7 days.
- **Library**: Recharts `<Sparklines>` or simple SVG.

### TelemetryChart

- **Location**: `src/components/insights/TelemetryChart.tsx`
- **Description**: Interactive time-series line chart for telemetry data.
- **Props**: `vehicleId`, `metric` (fuel, speed, temperature), `timeRange`
- **Features**: Tooltip on hover, zoom/pan, time range selector.
- **Library**: Recharts `<LineChart>`.

### ResponseTimeChart

- **Location**: `src/components/insights/ResponseTimeChart.tsx`
- **Description**: Bar chart comparing response times across vehicle types or individual vehicles.
- **Variants**: Grouped bar (avg vs P95), stacked bar by zone.
- **Library**: Recharts `<BarChart>`.

### FleetUtilizationGrid

- **Location**: `src/components/insights/FleetUtilizationGrid.tsx`
- **Description**: Grid view showing each vehicle as a cell, color-coded by utilization level.
- **Color Scale**: Green (high utilization) to Red (low/no utilization).
- **Interaction**: Click a cell to navigate to per-vehicle analytics.

### InsightCard

- **Location**: `src/components/insights/InsightCard.tsx`
- **Description**: Card displaying an automated recommendation or insight.
- **Content**: Icon (based on severity), title, description, timestamp, dismiss button.
- **Severity Colors**: Blue (info), Yellow (warning), Red (critical).

### ReportExporter

- **Location**: `src/components/insights/ReportExporter.tsx`
- **Description**: UI for configuring and triggering data exports.
- **Options**: Format (CSV), date range (from/to), data type (telemetry, events, anomalies), vehicle filter.
- **Action**: "Export" button triggers download via API.

---

## Pages / Routes

### `/insights` -- Main Insights Dashboard

- **File**: `src/app/insights/page.tsx`
- **Layout**:
  - Top row: KPIDashboard (4 KPI cards)
  - Middle row: TelemetryChart (default: fleet-wide fuel trend) + ResponseTimeChart
  - Bottom row: Recent InsightCards (latest 5 recommendations)
- **Time Range Selector**: Global filter that applies to all charts and KPIs.

### `/insights/vehicle/[id]` -- Per-Vehicle Analytics

- **File**: `src/app/insights/vehicle/[id]/page.tsx`
- **Layout**:
  - Header: Vehicle name, type, current status
  - Row 1: Vehicle-specific KPIs (usage hours, fuel efficiency, anomaly count)
  - Row 2: TelemetryChart for this vehicle (switchable: fuel, speed, temperature)
  - Row 3: Maintenance history timeline
  - Row 4: Anomaly list for this vehicle

### `/insights/fleet` -- Fleet-Wide Analytics

- **File**: `src/app/insights/fleet/page.tsx`
- **Layout**:
  - FleetUtilizationGrid (heatmap of all vehicles)
  - ResponseTimeChart (grouped by vehicle type)
  - Fleet trend charts (utilization over time, response time trends)

### `/insights/reports` -- Report Generation & Export

- **File**: `src/app/insights/reports/page.tsx`
- **Layout**:
  - ReportExporter component
  - List of previously generated exports (if persisted)
  - Quick export presets (e.g., "Last 7 days telemetry", "Monthly summary")

---

## API Endpoints

### `GET /api/insights/kpis`

Fleet KPIs (aggregated).

- **File**: `src/app/api/insights/kpis/route.ts`
- **Auth**: Authenticated users.
- **Query Params**: `?from=2025-01-01&to=2025-01-31`
- **Response**:
  ```json
  {
    "avg_response_time": 8.5,
    "fleet_utilization": 72.3,
    "vehicles_in_service": 18,
    "active_alerts": 3,
    "trends": {
      "response_time_7d": [-2.1, "improving"],
      "utilization_7d": [+5.0, "increasing"]
    }
  }
  ```

### `GET /api/insights/vehicle/[id]/analytics`

Per-vehicle analytics.

- **File**: `src/app/api/insights/vehicle/[id]/analytics/route.ts`
- **Auth**: Authenticated users.
- **Query Params**: `?from=&to=`
- **Response**:
  ```json
  {
    "vehicle_id": "uuid",
    "usage_hours": 142.5,
    "fuel_efficiency": 12.3,
    "maintenance_events": 2,
    "anomaly_count": 5,
    "telemetry_summary": {
      "avg_speed": 45.2,
      "avg_fuel_level": 68.1,
      "avg_engine_temp": 92.3
    }
  }
  ```

### `GET /api/insights/response-times`

Response time data for analytics.

- **File**: `src/app/api/insights/response-times/route.ts`
- **Auth**: Authenticated users.
- **Query Params**: `?from=&to=&group_by=vehicle_type`
- **Response**:
  ```json
  {
    "overall": { "avg": 8.5, "p50": 7.2, "p95": 15.8 },
    "by_type": {
      "ambulance": { "avg": 7.1, "p50": 6.5, "p95": 12.3 },
      "fire_engine": { "avg": 9.8, "p50": 8.9, "p95": 18.2 },
      "police": { "avg": 6.2, "p50": 5.8, "p95": 10.1 }
    }
  }
  ```

### `GET /api/insights/recommendations`

Generated insights and recommendations.

- **File**: `src/app/api/insights/recommendations/route.ts`
- **Auth**: Authenticated users.
- **Query Params**: `?severity=warning&dismissed=false&limit=10`
- **Response**: Array of insight objects from the `insights` table.

### `GET /api/insights/export`

Export data as CSV.

- **File**: `src/app/api/insights/export/route.ts`
- **Auth**: Authenticated users.
- **Query Params**: `?format=csv&from=&to=&type=telemetry&vehicle_id=`
- **Response**: `Content-Type: text/csv` with streamed CSV data.
- **Implementation**: Query Supabase, transform rows to CSV format, stream response.

---

## Technical Implementation

### Aggregation Queries

All KPIs and analytics are computed using PostgreSQL aggregation functions via Supabase:

- `COUNT`, `AVG`, `MIN`, `MAX` for basic metrics
- `PERCENTILE_CONT` for response time percentiles (P50, P95)
- `DATE_TRUNC` for time-series grouping (hourly, daily, weekly)
- Window functions for trend calculation (compare current period to previous)

### Charting with Recharts

All charts use the [Recharts](https://recharts.org/) library:

```typescript
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
```

- Charts are wrapped in `<ResponsiveContainer>` for responsive sizing.
- Consistent color palette across all charts.
- Tooltips show exact values on hover.
- Time-series charts use proper date formatting on X-axis.

### Recommendation Engine

Simple rule-based engine that runs periodically (or on demand via API):

```typescript
// src/lib/recommendation-engine.ts

interface InsightRule {
  type: string;
  check: (data: AnalyticsData) => InsightResult | null;
}

const rules: InsightRule[] = [
  {
    type: 'maintenance_due',
    check: (data) => {
      // If mileage since last service > 5000 km
      if (data.mileageSinceService > 5000) {
        return {
          title: `${data.vehicleName} due for maintenance`,
          description: `${data.mileageSinceService} km since last service (threshold: 5,000 km)`,
          severity: data.mileageSinceService > 7000 ? 'critical' : 'warning',
        };
      }
      return null;
    },
  },
  {
    type: 'anomaly_spike',
    check: (data) => {
      // If more than 3 anomalies in the past 7 days
      if (data.recentAnomalyCount > 3) {
        return {
          title: `Anomaly spike: ${data.vehicleName}`,
          description: `${data.recentAnomalyCount} anomalies in the past 7 days`,
          severity: 'warning',
        };
      }
      return null;
    },
  },
  {
    type: 'response_time_trend',
    check: (data) => {
      // If response time improved by more than 10%
      if (data.responseTimeDelta < -10) {
        return {
          title: `Response times improving in ${data.zoneName}`,
          description: `Average response time down ${Math.abs(data.responseTimeDelta)}% this week`,
          severity: 'info',
        };
      }
      return null;
    },
  },
];

async function generateInsights(): Promise<Insight[]> {
  const analyticsData = await fetchAnalyticsData();
  const insights: Insight[] = [];

  for (const rule of rules) {
    const result = rule.check(analyticsData);
    if (result) {
      insights.push(result);
    }
  }

  return insights;
}
```

### CSV Export Implementation

```typescript
// src/app/api/insights/export/route.ts

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const type = searchParams.get('type') || 'telemetry';

  // Query data from Supabase
  const { data, error } = await supabase
    .from(type === 'telemetry' ? 'telemetry_readings' : 'events')
    .select('*')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert to CSV
  const headers = Object.keys(data[0] || {}).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  const csv = [headers, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}_export_${from}_${to}.csv"`,
    },
  });
}
```

---

## Error Handling

| Error | HTTP Status | Message |
|---|---|---|
| Invalid date range | 400 | "Invalid date range: 'from' must be before 'to'" |
| No data available | 200 | Returns empty arrays/zero values (not an error) |
| Export too large | 413 | "Export exceeds maximum row limit (50,000). Narrow your date range." |
| Unauthorized | 401 | "Authentication required" |
| Vehicle not found | 404 | "Vehicle {id} not found" |
| Unsupported export format | 400 | "Unsupported format. Currently supported: csv" |

---

## Acceptance Criteria

- [ ] Fleet KPI dashboard displays accurate, up-to-date metrics (response time, utilization, in-service count, alert count)
- [ ] Time-series charts render telemetry history with selectable time ranges
- [ ] Response time analytics are computed and displayed with P50 and P95 values
- [ ] At least 3 types of automated recommendations work (maintenance_due, anomaly_spike, response_time_trend)
- [ ] CSV export of telemetry data works with date range filtering
- [ ] Per-vehicle analytics view shows vehicle-specific metrics and charts
- [ ] Fleet-wide analytics view shows utilization grid and comparative charts
- [ ] Insight cards can be dismissed by the user
- [ ] All charts are responsive and render correctly on different screen sizes

---

## Dependencies

- **Feature 2 (Telemetry)** -- provides the raw telemetry data that powers all charts and analytics
- **Feature 3 (Anomaly Detection)** -- provides alert/anomaly data for the anomaly_spike recommendation and active alerts KPI
- **Feature 6 (Fleet Management)** -- provides vehicle metadata (type, name, status) for per-vehicle and fleet-wide views
- **Feature 8 (Auth)** -- access control; all endpoints require authentication

---

## File Structure

```
src/
  app/
    insights/
      page.tsx                              # Main insights dashboard
      vehicle/
        [id]/
          page.tsx                           # Per-vehicle analytics
      fleet/
        page.tsx                             # Fleet-wide analytics
      reports/
        page.tsx                             # Report generation & export
    api/
      insights/
        kpis/
          route.ts                           # GET - fleet KPIs
        vehicle/
          [id]/
            analytics/
              route.ts                       # GET - per-vehicle analytics
        response-times/
          route.ts                           # GET - response time data
        recommendations/
          route.ts                           # GET - generated insights
        export/
          route.ts                           # GET - CSV export
  components/
    insights/
      KPIDashboard.tsx
      TelemetryChart.tsx
      ResponseTimeChart.tsx
      FleetUtilizationGrid.tsx
      InsightCard.tsx
      ReportExporter.tsx
  lib/
    recommendation-engine.ts                # Rule-based insight generation
```
