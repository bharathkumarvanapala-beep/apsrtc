/**
 * APSRTC SmartTrack Bus Routes
 */

const express = require('express');
const router = express.Router();
const busController = require('../controllers/busController');

const { requireAdmin } = require('../middleware/authMiddleware');

router.get('/', busController.getAllBuses);
router.post('/', requireAdmin, busController.createBus);
router.patch('/:busId/status', requireAdmin, busController.updateBusStatus);
router.get('/:busId', busController.getBusById);
router.get('/:busId/location', busController.getBusLocation);

module.exports = router;
