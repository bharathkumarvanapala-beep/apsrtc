const store = require("../services/fleetStore");

exports.update = (req, res) => {
  const { busId, lat, lng, speedKph, heading, locationName, accuracy } = req.body;

  if (!busId || typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "busId, numeric lat and numeric lng are required" });
  }

  const bus = store.updateLocation(busId, {
    lat, lng,
    speedKph: Number(speedKph || 0),
    heading: Number(heading || 0),
    locationName: locationName || "Unknown",
    accuracy: Number(accuracy || 50)
  });

  if (!bus) return res.status(404).json({ error: "Bus not found" });

  res.json({ message: "Location updated", bus });
};
