/**
 * Haversine and Geographic Utilities
 * High-precision distance and bearing calculations.
 */

const EARTH_RADIUS_KM = 6371.0088; // WGS84 mean earth radius in km

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180.0;
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians) {
  return (radians * 180.0) / Math.PI;
}

/**
 * Calculate straight-line Haversine distance between two coordinates in kilometers
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * Calculate straight-line Haversine distance in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  return Math.round(calculateDistanceKm(lat1, lon1, lat2, lon2) * 1000);
}

/**
 * Calculate forward azimuth / bearing in degrees (0 - 360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const bearing = (toDegrees(theta) + 360) % 360;
  return Math.round(bearing);
}

/**
 * Convert bearing in degrees to compass direction string
 */
function bearingToDirection(bearing) {
  const directions = [
    'North', 'North-East', 'East', 'South-East',
    'South', 'South-West', 'West', 'North-West'
  ];
  const index = Math.round(((bearing %= 360) < 0 ? bearing + 360 : bearing) / 45) % 8;
  return directions[index];
}

module.exports = {
  calculateDistanceKm,
  calculateDistanceMeters,
  calculateBearing,
  bearingToDirection,
  EARTH_RADIUS_KM
};
