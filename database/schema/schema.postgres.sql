-- ============================================================
-- APSRTC SmartTrack Database Schema (PostgreSQL Version)
-- Andhra Pradesh State Road Transport Corporation
-- Production Fleet Tracking & Journey Matching Schema
-- ============================================================

-- Create Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('PASSENGER', 'CREW', 'OFFICER', 'ADMIN');
    CREATE TYPE staff_designation AS ENUM ('DRIVER', 'CONDUCTOR', 'DEPOT_MANAGER', 'INSPECTOR');
    CREATE TYPE staff_status AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED');
    CREATE TYPE bus_service_type AS ENUM ('PALLE_VELUGU', 'EXPRESS', 'ULTRA_DELUXE', 'SUPER_LUXURY', 'INDRA_AC', 'GARUDA_PLUS');
    CREATE TYPE bus_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
    CREATE TYPE trip_status AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');
    CREATE TYPE location_source AS ENUM ('HARDWARE_TRACKER', 'CREW_PHONE', 'ETM', 'DEMO');
    CREATE TYPE freshness_status AS ENUM ('LIVE', 'RECENT', 'STALE', 'UNAVAILABLE');
    CREATE TYPE gps_confidence AS ENUM ('HIGH', 'GOOD', 'WEAK', 'UNKNOWN');
    CREATE TYPE complaint_category AS ENUM (
        'Bus did not stop', 'Overcrowding', 'Delay', 'Driver behaviour',
        'Conductor issue', 'Safety', 'Cleanliness', 'Other'
    );
    CREATE TYPE complaint_status AS ENUM ('NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED');
    CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'PASSENGER',
    full_name VARCHAR(128) NOT NULL,
    email VARCHAR(128),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(32) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    designation staff_designation NOT NULL,
    depot VARCHAR(64) NOT NULL,
    phone VARCHAR(20),
    status staff_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Buses Table
CREATE TABLE IF NOT EXISTS buses (
    id SERIAL PRIMARY KEY,
    bus_number VARCHAR(32) UNIQUE NOT NULL,
    registration_number VARCHAR(32) UNIQUE NOT NULL,
    depot VARCHAR(64) NOT NULL,
    service_type bus_service_type NOT NULL,
    total_seats INTEGER DEFAULT 45,
    status bus_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Routes Table
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    route_code VARCHAR(32) UNIQUE NOT NULL,
    route_name VARCHAR(128) NOT NULL,
    origin VARCHAR(64) NOT NULL,
    destination VARCHAR(64) NOT NULL,
    distance_km NUMERIC(6, 2) NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Route Stops Table
CREATE TABLE IF NOT EXISTS route_stops (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_name VARCHAR(64) NOT NULL,
    stop_code VARCHAR(32),
    stop_order INTEGER NOT NULL,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    distance_from_origin_km NUMERIC(6, 2) DEFAULT 0,
    average_time_mins INTEGER DEFAULT 0
);

-- 6. Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(64) UNIQUE NOT NULL,
    bus_id INTEGER NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    driver_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    conductor_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    from_stop VARCHAR(64) NOT NULL,
    to_stop VARCHAR(64) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    status trip_status DEFAULT 'RUNNING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. GPS Devices Table
CREATE TABLE IF NOT EXISTS gps_devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) UNIQUE NOT NULL,
    bus_id INTEGER REFERENCES buses(id) ON DELETE SET NULL,
    imei VARCHAR(32),
    firmware_version VARCHAR(32) DEFAULT 'v2.4.1',
    status VARCHAR(32) DEFAULT 'ACTIVE',
    last_heartbeat TIMESTAMP WITH TIME ZONE
);

-- 8. Crew Devices Table
CREATE TABLE IF NOT EXISTS crew_devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) UNIQUE NOT NULL,
    staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    bus_id INTEGER REFERENCES buses(id) ON DELETE SET NULL,
    trip_id VARCHAR(64),
    app_version VARCHAR(32) DEFAULT '1.0.0-pwa',
    status VARCHAR(32) DEFAULT 'ONLINE',
    last_heartbeat TIMESTAMP WITH TIME ZONE
);

-- 9. ETM Devices Table
CREATE TABLE IF NOT EXISTS etm_devices (
    id SERIAL PRIMARY KEY,
    etm_id VARCHAR(64) UNIQUE NOT NULL,
    bus_id INTEGER REFERENCES buses(id) ON DELETE SET NULL,
    trip_id VARCHAR(64),
    depot VARCHAR(64),
    status VARCHAR(32) DEFAULT 'ONLINE',
    last_heartbeat TIMESTAMP WITH TIME ZONE
);

-- 10. Location Updates (Time-Series Table)
CREATE TABLE IF NOT EXISTS location_updates (
    id BIGSERIAL PRIMARY KEY,
    bus_id INTEGER NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    bus_number VARCHAR(32) NOT NULL,
    source location_source NOT NULL,
    device_id VARCHAR(64),
    trip_id VARCHAR(64),
    route_id INTEGER,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    accuracy_meters NUMERIC(6, 2) DEFAULT 10.0,
    speed_kph NUMERIC(5, 2) DEFAULT 0.0,
    heading NUMERIC(5, 2) DEFAULT 0.0,
    altitude NUMERIC(7, 2) DEFAULT 0.0,
    location_name VARCHAR(128),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    raw_payload JSONB
);

-- 11. Current Bus Locations Table
CREATE TABLE IF NOT EXISTS current_bus_locations (
    id SERIAL PRIMARY KEY,
    bus_id INTEGER UNIQUE NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    bus_number VARCHAR(32) NOT NULL,
    active_source location_source DEFAULT 'DEMO',
    device_id VARCHAR(64),
    trip_id VARCHAR(64),
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    accuracy_meters NUMERIC(6, 2) DEFAULT 15.0,
    speed_kph NUMERIC(5, 2) DEFAULT 0.0,
    heading NUMERIC(5, 2) DEFAULT 0.0,
    altitude NUMERIC(7, 2) DEFAULT 0.0,
    location_name VARCHAR(128) NOT NULL,
    from_stop VARCHAR(64),
    to_stop VARCHAR(64),
    status freshness_status DEFAULT 'LIVE',
    confidence gps_confidence DEFAULT 'GOOD',
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_hardware_update_at TIMESTAMP WITH TIME ZONE,
    last_crew_update_at TIMESTAMP WITH TIME ZONE,
    last_etm_update_at TIMESTAMP WITH TIME ZONE,
    last_demo_update_at TIMESTAMP WITH TIME ZONE
);

-- 12. Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    complaint_ref VARCHAR(64) UNIQUE NOT NULL,
    bus_number VARCHAR(32) NOT NULL,
    trip_id VARCHAR(64),
    category complaint_category NOT NULL,
    description TEXT NOT NULL,
    passenger_name VARCHAR(128),
    passenger_phone VARCHAR(20),
    location VARCHAR(128),
    status complaint_status DEFAULT 'NEW',
    officer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Complaint Status History
CREATE TABLE IF NOT EXISTS complaint_status_history (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    old_status VARCHAR(32),
    new_status VARCHAR(32) NOT NULL,
    changed_by VARCHAR(64) DEFAULT 'Officer',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Operational Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(64) NOT NULL,
    bus_id INTEGER,
    bus_number VARCHAR(32) NOT NULL,
    trip_id VARCHAR(64),
    severity alert_severity DEFAULT 'MEDIUM',
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    actor_role VARCHAR(32),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Production Indexes
CREATE INDEX IF NOT EXISTS idx_pg_buses_number ON buses(bus_number);
CREATE INDEX IF NOT EXISTS idx_pg_route_stops ON route_stops(route_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_pg_trips_bus_status ON trips(bus_id, status);
CREATE INDEX IF NOT EXISTS idx_pg_curr_bus_loc ON current_bus_locations(bus_id);
CREATE INDEX IF NOT EXISTS idx_pg_loc_updates_ts ON location_updates(bus_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pg_complaints_status ON complaints(status);
