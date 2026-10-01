const router = require("express").Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "apsrtc-smarttrack",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
