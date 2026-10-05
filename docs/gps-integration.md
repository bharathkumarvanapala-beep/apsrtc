# APSRTC SmartTrack - Hardware GPS Tracker Integration Guide

## 1. Overview
Physical GPS tracking units installed on APSRTC buses represent **Source Priority 1** (Highest Priority). The architecture is engineered so physical trackers can be mounted and provisioned without altering the passenger frontend or route engines.

---

## 2. Ingestion Flow
```
[Vehicle Mounted GPS Box]
       |  (GSM / 4G LTE SIM)
       v
[APSRTC Ingestion Gateway]
       |  POST /api/v1/tracking/device
       v
[Location Resolver Service]
       |
       +---> Audit Record in `location_updates`
       +---> Updates `current_bus_locations`
       +---> Real-Time Broadcast via WebSocket
```

---

## 3. Tracker Protocol Specification
Trackers transmit JSON (or binary packets converted by an edge gateway) using the standard telemetry schema:

```json
POST /api/v1/tracking/device
Content-Type: application/json
Authorization: Bearer <DEVICE_TOKEN_OR_IMEI_SIGNATURE>

{
  "busNumber": "518",
  "deviceId": "HW-TRK-518-01",
  "imei": "864201045518012",
  "latitude": 17.8700,
  "longitude": 82.3500,
  "accuracyMeters": 6,
  "speedKph": 48,
  "heading": 95,
  "altitude": 640,
  "batteryVoltage": 12.8,
  "ignitionStatus": true,
  "timestamp": "2026-10-05T08:12:00Z"
}
```

---

## 4. Hardware Failover Handling
If a hardware tracker encounters dead zones (e.g. deep tunnels, mountain ravines in Eastern Ghats) or hardware disconnect:
1. Heartbeat timer detects no updates within `FRESHNESS_STALE_SEC` (300 seconds).
2. The location resolver marks the hardware tracker stream as stale or unavailable.
3. If the bus crew has their mobile duty app active, the system **automatically switches activeSource to `CREW_PHONE`** with 0ms interruption to passengers.
