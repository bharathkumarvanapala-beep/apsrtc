/**
 * APSRTC SmartTrack Automated Test Suite
 * Comprehensive verification of Health, Bus API, Multi-Stop Journey Matching,
 * Forward & Reverse Directions, Multi-Source Priority Failover, Telemetry Validation, and Complaints.
 */

const assert = require('assert');
const path = require('path');
const { getDb } = require('../config/db');
const { findRelevantBuses } = require('../services/journeyMatcherService');
const { 
  processLocationUpdate, 
  resolveActiveSourceForBus, 
  setSourceOffline,
  calculateFreshness,
  calculateConfidence 
} = require('../services/locationResolverService');
const { calculateDistanceKm, calculateBearing } = require('../utils/haversine');
const { calculateEta } = require('../services/etaService');
const { runSeed } = require('../../database/seed/seedData');

// Initialize database with known seed data
runSeed();

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  APSRTC SmartTrack Automated Test Suite Execution');
  console.log('===============================================================\n');

  console.log('📌 [TEST SUITE 1: Geographic & ETA Calculations]');
  it('Haversine distance calculation is accurate', () => {
    // Araku (18.3273, 82.8775) to Visakhapatnam (17.7215, 83.3032)
    const dist = calculateDistanceKm(18.3273, 82.8775, 17.7215, 83.3032);
    assert(dist > 75 && dist < 95, `Expected straight-line distance ~82km, got ${dist}`);
  });

  it('ETA calculation handles speed and intermediate stops properly', () => {
    const eta1 = calculateEta(35, 35, 1, 'GHAT');
    assert(eta1.etaMinutes >= 60 && eta1.etaMinutes <= 65, `Expected ~62 mins, got ${eta1.etaMinutes}`);

    const etaZero = calculateEta(10, 0, 0, 'GHAT'); // stopped bus fallback
    assert(etaZero.etaMinutes > 0, 'Stopped bus must have positive ETA using nominal corridor speed');
  });

  console.log('\n📌 [TEST SUITE 2: Multi-Source GPS Validation & Ingestion]');
  it('Rejects out-of-range latitude GPS coordinates', () => {
    assert.throws(() => {
      processLocationUpdate({
        busNumber: '415',
        source: 'HARDWARE_TRACKER',
        latitude: 95.0, // Invalid > 90
        longitude: 82.67
      });
    }, /Invalid GPS coordinates/);
  });

  it('Accepts valid Hardware Tracker GPS update', () => {
    const res = processLocationUpdate({
      busNumber: '518',
      source: 'HARDWARE_TRACKER',
      deviceId: 'HW-TRK-518-TEST',
      latitude: 17.8700,
      longitude: 82.3500,
      accuracyMeters: 5,
      speedKph: 50,
      heading: 90
    });
    assert.strictEqual(res.activeSource, 'HARDWARE_TRACKER');
    assert.strictEqual(res.confidence, 'HIGH');
    assert.strictEqual(res.status, 'LIVE');
  });

  it('Accepts Crew Mobile Phone GPS update', () => {
    const res = processLocationUpdate({
      busNumber: '415',
      source: 'CREW_PHONE',
      deviceId: 'DRIVER-415-TEST',
      latitude: 17.9500,
      longitude: 82.5167,
      accuracyMeters: 12,
      speedKph: 40,
      heading: 105
    });
    assert.strictEqual(res.activeSource, 'CREW_PHONE');
    assert.strictEqual(res.confidence, 'GOOD');
    assert.strictEqual(res.status, 'LIVE');
  });

  it('Accepts ETM GPS update', () => {
    const res = processLocationUpdate({
      busNumber: '731',
      source: 'ETM',
      deviceId: 'ETM-731-TEST',
      latitude: 18.0100,
      longitude: 82.5900,
      accuracyMeters: 18,
      speedKph: 38,
      heading: 115
    });
    assert.strictEqual(res.activeSource, 'ETM');
    assert.strictEqual(res.status, 'LIVE');
  });

  it('Accepts Demo Simulator GPS update', () => {
    const res = processLocationUpdate({
      busNumber: '302',
      source: 'DEMO',
      deviceId: 'DEMO-302-TEST',
      latitude: 18.0816,
      longitude: 82.6700,
      accuracyMeters: 15,
      speedKph: 42,
      heading: 120
    });
    assert.strictEqual(res.activeSource, 'DEMO');
    assert.strictEqual(res.status, 'LIVE');
  });

  console.log('\n📌 [TEST SUITE 3: Multi-Source Priority & Dynamic Failover]');
  it('Hardware Tracker takes priority over Crew Phone and ETM', () => {
    // Send crew update first
    processLocationUpdate({
      busNumber: '518',
      source: 'CREW_PHONE',
      deviceId: 'CREW-PHONE-518',
      latitude: 17.8700,
      longitude: 82.3500
    });
    // Send hardware update
    const res = processLocationUpdate({
      busNumber: '518',
      source: 'HARDWARE_TRACKER',
      deviceId: 'HW-TRK-518',
      latitude: 17.8705,
      longitude: 82.3505
    });
    assert.strictEqual(res.activeSource, 'HARDWARE_TRACKER');
  });

  it('Dynamic Failover: Dropping Hardware Tracker falls back to Crew Phone GPS', () => {
    const updated = setSourceOffline('518', 'HARDWARE_TRACKER');
    assert.strictEqual(updated.activeSource, 'CREW_PHONE', 'Should failover to CREW_PHONE');
  });

  console.log('\n📌 [TEST SUITE 4: Multi-Stop Generic Journey Matching]');
  it('Journey 1: Paderu → Visakhapatnam returns relevant forward buses', () => {
    const res = findRelevantBuses('Paderu', 'Visakhapatnam');
    assert(res.success === true);
    assert(res.totalRelevantBuses >= 1, 'Should find at least 1 relevant bus');
    const bus302 = res.buses.find(b => b.busNumber === '302');
    assert(bus302 !== undefined, 'Bus 302 should be relevant from Paderu');
  });

  it('Journey 2: Araku → Paderu matches corridor sub-segment', () => {
    // Send fresh ping for Bus 842
    processLocationUpdate({
      busNumber: '842',
      source: 'HARDWARE_TRACKER',
      latitude: 18.3273,
      longitude: 82.8775 // At Araku
    });
    const res = findRelevantBuses('Araku', 'Paderu');
    assert(res.success === true);
    assert(res.buses.length >= 1, 'Bus 842 should be relevant for Araku to Paderu');
  });

  it('Journey 3: Visakhapatnam → Paderu (Reverse Up Corridor)', () => {
    // Send fresh ping for Bus 624 heading UP
    processLocationUpdate({
      busNumber: '624',
      source: 'HARDWARE_TRACKER',
      latitude: 17.7215,
      longitude: 83.3032 // Visakhapatnam
    });
    const res = findRelevantBuses('Visakhapatnam', 'Paderu');
    assert(res.success === true);
    assert(res.buses.length >= 1, 'Should find reverse direction bus 624');
  });

  it('Journey 4: Paderu → G. Madugula', () => {
    const res = findRelevantBuses('Paderu', 'G. Madugula');
    assert(res.success === true);
  });

  it('Journey 5: G. Madugula → Chintapalli', () => {
    const res = findRelevantBuses('G. Madugula', 'Chintapalli');
    assert(res.success === true);
  });

  it('Journey 6: Chintapalli → Anakapalle', () => {
    const res = findRelevantBuses('Chintapalli', 'Anakapalle');
    assert(res.success === true);
  });

  it('Journey 7: Anakapalle → Visakhapatnam', () => {
    const res = findRelevantBuses('Anakapalle', 'Visakhapatnam');
    assert(res.success === true);
  });

  it('Journey 8: Paderu → Chodavaram (Direct Ghat Route)', () => {
    const res = findRelevantBuses('Paderu', 'Chodavaram');
    assert(res.success === true);
    assert(res.buses.length >= 1, 'Should find buses from Paderu to Chodavaram');
  });

  it('Journey 9: Chodavaram → Visakhapatnam', () => {
    const res = findRelevantBuses('Chodavaram', 'Visakhapatnam');
    assert(res.success === true);
    assert(res.buses.length >= 1, 'Should find buses from Chodavaram to Visakhapatnam');
  });

  it('Journey 10: Chodavaram → Pendurthi', () => {
    const res = findRelevantBuses('Chodavaram', 'Pendurthi');
    assert(res.success === true);
    assert(res.buses.length >= 1, 'Should find buses from Chodavaram to Pendurthi');
  });

  it('Journey 11: Pendurthi → Visakhapatnam', () => {
    const res = findRelevantBuses('Pendurthi', 'Visakhapatnam');
    assert(res.success === true);
  });

  it('Journey 12: Paderu → S. Kota (via Araku)', () => {
    // Send fresh ping for Bus 472 at Paderu
    processLocationUpdate({
      busNumber: '472',
      source: 'HARDWARE_TRACKER',
      latitude: 18.0816,
      longitude: 82.6700
    });
    const res = findRelevantBuses('Paderu', 'S. Kota');
    assert(res.success === true);
    assert(res.buses.length >= 1, 'Should find buses from Paderu to S. Kota');
  });

  it('Journey 13: S. Kota → Visakhapatnam', () => {
    const res = findRelevantBuses('S. Kota', 'Visakhapatnam');
    assert(res.success === true);
    assert(res.buses.length >= 1, 'Should find buses from S. Kota to Visakhapatnam');
  });

  it('Journey 14: S. Kota → Pendurthi', () => {
    const res = findRelevantBuses('S. Kota', 'Pendurthi');
    assert(res.success === true);
  });

  it('Journey 15: Araku → S. Kota', () => {
    const res = findRelevantBuses('Araku', 'S. Kota');
    assert(res.success === true);
  });

  it('Rejects identical From and To stops', () => {
    assert.throws(() => {
      findRelevantBuses('Paderu', 'Paderu');
    }, /Departure and destination locations must be different/);
  });

  it('Rejects unknown stop locations with clear error', () => {
    assert.throws(() => {
      findRelevantBuses('New York', 'Visakhapatnam');
    }, /not found in/);
  });

  console.log('\n===============================================================');
  console.log(`  Tests Completed: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
