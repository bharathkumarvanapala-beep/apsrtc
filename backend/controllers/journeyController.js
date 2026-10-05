/**
 * APSRTC SmartTrack Journey Controller
 * Handles passenger journey searches and corridor stops retrieval.
 */

const { findRelevantBuses } = require('../services/journeyMatcherService');
const { queryAll } = require('../config/db');

function searchJourney(req, res, next) {
  try {
    const { from, to } = req.query;

    const results = findRelevantBuses(from, to);

    res.json(results);
  } catch (err) {
    next(err);
  }
}

function getCorridorStops(req, res, next) {
  try {
    // Return distinct stops along our active routes
    const stops = queryAll(`
      SELECT 
        stop_name,
        stop_code,
        latitude,
        longitude,
        MIN(stop_order) AS typical_order
      FROM route_stops
      GROUP BY stop_name
      ORDER BY typical_order ASC
    `);

    res.json({
      success: true,
      count: stops.length,
      stops
    });
  } catch (err) {
    next(err);
  }
}

function getAllRoutes(req, res, next) {
  try {
    const routes = queryAll(`
      SELECT 
        r.*,
        COUNT(rs.id) AS total_stops
      FROM routes r
      LEFT JOIN route_stops rs ON rs.route_id = r.id
      GROUP BY r.id
      ORDER BY r.route_code ASC
    `);

    res.json({
      success: true,
      count: routes.length,
      routes
    });
  } catch (err) {
    next(err);
  }
}

function getRouteStopsById(req, res, next) {
  try {
    const { routeId } = req.params;

    const stops = queryAll(`
      SELECT * FROM route_stops
      WHERE route_id = ?
      ORDER BY stop_order ASC
    `, [routeId]);

    res.json({
      success: true,
      routeId,
      stops
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchJourney,
  getCorridorStops,
  getAllRoutes,
  getRouteStopsById
};
