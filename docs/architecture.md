# APSRTC SmartTrack - System Architecture

## 1. Executive Summary & Problem Statement
The Andhra Pradesh State Road Transport Corporation (APSRTC) operates thousands of bus services daily over diverse geographical regions, ranging from coastal plains to the Eastern Ghats hill corridors (e.g., Araku, Paderu, Chintapalli, Visakhapatnam). A critical passenger challenge is the uncertainty of bus arrivals:
> *"Passengers should know where the relevant buses actually are before waiting at a bus stop, so they do not waste time waiting unnecessarily."*

APSRTC SmartTrack provides an end-to-end, multi-source telemetry and journey matching platform engineered to deliver accurate, verified bus locations, spatial proximity, and dynamic ETAs to passengers, crew, and operations officers.

---

## 2. High-Level Architectural Diagram

```
+-----------------------------------------------------------------------------------+
|                              TELEMETRY INGESTION LAYER                            |
|                                                                                   |
|  [Hardware GPS Tracker]    [Crew Mobile Phone]    [ETM Ticket Machine]   [Simulator]
|        (Priority 1)            (Priority 2)           (Priority 3)       (Priority 4)
|             |                       |                      |                  |
+-------------+-----------------------+----------------------+------------------+---+
                                      |
                                      v
                      +-------------------------------+
                      |   REST Ingestion Endpoints    |
                      |   /api/v1/tracking/*          |
                      +---------------+---------------+
                                      |
                                      v
                      +-------------------------------+
                      |   Location Resolver Service   |
                      |   - Boundary Validation       |
                      |   - Priority Hierarchy Eval   |
                      |   - Freshness & Confidence    |
                      |   - Spatial Reverse Geocoding |
                      +---------------+---------------+
                                      |
                 +--------------------+--------------------+
                 |                                         |
                 v                                         v
   +---------------------------+             +---------------------------+
   |  Time-Series Audit Log    |             |  High-Speed Active State  |
   |  `location_updates` table |             |  `current_bus_locations`  |
   +---------------------------+             +-------------+-------------+
                                                           |
                                      +--------------------+--------------------+
                                      |                                         |
                                      v                                         v
                      +-------------------------------+         +-------------------------------+
                      |   Journey Matching Service    |         |   WebSocket Dispatch Engine   |
                      |   - Corridor Vector Projection|         |   Socket.IO Broadcast Rooms   |
                      |   - Direction & Passing Check |         |   (fleet, bus:ID, corridor)   |
                      |   - Network Haversine Dist    |         +---------------+---------------+
                      |   - Topography-Aware ETA      |                         |
                      +---------------+---------------+                         |
                                      |                                         |
                                      +--------------------+--------------------+
                                                           |
                                                           v
                      +---------------------------------------------------------+
                      |                 USER INTERACTION APPS                   |
                      |                                                         |
                      |   [Passenger Portal]    [Crew Portal]   [Officer Ops]   |
                      +---------------------------------------------------------+
```

---

## 3. Multi-Source Location Hierarchy
A key resilience feature is the **zero-dependence on a single location provider**:
1. **Source 1: HARDWARE GPS TRACKER (Priority 1)**
   - Hardwired vehicle tracker with external antenna. Highest reliability.
2. **Source 2: CREW MOBILE GPS (Priority 2)**
   - HTML5 Geolocation API from Driver/Conductor smartphone running the Crew Duty PWA.
3. **Source 3: ETM GPS (Priority 3)**
   - Electronic Ticketing Machine telemetry transmitted on ticket issuance or heartbeat.
4. **Source 4: DEMO SIMULATOR (Priority 4)**
   - Development & testbed simulator for offline evaluation and training.

### Dynamic Failover State Machine
When incoming updates are evaluated or queried:
- The system inspects available telemetry timestamps for each registered source.
- Freshness threshold is evaluated:
  - `0 - 10s`: **LIVE** (🟢)
  - `10 - 60s`: **RECENT** (🟡)
  - `60 - 300s`: **STALE** (🟠)
  - `> 300s`: **UNAVAILABLE** (⚪)
- If the Hardware Tracker goes offline or its age exceeds 300 seconds, the resolver automatically fails over to the Crew Mobile GPS or ETM without passenger downtime.

---

## 4. Corridor Journey Matching Algorithm
Unlike naive radius searches, SmartTrack employs **generic corridor route-order matching**:
1. Candidate routes are fetched that contain both `From` and `To` stops.
2. Direction validation ensures passenger boarding order < passenger destination order.
3. Each bus's GPS coordinates are projected onto the route stop sequence.
4. Proximity relationship is classified:
   - `BUS_AT_PASSENGER`: Bus is within 400m of the boarding stop.
   - `APPROACHING`: Bus is prior to the boarding stop and moving in the passenger's direction.
   - `BUS_ALREADY_PASSED`: Bus order > passenger stop order (bus has already departed).
   - `OPPOSITE_DIRECTION`: Bus is travelling along the reverse corridor.
5. All incoming matching buses are sorted by arrival proximity, highlighting the earliest arrival while displaying all options.

---

## 5. Technology Stack Summary
- **Backend Runtime:** Node.js v24+
- **Application Framework:** Express.js (REST v1)
- **Real-Time Layer:** Socket.IO v4.8+
- **Database Engine:** SQLite (WAL Mode via `better-sqlite3`) for zero-config persistence + full PostgreSQL production schemas
- **Geospatial Maths:** WGS-84 Haversine spherical projection and bearing azimuth calculations
- **Frontend Architecture:** Vanilla JavaScript (ES6+), Semantic HTML5, CSS Custom Properties, Leaflet.js / OpenStreetMap
- **Security:** Helmet, CORS, Express Rate Limiting, Input Sanitization
