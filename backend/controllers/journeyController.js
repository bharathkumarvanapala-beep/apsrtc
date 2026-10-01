const store = require("../services/fleetStore");

function normalizePlace(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function findStop(place) {
  const normalized = normalizePlace(place);

  return store.routeStops.find(stop => {
    const stopName = normalizePlace(stop.name);

    return (
      stopName === normalized ||
      stopName.includes(normalized) ||
      normalized.includes(stopName)
    );
  });
}

function calculateDistanceKm(bus, stop) {
  if (!bus || !stop) {
    return 0;
  }

  const lat1 = Number(bus.lat);
  const lng1 = Number(bus.lng);

  const lat2 = Number(stop.lat);
  const lng2 = Number(stop.lng);

  const earthRadiusKm = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return Number(
    (earthRadiusKm * c).toFixed(1)
  );
}

function calculateRouteDistanceKm(bus, targetStop) {
  if (!bus || !targetStop) {
    return 0;
  }

  const busStop =
    store.routeStops.find(stop => normalizePlace(stop.name) === normalizePlace(bus.locationName)) ||
    store.routeStops.find(stop => stop.order === bus.routeIndex);

  if (busStop && typeof busStop.order === "number" && typeof targetStop.order === "number") {
    const startOrder = Math.min(busStop.order, targetStop.order);
    const endOrder = Math.max(busStop.order, targetStop.order);

    if (startOrder === endOrder) {
      return 0;
    }

    let totalKm = 0;
    for (let i = startOrder; i < endOrder; i++) {
      const s1 = store.routeStops.find(s => s.order === i);
      const s2 = store.routeStops.find(s => s.order === i + 1);
      if (s1 && s2) {
        totalKm += calculateDistanceKm(s1, s2);
      }
    }
    return Number(totalKm.toFixed(1));
  }

  return calculateDistanceKm(bus, targetStop);
}

function calculateEta(distanceKm, speedKph) {
  const speed = Math.max(
    Number(speedKph) || 25,
    10
  );

  const minutes =
    (distanceKm / speed) * 60;

  return Math.max(
    Math.ceil(minutes),
    1
  );
}

exports.findBuses = (req, res) => {
  const { from = "", to = "" } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      error: "From and To locations are required."
    });
  }

  const fromStop = findStop(from);
  const toStop = findStop(to);

  if (!fromStop || !toStop) {
    return res.status(400).json({
      error:
        "Location not available. Supported locations: Araku, Ananthagiri, Paderu, G. Madugula, Chintapalli, Anakapalle and Visakhapatnam."
    });
  }

  if (fromStop.order === toStop.order) {
    return res.status(400).json({
      error:
        "Starting point and destination cannot be the same."
    });
  }

  const buses = store
    .journeyMatches(
      fromStop.name,
      toStop.name
    )
    .map(bus => {
      /*
       * Distance and ETA to passenger's boarding stop.
       */
      const distanceToPickupKm =
        calculateRouteDistanceKm(
          bus,
          fromStop
        );

      const etaToPickupMinutes =
        calculateEta(
          distanceToPickupKm,
          bus.speedKph
        );

      /*
       * Distance and ETA from current bus location to
       * the selected journey destination stop.
       */
      const distanceToDestinationKm =
        calculateRouteDistanceKm(
          bus,
          toStop
        );

      const etaToDestinationMinutes =
        calculateEta(
          distanceToDestinationKm,
          bus.speedKph
        );

      const busStop =
        store.routeStops.find(stop => normalizePlace(stop.name) === normalizePlace(bus.locationName)) ||
        store.routeStops.find(stop => stop.order === bus.routeIndex);

      const busOrder = busStop ? busStop.order : null;
      const stopsToPickup = busOrder !== null ? Math.abs(fromStop.order - busOrder) : null;
      const stopsToDestination = busOrder !== null ? Math.abs(toStop.order - busOrder) : null;

      const isAtPickup =
        distanceToPickupKm === 0 ||
        normalizePlace(bus.locationName) === normalizePlace(fromStop.name);

      const isAtDestination =
        distanceToDestinationKm === 0 ||
        normalizePlace(bus.locationName) === normalizePlace(toStop.name);

      /*
       * Higher score = better bus.
       */
      let score = 100;

      score -= etaToPickupMinutes;

      if (isAtPickup) {
        score += 10;
      }

      score = Math.max(
        Math.min(score, 100),
        50
      );

      return {
        ...bus,

        // Legacy compatibility
        distanceFromPassengerKm: distanceToPickupKm,
        etaMinutes: etaToPickupMinutes,

        // Pickup / Boarding details
        pickupStop: fromStop.name,
        distanceToPickupKm,
        etaToPickupMinutes,
        stopsToPickup,
        isAtPickup,

        // Destination details (regarding the specific destination)
        destinationStop: toStop.name,
        distanceToDestinationKm,
        etaToDestinationMinutes,
        stopsToDestination,
        isAtDestination,

        relevanceScore: score,

        matchReason:
          `Bus is travelling ${bus.direction} toward ${toStop.name} and is suitable for your journey.`
      };
    })
    .sort(
      (a, b) =>
        a.etaToPickupMinutes -
        b.etaToPickupMinutes
    );

  const finalBuses =
    buses.map((bus, index) => ({
      ...bus,

      matchType:
        index === 0
          ? "BEST MATCH"
          : "RELEVANT"
    }));

  res.json({
    success: true,

    demo:
      process.env.DEMO_MODE === "true",

    from: fromStop.name,

    to: toStop.name,

    totalBuses:
      finalBuses.length,

    buses: finalBuses
  });
};

exports.getStops = (_req, res) => {
  res.json({
    success: true,
    routeId: "ARAKU-VISAKHAPATNAM",
    stops: store.routeStops
  });
};