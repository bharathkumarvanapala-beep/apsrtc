const http = require("http");

const API = "http://localhost:5000/api/v1/tracking/location";

/*
 * APSRTC SmartTrack
 * Route-aware GPS simulator
 *
 * DEMO ROUTE:
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
 * Some buses travel forward.
 * Some buses travel in the reverse direction.
 */

const forwardRoute = [
  {
    name: "Araku",
    lat: 18.3270,
    lng: 82.8730
  },
  {
    name: "Ananthagiri",
    lat: 18.2800,
    lng: 82.7000
  },
  {
    name: "Paderu",
    lat: 18.0730,
    lng: 82.6600
  },
  {
    name: "G. Madugula",
    lat: 18.0816,
    lng: 82.6700
  },
  {
    name: "Chintapalli",
    lat: 18.1300,
    lng: 82.6900
  },
  {
    name: "Anakapalle",
    lat: 17.6900,
    lng: 83.0000
  },
  {
    name: "Visakhapatnam",
    lat: 17.6868,
    lng: 83.2185
  }
];

/*
 * Reverse route.
 *
 * Visakhapatnam
 *   ↓
 * Anakapalle
 *   ↓
 * Chintapalli
 *   ↓
 * G. Madugula
 *   ↓
 * Paderu
 *   ↓
 * Ananthagiri
 *   ↓
 * Araku
 */

const reverseRoute = [...forwardRoute].reverse();

/*
 * Each bus has:
 *
 * id
 * direction
 * starting position
 * speed
 *
 * IMPORTANT:
 * These are DEMO buses only.
 */

const buses = [
  {
    id: "302",
    direction: "forward",
    route: forwardRoute,
    position: 2,
    speedKph: 42,
    heading: 110
  },

  {
    id: "415",
    direction: "forward",
    route: forwardRoute,
    position: 1,
    speedKph: 38,
    heading: 105
  },

  {
    id: "518",
    direction: "forward",
    route: forwardRoute,
    position: 0,
    speedKph: 40,
    heading: 100
  },

  {
    id: "627",
    direction: "reverse",
    route: reverseRoute,
    position: 2,
    speedKph: 32,
    heading: 280
  }
];

function send(bus, point) {
  const payload = JSON.stringify({
    busId: bus.id,

    lat: point.lat,
    lng: point.lng,

    speedKph: bus.speedKph,

    heading: bus.heading,

    locationName: point.name,

    accuracy: 15
  });

  const url = new URL(API);

  const req = http.request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  });

  req.on(
    "error",
    err => {
      console.log(
        `Bus ${bus.id} connection error:`,
        err.message
      );
    }
  );

  req.write(payload);
  req.end();

  console.log(
    `Bus ${bus.id} -> ${point.name} | ${bus.direction === "forward"
      ? "towards Visakhapatnam"
      : "towards Araku"
    }`
  );
}

function moveBus(bus) {
  const point = bus.route[bus.position];

  if (!point) {
    return;
  }

  send(bus, point);

  /*
   * Move one route stop forward.
   *
   * When the bus reaches the end,
   * start again from the beginning.
   */

  bus.position++;

  if (bus.position >= bus.route.length) {
    bus.position = 0;
  }
}

console.log("========================================");
console.log("APSRTC SmartTrack GPS Simulator");
console.log("========================================");

console.log("");
console.log("Demo route:");

console.log(
  "Araku -> Ananthagiri -> Paderu -> G. Madugula -> Chintapalli -> Anakapalle -> Visakhapatnam"
);

console.log("");

console.log("Demo buses:");

buses.forEach(bus => {
  console.log(
    `Bus ${bus.id} -> ${bus.direction === "forward"
      ? "towards Visakhapatnam"
      : "towards Araku"
    }`
  );
});

console.log("");

console.log(
  "Make sure the backend is running on http://localhost:5000"
);

console.log("");

console.log("Starting GPS updates every 5 seconds...");
console.log("");

/*
 * Send the initial positions immediately.
 */

buses.forEach(bus => {
  const point = bus.route[bus.position];

  send(bus, point);
});

/*
 * Continue sending GPS updates.
 */

setInterval(() => {
  buses.forEach(bus => {
    moveBus(bus);
  });
}, 5000);