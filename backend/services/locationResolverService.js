/**
 * APSRTC SmartTrack Multi-Source Location Resolver Service
 * Evaluates incoming GPS updates from Hardware Trackers, Crew Phones, ETMs, and Demo Simulator.
 * Enforces priority hierarchy, freshness checks, spatial geocoding, and WebSocket dispatch.
 */

const { queryOne, queryAll, run, transaction } = require('../config/db');
const config = require('../config/config');
const { resolveLocationName } = require('./geoService');
const { broadcastBusLocation } = require('./socketService');
const logger = require('../utils/logger');

// In-memory latest updates cache per bus and source for sub-millisecond priority evaluation
// Structure: Map<busNumber, Map<sourceName, updateData>>
const busSourceCache = new Map();

/**
 * Accurately parse UTC date string from SQLite or ISO
 */
function parseUtcDate(dateStr) {
  if (!dateStr) return Date.now();
  if (typeof dateStr === 'number') return dateStr;
  const str = String(dateStr).trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    return new Date(str.replace(' ', 'T') + 'Z').getTime();
  }
  return new Date(str).getTime();
}

/**
 * Calculate freshness label based on age in seconds
 */
function calculateFreshness(ageSeconds) {
  if (ageSeconds <= config.FRESHNESS.LIVE_MAX_SEC) {
    return 'LIVE';
  } else if (ageSeconds <= config.FRESHNESS.RECENT_MAX_SEC) {
    return 'RECENT';
  } else if (ageSeconds <= config.FRESHNESS.STALE_MAX_SEC) {
    return 'STALE';
  } else {
    return 'UNAVAILABLE';
  }
}

/**
 * Calculate GPS accuracy confidence label
 */
function calculateConfidence(accuracyMeters) {
  if (!accuracyMeters || isNaN(accuracyMeters)) return 'UNKNOWN';
  if (accuracyMeters <= config.GPS_CONFIDENCE.HIGH) return 'HIGH';
  if (accuracyMeters <= config.GPS_CONFIDENCE.GOOD) return 'GOOD';
  if (accuracyMeters <= config.GPS_CONFIDENCE.WEAK) return 'WEAK';
  return 'UNKNOWN';
}

/**
 * Resolve Bus ID and basic metadata by bus number or bus ID
 */
function getBusRecord(busIdentifier) {
  let bus = queryOne('SELECT * FROM buses WHERE bus_number = ?', [String(busIdentifier)]);
  if (!bus) {
    bus = queryOne('SELECT * FROM buses WHERE id = ?', [Number(busIdentifier) || 0]);
  }
  return bus;
}

/**
 * Process an incoming location update from any source
 * @param {object} payload
 * @returns {object} resolved active state
 */
function processLocationUpdate(payload) {
  const {
    busNumber,
    busId,
    source,
    deviceId,
    tripId,
    latitude,
    longitude,
    accuracyMeters = 10,
    speedKph = 0,
    heading = 0,
    altitude = 0,
    timestamp = new Date().toISOString()
  } = payload;

  // 1. Validation
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid GPS coordinates: [${latitude}, ${longitude}]`);
  }
  if (!['HARDWARE_TRACKER', 'CREW_PHONE', 'ETM', 'DEMO'].includes(source)) {
    throw new Error(`Invalid location source: ${source}`);
  }

  // 2. Bus Identity Resolution
  const bus = getBusRecord(busNumber || busId);
  if (!bus) {
    throw new Error(`Bus not found for identifier: ${busNumber || busId}`);
  }

  const busNum = bus.bus_number;
  const busRecordId = bus.id;

  // 3. Find active trip & route
  let trip = null;
  if (tripId) {
    trip = queryOne('SELECT * FROM trips WHERE trip_id = ?', [tripId]);
  }
  if (!trip) {
    trip = queryOne("SELECT * FROM trips WHERE bus_id = ? AND status = 'RUNNING' ORDER BY id DESC LIMIT 1", [busRecordId]);
  }

  const routeId = trip ? trip.route_id : null;
  const fromStop = trip ? trip.from_stop : null;
  const toStop = trip ? trip.to_stop : null;

  // 4. Resolve Human-Readable Location
  let routeStops = [];
  if (routeId) {
    routeStops = queryAll('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC', [routeId]);
  }
  const locationName = resolveLocationName(latitude, longitude, routeStops);

  // 5. Update Bus Source Cache
  if (!busSourceCache.has(busNum)) {
    busSourceCache.set(busNum, new Map());
  }
  const sourcesMap = busSourceCache.get(busNum);

  const updateRecord = {
    busId: busRecordId,
    busNumber: busNum,
    source,
    deviceId,
    tripId: trip ? trip.trip_id : null,
    routeId,
    latitude,
    longitude,
    accuracyMeters: Number(accuracyMeters),
    speedKph: Number(speedKph),
    heading: Number(heading),
    altitude: Number(altitude),
    locationName,
    timestamp: new Date(timestamp).getTime(),
    receivedAt: Date.now()
  };

  sourcesMap.set(source, updateRecord);

  // 6. Multi-Source Priority Resolution
  const resolved = resolveActiveSourceForBus(busNum);

  // 7. Save raw log to location_updates table
  try {
    run(`
      INSERT INTO location_updates (
        bus_id, bus_number, source, device_id, trip_id, route_id,
        latitude, longitude, accuracy_meters, speed_kph, heading, altitude,
        location_name, timestamp, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      busRecordId,
      busNum,
      source,
      deviceId || null,
      trip ? trip.trip_id : null,
      routeId,
      latitude,
      longitude,
      Number(accuracyMeters),
      Number(speedKph),
      Number(heading),
      Number(altitude),
      locationName
    ]);
  } catch (err) {
    logger.warn(`Failed to insert location_updates log: ${err.message}`);
  }

  // 8. Update current_bus_locations table
  try {
    const sourceColMap = {
      HARDWARE_TRACKER: 'last_hardware_update_at',
      CREW_PHONE: 'last_crew_update_at',
      ETM: 'last_etm_update_at',
      DEMO: 'last_demo_update_at'
    };
    const updateCol = sourceColMap[source];

    run(`
      INSERT INTO current_bus_locations (
        bus_id, bus_number, active_source, device_id, trip_id, route_id,
        latitude, longitude, accuracy_meters, speed_kph, heading, altitude,
        location_name, from_stop, to_stop, status, confidence,
        last_updated_at, ${updateCol}
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(bus_id) DO UPDATE SET
        active_source = excluded.active_source,
        device_id = excluded.device_id,
        trip_id = COALESCE(excluded.trip_id, current_bus_locations.trip_id),
        route_id = COALESCE(excluded.route_id, current_bus_locations.route_id),
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_meters = excluded.accuracy_meters,
        speed_kph = excluded.speed_kph,
        heading = excluded.heading,
        altitude = excluded.altitude,
        location_name = excluded.location_name,
        from_stop = COALESCE(excluded.from_stop, current_bus_locations.from_stop),
        to_stop = COALESCE(excluded.to_stop, current_bus_locations.to_stop),
        status = excluded.status,
        confidence = excluded.confidence,
        last_updated_at = datetime('now'),
        ${updateCol} = datetime('now')
    `, [
      busRecordId,
      busNum,
      resolved.activeSource,
      resolved.deviceId,
      trip ? trip.trip_id : null,
      routeId,
      resolved.latitude,
      resolved.longitude,
      resolved.accuracyMeters,
      resolved.speedKph,
      resolved.heading,
      resolved.altitude,
      resolved.locationName,
      fromStop,
      toStop,
      resolved.status,
      resolved.confidence
    ]);
  } catch (err) {
    logger.error('Failed to update current_bus_locations', { error: err.message });
  }

  // 9. Dispatch real-time WebSocket broadcast
  const broadcastPayload = {
    ...resolved,
    busNumber: busNum,
    busId: busRecordId,
    serviceType: bus.service_type,
    depot: bus.depot,
    fromStop,
    toStop,
    routeId
  };

  broadcastBusLocation(broadcastPayload);

  return broadcastPayload;
}

/**
 * Resolve the highest-priority valid source for a given bus
 */
function resolveActiveSourceForBus(busNumber) {
  const sourcesMap = busSourceCache.get(busNumber);
  const now = Date.now();

  // If memory cache is empty, hydrate from database current_bus_locations
  if (!sourcesMap || sourcesMap.size === 0) {
    const dbLoc = queryOne('SELECT * FROM current_bus_locations WHERE bus_number = ?', [busNumber]);
    if (dbLoc) {
      const ageSec = Math.floor((now - parseUtcDate(dbLoc.last_updated_at)) / 1000);
      const freshness = calculateFreshness(ageSec);
      return {
        activeSource: dbLoc.active_source,
        deviceId: dbLoc.device_id,
        latitude: dbLoc.latitude,
        longitude: dbLoc.longitude,
        accuracyMeters: dbLoc.accuracy_meters,
        speedKph: dbLoc.speed_kph,
        heading: dbLoc.heading,
        altitude: dbLoc.altitude,
        locationName: dbLoc.location_name,
        status: freshness,
        confidence: calculateConfidence(dbLoc.accuracy_meters),
        ageSeconds: Math.max(0, ageSec),
        lastUpdatedAt: dbLoc.last_updated_at
      };
    }

    return {
      activeSource: 'NONE',
      deviceId: null,
      latitude: null,
      longitude: null,
      status: 'UNAVAILABLE',
      confidence: 'UNKNOWN',
      locationName: 'Location currently unavailable',
      ageSeconds: null
    };
  }

  // Iterate strictly by Priority:
  // 1: HARDWARE_TRACKER, 2: CREW_PHONE, 3: ETM, 4: DEMO
  for (const candidateSource of config.LOCATION_PRIORITY) {
    if (sourcesMap.has(candidateSource)) {
      const update = sourcesMap.get(candidateSource);
      const ageSeconds = Math.max(0, Math.floor((now - update.receivedAt) / 1000));

      // If update is within STALE_MAX_SEC (e.g. 300s = 5 mins), select it!
      if (ageSeconds <= config.FRESHNESS.STALE_MAX_SEC) {
        const freshness = calculateFreshness(ageSeconds);
        return {
          activeSource: candidateSource,
          deviceId: update.deviceId,
          latitude: update.latitude,
          longitude: update.longitude,
          accuracyMeters: update.accuracyMeters,
          speedKph: update.speedKph,
          heading: update.heading,
          altitude: update.altitude,
          locationName: update.locationName,
          status: freshness,
          confidence: calculateConfidence(update.accuracyMeters),
          ageSeconds,
          lastUpdatedAt: new Date(update.timestamp).toISOString()
        };
      }
    }
  }

  // If no source is fresh (< 300s)
  return {
    activeSource: 'NONE',
    deviceId: null,
    latitude: null,
    longitude: null,
    status: 'UNAVAILABLE',
    confidence: 'UNKNOWN',
    locationName: 'Location currently unavailable (GPS timeout)',
    ageSeconds: null
  };
}

/**
 * Simulate or set source offline (useful for operator failover testing)
 */
function setSourceOffline(busNumber, source) {
  if (busSourceCache.has(busNumber)) {
    const map = busSourceCache.get(busNumber);
    map.delete(source);
    logger.info(`Source ${source} marked offline for Bus ${busNumber}`);
    const resolved = resolveActiveSourceForBus(busNumber);
    broadcastBusLocation({ ...resolved, busNumber });
    return resolved;
  }
  return null;
}

module.exports = {
  processLocationUpdate,
  resolveActiveSourceForBus,
  setSourceOffline,
  calculateFreshness,
  calculateConfidence,
  parseUtcDate,
  busSourceCache
};
