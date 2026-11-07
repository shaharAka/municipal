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
  assert.ok(d.alerts.some((a: any) => a.title.includes('הטסט של אוטובוס 14 פג') && /14-1/.test(a.detail)));
  assert.ok(d.alerts.some((a: any) => a.title.includes('רישיון הנהיגה') && /21-1/.test(a.detail)));
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
  assert.ok(t.issues.some((i: string) => /רישוי הרכב/.test(i)));
  assert.throws(() => run(s, 'shuki', 'publish', t), /רישוי הרכב/);
  run(s, 'shuki', 'assign', t, { driverId: t.driverId, vehicleId: 'bus-spare' });
  t = tripOf(s, 'shuki', '14-1');
  assert.equal(t.published, false);
  run(s, 'shuki', 'publish', t);
  t = tripOf(s, 'shuki', '14-1');
  assert.equal(t.published, true);
  assert.deepEqual(t.issues, []);
  const alert = snapshot(s, DEMO_DATE, 'shuki').alerts.find((a: any) => a.id === 'test-bus-14');
  assert.doesNotMatch(alert.detail, /14-1/);
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
  assert.equal(d.alerts[0].title, '10-1: 2 תלמידים לא דווחו כיורדים');
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
