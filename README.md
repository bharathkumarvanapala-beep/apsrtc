# APSRTC SmartTrack

A development-ready demonstration platform for real-time bus tracking, journey-based multi-bus discovery, human-readable location names, ETA, and bus-linked grievance management.

## Important
This project uses DEMO GPS data. It is not connected to APSRTC's private/live operational systems. Real deployment requires authorization and an approved GPS/data source.

## Requirements
- Node.js 18+
- PostgreSQL 14+ with PostGIS (optional for the first demo run)
- Redis (optional; the server has an in-memory fallback for demo mode)
- VS Code or Antigravity

## Quick start

### 1. Backend
Open a terminal:

```powershell
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend:
http://localhost:5000

Health:
http://localhost:5000/health

### 2. Frontend
The frontend is plain HTML/CSS/JavaScript.

Option A: open `frontend/index.html` directly.

Option B: use VS Code Live Server / any static server:

```powershell
cd frontend
npx serve .
```

Then open the displayed URL.

### 3. Demo GPS simulator
In another terminal:

```powershell
cd demo/gps-simulator
node simulator.js
```

The simulator sends multiple buses along the demo corridor.

## Demo journey
Try:

Paderu -> Visakhapatnam

The application demonstrates multiple buses and displays human-readable locations such as:
- Paderu
- G. Madugula
- Chintapalli
- Anakapalle
- Visakhapatnam

## Project structure

- `frontend/` passenger web application
- `backend/` Node.js + Express API
- `database/` PostgreSQL/PostGIS schema
- `demo/gps-simulator/` simulated GPS fleet
- `docs/` project documentation

## Production direction

For production:
1. Replace demo GPS simulator with an authorized GPS/device/API source.
2. Configure PostgreSQL + PostGIS.
3. Configure Redis.
4. Put the API behind HTTPS and a load balancer.
5. Run multiple backend instances.
6. Add monitoring, backups, audit logging and load testing.
7. Validate route/stop data with APSRTC.
