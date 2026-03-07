# Feature 6: Vehicle Fleet Management

## Overview

CRUD operations for managing a fleet of emergency vehicles. Vehicle profiles with type, specifications, maintenance schedules, assignment history, and status tracking. Supports 5 vehicle types: Police Vehicle, Ambulance, Fire Truck, Civil Protection Unit, Hybrid/Specialized Vehicle.

## Assigned To: Agent 6 (Senior Full-Stack Engineer)

---

## User Stories

- As an admin, I want to add/edit/remove vehicles from the fleet
- As a fleet manager, I want to see all vehicles and their current status
- As a dispatcher, I want to filter vehicles by type and availability
- As a manager, I want to track maintenance schedules

---

## Key Capabilities

- Full CRUD for vehicles
- Vehicle types with type-specific attributes:
  - **Police**: patrol_zone, radio_channel, weapons_secured
  - **Ambulance**: medical_level (BLS/ALS), patient_capacity, medical_equipment_list
  - **Fire Truck**: water_tank_capacity, ladder_length, pump_capacity
  - **Civil Protection**: specialization, rescue_equipment
  - **Hybrid**: primary_function, secondary_function, special_capabilities
- Vehicle status management (available, in-service, en-route, at-scene, maintenance, offline)
- Maintenance scheduling and tracking
- Assignment history log
- Fleet overview with filtering and sorting
- Bulk status updates

---

## Supabase Tables

### `vehicles`

| Column              | Type         | Constraints / Notes                                                                 |
| ------------------- | ------------ | ----------------------------------------------------------------------------------- |
| id                  | uuid         | PK                                                                                  |
| type                | text         | `'police'`, `'ambulance'`, `'fire_truck'`, `'civil_protection'`, `'hybrid'`         |
| name                | text         |                                                                                     |
| plate_number        | text         | unique                                                                              |
| status              | text         | `'available'`, `'in_service'`, `'en_route'`, `'at_scene'`, `'maintenance'`, `'offline'` |
| year                | integer      |                                                                                     |
| make                | text         |                                                                                     |
| model               | text         |                                                                                     |
| specifications      | jsonb        | Type-specific attributes (see below)                                                |
| current_latitude    | numeric      | nullable                                                                            |
| current_longitude   | numeric      | nullable                                                                            |
| risk_score          | integer      | default 0                                                                           |
| created_at          | timestamptz  |                                                                                     |
| updated_at          | timestamptz  |                                                                                     |

#### `specifications` JSONB Structure by Vehicle Type

**Police:**
```json
{
  "patrol_zone": "Zone A",
  "radio_channel": "CH-14",
  "weapons_secured": true
}
```

**Ambulance:**
```json
{
  "medical_level": "ALS",
  "patient_capacity": 2,
  "medical_equipment_list": ["defibrillator", "stretcher", "oxygen_tank"]
}
```

**Fire Truck:**
```json
{
  "water_tank_capacity": 3000,
  "ladder_length": 30,
  "pump_capacity": 1500
}
```

**Civil Protection:**
```json
{
  "specialization": "flood_rescue",
  "rescue_equipment": ["inflatable_boat", "ropes", "thermal_blankets"]
}
```

**Hybrid:**
```json
{
  "primary_function": "medical",
  "secondary_function": "hazmat",
  "special_capabilities": ["chemical_detection", "decontamination"]
}
```

### `maintenance_records`

| Column            | Type         | Constraints / Notes                              |
| ----------------- | ------------ | ------------------------------------------------ |
| id                | uuid         | PK                                               |
| vehicle_id        | uuid         | FK -> vehicles                                   |
| maintenance_type  | text         | `'scheduled'`, `'emergency'`, `'inspection'`     |
| description       | text         |                                                  |
| status            | text         | `'scheduled'`, `'in_progress'`, `'completed'`    |
| scheduled_date    | date         |                                                  |
| completed_date    | date         | nullable                                         |
| cost              | numeric      | nullable                                         |
| notes             | text         | nullable                                         |
| created_at        | timestamptz  |                                                  |

### `vehicle_equipment`

| Column          | Type         | Constraints / Notes                                         |
| --------------- | ------------ | ----------------------------------------------------------- |
| id              | uuid         | PK                                                          |
| vehicle_id      | uuid         | FK -> vehicles                                              |
| equipment_name  | text         |                                                             |
| category        | text         |                                                             |
| status          | text         | `'operational'`, `'needs_repair'`, `'replaced'`, `'missing'`|
| last_checked    | timestamptz  |                                                             |

---

## UI Components

### FleetTable
Sortable, filterable table of all vehicles. Columns include name, plate number, type, status, make/model/year, and last updated. Supports column sorting and pagination.

### VehicleForm
Add/edit vehicle form with type-specific fields. When the user selects a vehicle type, the form dynamically renders the appropriate specification fields for that type.

### VehicleCard
Summary card for grid view display. Shows vehicle name, type icon, status badge, plate number, and key specs at a glance.

### MaintenanceScheduler
Schedule and track maintenance events. Calendar view of upcoming maintenance with the ability to create new scheduled, emergency, or inspection records.

### StatusBadge
Colored badge indicating vehicle status:
- **Available** — green
- **In Service** — blue
- **En Route** — yellow
- **At Scene** — orange
- **Maintenance** — purple
- **Offline** — gray

### VehicleTypeIcon
Icon per vehicle type:
- Police Vehicle — shield / police car icon
- Ambulance — medical cross / ambulance icon
- Fire Truck — flame / fire truck icon
- Civil Protection — hard hat / rescue icon
- Hybrid — dual-purpose / gear icon

### FleetFilters
Filter bar with controls for type, status, and availability. Supports multi-select for type and status, and a toggle for "available only."

---

## Pages / Routes

| Route                        | Description                          |
| ---------------------------- | ------------------------------------ |
| `/fleet`                     | Fleet overview (table + grid toggle) |
| `/fleet/new`                 | Add new vehicle                      |
| `/fleet/[id]`               | Vehicle detail / edit                |
| `/fleet/[id]/maintenance`   | Maintenance history and scheduling   |

---

## API Endpoints

| Method   | Endpoint                            | Description                |
| -------- | ----------------------------------- | -------------------------- |
| GET      | `/api/vehicles`                     | List all vehicles (with filters: type, status, search) |
| POST     | `/api/vehicles`                     | Create a new vehicle       |
| GET      | `/api/vehicles/[id]`               | Get vehicle detail         |
| PUT      | `/api/vehicles/[id]`               | Update vehicle             |
| DELETE   | `/api/vehicles/[id]`               | Delete vehicle             |
| PATCH    | `/api/vehicles/[id]/status`        | Update vehicle status only |
| GET      | `/api/vehicles/[id]/maintenance`   | List maintenance records   |
| POST     | `/api/vehicles/[id]/maintenance`   | Schedule new maintenance   |

---

## Acceptance Criteria

- [ ] Can add, edit, delete vehicles
- [ ] Vehicle type-specific fields work correctly
- [ ] Fleet table with filtering and sorting
- [ ] Status updates reflect in real-time across the app
- [ ] Maintenance records can be created and tracked
- [ ] All 5 vehicle types supported

---

## Dependencies

- **Feature 8 (Auth)** for admin-only write operations
