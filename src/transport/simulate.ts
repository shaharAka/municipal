// The live picture for a demo day. Trips driven from the phone during the demo
// are "manual": their phase and counts come only from driver reports. Every
// other trip is moved by the demo clock along its planned times and is marked
// as a simulation, so it is never mistaken for a driver report or a GPS fix.

import places from './places.json' with { type: 'json' };

export type Point = { id: string; name: string; kind: 'stop' | 'school'; time: string | null; planned: number | null; lat: number | null; lng: number | null; located: boolean; accuracy: string | null };

/** Routes driven by the presenter on the phone; everything else is simulated. */
export const MANUAL_ROUTES = new Set(['10']);

/** Scenario overrides, applied only to simulated trips. */
export const SCENARIO = {
  delays: { '12-1': 8 } as Record<string, number>,
  // A count that differs from the plan at one stop, so the mismatch alert is real.
  mismatches: { '19-1': { stop: 'כנף', delta: -3 } } as Record<string, { stop: string; delta: number }>,
};

const minutesOf = (time: string | null | undefined) =>
  typeof time === 'string' && /^\d\d:\d\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;
const timeOf = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

export function placeFor(name: string): { lat: number; lng: number; accuracy: string; source: string } | null {
  const p = places as { places: Record<string, any>; aliases: Record<string, string>; schools: Record<string, string> };
  const key = p.places[name] ? name : p.aliases[name] ?? p.schools[name];
  const hit = key ? p.places[key] : null;
  return hit ? { lat: hit.lat, lng: hit.lng, accuracy: hit.accuracy, source: hit.source } : null;
}

/** Ordered points in driving order, with planned times (estimated where the workbook has none). */
export function pointsFor(trip: any): Point[] {
  const stop = (s: any): Point => {
    const at = placeFor(s.name);
    return { id: s.id, name: s.name, kind: 'stop', time: s.time ?? null, planned: s.planned ?? null, lat: at?.lat ?? null, lng: at?.lng ?? null, located: Boolean(at), accuracy: at?.accuracy ?? null };
  };
  const school = (time: string | null): Point => {
    const at = placeFor(trip.school);
    return { id: 'school', name: trip.school, kind: 'school', time, planned: null, lat: at?.lat ?? null, lng: at?.lng ?? null, located: Boolean(at), accuracy: at?.accuracy ?? null };
  };
  const stops = trip.stops.map(stop);
  // Afternoon rows often repeat the departure time at every stop; space them so a bus can move.
  const spaced = (list: Point[], start: number) => {
    let previous = start;
    return list.map(p => {
      let m = minutesOf(p.time);
      if (!Number.isFinite(m) || m <= previous) m = previous + 8;
      previous = m;
      return { ...p, time: timeOf(m) };
    });
  };
  if (trip.direction === 'morning') {
    const timed = spaced(stops, minutesOf(trip.departure) - 1);
    const last = minutesOf(timed.at(-1)?.time ?? trip.departure);
    return [...timed, school(timeOf(last + 12))];
  }
  const start = minutesOf(trip.departure);
  return [school(trip.departure), ...spaced(stops, start)];
}

export type Live = {
  mode: 'manual' | 'simulation';
  phase: 'pending' | 'active' | 'completed';
  status: 'upcoming' | 'blocked' | 'late' | 'active' | 'delayed' | 'completed';
  lateMinutes: number;
  blockedReason: string | null;
  departedIndex: number; // last point left behind; -1 before the start
  fraction: number; // progress from departedIndex to the next point
  position: { lat: number; lng: number } | null;
  positionSource: 'simulation' | null;
  boarded: number | null;
  stopCounts: Record<string, { count: number; expected: number | null; source: 'driver' | 'simulation'; kind?: 'pickup' | 'dropoff' }>;
};

const at = (points: Point[], i: number, f: number) => {
  const a = points[Math.max(0, i)], b = points[Math.min(points.length - 1, i + 1)];
  if (a?.lat == null || a?.lng == null) return null;
  if (b?.lat == null || b?.lng == null || f <= 0) return { lat: a.lat, lng: a.lng };
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
};

/** Issues that legally stop a bus from running (as opposed to planning-data questions). */
export const FLEET_CAUSE = /רישיון|רישוי|טיפול|זמין|חסר שיבוץ/;

export function liveFor(trip: any, clock: string, blockedReason: string | null = null): Live {
  const points = pointsFor(trip);
  const now = minutesOf(clock);
  // A blocked trip never moves: no driver can take it until a dispatcher fixes and publishes it.
  if (blockedReason && trip.phase === 'pending') {
    const lateMinutes = Math.max(0, now - minutesOf(trip.departure));
    return { mode: 'simulation', phase: 'pending', status: lateMinutes > 0 ? 'late' : 'blocked', lateMinutes, blockedReason, departedIndex: -1, fraction: 0, position: null, positionSource: null, boarded: null, stopCounts: {} };
  }
  const manual = MANUAL_ROUTES.has(String(trip.routeCode)) || Object.values(trip.reports ?? {}).some((r: any) => r.source === 'driver') || trip.phase !== 'pending';
  if (manual) {
    const departedIndex = points.reduce((last, p, i) => (trip.departures.includes(p.id) ? i : last), -1);
    const next = points[departedIndex + 1];
    const from = departedIndex >= 0 ? minutesOf(points[departedIndex].time) : minutesOf(trip.departure);
    const to = next ? minutesOf(next.time) : from;
    const fraction = trip.phase === 'active' && next && to > from ? Math.min(0.9, Math.max(0, (now - from) / (to - from))) : 0;
    const lateStart = trip.phase === 'pending' ? Math.max(0, now - minutesOf(trip.departure)) : 0;
    const lateRunning = trip.phase === 'active' && next ? Math.max(0, now - to - 4) : 0;
    const lateMinutes = Math.max(trip.delayMinutes || 0, lateStart > 3 ? lateStart : 0, lateRunning);
    const stopCounts: Live['stopCounts'] = {};
    for (const [id, r] of Object.entries(trip.reports ?? {}) as [string, any][]) stopCounts[id] = { count: r.count, expected: r.expected ?? null, source: 'driver', kind: r.kind };
    return {
      mode: 'manual', phase: trip.phase, lateMinutes, blockedReason: null,
      status: trip.phase === 'completed' ? 'completed' : lateMinutes ? (trip.phase === 'active' ? 'delayed' : 'late') : trip.phase === 'active' ? 'active' : 'upcoming',
      departedIndex, fraction, position: trip.phase === 'pending' && lateStart <= 0 && now < minutesOf(trip.departure) - 30 ? null : trip.phase === 'completed' ? null : at(points, departedIndex < 0 ? 0 : departedIndex, fraction),
      positionSource: 'simulation', boarded: trip.boarded, stopCounts,
    };
  }
  const delay = SCENARIO.delays[trip.number] ?? 0;
  const times = points.map(p => minutesOf(p.time) + delay);
  const mismatch = SCENARIO.mismatches[trip.number];
  const stopCounts: Live['stopCounts'] = {};
  let boarded = 0;
  let departedIndex = -1;
  points.forEach((p, i) => {
    if (now >= times[i]) {
      departedIndex = i;
      if (p.kind === 'stop' && p.planned != null) {
        const count = Math.max(0, p.planned + (mismatch && mismatch.stop === p.name ? mismatch.delta : 0));
        stopCounts[p.id] = { count, expected: p.planned, source: 'simulation' };
        boarded += trip.direction === 'morning' ? count : 0;
      }
    }
  });
  const completed = now >= times[times.length - 1] + 3;
  const phase: Live['phase'] = departedIndex < 0 ? 'pending' : completed ? 'completed' : 'active';
  const next = departedIndex + 1;
  const fraction = phase === 'active' && next < times.length ? Math.min(1, Math.max(0, (now - times[departedIndex]) / Math.max(1, times[next] - times[departedIndex]))) : 0;
  const soon = phase === 'pending' && now >= times[0] - 10;
  const recent = phase === 'completed' && now <= times[times.length - 1] + 15;
  return {
    mode: 'simulation', phase, blockedReason: null, lateMinutes: delay && phase !== 'completed' && now >= minutesOf(points[0].time) ? delay : 0,
    status: phase === 'completed' ? 'completed' : delay && now >= minutesOf(points[0].time) ? (phase === 'active' ? 'delayed' : 'late') : phase === 'active' ? 'active' : 'upcoming',
    departedIndex, fraction,
    position: phase === 'active' || recent || soon ? at(points, Math.max(0, departedIndex), fraction) : null,
    positionSource: 'simulation',
    boarded: trip.direction === 'morning' ? (departedIndex >= 0 ? boarded : null) : departedIndex >= 0 ? trip.planned : null,
    stopCounts,
  };
}

export type Alert = {
  id: string; queue: 'road' | 'prep'; level: 'high' | 'medium' | 'low'; kind: string;
  tripId?: string; entityId?: string; title: string; detail: string;
  call?: { name: string; phone: string } | null;
  handled?: { by: string; at: string; note: string } | null;
};

const DAY = 86_400_000;

/**
 * What needs a dispatcher, in two queues: "road" is what is happening to children
 * now; "prep" is what can still be fixed before a bus leaves. One alert per cause.
 */
export function alertsFor(trips: any[], drivers: any[], vehicles: any[], date: string, clock: string, acks: Record<string, any> = {}): Alert[] {
  const alerts: Alert[] = [];
  const now = minutesOf(clock);
  const driverOf = (t: any) => drivers.find(d => d.id === t.driverId);
  const call = (t: any) => { const d = driverOf(t); return d?.contact ? { name: d.name, phone: d.contact } : null; };
  const list = (ts: any[]) => ts.slice(0, 4).map(t => t.number).join(', ') + (ts.length > 4 ? ` ועוד ${ts.length - 4}` : '');

  // ---- road: children and buses on the move
  for (const t of trips) {
    const label = `${t.school}`;
    if (t.live.status === 'late' && t.live.blockedReason) alerts.push({ id: `blocked-${t.id}`, queue: 'road', level: 'high', kind: 'late', tripId: t.id, title: `${t.number} לא יצאה · חסומה`, detail: `${t.live.blockedReason} · ${label}`, call: null });
    else if (t.live.status === 'late') alerts.push({ id: `late-${t.id}`, queue: 'road', level: 'high', kind: 'late', tripId: t.id, title: `${t.number} לא יצאה · ${t.live.lateMinutes} דק׳`, detail: label, call: call(t) });
    else if (t.live.status === 'delayed') alerts.push({ id: `delay-${t.id}`, queue: 'road', level: 'high', kind: 'delay', tripId: t.id, title: `${t.number} מאחרת ${t.live.lateMinutes} דק׳`, detail: label, call: call(t) });
    if (t.unaccounted) alerts.push({ id: `unaccounted-${t.id}`, queue: 'road', level: 'high', kind: 'count', tripId: t.id, title: `${t.number}: ${t.unaccounted} תלמידים לא דווחו כיורדים`, detail: `${label} · דיווח נהג`, call: call(t) });
    const off = Object.entries(t.live.stopCounts).filter(([id, c]: any) => c.expected != null && c.count !== c.expected && !(t.unaccounted && (id === 'school' || c.kind === 'dropoff'))) as [string, any][];
    if (off.length) {
      const [id, c] = off[0];
      const name = t.stops.find((x: any) => x.id === id)?.name ?? '';
      const fewer = c.count < c.expected;
      const verb = (c.kind ?? (t.direction === 'morning' ? 'pickup' : 'dropoff')) === 'pickup' ? 'עלו' : 'ירדו';
      alerts.push({ id: `count-${t.id}`, queue: 'road', level: fewer && c.source === 'driver' ? 'high' : 'medium', kind: 'count', tripId: t.id, title: `${t.number}: ${verb} ${c.count} במקום ${c.expected}${fewer ? ` · ${c.expected - c.count} חסרים` : ''}`, detail: `${name}${c.source === 'driver' ? ' · דיווח נהג' : ''}`, call: call(t) });
    }
    if (t.live.phase === 'active' && t.capacity != null && t.planned > t.capacity) alerts.push({ id: `seats-${t.id}`, queue: 'road', level: 'high', kind: 'seats', tripId: t.id, title: `${t.number} בדרך עם ${t.planned} מתוכננים ל־${t.capacity} מקומות`, detail: label, call: call(t) });
  }

  // ---- prep: what can still be fixed before a bus leaves
  const byIssue = new Map<string, any[]>();
  for (const t of trips) {
    for (const issue of t.issues) {
      if (FLEET_CAUSE.test(issue)) continue;
      const seats = /מקומות/.test(issue);
      if (seats && t.live.phase !== 'pending') continue; // on the road it is a road alert
      const key = seats ? 'מתוכננים יותר תלמידים ממקומות ברכב' : /כמויות|מספר התלמידים/.test(issue) ? 'כמויות תלמידים לא מאומתות בקובץ' : issue;
      const seen = byIssue.get(key) ?? [];
      if (!seen.includes(t)) byIssue.set(key, [...seen, t]);
    }
  }
  for (const [issue, ts] of byIssue) {
    alerts.push({ id: `issue-${issue}`, queue: 'prep', level: /מקומות/.test(issue) ? 'high' : 'medium', kind: 'ready', tripId: ts[0].id, title: ts.length === 1 ? `${ts[0].number}: ${issue}` : `${issue} · ${ts.length} נסיעות`, detail: list(ts) });
  }
  const unpublished = trips.filter(t => t.live.phase === 'pending' && !t.published && !t.issues.length && minutesOf(t.departure) - now <= 120);
  if (unpublished.length) alerts.push({ id: 'unpublished', queue: 'prep', level: 'medium', kind: 'publish', tripId: unpublished[0].id, title: `${unpublished.length} נסיעות לא פורסמו לנהג`, detail: list(unpublished) });
  const today = Date.parse(date);
  const days = (d: string) => Math.round((Date.parse(d) - today) / DAY);
  const waiting = (field: string, id: string) => trips.filter(t => t[field] === id && t.live.phase === 'pending');
  for (const d of drivers) if (d.licenseUntil && days(d.licenseUntil) < 0) {
    const ts = waiting('driverId', d.id);
    alerts.push({ id: `lic-${d.id}`, queue: 'prep', level: 'high', kind: 'fleet', entityId: d.id, tripId: ts[0]?.id, title: `רישיון הנהיגה של ${d.name} פג`, detail: ts.length ? `חוסם ${ts.length} נסיעות היום: ${list(ts)}` : `פג ב־${d.licenseUntil.split('-').reverse().join('.')}` });
  }
  for (const v of vehicles) {
    if (v.testUntil && days(v.testUntil) < 0) {
      const ts = waiting('vehicleId', v.id);
      alerts.push({ id: `test-${v.id}`, queue: 'prep', level: 'high', kind: 'fleet', entityId: v.id, tripId: ts[0]?.id, title: `הטסט של ${v.label} פג`, detail: ts.length ? `חוסם ${ts.length} נסיעות היום: ${list(ts)}` : `פג ב־${v.testUntil.split('-').reverse().join('.')}` });
    } else if (v.serviceDue && days(v.serviceDue) <= 7) alerts.push({ id: `svc-${v.id}`, queue: 'prep', level: 'low', kind: 'fleet', entityId: v.id, title: `טיפול ל${v.label} בעוד ${Math.max(0, days(v.serviceDue))} ימים`, detail: v.serviceDue.split('-').reverse().join('.') });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return alerts
    .map(a => ({ ...a, handled: acks[a.id] ?? null }))
    .sort((a, b) => rank[a.level] - rank[b.level]);
}
