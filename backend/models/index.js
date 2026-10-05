/**
 * APSRTC SmartTrack Database Models Index
 */

const { queryAll, queryOne, run } = require('../config/db');

const Bus = {
  findAll: (filter = {}) => {
    let sql = 'SELECT * FROM buses WHERE 1=1';
    const params = [];
    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    return queryAll(sql, params);
  },
  findByNumber: (busNumber) => {
    return queryOne('SELECT * FROM buses WHERE bus_number = ?', [busNumber]);
  },
  findById: (id) => {
    return queryOne('SELECT * FROM buses WHERE id = ?', [id]);
  }
};

const Route = {
  findAll: () => queryAll('SELECT * FROM routes WHERE is_active = 1'),
  findById: (id) => queryOne('SELECT * FROM routes WHERE id = ?', [id]),
  getStops: (routeId) => queryAll('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC', [routeId])
};

const Trip = {
  findActiveByBusId: (busId) => queryOne("SELECT * FROM trips WHERE bus_id = ? AND status = 'RUNNING' LIMIT 1", [busId]),
  findById: (tripId) => queryOne('SELECT * FROM trips WHERE trip_id = ?', [tripId])
};

const Complaint = {
  findByRef: (ref) => queryOne('SELECT * FROM complaints WHERE complaint_ref = ?', [ref]),
  findByBus: (busNumber) => queryAll('SELECT * FROM complaints WHERE bus_number = ? ORDER BY created_at DESC', [busNumber])
};

module.exports = {
  Bus,
  Route,
  Trip,
  Complaint
};
