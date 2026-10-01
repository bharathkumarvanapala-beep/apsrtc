// backend/services/fleetStore.js

/*
 * APSRTC SmartTrack
 *
 * DEMO fleet store.
 *
 * Route:
 *
 * Araku
 *   ↓
 * Ananthagiri
 *   ↓
 * Paderu
 *   ↓
 * G. Madugula
 *   ↓
 * Chintapalli
 *   ↓
 * Anakapalle
 *   ↓
 * Visakhapatnam
 *
 * This is DEMO data.
 * Real APSRTC GPS and route data requires an authorized
 * operational data source.
 */

// ------------------------------------------------------------
// ROUTE STOPS
// ------------------------------------------------------------

const routeStops = [
  {
    name: "Araku",
    lat: 18.3270,
    lng: 82.8730,
    order: 0
  },
  {
    name: "Ananthagiri",
    lat: 18.2800,
    lng: 82.7000,
    order: 1
  },
  {
    name: "Paderu",
    lat: 18.0730,
    lng: 82.6600,
    order: 2
  },
  {
    name: "G. Madugula",
    lat: 18.0816,
    lng: 82.6700,
    order: 3
  },
  {
    name: "Chintapalli",
    lat: 18.1300,
    lng: 82.6900,
    order: 4
  },
  {
    name: "Anakapalle",
    lat: 17.6900,
    lng: 83.0000,
    order: 5
  },
  {
    name: "Visakhapatnam",
    lat: 17.6868,
    lng: 83.2185,
    order: 6
  }
];

const ROUTE_ID = "ARAKU-VISAKHAPATNAM";

// ------------------------------------------------------------
// DEMO BUSES
// ------------------------------------------------------------

const buses = new Map([
  [
    "302",
    {
      id: "302",
      number: "302",

      route: "Araku - Visakhapatnam",
      routeId: ROUTE_ID,

      direction: "towards Visakhapatnam",
      directionCode: "forward",

      status: "ACTIVE",

      lat: 18.0730,
      lng: 82.6600,

      speedKph: 42,
      heading: 110,

      locationName: "Paderu",
      accuracy: 15,

      routeIndex: 2,

      updatedAt: new Date().toISOString()
    }
  ],

  [
    "415",
    {
      id: "415",
      number: "415",

      route: "Araku - Visakhapatnam",
      routeId: ROUTE_ID,

      direction: "towards Visakhapatnam",
      directionCode: "forward",

      status: "ACTIVE",

      lat: 18.2800,
      lng: 82.7000,

      speedKph: 35,
      heading: 105,

      locationName: "Ananthagiri",
      accuracy: 14,

      routeIndex: 1,

      updatedAt: new Date().toISOString()
    }
  ],

  [
    "518",
    {
      id: "518",
      number: "518",

      route: "Araku - Visakhapatnam",
      routeId: ROUTE_ID,

      direction: "towards Visakhapatnam",
      directionCode: "forward",

      status: "ACTIVE",

      lat: 18.3270,
      lng: 82.8730,

      speedKph: 40,
      heading: 100,

      locationName: "Araku",
      accuracy: 20,

      routeIndex: 0,

      updatedAt: new Date().toISOString()
    }
  ],

  [
    "627",
    {
      id: "627",
      number: "627",

      route: "Visakhapatnam - Araku",
      routeId: ROUTE_ID,

      direction: "towards Araku",
      directionCode: "reverse",

      status: "ACTIVE",

      lat: 17.6868,
      lng: 83.2185,

      speedKph: 32,
      heading: 280,

      locationName: "Visakhapatnam",
      accuracy: 22,

      routeIndex: 6,

      updatedAt: new Date().toISOString()
    }
  ]
]);

// ------------------------------------------------------------
// BASIC FUNCTIONS
// ------------------------------------------------------------

function all() {
  return [...buses.values()];
}

function get(id) {
  return buses.get(String(id));
}

// ------------------------------------------------------------
// NORMALIZATION
// ------------------------------------------------------------

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

// ------------------------------------------------------------
// FIND ROUTE STOP
// ------------------------------------------------------------

function findStop(place) {
  const text = normalize(place);

  return routeStops.find(stop => {
    const stopName = normalize(stop.name);

    return (
      stopName === text ||
      stopName.includes(text) ||
      text.includes(stopName)
    );
  });
}

// ------------------------------------------------------------
// UPDATE GPS LOCATION
// ------------------------------------------------------------

function updateLocation(id, data) {
  const current = get(id);

  if (!current) {
    return null;
  }

  const updated = {
    ...current,
    ...data,

    id: current.id,
    number: current.number,
    routeId: current.routeId,

    updatedAt: new Date().toISOString()
  };

  /*
   * Find the route position from the human-readable
   * location name sent by the GPS simulator.
   */

  if (data.locationName) {
    const stop = findStop(data.locationName);

    if (stop) {
      updated.routeIndex = stop.order;
    }
  }

  /*
   * Preserve the bus's original direction.
   *
   * Forward bus:
   * Araku -> Visakhapatnam
   *
   * Reverse bus:
   * Visakhapatnam -> Araku
   */

  if (current.directionCode === "forward") {
    updated.directionCode = "forward";
    updated.direction = "towards Visakhapatnam";
  }

  if (current.directionCode === "reverse") {
    updated.directionCode = "reverse";
    updated.direction = "towards Araku";
  }

  buses.set(String(id), updated);

  return updated;
}

// ------------------------------------------------------------
// JOURNEY MATCHING
// ------------------------------------------------------------

function journeyMatches(from, to) {
  const fromStop = findStop(from);
  const toStop = findStop(to);

  if (!fromStop || !toStop) {
    return [];
  }

  const fromIndex = fromStop.order;
  const toIndex = toStop.order;

  /*
   * Same location.
   */

  if (fromIndex === toIndex) {
    return [];
  }

  /*
   * Determine required direction.
   */

  const requiredDirection =
    toIndex > fromIndex
      ? "forward"
      : "reverse";

  /*
   * Filter buses.
   */

  const relevant = all().filter(bus => {

    /*
     * Only active buses.
     */

    if (bus.status !== "ACTIVE") {
      return false;
    }

    /*
     * Only buses on this corridor.
     */

    if (bus.routeId !== ROUTE_ID) {
      return false;
    }

    /*
     * Bus must travel in the same direction
     * as the passenger's journey.
     */

    if (
      bus.directionCode !==
      requiredDirection
    ) {
      return false;
    }

    const busIndex = Number(
      bus.routeIndex
    );

    if (!Number.isFinite(busIndex)) {
      return false;
    }

    // --------------------------------------------------------
    // FORWARD JOURNEY
    // --------------------------------------------------------

    if (requiredDirection === "forward") {

      /*
       * Bus must not already have passed
       * the passenger's destination.
       */

      if (busIndex >= toIndex) {
        return false;
      }

      /*
       * Bus can be before or at the passenger's
       * starting point.
       *
       * This allows the system to show buses that
       * are approaching the passenger.
       */

      return true;
    }

    // --------------------------------------------------------
    // REVERSE JOURNEY
    // --------------------------------------------------------

    if (requiredDirection === "reverse") {

      /*
       * Bus must not already have passed
       * the passenger's destination in reverse.
       */

      if (busIndex <= toIndex) {
        return false;
      }

      /*
       * Bus can be before/after the passenger's
       * starting point depending on its current
       * route position.
       */

      return true;
    }

    return false;
  });

  return relevant;
}

// ------------------------------------------------------------
// ADMIN MANAGEMENT & STATS
// ------------------------------------------------------------

const announcements = [
  {
    id: "ANN-001",
    message: "Ghat Road Operations Normal: All buses running on schedule across Araku - Visakhapatnam corridor.",
    type: "info",
    timestamp: new Date().toISOString()
  }
];

function addBus(data) {
  const id = String(data.id || data.number || Date.now());
  const startStop = findStop(data.locationName || "Araku") || routeStops[0];
  const directionCode = data.directionCode === "reverse" ? "reverse" : "forward";

  const newBus = {
    id,
    number: String(data.number || id),
    route: data.route || "Araku - Visakhapatnam",
    routeId: ROUTE_ID,
    direction: directionCode === "forward" ? "towards Visakhapatnam" : "towards Araku",
    directionCode,
    status: data.status || "ACTIVE",
    lat: startStop.lat,
    lng: startStop.lng,
    speedKph: Number(data.speedKph) || 35,
    heading: directionCode === "forward" ? 110 : 280,
    locationName: startStop.name,
    accuracy: 15,
    routeIndex: startStop.order,
    updatedAt: new Date().toISOString()
  };

  buses.set(id, newBus);
  return newBus;
}

function updateBusStatus(id, status) {
  const bus = get(id);
  if (!bus) return null;
  bus.status = status;
  bus.updatedAt = new Date().toISOString();
  buses.set(String(id), bus);
  return bus;
}

function removeBus(id) {
  return buses.delete(String(id));
}

function getStats() {
  const allBuses = all();
  const activeBuses = allBuses.filter(b => b.status === "ACTIVE");
  const speeds = activeBuses.map(b => Number(b.speedKph) || 0);
  const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;

  return {
    totalBuses: allBuses.length,
    activeBuses: activeBuses.length,
    maintenanceBuses: allBuses.filter(b => b.status === "MAINTENANCE").length,
    totalStops: routeStops.length,
    avgSpeedKph: avgSpeed,
    corridorName: "Araku - Visakhapatnam Ghat Corridor",
    corridorDistanceKm: 131.7,
    onTimeRate: "97.4%",
    gpsHealth: "100% OPERATIONAL",
    lastSync: new Date().toISOString()
  };
}

function addAnnouncement(message, type = "info") {
  const announcement = {
    id: `ANN-${String(announcements.length + 1).padStart(3, "0")}`,
    message: String(message),
    type,
    timestamp: new Date().toISOString()
  };
  announcements.unshift(announcement);
  if (announcements.length > 5) announcements.pop();
  return announcement;
}

function getAnnouncements() {
  return announcements;
}

// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------

module.exports = {
  all,
  get,
  updateLocation,
  journeyMatches,
  routeStops,
  findStop,
  addBus,
  updateBusStatus,
  removeBus,
  getStats,
  addAnnouncement,
  getAnnouncements
};