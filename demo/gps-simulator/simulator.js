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

// Key Route Waypoints (Araku to Visakhapatnam Ghat Corridor)
const DOWN_WAYPOINTS = [
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

const UP_WAYPOINTS = [...DOWN_WAYPOINTS].reverse();

// Simulated Fleet Configuration
const simulatedBuses = [
  {
    busNumber: '302',
    source: 'DEMO',
    endpoint: 'demo',
    deviceId: 'DEMO-SIM-302',
    waypoints: DOWN_WAYPOINTS,
    currentIdx: 4, // Starts at Paderu
    progress: 0.1,
    speedKph: 42,
    accuracyMeters: 14,
    heading: 120,
    altitude: 850
  },
  {
    busNumber: '415',
    source: 'CREW_PHONE',
    endpoint: 'crew',
    deviceId: 'DRIVER-415-01',
    waypoints: DOWN_WAYPOINTS,
    currentIdx: 6, // Starts at G. Madugula
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
    waypoints: DOWN_WAYPOINTS,
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
    waypoints: UP_WAYPOINTS,
    currentIdx: 3, // Starts near Anakapalle heading UP
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
    waypoints: DOWN_WAYPOINTS,
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
    waypoints: DOWN_WAYPOINTS,
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
    waypoints: UP_WAYPOINTS,
    currentIdx: 0, // Visakhapatnam RTC complex departing UP
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
