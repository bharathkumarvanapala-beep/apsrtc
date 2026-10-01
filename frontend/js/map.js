// frontend/js/map.js

let map;
const busMarkers = new Map();
const stopMarkers = new Map();
let routePolyline;
let routeGlowPolyline;

const corridorStops = [
  { name: "Araku", lat: 18.3270, lng: 82.8730, order: 0 },
  { name: "Ananthagiri", lat: 18.2800, lng: 82.7000, order: 1 },
  { name: "Paderu", lat: 18.0730, lng: 82.6600, order: 2 },
  { name: "G. Madugula", lat: 18.0816, lng: 82.6700, order: 3 },
  { name: "Chintapalli", lat: 18.1300, lng: 82.6900, order: 4 },
  { name: "Anakapalle", lat: 17.6900, lng: 83.0000, order: 5 },
  { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185, order: 6 }
];

function createBusIcon(bus) {
  return L.divIcon({
    className: "bus-div-marker",
    iconSize: [60, 40],
    iconAnchor: [30, 40],
    popupAnchor: [0, -36],
    html: `
      <div class="bus-marker-wrapper">
        <div class="bus-marker-pulse"></div>
        <div class="bus-marker-pill">
          <span class="bus-marker-icon">🚌</span>
          <span class="bus-marker-num">${bus.number}</span>
        </div>
        <div class="bus-marker-pin"></div>
      </div>
    `
  });
}

function createStopIcon(stop) {
  return L.divIcon({
    className: "stop-div-marker",
    iconSize: [120, 24],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
    html: `
      <div class="stop-marker-wrapper">
        <span class="stop-circle"></span>
        <span class="stop-label">${stop.name}</span>
      </div>
    `
  });
}

function initMap() {
  if (map) return;

  // Initialize map centered on the corridor
  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([18.05, 82.85], 9);

  // Reliable free tiles (CartoDB Voyager: reliable, clean, does not block file:// or localhost)
  const primaryTiles = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: ["a", "b", "c", "d"],
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  );

  primaryTiles.on("tileerror", () => {
    // Graceful fallback to Esri World Street Map if Carto is unreachable
    if (!map.hasLayer(fallbackTiles)) {
      map.removeLayer(primaryTiles);
      fallbackTiles.addTo(map);
    }
  });

  const fallbackTiles = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }
  );

  primaryTiles.addTo(map);

  // Draw Route Corridor Polyline connecting all stops
  drawCorridor();

  // Add Route Stops
  renderStops(corridorStops);

  // Add map legend
  addLegend();

  // Fit bounds to entire route corridor
  if (routePolyline) {
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
  }
}

function drawCorridor() {
  const latLngs = corridorStops.map(s => [s.lat, s.lng]);

  // Background glow
  routeGlowPolyline = L.polyline(latLngs, {
    color: "#14532d",
    weight: 8,
    opacity: 0.25,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);

  // Foreground road track
  routePolyline = L.polyline(latLngs, {
    color: "#16a34a",
    weight: 4,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);
}

function renderStops(stops) {
  stops.forEach(stop => {
    const popupHtml = `
      <div class="map-stop-popup">
        <strong>📍 ${stop.name}</strong>
        <div class="stop-popup-btn-group">
          <button class="stop-popup-btn" onclick="setStopFrom('${stop.name}')">🛫 Set as Origin (From)</button>
          <button class="stop-popup-btn" onclick="setStopTo('${stop.name}')">🎯 Set as Destination (To)</button>
        </div>
      </div>
    `;

    const marker = L.marker([stop.lat, stop.lng], {
      icon: createStopIcon(stop),
      zIndexOffset: 100
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
          <strong>Bus ${bus.number}</strong>
          <span class="pill">ACTIVE</span>
        </div>
        <div class="map-popup-row">📍 <span>Location:</span> <b>${bus.locationName}</b></div>
        <div class="map-popup-row">🚌 <span>Route:</span> <b>${bus.route}</b></div>
        <div class="map-popup-row">🧭 <span>Direction:</span> <b>${bus.direction}</b></div>
        <div class="map-popup-row">⚡ <span>Speed:</span> <b>${bus.speedKph} km/h</b></div>
        <div class="map-popup-row">🕒 <span>Updated:</span> <b>${new Date(bus.updatedAt).toLocaleTimeString()}</b></div>
      </div>
    `;

    if (!busMarkers.has(bus.id)) {
      const marker = L.marker([bus.lat, bus.lng], {
        icon: createBusIcon(bus),
        zIndexOffset: 500
      })
        .addTo(map)
        .bindPopup(popupHtml, { className: "custom-map-popup" });

      busMarkers.set(bus.id, marker);
    } else {
      const marker = busMarkers.get(bus.id);
      marker.setLatLng([bus.lat, bus.lng]);
      marker.setIcon(createBusIcon(bus));
      marker.setPopupContent(popupHtml);
    }
  });

  if (fleetList) {
    fleetList.innerHTML = list.map(bus => `
      <div class="fleet-item" onclick="focusBus('${bus.id}')" title="Click to view Bus ${bus.number} on map">
        <b>Bus ${bus.number}</b>
        <span>📍 ${bus.locationName}</span>
        <span> • ${bus.speedKph} km/h</span>
      </div>
    `).join("");
  }
}

function addLegend() {
  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = function() {
    const div = L.DomUtil.create("div", "map-legend-control");
    div.innerHTML = `
      <div class="legend-item"><span class="legend-dot-bus"></span> Live Bus</div>
      <div class="legend-item"><span class="legend-dot-stop"></span> Route Stop</div>
      <div class="legend-item"><span class="legend-line-route"></span> Araku-Vizag Corridor</div>
    `;
    return div;
  };
  legend.addTo(map);
}

// Global interactions for popups and fleet list
window.setStopFrom = function(stopName) {
  const fromInput = document.getElementById("from");
  if (fromInput) {
    fromInput.value = stopName;
    if (typeof searchJourney === "function") {
      searchJourney({ preventDefault() {} });
    }
  }
  map.closePopup();
};

window.setStopTo = function(stopName) {
  const toInput = document.getElementById("to");
  if (toInput) {
    toInput.value = stopName;
    if (typeof searchJourney === "function") {
      searchJourney({ preventDefault() {} });
    }
  }
  map.closePopup();
};

window.focusBus = function(busId) {
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
      fleetList.innerHTML = "<p>Backend unavailable. Start the server.</p>";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadFleet();

  if (typeof io !== "undefined") {
    const socket = io("http://localhost:5000");
    socket.on("fleet:snapshot", renderFleet);
    socket.on("fleet:update", renderFleet);
  }

  setInterval(loadFleet, 10000);
});
