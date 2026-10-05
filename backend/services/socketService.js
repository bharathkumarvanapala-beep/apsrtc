/**
 * APSRTC SmartTrack Socket Service
 * Manages real-time WebSockets for live fleet updates, bus tracking, and operational alerts.
 */

const logger = require('../utils/logger');

let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  ioInstance.on('connection', (socket) => {
    logger.info(`Client connected to WebSocket: ${socket.id}`);

    // Join fleet monitoring room
    socket.on('join:fleet', () => {
      socket.join('fleet');
      logger.debug(`Socket ${socket.id} joined room: fleet`);
    });

    // Join specific bus room
    socket.on('join:bus', (busNumber) => {
      if (busNumber) {
        socket.join(`bus:${busNumber}`);
        logger.debug(`Socket ${socket.id} joined room: bus:${busNumber}`);
      }
    });

    // Leave bus room
    socket.on('leave:bus', (busNumber) => {
      if (busNumber) {
        socket.leave(`bus:${busNumber}`);
      }
    });

    // Join corridor room
    socket.on('join:corridor', (corridorCode) => {
      if (corridorCode) {
        socket.join(`corridor:${corridorCode}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id} (${reason})`);
    });
  });
}

/**
 * Broadcast location update to all listening clients
 */
function broadcastBusLocation(locationData) {
  if (!ioInstance) return;

  // Broadcast to global fleet room
  ioInstance.to('fleet').emit('bus:location_update', locationData);

  // Broadcast to individual bus room
  if (locationData.busNumber) {
    ioInstance.to(`bus:${locationData.busNumber}`).emit('bus:location_update', locationData);
  }

  // Broadcast to corridor room if route_code exists
  if (locationData.routeCode) {
    ioInstance.to(`corridor:${locationData.routeCode}`).emit('bus:location_update', locationData);
  }
}

/**
 * Broadcast emergency SOS or operational alert
 */
function broadcastAlert(alertData) {
  if (!ioInstance) return;
  ioInstance.emit('fleet:alert', alertData);
}

/**
 * Broadcast complaint status change
 */
function broadcastComplaintUpdate(complaintData) {
  if (!ioInstance) return;
  ioInstance.emit('complaint:update', complaintData);
}

module.exports = {
  initSocket,
  broadcastBusLocation,
  broadcastAlert,
  broadcastComplaintUpdate,
  getIo: () => ioInstance
};
