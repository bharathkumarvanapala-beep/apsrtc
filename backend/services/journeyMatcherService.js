/**
 * APSRTC SmartTrack Journey Matching Service
 * Generic corridor-aware bus matching algorithm.
 * Evaluates direction, route order, spatial distance, and passenger relevance.
 */

const { queryAll, queryOne } = require('../config/db');
const { calculateDistanceKm, calculateBearing, bearingToDirection } = require('../utils/haversine');
const { findNearestStop } = require('./geoService');
const { calculateEta } = require('./etaService');
const { calculateFreshness, calculateConfidence, parseUtcDate } = require('./locationResolverService');
const logger = require('../utils/logger');

/**
 * Find all relevant buses for a passenger journey
 * @param {string} fromLocation Boarding stop name
 * @param {string} toLocation Destination stop name
 * @returns {object} Search results with all matching incoming buses
 */
function findRelevantBuses(fromLocation, toLocation) {
  const fromClean = (fromLocation || '').trim();
  const toClean = (toLocation || '').trim();

  if (!fromClean || !toClean) {
    throw new Error('Both departure (From) and destination (To) locations are required.');
  }

  if (fromClean.toLowerCase() === toClean.toLowerCase()) {
    throw new Error('Departure and destination locations must be different.');
  }

  // 1. Find all candidate routes containing both stops
  const candidateRoutes = queryAll(`
    SELECT 
      r.id AS route_id,
      r.route_code,
      r.route_name,
      r.origin,
      r.destination,
      rs_from.stop_order AS from_order,
      rs_from.stop_name AS from_stop_name,
      rs_from.latitude AS from_lat,
      rs_from.longitude AS from_lon,
      rs_to.stop_order AS to_order,
      rs_to.stop_name AS to_stop_name,
      rs_to.latitude AS to_lat,
      rs_to.longitude AS to_lon
    FROM routes r
    JOIN route_stops rs_from ON rs_from.route_id = r.id AND LOWER(rs_from.stop_name) = LOWER(?)
    JOIN route_stops rs_to ON rs_to.route_id = r.id AND LOWER(rs_to.stop_name) = LOWER(?)
    WHERE r.is_active = 1
  `, [fromClean, toClean]);

  if (!candidateRoutes || candidateRoutes.length === 0) {
    // Check if stops exist in system
    const fromExists = queryOne('SELECT id FROM route_stops WHERE LOWER(stop_name) = LOWER(?) LIMIT 1', [fromClean]);
    const toExists = queryOne('SELECT id FROM route_stops WHERE LOWER(stop_name) = LOWER(?) LIMIT 1', [toClean]);

    if (!fromExists && !toExists) {
      throw new Error(`Neither "${fromClean}" nor "${toClean}" were found in APSRTC route network.`);
    } else if (!fromExists) {
      throw new Error(`Departure location "${fromClean}" not found in corridor network.`);
    } else if (!toExists) {
      throw new Error(`Destination "${toClean}" not found in corridor network.`);
    } else {
      throw new Error(`No direct route found connecting "${fromClean}" to "${toClean}".`);
    }
  }

  // 2. Filter routes matching the requested journey direction (from_order < to_order)
  const matchingRoutes = candidateRoutes.filter(r => r.from_order < r.to_order);

  if (matchingRoutes.length === 0) {
    throw new Error(`Buses on this corridor travel in the opposite direction. Please check reverse route.`);
  }

  const relevantBuses = [];
  const passedBuses = [];

  // 3. For each matching route, find active buses
  for (const route of matchingRoutes) {
    // Get all stops for this route in order
    const allStops = queryAll(`
      SELECT stop_name, stop_code, stop_order, latitude, longitude, distance_from_origin_km
      FROM route_stops
      WHERE route_id = ?
      ORDER BY stop_order ASC
    `, [route.route_id]);

    const passengerFromStop = allStops.find(s => s.stop_order === route.from_order);
    const passengerToStop = allStops.find(s => s.stop_order === route.to_order);

    // Query active buses assigned to this route or with active trips on this corridor
    const activeBuses = queryAll(`
      SELECT 
        b.id AS bus_id,
        b.bus_number,
        b.registration_number,
        b.depot,
        b.service_type,
        b.total_seats,
        t.trip_id,
        t.from_stop AS trip_from,
        t.to_stop AS trip_to,
        t.status AS trip_status,
        cbl.active_source,
        cbl.device_id,
        cbl.latitude,
        cbl.longitude,
        cbl.accuracy_meters,
        cbl.speed_kph,
        cbl.heading,
        cbl.altitude,
        cbl.location_name,
        cbl.status AS db_status,
        cbl.confidence AS db_confidence,
        cbl.last_updated_at
      FROM buses b
      JOIN trips t ON t.bus_id = b.id AND t.status = 'RUNNING' AND t.route_id = ?
      LEFT JOIN current_bus_locations cbl ON cbl.bus_id = b.id
      WHERE b.status = 'ACTIVE'
    `, [route.route_id]);

    for (const bus of activeBuses) {
      // If bus has no GPS coordinates at all
      if (!bus.latitude || !bus.longitude) {
        continue;
      }

      // Calculate freshness age
      const lastUpdatedMs = parseUtcDate(bus.last_updated_at);
      const ageSeconds = Math.max(0, Math.floor((Date.now() - lastUpdatedMs) / 1000));
      const freshness = calculateFreshness(ageSeconds);
      const confidence = calculateConfidence(bus.accuracy_meters);

      // Locate nearest route stop to project bus position along corridor
      const nearest = findNearestStop(bus.latitude, bus.longitude, allStops);
      const busOrder = nearest ? nearest.stop.stop_order : 1;

      // Straight-line distance from bus to passenger boarding stop
      const directDistToPassengerKm = calculateDistanceKm(
        bus.latitude,
        bus.longitude,
        passengerFromStop.latitude,
        passengerFromStop.longitude
      );

      // Relationship determination:
      // - BUS_AT_PASSENGER: bus is within 400m of passenger stop
      // - APPROACHING: bus is prior to passenger stop (busOrder <= from_order)
      // - BUS_ALREADY_PASSED: busOrder > from_order and direct distance > 0.5km
      let relationship = 'APPROACHING';
      let isRelevant = false;

      if (directDistToPassengerKm <= 0.45) {
        relationship = 'BUS_AT_PASSENGER';
        isRelevant = true;
      } else if (busOrder < route.from_order) {
        relationship = 'APPROACHING';
        isRelevant = true;
      } else if (busOrder === route.from_order) {
        // At the passenger stop or near boundary
        if (directDistToPassengerKm <= 1.2) {
          relationship = 'BUS_NEAR_PASSENGER';
          isRelevant = true;
        } else {
          relationship = 'BUS_ALREADY_PASSED';
          isRelevant = false;
        }
      } else {
        // busOrder > route.from_order
        relationship = 'BUS_ALREADY_PASSED';
        isRelevant = false;
      }

      // Calculate corridor distance from bus to passenger stop
      let corridorDistanceToPassengerKm = 0;
      let intermediateStopsCount = 0;

      if (isRelevant) {
        if (relationship === 'BUS_AT_PASSENGER') {
          corridorDistanceToPassengerKm = directDistToPassengerKm;
          intermediateStopsCount = 0;
        } else {
          // Sum up segment distances from bus nearest stop to passenger boarding stop
          const segmentStops = allStops.filter(
            s => s.stop_order >= busOrder && s.stop_order <= route.from_order
          );
          intermediateStopsCount = Math.max(0, segmentStops.length - 1);

          if (segmentStops.length >= 2) {
            let segDist = 0;
            for (let i = 0; i < segmentStops.length - 1; i++) {
              segDist += calculateDistanceKm(
                segmentStops[i].latitude,
                segmentStops[i].longitude,
                segmentStops[i + 1].latitude,
                segmentStops[i + 1].longitude
              );
            }
            corridorDistanceToPassengerKm = Number(segDist.toFixed(1));
          } else {
            corridorDistanceToPassengerKm = directDistToPassengerKm;
          }
        }
      }

      // Calculate ETA to passenger stop
      const eta = calculateEta(
        corridorDistanceToPassengerKm,
        bus.speed_kph || 0,
        intermediateStopsCount,
        'GHAT'
      );

      // Journey distance for the passenger (from boarding to destination)
      const passengerJourneyDistKm = Math.abs(
        passengerToStop.distance_from_origin_km - passengerFromStop.distance_from_origin_km
      );

      const busPayload = {
        busId: bus.bus_id,
        busNumber: bus.bus_number,
        registrationNumber: bus.registration_number,
        serviceType: bus.service_type,
        depot: bus.depot,
        totalSeats: bus.total_seats,
        tripId: bus.trip_id,
        routeId: route.route_id,
        routeCode: route.route_code,
        routeName: route.route_name,
        tripFrom: bus.trip_from,
        tripTo: bus.trip_to,
        towards: passengerToStop.stop_name,
        
        // Location details
        currentLocation: bus.location_name || `${bus.latitude.toFixed(4)}, ${bus.longitude.toFixed(4)}`,
        latitude: bus.latitude,
        longitude: bus.longitude,
        speedKph: bus.speed_kph || 0,
        heading: bus.heading || 0,
        headingDirection: bearingToDirection(bus.heading || 0),
        accuracyMeters: bus.accuracy_meters || 10,
        activeSource: bus.active_source || 'DEMO',
        status: freshness,
        confidence,
        ageSeconds,
        lastUpdatedAt: bus.last_updated_at,

        // Journey Proximity
        relationship,
        distanceToPassengerKm: Number(corridorDistanceToPassengerKm.toFixed(1)),
        directDistanceKm: directDistToPassengerKm,
        etaMinutes: eta.etaMinutes,
        etaFormatted: eta.formattedEta,
        estimatedArrival: eta.arrivalTime,
        passengerJourneyKm: Number(passengerJourneyDistKm.toFixed(1)),
        isBoardable: isRelevant
      };

      if (isRelevant) {
        relevantBuses.push(busPayload);
      } else {
        passedBuses.push(busPayload);
      }
    }
  }

  // 4. Sort relevant buses:
  // 1: Proximity / ETA ascending (earliest arrival first)
  // 2: Freshness (LIVE > RECENT > STALE > UNAVAILABLE)
  const freshnessRank = { LIVE: 1, RECENT: 2, STALE: 3, UNAVAILABLE: 4 };

  relevantBuses.sort((a, b) => {
    // If one is at passenger location, it comes first
    if (a.relationship === 'BUS_AT_PASSENGER' && b.relationship !== 'BUS_AT_PASSENGER') return -1;
    if (b.relationship === 'BUS_AT_PASSENGER' && a.relationship !== 'BUS_AT_PASSENGER') return 1;

    // Proximity/ETA
    if (a.etaMinutes !== b.etaMinutes) {
      return a.etaMinutes - b.etaMinutes;
    }

    // Freshness rank
    return (freshnessRank[a.status] || 5) - (freshnessRank[b.status] || 5);
  });

  // Flag the best option as recommended
  if (relevantBuses.length > 0) {
    relevantBuses[0].isRecommended = true;
  }

  return {
    success: true,
    search: {
      from: fromClean,
      to: toClean,
      searchedAt: new Date().toISOString()
    },
    totalRelevantBuses: relevantBuses.length,
    buses: relevantBuses,
    passedBusesCount: passedBuses.length,
    passedBuses: passedBuses,
    calculationMethod: 'Corridor Route-Segment Network Projection & Haversine Distance',
    corridor: {
      routesMatched: matchingRoutes.map(r => ({
        code: r.route_code,
        name: r.route_name
      }))
    }
  };
}

module.exports = {
  findRelevantBuses
};
