/**
 * APSRTC SmartTrack Passenger Application
 * Handles From-To corridor search, multi-bus result cards, live map sync, and complaints.
 */

let allKnownStops = [];
let currentSearch = { from: '', to: '' };
let currentBuses = [];

async function initPassenger() {
  loadStopsDropdown();
  setupEventListeners();

  // Listen for real-time WebSocket bus updates
  if (window.socketClient) {
    window.socketClient.on('bus:location_update', (update) => {
      onBusLocationUpdate(update);
    });
  }

  // Auto-refresh relative time badges every 5 seconds
  setInterval(updateRelativeTimes, 5000);
}

async function loadStopsDropdown() {
  try {
    const data = await api.getStops();
    if (data.success && data.stops) {
      allKnownStops = data.stops;
      populateSelects(data.stops);
    }
  } catch (err) {
    console.error('Failed to load stops:', err);
  }
}

function populateSelects(stops) {
  const fromSelect = document.getElementById('searchFrom');
  const toSelect = document.getElementById('searchTo');
  if (!fromSelect || !toSelect) return;

  fromSelect.innerHTML = '<option value="">-- Select Boarding Stop --</option>';
  toSelect.innerHTML = '<option value="">-- Select Destination Stop --</option>';

  stops.forEach(stop => {
    const optFrom = document.createElement('option');
    optFrom.value = stop.stop_name;
    optFrom.textContent = `${stop.stop_name} (${stop.stop_code || 'APSRTC'})`;
    fromSelect.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = stop.stop_name;
    optTo.textContent = `${stop.stop_name} (${stop.stop_code || 'APSRTC'})`;
    toSelect.appendChild(optTo);
  });

  // Default demo selection: Paderu -> Visakhapatnam
  fromSelect.value = 'Paderu';
  toSelect.value = 'Visakhapatnam';

  // Trigger initial search
  performSearch();
}

function setupEventListeners() {
  const form = document.getElementById('journeySearchForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      performSearch();
    });
  }

  const swapBtn = document.getElementById('swapStopsBtn');
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      const fromSelect = document.getElementById('searchFrom');
      const toSelect = document.getElementById('searchTo');
      const temp = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = temp;
      if (fromSelect.value && toSelect.value) {
        performSearch();
      }
    });
  }

  const busSearchBtn = document.getElementById('busNumberSearchBtn');
  if (busSearchBtn) {
    busSearchBtn.addEventListener('click', performBusNumberSearch);
  }

  const complaintForm = document.getElementById('complaintForm');
  if (complaintForm) {
    complaintForm.addEventListener('submit', handleComplaintSubmit);
  }
}

function setQuickSearch(from, to) {
  const fromSelect = document.getElementById('searchFrom');
  const toSelect = document.getElementById('searchTo');
  if (fromSelect && toSelect) {
    fromSelect.value = from;
    toSelect.value = to;
    performSearch();
  }
}

async function performSearch() {
  const from = document.getElementById('searchFrom').value;
  const to = document.getElementById('searchTo').value;
  const resultsContainer = document.getElementById('busesListContainer');
  const resultsCountBadge = document.getElementById('resultsCountBadge');

  if (!from || !to) {
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #64748b;">
        Please select both Departure and Destination stops to see active incoming buses.
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = `
    <div style="text-align: center; padding: 2.5rem; color: #00695c;">
      <div class="pulse-dot" style="width: 16px; height: 16px; margin-bottom: 0.5rem;"></div>
      <p style="font-weight: 700;">Scanning APSRTC GPS Corridor Network...</p>
    </div>
  `;

  try {
    const data = await api.searchJourney(from, to);
    currentSearch = { from, to };
    currentBuses = data.buses || [];

    if (resultsCountBadge) {
      resultsCountBadge.textContent = `${currentBuses.length} Relevant Active Buses`;
    }

    renderBusCards(currentBuses, data.passedBuses || []);

    // Also update all bus markers on the live map
    currentBuses.forEach(b => {
      if (window.fleetMap) window.fleetMap.updateBusMarker(b);
    });
  } catch (err) {
    resultsContainer.innerHTML = `
      <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 1.5rem; color: #991b1b;">
        <h4 style="font-weight: 800; margin-bottom: 0.4rem;">⚠️ Journey Search Notification</h4>
        <p>${err.message}</p>
      </div>
    `;
    if (resultsCountBadge) resultsCountBadge.textContent = '0 Buses';
  }
}

async function performBusNumberSearch() {
  const input = document.getElementById('busNumberInput');
  const busNum = (input.value || '').trim();
  if (!busNum) return;

  const resultsContainer = document.getElementById('busesListContainer');
  resultsContainer.innerHTML = `<div style="text-align: center; padding: 2rem;">Searching Bus ${busNum}...</div>`;

  try {
    const data = await api.getBusById(busNum);
    if (data.success && data.bus) {
      const bus = data.bus;
      const cardPayload = {
        busNumber: bus.bus_number,
        serviceType: bus.service_type,
        depot: bus.depot,
        tripId: bus.trip_id,
        currentLocation: bus.currentLocation.locationName,
        latitude: bus.currentLocation.latitude,
        longitude: bus.currentLocation.longitude,
        speedKph: bus.currentLocation.speedKph,
        accuracyMeters: bus.currentLocation.accuracyMeters,
        activeSource: bus.currentLocation.activeSource,
        status: bus.currentLocation.status,
        confidence: bus.currentLocation.confidence,
        towards: bus.to_stop || 'Destination',
        distanceToPassengerKm: 0,
        etaFormatted: 'Direct Lookup',
        lastUpdatedAt: bus.currentLocation.lastUpdatedAt,
        isRecommended: false
      };

      renderBusCards([cardPayload], []);
      if (window.fleetMap) {
        window.fleetMap.updateBusMarker(cardPayload);
        window.fleetMap.focusBus(cardPayload.busNumber);
      }
    }
  } catch (err) {
    resultsContainer.innerHTML = `
      <div style="background: #fef2f2; padding: 1.5rem; border-radius: 12px; color: #991b1b;">
        Bus "${busNum}" was not found or is currently off-duty.
      </div>
    `;
  }
}

function renderBusCards(buses, passedBuses) {
  const container = document.getElementById('busesListContainer');
  if (!buses || buses.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; background: #ffffff; border-radius: 16px; border: 1.5px dashed #cbd5e1;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🚍</div>
        <h4 style="font-weight: 800; color: #334155; margin-bottom: 0.3rem;">No Active Incoming Buses Right Now</h4>
        <p style="font-size: 0.85rem; color: #64748b; max-width: 400px; margin: 0 auto;">
          There are currently no active buses approaching ${currentSearch.from || 'this stop'} for ${currentSearch.to || 'the destination'}.
          ${passedBuses.length > 0 ? `<br><strong>Note:</strong> ${passedBuses.length} bus(es) have already departed past this stop.` : ''}
        </p>
      </div>
    `;
    return;
  }

  let html = '<div class="buses-stack">';

  buses.forEach(bus => {
    const isRec = bus.isRecommended;
    const accuracy = Math.round(bus.accuracyMeters || 10);
    const speed = Math.round(bus.speedKph || 0);

    html += `
      <div class="bus-card ${isRec ? 'recommended' : ''}" id="bus-card-${bus.busNumber}">
        ${isRec ? '<div class="recommended-ribbon">⭐ Earliest Arrival</div>' : ''}
        
        <div class="bus-card-top">
          <div class="bus-identity">
            <span class="bus-num-pill">Bus ${bus.busNumber}</span>
            <span class="service-type-badge ${bus.serviceType}">${formatServiceType(bus.serviceType)}</span>
          </div>

          <div class="status-badges">
            <span class="source-pill ${bus.activeSource}">${formatSource(bus.activeSource)}</span>
            <span class="freshness-pill ${bus.status}">
              <span class="pulse-dot"></span>
              ${bus.status}
            </span>
          </div>
        </div>

        <div class="bus-location-headline">
          <div class="loc-label">Current Verified Location:</div>
          <div class="loc-name">
            📍 ${bus.currentLocation || 'Corridor En Route'}
          </div>
          <div class="loc-direction">
            ➔ Direction: Towards ${bus.towards || 'Destination'}
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-name">ETA to You</span>
            <span class="metric-val highlight">${bus.etaFormatted || 'Calc...'}</span>
          </div>
          <div class="metric-item">
            <span class="metric-name">Distance</span>
            <span class="metric-val">${bus.distanceToPassengerKm !== undefined ? `${bus.distanceToPassengerKm} km` : '--'}</span>
          </div>
          <div class="metric-item">
            <span class="metric-name">Speed</span>
            <span class="metric-val">${speed} km/h</span>
          </div>
          <div class="metric-item">
            <span class="metric-name">GPS Accuracy</span>
            <span class="metric-val" title="Confidence: ${bus.confidence}">±${accuracy}m</span>
          </div>
        </div>

        <div style="font-size: 0.73rem; color: #64748b; margin-bottom: 0.75rem; display: flex; justify-content: space-between;">
          <span class="relative-time-ticker" data-timestamp="${bus.lastUpdatedAt}">Updated just now</span>
          <span>Depot: ${bus.depot || 'APSRTC'}</span>
        </div>

        <div class="card-actions">
          <button class="btn-card-action" onclick="fleetMap.focusBus('${bus.busNumber}')">
            🗺️ View on Map
          </button>
          <button class="btn-card-action" onclick="passengerApp.openBusDetailsModal('${bus.busNumber}')">
            ℹ️ Bus Details
          </button>
          <button class="btn-card-action danger-action" onclick="passengerApp.openComplaintModal('${bus.busNumber}', '${bus.tripId || ''}')">
            ⚠️ Report Problem
          </button>
        </div>
      </div>
    `;
  });

  html += '</div>';

  container.innerHTML = html;
  updateRelativeTimes();
}

function onBusLocationUpdate(update) {
  // Update marker on live map
  if (window.fleetMap) {
    window.fleetMap.updateBusMarker(update);
  }

  // If bus card is on screen, update its data dynamically
  const card = document.getElementById(`bus-card-${update.busNumber}`);
  if (card) {
    const locNameEl = card.querySelector('.loc-name');
    if (locNameEl) locNameEl.innerHTML = `📍 ${update.locationName || 'En route'}`;

    const sourceEl = card.querySelector('.source-pill');
    if (sourceEl) {
      sourceEl.className = `source-pill ${update.activeSource}`;
      sourceEl.textContent = formatSource(update.activeSource);
    }

    const freshnessEl = card.querySelector('.freshness-pill');
    if (freshnessEl) {
      freshnessEl.className = `freshness-pill ${update.status}`;
      freshnessEl.innerHTML = `<span class="pulse-dot"></span> ${update.status}`;
    }

    const ticker = card.querySelector('.relative-time-ticker');
    if (ticker) {
      ticker.setAttribute('data-timestamp', update.lastUpdatedAt);
      ticker.textContent = 'Updated just now';
    }
  }
}

function updateRelativeTimes() {
  const tickers = document.querySelectorAll('.relative-time-ticker');
  const now = Date.now();

  tickers.forEach(t => {
    const tsStr = t.getAttribute('data-timestamp');
    if (!tsStr) return;
    const ts = new Date(tsStr.includes('Z') ? tsStr : tsStr + 'Z').getTime();
    const diffSec = Math.max(0, Math.floor((now - ts) / 1000));

    if (diffSec < 5) {
      t.textContent = 'Updated just now';
    } else if (diffSec < 60) {
      t.textContent = `Updated ${diffSec}s ago`;
    } else if (diffSec < 3600) {
      t.textContent = `Updated ${Math.floor(diffSec / 60)}m ago`;
    } else {
      t.textContent = `Updated ${Math.floor(diffSec / 3600)}h ago`;
    }
  });
}

function openComplaintModal(busNumber, tripId) {
  const modal = document.getElementById('complaintModal');
  const busInput = document.getElementById('complaintBusNumber');
  const tripInput = document.getElementById('complaintTripId');
  if (modal && busInput) {
    busInput.value = busNumber;
    if (tripInput) tripInput.value = tripId || '';
    modal.classList.add('open');
  }
}

async function handleComplaintSubmit(e) {
  e.preventDefault();
  const busNumber = document.getElementById('complaintBusNumber').value;
  const tripId = document.getElementById('complaintTripId').value;
  const category = document.getElementById('complaintCategory').value;
  const description = document.getElementById('complaintDescription').value;
  const passengerName = document.getElementById('complaintName').value;
  const passengerPhone = document.getElementById('complaintPhone').value;

  try {
    const res = await api.submitComplaint({
      busNumber,
      tripId,
      category,
      description,
      passengerName,
      passengerPhone
    });

    closeModal('complaintModal');
    alert(`✅ Grievance Registered!\n\nReference ID: ${res.referenceId}\n\nDepot Operations Officers have been alerted for investigation.`);
    document.getElementById('complaintForm').reset();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function openBusDetailsModal(busNumber) {
  const modal = document.getElementById('busDetailsModal');
  const body = document.getElementById('busDetailsModalBody');
  if (!modal || !body) return;

  body.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading Bus Details...</div>';
  modal.classList.add('open');

  try {
    const data = await api.getBusById(busNumber);
    const bus = data.bus;
    body.innerHTML = `
      <div style="font-size: 0.9rem; line-height: 1.6;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #00695c; padding-bottom: 0.5rem; margin-bottom: 1rem;">
          <h3 style="color: #004d40;">🚍 Bus ${bus.bus_number}</h3>
          <span style="font-weight: 700; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${bus.service_type}</span>
        </div>
        <p><strong>Registration:</strong> ${bus.registration_number}</p>
        <p><strong>Depot:</strong> ${bus.depot}</p>
        <p><strong>Total Capacity:</strong> ${bus.total_seats} Seats</p>
        <p><strong>Corridor Route:</strong> ${bus.route_name || 'Araku - Visakhapatnam Corridor'}</p>
        <p><strong>Driver:</strong> ${bus.driver_name || 'Assigned RTC Driver'} (${bus.driver_emp_id || 'APSRTC'})</p>
        <hr style="margin: 0.75rem 0; border: none; border-top: 1px solid #e2e8f0;">
        <h4 style="color: #004d40; margin-bottom: 0.4rem;">Telemetry Diagnostics</h4>
        <p><strong>Active Source:</strong> ${bus.currentLocation.activeSource}</p>
        <p><strong>Freshness:</strong> ${bus.currentLocation.status}</p>
        <p><strong>GPS Accuracy:</strong> ±${bus.currentLocation.accuracyMeters}m (${bus.currentLocation.confidence})</p>
        <p><strong>Speed:</strong> ${bus.currentLocation.speedKph} km/h</p>
        <p><strong>Coordinates:</strong> ${bus.currentLocation.latitude}, ${bus.currentLocation.longitude}</p>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div style="color: #c62828;">Failed to load bus details: ${err.message}</div>`;
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
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

function formatServiceType(type) {
  if (!type) return 'EXPRESS';
  return type.replace('_', ' ');
}

window.passengerApp = {
  init: initPassenger,
  performSearch,
  setQuickSearch,
  openComplaintModal,
  openBusDetailsModal,
  closeModal
};
