-- ============================================================
-- APSRTC SmartTrack Database Schema (SQLite Version)
-- Andhra Pradesh State Road Transport Corporation
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('PASSENGER', 'CREW', 'OFFICER', 'ADMIN')) NOT NULL DEFAULT 'PASSENGER',
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Staff Table (Drivers, Conductors, Depot Managers)
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    designation TEXT CHECK(designation IN ('DRIVER', 'CONDUCTOR', 'DEPOT_MANAGER', 'INSPECTOR')) NOT NULL,
    depot TEXT NOT NULL,
    phone TEXT,
    status TEXT CHECK(status IN ('ACTIVE', 'ON_LEAVE', 'SUSPENDED')) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Buses Table
CREATE TABLE IF NOT EXISTS buses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_number TEXT UNIQUE NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    depot TEXT NOT NULL,
    service_type TEXT CHECK(service_type IN ('PALLE_VELUGU', 'EXPRESS', 'ULTRA_DELUXE', 'SUPER_LUXURY', 'INDRA_AC', 'GARUDA_PLUS')) NOT NULL,
    total_seats INTEGER DEFAULT 45,
    status TEXT CHECK(status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Routes Table
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_code TEXT UNIQUE NOT NULL,
    route_name TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    distance_km REAL NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Route Stops Table (Ordered sequence of stops along each corridor)
CREATE TABLE IF NOT EXISTS route_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    stop_name TEXT NOT NULL,
    stop_code TEXT,
    stop_order INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    distance_from_origin_km REAL DEFAULT 0,
    average_time_mins INTEGER DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- 6. Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id TEXT UNIQUE NOT NULL,
    bus_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    driver_staff_id INTEGER,
    conductor_staff_id INTEGER,
    from_stop TEXT NOT NULL,
    to_stop TEXT NOT NULL,
    tracking_source TEXT CHECK(tracking_source IN ('HARDWARE_TRACKER', 'CREW_PHONE', 'ETM', 'DEMO')) DEFAULT 'CREW_PHONE',
    device_id TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status TEXT CHECK(status IN ('SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED')) DEFAULT 'RUNNING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (conductor_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- 7. GPS Devices Table (Installed Hardware Trackers)
CREATE TABLE IF NOT EXISTS gps_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    bus_id INTEGER,
    imei TEXT,
    firmware_version TEXT DEFAULT 'v2.4.1',
    status TEXT CHECK(status IN ('ACTIVE', 'INACTIVE', 'OFFLINE')) DEFAULT 'ACTIVE',
    last_heartbeat DATETIME,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL
);

-- 8. Crew Devices Table (Driver/Conductor Mobile Phones)
CREATE TABLE IF NOT EXISTS crew_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    staff_id INTEGER,
    bus_id INTEGER,
    trip_id TEXT,
    app_version TEXT DEFAULT '1.0.0-pwa',
    status TEXT CHECK(status IN ('ONLINE', 'OFFLINE', 'BACKGROUND')) DEFAULT 'ONLINE',
    last_heartbeat DATETIME,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL
);

-- 9. ETM Devices Table (Electronic Ticketing Machines)
CREATE TABLE IF NOT EXISTS etm_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etm_id TEXT UNIQUE NOT NULL,
    bus_id INTEGER,
    trip_id TEXT,
    depot TEXT,
    status TEXT CHECK(status IN ('ONLINE', 'OFFLINE')) DEFAULT 'ONLINE',
    last_heartbeat DATETIME,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL
);

-- 10. Location Updates (Immutable Time-Series Log of all raw GPS pings)
CREATE TABLE IF NOT EXISTS location_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_id INTEGER NOT NULL,
    bus_number TEXT NOT NULL,
    source TEXT CHECK(source IN ('HARDWARE_TRACKER', 'CREW_PHONE', 'ETM', 'DEMO')) NOT NULL,
    device_id TEXT,
    trip_id TEXT,
    route_id INTEGER,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy_meters REAL DEFAULT 10.0,
    speed_kph REAL DEFAULT 0.0,
    heading REAL DEFAULT 0.0,
    altitude REAL DEFAULT 0.0,
    location_name TEXT,
    timestamp DATETIME NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_payload TEXT,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
);

-- 11. Current Bus Locations (High-Frequency Read/Update Table for Current Active State)
CREATE TABLE IF NOT EXISTS current_bus_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_id INTEGER UNIQUE NOT NULL,
    bus_number TEXT NOT NULL,
    active_source TEXT CHECK(active_source IN ('HARDWARE_TRACKER', 'CREW_PHONE', 'ETM', 'DEMO')) DEFAULT 'DEMO',
    device_id TEXT,
    trip_id TEXT,
    route_id INTEGER,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy_meters REAL DEFAULT 15.0,
    speed_kph REAL DEFAULT 0.0,
    heading REAL DEFAULT 0.0,
    altitude REAL DEFAULT 0.0,
    location_name TEXT NOT NULL,
    from_stop TEXT,
    to_stop TEXT,
    status TEXT CHECK(status IN ('LIVE', 'RECENT', 'STALE', 'UNAVAILABLE')) DEFAULT 'LIVE',
    confidence TEXT CHECK(confidence IN ('HIGH', 'GOOD', 'WEAK', 'UNKNOWN')) DEFAULT 'GOOD',
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_hardware_update_at DATETIME,
    last_crew_update_at DATETIME,
    last_etm_update_at DATETIME,
    last_demo_update_at DATETIME,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);

-- 12. Complaints Table (Supports Staff Conduct, Bus Condition, and Service Issues)
CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_ref TEXT UNIQUE NOT NULL,
    bus_number TEXT NOT NULL,
    trip_id TEXT,
    target_type TEXT CHECK(target_type IN ('STAFF', 'BUS_CONDITION', 'SERVICE', 'GENERAL')) DEFAULT 'GENERAL',
    category TEXT NOT NULL,
    sub_category TEXT,
    description TEXT NOT NULL,
    passenger_name TEXT,
    passenger_phone TEXT,
    location TEXT,
    photo_url TEXT,
    status TEXT CHECK(status IN ('NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED')) DEFAULT 'NEW',
    officer_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Complaint Status History
CREATE TABLE IF NOT EXISTS complaint_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT DEFAULT 'Officer',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

-- 14. Operational Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT CHECK(alert_type IN ('SOS', 'OVERSPEEDING', 'ROUTE_DEVIATION', 'TRACKER_OFFLINE', 'STALE_GPS')) NOT NULL,
    bus_id INTEGER,
    bus_number TEXT NOT NULL,
    trip_id TEXT,
    severity TEXT CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
    message TEXT NOT NULL,
    is_resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    actor_role TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES FOR HIGH-TRAFFIC REAL-TIME PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_buses_number ON buses(bus_number);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_order ON route_stops(route_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_trips_bus_status ON trips(bus_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_trip_id ON trips(trip_id);
CREATE INDEX IF NOT EXISTS idx_curr_bus_loc_bus_id ON current_bus_locations(bus_id);
CREATE INDEX IF NOT EXISTS idx_curr_bus_loc_route_id ON current_bus_locations(route_id);
CREATE INDEX IF NOT EXISTS idx_loc_updates_bus_ts ON location_updates(bus_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_bus_num ON complaints(bus_number);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_alerts_bus_resolved ON alerts(bus_id, is_resolved);
