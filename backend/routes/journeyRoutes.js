/**
 * APSRTC SmartTrack Journey Routes
 */

const express = require('express');
const router = express.Router();
const journeyController = require('../controllers/journeyController');
const { validateJourneySearch } = require('../middleware/validationMiddleware');

router.get('/buses', validateJourneySearch, journeyController.searchJourney);
router.get('/search', validateJourneySearch, journeyController.searchJourney);
router.get('/corridor', validateJourneySearch, journeyController.searchJourney);
router.get('/stops', journeyController.getCorridorStops);
router.get('/routes', journeyController.getAllRoutes);
router.get('/routes/:routeId/stops', journeyController.getRouteStopsById);

module.exports = router;
