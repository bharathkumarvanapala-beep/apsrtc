/**
 * APSRTC SmartTrack Complaint Routes
 */

const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { validateComplaint } = require('../middleware/validationMiddleware');

router.post('/', validateComplaint, complaintController.createComplaint);
router.get('/', complaintController.getComplaints);
router.patch('/:id/status', complaintController.updateComplaintStatus);

module.exports = router;
