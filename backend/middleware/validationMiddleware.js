/**
 * APSRTC SmartTrack Validation Middleware
 * Validates GPS payloads, journey search parameters, and complaint data.
 */

function validateGpsPayload(req, res, next) {
  const { busNumber, busId, latitude, longitude, speedKph, accuracyMeters } = req.body;

  if (!busNumber && !busId) {
    return res.status(400).json({
      success: false,
      error: 'Bus identification required. Please provide busNumber or busId.'
    });
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({
      success: false,
      error: `Invalid latitude "${latitude}". Must be a number between -90 and 90.`
    });
  }

  if (isNaN(lon) || lon < -180 || lon > 180) {
    return res.status(400).json({
      success: false,
      error: `Invalid longitude "${longitude}". Must be a number between -180 and 180.`
    });
  }

  if (speedKph !== undefined) {
    const spd = Number(speedKph);
    if (isNaN(spd) || spd < 0 || spd > 180) {
      return res.status(400).json({
        success: false,
        error: `Invalid speed "${speedKph}". Must be between 0 and 180 km/h.`
      });
    }
  }

  if (accuracyMeters !== undefined) {
    const acc = Number(accuracyMeters);
    if (isNaN(acc) || acc < 0 || acc > 2000) {
      return res.status(400).json({
        success: false,
        error: `Invalid accuracy "${accuracyMeters}". Must be between 0 and 2000 meters.`
      });
    }
  }

  next();
}

function validateJourneySearch(req, res, next) {
  const { from, to } = req.query;

  if (!from || !from.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Unknown departure location. Please provide a "from" parameter.'
    });
  }

  if (!to || !to.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Unknown destination. Please provide a "to" parameter.'
    });
  }

  if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
    return res.status(400).json({
      success: false,
      error: 'Departure (From) and Destination (To) cannot be the same stop.'
    });
  }

  next();
}

function validateComplaint(req, res, next) {
  const { busNumber, category, description } = req.body;

  if (!busNumber || !busNumber.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid bus number. Bus number is required to file a grievance.'
    });
  }

  if (!category || typeof category !== 'string' || category.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Category is required. Please select a valid grievance category (Staff Conduct, Bus Condition, or Service).'
    });
  }

  if (!description || description.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: 'Description must be at least 5 characters long explaining the issue.'
    });
  }

  next();
}

module.exports = {
  validateGpsPayload,
  validateJourneySearch,
  validateComplaint
};
