/**
 * APSRTC SmartTrack Administrative Authentication Middleware
 * Protects privileged fleet operations and broadcasts from unauthorized public access.
 */

const config = require('../config/config');

function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || 
                   (req.headers['authorization'] ? req.headers['authorization'].replace('Bearer ', '') : null);

  if (adminKey === config.ADMIN_KEY || adminKey === config.ADMIN_PIN) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Access Restricted: APSRTC Depot Administrator authentication required.',
    requiresLogin: true
  });
}

module.exports = {
  requireAdmin
};
