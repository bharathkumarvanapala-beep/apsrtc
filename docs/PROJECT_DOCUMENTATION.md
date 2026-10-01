# APSRTC SmartTrack — Project Documentation

## 1. Purpose
A proposed real-time public transport platform that helps passengers discover relevant buses for a journey, view live locations, understand nearby place names, estimate arrival times and submit bus-specific grievances.

## 2. Key passenger use case
Passenger enters current location and destination. The server identifies multiple relevant buses along or approaching the required road/route corridor.

Example:
Paderu → Visakhapatnam

The interface may show:
- Bus 415 — Near Paderu
- Bus 302 — Near G. Madugula
- Bus 518 — Near Chintapalli

These are demonstration values.

## 3. Architecture
Frontend: HTML/CSS/JavaScript.
Backend: Node.js + Express.
Realtime: Socket.IO.
Database target: PostgreSQL + PostGIS.
Cache target: Redis.
Maps: Leaflet + OpenStreetMap.
Demo: Node GPS simulator.

## 4. Scalability
The production architecture should use multiple backend instances behind a load balancer, shared Redis state for real-time scaling, PostgreSQL connection pooling, spatial indexes, selective WebSocket subscriptions, health checks, monitoring, backups and load testing.

The project does not claim that a server can never fail. The goal is resilience, graceful degradation and rapid recovery.

## 5. Live location
Each bus location contains latitude, longitude, speed, heading, accuracy, human-readable location name and timestamp.

The UI should distinguish live, stale and unavailable data.

## 6. Journey intelligence
Bus relevance should be based on:
- route compatibility
- direction
- corridor/route overlap
- proximity to passenger
- ETA
- ability to serve the destination

Distance alone should not determine relevance.

## 7. Grievance
A complaint is associated with a selected bus and can include category and description. Production systems should attach trip/route/passenger context and maintain an auditable status history.

## 8. Production requirement
This repository uses demo data. Official APSRTC live GPS, fleet and route data requires authorization and approved integration.

## 9. Main folders
- frontend
- backend
- database
- demo
- docs
