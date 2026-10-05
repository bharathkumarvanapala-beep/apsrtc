/**
 * APSRTC SmartTrack Crew Mobile Portal
 * Enables Drivers and Conductors to start trips, transmit live device GPS, and trigger SOS.
 */

let activeTrip = null;
let geolocationWatchId = null;
let isGpsActive = false;
let pingsCount = 0;
let simulatedStepIndex = 0;

// Corridor waypoints for crew manual simulation step
const CREW_SIM_WAYPOINTS = [
  { name: 'Paderu RTC Complex', lat: 18.0816, lon: 82.6700, spd: 25 },
  { name: 'Paderu Ghat South Pass', lat: 18.0100, lon: 82.5900, spd: 38 },
  { name: 'G. Madugula Town Center', lat: 17.9500, lon: 82.5167, spd: 41 },
  { name: 'Vanjangi Forest Ghat', lat: 17.9100, lon: 82.4300, spd: 35 },
  { name: 'Chintapalli RTC Stand', lat: 17.8700, lon: 82.3500, spd: 45 },
  { name: 'Anakapalle Bypass', lat: 17.6913, lon: 83.0039, spd: 55 },
  { name: 'Visakhapatnam Complex', lat: 17.7215, lon: 83.3032, spd: 15 }
];

function initCrew() {
  setupCrewEvents();
}

function setupCrewEvents() {
  const startTripBtn = document.getElementById('crewStartTripBtn');
  if (startTripBtn) {
    startTripBtn.addEventListener('click', handleStartTrip);
  }

  const endTripBtn = document.getElementById('crewEndTripBtn');
  if (endTripBtn) {
    endTripBtn.addEventListener('click', handleEndTrip);
  }

  const gpsToggleBtn = document.getElementById('crewGpsToggleBtn');
  if (gpsToggleBtn) {
    gpsToggleBtn.addEventListener('click', toggleGpsSharing);
  }

  const stepPingBtn = document.getElementById('crewStepPingBtn');
  if (stepPingBtn) {
    stepPingBtn.addEventListener('click', sendSimulatedCrewPing);
  }

  const sosBtn = document.getElementById('crewSosBtn');
  if (sosBtn) {
    sosBtn.addEventListener('click', triggerCrewSos);
  }
}

async function handleStartTrip() {
  const busNumber = document.getElementById('crewBusSelect').value;
  const employeeId = document.getElementById('crewStaffSelect').value;
  const fromStop = document.getElementById('crewFromSelect').value;
  const toStop = document.getElementById('crewToSelect').value;

  if (!busNumber || !fromStop || !toStop) {
    alert('Please select Bus Number, Departure, and Destination stops.');
    return;
  }

  try {
    const res = await api.startTrip({
      busNumber,
      employeeId,
      fromStop,
      toStop
    });

    activeTrip = res.trip;
    updateCrewUiState(true);
    logCrewTelemetry(`Trip started: ${activeTrip.tripId} for Bus ${busNumber}`);
    alert(`✅ Trip Initialized!\nTrip ID: ${activeTrip.tripId}\nRoute: ${fromStop} ➔ ${toStop}`);
  } catch (err) {
    alert(`Failed to start trip: ${err.message}`);
  }
}

async function handleEndTrip() {
  if (!activeTrip) return;
  if (!confirm(`Are you sure you want to end Trip ${activeTrip.tripId}?`)) return;

  try {
    await api.endTrip(activeTrip.tripId);
    stopGpsSharing();
    logCrewTelemetry(`Trip ${activeTrip.tripId} ended.`);
    activeTrip = null;
    updateCrewUiState(false);
    alert('Trip ended successfully.');
  } catch (err) {
    alert(`Failed to end trip: ${err.message}`);
  }
}

function toggleGpsSharing() {
  if (isGpsActive) {
    stopGpsSharing();
  } else {
    startGpsSharing();
  }
}

function startGpsSharing() {
  if (!activeTrip) {
    alert('Please start a trip first before enabling GPS sharing.');
    return;
  }

  isGpsActive = true;
  const toggleBtn = document.getElementById('crewGpsToggleBtn');
  if (toggleBtn) {
    toggleBtn.innerHTML = '🛑 Stop GPS Sharing';
    toggleBtn.style.background = '#c62828';
  }

  logCrewTelemetry('Acquiring device GPS signal via HTML5 Geolocation API...');

  if ('geolocation' in navigator) {
    geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        handleDevicePosition(position.coords);
      },
      (error) => {
        logCrewTelemetry(`⚠️ Browser GPS Warning: ${error.message}. You can also use the Step Simulator button below.`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      }
    );
  } else {
    logCrewTelemetry('HTML5 Geolocation not supported by this browser. Use manual Step button.');
  }
}

function stopGpsSharing() {
  isGpsActive = false;
  if (geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }
  const toggleBtn = document.getElementById('crewGpsToggleBtn');
  if (toggleBtn) {
    toggleBtn.innerHTML = '📡 Start Phone GPS';
    toggleBtn.style.background = '#00695c';
  }
  logCrewTelemetry('GPS sharing stopped.');
}

async function handleDevicePosition(coords) {
  if (!activeTrip) return;

  const payload = {
    busNumber: activeTrip.busNumber,
    deviceId: `CREW-${activeTrip.busNumber}-PHONE`,
    tripId: activeTrip.tripId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyMeters: Math.round(coords.accuracy || 12),
    speedKph: Math.round((coords.speed || 0) * 3.6), // m/s to km/h
    heading: Math.round(coords.heading || 0),
    altitude: Math.round(coords.altitude || 0)
  };

  try {
    await api.sendGpsUpdate('crew', payload);
    pingsCount++;
    logCrewTelemetry(`Ping #${pingsCount} sent: [${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}] Speed: ${payload.speedKph} km/h Accuracy: ±${payload.accuracyMeters}m`);
  } catch (err) {
    logCrewTelemetry(`Transmission Error: ${err.message}`);
  }
}

async function sendSimulatedCrewPing() {
  if (!activeTrip) {
    alert('Please start a trip first.');
    return;
  }

  const wp = CREW_SIM_WAYPOINTS[simulatedStepIndex % CREW_SIM_WAYPOINTS.length];
  simulatedStepIndex++;

  const payload = {
    busNumber: activeTrip.busNumber,
    deviceId: `CREW-${activeTrip.busNumber}-PHONE`,
    tripId: activeTrip.tripId,
    latitude: wp.lat,
    longitude: wp.lon,
    accuracyMeters: 8,
    speedKph: wp.spd,
    heading: 110,
    altitude: 750
  };

  try {
    const res = await api.sendGpsUpdate('crew', payload);
    pingsCount++;
    logCrewTelemetry(`Simulated Crew GPS sent: At ${wp.name} [${wp.lat}, ${wp.lon}] Speed: ${wp.spd} km/h`);
  } catch (err) {
    logCrewTelemetry(`Error: ${err.message}`);
  }
}

async function triggerCrewSos() {
  if (!activeTrip) {
    alert('No active trip.');
    return;
  }

  if (!confirm('🚨 EMERGENCY SOS: Are you sure you want to broadcast an emergency distress signal to APSRTC Depot Controllers?')) {
    return;
  }

  try {
    await api.triggerSos({
      busNumber: activeTrip.busNumber,
      tripId: activeTrip.tripId,
      message: `CRITICAL: Driver on Bus ${activeTrip.busNumber} has triggered SOS distress call on route ${activeTrip.fromStop} -> ${activeTrip.toStop}.`
    });
    alert('🚨 EMERGENCY SOS DISPATCHED: Central Control & Police assistance notified.');
    logCrewTelemetry('🚨 EMERGENCY SOS BROADCAST SENT TO ALL DEPOTS');
  } catch (err) {
    alert(`Failed to trigger SOS: ${err.message}`);
  }
}

function updateCrewUiState(isTripActive) {
  const activeTripBox = document.getElementById('crewActiveTripDisplay');
  const startBtn = document.getElementById('crewStartTripBtn');
  const endBtn = document.getElementById('crewEndTripBtn');
  const gpsControls = document.getElementById('crewGpsControlsGroup');

  if (isTripActive) {
    if (activeTripBox) {
      activeTripBox.style.display = 'block';
      activeTripBox.innerHTML = `
        <div style="background: #e0f2fe; border: 1.5px solid #0284c7; padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
          <h4 style="color: #0369a1; font-weight: 800;">🚍 Current Trip: ${activeTrip.tripId}</h4>
          <p><strong>Bus:</strong> ${activeTrip.busNumber} | <strong>Driver:</strong> ${activeTrip.driverName}</p>
          <p><strong>Route:</strong> ${activeTrip.fromStop} ➔ ${activeTrip.toStop}</p>
        </div>
      `;
    }
    if (startBtn) startBtn.disabled = true;
    if (endBtn) endBtn.disabled = false;
    if (gpsControls) gpsControls.style.display = 'block';
  } else {
    if (activeTripBox) activeTripBox.style.display = 'none';
    if (startBtn) startBtn.disabled = false;
    if (endBtn) endBtn.disabled = true;
    if (gpsControls) gpsControls.style.display = 'none';
  }
}

function logCrewTelemetry(msg) {
  const logBox = document.getElementById('crewTelemetryLog');
  if (logBox) {
    const time = new Date().toLocaleTimeString();
    logBox.innerHTML = `[${time}] ${msg}\n` + logBox.innerHTML;
  }
}

window.crewApp = {
  init: initCrew,
  handleStartTrip,
  handleEndTrip,
  toggleGpsSharing,
  sendSimulatedCrewPing,
  triggerCrewSos
};
