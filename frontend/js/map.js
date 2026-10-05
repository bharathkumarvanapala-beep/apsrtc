/**
 * APSRTC SmartTrack Interactive Fleet Map
 * Integrates Google Maps Roadmap, Satellite, and Terrain tile layers
 * with real-time bus marker tracking, corridor route polyline, and stop pins.
 */

let mapInstance = null;
const busMarkers = new Map(); // busNumber -> Leaflet Marker
let routePolyline = null;
let stopMarkersGroup = null;

// Corridor Stops Coordinates along Eastern Ghats
const CORRIDOR_POINTS = [
  { name: 'Araku Valley', lat: 18.3273, lon: 82.8775, code: 'ARK' },
  { name: 'Ananthagiri Hills', lat: 18.2372, lon: 83.0117, code: 'ATG' },
  { name: 'Paderu Bus Complex', lat: 18.0816, lon: 82.6700, code: 'PDR' },
  { name: 'G. Madugula Junction', lat: 17.9500, lon: 82.5167, code: 'GMD' },
  { name: 'Chintapalli RTC Stand', lat: 17.8700, lon: 82.3500, code: 'CTP' },
  { name: 'Anakapalle Bypass', lat: 17.6913, lon: 83.0039, code: 'AKP' },
  { name: 'Visakhapatnam Dwaraka RTC Complex', lat: 17.7215, lon: 83.3032, code: 'VSKP' }
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
  }

  // Initialize Map centered on Paderu / Eastern Ghats Corridor
  mapInstance = L.map(containerId, {
    zoomControl: false, // Customized control position
    scrollWheelZoom: true
  }).setView([17.98, 82.78], 9);

  // Position Zoom Control cleanly at top-left
  L.control.zoom({ position: 'topleft' }).addTo(mapInstance);

  // 1. Google Maps Roadmap Layer (Standard Indian Highway / Town Navigation)
  const googleRoadmap = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps | APSRTC SmartTrack'
  });

  // 2. Google Maps Satellite / Hybrid Layer
  const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps Satellite'
  });

  // 3. Google Maps Terrain Layer (Highlights Eastern Ghats elevation and hill roads)
  const googleTerrain = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps Terrain'
  });

  // 4. CartoDB Voyager Transit Layer (Clean high-contrast backup)
  const cartoTransit = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; CartoDB &copy; OpenStreetMap'
  });

  // Set Google Roadmap as default layer
  googleRoadmap.addTo(mapInstance);

  // Add Interactive Layer Switcher (Google Roadmap vs Google Satellite vs Google Terrain)
  const baseMaps = {
    "🗺️ Google Roadmap": googleRoadmap,
    "🛰️ Google Satellite": googleSatellite,
    "🏔️ Google Terrain": googleTerrain,
    "🏙️ Carto Transit": cartoTransit
  };

  L.control.layers(baseMaps, null, { position: 'topright', collapsed: false }).addTo(mapInstance);

  // Draw Corridor Route Polyline (APSRTC Teal with Golden border)
  const latLngs = CORRIDOR_POINTS.map(p => [p.lat, p.lon]);
  
  // Background glowing casing
  L.polyline(latLngs, {
    color: '#004d38',
    weight: 7,
    opacity: 0.6,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(mapInstance);

  // Foreground corridor line
  routePolyline = L.polyline(latLngs, {
    color: '#ffb703',
    weight: 4,
    opacity: 0.95,
    dashArray: '10, 6',
    lineJoin: 'round'
  }).addTo(mapInstance);

  // Add Official APSRTC Stop Markers
  stopMarkersGroup = L.layerGroup().addTo(mapInstance);
  CORRIDOR_POINTS.forEach((stop, index) => {
    const isTerminal = index === 0 || index === CORRIDOR_POINTS.length - 1;
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
    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 0.85rem; padding: 4px; min-width: 180px;">
        <div style="font-weight: 800; color: #004d38; font-size: 0.95rem; border-bottom: 1.5px solid #00674d; padding-bottom: 3px; margin-bottom: 4px;">
          🚏 ${stop.name}
        </div>
        <div style="font-size: 0.75rem; color: #475569;">
          <strong>Stop Code:</strong> ${stop.code} | Corridor Stop #${index + 1}<br>
          <strong>District:</strong> Alluri Sitharama Raju / Visakhapatnam
        </div>
      </div>
    `);
  });

  // Fit bounds to include all corridor points smoothly
  const bounds = L.latLngBounds(latLngs);
  mapInstance.fitBounds(bounds, { padding: [40, 40] });

  return mapInstance;
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

      <div style="margin-bottom: 6px; font-size: 0.8rem; color: #00674d; font-weight: 700;">
        ➔ Towards ${bus.towards || bus.tripTo || 'Visakhapatnam'}
      </div>

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
  getMap: () => mapInstance
};
