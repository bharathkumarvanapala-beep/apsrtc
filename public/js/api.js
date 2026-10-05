/**
 * APSRTC SmartTrack API Client
 * Wraps REST endpoints with error handling and response normalization.
 */

const API_BASE = window.location.origin;

const api = {
  // Health
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Corridor Stops
  getStops: async () => {
    const res = await fetch(`${API_BASE}/api/v1/journey/stops`);
    return res.json();
  },

  // Journey Search (From -> To)
  searchJourney: async (from, to) => {
    const url = new URL(`${API_BASE}/api/v1/journey/buses`);
    url.searchParams.append('from', from);
    url.searchParams.append('to', to);
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to search journey');
    }
    return json;
  },

  // All Buses
  getAllBuses: async (params = {}) => {
    const url = new URL(`${API_BASE}/api/v1/buses`);
    Object.keys(params).forEach(k => {
      if (params[k]) url.searchParams.append(k, params[k]);
    });
    const res = await fetch(url);
    return res.json();
  },

  // Bus by Number / ID
  getBusById: async (busId) => {
    const res = await fetch(`${API_BASE}/api/v1/buses/${busId}`);
    return res.json();
  },

  // Bus Location
  getBusLocation: async (busId) => {
    const res = await fetch(`${API_BASE}/api/v1/buses/${busId}/location`);
    return res.json();
  },

  // Telemetry Ingestion
  sendGpsUpdate: async (sourceEndpoint, payload) => {
    // sourceEndpoint: 'device', 'crew', 'etm', 'demo'
    const res = await fetch(`${API_BASE}/api/v1/tracking/${sourceEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'GPS Telemetry Rejected');
    }
    return json;
  },

  // Simulate Source Drop for failover demonstration
  simulateDrop: async (busNumber, source) => {
    const res = await fetch(`${API_BASE}/api/v1/tracking/simulate-drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busNumber, source })
    });
    return res.json();
  },

  // Trip Start & End
  startTrip: async (payload) => {
    const res = await fetch(`${API_BASE}/api/v1/trips/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to start trip');
    return json;
  },

  endTrip: async (tripId) => {
    const res = await fetch(`${API_BASE}/api/v1/trips/${tripId}/end`, {
      method: 'POST'
    });
    return res.json();
  },

  getActiveTrips: async () => {
    const res = await fetch(`${API_BASE}/api/v1/trips/active`);
    return res.json();
  },

  // Complaints
  submitComplaint: async (payload) => {
    const res = await fetch(`${API_BASE}/api/v1/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to submit complaint');
    return json;
  },

  getComplaints: async (params = {}) => {
    const url = new URL(`${API_BASE}/api/v1/complaints`);
    Object.keys(params).forEach(k => {
      if (params[k]) url.searchParams.append(k, params[k]);
    });
    const res = await fetch(url);
    return res.json();
  },

  updateComplaintStatus: async (id, status, notes = '') => {
    const res = await fetch(`${API_BASE}/api/v1/complaints/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, officerNotes: notes })
    });
    return res.json();
  },

  // Operations Fleet Overview
  getFleetOverview: async () => {
    const res = await fetch(`${API_BASE}/api/v1/operations/fleet`);
    return res.json();
  },

  triggerSos: async (payload) => {
    const res = await fetch(`${API_BASE}/api/v1/operations/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }
};

window.api = api;
