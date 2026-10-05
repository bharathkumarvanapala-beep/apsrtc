/**
 * APSRTC SmartTrack Bus Routes
 */

const express = require('express');
const router = express.Router();
const busController = require('../controllers/busController');

router.get('/', busController.getAllBuses);
router.get('/:busId', busController.getBusById);
router.get('/:busId/location', busController.getBusLocation);

module.exports = router;
