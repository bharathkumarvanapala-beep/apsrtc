/**
 * APSRTC SmartTrack Multi-Bus GPS Telemetry Simulator
 * Simulates real-time GPS coordinate movement along Eastern Ghats corridors.
 * Demonstrates Hardware Trackers, Crew Mobile GPS, ETMs, and Demo Simulator pings.
 * 
 * IMPORTANT: All data generated is explicitly flagged with source identifiers
 * and is intended for demonstration and integration prototyping.
 */

const http = require('http');

const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.PORT || 5000;
const TICK_INTERVAL_MS = parseInt(process.env.SIMULATOR_TICK_MS || '3000', 10);

// 1. Chintapalli Corridor Waypoints (Araku to Visakhapatnam via Chintapalli)
const CHINTAPALLI_WAYPOINTS = [
  { name: 'Araku Valley Bus Stand', lat: 18.3273, lon: 82.8775 },
  { name: 'Araku Valley Viewpoint', lat: 18.2820, lon: 82.9450 },
  { name: 'Ananthagiri Hills Coffee Plantations', lat: 18.2372, lon: 83.0117 },
  { name: 'Tyda Ghat Section Curve', lat: 18.1500, lon: 82.8500 },
  { name: 'Paderu RTC Depot Junction', lat: 18.0816, lon: 82.6700 },
  { name: 'Paderu Ghat South Pass', lat: 18.0100, lon: 82.5900 },
  { name: 'G. Madugula Town Center', lat: 17.9500, lon: 82.5167 },
  { name: 'Vanjangi Forest Ridge', lat: 17.9100, lon: 82.4300 },
  { name: 'Chintapalli RTC Bus Complex', lat: 17.8700, lon: 82.3500 },
  { name: 'Narsipatnam Road Junction', lat: 17.7800, lon: 82.6800 },
  { name: 'Anakapalle Bypass RTC Stand', lat: 17.6913, lon: 83.0039 },
  { name: 'Lankelapalem NH-16 Toll Plaza', lat: 17.6950, lon: 83.1200 },
  { name: 'Gajuwaka Industrial Hub', lat: 17.6890, lon: 83.2100 },
  { name: 'NAD Kotha Road Flyover', lat: 17.7380, lon: 83.2450 },
  { name: 'Visakhapatnam Dwaraka RTC Complex', lat: 17.7215, lon: 83.3032 }
];

const CHINTAPALLI_UP_WAYPOINTS = [...CHINTAPALLI_WAYPOINTS].reverse();

// 2. Chodavaram Corridor Waypoints (Paderu to Visakhapatnam via Chodavaram & Pendurthi - Direct SH-39)
const CHODAVARAM_WAYPOINTS = [
  { name: 'Paderu RTC Depot Junction', lat: 18.0816, lon: 82.6700 },
  { name: 'Minumuluru Ghat Viewpoint', lat: 18.0350, lon: 82.7450 },
  { name: 'Vaddadi Ghat Junction', lat: 17.8400, lon: 82.9000 },
  { name: 'Chodavaram RTC Bus Stand', lat: 17.8288, lon: 82.9328 },
  { name: 'Sabbavaram Junction', lat: 17.7850, lon: 83.1300 },
  { name: 'Pendurthi RTC Bus Stop', lat: 17.8239, lon: 83.2014 },
  { name: 'NAD Kotha Road Flyover', lat: 17.7380, lon: 83.2450 },
  { name: 'Visakhapatnam Dwaraka RTC Complex', lat: 17.7215, lon: 83.3032 }
];

const CHODAVARAM_UP_WAYPOINTS = [...CHODAVARAM_WAYPOINTS].reverse();

// 3. S. Kota Corridor Waypoints (Paderu to Visakhapatnam via Araku Valley, S. Kota & Pendurthi)
const SKOTA_WAYPOINTS = [
  { name: 'Paderu RTC Depot Junction', lat: 18.0816, lon: 82.6700 },
  { name: 'Dumbriguda Agency Valley', lat: 18.2300, lon: 82.7600 },
  { name: 'Araku Valley Bus Stand', lat: 18.3273, lon: 82.8775 },
  { name: 'Ananthagiri Coffee Estates', lat: 18.2372, lon: 83.0117 },
  { name: 'Tyda Eastern Ghat Pass', lat: 18.1500, lon: 83.0500 },
  { name: 'Srungavarapukota (S. Kota) RTC Stand', lat: 18.1150, lon: 83.1450 },
  { name: 'Kothavalasa Railway Junction', lat: 17.8967, lon: 83.1900 },
  { name: 'Pendurthi RTC Bus Stop', lat: 17.8239, lon: 83.2014 },
  { name: 'NAD Kotha Road Flyover', lat: 17.7380, lon: 83.2450 },
  { name: 'Visakhapatnam Dwaraka RTC Complex', lat: 17.7215, lon: 83.3032 }
];

const SKOTA_UP_WAYPOINTS = [...SKOTA_WAYPOINTS].reverse();

// Backwards compatibility alias
const DOWN_WAYPOINTS = CHINTAPALLI_WAYPOINTS;
const UP_WAYPOINTS = CHINTAPALLI_UP_WAYPOINTS;

// Simulated Fleet Configuration across all 3 Corridors
const simulatedBuses = [
  {
    busNumber: '302',
    source: 'DEMO',
    endpoint: 'demo',
    deviceId: 'DEMO-SIM-302',
    waypoints: CHODAVARAM_WAYPOINTS,
    currentIdx: 0, // Starts at Paderu (via Chodavaram & Pendurthi)
    progress: 0.1,
    speedKph: 42,
    accuracyMeters: 14,
    heading: 120,
    altitude: 850
  },
  {
    busNumber: '246',
    source: 'HARDWARE_TRACKER',
    endpoint: 'device',
    deviceId: 'HW-TRK-246-01',
    waypoints: CHODAVARAM_WAYPOINTS,
    currentIdx: 3, // At Chodavaram (via Pendurthi to Vizag)
    progress: 0.25,
    speedKph: 46,
    accuracyMeters: 7,
    heading: 110,
    altitude: 120
  },
  {
    busNumber: '472',
    source: 'HARDWARE_TRACKER',
    endpoint: 'device',
    deviceId: 'HW-TRK-472-01',
    waypoints: SKOTA_WAYPOINTS,
    currentIdx: 5, // Near S. Kota (via Pendurthi to Vizag)
    progress: 0.2,
    speedKph: 45,
    accuracyMeters: 8,
    heading: 135,
    altitude: 95
  },
  {
    busNumber: '580',
    source: 'ETM',
    endpoint: 'etm',
    deviceId: 'ETM-VIZAG-580',
    waypoints: SKOTA_UP_WAYPOINTS,
    currentIdx: 2, // Near Pendurthi heading Up to S. Kota & Paderu
    progress: 0.15,
    speedKph: 40,
    accuracyMeters: 12,
    heading: 315,
    altitude: 40
  },
  {
    busNumber: '415',
    source: 'CREW_PHONE',
    endpoint: 'crew',
    deviceId: 'DRIVER-415-01',
    waypoints: CHINTAPALLI_WAYPOINTS,
    currentIdx: 6, // Starts at G. Madugula (via Chintapalli)
    progress: 0.2,
    speedKph: 44,
    accuracyMeters: 9,
    heading: 110,
    altitude: 720
  },
  {
    busNumber: '518',
    source: 'HARDWARE_TRACKER',
    endpoint: 'device',
    deviceId: 'HW-TRK-518-01',
    waypoints: CHINTAPALLI_WAYPOINTS,
    currentIdx: 8, // Starts at Chintapalli
    progress: 0.0,
    speedKph: 48,
    accuracyMeters: 6,
    heading: 95,
    altitude: 640
  },
  {
    busNumber: '624',
    source: 'HARDWARE_TRACKER',
    endpoint: 'device',
    deviceId: 'HW-TRK-624-01',
    waypoints: CHINTAPALLI_UP_WAYPOINTS,
    currentIdx: 3, // Near Anakapalle heading UP via Chintapalli
    progress: 0.4,
    speedKph: 52,
    accuracyMeters: 7,
    heading: 305,
    altitude: 45
  },
  {
    busNumber: '731',
    source: 'ETM',
    endpoint: 'etm',
    deviceId: 'ETM-VIZAG-731',
    waypoints: CHINTAPALLI_WAYPOINTS,
    currentIdx: 5, // Between Paderu and G. Madugula
    progress: 0.6,
    speedKph: 39,
    accuracyMeters: 18,
    heading: 125,
    altitude: 780
  },
  {
    busNumber: '842',
    source: 'HARDWARE_TRACKER',
    endpoint: 'device',
    deviceId: 'HW-TRK-842-01',
    waypoints: CHINTAPALLI_WAYPOINTS,
    currentIdx: 1, // Near Ananthagiri
    progress: 0.3,
    speedKph: 35,
    accuracyMeters: 8,
    heading: 135,
    altitude: 900
  },
  {
    busNumber: '905',
    source: 'CREW_PHONE',
    endpoint: 'crew',
    deviceId: 'DRIVER-905-01',
    waypoints: CHODAVARAM_UP_WAYPOINTS,
    currentIdx: 0, // Visakhapatnam RTC complex departing UP via Chodavaram
    progress: 0.05,
    speedKph: 25,
    accuracyMeters: 11,
    heading: 275,
    altitude: 15
  }
];

// Linear interpolation between 2 GPS coordinates
function interpolate(p1, p2, factor) {
  return {
    lat: Number((p1.lat + (p2.lat - p1.lat) * factor).toFixed(6)),
    lon: Number((p1.lon + (p2.lon - p1.lon) * factor).toFixed(6))
  };
}

// Send GPS payload to backend via HTTP
function sendGpsTelemetry(bus, coords) {
  const payload = JSON.stringify({
    busNumber: bus.busNumber,
    deviceId: bus.deviceId,
    latitude: coords.lat,
    longitude: coords.lon,
    accuracyMeters: bus.accuracyMeters,
    speedKph: bus.speedKph,
    heading: bus.heading,
    altitude: bus.altitude,
    timestamp: new Date().toISOString()
  });

  const options = {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: `/api/v1/tracking/${bus.endpoint}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    // Consume response
    res.resume();
  });

  req.on('error', (err) => {
    // Silent fail if server is not yet up
  });

  req.write(payload);
  req.end();
}

function tick() {
  const timestamp = new Date().toLocaleTimeString();

  simulatedBuses.forEach((bus) => {
    const waypoints = bus.waypoints;
    const currentWp = waypoints[bus.currentIdx];
    const nextIdx = (bus.currentIdx + 1) % waypoints.length;
    const nextWp = waypoints[nextIdx];

    // Advance progress along current segment
    // Step proportional to speed
    const step = 0.05 + (Math.random() * 0.03);
    bus.progress += step;

    if (bus.progress >= 1.0) {
      bus.progress = 0.0;
      bus.currentIdx = nextIdx;
    }

    const coords = interpolate(currentWp, nextWp, bus.progress);

    // Slight realistic jitter in speed
    bus.speedKph = Math.max(15, Math.min(65, Math.round(bus.speedKph + (Math.random() * 6 - 3))));

    sendGpsTelemetry(bus, coords);
  });
}

function startSimulator() {
  console.log('===============================================================');
  console.log('  APSRTC SmartTrack Multi-Bus Telemetry Simulator Active');
  console.log(`  Target Backend: http://${SERVER_HOST}:${SERVER_PORT}`);
  console.log(`  Telemetry Tick Rate: every ${TICK_INTERVAL_MS / 1000}s`);
  console.log('  Simulating: 7 Fleet Buses across Eastern Ghats Corridor');
  console.log('  Sources: HARDWARE_TRACKER, CREW_PHONE, ETM, DEMO');
  console.log('===============================================================');

  // Initial immediate tick
  tick();

  const intervalId = setInterval(tick, TICK_INTERVAL_MS);

  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('\nSimulator stopped.');
    process.exit(0);
  });

  return intervalId;
}

if (require.main === module) {
  startSimulator();
}

module.exports = {
  startSimulator,
  simulatedBuses,
  tick
};
