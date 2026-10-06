/**
 * APSRTC SmartTrack Crew Mobile Portal
 * Enables Drivers and Conductors to enter their Staff ID, select location identification means
 * (Staff Mobile Phone GPS, Onboard Hardware Tracker, or ETM Machine), start trips, and dispatch live telemetry.
 */

let activeTrip = null;
let geolocationWatchId = null;
let isGpsActive = false;
let pingsCount = 0;
let simulatedStepIndex = 0;

// Corridor waypoints for crew manual simulation step across all regional corridors
const CREW_SIM_WAYPOINTS = [
  { name: 'Paderu RTC Complex', lat: 18.0816, lon: 82.6700, spd: 25 },
  { name: 'Paderu Ghat South Pass', lat: 18.0100, lon: 82.5900, spd: 38 },
  { name: 'G. Madugula Town Center', lat: 17.9500, lon: 82.5167, spd: 41 },
  { name: 'Vanjangi Forest Ghat', lat: 17.9100, lon: 82.4300, spd: 35 },
  { name: 'Chintapalli RTC Stand', lat: 17.8700, lon: 82.3500, spd: 45 },
  { name: 'Chodavaram RTC Depot', lat: 17.8286, lon: 82.9325, spd: 40 },
  { name: 'S. Kota Bus Station', lat: 18.1130, lon: 83.1592, spd: 42 },
  { name: 'Pendurthi Junction', lat: 17.8242, lon: 83.2003, spd: 48 },
  { name: 'Anakapalle Bypass', lat: 17.6913, lon: 83.0039, spd: 55 },
  { name: 'Visakhapatnam Complex (Dwaraka)', lat: 17.7215, lon: 83.3032, spd: 15 }
];

function initCrew() {
  setupCrewEvents();
  syncDeviceIdentifier();
}

function computeDefaultDeviceId(source, staffId, busNumber) {
  const cleanEmp = (staffId || 'CREW').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  const cleanBus = (busNumber || '415').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  switch (source) {
    case 'HARDWARE_TRACKER':
      return `HW-TRK-${cleanBus}-01`;
    case 'ETM':
      return `ETM-VIZAG-${cleanBus}`;
    case 'CREW_PHONE':
    default:
      return `DRIVER-${cleanEmp}-PHONE`;
  }
}

function formatSourceLabel(source) {
  switch (source) {
    case 'HARDWARE_TRACKER': return '🛰️ Hardware GPS Tracker';
    case 'ETM': return '📠 Electronic Ticketing Machine (ETM)';
    case 'CREW_PHONE': return '📱 Staff Mobile Phone GPS';
    case 'DEMO': return '🔮 Demo GPS Simulator';
    default: return source || '📱 Staff Mobile Phone GPS';
  }
}

function resolveApiEndpoint(trackingSource) {
  switch (trackingSource) {
    case 'HARDWARE_TRACKER': return 'device';
    case 'ETM': return 'etm';
    case 'CREW_PHONE':
    default: return 'crew';
  }
}

function syncDeviceIdentifier(userEdited = false) {
  const sourceSelect = document.getElementById('crewTrackingSourceSelect');
  const staffInput = document.getElementById('crewStaffInput');
  const staffSelect = document.getElementById('crewStaffSelect');
  const busSelect = document.getElementById('crewBusSelect');
  const deviceInput = document.getElementById('crewDeviceIdInput');
  const gpsToggleBtn = document.getElementById('crewGpsToggleBtn');

  const source = sourceSelect ? sourceSelect.value : 'CREW_PHONE';
  const rawStaffId = staffInput?.value || staffSelect?.value || 'EMP-4089';
  const staffId = rawStaffId.split(' ')[0].trim();
  const busNumber = busSelect ? busSelect.value : '415';

  if (deviceInput && (!userEdited || !deviceInput.value.trim())) {
    deviceInput.value = computeDefaultDeviceId(source, staffId, busNumber);
  }

  // Sync hidden select if present
  if (staffSelect && staffInput) {
    staffSelect.value = staffId;
  }

  // Update button text and style according to source
  if (gpsToggleBtn && !isGpsActive) {
    if (source === 'HARDWARE_TRACKER') {
      gpsToggleBtn.innerHTML = '🛰️ Stream Hardware GPS';
      gpsToggleBtn.style.background = '#0284c7';
    } else if (source === 'ETM') {
      gpsToggleBtn.innerHTML = '📠 Stream ETM Machine GPS';
      gpsToggleBtn.style.background = '#7c3aed';
    } else {
      gpsToggleBtn.innerHTML = '📡 Start Phone GPS';
      gpsToggleBtn.style.background = '#00695c';
    }
  }
}

function setupCrewEvents() {
  const staffInput = document.getElementById('crewStaffInput');
  if (staffInput) {
    staffInput.addEventListener('input', () => syncDeviceIdentifier(false));
    staffInput.addEventListener('change', () => syncDeviceIdentifier(false));
  }

  const busSelect = document.getElementById('crewBusSelect');
  if (busSelect) {
    busSelect.addEventListener('change', () => syncDeviceIdentifier(false));
  }

  const sourceSelect = document.getElementById('crewTrackingSourceSelect');
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => syncDeviceIdentifier(false));
  }

  const startTripBtn = document.getElementById('crewStartTripBtn') || document.getElementById('btn-start-trip');
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
  const busSelect = document.getElementById('crewBusSelect');
  const busInput = document.getElementById('crew-bus-input');
  const busNumber = busSelect ? busSelect.value : (busInput ? busInput.value : '415');

  const staffInput = document.getElementById('crewStaffInput');
  const staffSelect = document.getElementById('crewStaffSelect');
  const legacyStaff = document.getElementById('crew-id-select');
  const rawStaff = staffInput?.value || staffSelect?.value || legacyStaff?.value || 'EMP-4089';
  const employeeId = rawStaff.split(' ')[0].trim();

  const sourceSelect = document.getElementById('crewTrackingSourceSelect');
  const trackingSource = sourceSelect ? sourceSelect.value : 'CREW_PHONE';

  const deviceInput = document.getElementById('crewDeviceIdInput');
  const deviceId = (deviceInput?.value || computeDefaultDeviceId(trackingSource, employeeId, busNumber)).trim();

  const fromSelect = document.getElementById('crewFromSelect') || document.getElementById('crew-from-select');
  const toSelect = document.getElementById('crewToSelect') || document.getElementById('crew-to-select');
  const fromStop = fromSelect ? fromSelect.value : 'Paderu';
  const toStop = toSelect ? toSelect.value : 'Visakhapatnam';

  if (!busNumber || !fromStop || !toStop) {
    alert('Please select Bus Number, Departure, and Destination stops.');
    return;
  }

  try {
    const res = await api.startTrip({
      busNumber,
      employeeId,
      trackingSource,
      deviceId,
      fromStop,
      toStop
    });

    activeTrip = res.trip;
    updateCrewUiState(true);
    const sourceLabel = formatSourceLabel(activeTrip.trackingSource);
    logCrewTelemetry(`Trip initialized: ${activeTrip.tripId} | Bus ${busNumber} | Identified via ${sourceLabel} (${activeTrip.deviceId})`);
    alert(`✅ Trip Initialized!\nTrip ID: ${activeTrip.tripId}\nRoute: ${fromStop} ➔ ${toStop}\nIdentified via: ${sourceLabel}\nDevice ID: ${activeTrip.deviceId}`);
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
    toggleBtn.innerHTML = '🛑 Stop GPS Stream';
    toggleBtn.style.background = '#c62828';
  }

  const srcName = formatSourceLabel(activeTrip.trackingSource);
  logCrewTelemetry(`Streaming live ${srcName} coordinates to APSRTC SmartTrack servers...`);

  if ('geolocation' in navigator) {
    geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        handleDevicePosition(position.coords);
      },
      (error) => {
        logCrewTelemetry(`⚠️ Browser GPS Notice: ${error.message}. You can test using the Step button below.`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      }
    );
  } else {
    logCrewTelemetry('HTML5 Geolocation not supported. Use Step Forward button to stream updates.');
  }
}

function stopGpsSharing() {
  isGpsActive = false;
  if (geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }
  syncDeviceIdentifier();
  logCrewTelemetry('Location streaming paused.');
}

async function handleDevicePosition(coords) {
  if (!activeTrip) return;

  const endpoint = resolveApiEndpoint(activeTrip.trackingSource);
  const payload = {
    busNumber: activeTrip.busNumber,
    deviceId: activeTrip.deviceId || computeDefaultDeviceId(activeTrip.trackingSource, activeTrip.employeeId, activeTrip.busNumber),
    tripId: activeTrip.tripId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyMeters: Math.round(coords.accuracy || 12),
    speedKph: Math.round((coords.speed || 0) * 3.6), // m/s to km/h
    heading: Math.round(coords.heading || 0),
    altitude: Math.round(coords.altitude || 0)
  };

  try {
    await api.sendGpsUpdate(endpoint, payload);
    pingsCount++;
    const srcName = formatSourceLabel(activeTrip.trackingSource);
    logCrewTelemetry(`[${srcName}] Ping #${pingsCount}: [${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}] Speed: ${payload.speedKph} km/h Accuracy: ±${payload.accuracyMeters}m`);
    updateStandaloneDashboard(payload);
  } catch (err) {
    logCrewTelemetry(`Transmission Error: ${err.message}`);
  }
}

async function sendSimulatedCrewPing() {
  if (!activeTrip) {
    alert('Please start a trip first before dispatching coordinates.');
    return;
  }

  const wp = CREW_SIM_WAYPOINTS[simulatedStepIndex % CREW_SIM_WAYPOINTS.length];
  simulatedStepIndex++;

  const endpoint = resolveApiEndpoint(activeTrip.trackingSource);
  const payload = {
    busNumber: activeTrip.busNumber,
    deviceId: activeTrip.deviceId || computeDefaultDeviceId(activeTrip.trackingSource, activeTrip.employeeId, activeTrip.busNumber),
    tripId: activeTrip.tripId,
    latitude: wp.lat,
    longitude: wp.lon,
    accuracyMeters: 8,
    speedKph: wp.spd,
    heading: 110,
    altitude: 750
  };

  try {
    await api.sendGpsUpdate(endpoint, payload);
    pingsCount++;
    const srcName = formatSourceLabel(activeTrip.trackingSource);
    logCrewTelemetry(`[${srcName}] Dispatched: At ${wp.name} [${wp.lat}, ${wp.lon}] Speed: ${wp.spd} km/h (Identified via ${activeTrip.deviceId})`);
    updateStandaloneDashboard(payload);
  } catch (err) {
    logCrewTelemetry(`Error: ${err.message}`);
  }
}

function updateStandaloneDashboard(payload) {
  const speedEl = document.getElementById('crew-speed-display');
  if (speedEl) speedEl.textContent = `${payload.speedKph} km/h`;

  const pingCounterEl = document.getElementById('crew-ping-counter');
  if (pingCounterEl) pingCounterEl.textContent = pingsCount;

  const accEl = document.getElementById('crew-accuracy-display');
  if (accEl) accEl.textContent = `±${payload.accuracyMeters} m`;

  const latlngEl = document.getElementById('crew-last-latlng');
  if (latlngEl) latlngEl.textContent = `${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}`;
}

function handlePauseGps() {
  toggleGpsSharing();
}

function simulatePowerOff() {
  stopGpsSharing();
  logCrewTelemetry('⚠️ SIMULATION: Device suddenly powered off / battery exhausted. No further heartbeats will be sent.');
  alert('Simulated sudden power off! Telemetry stream severed.');
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
      message: `CRITICAL: Staff ${activeTrip.employeeId} on Bus ${activeTrip.busNumber} has triggered SOS distress signal on route ${activeTrip.fromStop} -> ${activeTrip.toStop}.`
    });
    alert('🚨 EMERGENCY SOS DISPATCHED: Central Control & Police assistance notified.');
    logCrewTelemetry('🚨 EMERGENCY SOS BROADCAST SENT TO ALL DEPOTS');
  } catch (err) {
    alert(`Failed to trigger SOS: ${err.message}`);
  }
}

function updateCrewUiState(isTripActive) {
  const activeTripBox = document.getElementById('crewActiveTripDisplay');
  const startBtn = document.getElementById('crewStartTripBtn') || document.getElementById('btn-start-trip');
  const endBtn = document.getElementById('crewEndTripBtn');
  const gpsControls = document.getElementById('crewGpsControlsGroup');
  const staffInput = document.getElementById('crewStaffInput');
  const busSelect = document.getElementById('crewBusSelect');
  const sourceSelect = document.getElementById('crewTrackingSourceSelect');
  const deviceInput = document.getElementById('crewDeviceIdInput');

  // Also support standalone crew.html dashboard toggle
  const setupCard = document.getElementById('crew-setup-card');
  const activeDash = document.getElementById('crew-active-dashboard');
  const statusBadge = document.getElementById('crew-status-badge');

  if (isTripActive && activeTrip) {
    if (activeTripBox) {
      activeTripBox.style.display = 'block';
      const sourceBadge = formatSourceLabel(activeTrip.trackingSource);
      activeTripBox.innerHTML = `
        <div style="background: #e0f2fe; border: 1.5px solid #0284c7; padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <h4 style="color: #0369a1; font-weight: 800; margin: 0;">🚍 Active Trip: ${activeTrip.tripId}</h4>
            <span style="background: #0284c7; color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 0.78rem; font-weight: 700;">
              ${sourceBadge}
            </span>
          </div>
          <p style="margin: 0.3rem 0; font-size: 0.9rem;">
            <strong>Bus Number:</strong> Bus ${activeTrip.busNumber} &nbsp;|&nbsp; 
            <strong>Assigned Crew:</strong> ${activeTrip.employeeId || 'EMP-4089'} (${activeTrip.driverName || 'Driver'})
          </p>
          <p style="margin: 0.3rem 0; font-size: 0.9rem;">
            <strong>Scheduled Route:</strong> ${activeTrip.fromStop} ➔ ${activeTrip.toStop}
          </p>
          <p style="margin: 0.3rem 0; font-size: 0.85rem; color: #334155;">
            <strong>Location Identification Source:</strong> <code>${activeTrip.trackingSource}</code> &nbsp;|&nbsp; 
            <strong>Device ID:</strong> <code>${activeTrip.deviceId || 'Auto'}</code>
          </p>
        </div>
      `;
    }
    if (startBtn) startBtn.disabled = true;
    if (endBtn) endBtn.disabled = false;
    if (staffInput) staffInput.disabled = true;
    if (busSelect) busSelect.disabled = true;
    if (sourceSelect) sourceSelect.disabled = true;
    if (deviceInput) deviceInput.disabled = true;
    if (gpsControls) gpsControls.style.display = 'block';

    if (setupCard) setupCard.style.display = 'none';
    if (activeDash) activeDash.style.display = 'block';
    if (statusBadge) {
      statusBadge.className = 'freshness-pill live';
      statusBadge.textContent = '🟢 ON-DUTY (LIVE)';
    }
  } else {
    if (activeTripBox) activeTripBox.style.display = 'none';
    if (startBtn) startBtn.disabled = false;
    if (endBtn) endBtn.disabled = true;
    if (staffInput) staffInput.disabled = false;
    if (busSelect) busSelect.disabled = false;
    if (sourceSelect) sourceSelect.disabled = false;
    if (deviceInput) deviceInput.disabled = false;
    if (gpsControls) gpsControls.style.display = 'none';

    if (setupCard) setupCard.style.display = 'block';
    if (activeDash) activeDash.style.display = 'none';
    if (statusBadge) {
      statusBadge.className = 'freshness-pill offline';
      statusBadge.textContent = '⚪ OFF-DUTY';
    }
  }
}

function logCrewTelemetry(msg) {
  const logBox = document.getElementById('crewTelemetryLog');
  if (logBox) {
    const time = new Date().toLocaleTimeString();
    logBox.innerHTML = `[${time}] ${msg}\n` + logBox.innerHTML;
  }
}

// Global exposure for event handlers and module accessibility
window.crewApp = {
  init: initCrew,
  handleStartTrip,
  handleEndTrip,
  handlePauseGps,
  simulatePowerOff,
  toggleGpsSharing,
  sendSimulatedCrewPing,
  triggerCrewSos,
  syncDeviceIdentifier
};

window.handleStartTrip = handleStartTrip;
window.handleEndTrip = handleEndTrip;
window.handlePauseGps = handlePauseGps;
window.simulatePowerOff = simulatePowerOff;
window.toggleGpsSharing = toggleGpsSharing;
window.sendSimulatedCrewPing = sendSimulatedCrewPing;
window.triggerCrewSos = triggerCrewSos;
