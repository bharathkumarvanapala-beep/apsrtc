/**
 * APSRTC SmartTrack Interactive Fleet Map
 * Integrates Leaflet.js with live bus marker tracking, corridor route polylines, and stop pins.
 */

let mapInstance = null;
const busMarkers = new Map(); // busNumber -> Leaflet Marker
let routePolyline = null;
let stopMarkersGroup = null;

// Corridor Stops Coordinates for Reference Route Line
const CORRIDOR_POINTS = [
  { name: 'Araku', lat: 18.3273, lon: 82.8775 },
  { name: 'Ananthagiri', lat: 18.2372, lon: 83.0117 },
  { name: 'Paderu', lat: 18.0816, lon: 82.6700 },
  { name: 'G. Madugula', lat: 17.9500, lon: 82.5167 },
  { name: 'Chintapalli', lat: 17.8700, lon: 82.3500 },
  { name: 'Anakapalle', lat: 17.6913, lon: 83.0039 },
  { name: 'Visakhapatnam', lat: 17.7215, lon: 83.3032 }
];

function initMap(containerId = 'fleetMap') {
  if (typeof L === 'undefined') {
    console.warn('Leaflet library not found, map disabled');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) return null;

  // Center on Eastern Ghats corridor (Paderu centroid ~ 18.00 N, 82.80 E)
  mapInstance = L.map(containerId, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([18.00, 82.85], 9);

  // OpenStreetMap Tile Layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | APSRTC SmartTrack'
  }).addTo(mapInstance);

  // Draw Corridor Route Polyline
  const latLngs = CORRIDOR_POINTS.map(p => [p.lat, p.lon]);
  routePolyline = L.polyline(latLngs, {
    color: '#00695c',
    weight: 4,
    opacity: 0.85,
    dashArray: '8, 6',
    lineJoin: 'round'
  }).addTo(mapInstance);

  // Stop Markers Group
  stopMarkersGroup = L.layerGroup().addTo(mapInstance);
  CORRIDOR_POINTS.forEach(stop => {
    const stopIcon = L.divIcon({
      className: 'stop-pin',
      html: `
        <div style="background: #ffffff; border: 2.5px solid #004d40; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.3);" title="${stop.name}"></div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon }).addTo(stopMarkersGroup);
    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 0.85rem; padding: 0.2rem;">
        <strong style="color: #004d40;">🚏 ${stop.name}</strong><br>
        <span style="font-size: 0.75rem; color: #64748b;">APSRTC Designated Corridor Bus Stop</span>
      </div>
    `);
  });

  return mapInstance;
}

/**
 * Create or update a bus marker on the map
 */
function updateBusMarker(bus) {
  if (!mapInstance || !bus || !bus.latitude || !bus.longitude) return;

  const busNumber = bus.busNumber;
  const lat = Number(bus.latitude);
  const lon = Number(bus.longitude);
  const freshness = bus.status || 'LIVE';
  const source = bus.activeSource || 'DEMO';
  const speed = Math.round(bus.speedKph || 0);

  const markerHtml = `
    <div class="custom-bus-marker ${freshness}" style="width: 32px; height: 32px;" title="Bus ${busNumber}">
      ${busNumber}
    </div>
  `;

  const customIcon = L.divIcon({
    className: 'leaflet-bus-icon-container',
    html: markerHtml,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const popupContent = `
    <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.5; min-width: 220px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #00695c; padding-bottom: 4px; margin-bottom: 6px;">
        <strong style="font-size: 1rem; color: #004d40;">🚍 Bus ${busNumber}</strong>
        <span style="font-size: 0.7rem; font-weight: 800; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${bus.serviceType || 'EXPRESS'}</span>
      </div>
      <div><strong>Current Location:</strong> ${bus.currentLocation || bus.locationName || 'En route'}</div>
      <div><strong>Direction:</strong> Towards ${bus.towards || bus.tripTo || 'Destination'}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0; background: #f8fafc; padding: 6px; border-radius: 6px; font-size: 0.78rem;">
        <div>⚡ <strong>Speed:</strong> ${speed} km/h</div>
        <div>🎯 <strong>GPS:</strong> ±${Math.round(bus.accuracyMeters || 10)}m</div>
        <div>📡 <strong>Source:</strong> ${formatSource(source)}</div>
        <div>🟢 <strong>Status:</strong> ${freshness}</div>
      </div>
      ${bus.tripId ? `<div style="font-size: 0.72rem; color: #64748b;">Trip: ${bus.tripId}</div>` : ''}
      <div style="margin-top: 6px; text-align: right;">
        <button onclick="passengerApp.openComplaintModal('${busNumber}', '${bus.tripId || ''}')" style="background: #c62828; color: #ffffff; border: none; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: 600;">Report Issue</button>
      </div>
    </div>
  `;

  if (busMarkers.has(busNumber)) {
    const existingMarker = busMarkers.get(busNumber);
    existingMarker.setLatLng([lat, lon]);
    existingMarker.setIcon(customIcon);
    existingMarker.setPopupContent(popupContent);
  } else {
    const newMarker = L.marker([lat, lon], { icon: customIcon }).addTo(mapInstance);
    newMarker.bindPopup(popupContent);
    busMarkers.set(busNumber, newMarker);
  }
}

/**
 * Focus and zoom map to a specific bus
 */
function focusBus(busNumber) {
  if (!mapInstance) return;

  if (busMarkers.has(busNumber)) {
    const marker = busMarkers.get(busNumber);
    mapInstance.setView(marker.getLatLng(), 13, { animate: true });
    marker.openPopup();
  }
}

function formatSource(source) {
  switch (source) {
    case 'HARDWARE_TRACKER': return 'Tracker (HW)';
    case 'CREW_PHONE': return 'Crew Mobile';
    case 'ETM': return 'ETM Device';
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
