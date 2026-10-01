// backend/controllers/adminController.js

const jwt = require("jsonwebtoken");
const store = require("../services/fleetStore");
const complaintController = require("./complaintController");

const JWT_SECRET = process.env.JWT_SECRET || "apsrtc-smarttrack-secret-key-2026";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "apsrtc@2026";

exports.login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: "Invalid officer credentials" });
  }

  const token = jwt.sign(
    {
      username: ADMIN_USER,
      role: "DISPATCH_OFFICER",
      depot: "Araku-Paderu Operational Control Center",
      issuedAt: Date.now()
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    success: true,
    message: "Officer authenticated successfully",
    token,
    user: {
      username: ADMIN_USER,
      name: "Fleet Operations Controller",
      role: "CHIEF_DISPATCHER",
      division: "Visakhapatnam - Alluri Sitharama Raju District",
      badge: "APSRTC-OCC-04"
    }
  });
};

exports.verify = (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

exports.getStats = (_req, res) => {
  const fleetStats = store.getStats();
  res.json({
    success: true,
    stats: fleetStats,
    timestamp: new Date().toISOString()
  });
};

exports.addBus = (req, res) => {
  const { number, locationName, directionCode, speedKph, status } = req.body;

  if (!number) {
    return res.status(400).json({ error: "Bus number is required" });
  }

  const newBus = store.addBus({
    number,
    locationName: locationName || "Araku",
    directionCode: directionCode || "forward",
    speedKph: Number(speedKph) || 40,
    status: status || "ACTIVE"
  });

  res.status(201).json({
    success: true,
    message: `Bus ${newBus.number} added to fleet`,
    bus: newBus
  });
};

exports.updateBusStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const updated = store.updateBusStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: "Bus not found" });
  }

  res.json({
    success: true,
    message: `Bus ${id} status updated to ${status}`,
    bus: updated
  });
};

exports.deleteBus = (req, res) => {
  const { id } = req.params;
  const removed = store.removeBus(id);

  if (!removed) {
    return res.status(404).json({ error: "Bus not found" });
  }

  res.json({
    success: true,
    message: `Bus ${id} removed from service`
  });
};

exports.updateComplaint = (req, res) => {
  return complaintController.updateStatus(req, res);
};

exports.broadcast = (req, res) => {
  const { message, type } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Announcement message required" });
  }

  const item = store.addAnnouncement(message, type || "warning");

  res.json({
    success: true,
    message: "Announcement broadcasted across network",
    announcement: item
  });
};

exports.getAnnouncements = (_req, res) => {
  res.json({
    success: true,
    announcements: store.getAnnouncements()
  });
};

exports.simulateStep = (_req, res) => {
  const updatedBuses = store.simulateStep();
  res.json({
    success: true,
    message: "Simulation step executed",
    buses: updatedBuses
  });
};

