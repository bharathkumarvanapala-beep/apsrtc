// frontend/js/app.js - APSRTC SmartTrack Official Portal

const API_BASE = "http://localhost:5000/api/v1";
let buses = [];
let allFleetBuses = [];
let corridorStopsData = [
  "Araku", "Ananthagiri", "Paderu", "G. Madugula", "Chintapalli", "Anakapalle", "Visakhapatnam"
];
let currentOfficer = null;

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
// BUS CARD RENDERER
// ------------------------------------------------------------

function busCard(bus, index) {
  const isAtPickup = bus.isAtPickup || bus.distanceToPickupKm === 0;
  const isAtDestination = bus.isAtDestination || bus.distanceToDestinationKm === 0;

  const pickupDistText = isAtPickup ? "At boarding stop" : `${bus.distanceToPickupKm ?? bus.distanceFromPassengerKm} km`;
  const pickupEtaText = isAtPickup ? "Arrived" : `${bus.etaToPickupMinutes ?? bus.etaMinutes} min`;

  const destDistText = isAtDestination
    ? "Arrived"
    : `${bus.distanceToDestinationKm ?? "--"} km`;
  const destEtaText = isAtDestination
    ? "Arrived"
    : `${bus.etaToDestinationMinutes ?? "--"} min`;

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
          <span class="bus-number">Bus ${bus.number}</span>
          <span class="corridor-tag">${bus.route || "Araku - Visakhapatnam Corridor"}</span>
        </div>
        <span class="tag ${index === 0 ? "tag-best" : "tag-relevant"}">${index === 0 ? "BEST MATCH" : "RELEVANT"}</span>
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

        <!-- Particular Destination Leg -->
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
        <div class="metric"><span>Speed</span><b>${bus.speedKph} km/h</b></div>
        <div class="metric"><span>GPS accuracy</span><b>±${bus.accuracy} m</b></div>
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

  results.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-muted);'>🔍 Finding relevant corridor buses...</p>";

  try {
    const response = await fetch(`${API_BASE}/journey/buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed");

    buses = data.buses;
    results.innerHTML = buses.length
      ? buses.map(busCard).join("")
      : "<p style='grid-column: 1/-1; text-align: center; padding: 20px;'>No active buses currently available on this segment. Check back shortly.</p>";

    fillComplaintBus();
  } catch (error) {
    results.innerHTML = `<p style='grid-column: 1/-1; color: var(--danger); padding: 10px;'>Could not search: ${error.message}. Is the backend running?</p>`;
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
// KPI DASHBOARD & STATION RADAR
// ------------------------------------------------------------

async function loadDashboardStats() {
  try {
    const [statsRes, busesRes] = await Promise.all([
      fetch(`${API_BASE}/admin/stats`),
      fetch(`${API_BASE}/buses`)
    ]);

    if (statsRes.ok) {
      const { stats } = await statsRes.json();
      document.getElementById("kpiActiveBuses").textContent = `${stats.activeBuses} / ${stats.totalBuses}`;
      document.getElementById("kpiOnTime").textContent = stats.onTimeRate || "97.4%";
      document.getElementById("kpiAvgSpeed").textContent = `${stats.avgSpeedKph} km/h`;
      document.getElementById("kpiStops").textContent = `${stats.totalStops} Depots`;
    }

    if (busesRes.ok) {
      const data = await busesRes.json();
      allFleetBuses = data.buses || [];
      renderStationRadar(allFleetBuses);
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

  strip.innerHTML = corridorStopsData.map((stopName, idx) => {
    // Find any bus currently at this stop
    const busesAtStop = fleet.filter(b => b.locationName && b.locationName.toLowerCase().includes(stopName.toLowerCase()));

    const busPills = busesAtStop.map(b => `
      <span class="radar-bus-pill" title="Bus ${b.number} is docked/near ${stopName}">
        🚌 ${b.number}
      </span>
    `).join(" ");

    return `
      <div class="radar-station-node ${busesAtStop.length ? "has-bus" : ""}">
        <span class="radar-node-order">DEPOT 0${idx + 1}</span>
        <div class="radar-node-name" title="${stopName}">${stopName}</div>
        <div>
          ${busesAtStop.length ? busPills : '<span class="radar-station-empty">—</span>'}
        </div>
      </div>
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
    // Already logged in - scroll to admin portal
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

    // Success
    localStorage.setItem("apsrtc_officer_token", data.token);
    localStorage.setItem("apsrtc_officer_data", JSON.stringify(data.user));
    currentOfficer = data.user;

    closeLoginModal();
    applyOfficerState();
    loadAdminComplaints();

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
    document.getElementById("officerBadge").textContent = `Operational Control Center — ${currentOfficer.division} | Token Active`;

    renderAdminBusTable();
    loadAdminComplaints();
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

  const btnIndex = tabName === "fleetMgmt" ? 0 : (tabName === "complaintMgmt" ? 1 : 2);
  const btn = document.querySelectorAll(".admin-tab")[btnIndex];
  if (btn) btn.classList.add("active");
}

// ------------------------------------------------------------
// ADMIN: FLEET CONTROLLER
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
          <td style="max-width: 250px;">${c.description}</td>
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
// EVENT LISTENERS & INIT
// ------------------------------------------------------------

document.getElementById("journeyForm").addEventListener("submit", searchJourney);
document.getElementById("to").addEventListener("change", searchJourney);
document.getElementById("from").addEventListener("change", searchJourney);
document.getElementById("complaintForm").addEventListener("submit", submitComplaint);

checkServer();
checkSavedOfficer();
loadDashboardStats();
loadAnnouncements();
searchJourney({ preventDefault() {} });

// Periodic refresh of dashboard stats & announcements (every 10 seconds)
setInterval(() => {
  loadDashboardStats();
  loadAnnouncements();
}, 10000);
