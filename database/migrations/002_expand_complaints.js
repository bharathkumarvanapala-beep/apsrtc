/**
 * Migration 002: Expand Complaints Table for Staff & Bus Condition Categories
 */

const path = require('path');
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = require(path.join(__dirname, '../../backend/node_modules/better-sqlite3'));
}

const dbPath = path.join(__dirname, '../../backend/apsrtc.db');
const db = new Database(dbPath);

console.log('Running Migration 002 on:', dbPath);

db.exec(`
  PRAGMA foreign_keys = OFF;
  
  CREATE TABLE IF NOT EXISTS complaints_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_ref TEXT UNIQUE NOT NULL,
    bus_number TEXT NOT NULL,
    trip_id TEXT,
    target_type TEXT DEFAULT 'GENERAL',
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

  INSERT OR IGNORE INTO complaints_new (
    id, complaint_ref, bus_number, trip_id, target_type, category,
    description, passenger_name, passenger_phone, location, status,
    officer_notes, created_at, updated_at
  )
  SELECT 
    id, complaint_ref, bus_number, trip_id, 'GENERAL', category,
    description, passenger_name, passenger_phone, location, status,
    officer_notes, created_at, updated_at
  FROM complaints;

  DROP TABLE IF EXISTS complaints;
  ALTER TABLE complaints_new RENAME TO complaints;
  
  CREATE INDEX IF NOT EXISTS idx_complaints_bus_num ON complaints(bus_number);
  CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
  CREATE INDEX IF NOT EXISTS idx_complaints_target ON complaints(target_type);
  
  PRAGMA foreign_keys = ON;
`);

console.log('✅ Migration 002 complete: complaints table now supports target_type, sub_category, photo_url, and flexible categories!');
db.close();
