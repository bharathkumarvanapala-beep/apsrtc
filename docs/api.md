# APSRTC SmartTrack - REST & WebSocket API Specification

## Base URL
- Local Development: `http://localhost:5000`
- Production: `https://smarttrack.apsrtc.ap.gov.in`

---

## 1. System Health
### `GET /health`
Returns system operational status, memory utilization, and database connectivity.

**Response (200 OK):**
```json
{
  "status": "UP",
  "service": "APSRTC SmartTrack Fleet Management Service",
  "version": "1.0.0",
  "timestamp": "2026-10-05T08:10:18.013Z",
  "uptime": 128.45,
  "database": "CONNECTED (SQLite WAL)",
  "environment": "development"
}
```

---

## 2. Journey & Passenger Endpoints
### `GET /api/v1/journey/buses?from=:from&to=:to`
Discovers all active incoming buses travelling between two corridor stops in the requested direction.

**Query Parameters:**
- `from` (string, required): Boarding stop name (e.g., `Paderu`)
- `to` (string, required): Destination stop name (e.g., `Visakhapatnam`)

**Response (200 OK):**
```json
{
  "success": true,
  "search": {
    "from": "Paderu",
    "to": "Visakhapatnam",
    "searchedAt": "2026-10-05T08:10:28.270Z"
  },
  "totalRelevantBuses": 2,
  "buses": [
    {
      "busId": 1,
      "busNumber": "302",
      "registrationNumber": "AP-39-Z-0302",
      "serviceType": "PALLE_VELUGU",
      "depot": "Paderu",
      "tripId": "TRIP-2026-302",
      "currentLocation": "Paderu Bus Station",
      "latitude": 18.0816,
      "longitude": 82.6700,
      "speedKph": 42,
      "heading": 120,
      "headingDirection": "South-East",
      "accuracyMeters": 15,
      "activeSource": "DEMO",
      "status": "LIVE",
      "confidence": "GOOD",
      "relationship": "BUS_AT_PASSENGER",
      "distanceToPassengerKm": 0,
      "etaMinutes": 0,
      "etaFormatted": "Arriving now",
      "isBoardable": true,
      "isRecommended": true
    }
  ],
  "passedBusesCount": 3,
  "calculationMethod": "Corridor Route-Segment Network Projection & Haversine Distance"
}
```

### `GET /api/v1/journey/stops`
Returns unique designated corridor stops along active routes.

---

## 3. Bus Fleet Endpoints
### `GET /api/v1/buses`
Lists all buses in fleet with optional filters for `depot`, `serviceType`, and `status`.

### `GET /api/v1/buses/:busId`
Returns complete asset record, assigned crew, registered devices, and active location.

### `GET /api/v1/buses/:busId/location`
Returns current resolved location and source age breakdown.

---

## 4. Multi-Source Telemetry Ingestion Endpoints
All telemetry updates require latitude, longitude, and bus identification.

### `POST /api/v1/tracking/device` (Hardware Tracker)
```json
{
  "busNumber": "518",
  "deviceId": "HW-TRK-518-01",
  "latitude": 17.8700,
  "longitude": 82.3500,
  "accuracyMeters": 6,
  "speedKph": 48,
  "heading": 95,
  "altitude": 640
}
```

### `POST /api/v1/tracking/crew` (Crew Mobile Phone)
```json
{
  "busNumber": "415",
  "deviceId": "DRIVER-415-01",
  "tripId": "TRIP-2026-415",
  "latitude": 17.9500,
  "longitude": 82.5167,
  "accuracyMeters": 10,
  "speedKph": 41,
  "heading": 105
}
```

### `POST /api/v1/tracking/etm` (Electronic Ticketing Machine)
```json
{
  "busNumber": "731",
  "deviceId": "ETM-VIZAG-731",
  "tripId": "TRIP-2026-731",
  "latitude": 18.0100,
  "longitude": 82.5900,
  "accuracyMeters": 18,
  "speedKph": 38
}
```

### `POST /api/v1/tracking/demo` (Simulator)
Same schema with source auto-tagged as `DEMO`.

### `POST /api/v1/tracking/simulate-drop` (Failover Test)
```json
{
  "busNumber": "518",
  "source": "HARDWARE_TRACKER"
}
```

---

## 5. Grievances & Complaints
### `POST /api/v1/complaints`
Filing a passenger grievance.
```json
{
  "busNumber": "415",
  "tripId": "TRIP-2026-415",
  "category": "Delay",
  "description": "Bus delayed at Ananthagiri viewpoint due to dense fog.",
  "passengerName": "Suresh",
  "passengerPhone": "9848011223"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Complaint submitted successfully.",
  "referenceId": "APSRTC-G-2026-4892",
  "status": "NEW"
}
```

### `PATCH /api/v1/complaints/:id/status`
Officer workflow update (`NEW`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`, `CLOSED`).

---

## 6. Real-Time WebSockets (Socket.IO)
- **Namespace:** `/`
- **Client Rooms:**
  - `fleet`: receives all bus movements
  - `bus:<busNumber>`: specific bus telemetry
  - `corridor:<routeCode>`: corridor level updates
- **Events Emitted by Server:**
  - `bus:location_update`: Real-time coordinate & status update
  - `fleet:alert`: Emergency SOS or operational notification
  - `complaint:update`: Grievance status transition
