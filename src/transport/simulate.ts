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
export const FLEET_CAUSE = /רישיון|טסט|טיפול|זמין|חסר שיבוץ/;

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
  // Arrival at the last point is completion: a bus that has delivered everyone is never "late".
  const completed = now >= times[times.length - 1];
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
  tripId?: string; tripIds?: string[]; entityId?: string; title: string; detail: string;
  /** Lower is more urgent for children: missing children first, a bus that never came, a late bus, then paperwork. */
  risk: number;
  call?: { name: string; phone: string } | null;
  /** A cause that one replacement fixes for every trip it blocks. */
  fix?: { kind: 'bus' | 'driver'; id: string } | null;
  handled?: { by: string; at: string; note: string } | null;
};

const DAY = 86_400_000;

/**
 * What needs a dispatcher, in two queues: "road" is what is happening to children
 * now; "prep" is what can still be fixed before a bus leaves. One alert per cause.
 */
export function alertsFor(trips: any[], drivers: any[], vehicles: any[], date: string, clock: string, acks: Record<string, any> = {}): Alert[] {
  const alerts: Alert[] = [];
  const driverOf = (t: any) => drivers.find(d => d.id === t.driverId);
  const busOf = (t: any) => vehicles.find(v => v.id === t.vehicleId);
  const call = (t: any) => { const d = driverOf(t); return d?.contact ? { name: d.name, phone: d.contact } : null; };
  const line = (t: any) => `קו ${t.routeCode}`;
  const lines = (ts: any[]) => { const codes = [...new Set(ts.map(t => t.routeCode))]; return `${codes.length === 1 ? 'קו' : 'קווים'} ${codes.slice(0, 4).join(', ')}${codes.length > 4 ? ` ועוד ${codes.length - 4}` : ''}`; };
  const who = (t: any) => [t.school, driverOf(t)?.name].filter(Boolean).join(' · ');
  const notYet = (t: any) => t.live.phase === 'pending' && t.live.status !== 'late';
  const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).map(Number).join('.');

  // ---- road: children and buses on the move, by risk to children
  const blocked = new Map<string, { title: string; trips: any[]; fix: Alert['fix'] }>();
  for (const t of trips) {
    if (t.live.status === 'late' && t.live.blockedReason) {
      const r = t.live.blockedReason, bus = busOf(t), drv = driverOf(t);
      const [key, title, fix]: [string, string, Alert['fix']] =
        /טסט|טיפול|הרכב/.test(r) && bus ? [`bus-${bus.id}`, r === 'הטסט של הרכב פג' ? `הטסט של ${bus.label} פג` : `${bus.label}: ${r}`, { kind: 'bus', id: bus.id }]
        : /רישיון|הנהג/.test(r) && drv ? [`driver-${drv.id}`, r === 'הרישיון של הנהג פג' ? `הרישיון של ${drv.name} פג` : `${drv.name}: ${r}`, { kind: 'driver', id: drv.id }]
        : [`reason-${r}`, r, null];
      const group = blocked.get(key) ?? { title, trips: [], fix };
      group.trips.push(t); blocked.set(key, group);
      continue;
    }
    if (t.live.status === 'late') alerts.push({ id: `late-${t.id}`, queue: 'road', level: 'high', risk: 1, kind: 'late', tripId: t.id, title: `${line(t)} לא יצא · ${t.live.lateMinutes} דק׳ איחור`, detail: who(t), call: call(t) });
    else if (t.live.status === 'delayed') alerts.push({ id: `delay-${t.id}`, queue: 'road', level: 'high', risk: 2, kind: 'delay', tripId: t.id, title: `${line(t)} מאחר ${t.live.lateMinutes} דק׳`, detail: who(t), call: call(t) });
    if (t.unaccounted) alerts.push({ id: `unaccounted-${t.id}`, queue: 'road', level: 'high', risk: 0, kind: 'count', tripId: t.id, title: `${line(t)}: ${t.unaccounted} תלמידים לא דווחו כיורדים`, detail: `${t.school} · דיווח נהג`, call: call(t) });
    // Only a count the driver reported can say children are missing; an estimate never raises this alert.
    const off = Object.entries(t.live.stopCounts).filter(([id, c]: any) => c.source === 'driver' && c.expected != null && c.count !== c.expected && !(t.unaccounted && (id === 'school' || c.kind === 'dropoff'))) as [string, any][];
    if (off.length) {
      const [id, c] = off[0];
      const name = t.stops.find((x: any) => x.id === id)?.name ?? '';
      const fewer = c.count < c.expected;
      const verb = (c.kind ?? (t.direction === 'morning' ? 'pickup' : 'dropoff')) === 'pickup' ? 'עלו' : 'ירדו';
      alerts.push({ id: `count-${t.id}`, queue: 'road', level: fewer ? 'high' : 'medium', risk: fewer ? 0 : 4, kind: 'count', tripId: t.id, title: `${line(t)}: ${verb} ${c.count} במקום ${c.expected}${fewer ? ` · ${c.expected - c.count} חסרים` : ''}`, detail: [name, t.school, c.source === 'driver' ? 'דיווח נהג' : ''].filter(Boolean).join(' · '), call: call(t) });
    }
    if (t.live.phase === 'active' && t.capacity != null && t.planned > t.capacity) alerts.push({ id: `seats-${t.id}`, queue: 'road', level: 'high', risk: 3, kind: 'seats', tripId: t.id, title: `${line(t)} בדרך עם ${t.planned} תלמידים ל־${t.capacity} מקומות`, detail: who(t), call: call(t) });
  }
  for (const [key, g] of blocked) {
    const n = g.trips.length;
    alerts.push({ id: `blocked-${key}`, queue: 'road', level: 'high', risk: 5, kind: 'blocked', tripId: g.trips[0].id, tripIds: g.trips.map(t => t.id), title: `${n === 1 ? `${line(g.trips[0])} לא יצא` : `${n} נסיעות לא יצאו`} · ${g.title}`, detail: n === 1 ? g.trips[0].school : lines(g.trips), call: null, fix: g.fix });
  }

  // ---- prep: what still blocks a trip that has not left yet (file checks live in the schedule, not here)
  const seats = trips.filter(t => notYet(t) && (t.blockers ?? []).some((i: string) => /מקומות/.test(i)));
  if (seats.length) alerts.push({ id: 'prep-seats', queue: 'prep', level: 'high', risk: 6, kind: 'ready', tripId: seats[0].id, tripIds: seats.map(t => t.id), title: `${seats.length === 1 ? `${line(seats[0])} מתוכנן` : `${seats.length} נסיעות מתוכננות`} ליותר תלמידים ממקומות ברכב`, detail: lines(seats) });
  const other = trips.filter(t => notYet(t) && (t.blockers ?? []).some((i: string) => !FLEET_CAUSE.test(i) && !/מקומות/.test(i)));
  if (other.length) alerts.push({ id: 'prep-other', queue: 'prep', level: 'high', risk: 6, kind: 'ready', tripId: other[0].id, tripIds: other.map(t => t.id), title: `${other.length === 1 ? `${line(other[0])} לא מוכן` : `${other.length} נסיעות לא מוכנות`} ליציאה`, detail: lines(other) });
  const unpublished = trips.filter(t => notYet(t) && !t.published && !(t.blockers ?? []).length);
  if (unpublished.length) alerts.push({ id: 'unpublished', queue: 'prep', level: 'medium', risk: 7, kind: 'publish', tripId: unpublished[0].id, tripIds: unpublished.map(t => t.id), title: `${unpublished.length === 1 ? `${line(unpublished[0])} לא פורסם` : `${unpublished.length} נסיעות לא פורסמו`} לנהג`, detail: lines(unpublished) });
  const today = Date.parse(date);
  const days = (d: string) => Math.round((Date.parse(d) - today) / DAY);
  const late = (field: string, id: string) => trips.some(t => t[field] === id && t.live.status === 'late');
  for (const d of drivers) if (d.licenseUntil && days(d.licenseUntil) < 0) {
    const ts = trips.filter(t => t.driverId === d.id && notYet(t));
    if (!ts.length && late('driverId', d.id)) continue; // already on the road list
    alerts.push({ id: `lic-${d.id}`, queue: 'prep', level: ts.length ? 'high' : 'medium', risk: 6, kind: 'fleet', entityId: d.id, tripId: ts[0]?.id, tripIds: ts.map(t => t.id), title: `הרישיון של ${d.name} פג`, detail: ts.length ? `${ts.length} נסיעות היום עוד לא יצאו · ${lines(ts)}` : `פג ב־${ddmm(d.licenseUntil)}`, fix: { kind: 'driver', id: d.id } });
  }
  for (const v of vehicles) {
    if (v.testUntil && days(v.testUntil) < 0) {
      const ts = trips.filter(t => t.vehicleId === v.id && notYet(t));
      if (!ts.length && late('vehicleId', v.id)) continue;
      alerts.push({ id: `test-${v.id}`, queue: 'prep', level: ts.length ? 'high' : 'medium', risk: 6, kind: 'fleet', entityId: v.id, tripId: ts[0]?.id, tripIds: ts.map(t => t.id), title: `הטסט של ${v.label} פג`, detail: ts.length ? `${ts.length} נסיעות היום עוד לא יצאו · ${lines(ts)}` : `פג ב־${ddmm(v.testUntil)}`, fix: { kind: 'bus', id: v.id } });
    } else if (v.serviceDue && days(v.serviceDue) <= 7) alerts.push({ id: `svc-${v.id}`, queue: 'prep', level: 'low', risk: 8, kind: 'fleet', entityId: v.id, title: `${v.label} צריך טיפול בעוד ${Math.max(0, days(v.serviceDue))} ימים`, detail: `עד ${ddmm(v.serviceDue)}` });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return alerts
    .map(a => ({ ...a, handled: acks[a.id] ?? null }))
    .sort((a, b) => a.risk - b.risk || rank[a.level] - rank[b.level]);
}
