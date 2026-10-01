// backend/controllers/emergencyController.js - APSRTC Staff Emergency SOS & Depot Support

const emergencies = [
  {
    id: "SOS-2026-081",
    busId: "415",
    busNumber: "415",
    driverName: "S. Apparao",
    driverBadge: "D-4091",
    driverPhone: "+91 94906 17942",
    incidentType: "Tire Flat",
    severity: "HIGH",
    locationDesc: "Km 34.2, Ananthagiri Ghat hairpins between Depot 01 and 02",
    nearestDepot: {
      name: "Paderu Divisional Depot",
      code: "PDR-03",
      distanceKm: 8.5,
      etaMins: 14,
      phone: "08935-250333",
      emergencyCell: "+91 94906 17803"
    },
    passengerCount: 42,
    reliefBusNeeded: true,
    description: "Rear left double tire burst while climbing incline. Vehicle safely parked on wide shoulder. Passengers safe.",
    status: "DISPATCHED",
    dispatchedUnit: "Paderu Recovery Van #RV-03 & Relief Bus #503",
    photoUrl: "assets/incident_inspection_sample.svg",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
];

const corridorDepots = [
  { name: "Araku Depot", code: "ARK-01", lat: 18.3270, lng: 82.8730, phone: "08936-249222", emergencyCell: "+91 94906 17801", recoveryVans: 2, manager: "Shri V. Rao" },
  { name: "Ananthagiri Sub-Depot", code: "ANT-02", lat: 18.2800, lng: 82.7000, phone: "08936-249555", emergencyCell: "+91 94906 17802", recoveryVans: 1, manager: "Shri K. Prasad" },
  { name: "Paderu Divisional Depot", code: "PDR-03", lat: 18.0730, lng: 82.6600, phone: "08935-250333", emergencyCell: "+91 94906 17803", recoveryVans: 4, manager: "Shri M. Satyanarayana" },
  { name: "G. Madugula Waypoint", code: "GMD-04", lat: 18.0816, lng: 82.6700, phone: "08935-251222", emergencyCell: "+91 94906 17804", recoveryVans: 1, manager: "Shri D. Apparao" },
  { name: "Chintapalli Depot", code: "CTP-05", lat: 18.1300, lng: 82.6900, phone: "08937-252444", emergencyCell: "+91 94906 17805", recoveryVans: 2, manager: "Shri S. Venkat" },
  { name: "Anakapalle Depot", code: "AKP-06", lat: 17.6900, lng: 83.0000, phone: "08924-222888", emergencyCell: "+91 94906 17806", recoveryVans: 3, manager: "Shri P. Ramana" },
  { name: "Visakhapatnam Central Complex", code: "VSKP-07", lat: 17.6868, lng: 83.2185, phone: "0891-2746400", emergencyCell: "+91 94906 17807", recoveryVans: 6, manager: "Divisional Manager VSKP" }
];

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

exports.findNearestDepot = (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const stationName = req.query.station;

  let nearest = corridorDepots[2]; // Default Paderu
  let minDistance = Infinity;

  if (!isNaN(lat) && !isNaN(lng)) {
    corridorDepots.forEach(depot => {
      const dist = calculateDistanceKm(lat, lng, depot.lat, depot.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = { ...depot, distanceKm: dist, etaMins: Math.max(8, Math.round(dist * 1.8)) };
      }
    });
  } else if (stationName) {
    const matched = corridorDepots.find(d => d.name.toLowerCase().includes(stationName.toLowerCase()));
    if (matched) {
      nearest = { ...matched, distanceKm: 2.5, etaMins: 8 };
    }
  }

  res.json({
    success: true,
    nearestDepot: nearest,
    allDepots: corridorDepots
  });
};

exports.staffLogin = (req, res) => {
  const { staffId, password, busNumber } = req.body;

  if (!staffId) {
    return res.status(400).json({ error: "Staff ID or Driver Badge is required" });
  }

  // Demo credential validation: allows driver / staff login
  const isDemo = (!password || password === "crew@2026" || password === "apsrtc@2026" || staffId.startsWith("driver") || staffId.startsWith("staff") || staffId === "D-4091");

  if (!isDemo && password !== "crew@2026") {
    return res.status(401).json({ error: "Invalid crew credentials. Use driver415 / crew@2026" });
  }

  const staffUser = {
    staffId: staffId.toUpperCase(),
    name: staffId.includes("415") ? "S. Apparao" : (staffId.includes("734") ? "K. Venkata Rao" : "Staff Officer"),
    role: "ON_DUTY_CREW",
    badge: staffId.includes("D-") ? staffId : "D-4091",
    assignedBus: busNumber || "415",
    phone: "+91 94906 17942",
    depotAffiliation: "Paderu Divisional Depot",
    loginTime: new Date().toISOString()
  };

  res.json({
    success: true,
    message: "Crew authentication successful",
    staff: staffUser,
    user: staffUser,
    token: "crew-sos-token-" + Date.now()
  });
};


exports.createEmergency = (req, res) => {
  const {
    busId,
    busNumber,
    driverName,
    driverBadge,
    driverPhone,
    incidentType,
    severity,
    locationDesc,
    passengerCount,
    reliefBusNeeded,
    description,
    photoUrl,
    lat,
    lng
  } = req.body;

  if (!busId || !incidentType || !description) {
    return res.status(400).json({ error: "Bus ID, incident type, and description are required" });
  }

  // Compute nearest depot
  let nearest = corridorDepots[2]; // Default Paderu
  let minDistance = Infinity;
  if (typeof lat === "number" && typeof lng === "number") {
    corridorDepots.forEach(depot => {
      const dist = calculateDistanceKm(lat, lng, depot.lat, depot.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = { ...depot, distanceKm: dist, etaMins: Math.max(8, Math.round(dist * 1.8)) };
      }
    });
  } else {
    nearest = { ...corridorDepots[2], distanceKm: 8.5, etaMins: 14 };
  }

  const emergency = {
    id: `SOS-2026-${String(emergencies.length + 82).padStart(3, "0")}`,
    busId: String(busId),
    busNumber: String(busNumber || busId),
    driverName: driverName || "Corridor Bus Crew",
    driverBadge: driverBadge || "D-Crew",
    driverPhone: driverPhone || "+91 94906 17942",
    incidentType,
    severity: severity || "HIGH",
    locationDesc: locationDesc || "Araku-Vizag Mountain Ghat Corridor",
    nearestDepot: nearest,
    passengerCount: Number(passengerCount || 35),
    reliefBusNeeded: Boolean(reliefBusNeeded),
    description,
    status: "TRANSMITTED",
    dispatchedUnit: null,
    photoUrl: photoUrl || "assets/incident_inspection_sample.svg",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  emergencies.unshift(emergency);

  res.status(201).json({
    success: true,
    message: `🚨 Emergency SOS logged. Alert dispatched to ${nearest.name}.`,
    emergency
  });
};

exports.listEmergencies = (_req, res) => {
  res.json({
    success: true,
    emergencies,
    total: emergencies.length,
    activeCount: emergencies.filter(e => e.status !== "RESOLVED").length
  });
};

exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status, dispatchedUnit, notes } = req.body;

  const item = emergencies.find(e => e.id === id);
  if (!item) {
    return res.status(404).json({ error: "Emergency incident not found" });
  }

  item.status = status || item.status;
  if (dispatchedUnit) item.dispatchedUnit = dispatchedUnit;
  if (notes) item.notes = notes;
  item.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: `Incident ${id} updated to ${status}`,
    emergency: item
  });
};
