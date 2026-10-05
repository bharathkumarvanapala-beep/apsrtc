/**
 * APSRTC SmartTrack Master Application Coordinator
 * Boots up Map, WebSockets, Tabs, and Module Controllers.
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing APSRTC SmartTrack Application...');

  // 1. Initialize Map
  if (window.fleetMap) {
    window.fleetMap.init('fleetMap');
  }

  // 2. Initialize Real-Time WebSockets
  if (window.socketClient) {
    window.socketClient.init();
  }

  // 3. Initialize Sub-Applications
  if (window.passengerApp) {
    window.passengerApp.init();
  }
  if (window.crewApp) {
    window.crewApp.init();
  }
  if (window.officerApp) {
    window.officerApp.init();
  }

  // 4. Setup Global Tab Switching
  setupTabNavigation();

  // Handle URL query parameter ?tab=crew / ?tab=officer / ?tab=simulator
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam && ['passenger', 'crew', 'officer', 'simulator'].includes(tabParam)) {
    switchTab(tabParam);
  }

  // 5. Setup Modal Dismiss Listeners
  setupModalDismiss();

  // 6. Setup In-Browser Simulator Controls
  setupSimulatorControls();
});

function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  // Update Tab Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update View Sections
  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.toggle('active', view.id === `view-${tabId}`);
  });

  // Invalidate map size when switching back to passenger/map view
  if (tabId === 'passenger' && window.fleetMap && window.fleetMap.getMap()) {
    setTimeout(() => {
      window.fleetMap.getMap().invalidateSize();
    }, 200);
  }

  // Refresh officer table if switching to officer tab
  if (tabId === 'officer' && window.officerApp) {
    window.officerApp.loadFleetOverview();
  }
}

function setupModalDismiss() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(modal => {
        modal.classList.remove('open');
      });
    }
  });
}

// In-Browser Simulation Trigger
let simInterval = null;
function setupSimulatorControls() {
  const triggerBtn = document.getElementById('simTriggerTickBtn');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', async () => {
      // Send a ping for Bus 302 and Bus 415 to keep them fresh
      try {
        await api.sendGpsUpdate('demo', {
          busNumber: '302',
          deviceId: 'DEMO-SIM-302',
          latitude: 18.0816 + (Math.random() * 0.005),
          longitude: 82.6700 + (Math.random() * 0.005),
          accuracyMeters: 14,
          speedKph: 42,
          heading: 120
        });
        await api.sendGpsUpdate('crew', {
          busNumber: '415',
          deviceId: 'DRIVER-415-01',
          latitude: 17.9500 + (Math.random() * 0.005),
          longitude: 82.5167 + (Math.random() * 0.005),
          accuracyMeters: 10,
          speedKph: 45,
          heading: 105
        });
        alert('🛰️ Simulated GPS Pings Dispatched! Check live updates.');
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  const loopToggle = document.getElementById('simLoopToggleBtn');
  if (loopToggle) {
    loopToggle.addEventListener('click', () => {
      if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
        loopToggle.textContent = '▶️ Start In-Browser Pings (3s)';
        loopToggle.style.background = '#00695c';
      } else {
        loopToggle.textContent = '⏹️ Stop In-Browser Pings';
        loopToggle.style.background = '#c62828';
        simInterval = setInterval(async () => {
          try {
            await api.sendGpsUpdate('demo', {
              busNumber: '302',
              latitude: 18.0816 + (Math.random() * 0.008 - 0.004),
              longitude: 82.6700 + (Math.random() * 0.008 - 0.004),
              speedKph: Math.round(35 + Math.random() * 15),
              accuracyMeters: 12
            });
            await api.sendGpsUpdate('device', {
              busNumber: '518',
              latitude: 17.8700 + (Math.random() * 0.008 - 0.004),
              longitude: 82.3500 + (Math.random() * 0.008 - 0.004),
              speedKph: Math.round(40 + Math.random() * 15),
              accuracyMeters: 6
            });
          } catch (e) {}
        }, 3000);
      }
    });
  }
}

window.app = {
  switchTab
};
