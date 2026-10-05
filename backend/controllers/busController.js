/**
 * APSRTC SmartTrack Bus Controller
 * Handles bus directory, single bus lookup, and location queries.
 */

const { queryAll, queryOne } = require('../config/db');
const { resolveActiveSourceForBus } = require('../services/locationResolverService');

function getAllBuses(req, res, next) {
  try {
    const { depot, serviceType, status } = req.query;

    let sql = `
      SELECT 
        b.id,
        b.bus_number,
        b.registration_number,
        b.depot,
        b.service_type,
        b.total_seats,
        b.status AS bus_status,
        t.trip_id,
        t.from_stop,
        t.to_stop,
        t.status AS trip_status,
        r.route_code,
        r.route_name,
        cbl.active_source,
        cbl.latitude,
        cbl.longitude,
        cbl.speed_kph,
        cbl.accuracy_meters,
        cbl.heading,
        cbl.location_name,
        cbl.status AS location_status,
        cbl.confidence,
        cbl.last_updated_at
      FROM buses b
      LEFT JOIN trips t ON t.bus_id = b.id AND t.status = 'RUNNING'
      LEFT JOIN routes r ON r.id = t.route_id
      LEFT JOIN current_bus_locations cbl ON cbl.bus_id = b.id
      WHERE 1=1
    `;

    const params = [];

    if (depot) {
      sql += ' AND LOWER(b.depot) = LOWER(?)';
      params.push(depot);
    }
    if (serviceType) {
      sql += ' AND b.service_type = ?';
      params.push(serviceType);
    }
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY b.bus_number ASC';

    const buses = queryAll(sql, params);

    res.json({
      success: true,
      count: buses.length,
      buses
    });
  } catch (err) {
    next(err);
  }
}

function getBusById(req, res, next) {
  try {
    const { busId } = req.params;

    const bus = queryOne(`
      SELECT 
        b.*,
        t.trip_id,
        t.from_stop,
        t.to_stop,
        t.status AS trip_status,
        r.route_code,
        r.route_name,
        s_drv.full_name AS driver_name,
        s_drv.employee_id AS driver_emp_id,
        s_cnd.full_name AS conductor_name,
        s_cnd.employee_id AS conductor_emp_id
      FROM buses b
      LEFT JOIN trips t ON t.bus_id = b.id AND t.status = 'RUNNING'
      LEFT JOIN routes r ON r.id = t.route_id
      LEFT JOIN staff s_drv ON s_drv.id = t.driver_staff_id
      LEFT JOIN staff s_cnd ON s_cnd.id = t.conductor_staff_id
      WHERE b.bus_number = ? OR b.id = ?
    `, [busId, Number(busId) || 0]);

    if (!bus) {
      return res.status(404).json({
        success: false,
        error: `Bus with identifier "${busId}" was not found.`
      });
    }

    // Registered devices for this bus
    const hwTrackers = queryAll('SELECT * FROM gps_devices WHERE bus_id = ?', [bus.id]);
    const crewDevices = queryAll('SELECT * FROM crew_devices WHERE bus_id = ?', [bus.id]);
    const etmDevices = queryAll('SELECT * FROM etm_devices WHERE bus_id = ?', [bus.id]);

    // Active location resolution
    const location = resolveActiveSourceForBus(bus.bus_number);

    res.json({
      success: true,
      bus: {
        ...bus,
        devices: {
          hardwareTrackers: hwTrackers,
          crewPhones: crewDevices,
          etmDevices: etmDevices
        },
        currentLocation: location
      }
    });
  } catch (err) {
    next(err);
  }
}

function getBusLocation(req, res, next) {
  try {
    const { busId } = req.params;

    const bus = queryOne('SELECT id, bus_number FROM buses WHERE bus_number = ? OR id = ?', [busId, Number(busId) || 0]);
    if (!bus) {
      return res.status(404).json({
        success: false,
        error: `Bus "${busId}" does not exist.`
      });
    }

    const location = resolveActiveSourceForBus(bus.bus_number);

    res.json({
      success: true,
      busNumber: bus.bus_number,
      location
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllBuses,
  getBusById,
  getBusLocation
};
