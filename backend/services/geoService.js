/**
 * APSRTC SmartTrack Geo Location Service
 * Converts raw latitude/longitude coordinates into human-readable corridor locations.
 * Uses exact route-stop proximity and spatial interpolation. Never invents locations.
 */

const { calculateDistanceKm, calculateBearing } = require('../utils/haversine');
const { queryAll } = require('../config/db');
const logger = require('../utils/logger');

let cachedStops = null;
let lastStopsFetch = 0;

function getAllKnownStops() {
  const now = Date.now();
  // Cache stops for 60 seconds
  if (cachedStops && now - lastStopsFetch < 60000) {
    return cachedStops;
  }

  try {
    const stops = queryAll(`
      SELECT DISTINCT stop_name, latitude, longitude, stop_code
      FROM route_stops
    `);
    cachedStops = stops;
    lastStopsFetch = now;
    return stops;
  } catch (err) {
    logger.error('Failed to load known stops for geo resolution', { error: err.message });
    return cachedStops || [];
  }
}

/**
 * Resolve human-readable location name from latitude and longitude
 * @param {number} latitude
 * @param {number} longitude
 * @param {Array} routeStops (optional stops specific to current bus route)
 * @returns {string} Human-readable location description
 */
function resolveLocationName(latitude, longitude, routeStops = null) {
  const stops = (routeStops && routeStops.length > 0) ? routeStops : getAllKnownStops();

  if (!stops || stops.length === 0) {
    return `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`;
  }

  // Calculate distance to each stop
  const ranked = stops.map(stop => {
    const dist = calculateDistanceKm(latitude, longitude, stop.latitude, stop.longitude);
    return {
      stop_name: stop.stop_name,
      stop_code: stop.stop_code,
      latitude: stop.latitude,
      longitude: stop.longitude,
      distanceKm: dist,
      order: stop.stop_order || 0
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  const nearest = ranked[0];

  // At the stop (< 400 meters)
  if (nearest.distanceKm <= 0.4) {
    return nearest.stop_name;
  }

  // Very close to stop (< 2.5 km)
  if (nearest.distanceKm <= 2.5) {
    return `Near ${nearest.stop_name} (${nearest.distanceKm} km)`;
  }

  // Check if between two route stops
  if (ranked.length >= 2) {
    const secondNearest = ranked[1];
    if (nearest.distanceKm < 15 && secondNearest.distanceKm < 25) {
      return `Between ${nearest.stop_name} and ${secondNearest.stop_name} (${nearest.distanceKm} km from ${nearest.stop_name})`;
    }
  }

  return `Approaching ${nearest.stop_name} (${nearest.distanceKm} km away)`;
}

/**
 * Find the nearest route stop index and distance for route progress calculation
 */
function findNearestStop(latitude, longitude, routeStops) {
  if (!routeStops || routeStops.length === 0) return null;

  let minDistance = Infinity;
  let nearestIndex = 0;

  routeStops.forEach((stop, idx) => {
    const dist = calculateDistanceKm(latitude, longitude, stop.latitude, stop.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = idx;
    }
  });

  return {
    stop: routeStops[nearestIndex],
    index: nearestIndex,
    distanceKm: minDistance
  };
}

module.exports = {
  resolveLocationName,
  findNearestStop,
  getAllKnownStops
};
