const { run, queryOne, queryAll } = require('./config/db');

console.log('Seeding initial action data for complaints...');

// 1. Update APSRTC-G-2026-9083 (Bus 518 Broken Seats - from user screenshot)
const c9083 = queryOne('SELECT * FROM complaints WHERE complaint_ref = ?', ['APSRTC-G-2026-9083']);
if (c9083) {
  run(`
    UPDATE complaints 
    SET status = 'ACTION_TAKEN', 
        officer_notes = 'Bus 518 brought into Paderu Depot Mechanical Bay #2. Welded loose backrest bracket for Seat #14, replaced damaged spring cushion, and lubricated jammed window latch mechanism. Inspected and certified fit for service by Mechanical Foreman T. Ramana.',
        updated_at = datetime('now')
    WHERE id = ?
  `, [c9083.id]);

  run('DELETE FROM complaint_status_history WHERE complaint_id = ?', [c9083.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'NEW', 'ACKNOWLEDGED', 'K. Satyanarayana, Depot Manager, Paderu', 'Grievance assigned to Paderu Workshop Maintenance Unit for emergency bay inspection.', datetime('now', '-3 hours'))
  `, [c9083.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'ACKNOWLEDGED', 'INVESTIGATING', 'V. Prasad, Mechanical Supervisor', 'Vehicle inspected on return to Paderu Depot. Verified loose seat frame #14 and bent window rail.', datetime('now', '-2 hours'))
  `, [c9083.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'INVESTIGATING', 'ACTION_TAKEN', 'T. Ramana, Mechanical Foreman', 'Seat frame re-welded, cushion replaced, window rail lubricated. Workshop fitness certificate #PDR-WS-8841 issued.', datetime('now', '-30 minutes'))
  `, [c9083.id]);
}

// 2. Update APSRTC-G-2026-1011 (Bus 415 Staff Misconduct)
const c1011 = queryOne('SELECT * FROM complaints WHERE complaint_ref = ?', ['APSRTC-G-2026-1011']);
if (c1011) {
  run(`
    UPDATE complaints 
    SET status = 'ACTION_TAKEN', 
        officer_notes = 'Driver summoned to Depot Manager chamber. Speed telemetry logs reviewed (confirmed 48 km/h on 30 km/h Bowdara hairpin curve). Written warning memo issued under APSRTC Disciplinary Code Rule 14. Deputed to 2-day mandatory defensive ghat driving training.',
        updated_at = datetime('now')
    WHERE id = ?
  `, [c1011.id]);

  run('DELETE FROM complaint_status_history WHERE complaint_id = ?', [c1011.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'NEW', 'ACKNOWLEDGED', 'Depot Traffic Supervisor', 'Complainant statement logged; driver badge #DRV-442 identified.', datetime('now', '-4 hours'))
  `, [c1011.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'ACKNOWLEDGED', 'INVESTIGATING', 'M. Rao, Vigilance Officer', 'GPS telemetry speed logs audited across Bowdara sector.', datetime('now', '-2 hours'))
  `, [c1011.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'INVESTIGATING', 'ACTION_TAKEN', 'K. Satyanarayana, Depot Manager', 'Disciplinary warning memo #PDR/DISC/2026/89 served. Roster updated for safety refresher.', datetime('now', '-1 hour'))
  `, [c1011.id]);
}

// 3. Update APSRTC-G-2026-1049 (Bus 415 Delay)
const c1049 = queryOne('SELECT * FROM complaints WHERE complaint_ref = ?', ['APSRTC-G-2026-1049']);
if (c1049) {
  run(`
    UPDATE complaints 
    SET status = 'RESOLVED', 
        officer_notes = 'Ghat section clearance completed following minor rockfall near Bowdara. Police traffic control escorted bus safely past foggy sector. Schedule normalized.',
        updated_at = datetime('now')
    WHERE id = ?
  `, [c1049.id]);

  run('DELETE FROM complaint_status_history WHERE complaint_id = ?', [c1049.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'NEW', 'ACKNOWLEDGED', 'Regional Traffic Controller', 'Notified highway patrol of foggy conditions on ghat road.', datetime('now', '-5 hours'))
  `, [c1049.id]);
  run(`
    INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, created_at)
    VALUES (?, 'ACKNOWLEDGED', 'RESOLVED', 'K. Satyanarayana, Depot Manager', 'Road cleared, bus safely reached destination without incident.', datetime('now', '-1 hour'))
  `, [c1049.id]);
}

console.log('Seeding completed successfully!');
const test = queryAll('SELECT complaint_ref, status, officer_notes FROM complaints');
console.log(JSON.stringify(test, null, 2));
