/**
 * APSRTC SmartTrack Configuration
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_CLIENT: process.env.DB_CLIENT || 'sqlite', // 'sqlite' or 'postgres'
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../apsrtc.db'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  DEMO_MODE: process.env.DEMO_MODE !== 'false', // Default: true for prototype
  
  // Location Freshness Thresholds (in seconds)
  FRESHNESS: {
    LIVE_MAX_SEC: parseInt(process.env.FRESHNESS_LIVE_SEC || '10', 10),
    RECENT_MAX_SEC: parseInt(process.env.FRESHNESS_RECENT_SEC || '60', 10),
    STALE_MAX_SEC: parseInt(process.env.FRESHNESS_STALE_SEC || '300', 10), // 5 mins
  },

  // Priority Hierarchy for Bus Location Sources
  // 1: Hardware Tracker, 2: Crew Phone, 3: ETM, 4: Demo Simulator
  LOCATION_PRIORITY: [
    'HARDWARE_TRACKER',
    'CREW_PHONE',
    'ETM',
    'DEMO'
  ],

  // GPS Accuracy Confidence Thresholds (meters)
  GPS_CONFIDENCE: {
    HIGH: 10,   // <= 10m
    GOOD: 25,   // <= 25m
    WEAK: 80,   // <= 80m
  }
};
