const router = require("express").Router();
const controller = require("../controllers/journeyController");

router.get("/buses", controller.findBuses);
router.get("/stops", controller.getStops);

module.exports = router;
