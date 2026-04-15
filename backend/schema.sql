-- =============================================================
-- EMS Coordination System — PostgreSQL Schema
-- Run: psql -d ems -f schema.sql
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----- Users -----
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('ambulance', 'police', 'admin')),
  -- Ambulance-specific
  vehicle_id    VARCHAR(50),
  vehicle_type  VARCHAR(50),
  license_plate VARCHAR(20),
  -- Police-specific
  badge_number  VARCHAR(50),
  station       VARCHAR(100),
  jurisdiction  VARCHAR(100),
  -- Shared profile
  phone         VARCHAR(20),
  profile_photo_url TEXT,
  bio           TEXT,
  years_experience INTEGER,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ----- Hospitals -----
CREATE TABLE IF NOT EXISTS hospitals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(150) NOT NULL,
  lat              DECIMAL(10,7) NOT NULL,
  lng              DECIMAL(10,7) NOT NULL,
  address          TEXT,
  phone            VARCHAR(20),
  specializations  TEXT[],
  bed_count        INTEGER,
  trauma_level     INTEGER CHECK (trauma_level BETWEEN 1 AND 5),
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ----- Rides -----
CREATE TABLE IF NOT EXISTS rides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_id UUID REFERENCES users(id) NOT NULL,
  hospital_id  UUID REFERENCES hospitals(id) NOT NULL,
  severity     VARCHAR(20) CHECK (severity IN ('critical', 'serious', 'stable')),
  case_type    VARCHAR(30) CHECK (case_type IN ('cardiac', 'trauma', 'stroke', 'respiratory', 'other')),
  status       VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  start_time   TIMESTAMPTZ DEFAULT NOW(),
  end_time     TIMESTAMPTZ,
  duration_minutes DECIMAL(8,2) GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----- Ride Locations (time-series) -----
CREATE TABLE IF NOT EXISTS ride_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     UUID REFERENCES rides(id) NOT NULL,
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL,
  speed       DECIMAL(5,2),
  eta_minutes DECIMAL(6,2),
  alpha       DECIMAL(4,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ride_locations_ride_id ON ride_locations(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_locations_recorded_at ON ride_locations(recorded_at);

-- ----- Alerts -----
-- officer_id is nullable: hospital alerts do not target a specific officer
CREATE TABLE IF NOT EXISTS alerts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id              UUID REFERENCES rides(id) NOT NULL,
  officer_id           UUID REFERENCES users(id),
  alert_target         VARCHAR(20) DEFAULT 'officer' CHECK (alert_target IN ('officer', 'hospital')),
  trigger_type         VARCHAR(30) CHECK (trigger_type IN ('adaptive_eta', 'fallback_distance', 'distress')),
  eta_at_trigger       DECIMAL(6,2),
  tprepare_seconds     INTEGER,
  tclear_seconds       DECIMAL(6,2),
  alpha_value          DECIMAL(4,2),
  speed_value          DECIMAL(5,2),
  weather_value        DECIMAL(3,2),
  drift_value          DECIMAL(6,2),
  time_of_day_factor   DECIMAL(3,2),
  distance_at_trigger  INTEGER,
  acknowledged         BOOLEAN DEFAULT false,
  acknowledged_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_officer_id ON alerts(officer_id);
CREATE INDEX IF NOT EXISTS idx_alerts_ride_id ON alerts(ride_id);

-- ----- Pre-Arrivals -----
CREATE TABLE IF NOT EXISTS pre_arrivals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id        UUID REFERENCES rides(id) UNIQUE NOT NULL,
  emergency_type VARCHAR(30),
  severity       VARCHAR(20),
  heart_rate     INTEGER,
  blood_pressure VARCHAR(20),
  spo2           INTEGER,
  treatments     TEXT[],
  notes          TEXT,
  transmitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ----- Analytics Events -----
CREATE TABLE IF NOT EXISTS analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id    UUID REFERENCES rides(id),
  user_id    UUID REFERENCES users(id),
  event_type VARCHAR(50),
  meta       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_ride_id ON analytics_events(ride_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);

-- ----- Seed Hospitals -----
INSERT INTO hospitals (name, lat, lng, address) VALUES
  ('Government Medical College and Hospital', 21.1458, 79.0882, 'Nagpur, Maharashtra'),
  ('Lata Mangeshkar Hospital', 21.0924, 79.0622, 'Nagpur, Maharashtra'),
  ('Wockhardt Hospital Nagpur', 21.1415, 79.0808, 'Nagpur, Maharashtra')
ON CONFLICT DO NOTHING;
