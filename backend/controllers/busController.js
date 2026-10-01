const store = require("../services/fleetStore");

exports.list = (_req, res) => {
  res.json({ buses: store.all(), count: store.all().length });
};

exports.get = (req, res) => {
  const bus = store.get(req.params.id);
  if (!bus) return res.status(404).json({ error: "Bus not found" });
  res.json(bus);
};
