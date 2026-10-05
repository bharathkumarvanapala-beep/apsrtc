/**
 * APSRTC SmartTrack Socket Handler
 */

const { initSocket } = require('../services/socketService');

module.exports = function registerSockets(io) {
  initSocket(io);
};
