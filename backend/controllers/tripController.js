/**
 * APSRTC SmartTrack Trip Controller
 * Manages trip lifecycle: start trip, end trip, staff assignment.
 */

const { queryAll, queryOne, run } = require('../config/db');

function startTrip(req, res, next) {
  try {
    const { busNumber, employeeId, fromStop, toStop, routeCode } = req.body;

    if (!busNumber || !fromStop || !toStop) {
      return res.status(400).json({
        success: false,
        error: 'busNumber, fromStop, and toStop are required to start a trip.'
      });
    }

    // Find bus
    const bus = queryOne('SELECT * FROM buses WHERE bus_number = ?', [String(busNumber)]);
    if (!bus) {
      return res.status(404).json({
        success: false,
        error: `Bus "${busNumber}" does not exist in APSRTC database.`
      });
    }

    // Find staff
    let staff = null;
    if (employeeId) {
      staff = queryOne('SELECT * FROM staff WHERE employee_id = ?', [employeeId]);
    }

    // Find or deduce route
    let route = null;
    if (routeCode) {
      route = queryOne('SELECT * FROM routes WHERE route_code = ?', [routeCode]);
    }
    if (!route) {
      // Find candidate route containing fromStop and toStop
      route = queryOne(`
        SELECT r.*
        FROM routes r
        JOIN route_stops rs_from ON rs_from.route_id = r.id AND LOWER(rs_from.stop_name) = LOWER(?)
        JOIN route_stops rs_to ON rs_to.route_id = r.id AND LOWER(rs_to.stop_name) = LOWER(?)
        WHERE rs_from.stop_order < rs_to.stop_order AND r.is_active = 1
        LIMIT 1
      `, [fromStop, toStop]);
    }

    if (!route) {
      // Fallback to primary corridor
      route = queryOne('SELECT * FROM routes WHERE is_active = 1 LIMIT 1');
    }

    // Generate unique tripId e.g. TRIP-2026-BUSNUM-TIMESTAMP
    const tripId = `TRIP-${new Date().getFullYear()}-${bus.bus_number}-${Date.now().toString().slice(-4)}`;

    // End any existing running trip for this bus
    run(`UPDATE trips SET status = 'COMPLETED', end_time = datetime('now') WHERE bus_id = ? AND status = 'RUNNING'`, [bus.id]);

    // Insert new trip
    run(`
      INSERT INTO trips (
        trip_id, bus_id, route_id, driver_staff_id, from_stop, to_stop, status, start_time
      ) VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', datetime('now'))
    `, [
      tripId,
      bus.id,
      route.id,
      staff ? staff.id : null,
      fromStop,
      toStop
    ]);

    res.status(201).json({
      success: true,
      message: `Trip started successfully for Bus ${bus.bus_number}`,
      trip: {
        tripId,
        busNumber: bus.bus_number,
        routeCode: route.route_code,
        routeName: route.route_name,
        fromStop,
        toStop,
        driverName: staff ? staff.full_name : 'Assigned Crew',
        status: 'RUNNING',
        startTime: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
}

function endTrip(req, res, next) {
  try {
    const { tripId } = req.params;

    const trip = queryOne('SELECT * FROM trips WHERE trip_id = ?', [tripId]);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: `Trip "${tripId}" was not found.`
      });
    }

    run(`UPDATE trips SET status = 'COMPLETED', end_time = datetime('now') WHERE trip_id = ?`, [tripId]);

    res.json({
      success: true,
      message: `Trip ${tripId} has been successfully completed and closed.`
    });
  } catch (err) {
    next(err);
  }
}

function getActiveTrips(req, res, next) {
  try {
    const trips = queryAll(`
      SELECT 
        t.*,
        b.bus_number,
        b.registration_number,
        b.service_type,
        r.route_code,
        r.route_name,
        s.full_name AS driver_name,
        s.employee_id AS driver_emp_id
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      LEFT JOIN staff s ON s.id = t.driver_staff_id
      WHERE t.status = 'RUNNING'
      ORDER BY t.start_time DESC
    `);

    res.json({
      success: true,
      count: trips.length,
      trips
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startTrip,
  endTrip,
  getActiveTrips
};
