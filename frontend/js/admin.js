/**
 * APSRTC SmartTrack Admin Control Module
 * Depot fleet registration, crew duty assignments, GPS hardware registry, and emergency broadcasts.
 */

let adminFleetData = [];

async function initAdmin() {
  console.log('⚙️ Initializing APSRTC Admin Control Module...');
  await loadFleetAssets();
  await loadDeviceInventory();
  setupAdminEvents();
}

function setupAdminEvents() {
  const regForm = document.getElementById('adminRegisterBusForm');
  if (regForm) {
    regForm.addEventListener('submit', handleRegisterBus);
  }

  const broadcastForm = document.getElementById('adminBroadcastForm');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', handleBroadcastSubmit);
  }

  const searchInput = document.getElementById('adminFleetSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const filtered = adminFleetData.filter(b => 
        b.bus_number.toLowerCase().includes(q) ||
        b.registration_number.toLowerCase().includes(q) ||
        b.depot.toLowerCase().includes(q) ||
        b.service_type.toLowerCase().includes(q)
      );
      renderFleetAssetsTable(filtered);
    });
  }
}

async function loadFleetAssets() {
  try {
    const data = await api.getFleetOverview();
    if (!data.success) return;

    adminFleetData = data.fleet || [];
    renderFleetAssetsTable(adminFleetData);
    updateAdminCounters(data.summary);
  } catch (err) {
    console.error('Failed to load admin fleet assets:', err);
  }
}

function updateAdminCounters(summary) {
  const totalEl = document.getElementById('adminTotalAssetsCount');
  if (totalEl) totalEl.textContent = summary?.totalBuses || adminFleetData.length;

  const activeEl = document.getElementById('adminActiveTripsCount');
  if (activeEl) activeEl.textContent = summary?.activeBuses || 0;

  const complaintsEl = document.getElementById('adminPendingGrievancesCount');
  if (complaintsEl) complaintsEl.textContent = summary?.complaints?.active || 0;
}

function renderFleetAssetsTable(buses) {
  const tbody = document.getElementById('adminFleetTableBody');
  if (!tbody) return;

  if (buses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No fleet assets match filter.</td></tr>';
    return;
  }

  tbody.innerHTML = buses.map(b => {
    const statusColor = b.bus_status === 'ACTIVE' ? '#16a34a' : (b.bus_status === 'MAINTENANCE' ? '#ea580c' : '#64748b');
    return `
      <tr>
        <td>
          <strong style="color: #004230; font-size: 0.95rem;">Bus ${b.bus_number}</strong>
        </td>
        <td>
          <span style="font-family: monospace; font-weight: 700; color: #1e293b;">${b.registration_number}</span>
        </td>
        <td>
          <span style="font-weight: 700; color: #006045;">${b.depot} Depot</span>
        </td>
        <td>
          <span style="font-size: 0.8rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 700;">
            ${(b.service_type || 'EXPRESS').replace('_', ' ')}
          </span>
        </td>
        <td>${b.total_seats || 45} Seats</td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 800; color: ${statusColor}; background: ${statusColor}18; padding: 2px 8px; border-radius: 4px;">
            <span class="pulse-dot" style="background: ${statusColor};"></span> ${b.bus_status || 'ACTIVE'}
          </span>
        </td>
        <td>
          <select onchange="adminApp.updateStatus('${b.bus_number}', this.value)" style="font-size: 0.75rem; padding: 4px 6px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600;">
            <option value="ACTIVE" ${b.bus_status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="MAINTENANCE" ${b.bus_status === 'MAINTENANCE' ? 'selected' : ''}>MAINTENANCE</option>
            <option value="STANDBY" ${b.bus_status === 'STANDBY' ? 'selected' : ''}>STANDBY</option>
            <option value="DECOMMISSIONED" ${b.bus_status === 'DECOMMISSIONED' ? 'selected' : ''}>DECOMMISSIONED</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleRegisterBus(e) {
  e.preventDefault();
  const busNumber = document.getElementById('regBusNumber').value.trim();
  const registrationNumber = document.getElementById('regRegistrationNumber').value.trim().toUpperCase();
  const depot = document.getElementById('regDepot').value;
  const serviceType = document.getElementById('regServiceType').value;
  const totalSeats = Number(document.getElementById('regTotalSeats').value) || 45;

  try {
    const res = await api.createBus({
      busNumber,
      registrationNumber,
      depot,
      serviceType,
      totalSeats
    });

    alert(`✅ BUS REGISTERED SUCCESSFULLY IN APSRTC DATABASE!\n\n` +
          `Bus Number: ${busNumber}\n` +
          `Registration: ${registrationNumber}\n` +
          `Depot: ${depot}\n` +
          `Class: ${serviceType}\n` +
          `The asset has been allocated to active corridor tracking.`);

    document.getElementById('adminRegisterBusForm').reset();
    await loadFleetAssets();
  } catch (err) {
    alert(`Registration Error: ${err.message}`);
  }
}

async function updateStatus(busNumber, newStatus) {
  try {
    await api.updateBusStatus(busNumber, newStatus);
    await loadFleetAssets();
  } catch (err) {
    alert(`Status update failed: ${err.message}`);
  }
}

async function loadDeviceInventory() {
  try {
    const data = await api.getDeviceRegistry();
    if (!data.success) return;

    const tbody = document.getElementById('adminDevicesTableBody');
    if (!tbody) return;

    const allDevices = [
      ...(data.trackers || []).map(t => ({
        id: t.device_id,
        type: '🛰️ Hardware GPS Box',
        bus: t.bus_number ? `Bus ${t.bus_number}` : 'Unassigned',
        depot: t.depot || 'Agency Fleet',
        status: t.status || 'ACTIVE',
        details: `Firmware ${t.firmware_version || 'v2.4.1'}`
      })),
      ...(data.etms || []).map(e => ({
        id: e.etm_id,
        type: '🎫 ETM Device Terminal',
        bus: e.bus_number ? `Bus ${e.bus_number}` : 'Standby Depot Unit',
        depot: e.depot || 'Central Depot',
        status: e.status || 'ONLINE',
        details: 'GPRS Telemetry Ready'
      }))
    ];

    tbody.innerHTML = allDevices.map(d => `
      <tr>
        <td><strong>${d.id}</strong></td>
        <td>${d.type}</td>
        <td><span class="bus-num-pill">${d.bus}</span></td>
        <td>${d.depot}</td>
        <td>
          <span style="font-size: 0.75rem; font-weight: 700; color: #16a34a; background: #dcfce7; padding: 2px 6px; border-radius: 4px;">
            ${d.status}
          </span>
        </td>
        <td style="font-size: 0.78rem; color: #64748b;">${d.details}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load device inventory:', err);
  }
}

async function handleBroadcastSubmit(e) {
  e.preventDefault();
  const message = document.getElementById('adminBroadcastMsg').value.trim();
  const severity = document.getElementById('adminBroadcastSeverity').value;

  if (!message) return;

  try {
    await api.broadcastAnnouncement(message, severity);
    alert('📢 BROADCAST DISPATCHED!\n\nMessage has been streamed live across all passenger screens and crew portals.');
    document.getElementById('adminBroadcastMsg').value = '';

    // Also update current news ticker track in DOM immediately
    const ticker = document.querySelector('.ticker-track');
    if (ticker) {
      const span = document.createElement('span');
      span.innerHTML = `🚨 <strong>DEPOT BROADCAST:</strong> ${message}`;
      ticker.prepend(span);
    }
  } catch (err) {
    alert(`Broadcast Failed: ${err.message}`);
  }
}

window.adminApp = {
  init: initAdmin,
  loadFleetAssets,
  updateStatus
};
