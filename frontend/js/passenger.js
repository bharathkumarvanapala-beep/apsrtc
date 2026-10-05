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
    if (res.referenceId) {
      localStorage.setItem('apsrtc_last_complaint', res.referenceId);
    }

    document.getElementById('complaintForm').reset();

    // Directly open the status dossier for the new grievance
    setTimeout(() => {
      trackComplaintModal(res.referenceId);
    }, 250);
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

let currentTrackingComplaint = null;

async function trackComplaintModal(refId = null) {
  const modal = document.getElementById('complaintStatusModal');
  const input = document.getElementById('trackComplaintInput');
  if (!modal) return;

  modal.classList.add('open');

  const targetRef = (refId || (input ? input.value : '') || localStorage.getItem('apsrtc_last_complaint') || 'APSRTC-G-2026-9083').trim();
  if (input) {
    input.value = targetRef;
  }

  await loadAndRenderComplaintStatus(targetRef);
}

async function handleTrackSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('trackComplaintInput');
  if (!input || !input.value.trim()) return;
  await loadAndRenderComplaintStatus(input.value.trim());
}

async function loadAndRenderComplaintStatus(ref) {
  const resultContainer = document.getElementById('complaintStatusResult');
  if (!resultContainer) return;

  resultContainer.innerHTML = `
    <div style="text-align: center; padding: 2.5rem 1rem; color: #004230;">
      <div class="pulse-dot" style="width: 14px; height: 14px; background: #006045; margin-bottom: 0.75rem;"></div>
      <div style="font-weight: 700; font-size: 0.95rem;">Retrieving APSRTC Official Grievance Dossier...</div>
      <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">Connecting to Regional Depot Grievance Redressal Cell</div>
    </div>
  `;

  try {
    const res = await api.trackComplaint(ref);
    currentTrackingComplaint = res;
    renderComplaintStatusModal(res.complaint, res.history);
  } catch (err) {
    resultContainer.innerHTML = `
      <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 8px; padding: 1.5rem; text-align: center; color: #991b1b;">
        <span style="font-size: 2rem;">⚠️</span>
        <h4 style="margin: 0.5rem 0 0.25rem;">Grievance Record Not Found</h4>
        <p style="font-size: 0.82rem; color: #7f1d1d; margin-bottom: 1rem;">
          No grievance record matches reference ID "<strong>${ref}</strong>". Please verify your SMS receipt code.
        </p>
        <div style="font-size: 0.75rem; color: #64748b;">
          Try active sample complaints:
          <button type="button" class="gov-link-btn" onclick="passengerApp.trackComplaintModal('APSRTC-G-2026-9083')" style="color: #0369a1; background: #e0f2fe; padding: 2px 8px; margin: 2px;">Bus 518 (Broken Seats)</button>
          <button type="button" class="gov-link-btn" onclick="passengerApp.trackComplaintModal('APSRTC-G-2026-1011')" style="color: #991b1b; background: #fee2e2; padding: 2px 8px; margin: 2px;">Bus 415 (Rash Driving)</button>
          <button type="button" class="gov-link-btn" onclick="passengerApp.trackComplaintModal('APSRTC-G-2026-1049')" style="color: #166534; background: #dcfce7; padding: 2px 8px; margin: 2px;">Bus 415 (Delay)</button>
        </div>
      </div>
    `;
  }
}

function renderComplaintStatusModal(complaint, history = []) {
  const container = document.getElementById('complaintStatusResult');
  if (!container) return;

  const status = complaint.status || 'NEW';
  
  // Progress lifecycle steps calculation
  const steps = [
    { key: 'NEW', label: '1. Lodged', sub: 'Citizen Report Logged', icon: '📝' },
    { key: 'ACKNOWLEDGED', label: '2. Depot Assigned', sub: 'Depot Manager Assigned', icon: '🏢' },
    { key: 'INVESTIGATING', label: '3. Investigation', sub: 'Technical / Vigilance Review', icon: '🔍' },
    { key: 'ACTION_TAKEN', label: '4. Action Taken', sub: 'Corrective Action Done', icon: '🛠️' },
    { key: 'RESOLVED', label: '5. Resolved', sub: 'Quality Verified & Closed', icon: '✅' }
  ];

  const statusOrder = ['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED'];
  const currentIndex = statusOrder.indexOf(status);

  // Status color badges
  let statusLabel = 'REGISTERED';
  let statusBg = '#fee2e2';
  let statusColor = '#991b1b';

  if (status === 'ACKNOWLEDGED') {
    statusLabel = 'ACKNOWLEDGED BY DEPOT';
    statusBg = '#e0f2fe';
    statusColor = '#0369a1';
  } else if (status === 'INVESTIGATING') {
    statusLabel = 'INQUIRY & INSPECTION IN PROGRESS';
    statusBg = '#fef3c7';
    statusColor = '#92400e';
  } else if (status === 'ACTION_TAKEN') {
    statusLabel = 'OFFICIAL ACTION TAKEN';
    statusBg = '#dcfce7';
    statusColor = '#166534';
  } else if (status === 'RESOLVED' || status === 'CLOSED') {
    statusLabel = 'RESOLVED & VERIFIED';
    statusBg = '#bbf7d0';
    statusColor = '#14532d';
  }

  // Target badge
  let targetIcon = '⚠️';
  let targetLabel = 'General Service Issue';
  if (complaint.target_type === 'STAFF') {
    targetIcon = '👨‍✈️';
    targetLabel = 'Staff Misconduct (సిబ్బంది ప్రవర్తన)';
  } else if (complaint.target_type === 'BUS_CONDITION') {
    targetIcon = '🚌';
    targetLabel = 'Bus Condition & Defect (బస్సు పరిస్థితి)';
  } else if (complaint.target_type === 'SERVICE') {
    targetIcon = '⏱️';
    targetLabel = 'Route Schedule / Delay Issue (రవాణా సేవలు)';
  }

  // Build the timeline HTML
  const timelineHtml = steps.map((step, idx) => {
    const isCompleted = currentIndex >= idx;
    const isCurrent = (currentIndex === idx) || (status === 'CLOSED' && idx === 4);
    const circleBg = isCurrent ? '#006045' : (isCompleted ? '#16a34a' : '#e2e8f0');
    const textColor = isCurrent ? '#004230' : (isCompleted ? '#15803d' : '#94a3b8');
    const borderStyle = isCurrent ? '2px solid #ffb703' : 'none';

    return `
      <div style="flex: 1; text-align: center; position: relative; padding: 0 4px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${circleBg}; color: #ffffff; display: flex; align-items: center; justify-content: center; margin: 0 auto 6px; font-size: 1rem; box-shadow: 0 2px 6px rgba(0,0,0,0.15); border: ${borderStyle};">
          ${isCompleted ? (isCurrent ? step.icon : '✓') : step.icon}
        </div>
        <div style="font-size: 0.76rem; font-weight: 800; color: ${textColor}; line-height: 1.2;">${step.label}</div>
        <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">${step.sub}</div>
      </div>
    `;
  }).join('');

  // Build Action Taken Card
  const hasActionTaken = Boolean(complaint.officer_notes);
  const actionBanner = `
    <div style="background: ${hasActionTaken ? '#f0fdf4' : '#fffbeb'}; border: 2px solid ${hasActionTaken ? '#22c55e' : '#f59e0b'}; border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.4rem;">${hasActionTaken ? '🛡️' : '⏳'}</span>
          <h4 style="margin: 0; color: ${hasActionTaken ? '#14532d' : '#92400e'}; font-size: 1rem; font-weight: 800;">
            ${hasActionTaken ? 'APSRTC OFFICIAL ACTION TAKEN & REMEDIAL MEASURE' : 'CURRENT STATUS: UNDER ACTIVE INQUIRY'}
          </h4>
        </div>
        <span style="background: ${statusBg}; color: ${statusColor}; font-weight: 800; font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
          ${statusLabel}
        </span>
      </div>

      <div style="background: #ffffff; border: 1px solid ${hasActionTaken ? '#bbf7d0' : '#fde68a'}; border-radius: 8px; padding: 0.85rem 1rem; font-size: 0.9rem; line-height: 1.6; color: #1e293b; margin-bottom: 0.75rem;">
        <strong style="color: #004230; font-size: 0.82rem; text-transform: uppercase;">Action Taken Summary / అధికారులు చేపట్టిన చర్య:</strong><br>
        <span style="color: ${hasActionTaken ? '#065f46' : '#64748b'}; font-weight: ${hasActionTaken ? '600' : '400'}; display: block; margin-top: 4px;">
          ${complaint.officer_notes || 'The assigned Regional Depot Vigilance Officer & Depot Manager are currently reviewing this incident report. Necessary vehicle inspection or crew inquiry is in progress under APSRTC Citizen Service Standards.'}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: 0.75rem; color: #475569;">
        <div>
          <strong>Responsible Authority:</strong><br>
          <span style="color: #004230; font-weight: 700;">🏢 ${complaint.depot || 'Paderu'} RTC Depot & Vigilance Cell</span>
        </div>
        <div>
          <strong>Last Action Recorded:</strong><br>
          <span>📅 ${new Date(complaint.updated_at || complaint.created_at).toLocaleString()}</span>
        </div>
        <div>
          <strong>APSRTC Citizen Charter:</strong><br>
          <span style="color: #166534; font-weight: 700;">⚡ 24-Hour Redressal SLA Active</span>
        </div>
      </div>
    </div>
  `;

  // Build Incident Dossier (What Happened)
  const incidentCard = `
    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
        <h4 style="margin: 0; color: #004230; font-weight: 800; font-size: 0.95rem;">
          📋 INCIDENT REPORT DOSSIER (ఏమి జరిగింది / పూర్తి వివరాలు)
        </h4>
        <span style="font-family: monospace; font-weight: 800; color: #006045; background: #e0f2fe; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">
          Ref: ${complaint.complaint_ref}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 0.85rem; font-size: 0.82rem;">
        <div>
          <span style="color: #64748b; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Target Type</span><br>
          <strong>${targetIcon} ${targetLabel}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Bus Involved</span><br>
          <strong style="color: #006045; font-size: 0.95rem;">Bus ${complaint.bus_number}</strong>
          <span style="color: #64748b; font-size: 0.75rem;">(${complaint.registration_number || 'AP-39-Z-' + complaint.bus_number})</span>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Service & Depot</span><br>
          <strong>${(complaint.service_type || 'EXPRESS').replace('_', ' ')} • ${complaint.depot || 'Paderu'} Depot</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Incident Location</span><br>
          <strong>📍 ${complaint.location || 'Eastern Ghats Corridor Route'}</strong>
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.85rem; margin-bottom: 0.75rem;">
        <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 0.2rem; text-transform: uppercase;">Specific Grievance Reason:</div>
        <div style="font-weight: 800; color: #b91c1c; font-size: 0.9rem; margin-bottom: 0.6rem;">${complaint.category}</div>
        <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 0.2rem; text-transform: uppercase;">Complainant Statement / సంఘటన వివరణ:</div>
        <div style="font-size: 0.85rem; line-height: 1.5; color: #1e293b; background: #f8fafc; padding: 0.6rem 0.8rem; border-radius: 4px; border-left: 3px solid #b91c1c;">
          "${complaint.description}"
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; flex-wrap: wrap; gap: 0.5rem;">
        <div>Complainant: <strong>${complaint.passenger_name || 'Passenger'}</strong> ${complaint.passenger_phone ? `(${complaint.passenger_phone})` : ''}</div>
        <div>Lodged Date: <strong>${new Date(complaint.created_at).toLocaleString()}</strong></div>
      </div>
    </div>
  `;

  // Build History / Investigation Trail
  let historyCard = '';
  if (history && history.length > 0) {
    const historyRows = history.map(h => `
      <div style="display: flex; gap: 0.85rem; padding: 0.65rem 0; border-bottom: 1px dashed #e2e8f0;">
        <div style="min-width: 140px; font-size: 0.72rem; color: #64748b;">
          <strong>${new Date(h.created_at).toLocaleString()}</strong>
        </div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; flex-wrap: wrap;">
            <span style="font-size: 0.7rem; font-weight: 800; background: #e2e8f0; color: #1e293b; padding: 1px 6px; border-radius: 3px;">${h.old_status || 'INIT'}</span>
            <span style="font-size: 0.7rem; color: #64748b;">➔</span>
            <span style="font-size: 0.7rem; font-weight: 800; background: #dcfce7; color: #166534; padding: 1px 6px; border-radius: 3px;">${h.new_status}</span>
            <span style="font-size: 0.72rem; font-weight: 700; color: #004230; margin-left: 0.3rem;">By: ${h.changed_by}</span>
          </div>
          <div style="font-size: 0.8rem; color: #334155; line-height: 1.4;">${h.notes || 'Status updated'}</div>
        </div>
      </div>
    `).join('');

    historyCard = `
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 1.25rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: #004230; font-weight: 800; font-size: 0.95rem;">
          📜 OFFICIAL INVESTIGATION AUDIT TRAIL (కాలక్రమ విచారణ & చర్యల రికార్డు)
        </h4>
        <div>${historyRows}</div>
      </div>
    `;
  }

  // Put it all together
  container.innerHTML = `
    <!-- Top Stepper -->
    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 1.25rem 0.5rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative;">
        ${timelineHtml}
      </div>
    </div>

    <!-- Official Action Taken Highlight -->
    ${actionBanner}

    <!-- Incident Dossier -->
    ${incidentCard}

    <!-- Historical Audit Trail -->
    ${historyCard}
  `;
}

function printGrievanceReceipt() {
  if (!currentTrackingComplaint || !currentTrackingComplaint.complaint) {
    alert('Please track a grievance first to print receipt.');
    return;
  }
  const c = currentTrackingComplaint.complaint;
  const printWindow = window.open('', '_blank', 'width=720,height=620');
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>APSRTC Grievance Slip - ${c.complaint_ref}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; }
          .header { border-bottom: 3px solid #006045; padding-bottom: 12px; margin-bottom: 16px; }
          .badge { display: inline-block; padding: 4px 8px; background: #006045; color: #fff; font-weight: bold; border-radius: 4px; }
          .box { border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; margin: 12px 0; background: #f8fafc; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
          td.label { font-weight: bold; width: 35%; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="color: #004230; margin: 0;">Andhra Pradesh State Road Transport Corporation</h2>
          <div style="font-size: 12px; color: #64748b;">Official Citizen Passenger Grievance Acknowledgement & Action Taken Slip</div>
        </div>
        <div><strong>Reference ID:</strong> <span class="badge">${c.complaint_ref}</span></div>
        <table>
          <tr><td class="label">Current Status:</td><td><strong>${c.status}</strong></td></tr>
          <tr><td class="label">Target Category:</td><td>${c.target_type}</td></tr>
          <tr><td class="label">Bus Number:</td><td>Bus ${c.bus_number} (${c.registration_number || 'APSRTC'})</td></tr>
          <tr><td class="label">Operating Depot:</td><td>${c.depot || 'Paderu'} Depot</td></tr>
          <tr><td class="label">Grievance Reason:</td><td>${c.category}</td></tr>
          <tr><td class="label">Complainant Statement:</td><td>"${c.description}"</td></tr>
          <tr><td class="label">Reported Location:</td><td>${c.location || 'Corridor Route'}</td></tr>
          <tr><td class="label">Complainant Name:</td><td>${c.passenger_name || 'Passenger'} (${c.passenger_phone || 'N/A'})</td></tr>
          <tr><td class="label">Lodged Date:</td><td>${new Date(c.created_at).toLocaleString()}</td></tr>
        </table>
        <div class="box">
          <strong style="color: #006045;">Official Action Taken / Depot Findings:</strong><br>
          <div style="margin-top: 6px; font-size: 13px; line-height: 1.5; color: #065f46; font-weight: 600;">
            ${c.officer_notes || 'Investigation active under Regional Depot Vigilance Officer.'}
          </div>
        </div>
        <div style="margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center;">
          This is an official computer-generated receipt from APSRTC SmartTrack Telemetry & Redressal Portal. 24x7 Helpline: 149
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
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
  handleTrackSubmit,
  printGrievanceReceipt,
  selectComplaintTarget,
  closeModal
};
