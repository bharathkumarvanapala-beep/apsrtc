# APSRTC SmartTrack — Real-Time Fleet & Corridor Tracking Prototype
### Andhra Pradesh State Road Transport Corporation (ఆంధ్రప్రదేశ్ రాష్ట్ర రోడ్డు రవాణా సంస్థ)

---

## 🚌 Problem Statement & Solution

**The Core Passenger Problem:**
> *"Passengers should know where the relevant buses actually are before waiting at a bus stop, so they do not waste time waiting unnecessarily."*

**APSRTC SmartTrack Solution:**
APSRTC SmartTrack provides an enterprise-ready, multi-source location architecture and corridor journey matching system designed for high-density public transport operations. 

> [!NOTE]
> **Prototype Demonstration Notice:**  
> This system is an operational full-stack demonstration prototype. It showcases real-time location resolution, multi-bus directional matching, and dynamic priority failover across simulated and live data feeds. Real-world APSRTC production deployment will connect to authorized physical GPS hardware and enterprise ETM servers.

---

## 🌟 Key Capabilities

1. **Multi-Source Location Hierarchy with Zero Single-Point-of-Failure:**
   - **Source 1: HARDWARE GPS TRACKER** (Priority 1 — Vehicle mounted hardware box)
   - **Source 2: CREW MOBILE GPS** (Priority 2 — Driver/conductor smartphone GPS via HTML5 Geolocation)
   - **Source 3: ETM GPS** (Priority 3 — Electronic Ticketing Machine telemetry)
   - **Source 4: DEMO SIMULATOR** (Priority 4 — Topographic corridor simulator)
2. **Dynamic Automatic Priority Failover:**
   - If a Hardware Tracker drops offline, the system instantly fails over to Crew Mobile GPS or ETM telemetry with zero passenger disruption.
3. **Generic Corridor Journey Matching (No Hardcoded Routes):**
   - Supports arbitrary stop combinations (e.g. *Araku ➔ Paderu*, *Paderu ➔ Visakhapatnam*, *Visakhapatnam ➔ Araku*, *G. Madugula ➔ Chintapalli*).
   - Distinguishes **Approaching Buses**, **Buses at Passenger Stop**, **Already Departed Buses**, and **Opposite Direction Buses**.
   - Displays **ALL** incoming buses (not just one!), sorted by proximity/ETA, highlighting the earliest arrival option.
4. **Verified Human-Readable Corridor Locations:**
   - Reverses GPS coordinates into exact landmarks (e.g., *"Paderu Bus Station"*, *"Near G. Madugula (0.8 km)"*, *"Between Paderu and G. Madugula"*).
5. **Freshness & Confidence Telemetry:**
   - Visual freshness indicators: 🟢 **LIVE** (&le;10s), 🟡 **RECENT** (&le;60s), 🟠 **STALE** (&le;5m), ⚪ **UNAVAILABLE** (>5m).
   - GPS horizontal accuracy confidence pills (High &plusmn;8m, Good &plusmn;15m, Weak &plusmn;80m).
6. **Live Interactive Fleet Map:**
   - Leaflet.js + OpenStreetMap with custom bus markers, corridor route polylines, and popups.
7. **Passenger Grievance Desk:**
   - Passengers can file grievances directly against specific buses, generating official reference IDs (e.g. `APSRTC-G-2026-1049`).
   - Officer Dashboard provides real-time status transitions: `NEW` ➔ `ACKNOWLEDGED` ➔ `INVESTIGATING` ➔ `RESOLVED` ➔ `CLOSED`.
8. **Crew Mobile Portal:**
   - Staff can authenticate, start scheduled trips, stream live phone GPS, and trigger Emergency SOS alarms.

---

## 🗺️ Demonstration Corridor Stops (Eastern Ghats)

```
[1] Araku ➔ [2] Ananthagiri ➔ [3] Paderu ➔ [4] G. Madugula ➔ [5] Chintapalli ➔ [6] Anakapalle ➔ [7] Visakhapatnam
```

---

## 🚀 Quick Start Guide (Windows PowerShell)

### Prerequisites
- **Node.js**: v20+ or v24+ (`node -v`)
- **NPM**: v10+ (`npm -v`)
- A modern web browser (Edge, Chrome, Firefox)

---

### Step 1: Open Terminal & Navigate to Backend
Open Windows PowerShell in the project directory:

```powershell
cd "c:\Users\AI PC\Desktop\apsrtc\backend"
```

---

### Step 2: Install Dependencies & Setup Environment
```powershell
npm install
copy .env.example .env
```

*Expected Output:*
```
added 94 packages in 3s
        1 file(s) copied.
```

---

### Step 3: Run Database Migrations & Seed Data
```powershell
npm run seed
```

*Expected Output:*
```
🚍 Initializing APSRTC SmartTrack SQLite Database at: C:\Users\AI PC\Desktop\apsrtc\backend\apsrtc.db
✅ Schema tables verified/created.
✅ Successfully seeded routes, stops, buses, devices, locations, and complaints!
✨ Seed complete.
```

---

### Step 4: Run the Automated Test Suite (18 Scenarios)
Verify that all journey matching, multi-source failover, and geographic calculations pass:

```powershell
npm test
```

*Expected Output:*
```
===============================================================
  APSRTC SmartTrack Automated Test Suite Execution
===============================================================

📌 [TEST SUITE 1: Geographic & ETA Calculations]
  ✅ PASS: Haversine distance calculation is accurate
  ✅ PASS: ETA calculation handles speed and intermediate stops properly

📌 [TEST SUITE 2: Multi-Source GPS Validation & Ingestion]
  ✅ PASS: Rejects out-of-range latitude GPS coordinates
  ✅ PASS: Accepts valid Hardware Tracker GPS update
  ✅ PASS: Accepts Crew Mobile Phone GPS update
  ✅ PASS: Accepts ETM GPS update
  ✅ PASS: Accepts Demo Simulator GPS update

📌 [TEST SUITE 3: Multi-Source Priority & Dynamic Failover]
  ✅ PASS: Hardware Tracker takes priority over Crew Phone and ETM
  ✅ PASS: Dynamic Failover: Dropping Hardware Tracker falls back to Crew Phone GPS

📌 [TEST SUITE 4: Multi-Stop Generic Journey Matching]
  ✅ PASS: Journey 1: Paderu → Visakhapatnam returns relevant forward buses
  ✅ PASS: Journey 2: Araku → Paderu matches corridor sub-segment
  ✅ PASS: Journey 3: Visakhapatnam → Paderu (Reverse Up Corridor)
  ✅ PASS: Journey 4: Paderu → G. Madugula
  ✅ PASS: Journey 5: G. Madugula → Chintapalli
  ✅ PASS: Journey 6: Chintapalli → Anakapalle
  ✅ PASS: Journey 7: Anakapalle → Visakhapatnam
  ✅ PASS: Rejects identical From and To stops
  ✅ PASS: Rejects unknown stop locations with clear error

===============================================================
  Tests Completed: 18 | Passed: 18 | Failed: 0
===============================================================
```

---

### Step 5: Start the APSRTC SmartTrack Server
```powershell
npm start
```

*Expected Output:*
```
[INFO] Connecting to SQLite Database at: C:\Users\AI PC\Desktop\apsrtc\backend\apsrtc.db
[INFO] Database connected successfully (WAL Mode & Foreign Keys ON).
========================================================
  APSRTC SmartTrack Server listening on port 5000
  Mode: DEVELOPMENT | Demo Mode: true
  Web App: http://localhost:5000
  Health:  http://localhost:5000/health
========================================================
```

---

### Step 6: Open the Web Application
Open your browser and navigate to:
👉 **`http://localhost:5000`**

*(You can also open the modular direct links:)*
- **Passenger Portal:** `http://localhost:5000?tab=passenger`
- **Crew Mobile Portal:** `http://localhost:5000?tab=crew`
- **Officer Operations Fleet Dashboard:** `http://localhost:5000?tab=officer`
- **Telemetry Simulator Lab:** `http://localhost:5000?tab=simulator`

---

### Step 7 (Optional): Run the Standalone Background GPS Simulator
To have 7 buses continuously moving in real-time along the corridor:
Open a second PowerShell terminal:

```powershell
cd "c:\Users\AI PC\Desktop\apsrtc\backend"
npm run simulate
```

*Expected Output:*
```
===============================================================
  APSRTC SmartTrack Multi-Bus Telemetry Simulator Active
  Target Backend: http://localhost:5000
  Telemetry Tick Rate: every 3s
  Simulating: 7 Fleet Buses across Eastern Ghats Corridor
  Sources: HARDWARE_TRACKER, CREW_PHONE, ETM, DEMO
===============================================================
```
*(Alternatively, you can click the **"Start In-Browser Pings (3s)"** button directly inside the web UI's **Simulator & Failover** tab!)*

---

## 🎬 Verification & Demonstration Walkthrough

### Scenario 1: Passenger Journey Search
1. Open `http://localhost:5000`.
2. Notice the pre-filled boarding stop **Paderu** and destination **Visakhapatnam** (or click the quick-chip **Paderu ➔ Visakhapatnam**).
3. Click **Find Relevant Incoming Buses**.
4. Observe the results:
   - **Bus 302** (Palle Velugu): Located at *Paderu Bus Station* (`BUS_AT_PASSENGER`), ETA: *Arriving now*.
   - **Bus 842** (Express): Located near *Ananthagiri Viewpoint* (`APPROACHING`), Distance: *40.0 km*, ETA: *~1 hr 9 min*.
   - **Buses 415, 518, 731**: Identified as already passed Paderu (downstream at G. Madugula and Chintapalli).
   - **Bus 624**: Operating on the reverse corridor (Visakhapatnam ➔ Araku Up) and correctly excluded.
5. Click **🗺️ View on Map** on Bus 302: The Leaflet map instantly zooms in to Bus 302 with real-time speed, accuracy, and trip popup!

### Scenario 2: Dynamic Failover Verification (Hardware Tracker ➔ Crew Phone ➔ ETM)
1. Click the **🛡️ Officer Fleet Ops** tab.
2. In the **Multi-Source Priority Failover Verification Console**:
   - Target Bus: **Bus 518** (Currently on `HARDWARE_TRACKER`).
   - Source to Drop: **Hardware Tracker**.
   - Click **⚡ Drop Source & Trigger Failover**.
3. Watch the result box and table update in real time: Bus 518 immediately switches to `CREW_PHONE` GPS without dropping the bus from the passenger portal!

### Scenario 3: Filing a Passenger Grievance
1. On any bus card (e.g. Bus 415), click **⚠️ Report Problem**.
2. Select Category (e.g. *Delay* or *Overcrowding*), enter description, and submit.
3. Receive official reference ID (e.g. `APSRTC-G-2026-XXXX`).
4. Click the **🛡️ Officer Fleet Ops** tab: The grievance appears instantly in the **Passenger Grievance Resolution Desk**. The officer can change status to `INVESTIGATING` or `RESOLVED` and save notes.

### Scenario 4: Crew Mobile Trip Tracking & SOS
1. Click the **📱 Crew Mobile Portal** tab.
2. Select Driver `EMP-4089`, Bus `415`, Route `Paderu ➔ Visakhapatnam`.
3. Click **🚀 Start Scheduled Trip**.
4. Click **🧪 Step Forward Along Route** to simulate movement or **📡 Start Phone GPS** to stream live device coordinates.
5. Click **🚨 EMERGENCY SOS BROADCAST**: The server dispatches a high-priority alarm to all depot controllers!

---

## 🏛️ Project Structure

```
apsrtc/
├── frontend/                       # Web application source files
│   ├── index.html                  # Single Page Application
│   ├── css/style.css               # Official APSRTC design system
│   ├── js/                         # Modular JavaScript (api, socket, map, passenger, crew, officer, app)
│   ├── pages/                      # Modular direct page entries (passenger.html, crew.html, officer.html)
│   └── assets/logo.svg             # APSRTC emblem vector logo
├── backend/                        # Express + Socket.IO REST/WS backend
│   ├── server.js                   # Application server & static host
│   ├── package.json                # Dependencies and npm scripts
│   ├── config/                     # Configuration and database pooling
│   ├── controllers/                # REST API controllers
│   ├── routes/                     # REST v1 routes
│   ├── services/                   # Location Resolver, Journey Matcher, GeoService, ETAService, SocketService
│   ├── middleware/                 # Validation & human-readable error handler
│   ├── sockets/                    # Socket.IO room management
│   ├── models/                     # Data access helpers
│   └── tests/suite.test.js         # Automated test suite (18 scenarios)
├── database/                       # Database DDL & Seeders
│   ├── schema/                     # SQLite and PostgreSQL production schemas
│   ├── migrations/                 # Initial migration scripts
│   └── seed/                       # Programmatic corridor seed data
├── demo/                           # Telemetry Simulation
│   └── gps-simulator/simulator.js  # Multi-bus corridor telemetry simulator
├── docs/                           # Comprehensive Engineering Documentation
│   ├── architecture.md             # System architecture & multi-source design
│   ├── api.md                      # REST & WebSocket API specification
│   ├── database.md                 # Data dictionary & ER diagram
│   ├── gps-integration.md          # Physical GPS tracker integration guide
│   ├── crew-gps.md                 # Crew mobile GPS integration guide
│   ├── etm-integration.md          # ETM ticket machine integration guide
│   ├── deployment.md               # Cloud Docker & NGINX deployment guide
│   ├── security.md                 # Threat model & RBAC
│   └── user-guide.md               # Step-by-step user manuals
├── Dockerfile                      # Production container image definition
├── docker-compose.yml              # Local container orchestration
├── PROJECT_FILES.txt               # Inventory of all project files
└── README.md                       # This documentation guide
```

---

## 🛡️ License & Operational Context
Built for the **Andhra Pradesh State Road Transport Corporation (APSRTC)**.  
Designed for future operational expansion into physical vehicle GPS units and central depot command dashboards.
