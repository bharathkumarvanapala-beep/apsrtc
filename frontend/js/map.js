// frontend/js/map.js - APSRTC SmartTrack Advanced Fleet & 3D Telemetry Map

let map;
const busMarkers = new Map();
const stopMarkers = new Map();
let routePolyline;
let routeGlowPolyline;

// Basemap Layers
let currentBasemapLayer = null;
let currentOverlayLayer = null;
const baseLayers = {};

const corridorStops = [
  { name: "Araku", telugu: "అరకు", lat: 18.3270, lng: 82.8730, order: 0, alt: "912m" },
  { name: "Ananthagiri", telugu: "అనంతగిరి", lat: 18.2800, lng: 82.7000, order: 1, alt: "680m" },
  { name: "Paderu", telugu: "పాడేరు", lat: 18.0730, lng: 82.6600, order: 2, alt: "900m" },
  { name: "G. Madugula", telugu: "జి. మాడుగుల", lat: 18.0816, lng: 82.6700, order: 3, alt: "650m" },
  { name: "Chintapalli", telugu: "చింతపల్లి", lat: 18.1300, lng: 82.6900, order: 4, alt: "830m" },
  { name: "Anakapalle", telugu: "అనకాపల్లి", lat: 17.6900, lng: 83.0000, order: 5, alt: "40m" },
  { name: "Visakhapatnam", telugu: "విశాఖపట్నం", lat: 17.6868, lng: 83.2185, order: 6, alt: "15m" }
];

function createBusIcon(bus) {
  const isMoving = bus.speedKph > 0;
  return L.divIcon({
    className: "bus-div-marker",
    iconSize: [64, 46],
    iconAnchor: [32, 44],
    popupAnchor: [0, -40],
    html: `
      <div class="bus-marker-wrapper ${isMoving ? "bus-in-motion" : ""}">
        <div class="bus-marker-pulse"></div>
        <div class="bus-marker-shadow"></div>
        <div class="bus-marker-pill">
          <span class="bus-marker-icon">🚌</span>
          <span class="bus-marker-num">${bus.number}</span>
          <span class="bus-marker-speed">${bus.speedKph || 38}k</span>
        </div>
        <div class="bus-marker-pin"></div>
      </div>
    `
  });
}

function createStopIcon(stop) {
  return L.divIcon({
    className: "stop-div-marker",
    iconSize: [140, 28],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
    html: `
      <div class="stop-marker-wrapper">
        <span class="stop-circle"></span>
        <span class="stop-label">
          <span class="stop-eng">${stop.name}</span>
          <span class="stop-tel">${stop.telugu || ""}</span>
        </span>
      </div>
    `
  });
}

function initMap() {
  if (map) return;

  // Initialize map centered on the corridor
  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: false
  }).setView([18.05, 82.85], 9);

  // Basemap layers:
  // 1. Esri World Imagery (Satellite) - Perfect for Ghat terrain
  baseLayers.satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19 }
  );

  // Satellite Reference Labels (Borders & Roads)
  baseLayers.satelliteLabels = L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19 }
  );

  // 2. OpenStreetMap Standard (Crisp Transit Streets)
  baseLayers.streets = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  );

  // 3. Esri Dark Gray (Night Radar)
  baseLayers.dark = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16 }
  );

  // Default to High-Res Satellite GIS (looks ultra premium for mountain ghat tracking)
  setBasemap("satellite");

  // Draw Route Corridor Polyline connecting all stops
  drawCorridor();

  // Add Route Stops
  renderStops(corridorStops);

  // Add Custom Map Toolbar (Basemap toggle, 3D Tilt perspective, reset view)
  addCustomMapControls();

  // Add map legend
  addLegend();

  // Fit bounds to entire route corridor
  if (routePolyline) {
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
  }
}

function setBasemap(type) {
  if (!map) return;

  // Remove existing base layer
  if (currentBasemapLayer) {
    map.removeLayer(currentBasemapLayer);
  }
  if (currentOverlayLayer) {
    map.removeLayer(currentOverlayLayer);
    currentOverlayLayer = null;
  }

  if (type === "satellite") {
    currentBasemapLayer = baseLayers.satellite.addTo(map);
    currentOverlayLayer = baseLayers.satelliteLabels.addTo(map);
  } else if (type === "streets") {
    currentBasemapLayer = baseLayers.streets.addTo(map);
  } else if (type === "dark") {
    currentBasemapLayer = baseLayers.dark.addTo(map);
  }

  // Update UI active buttons
  document.querySelectorAll(".map-basemap-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function drawCorridor() {
  const latLngs = corridorStops.map(s => [s.lat, s.lng]);

  // Background glow
  routeGlowPolyline = L.polyline(latLngs, {
    color: "#22c55e",
    weight: 9,
    opacity: 0.35,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);

  // Foreground road track
  routePolyline = L.polyline(latLngs, {
    color: "#16a34a",
    weight: 4.5,
    opacity: 0.95,
    lineCap: "round",
    lineJoin: "round",
    dashArray: "1, 10"
  }).addTo(map);

  // Solid road edge
  L.polyline(latLngs, {
    color: "#f59e0b",
    weight: 2,
    opacity: 0.8
  }).addTo(map);
}

function renderStops(stops) {
  stops.forEach((stop, index) => {
    const popupHtml = `
      <div class="map-stop-popup">
        <div class="map-stop-popup-head">
          <span class="depot-tag">DEPOT 0${index + 1}</span>
          <strong>📍 ${stop.name} <span class="tel-inline">(${stop.telugu})</span></strong>
          <small class="alt-badge">⛰️ Elevation: ${stop.alt || "MSL"}</small>
        </div>
        <div class="stop-popup-btn-group">
          <button class="stop-popup-btn" onclick="setStopFrom('${stop.name}')">🛫 Set as Origin (From)</button>
          <button class="stop-popup-btn" onclick="setStopTo('${stop.name}')">🎯 Set as Destination (To)</button>
          <button class="stop-popup-btn stop-popup-btn-photo" onclick="openDepotGallery('${stop.name}')">📸 View Depot Photos</button>
        </div>
      </div>
    `;

    const marker = L.marker([stop.lat, stop.lng], {
      icon: createStopIcon(stop),
      zIndexOffset: 150
    })
      .addTo(map)
      .bindPopup(popupHtml, { className: "custom-map-popup" });

    stopMarkers.set(stop.name, marker);
  });
}

function renderFleet(list) {
  const fleetList = document.getElementById("fleetList");
  if (!map) return;

  list.forEach(bus => {
    const popupHtml = `
      <div class="map-bus-popup">
        <div class="map-bus-popup-head">
          <div>
            <strong>🚌 Bus ${bus.number}</strong>
            <span class="bus-model-sub">${bus.model || "Super Luxury 2+2"}</span>
          </div>
          <span class="pill pill-active">LIVE GPS</span>
        </div>
        <div class="map-popup-row">📍 <span>Current Station:</span> <b>${bus.locationName}</b></div>
        <div class="map-popup-row">🧭 <span>Direction:</span> <b>${bus.direction}</b></div>
        <div class="map-popup-row">⚡ <span>Corridor Velocity:</span> <b>${bus.speedKph} km/h</b></div>
        <div class="map-popup-row">📶 <span>GPS Accuracy:</span> <b>±${bus.accuracy || 4} m</b></div>
        <div class="map-popup-actions">
          <button class="btn-3d-jump" onclick="jumpTo3DViewer('${bus.id}')">
            🚀 View in 3D Digital Twin
          </button>
          <button class="btn-popup-gallery" onclick="openFleetGallery('${bus.number}')">
            📷 Vehicle Visuals
          </button>
        </div>
      </div>
    `;

    if (!busMarkers.has(String(bus.id))) {
      const marker = L.marker([bus.lat, bus.lng], {
        icon: createBusIcon(bus),
        zIndexOffset: 600
      })
        .addTo(map)
        .bindPopup(popupHtml, { className: "custom-map-popup" });

      busMarkers.set(String(bus.id), marker);
    } else {
      const marker = busMarkers.get(String(bus.id));
      marker.setLatLng([bus.lat, bus.lng]);
      marker.setIcon(createBusIcon(bus));
      marker.setPopupContent(popupHtml);
    }
  });

  if (fleetList) {
    fleetList.innerHTML = list.map(bus => `
      <div class="fleet-item" onclick="focusBus('${bus.id}')" title="Click to track Bus ${bus.number}">
        <div class="fleet-item-left">
          <span class="fleet-bus-badge">🚌 ${bus.number}</span>
          <div>
            <b>${bus.locationName}</b>
            <small class="fleet-dir">${bus.direction}</small>
          </div>
        </div>
        <div class="fleet-item-right">
          <span class="fleet-speed">${bus.speedKph} km/h</span>
          <button class="btn-fleet-3d" onclick="event.stopPropagation(); jumpTo3DViewer('${bus.id}')" title="3D Digital Twin">
            3D
          </button>
        </div>
      </div>
    `).join("");
  }

  // Also update Three.js 3D Digital Twin if available
  if (window.APSRTC_3D && typeof window.APSRTC_3D.updateFleet === "function") {
    window.APSRTC_3D.updateFleet(list);
  }
}

function addCustomMapControls() {
  const customControl = L.control({ position: "topright" });
  customControl.onAdd = function () {
    const div = L.DomUtil.create("div", "map-custom-controls");
    div.innerHTML = `
      <div class="map-ctrl-group">
        <button class="map-basemap-btn active" data-type="satellite" onclick="setBasemap('satellite')">🛰️ Satellite</button>
        <button class="map-basemap-btn" data-type="streets" onclick="setBasemap('streets')">🗺️ Streets</button>
        <button class="map-basemap-btn" data-type="dark" onclick="setBasemap('dark')">🌙 Night</button>
      </div>
      <button class="map-3d-tilt-btn" id="map3dTiltBtn" onclick="toggleMap3DTilt()">
        🕹️ 3D Perspective Tilt
      </button>
    `;
    return div;
  };
  customControl.addTo(map);
}

function addLegend() {
  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "map-legend-control");
    div.innerHTML = `
      <div class="legend-item"><span class="legend-dot-bus"></span> Active Bus</div>
      <div class="legend-item"><span class="legend-dot-stop"></span> Depot Station</div>
      <div class="legend-item"><span class="legend-line-route"></span> Araku-Vizag Highway</div>
    `;
    return div;
  };
  legend.addTo(map);
}

// ------------------------------------------------------------
// 3D PERSPECTIVE TILT TOGGLE
// ------------------------------------------------------------
let is3DTiltActive = false;

window.toggleMap3DTilt = function () {
  is3DTiltActive = !is3DTiltActive;
  const mapEl = document.getElementById("map");
  const btn = document.getElementById("map3dTiltBtn");

  if (mapEl) {
    mapEl.classList.toggle("map-3d-perspective-active", is3DTiltActive);
  }

  if (btn) {
    btn.classList.toggle("active", is3DTiltActive);
    btn.innerHTML = is3DTiltActive ? "📐 Reset 2D View" : "🕹️ 3D Perspective Tilt";
  }

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 350);
};

// ------------------------------------------------------------
// INTERACTIVE BRIDGES TO 3D DIGITAL TWIN & GALLERY
// ------------------------------------------------------------

window.jumpTo3DViewer = function (busId) {
  const section = document.getElementById("digitalTwin3D");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
    if (window.APSRTC_3D) {
      window.APSRTC_3D.focusBus(busId);
      window.APSRTC_3D.setCameraMode("drone");
    }
  }
};

window.openDepotGallery = function (stationName) {
  const gallerySection = document.getElementById("gallery");
  if (gallerySection) {
    gallerySection.scrollIntoView({ behavior: "smooth" });
  }
  if (window.triggerViewerByStation) {
    window.triggerViewerByStation(stationName);
  }
};

window.openFleetGallery = function (busNum) {
  const gallerySection = document.getElementById("gallery");
  if (gallerySection) {
    gallerySection.scrollIntoView({ behavior: "smooth" });
  }
  if (window.triggerViewerByFleet) {
    window.triggerViewerByFleet(busNum);
  }
};

window.setStopFrom = function (stopName) {
  const fromInput = document.getElementById("from");
  if (fromInput) {
    fromInput.value = stopName;
    if (typeof searchJourney === "function") {
      searchJourney({ preventDefault() {} });
    }
  }
  if (map) map.closePopup();
};

window.setStopTo = function (stopName) {
  const toInput = document.getElementById("to");
  if (toInput) {
    toInput.value = stopName;
    if (typeof searchJourney === "function") {
      searchJourney({ preventDefault() {} });
    }
  }
  if (map) map.closePopup();
};

window.focusBus = function (busId) {
  const marker = busMarkers.get(String(busId));
  if (marker && map) {
    map.flyTo(marker.getLatLng(), 12, { animate: true, duration: 1 });
    marker.openPopup();
  }
};

async function loadFleet() {
  try {
    const response = await fetch(`${API_BASE}/buses`);
    const data = await response.json();
    renderFleet(data.buses);
    if (typeof fillComplaintBus === "function") {
      fillComplaintBus();
    }
  } catch {
    const fleetList = document.getElementById("fleetList");
    if (fleetList) {
      fleetList.innerHTML = "<p style='padding: 12px; color: var(--text-muted);'>Backend connecting...</p>";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadFleet();

  // Socket.io live updates
  if (typeof io !== "undefined") {
    const socket = io("http://localhost:5000");
    socket.on("fleet:snapshot", renderFleet);
    socket.on("fleet:update", renderFleet);
  }

  // Periodic poll
  setInterval(loadFleet, 8000);
});
