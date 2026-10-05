/**
 * APSRTC SmartTrack Trip Routes
 */

const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');

router.post('/start', tripController.startTrip);
router.post('/:tripId/end', tripController.endTrip);
router.get('/active', tripController.getActiveTrips);

module.exports = router;
