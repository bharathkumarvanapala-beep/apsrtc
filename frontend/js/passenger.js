/**
 * APSRTC SmartTrack Passenger Application
 * Instant corridor loading, visual route progress bars, multi-bus matching,
 * Google Maps integration, and comprehensive Staff & Bus Condition grievance lodging.
 */

let allKnownStops = [
  { stop_name: 'Araku', stop_code: 'ARK', latitude: 18.3273, longitude: 82.8775 },
  { stop_name: 'Ananthagiri', stop_code: 'ATG', latitude: 18.2372, longitude: 83.0117 },
  { stop_name: 'Paderu', stop_code: 'PDR', latitude: 18.0816, longitude: 82.6700 },
  { stop_name: 'G. Madugula', stop_code: 'GMD', latitude: 17.9500, longitude: 82.5167 },
  { stop_name: 'Chintapalli', stop_code: 'CTP', latitude: 17.8700, longitude: 82.3500 },
  { stop_name: 'Anakapalle', stop_code: 'AKP', latitude: 17.6913, longitude: 83.0039 },
  { stop_name: 'Visakhapatnam', stop_code: 'VSKP', latitude: 17.7215, longitude: 83.3032 }
];

let currentSearch = { from: 'Paderu', to: 'Visakhapatnam' };
let currentBuses = [];

// Stop corridor sequence for progress bar calculation
const CORRIDOR_ORDER = {
  'araku': 0,
  'ananthagiri': 16,
  'paderu': 36,
  'g. madugula': 54,
  'chintapalli': 72,
  'anakapalle': 86,
  'visakhapatnam': 100
};

async function initPassenger() {
  // Synchronously populate default corridor stops immediately to prevent any "Loading..." hangs
  populateSelects(allKnownStops);

  // Fetch updated stops from backend in background
  loadStopsDropdown();

  // Setup search, chip, and grievance listeners
  setupEventListeners();

  // Listen for real-time WebSocket bus updates
  if (window.socketClient) {
    window.socketClient.on('bus:location_update', (update) => {
      onBusLocationUpdate(update);
    });
  }

  // Auto-refresh relative time badges every 5 seconds
  setInterval(updateRelativeTimes, 5000);

  // Perform initial search for corridor
  performSearch();
}

async function loadStopsDropdown() {
  try {
    const data = await api.getStops();
    if (data.success && data.stops && data.stops.length > 0) {
      allKnownStops = data.stops;
      populateSelects(data.stops);
    }
  } catch (err) {
    console.warn('Using pre-seeded corridor stops:', err);
  }
}

function populateSelects(stops) {
  const fromSelect = document.getElementById('searchFrom');
  const toSelect = document.getElementById('searchTo');
  if (!fromSelect || !toSelect) return;

  const currentFrom = fromSelect.value || 'Paderu';
  const currentTo = toSelect.value || 'Visakhapatnam';

  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';

  stops.forEach(stop => {
    const optFrom = document.createElement('option');
    optFrom.value = stop.stop_name;
    optFrom.textContent = `${stop.stop_name} (${stop.stop_code || 'RTC'})`;
    fromSelect.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = stop.stop_name;
    optTo.textContent = `${stop.stop_name} (${stop.stop_code || 'RTC'})`;
    toSelect.appendChild(optTo);
  });

  fromSelect.value = currentFrom;
  toSelect.value = currentTo;
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

  // Grievance target tabs (Staff vs Bus Condition vs Service)
  setupComplaintTabs();
}

function setupComplaintTabs() {
  const staffTab = document.getElementById('tabStaffGrievance');
  const busTab = document.getElementById('tabBusCondition');
  const serviceTab = document.getElementById('tabServiceIssue');

  if (staffTab && busTab && serviceTab) {
    staffTab.addEventListener('click', () => selectComplaintTarget('STAFF'));
    busTab.addEventListener('click', () => selectComplaintTarget('BUS_CONDITION'));
    serviceTab.addEventListener('click', () => selectComplaintTarget('SERVICE'));
  }
}

function selectComplaintTarget(target) {
  document.querySelectorAll('.complaint-tab-choice').forEach(t => t.classList.remove('active', 'staff-active'));

  const hiddenInput = document.getElementById('complaintTargetType');
  if (hiddenInput) hiddenInput.value = target;

  const categorySelect = document.getElementById('complaintCategory');
  if (!categorySelect) return;

  categorySelect.innerHTML = '';

  if (target === 'STAFF') {
    document.getElementById('tabStaffGrievance')?.classList.add('active', 'staff-active');
    const staffCategories = [
      'Driver Rash Driving / Overspeeding on Ghat Roads (వేగంగా నడపడం)',
      'Talking on Mobile Phone While Driving (డ్రైవింగ్ చేస్తూ మొబైల్ వాడటం)',
      'Conductor Rude / Abusive Behaviour (కండక్టర్ దురుసు ప్రవర్తన)',
      'Refusal to Issue Ticket / Overcharging (టికెట్ ఇవ్వకపోవడం / అదనపు వసూలు)',
      'Skipped Bus Stop / Did Not Stop (బస్ స్టాప్ వద్ద ఆగలేదు)',
      'Staff Smoking / Alcohol Suspicion (ధూమపానం / మద్యం అనుమానం)',
      'Refusal to Return Balance Fare (మిగిలిన చిల్లర ఇవ్వకపోవడం)',
      'Other Staff Misconduct (ఇతర సిబ్బంది సమస్య)'
    ];
    staffCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  } else if (target === 'BUS_CONDITION') {
    document.getElementById('tabBusCondition')?.classList.add('active');
    const busCategories = [
      'Broken / Damaged / Loose Seats (విరిగిన సీట్లు)',
      'AC Not Cooling / AC Mechanical Failure (ఏసీ పని చేయడం లేదు)',
      'Dirty / Unhygienic Interior or Cockroaches (అపరిశుభ్రత)',
      'Door Mechanism Faulty / Pneumatic Door Not Closing (డోర్ సమస్య)',
      'Window Glass Broken / Rattling / Window Jammed (కిటికీ అద్దం సమస్య)',
      'Headlight / Taillight / Wiper Failure (లైట్లు లేదా వైపర్ పని చేయడం లేదు)',
      'Engine Smoke / Fuel Smell / Overheating (ఇంజిన్ పొగ / వాసన)',
      'Dangerous / Punctured / Bald Tires (టైర్ల పరిస్థితి ప్రమాదకరం)',
      'Emergency Exit Door Jammed / Obstructed (ఎమర్జెన్సీ ఎగ్జిట్ బ్లాక్)'
    ];
    busCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  } else {
    document.getElementById('tabServiceIssue')?.classList.add('active');
    const serviceCategories = [
      'Severe Unscheduled Delay (>30 Mins) (తీవ్రమైన ఆలస్యం)',
      'Dangerous Overcrowding Beyond Permissible Limit (రద్దీ సమస్య)',
      'Unauthorized Route Deviation (అనధికారిక రూట్ మార్పు)',
      'Trip Cancelled Without Notice (ముందస్తు సమాచారం లేకుండా ట్రిప్ రద్దు)'
    ];
    serviceCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }
}

function setQuickSearch(from, to) {
  const fromSelect = document.getElementById('searchFrom');
  const toSelect = document.getElementById('searchTo');
  if (fromSelect && toSelect) {
    fromSelect.value = from;
    toSelect.value = to;

    document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
    event?.target?.classList.add('active');

    performSearch();
  }
}

async function performSearch() {
  const from = document.getElementById('searchFrom')?.value || 'Paderu';
  const to = document.getElementById('searchTo')?.value || 'Visakhapatnam';
  const resultsContainer = document.getElementById('busesListContainer');
  const resultsCountBadge = document.getElementById('resultsCountBadge');

  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; color: #006045;">
        <div class="pulse-dot" style="width: 18px; height: 18px; margin-bottom: 0.5rem;"></div>
        <p style="font-weight: 800; font-size: 1rem;">Scanning APSRTC GPS Corridor Network (${from} ➔ ${to})...</p>
      </div>
    `;
  }

  try {
    const data = await api.searchJourney(from, to);
    currentSearch = { from, to };
    currentBuses = data.buses || [];

    if (resultsCountBadge) {
      resultsCountBadge.textContent = `${currentBuses.length} Relevant Active Buses`;
    }

    renderBusCards(currentBuses, data.passedBuses || []);

    // Update markers on Google Maps
    currentBuses.forEach(b => {
      if (window.fleetMap) window.fleetMap.updateBusMarker(b);
    });
  } catch (err) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 1.5rem; color: #991b1b;">
          <h4 style="font-weight: 800; margin-bottom: 0.4rem;">⚠️ Corridor Search Notice</h4>
          <p>${err.message}</p>
        </div>
      `;
    }
  }
}

async function performBusNumberSearch() {
  const input = document.getElementById('busNumberInput');
  const busNum = (input.value || '').trim();
  if (!busNum) return;

  const resultsContainer = document.getElementById('busesListContainer');
  resultsContainer.innerHTML = `<div style="text-align: center; padding: 2rem;">Locating Bus ${busNum}...</div>`;

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
        towards: bus.to_stop || 'Visakhapatnam',
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

function calculateCorridorProgress(locationName, towards) {
  const loc = (locationName || '').toLowerCase();
  for (const [stopKey, percent] of Object.entries(CORRIDOR_ORDER)) {
    if (loc.includes(stopKey)) {
      return percent;
    }
  }
  return 45; // Default middle ghat position
}

function renderBusCards(buses, passedBuses) {
  const container = document.getElementById('busesListContainer');
  if (!container) return;

  if (!buses || buses.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; background: #ffffff; border-radius: 16px; border: 1.5px dashed #cbd5e1;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🚍</div>
        <h4 style="font-weight: 800; color: #004230; margin-bottom: 0.3rem;">No Active Incoming Buses Right Now</h4>
        <p style="font-size: 0.85rem; color: #64748b; max-width: 420px; margin: 0 auto;">
          No buses currently approaching ${currentSearch.from} for ${currentSearch.to}.
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
    const progressPercent = calculateCorridorProgress(bus.currentLocation, bus.towards);

    html += `
      <div class="bus-card ${isRec ? 'recommended' : ''}" id="bus-card-${bus.busNumber}">
        ${isRec ? '<div class="recommended-ribbon">⭐ EARLIEST ARRIVAL</div>' : ''}
        
        <div class="bus-card-top">
          <div class="bus-identity">
            <span class="bus-num-pill">Bus ${bus.busNumber}</span>
            <span class="service-type-badge ${bus.serviceType}">${formatServiceType(bus.serviceType)}</span>
          </div>

          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <span class="source-pill ${bus.activeSource}">${formatSource(bus.activeSource)}</span>
            <span class="freshness-pill ${bus.status}">
              <span class="pulse-dot"></span>
              ${bus.status}
            </span>
          </div>
        </div>

        <div class="bus-location-headline">
          <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Verified Live Location:</div>
          <div style="font-size: 1.15rem; font-weight: 900; color: #0f172a; margin: 2px 0;">
            📍 ${bus.currentLocation || 'Eastern Ghats Corridor'}
          </div>
          <div style="font-size: 0.82rem; color: #006045; font-weight: 800;">
            ➔ Route Direction: Towards ${bus.towards || currentSearch.to || 'Visakhapatnam'}
          </div>
        </div>

        <!-- Visual Corridor Route Progress Bar -->
        <div class="route-progress-bar">
          <div class="progress-stops-labels">
            <span>🏁 ${bus.tripFrom || 'Araku/Paderu'}</span>
            <span style="color: #006045;">● Current: ${bus.currentLocation}</span>
            <span>🏁 ${bus.towards || 'Visakhapatnam'}</span>
          </div>
          <div class="progress-track-line">
            <div class="progress-track-fill" style="width: ${progressPercent}%;"></div>
            <div class="progress-bus-icon" style="left: ${progressPercent}%;">
              🚍 Bus ${bus.busNumber} (${speed} km/h)
            </div>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-name">ETA to You</span>
            <span class="metric-val highlight">${bus.etaFormatted || 'Calculating...'}</span>
          </div>
          <div class="metric-item">
            <span class="metric-name">Distance</span>
            <span class="metric-val">${bus.distanceToPassengerKm !== undefined ? `${bus.distanceToPassengerKm} km` : '--'}</span>
          </div>
          <div class="metric-item">
            <span class="metric-name">GPS Speed</span>
            <span class="metric-val">${speed} km/h</span>
          </div>
          <div class="metric-item">
            <span class="metric-name">Accuracy</span>
            <span class="metric-val">±${accuracy}m</span>
          </div>
        </div>

        <div style="font-size: 0.74rem; color: #64748b; margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
          <span class="relative-time-ticker" data-timestamp="${bus.lastUpdatedAt}">Updated just now</span>
          <span>Home Depot: <strong>${bus.depot || 'APSRTC'}</strong></span>
        </div>

        <div class="card-actions">
          <button class="btn-card-action" onclick="fleetMap.focusBus('${bus.busNumber}')">
            🗺️ Track on Google Map
          </button>
          <button class="btn-card-action" onclick="passengerApp.openBusDetailsModal('${bus.busNumber}')">
            ℹ️ Bus Profile
          </button>
          <button class="btn-card-action danger-action" onclick="passengerApp.openComplaintModal('${bus.busNumber}', '${bus.tripId || ''}')">
            ⚠️ Lodge Grievance / Report
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
  if (window.fleetMap) {
    window.fleetMap.updateBusMarker(update);
  }

  const card = document.getElementById(`bus-card-${update.busNumber}`);
  if (card) {
    const locNameEl = card.querySelector('.bus-location-headline div:nth-child(2)');
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

function openComplaintModal(busNumber = '', tripId = '', targetType = 'BUS_CONDITION') {
  const modal = document.getElementById('complaintModal');
  const busInput = document.getElementById('complaintBusNumber');
  const tripInput = document.getElementById('complaintTripId');

  if (modal) {
    if (busInput) busInput.value = busNumber;
    if (tripInput) tripInput.value = tripId || '';
    selectComplaintTarget(targetType);
    modal.classList.add('open');
  }
}

async function handleComplaintSubmit(e) {
  e.preventDefault();
  const busNumber = document.getElementById('complaintBusNumber').value;
  const tripId = document.getElementById('complaintTripId').value;
  const targetType = document.getElementById('complaintTargetType')?.value || 'GENERAL';
  const category = document.getElementById('complaintCategory').value;
  const description = document.getElementById('complaintDescription').value;
  const passengerName = document.getElementById('complaintName').value;
  const passengerPhone = document.getElementById('complaintPhone').value;
  const location = document.getElementById('complaintLocation')?.value || '';

  try {
    const res = await api.submitComplaint({
      busNumber,
      tripId,
      targetType,
      category,
      description,
      passengerName,
      passengerPhone,
      location
    });

    closeModal('complaintModal');

    // Show custom official modal or alert with reference number
    alert(`✅ APSRTC GRIEVANCE REGISTERED SUCCESSFULLY!\n\n` +
          `Official Reference ID: ${res.referenceId}\n` +
          `Target: ${targetType.replace('_', ' ')}\n` +
          `Bus Number: ${busNumber}\n` +
          `Category: ${category}\n\n` +
          `Your complaint has been forwarded to the Depot Operations Controller & Maintenance Supervisor for immediate inquiry.`);

    document.getElementById('complaintForm').reset();
  } catch (err) {
    alert(`Submission Error: ${err.message}`);
  }
}

async function openBusDetailsModal(busNumber) {
  const modal = document.getElementById('busDetailsModal');
  const body = document.getElementById('busDetailsModalBody');
  if (!modal || !body) return;

  body.innerHTML = '<div style="text-align: center; padding: 2rem;">Fetching APSRTC Asset Profile...</div>';
  modal.classList.add('open');

  try {
    const data = await api.getBusById(busNumber);
    const bus = data.bus;
    body.innerHTML = `
      <div style="font-size: 0.9rem; line-height: 1.6; color: #1e293b;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #006045; padding-bottom: 0.5rem; margin-bottom: 1rem;">
          <h3 style="color: #004230; font-weight: 800;">🚍 APSRTC Bus ${bus.bus_number}</h3>
          <span style="font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 2px 10px; border-radius: 4px;">${bus.service_type}</span>
        </div>
        <p><strong>Registration Number:</strong> ${bus.registration_number}</p>
        <p><strong>Operating RTC Depot:</strong> ${bus.depot}</p>
        <p><strong>Seating Capacity:</strong> ${bus.total_seats} Passenger Seats</p>
        <p><strong>Designated Route:</strong> ${bus.route_name || 'Araku - Visakhapatnam Eastern Ghats Corridor'}</p>
        <p><strong>Assigned Crew:</strong> ${bus.driver_name || 'APSRTC Duty Crew'} (${bus.driver_emp_id || 'EMP-4089'})</p>
        <hr style="margin: 0.85rem 0; border: none; border-top: 1px solid #e2e8f0;">
        <h4 style="color: #006045; font-weight: 800; margin-bottom: 0.4rem;">Telemetry & Location Diagnostics</h4>
        <p><strong>Active Source:</strong> ${formatSource(bus.currentLocation.activeSource)}</p>
        <p><strong>GPS Freshness:</strong> <span class="freshness-pill ${bus.currentLocation.status}" style="display: inline-flex;"><span class="pulse-dot"></span> ${bus.currentLocation.status}</span></p>
        <p><strong>Precision Accuracy:</strong> ±${Math.round(bus.currentLocation.accuracyMeters)}m (${bus.currentLocation.confidence})</p>
        <p><strong>Instantaneous Speed:</strong> ${Math.round(bus.currentLocation.speedKph)} km/h</p>
        <p><strong>Coordinates:</strong> ${bus.currentLocation.latitude}, ${bus.currentLocation.longitude}</p>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div style="color: #c62828;">Failed to load bus details: ${err.message}</div>`;
  }
}

async function trackComplaintModal() {
  const ref = prompt('Enter your APSRTC Grievance Reference ID (e.g. APSRTC-G-2026-1049):');
  if (!ref || !ref.trim()) return;

  try {
    const res = await api.trackComplaint(ref.trim());
    const c = res.complaint;
    alert(`📋 APSRTC GRIEVANCE STATUS\n\n` +
          `Reference ID: ${c.complaint_ref}\n` +
          `Target: ${c.target_type}\n` +
          `Bus Number: ${c.bus_number}\n` +
          `Category: ${c.category}\n` +
          `Status: ${c.status}\n` +
          `Officer Action Notes: ${c.officer_notes || 'Under review by Depot Supervisor'}\n` +
          `Filed Date: ${new Date(c.created_at).toLocaleString()}`);
  } catch (err) {
    alert(`Grievance Not Found: ${err.message}`);
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
    default: return source || 'Demo GPS';
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
  trackComplaintModal,
  selectComplaintTarget,
  closeModal
};
