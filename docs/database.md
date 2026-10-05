# APSRTC SmartTrack - Database Architecture & Data Dictionary

## 1. Overview
The database layer is designed to separate high-frequency live telemetry writes from heavy passenger journey queries. The system provides zero-setup local deployment using SQLite in WAL mode (`backend/apsrtc.db`) and complete enterprise scripts for PostgreSQL (`database/schema/schema.postgres.sql`).

---

## 2. Entity-Relationship Overview

```
 [buses] 1 ----- * [trips] * ----- 1 [routes] 1 ----- * [route_stops]
    |                 |
    |                 |
    +--- 1:1 --- [current_bus_locations] (High-Speed Cached State)
    |
    +--- 1:* --- [location_updates] (Immutable Time-Series Log)
    |
    +--- 1:* --- [complaints] 1 ----- * [complaint_status_history]
    |
    +--- 1:* --- [alerts]
    |
    +--- 1:* --- [gps_devices]
    +--- 1:* --- [crew_devices]
    +--- 1:* --- [etm_devices]
```

---

## 3. Data Dictionary

### Table: `buses`
Primary physical vehicle registry.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Unique asset ID |
| `bus_number` | TEXT | UNIQUE, NOT NULL | Passenger-facing service number (e.g. 415) |
| `registration_number` | TEXT | UNIQUE, NOT NULL | RTA Registration (e.g. AP-39-Z-0415) |
| `depot` | TEXT | NOT NULL | Home RTC Depot (e.g. Paderu, Araku) |
| `service_type` | TEXT | NOT NULL | Palle Velugu, Express, Ultra Deluxe, etc. |
| `total_seats` | INTEGER | DEFAULT 45 | Passenger seating capacity |
| `status` | TEXT | DEFAULT 'ACTIVE' | ACTIVE, MAINTENANCE, INACTIVE |

### Table: `current_bus_locations`
Optimized single-row active location record per bus.
| Column | Type | Description |
|---|---|---|
| `bus_id` | INTEGER | Foreign Key to `buses(id)`, UNIQUE |
| `bus_number` | TEXT | Denormalized bus service number |
| `active_source` | TEXT | Resolved source (`HARDWARE_TRACKER`, `CREW_PHONE`, `ETM`, `DEMO`) |
| `device_id` | TEXT | Active device identifier |
| `trip_id` | TEXT | Current running trip |
| `latitude` | REAL | Current WGS84 Latitude |
| `longitude` | REAL | Current WGS84 Longitude |
| `accuracy_meters` | REAL | Horizontal dilution of precision (meters) |
| `speed_kph` | REAL | Speed over ground |
| `heading` | REAL | Azimuth bearing (0-360 deg) |
| `location_name` | TEXT | Spatial corridor geocoded name |
| `status` | TEXT | `LIVE`, `RECENT`, `STALE`, `UNAVAILABLE` |
| `confidence` | TEXT | `HIGH`, `GOOD`, `WEAK`, `UNKNOWN` |
| `last_updated_at` | DATETIME | Timestamp of active update |
| `last_hardware_update_at` | DATETIME | Timestamp of last hardware ping |
| `last_crew_update_at` | DATETIME | Timestamp of last crew mobile ping |
| `last_etm_update_at` | DATETIME | Timestamp of last ETM ping |
| `last_demo_update_at` | DATETIME | Timestamp of last simulator ping |

### Table: `location_updates`
Immutable append-only time-series telemetry table.
Used for audit logging, operational diagnostics, and driver route compliance analysis.

### Table: `complaints`
Passenger grievance repository.
| Column | Type | Description |
|---|---|---|
| `complaint_ref` | TEXT | Unique ID e.g. `APSRTC-G-2026-1049` |
| `bus_number` | TEXT | Targeted bus service |
| `category` | TEXT | Categorized grievance reason |
| `status` | TEXT | `NEW`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`, `CLOSED` |

---

## 4. High-Performance Indexing Strategy
To support thousands of queries per second:
- `idx_buses_number`: B-tree index on `buses(bus_number)`
- `idx_route_stops_route_order`: Composite index on `route_stops(route_id, stop_order)`
- `idx_trips_bus_status`: Partial/composite index on `trips(bus_id, status)`
- `idx_curr_bus_loc_bus_id`: Fast lookup on `current_bus_locations(bus_id)`
- `idx_loc_updates_bus_ts`: Time-series sorting index on `location_updates(bus_id, timestamp DESC)`
