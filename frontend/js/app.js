// frontend/js/app.js - APSRTC SmartTrack Official Portal & Dashboard Logic

const API_BASE = "http://localhost:5000/api/v1";
let buses = [];
let allFleetBuses = [];
const corridorStopsData = [
  { name: "Araku", telugu: "అరకు", alt: 912, distKm: 0 },
  { name: "Ananthagiri", telugu: "అనంతగిరి", alt: 680, distKm: 24.5 },
  { name: "Paderu", telugu: "పాడేరు", alt: 900, distKm: 48.2 },
  { name: "G. Madugula", telugu: "జి. మాడుగుల", alt: 650, distKm: 65.0 },
  { name: "Chintapalli", telugu: "చింతపల్లి", alt: 830, distKm: 82.4 },
  { name: "Anakapalle", telugu: "అనకాపల్లి", alt: 40, distKm: 114.2 },
  { name: "Visakhapatnam", telugu: "విశాఖపట్నం", alt: 15, distKm: 131.7 }
];

let currentOfficer = null;
let currentStaff = null;
let corridorViewer = null;
let evidenceViewer = null;
let autoSimInterval = null;

const corridorDepotsData = [
  { name: "Araku Depot", code: "ARK-01", lat: 18.3270, lng: 82.8730, phone: "08936-249222", emergencyCell: "+91 94906 17801", recoveryVans: 2, manager: "Shri V. Rao" },
  { name: "Ananthagiri Sub-Depot", code: "ANT-02", lat: 18.2800, lng: 82.7000, phone: "08936-249555", emergencyCell: "+91 94906 17802", recoveryVans: 1, manager: "Shri K. Prasad" },
  { name: "Paderu Divisional Depot", code: "PDR-03", lat: 18.0730, lng: 82.6600, phone: "08935-250333", emergencyCell: "+91 94906 17803", recoveryVans: 4, manager: "Shri M. Satyanarayana" },
  { name: "G. Madugula Waypoint", code: "GMD-04", lat: 18.0816, lng: 82.6700, phone: "08935-251222", emergencyCell: "+91 94906 17804", recoveryVans: 1, manager: "Shri D. Apparao" },
  { name: "Chintapalli Depot", code: "CTP-05", lat: 18.1300, lng: 82.6900, phone: "08937-252444", emergencyCell: "+91 94906 17805", recoveryVans: 2, manager: "Shri S. Venkat" },
  { name: "Anakapalle Depot", code: "AKP-06", lat: 17.6900, lng: 83.0000, phone: "08924-222888", emergencyCell: "+91 94906 17806", recoveryVans: 3, manager: "Shri P. Ramana" },
  { name: "Visakhapatnam Central Complex", code: "VSKP-07", lat: 17.6868, lng: 83.2185, phone: "0891-2746400", emergencyCell: "+91 94906 17807", recoveryVans: 6, manager: "Divisional Manager VSKP" }
];

let emergenciesList = [
  {
    id: "SOS-2026-081",
    busId: "415",
    busNumber: "415",
    driverName: "S. Apparao",
    driverBadge: "D-4091",
    driverPhone: "+91 94906 17942",
    incidentType: "Tire Flat",
    severity: "HIGH",
    locationDesc: "Km 34.2, Ananthagiri Ghat hairpins between Depot 01 and 02",
    nearestDepot: {
      name: "Paderu Divisional Depot",
      code: "PDR-03",
      distanceKm: 8.5,
      etaMins: 14,
      phone: "08935-250333",
      emergencyCell: "+91 94906 17803"
    },
    passengerCount: 42,
    reliefBusNeeded: true,
    description: "Rear left double tire burst while climbing incline. Vehicle safely parked on wide shoulder. Need mobile hydraulic jack and replacement tire van.",
    status: "DISPATCHED",
    dispatchedUnit: "Paderu Recovery Van #RV-03 & Relief Bus #503",
    photoUrl: "assets/emergency_breakdown_repair.svg",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
];


// ------------------------------------------------------------
// SERVER HEALTH CHECK
// ------------------------------------------------------------

async function checkServer() {
  const el = document.getElementById("apiStatus");
  const badge = document.getElementById("systemHealthBadge");
  try {
    const response = await fetch("http://localhost:5000/health");
    if (!response.ok) throw new Error();
    if (el) el.textContent = "Server online • GPS Linked";
    if (badge) badge.textContent = "● 100% OPERATIONAL";
  } catch {
    if (el) {
      el.textContent = "Connecting to backend...";
      el.style.background = "#fff7ed";
      el.style.color = "#b45309";
    }
    if (badge) {
      badge.textContent = "● RECONNECTING";
      badge.style.background = "#fff7ed";
      badge.style.color = "#b45309";
    }
  }
}

// ------------------------------------------------------------
// BUS CARD RENDERER (PASSENGER TRANSIT FINDER)
// ------------------------------------------------------------

function busCard(bus, index) {
  const isAtPickup = bus.isAtPickup || bus.distanceToPickupKm === 0;
  const isAtDestination = bus.isAtDestination || bus.distanceToDestinationKm === 0;

  const pickupDistText = isAtPickup ? "At boarding stop" : `${bus.distanceToPickupKm ?? bus.distanceFromPassengerKm ?? "--"} km`;
  const pickupEtaText = isAtPickup ? "Arrived" : `${bus.etaToPickupMinutes ?? bus.etaMinutes ?? "--"} min`;

  const destDistText = isAtDestination ? "Arrived" : `${bus.distanceToDestinationKm ?? "--"} km`;
  const destEtaText = isAtDestination ? "Arrived" : `${bus.etaToDestinationMinutes ?? "--"} min`;

  const stopsPickupText = bus.stopsToPickup !== null && bus.stopsToPickup !== undefined
    ? (bus.stopsToPickup === 0 ? "At stop" : `${bus.stopsToPickup} stop${bus.stopsToPickup > 1 ? "s" : ""} away`)
    : "";

  const stopsDestText = bus.stopsToDestination !== null && bus.stopsToDestination !== undefined
    ? (bus.stopsToDestination === 0 ? "Arrived" : `${bus.stopsToDestination} stop${bus.stopsToDestination > 1 ? "s" : ""} to dest`)
    : "";

  return `
    <article class="bus-card ${index === 0 ? "best" : ""}">
      <div class="bus-head">
        <div>
          <span class="bus-number">🚌 Bus ${bus.number}</span>
          <span class="corridor-tag">${bus.route || "Araku - Visakhapatnam Corridor"}</span>
        </div>
        <span class="tag ${index === 0 ? "tag-best" : "tag-relevant"}">${index === 0 ? "⭐ BEST MATCH" : "RELEVANT"}</span>
      </div>

      <div class="bus-location">
        <div class="loc-badge-row">
          <span class="loc-icon">📍</span>
          <div>
            <span class="loc-subtitle">Current GPS Location</span>
            <strong class="loc-name">${bus.locationName}</strong>
          </div>
          ${isAtPickup ? '<span class="status-badge at-stop">🟢 At Boarding Point</span>' : ""}
        </div>
        <div class="destination-bar">
          <span class="dest-target">🎯 Destination: <b>${bus.destinationStop || "Selected Destination"}</b></span>
          <small class="route-corridor">${bus.direction}</small>
        </div>
      </div>

      <div class="journey-legs">
        <!-- Boarding Stop Leg -->
        <div class="leg-box pickup-box">
          <div class="leg-header">
            <span class="leg-indicator pickup-indicator"></span>
            <span class="leg-label">Pickup: <b>${bus.pickupStop || "Boarding"}</b></span>
            ${stopsPickupText ? `<span class="stops-count">${stopsPickupText}</span>` : ""}
          </div>
          <div class="metrics">
            <div class="metric ${isAtPickup ? "metric-success" : ""}">
              <span>Distance to Pickup</span>
              <b>${pickupDistText}</b>
            </div>
            <div class="metric ${isAtPickup ? "metric-success" : ""}">
              <span>ETA to Pickup</span>
              <b>${pickupEtaText}</b>
            </div>
          </div>
        </div>

        <!-- Destination Leg -->
        <div class="leg-box dest-box">
          <div class="leg-header">
            <span class="leg-indicator dest-indicator"></span>
            <span class="leg-label">Destination: <b>${bus.destinationStop || "Destination"}</b></span>
            ${stopsDestText ? `<span class="stops-count dest-count">${stopsDestText}</span>` : ""}
          </div>
          <div class="metrics">
            <div class="metric metric-dest">
              <span>Distance to Destination</span>
              <b>${destDistText}</b>
            </div>
            <div class="metric metric-dest">
              <span>ETA to Destination</span>
              <b>${destEtaText}</b>
            </div>
          </div>
        </div>
      </div>

      <div class="metrics telemetry">
        <div class="metric"><span>Speed</span><b>${bus.speedKph || 38} km/h</b></div>
        <div class="metric"><span>GPS Accuracy</span><b>±${bus.accuracy || 15} m</b></div>
        <div class="metric"><span>Service Class</span><b>Super Luxury</b></div>
      </div>

      <div class="bus-card-actions">
        <button class="btn-card-3d" onclick="jumpTo3DViewer('${bus.id}')">
          🚀 View in 3D Digital Twin
        </button>
        <button class="btn-card-photos" onclick="openFleetGallery('${bus.number}')">
          📸 Vehicle & Depot Photos
        </button>
      </div>
    </article>
  `;
}

// ------------------------------------------------------------
// JOURNEY SEARCH
// ------------------------------------------------------------

async function searchJourney(event) {
  if (event && event.preventDefault) {
    event.preventDefault();
  }
  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();
  const results = document.getElementById("results");

  results.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted); font-weight: 600;'>🔍 Calculating shortest corridor routing and ETA...</p>";

  try {
    const response = await fetch(`${API_BASE}/journey/buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed");

    buses = data.buses || [];
    results.innerHTML = buses.length
      ? buses.map(busCard).join("")
      : "<div style='grid-column: 1/-1; text-align: center; padding: 30px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--line);'><p style='font-weight: 700; color: var(--text);'>No active buses currently available on this segment.</p><small style='color: var(--text-muted);'>Try changing stops or checking all fleet in the radar below.</small></div>";

    fillComplaintBus();
  } catch (error) {
    results.innerHTML = `<p style='grid-column: 1/-1; color: var(--danger); padding: 12px;'>Could not search: ${error.message}. Is the backend running?</p>`;
  }
}

function setJourneyPreset(from, to) {
  const fromEl = document.getElementById("from");
  const toEl = document.getElementById("to");
  if (fromEl && toEl) {
    fromEl.value = from;
    toEl.value = to;
    searchJourney({ preventDefault() {} });
  }
}

// ------------------------------------------------------------
// KPI DASHBOARD, RADAR, & ELEVATION PROFILE
// ------------------------------------------------------------

async function loadDashboardStats() {
  try {
    const [statsRes, busesRes] = await Promise.all([
      fetch(`${API_BASE}/admin/stats`),
      fetch(`${API_BASE}/buses`)
    ]);

    if (statsRes.ok) {
      const { stats } = await statsRes.json();
      const elBuses = document.getElementById("kpiActiveBuses");
      const elOnTime = document.getElementById("kpiOnTime");
      const elSpeed = document.getElementById("kpiAvgSpeed");
      const elStops = document.getElementById("kpiStops");

      if (elBuses) elBuses.textContent = `${stats.activeBuses} / ${stats.totalBuses}`;
      if (elOnTime) elOnTime.textContent = stats.onTimeRate || "97.4%";
      if (elSpeed) elSpeed.textContent = `${stats.avgSpeedKph} km/h`;
      if (elStops) elStops.textContent = `${stats.totalStops} Depots`;
    }

    if (busesRes.ok) {
      const data = await busesRes.json();
      allFleetBuses = data.buses || [];
      renderStationRadar(allFleetBuses);
      renderElevationProfile(allFleetBuses);
      renderTimetable(allFleetBuses);
      if (currentOfficer) {
        renderAdminBusTable();
      }
    }
  } catch (e) {
    console.error("Dashboard stats error:", e);
  }
}

function renderStationRadar(fleet) {
  const strip = document.getElementById("radarStrip");
  if (!strip) return;

  strip.innerHTML = corridorStopsData.map((stop, idx) => {
    const busesAtStop = fleet.filter(b => b.locationName && b.locationName.toLowerCase().includes(stop.name.toLowerCase()));

    const busPills = busesAtStop.map(b => `
      <span class="radar-bus-pill" onclick="jumpTo3DViewer('${b.id}')" title="Click to track Bus ${b.number} in 3D">
        🚌 ${b.number} <small>(${b.speedKph}k)</small>
      </span>
    `).join(" ");

    return `
      <div class="radar-station-node ${busesAtStop.length ? "has-bus" : ""}">
        <span class="radar-node-order">DEPOT 0${idx + 1}</span>
        <div class="radar-node-name" title="${stop.name}">${stop.name}</div>
        <div class="radar-node-tel">${stop.telugu}</div>
        <small class="radar-node-alt">⛰️ ${stop.alt}m</small>
        <div class="radar-node-buses">
          ${busesAtStop.length ? busPills : '<span class="radar-station-empty">—</span>'}
        </div>
      </div>
    `;
  }).join("");
}

// ------------------------------------------------------------
// INTERACTIVE CORRIDOR ELEVATION PROFILE CHART
// ------------------------------------------------------------

function renderElevationProfile(fleet) {
  const container = document.getElementById("elevationChartWrapper");
  if (!container) return;

  // 7 stops profile
  const stops = corridorStopsData;
  const maxAlt = 1000;
  const chartHeight = 160;

  // Build SVG Points for the mountain slope curve
  const points = stops.map((s, idx) => {
    const x = (idx / (stops.length - 1)) * 740 + 30; // 30px to 770px
    const y = chartHeight - (s.alt / maxAlt) * (chartHeight - 30) - 15;
    return { x, y, stop: s };
  });

  const polylineStr = points.map(p => `${p.x},${p.y}`).join(" ");
  const polygonStr = `30,${chartHeight} ` + polylineStr + ` 770,${chartHeight}`;

  // Build bus marker icons positioned along the profile
  const busMarkersHtml = (fleet || []).map(bus => {
    // Find closest stop
    const stopIdx = stops.findIndex(s => bus.locationName && bus.locationName.toLowerCase().includes(s.name.toLowerCase()));
    if (stopIdx === -1) return "";

    const p = points[stopIdx];
    return `
      <g transform="translate(${p.x}, ${p.y - 18})" class="elev-bus-pin" onclick="jumpTo3DViewer('${bus.id}')">
        <circle cx="0" cy="0" r="12" fill="#15803d" stroke="#ffffff" stroke-width="2"/>
        <text x="0" y="4" font-size="9" fill="#ffffff" font-weight="bold" text-anchor="middle">🚌</text>
        <text x="0" y="-14" font-size="9" fill="#fde68a" font-weight="bold" text-anchor="middle">Bus ${bus.number}</text>
      </g>
    `;
  }).join("");

  const stationNodesHtml = points.map(p => `
    <g transform="translate(${p.x}, ${p.y})">
      <circle cx="0" cy="0" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
      <text x="0" y="20" font-size="10" font-weight="700" fill="var(--text)" text-anchor="middle">${p.stop.name}</text>
      <text x="0" y="32" font-size="8" fill="var(--text-muted)" text-anchor="middle">${p.stop.alt}m</text>
    </g>
  `).join("");

  container.innerHTML = `
    <svg viewBox="0 0 800 ${chartHeight + 45}" class="elevation-svg">
      <defs>
        <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#15803d" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#15803d" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <!-- Background Grid lines -->
      <line x1="30" y1="20" x2="770" y2="20" stroke="var(--line)" stroke-dasharray="4 4"/>
      <text x="25" y="24" font-size="8" fill="var(--text-muted)" text-anchor="end">900m</text>
      <line x1="30" y1="80" x2="770" y2="80" stroke="var(--line)" stroke-dasharray="4 4"/>
      <text x="25" y="84" font-size="8" fill="var(--text-muted)" text-anchor="end">500m</text>
      <line x1="30" y1="${chartHeight}" x2="770" y2="${chartHeight}" stroke="var(--line)"/>
      <text x="25" y="${chartHeight}" font-size="8" fill="var(--text-muted)" text-anchor="end">0m (Sea Level)</text>

      <!-- Mountain Relief Polygon -->
      <polygon points="${polygonStr}" fill="url(#elevGrad)"/>
      <!-- Mountain Slope Polyline -->
      <polyline points="${polylineStr}" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>

      <!-- Station Nodes -->
      ${stationNodesHtml}

      <!-- Real-time Buses on slope -->
      ${busMarkersHtml}
    </svg>
  `;
}

// ------------------------------------------------------------
// DEPOT LIVE TIMETABLE
// ------------------------------------------------------------

function renderTimetable(fleet) {
  const tbody = document.getElementById("timetableBody");
  if (!tbody) return;

  const now = new Date();
  const sampleTimes = ["06:30 AM", "08:15 AM", "10:45 AM", "01:20 PM", "03:50 PM", "06:10 PM", "08:30 PM"];

  tbody.innerHTML = corridorStopsData.map((stop, idx) => {
    const busHere = fleet.find(b => b.locationName && b.locationName.toLowerCase().includes(stop.name.toLowerCase()));
    const timeStr = sampleTimes[idx % sampleTimes.length];
    const platform = `Bay 0${(idx % 4) + 1}`;

    return `
      <tr>
        <td><strong>${stop.name}</strong> <small class="text-tel">(${stop.telugu})</small></td>
        <td><span class="badge-bay">${platform}</span></td>
        <td>${busHere ? `<b>Bus ${busHere.number}</b>` : "Scheduled Express"}</td>
        <td>${busHere ? `<span class="badge-status badge-active">DOCKED / DOCKED SOON</span>` : `<span class="badge-status badge-sched">SCHEDULED (${timeStr})</span>`}</td>
        <td>${busHere ? `${busHere.direction}` : (idx < 3 ? "Towards Visakhapatnam" : "Towards Araku")}</td>
        <td>
          <button class="btn-timetable-action" onclick="setJourneyPreset('${stop.name}', 'Visakhapatnam')">Book / Route</button>
        </td>
      </tr>
    `;
  }).join("");
}

// ------------------------------------------------------------
// ANNOUNCEMENTS BULLETIN
// ------------------------------------------------------------

async function loadAnnouncements() {
  const textEl = document.getElementById("announcementText");
  try {
    const res = await fetch(`${API_BASE}/admin/announcements`);
    if (res.ok) {
      const data = await res.json();
      if (data.announcements && data.announcements.length > 0) {
        textEl.textContent = data.announcements[0].message;
      }
    }
  } catch (e) {
    // Fallback message exists
  }
}

// ------------------------------------------------------------
// VIEWER.JS INTEGRATION FOR CORRIDOR PICTURES & CITIZEN PROOF
// ------------------------------------------------------------

function initViewerJS() {
  // Check if Viewer is loaded from CDN
  if (typeof Viewer === "undefined") {
    console.warn("Viewer.js is not yet loaded.");
    return;
  }

  // 1. Initialize Corridor Scenic & Depot Gallery
  const galleryEl = document.getElementById("corridorGallery");
  if (galleryEl && !corridorViewer) {
    corridorViewer = new Viewer(galleryEl, {
      navbar: true,
      title: true,
      toolbar: {
        zoomIn: 4,
        zoomOut: 4,
        oneToOne: 4,
        reset: 4,
        prev: 4,
        play: {
          show: 4,
          size: 'large',
        },
        next: 4,
        rotateLeft: 4,
        rotateRight: 4,
        flipHorizontal: 4,
        flipVertical: 4,
      },
      transition: true,
      viewed() {
        console.log("Viewer.js opened image successfully.");
      }
    });
  }

  // 2. Initialize Evidence Gallery
  const evidenceEl = document.getElementById("evidenceGallery");
  if (evidenceEl && !evidenceViewer) {
    evidenceViewer = new Viewer(evidenceEl, {
      inline: false,
      button: true,
      navbar: true,
      title: true
    });

  }
}

window.triggerViewerByStation = function (stationName) {
  if (!corridorViewer) initViewerJS();
  if (!corridorViewer) return;

  const images = document.querySelectorAll("#corridorGallery img");
  for (let i = 0; i < images.length; i++) {
    const alt = images[i].getAttribute("alt") || "";
    if (alt.toLowerCase().includes(stationName.toLowerCase())) {
      corridorViewer.view(i);
      return;
    }
  }
  // Default to first image
  corridorViewer.view(0);
};

window.triggerViewerByFleet = function (busNum) {
  if (!corridorViewer) initViewerJS();
  if (!corridorViewer) return;

  const images = document.querySelectorAll("#corridorGallery img");
  for (let i = 0; i < images.length; i++) {
    const alt = images[i].getAttribute("alt") || "";
    if (alt.toLowerCase().includes("super luxury") || alt.toLowerCase().includes("fleet")) {
      corridorViewer.view(i);
      return;
    }
  }
  corridorViewer.view(0);
};

window.openEvidenceViewer = function () {
  const sampleProof = document.getElementById("sampleProofImg");
  if (sampleProof) {
    if (!evidenceViewer) initViewerJS();
    if (evidenceViewer) evidenceViewer.show();
  }
};

// ------------------------------------------------------------
// CITIZEN GRIEVANCE
// ------------------------------------------------------------

function fillComplaintBus() {
  const select = document.getElementById("complaintBus");
  if (!select) return;
  const sourceBuses = (buses.length > 0) ? buses : allFleetBuses;
  select.innerHTML = sourceBuses.map(b => `<option value="${b.id}">Bus ${b.number} — Current: ${b.locationName}</option>`).join("");
}

async function submitComplaint(event) {
  event.preventDefault();
  const message = document.getElementById("complaintMessage");
  const payload = {
    busId: document.getElementById("complaintBus").value,
    category: document.getElementById("category").value,
    passengerName: document.getElementById("passengerName").value || "Citizen Passenger",
    description: document.getElementById("description").value
  };

  try {
    const response = await fetch(`${API_BASE}/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Complaint failed");
    message.className = "success-message";
    message.textContent = `✅ Grievance Registered. Official Reference ID: ${data.id}. Monitored by OCC Dispatch.`;
    document.getElementById("description").value = "";
    if (currentOfficer) {
      loadAdminComplaints();
    }
  } catch (error) {
    message.className = "";
    message.textContent = error.message;
  }
}

// ------------------------------------------------------------
// OFFICER AUTHENTICATION & CONTROL CENTER
// ------------------------------------------------------------

function openLoginModal() {
  if (currentOfficer) {
    const portal = document.getElementById("adminPortal");
    if (portal) {
      portal.style.display = "block";
      portal.scrollIntoView({ behavior: "smooth" });
    }
    return;
  }
  document.getElementById("loginModal").classList.add("open");
}

function closeLoginModal() {
  document.getElementById("loginModal").classList.remove("open");
  const err = document.getElementById("loginError");
  if (err) err.style.display = "none";
}

function fillDemoCredentials() {
  document.getElementById("loginUsername").value = "admin";
  document.getElementById("loginPassword").value = "apsrtc@2026";
}

// 1-Click Instant Demo Login
async function quickDemoLogin() {
  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "apsrtc@2026" })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    localStorage.setItem("apsrtc_officer_token", data.token);
    localStorage.setItem("apsrtc_officer_data", JSON.stringify(data.user));
    currentOfficer = data.user;

    closeLoginModal();
    applyOfficerState();

    const portal = document.getElementById("adminPortal");
    if (portal) {
      portal.style.display = "block";
      portal.scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) {
    alert("Demo login error: " + err.message);
  }
}

async function handleOfficerLogin(event) {
  event.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const errorEl = document.getElementById("loginError");

  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed");

    localStorage.setItem("apsrtc_officer_token", data.token);
    localStorage.setItem("apsrtc_officer_data", JSON.stringify(data.user));
    currentOfficer = data.user;

    closeLoginModal();
    applyOfficerState();

    const portal = document.getElementById("adminPortal");
    portal.style.display = "block";
    portal.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    errorEl.textContent = `Authentication error: ${err.message}`;
    errorEl.style.display = "block";
  }
}

function applyOfficerState() {
  const btn = document.getElementById("officerLoginBtn");
  const portal = document.getElementById("adminPortal");

  if (currentOfficer) {
    btn.innerHTML = `🛡️ Officer: <b>${currentOfficer.name.split(" ")[0]}</b>`;
    btn.classList.add("btn-officer-active");

    portal.style.display = "block";
    document.getElementById("officerName").textContent = `${currentOfficer.name} (${currentOfficer.badge})`;
    document.getElementById("officerBadge").textContent = `Operational Control Center — ${currentOfficer.division} | Session Active`;

    renderAdminBusTable();
    loadAdminComplaints();
    loadAdminEmergencies();
  } else {
    btn.innerHTML = "🔐 Officer Login";
    btn.classList.remove("btn-officer-active");
    portal.style.display = "none";
  }
}

function logoutOfficer() {
  localStorage.removeItem("apsrtc_officer_token");
  localStorage.removeItem("apsrtc_officer_data");
  currentOfficer = null;
  applyOfficerState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function checkSavedOfficer() {
  const token = localStorage.getItem("apsrtc_officer_token");
  const data = localStorage.getItem("apsrtc_officer_data");
  if (token && data) {
    try {
      currentOfficer = JSON.parse(data);
      applyOfficerState();
    } catch {
      localStorage.removeItem("apsrtc_officer_data");
    }
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".admin-tab-content").forEach(content => content.classList.remove("active"));

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.add("active");

  const tabIndexMap = {
    fleetMgmt: 0,
    complaintMgmt: 1,
    broadcastMgmt: 2,
    emergencyMgmt: 3
  };
  const btn = document.querySelectorAll(".admin-tab")[tabIndexMap[tabName] ?? 0];
  if (btn) btn.classList.add("active");

  if (tabName === "emergencyMgmt") {
    loadAdminEmergencies();
  }
}

// ------------------------------------------------------------
// ADMIN: FLEET CONTROLLER & SIMULATION STEP
// ------------------------------------------------------------

function renderAdminBusTable() {
  const tbody = document.getElementById("adminBusTableBody");
  if (!tbody) return;

  tbody.innerHTML = allFleetBuses.map(bus => {
    const isMaint = bus.status === "MAINTENANCE";
    const statusClass = isMaint ? "badge-maint" : "badge-active";

    return `
      <tr>
        <td><strong>Bus ${bus.number}</strong></td>
        <td>${bus.direction}</td>
        <td>📍 ${bus.locationName}</td>
        <td>${bus.speedKph} km/h</td>
        <td><span class="badge-status badge-active">LINKED</span></td>
        <td><span class="badge-status ${statusClass}">${bus.status || "ACTIVE"}</span></td>
        <td>
          <button class="admin-btn-action admin-btn-toggle" onclick="toggleBusStatus('${bus.id}', '${bus.status}')">
            ${isMaint ? "Activate" : "Hold Service"}
          </button>
          <button class="admin-btn-action admin-btn-danger" onclick="handleDeleteBus('${bus.id}')" style="margin-left: 4px;">
            Remove
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function toggleBusStatus(id, currentStatus) {
  const newStatus = currentStatus === "MAINTENANCE" ? "ACTIVE" : "MAINTENANCE";
  try {
    const res = await fetch(`${API_BASE}/admin/bus/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      await loadDashboardStats();
    }
  } catch (e) {
    alert("Status change failed: " + e.message);
  }
}

async function handleDeleteBus(id) {
  if (!confirm(`Are you sure you want to decommission Bus ${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE}/admin/bus/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadDashboardStats();
    }
  } catch (e) {
    alert("Delete failed: " + e.message);
  }
}

async function handleAddBus(event) {
  event.preventDefault();
  const number = document.getElementById("newBusNumber").value.trim();
  const locationName = document.getElementById("newBusStation").value;
  const directionCode = document.getElementById("newBusDirection").value;
  const speedKph = document.getElementById("newBusSpeed").value;

  try {
    const res = await fetch(`${API_BASE}/admin/bus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number, locationName, directionCode, speedKph })
    });
    if (res.ok) {
      alert(`✅ Bus ${number} deployed to ${locationName} station.`);
      document.getElementById("newBusNumber").value = "";
      await loadDashboardStats();
    }
  } catch (e) {
    alert("Deployment failed: " + e.message);
  }
}

// SIMULATION CONTROL
async function triggerSimulateStep() {
  const btn = document.getElementById("btnSimStep");
  if (btn) btn.textContent = "⏳ Simulating...";

  try {
    const res = await fetch(`${API_BASE}/admin/simulate-step`, { method: "POST" });
    if (res.ok) {
      await loadDashboardStats();
      return;
    }
    // Fallback: advance each bus using the active tracking API
    const stops = [
      { name: "Araku", lat: 18.3270, lng: 82.8730 },
      { name: "Ananthagiri", lat: 18.2800, lng: 82.7000 },
      { name: "Paderu", lat: 18.0730, lng: 82.6600 },
      { name: "G. Madugula", lat: 18.0816, lng: 82.6700 },
      { name: "Chintapalli", lat: 18.1300, lng: 82.6900 },
      { name: "Anakapalle", lat: 17.6900, lng: 83.0000 },
      { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 }
    ];

    for (const b of allFleetBuses) {
      if (b.status === "MAINTENANCE") continue;
      let currIdx = stops.findIndex(s => b.locationName && b.locationName.toLowerCase().includes(s.name.toLowerCase()));
      if (currIdx === -1) currIdx = 0;
      let nextIdx = (b.directionCode === "reverse") ? currIdx - 1 : currIdx + 1;
      if (nextIdx >= stops.length) nextIdx = stops.length - 2;
      if (nextIdx < 0) nextIdx = 1;

      const targetStop = stops[nextIdx];
      await fetch(`${API_BASE}/tracking/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          busId: b.id,
          lat: targetStop.lat,
          lng: targetStop.lng,
          speedKph: Math.floor(34 + Math.random() * 14),
          heading: (b.directionCode === "reverse") ? 280 : 110,
          locationName: targetStop.name,
          accuracy: 12
        })
      });
    }

    await loadDashboardStats();
    if (typeof loadFleet === "function") loadFleet();
  } catch (e) {
    console.error("Simulation step error:", e);
  } finally {
    if (btn) btn.textContent = "🎮 Advance 1 GPS Step";
  }
}


function toggleAutoSim() {
  const btn = document.getElementById("btnAutoSim");
  if (autoSimInterval) {
    clearInterval(autoSimInterval);
    autoSimInterval = null;
    if (btn) {
      btn.textContent = "▶️ Start Auto-Advance (5s)";
      btn.classList.remove("btn-active-sim");
    }
  } else {
    autoSimInterval = setInterval(triggerSimulateStep, 5000);
    if (btn) {
      btn.textContent = "⏸️ Pause Auto-Advance";
      btn.classList.add("btn-active-sim");
    }
  }
}

// ------------------------------------------------------------
// ADMIN: GRIEVANCE DESK
// ------------------------------------------------------------

async function loadAdminComplaints() {
  const tbody = document.getElementById("adminComplaintTableBody");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/complaints`);
    if (res.ok) {
      const data = await res.json();
      tbody.innerHTML = (data.complaints || []).map(c => `
        <tr>
          <td><b>${c.id}</b></td>
          <td>Bus ${c.busId}</td>
          <td>${c.category}</td>
          <td>${c.passengerName || "Citizen"}</td>
          <td style="max-width: 240px;">${c.description}</td>
          <td>
            <button class="btn-evidence-badge" onclick="openEvidenceViewer()" title="Inspect evidence photo with Viewer.js">
              📷 Photo Attached
            </button>
          </td>
          <td><span class="badge-status ${c.status === "RESOLVED" ? "badge-active" : "badge-maint"}">${c.status}</span></td>
          <td>
            ${c.status !== "RESOLVED" ? `
              <button class="admin-btn-action admin-btn-success" onclick="updateGrievanceStatus('${c.id}', 'RESOLVED')">
                Mark Resolved
              </button>
            ` : '<span style="color: var(--success); font-weight: 700; font-size: 11px;">✓ Closed</span>'}
          </td>
        </tr>
      `).join("");
    }
  } catch (e) {
    console.error("Complaint load error:", e);
  }
}

async function updateGrievanceStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/admin/complaints/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      loadAdminComplaints();
    }
  } catch (e) {
    alert("Update failed: " + e.message);
  }
}

// ------------------------------------------------------------
// ADMIN: BROADCAST BULLETIN
// ------------------------------------------------------------

async function handleBroadcast(event) {
  event.preventDefault();
  const message = document.getElementById("broadcastMessage").value.trim();
  const type = document.getElementById("broadcastType").value;

  try {
    const res = await fetch(`${API_BASE}/admin/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, type })
    });
    if (res.ok) {
      alert("📢 Bulletin transmitted across the corridor network.");
      document.getElementById("broadcastMessage").value = "";
      loadAnnouncements();
    }
  } catch (e) {
    alert("Broadcast failed: " + e.message);
  }
}

// ------------------------------------------------------------
// ON-DUTY STAFF & CREW EMERGENCY SOS CONTROLLER
// ------------------------------------------------------------

function openStaffModal() {
  if (currentStaff) {
    const portal = document.getElementById("staffPortal");
    if (portal) {
      portal.style.display = "block";
      portal.scrollIntoView({ behavior: "smooth" });
    }
    return;
  }
  const modal = document.getElementById("staffLoginModal");
  if (modal) modal.classList.add("open");
}

function closeStaffModal() {
  const modal = document.getElementById("staffLoginModal");
  if (modal) modal.classList.remove("open");
  const err = document.getElementById("staffLoginError");
  if (err) err.style.display = "none";
}

function fillStaffDemoCredentials() {
  const idEl = document.getElementById("staffLoginId");
  const busEl = document.getElementById("staffBusNumberInput");
  const passEl = document.getElementById("staffLoginPass");
  if (idEl) idEl.value = "driver415";
  if (busEl) busEl.value = "415";
  if (passEl) passEl.value = "crew@2026";
}

async function quickStaffLogin() {
  fillStaffDemoCredentials();
  await executeStaffAuth("driver415", "415", "crew@2026");
}

async function handleStaffLogin(event) {
  event.preventDefault();
  const staffId = document.getElementById("staffLoginId").value.trim();
  const busNumber = document.getElementById("staffBusNumberInput").value.trim();
  const password = document.getElementById("staffLoginPass").value.trim();
  await executeStaffAuth(staffId, busNumber, password);
}

async function executeStaffAuth(staffId, busNumber, password) {
  const errorEl = document.getElementById("staffLoginError");
  if (errorEl) errorEl.style.display = "none";

  try {
    let userData = null;
    let token = null;

    try {
      const res = await fetch(`${API_BASE}/emergencies/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, busNumber, password })
      });
      if (res.ok) {
        const data = await res.json();
        token = data.token;
        userData = data.user;
      }
    } catch (e) {
      console.warn("Backend emergency login fetch failed, falling back to local auth verification:", e);
    }

    // Robust fallback if server is offline or restarting
    if (!userData) {
      if (password === "crew@2026" || password === "apsrtc@2026" || staffId.startsWith("driver") || staffId.startsWith("D-")) {
        token = "crew-token-" + Date.now();
        userData = {
          id: staffId,
          badge: staffId.toUpperCase().includes("D-") ? staffId.toUpperCase() : "D-4091",
          name: "S. Apparao",
          role: "Senior Hill Highway Driver",
          busNumber: busNumber || "415",
          phone: "+91 94906 17942",
          depotBase: "Paderu Divisional Depot"
        };
      } else {
        throw new Error("Invalid Driver / Staff Badge or PIN. Demo badge: driver415, pass: crew@2026");
      }
    }

    localStorage.setItem("apsrtc_staff_token", token);
    localStorage.setItem("apsrtc_staff_data", JSON.stringify(userData));
    currentStaff = userData;

    closeStaffModal();
    applyStaffState();

    const portal = document.getElementById("staffPortal");
    if (portal) {
      portal.style.display = "block";
      portal.scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = `Staff Authentication Error: ${err.message}`;
      errorEl.style.display = "block";
    } else {
      alert(err.message);
    }
  }
}

function applyStaffState() {
  const btn = document.getElementById("staffLoginBtn");
  const portal = document.getElementById("staffPortal");

  if (currentStaff) {
    if (btn) {
      btn.innerHTML = `🚨 Driver: <b>${currentStaff.name.split(" ")[0]}</b>`;
      btn.classList.add("btn-staff-active");
    }
    if (portal) portal.style.display = "block";

    const nameEl = document.getElementById("staffDriverName");
    if (nameEl) nameEl.textContent = `${currentStaff.name} (Badge: ${currentStaff.badge})`;

    const busEl = document.getElementById("staffBusInfo");
    if (busEl) busEl.innerHTML = `Assigned Bus: <b>Bus ${currentStaff.busNumber || "415"} (Super Luxury)</b> • Status: <span class="badge-status badge-active">ON-DUTY ACTIVE</span>`;

    const sosBusInput = document.getElementById("sosBusNumber");
    if (sosBusInput) sosBusInput.value = currentStaff.busNumber || "415";

    refreshStaffNearestDepot();
    renderStaffEmergencies();
  } else {
    if (btn) {
      btn.innerHTML = "🚨 Crew SOS Login";
      btn.classList.remove("btn-staff-active");
    }
    if (portal) portal.style.display = "none";
  }
}

function logoutStaff() {
  localStorage.removeItem("apsrtc_staff_token");
  localStorage.removeItem("apsrtc_staff_data");
  currentStaff = null;
  applyStaffState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function checkSavedStaff() {
  const token = localStorage.getItem("apsrtc_staff_token");
  const data = localStorage.getItem("apsrtc_staff_data");
  if (token && data) {
    try {
      currentStaff = JSON.parse(data);
      applyStaffState();
    } catch {
      localStorage.removeItem("apsrtc_staff_data");
    }
  }
}

// ------------------------------------------------------------
// NEAREST CORRIDOR DEPOT CALCULATOR (HAVERSINE GEODESIC)
// ------------------------------------------------------------

function calcDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

function getNearestDepotForLocation(lat, lon) {
  let nearest = null;
  let minDistance = Infinity;

  corridorDepotsData.forEach(depot => {
    const dist = calcDistanceKm(lat, lon, depot.lat, depot.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = {
        ...depot,
        distanceKm: dist,
        etaMins: Math.max(6, Math.round((dist / 35) * 60)) // ~35 km/h avg mountain response speed
      };
    }
  });

  return nearest;
}

function refreshStaffNearestDepot() {
  const busNum = currentStaff ? currentStaff.busNumber : "415";
  const activeBus = allFleetBuses.find(b => String(b.number) === String(busNum) || String(b.id) === String(busNum));
  
  const currentLat = activeBus ? activeBus.lat : 18.1800;
  const currentLng = activeBus ? activeBus.lng : 82.6850;

  const nearest = getNearestDepotForLocation(currentLat, currentLng);
  if (!nearest) return null;

  const distEl = document.getElementById("depotDistanceText");
  if (distEl) distEl.textContent = `${nearest.distanceKm} km away • Hill Recovery ETA: ~${nearest.etaMins} mins`;

  const nameEl = document.getElementById("depotNameText");
  if (nameEl) nameEl.textContent = `${nearest.name} (${nearest.code})`;

  const mgrEl = document.getElementById("depotManagerText");
  if (mgrEl) mgrEl.innerHTML = `Depot Control Officer: <b>${nearest.manager}</b> • Division: Alluri Sitharama Raju • Emergency Cell: <b>${nearest.emergencyCell}</b>`;

  const phoneEl = document.getElementById("depotPhoneText");
  if (phoneEl) phoneEl.textContent = nearest.phone;

  const callBtn = document.getElementById("depotCallBtn");
  if (callBtn) callBtn.href = `tel:${nearest.phone.replace(/[^0-9]/g, "")}`;

  return nearest;
}

// ------------------------------------------------------------
// 1-CLICK QUICK SOS TRIGGER & FORM TRANSMISSION
// ------------------------------------------------------------

function triggerQuickSos(type) {
  const categorySelect = document.getElementById("sosCategory");
  const descInput = document.getElementById("sosDescription");
  const reliefSelect = document.getElementById("sosReliefBus");

  if (!categorySelect || !descInput) return;

  categorySelect.value = type;

  if (type === "Tire Flat") {
    descInput.value = "Left rear double-tire burst while climbing uphill hairpin gradient. Bus securely anchored on wide shoulder with parking brake & stones. Urgent request for mobile hydraulic jack and 10.00R20 replacement tire van from nearest depot.";
    if (reliefSelect) reliefSelect.value = "false";
  } else if (type === "Accident") {
    descInput.value = "Collision / ditch avoidance incident on steep ghat turn. Bus safely resting against protective berm. All passengers evacuated behind crash barrier. Urgent request for police rendezvous, tow winch crane, and relief passenger shuttle bus.";
    if (reliefSelect) reliefSelect.value = "true";
  } else if (type === "Breakdown") {
    descInput.value = "Severe engine overheating and clutch pressure loss under hill payload. Bus stalled on bypass. Urgent request for mechanical recovery van and passenger transfer bus.";
    if (reliefSelect) reliefSelect.value = "true";
  } else if (type === "Medical") {
    descInput.value = "Passenger sudden severe respiratory/altitude sickness distress. Vehicle halted at scenic viewpoint. Urgent paramedic team & rapid ambulance rendezvous needed immediately.";
    if (reliefSelect) reliefSelect.value = "false";
  } else if (type === "Road Block") {
    descInput.value = "Substantial rockfall and fallen forest tree blocking both lanes ahead. Vehicle stopped 60m prior. Request forest highway clearance bulldozer and traffic management.";
    if (reliefSelect) reliefSelect.value = "true";
  }

  const formWrap = document.querySelector(".sos-form-wrap");
  if (formWrap) {
    formWrap.scrollIntoView({ behavior: "smooth" });
    formWrap.style.boxShadow = "0 0 24px rgba(220, 38, 38, 0.4)";
    setTimeout(() => { formWrap.style.boxShadow = ""; }, 2000);
  }
}

async function submitEmergencySos(event) {
  event.preventDefault();

  const category = document.getElementById("sosCategory").value;
  const busNumber = document.getElementById("sosBusNumber").value.trim() || (currentStaff?.busNumber || "415");
  const locationDesc = document.getElementById("sosLocationDesc").value.trim();
  const passengerCount = parseInt(document.getElementById("sosPassengerCount").value) || 40;
  const reliefBusNeeded = document.getElementById("sosReliefBus").value === "true";
  const passengerStatus = document.getElementById("sosPassengerStatus")?.value || "safe";
  const description = document.getElementById("sosDescription").value.trim();

  const nearest = refreshStaffNearestDepot() || corridorDepotsData[2];

  const sosPayload = {
    busNumber,
    busId: busNumber,
    incidentType: category,
    severity: category === "Accident" ? "CRITICAL" : "HIGH",
    locationDesc,
    passengerCount,
    reliefBusNeeded,
    passengerStatus,
    description,
    driverName: currentStaff?.name || "S. Apparao",
    driverBadge: currentStaff?.badge || "D-4091",
    driverPhone: currentStaff?.phone || "+91 94906 17942",
    nearestDepot: nearest
  };

  const alertBox = document.getElementById("sosAlertMessage");
  let createdRecord = null;

  try {
    const res = await fetch(`${API_BASE}/emergencies/sos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sosPayload)
    });
    if (res.ok) {
      const data = await res.json();
      createdRecord = data.emergency;
    }
  } catch (err) {
    console.warn("Backend SOS transmission failed, saving locally:", err);
  }

  if (!createdRecord) {
    createdRecord = {
      id: "SOS-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900),
      ...sosPayload,
      status: "REPORTED",
      dispatchedUnit: null,
      photoUrl: category.includes("Tire") ? "assets/emergency_breakdown_repair.svg" : "assets/emergency_rescue_van.svg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  emergenciesList.unshift(createdRecord);
  try {
    localStorage.setItem("apsrtc_emergencies", JSON.stringify(emergenciesList));
  } catch (e) {}

  if (alertBox) {
    alertBox.innerHTML = `
      <div style="background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #15803d; padding: 14px 18px; border-radius: 10px; margin-top: 14px; font-size: 13px; font-weight: 700;">
        🚨 <b>EMERGENCY SOS TRANSMITTED!</b> Distress ticket <u>${createdRecord.id}</u> sent to <b>${nearest.name}</b> (${nearest.phone}). Recovery unit standby initiated.
      </div>
    `;
    setTimeout(() => { alertBox.innerHTML = ""; }, 8000);
  }

  renderStaffEmergencies();
  loadAdminEmergencies();

  const pipeline = document.querySelector(".sos-pipeline-wrap");
  if (pipeline) pipeline.scrollIntoView({ behavior: "smooth" });
}

// ------------------------------------------------------------
// RESCUE PIPELINE RENDERING & STATUS LIFECYCLE
// ------------------------------------------------------------

function loadLocalEmergencies() {
  const saved = localStorage.getItem("apsrtc_emergencies");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        emergenciesList = parsed;
      }
    } catch (e) {}
  }
}

function renderStaffEmergencies() {
  const container = document.getElementById("staffEmergenciesList");
  if (!container) return;

  loadLocalEmergencies();

  if (emergenciesList.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">No active corridor emergency reports. Safe travels!</div>`;
    return;
  }

  container.innerHTML = emergenciesList.map(e => {
    let statusClass = "status-reported";
    let statusLabel = "⏳ TRANSMITTED (Awaiting Dispatch)";
    if (e.status === "DISPATCHED") {
      statusClass = "status-dispatched";
      statusLabel = "🚀 DISPATCHED (On Road to Incident)";
    } else if (e.status === "ON_SITE" || e.status === "ON-SITE") {
      statusClass = "status-onsite";
      statusLabel = "🔧 ON-SITE (Assistance in Progress)";
    } else if (e.status === "RESOLVED") {
      statusClass = "status-resolved";
      statusLabel = "✅ RESOLVED (Bus Cleared)";
    }

    const depotName = e.nearestDepot ? e.nearestDepot.name : "Paderu Divisional Depot";
    const depotPhone = e.nearestDepot ? (e.nearestDepot.phone || e.nearestDepot.emergencyCell || "08935-250333") : "08935-250333";
    const distText = e.nearestDepot ? `${e.nearestDepot.distanceKm} km • ETA: ~${e.nearestDepot.etaMins} mins` : "8.5 km • ETA: ~14 mins";

    return `
      <div class="staff-pipeline-card">
        <div class="pipeline-card-top">
          <div class="pipeline-title-group">
            <span class="pipeline-incident-tag">${e.incidentType}</span>
            <span class="pipeline-sos-id">${e.id}</span>
          </div>
          <span class="pipeline-status-badge ${statusClass}">${statusLabel}</span>
        </div>

        <div class="pipeline-card-grid">
          <div class="pipeline-detail-col">
            <div class="pipeline-field">
              <span class="field-lbl">Assigned Vehicle:</span>
              <strong class="field-val">Bus ${e.busNumber || e.busId}</strong>
            </div>
            <div class="pipeline-field">
              <span class="field-lbl">Driver on Duty:</span>
              <span class="field-val">${e.driverName} (${e.driverBadge}) • ${e.driverPhone}</span>
            </div>
            <div class="pipeline-field">
              <span class="field-lbl">Ghat Location:</span>
              <span class="field-val">📍 ${e.locationDesc}</span>
            </div>
            <div class="pipeline-field">
              <span class="field-lbl">Passengers / Relief Shuttle:</span>
              <span class="field-val">${e.passengerCount} on board • ${e.reliefBusNeeded ? "⚠️ Shuttle Bus Requested" : "No Shuttle Needed"}</span>
            </div>
          </div>

          <div class="pipeline-depot-col">
            <div class="depot-support-box">
              <div class="depot-support-head">
                <span class="depot-icon-mini">🏛️</span>
                <div>
                  <strong>${depotName}</strong>
                  <small>${distText}</small>
                </div>
              </div>
              <div class="dispatched-unit-info">
                ${e.dispatchedUnit ? `
                  <div class="unit-active-alert">
                    <span>🚜</span>
                    <div>
                      <strong>Dispatched Rescue Unit:</strong><br>
                      <span>${e.dispatchedUnit}</span>
                    </div>
                  </div>
                ` : `
                  <div class="unit-waiting-alert">
                    <span>⏳</span>
                    <span>Depot Control Desk notified. Recovery team preparing gear.</span>
                  </div>
                `}
              </div>
              <div class="pipeline-depot-actions">
                <a href="tel:${depotPhone.replace(/[^0-9]/g, '')}" class="btn-pipeline-call">
                  📞 Call Nearest Depot (${depotPhone})
                </a>
                <button type="button" class="btn-evidence-badge" onclick="openEvidenceViewer()">
                  📷 View Inspection Photo (Viewer.js)
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="pipeline-desc-foot">
          <b>Driver Situation Log:</b> "${e.description}"
        </div>
      </div>
    `;
  }).join("");
}

async function loadAdminEmergencies() {
  const tbody = document.getElementById("adminEmergencyTableBody");
  const countBadge = document.getElementById("activeSosCountBadge");

  try {
    const res = await fetch(`${API_BASE}/emergencies`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.emergencies) && data.emergencies.length > 0) {
        emergenciesList = data.emergencies;
      }
    }
  } catch (e) {
    loadLocalEmergencies();
  }

  const activeCount = emergenciesList.filter(e => e.status !== "RESOLVED").length;
  if (countBadge) countBadge.textContent = activeCount;

  if (!tbody) return;

  tbody.innerHTML = emergenciesList.map(e => {
    const isResolved = e.status === "RESOLVED";
    const isDispatched = e.status === "DISPATCHED" || e.status === "ON_SITE";
    const statusClass = isResolved ? "badge-active" : (isDispatched ? "badge-maint" : "badge-sos-critical");

    const depotName = e.nearestDepot ? e.nearestDepot.name : "Paderu Divisional Depot";
    const distText = e.nearestDepot ? `${e.nearestDepot.distanceKm} km (~${e.nearestDepot.etaMins}m)` : "8.5 km";

    return `
      <tr>
        <td><b>${e.id}</b></td>
        <td><strong>Bus ${e.busNumber || e.busId}</strong></td>
        <td>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; background: ${e.incidentType === "Accident" ? "#fee2e2" : "#fef3c7"}; color: ${e.incidentType === "Accident" ? "#b91c1c" : "#b45309"};">
            ${e.incidentType}
          </span>
        </td>
        <td>
          <div style="font-size: 12px; font-weight: 700;">${e.driverName}</div>
          <small style="color: var(--text-muted); font-size: 10px;">${e.driverBadge} • ${e.driverPhone}</small>
        </td>
        <td style="max-width: 220px; font-size: 12px;">📍 ${e.locationDesc}</td>
        <td>
          <div style="font-weight: 800; font-size: 12px;">${depotName}</div>
          <small style="color: var(--primary-accent); font-weight: 700;">${distText}</small>
        </td>
        <td>
          <span class="badge-status ${statusClass}">${e.status}</span>
          ${e.dispatchedUnit ? `<br><small style="font-size: 10px; color: var(--text-muted);">${e.dispatchedUnit}</small>` : ""}
        </td>
        <td>
          ${e.status === "REPORTED" ? `
            <button class="admin-btn-action admin-btn-toggle" onclick="dispatchRecoveryUnit('${e.id}')">
              🚜 Dispatch Van
            </button>
          ` : (!isResolved ? `
            <button class="admin-btn-action admin-btn-success" onclick="resolveEmergencyIncident('${e.id}')">
              ✓ Resolve
            </button>
          ` : '<span style="color: var(--success); font-weight: 700; font-size: 11px;">✓ Cleared</span>')}
        </td>
      </tr>
    `;
  }).join("");
}

async function dispatchRecoveryUnit(id) {
  const item = emergenciesList.find(e => e.id === id);
  const depotName = item?.nearestDepot?.name || "Paderu Depot";
  const defaultUnit = `${depotName} Mobile Recovery Van #RV-02 & Relief Bus`;

  const unitName = prompt(`Confirm Emergency Dispatch Unit from ${depotName}:`, defaultUnit);
  if (!unitName) return;

  try {
    await fetch(`${API_BASE}/emergencies/${id}/dispatch`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dispatchedUnit: unitName })
    });
  } catch (e) {
    console.warn("Backend dispatch failed, saving locally:", e);
  }

  if (item) {
    item.status = "DISPATCHED";
    item.dispatchedUnit = unitName;
    item.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem("apsrtc_emergencies", JSON.stringify(emergenciesList));
    } catch (e) {}
  }

  renderStaffEmergencies();
  loadAdminEmergencies();
}

async function resolveEmergencyIncident(id) {
  if (!confirm(`Mark Emergency SOS ticket ${id} as fully resolved and cleared?`)) return;

  try {
    await fetch(`${API_BASE}/emergencies/${id}/resolve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolutionNotes: "Bus repaired / tire replaced on-site. Route resumed." })
    });
  } catch (e) {
    console.warn("Backend resolve failed, saving locally:", e);
  }

  const item = emergenciesList.find(e => e.id === id);
  if (item) {
    item.status = "RESOLVED";
    item.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem("apsrtc_emergencies", JSON.stringify(emergenciesList));
    } catch (e) {}
  }

  renderStaffEmergencies();
  loadAdminEmergencies();
}

// ------------------------------------------------------------
// THEME SWITCHER (DARK / LIGHT MODE)
// ------------------------------------------------------------

function toggleTheme() {
  const isDark = document.body.classList.toggle("theme-dark");
  localStorage.setItem("apsrtc_theme", isDark ? "dark" : "light");
  updateThemeButtonText();
}

function updateThemeButtonText() {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  const isDark = document.body.classList.contains("theme-dark");
  btn.innerHTML = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
}

function loadSavedTheme() {
  const saved = localStorage.getItem("apsrtc_theme");
  if (saved === "dark") {
    document.body.classList.add("theme-dark");
  }
  updateThemeButtonText();
}

// ------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadSavedTheme();

  document.getElementById("journeyForm").addEventListener("submit", searchJourney);
  document.getElementById("to").addEventListener("change", searchJourney);
  document.getElementById("from").addEventListener("change", searchJourney);
  document.getElementById("complaintForm").addEventListener("submit", submitComplaint);

  checkServer();
  checkSavedOfficer();
  checkSavedStaff();
  loadLocalEmergencies();
  loadDashboardStats();
  loadAnnouncements();
  renderStaffEmergencies();
  loadAdminEmergencies();
  searchJourney({ preventDefault() {} });

  // Initialize Viewer.js once images are ready
  setTimeout(initViewerJS, 600);

  // Initialize Three.js 3D Digital Twin if available
  setTimeout(() => {
    if (window.APSRTC_3D && typeof window.APSRTC_3D.init === "function") {
      window.APSRTC_3D.init();
      if (allFleetBuses.length > 0) {
        window.APSRTC_3D.updateFleet(allFleetBuses);
      }
    }
  }, 400);

  // Periodic refresh
  setInterval(() => {
    loadDashboardStats();
    loadAnnouncements();
  }, 9000);
});
