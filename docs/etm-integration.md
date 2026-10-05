# APSRTC SmartTrack - Electronic Ticketing Machine (ETM) Integration Guide

## 1. Overview
Electronic Ticketing Machines (ETMs) carried by bus conductors are GPS-enabled and connected via cellular GPRS/4G. ETM GPS represents **Source Priority 3**.

---

## 2. Integration Architecture
ETMs can send coordinates in two ways:
1. **Periodic Background Heartbeat:** Periodic pings sent every 30-60 seconds.
2. **Transaction-Triggered Geo-Stamp:** Every passenger ticket issuance attaches the instantaneous GPS coordinate, route stop code, and timestamp.

```
+-------------+         GSM/4G         +-------------------------+
| ETM Handheld| ---------------------> | ETM Gateway / Ingestion |
|   Device    |                        | POST /api/v1/tracking/etm|
+-------------+                        +------------+------------+
                                                    |
                                                    v
                                      +---------------------------+
                                      | Location Resolver Engine  |
                                      +---------------------------+
```

---

## 3. Telemetry Payload
```json
POST /api/v1/tracking/etm
Content-Type: application/json

{
  "busNumber": "731",
  "deviceId": "ETM-VIZAG-731",
  "tripId": "TRIP-2026-731",
  "latitude": 18.0100,
  "longitude": 82.5900,
  "accuracyMeters": 18,
  "speedKph": 38,
  "ticketSequence": 1042,
  "timestamp": "2026-10-05T08:18:00Z"
}
```

---

## 4. Priority Resolution
If neither a dedicated Hardware Tracker nor Crew Mobile GPS is actively streaming for Bus 731:
- The system checks for recent ETM telemetry.
- If ETM timestamp is within 300 seconds, the bus location is marked as **ETM GPS** and served to passengers.
