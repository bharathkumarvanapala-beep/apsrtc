# APSRTC SmartTrack - Comprehensive User Guide

## 1. Passenger Portal Guide
*Objective: Know where your bus is before waiting at a bus stop.*

### Step 1: Search Your Journey
1. Open the application at `http://localhost:5000` (or `pages/passenger.html`).
2. Select your **Boarding Stop** (From) e.g., `Paderu`.
3. Select your **Destination Stop** (To) e.g., `Visakhapatnam`.
4. Click **Find Relevant Incoming Buses** (or click a quick-chip e.g. `Paderu ➔ Visakhapatnam`).

### Step 2: Review Incoming Buses
- The system returns **ALL** compatible active buses approaching your stop.
- Each bus card displays:
  - **Bus Number:** e.g., Bus 302, Bus 415.
  - **Service Type:** Palle Velugu, Express, Ultra Deluxe, etc.
  - **Freshness Badge:** 🟢 `LIVE` (&le;10s), 🟡 `RECENT` (&le;60s), 🟠 `STALE` (&le;5m).
  - **Current Verified Location:** e.g. `Paderu Bus Station`, `G. Madugula`.
  - **Distance to You:** Corridor distance in kilometers.
  - **ETA to You:** Dynamic arrival time (e.g. `Arriving now`, `20 min`, `1 hr 9 min`).
  - **GPS Accuracy:** Horizontal accuracy (e.g. `±12m`).
  - **Source Badge:** Live Tracker, Crew Mobile, ETM Device, or Demo GPS.

### Step 3: Interactive Map & Grievances
- Click **View on Map** to zoom directly to any bus marker with real-time stats.
- Click **Report Problem** to submit a grievance against that specific bus. Receive an official reference number e.g. `APSRTC-G-2026-XXXX`.

---

## 2. Crew Mobile Portal Guide
*For Drivers and Conductors on Duty.*

1. Click the **Crew Mobile Portal** tab in the navigation bar.
2. Select your **Staff ID** and **Bus Number**.
3. Choose your trip origin and destination.
4. Tap **Start Scheduled Trip**.
5. Tap **Start Phone GPS** to stream your device's location to the central fleet server.
6. In desktop or demo environments, use the **Step Forward Along Route** button to simulate movement.
7. In case of emergency, tap **EMERGENCY SOS BROADCAST** to immediately trigger central depot alarms.
8. At the conclusion of your route, tap **End Trip**.

---

## 3. Officer Fleet Operations Guide
*For Depot Managers, Controllers, and Operations Engineers.*

1. Click the **Officer Fleet Ops** tab.
2. View key operational health counters: Total Fleet, Active Trips, Live GPS, Stale, Offline, Tracker Count, Crew GPS, ETM, Complaints, and Critical Alerts.
3. Test Multi-Source Priority Failover:
   - Select a bus (e.g. `Bus 518`).
   - Select a source to drop (e.g. `Hardware Tracker`).
   - Click **Drop Source & Trigger Failover**.
   - Watch the backend immediately failover to Crew Mobile GPS or ETM live on screen!
4. Filter the fleet monitoring table by bus number, corridor, or freshness.
5. Review the **Passenger Grievance Resolution Desk**, update grievance statuses (`NEW`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`, `CLOSED`), and log investigation notes.
