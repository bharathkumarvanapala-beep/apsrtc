/**
 * APSRTC SmartTrack Multi-Source Tracking Routes
 */

const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { validateGpsPayload } = require('../middleware/validationMiddleware');

// Hardware GPS Trackers
router.post('/device', validateGpsPayload, trackingController.postDeviceUpdate);

// Crew Mobile Phone GPS
router.post('/crew', validateGpsPayload, trackingController.postCrewUpdate);

// Electronic Ticketing Machines (ETM)
router.post('/etm', validateGpsPayload, trackingController.postEtmUpdate);

// Demo GPS Simulator
router.post('/demo', validateGpsPayload, trackingController.postDemoUpdate);

// Operator simulation endpoint: drop/failover test
router.post('/simulate-drop', trackingController.simulateSourceDrop);

module.exports = router;
