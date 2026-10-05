/**
 * APSRTC SmartTrack Officer / Operations Dashboard
 * Fleet monitoring, dynamic source priority failover testing, and grievance resolution.
 */

let fleetData = [];
let complaintsData = [];

async function initOfficer() {
  await loadFleetOverview();
  await loadComplaintsTable();
  setupOfficerEvents();

  // Refresh officer metrics periodically
  setInterval(loadFleetOverview, 10000);
}

function setupOfficerEvents() {
  const filterInput = document.getElementById('officerFleetFilter');
  if (filterInput) {
    filterInput.addEventListener('input', applyFleetFilters);
  }

  const sourceFilter = document.getElementById('officerSourceFilter');
  if (sourceFilter) {
    sourceFilter.addEventListener('change', applyFleetFilters);
  }

  const statusFilter = document.getElementById('officerStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyFleetFilters);
  }

  const failoverBtn = document.getElementById('simulateFailoverBtn');
  if (failoverBtn) {
    failoverBtn.addEventListener('click', handleFailoverTest);
  }
}

async function loadFleetOverview() {
  try {
    const data = await api.getFleetOverview();
    if (!data.success) return;

    fleetData = data.fleet || [];
    renderSummaryMetrics(data.summary);
    applyFleetFilters();
  } catch (err) {
    console.error('Failed to load fleet overview:', err);
  }
}

function renderSummaryMetrics(summary) {
  setMetric('metricTotalBuses', summary.totalBuses);
  setMetric('metricActiveTrips', summary.activeBuses);
  setMetric('metricLiveBuses', summary.freshness.live);
  setMetric('metricStaleBuses', summary.freshness.stale);
  setMetric('metricOfflineBuses', summary.freshness.unavailable);
  setMetric('metricHwTrackers', summary.sources.hardwareTracker);
  setMetric('metricCrewGps', summary.sources.crewPhone);
  setMetric('metricEtmGps', summary.sources.etm);
  setMetric('metricActiveComplaints', summary.complaints.active);
  setMetric('metricCriticalAlerts', summary.alerts.critical);
}

function setMetric(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val !== undefined ? val : 0;
}

function applyFleetFilters() {
  const search = (document.getElementById('officerFleetFilter')?.value || '').toLowerCase();
  const source = document.getElementById('officerSourceFilter')?.value || '';
  const status = document.getElementById('officerStatusFilter')?.value || '';

  const filtered = fleetData.filter(bus => {
    const matchesSearch = !search || 
      bus.bus_number.toLowerCase().includes(search) ||
      (bus.location_name && bus.location_name.toLowerCase().includes(search)) ||
      (bus.route_name && bus.route_name.toLowerCase().includes(search));

    const matchesSource = !source || bus.active_source === source;
    const matchesStatus = !status || bus.freshness === status;

    return matchesSearch && matchesSource && matchesStatus;
  });

  renderFleetTable(filtered);
}

function renderFleetTable(buses) {
  const tbody = document.getElementById('officerFleetTableBody');
  if (!tbody) return;

  if (buses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No buses match the filter criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = buses.map(bus => `
    <tr>
      <td>
        <strong style="color: #004d40;">Bus ${bus.bus_number}</strong><br>
        <span style="font-size: 0.72rem; color: #64748b;">${bus.registration_number}</span>
      </td>
      <td>
        <div>${bus.route_name || 'Corridor Service'}</div>
        <span style="font-size: 0.72rem; color: #0284c7;">${bus.trip_from || 'Araku'} ➔ ${bus.trip_to || 'Visakhapatnam'}</span>
      </td>
      <td>
        <strong>${bus.location_name || 'En Route'}</strong><br>
        <span style="font-size: 0.72rem; color: #64748b;">${bus.latitude ? `${bus.latitude.toFixed(4)}, ${bus.longitude.toFixed(4)}` : 'N/A'}</span>
      </td>
      <td>
        <span class="source-pill ${bus.active_source}">${formatSource(bus.active_source)}</span>
      </td>
      <td>
        <span class="freshness-pill ${bus.freshness}">
          <span class="pulse-dot"></span>
          ${bus.freshness}
        </span>
      </td>
      <td>${Math.round(bus.speed_kph || 0)} km/h</td>
      <td>±${Math.round(bus.accuracy_meters || 10)}m</td>
      <td>${bus.ageSeconds !== null ? `${bus.ageSeconds}s ago` : 'Stale'}</td>
      <td>
        <button class="btn-card-action" style="padding: 3px 8px; font-size: 0.75rem;" onclick="fleetMap.focusBus('${bus.bus_number}'); app.switchTab('passenger');">
          🗺️ Locate
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleFailoverTest() {
  const busNumber = document.getElementById('failoverBusSelect').value;
  const sourceToDrop = document.getElementById('failoverSourceSelect').value;
  const resultBox = document.getElementById('failoverResultBox');

  if (!busNumber || !sourceToDrop) {
    alert('Please select Bus Number and Source to drop.');
    return;
  }

  try {
    const res = await api.simulateDrop(busNumber, sourceToDrop);
    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div style="background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 8px; padding: 0.85rem; font-size: 0.85rem;">
          <h4 style="color: #15803d; font-weight: 800;">⚡ Multi-Source Priority Failover Executed</h4>
          <p><strong>Target:</strong> Bus ${busNumber} | <strong>Dropped Source:</strong> ${sourceToDrop}</p>
          <p><strong>Resolved Active Source:</strong> <span class="source-pill ${res.activeState?.activeSource}">${res.activeState?.activeSource}</span></p>
          <p><strong>Status:</strong> ${res.activeState?.status} | <strong>Location:</strong> ${res.activeState?.locationName}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">System seamlessly transferred telemetry to the next valid hierarchical source without passenger disruption.</p>
        </div>
      `;
    }
    loadFleetOverview();
  } catch (err) {
    alert(`Failover execution failed: ${err.message}`);
  }
}

async function loadComplaintsTable() {
  try {
    const data = await api.getComplaints();
    if (!data.success) return;

    complaintsData = data.complaints || [];
    renderComplaintsTable(complaintsData);
  } catch (err) {
    console.error('Failed to load complaints:', err);
  }
}

function renderComplaintsTable(complaints) {
  const tbody = document.getElementById('officerComplaintsTableBody');
  if (!tbody) return;

  if (complaints.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No passenger grievances recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = complaints.map(c => {
    let targetBadge = '';
    if (c.target_type === 'STAFF') {
      targetBadge = `<span style="display: inline-block; background: #fee2e2; color: #991b1b; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; margin-bottom: 2px;">👨‍✈️ Staff Misconduct</span>`;
    } else if (c.target_type === 'BUS_CONDITION') {
      targetBadge = `<span style="display: inline-block; background: #fef3c7; color: #92400e; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; margin-bottom: 2px;">🚌 Bus Defect</span>`;
    } else {
      targetBadge = `<span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; margin-bottom: 2px;">⏱️ Service</span>`;
    }

    return `
    <tr>
      <td><strong>${c.complaint_ref}</strong></td>
      <td>
        ${targetBadge}<br>
        <span class="bus-num-pill" style="font-size: 0.85rem; padding: 2px 6px;">Bus ${c.bus_number}</span>
      </td>
      <td><strong>${c.category}</strong></td>
      <td style="max-width: 250px;">
        <div style="font-size: 0.8rem; font-weight: 600;">${c.description}</div>
        ${c.location ? `<div style="font-size: 0.72rem; color: #006045;">📍 ${c.location}</div>` : ''}
        <span style="font-size: 0.72rem; color: #64748b;">By: ${c.passenger_name} (${c.passenger_phone || 'No phone'})</span>
      </td>
      <td>
        <span class="status-badge-complaint ${c.status}">${c.status}</span>
      </td>
      <td style="font-size: 0.75rem; color: #64748b;">${new Date(c.created_at).toLocaleString()}</td>
      <td>
        <select onchange="officerApp.updateStatus('${c.id}', this.value)" style="font-size: 0.75rem; padding: 4px; border-radius: 4px; border: 1px solid #cbd5e1;">
          <option value="NEW" ${c.status === 'NEW' ? 'selected' : ''}>NEW</option>
          <option value="ACKNOWLEDGED" ${c.status === 'ACKNOWLEDGED' ? 'selected' : ''}>ACKNOWLEDGED</option>
          <option value="INVESTIGATING" ${c.status === 'INVESTIGATING' ? 'selected' : ''}>INVESTIGATING</option>
          <option value="ACTION_TAKEN" ${c.status === 'ACTION_TAKEN' ? 'selected' : ''}>ACTION TAKEN</option>
          <option value="RESOLVED" ${c.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
          <option value="CLOSED" ${c.status === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
        </select>
      </td>
    </tr>
    `;
  }).join('');
}

function applyGrievanceFilter(targetType) {
  if (!targetType) {
    renderComplaintsTable(complaintsData);
  } else {
    const filtered = complaintsData.filter(c => c.target_type === targetType);
    renderComplaintsTable(filtered);
  }
}

async function updateStatus(id, newStatus) {
  const notes = prompt(`Enter officer investigation notes for status "${newStatus}":`, 'Reviewed by Depot Manager');
  if (notes === null) return;

  try {
    await api.updateComplaintStatus(id, newStatus, notes);
    await loadComplaintsTable();
    await loadFleetOverview();
    alert(`Complaint status updated to ${newStatus}`);
  } catch (err) {
    alert(`Failed to update status: ${err.message}`);
  }
}

function formatSource(source) {
  switch (source) {
    case 'HARDWARE_TRACKER': return 'Hardware Tracker';
    case 'CREW_PHONE': return 'Crew Mobile';
    case 'ETM': return 'ETM Device';
    case 'DEMO': return 'Demo GPS';
    default: return source;
  }
}

window.officerApp = {
  init: initOfficer,
  loadFleetOverview,
  handleFailoverTest,
  updateStatus,
  applyGrievanceFilter
};
