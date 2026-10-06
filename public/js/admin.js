/**
 * APSRTC SmartTrack Admin Control Module
 * Secure Depot Fleet Registration, Device Registry, and Emergency Broadcasts.
 * Protected by Administrative Security Gate: Unauthorized users cannot view console.
 */

let adminFleetData = [];

async function initAdmin() {
  console.log('⚙️ Initializing APSRTC Admin Control Module...');
  setupAdminEvents();

  // Developer auto-access detection via URL parameters: ?admin=true, ?dev=true, or ?auto=true
  const urlParams = new URLSearchParams(window.location.search);
  const wantsDevAccess = urlParams.get('admin') === 'true' || 
                         urlParams.get('dev') === 'true' || 
                         urlParams.get('auto') === 'true';

  if (wantsDevAccess && !api.isAdminAuthenticated()) {
    console.log('⚡ Developer auto-access triggered via URL parameter');
    await quickDevLogin(false);
  }

  checkAuthUI();

  if (api.isAdminAuthenticated()) {
    await loadFleetAssets();
    await loadDeviceInventory();
  }
}

async function quickDevLogin(showAlert = true) {
  try {
    const res = await api.adminLogin({ pin: '2026' });
    closeModal('adminAuthModal');
    checkAuthUI();
    await loadFleetAssets();
    await loadDeviceInventory();

    // Switch to admin view automatically
    if (window.app && window.app.switchTab) {
      window.app.switchTab('admin');
    }

    if (showAlert) {
      alert(`⚡ DEVELOPER ACCESS GRANTED!\n\n` +
            `Authenticated as: ${res.admin?.name || 'Chief Depot Controller'}\n` +
            `Assigned: ${res.admin?.depot || 'Headquarters'}\n` +
            `PIN: 2026 (Saved in browser storage for persistent building session).`);
    }
    return true;
  } catch (err) {
    console.error('quickDevLogin error:', err);
    if (showAlert) {
      alert(`Developer auto-login failed: ${err.message}`);
    }
    return false;
  }
}

function checkAuthUI() {
  const isAuth = api.isAdminAuthenticated();
  const navTab = document.getElementById('navTabAdmin');
  const gateLock = document.getElementById('adminAuthGateLock');
  const consoleContent = document.getElementById('adminConsoleContent');
  const authTopBadge = document.getElementById('adminTopAuthBadge');

  if (navTab) {
    navTab.style.display = isAuth ? 'flex' : 'none';
  }

  if (gateLock) {
    gateLock.style.display = isAuth ? 'none' : 'block';
  }

  if (consoleContent) {
    consoleContent.style.display = isAuth ? 'block' : 'none';
  }

  if (authTopBadge) {
    if (isAuth) {
      authTopBadge.innerHTML = `
        <span style="color: #4ade80; font-weight: 700;">🟢 Depot Admin</span>
        <button type="button" class="gov-link-btn" onclick="adminApp.logout()" style="background: rgba(220, 38, 38, 0.4); border-color: rgba(248, 113, 113, 0.4);">
          🚪 Sign Out
        </button>
      `;
    } else {
      authTopBadge.innerHTML = `
        <button type="button" class="gov-link-btn" onclick="adminApp.openLoginModal()" style="background: rgba(255, 255, 255, 0.12);">
          🔒 Staff / Depot Login
        </button>
      `;
    }
  }
}

function setupAdminEvents() {
  // 1. Bus Registration Form
  const regForm = document.getElementById('adminRegisterBusForm');
  if (regForm) {
    regForm.addEventListener('submit', handleRegisterBus);
  }

  // 2. Broadcast Form
  const broadcastForm = document.getElementById('adminBroadcastForm');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', handleBroadcastSubmit);
  }

  // 3. Search Filter
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

  // 4. Modal Login Form
  const modalLoginForm = document.getElementById('adminModalLoginForm');
  if (modalLoginForm) {
    modalLoginForm.addEventListener('submit', (e) => handleLoginSubmit(e, 'modal'));
  }

  // 5. In-Page Gate Login Form
  const gateLoginForm = document.getElementById('adminGateLoginForm');
  if (gateLoginForm) {
    gateLoginForm.addEventListener('submit', (e) => handleLoginSubmit(e, 'gate'));
  }
}

async function handleLoginSubmit(e, source = 'modal') {
  e.preventDefault();
  const userField = source === 'modal' ? 'adminModalUser' : 'adminGateUser';
  const passField = source === 'modal' ? 'adminModalPass' : 'adminGatePass';
  const pinField = source === 'modal' ? 'adminModalPin' : 'adminGatePin';

  const username = document.getElementById(userField)?.value?.trim() || '';
  const password = document.getElementById(passField)?.value?.trim() || '';
  const pin = document.getElementById(pinField)?.value?.trim() || '';

  try {
    const res = await api.adminLogin({ username, password, pin });
    closeModal('adminAuthModal');
    checkAuthUI();
    await loadFleetAssets();
    await loadDeviceInventory();

    // Switch to admin view automatically
    if (window.app && window.app.switchTab) {
      window.app.switchTab('admin');
    }

    alert(`✅ APSRTC DEPOT ADMIN AUTHENTICATED!\n\n` +
          `Welcome, ${res.admin?.name || 'Depot Officer'}.\n` +
          `Assigned: ${res.admin?.depot || 'Headquarters'}\n\n` +
          `Administrative fleet tools and broadcast controls are now active.`);
  } catch (err) {
    alert(`❌ Authentication Failed: ${err.message}\n\nHint for Demo: Enter PIN "2026" or Username "admin" / Password "apsrtc@admin2026".`);
  }
}

function logout() {
  api.logoutAdmin();
  checkAuthUI();
  if (window.app && window.app.switchTab) {
    window.app.switchTab('passenger');
  }
  alert('🚪 You have been signed out from APSRTC Depot Admin Console.');
}

function openLoginModal() {
  const modal = document.getElementById('adminAuthModal');
  if (modal) {
    modal.classList.add('open');
  }
}

async function loadFleetAssets() {
  if (!api.isAdminAuthenticated()) return;
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
  if (!api.isAdminAuthenticated()) {
    openLoginModal();
    return;
  }

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
  if (!api.isAdminAuthenticated()) {
    openLoginModal();
    return;
  }

  try {
    await api.updateBusStatus(busNumber, newStatus);
    await loadFleetAssets();
  } catch (err) {
    alert(`Status update failed: ${err.message}`);
  }
}

async function loadDeviceInventory() {
  if (!api.isAdminAuthenticated()) return;
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
  if (!api.isAdminAuthenticated()) {
    openLoginModal();
    return;
  }

  const message = document.getElementById('adminBroadcastMsg').value.trim();
  const severity = document.getElementById('adminBroadcastSeverity').value;

  if (!message) return;

  try {
    await api.broadcastAnnouncement(message, severity);
    alert('📢 BROADCAST DISPATCHED!\n\nMessage has been streamed live across all passenger screens and crew portals.');
    document.getElementById('adminBroadcastMsg').value = '';

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

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

window.adminApp = {
  init: initAdmin,
  loadFleetAssets,
  updateStatus,
  openLoginModal,
  logout,
  checkAuthUI,
  quickDevLogin
};
