# APSRTC SmartTrack - Crew Mobile GPS Integration Guide

## 1. Overview
Crew Mobile GPS represents **Source Priority 2**. It provides an instant, zero-hardware fallback and primary tracking mechanism using standard smartphones carried by drivers and conductors.

---

## 2. Operational Workflow
1. Driver or conductor opens the APSRTC SmartTrack Crew Portal on their mobile browser or installed PWA.
2. Selects their official Staff ID (e.g. `EMP-4089`).
3. Selects their assigned Bus Number (e.g. `Bus 415`).
4. Selects Departure (`Paderu`) and Destination (`Visakhapatnam`).
5. Taps **Start Scheduled Trip**.
   - Server creates a unique `tripId` e.g. `TRIP-2026-415-8492`.
   - Binds the driver, bus, route, and mobile device together in database records.
6. Driver grants HTML5 Geolocation permission.
7. Device activates `navigator.geolocation.watchPosition` with `{ enableHighAccuracy: true }`.
8. Browser periodically sends coordinate updates every few seconds to `POST /api/v1/tracking/crew`.
9. At destination, the crew member taps **End Trip**.

---

## 3. Telemetry Payload
```json
POST /api/v1/tracking/crew
Content-Type: application/json

{
  "busNumber": "415",
  "deviceId": "DRIVER-415-01",
  "tripId": "TRIP-2026-415",
  "latitude": 17.9500,
  "longitude": 82.5167,
  "accuracyMeters": 10,
  "speedKph": 41,
  "heading": 105,
  "altitude": 720,
  "timestamp": "2026-10-05T08:15:00Z"
}
```

---

## 4. Emergency SOS Dispatch
In the event of an accident, road blockage, or medical emergency:
- The driver taps the red **EMERGENCY SOS BROADCAST** button.
- Triggers `POST /api/v1/operations/sos`.
- Immediately alerts all depot controllers and broadcasts an audible alert on officer dashboards.
