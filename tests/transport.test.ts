import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransportState, execute, snapshot, DEMO_DATE } from '../src/transport/engine.ts';
import { placeFor, pointsFor } from '../src/transport/simulate.ts';
import schedule from '../src/transport/schedule.json' with { type: 'json' };

let n = 0;
const run = (state: any, viewer: string, type: string, trip: any = null, data: any = {}) =>
  execute(state, viewer, { id: `t-${++n}`, type, date: DEMO_DATE, tripId: trip?.id, version: trip?.version, data });
const tripOf = (state: any, viewer: string, number: string) => snapshot(state, DEMO_DATE, viewer).trips.find((t: any) => t.number === number);

test('every stop and school in the workbook resolves to a sourced place, or says it is unknown', () => {
  const stops = new Set(schedule.trips.flatMap((t: any) => t.stops.map((s: any) => s.name)));
  const missing = [...stops].filter(name => !placeFor(name as string));
  assert.deepEqual(missing.sort(), ['גנים דרום הגולן', 'תחנה לבירור']);
  const schools = new Set(schedule.trips.map((t: any) => t.school));
  assert.deepEqual([...schools].filter(s => !placeFor(s as string)), ['ילקוט רועים']);
  for (const name of stops) { const p = placeFor(name as string); if (p) assert.match(p.source, /^https:\/\//); }
});

test('a morning trip runs stops then school; an afternoon trip starts at school with stops spaced in time', () => {
  const morning = pointsFor(schedule.trips.find((t: any) => t.number === '10-1' && t.weekday === 0));
  assert.deepEqual(morning.map(p => p.kind), ['stop', 'stop', 'school']);
  const afternoon = pointsFor(schedule.trips.find((t: any) => t.direction === 'afternoon' && t.stops.length > 2));
  assert.equal(afternoon[0].kind, 'school');
  const times = afternoon.map(p => Number(p.time!.slice(0, 2)) * 60 + Number(p.time!.slice(3)));
  assert.ok(times.every((m, i) => i === 0 || m > times[i - 1]), 'times strictly increase');
});

test('the dispatcher sees a short list of causes, not one alert per trip', () => {
  const s = createTransportState();
  const d = snapshot(s, DEMO_DATE, 'shuki');
  assert.equal(d.clock, '07:05');
  assert.ok(d.alerts.length <= 8, `${d.alerts.length} alerts`);
  const tripIdOf = (n: string) => d.trips.find((t: any) => t.number === n).id;
  assert.ok(d.alerts.some((a: any) => a.title === 'הטסט של אוטובוס 14 פג' && a.tripIds.includes(tripIdOf('14-1')) && a.fix?.kind === 'bus'));
  assert.ok(d.alerts.some((a: any) => /^הרישיון של .+ פג$/.test(a.title) && a.tripIds.includes(tripIdOf('21-1')) && a.fix?.kind === 'driver'));
  assert.ok(!d.alerts.some((a: any) => a.queue === 'prep' && /מאומת|בירור|לבדיקה/.test(a.title)), 'file checks stay out of the alert queues');
  assert.equal(new Set(d.alerts.map((a: any) => a.id)).size, d.alerts.length);
});

test('a driver sees only their own published, ready trips; positions are labelled as simulation', () => {
  const s = createTransportState();
  const d = snapshot(s, DEMO_DATE, 'driver-10');
  assert.deepEqual(d.trips.map((t: any) => t.number), ['10-1', '10-2', '10-3', '10-4']);
  assert.equal(d.alerts.length, 0);
  assert.equal(d.gps.connected, false);
  assert.equal(snapshot(s, DEMO_DATE, 'driver-14').trips.length, 0, 'bus 14 has an expired test, so nothing is published to its driver');
});

test('reports need a stationary bus, and a short count raises a high alert before anything else', () => {
  const s = createTransportState();
  let t = tripOf(s, 'driver-10', '10-1');
  assert.throws(() => run(s, 'driver-10', 'start', t, {}), /עצירה בטוחה/);
  run(s, 'driver-10', 'start', t, { stationary: true });
  t = tripOf(s, 'driver-10', '10-1');
  run(s, 'driver-10', 'report', t, { stationary: true, stopId: 'stop-1', count: 13 });
  const d = snapshot(s, DEMO_DATE, 'shuki');
  assert.equal(d.alerts[0].kind, 'count');
  assert.equal(d.alerts[0].level, 'high');
  assert.match(d.alerts[0].title, /עלו 13 במקום 15 · 2 חסרים/);
  assert.equal(d.trips.find((x: any) => x.number === '10-1').live.stopCounts['stop-1'].source, 'driver');
});

test('roles are enforced both ways', () => {
  const s = createTransportState();
  const t = tripOf(s, 'shuki', '10-1');
  assert.throws(() => run(s, 'driver-10', 'assign', t, { driverId: 'driver-10', vehicleId: 'bus-10' }), /לסדרנים בלבד/);
  assert.throws(() => run(s, 'shuki', 'report', t, { stationary: true, stopId: 'stop-1', count: 1 }), /מהנהג המשויך בלבד/);
  assert.throws(() => run(s, 'driver-11', 'start', t, { stationary: true }), /אין גישה/);
});

test('the dispatcher fixes an expired bus by swapping it, then publishes', () => {
  const s = createTransportState();
  let t = tripOf(s, 'shuki', '14-1');
  assert.ok(t.blockers.includes('הטסט של הרכב פג'));
  assert.throws(() => run(s, 'shuki', 'publish', t), /הטסט של הרכב פג/);
  run(s, 'shuki', 'assign', t, { driverId: t.driverId, vehicleId: 'bus-spare' });
  t = tripOf(s, 'shuki', '14-1');
  assert.equal(t.published, false);
  run(s, 'shuki', 'publish', t);
  t = tripOf(s, 'shuki', '14-1');
  assert.equal(t.published, true);
  assert.deepEqual(t.issues, []);
  const alert = snapshot(s, DEMO_DATE, 'shuki').alerts.find((a: any) => a.id === 'test-bus-14');
  assert.ok(!alert.tripIds.includes(t.id), 'the swapped trip is no longer blocked by bus 14');
});

test('file checks from the workbook warn but never block publishing or driving', () => {
  const s = createTransportState();
  const d = snapshot(s, DEMO_DATE, 'shuki');
  const flagged = d.trips.find((t: any) => t.checks.length && !t.blockers.length);
  assert.ok(flagged, 'the workbook has flagged trips');
  assert.equal(flagged.published, true);
  assert.equal(flagged.live.blockedReason, null);
});

test('an unknown seat count never blocks a driver report', () => {
  const s = createTransportState();
  const t = tripOf(s, 'shuki', '304-1');
  assert.equal(t.capacity, null);
  run(s, 'driver-304', 'start', t, { stationary: true });
  const t2 = tripOf(s, 'driver-304', '304-1');
  assert.doesNotThrow(() => run(s, 'driver-304', 'report', t2, { stationary: true, stopId: 'stop-1', count: t2.stops[0].planned }));
});

test('the demo clock moves simulated buses; the scenario delay shows while on the road and clears on arrival', () => {
  const s = createTransportState();
  run(s, 'shuki', 'clock', null, { time: '07:30' });
  let d = snapshot(s, DEMO_DATE, 'shuki');
  const delayed = d.trips.find((t: any) => t.number === '12-1');
  assert.equal(delayed.status, 'delayed');
  assert.equal(delayed.live.lateMinutes, 8);
  run(s, 'shuki', 'clock', null, { time: '07:40' });
  d = snapshot(s, DEMO_DATE, 'shuki');
  assert.ok(d.trips.some((t: any) => t.status === 'completed'));
  assert.equal(d.trips.find((t: any) => t.number === '12-1').status, 'completed', 'a bus that delivered everyone is not late');
  assert.ok(!d.alerts.some((a: any) => a.id === `delay-${delayed.id}`), 'and its delay alert is gone');
  assert.equal(d.trips.find((t: any) => t.number === '10-1').status, 'late', 'the presenter trip has not left, so it is late');
});

test('a driver can always finish: fewer drop-offs than on board completes the trip and alerts the dispatcher', () => {
  const s = createTransportState();
  const step = (type: string, data: any) => run(s, 'driver-10', type, tripOf(s, 'driver-10', '10-1'), { stationary: true, ...data });
  step('start', {});
  step('report', { stopId: 'stop-1', count: 15 }); step('depart', { stopId: 'stop-1' });
  step('report', { stopId: 'stop-2', count: 32 }); step('depart', { stopId: 'stop-2' });
  step('report', { stopId: 'school', count: 45 });
  assert.doesNotThrow(() => step('depart', { stopId: 'school' }));
  const d = snapshot(s, DEMO_DATE, 'shuki');
  const t = d.trips.find((x: any) => x.number === '10-1');
  assert.equal(t.phase, 'completed');
  assert.equal(t.unaccounted, 2);
  assert.equal(d.alerts[0].title, 'קו 10: 2 תלמידים לא דווחו כיורדים');
  assert.equal(d.alerts.filter((a: any) => a.tripId === t.id).length, 1, 'one alert for one cause');
});

test('a count can be corrected before leaving the stop, and nothing reports without the stationary confirmation', () => {
  const s = createTransportState();
  const step = (type: string, data: any) => run(s, 'driver-10', type, tripOf(s, 'driver-10', '10-1'), data);
  step('start', { stationary: true });
  step('report', { stationary: true, stopId: 'stop-1', count: 12 });
  step('report', { stationary: true, stopId: 'stop-1', count: 15 });
  const t = tripOf(s, 'driver-10', '10-1');
  assert.equal(t.boarded, 15);
  assert.equal(t.onBoard, 15);
  assert.throws(() => step('depart', { stopId: 'stop-1' }), /עצירה בטוחה/);
  assert.throws(() => step('delay', { minutes: 5 }), /עצירה בטוחה/);
});

test('the assistant finds what stops tomorrow and proposes one approvable fix per cause', async () => {
  const { proposalsFor } = await import('../src/transport/assistant.ts');
  const s = createTransportState();
  const r = proposalsFor(s, '2026-11-09');
  assert.equal(r.date, '2026-11-09');
  const bus = r.proposals.find((p: any) => p.id === 'bus-bus-14');
  const driver = r.proposals.find((p: any) => p.id === 'driver-driver-21');
  assert.ok(bus?.apply && driver?.apply, 'a swap for the expired bus test and for the expired licence');
  assert.match(bus.why, /הטסט של אוטובוס 14 פג/);
  execute(s, 'shuki', { id: `p-${++n}`, type: 'plan', date: '2026-11-09', data: bus.apply });
  execute(s, 'shuki', { id: `p-${++n}`, type: 'plan', date: '2026-11-09', data: driver.apply });
  const d = snapshot(s, '2026-11-09', 'shuki');
  for (const id of [...bus.tripIds, ...driver.tripIds]) {
    const t = d.trips.find((x: any) => x.id === id);
    assert.equal(t.published, true, `${t.number} is published after approval`);
    assert.ok(!t.blockers.some((b: string) => /טסט|רישיון/.test(b)), `${t.number} is no longer blocked`);
  }
  const again = proposalsFor(s, '2026-11-09');
  assert.ok(!again.proposals.some((p: any) => p.id === 'bus-bus-14' || p.id === 'driver-driver-21'), 'fixed causes drop out');
});

test('the assistant reads plain requests: a driver who is out tomorrow, a bus in the garage on a weekday', async () => {
  const { proposalsFor } = await import('../src/transport/assistant.ts');
  const s = createTransportState();
  const out = proposalsFor(s, DEMO_DATE, 'דוד מזרחי לא מגיע מחר');
  assert.equal(out.date, '2026-11-09');
  assert.ok(out.understood);
  const p = out.proposals[0];
  assert.match(p.why, /ביקשת: דוד מזרחי לא מגיע/);
  assert.ok(p.apply.assignments.every((a: any) => a.driverId && a.driverId !== 'driver-10'));
  const garage = proposalsFor(s, DEMO_DATE, 'אוטובוס 15 במוסך ביום שלישי');
  assert.equal(garage.date, '2026-11-10');
  assert.match(garage.proposals[0].title, /אוטובוס 15/);
  const unclear = proposalsFor(s, DEMO_DATE, 'מה נשמע');
  assert.equal(unclear.understood, false);
  assert.match(unclear.summary, /לא הבנתי/);
});

test('a plan is all or nothing: a trip that already left stops the whole change', () => {
  const s = createTransportState();
  run(s, 'shuki', 'clock', null, { time: '07:40' });
  const d = snapshot(s, DEMO_DATE, 'shuki');
  const left = d.trips.find((t: any) => t.status === 'completed');
  const waiting = d.trips.find((t: any) => t.live.phase === 'pending' && t.phase === 'pending' && t.number !== '10-1');
  const before = waiting.vehicleId;
  // simulated trips only "leave" in the simulation; a driver-reported start is a real departure
  const t = tripOf(s, 'driver-10', '10-1');
  run(s, 'driver-10', 'start', t, { stationary: true });
  assert.throws(() => execute(s, 'shuki', { id: `p-${++n}`, type: 'plan', date: DEMO_DATE, data: { assignments: [{ tripId: waiting.id, vehicleId: 'bus-spare' }, { tripId: t.id, vehicleId: 'bus-spare' }], publish: true } }), /כבר יצאה/);
  assert.equal(snapshot(s, DEMO_DATE, 'shuki').trips.find((x: any) => x.id === waiting.id).vehicleId, before, 'nothing changed');
  assert.ok(left);
});

test('only today runs live: tomorrow is a plan in which nothing has left, so every trip can still be changed', () => {
  const s = createTransportState();
  const d = snapshot(s, '2026-11-09', 'shuki');
  assert.ok(d.trips.every((t: any) => t.live.phase === 'pending'));
  const early = d.trips.find((t: any) => t.departure === '06:30');
  assert.ok(early, 'the 06:30 trip exists tomorrow');
  assert.doesNotThrow(() => execute(s, 'shuki', { id: `p-${++n}`, type: 'plan', date: '2026-11-09', data: { assignments: [{ tripId: early.id, vehicleId: 'bus-spare' }], publish: false } }));
});

test('an estimated count never raises a missing-children alert; only a driver report does', () => {
  const s = createTransportState();
  run(s, 'shuki', 'clock', null, { time: '07:40' });
  const d = snapshot(s, DEMO_DATE, 'shuki');
  const scenario = d.trips.find((t: any) => t.number === '19-1');
  assert.ok(Object.values(scenario.live.stopCounts).some((c: any) => c.source === 'simulation' && c.count !== c.expected), 'the timetable estimate differs at כנף');
  assert.ok(!d.alerts.some((a: any) => a.kind === 'count'), 'but no count alert is raised from it');
});

test('a regular crew change applies to every future day still on the old crew, never to today', () => {
  const s = createTransportState();
  snapshot(s, '2026-11-09', 'shuki'); snapshot(s, '2026-11-10', 'shuki');
  execute(s, 'shuki', { id: `p-${++n}`, type: 'template', date: DEMO_DATE, data: { routeCode: '14', vehicleId: 'bus-spare' } });
  for (const date of ['2026-11-09', '2026-11-10', '2026-11-11']) {
    const ts = snapshot(s, date, 'shuki').trips.filter((t: any) => t.routeCode === '14');
    assert.ok(ts.length && ts.every((t: any) => t.vehicleId === 'bus-spare'), `route 14 runs on the spare on ${date}`);
  }
  assert.ok(snapshot(s, DEMO_DATE, 'shuki').trips.filter((t: any) => t.routeCode === '14').every((t: any) => t.vehicleId === 'bus-14'), 'today is untouched');
  assert.equal(snapshot(s, DEMO_DATE, 'shuki').template['14'].vehicleId, 'bus-spare');
});

test('an absence makes a driver unavailable on those dates only, and the assistant moves his rides', async () => {
  const { proposalsFor } = await import('../src/transport/assistant.ts');
  const s = createTransportState();
  execute(s, 'shuki', { id: `p-${++n}`, type: 'driver-save', date: DEMO_DATE, data: { id: 'driver-10', away: [{ from: '2026-11-10', to: '2026-11-10', reason: 'מחלה' }] } });
  const tue = snapshot(s, '2026-11-10', 'shuki').trips.filter((t: any) => t.driverId === 'driver-10');
  assert.ok(tue.every((t: any) => t.blockers.includes('הנהג לא זמין בתאריך הזה')));
  assert.ok(snapshot(s, '2026-11-09', 'shuki').trips.filter((t: any) => t.driverId === 'driver-10').every((t: any) => !t.blockers.length), 'Monday is fine');
  const p = proposalsFor(s, '2026-11-10').proposals.find((x: any) => x.id === 'driver-driver-10');
  assert.ok(p?.apply && /מחלה/.test(p.why));
});

test('drivers and buses can be added, edited and removed; removal blocks their rides', () => {
  const s = createTransportState();
  execute(s, 'shuki', { id: `p-${++n}`, type: 'vehicle-save', date: DEMO_DATE, data: { label: 'אוטובוס 99', registration: '12-345-67', capacity: 60, testUntil: '2027-06-01', serviceDue: '2027-01-01' } });
  const bus = Object.values(s.vehicles).find((v: any) => v.label === 'אוטובוס 99') as any;
  assert.ok(bus && bus.available && bus.capacity === 60);
  assert.throws(() => execute(s, 'shuki', { id: `p-${++n}`, type: 'vehicle-save', date: DEMO_DATE, data: { id: bus.id, capacity: 0 } }), /מקומות/);
  execute(s, 'shuki', { id: `p-${++n}`, type: 'archive', date: DEMO_DATE, data: { kind: 'driver', id: 'driver-12' } });
  const ts = snapshot(s, '2026-11-09', 'shuki').trips.filter((t: any) => t.driverId === 'driver-12');
  assert.ok(ts.length && ts.every((t: any) => t.blockers.includes('הנהג אינו זמין')));
  assert.throws(() => execute(s, 'driver-10', { id: `p-${++n}`, type: 'archive', date: DEMO_DATE, data: { kind: 'driver', id: 'driver-12' } }), /לסדרנים/);
});

test('a ride with too many students splits across two buses, and merges back', () => {
  const s = createTransportState();
  const date = '2026-11-09';
  const view = () => snapshot(s, date, 'shuki');
  const t = view().trips.find((x: any) => x.routeCode === '15' && x.stops.length > 1 && x.planned > (x.capacity ?? 99));
  assert.ok(t, 'a route 15 ride over capacity');
  const before = t.planned;
  const stop = t.stops[0];
  execute(s, 'shuki', { id: 'sp-1', type: 'split', date, tripId: t.id, version: t.version, data: { stopIds: [stop.id], vehicleId: 'bus-spare', driverId: 'driver-spare' } });
  const a = view().trips.find((x: any) => x.id === t.id);
  const b = view().trips.find((x: any) => x.splitFrom === t.id);
  assert.equal(a.planned + b.planned, before);
  assert.equal(b.stops[0].name, stop.name);
  assert.equal(b.driverId, 'driver-spare');
  assert.ok(!a.blockers.some((x: string) => /מקומות/.test(x)), 'the first bus now has enough seats');
  assert.throws(() => execute(s, 'shuki', { id: 'sp-2', type: 'split', date, tripId: a.id, version: a.version, data: { stopIds: a.stops.map((x: any) => x.id), vehicleId: 'bus-spare', driverId: 'driver-spare' } }), /בחרו אילו תחנות/);
  execute(s, 'shuki', { id: 'sp-3', type: 'merge', date, tripId: a.id, version: a.version, data: { fromId: b.id } });
  const m = view().trips.find((x: any) => x.id === t.id);
  assert.equal(m.planned, before);
  assert.ok(!view().trips.some((x: any) => x.splitFrom === t.id));
});

test('a driver confirms a new ride, flags a problem, and marks a day off; the dispatcher sees each', () => {
  const s = createTransportState();
  const date = '2026-11-09';
  const t = snapshot(s, date, 'shuki').trips.find((x: any) => x.driverId === 'driver-21');
  execute(s, 'shuki', { id: 'a-1', type: 'plan', date, data: { assignments: [{ tripId: t.id, driverId: 'driver-spare' }], publish: true, reason: 'מחליף' } });
  const mine = snapshot(s, date, 'driver-spare').trips.find((x: any) => x.id === t.id);
  assert.ok(mine, 'the spare driver sees the new ride');
  execute(s, 'driver-spare', { id: 'a-2', type: 'confirm', date, tripId: t.id, version: mine.version, data: {} });
  const confirmed = snapshot(s, date, 'driver-spare').trips.find((x: any) => x.id === t.id);
  assert.ok(confirmed.confirmed);
  execute(s, 'driver-spare', { id: 'a-3', type: 'concern', date, tripId: t.id, version: confirmed.version, data: { call: true } });
  const inbox = snapshot(s, DEMO_DATE, 'shuki').inbox;
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].call, true);
  assert.equal(snapshot(s, DEMO_DATE, 'driver-spare').inbox.length, 0, 'drivers never see the inbox');
  execute(s, 'driver-spare', { id: 'a-4', type: 'my-away', date: DEMO_DATE, data: { date: '2026-11-10', away: true, reason: 'מחלה' } });
  assert.deepEqual(s.drivers['driver-spare'].away, [{ from: '2026-11-10', to: '2026-11-10', reason: 'מחלה', by: 'driver' }]);
  execute(s, 'driver-spare', { id: 'a-5', type: 'my-away', date: DEMO_DATE, data: { date: '2026-11-10', away: false } });
  assert.deepEqual(s.drivers['driver-spare'].away, []);
  assert.throws(() => execute(s, 'shuki', { id: 'a-6', type: 'my-away', date: DEMO_DATE, data: { date: '2026-11-10', away: true } }), /לנהגים בלבד/);
  const first = snapshot(s, DEMO_DATE, 'shuki').inbox[0];
  execute(s, 'shuki', { id: 'a-7', type: 'inbox-done', date: DEMO_DATE, data: { id: first.id } });
  assert.ok(!snapshot(s, DEMO_DATE, 'shuki').inbox.some((x: any) => x.id === first.id));
});
