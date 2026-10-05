/**
 * APSRTC SmartTrack Complaint / Grievance Controller
 * Manages passenger complaints and officer status updates.
 */

const { queryAll, queryOne, run } = require('../config/db');
const { broadcastComplaintUpdate } = require('../services/socketService');

function createComplaint(req, res, next) {
  try {
    const {
      busNumber,
      tripId,
      targetType = 'GENERAL',
      category,
      subCategory,
      description,
      passengerName,
      passengerPhone,
      location,
      photoUrl
    } = req.body;

    // Generate unique complaint reference ID: APSRTC-G-YYYY-XXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const complaintRef = `APSRTC-G-${new Date().getFullYear()}-${randomSuffix}`;

    run(`
      INSERT INTO complaints (
        complaint_ref, bus_number, trip_id, target_type, category, sub_category,
        description, passenger_name, passenger_phone, location, photo_url,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', datetime('now'), datetime('now'))
    `, [
      complaintRef,
      busNumber.trim(),
      tripId || null,
      targetType,
      category.trim(),
      subCategory || null,
      description.trim(),
      passengerName || 'Anonymous Passenger',
      passengerPhone || null,
      location || null,
      photoUrl || null
    ]);

    const created = queryOne('SELECT * FROM complaints WHERE complaint_ref = ?', [complaintRef]);

    // Broadcast to officers via WebSocket
    broadcastComplaintUpdate(created);

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully to APSRTC Grievance Cell.',
      referenceId: complaintRef,
      complaint: {
        referenceId: complaintRef,
        busNumber,
        targetType,
        category,
        subCategory,
        status: 'NEW',
        createdAt: created.created_at
      }
    });
  } catch (err) {
    next(err);
  }
}

function trackComplaintByRef(req, res, next) {
  try {
    const { ref } = req.params;
    const complaint = queryOne('SELECT * FROM complaints WHERE complaint_ref = ?', [ref.trim().toUpperCase()]);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `No grievance found with reference ID "${ref}". Please check the reference code.`
      });
    }

    const history = queryAll('SELECT * FROM complaint_status_history WHERE complaint_id = ? ORDER BY created_at DESC', [complaint.id]);

    res.json({
      success: true,
      complaint,
      history
    });
  } catch (err) {
    next(err);
  }
}

function getComplaints(req, res, next) {
  try {
    const { busNumber, status, category, targetType } = req.query;

    let sql = 'SELECT * FROM complaints WHERE 1=1';
    const params = [];

    if (busNumber) {
      sql += ' AND bus_number = ?';
      params.push(busNumber);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (targetType) {
      sql += ' AND target_type = ?';
      params.push(targetType);
    }

    sql += ' ORDER BY created_at DESC';

    const complaints = queryAll(sql, params);

    res.json({
      success: true,
      count: complaints.length,
      complaints
    });
  } catch (err) {
    next(err);
  }
}

function updateComplaintStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, officerNotes, officerName } = req.body;

    const validStatuses = ['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const complaint = queryOne('SELECT * FROM complaints WHERE id = ? OR complaint_ref = ?', [id, id]);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint "${id}" was not found.`
      });
    }

    const oldStatus = complaint.status;

    run(`
      UPDATE complaints 
      SET status = ?, officer_notes = COALESCE(?, officer_notes), updated_at = datetime('now')
      WHERE id = ?
    `, [status, officerNotes || null, complaint.id]);

    // Record status history audit
    run(`
      INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      complaint.id,
      oldStatus,
      status,
      officerName || 'Depot Officer',
      officerNotes || 'Status updated'
    ]);

    const updated = queryOne('SELECT * FROM complaints WHERE id = ?', [complaint.id]);

    broadcastComplaintUpdate(updated);

    res.json({
      success: true,
      message: `Complaint ${complaint.complaint_ref} updated to ${status}`,
      complaint: updated
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createComplaint,
  getComplaints,
  updateComplaintStatus,
  trackComplaintByRef
};
