const router = require("express").Router();
const controller = require("../controllers/trackingController");

router.post("/location", controller.update);

module.exports = router;
