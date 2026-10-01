CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'PASSENGER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buses (
  id BIGSERIAL PRIMARY KEY,
  bus_number VARCHAR(50) UNIQUE NOT NULL,
  registration_number VARCHAR(50),
  bus_type VARCHAR(80),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id BIGSERIAL PRIMARY KEY,
  route_name VARCHAR(200) NOT NULL,
  origin VARCHAR(150),
  destination VARCHAR(150),
  geometry GEOMETRY(LineString, 4326)
);

CREATE TABLE IF NOT EXISTS stops (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT REFERENCES buses(id),
  route_id BIGINT REFERENCES routes(id),
  driver_user_id BIGINT REFERENCES users(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS bus_locations (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT REFERENCES buses(id),
  trip_id BIGINT REFERENCES trips(id),
  location GEOMETRY(Point, 4326) NOT NULL,
  speed_kph NUMERIC(8,2),
  heading NUMERIC(8,2),
  accuracy_m NUMERIC(8,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bus_locations_bus_time
ON bus_locations(bus_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_bus_locations_geo
ON bus_locations USING GIST(location);

CREATE TABLE IF NOT EXISTS complaints (
  id BIGSERIAL PRIMARY KEY,
  reference_code VARCHAR(60) UNIQUE NOT NULL,
  passenger_id BIGINT REFERENCES users(id),
  bus_id BIGINT REFERENCES buses(id),
  trip_id BIGINT REFERENCES trips(id),
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
