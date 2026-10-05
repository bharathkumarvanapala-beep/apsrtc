/**
 * APSRTC SmartTrack Tracking Ingestion Controller
 * Receives multi-source telemetry from Hardware Trackers, Crew Mobile GPS, ETMs, and Simulator.
 */

const { processLocationUpdate, setSourceOffline } = require('../services/locationResolverService');
const logger = require('../utils/logger');

function postDeviceUpdate(req, res, next) {
  try {
    const payload = {
      ...req.body,
      source: 'HARDWARE_TRACKER'
    };

    const resolved = processLocationUpdate(payload);

    res.status(200).json({
      success: true,
      message: 'Hardware tracker GPS accepted',
      data: resolved
    });
  } catch (err) {
    next(err);
  }
}

function postCrewUpdate(req, res, next) {
  try {
    const payload = {
      ...req.body,
      source: 'CREW_PHONE'
    };

    const resolved = processLocationUpdate(payload);

    res.status(200).json({
      success: true,
      message: 'Crew mobile phone GPS accepted',
      data: resolved
    });
  } catch (err) {
    next(err);
  }
}

function postEtmUpdate(req, res, next) {
  try {
    const payload = {
      ...req.body,
      source: 'ETM'
    };

    const resolved = processLocationUpdate(payload);

    res.status(200).json({
      success: true,
      message: 'ETM ticket machine GPS accepted',
      data: resolved
    });
  } catch (err) {
    next(err);
  }
}

function postDemoUpdate(req, res, next) {
  try {
    const payload = {
      ...req.body,
      source: 'DEMO'
    };

    const resolved = processLocationUpdate(payload);

    res.status(200).json({
      success: true,
      message: 'Demo simulator GPS update accepted',
      data: resolved
    });
  } catch (err) {
    next(err);
  }
}

function simulateSourceDrop(req, res, next) {
  try {
    const { busNumber, source } = req.body;

    if (!busNumber || !source) {
      return res.status(400).json({
        success: false,
        error: 'busNumber and source are required.'
      });
    }

    const updated = setSourceOffline(busNumber, source);

    res.json({
      success: true,
      message: `Simulated drop: ${source} marked offline for Bus ${busNumber}. Failover evaluated.`,
      activeState: updated
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  postDeviceUpdate,
  postCrewUpdate,
  postEtmUpdate,
  postDemoUpdate,
  simulateSourceDrop
};
