/**
 * APSRTC SmartTrack Socket Client
 * Handles real-time WebSockets with automatic reconnection and event dispatch.
 */

let socket = null;
const listeners = {
  'bus:location_update': [],
  'fleet:alert': [],
  'complaint:update': [],
  'connect': [],
  'disconnect': []
};

function initSocketConnection() {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO script not loaded, running in HTTP polling fallback mode');
    return;
  }

  socket = io(window.location.origin, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  socket.on('connect', () => {
    console.log('⚡ Connected to APSRTC Live WebSocket Server (ID:', socket.id, ')');
    socket.emit('join:fleet');
    updateConnectionStatusUI(true);
    triggerHandlers('connect', socket);
  });

  socket.on('disconnect', (reason) => {
    console.warn('⚠️ Disconnected from APSRTC Live Server:', reason);
    updateConnectionStatusUI(false);
    triggerHandlers('disconnect', reason);
  });

  socket.on('bus:location_update', (data) => {
    triggerHandlers('bus:location_update', data);
  });

  socket.on('fleet:alert', (alert) => {
    triggerHandlers('fleet:alert', alert);
  });

  socket.on('complaint:update', (complaint) => {
    triggerHandlers('complaint:update', complaint);
  });
}

function on(event, callback) {
  if (listeners[event]) {
    listeners[event].push(callback);
  }
}

function triggerHandlers(event, payload) {
  if (listeners[event]) {
    listeners[event].forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Error in socket listener for ${event}:`, err);
      }
    });
  }
}

function updateConnectionStatusUI(isConnected) {
  const el = document.getElementById('wsStatusIndicator');
  if (el) {
    if (isConnected) {
      el.innerHTML = '<span class="pulse-dot" style="color: #4ade80;"></span> <span>WS LIVE</span>';
      el.title = 'Real-time WebSocket connection active';
    } else {
      el.innerHTML = '<span class="pulse-dot" style="color: #f87171;"></span> <span>RECONNECTING</span>';
      el.title = 'Attempting to reconnect...';
    }
  }
}

window.socketClient = {
  init: initSocketConnection,
  on,
  getSocket: () => socket
};
