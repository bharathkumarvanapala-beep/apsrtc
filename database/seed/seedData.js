/**
 * APSRTC SmartTrack Database Seeder
 * Populates corridor routes, stops, buses, trips, devices, and initial locations.
 * Fully supports all three primary Eastern Ghats & Coastal corridors:
 * 1. Araku – Paderu – Chintapalli – Anakapalle – Visakhapatnam (RTC-101)
 * 2. Paderu – Chodavaram – Pendurthi – Visakhapatnam (RTC-202)
 * 3. Paderu – Araku Valley – S. Kota – Pendurthi – Visakhapatnam (RTC-303)
 */

const fs = require('fs');
const path = require('path');
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = require(path.join(__dirname, '../../backend/node_modules/better-sqlite3'));
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../backend/apsrtc.db');
const SCHEMA_PATH = path.join(__dirname, '../schema/schema.sqlite.sql');

function runSeed() {
  console.log('🚍 Initializing APSRTC SmartTrack SQLite Database at:', DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 1. Run Schema
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);
  console.log('✅ Schema tables verified/created.');

  // Check if routes already exist
  const existingRoutes = db.prepare('SELECT count(*) as cnt FROM routes').get();
  if (existingRoutes.cnt > 0) {
    console.log(`ℹ️ Database already seeded with ${existingRoutes.cnt} routes. Ensuring all 3 corridors exist...`);
    ensureAdditionalCorridors(db);
    refreshDynamicData(db);
    db.close();
    console.log('✨ Seed complete.');
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, role, full_name, email, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertStaff = db.prepare(`
    INSERT INTO staff (employee_id, full_name, designation, depot, phone, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertBus = db.prepare(`
    INSERT INTO buses (bus_number, registration_number, depot, service_type, total_seats, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertRoute = db.prepare(`
    INSERT INTO routes (route_code, route_name, origin, destination, distance_km, estimated_minutes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStop = db.prepare(`
    INSERT INTO route_stops (route_id, stop_name, stop_code, stop_order, latitude, longitude, distance_from_origin_km, average_time_mins)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTrip = db.prepare(`
    INSERT INTO trips (trip_id, bus_id, route_id, driver_staff_id, conductor_staff_id, from_stop, to_stop, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHwDevice = db.prepare(`
    INSERT INTO gps_devices (device_id, bus_id, imei, firmware_version, status, last_heartbeat)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertCrewDevice = db.prepare(`
    INSERT INTO crew_devices (device_id, staff_id, bus_id, trip_id, app_version, status, last_heartbeat)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertEtm = db.prepare(`
    INSERT INTO etm_devices (etm_id, bus_id, trip_id, depot, status, last_heartbeat)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertCurrentLoc = db.prepare(`
    INSERT INTO current_bus_locations (
      bus_id, bus_number, active_source, device_id, trip_id, route_id,
      latitude, longitude, accuracy_meters, speed_kph, heading, altitude,
      location_name, from_stop, to_stop, status, confidence, last_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertComplaint = db.prepare(`
    INSERT INTO complaints (
      complaint_ref, bus_number, trip_id, category, description,
      passenger_name, passenger_phone, location, status, officer_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAlert = db.prepare(`
    INSERT INTO alerts (alert_type, bus_id, bus_number, trip_id, severity, message, is_resolved)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);

  const seedTransaction = db.transaction(() => {
    // 1. Users
    insertUser.run('passenger_demo', 'hash_pass_123', 'PASSENGER', 'Suresh Kumar', 'suresh@example.com', '9848022338');
    insertUser.run('driver_ramesh', 'hash_crew_123', 'CREW', 'K. Ramesh Babu', 'ramesh.crew@apsrtc.ap.gov.in', '9440156789');
    insertUser.run('officer_vizag', 'hash_admin_123', 'OFFICER', 'Depot Officer Visakhapatnam', 'officer.vskp@apsrtc.ap.gov.in', '9440100001');

    // 2. Staff
    insertStaff.run('EMP-4089', 'K. Ramesh Babu', 'DRIVER', 'Paderu', '9440156789', 'ACTIVE');
    insertStaff.run('EMP-4102', 'M. Venkateswarlu', 'DRIVER', 'Araku', '9440156790', 'ACTIVE');
    insertStaff.run('EMP-5011', 'T. Appa Rao', 'DRIVER', 'Visakhapatnam', '9440156791', 'ACTIVE');
    insertStaff.run('CON-1120', 'P. Satyanarayana', 'CONDUCTOR', 'Paderu', '9440156792', 'ACTIVE');
    insertStaff.run('CON-1145', 'B. Srinivasa Rao', 'CONDUCTOR', 'Araku', '9440156793', 'ACTIVE');

    // 3. Corridor Routes
    // Corridor 1: Araku -> Visakhapatnam via Chintapalli (Down)
    const r1 = insertRoute.run(
      'RTC-101-DN',
      'Araku - Visakhapatnam via Chintapalli Corridor (Down)',
      'Araku',
      'Visakhapatnam',
      178.5,
      300,
      1
    );
    const r1Id = r1.lastInsertRowid;

    // Corridor 1: Visakhapatnam -> Araku via Chintapalli (Up)
    const r2 = insertRoute.run(
      'RTC-101-UP',
      'Visakhapatnam - Araku via Chintapalli Corridor (Up)',
      'Visakhapatnam',
      'Araku',
      178.5,
      300,
      1
    );
    const r2Id = r2.lastInsertRowid;

    // Corridor 2: Paderu -> Chodavaram -> Pendurthi -> Visakhapatnam (Down)
    const r3 = insertRoute.run(
      'RTC-202-DN',
      'Paderu - Chodavaram - Pendurthi - Visakhapatnam Express (Down)',
      'Paderu',
      'Visakhapatnam',
      118.0,
      180,
      1
    );
    const r3Id = r3.lastInsertRowid;

    // Corridor 2: Visakhapatnam -> Pendurthi -> Chodavaram -> Paderu (Up)
    const r4 = insertRoute.run(
      'RTC-202-UP',
      'Visakhapatnam - Pendurthi - Chodavaram - Paderu Express (Up)',
      'Visakhapatnam',
      'Paderu',
      118.0,
      180,
      1
    );
    const r4Id = r4.lastInsertRowid;

    // Corridor 3: Paderu -> Araku -> S. Kota -> Pendurthi -> Visakhapatnam (Down)
    const r5 = insertRoute.run(
      'RTC-303-DN',
      'Paderu - Araku - S. Kota - Pendurthi - Visakhapatnam Express (Down)',
      'Paderu',
      'Visakhapatnam',
      162.0,
      260,
      1
    );
    const r5Id = r5.lastInsertRowid;

    // Corridor 3: Visakhapatnam -> Pendurthi -> S. Kota -> Araku -> Paderu (Up)
    const r6 = insertRoute.run(
      'RTC-303-UP',
      'Visakhapatnam - Pendurthi - S. Kota - Araku - Paderu Express (Up)',
      'Visakhapatnam',
      'Paderu',
      162.0,
      260,
      1
    );
    const r6Id = r6.lastInsertRowid;

    // 4. Stops along Route 1 (Down: Araku -> Chintapalli -> Visakhapatnam)
    const corridorStops101 = [
      { name: 'Araku', code: 'ARK', lat: 18.3273, lon: 82.8775, km: 0, mins: 0 },
      { name: 'Ananthagiri', code: 'ATG', lat: 18.2372, lon: 83.0117, km: 31.0, mins: 55 },
      { name: 'Paderu', code: 'PDR', lat: 18.0816, lon: 82.6700, km: 74.2, mins: 125 },
      { name: 'G. Madugula', code: 'GMD', lat: 17.9500, lon: 82.5167, km: 98.4, mins: 165 },
      { name: 'Chintapalli', code: 'CTP', lat: 17.8700, lon: 82.3500, km: 121.6, mins: 205 },
      { name: 'Anakapalle', code: 'AKP', lat: 17.6913, lon: 83.0039, km: 152.0, mins: 255 },
      { name: 'Visakhapatnam', code: 'VSKP', lat: 17.7215, lon: 83.3032, km: 178.5, mins: 300 }
    ];

    corridorStops101.forEach((stop, idx) => {
      insertStop.run(r1Id, stop.name, stop.code, idx + 1, stop.lat, stop.lon, stop.km, stop.mins);
    });

    const reverseStops101 = [...corridorStops101].reverse();
    reverseStops101.forEach((stop, idx) => {
      const distFromStart = Number((178.5 - stop.km).toFixed(1));
      const minsFromStart = 300 - stop.mins;
      insertStop.run(r2Id, stop.name, stop.code, idx + 1, stop.lat, stop.lon, distFromStart, minsFromStart);
    });

    // Stops along Route 2 (Down: Paderu -> Chodavaram -> Pendurthi -> Visakhapatnam)
    const corridorStops202 = [
      { name: 'Paderu', code: 'PDR', lat: 18.0816, lon: 82.6700, km: 0, mins: 0 },
      { name: 'Chodavaram', code: 'CDV', lat: 17.8288, lon: 82.9328, km: 68.5, mins: 105 },
      { name: 'Pendurthi', code: 'PDT', lat: 17.8239, lon: 83.2014, km: 98.2, mins: 150 },
      { name: 'Visakhapatnam', code: 'VSKP', lat: 17.7215, lon: 83.3032, km: 118.0, mins: 180 }
    ];

    corridorStops202.forEach((stop, idx) => {
      insertStop.run(r3Id, stop.name, stop.code, idx + 1, stop.lat, stop.lon, stop.km, stop.mins);
    });

    const reverseStops202 = [...corridorStops202].reverse();
    reverseStops202.forEach((stop, idx) => {
      const distFromStart = Number((118.0 - stop.km).toFixed(1));
      const minsFromStart = 180 - stop.mins;
      insertStop.run(r4Id, stop.name, stop.code, idx + 1, stop.lat, stop.lon, distFromStart, minsFromStart);
    });

    // Stops along Route 3 (Down: Paderu -> Araku -> S. Kota -> Pendurthi -> Visakhapatnam)
    const corridorStops303 = [
      { name: 'Paderu', code: 'PDR', lat: 18.0816, lon: 82.6700, km: 0, mins: 0 },
      { name: 'Araku', code: 'ARK', lat: 18.3273, lon: 82.8775, km: 44.0, mins: 70 },
      { name: 'Ananthagiri', code: 'ATG', lat: 18.2372, lon: 83.0117, km: 75.0, mins: 120 },
      { name: 'S. Kota', code: 'SKT', lat: 18.1150, lon: 83.1450, km: 106.0, mins: 170 },
      { name: 'Pendurthi', code: 'PDT', lat: 17.8239, lon: 83.2014, km: 142.0, mins: 225 },
      { name: 'Visakhapatnam', code: 'VSKP', lat: 17.7215, lon: 83.3032, km: 162.0, mins: 260 }
    ];

    corridorStops303.forEach((stop, idx) => {
      insertStop.run(r5Id, stop.name, stop.code, idx + 1, stop.lat, stop.lon, stop.km, stop.mins);
    });

    const reverseStops303 = [...corridorStops303].reverse();
    reverseStops303.forEach((stop, idx) => {
      const distFromStart = Number((162.0 - stop.km).toFixed(1));
      const minsFromStart = 260 - stop.mins;
      insertStop.run(r6Id, stop.name, stop.code, idx + 1, stop.lat, stop.lon, distFromStart, minsFromStart);
    });

    // 5. Buses
    const bus302 = insertBus.run('302', 'AP-39-Z-0302', 'Paderu', 'PALLE_VELUGU', 48, 'ACTIVE');
    const bus415 = insertBus.run('415', 'AP-39-Z-0415', 'Araku', 'EXPRESS', 45, 'ACTIVE');
    const bus518 = insertBus.run('518', 'AP-39-Z-0518', 'Chintapalli', 'ULTRA_DELUXE', 41, 'ACTIVE');
    const bus624 = insertBus.run('624', 'AP-39-Z-0624', 'Visakhapatnam', 'SUPER_LUXURY', 36, 'ACTIVE');
    const bus731 = insertBus.run('731', 'AP-39-Z-0731', 'Anakapalle', 'INDRA_AC', 38, 'ACTIVE');
    const bus842 = insertBus.run('842', 'AP-39-Z-0842', 'Araku', 'EXPRESS', 45, 'ACTIVE');
    const bus905 = insertBus.run('905', 'AP-39-Z-0905', 'Visakhapatnam', 'PALLE_VELUGU', 50, 'ACTIVE');
    const bus246 = insertBus.run('246', 'AP-39-Z-0246', 'Paderu', 'EXPRESS', 45, 'ACTIVE');
    const bus472 = insertBus.run('472', 'AP-39-Z-0472', 'Paderu', 'ULTRA_DELUXE', 41, 'ACTIVE');
    const bus580 = insertBus.run('580', 'AP-39-Z-0580', 'Visakhapatnam', 'SUPER_LUXURY', 38, 'ACTIVE');

    // 6. Registered Devices
    insertHwDevice.run('HW-TRK-518-01', bus518.lastInsertRowid, '864201045518012', 'v3.1.2', 'ACTIVE');
    insertHwDevice.run('HW-TRK-624-01', bus624.lastInsertRowid, '864201045624019', 'v3.1.2', 'ACTIVE');
    insertHwDevice.run('HW-TRK-842-01', bus842.lastInsertRowid, '864201045842014', 'v3.1.2', 'ACTIVE');
    insertHwDevice.run('HW-TRK-246-01', bus246.lastInsertRowid, '864201045246018', 'v3.1.2', 'ACTIVE');
    insertHwDevice.run('HW-TRK-472-01', bus472.lastInsertRowid, '864201045472015', 'v3.1.2', 'ACTIVE');

    insertCrewDevice.run('DRIVER-415-01', 1, bus415.lastInsertRowid, 'TRIP-2026-415', '1.2.0', 'ONLINE');
    insertCrewDevice.run('DRIVER-905-01', 2, bus905.lastInsertRowid, 'TRIP-2026-905', '1.2.0', 'ONLINE');

    insertEtm.run('ETM-VIZAG-731', bus731.lastInsertRowid, 'TRIP-2026-731', 'Visakhapatnam Central', 'ONLINE');
    insertEtm.run('ETM-VIZAG-580', bus580.lastInsertRowid, 'TRIP-2026-580', 'Pendurthi Depot', 'ONLINE');

    // 7. Active Trips
    // Bus 302: Paderu -> Visakhapatnam (Via Chodavaram & Pendurthi, Demo GPS)
    insertTrip.run('TRIP-2026-302', bus302.lastInsertRowid, r3Id, 1, 4, 'Paderu', 'Visakhapatnam', 'RUNNING');

    // Bus 246: Paderu -> Visakhapatnam (Via Chodavaram & Pendurthi, Hardware Tracker)
    insertTrip.run('TRIP-2026-246', bus246.lastInsertRowid, r3Id, 2, 5, 'Paderu', 'Visakhapatnam', 'RUNNING');

    // Bus 472: Paderu -> Visakhapatnam (Via Araku & S. Kota & Pendurthi, Hardware Tracker)
    insertTrip.run('TRIP-2026-472', bus472.lastInsertRowid, r5Id, 3, 4, 'Paderu', 'Visakhapatnam', 'RUNNING');

    // Bus 580: Visakhapatnam -> Paderu (Via Pendurthi & S. Kota & Araku, ETM)
    insertTrip.run('TRIP-2026-580', bus580.lastInsertRowid, r6Id, 1, 5, 'Visakhapatnam', 'Paderu', 'RUNNING');

    // Bus 415: Araku -> Visakhapatnam (Via Chintapalli, Crew Phone)
    insertTrip.run('TRIP-2026-415', bus415.lastInsertRowid, r1Id, 2, 5, 'Araku', 'Visakhapatnam', 'RUNNING');

    // Bus 518: Chintapalli -> Visakhapatnam (Hardware Tracker)
    insertTrip.run('TRIP-2026-518', bus518.lastInsertRowid, r1Id, 3, null, 'Chintapalli', 'Visakhapatnam', 'RUNNING');

    // Bus 624: Visakhapatnam -> Araku (Reverse route, Hardware Tracker)
    insertTrip.run('TRIP-2026-624', bus624.lastInsertRowid, r2Id, 1, null, 'Visakhapatnam', 'Araku', 'RUNNING');

    // Bus 731: G. Madugula -> Visakhapatnam (ETM GPS)
    insertTrip.run('TRIP-2026-731', bus731.lastInsertRowid, r1Id, 2, 4, 'G. Madugula', 'Visakhapatnam', 'RUNNING');

    // Bus 842: Araku -> Paderu (Short sector, Hardware Tracker)
    insertTrip.run('TRIP-2026-842', bus842.lastInsertRowid, r1Id, 3, 5, 'Araku', 'Paderu', 'RUNNING');

    // Bus 905: Visakhapatnam -> Paderu (Reverse sector via Chodavaram, Crew Phone)
    insertTrip.run('TRIP-2026-905', bus905.lastInsertRowid, r4Id, 2, 4, 'Visakhapatnam', 'Paderu', 'RUNNING');

    // 8. Initial Current Bus Locations
    // Bus 302: At Paderu (DEMO)
    insertCurrentLoc.run(
      bus302.lastInsertRowid,
      '302',
      'DEMO',
      'DEMO-SIM-302',
      'TRIP-2026-302',
      r3Id,
      18.0816,
      82.6700,
      15.0,
      42.0,
      120.0,
      850.0,
      'Paderu Bus Station',
      'Paderu',
      'Visakhapatnam',
      'LIVE',
      'GOOD'
    );

    // Bus 246: Near Chodavaram Stand (HARDWARE_TRACKER)
    insertCurrentLoc.run(
      bus246.lastInsertRowid,
      '246',
      'HARDWARE_TRACKER',
      'HW-TRK-246-01',
      'TRIP-2026-246',
      r3Id,
      17.8288,
      82.9328,
      7.0,
      46.0,
      110.0,
      120.0,
      'Chodavaram RTC Bus Stand',
      'Paderu',
      'Visakhapatnam',
      'LIVE',
      'HIGH'
    );

    // Bus 472: Near S. Kota RTC Stand (HARDWARE_TRACKER)
    insertCurrentLoc.run(
      bus472.lastInsertRowid,
      '472',
      'HARDWARE_TRACKER',
      'HW-TRK-472-01',
      'TRIP-2026-472',
      r5Id,
      18.1150,
      83.1450,
      8.0,
      44.0,
      135.0,
      95.0,
      'Srungavarapukota (S. Kota) RTC Stand',
      'Paderu',
      'Visakhapatnam',
      'LIVE',
      'HIGH'
    );

    // Bus 580: Approaching Pendurthi Junction (ETM)
    insertCurrentLoc.run(
      bus580.lastInsertRowid,
      '580',
      'ETM',
      'ETM-VIZAG-580',
      'TRIP-2026-580',
      r6Id,
      17.8239,
      83.2014,
      14.0,
      38.0,
      315.0,
      40.0,
      'Pendurthi RTC Junction',
      'Visakhapatnam',
      'Paderu',
      'LIVE',
      'GOOD'
    );

    // Bus 415: At G. Madugula (CREW_PHONE)
    insertCurrentLoc.run(
      bus415.lastInsertRowid,
      '415',
      'CREW_PHONE',
      'DRIVER-415-01',
      'TRIP-2026-415',
      r1Id,
      17.9500,
      82.5167,
      12.0,
      41.0,
      105.0,
      720.0,
      'G. Madugula Main Junction',
      'Araku',
      'Visakhapatnam',
      'LIVE',
      'HIGH'
    );

    // Bus 518: At Chintapalli (HARDWARE_TRACKER)
    insertCurrentLoc.run(
      bus518.lastInsertRowid,
      '518',
      'HARDWARE_TRACKER',
      'HW-TRK-518-01',
      'TRIP-2026-518',
      r1Id,
      17.8700,
      82.3500,
      6.0,
      48.0,
      95.0,
      640.0,
      'Chintapalli RTC Bus Complex',
      'Chintapalli',
      'Visakhapatnam',
      'LIVE',
      'HIGH'
    );

    // Bus 624: Near Anakapalle (HARDWARE_TRACKER - Up route)
    insertCurrentLoc.run(
      bus624.lastInsertRowid,
      '624',
      'HARDWARE_TRACKER',
      'HW-TRK-624-01',
      'TRIP-2026-624',
      r2Id,
      17.6913,
      83.0039,
      8.0,
      52.0,
      310.0,
      30.0,
      'Near Anakapalle Bypass',
      'Visakhapatnam',
      'Araku',
      'LIVE',
      'HIGH'
    );

    // Bus 731: Between Paderu & G. Madugula (ETM GPS source)
    insertCurrentLoc.run(
      bus731.lastInsertRowid,
      '731',
      'ETM',
      'ETM-VIZAG-731',
      'TRIP-2026-731',
      r1Id,
      18.0100,
      82.5900,
      18.0,
      38.0,
      115.0,
      790.0,
      'Near G. Madugula (Ghat Section)',
      'G. Madugula',
      'Visakhapatnam',
      'RECENT',
      'GOOD'
    );

    // Bus 842: Near Ananthagiri (HARDWARE_TRACKER)
    insertCurrentLoc.run(
      bus842.lastInsertRowid,
      '842',
      'HARDWARE_TRACKER',
      'HW-TRK-842-01',
      'TRIP-2026-842',
      r1Id,
      18.2372,
      83.0117,
      7.0,
      36.0,
      140.0,
      910.0,
      'Ananthagiri Viewpoint',
      'Araku',
      'Paderu',
      'LIVE',
      'HIGH'
    );

    // Bus 905: Visakhapatnam RTC Complex (CREW_PHONE - Up route)
    insertCurrentLoc.run(
      bus905.lastInsertRowid,
      '905',
      'CREW_PHONE',
      'DRIVER-905-01',
      'TRIP-2026-905',
      r4Id,
      17.7215,
      83.3032,
      10.0,
      0.0,
      270.0,
      15.0,
      'Visakhapatnam Dwaraka RTC Complex',
      'Visakhapatnam',
      'Paderu',
      'LIVE',
      'HIGH'
    );

    // 9. Initial Complaints
    insertComplaint.run(
      'APSRTC-G-2026-1049',
      '415',
      'TRIP-2026-415',
      'Delay',
      'Bus experienced 20 min ghat section fog delay near Ananthagiri.',
      'R. Venkat',
      '9848123456',
      'Ananthagiri',
      'ACKNOWLEDGED',
      'Depot controller notified driver of road clearance.'
    );

    insertComplaint.run(
      'APSRTC-G-2026-1052',
      '302',
      'TRIP-2026-302',
      'Overcrowding',
      'Morning peak rush observed at Paderu stand; request extra service.',
      'S. Lakshmi',
      '9440987654',
      'Paderu',
      'NEW',
      null
    );

    // 10. Operational Alert
    insertAlert.run(
      'STALE_GPS',
      bus731.lastInsertRowid,
      '731',
      'TRIP-2026-731',
      'LOW',
      'Bus 731 ETM location freshness is RECENT (approaching 45s heartbeat window).'
    );
  });

  seedTransaction();
  console.log('✅ Successfully seeded all 3 corridor routes, stops, buses, devices, locations, and complaints!');
}

/**
 * Ensure Corridors 2 (Chodavaram) and 3 (S. Kota) exist in already-seeded databases
 */
function ensureAdditionalCorridors(db) {
  const checkR202 = db.prepare("SELECT id FROM routes WHERE route_code = 'RTC-202-DN'").get();
  if (!checkR202) {
    console.log('🚀 Adding Corridor 2 (Paderu - Chodavaram - Pendurthi - Visakhapatnam)...');
    const insertRoute = db.prepare(`
      INSERT INTO routes (route_code, route_name, origin, destination, distance_km, estimated_minutes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStop = db.prepare(`
      INSERT INTO route_stops (route_id, stop_name, stop_code, stop_order, latitude, longitude, distance_from_origin_km, average_time_mins)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const r3 = insertRoute.run('RTC-202-DN', 'Paderu - Chodavaram - Pendurthi - Visakhapatnam Express (Down)', 'Paderu', 'Visakhapatnam', 118.0, 180, 1);
    const r4 = insertRoute.run('RTC-202-UP', 'Visakhapatnam - Pendurthi - Chodavaram - Paderu Express (Up)', 'Visakhapatnam', 'Paderu', 118.0, 180, 1);

    const stops202 = [
      { name: 'Paderu', code: 'PDR', lat: 18.0816, lon: 82.6700, km: 0, mins: 0 },
      { name: 'Chodavaram', code: 'CDV', lat: 17.8288, lon: 82.9328, km: 68.5, mins: 105 },
      { name: 'Pendurthi', code: 'PDT', lat: 17.8239, lon: 83.2014, km: 98.2, mins: 150 },
      { name: 'Visakhapatnam', code: 'VSKP', lat: 17.7215, lon: 83.3032, km: 118.0, mins: 180 }
    ];
    stops202.forEach((s, i) => insertStop.run(r3.lastInsertRowid, s.name, s.code, i + 1, s.lat, s.lon, s.km, s.mins));
    [...stops202].reverse().forEach((s, i) => {
      insertStop.run(r4.lastInsertRowid, s.name, s.code, i + 1, s.lat, s.lon, Number((118.0 - s.km).toFixed(1)), 180 - s.mins);
    });
  }

  const checkR303 = db.prepare("SELECT id FROM routes WHERE route_code = 'RTC-303-DN'").get();
  if (!checkR303) {
    console.log('🚀 Adding Corridor 3 (Paderu - Araku - S. Kota - Pendurthi - Visakhapatnam)...');
    const insertRoute = db.prepare(`
      INSERT INTO routes (route_code, route_name, origin, destination, distance_km, estimated_minutes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStop = db.prepare(`
      INSERT INTO route_stops (route_id, stop_name, stop_code, stop_order, latitude, longitude, distance_from_origin_km, average_time_mins)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const r5 = insertRoute.run('RTC-303-DN', 'Paderu - Araku - S. Kota - Pendurthi - Visakhapatnam Express (Down)', 'Paderu', 'Visakhapatnam', 162.0, 260, 1);
    const r6 = insertRoute.run('RTC-303-UP', 'Visakhapatnam - Pendurthi - S. Kota - Araku - Paderu Express (Up)', 'Visakhapatnam', 'Paderu', 162.0, 260, 1);

    const stops303 = [
      { name: 'Paderu', code: 'PDR', lat: 18.0816, lon: 82.6700, km: 0, mins: 0 },
      { name: 'Araku', code: 'ARK', lat: 18.3273, lon: 82.8775, km: 44.0, mins: 70 },
      { name: 'Ananthagiri', code: 'ATG', lat: 18.2372, lon: 83.0117, km: 75.0, mins: 120 },
      { name: 'S. Kota', code: 'SKT', lat: 18.1150, lon: 83.1450, km: 106.0, mins: 170 },
      { name: 'Pendurthi', code: 'PDT', lat: 17.8239, lon: 83.2014, km: 142.0, mins: 225 },
      { name: 'Visakhapatnam', code: 'VSKP', lat: 17.7215, lon: 83.3032, km: 162.0, mins: 260 }
    ];
    stops303.forEach((s, i) => insertStop.run(r5.lastInsertRowid, s.name, s.code, i + 1, s.lat, s.lon, s.km, s.mins));
    [...stops303].reverse().forEach((s, i) => {
      insertStop.run(r6.lastInsertRowid, s.name, s.code, i + 1, s.lat, s.lon, Number((162.0 - s.km).toFixed(1)), 260 - s.mins);
    });
  }

  // Ensure additional buses 246, 472, 580 exist
  const insertBus = db.prepare(`
    INSERT OR IGNORE INTO buses (bus_number, registration_number, depot, service_type, total_seats, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertBus.run('246', 'AP-39-Z-0246', 'Paderu', 'EXPRESS', 45, 'ACTIVE');
  insertBus.run('472', 'AP-39-Z-0472', 'Paderu', 'ULTRA_DELUXE', 41, 'ACTIVE');
  insertBus.run('580', 'AP-39-Z-0580', 'Visakhapatnam', 'SUPER_LUXURY', 38, 'ACTIVE');

  // Ensure trips and current locations exist for these buses
  const r202 = db.prepare("SELECT id FROM routes WHERE route_code = 'RTC-202-DN'").get();
  const r303 = db.prepare("SELECT id FROM routes WHERE route_code = 'RTC-303-DN'").get();
  const r303Up = db.prepare("SELECT id FROM routes WHERE route_code = 'RTC-303-UP'").get();

  const b302 = db.prepare("SELECT id FROM buses WHERE bus_number = '302'").get();
  const b246 = db.prepare("SELECT id FROM buses WHERE bus_number = '246'").get();
  const b472 = db.prepare("SELECT id FROM buses WHERE bus_number = '472'").get();
  const b580 = db.prepare("SELECT id FROM buses WHERE bus_number = '580'").get();

  if (r202 && b302) {
    db.prepare(`
      INSERT OR REPLACE INTO trips (trip_id, bus_id, route_id, driver_staff_id, conductor_staff_id, from_stop, to_stop, status)
      VALUES ('TRIP-2026-302', ?, ?, 1, 4, 'Paderu', 'Visakhapatnam', 'RUNNING')
    `).run(b302.id, r202.id);
  }

  if (r202 && b246) {
    db.prepare(`
      INSERT OR REPLACE INTO trips (trip_id, bus_id, route_id, driver_staff_id, conductor_staff_id, from_stop, to_stop, status)
      VALUES ('TRIP-2026-246', ?, ?, 2, 5, 'Paderu', 'Visakhapatnam', 'RUNNING')
    `).run(b246.id, r202.id);

    db.prepare(`
      INSERT OR REPLACE INTO current_bus_locations (
        bus_id, bus_number, active_source, device_id, trip_id, route_id,
        latitude, longitude, accuracy_meters, speed_kph, heading, altitude,
        location_name, from_stop, to_stop, status, confidence, last_updated_at
      ) VALUES (?, '246', 'HARDWARE_TRACKER', 'HW-TRK-246-01', 'TRIP-2026-246', ?, 17.8288, 82.9328, 7.0, 46.0, 110.0, 120.0, 'Chodavaram RTC Bus Stand', 'Paderu', 'Visakhapatnam', 'LIVE', 'HIGH', datetime('now'))
    `).run(b246.id, r202.id);
  }

  if (r303 && b472) {
    db.prepare(`
      INSERT OR REPLACE INTO trips (trip_id, bus_id, route_id, driver_staff_id, conductor_staff_id, from_stop, to_stop, status)
      VALUES ('TRIP-2026-472', ?, ?, 3, 4, 'Paderu', 'Visakhapatnam', 'RUNNING')
    `).run(b472.id, r303.id);

    db.prepare(`
      INSERT OR REPLACE INTO current_bus_locations (
        bus_id, bus_number, active_source, device_id, trip_id, route_id,
        latitude, longitude, accuracy_meters, speed_kph, heading, altitude,
        location_name, from_stop, to_stop, status, confidence, last_updated_at
      ) VALUES (?, '472', 'HARDWARE_TRACKER', 'HW-TRK-472-01', 'TRIP-2026-472', ?, 18.1150, 83.1450, 8.0, 44.0, 135.0, 95.0, 'Srungavarapukota (S. Kota) RTC Stand', 'Paderu', 'Visakhapatnam', 'LIVE', 'HIGH', datetime('now'))
    `).run(b472.id, r303.id);
  }

  if (r303Up && b580) {
    db.prepare(`
      INSERT OR REPLACE INTO trips (trip_id, bus_id, route_id, driver_staff_id, conductor_staff_id, from_stop, to_stop, status)
      VALUES ('TRIP-2026-580', ?, ?, 1, 5, 'Visakhapatnam', 'Paderu', 'RUNNING')
    `).run(b580.id, r303Up.id);

    db.prepare(`
      INSERT OR REPLACE INTO current_bus_locations (
        bus_id, bus_number, active_source, device_id, trip_id, route_id,
        latitude, longitude, accuracy_meters, speed_kph, heading, altitude,
        location_name, from_stop, to_stop, status, confidence, last_updated_at
      ) VALUES (?, '580', 'ETM', 'ETM-VIZAG-580', 'TRIP-2026-580', ?, 17.8239, 83.2014, 14.0, 38.0, 315.0, 40.0, 'Pendurthi RTC Junction', 'Visakhapatnam', 'Paderu', 'LIVE', 'GOOD', datetime('now'))
    `).run(b580.id, r303Up.id);
  }
}

function refreshDynamicData(db) {
  // Update last_updated_at to current timestamp so seed data isn't stale on fresh start
  db.prepare(`UPDATE current_bus_locations SET last_updated_at = datetime('now')`).run();
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed, DB_PATH };
