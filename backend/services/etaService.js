/**
 * APSRTC SmartTrack ETA Service
 * Calculates dynamic Estimated Time of Arrival based on distance, speed, corridor topography, and dwell buffers.
 */

// Default nominal speed for Eastern Ghats bus corridors (km/h)
const NOMINAL_GHAT_SPEED_KPH = 35;
const NOMINAL_HIGHWAY_SPEED_KPH = 50;
const DWELL_TIME_PER_STOP_MINS = 2; // Boarding/alighting stop dwell buffer

/**
 * Calculate dynamic ETA
 * @param {number} remainingDistanceKm Distance in kilometers along route
 * @param {number} currentSpeedKph Instantaneous GPS speed (km/h)
 * @param {number} intermediateStopsCount Number of intermediate stops ahead
 * @param {string} routeType Corridor type ('GHAT' or 'STANDARD')
 * @returns {object} { etaMinutes, formattedEta, arrivalTime, confidence }
 */
function calculateEta(remainingDistanceKm, currentSpeedKph = 0, intermediateStopsCount = 0, routeType = 'GHAT') {
  if (remainingDistanceKm <= 0) {
    return {
      etaMinutes: 0,
      formattedEta: 'Arriving now',
      arrivalTime: new Date().toISOString(),
      confidence: 'HIGH'
    };
  }

  const nominalSpeed = routeType === 'GHAT' ? NOMINAL_GHAT_SPEED_KPH : NOMINAL_HIGHWAY_SPEED_KPH;

  // Determine effective speed
  let effectiveSpeed = nominalSpeed;
  let confidence = 'GOOD';

  if (currentSpeedKph > 10 && currentSpeedKph < 100) {
    // Weighted blend: 65% current speed + 35% corridor nominal speed
    effectiveSpeed = (currentSpeedKph * 0.65) + (nominalSpeed * 0.35);
    confidence = 'HIGH';
  } else if (currentSpeedKph <= 10) {
    // Bus is temporarily stopped at a bus stand or traffic signal
    effectiveSpeed = nominalSpeed * 0.85; // slightly reduced for slow/stopped start
    confidence = 'GOOD';
  }

  // Pure travel time in minutes
  const travelTimeMinutes = (remainingDistanceKm / effectiveSpeed) * 60;

  // Add dwell time for passenger boarding at intermediate stops
  const dwellBufferMinutes = Math.max(0, intermediateStopsCount) * DWELL_TIME_PER_STOP_MINS;

  const totalEtaMinutes = Math.round(travelTimeMinutes + dwellBufferMinutes);

  // Format readable ETA
  let formattedEta = '';
  if (totalEtaMinutes < 1) {
    formattedEta = '< 1 min';
  } else if (totalEtaMinutes < 60) {
    formattedEta = `${totalEtaMinutes} min`;
  } else {
    const hours = Math.floor(totalEtaMinutes / 60);
    const mins = totalEtaMinutes % 60;
    formattedEta = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }

  const arrivalDate = new Date(Date.now() + totalEtaMinutes * 60000);

  return {
    etaMinutes: totalEtaMinutes,
    formattedEta,
    arrivalTime: arrivalDate.toISOString(),
    confidence
  };
}

module.exports = {
  calculateEta,
  NOMINAL_GHAT_SPEED_KPH
};
