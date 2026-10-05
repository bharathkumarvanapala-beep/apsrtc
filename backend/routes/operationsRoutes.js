/**
 * APSRTC SmartTrack Operations Routes
 */

const express = require('express');
const router = express.Router();
const operationsController = require('../controllers/operationsController');

const { requireAdmin } = require('../middleware/authMiddleware');

router.get('/fleet', operationsController.getFleetOverview);
router.get('/alerts', operationsController.getAlerts);
router.get('/devices', operationsController.getDeviceRegistry);
router.post('/login', operationsController.adminLogin);
router.post('/broadcast', requireAdmin, operationsController.broadcastAnnouncement);
router.post('/sos', operationsController.triggerSosAlert);

module.exports = router;
