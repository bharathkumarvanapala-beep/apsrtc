/**
 * APSRTC SmartTrack Operations Routes
 */

const express = require('express');
const router = express.Router();
const operationsController = require('../controllers/operationsController');

router.get('/fleet', operationsController.getFleetOverview);
router.get('/alerts', operationsController.getAlerts);
router.post('/sos', operationsController.triggerSosAlert);

module.exports = router;
