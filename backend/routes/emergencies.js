// backend/routes/emergencies.js - Staff Emergency SOS & Depot Support Routes

const router = require("express").Router();
const controller = require("../controllers/emergencyController");

router.post("/login", controller.staffLogin);
router.post("/staff/login", controller.staffLogin);
router.get("/nearest-depot", controller.findNearestDepot);
router.post("/sos", controller.createEmergency);
router.get("/", controller.listEmergencies);
router.put("/:id/status", controller.updateStatus);
router.put("/:id/dispatch", (req, res) => {
  req.body.status = "DISPATCHED";
  controller.updateStatus(req, res);
});
router.put("/:id/resolve", (req, res) => {
  req.body.status = "RESOLVED";
  controller.updateStatus(req, res);
});

module.exports = router;

