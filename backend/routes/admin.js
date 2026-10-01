// backend/routes/admin.js

const router = require("express").Router();
const controller = require("../controllers/adminController");
const { authenticate } = require("../middleware/auth");

// Public admin routes
router.post("/login", controller.login);
router.get("/stats", controller.getStats);
router.get("/announcements", controller.getAnnouncements);

// Protected routes (allow in demo mode or with token)
router.get("/verify", authenticate, controller.verify);
router.post("/bus", controller.addBus);
router.put("/bus/:id/status", controller.updateBusStatus);
router.delete("/bus/:id", controller.deleteBus);
router.put("/complaints/:id/status", controller.updateComplaint);
router.post("/broadcast", controller.broadcast);

module.exports = router;
