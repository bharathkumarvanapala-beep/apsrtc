/**
 * APSRTC SmartTrack Interactive Fleet Map
 * Integrates Google Maps Roadmap, Satellite, and Terrain tile layers
 * with real-time multi-bus marker tracking, multi-corridor route polylines, and stop pins.
 * 
 * Supports all three primary Eastern Ghats & Coastal Corridors:
 * 1. Araku – Paderu – Chintapalli – Anakapalle – Visakhapatnam (Corridor 1)
 * 2. Paderu – Chodavaram – Pendurthi – Visakhapatnam (Corridor 2 - Direct SH-39)
 * 3. Paderu – Araku Valley – S. Kota – Pendurthi – Visakhapatnam (Corridor 3)
 */

let mapInstance = null;
const busMarkers = new Map(); // busNumber -> Leaflet Marker
let corridorPolylines = [];
let stopMarkersGroup = null;

// Base tile layers
let googleRoadmapLayer = null;
let googleSatelliteLayer = null;
let googleTerrainLayer = null;
let cartoTransitLayer = null;

// Multi-Corridor Route Definitions
const CORRIDORS = [
  {
    id: 'chintapalli',
    name: 'Araku – Paderu – Chintapalli – Anakapalle – Vizag',
    shortName: 'Via Chintapalli & Anakapalle',
    casingColor: '#004d38', // APSRTC Deep Forest Teal Casing
    casingWeight: 7,
    lineColor: '#ffb703',   // Golden Amber
    weight: 4,
    dashArray: '10, 6',
    points: [
      { name: 'Araku Valley RTC Complex', lat: 18.3273, lon: 82.8775 },
      { name: 'Ananthagiri Hills Viewpoint', lat: 18.2372, lon: 83.0117 },
      { name: 'Paderu Bus Complex', lat: 18.0816, lon: 82.6700 },
      { name: 'G. Madugula Junction', lat: 17.9500, lon: 82.5167 },
      { name: 'Chintapalli RTC Stand', lat: 17.8700, lon: 82.3500 },
      { name: 'Narsipatnam Road Junction', lat: 17.7800, lon: 82.6800 },
      { name: 'Anakapalle Bypass RTC Stand', lat: 17.6913, lon: 83.0039 },
      { name: 'Lankelapalem NH-16 Toll Plaza', lat: 17.6950, lon: 83.1200 },
      { name: 'Gajuwaka Industrial Hub', lat: 17.6890, lon: 83.2100 },
      { name: 'NAD Kotha Road Flyover', lat: 17.7380, lon: 83.2450 },
      { name: 'Visakhapatnam Dwaraka RTC Complex', lat: 17.7215, lon: 83.3032 }
    ]
  },
  {
    id: 'chodavaram',
    name: 'Paderu – Chodavaram – Pendurthi – Vizag (Direct SH-39)',
    shortName: 'Via Chodavaram & Pendurthi',
    casingColor: '#075985', // Dark Navy Slate Casing
    casingWeight: 7,
    lineColor: '#38bdf8',   // Bright Cyan / Sky Blue
    weight: 4,
    dashArray: '9, 5',
    points: [
      { name: 'Paderu Bus Complex', lat: 18.0816, lon: 82.6700 },
      { name: 'Minumuluru Ghat Viewpoint', lat: 18.0350, lon: 82.7450 },
      { name: 'Vaddadi Ghat Junction', lat: 17.8400, lon: 82.9000 },
      { name: 'Chodavaram RTC Bus Stand', lat: 17.8288, lon: 82.9328 },
      { name: 'Sabbavaram Junction', lat: 17.7850, lon: 83.1300 },
      { name: 'Pendurthi RTC Bus Stop', lat: 17.8239, lon: 83.2014 },
      { name: 'NAD Kotha Road Flyover', lat: 17.7380, lon: 83.2450 },
      { name: 'Visakhapatnam Dwaraka RTC Complex', lat: 17.7215, lon: 83.3032 }
    ]
  },
  {
    id: 'skota',
    name: 'Paderu – Araku Valley – S. Kota – Pendurthi – Vizag',
    shortName: 'Via Araku, S. Kota & Pendurthi',
    casingColor: '#6b21a8', // Deep Purple Casing
    casingWeight: 7,
    lineColor: '#f43f5e',   // Vivid Coral / Rose Red
    weight: 4,
    dashArray: '9, 5',
    points: [
      { name: 'Paderu Bus Complex', lat: 18.0816, lon: 82.6700 },
      { name: 'Dumbriguda Agency Valley', lat: 18.2300, lon: 82.7600 },
      { name: 'Araku Valley RTC Complex', lat: 18.3273, lon: 82.8775 },
      { name: 'Ananthagiri Hills Viewpoint', lat: 18.2372, lon: 83.0117 },
      { name: 'Tyda Eastern Ghat Pass', lat: 18.1500, lon: 83.0500 },
      { name: 'Srungavarapukota (S. Kota) RTC Stand', lat: 18.1150, lon: 83.1450 },
      { name: 'Kothavalasa Junction', lat: 17.8967, lon: 83.1900 },
      { name: 'Pendurthi RTC Bus Stop', lat: 17.8239, lon: 83.2014 },
      { name: 'NAD Kotha Road Flyover', lat: 17.7380, lon: 83.2450 },
      { name: 'Visakhapatnam Dwaraka RTC Complex', lat: 17.7215, lon: 83.3032 }
    ]
  }
];

// Master Stop List with District & Serviced Corridors
const MASTER_CORRIDOR_STOPS = [
  {
    name: 'Araku Valley RTC Complex',
    shortName: 'Araku',
    code: 'ARK',
    lat: 18.3273,
    lon: 82.8775,
    isTerminal: true,
    district: 'Alluri Sitharama Raju',
    corridors: ['Via Chintapalli', 'Via S. Kota & Pendurthi']
  },
  {
    name: 'Ananthagiri Hills Viewpoint',
    shortName: 'Ananthagiri',
    code: 'ATG',
    lat: 18.2372,
    lon: 83.0117,
    isTerminal: false,
    district: 'Alluri Sitharama Raju',
    corridors: ['Via Chintapalli', 'Via S. Kota & Pendurthi']
  },
  {
    name: 'Paderu RTC Bus Complex',
    shortName: 'Paderu',
    code: 'PDR',
    lat: 18.0816,
    lon: 82.6700,
    isTerminal: true,
    district: 'Alluri Sitharama Raju',
    corridors: ['Via Chintapalli', 'Via Chodavaram (Direct)', 'Via Araku & S. Kota']
  },
  {
    name: 'G. Madugula Junction',
    shortName: 'G. Madugula',
    code: 'GMD',
    lat: 17.9500,
    lon: 82.5167,
    isTerminal: false,
    district: 'Alluri Sitharama Raju',
    corridors: ['Via Chintapalli']
  },
  {
    name: 'Chintapalli RTC Stand',
    shortName: 'Chintapalli',
    code: 'CTP',
    lat: 17.8700,
    lon: 82.3500,
    isTerminal: false,
    district: 'Alluri Sitharama Raju',
    corridors: ['Via Chintapalli']
  },
  {
    name: 'Chodavaram RTC Bus Stand',
    shortName: 'Chodavaram',
    code: 'CDV',
    lat: 17.8288,
    lon: 82.9328,
    isTerminal: false,
    district: 'Anakapalle / Visakhapatnam',
    corridors: ['Via Chodavaram & Pendurthi (Direct SH-39)']
  },
  {
    name: 'Srungavarapukota (S. Kota) RTC Stand',
    shortName: 'S. Kota',
    code: 'SKT',
    lat: 18.1150,
    lon: 83.1450,
    isTerminal: false,
    district: 'Vizianagaram / Visakhapatnam',
    corridors: ['Via Araku, S. Kota & Pendurthi']
  },
  {
    name: 'Pendurthi RTC Bus Junction',
    shortName: 'Pendurthi',
    code: 'PDT',
    lat: 17.8239,
    lon: 83.2014,
    isTerminal: false,
    district: 'Visakhapatnam',
    corridors: ['Via Chodavaram & Pendurthi', 'Via Araku & S. Kota']
  },
  {
    name: 'Anakapalle Bypass RTC Stand',
    shortName: 'Anakapalle',
    code: 'AKP',
    lat: 17.6913,
    lon: 83.0039,
    isTerminal: false,
    district: 'Anakapalle',
    corridors: ['Via Chintapalli']
  },
  {
    name: 'Visakhapatnam Dwaraka RTC Complex',
    shortName: 'Visakhapatnam',
    code: 'VSKP',
    lat: 17.7215,
    lon: 83.3032,
    isTerminal: true,
    district: 'Visakhapatnam (City RTC Terminal)',
    corridors: ['Via Chintapalli', 'Via Chodavaram', 'Via S. Kota']
  }
];

function initMap(containerId = 'fleetMap') {
  if (typeof L === 'undefined') {
    console.warn('Leaflet library not loaded, fleet map unavailable');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) return null;

  // Clean existing instance if re-initializing
  if (mapInstance) {
    try { mapInstance.remove(); } catch (e) {}
    mapInstance = null;
    busMarkers.clear();
    corridorPolylines = [];
  }

  // Initialize Map centered on Paderu / Eastern Ghats Corridor
  mapInstance = L.map(containerId, {
    zoomControl: false,
    scrollWheelZoom: true
  }).setView([17.98, 82.85], 9);

  // Position Zoom Control cleanly at top-left
  L.control.zoom({ position: 'topleft' }).addTo(mapInstance);

  // 1. Google Maps Roadmap Layer (Standard Indian Highway / Town Navigation)
  googleRoadmapLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps | APSRTC SmartTrack'
  });

  // 2. Google Maps Satellite / Hybrid Layer
  googleSatelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps Satellite'
  });

  // 3. Google Maps Terrain Layer (Highlights Eastern Ghats elevation and hill roads)
  googleTerrainLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps Terrain'
  });

  // 4. CartoDB Voyager Transit Layer (Clean high-contrast backup)
  cartoTransitLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; CartoDB &copy; OpenStreetMap'
  });

  // Set Google Roadmap as default layer
  googleRoadmapLayer.addTo(mapInstance);

  // Add Interactive Layer Switcher
  const baseMaps = {
    "🗺️ Google Roadmap": googleRoadmapLayer,
    "🛰️ Google Satellite": googleSatelliteLayer,
    "🏔️ Google Terrain": googleTerrainLayer,
    "🏙️ Carto Transit": cartoTransitLayer
  };

  L.control.layers(baseMaps, null, { position: 'topright', collapsed: false }).addTo(mapInstance);

  // Draw all three corridor route polylines
  drawCorridors();

  // Add Official APSRTC Stop Markers
  drawStopMarkers();

  // Fit bounds to smoothly encompass all 3 corridors
  fitNetworkBounds();

  return mapInstance;
}

/**
 * Draw polylines for all 3 corridors with glowing casings and colored dashed lines
 */
function drawCorridors() {
  corridorPolylines = [];

  CORRIDORS.forEach(corridor => {
    const latLngs = corridor.points.map(p => [p.lat, p.lon]);

    // Background glowing casing
    const casing = L.polyline(latLngs, {
      color: corridor.casingColor,
      weight: corridor.casingWeight,
      opacity: 0.65,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(mapInstance);

    // Foreground dashed corridor line
    const foreground = L.polyline(latLngs, {
      color: corridor.lineColor,
      weight: corridor.weight,
      opacity: 0.95,
      dashArray: corridor.dashArray,
      lineJoin: 'round'
    }).addTo(mapInstance);

    // Tooltip showing route name
    foreground.bindTooltip(`<strong>🛣️ ${corridor.name}</strong><br><span style="font-size: 0.72rem; color: #475569;">${corridor.shortName}</span>`, {
      sticky: true,
      direction: 'top'
    });

    corridorPolylines.push({
      id: corridor.id,
      casing,
      foreground
    });
  });
}

/**
 * Draw stop pins for all stops across the 3 corridors
 */
function drawStopMarkers() {
  if (stopMarkersGroup) {
    mapInstance.removeLayer(stopMarkersGroup);
  }
  stopMarkersGroup = L.layerGroup().addTo(mapInstance);

  MASTER_CORRIDOR_STOPS.forEach((stop, index) => {
    const isTerminal = stop.isTerminal;
    const pinColor = isTerminal ? '#c62828' : '#00674d';
    const pinSize = isTerminal ? 16 : 12;

    const stopIcon = L.divIcon({
      className: 'stop-pin-wrapper',
      html: `
        <div style="background: #ffffff; border: 3px solid ${pinColor}; width: ${pinSize}px; height: ${pinSize}px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35); position: relative;" title="${stop.name}">
          ${isTerminal ? '<div style="position: absolute; top: -16px; left: -14px; background: #c62828; color: #fff; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px; white-space: nowrap;">RTC TERM</div>' : ''}
        </div>
      `,
      iconSize: [pinSize, pinSize],
      iconAnchor: [pinSize / 2, pinSize / 2]
    });

    const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon }).addTo(stopMarkersGroup);

    const corridorsHtml = (stop.corridors || []).map(c => `&bull; ${c}`).join('<br>');

    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 0.85rem; padding: 4px; min-width: 200px;">
        <div style="font-weight: 800; color: #004d38; font-size: 0.95rem; border-bottom: 1.5px solid #00674d; padding-bottom: 3px; margin-bottom: 5px;">
          🚏 ${stop.name}
        </div>
        <div style="font-size: 0.75rem; color: #334155; line-height: 1.45;">
          <strong>Stop Code:</strong> ${stop.code}<br>
          <strong>District:</strong> ${stop.district}<br>
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; color: #0f766e; font-weight: 700;">
            Serving Corridors:
          </div>
          <div style="font-size: 0.72rem; color: #475569;">
            ${corridorsHtml}
          </div>
        </div>
      </div>
    `);
  });
}

/**
 * Fit bounds smoothly to encompass the complete Eastern Ghats multi-corridor network
 */
function fitNetworkBounds() {
  const allCoords = [];
  CORRIDORS.forEach(c => {
    c.points.forEach(p => allCoords.push([p.lat, p.lon]));
  });
  if (allCoords.length > 0) {
    const bounds = L.latLngBounds(allCoords);
    mapInstance.fitBounds(bounds, { padding: [35, 35] });
  }
}

/**
 * Switch tile base layer (called by header buttons: Roadmap, Satellite, Terrain)
 */
function setBaseLayer(layerName) {
  if (!mapInstance) return;

  const allLayers = [googleRoadmapLayer, googleSatelliteLayer, googleTerrainLayer, cartoTransitLayer];
  allLayers.forEach(layer => {
    if (layer && mapInstance.hasLayer(layer)) {
      mapInstance.removeLayer(layer);
    }
  });

  if (layerName === 'satellite' && googleSatelliteLayer) {
    googleSatelliteLayer.addTo(mapInstance);
  } else if (layerName === 'terrain' && googleTerrainLayer) {
    googleTerrainLayer.addTo(mapInstance);
  } else if (googleRoadmapLayer) {
    googleRoadmapLayer.addTo(mapInstance);
  }

  // Update button active states in card header
  document.querySelectorAll('.map-layer-btn').forEach(b => b.classList.remove('active'));
  const activeBtnId = layerName === 'satellite' ? 'btnLayerSatellite' : (layerName === 'terrain' ? 'btnLayerTerrain' : 'btnLayerRoadmap');
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) activeBtn.classList.add('active');
}

/**
 * Create or update a bus marker on the Google Maps layer
 */
function updateBusMarker(bus) {
  if (!mapInstance || !bus || !bus.latitude || !bus.longitude) return;

  const busNumber = String(bus.busNumber);
  const lat = Number(bus.latitude);
  const lon = Number(bus.longitude);
  const freshness = bus.status || 'LIVE';
  const source = bus.activeSource || 'DEMO';
  const speed = Math.round(bus.speedKph || 0);
  const heading = Math.round(bus.heading || 0);

  // Status colors
  const statusColors = {
    LIVE: '#16a34a',
    RECENT: '#f59e0b',
    STALE: '#ea580c',
    UNAVAILABLE: '#64748b'
  };
  const color = statusColors[freshness] || '#16a34a';

  const markerHtml = `
    <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
      ${freshness === 'LIVE' ? `<div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background: ${color}; opacity: 0.35; animation: pulseRing 1.8s infinite;"></div>` : ''}
      <div style="width: 32px; height: 32px; border-radius: 50%; background: ${color}; border: 2.5px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 0.72rem; letter-spacing: -0.5px;">
        ${busNumber}
      </div>
      <div style="position: absolute; top: -6px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 6px solid #ffb703; transform: rotate(${heading}deg); transform-origin: center 25px;"></div>
    </div>
  `;

  const customIcon = L.divIcon({
    className: 'leaflet-google-bus-marker',
    html: markerHtml,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });

  const popupContent = `
    <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.5; min-width: 240px; color: #1e293b;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #00674d; padding-bottom: 4px; margin-bottom: 6px;">
        <div>
          <strong style="font-size: 1.05rem; color: #004d38;">🚍 APSRTC Bus ${busNumber}</strong><br>
          <span style="font-size: 0.72rem; color: #64748b;">${bus.registrationNumber || 'AP-39-Z-' + busNumber}</span>
        </div>
        <span style="font-size: 0.72rem; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">
          ${bus.serviceType || 'EXPRESS'}
        </span>
      </div>

      <div style="margin-bottom: 4px;">
        <span style="font-size: 0.75rem; color: #64748b;">Current Location:</span><br>
        <strong style="color: #0f172a; font-size: 0.95rem;">📍 ${bus.currentLocation || bus.locationName || 'Corridor En Route'}</strong>
      </div>

      <div style="margin-bottom: 4px; font-size: 0.8rem; color: #00674d; font-weight: 700;">
        ➔ Towards ${bus.towards || bus.tripTo || 'Visakhapatnam'}
      </div>

      ${bus.routeName ? `<div style="font-size: 0.74rem; color: #0284c7; font-weight: 700; margin-bottom: 6px;">🛣️ ${bus.routeName}</div>` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 6px; font-size: 0.78rem; margin-bottom: 8px;">
        <div>⚡ <strong>Speed:</strong> ${speed} km/h</div>
        <div>🎯 <strong>GPS:</strong> ±${Math.round(bus.accuracyMeters || 10)}m</div>
        <div>📡 <strong>Source:</strong> ${formatSource(source)}</div>
        <div>🟢 <strong>Status:</strong> <span style="font-weight: 800; color: ${color};">${freshness}</span></div>
      </div>

      <div style="display: flex; gap: 6px;">
        <button onclick="passengerApp.openComplaintModal('${busNumber}', '${bus.tripId || ''}')" style="flex: 1; background: #c62828; color: #ffffff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: 700;">
          ⚠️ Lodge Complaint
        </button>
        <button onclick="passengerApp.openBusDetailsModal('${busNumber}')" style="flex: 1; background: #00674d; color: #ffffff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: 700;">
          ℹ️ Details
        </button>
      </div>
    </div>
  `;

  if (busMarkers.has(busNumber)) {
    const existing = busMarkers.get(busNumber);
    existing.setLatLng([lat, lon]);
    existing.setIcon(customIcon);
    existing.setPopupContent(popupContent);
  } else {
    const marker = L.marker([lat, lon], { icon: customIcon }).addTo(mapInstance);
    marker.bindPopup(popupContent);
    busMarkers.set(busNumber, marker);
  }
}

/**
 * Focus and smoothly zoom Google Map to a specific bus
 */
function focusBus(busNumber) {
  if (!mapInstance) return;

  const key = String(busNumber);
  if (busMarkers.has(key)) {
    const marker = busMarkers.get(key);
    mapInstance.setView(marker.getLatLng(), 14, { animate: true });
    marker.openPopup();

    const mapEl = document.getElementById('fleetMap');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function formatSource(source) {
  switch (source) {
    case 'HARDWARE_TRACKER': return 'Live Tracker';
    case 'CREW_PHONE': return 'Crew Mobile';
    case 'ETM': return 'ETM GPS';
    case 'DEMO': return 'Demo GPS';
    default: return source;
  }
}

window.fleetMap = {
  init: initMap,
  updateBusMarker,
  focusBus,
  setBaseLayer,
  fitNetworkBounds,
  getMap: () => mapInstance
};
