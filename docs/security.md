# APSRTC SmartTrack - Security Architecture & Data Protection

## 1. Threat Model & Mitigations
Public transportation tracking infrastructure faces several threat vectors:

### A. GPS Spoofing & Invalid Telemetry Injection
- **Risk:** An adversary sends bogus coordinates to falsely move buses.
- **Mitigation:**
  - Strict bounding box validation (`-90 <= lat <= 90`, `-180 <= lon <= 180`).
  - Speed sanity clamping (`0 <= speed <= 180 km/h`).
  - Device authorization checks: Devices must be registered to the assigned bus.
  - Rate limiting on `/api/v1/tracking/*` ingestion gateways.

### B. Passenger Privacy
- **Risk:** Exposing driver personal identity, phone numbers, or operational shift secrets.
- **Mitigation:**
  - Public passenger endpoints (`/journey/buses`, `/buses`) sanitize internal staff fields.
  - Driver names and employee IDs are restricted to the Officer Portal.

### C. Denial of Service (DoS)
- **Risk:** Flood of search requests during peak festival rushes (e.g. Sankranti, Dussehra).
- **Mitigation:**
  - IP-based sliding window rate limiting via `express-rate-limit`.
  - WAL mode and prepared statements in SQLite, eliminating query locking.
  - Redis cache integration ready for passenger search results.

---

## 2. Role-Based Access Control (RBAC)
1. **PASSENGER:** Read-only corridor search, bus lookup, grievance submission.
2. **CREW:** Trip start/end, device GPS streaming, emergency SOS.
3. **OFFICER:** Fleet operational table, live map, grievance updates, telemetry diagnostics.
4. **ADMIN:** Device registration, route editing, audit log inspections.

---

## 3. Headers & Network Security
- **Helmet:** Content Security Policy (CSP), X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`).
- **CORS:** Restricted to trusted corporate domains in production.
- **Request Size Limits:** Hard limit of `1MB` prevents memory exhaustion attacks.
