// The planning assistant: reads a day's schedule, finds what would stop a trip, and proposes
// concrete changes with the reason for each. It only proposes; a dispatcher approves, and the
// approval runs the engine's `plan` command. Requests in plain Hebrew ("דוד לא מגיע מחר",
// "אוטובוס 15 במוסך ביום שלישי") are read by Claude when ANTHROPIC_API_KEY is set, and by simple
// rules otherwise. Either way Claude only reads the request; the planner decides, and a person approves.
import { dayFor, tripView, weekday, minutes, DAYS, DEMO_DATE } from './engine.ts';
import { pointsFor } from './simulate.ts';

export type Proposal = {
  id: string;
  tone: 'fix' | 'info';
  title: string;
  why: string;
  changes: string[];
  tripIds: string[];
  apply: { assignments: { tripId: string; driverId?: string; vehicleId?: string }[]; publish: boolean; reason: string } | null;
  open: { view: 'fleet' | 'checks' | 'trip'; id?: string } | null;
};

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(Date.parse(date) + n * DAY_MS);
const ddmm = (date: string) => date.split('-').reverse().slice(0, 2).map(Number).join('.');
const dmy = (date: string) => date.split('-').reverse().map(Number).join('.');
const dayName = (date: string) => `יום ${DAYS[weekday(date)]} ${ddmm(date)}`;
const unavailableDriver = /לא מגיע|לא יגיע|חולה|בחופש|לא זמין|לא יכול|נעדר|במילואים/;
const unavailableBus = /מוסך|תקול|תקלה|לא זמין|בטיפול|מושבת|התקלקל/;

type Intent = ReturnType<typeof parseAsk> & { readBy?: 'claude' | 'rules' };

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['driver-out', 'bus-out', 'check', 'unclear'] },
    driverName: { type: ['string', 'null'] },
    busLabel: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
  },
  required: ['kind', 'driverName', 'busLabel', 'date'],
  additionalProperties: false,
};

/**
 * Reads a dispatcher's request with Claude: who or what is out, and on which day. Returns null when
 * there is no key, the SDK is missing, or the call fails, so the rules in `parseAsk` take over.
 */
export async function understand(state: any, baseDate: string, ask: string): Promise<Intent | null> {
  const text = String(ask || '').trim().slice(0, 300);
  if (!text || !process.env.ANTHROPIC_API_KEY) return null;
  let Anthropic: any;
  try { Anthropic = (await import('@anthropic-ai/sdk')).default; } catch { return null; }
  const drivers = Object.values(state.drivers) as any[];
  const vehicles = Object.values(state.vehicles) as any[];
  const sunday = addDays(DEMO_DATE, -weekday(DEMO_DATE));
  const week = DAYS.slice(0, 6).map((name, i) => `${name}: ${addDays(sunday, i)}`).join(', ');
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: INTENT_SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        'You read requests from a school-transport dispatcher at the Golan Regional Council, written in Hebrew.',
        'Return what the request says: a driver who cannot work (kind "driver-out"), a bus that cannot run (kind "bus-out"), a request to check the schedule (kind "check"), or "unclear".',
        'Use exactly one name from the lists below, or null. Dates are YYYY-MM-DD; "היום" is today, "מחר" is tomorrow, and a weekday name means that day this week. Use null when no day is given.',
        `Today: ${DEMO_DATE} (יום ${DAYS[weekday(DEMO_DATE)]}). This week: ${week}.`,
        `Drivers: ${drivers.map(d => d.name).join(', ')}.`,
        `Buses: ${vehicles.map(v => v.label).join(', ')}.`,
      ].join('\n'),
      messages: [{ role: 'user', content: text }],
    }, { timeout: 15_000, maxRetries: 1 });
    if (response.stop_reason === 'refusal') return null;
    const block = response.content.find((b: any) => b.type === 'text');
    const read = JSON.parse(block?.text ?? '{}');
    const driver = drivers.find(d => d.name === read.driverName) ?? null;
    const bus = vehicles.find(v => v.label === read.busLabel) ?? null;
    const date = typeof read.date === 'string' && DAYS.some((_, i) => addDays(sunday, i) === read.date) ? read.date : baseDate;
    const kind = read.kind === 'driver-out' && driver ? 'driver-out' : read.kind === 'bus-out' && bus ? 'bus-out' : 'check';
    return { date, driver, bus, kind, understood: read.kind !== 'unclear', text, readBy: 'claude' };
  } catch {
    return null;
  }
}

/** Reads a request in plain Hebrew. Returns what it understood, so the answer can say it back. */
export function parseAsk(state: any, baseDate: string, ask: string) {
  const text = String(ask || '').trim().slice(0, 300);
  const out: { date: string; driver: any; bus: any; kind: 'check' | 'driver-out' | 'bus-out'; understood: boolean; text: string } =
    { date: baseDate, driver: null, bus: null, kind: 'check', understood: !text, text };
  if (!text) return out;
  if (/מחר/.test(text)) out.date = addDays(DEMO_DATE, 1);
  else if (/היום/.test(text)) out.date = DEMO_DATE;
  const named = text.match(/(?:^|[\s,ב])(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי)(?=$|[\s?.!,])/);
  if (named) {
    const sunday = addDays(DEMO_DATE, -weekday(DEMO_DATE));
    out.date = addDays(sunday, DAYS.indexOf(named[1]));
  }
  const drivers = Object.values(state.drivers) as any[];
  out.driver = drivers.find(d => text.includes(d.name))
    ?? drivers.find(d => { const first = d.name.split(' ')[0]; return new RegExp(`(^|\\s)${first}(\\s|$)`).test(text) && drivers.filter(x => x.name.split(' ')[0] === first).length === 1; })
    ?? null;
  const busMatch = text.match(/(?:אוטובוס|רכב)\s*(\S+)/);
  if (busMatch) out.bus = (Object.values(state.vehicles) as any[]).find(v => v.label === `אוטובוס ${busMatch[1]}`) ?? null;
  const route = text.match(/קו\s*(\d+)/)?.[1];
  if (route && !out.driver && /נהג/.test(text)) out.driver = drivers.find(d => d.routeCode === route) ?? null;
  if (route && !out.bus && /אוטובוס|רכב/.test(text)) out.bus = state.vehicles[`bus-${route}`] ?? null;
  if (out.driver && unavailableDriver.test(text)) out.kind = 'driver-out';
  else if (out.bus && unavailableBus.test(text)) out.kind = 'bus-out';
  out.understood = out.kind !== 'check' || /מה חסר|בדיק|לבדוק|מוכן|בעי|לסדר|סידור/.test(text) || out.date !== baseDate;
  return out;
}

/** What to change on a day so every trip can run, each with its reason. */
export function proposalsFor(state: any, baseDate: string, ask = '', read: Intent | null = null) {
  const intent: Intent = read ?? { ...parseAsk(state, baseDate, ask), readBy: 'rules' };
  const date = intent.date;
  const day = dayFor(state, date);
  const views = day.trips.map((t: any) => tripView(state, t, date === DEMO_DATE ? day.clock : '00:00'));
  const open = views.filter((t: any) => t.phase === 'pending' && t.live.phase === 'pending');
  const span = (t: any): [number, number] => { const ms = pointsFor(t).map(p => minutes(p.time ?? '')).filter(m => m >= 0); return ms.length ? [Math.min(...ms), Math.max(...ms)] : [minutes(t.departure), minutes(t.departure) + 45]; };
  const windows = new Map<string, [number, number]>(views.map((t: any) => [t.id, span(t)]));
  const busy: Record<string, [number, number][]> = {};
  const book = (key: string, w: [number, number]) => { (busy[key] ??= []).push(w); };
  const free = (key: string, w: [number, number]) => !(busy[key] ?? []).some(x => x[0] < w[1] + 10 && w[0] < x[1] + 10);
  for (const t of views) { book(`d:${t.driverId}`, windows.get(t.id)!); book(`v:${t.vehicleId}`, windows.get(t.id)!); }
  const tripsOf = (field: string, id: string) => views.filter((t: any) => t[field] === id).length;
  const line = (t: any) => `קו ${t.routeCode} (${t.departure})`;
  const proposals: Proposal[] = [];
  const handled = new Set<string>();

  const drivers = (Object.values(state.drivers) as any[]);
  const vehicles = (Object.values(state.vehicles) as any[]);
  const okDriver = (d: any) => d.available !== false && d.licenseUntil >= date;
  const okBus = (v: any, seats = 0) => v.available !== false && v.testUntil >= date && v.serviceDue >= date && (seats ? v.capacity != null && v.capacity >= seats : true);
  const pickDriver = (ts: any[], not: string) => drivers
    .filter(d => d.id !== not && okDriver(d) && ts.every(t => free(`d:${d.id}`, windows.get(t.id)!)))
    .sort((a, b) => Number(Boolean(a.routeCode)) - Number(Boolean(b.routeCode)) || tripsOf('driverId', a.id) - tripsOf('driverId', b.id))[0];
  const pickBus = (ts: any[], not: string) => { const seats = Math.max(...ts.map(t => t.planned || 0)); return vehicles
    .filter(v => v.id !== not && okBus(v) && (v.capacity == null || v.capacity >= seats) && ts.every(t => free(`v:${v.id}`, windows.get(t.id)!)))
    .sort((a, b) => Number(a.id !== 'bus-spare') - Number(b.id !== 'bus-spare') || Number(a.capacity == null) - Number(b.capacity == null) || (a.capacity ?? 99) - (b.capacity ?? 99))[0]; };

  const driverOut = (d: any, ts: any[], cause: string) => {
    if (!ts.length) return;
    const to = pickDriver(ts, d.id);
    ts.forEach(t => handled.add(t.id));
    if (!to) { proposals.push({ id: `driver-${d.id}`, tone: 'info', title: `אין נהג פנוי במקום ${d.name}`, why: `${cause} אף נהג עם רישיון בתוקף לא פנוי בשעות של ${ts.map(line).join(', ')}.`, changes: [], tripIds: ts.map(t => t.id), apply: null, open: { view: 'trip', id: ts[0].id } }); return; }
    ts.forEach(t => book(`d:${to.id}`, windows.get(t.id)!));
    proposals.push({
      id: `driver-${d.id}`, tone: 'fix',
      title: ts.length === 1 ? `להעביר את ${line(ts[0])} ל${to.name}` : `להעביר את ${ts.length} הנסיעות של ${d.name} ל${to.name}`,
      why: `${cause} ${to.name} ${to.routeCode ? '' : 'הוא נהג חלופי, '}פנוי בשעות האלה, והרישיון שלו בתוקף עד ${dmy(to.licenseUntil)}.`,
      changes: ts.map(t => `${line(t)} · ${d.name} ← ${to.name}`), tripIds: ts.map(t => t.id),
      apply: { assignments: ts.map(t => ({ tripId: t.id, driverId: to.id })), publish: true, reason: `הועבר ל${to.name}: ${cause}` }, open: null,
    });
  };
  const busOut = (v: any, ts: any[], cause: string) => {
    if (!ts.length) return;
    const to = pickBus(ts, v.id);
    ts.forEach(t => handled.add(t.id));
    if (!to) { proposals.push({ id: `bus-${v.id}`, tone: 'info', title: `אין רכב פנוי במקום ${v.label}`, why: `${cause} אין רכב תקין ופנוי בשעות של ${ts.map(line).join(', ')}. אפשר לבקש רכב מקבלן.`, changes: [], tripIds: ts.map(t => t.id), apply: null, open: { view: 'trip', id: ts[0].id } }); return; }
    ts.forEach(t => book(`v:${to.id}`, windows.get(t.id)!));
    proposals.push({
      id: `bus-${v.id}`, tone: 'fix',
      title: ts.length === 1 ? `להחליף את ${v.label} ב${to.label} ב${line(ts[0])}` : `להחליף את ${v.label} ב${to.label} ב־${ts.length} נסיעות`,
      why: `${cause} ל${to.label} ${to.capacity ? `${to.capacity} מקומות` : 'מספר מקומות לא ידוע'}, הטסט שלו בתוקף עד ${dmy(to.testUntil)}, והוא פנוי בשעות האלה.`,
      changes: ts.map(t => `${line(t)} · ${v.label} ← ${to.label}`), tripIds: ts.map(t => t.id),
      apply: { assignments: ts.map(t => ({ tripId: t.id, vehicleId: to.id })), publish: true, reason: `הוחלף ל${to.label}: ${cause}` }, open: null,
    });
  };

  // What the dispatcher asked for comes first.
  if (intent.kind === 'driver-out') driverOut(intent.driver, open.filter((t: any) => t.driverId === intent.driver.id), `ביקשת: ${intent.driver.name} לא מגיע ב${dayName(date)}.`);
  if (intent.kind === 'bus-out') busOut(intent.bus, open.filter((t: any) => t.vehicleId === intent.bus.id), `ביקשת: ${intent.bus.label} לא זמין ב${dayName(date)}.`);

  // Then everything that would stop a trip that day.
  for (const d of drivers) {
    if (okDriver(d)) continue;
    const ts = open.filter((t: any) => t.driverId === d.id && !handled.has(t.id));
    driverOut(d, ts, d.available === false ? `${d.name} סומן כלא זמין.` : `הרישיון של ${d.name} פג ב־${ddmm(d.licenseUntil)}.`);
  }
  for (const v of vehicles) {
    if (okBus(v)) continue;
    const ts = open.filter((t: any) => t.vehicleId === v.id && !handled.has(t.id));
    const cause = v.available === false ? `${v.label} סומן כלא זמין.` : v.testUntil < date ? `הטסט של ${v.label} פג ב־${ddmm(v.testUntil)}.` : `${v.label} לא עבר טיפול בזמן (${ddmm(v.serviceDue)}).`;
    busOut(v, ts, cause);
  }
  for (const t of open.filter((x: any) => !handled.has(x.id) && x.capacity != null && x.planned > x.capacity)) {
    const bus = vehicles.find(v => v.id === t.vehicleId);
    const to = vehicles.filter(v => v.id !== t.vehicleId && okBus(v, t.planned) && free(`v:${v.id}`, windows.get(t.id)!)).sort((a, b) => a.capacity - b.capacity)[0];
    handled.add(t.id);
    if (!to) { proposals.push({ id: `seats-${t.id}`, tone: 'info', title: `${line(t)}: ${t.planned} תלמידים ל־${t.capacity} מקומות`, why: `אין כרגע אוטובוס גדול יותר שפנוי בשעה הזו. אפשר לפצל את הנסיעה לשני רכבים או לבקש רכב מקבלן.`, changes: [], tripIds: [t.id], apply: null, open: { view: 'trip', id: t.id } }); continue; }
    book(`v:${to.id}`, windows.get(t.id)!);
    proposals.push({ id: `seats-${t.id}`, tone: 'fix', title: `להחליף ל${to.label} ב${line(t)}`, why: `מתוכננים ${t.planned} תלמידים ל${bus?.label ?? 'רכב'} עם ${t.capacity} מקומות. ל${to.label} ${to.capacity} מקומות, והוא פנוי בשעה הזו.`, changes: [`${line(t)} · ${bus?.label} ← ${to.label}`], tripIds: [t.id], apply: { assignments: [{ tripId: t.id, vehicleId: to.id }], publish: true, reason: `הוחלף ל${to.label}: יותר תלמידים ממקומות` }, open: null });
  }
  const ready = open.filter((t: any) => !handled.has(t.id) && !t.published && !t.blockers.length);
  if (ready.length) proposals.push({ id: 'publish', tone: 'fix', title: ready.length === 1 ? `לפרסם את ${line(ready[0])} לנהג` : `לפרסם ${ready.length} נסיעות מוכנות לנהגים`, why: 'הנסיעות מוכנות, אבל הנהגים עוד לא רואים אותן.', changes: ready.slice(0, 6).map(line), tripIds: ready.map((t: any) => t.id), apply: { assignments: ready.map((t: any) => ({ tripId: t.id })), publish: true, reason: 'פורסם לנהג' }, open: null });

  // Things to know, not to fix now.
  const soon = [...drivers.filter(d => d.licenseUntil >= date && Date.parse(d.licenseUntil) - Date.parse(date) <= 30 * DAY_MS).map(d => `הרישיון של ${d.name} (${ddmm(d.licenseUntil)})`),
    ...vehicles.filter(v => v.testUntil >= date && Date.parse(v.testUntil) - Date.parse(date) <= 30 * DAY_MS).map(v => `הטסט של ${v.label} (${ddmm(v.testUntil)})`)];
  if (soon.length) proposals.push({ id: 'expiring', tone: 'info', title: `${soon.length} תוקפים פגים בחודש הקרוב`, why: soon.slice(0, 5).join(', ') + (soon.length > 5 ? ` ועוד ${soon.length - 5}` : '') + '.', changes: [], tripIds: [], apply: null, open: { view: 'fleet' } });
  const checked = views.filter((t: any) => t.checks.length);
  if (checked.length) proposals.push({ id: 'checks', tone: 'info', title: `${checked.length} נסיעות עם הערות בקובץ המועצה`, why: 'למשל כמויות שלא אומתו או שם תחנה שצריך לברר. הן לא עוצרות נסיעה, אבל כדאי לעבור עליהן עם הקובץ.', changes: [], tripIds: checked.map((t: any) => t.id), apply: null, open: { view: 'checks' } });

  const fixes = proposals.filter(p => p.tone === 'fix').length;
  const heard = !intent.text ? '' : intent.understood
    ? (intent.kind === 'driver-out' ? `הבנתי: ${intent.driver.name} לא מגיע ב${dayName(date)}. ` : intent.kind === 'bus-out' ? `הבנתי: ${intent.bus.label} לא זמין ב${dayName(date)}. ` : '')
    : 'לא הבנתי את הבקשה, אז בדקתי את כל הסידור. אפשר לכתוב למשל "דוד מזרחי לא מגיע מחר" או "אוטובוס 15 במוסך ביום שלישי". ';
  return {
    date, weekday: DAYS[weekday(date)], ask: intent.text, understood: intent.understood, readBy: intent.text ? intent.readBy : null,
    summary: `${heard}בדקתי ${views.length} נסיעות ל${dayName(date)}. ${fixes ? (fixes === 1 ? 'יש דבר אחד שאפשר לסדר עכשיו.' : `יש ${fixes} דברים שאפשר לסדר עכשיו.`) : 'כל הנסיעות יכולות לצאת.'}`,
    proposals,
  };
}
