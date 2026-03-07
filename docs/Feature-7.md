# Feature 7: Real-time Map & Geolocation

## Overview

Interactive map showing vehicle positions updated in real-time. Route visualization, geofencing zones, proximity alerts, and coverage area analysis. Uses Leaflet with OpenStreetMap tiles (free, no API key needed for POC).

## Assigned To: Agent 7 (Senior GIS/Frontend Engineer)

---

## User Stories

- As a dispatcher, I want to see all vehicles on a map in real-time
- As a dispatcher, I want to see which vehicles are closest to an incident
- As a fleet manager, I want to visualize coverage areas
- As an operator, I want to see my vehicle's route history

---

## Key Capabilities

- Real-time vehicle position markers on map (updated via Supabase Realtime)
- Vehicle markers with type-specific icons and status-colored borders
- Click on vehicle marker to see quick info popup
- Route history visualization (polyline of past positions)
- Geofencing: define zones on map (city districts, high-risk areas)
- Proximity calculation: "find nearest available vehicle to point X"
- Coverage heatmap: visualize which areas are well-covered
- Incident markers: place an incident on map and see nearby vehicles

---

## Supabase Tables

### Shared Tables (defined in other features)

- **`vehicles`** (Feature 6) — uses `current_latitude` and `current_longitude` for live position
- **`telemetry_readings`** (Feature 2) — uses `latitude` and `longitude` for route history

### `geofences`

| Column       | Type         | Constraints / Notes                                          |
| ------------ | ------------ | ------------------------------------------------------------ |
| id           | uuid         | PK                                                           |
| name         | text         |                                                              |
| description  | text         |                                                              |
| zone_type    | text         | `'district'`, `'high_risk'`, `'restricted'`, `'coverage'`   |
| coordinates  | jsonb        | GeoJSON polygon (see structure below)                        |
| color        | text         | Hex color for map display (e.g., `#FF5733`)                  |
| is_active    | boolean      |                                                              |
| created_at   | timestamptz  |                                                              |

#### `coordinates` GeoJSON Structure

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [-73.935242, 40.730610],
      [-73.925242, 40.730610],
      [-73.925242, 40.740610],
      [-73.935242, 40.740610],
      [-73.935242, 40.730610]
    ]
  ]
}
```

### `incidents`

| Column               | Type         | Constraints / Notes                                                        |
| -------------------- | ------------ | -------------------------------------------------------------------------- |
| id                   | uuid         | PK                                                                         |
| title                | text         |                                                                            |
| description          | text         |                                                                            |
| incident_type        | text         | `'fire'`, `'medical'`, `'crime'`, `'accident'`, `'natural_disaster'`       |
| severity             | text         | `'low'`, `'medium'`, `'high'`, `'critical'`                                |
| latitude             | numeric      |                                                                            |
| longitude            | numeric      |                                                                            |
| status               | text         | `'reported'`, `'dispatched'`, `'in_progress'`, `'resolved'`               |
| assigned_vehicle_ids | uuid[]       | nullable                                                                   |
| reported_at          | timestamptz  |                                                                            |
| resolved_at          | timestamptz  | nullable                                                                   |

---

## UI Components

### FleetMap
Main Leaflet map component. Full-screen interactive map with OpenStreetMap tiles. Renders all vehicle markers, geofence overlays, and incident markers. Manages map state (center, zoom, active layers).

### VehicleMarker
Custom marker with vehicle type icon. Border color reflects vehicle status:
- **Available** — green border
- **In Service** — blue border
- **En Route** — yellow border
- **At Scene** — orange border
- **Maintenance** — purple border
- **Offline** — gray border

### VehiclePopup
Info popup displayed on marker click. Shows vehicle name, type, status, plate number, current speed (if available from telemetry), and a link to the full vehicle detail page.

### RoutePolyline
Historical route visualization rendered as a polyline on the map. Fetches position data from `telemetry_readings` for a given time range and draws the path with directional arrows.

### GeofenceLayer
Overlay for geofence zones. Renders GeoJSON polygons on the map with the configured color and opacity. Supports toggling individual zones on/off.

### IncidentMarker
Incident location marker with severity-based styling:
- **Low** — blue marker
- **Medium** — yellow marker
- **High** — orange marker
- **Critical** — red pulsing marker

### ProximityCircle
Radius circle drawn from a selected point on the map. Configurable radius in kilometers. Highlights all vehicles within the circle.

### MapControls
Control panel for map interactions:
- Zoom in / zoom out
- Layer toggles (vehicles, geofences, incidents, heatmap)
- Vehicle type filter (show/hide by type)
- Status filter (show/hide by status)

### NearestVehicleFinder
Input a location (click on map or enter coordinates), select optional vehicle type filter, and find the closest available vehicles. Displays results as a ranked list with distance and estimated travel time.

---

## Pages / Routes

| Route                       | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `/map`                      | Full-screen fleet map                             |
| `/map?vehicle=[id]`        | Map centered on a specific vehicle                |
| `/map?incident=[id]`       | Map centered on an incident with nearby vehicles  |

---

## API Endpoints

| Method | Endpoint                                          | Description                              |
| ------ | ------------------------------------------------- | ---------------------------------------- |
| GET    | `/api/map/vehicles`                               | All vehicles with current positions      |
| GET    | `/api/map/vehicles/[id]/route?from=&to=`         | Route history for a vehicle in time range|
| GET    | `/api/map/nearest?lat=&lng=&type=&limit=`        | Find nearest available vehicles          |
| GET    | `/api/geofences`                                  | List all geofences                       |
| POST   | `/api/geofences`                                  | Create a new geofence                    |
| GET    | `/api/incidents`                                  | List active incidents                    |
| POST   | `/api/incidents`                                  | Create a new incident                    |

---

## Technical Implementation

### Map Library Setup
- Use `react-leaflet` for map integration in Next.js
- Dynamic import with `next/dynamic` and `ssr: false` (Leaflet requires `window` and cannot be server-side rendered)
- OpenStreetMap tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (free, no API key)

### Real-time Position Updates
- Subscribe to Supabase Realtime on the `vehicles` table
- Listen for UPDATE events on `current_latitude` and `current_longitude` columns
- Animate marker movement smoothly between old and new positions

```typescript
// Example Supabase Realtime subscription
const channel = supabase
  .channel('vehicle-positions')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'vehicles',
      filter: 'current_latitude=neq.null'
    },
    (payload) => {
      updateVehiclePosition(payload.new.id, {
        lat: payload.new.current_latitude,
        lng: payload.new.current_longitude
      });
    }
  )
  .subscribe();
```

### Distance Calculation (Haversine Formula)
Used for proximity searches and nearest-vehicle calculations.

```typescript
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
```

### GeoJSON for Geofence Polygons
Geofence coordinates are stored as GeoJSON in the `coordinates` JSONB column. Leaflet's `GeoJSON` layer renders them directly.

---

## Acceptance Criteria

- [ ] Map displays all vehicles with correct positions
- [ ] Vehicle positions update in real-time
- [ ] Can click on vehicle marker to see info
- [ ] Route history displays as polyline
- [ ] Can find nearest vehicles to a point
- [ ] Geofence zones can be displayed on map
- [ ] Incidents can be placed on map

---

## Dependencies

- **Feature 6 (Fleet)** for vehicle data
- **Feature 2 (Telemetry)** for position data
- **Feature 8 (Auth)** for access control
