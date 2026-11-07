// Dispatcher workspace for people who run school transport from a spreadsheet today.
// Built like a modern CRM: rides are the records. A board and a table list them, one inspector
// opens a ride (overview, map, assignment, activity), a weekly planner builds tomorrow, and an
// assistant proposes fixes that a person approves. The live map is one click away, not the page.
import { mountTransportMap } from './transport-map.js';

const DAYS = [
  { label: 'ראשון', date: '2026-11-08' }, { label: 'שני', date: '2026-11-09' }, { label: 'שלישי', date: '2026-11-10' },
  { label: 'רביעי', date: '2026-11-11' }, { label: 'חמישי', date: '2026-11-12' }, { label: 'שישי', date: '2026-11-13' },
];
const DISPATCHERS = [{ id: 'shuki', name: 'שוקי' }, { id: 'inbal', name: 'ענבל' }];
const TODAY = DAYS[0].date;
const TOMORROW = DAYS[1].date;
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const S = {
  viewer: store.get('t-viewer', 'shuki'), theme: 'clean', data: null, week: {}, playing: false,
  rides: store.get('t-rides-view', 'board'), mapOpen: false, map: null, inspMap: null,
  insp: null, // { id, date, tab }
  dirty: false, stale: false, composing: false, draft: '',
  plan: { view: 'fix', day: TOMORROW, q: '', sel: null, route: null, showReady: false, suggest: new Map(), proposals: [], month: null }, table: { q: '', facet: '' },
  assist: null, // { date, ask, busy, result, applied: Set }
  tour: null, // { step }
  phone: false, offline: false, driver: 'driver-10', pop: false, confirmReset: false, cmd: null, help: false, flash: null, opt: {}, optMore: {}, optScope: {}, fleetFilter: 'all',
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = s => document.querySelector(s);
const num = n => (n == null ? '—' : Number(n).toLocaleString('he-IL'));
const heDate = iso => iso.split('-').reverse().slice(0, 2).map(Number).join('.');
const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dayOf = date => DAYS.find(d => d.date === date) ?? DAYS[0];
const dayWord = date => (date === TODAY ? 'היום' : date === TOMORROW ? 'מחר' : `יום ${dayOf(date).label}`);
const firstName = name => String(name).split(' ')[0];
const FLEET_CAUSE = /רישיון|טסט|טיפול|זמין|חסר שיבוץ|הוסר/;

const svg = (d, fill = false) => `<svg class="i" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  bus: svg('<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>', true),
  pause: svg('<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>', true),
  call: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6"/>'),
  chev: svg('<path d="m15 18-6-6 6-6"/>'),
  back: svg('<path d="m9 18 6-6-6-6"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  wrench: svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>'),
  msg: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  sliders: svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  rides: svg('<path d="M3 7h18M3 12h18M3 17h12"/>'),
  board: svg('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>'),
  table: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  fleet: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><rect x="15" y="9" width="7" height="8" rx="1.5"/><path d="M15 13h7"/>'),
  map: svg('<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>'),
  assist: svg('<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>'),
  flag: svg('<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>'),
  send: svg('<path d="m22 2-7 20-4-9-9-4 20-7z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};
const STATUS = {
  upcoming: ['טרם יצאה', ''], blocked: ['חסומה', 'is-blocked'], late: ['לא יצאה', 'is-bad'],
  active: ['בדרך', 'is-active'], delayed: ['מאחרת', 'is-warn'], completed: ['הגיעה', 'is-ok'],
};
const pill = status => { const [t, c] = STATUS[status] ?? STATUS.upcoming; return `<span class="t-pill ${c}">${t}</span>`; };
const codeTone = t => (['late', 'delayed'].includes(t.status) ? 'is-bad' : ['upcoming', 'completed', 'blocked'].includes(t.status) ? 'is-quiet' : '');

// ------------------------------------------------------------ server
async function api(path, opts = {}) {
  let r;
  try { r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', 'x-transport-viewer': S.viewer, ...(opts.headers || {}) } }); }
  catch { throw new Error('אין חיבור לשרת. בדקו את הרשת ונסו שוב.'); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'הפעולה לא נשמרה. נסו שוב.');
  return body;
}
const stateFor = date => api(`/api/transport/state?date=${date}`);
const command = (type, data = {}, trip = null, date = TODAY) =>
  api('/api/transport/commands', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), type, date, tripId: trip?.id, version: trip?.version, data }) });
const dataFor = date => (date === TODAY ? S.data : S.week[date]);
async function loadDay(date) { const d = await stateFor(date); if (date === TODAY) S.data = d; S.week[date] = d; return d; }

// Errors stay until dismissed and can be retried; confirmations can be undone.
function toast(text, { bad = false, undo = null, retry = null, action = null } = {}) {
  const el = document.createElement('div');
  el.className = `t-toast${bad ? ' is-bad' : ''}`;
  el.setAttribute('role', bad ? 'alert' : 'status');
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button" data-t="action">${esc(action.label)}</button>` : ''}${undo ? '<button type="button" data-t="undo">ביטול</button>' : ''}${retry ? '<button type="button" data-t="retry">לנסות שוב</button>' : ''}${bad ? `<button type="button" data-t="close" aria-label="סגירה">${I.x}</button>` : ''}`;
  el.querySelector('[data-t=undo]')?.addEventListener('click', () => { el.remove(); undo(); });
  el.querySelector('[data-t=action]')?.addEventListener('click', () => { el.remove(); action.fn(); });
  el.querySelector('[data-t=retry]')?.addEventListener('click', () => { el.remove(); retry(); });
  el.querySelector('[data-t=close]')?.addEventListener('click', () => el.remove());
  $('#toast').replaceChildren(el);
  if (!bad) setTimeout(() => el.remove(), undo || action ? 8000 : 3200);
}
async function run(fn, ok) {
  try { await fn(); if (ok) toast(ok); return true; } catch (e) { toast(e.message, { bad: true, retry: () => run(fn, ok) }); return false; }
}
// An in-app confirmation instead of the browser's own dialog.
function ask(text, yes = 'כן', no = 'ביטול') {
  return new Promise(resolve => {
    const root = $('#dialog');
    root.innerHTML = `<div class="t-scrim"><div class="t-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t"><p id="dlg-t">${esc(text)}</p>
      <div class="t-actions"><button class="t-btn is-primary" data-d="yes">${esc(yes)}</button><button class="t-btn" data-d="no">${esc(no)}</button></div></div></div>`;
    const done = v => { root.innerHTML = ''; resolve(v); };
    root.querySelector('[data-d=yes]').onclick = () => done(true);
    root.querySelector('[data-d=no]').onclick = () => done(false);
    root.querySelector('[data-d=no]').focus();
    root.querySelector('.t-scrim').onkeydown = e => { if (e.key === 'Escape') done(false); };
  });
}
const leaveEdits = async () => !S.dirty || ask('יש שינויים שלא נשמרו. לצאת בלי לשמור?', 'לצאת בלי לשמור', 'להישאר');
const view = () => (location.hash.replace('#/', '') || 'rides').split('?')[0];

// ------------------------------------------------------------ themes
const THEMES = [
  { id: 'clean', name: 'נקי: דיו, לבן וכחול לפעולות', note: 'שני צבעים, צבע אחד לכפתור הראשי', sw: ['#f6f6f4', '#1b1c1e', '#2f5bd0'] },
  { id: 'royal', name: 'פחם וכחול מלכותי', note: 'כחול מוביל, כתום רק להדגשה', sw: ['#1d2024', '#3557d8', '#f28500'] },
  { id: 'paper', name: 'נייר, דיו וכחול דגנית', note: 'בהיר ושקט, שחור לפעולות', sw: ['#f7f5ef', '#17171a', '#6c93ea'] },
  { id: 'flame', name: 'שחור, לבן רך וכתום להבה', note: 'אוטובוסים בשחור, כתום למותג', sw: ['#0f0f10', '#f6f4ef', '#e8590c'] },
  { id: 'navy', name: 'כחול רך, כחול לילה ואלמוג', note: 'רקע כחלחל, אלמוג להדגשה', sw: ['#eef3fa', '#13213c', '#ff6f59'] },
];
function applyTheme(id) {
  if (!THEMES.some(t => t.id === id)) id = 'clean';
  S.theme = id;
  document.documentElement.dataset.theme = id;
  store.set('t-theme-v2', id);
  $('#phone')?.contentWindow?.postMessage({ theme: id }, location.origin);
  S.map?.retheme?.(); S.inspMap?.retheme?.();
}

// ------------------------------------------------------------ rail (the CRM sidebar)
function rail() {
  const v = view();
  const d = S.data;
  const me = DISPATCHERS.find(p => p.id === S.viewer) ?? DISPATCHERS[0];
  const item = (k, icon, label, badge = '') => `<a class="t-rail-item" href="#/${k}" ${v === k ? 'aria-current="page"' : ''}>${icon}<span>${label}</span>${badge}</a>`;
  $('#rail').innerHTML = `
    <a class="t-brand" href="#/rides" aria-label="הסעות, מועצה אזורית גולן"><span class="t-sign">${I.bus}</span><span><b>הסעות</b><small>מועצה אזורית גולן</small></span></a>
    <button class="t-search" data-act="cmd">${I.search}<span>חיפוש</span><kbd class="t-kbd">${IS_MAC ? '⌘K' : 'Ctrl K'}</kbd></button>
    <nav class="t-rail-nav" aria-label="ניווט">
      ${item('rides', I.rides, 'נסיעות', '<span class="t-badge" id="b-road" hidden></span>')}
      ${item('plan', I.calendar, 'סידור')}
      ${item('drivers', I.user, 'נהגים', '<span class="t-badge" id="b-drivers" hidden></span>')}
      ${item('vehicles', I.bus, 'רכבים', '<span class="t-badge" id="b-vehicles" hidden></span>')}
    </nav>
    <button class="t-rail-item t-rail-assist" data-act="assist" aria-expanded="${Boolean(S.assist)}">${I.assist}<span>עוזר התכנון</span></button>
    <div class="t-spacer"></div>
    <div class="t-rail-foot">
      <div class="t-clock" id="clock"><span class="t-live-dot"></span><b class="num" id="clock-time">${esc(d?.clock ?? '')}</b><small>יום ${esc(d?.weekday ?? 'ראשון')} ${heDate(TODAY)}</small></div>
      <div class="t-rail-row">
        <span class="t-me"><span class="t-avatar" aria-hidden="true">${esc(me.name[0])}</span>${esc(me.name)}</span>
        <button class="t-icon-btn" data-act="help" aria-label="עזרה וקיצורים" title="עזרה">${I.help}</button>
        <div class="t-pop-wrap"><button class="t-icon-btn" data-act="pop" aria-expanded="${S.pop}" aria-haspopup="dialog" aria-label="הגדרות תצוגה" title="תצוגה">${I.sliders}</button>${S.pop ? demoTray() : ''}</div>
      </div>
    </div>`;
  railTick();
}
function railTick() {
  const d = S.data;
  if (!d) return;
  const road = attentionCount();
  const lic = d.drivers.filter(x => x.licenseUntil < TODAY).length;
  const test = d.vehicles.filter(x => x.testUntil < TODAY).length;
  const set = (id, n, label) => { const el = $(id); if (el) { el.hidden = !n; el.textContent = n; el.setAttribute('aria-label', `${n} ${label}`); } };
  set('#b-road', road, 'דורשים טיפול'); set('#b-drivers', lic, 'עם רישיון שפג'); set('#b-vehicles', test, 'עם טסט שפג');
  if ($('#clock-time')) $('#clock-time').textContent = d.clock;
  if ($('#pop-clock')) $('#pop-clock').textContent = d.clock;
  $('#clock')?.classList.toggle('is-playing', S.playing);
  const st = $('.t-status-time'); if (st) st.textContent = d.clock;
}
function demoTray() {
  const d = S.data;
  const drivers = d.drivers.filter(x => d.trips.some(t => t.driverId === x.id && t.published && !t.blockers.length));
  return `<div class="t-pop" role="dialog" aria-label="תצוגה">
    <button class="t-tour-btn" data-act="tour">${I.flag}<span><b>הבריף: 9 הנקודות</b><small>מעבר על כל נקודה בדמו</small></span>${I.chev}</button>
    <hr>
    <h3>ערכת צבעים</h3>
    <div class="t-themes" role="radiogroup" aria-label="ערכת צבעים">${THEMES.map(t => `<button class="t-theme" role="radio" aria-checked="${S.theme === t.id}" data-theme-pick="${t.id}">
      <span class="t-swatch" aria-hidden="true">${t.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <span>${t.name}<small>${t.note}</small></span><span class="t-tick">${I.check}</span></button>`).join('')}</div>
    <hr>
    <div class="t-pop-row"><span>השעה <b class="num" id="pop-clock">${esc(d.clock)}</b></span>
      <span class="t-actions"><button class="t-btn is-sm" data-act="play">${S.playing ? `${I.pause} עצירה` : `${I.play} הרצה`}</button><button class="t-btn is-sm" data-act="plus5">+5 דק׳</button></span></div>
    <div class="t-pop-row"><span id="l-phone">טלפון הנהג על המסך</span><button class="t-switch" role="switch" aria-checked="${S.phone}" aria-labelledby="l-phone" data-act="phone"></button></div>
    <div class="t-pop-row"><label for="drv">נהג בטלפון</label><select id="drv" class="t-select" data-act="driver">${drivers.map(x => `<option value="${x.id}" ${x.id === S.driver ? 'selected' : ''}>${esc(x.name)} · קו ${esc(x.routeCode)}</option>`).join('')}</select></div>
    <div class="t-pop-row"><span id="l-off">הטלפון בלי קליטה</span><button class="t-switch" role="switch" aria-checked="${S.offline}" aria-labelledby="l-off" data-act="offline"></button></div>
    <div class="t-pop-row"><label for="who">מחובר כ</label><select id="who" class="t-select" data-act="viewer">${DISPATCHERS.map(p => `<option value="${p.id}" ${p.id === S.viewer ? 'selected' : ''}>${p.name}</option>`).join('')}</select></div>
    <hr>
    <div class="t-pop-row"><span>חזרה ל־07:05</span><button class="t-btn is-sm" data-act="reset">${I.reset} ${S.confirmReset ? 'לאפס? שוב' : 'איפוס'}</button></div>
  </div>`;
}

// ------------------------------------------------------------ rides: board and table
function progress(t) {
  const n = t.points.length;
  if (n < 2 || !['active', 'delayed'].includes(t.status)) return '';
  const at = Math.min(1, Math.max(0, (t.live.departedIndex + t.live.fraction) / (n - 1)));
  const next = t.points[t.live.departedIndex + 1];
  return `<span class="t-prog" role="img" aria-label="${esc(`עברה ${t.live.departedIndex + 1} מתוך ${n} תחנות${next ? `, בדרך ל${next.name}` : ''}`)}">
    <i class="t-prog-line"></i><i class="t-prog-done" style="width:${(at * 100).toFixed(1)}%"></i>
    ${t.points.map((p, i) => `<i class="t-prog-dot ${i <= t.live.departedIndex ? 'is-done' : ''} ${p.kind === 'school' ? 'is-end' : ''}" style="inset-inline-start:${((i / (n - 1)) * 100).toFixed(1)}%" title="${esc(`${p.name}${p.time ? ` · ${p.time}` : ''}`)}"></i>`).join('')}
    <i class="t-prog-bus ${t.status === 'delayed' ? 'is-late' : ''}" style="inset-inline-start:${(at * 100).toFixed(1)}%">${I.bus}</i>
  </span>`;
}
function rideCard(t) {
  const next = t.points[t.live.departedIndex + 1];
  const where = t.status === 'completed' ? 'הגיעה לבית הספר'
    : t.live.blockedReason && t.live.phase === 'pending' ? t.live.blockedReason
    : t.live.phase === 'pending' ? t.driverName : next ? `בדרך ל${next.name}` : '';
  const figure = t.live.boarded != null ? `<span dir="ltr" class="num"><b>${num(t.live.boarded)}</b>/${num(t.planned)}</span>` : `<span class="num"><b>${num(t.planned)}</b> תלמידים</span>`;
  return `<button class="t-ride ${S.insp?.id === t.id ? 'is-open' : ''}" data-ride="${t.id}">
    <span class="t-ride-top"><span class="t-code ${codeTone(t)}">${esc(t.routeCode)}</span><span class="num t-ride-time">${esc(t.departure)}</span>${['late', 'delayed', 'blocked'].includes(t.status) ? pill(t.status) : ''}</span>
    <b>${esc(t.school)}</b>
    <span class="t-sub">${t.live.lateMinutes ? `<b class="t-late">${t.live.lateMinutes} דק׳ איחור</b> · ` : ''}${esc(where)}</span>
    ${progress(t)}
    <span class="t-ride-foot">${figure}${t.live.mode === 'manual' && t.live.boarded != null ? '<span class="t-src">דיווח נהג</span>' : ''}</span>
  </button>`;
}
// What a driver sent from the phone: a problem with a ride, a "call me", or a day off.
function inboxCard(x) {
  const when = `${dayWord(x.date)}${x.departure ? ` · קו ${esc(x.routeCode)} · ${esc(x.departure)}` : ''}`;
  const title = x.kind === 'away' ? `${esc(x.driverName)} לא זמין ${dayWord(x.date)}` : x.kind === 'back' ? `${esc(x.driverName)} חזר להיות זמין ${dayWord(x.date)}` : x.call && !x.text && !x.reason ? `${esc(x.driverName)} ביקש שיתקשרו אליו` : `${esc(x.driverName)}: ${esc(x.reason || 'יש בעיה')}`;
  const tag = x.kind === 'away' ? statusPill([x.reason || 'לא זמין', 'is-warn']) : x.kind === 'back' ? statusPill(['זמין', 'is-ok']) : statusPill([x.call ? 'ביקש שיחה' : 'דיווח מהנהג', 'is-info']);
  return `<div class="t-alert t-inbox is-high">
    <div class="t-alert-open"><span class="t-inbox-top">${avatar(x.driverName)}<b>${title}</b>${tag}</span><span class="t-detail">${x.kind === 'concern' ? when : `${dayWord(x.date)} ${heDate(x.date)}`}${x.text ? ` · "${esc(x.text)}"` : ''}</span></div>
    <div class="t-actions">
      ${x.kind === 'away' ? `<button class="t-btn is-primary is-sm" data-inbox-plan="${esc(x.date)}">לסידור של ${esc(dayWord(x.date))}</button>` : x.phone && x.kind === 'concern' ? `<a class="t-btn is-primary is-sm" href="tel:${esc(x.phone)}" data-call="${esc(x.driverName)}|${esc(x.phone)}">${I.call} להתקשר ל${esc(firstName(x.driverName))}</a>` : ''}
      <button class="t-btn is-sm" data-inbox-done="${esc(x.id)}">${I.check} טופל</button>
    </div>
  </div>`;
}
function alertCard(a, lead = true) {
  const fix = a.kind === 'blocked' && a.fix;
  const p = lead ? 'is-primary' : '';
  return `<div class="t-alert is-${a.level}">
    <button class="t-alert-open" data-ride="${esc(a.tripId)}"><b>${esc(a.title)}</b><span class="t-detail">${esc(a.detail)}</span></button>
    ${S.focus?.alertId === a.id ? '' : `<div class="t-actions">
      ${fix ? `<button class="t-btn ${p} is-sm" data-focus="${esc(a.id)}" aria-expanded="false">${a.fix.kind === 'bus' ? 'בחירת רכב חלופי' : 'בחירת נהג חלופי'}</button>` : ''}
      ${a.call ? `<a class="t-btn ${p} is-sm" href="tel:${esc(a.call.phone)}" data-call="${esc(a.call.name)}|${esc(a.call.phone)}">${I.call} להתקשר ל${esc(firstName(a.call.name))}</a>` : ''}
      <button class="t-btn is-sm" data-ack="${esc(a.id)}">${I.check} טופל</button>
    </div>`}
    ${S.focus?.alertId === a.id ? focusBlock() : ''}
  </div>`;
}
// One issue, one suggestion: what to change and why, approved in place.
function focusBlock() {
  const f = S.focus;
  if (f.busy) return '<div class="t-focus"><p class="t-source">מחפש נהג או רכב פנויים…</p></div>';
  return `<div class="t-focus" role="region" aria-label="אפשרויות">${optionsBlock(f.cause, TODAY, S.data, 'board', '<button class="t-btn" data-act="focus-close">לא עכשיו</button>')}</div>`;
}
async function focusFix(alertId) {
  if (S.focus?.alertId === alertId) { S.focus = null; paintRides(); return; }
  const a = S.data.alerts.find(x => x.id === alertId);
  if (!a?.fix) return;
  S.focus = { alertId, busy: true, kind: a.fix.kind }; paintRides();
  try {
    const r = await api(`/api/transport/assistant?date=${TODAY}`);
    const proposal = r.proposals.find(p => p.id === `${a.fix.kind === 'bus' ? 'bus' : 'driver'}-${a.fix.id}`) ?? r.proposals.find(p => (p.tripIds ?? []).some(id => (a.tripIds ?? [a.tripId]).includes(id)));
    const rides = (a.tripIds ?? [a.tripId]).map(id => S.data.trips.find(t => t.id === id)).filter(Boolean);
    const [head, ...rest] = (proposal?.why ?? a.title).split('. ');
    S.focus = { alertId, kind: a.fix.kind, cause: { key: `${a.fix.kind === 'bus' ? 'bus' : 'driver'}-${a.fix.id}`, res: a.fix.kind === 'bus' ? 'bus' : 'driver', head, rides, applies: proposal?.apply ? [proposal.apply] : [], recWhy: rest.join('. ') } };
  } catch (e) { S.focus = null; toast(e.message, { bad: true }); }
  paintRides();
}
function boardColumns() {
  const d = S.data;
  const now = minutes(d.clock);
  const road = d.alerts.filter(a => a.queue === 'road');
  // Today's problems, counted exactly like the planner; road alerts that only repeat one of them are folded in.
  const fix = causes(TODAY);
  const covered = new Set(fix.flatMap(c => c.rides.map(t => t.id)));
  return {
    fix,
    open: road.filter(a => !a.handled && !(a.kind === 'blocked' && (a.tripIds ?? [a.tripId]).every(id => covered.has(id)))), handled: road.filter(a => a.handled),
    soon: d.trips.filter(t => ['upcoming', 'blocked'].includes(t.status) && minutes(t.departure) - now <= 60).sort((a, b) => a.departure.localeCompare(b.departure)),
    later: d.trips.filter(t => ['upcoming', 'blocked'].includes(t.status) && minutes(t.departure) - now > 60),
    moving: d.trips.filter(t => t.status === 'active' || t.status === 'delayed').sort((a, b) => b.live.lateMinutes - a.live.lateMinutes || a.departure.localeCompare(b.departure)),
    done: d.trips.filter(t => t.status === 'completed').sort((a, b) => b.departure.localeCompare(a.departure)),
    prep: d.alerts.filter(a => a.queue === 'prep' && !a.handled && a.level !== 'low'),
  };
}
// One number for "needs you": drivers' messages, live alerts, and today's problems (the same ones the planner shows).
function attentionCount() { const c = boardColumns(); return (S.data.inbox?.length ?? 0) + c.open.length + c.fix.length; }
function problemCard(c, i, lead) {
  const d = S.data;
  const first = c.rides[0];
  const left = minutes(first.departure) - minutes(d.clock);
  return `<div class="t-alert t-problem is-high">
    <div class="t-alert-open"><span class="t-inbox-top">${causeChip(c, d)}</span><span class="t-detail">${num(c.rides.length)} ${c.rides.length === 1 ? 'נסיעה' : 'נסיעות'} היום · הראשונה ${esc(first.departure)}${left > 0 && left <= 90 ? `, בעוד ${num(left)} דק׳` : ''}</span></div>
    <div class="t-actions"><button class="t-btn ${lead ? 'is-primary' : ''} is-sm" data-fixtoday="${i}">${c.res === 'bus' ? 'בחירת רכב מחליף' : c.res === 'driver' ? 'בחירת נהג מחליף' : 'לפרטים'}</button></div>
  </div>`;
}
function boardHtml() {
  const c = boardColumns();
  const col = (key, title, count, body, tone = '') => `<section class="t-col ${tone}" aria-labelledby="col-${key}"><header><h2 id="col-${key}">${title}</h2><span class="num">${num(count)}</span></header><div class="t-col-body">${body}</div></section>`;
  const inbox = S.data.inbox ?? [];
  const total = attentionCount();
  const attention = inbox.map(inboxCard).join('') + c.open.map((a, i) => alertCard(a, i === 0 && !inbox.length)).join('') + c.fix.map((x, i) => problemCard(x, i, !inbox.length && !c.open.length && i === 0)).join('')
    + (total ? '' : `<div class="t-calm">${I.check}<b>הכל בסדר</b><span>כל הנסיעות של היום יכולות לצאת, ואין הודעות מנהגים.</span></div>`)
    + (c.handled.length ? `<details class="t-handled"><summary>טופלו (${num(c.handled.length)})</summary>${c.handled.map(a => `<div class="t-handled-row"><span><s>${esc(a.title)}</s><br>${esc(a.handled.by)}</span><button class="t-btn is-sm is-ghost" data-unack="${esc(a.id)}">החזרה</button></div>`).join('')}</details>` : '')
    ;
  const list = (ts, empty) => ts.map(rideCard).join('') || `<p class="t-empty">${empty}</p>`;
  return `<div class="t-board" id="board">
    ${col('now', 'דורש טיפול', total, attention, total ? 'is-attn' : '')}
    ${col('soon', 'יוצאות בשעה הקרובה', c.soon.length, list(c.soon, 'אין יציאות בשעה הקרובה.') + (c.later.length ? `<button class="t-more" data-act="later">ועוד ${num(c.later.length)} נסיעות בהמשך היום</button>` : ''))}
    ${col('moving', 'בדרך', c.moving.length, list(c.moving, 'אף אוטובוס לא בדרך כרגע.'))}
    ${col('done', 'הגיעו', c.done.length, c.done.map(t => `<button class="t-ride-mini ${S.insp?.id === t.id ? 'is-open' : ''}" data-ride="${t.id}"><span class="t-code">${esc(t.routeCode)}</span><span>${esc(t.school)}</span><span class="num">${t.live.boarded != null ? `<span dir="ltr">${num(t.live.boarded)}/${num(t.planned)}</span>` : ''}</span></button>`).join('') || '<p class="t-empty">עוד לא הגיעו נסיעות.</p>', 'is-done')}
  </div>`;
}
function ridesPage() {
  const d = S.data;
  const me = DISPATCHERS.find(p => p.id === S.viewer) ?? DISPATCHERS[0];
  const hour = Math.floor(minutes(d.clock) / 60);
  return `<div class="t-page t-page-full">
    <header class="t-page-head">
      <div><h1>${hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'}, ${esc(me.name)}</h1><p id="rides-meta"></p><p id="rides-out" class="t-out"></p></div>
      <div class="t-spacer"></div>
      <div class="t-seg" role="group" aria-label="תצוגה">
        <button data-rides="board" aria-pressed="${S.rides === 'board'}">${I.board} לוח</button>
        <button data-rides="table" aria-pressed="${S.rides === 'table'}">${I.table} טבלה</button>
      </div>
      <button class="t-btn" data-act="map">${I.map} מפה חיה</button>
    </header>
    <div id="rides-body">${S.rides === 'board' ? boardHtml() : tableShell()}</div>
  </div>`;
}
function ridesMeta() {
  const d = S.data;
  const c = boardColumns();
  const el = $('#rides-meta');
  const n = attentionCount();
  if (el) el.innerHTML = [n ? `<b class="t-meta-attn">${num(n)} ${n === 1 ? 'דבר דורש' : 'דברים דורשים'} טיפול</b>` : 'אין כרגע מה לטפל', `${num(c.moving.length)} בדרך`, `${num(c.done.length)} הגיעו`, `${num(d.trips.length)} נסיעות ביום ${esc(d.weekday)} ${heDate(d.date)}`].join(' · ');
}
function missingToday(d = S.data, date = TODAY) {
  const used = new Set(d.trips.flatMap(t => [t.driverId, t.vehicleId]));
  const why = (x, kind) => x.available === false ? (kind === 'driver' ? 'לא זמין' : 'מושבת') : away(x, date) ? ((x.away.find(a => a.from <= date && date <= a.to)?.reason) || 'בהיעדרות') : kind === 'driver' ? (x.licenseUntil < date ? 'רישיון פג' : '') : x.testUntil < date ? 'טסט פג' : x.serviceDue < date ? 'טיפול' : '';
  return [...d.drivers.filter(x => !x.archived && used.has(x.id)).map(x => ({ kind: 'drivers', id: x.id, name: x.name, why: why(x, 'driver') })),
    ...d.vehicles.filter(x => !x.archived && used.has(x.id)).map(x => ({ kind: 'vehicles', id: x.id, name: x.label, why: why(x, 'bus') }))].filter(x => x.why);
}
function paintRides() {
  ridesMeta();
  const out = $('#rides-out');
  if (out) { const m = missingToday(); out.innerHTML = m.length ? `חסרים היום: ${m.slice(0, 4).map(x => `<button class="t-link" data-rec-open="${x.kind}:${esc(x.id)}">${esc(x.name)}</button> <span class="t-pill is-${/פג|מושבת|לא זמין/.test(x.why) ? 'bad' : 'warn'}">${esc(x.why)}</span>`).join(' ')}${m.length > 4 ? ` ועוד ${num(m.length - 4)}` : ''}` : 'כל הנהגים והרכבים של היום זמינים'; }
  if (S.rides === 'board') {
    const body = $('#rides-body');
    const scrolls = [...document.querySelectorAll('.t-col-body')].map(x => x.scrollTop);
    body.innerHTML = boardHtml();
    document.querySelectorAll('.t-col-body').forEach((x, i) => { x.scrollTop = scrolls[i] ?? 0; });
  } else paintTable();
}

// table view (AG Grid, Omni DataGrid conventions)
const AG = window.agGrid;
const gridTheme = AG?.themeQuartz.withParams({
  backgroundColor: 'var(--surface)', foregroundColor: 'var(--ink)', borderColor: 'var(--line)',
  rowBorder: { color: 'var(--line)' }, headerBackgroundColor: 'var(--surface-2)', headerTextColor: 'var(--muted)',
  rowHoverColor: 'var(--surface-2)', accentColor: 'var(--accent)', selectedRowBackgroundColor: 'var(--hi-soft)',
  fontFamily: 'var(--font)', fontSize: 13, headerFontSize: 12, headerFontWeight: 500, headerHeight: 36,
  cellHorizontalPadding: 12, wrapperBorderRadius: 12, wrapperBorder: false,
});
S.grids = {};
function grid(el, key, options) {
  if (!AG) { el.innerHTML = '<p class="t-empty">הטבלה לא נטענה. בדקו את החיבור לרשת ורעננו.</p>'; return null; }
  S.grids[key]?.destroy();
  S.grids[key] = AG.createGrid(el, {
    theme: gridTheme, enableRtl: true, animateRows: false, ensureDomOrder: true, suppressMovableColumns: true,
    rowHeight: 48, getRowId: p => p.data.id,
    defaultColDef: { resizable: true, sortable: true, suppressHeaderMenuButton: true, cellClass: 't-gcell', minWidth: 80 },
    ...options,
  });
  return S.grids[key];
}
function dropGrids() { Object.values(S.grids).forEach(g => g?.destroy()); S.grids = {}; }
const endCell = 't-gcell is-end num';
const two = (top, sub) => `<div class="t-g2"><b>${top}</b><span>${sub}</span></div>`;
const TABLE_FACETS = [['attention', 'דורשות טיפול'], ['moving', 'בדרך'], ['later', 'בהמשך היום'], ['checks', 'לבירור בקובץ']];
function tableRows() {
  const q = S.table.q.trim();
  const open = new Set(S.data.alerts.filter(a => a.queue === 'road' && !a.handled).flatMap(a => a.tripIds ?? [a.tripId]));
  return S.data.trips
    .filter(t => !q || [t.number, t.routeCode, `קו ${t.routeCode}`, t.school, t.driverName, t.vehicleName, ...t.stops.map(s => s.name)].join(' ').includes(q))
    .filter(t => !S.table.facet || (S.table.facet === 'attention' ? open.has(t.id) : S.table.facet === 'moving' ? ['active', 'delayed'].includes(t.status) : S.table.facet === 'later' ? ['upcoming', 'blocked'].includes(t.status) : t.checks.length))
    .sort((a, b) => a.departure.localeCompare(b.departure));
}
function tableShell() {
  return `<div class="t-toolbar">
      <label class="t-search-field">${I.search}<span class="sr-only">חיפוש בנסיעות</span><input id="tq" type="search" placeholder="קו, בית ספר, יישוב או נהג" value="${esc(S.table.q)}"></label>
      <div class="t-chips" role="group" aria-label="סינון">${TABLE_FACETS.map(([k, l]) => `<button class="t-chip" data-tfacet="${k}" aria-pressed="${S.table.facet === k}">${l}</button>`).join('')}</div>
    </div>
    <div class="t-grid t-grid-main" id="g-rides"></div><p class="t-grid-foot" id="rides-foot"></p>`;
}
function mountTable() {
  grid($('#g-rides'), 'rides', {
    rowData: tableRows(), rowHeight: 56,
    rowClassRules: { 't-grid-selected': p => p.data?.id === S.insp?.id },
    onRowClicked: e => openRide(e.data.id, TODAY),
    onCellKeyDown: e => { if (e.event?.key === 'Enter') openRide(e.data.id, TODAY); },
    onGridReady: e => e.api.setGridAriaProperty('label', 'נסיעות היום'),
    columnDefs: [
      { headerName: 'יציאה', field: 'departure', width: 86, minWidth: 76, cellClass: 't-gcell num', sort: 'asc' },
      { headerName: 'קו', field: 'routeCode', width: 76, minWidth: 70, comparator: (a, b) => (Number(a) || 1e9) - (Number(b) || 1e9), cellRenderer: p => `<span class="t-code ${codeTone(p.data)}">${esc(p.value)}</span>` },
      { headerName: 'בית ספר ותחנות', field: 'school', flex: 2.2, minWidth: 240, cellRenderer: p => two(esc(p.value), esc(p.data.points.filter(x => x.kind === 'stop').map(x => x.name).join(' · '))) },
      { headerName: 'מצב', colId: 'status', width: 120, valueGetter: p => p.data.status, cellRenderer: p => pill(p.data.status) },
      { headerName: 'תלמידים', colId: 'count', width: 100, cellClass: endCell, valueGetter: p => p.data.live.boarded ?? p.data.planned, cellRenderer: p => (p.data.live.boarded != null ? `<span dir="ltr">${num(p.data.live.boarded)}/${num(p.data.planned)}</span>` : num(p.data.planned)) },
      { headerName: 'נהג', field: 'driverName', flex: 1, minWidth: 120 },
      { headerName: 'רכב', field: 'vehicleName', flex: 1, minWidth: 110 },
      { headerName: 'הערות', colId: 'notes', flex: 1.2, minWidth: 150, valueGetter: p => p.data.blockers[0] ?? p.data.checks[0] ?? '', cellRenderer: p => p.data.blockers.length ? `<span class="t-pill is-bad" title="${esc(p.data.blockers.join(' · '))}">${esc(p.data.blockers[0])}</span>` : p.data.checks.length ? `<span class="t-note" title="${esc(p.data.checks.join(' · '))}">לבירור: ${esc(p.data.checks[0])}</span>` : '' },
    ],
  });
  paintTable();
}
function paintTable() {
  const rows = tableRows();
  S.grids.rides?.setGridOption('rowData', rows);
  S.grids.rides?.redrawRows();
  const f = $('#rides-foot'); if (f) f.textContent = `מוצגות ${num(rows.length)} מתוך ${num(S.data.trips.length)} נסיעות היום`;
}

// ------------------------------------------------------------ the ride inspector
async function openRide(id, date = TODAY, tab = null) {
  if (S.insp && S.insp.id !== id && !(await leaveEdits())) return;
  if (!dataFor(date)) await loadDay(date);
  const t = dataFor(date).trips.find(x => x.id === id);
  if (!t) return;
  if (!S.insp) S.returnFocus = document.activeElement;
  S.insp = { id, date, tab: tab ?? (date !== TODAY ? 'assign' : 'overview') };
  S.dirty = false; S.stale = false; S.composing = false; S.draft = '';
  paintInspector();
  document.querySelectorAll('.t-ride').forEach(x => x.classList.toggle('is-open', x.dataset.ride === id));
  S.grids.rides?.redrawRows();
}
async function closeRide() {
  if (!(await leaveEdits())) return;
  S.insp = null; S.dirty = false; S.inspMap?.destroy?.(); S.inspMap = null;
  $('#inspector').innerHTML = '';
  document.querySelectorAll('.t-ride.is-open').forEach(x => x.classList.remove('is-open'));
  S.grids.rides?.redrawRows();
  paintPlannerSelection();
  if (S.returnFocus?.isConnected) S.returnFocus.focus(); S.returnFocus = null;
}
function paintInspector() {
  const slot = $('#inspector');
  if (!S.insp) { slot.innerHTML = ''; return; }
  const d = dataFor(S.insp.date);
  const t = d?.trips.find(x => x.id === S.insp.id);
  if (!t) { slot.innerHTML = ''; return; }
  const body = $('#insp-body');
  const keepScroll = body?.scrollTop ?? 0;
  const tabs = [['overview', 'סקירה'], ['map', 'מפה'], ['assign', 'שיבוץ ותחנות'], ['log', 'פעילות']];
  const fresh = !slot.querySelector(`[data-insp="${t.id}:${S.insp.date}"]`);
  slot.innerHTML = `<aside class="t-insp" data-insp="${t.id}:${S.insp.date}" aria-label="נסיעה ${esc(t.number)}">
    <header class="t-insp-head">
      <div class="t-insp-title"><span class="t-code ${S.insp.date === TODAY ? codeTone(t) : 'is-quiet'}">${esc(t.routeCode)}</span><h2 tabindex="-1" id="insp-title">${esc(t.school)}</h2>${S.insp.date === TODAY ? pill(t.status) : ''}</div>
      <p>${[dayWord(S.insp.date), t.direction === 'morning' ? 'איסוף בוקר' : 'פיזור צהריים', `יציאה ${t.departure}`, `${num(t.planned)} תלמידים`].join(' · ')}</p>
      <button class="t-icon-btn t-insp-close" data-act="close-ride" aria-label="סגירה">${I.x}</button>
    </header>
    <div class="t-tabs" role="tablist" aria-label="פרטי הנסיעה">${tabs.map(([k, l]) => `<button role="tab" id="itab-${k}" aria-controls="insp-body" tabindex="${S.insp.tab === k ? 0 : -1}" data-itab="${k}" aria-selected="${S.insp.tab === k}">${l}</button>`).join('')}</div>
    <div class="t-insp-body" id="insp-body" role="tabpanel" aria-labelledby="itab-${S.insp.tab}">${S.insp.tab === 'overview' ? overviewTab(t) : S.insp.tab === 'map' ? mapTab(t) : S.insp.tab === 'assign' ? assignTab(t, d) : logTab(t)}</div>
    ${S.insp.tab === 'assign' && editableTrip(t, S.insp.date) ? assignFoot(t) : ''}
  </aside>`;
  if (!fresh) $('#insp-body').scrollTop = keepScroll;
  else $('#insp-title')?.focus({ preventScroll: true });
  if (S.insp.tab === 'map') mountInspMap(t);
  else { S.inspMap?.destroy?.(); S.inspMap = null; }
}
function overviewTab(t) {
  const today = S.insp.date === TODAY;
  const road = today ? S.data.alerts.filter(a => (a.tripIds ?? [a.tripId]).includes(t.id) && a.queue === 'road' && !a.handled) : [];
  const d = t.live.departedIndex;
  const moving = today && ['active', 'delayed'].includes(t.status);
  const eta = p => (p?.time ? hhmm(minutes(p.time) + (t.live.lateMinutes || 0)) : '');
  const stops = t.points.map((p, i) => {
    const c = today ? t.live.stopCounts[p.id] : null;
    const cls = today && i <= d ? 'is-done' : today && i === d + 1 && t.live.phase !== 'pending' ? 'is-next' : '';
    const label = p.kind === 'school' ? 'בי״ס' : String(t.points.slice(0, i + 1).filter(x => x.kind === 'stop').length);
    const count = p.kind === 'school'
      ? (today && t.direction === 'morning' && i <= d ? `<b class="num">${num(t.live.boarded)}</b> ירדו` : '')
      : c ? `<span dir="ltr"><b class="num ${c.expected != null && c.count !== c.expected ? 'is-off' : ''}">${num(c.count)}</b>/${num(p.planned)}</span><div class="t-source">${c.source === 'driver' ? 'דיווח נהג' : 'משוער'}</div>`
      : `<span class="num">${num(p.planned)}</span> צפויים`;
    const when = today && i <= d ? `עברה · ${esc(p.time ?? '')}` : moving && i === d + 1 && t.live.lateMinutes ? `צפויה ב־${eta(p)} <span class="t-late">(+${t.live.lateMinutes})</span>` : esc(p.time ?? '');
    const row = `<li class="${cls}"><span class="t-dot ${p.kind === 'school' ? 'is-school' : ''}">${label}</span><span><b>${esc(p.name)}</b><small>${when}${p.located ? '' : ' · מיקום לא ידוע'}</small></span><span class="t-count-cell">${count}</span></li>`;
    const here = moving && i === d ? `<li class="is-here"><span class="t-dot is-bus">${I.bus}</span><span><b>האוטובוס כאן</b><small>בדרך ל${esc(t.points[d + 1]?.name ?? '')}${t.points[d + 1]?.time ? ` · צפוי ב־${eta(t.points[d + 1])}` : ''}</small></span><span></span></li>` : '';
    return row + here;
  }).join('');
  const blocked = today && t.live.blockedReason && t.live.phase === 'pending';
  return `${road.length ? `<div class="t-insp-alerts">${road.map(alertCard).join('')}</div>` : ''}
    ${blocked && !road.length ? `<ul class="t-issues is-bad"><li><b>לא תצא:</b> ${esc(t.live.blockedReason)}</li></ul>` : ''}
    ${!today && t.blockers.length ? `<ul class="t-issues is-bad">${t.blockers.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    ${t.checks.length ? `<ul class="t-issues">${t.checks.map(i => `<li>לבירור בקובץ: ${esc(i)}</li>`).join('')}</ul>` : ''}
    <div class="t-people">
      <div class="t-person">${I.user}<span><b>${esc(t.driverName)}</b><small dir="ltr">${esc(t.driverContact ?? '')}</small></span>${t.driverContact ? `<a class="t-btn is-sm" href="tel:${esc(t.driverContact)}" data-call="${esc(t.driverName)}|${esc(t.driverContact)}">${I.call} להתקשר</a>` : ''}</div>
      <div class="t-person">${I.bus}<span><b>${esc(t.vehicleName)}</b><small>${t.capacity ? `${num(t.capacity)} מקומות` : 'מספר מקומות לא ידוע'}</small></span><button class="t-btn is-sm is-ghost" data-itab="assign">החלפה</button></div>
    </div>
    <div class="t-actions"><button class="t-btn" data-act="compose" aria-expanded="${S.composing}">${I.msg} הודעה לנהג</button></div>
    ${S.composing ? `<form class="t-composer" data-form="note">
      <label class="sr-only" for="note-text">הודעה ל${esc(t.driverName)}</label>
      <textarea id="note-text" placeholder="ההודעה תופיע בטלפון של ${esc(firstName(t.driverName))}" maxlength="300">${esc(S.draft)}</textarea>
      <div class="t-actions"><button class="t-btn is-primary is-sm" type="submit">${I.send} שליחה</button><button class="t-btn is-sm is-ghost" type="button" data-act="compose">ביטול</button></div>
    </form>` : ''}
    <h3 class="t-insp-h">תחנות</h3>
    <ol class="t-timeline">${stops}</ol>`;
}
function mapTab(t) {
  const today = S.insp.date === TODAY;
  const src = today && t.live.mode === 'manual' ? 'דיווחי הנהג מהטלפון' : 'לוח הזמנים (עד לחיבור GPS)';
  return `<div class="t-insp-map" id="insp-map"></div>
    <p class="t-source">מיקום האוטובוס לפי ${src}. ספירות התלמידים לפי דיווחי הנהג.</p>`;
}
async function mountInspMap(t) {
  S.inspMap?.destroy?.();
  const el = $('#insp-map');
  const config = S.config ?? (S.config = await fetch('/api/workspace/config').then(r => r.json()).catch(() => ({})));
  S.inspMap = await mountTransportMap(el, { config, onSelect: () => {}, focus: t.id }).catch(e => { el.innerHTML = `<p class="t-empty">${esc(e.message)}</p>`; return null; });
  S.inspMap?.update?.(dataFor(S.insp.date), t.id);
}
function assignTab(t, d) {
  const editable = editableTrip(t, S.insp.date);
  if (!editable) return `<div class="t-calm">${I.check}<b>הנסיעה כבר יצאה</b><span>אי אפשר לשנות נהג, רכב או תחנות אחרי היציאה.</span></div>
    <div class="t-people"><div class="t-person">${I.user}<span><b>${esc(t.driverName)}</b></span></div><div class="t-person">${I.bus}<span><b>${esc(t.vehicleName)}</b></span></div></div>`;
  const date = S.insp.date;
  const driverOk = x => x.available !== false && x.licenseUntil >= date;
  const busOk = v => v.available !== false && v.testUntil >= date && (v.capacity == null || v.capacity >= (t.planned || 0));
  const rank = ok => (a, b) => (b.id === t.driverId || b.id === t.vehicleId) - (a.id === t.driverId || a.id === t.vehicleId) || ok(b) - ok(a);
  const driverOpt = x => `<option value="${x.id}" ${x.id === t.driverId ? 'selected' : ''}>${esc(x.name)}${x.routeCode ? ` · קו ${esc(x.routeCode)}` : ' · חלופי'}${driverOk(x) ? '' : ' · רישיון פג'}</option>`;
  const busOpt = v => `<option value="${v.id}" ${v.id === t.vehicleId ? 'selected' : ''}>${esc(v.label)}${v.capacity ? ` · ${v.capacity} מקומות` : ''}${v.testUntil < date ? ' · טסט פג' : v.capacity != null && v.capacity < (t.planned || 0) ? ' · קטן מדי' : ''}</option>`;
  return `<div id="stale">${S.stale ? '<div class="t-stale"><span>מישהו שינה את הנסיעה בינתיים.</span><button class="t-btn is-sm" data-act="reload">טעינה מחדש</button></div>' : ''}</div>
    ${t.blockers.length ? `<ul class="t-issues is-bad">${t.blockers.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<ul class="t-issues is-ok"><li>${t.published ? 'מוכנה ופורסמה לנהג' : 'מוכנה לפרסום'}</li></ul>`}
    <div class="t-field"><label for="f-driver">נהג · המתאימים ראשונים</label><select id="f-driver" class="t-select">${[...d.drivers].sort(rank(driverOk)).map(driverOpt).join('')}</select></div>
    <div class="t-field"><label for="f-bus">רכב · המתאימים ראשונים</label><select id="f-bus" class="t-select">${[...d.vehicles].sort(rank(busOk)).map(busOpt).join('')}</select></div>
    <div class="t-field"><span class="t-label">תחנות · שעה · תלמידים</span>
      <div class="t-stops-edit">${t.stops.map((s, i) => `<div><span>${esc(s.name)}</span><input data-stop-time="${i}" value="${esc(s.time)}" inputmode="numeric" aria-label="שעה ב${esc(s.name)}"><input data-stop-count="${i}" type="number" min="0" value="${esc(s.planned ?? '')}" aria-label="תלמידים ב${esc(s.name)}"></div>`).join('')}</div>
    </div>
    <p class="t-source">כל שינוי מגיע לנהג רק אחרי פרסום.</p>`;
}
function assignFoot(t) {
  const done = t.published && !t.blockers.length;
  return `<footer class="t-insp-foot">
    <button class="t-btn is-primary" id="save-publish" data-act="save-publish" ${!done || S.dirty ? '' : 'disabled'}>${done && !S.dirty ? `${I.check} פורסמה לנהג` : 'שמירה ופרסום לנהג'}</button>
    <button class="t-btn is-ghost" data-act="save-draft" ${S.dirty ? '' : 'disabled'}>שמירה בלי לפרסם</button>
  </footer>`;
}
function logTab(t) {
  const events = [...(t.events ?? [])].reverse();
  return `<ul class="t-feed">${events.map(e => `<li><span class="t-who ${e.source === 'driver' ? 'is-driver' : ''}" aria-hidden="true">${esc((e.actor || '?')[0])}</span><span><b>${esc(e.actor)}</b> <small>${e.source === 'driver' ? 'נהג' : 'סדרן'}</small><br>${esc(e.text)}</span></li>`).join('') || '<li class="t-empty">הנהג עוד לא דיווח בנסיעה הזו. המיקום והספירות כאן לפי לוח הזמנים.</li>'}</ul>`;
}
async function saveRide(publish) {
  const date = S.insp.date;
  const t = dataFor(date).trips.find(x => x.id === S.insp.id);
  const driverId = $('#f-driver').value;
  const vehicleId = $('#f-bus').value;
  const stops = t.stops.map((s, i) => ({ name: s.name, time: $(`[data-stop-time="${i}"]`).value.trim(), planned: Number($(`[data-stop-count="${i}"]`).value) }));
  const latest = async () => (await loadDay(date)).trips.find(x => x.id === t.id);
  if (driverId !== t.driverId || vehicleId !== t.vehicleId) await command('assign', { driverId, vehicleId }, t, date);
  if (stops.some((s, i) => s.time !== t.stops[i].time || s.planned !== t.stops[i].planned)) {
    await command('edit', { departure: stops[0]?.time && t.direction === 'morning' ? stops[0].time : t.departure, stops }, await latest(), date);
  }
  S.dirty = false; S.stale = false;
  const fresh = await latest();
  if (publish) {
    if (fresh.blockers.length) { repaint(); throw new Error(`נשמר בלי פרסום. קודם צריך לטפל ב: ${fresh.blockers[0]}`); }
    if (!fresh.published) await command('publish', {}, fresh, date);
    await loadDay(date);
  }
  repaint();
}

// ------------------------------------------------------------ the live map, one click away
async function openMap() {
  if (S.rec) { S.rec = null; paintRecord(); }
  S.mapOpen = true; S.mapF ??= 'moving'; S.mapQ = ''; S.mapSel = null;
  $('#mapfull').innerHTML = `<div class="t-mapfull" role="dialog" aria-modal="true" aria-label="מפה חיה">
    <header><h2>${I.map} מפה חיה</h2><span id="map-meta" class="t-source"></span><span class="t-spacer"></span>
      <button class="t-btn" data-act="close-map">${I.x} יציאה מהמפה <kbd class="t-kbd">Esc</kbd></button></header>
    <div class="t-mapfull-canvas"><div id="map" class="t-map-fill"></div>
      <aside class="t-mapside" aria-label="נסיעות על המפה" id="map-side"></aside>
      <div class="t-mapctl" role="group" aria-label="שליטה במפה">
        <button class="t-mapbtn" data-mapz="1" aria-label="הגדלה">+</button>
        <button class="t-mapbtn" data-mapz="-1" aria-label="הקטנה">−</button>
        <button class="t-mapbtn is-wide" data-act="map-fit">כל האוטובוסים</button>
        <button class="t-mapbtn is-wide" data-act="map-golan">כל הגולן</button>
      </div>
      <div class="t-maplegend"><span><i style="background:var(--accent)"></i>בדרך</span><span><i style="background:var(--bad)"></i>מאחר</span><span><i class="is-dashed"></i>עוד לא יצא</span><span><i class="is-cluster">3</i>כמה יחד, לחיצה מקרבת</span></div>
      <div class="t-mapcard" id="map-card" hidden></div>
    </div></div>`;
  paintMapSide();
  const config = S.config ?? (S.config = await fetch('/api/workspace/config').then(r => r.json()).catch(() => ({})));
  S.map = await mountTransportMap($('#map'), { config, onSelect: id => mapSelect(id) }).catch(e => (toast(e.message, { bad: true }), null));
  mapUpdate();
  setTimeout(() => S.map?.fitBuses?.(), 400);
  $('[data-act=close-map]')?.focus();
}
const mapTrips = () => (S.data?.trips ?? []).filter(t => S.mapF === 'all' ? true : S.mapF === 'late' ? ['delayed', 'late'].includes(t.status) : ['active', 'delayed'].includes(t.status));
function mapUpdate() { if (!S.map?.ready) return; S.map.update({ ...S.data, trips: S.mapF === 'all' ? S.data.trips : mapTrips() }, S.mapSel); }
function paintMapSide() {
  const el = $('#map-side'); if (!el) return;
  const all = S.data.trips;
  const n = { moving: all.filter(t => ['active', 'delayed'].includes(t.status)).length, late: all.filter(t => ['delayed', 'late'].includes(t.status)).length, all: all.length };
  const q = (S.mapQ ?? '').trim();
  $('#map-meta').textContent = `${num(n.moving)} בדרך · ${num(n.late)} מאחרים · מיקום לפי לוח הזמנים, ולפי הטלפון בקו 10`;
  el.innerHTML = `<label class="t-search-field">${I.search}<span class="sr-only">חיפוש נסיעה</span><input id="map-q" type="search" placeholder="קו, בית ספר או נהג" value="${esc(q)}"></label>
    <div class="t-filters">${[['moving', 'בדרך'], ['late', 'מאחרים'], ['all', 'כל היום']].map(([k, l]) => `<button class="t-filter" data-mapf="${k}" aria-pressed="${S.mapF === k}">${l} <span class="num">${num(n[k])}</span></button>`).join('')}</div>
    <div class="t-maplist" id="map-list"></div>`;
  paintMapList();
}
function paintMapList() {
  const el = $('#map-list'); if (!el) return;
  const q = (S.mapQ ?? '').trim();
  const pool = q ? S.data.trips : mapTrips();
  const list = pool.filter(t => !q || `${t.routeCode} ${t.school} ${t.driverName}`.includes(q)).sort((a, b) => b.live.lateMinutes - a.live.lateMinutes || a.departure.localeCompare(b.departure));
  el.innerHTML = `${q && S.mapF !== 'all' ? '<p class="t-source t-map-note">מחפש בכל נסיעות היום</p>' : ''}${list.map(t => `<button class="t-maprow ${S.mapSel === t.id ? 'is-on' : ''}" data-mapsel="${t.id}"><span class="t-code">${esc(t.routeCode)}</span><span><b>${esc(t.school)}</b><small>${esc(t.driverName)} · ${esc(t.departure)}${t.live.lateMinutes ? ` · ${t.live.lateMinutes} דק׳ איחור` : ''}</small></span>${pill(t.status)}</button>`).join('') || '<p class="t-empty">אין נסיעות כאלה כרגע.</p>'}`;
}
function mapSelect(id) {
  S.mapSel = id; S.map?.focusOn?.(id); paintMapSide();
  const t = S.data.trips.find(x => x.id === id); const card = $('#map-card'); if (!card || !t) return;
  card.hidden = false;
  card.innerHTML = `<div class="t-mapcard-top"><span class="t-code">${esc(t.routeCode)}</span><b>${esc(t.school)}</b>${pill(t.status)}<button class="t-icon-btn" data-act="map-unsel" aria-label="ביטול הבחירה">${I.x}</button></div>
    <small>${['upcoming', 'blocked'].includes(t.status) ? (() => { const m = minutes(t.departure) - minutes(S.data.clock); return `<b class="t-mapcard-when">${m > 0 ? `יוצא ב־${esc(t.departure)}, בעוד ${m >= 60 ? `${Math.floor(m / 60)} ש׳ ו־${m % 60} דק׳` : `${num(m)} דק׳`}` : `היה אמור לצאת ב־${esc(t.departure)}`}</b> · `; })() : ''}${esc(t.driverName)} · ${esc(t.vehicleName)}${t.live.boarded != null ? ` · ${num(t.live.boarded)}/${num(t.planned)} תלמידים` : ''}</small>
    ${progress(t)}
    <div class="t-actions"><button class="t-btn is-primary is-sm" data-ride="${t.id}">פתיחת הנסיעה</button>${t.driverContact ? `<a class="t-btn is-sm" href="tel:${esc(t.driverContact)}" data-call="${esc(t.driverName)}|${esc(t.driverContact)}">${I.call} להתקשר</a>` : ''}</div>`;
}
function closeMap() { S.mapSel = null; S.mapOpen = false; S.map?.destroy?.(); S.map = null; $('#mapfull').innerHTML = ''; }

// ------------------------------------------------------------ plan builder: rides first, then a crew (driver + bus) for each
// The rides already exist: the council's workbook is a weekly schedule, and every ride carries its route's
// regular crew. Planning a day means finding the rides whose crew can't run them and giving them one.
// Month: what each day needs. Week: the fixed schedule and the regular crews. Day: allocate and publish.
const span = t => { const ms = t.stops.map(x => (/^\d\d:\d\d$/.test(x.time || '') ? minutes(x.time) : -1)).filter(m => m >= 0); const s = Math.min(minutes(t.departure), ...ms); return [s, Math.max(s + 5, ...ms)]; };
const editableTrip = (t, date) => t.phase === 'pending' && (date !== TODAY || t.live.phase === 'pending');
const overlaps = (a, b) => span(a)[0] < span(b)[1] && span(b)[0] < span(a)[1];
const away = (r, date) => (r.away ?? []).some(x => x.from <= date && date <= x.to);
function driverState(x, t, date, d) {
  if (x.archived) return 'הוסר מהצי';
  if (x.available === false) return 'סומן כלא זמין';
  if (away(x, date)) return 'בהיעדרות';
  if (!x.licenseUntil || x.licenseUntil < date) return 'הרישיון פג';
  const clash = d.trips.find(o => o.id !== t.id && o.driverId === x.id && overlaps(o, t));
  return clash ? `נוסע בקו ${clash.routeCode} ב־${clash.departure}` : '';
}
function busState(v, t, date, d) {
  if (v.archived) return 'הוסר מהצי';
  if (v.available === false) return 'מושבת';
  if (away(v, date)) return 'מושבת בתאריך הזה';
  if (!v.testUntil || v.testUntil < date) return 'הטסט פג';
  if (!v.serviceDue || v.serviceDue < date) return 'לא עבר טיפול';
  if (v.capacity != null && v.capacity < (t.planned || 0)) return `${v.capacity} מקומות ל־${t.planned} תלמידים`;
  const clash = d.trips.find(o => o.id !== t.id && o.vehicleId === v.id && overlaps(o, t));
  return clash ? `נוסע בקו ${clash.routeCode} ב־${clash.departure}` : '';
}
// What stops a ride from running with its crew today: the crew itself, or two rides at once.
function rideProblem(t, date, d) {
  if (!editableTrip(t, date)) return null;
  const drv = d.drivers.find(x => x.id === t.driverId);
  const bus = d.vehicles.find(x => x.id === t.vehicleId);
  const dp = drv ? driverState(drv, t, date, d) : 'אין נהג';
  const bp = bus ? busState(bus, t, date, d) : 'אין רכב';
  const sameRoute = msg => /נוסע בקו/.test(msg) && msg.includes(`בקו ${t.routeCode} `);
  if (dp && !sameRoute(dp)) return { who: 'driver', text: drv ? `${drv.name}: ${dp}` : dp };
  if (bp && !sameRoute(bp)) return { who: 'bus', text: bus ? `${bus.label}: ${bp}` : bp };
  if ((dp && sameRoute(dp)) || (bp && sameRoute(bp))) return { who: 'file', text: `בקובץ יש שתי נסיעות של קו ${t.routeCode} באותה שעה` };
  return null;
}
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const monthStart = (iso, add = 0) => { const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + add); return d.toISOString().slice(0, 10); };
async function loadMonth() {
  S.plan.monthAt ??= monthStart(S.plan.day);
  const cur = monthStart(TODAY);
  const [m, c] = await Promise.all([api(`/api/transport/month?date=${S.plan.monthAt}`), S.plan.monthAt === cur ? null : api(`/api/transport/month?date=${cur}`)]);
  S.plan.month = m; S.plan.cur = c ?? m;
}
async function shiftMonth(n) {
  const next = monthStart(S.plan.monthAt ?? S.plan.day, n);
  if (next < monthStart(TODAY) || next > monthStart(TODAY, 8)) return;
  S.plan.monthAt = next; S.plan.month = null; S.mday = null; paintMonthDay(); paintPlanner(); await loadMonth(); paintPlanner();
}
async function loadSuggestions(date) {
  try {
    const r = await api(`/api/transport/assistant?date=${date}`);
    const map = new Map();
    for (const p of r.proposals) if (p.tone === 'fix' && p.apply) for (const a of p.apply.assignments) if (a.driverId || a.vehicleId) map.set(a.tripId, { ...a, proposal: p.id, title: p.title });
    S.plan.suggest = map; S.plan.proposals = r.proposals.filter(p => p.tone === 'fix' && p.apply); S.plan.all = r.proposals;
  } catch { S.plan.suggest = new Map(); S.plan.proposals = []; S.plan.all = []; }
}
// ---- the planner's main screen: what needs solving on a day, one card per cause, one obvious fix each
function plannerPage() {
  return `<div class="t-page t-page-full t-inbox-page">
    <header class="t-page-head">
      <div><h1>סידור</h1><p>מה צריך לסדר בימים הקרובים</p></div>
      <div class="t-spacer"></div>
      <button class="t-btn" data-act="change">${I.plus} משהו השתנה</button>
    </header>
    <nav class="t-days" id="plan-days" aria-label="ימים"></nav>
    <div class="t-subhead" id="plan-sub" hidden><button class="t-link" data-pview="fix">${I.back} חזרה לסידור</button><span id="plan-meta"></span></div>
    <div class="t-plan-body" id="plan-body"><p class="t-empty">טוען…</p></div>
  </div>`;
}
function paintDays() {
  const el = $('#plan-days');
  if (!el) return;
  const m = new Map((S.plan.cur ?? S.plan.month ?? []).map(x => [x.date, x]));
  el.innerHTML = DAYS.map(x => { const s = m.get(x.date); const n = s?.issues ?? null; return `<button class="t-daytab ${S.plan.day === x.date && S.plan.view === 'fix' ? 'is-on' : ''}" data-pgo="${x.date}"><b>${x.date === TODAY ? 'היום' : x.date === TOMORROW ? 'מחר' : x.label}</b><small>${heDate(x.date)}</small><span>${n == null ? '' : s.noSchool ? '<i class="t-pill">אין הסעות</i>' : n ? `<i class="t-pill is-bad">${num(n)} ${n === 1 ? 'בעיה' : 'בעיות'}</i>` : '<i class="t-pill is-ok">מוכן</i>'}</span></button>`; }).join('')
    + `<span class="t-spacer"></span><button class="t-link" data-pview="month">כל החודש</button><button class="t-link" data-pview="week">הסידור הקבוע</button>`;
}
function paintPlanner() {
  const el = $('#plan-body');
  if (!el) return;
  paintDays();
  const sub = $('#plan-sub'); if (sub) sub.hidden = S.plan.view === 'fix';
  if (S.plan.view === 'month') return paintMonth(el);
  if (S.plan.view === 'week') return paintWeek(el);
  if (S.plan.view === 'all') return paintDayPlan(el);
  return paintInbox(el);
}
// Same rule as the engine's issueKeyFor: one problem per driver, per bus, or per route short of seats.
function issueKey(t) {
  const list = t.blockers ?? [];
  if (!list.length || t.phase !== 'pending') return null;
  if (list.some(x => /נהג/.test(x))) return `driver-${t.driverId || 'none'}`;
  if (list.some(x => /רכב|טסט/.test(x) && !/מקומות/.test(x))) return `bus-${t.vehicleId || 'none'}`;
  if (list.some(x => /מקומות/.test(x))) return `seats-${t.routeCode}`;
  return `trip-${t.id}`;
}
function causes(date) {
  const d = dataFor(date);
  if (!d) return [];
  const groups = new Map();
  for (const t of [...d.trips].sort((a, b) => a.departure.localeCompare(b.departure))) { const k = issueKey(t); if (k) (groups.get(k) ?? groups.set(k, []).get(k)).push(t); }
  const props = date === S.plan.day ? (S.plan.all ?? []) : [];
  return [...groups.entries()].map(([key, rides]) => {
    const t = rides[0];
    if (key.startsWith('seats-')) {
      const ps = props.filter(p => p.id.startsWith('seats-') && rides.some(r => (p.tripIds ?? []).includes(r.id)));
      return { key, res: 'bus', head: `קו ${t.routeCode}: יותר תלמידים ממקומות ב${t.vehicleName}`, rides, applies: ps.length === rides.length && ps.every(p => p.apply) ? ps.map(p => p.apply) : [], recWhy: '' };
    }
    if (key.startsWith('trip-')) return { key, res: null, head: `קו ${t.routeCode} · ${t.departure}: ${t.blockers[0]}`, rides, applies: [], recWhy: t.blockers.join(' · ') };
    const p = props.find(x => x.id === key);
    const res = key.startsWith('bus-') ? 'bus' : 'driver';
    const rec = res === 'bus' ? d.vehicles.find(v => v.id === t.vehicleId) : d.drivers.find(x => x.id === t.driverId);
    const head = p ? p.why.split('. ')[0].replace(/\.$/, '') : `${rec ? (res === 'bus' ? rec.label : rec.name) : res === 'bus' ? 'אין רכב' : 'אין נהג'}: ${t.blockers.find(x => (res === 'bus' ? /רכב|טסט|טיפול/ : /נהג/).test(x)) ?? t.blockers[0]}`;
    return { key, res, head, rides, applies: p?.apply ? [p.apply] : [], recWhy: p ? p.why.split('. ').slice(1).join('. ') : '' };
  }).sort((a, b) => b.rides.length - a.rides.length);
}
function causeChip(c, d) {
  const m = /^(bus|driver)-(.+)$/.exec(c.key);
  const rec = m ? (m[1] === 'bus' ? d.vehicles : d.drivers).find(x => x.id === m[2]) : null;
  const name = rec ? (m[1] === 'bus' ? rec.label : rec.name) : c.key.startsWith('seats-') ? `קו ${c.key.slice(6)}` : `קו ${c.rides[0].routeCode}`;
  const what = c.key.startsWith('seats-') ? 'מקומות' : rec ? recStatus(rec, m[1] === 'driver', S.plan.day)[0].replace(/ עד .*| מ־.*/, '') : 'לבדיקה';
  return `${avatar(name, c.res === 'bus')}<span><b>${esc(name)}</b><small>${esc(what === 'זמין' ? 'לא יכול לצאת' : what)} · ${num(c.rides.length)}</small></span>`;
}
function causeHead(c, date, d) {
  const m = /^(bus|driver)-(.+)$/.exec(c.key);
  const rec = m ? (m[1] === 'bus' ? d.vehicles : d.drivers).find(x => x.id === m[2]) : null;
  const week = causeWeek(c, date);
  const n = `${num(c.rides.length)} ${c.rides.length === 1 ? 'נסיעה' : 'נסיעות'} ${dayWord(date)}${week.length > 1 ? ` · ${num(week.reduce((a, x) => a + x.rides.length, 0))} השבוע` : ''}`;
  if (!rec) return `<header class="t-cause-head">${avatar('', c.res === 'bus')}<span><b>${esc(c.head)}</b><small>${n}</small></span>${c.key.startsWith('seats-') ? '<span class="t-pill is-warn">חסרים מקומות</span>' : ''}</header>`;
  const people = m[1] === 'driver';
  const st = recStatus(rec, people, date);
  const routes = [...new Set(c.rides.map(t => t.routeCode))];
  return `<header class="t-cause-head">${avatar(people ? rec.name : rec.label, !people)}<span><b><button class="t-link-plain" data-rec-open="${people ? 'drivers' : 'vehicles'}:${esc(rec.id)}">${esc(people ? rec.name : rec.label)}</button></b><small>${routes.length === 1 ? `קו ${esc(routes[0])} · ` : ''}${n}</small></span>${statusPill(st[1] === 'is-ok' ? ['לא יכול לצאת', 'is-bad'] : st)}</header>`;
}
function paintInbox(el) {
  const date = S.plan.day;
  const d = dataFor(date);
  if (!d) { el.innerHTML = '<p class="t-empty">טוען…</p>'; return; }
  const list = causes(date);
  const affected = new Set(list.flatMap(c => c.rides.map(t => t.id))).size;
  const done = (S.plan.done ?? []).filter(x => x.date === date);
  const drafts = d.trips.filter(t => !t.published && editableTrip(t, date) && !t.blockers.length);
  const know = (S.plan.all ?? []).filter(p => p.tone === 'info' && ['expiring', 'checks'].includes(p.id));
  const rideList = rides => rides.slice(0, 6).map(t => `<span class="t-tag num">קו ${esc(t.routeCode)} · ${esc(t.departure)}</span>`).join('') + (rides.length > 6 ? `<span class="t-tag">ועוד ${num(rides.length - 6)}</span>` : '');
  const recs = list.filter(c => c.res && causeOptions(c, date, d)[0]?.rec).length;
  const total = list.length + done.length;
  el.innerHTML = `${tip('plan', 'רק מה שצריך לסדר', 'כל הנסיעות כבר בנויות מהסידור הקבוע, כמו באקסל. כאן מופיעים רק נהגים ורכבים שלא יכולים לצאת. לכל אחד מסומן מחליף מומלץ: מאשרים, והנהג מקבל הודעה.')}
    <section class="t-dstatus ${list.length ? 'is-open' : 'is-ok'}">
      <div class="t-dstatus-text">${list.length ? `<b>${num(list.length)} ${list.length === 1 ? 'בעיה לסדר' : 'בעיות לסדר'} ${dayWord(date)}</b><span>${num(affected)} נסיעות צריכות נהג או רכב אחר · ${num(d.trips.length - affected)} האחרות מוכנות עם הצוות הקבוע</span>`
        : `<b>${I.check} ${dayWord(date)} מוכן</b><span>כל ${num(d.trips.length)} הנסיעות יוצאות עם נהג ורכב שיכולים לצאת.</span>`}
      ${total ? `<div class="t-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done.length}" aria-label="טופלו ${done.length} מתוך ${total}"><i style="width:${Math.round(100 * done.length / total)}%"></i></div><small>${num(done.length)} מתוך ${num(total)} טופלו</small>` : ''}</div>
      ${recs > 1 ? `<button class="t-btn" data-act="approve-all">${I.check} אישור כל ההמלצות (${num(recs)})</button>` : ''}
    </section>
    ${list.length ? (() => {
      const i = Math.min(S.plan.ci ?? 0, list.length - 1); S.plan.ci = i;
      const c = list[i];
      return `<nav class="t-cnav" aria-label="הבעיות ${dayWord(date)}">${list.map((x, k) => `<button class="t-cchip ${k === i ? 'is-on' : ''}" data-ci="${k}" aria-current="${k === i}">${causeChip(x, d)}</button>`).join('')}</nav>
      <div class="t-carousel">
        <button class="t-cnext" data-ci="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="הבעיה הקודמת">${I.chev}</button>
        <article class="t-cause" data-cause="${esc(c.key)}">
          ${S.plan.solved ? `<p class="t-solved" role="status">${I.check} ${esc(S.plan.solved)}. ${list.length ? 'הבעיה הבאה:' : ''}</p>` : ''}
          <p class="t-cpos">בעיה ${num(i + 1)} מתוך ${num(list.length)}</p>
          ${causeHead(c, date, d)}
          <div class="t-tags">${rideList(c.rides)}</div>
          ${c.res ? optionsBlock(c, date, d, 'plan') : `<p class="t-norec">${esc(c.recWhy)}</p><div class="t-actions"><button class="t-btn" data-pview="all">לרשימת הנסיעות</button></div>`}
        </article>
        <button class="t-cnext is-next" data-ci="${i + 1}" ${i >= list.length - 1 ? 'disabled' : ''} aria-label="הבעיה הבאה">${I.chev}</button>
      </div>`; })() : ''}
    <div class="t-causes">
      ${drafts.length ? `<article class="t-cause is-quiet"><header><b>${num(drafts.length)} שינויים שעוד לא נשלחו לנהגים</b></header><div class="t-actions"><button class="t-btn is-primary" data-act="publish-drafts">שליחה לנהגים</button></div></article>` : ''}
    </div>
    ${done.length ? `<section class="t-done"><h3>טופל ${dayWord(date)}</h3>${done.map((x, i) => `<div class="t-done-row"><span>${I.check} ${esc(x.text)}</span><button class="t-link" data-undo-done="${i}">ביטול</button></div>`).join('')}</section>` : ''}
    ${know.length ? `<section class="t-know">${know.map(p => `<p>${esc(p.id === 'checks' ? `${p.title.match(/\d+/)?.[0] ?? ''} נסיעות מסומנות בקובץ המועצה לבירור (שם תחנה או מספר תלמידים). הן יוצאות כרגיל` : p.title)}. <button class="t-link" data-prop-know="${esc(p.id)}">${p.id === 'expiring' ? 'לנהגים ולרכבים' : 'לרשימה'}</button></p>`).join('')}</section>` : ''}
    <p class="t-grid-foot"><button class="t-link" data-pview="all">כל ${num(d.trips.length)} הנסיעות ${dayWord(date)}</button></p>`;
}
function causeByKey(key) { return causes(S.plan.day).find(c => c.key === key); }
// A driver or bus problem usually isn't one day's problem: the same licence is expired all week.
function causeWeek(c, date = S.plan.day) {
  const m = /^(bus|driver)-(.+)$/.exec(c.key);
  if (!m || !DAYS.some(x => x.date === date)) return [{ date, rides: c.rides }];
  const field = m[1] === 'bus' ? 'vehicleId' : 'driverId';
  return DAYS.filter(x => x.date >= date).map(x => {
    const d = x.date === date ? dataFor(date) : S.week[x.date];
    if (x.date === date) return { date, rides: c.rides };
    if (!d) return null;
    const rides = d.trips.filter(t => issueKey(t) === c.key);
    return rides.length ? { date: x.date, rides } : null;
  }).filter(Boolean);
}
const dayShort = date => (date === TODAY ? 'היום' : date === TOMORROW ? 'מחר' : dayOf(date).label);
function causeRecord(c, date = S.plan.day) {
  const m = /^(bus|driver)-(.+)$/.exec(c.key); const d = dataFor(date);
  if (!m || !d) return null;
  const rec = (m[1] === 'bus' ? d.vehicles : d.drivers).find(x => x.id === m[2]);
  if (!rec) return null;
  const away = (rec.away ?? []).find(a => a.from <= date && date <= a.to);
  return { rec, name: m[1] === 'bus' ? rec.label : rec.name, bus: m[1] === 'bus', away, lasting: !away };
}
// The choices for "how long", best first: a lasting problem holds until it's fixed; an absence holds for its days.
function scopesFor(c, date = S.plan.day) {
  if (!/^(bus|driver)-/.test(c.key)) return [];
  const r = causeRecord(c, date); const week = causeWeek(c, date);
  const weekN = week.reduce((a, x) => a + x.rides.length, 0);
  const what = r?.bus ? (/טסט/.test(c.head) ? 'הטסט יחודש' : 'הרכב יחזור') : /רישיון/.test(c.head) ? 'הרישיון יחודש' : 'הנהג יחזור';
  const out = [];
  if (r?.lasting) out.push({ id: 'until', label: 'עד שזה יסודר', note: `בכל הימים מעכשיו, עד ש${what}` });
  if (week.length > 1) out.push({ id: 'week', label: r?.away ? `בכל ימי ההיעדרות · ${num(weekN)}` : `רק השבוע · ${num(weekN)}`, note: `בימים: ${week.map(x => dayShort(x.date)).join(', ')}` });
  out.push({ id: 'day', label: `רק ${dayWord(date)} · ${num(c.rides.length)}`, note: `רק ${dayWord(date)}. בשאר הימים זה יישאר לסידור.` });
  return out;
}
function scopeOf(key, c) { return S.optScope[key] ?? scopesFor(c)[0]?.id ?? 'day'; }
async function applyOption(c, id, scope, date) {
  const field = c.res === 'bus' ? 'vehicleId' : 'driverId';
  const days = scope === 'day' ? [{ date, rides: c.rides }] : causeWeek(c, date);
  const done = []; const skipped = [];
  for (const x of days) {
    const d = dataFor(x.date) ?? await loadDay(x.date);
    const rec = (c.res === 'bus' ? d.vehicles : d.drivers).find(r => r.id === id);
    const free = x.date === date || (rec && x.rides.every(t => !(c.res === 'bus' ? busState(rec, t, x.date, d) : driverState(rec, t, x.date, d))));
    if (!free) { skipped.push(x.date); continue; }
    done.push({ date: x.date, before: x.rides.map(t => ({ tripId: t.id, driverId: t.driverId, vehicleId: t.vehicleId })), n: x.rides.length });
    await command('plan', { assignments: x.rides.map(t => ({ tripId: t.id, [field]: id })), publish: true, reason: c.head }, null, x.date);
    await loadDay(x.date);
  }
  const routes = [...new Set(c.rides.map(t => t.routeCode))];
  const tplBefore = ['regular', 'until'].includes(scope) ? routes.map(code => ({ routeCode: code, ...(S.data.template?.[code] ?? {}) })) : [];
  if (['regular', 'until'].includes(scope)) for (const code of routes) await command('template', { routeCode: code, [field]: id }, null, TODAY);
  const undo = async () => {
    for (const t of tplBefore) await command('template', t, null, TODAY);
    for (const x of done) { await command('plan', { assignments: x.before, publish: true, reason: 'בוטל' }, null, x.date); await loadDay(x.date); }
  };
  return { n: done.reduce((a, x) => a + x.n, 0), days: done.length, skipped, undo };
}
// ---- every viable option for a cause, the recommended one first and pre-selected; the button names the action
// "What will happen": the chosen option and scope, said as plain outcomes before anyone presses the button.
function whatHappens(c, sel, offSel, scope, date, d) {
  const bus = c.res === 'bus';
  const days = scope === 'day' ? [{ date, rides: c.rides }] : causeWeek(c, date);
  const ok = []; const skip = [];
  for (const x of days) {
    const dd = dataFor(x.date); const rec = dd && (bus ? dd.vehicles : dd.drivers).find(r => r.id === sel.id);
    const free = offSel || x.date === date || (rec && x.rides.every(t => !(bus ? busState(rec, t, x.date, dd) : driverState(rec, t, x.date, dd))));
    (free ? ok : skip).push(x);
  }
  const n = ok.reduce((a, x) => a + x.rides.length, 0);
  const rec = (bus ? d.vehicles : d.drivers).find(r => r.id === sel.id);
  const lines = [];
  if (offSel) lines.push(['bad', `${sel.label} לא מתאים: ${offSel.off}. הנסיעות יישארו מסומנות באדום עד שזה יסודר.`]);
  lines.push(['', `${sel.label} ${bus ? 'ייכנס ל־' : 'ייקח '}${num(n)} ${n === 1 ? 'נסיעה' : 'נסיעות'} ${ok.length > 1 ? `ב־${num(ok.length)} ימים: ${ok.map(x => dayShort(x.date)).join(', ')}` : dayWord(ok[0]?.date ?? date)}`]);
  if (skip.length) lines.push(['warn', `${skip.map(x => dayShort(x.date)).join(', ')}: ${sel.label} לא פנוי, ולכן זה יישאר לסידור באותם ימים`]);
  if (!bus && rec?.routeCode && !offSel) lines.push(['', `הוא נוהג גם בקו ${rec.routeCode}, בלי חפיפה בשעות`]);
  const most = Math.max(...c.rides.map(t => t.planned || 0));
  if (bus && rec?.capacity) lines.push(['', `${num(rec.capacity)} מקומות ל־${num(most)} תלמידים לכל היותר`]);
  if (bus && rec && !rec.capacity && most) lines.push(['warn', `מספר המקומות ב${rec.label} לא רשום. כדאי לוודא שיש מקום ל־${num(most)} תלמידים, או לעדכן בפרטי הרכב`]);
  if (scope === 'until') { const r = causeRecord(c, date); lines.push(['', `וגם בכל הימים שאחרי, עד שזה יסודר. החודש ייצא נקי מהבעיה הזו`]); lines.push(['', `כש${r?.bus ? 'הרכב' : 'הנהג'} יחזור, מחזירים אותו בסידור הקבוע של קו ${c.rides[0].routeCode}`]); }
  lines.push(['', bus ? 'הנהגים של הנסיעות יקבלו הודעה על הרכב החדש' : `${firstName(sel.label)} יקבל הודעה בטלפון ויתבקש לאשר`]);
  const left = causes(date).length - 1;
  lines.push(['ok', left ? `אחרי האישור יישארו ${num(left)} ${left === 1 ? 'בעיה' : 'בעיות'} ${dayWord(date)}` : `אחרי האישור ${dayWord(date)} מוכן`]);
  return `<div class="t-what" aria-live="polite"><b>מה יקרה</b><ul>${lines.map(([k, t]) => `<li class="${k ? `is-${k}` : ''}">${esc(t)}</li>`).join('')}</ul></div>`;
}
function causeOptions(c, date, d) {
  if (!c.res || !c.rides.length) return [];
  const per = c.rides.map(t => crewItems(c.res, t, date, d));
  const recId = c.applies[0]?.assignments?.[0]?.[c.res === 'bus' ? 'vehicleId' : 'driverId'];
  const most = Math.max(0, ...c.rides.map(t => t.planned || 0));
  const free = c.rides.length === 1 ? 'פנוי בשעה הזו' : `פנוי בכל ${c.rides.length} הנסיעות`;
  const seats = c.key.startsWith('seats-');
  const fits = x => !seats || ((d.vehicles.find(v => v.id === x.id)?.capacity ?? 0) >= most);
  const opts = per[0].filter(x => !x.current && fits(x) && per.every(list => { const y = list.find(z => z.id === x.id); return y && !y.why && !y.current; }))
    .map(x => {
      const r = (c.res === 'bus' ? d.vehicles : d.drivers).find(y => y.id === x.id) ?? {};
      const load = x.trips ? `עוד ${num(x.trips)} נסיעות ביום` : 'בלי נסיעות אחרות ביום';
      const bits = c.res === 'bus'
        ? [r.capacity ? `${num(r.capacity)} מקומות${most ? ` ל־${num(most)} תלמידים` : ''}` : 'מספר מקומות לא רשום', x.spare ? 'רכב חלופי' : load, free]
        : [x.spare ? 'נהג חלופי' : `נוהג בקו ${r.routeCode}`, load, free];
      const known = c.res !== 'bus' || Boolean(r.capacity) || !most;
      return { id: x.id, label: x.label, sub: bits.join(' · '), rec: x.id === recId && known, known };
    });
  opts.sort((a, b) => b.rec - a.rec || b.known - a.known);
  const off = per[0].filter(x => !x.current && !opts.some(o => o.id === x.id))
    .map(x => ({ id: x.id, label: x.label, off: per.map(l => l.find(z => z.id === x.id)?.why).find(Boolean) || (seats && !fits(x) ? (d.vehicles.find(v => v.id === x.id)?.capacity ? `${num(d.vehicles.find(v => v.id === x.id).capacity)} מקומות ל־${num(most)} תלמידים` : 'מספר המקומות לא רשום') : 'לא פנוי') }));
  return Object.assign(opts, { off });
}
function optionsBlock(c, date, d, scope, cancel = '') {
  const opts = causeOptions(c, date, d);
  const key = `${scope}|${c.key}`;
  const more = S.optMore[key];
  const plural = c.res === 'bus' ? 'הרכבים' : 'הנהגים';
  const offList = () => opts.off.map(o => `<label class="t-opt is-off ${o.id === S.opt[key] ? 'is-on' : ''}"><input type="radio" name="opt-${esc(key)}" value="${esc(o.id)}" data-opt="${esc(key)}" ${o.id === S.opt[key] ? 'checked' : ''}>
      <span><b>${esc(o.label)}</b><small>לא מתאים: ${esc(o.off)}</small></span></label>`).join('');
  const offSel = opts.off.find(o => o.id === S.opt[key]);
  const okBtn = (o, warn) => `<button class="t-btn is-primary" data-opt-ok="${esc(key)}" data-opt-id="${esc(o.id)}" ${warn ? `data-opt-warn="${esc(o.off)}"` : ''}>${I.check} ${warn ? 'שיבוץ בכל זאת' : 'אישור'}: ${esc(o.label)}</button>`;
  const who = c.res === 'bus' ? 'רכב' : 'נהג';
  const fixLink = /^(bus|driver)-/.test(c.key) ? (() => { const id = c.key.replace(/^(bus|driver)-/, ''); const kind = c.key.startsWith('bus-') ? 'vehicles' : 'drivers'; const what = /פג/.test(c.head) ? (kind === 'vehicles' ? 'הטסט חודש?' : 'הרישיון חודש?') : 'השתנה משהו?'; return `<button class="t-link t-fixlink" data-rec-open="${kind}:${id}">${what} לעדכון הפרטים של ${esc((kind === 'vehicles' ? d.vehicles : d.drivers).find(x => x.id === id)?.[kind === 'vehicles' ? 'label' : 'name'] ?? '')}</button>`; })() : '';
  if (!opts.length && c.key.startsWith('seats-') && !opts.off.some(o => o.id === S.opt[key])) { const sp = splitBlock(c, date, d, scope, key, cancel); if (sp) return sp; }
  if (!opts.length) return `<p class="t-norec"><b>אף ${who} פנוי לא מתאים ל${c.rides.length === 1 ? 'נסיעה הזו' : `כל ${num(c.rides.length)} הנסיעות`}</b>אפשר לעדכן את הפרטים, לשבץ ${who} שלא מתאים בכל זאת, או לבקש ${who} מקבלן.</p>
    ${more ? `<fieldset class="t-opts"><legend class="sr-only">כל ${plural}</legend>${offList()}</fieldset>` : ''}
    <div class="t-actions">${offSel ? okBtn(offSel, true) : `<button class="t-btn" data-opt-more="${esc(key)}">${more ? 'הסתרה' : `הצגת כל ${plural} (${num(opts.off.length)})`}</button>`}${cancel}</div>${fixLink ? `<p class="t-fixline">${fixLink}</p>` : ''}`;
  const sel = offSel ?? opts.find(o => o.id === S.opt[key]) ?? opts[0];
  const week = scope === 'plan' ? causeWeek(c, date) : [];
  const routes = [...new Set(c.rides.map(t => t.routeCode))];
  const sc = scope === 'plan' ? scopeOf(key, c) : 'day';
  const weekN = week.reduce((a, x) => a + x.rides.length, 0);
  const scopes = scope === 'plan' ? scopesFor(c, date) : [];
  const cur = scopes.find(x => x.id === sc) ?? scopes[0];
  const count = cur ? (cur.id === 'day' ? c.rides.length : weekN || c.rides.length) : c.rides.length;
  const shown = more ? opts : opts.slice(0, 3);
  if (!offSel && !shown.includes(sel)) shown.push(sel);
  const hidden = opts.length - shown.length + opts.off.length;
  return `<fieldset class="t-opts"><legend class="sr-only">אפשרויות</legend>
      ${shown.map(o => `<label class="t-opt ${o.id === sel.id ? 'is-on' : ''}"><input type="radio" name="opt-${esc(key)}" value="${esc(o.id)}" data-opt="${esc(key)}" ${o.id === sel.id ? 'checked' : ''}>
        <span><b>${esc(o.label)}${o.rec ? '<i class="t-recommend">מומלץ</i>' : ''}${o.known ? '' : '<i class="t-pill is-warn t-opt-warn">לבדוק מקומות</i>'}</b><small>${esc(o.sub)}</small></span></label>`).join('')}
      ${more && opts.off.length ? `<p class="t-opts-sep">לא מתאימים כרגע</p>${offList()}` : ''}
      ${more || hidden ? `<span class="t-opts-more"><button type="button" class="t-link" data-opt-more="${esc(key)}">${more ? 'פחות' : `הצגת כל ${plural} (עוד ${num(hidden)})`}</button></span>` : ''}
    </fieldset>
    ${scopes.length > 1 ? `<div class="t-scope"><span class="t-scope-q">לכמה זמן?</span><div class="t-seg" role="group" aria-label="לכמה זמן">${scopes.map(x => `<button type="button" data-oscope="${esc(key)}|${x.id}" aria-pressed="${x.id === cur.id}">${esc(x.label)}${x.id === scopes[0].id ? ' <i class="t-recommend">מומלץ</i>' : ''}</button>`).join('')}</div></div>` : ''}
    ${scope === 'plan' ? whatHappens(c, sel, offSel, cur?.id ?? 'day', date, d) : ''}
    ${fixLink ? `<p class="t-fixline">${fixLink}</p>` : ''}
    <div class="t-actions t-cta-bar">${okBtn(sel, Boolean(offSel)).replace('</button>', cur?.id === 'until' ? ' · עד שזה יסודר</button>' : count > 1 ? ` · ${num(count)} נסיעות</button>` : '</button>')}${cancel}<span class="t-source">${c.res === 'driver' ? `${esc(firstName(sel.label))} יקבל הודעה` : 'הנהגים יקבלו הודעה'} · אפשר לבטל</span></div>`;
}
// Too many students and no bigger bus free: split the ride. Some stops move to a second free bus with a free driver.
function splitPlans(c, date, d) {
  const plans = [];
  for (let k = 0; k < 3; k++) {
    const chosen = []; const rides = [];
    for (const t of c.rides) {
      const cap = d.vehicles.find(v => v.id === t.vehicleId)?.capacity;
      if (!cap) return plans;
      const subsets = [];
      for (let mask = 1; t.stops.length > 1 && mask < (1 << t.stops.length) - 1; mask++) {
        const stops = t.stops.filter((_, i) => mask & (1 << i)); const moved = stops.reduce((a, x) => a + (x.planned || 0), 0);
        if (t.planned - moved <= cap && moved > 0) subsets.push({ stops, moved });
      }
      subsets.sort((a, b) => a.moved - b.moved || a.stops.length - b.stops.length);
      // No clean way to split by stops: part of the busiest stop boards the second bus there.
      if (!subsets.length) { const big = [...t.stops].sort((a, b) => (b.planned || 0) - (a.planned || 0))[0]; const need = t.planned - cap; if (big && need > 0 && need < (big.planned || 0)) subsets.push({ stops: [{ ...big, planned: need }], moved: need, partial: { stopId: big.id, count: need } }); }
      const sub = subsets[k] ?? subsets.at(-1);
      if (!sub) return plans;
      const ghost = { ...t, id: `${t.id}-ghost`, planned: sub.moved, stops: sub.stops };
      const clash = (id, field) => chosen.some(x => x[field] === id && overlaps(x.t, ghost));
      const free = d.vehicles.filter(v => !v.archived && v.id !== t.vehicleId && !busState(v, ghost, date, d) && !clash(v.id, 'bus'));
      // A bus with a known seat count first; one with no count recorded only as a marked fallback.
      const bus = free.filter(v => v.capacity >= sub.moved).sort((a, b) => a.capacity - b.capacity)[0] ?? free.find(v => v.capacity == null);
      const drv = d.drivers.filter(x => !x.archived && x.id !== t.driverId && !driverState(x, ghost, date, d) && !clash(x.id, 'drv')).sort((a, b) => Boolean(a.routeCode) - Boolean(b.routeCode))[0];
      if (!bus || !drv) return plans;
      chosen.push({ t: ghost, bus: bus.id, drv: drv.id });
      rides.push({ t, stops: sub.stops, moved: sub.moved, partial: sub.partial, keep: t.planned - sub.moved, cap, bus, drv, unknown: bus.capacity == null });
    }
    const sig = rides.map(r => r.stops.map(x => x.id).join('+') + r.bus.id + r.drv.id).join('|');
    if (!plans.some(p => p.sig === sig)) plans.push({ id: `split-${plans.length}`, sig, rides });
  }
  return plans;
}
function splitBlock(c, date, d, scope, key, cancel) {
  const plans = splitPlans(c, date, d);
  if (!plans.length) return '';
  const sel = plans.find(p => p.id === S.opt[key]) ?? plans[0];
  const line = r => `${esc(r.t.departure)}: ${r.partial ? `${num(r.moved)} מהתלמידים ב${esc(r.stops[0].name)} עולים` : `${r.stops.map(x => esc(x.name)).join(', ')} (${num(r.moved)} תלמידים) עוברים`} ל${esc(r.bus.label)} עם ${esc(r.drv.name)}${r.unknown ? ' · מספר המקומות שם לא רשום, לבדוק' : ''} · ${esc(r.t.vehicleName ?? '')} נשאר עם ${num(r.keep)} מתוך ${num(r.cap)} מקומות`;
  S.split ??= {}; S.split[key] = sel;
  return `<p class="t-norec"><b>אין רכב גדול יותר פנוי, אבל אפשר לפצל</b>חלק מהתחנות עוברות לרכב נוסף עם נהג פנוי. כל הילדים מגיעים, ובכל רכב יש מספיק מקומות.</p>
    <fieldset class="t-opts"><legend class="sr-only">אפשרויות פיצול</legend>
      ${plans.map((p, i) => `<label class="t-opt ${p.id === sel.id ? 'is-on' : ''}"><input type="radio" name="opt-${esc(key)}" value="${p.id}" data-opt="${esc(key)}" ${p.id === sel.id ? 'checked' : ''}>
        <span><b>${esc([...new Set(p.rides.map(r => r.bus.label))].join(', '))} + ${esc([...new Set(p.rides.map(r => r.drv.name))].join(', '))}${i === 0 && !p.rides.some(r => r.unknown) ? '<i class="t-recommend">מומלץ</i>' : ''}${p.rides.some(r => r.unknown) ? '<i class="t-pill is-warn t-opt-warn">לבדוק מקומות</i>' : ''}</b>${p.rides.map(r => `<small>${line(r)}</small>`).join('')}</span></label>`).join('')}
    </fieldset>
    <div class="t-actions"><button class="t-btn is-primary" data-opt-ok="${esc(key)}" data-opt-id="${sel.id}">${I.check} אישור: פיצול ל${esc(sel.rides[0].bus.label)}${sel.rides.length > 1 ? ` · ${num(sel.rides.length)} נסיעות` : ''}</button>${cancel}<span class="t-source">הנהגים יקבלו הודעה · אפשר לבטל</span></div>
    <p class="t-fixline"><button class="t-link" data-opt-more="${esc(key)}">${S.optMore[key] ? 'הסתרת הרכבים' : 'או רכב אחר מכל הרשימה'}</button></p>
    ${S.optMore[key] ? `<fieldset class="t-opts">${causeOptions(c, date, d).off.map(o => `<label class="t-opt is-off"><input type="radio" name="opt-${esc(key)}" value="${esc(o.id)}" data-opt="${esc(key)}"><span><b>${esc(o.label)}</b><small>לא מתאים: ${esc(o.off)}</small></span></label>`).join('')}</fieldset>` : ''}`;
}
async function confirmSplit(scope, key, c, date) {
  const plan = S.split?.[key]; if (!plan) return;
  const done = [];
  try {
    for (const r of plan.rides) {
      const t = dataFor(date).trips.find(x => x.id === r.t.id);
      await command('split', r.partial ? { partial: r.partial, vehicleId: r.bus.id, driverId: r.drv.id } : { stopIds: r.stops.map(x => x.id), vehicleId: r.bus.id, driverId: r.drv.id }, t, date);
      const d2 = await loadDay(date); const twin = d2.trips.find(x => x.splitFrom === t.id);
      done.push({ id: t.id, twin: twin?.id });
    }
    const undo = async () => { const d2 = await loadDay(date); for (const x of done) { const t = d2.trips.find(y => y.id === x.id); if (t && x.twin) await command('merge', { fromId: x.twin }, t, date); } };
    const text = `${c.rides.length === 1 ? `קו ${c.rides[0].routeCode}` : `${num(c.rides.length)} נסיעות`} פוצלו: ${plan.rides[0].bus.label} עם ${plan.rides[0].drv.name} לוקח חלק מהתחנות`;
    (S.plan.done ??= []).push({ key: c.key, date, text, undo });
    if (view() === 'plan') await refreshPlan(date); else { S.focus = null; await loadDay(date); repaint(); }
    toast(`${text} · נשלח לנהגים`, { undo: () => run(async () => { await undo(); S.plan.done = S.plan.done.filter(x => x.undo !== undo); view() === 'plan' ? await refreshPlan(date) : (await loadDay(date), repaint()); }, 'הפיצול בוטל') });
  } catch (e) { toast(e.message, { bad: true }); }
}
async function confirmOption(scope, causeKey, id) {
  const c = scope === 'plan' ? causeByKey(causeKey) : S.focus?.cause;
  if (!c) return;
  const date = scope === 'plan' ? S.plan.day : TODAY;
  if (id.startsWith('split-')) return confirmSplit(scope, `${scope}|${causeKey}`, c, date);
  const d = dataFor(date);
  const name = c.res === 'bus' ? d.vehicles.find(v => v.id === id)?.label : d.drivers.find(x => x.id === id)?.name;
  const sc = scope === 'plan' ? scopeOf(`plan|${causeKey}`, c) : 'day';
  try {
    const r = await applyOption(c, id, sc, date);
    const text = `${name} שובץ ב־${num(r.n)} ${r.n === 1 ? 'נסיעה' : 'נסיעות'}${r.days > 1 ? ` ב־${num(r.days)} ימים` : ''}${sc === 'until' ? ', ובכל הימים שאחרי עד שזה יסודר' : ''}`;
    (S.plan.done ??= []).push({ key: c.key, date, text, undo: r.undo });
    if (view() === 'plan') { S.plan.solved = `נפתר: ${text}`; await refreshPlan(date); $('.t-carousel')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); clearTimeout(S.plan.solvedT); S.plan.solvedT = setTimeout(() => { S.plan.solved = null; if (view() === 'plan') paintPlanner(); }, 10000); } else { S.focus = null; await loadDay(date); repaint(); }
    toast(`${text} · נשלח לנהגים${r.skipped.length ? ` · ב${r.skipped.map(dayShort).join(', ')} ${name} לא פנוי, זה נשאר לסדר` : ''}`, { undo: () => run(async () => { await r.undo(); S.plan.done = S.plan.done.filter(x => x.undo !== r.undo); view() === 'plan' ? await refreshPlan(date) : (await loadDay(date), repaint()); }, 'בוטל') });
  } catch (e) { toast(e.message, { bad: true }); }
}
// Deputy's "accept all": every recommended fix at once, each for its suggested scope, one undo.
async function approveAll() {
  const date = S.plan.day;
  const list = causes(date).filter(c => c.res && causeOptions(c, date, dataFor(date))[0]?.rec);
  if (!list.length) return;
  const names = list.map(c => { const o = causeOptions(c, date, dataFor(date))[0]; return `${o.label} (${c.head})`; });
  if (!(await ask(`לאשר ${num(list.length)} המלצות? ${names.join(' · ')}. כל אחת לכל הימים השבוע שבהם זה חסר. אפשר לבטל הכל בלחיצה.`, `אישור ${num(list.length)} ההמלצות`, 'ביטול'))) return;
  const undos = []; let n = 0;
  try {
    for (const k of list.map(c => c.key)) {
      const c = causes(date).find(x => x.key === k); if (!c?.res) continue;
      const o = causeOptions(c, date, dataFor(date))[0]; if (!o) continue;
      const r = await applyOption(c, o.id, scopeOf(`plan|${k}`, c), date);
      undos.push(r.undo); n += r.n;
      (S.plan.done ??= []).push({ key: k, date, text: `${o.label} שובץ ב־${num(r.n)} נסיעות`, undo: r.undo });
      await loadSuggestions(date);
    }
  } catch (e) { toast(e.message, { bad: true }); }
  await refreshPlan(date);
  const all = async () => { for (const u of undos.reverse()) await u(); S.plan.done = (S.plan.done ?? []).filter(x => !undos.includes(x.undo)); await refreshPlan(date); };
  toast(`${num(undos.length)} המלצות אושרו · ${num(n)} נסיעות קיבלו צוות · נשלח לנהגים`, { undo: () => run(all, 'בוטל') });
}
async function applyCause(c, applies, label, date = S.plan.day) {
  const d = dataFor(date);
  const before = c.rides.map(t => ({ tripId: t.id, driverId: t.driverId, vehicleId: t.vehicleId }));
  try {
    for (const a of applies) await command('plan', { ...a, publish: true }, null, date);
    if (view() === 'plan') await refreshPlan(date); else { S.focus = null; await loadDay(date); repaint(); }
    const routes = [...new Set(c.rides.map(t => t.routeCode))];
    const chosen = applies[0]?.assignments?.[0]?.[c.res === 'bus' ? 'vehicleId' : 'driverId'];
    const undo = async () => { await command('plan', { assignments: before, publish: true, reason: 'בוטל' }, null, date); S.plan.done = (S.plan.done ?? []).filter(x => x.key !== c.key || x.date !== date); if (view() === 'plan') await refreshPlan(date); else { await loadDay(date); repaint(); } };
    (S.plan.done ??= []).push({ key: c.key, date, text: label, undo });
    if (view() === 'plan') paintPlanner();
    toast(`${label} · נשלח לנהגים`, { undo: () => run(undo, 'בוטל'), action: routes.length === 1 && chosen && c.res ? { label: `להפוך לקבוע בקו ${routes[0]}`, fn: () => setRegular(routes[0], c.res, chosen) } : null });
  } catch (e) { toast(e.message, { bad: true }); }
}
function pickForCause(anchor, c, date = S.plan.day) {
  const d = dataFor(date);
  const per = c.rides.map(t => crewItems(c.res, t, date, d));
  const items = per[0].filter(x => !x.current).map(x => ({ ...x, why: per.map(list => list.find(y => y.id === x.id)?.why).find(Boolean) ?? '', current: false }));
  items.sort((a, b) => Boolean(a.why) - Boolean(b.why) || b.spare - a.spare || a.trips - b.trips);
  openPicker(anchor, { title: `${c.res === 'bus' ? 'רכב' : 'נהג'} ל־${c.rides.length === 1 ? 'נסיעה' : `${c.rides.length} הנסיעות`}`, items, anyway: true, onPick: id => {
    const label = `${c.res === 'bus' ? (d.vehicles.find(v => v.id === id)?.label) : (d.drivers.find(x => x.id === id)?.name)} ב־${c.rides.length === 1 ? `קו ${c.rides[0].routeCode}` : `${c.rides.length} נסיעות`}`;
    applyCause(c, [{ assignments: c.rides.map(t => ({ tripId: t.id, [c.res === 'bus' ? 'vehicleId' : 'driverId']: id })), publish: true, reason: label }], label, date);
  } });
}
async function refreshPlan(date) { await loadDay(date); if (date !== TODAY) await loadDay(TODAY); await Promise.all([loadSuggestions(date), loadMonth(), ...DAYS.filter(x => x.date > date).map(x => loadDay(x.date))]); paintPlanner(); }
// ---- "משהו השתנה": one form for the two things that actually happen
function paintChange() {
  const c = S.change; const root = $('#dialog');
  if (!c) { if (root.querySelector('.t-change')) root.innerHTML = ''; return; }
  const list = c.kind === 'driver' ? S.data.drivers : S.data.vehicles;
  const reasons = c.kind === 'driver' ? ['מחלה', 'חופשה', 'מילואים', 'אחר'] : ['מוסך', 'תקלה', 'תאונה', 'אחר'];
  root.innerHTML = `<div class="t-scrim"><form class="t-dialog t-change" data-form="change" aria-labelledby="chg-t">
    <header><h2 id="chg-t">משהו השתנה</h2><button type="button" class="t-icon-btn" data-act="change-close" aria-label="סגירה">${I.x}</button></header>
    <div class="t-seg" role="group" aria-label="מה השתנה"><button type="button" data-chg-kind="driver" aria-pressed="${c.kind === 'driver'}">${I.user} נהג לא זמין</button><button type="button" data-chg-kind="bus" aria-pressed="${c.kind === 'bus'}">${I.bus} רכב לא זמין</button></div>
    <div class="t-field"><label for="chg-who">${c.kind === 'driver' ? 'מי' : 'איזה רכב'}</label><select id="chg-who" class="t-select" required><option value="">בחירה</option>${list.filter(x => !x.archived).map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name ?? x.label)}${x.routeCode ? ` · קו ${x.routeCode}` : ''}</option>`).join('')}</select></div>
    <div class="t-chg-dates"><div class="t-field"><label for="chg-from">מתאריך</label><input id="chg-from" type="date" class="t-input" value="${c.from}" required></div><div class="t-field"><label for="chg-to">עד תאריך</label><input id="chg-to" type="date" class="t-input" value="${c.to}" required></div></div>
    <div class="t-chips" role="group" aria-label="סיבה">${reasons.map(r => `<button type="button" class="t-chip" data-chg-reason="${r}" aria-pressed="${c.reason === r}">${r}</button>`).join('')}</div>
    <p class="t-impact" id="chg-impact" aria-live="polite"></p>
    <div class="t-actions"><button class="t-btn is-primary" type="submit">שמירה</button><button class="t-btn is-ghost" type="button" data-act="change-close">ביטול</button></div>
  </form></div>`;
  $('#chg-who').focus();
  changeImpact();
}
async function changeImpact() {
  const el = $('#chg-impact'); const c = S.change;
  if (!el || !c) return;
  const id = $('#chg-who').value; const from = $('#chg-from').value; const to = $('#chg-to').value || from;
  if (!id || !from) { el.textContent = 'אחרי השמירה תקבלו לכל נסיעה שנפגעת את המחליפים הפנויים, והמומלץ מסומן.'; return; }
  const days = DAYS.filter(x => x.date >= from && x.date <= (to < from ? from : to));
  await Promise.all(days.map(x => S.week[x.date] ? null : loadDay(x.date)));
  const hits = days.map(x => ({ x, n: (S.week[x.date]?.trips ?? []).filter(t => (c.kind === 'driver' ? t.driverId : t.vehicleId) === id && editableTrip(t, x.date)).length })).filter(h => h.n);
  const total = hits.reduce((a, h) => a + h.n, 0);
  const need = `${total === 1 ? 'תצטרך' : 'יצטרכו'} ${c.kind === 'driver' ? 'נהג' : 'רכב'} אחר`;
  el.innerHTML = total ? `<b>${hits.length === 1 ? `${num(total)} ${total === 1 ? 'נסיעה' : 'נסיעות'} ${dayWord(hits[0].x.date)} ${need}` : `${num(total)} נסיעות ${need}: ${hits.map(h => `${dayWord(h.x.date)} ${num(h.n)}`).join(' · ')}`}</b><br>אחרי השמירה תבחרו מחליף. המומלץ כבר מסומן.` : 'אין נסיעות בתאריכים האלה. השמירה רק תסמן את ההיעדרות.';
}
async function saveChange() {
  const c = S.change;
  c.id = $('#chg-who').value; c.from = $('#chg-from').value; c.to = $('#chg-to').value || c.from;
  if (!c.id || !c.from) { toast('בחרו מי לא זמין וממתי', { bad: true }); return; }
  const rec = (c.kind === 'driver' ? S.data.drivers : S.data.vehicles).find(x => x.id === c.id);
  try {
    await command(c.kind === 'driver' ? 'driver-save' : 'vehicle-save', { id: c.id, away: [...(rec.away ?? []), { from: c.from, to: c.to < c.from ? c.from : c.to, reason: c.reason || '' }] }, null, TODAY);
    S.change = null; paintChange();
    if (DAYS.some(x => x.date === c.from)) S.plan.day = c.from;
    S.plan.view = 'fix';
    await Promise.all(DAYS.map(x => loadDay(x.date)));
    await refreshPlan(S.plan.day);
    toast(`${rec.name ?? rec.label} לא ${c.kind === 'driver' ? 'זמין' : 'זמין'} ${c.from === c.to ? `ב־${heDate(c.from)}` : `${heDate(c.from)}–${heDate(c.to)}`} · המחליפים מוצעים למטה`);
  } catch (e) { toast(e.message, { bad: true }); }
}
function paintMonth(el) {
  const m = S.plan.month;
  if (!m) { el.innerHTML = '<p class="t-empty">טוען…</p>'; return; }
  const first = new Date(`${m[0].date.slice(0, 8)}01T00:00:00Z`);
  const lead = first.getUTCDay();
  const open = m.filter(x => !x.past && x.issues);
  const ready = m.filter(x => !x.past && !x.issues && !x.noSchool);
  const mName = `${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`;
  $('#plan-meta').textContent = `${num(m.length)} ימי לימודים`;
  // Problems that sit on a person or a bus repeat every day until fixed: say them once, above the calendar.
  const d = S.data;
  const used = new Set(Object.values(d.template ?? {}).flatMap(c => [c.driverId, c.vehicleId]));
  // What already stops a regular crew, and what expires during the month on screen, with the date it does.
  const mFrom = m[0].date.slice(0, 8) + '01'; const mTo = monthStart(mFrom, 1);
  const lasting = [...d.drivers.filter(x => used.has(x.id)).map(x => ({ x, people: true })), ...d.vehicles.filter(x => used.has(x.id)).map(x => ({ x, people: false }))]
    .map(o => {
      const now = recStatus(o.x, o.people, TOMORROW);
      if (now[1] === 'is-bad') return { ...o, st: now };
      const dates = o.people ? [['רישיון', o.x.licenseUntil]] : [['טסט', o.x.testUntil], ['טיפול', o.x.serviceDue]];
      const hit = dates.filter(([, iso]) => iso && iso < mTo && iso >= TOMORROW).sort((a, b) => a[1].localeCompare(b[1]))[0];
      return hit ? { ...o, st: [`${hit[0]} עד ${heDate(hit[1])}`, 'is-warn'] } : null;
    }).filter(Boolean).sort((a, b) => (a.st[1] === 'is-bad' ? -1 : 0) - (b.st[1] === 'is-bad' ? -1 : 0));
  // Who is out on each day (HiBob's "who's out"), from the absences on each record.
  const outOn = date => [...d.drivers.map(x => ({ x, n: x.name })), ...d.vehicles.map(x => ({ x, n: x.label }))]
    .filter(o => !o.x.archived && (o.x.away ?? []).some(a => a.from <= date && date <= a.to))
    .map(o => ({ n: o.n, r: o.x.away.find(a => a.from <= date && date <= a.to).reason || 'לא זמין' }));
  const byDate = new Map(m.map(x => [x.date, x]));
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="t-cal-cell is-blank"></div>');
  for (let k = 1; k <= days; k++) {
    const date = `${m[0].date.slice(0, 8)}${String(k).padStart(2, '0')}`;
    const x = byDate.get(date);
    if (!x) { cells.push(`<div class="t-cal-cell is-off"><b>${k}</b><small>${new Date(date + 'T00:00:00Z').getUTCDay() === 6 ? 'שבת' : 'אין הסעות'}</small></div>`); continue; }
    const out = x.past ? [] : outOn(date);
    const state = x.past ? '<small class="t-quiet">עבר</small>' : x.noSchool ? `<i class="t-pill">אין הסעות${x.note ? ` · ${esc(x.note)}` : ''}</i>` : x.issues ? `<i class="t-pill is-bad">${num(x.issues)} ${x.issues === 1 ? 'בעיה' : 'בעיות'}</i>` : x.drafts ? `<i class="t-pill">${num(x.drafts)} לא נשלחו</i>` : '<i class="t-pill is-ok">מוכן</i>';
    const extra = !x.past && x.cancelled && !x.noSchool ? `<span class="t-out-chip is-cancel"><i aria-hidden="true"></i>${num(x.cancelled)} נסיעות בוטלו</span>` : '';
    cells.push(`<button class="t-cal-cell ${x.past ? 'is-past' : ''} ${x.today ? 'is-today' : ''} ${x.date === TOMORROW ? 'is-tomorrow' : ''} ${S.mday === x.date ? 'is-sel' : ''}" ${x.past ? 'disabled' : `data-mday="${x.date}"`} aria-label="${x.weekday} ${k}.${first.getUTCMonth() + 1}, ${num(x.rides)} נסיעות">${extra}<b>${k}${x.today ? ' · היום' : x.date === TOMORROW ? ' · מחר' : ''}</b>${state}
      ${out.slice(0, 2).map(o => `<span class="t-out-chip"><i aria-hidden="true"></i>${esc(firstName(o.n))} · ${esc(o.r)}</span>`).join('')}${out.length > 2 ? `<span class="t-out-chip">ועוד ${num(out.length - 2)}</span>` : ''}</button>`);
  }
  el.innerHTML = `<div class="t-mhead">
      <div class="t-mnav"><button class="t-icon-btn" data-mshift="-1" aria-label="החודש הקודם" ${S.plan.monthAt <= monthStart(TODAY) ? 'disabled' : ''}>${I.back}</button><h2>${mName}</h2><button class="t-icon-btn is-next" data-mshift="1" aria-label="החודש הבא">${I.back}</button></div>
      <div class="t-mstats"><span class="t-pill is-bad">${num(open.length)} ימים לסדר</span><span class="t-pill is-ok">${num(ready.length)} ימים מוכנים</span></div>
      ${open.length ? `<button class="t-btn" data-pgo="${open[0].date}">לסידור של ${esc(dayWord(open[0].date))}</button>` : ''}
    </div>
    ${tip('month', 'איך לקרוא את החודש', 'כל יום נבנה מהסידור הקבוע. אדום: יש בעיות לסדר. ירוק: הכל מוכן. לחיצה על יום פותחת אותו: אפשר לבטל נסיעות (חג, טיול), להזיז שעות (יום קצר), או לסמן שאין הסעות בכלל.')}
    ${lasting.length ? `<section class="t-lasting"><b>${lasting.some(o => o.st[1] === 'is-warn') ? `חוזרות בכל יום עד שיטופלו, ומה שפג במהלך ${MONTHS[first.getUTCMonth()]}` : 'חוזרות בכל יום עד שיטופלו'}</b><div>${(() => {
      const item = o => `<button class="t-lasting-item" data-rec-open="${o.people ? 'drivers' : 'vehicles'}:${esc(o.x.id)}">${avatar(o.people ? o.x.name : o.x.label, !o.people)}<span>${esc(o.people ? o.x.name : o.x.label)}</span>${statusPill(o.st)}</button>`;
      const bad = lasting.filter(o => o.st[1] === 'is-bad'); const warn = lasting.filter(o => o.st[1] !== 'is-bad');
      if (warn.length <= 6) return [...bad, ...warn].map(item).join('');
      // Many at once: one line per kind, with the date range, instead of a wall of names.
      const groups = new Map(); for (const o of warn) { const k = `${o.people ? 'drivers' : 'vehicles'}|${o.st[0].split(' ')[0]}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(o); }
      return bad.map(item).join('') + [...groups.entries()].map(([k, list]) => { const [v, what] = k.split('|'); const ds = list.map(o => o.st[0].split(' עד ')[1]).sort((a, b) => Number(a.split('.').reverse().join('')) - Number(b.split('.').reverse().join(''))); return `<a class="t-lasting-item" href="#/${v}">${avatar('', v === 'vehicles')}<span>${num(list.length)} ${v === 'vehicles' ? 'רכבים' : 'נהגים'}</span>${statusPill([`${what} בין ${ds[0]} ל־${ds.at(-1)}`, 'is-warn'])}</a>`; }).join('');
    })()}</div><small>${lasting.some(o => o.st[1] === 'is-warn') ? 'כתום: עוד בתוקף, ויפוג בתאריך הזה. מעדכנים את התאריך בפרטים, והימים יתנקו. ' : ''}אדום: כבר לא יכול לצאת. מאשרים מחליף "עד שזה יסודר", או מעדכנים את התוקף.</small></section>` : ''}
    <div class="t-cal"><div class="t-cal-head">${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(n => `<span>${n}</span>`).join('')}</div><div class="t-cal-grid">${cells.join('')}</div></div>`;
}
// ---- one day of the month: what's on, who's out, and the changes people actually make
async function openMonthDay(date) {
  S.mday = date; S.mdo = null; S.insp = null; S.rec = null;
  if (!S.week[date]) await loadDay(date);
  paintMonthDay(); if (view() === 'plan' && S.plan.view === 'month') paintPlanner();
}
function paintMonthDay() {
  const slot = $('#inspector');
  if (!S.mday) { if (slot.querySelector('.t-mday')) slot.innerHTML = ''; return; }
  const date = S.mday; const d = S.week[date] ?? dataFor(date);
  if (!d) { slot.innerHTML = '<aside class="t-insp t-mday"><p class="t-empty">טוען…</p></aside>'; return; }
  const summary = (S.plan.month ?? []).find(x => x.date === date);
  const issues = new Set(d.trips.map(issueKey).filter(Boolean)).size;
  const schools = new Map();
  for (const t of d.trips) { const g = schools.get(t.school) ?? { name: t.school, am: [], pm: [] }; (t.direction === 'morning' ? g.am : g.pm).push(t); schools.set(t.school, g); }
  const out = [...d.drivers.map(x => ({ x, people: true })), ...d.vehicles.map(x => ({ x, people: false }))].filter(o => !o.x.archived && (o.x.away ?? []).some(a => a.from <= date && date <= a.to));
  const doing = S.mdo;
  const chips = (name, list, cur) => list.map(([v, l]) => `<button type="button" class="t-chip-sel" data-mset="${name}:${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('');
  const schoolRow = g => {
    const open = doing?.school === g.name;
    const times = list => list.length ? `${esc(list[0].departure)}${list.length > 1 ? `–${esc(list.at(-1).departure)}` : ''}` : '';
    return `<div class="t-mschool ${open ? 'is-open' : ''}">
      <div class="t-mschool-row"><span><b>${esc(g.name)}</b><small>${g.am.length ? `בוקר ${num(g.am.length)} · ${times(g.am)}` : ''}${g.am.length && g.pm.length ? ' · ' : ''}${g.pm.length ? `צהריים ${num(g.pm.length)} · ${times(g.pm)}` : ''}</small></span>
        <span class="t-mschool-acts"><button class="t-link" data-mdo="cancel|${esc(g.name)}">ביטול נסיעות</button><button class="t-link" data-mdo="shift|${esc(g.name)}">שינוי שעה</button></span></div>
      ${open && doing.kind === 'cancel' ? `<div class="t-mform"><span class="t-mform-q">אילו נסיעות?</span><div class="t-chips">${chips('dir', [['', 'כל היום'], ['morning', 'בוקר'], ['afternoon', 'צהריים']], doing.dir ?? '')}</div>
          <span class="t-mform-q">למה?</span><div class="t-chips">${chips('why', [['טיול', 'טיול'], ['יום חופשי בבית הספר', 'יום חופשי'], ['שביתה', 'שביתה'], ['אחר', 'אחר']], doing.why ?? '')}</div>
          <div class="t-actions"><button class="t-btn is-primary" data-mgo="cancel">ביטול ${num((doing.dir === 'morning' ? g.am : doing.dir === 'afternoon' ? g.pm : [...g.am, ...g.pm]).length)} נסיעות</button><button class="t-btn is-ghost" data-mdo="">סגירה</button><span class="t-source">הנהגים יקבלו הודעה · אפשר להחזיר</span></div></div>` : ''}
      ${open && doing.kind === 'shift' ? `<div class="t-mform"><span class="t-mform-q">אילו נסיעות?</span><div class="t-chips">${chips('dir', [['afternoon', 'צהריים'], ['morning', 'בוקר'], ['', 'כולן']], doing.dir ?? 'afternoon')}</div>
          <span class="t-mform-q">כמה להזיז?</span><div class="t-chips">${chips('min', [[-90, '1.5 שעות מוקדם'], [-60, 'שעה מוקדם'], [-30, 'חצי שעה מוקדם'], [30, 'חצי שעה מאוחר'], [60, 'שעה מאוחר']], doing.min ?? '')}</div>
          <div class="t-actions"><button class="t-btn is-primary" data-mgo="shift" ${doing.min ? '' : 'disabled'}>הזזת ${num((doing.dir === 'morning' ? g.am : (doing.dir ?? 'afternoon') === 'afternoon' ? g.pm : [...g.am, ...g.pm]).length)} נסיעות</button><button class="t-btn is-ghost" data-mdo="">סגירה</button><span class="t-source">הנהגים יקבלו הודעה · אפשר לבטל</span></div></div>` : ''}
    </div>`;
  };
  const st = d.trips.length ? (issues ? [`${num(issues)} ${issues === 1 ? 'בעיה' : 'בעיות'} לסדר`, 'is-bad'] : ['מוכן', 'is-ok']) : [`אין הסעות${d.note ? ` · ${d.note}` : ''}`, ''];
  const changes = (d.events ?? []).filter(e => ['cancel', 'restore', 'shift', 'assign', 'split'].includes(e.kind) && e.source === 'dispatcher').slice(-4).reverse();
  slot.innerHTML = `<aside class="t-insp t-mday" aria-label="יום ${esc(d.weekday)}">
    <header class="t-insp-head"><div class="t-insp-title"><h2 tabindex="-1" id="mday-title">יום ${esc(d.weekday)} ${heDate(date)}</h2>${statusPill(st)}</div>
      <p>${d.trips.length ? `${num(d.trips.length)} נסיעות · ${num(schools.size)} בתי ספר` : 'כל הנסיעות של היום בוטלו'}</p>
      <button class="t-icon-btn t-insp-close" data-act="mday-close" aria-label="סגירה">${I.x}</button></header>
    <div class="t-insp-body">
      ${issues ? `<button class="t-btn is-primary t-wide" data-pgo="${date}">לסידור ${num(issues)} ${issues === 1 ? 'הבעיה' : 'הבעיות'}</button>` : ''}
      ${out.length ? `<section><h3 class="t-insp-h">לא זמינים ביום הזה</h3><div class="t-mout">${out.map(o => `<button class="t-lasting-item" data-rec-open="${o.people ? 'drivers' : 'vehicles'}:${esc(o.x.id)}">${avatar(o.people ? o.x.name : o.x.label, !o.people)}<span>${esc(o.people ? o.x.name : o.x.label)}</span>${statusPill([o.x.away.find(a => a.from <= date && date <= a.to).reason || 'לא זמין', 'is-warn'])}</button>`).join('')}</div></section>` : ''}
      ${d.cancelled?.length && !d.trips.length ? `<section><div class="t-mcancel"><span><b>כל ${num(d.cancelled.length)} הנסיעות בוטלו</b><small>${esc(d.note || 'אין הסעות')} · ${num(new Set(d.cancelled.map(t => t.school)).size)} בתי ספר</small></span><button class="t-link" data-mrestore="all">החזרת כל הנסיעות</button></div></section>` : ''}
      ${d.cancelled?.length && d.trips.length ? `<section><h3 class="t-insp-h">בוטלו ביום הזה</h3>${[...new Set(d.cancelled.map(t => t.school))].map(sc => { const ts = d.cancelled.filter(t => t.school === sc); return `<div class="t-mcancel"><span><b>${esc(sc)}</b><small>${num(ts.length)} נסיעות${ts[0].reason ? ` · ${esc(ts[0].reason)}` : ''}</small></span><button class="t-link" data-mrestore="${esc(ts.map(t => t.id).join(','))}">החזרה</button></div>`; }).join('')}</section>` : ''}
      ${d.trips.length ? `<section><h3 class="t-insp-h">בתי הספר ביום הזה</h3><div class="t-mschools">${[...schools.values()].sort((a, b) => (b.am.length + b.pm.length) - (a.am.length + a.pm.length)).map(schoolRow).join('')}</div></section>` : ''}
      <section><h3 class="t-insp-h">שינויים בכל היום</h3>
        ${doing?.kind === 'day' ? `<div class="t-mform"><span class="t-mform-q">למה אין הסעות?</span><div class="t-chips">${chips('why', [['חג', 'חג'], ['חופשה', 'חופשה'], ['שביתה', 'שביתה'], ['אחר', 'אחר']], doing.why ?? '')}</div>
          <label class="t-mform-q" for="mday-to">עד תאריך (לא חובה, לכמה ימים)</label><input id="mday-to" type="date" class="t-input" min="${date}" value="${esc(doing.to ?? '')}">
          <div class="t-actions"><button class="t-btn is-primary" data-mgo="day" ${doing.why ? '' : 'disabled'}>אין הסעות ${doing.to && doing.to > date ? `עד ${heDate(doing.to)}` : 'ביום הזה'}</button><button class="t-btn is-ghost" data-mdo="">סגירה</button></div></div>`
        : `<div class="t-mday-acts">${d.trips.length ? '<button class="t-btn" data-mdo="day|">אין הסעות ביום הזה</button>' : ''}<button class="t-btn" data-act="change-day">נהג או רכב לא זמינים</button><button class="t-btn" data-mall="${date}">כל הנסיעות, נסיעה־נסיעה</button></div>`}
      </section>
      ${changes.length ? `<section><h3 class="t-insp-h">מה השתנה מהסידור הקבוע</h3><ul class="t-mchanges">${changes.map(e => `<li>${esc(e.text.replace(/\. פורסם לנהג$/, ''))}<small>${esc(e.actor)}</small></li>`).join('')}</ul></section>` : ''}
    </div>
  </aside>`;
  if (!S.mdayFocused) { $('#mday-title')?.focus({ preventScroll: true }); S.mdayFocused = true; }
}
async function monthDayGo(kind) {
  const date = S.mday; const x = S.mdo; const d = S.week[date] ?? dataFor(date);
  const pickDir = list => list.filter(t => !x.dir || t.direction === x.dir);
  try {
    if (kind === 'cancel') {
      const ts = pickDir(d.trips.filter(t => t.school === x.school));
      await command('cancel', { tripIds: ts.map(t => t.id), reason: x.why || '' }, null, date);
      const ids = ts.map(t => t.id);
      await afterMonthChange(date);
      toast(`${num(ids.length)} נסיעות של ${x.school} בוטלו ${dayWord(date)}`, { undo: () => run(async () => { await command('restore', { tripIds: ids }, null, date); await afterMonthChange(date); }, 'הנסיעות הוחזרו') });
    }
    if (kind === 'shift') {
      const dir = x.dir ?? 'afternoon'; const ts = d.trips.filter(t => t.school === x.school && (!dir || t.direction === dir));
      await command('shift', { tripIds: ts.map(t => t.id), minutes: Number(x.min) }, null, date);
      const ids = ts.map(t => t.id); const m = Number(x.min);
      await afterMonthChange(date);
      toast(`${num(ids.length)} נסיעות של ${x.school} זזו ${Math.abs(m) === 60 ? 'בשעה' : `ב־${Math.abs(m)} דקות`} ${m < 0 ? 'מוקדם' : 'מאוחר'} יותר`, { undo: () => run(async () => { await command('shift', { tripIds: ids, minutes: -m }, null, date); await afterMonthChange(date); }, 'השעות הוחזרו') });
    }
    if (kind === 'day') {
      const to = x.to && x.to > date ? x.to : date;
      const dates = (S.plan.month ?? []).filter(m => m.date >= date && m.date <= to && !m.noSchool).map(m => m.date);
      for (const dt of dates) await command('cancel', { all: true, reason: x.why }, null, dt);
      await afterMonthChange(date, dates);
      toast(`אין הסעות ${dates.length > 1 ? `ב־${num(dates.length)} ימים, עד ${heDate(to)}` : dayWord(date)} · ${x.why}`, { undo: () => run(async () => { for (const dt of dates) await command('restore', { all: true }, null, dt); await afterMonthChange(date, dates); }, 'הנסיעות הוחזרו') });
    }
  } catch (e) { toast(e.message, { bad: true }); }
}
async function afterMonthChange(date, dates = [date]) {
  S.mdo = null;
  await Promise.all([...dates.map(dt => loadDay(dt)), loadMonth()]);
  paintMonthDay(); paintPlanner();
}
function paintWeek(el) {
  const ready = DAYS.every(x => dataFor(x.date));
  if (!ready) { el.innerHTML = '<p class="t-empty">טוען…</p>'; return; }
  const d0 = dataFor(TOMORROW);
  const routes = new Map();
  for (const day of DAYS) for (const t of dataFor(day.date).trips) {
    const r = routes.get(t.routeCode) ?? { code: t.routeCode, schools: new Set(), days: {}, most: 0 };
    r.schools.add(t.school); (r.days[day.date] ??= []).push(t); r.most = Math.max(r.most, t.planned || 0); routes.set(t.routeCode, r);
  }
  const crew = code => {
    const c = S.data.template?.[code];
    const drv = d0.drivers.find(x => x.id === c?.driverId); const bus = d0.vehicles.find(x => x.id === c?.vehicleId);
    const ds = drv ? recStatus(drv, true, TOMORROW) : ['אין נהג קבוע', 'is-bad'];
    const bs = bus ? recStatus(bus, false, TOMORROW) : ['אין רכב קבוע', 'is-bad'];
    return { drv, bus, ds, bs, bad: ds[1] === 'is-bad' || bs[1] === 'is-bad' };
  };
  const all = [...routes.values()].sort((a, b) => (Number(a.code) || 1e9) - (Number(b.code) || 1e9));
  const bad = all.filter(r => crew(r.code).bad);
  const f = S.plan.wf ?? 'all';
  const q = S.plan.q.trim();
  let rows = f === 'bad' ? bad : all;
  if (q) rows = rows.filter(r => [`קו ${r.code}`, ...r.schools, crew(r.code).drv?.name ?? '', crew(r.code).bus?.label ?? ''].join(' ').includes(q));
  const total = DAYS.reduce((n, x) => n + dataFor(x.date).trips.length, 0);
  $('#plan-meta').textContent = `נבנה מהקובץ "${S.data.source?.file ?? 'סידור מקור'}" · ${num(routes.size)} קווים · ${num(total)} נסיעות בשבוע`;
  const person = (kind, r, c) => {
    const rec = kind === 'driver' ? c.drv : c.bus; const st = kind === 'driver' ? c.ds : c.bs;
    const sub = kind === 'driver' ? (rec?.contact ? `<span dir="ltr">${esc(rec.contact)}</span>` : '') : rec ? `${rec.capacity ? `${num(rec.capacity)} מקומות` : 'מקומות לא רשום'}${r.most ? ` · עד ${num(r.most)} תלמידים` : ''}` : '';
    return `<button class="t-crew" data-tpick="${kind}:${esc(r.code)}" aria-haspopup="listbox" aria-label="${kind === 'driver' ? 'נהג קבוע' : 'רכב קבוע'} לקו ${esc(r.code)}: ${esc(rec ? (kind === 'driver' ? rec.name : rec.label) : 'אין')}. לחיצה להחלפה">
      ${avatar(rec ? (kind === 'driver' ? rec.name : rec.label) : '?', kind === 'bus')}<span><b>${esc(rec ? (kind === 'driver' ? rec.name : rec.label) : (kind === 'driver' ? 'אין נהג' : 'אין רכב'))}</b>${st[1] === 'is-ok' ? `<small>${sub}</small>` : `<small class="t-crew-st">${statusPill(st)}</small>`}</span><i class="t-caret" aria-hidden="true">▾</i></button>`;
  };
  const open = S.plan.wopen ??= new Set();
  el.innerHTML = `${tip('regular', 'זה הסידור הקבוע', 'ממנו נבנה כל יום בחודש. החלפת נהג או רכב כאן תחול על כל הימים מעכשיו והלאה. לשינוי של יום אחד בלבד, עוברים לסידור של אותו יום.')}
    <div class="t-toolbar">
      <div class="t-filters" role="group" aria-label="סינון"><button class="t-filter" data-wf="all" aria-pressed="${f === 'all'}">כל הקווים <span class="num">${num(all.length)}</span></button><button class="t-filter" data-wf="bad" aria-pressed="${f === 'bad'}">צריך להחליף צוות <span class="num">${num(bad.length)}</span></button></div>
      <span class="t-spacer"></span><label class="t-search-field">${I.search}<span class="sr-only">חיפוש</span><input id="pq" type="search" placeholder="קו, בית ספר, נהג או רכב" value="${esc(q)}"></label></div>
    <div class="t-reg" role="table" aria-label="הסידור הקבוע לפי קו">
      <div class="t-reg-row t-reg-head" role="row"><span role="columnheader">קו</span><span role="columnheader">נהג קבוע</span><span role="columnheader">רכב קבוע</span><span role="columnheader">נסיעות בכל יום</span></div>
      ${rows.map(r => { const c = crew(r.code); const isOpen = open.has(r.code); return `<div class="t-reg-row ${c.bad ? 'is-bad' : ''}" role="row">
        <span role="cell" class="t-reg-route"><span class="t-code">${esc(r.code)}</span><span><b>${esc([...r.schools][0])}</b><small>${r.schools.size > 1 ? `ועוד ${num(r.schools.size - 1)} בתי ספר` : `עד ${num(r.most)} תלמידים`}</small></span></span>
        <span role="cell">${person('driver', r, c)}</span>
        <span role="cell">${person('bus', r, c)}</span>
        <span role="cell"><button class="t-days-strip" data-wopen="${esc(r.code)}" aria-expanded="${isOpen}" aria-label="שעות קו ${esc(r.code)}">${DAYS.map(x => { const n = (r.days[x.date] ?? []).length; return `<span class="${n ? '' : 'is-none'}"><small>${'אבגדהו'[new Date(x.date + 'T00:00:00Z').getUTCDay()]}׳</small><b class="num">${n || '—'}</b></span>`; }).join('')}<i class="t-caret" aria-hidden="true">${isOpen ? '▴' : '▾'}</i></button></span>
        ${isOpen ? `<div class="t-reg-times" role="cell">${DAYS.map(x => `<div><small>${esc(x.label)}</small>${(r.days[x.date] ?? []).sort((a, b) => a.departure.localeCompare(b.departure)).map(t => `<span class="t-tag num">${esc(t.departure)} · ${t.direction === 'morning' ? 'איסוף' : 'פיזור'}</span>`).join('') || '<span class="t-quiet">אין</span>'}</div>`).join('')}</div>` : ''}
      </div>`; }).join('') || '<p class="t-empty">אין קווים שמתאימים לחיפוש.</p>'}
    </div>`;
}
function paintDayPlan(el) {
  const date = S.plan.day;
  const d = dataFor(date);
  if (!d) { el.innerHTML = '<p class="t-empty">טוען…</p>'; return; }
  const rides = [...d.trips].sort((a, b) => a.departure.localeCompare(b.departure));
  const need = [], file = [], ok = [];
  for (const t of rides) { const p = rideProblem(t, date, d); (p ? (p.who === 'file' ? file : need) : ok).push({ t, p }); }
  const drafts = rides.filter(t => !t.published && editableTrip(t, date));
  const pub = [...(d.events ?? [])].reverse().find(e => /פורסם/.test(e.text) && e.source === 'dispatcher');
  const lastPub = pub ? `${new Date(pub.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} · ${pub.actor}` : '';
  const sugg = S.plan.suggest ?? new Map();
  const autoN = need.filter(x => sugg.has(x.t.id)).length;
  const i = DAYS.findIndex(x => x.date === date);
  $('#plan-meta').textContent = [`${dayWord(date)}, ${d.weekday} ${heDate(date)}`, `${num(rides.length)} נסיעות`, need.length ? `${num(need.length)} צריכות צוות` : 'לכל הנסיעות יש צוות'].join(' · ');
  const name = (list, id) => list.find(x => x.id === id);
  const crewText = t => `${esc(name(d.drivers, t.driverId)?.name ?? 'אין נהג')} · ${esc(name(d.vehicles, t.vehicleId)?.label ?? 'אין רכב')}`;
  const row = ({ t, p }, kind) => {
    const sg = sugg.get(t.id);
    const can = editableTrip(t, date);
    const drv = name(d.drivers, t.driverId), bus = name(d.vehicles, t.vehicleId);
    const dBad = p && p.who === 'driver', bBad = p && p.who === 'bus';
    const chip = (kindKey, label, bad, why) => `<button class="t-chip-pick ${bad ? 'is-bad' : ''}" data-pick="${kindKey}:${t.id}" ${can ? '' : 'disabled'} title="${esc(why || 'החלפה')}" aria-haspopup="listbox">${kindKey === 'driver' ? I.user : I.bus}<span>${esc(label)}</span>${can ? '<i class="t-caret" aria-hidden="true">▾</i>' : ''}</button>`;
    const sgText = sg ? [sg.driverId ? name(d.drivers, sg.driverId)?.name : null, sg.vehicleId ? name(d.vehicles, sg.vehicleId)?.label : null].filter(Boolean).join(' · ') : '';
    return `<div class="t-row2 ${kind} ${!t.published && can ? 'is-draft' : ''}" data-row-trip="${t.id}">
      <span class="num t-alloc-time">${esc(t.departure)}</span>
      <span class="t-code">${esc(t.routeCode)}</span>
      <button class="t-row2-what" data-ride-open="${t.id}"><b>${esc(t.school)}</b><small>${num(t.planned)} תלמידים${p ? ` · <span class="${kind === 'is-need' ? 't-bad-text' : 't-warn-text'}">${esc(p.text)}</span>` : ''}</small></button>
      <span class="t-row2-crew">${chip('driver', drv?.name ?? 'אין נהג', dBad, dBad ? p.text : '')}${chip('bus', bus?.label ?? 'אין רכב', bBad, bBad ? p.text : '')}</span>
      <span class="t-row2-act">${kind === 'is-need' && sg ? `<button class="t-sugg" data-paccept="${t.id}" title="${esc(sg.title)}"><span>${I.assist}${esc(sgText)}</span><b>${I.check} אישור</b></button>` : ''}
        <button class="t-icon-btn" data-rowmenu="${t.id}" aria-label="פעולות נוספות" aria-haspopup="menu">⋯</button></span>
    </div>`;
  };
  const shown = S.plan.showReady;
  el.innerHTML = `<div class="t-day-nav">
      <button class="t-icon-btn" data-pgo="${DAYS[i - 1]?.date ?? ''}" ${i > 0 ? '' : 'disabled'} aria-label="היום הקודם">${I.back}</button>
      <b>${dayWord(date)} · ${d.weekday} ${heDate(date)}</b>
      <button class="t-icon-btn" data-pgo="${DAYS[i + 1]?.date ?? ''}" ${i >= 0 && i < DAYS.length - 1 ? '' : 'disabled'} aria-label="היום הבא">${I.chev}</button>
      <span class="t-spacer"></span>
      ${autoN ? `<button class="t-btn" data-act="auto-alloc" title="משבץ רק ביום הזה, כטיוטה. אפשר לבטל בלחיצה.">${I.assist} שיבוץ אוטומטי (${num(autoN)})</button>` : ''}
    </div>
    <div class="t-alloc-wrap">
      <div class="t-alloc-list">
        <section><h2 class="t-alloc-h">צריכות צוות <span class="num">${num(need.length)}</span></h2>
          ${need.map(x => row(x, 'is-need')).join('') || `<div class="t-calm">${I.check}<b>לכל הנסיעות ביום הזה יש נהג ורכב שיכולים לצאת</b></div>`}</section>
        ${file.length ? `<section><button class="t-alloc-h t-alloc-toggle" data-act="toggle-file" aria-expanded="${Boolean(S.plan.showFile)}">${S.plan.showFile ? '▾' : '▸'} לבדוק מול הקובץ <span class="num">${num(file.length)}</span></button>${S.plan.showFile ? `<p class="t-source">שתי נסיעות של אותו קו באותה שעה כבר בקובץ. אולי אלה שני רכבים, אולי טעות בקובץ.</p>${file.map(x => row(x, 'is-file')).join('')}` : ''}</section>` : ''}
        <section><button class="t-alloc-h t-alloc-toggle" data-act="toggle-ready" aria-expanded="${shown}">${shown ? '▾' : '▸'} מוכנות עם הצוות הקבוע <span class="num">${num(ok.length)}</span></button>
          ${shown ? ok.map(x => row(x, '')).join('') : ''}</section>
      </div>
    </div>
    ${drafts.length ? `<div class="t-plan-bar" role="status"><span><b>${num(drafts.length)}</b> ${drafts.length === 1 ? 'שינוי שעוד לא נשלח' : 'שינויים שעוד לא נשלחו'}<small>תישלח הודעה רק ל־${num(new Set(drafts.map(t => t.driverId)).size)} הנהגים שהנסיעות שלהם השתנו${lastPub ? ` · פורסם לאחרונה ${lastPub}` : ''}</small></span><button class="t-btn is-primary" data-act="publish-drafts" title="P">פרסום לנהגים (${num(drafts.length)})</button></div>` : lastPub ? `<p class="t-grid-foot">פורסם לאחרונה ${lastPub}. אין שינויים שמחכים.</p>` : ''}`;
}
// Who and what can run this ride: free at its hours, legal on its date, with enough seats.
async function assignRes(tripId, kind, id) {
  const date = S.plan.day;
  const t = dataFor(date).trips.find(x => x.id === tripId);
  const before = { tripId, driverId: t.driverId, vehicleId: t.vehicleId };
  const key = kind === 'driver' ? 'driverId' : 'vehicleId';
  try {
    await command('plan', { assignments: [{ tripId, [key]: id }], publish: false, reason: 'שובץ בבניית הסידור' }, null, date);
    await loadDay(date); await loadSuggestions(date); paintPlanner();
    toast('נשמר כטיוטה · יישלח לנהג בלחיצה על "שליחה לנהגים"', { action: { label: `לקבוע כקבוע לקו ${t.routeCode}`, fn: () => setRegular(t.routeCode, kind, id) }, undo: () => run(async () => { await command('plan', { assignments: [before], publish: t.published, reason: 'בוטל' }, null, date); await loadDay(date); await loadSuggestions(date); paintPlanner(); }, 'השיבוץ בוטל') });
  } catch (e) { toast(e.message, { bad: true }); }
}
async function acceptSuggestion(tripId) {
  const date = S.plan.day;
  const s = S.plan.suggest.get(tripId);
  if (!s) return;
  const t = dataFor(date).trips.find(x => x.id === tripId);
  const before = { tripId, driverId: t.driverId, vehicleId: t.vehicleId };
  await run(async () => {
    await command('plan', { assignments: [{ tripId, ...(s.driverId ? { driverId: s.driverId } : {}), ...(s.vehicleId ? { vehicleId: s.vehicleId } : {}) }], publish: false, reason: s.title }, null, date);
    await loadDay(date); await loadSuggestions(date); paintPlanner();
    toast('נשמר כטיוטה · יישלח לנהג בלחיצה על "שליחה לנהגים"', { undo: () => run(async () => { await command('plan', { assignments: [before], publish: true, reason: 'בוטל' }, null, date); await loadDay(date); await loadSuggestions(date); paintPlanner(); }, 'בוטל') });
  });
}
async function autoAllocate() {
  const date = S.plan.day;
  const props = S.plan.proposals ?? [];
  if (!props.length) return;
  const d = dataFor(date);
  const before = props.flatMap(p => p.apply.assignments).map(a => { const t = d.trips.find(x => x.id === a.tripId); return { tripId: a.tripId, driverId: t?.driverId, vehicleId: t?.vehicleId, published: t?.published }; });
  try {
    for (const p of props) await command('plan', { ...p.apply, publish: false }, null, date);
    await loadDay(date); await loadSuggestions(date); paintPlanner();
    toast(`${num(before.length)} נסיעות שובצו כטיוטה · בדקו ושלחו לנהגים`, { undo: () => run(async () => {
      await command('plan', { assignments: before.map(({ published, ...a }) => a), publish: false, reason: 'שיבוץ אוטומטי בוטל' }, null, date);
      const was = before.filter(b => b.published).map(b => ({ tripId: b.tripId }));
      if (was.length) await command('plan', { assignments: was, publish: true, reason: 'הוחזר' }, null, date);
      await loadDay(date); await loadSuggestions(date); paintPlanner();
    }, 'השיבוץ האוטומטי בוטל') });
  } catch (e) { toast(e.message, { bad: true }); }
}
async function publishDrafts() {
  const date = S.plan.day;
  const ids = dataFor(date).trips.filter(t => !t.published && editableTrip(t, date)).map(t => ({ tripId: t.id }));
  if (!ids.length) return;
  const blocked = dataFor(date).trips.filter(t => !t.published && editableTrip(t, date) && t.blockers.length).length;
  await run(async () => { await command('plan', { assignments: ids, publish: true, reason: 'פורסם לנהג' }, null, date); await loadDay(date); await loadSuggestions(date); paintPlanner(); }, blocked ? `פורסם. ${blocked} נסיעות עם בעיה נשארו טיוטה עד שיהיה להן צוות.` : 'פורסם לנהגים');
}
async function planGo(date) {
  if (!date) return;
  S.plan.day = date; S.plan.view = 'fix'; S.plan.ci = 0;
  if (S.mday) { S.mday = null; S.mdo = null; paintMonthDay(); }
  paintPlanner();
  if (!dataFor(date)) await loadDay(date);
  await loadSuggestions(date); paintPlanner();
}
async function planView(v) {
  S.plan.view = v; S.plan.sel = null; S.plan.route = null;
  document.querySelectorAll('[data-pview]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pview === v));
  paintPlanner();
  if (v === 'month') { await loadMonth(); paintPlanner(); }
  if (v !== 'month' && !S.plan.month) { await loadMonth(); paintPlanner(); }
  if (v === 'week') { await Promise.all(DAYS.map(x => (dataFor(x.date) ? null : loadDay(x.date)))); paintPlanner(); }
  if (v === 'fix' || v === 'all') { if (!dataFor(S.plan.day)) await loadDay(S.plan.day); await Promise.all([loadSuggestions(S.plan.day), ...DAYS.filter(x => !S.week[x.date]).map(x => loadDay(x.date))]); if (!S.plan.month) await loadMonth(); paintPlanner(); }
}
function paintPlannerSelection() {}
// ---- a small picker anchored to a chip: free first, then the unavailable with their reason
function closePicker() { S.picker?.el.remove(); S.picker = null; }
function openPicker(anchor, { title, items, onPick, search = true, anyway = false }) {
  closePicker();
  const el = document.createElement('div');
  el.className = 't-picker'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
  el.innerHTML = `<header>${esc(title)}</header>${search ? '<input class="t-input t-picker-q" placeholder="חיפוש" aria-label="חיפוש">' : ''}<div class="t-picker-list" role="listbox"></div>`;
  const list = el.querySelector('.t-picker-list');
  const draw = (q = '') => {
    const match = it => !q || `${it.label} ${it.sub ?? ''}`.includes(q);
    const free = items.filter(it => !it.why && match(it));
    const busy = items.filter(it => it.why && match(it));
    list.innerHTML = free.map(it => `<button role="option" class="t-pick ${it.current ? 'is-current' : ''}" data-pid="${esc(it.id)}"><span><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.current ? I.check : ''}</button>`).join('')
      + (busy.length ? `<p class="t-picker-h">לא מומלצים</p>${busy.map(it => anyway && !it.hard
        ? `<button role="option" class="t-pick is-off" data-pid="${esc(it.id)}" data-why="${esc(it.why)}"><span><b>${esc(it.label)}</b><small>${esc(it.why)}</small></span><i class="t-anyway">בכל זאת</i></button>`
        : `<div class="t-pick is-off" aria-disabled="true"><span><b>${esc(it.label)}</b><small>${esc(it.why)}</small></span></div>`).join('')}` : '')
      || '<p class="t-empty">לא נמצא.</p>';
  };
  draw();
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  el.style.top = `${Math.min(window.innerHeight - el.offsetHeight - 12, r.bottom + 6)}px`;
  el.style.left = `${Math.max(12, Math.min(window.innerWidth - el.offsetWidth - 12, r.right - el.offsetWidth))}px`;
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-pid]'); if (!b) return;
    const why = b.dataset.why; const label = b.querySelector('b')?.textContent;
    closePicker();
    if (why && !(await ask(`לשבץ את ${label} בכל זאת? ${why}. הנסיעה תישאר מסומנת עד שזה ייפתר.`, 'לשבץ בכל זאת', 'ביטול'))) return;
    onPick(b.dataset.pid); anchor.focus?.();
  });
  el.querySelector('.t-picker-q')?.addEventListener('input', e => draw(e.target.value.trim()));
  (el.querySelector('.t-picker-q') ?? el.querySelector('[data-pid]'))?.focus();
  S.picker = { el, anchor };
}
function crewItems(kind, t, date, d) {
  const items = (kind === 'driver' ? d.drivers : d.vehicles).filter(x => !x.archived).map(x => {
    const why = kind === 'driver' ? driverState(x, t, date, d) : busState(x, t, date, d);
    const trips = d.trips.filter(o => (kind === 'driver' ? o.driverId : o.vehicleId) === x.id).length;
    return { id: x.id, label: kind === 'driver' ? x.name : x.label, sub: kind === 'driver' ? `${x.routeCode ? `קו ${x.routeCode}` : 'חלופי'} · ${trips} נסיעות ביום` : `${x.capacity ? `${x.capacity} מקומות` : 'מקומות לא ידוע'} · ${trips} נסיעות ביום`, why: x.id === (kind === 'driver' ? t.driverId : t.vehicleId) ? '' : why, hard: /פג|הוסר/.test(why), current: x.id === (kind === 'driver' ? t.driverId : t.vehicleId), spare: !x.routeCode && kind === 'driver' || x.id === 'bus-spare', trips };
  });
  return items.sort((a, b) => Boolean(a.why) - Boolean(b.why) || b.current - a.current || b.spare - a.spare || a.trips - b.trips);
}
function pickCrew(anchor, kind, tripId) {
  const date = S.plan.day; const d = dataFor(date); const t = d.trips.find(x => x.id === tripId);
  openPicker(anchor, { title: `${kind === 'driver' ? 'נהג' : 'רכב'} לקו ${t.routeCode} · ${t.departure}`, items: crewItems(kind, t, date, d), anyway: true, onPick: id => assignRes(tripId, kind, id) });
}
function pickRegular(anchor, kind, code) {
  const d = dataFor(TOMORROW); const sample = d.trips.find(t => t.routeCode === code) ?? { id: '', routeCode: code, planned: 0, stops: [], departure: '00:00' };
  const cur = S.data.template?.[code];
  const items = (kind === 'driver' ? d.drivers : d.vehicles).filter(x => !x.archived).map(x => {
    const bad = kind === 'driver' ? (x.available === false ? 'סומן כלא זמין' : x.licenseUntil < TOMORROW ? 'הרישיון פג' : '') : (x.available === false ? 'מושבת' : x.testUntil < TOMORROW ? 'הטסט פג' : x.capacity != null && x.capacity < (sample.planned || 0) ? `${x.capacity} מקומות` : '');
    const routes = Object.entries(S.data.template ?? {}).filter(([c, t]) => c !== code && (kind === 'driver' ? t.driverId : t.vehicleId) === x.id).map(([c]) => c);
    // Already regular on another route: fine if the hours never meet, a warning if they do.
    const days = DAYS.map(dd => dataFor(dd.date)).filter(Boolean);
    const clash = routes.find(rc => days.some(dd => dd.trips.filter(t => t.routeCode === code).some(a => dd.trips.filter(t => t.routeCode === rc).some(b => overlaps(a, b)))));
    const current = x.id === (kind === 'driver' ? cur?.driverId : cur?.vehicleId);
    const why = current ? '' : bad || (clash ? `קבוע בקו ${clash} באותן שעות` : '');
    return { id: x.id, label: kind === 'driver' ? x.name : x.label, sub: routes.length ? `קבוע גם בקו ${routes.join(', ')}${clash ? '' : ', בלי חפיפה בשעות'}` : 'פנוי, לא משויך לקו', why, hard: Boolean(bad), current, routes: routes.length };
  }).sort((a, b) => Boolean(a.why) - Boolean(b.why) || b.current - a.current || a.routes - b.routes);
  const rec = items.find(x => !x.why && !x.current); if (rec) rec.sub = `מומלץ · ${rec.sub}`;
  openPicker(anchor, { title: `${kind === 'driver' ? 'נהג' : 'רכב'} קבוע לקו ${code}`, items, anyway: true, onPick: id => setRegular(code, kind, id) });
}
async function setRegular(code, kind, id) {
  const before = { ...(S.data.template?.[code] ?? {}) };
  const data = { routeCode: code, [kind === 'driver' ? 'driverId' : 'vehicleId']: id };
  try {
    await command('template', data, null, TODAY);
    S.week = {}; await loadDay(TODAY); await Promise.all(DAYS.map(x => loadDay(x.date)));
    if (S.plan.day) await loadSuggestions(S.plan.day);
    paintPlanner();
    toast(`הצוות הקבוע של קו ${code} עודכן מעכשיו והלאה`, { undo: () => run(async () => { await command('template', { routeCode: code, ...before }, null, TODAY); S.week = {}; await loadDay(TODAY); await Promise.all(DAYS.map(x => loadDay(x.date))); paintPlanner(); }, 'הוחזר') });
  } catch (e) { toast(e.message, { bad: true }); }
}
function rowMenu(anchor, tripId) {
  const date = S.plan.day; const d = dataFor(date); const t = d.trips.find(x => x.id === tripId);
  const reg = S.data.template?.[t.routeCode];
  const isRegular = reg && reg.driverId === t.driverId && reg.vehicleId === t.vehicleId;
  const items = [
    ...(isRegular ? [] : [{ id: 'make-regular', label: `לקבוע את הצוות הזה כקבוע לקו ${t.routeCode}`, sub: `${name2(d.drivers, t.driverId)} · ${name2(d.vehicles, t.vehicleId)}, מעכשיו והלאה` }]),
    ...(isRegular ? [] : [{ id: 'back-regular', label: 'החזרה לצוות הקבוע', sub: `${name2(d.drivers, reg?.driverId)} · ${name2(d.vehicles, reg?.vehicleId)}` }]),
    { id: 'open', label: 'פרטי הנסיעה והתחנות' },
  ];
  openPicker(anchor, { title: `קו ${t.routeCode} · ${t.departure}`, items, search: false, onPick: async id => {
    if (id === 'open') openRide(tripId, date, 'overview');
    if (id === 'make-regular') { await command('template', { routeCode: t.routeCode, driverId: t.driverId, vehicleId: t.vehicleId }, null, TODAY).catch(e => toast(e.message, { bad: true })); S.week = {}; await loadDay(TODAY); await loadDay(date); await loadSuggestions(date); paintPlanner(); toast(`הצוות של קו ${t.routeCode} נקבע כקבוע`); }
    if (id === 'back-regular') { await run(async () => { await command('plan', { assignments: [{ tripId, driverId: reg.driverId, vehicleId: reg.vehicleId }], publish: false, reason: 'חזרה לצוות הקבוע' }, null, date); await loadDay(date); await loadSuggestions(date); paintPlanner(); }, 'חזר לצוות הקבוע'); }
  } });
}
const name2 = (list, id) => (list.find(x => x.id === id)?.name ?? list.find(x => x.id === id)?.label ?? '—');

// ------------------------------------------------------------ the planning assistant
async function openAssist(date = TOMORROW, askText = '') {
  S.assist = { date, ask: askText, busy: true, result: null, applied: new Set(), open: new Set() };
  paintAssist(); rail();
  await runAssist();
}
async function runAssist() {
  if (S.assist && !dataFor(S.assist.date ?? TODAY)) await loadDay(S.assist.date ?? TODAY).catch(() => null);
  const a = S.assist;
  a.busy = true; paintAssist();
  try { a.result = await api(`/api/transport/assistant?date=${a.date}&ask=${encodeURIComponent(a.ask)}`); a.date = a.result.date; }
  catch (e) { a.result = null; toast(e.message, { bad: true, retry: runAssist }); }
  a.busy = false; paintAssist();
}
function paintAssist() {
  const slot = $('#assist');
  const a = S.assist;
  if (!a) { slot.innerHTML = ''; return; }
  const r = a.result;
  const examples = ['מה חסר למחר?', 'יוסי חזן לא מגיע מחר', 'אוטובוס 15 במוסך ביום שלישי'];
  const date = a.date ?? TODAY;
  // A fix the planner knows (a driver, a bus, seats) opens there: one place, one way to choose.
  const planKey = p => { if (/^(bus|driver)-/.test(p.id)) return p.id; if (p.id.startsWith('seats-')) { const t = dataFor(date)?.trips.find(x => (p.tripIds ?? []).includes(x.id)); return t ? `seats-${t.routeCode}` : null; } return null; };
  let firstFix = true;
  const card = p => {
    const done = a.applied.has(p.id);
    const key = !done ? planKey(p) : null;
    if (key) { const lead = firstFix; firstFix = false; return `<article class="t-prop"><b>${esc(p.id.startsWith('seats-') ? `קו ${dataFor(date)?.trips.find(x => (p.tripIds ?? []).includes(x.id))?.routeCode ?? ''}: חסרים מקומות` : p.why.split('. ')[0])}</b><p>${esc(p.apply ? `${p.title} מומלץ. אפשר לבחור גם אחר.` : p.why)}</p><div class="t-actions"><button class="t-btn ${lead ? 'is-primary' : ''} is-sm" data-prop-plan="${esc(key)}|${date}">${p.id.startsWith('driver-') ? 'לבחירת נהג מחליף' : p.id.startsWith('seats-') && !p.apply ? 'לפתרונות: רכב גדול יותר או פיצול' : 'לבחירת רכב מחליף'}</button></div></article>`; }
    const many = p.changes.length > 4 && !a.open.has(p.id);
    return `<article class="t-prop ${p.tone === 'info' ? 'is-info' : ''} ${done ? 'is-done' : ''}">
      <b>${done ? `${I.check} ` : ''}${esc(p.title)}</b>
      <p>${esc(p.why)}</p>
      ${p.changes.length ? `<ul>${(many ? p.changes.slice(0, 3) : p.changes).map(c => `<li>${esc(c)}</li>`).join('')}</ul>${many ? `<button class="t-link" data-prop-more="${esc(p.id)}">עוד ${num(p.changes.length - 3)}</button>` : ''}` : ''}
      <div class="t-actions">
        ${p.apply && !done ? `<button class="t-btn is-primary is-sm" data-prop-apply="${esc(p.id)}">${I.check} אישור ופרסום לנהגים</button>` : ''}
        ${p.open ? `<button class="t-btn is-sm" data-prop-open="${esc(p.id)}">פתיחה</button>` : ''}
        ${done ? '<span class="t-source">בוצע ופורסם לנהגים</span>' : ''}
      </div>
    </article>`;
  };
  slot.innerHTML = `<aside class="t-assist" aria-label="עוזר התכנון">
    <header class="t-insp-head"><div class="t-insp-title">${I.assist}<h2>עוזר התכנון</h2></div><p>מציע שינויים. שום דבר לא משתנה בלי אישור שלך.</p>
      <button class="t-icon-btn t-insp-close" data-act="close-assist" aria-label="סגירת העוזר">${I.x}</button></header>
    <form class="t-ask" data-form="ask"><label class="sr-only" for="ask-q">מה לבדוק או לשנות</label>
      <input id="ask-q" placeholder="למשל: דוד מזרחי לא מגיע מחר" value="${esc(a.ask)}" autocomplete="off"><button class="t-btn is-primary" type="submit" aria-label="שליחה">${I.send}</button></form>
    <div class="t-ask-examples">${examples.map(x => `<button class="t-chip" data-ask="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div class="t-insp-body">
      ${a.busy ? '<p class="t-empty">בודק את הסידור…</p>' : r ? (() => {
        // A seat shortage is a problem the planner can solve (a bigger bus, or a split), even when no bigger bus is free.
        const seen = new Set(); const isFix = p => p.tone === 'fix' || p.id.startsWith('seats-');
        const fixes = r.proposals.filter(isFix).filter(p => { const k = planKey(p) ?? p.id; if (seen.has(k)) return false; seen.add(k); return true; });
        const info = r.proposals.filter(p => !isFix(p));
        return `<p class="t-answer">${esc(fixes.length ? `${r.summary.split('.')[0]}. ${fixes.length === 1 ? 'יש בעיה אחת לסדר' : `יש ${num(fixes.length)} בעיות לסדר`}.` : r.summary)}</p>${fixes.map(card).join('')}${info.length ? `<h3 class="t-insp-h">כדאי לדעת</h3>${info.map(card).join('')}` : ''}`;
      })() : ''}
    </div>
  </aside>`;
}
async function applyProposal(id) {
  const a = S.assist;
  const p = a.result.proposals.find(x => x.id === id);
  if (!p?.apply) return;
  const before = dataFor(a.date) ?? await loadDay(a.date);
  const undo = p.apply.assignments.map(x => { const t = before.trips.find(y => y.id === x.tripId); return { tripId: x.tripId, driverId: t?.driverId, vehicleId: t?.vehicleId }; });
  try {
    await command('plan', p.apply, null, a.date);
    a.applied.add(id);
    await loadDay(a.date);
    toast(`${p.title} · נשלח לנהגים`, { undo: () => run(async () => { await command('plan', { assignments: undo, publish: true, reason: 'בוטל לבקשת הסדרן' }, null, a.date); a.applied.delete(id); await loadDay(a.date); await runAssist(); repaint(); }, 'השינוי בוטל') });
    await runAssist(); a.applied.add(id);
    repaint();
  } catch (e) { toast(e.message, { bad: true, retry: () => applyProposal(id) }); }
}
function openProposal(id) {
  const p = S.assist.result.proposals.find(x => x.id === id);
  if (!p?.open) return;
  if (p.open.view === 'fleet') location.hash = '#/drivers';
  else if (p.open.view === 'checks') { S.table.facet = 'checks'; S.rides = 'table'; location.hash = '#/rides'; render(); }
  else openRide(p.open.id ?? p.tripIds[0], S.assist.date, 'overview');
}

// ------------------------------------------------------------ drivers and buses
const daysLeft = iso => Math.round((Date.parse(iso) - Date.parse(TODAY)) / 86_400_000);
const plusDays = (iso, n) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);
const initials = n => String(n || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('');
const avatar = (name, bus = false) => `<span class="t-av ${bus ? 'is-bus' : ''}" aria-hidden="true">${bus ? I.bus : esc(initials(name))}</span>`;
// One status per driver or bus, said in one or two words, with a clear colour.
function recStatus(x, people, date = TODAY) {
  if (x.archived) return ['הוסר מהצי', 'is-done'];
  if (x.available === false) return [people ? 'לא זמין' : 'מושבת', 'is-warn'];
  const now = (x.away ?? []).find(a => a.from <= date && date <= a.to);
  if (now) return [`${now.reason || (people ? 'בהיעדרות' : 'מושבת')} עד ${heDate(now.to)}`, 'is-warn'];
  const left = people ? daysLeft(x.licenseUntil) : 0;
  if (people && !(left >= 0)) return ['רישיון פג', 'is-bad'];
  if (!people && !(daysLeft(x.testUntil) >= 0)) return ['טסט פג', 'is-bad'];
  if (!people && !(daysLeft(x.serviceDue) >= 0)) return ['טיפול באיחור', 'is-bad'];
  const next = (x.away ?? []).find(a => a.from > date && a.from <= plusDays(date, 7));
  if (next) return [`${next.reason || 'היעדרות'} מ־${heDate(next.from)}`, 'is-warn'];
  if (people && left <= 30) return [`רישיון פג בעוד ${num(left)} ימים`, 'is-warn'];
  if (!people && daysLeft(x.testUntil) <= 30) return [`טסט פג בעוד ${num(daysLeft(x.testUntil))} ימים`, 'is-warn'];
  if (!people && daysLeft(x.serviceDue) <= 7) return [`טיפול בעוד ${num(daysLeft(x.serviceDue))} ימים`, 'is-warn'];
  return ['זמין', 'is-ok'];
}
// A short tip that explains a screen once. Closed tips stay closed; "?" can bring them back.
function tip(id, title, text) {
  try { if (localStorage.getItem(`t-tip-${id}`) === 'closed') return ''; } catch {}
  return `<aside class="t-tip" role="note" aria-label="הסבר"><svg class="i t-tip-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-linecap="round"/></svg><p><b>${title}.</b> ${text} <button class="t-tip-hide" data-tip-close="${id}">הסתרה</button></p></aside>`;
}
const statusPill = ([t, c]) => `<span class="t-pill ${c}">${esc(t)}</span>`;
const due = (iso, soon = 14) => !iso ? '<span class="t-pill">לא ידוע</span>' : daysLeft(iso) < 0 ? '<span class="t-pill is-bad">פג</span>' : daysLeft(iso) <= soon ? `<span class="t-pill is-warn">בעוד ${daysLeft(iso)} ימים</span>` : '';
const dateCell = (kind, field, label, soon = 14) => ({
  cellRenderer: p => { const v = p.data[field]; const tone = !v ? 'is-unknown' : daysLeft(v) < 0 ? 'is-bad' : daysLeft(v) <= soon ? 'is-warn' : ''; return `<span class="t-datecell"><input type="date" class="t-date num ${tone}" data-fleet="${kind}" data-id="${p.data.id}" data-field="${field}" value="${esc(v)}" aria-label="${esc(label(p.data))}${tone === 'is-bad' ? ', פג' : tone === 'is-warn' ? `, בעוד ${daysLeft(v)} ימים` : ''}"></span>`; },
  suppressKeyboardEvent: () => true, sortable: true, flex: 1, minWidth: 230,
});
const isPeople = v => v === 'drivers';
function fleetPage(v) {
  const d = S.data;
  const people = isPeople(v);
  const items = people ? d.drivers : d.vehicles;
  const expired = people ? items.filter(x => daysLeft(x.licenseUntil) < 0).length : items.filter(x => daysLeft(x.testUntil) < 0).length;
  const soon = people ? items.filter(x => daysLeft(x.licenseUntil) >= 0 && daysLeft(x.licenseUntil) <= 30).length : items.filter(x => (daysLeft(x.testUntil) >= 0 && daysLeft(x.testUntil) <= 30) || daysLeft(x.serviceDue) <= 7).length;
  return `<div class="t-page t-page-full">
    <header class="t-page-head"><div><h1>${people ? 'נהגים' : 'רכבים'}</h1><p>${[`${num(items.length)} ${people ? 'נהגים' : 'רכבים'}`, expired ? `${num(expired)} ${people ? 'עם רישיון שפג' : 'עם טסט שפג'}` : null, soon ? `${num(soon)} פגים בקרוב` : null].filter(Boolean).join(' · ') || 'הכל בתוקף'}</p></div>
      <div class="t-spacer"></div><button class="t-btn is-primary" data-act="rec-new">${I.plus ?? ''}${people ? 'נהג חדש' : 'רכב חדש'}</button></header>
    <div class="t-filters" role="group" aria-label="סינון">${fleetFilters(v).map(f => `<button class="t-filter" data-ffilter="${f.id}" aria-pressed="${S.fleetFilter === f.id}">${esc(f.label)} <span class="num">${num(f.n)}</span></button>`).join('')}</div>
    <div class="t-grid t-grid-main" id="g-fleet"></div>
  </div>`;
}
function fleetFilters(v) {
  const people = isPeople(v);
  const items = (people ? S.data.drivers : S.data.vehicles).filter(x => !x.archived);
  const st = items.map(x => recStatus(x, people));
  return [{ id: 'all', label: 'הכל', n: items.length }, { id: 'attn', label: 'דורשים טיפול', n: st.filter(s => s[1] === 'is-bad' || (s[1] === 'is-warn' && /פג|טיפול/.test(s[0]))).length },
    { id: 'away', label: people ? 'לא זמינים השבוע' : 'מושבתים השבוע', n: st.filter(s => s[1] === 'is-warn' && !/פג|טיפול/.test(s[0])).length }, { id: 'ok', label: 'זמינים', n: st.filter(s => s[1] === 'is-ok').length }];
}
const fleetMatch = (x, people) => { const [t, c] = recStatus(x, people); const f = S.fleetFilter; return f === 'all' || (f === 'ok' ? c === 'is-ok' : f === 'attn' ? c === 'is-bad' || (c === 'is-warn' && /פג|טיפול/.test(t)) : c === 'is-warn' && !/פג|טיפול/.test(t)); };
function fleetRows(v) {
  const d = S.data;
  const trips = (field, id) => d.trips.filter(t => t[field] === id).length;
  const soon = (iso, n) => !iso || daysLeft(iso) <= n;
  return isPeople(v)
    ? [...d.drivers].filter(x => fleetMatch(x, true)).sort((a, b) => (a.licenseUntil < b.licenseUntil ? -1 : 1)).map(x => ({ ...x, today: trips('driverId', x.id) }))
    : [...d.vehicles].filter(x => fleetMatch(x, false)).sort((a, b) => ((a.testUntil || '9') < (b.testUntil || '9') ? -1 : 1)).map(x => ({ ...x, today: trips('vehicleId', x.id) }));
}
function mountFleet(v) {
  const flash = { 't-flash': p => p.data?.id === S.flash };
  const columnDefs = isPeople(v) ? [
    { headerName: 'נהג', field: 'name', flex: 1.4, minWidth: 200, cellRenderer: p => `<div class="t-person-cell">${avatar(p.value)}${two(esc(p.value), p.data.routeCode ? `קו ${esc(p.data.routeCode)}` : 'נהג חלופי')}</div>` },
    { headerName: 'מצב', colId: 'status', width: 190, valueGetter: p => recStatus(p.data, true)[0], cellRenderer: p => statusPill(recStatus(p.data, true)) },
    { headerName: 'טלפון', field: 'contact', width: 140, cellRenderer: p => `<span dir="ltr" class="num">${esc(p.value)}</span>` },
    { headerName: 'רישיון', field: 'licenseType', width: 90 },
    { headerName: 'רישיון בתוקף עד', field: 'licenseUntil', ...dateCell('driver', 'licenseUntil', x => `תוקף רישיון של ${x.name}`, 30) },
    { headerName: 'רכב קבוע', colId: 'bus', width: 130, valueGetter: p => S.data.vehicles.find(v => v.id === `bus-${p.data.routeCode}`)?.label ?? '—' },
    { headerName: 'נסיעות היום', field: 'today', width: 120, cellClass: endCell },
  ] : [
    { headerName: 'רכב', field: 'label', flex: 1.2, minWidth: 180, cellRenderer: p => `<div class="t-person-cell">${avatar(p.value, true)}${two(esc(p.value), `<span dir="ltr">${esc(p.data.registration)}</span>`)}</div>` },
    { headerName: 'מצב', colId: 'status', width: 190, valueGetter: p => recStatus(p.data, false)[0], cellRenderer: p => statusPill(recStatus(p.data, false)) },
    { headerName: 'מקומות', field: 'capacity', width: 100, cellClass: endCell, cellRenderer: p => (p.value ? num(p.value) : '<span class="t-quiet">לא רשום</span>') },
    { headerName: 'טסט בתוקף עד', field: 'testUntil', ...dateCell('vehicle', 'testUntil', x => `תוקף טסט ל${x.label}`, 30) },
    { headerName: 'טיפול הבא', field: 'serviceDue', ...dateCell('vehicle', 'serviceDue', x => `מועד טיפול ל${x.label}`, 7) },
    { headerName: 'נסיעות היום', field: 'today', width: 120, cellClass: endCell },
  ];
  const g = grid($('#g-fleet'), 'fleet', { rowData: fleetRows(v), rowClassRules: { ...flash, 't-grid-selected': p => p.data?.id === S.rec?.id }, columnDefs,
    onRowClicked: e => { if (!e.event?.target?.closest?.('input,button,a')) openRecord(v, e.data.id); },
    onCellKeyDown: e => { if (e.event?.key === 'Enter' && !e.event.target.closest('input')) openRecord(v, e.data.id); } });
  if (S.flash) { const n = g?.getRowNode(S.flash); if (n) setTimeout(() => g.ensureNodeVisible(n, 'middle'), 50); }
}
function paintFleet() {
  S.grids.fleet?.setGridOption('rowData', fleetRows(view())); S.grids.fleet?.redrawRows();
  if (S.flash) { const n = S.grids.fleet?.getRowNode(S.flash); if (n) S.grids.fleet.ensureNodeVisible(n, 'middle'); }
  document.querySelectorAll('[data-ffilter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ffilter === S.fleetFilter));
  const counts = new Map(fleetFilters(view()).map(f => [f.id, f.n]));
  document.querySelectorAll('[data-ffilter] .num').forEach(n => { n.textContent = num(counts.get(n.parentElement.dataset.ffilter) ?? 0); });
}
// ---- one driver or bus: details, availability, removal. Saving shows what it changes for the coming days.
function openRecord(v, id) {
  const people = isPeople(v);
  const src = id ? (people ? S.data.drivers : S.data.vehicles).find(x => x.id === id) : null;
  S.rec = { v, id, draft: src ? structuredClone(src) : (people ? { name: '', contact: '', licenseType: 'D', licenseUntil: '', available: true, away: [] } : { label: '', registration: '', capacity: null, testUntil: '', serviceDue: '', available: true, away: [] }) };
  S.rec.draft.away ??= [];
  paintRecord(); S.grids.fleet?.redrawRows();
  if (DAYS.some(x => !S.week[x.date])) Promise.all(DAYS.filter(x => !S.week[x.date]).map(x => loadDay(x.date))).then(() => { if (S.rec?.id === id) paintRecord(); });
}
function paintRecord() {
  const slot = $('#inspector');
  const r = S.rec;
  if (!r) { slot.innerHTML = ''; return; }
  const people = isPeople(r.v);
  const x = r.draft;
  const field = (key, label, type = 'text', extra = '') => `<div class="t-field"><label for="rec-${key}">${label}</label><input id="rec-${key}" class="t-input" data-rec="${key}" type="${type}" value="${esc(x[key] ?? '')}" ${extra}></div>`;
  const regular = people ? S.data.template && Object.entries(S.data.template).filter(([, c]) => c.driverId === x.id).map(([code]) => code) : Object.entries(S.data.template ?? {}).filter(([, c]) => c.vehicleId === x.id).map(([code]) => code);
  slot.innerHTML = `<aside class="t-insp t-rec" aria-label="${people ? 'נהג' : 'רכב'}">
    <header class="t-insp-head"><div class="t-insp-title">${avatar(people ? x.name : x.label, !people)}<h2 tabindex="-1" id="rec-title">${esc((people ? x.name : x.label) || (people ? 'נהג חדש' : 'רכב חדש'))}</h2>${r.id ? statusPill(recStatus(x, people)) : ''}</div>
      <p>${r.id ? (regular?.length ? `צוות קבוע של ${regular.map(c => `קו ${c}`).join(', ')}` : people ? 'נהג חלופי' : 'רכב חלופי') : 'אחרי השמירה אפשר לשבץ אותו בבניית הסידור.'}</p>
      <button class="t-icon-btn t-insp-close" data-act="rec-close" aria-label="סגירה">${I.x}</button></header>
    <div class="t-insp-body">
      ${r.id ? `<div class="t-recweek" aria-label="השבוע">${DAYS.map(dd => { const dd2 = dataFor(dd.date); const n = dd2 ? dd2.trips.filter(t => (people ? t.driverId : t.vehicleId) === x.id).length : null; const off = (x.away ?? []).some(a => a.from <= dd.date && dd.date <= a.to); return `<span class="${off ? 'is-off' : ''}"><small>${esc(dayShort(dd.date))}</small><b class="num">${off ? '—' : n == null ? '' : num(n)}</b></span>`; }).join('')}</div><p class="t-source">נסיעות בכל יום השבוע</p>` : ''}
      <h3 class="t-insp-h">פרטים</h3>
      ${people ? `${field('name', 'שם מלא')}${field('contact', 'טלפון', 'tel', 'dir="ltr"')}
        <div class="t-field"><label for="rec-licenseType">סוג רישיון</label><select id="rec-licenseType" class="t-select" data-rec="licenseType">${['D', 'C1', 'D1'].map(o => `<option ${x.licenseType === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        ${field('licenseUntil', 'רישיון בתוקף עד', 'date')}`
      : `${field('label', 'שם הרכב')}${field('registration', 'מספר רישוי', 'text', 'dir="ltr"')}${field('capacity', 'מספר מקומות', 'number', 'min="1" max="99"')}${field('testUntil', 'טסט בתוקף עד', 'date')}${field('serviceDue', 'טיפול הבא עד', 'date')}`}
      <div class="t-pop-row t-rec-switch"><span id="l-avail">${people ? 'זמין לשיבוץ' : 'זמין לשיבוץ (לא מושבת)'}</span><button class="t-switch" role="switch" aria-checked="${x.available !== false}" aria-labelledby="l-avail" data-act="rec-avail"></button></div>
      <h3 class="t-insp-h">${people ? 'היעדרויות' : 'השבתות'}</h3>
      <div class="t-away">${x.away.map((a, i) => `<div class="t-away-row"><span class="num">${a.from.split('-').reverse().join('.')} – ${a.to.split('-').reverse().join('.')}</span><span>${esc(a.reason || '')}${a.sub ? ` · מחליף: ${esc(S.data.drivers.find(o => o.id === a.sub)?.name ?? '')}` : ''}</span><button class="t-icon-btn" data-away-del="${i}" aria-label="הסרה">${I.x}</button></div>`).join('') || `<p class="t-source">אין ${people ? 'היעדרויות' : 'השבתות'} מתוכננות.</p>`}
        <div class="t-away-add"><b class="t-away-title">${people ? 'הוספת היעדרות' : 'הוספת השבתה'}</b><div class="t-field"><label for="away-from">מתאריך</label><input type="date" class="t-input" id="away-from"></div><div class="t-field"><label for="away-to">עד תאריך</label><input type="date" class="t-input" id="away-to"></div><div class="t-field t-span"><label for="away-reason">סיבה</label><input class="t-input" id="away-reason" placeholder="${people ? 'חופשה, מחלה, מילואים' : 'מוסך, תקלה'}"></div>
          ${people && r.id ? `<div class="t-field t-span"><label for="away-sub">מי מחליף בימים האלה</label><select id="away-sub" class="t-select"><option value="">אחליט בבניית הסידור</option>${S.data.drivers.filter(o => o.id !== r.id && !o.archived && o.available !== false && o.licenseUntil >= TOMORROW).sort((a, b) => Number(Boolean(a.routeCode)) - Number(Boolean(b.routeCode))).map(o => `<option value="${o.id}">${esc(o.name)}${o.routeCode ? ` · קו ${o.routeCode}` : ' · חלופי'}</option>`).join('')}</select></div>` : ''}
          <button class="t-btn is-sm" data-act="away-add">${I.plus} ${people ? 'הוספת היעדרות' : 'הוספת השבתה'}</button></div>
      </div>
      <div id="rec-impact"></div>
    </div>
    <footer class="t-insp-foot"><button class="t-btn is-primary" data-act="rec-save">שמירה</button>${r.id && !x.archived ? `<button class="t-btn is-ghost t-danger" data-act="rec-archive">הסרה מהצי</button>` : ''}${x.archived ? '<button class="t-btn" data-act="rec-restore">החזרה לצי</button>' : ''}</footer>
  </aside>`;
  if (!r.focused) { $('#rec-title')?.focus({ preventScroll: true }); r.focused = true; }
}
// A renewed licence or test: the person or bus can drive again, so offer them their own route back.
async function giveBackOffer(kind, id) {
  const people = kind === 'driver';
  const rec = (people ? S.data.drivers : S.data.vehicles).find(x => x.id === id);
  if (!rec || recStatus(rec, people)[1] === 'is-bad') return null;
  const code = people ? rec.routeCode : id.replace(/^bus-/, '');
  if (!code || !S.data.template?.[code]) return null;
  const field = people ? 'driverId' : 'vehicleId';
  await Promise.all(DAYS.filter(x => !S.week[x.date]).map(x => loadDay(x.date)));
  const days = DAYS.map(x => ({ date: x.date, trips: (dataFor(x.date)?.trips ?? []).filter(t => t.routeCode === code && t[field] !== id && editableTrip(t, x.date)) })).filter(x => x.trips.length);
  const tplOther = S.data.template[code][field] !== id;
  if (!days.length && !tplOther) return null;
  const n = days.reduce((a, x) => a + x.trips.length, 0);
  const name = people ? rec.name : rec.label;
  return {
    label: `${people ? firstName(name) : name} יכול${people ? '' : ''} לחזור לקו ${code}${n ? ` (${num(n)} נסיעות השבוע)` : ''}`,
    fn: () => run(async () => {
      if (tplOther) await command('template', { routeCode: code, [field]: id }, null, TODAY);
      for (const x of days) { const fresh = (await loadDay(x.date)).trips.filter(t => t.routeCode === code && t[field] !== id && editableTrip(t, x.date)); if (fresh.length) await command('plan', { assignments: fresh.map(t => ({ tripId: t.id, [field]: id })), publish: true, reason: `${name} חזר לקו ${code}` }, null, x.date); }
      S.week = {}; await loadDay(TODAY); await Promise.all(DAYS.map(x => loadDay(x.date))); repaint();
    }, `${name} חזר לקו ${code} · הנהגים קיבלו הודעה`),
  };
}
async function upcomingImpact(id) {
  // Which rides in the coming days can't run with this driver or bus now.
  const out = [];
  for (const day of DAYS.slice(1, 4)) { const d = await loadDay(day.date); const ts = d.trips.filter(t => (t.driverId === id || t.vehicleId === id) && t.blockers.length); if (ts.length) out.push({ day, n: ts.length }); }
  return out;
}
async function saveRecord() {
  const r = S.rec; const people = isPeople(r.v); const x = r.draft;
  const data = people ? { id: r.id ?? undefined, name: x.name, contact: x.contact, licenseType: x.licenseType, licenseUntil: x.licenseUntil, available: x.available !== false, away: x.away }
    : { id: r.id ?? undefined, label: x.label, registration: x.registration, capacity: x.capacity === '' || x.capacity == null ? null : Number(x.capacity), testUntil: x.testUntil, serviceDue: x.serviceDue, available: x.available !== false, away: x.away };
  try {
    await command(people ? 'driver-save' : 'vehicle-save', { ...data, away: data.away.map(({ sub, ...a }) => a) }, null, TODAY);
    await loadDay(TODAY);
    // An absence with a substitute moves that driver's rides on those days to the substitute, as drafts.
    let moved = 0;
    if (people && r.id) for (const a of x.away.filter(a => a.sub)) for (const day of DAYS.filter(dd => dd.date >= a.from && dd.date <= a.to && dd.date > TODAY)) {
      const dd = await loadDay(day.date);
      const ts = dd.trips.filter(t => t.driverId === r.id && t.phase === 'pending');
      if (ts.length) { await command('plan', { assignments: ts.map(t => ({ tripId: t.id, driverId: a.sub })), publish: false, reason: `מחליף בזמן ההיעדרות של ${x.name}` }, null, day.date); moved += ts.length; await loadDay(day.date); }
    }
    if (moved) { S.rec = null; paintRecord(); paintFleet(); toast(`${num(moved)} נסיעות עברו למחליף כטיוטה`, { action: { label: 'לבניית הסידור', fn: () => { S.plan.view = 'day'; location.hash = '#/plan'; } } }); return; }
    const saved = r.id ?? (people ? S.data.drivers : S.data.vehicles).at(-1)?.id;
    S.rec = null; paintRecord(); paintFleet(); S.flash = saved; paintFleet();
    const impact = saved ? await upcomingImpact(saved) : [];
    const back = r.id ? await giveBackOffer(people ? 'driver' : 'vehicle', r.id) : null;
    if (back) { toast(`נשמר · ${back.label}?`, { action: { label: 'להחזיר', fn: back.fn } }); return; }
    toast(impact.length ? `נשמר. ${impact.map(i => `${dayWord(i.day.date)}: ${i.n} נסיעות צריכות צוות אחר`).join(' · ')}` : 'נשמר. אין שינוי בנסיעות של הימים הקרובים.');
  } catch (e) { toast(e.message, { bad: true }); }
}
async function archiveRecord(restore = false) {
  const r = S.rec; const people = isPeople(r.v);
  const n = DAYS.slice(1).reduce((k, day) => k + (dataFor(day.date)?.trips.filter(t => t.driverId === r.id || t.vehicleId === r.id).length ?? 0), 0);
  if (!restore && !(await ask(`להסיר את ${people ? r.draft.name : r.draft.label} מהצי? ${n ? `הוא משובץ ל־${n} נסיעות השבוע, והן יופיעו בבניית הסידור כצריכות צוות.` : ''}`, 'הסרה מהצי', 'ביטול'))) return;
  await run(async () => { await command('archive', { kind: people ? 'driver' : 'vehicle', id: r.id, restore }, null, TODAY); await loadDay(TODAY); S.rec = null; paintRecord(); paintFleet(); }, restore ? 'הוחזר לצי' : 'הוסר מהצי. אפשר להחזיר מהרשימה.');
}

// ------------------------------------------------------------ the brief, point by point (presenter tour)
const BRIEF = [
  { title: 'מטרת המוצר', text: 'מקום אחד לתכנן, לעקוב בזמן אמת ולראות את כל המערך: נסיעות, נהגים, אוטובוסים ותלמידים.', go: () => { S.rides = 'board'; location.hash = '#/rides'; }, spot: '#board', say: 'כל המערך סביב הנסיעות: מה דורש טיפול, מה יוצא, מה בדרך ומה הגיע.' },
  { title: 'ממשק הסדרנים', text: 'סידור יומי, שיוך נהג ורכב, תחנות ותלמידים, מצב כל נסיעה, מתוכנן מול בפועל, והתראות.', go: async () => { location.hash = '#/rides'; await wait(400); const t = S.data.trips.find(x => x.status === 'active'); if (t) await openRide(t.id, TODAY, 'overview'); }, spot: '.t-insp', say: 'כל נסיעה נפתחת בצד: תחנות עם מתוכנן מול בפועל, הנהג, הרכב, והתראות עם פעולה.' },
  { title: 'ממשק הנהג', text: 'סידור העבודה, תחנה אחת בכל מסך, ספירה, אישור יציאה בהחלקה, ופיזור.', go: async () => { if (!S.phone) { S.phone = true; paintPhone(); } }, spot: '.t-phone', say: 'הנהג רואה רק את הנסיעות שלו. מחליקים רק כשהרכב עומד.' },
  { title: 'נהגים וצי רכב', text: 'פרטי קשר, סוג רישיון ותוקפו, טסט, טיפולים וזמינות, עם התראה לפני שפג.', go: () => { S.fleetFilter = 'attn'; location.hash = '#/drivers'; }, spot: '#g-fleet', say: 'מה שפג או עומד לפוג, ולחיצה על תאריך מעדכנת.' },
  { title: 'תהליך העבודה', text: 'שלב 1: בונים את הסידור למחר. משם הנהג רואה, מדווח, והדשבורד מתעדכן.', go: () => { location.hash = '#/plan'; }, spot: '#plan-body', say: 'הנסיעות כבר בסידור. רואים רק מה צריך לסדר מחר, סיבה בכל כרטיס, עם הצעה ואישור אחד.' },
  { title: 'הדמו (MVP)', text: 'דשבורד עם מפה, סידור יומי, ממשק נהג, עדכון מיידי וניהול צי, כולם על הנתונים שלכם.', go: async () => { location.hash = '#/rides'; await wait(300); await openMap(); }, spot: '.t-mapfull', say: 'המפה החיה, עם כל האוטובוסים. נפתחת בלחיצה, לא מסתירה את העבודה.' },
  { title: 'מה למדנו מהקובץ', text: 'מסלולים ותחנות: קוד סידור הוא האוטובוס, נסיעה היא יום + קוד + מספר. יש קווי בוקר וצהריים שונים בכל יום, ושישי שונה. גם נהגי מועצה וגם קבלנים. בקובץ רק מספרי תלמידים, בלי שמות. אין בו נתוני נהגים ותוקפים, ולא GPS.' },
  { title: 'נקודות לתכנון', text: 'בטיחות: דיווח רק בהחלקה כשהרכב עומד. אמינות: כל מספר מסומן "דיווח נהג" או "משוער". הרשאות: נהג רואה רק את שלו. פרטיות: מספרים בלבד. בלי קליטה: הדיווחים נשמרים בטלפון ונשלחים כשחוזרת קליטה.' },
  { title: 'הצעד הבא', text: 'כל 710 הנסיעות השבועיות מהאקסל שלכם כבר בפנים. כדי לעבור לפיילוט: חיבור ל־GPS הקיים, רשימת נהגים ורכבים עם תוקפים, ואישור של הזרימה הזו מול שוקי וענבל.' },
];
const wait = ms => new Promise(r => setTimeout(r, ms));
function paintTour() {
  const slot = $('#tour');
  if (!S.tour) { slot.innerHTML = ''; clearSpot(); return; }
  const i = S.tour.step;
  const b = BRIEF[i];
  slot.innerHTML = `<aside class="t-tour ${i === 2 ? 'is-away' : ''}" aria-label="הבריף, 9 הנקודות">
    <header><b>הבריף · ${i + 1} מתוך ${BRIEF.length}</b><button class="t-icon-btn" data-act="tour-close" aria-label="סגירת הסיור">${I.x}</button></header>
    <ol class="t-tour-steps">${BRIEF.map((x, k) => `<li><button data-tour="${k}" aria-current="${k === i}">${k + 1}</button></li>`).join('')}</ol>
    <h3>${esc(b.title)}</h3><p>${esc(b.text)}</p>
    <div class="t-actions">${i > 0 ? '<button class="t-btn is-sm" data-tour-step="-1">הקודם</button>' : ''}${i < BRIEF.length - 1 ? '<button class="t-btn is-primary is-sm" data-tour-step="1">הבא</button>' : '<button class="t-btn is-primary is-sm" data-act="tour-close">סיום</button>'}</div>
  </aside>`;
}
async function tourGo(i) {
  S.tour = { step: i }; S.pop = false; rail();
  clearSpot();
  if (S.mapOpen && i !== 5) closeMap();
  paintTour();
  const b = BRIEF[i];
  if (b.go) { await b.go(); await wait(700); }
  if (b.spot) spot(b.spot, b.say);
}
function spot(sel, text) {
  clearSpot();
  const el = document.querySelector(sel);
  if (!el) return;
  el.scrollIntoView({ block: 'nearest' });
  el.classList.add('t-spot');
  const r = el.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.className = 't-callout'; tip.textContent = text; tip.setAttribute('role', 'note');
  document.body.append(tip);
  const top = r.top > 120 ? r.top - tip.offsetHeight - 12 : Math.min(window.innerHeight - tip.offsetHeight - 12, r.bottom + 12);
  tip.style.top = `${Math.max(12, top)}px`;
  tip.style.left = `${Math.max(12, Math.min(window.innerWidth - tip.offsetWidth - 12, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
}
function clearSpot() { document.querySelectorAll('.t-spot').forEach(x => x.classList.remove('t-spot')); document.querySelectorAll('.t-callout').forEach(x => x.remove()); }

// ------------------------------------------------------------ help
function paintHelp() {
  const slot = $('#dialog');
  if (!S.help) { if (slot.querySelector('.t-help')) slot.innerHTML = ''; return; }
  const k = IS_MAC ? '⌘' : 'Ctrl';
  slot.innerHTML = `<div class="t-scrim" data-act="help-close"><div class="t-dialog t-help" role="dialog" aria-modal="true" aria-labelledby="help-t">
    <header><h2 id="help-t">איך עובדים כאן</h2><button class="t-icon-btn" data-act="help-close" aria-label="סגירה">${I.x}</button></header>
    <div class="t-help-cols">
      <section><h3>המסכים</h3><ul>
        <li><b>נסיעות</b>: מה דורש טיפול עכשיו, מה יוצא, מה בדרך ומה הגיע. לחיצה על נסיעה פותחת אותה בצד.</li>
        <li><b>סידור</b>: הנסיעות מגיעות מהסידור הקבוע. לכל יום רואים רק מה צריך לסדר, סיבה אחת בכל כרטיס, עם הצעה ואישור. "משהו השתנה" כשנהג לא מגיע או רכב לא זמין.</li>
        <li><b>נהגים</b> ו<b>רכבים</b>: תוקף רישיון, טסט וטיפולים. לחיצה על תאריך מעדכנת אותו.</li>
        <li><b>עוזר התכנון</b>: כותבים מה קרה ("דוד לא מגיע מחר") ומקבלים הצעה לאישור.</li>
      </ul></section>
      <section><h3>מצבי נסיעה</h3><ul>
        ${Object.entries(STATUS).map(([k, [label]]) => `<li>${pill(k)} ${{ upcoming: 'עוד לא הגיעה שעת היציאה', blocked: 'לא יכולה לצאת: רישיון, טסט או שיבוץ', late: 'עברה שעת היציאה והאוטובוס לא יצא', active: 'האוטובוס בדרך', delayed: 'בדרך, באיחור', completed: 'הגיעה לבית הספר' }[k]}</li>`).join('')}
        <li>אדום מסמן רק דבר שמשפיע על ילדים עכשיו או נסיעה שלא יכולה לצאת.</li>
      </ul>
      <h3>קיצורים</h3><ul class="t-keys">
        <li><kbd class="t-kbd">${k} K</kbd> או <kbd class="t-kbd">/</kbd> חיפוש</li>
        <li><kbd class="t-kbd">M</kbd> מפה חיה</li>
        <li><kbd class="t-kbd">A</kbd> עוזר התכנון</li>
        <li><kbd class="t-kbd">Esc</kbd> סגירה</li>
        <li><kbd class="t-kbd">?</kbd> העזרה הזו</li>
      </ul><button class="t-btn is-sm" data-act="tips-on">להציג שוב את הטיפים</button></section>
    </div></div></div>`;
  slot.querySelector('[data-act=help-close].t-icon-btn')?.focus();
}

// ------------------------------------------------------------ command bar
function cmdItems() {
  const d = S.data;
  const items = [
    { kind: 'מסך', label: 'נסיעות', sub: 'מה דורש טיפול, מה בדרך ומה הגיע', go: () => { location.hash = '#/rides'; } },
    { kind: 'מסך', label: 'בניית סידור', sub: 'חודש, סידור קבוע, ושיבוץ צוות לכל יום', go: () => { location.hash = '#/plan'; } },
    { kind: 'מסך', label: 'נהגים', sub: 'טלפונים ותוקף רישיון', go: () => { location.hash = '#/drivers'; } },
    { kind: 'מסך', label: 'רכבים', sub: 'מקומות, טסט וטיפולים', go: () => { location.hash = '#/vehicles'; } },
    { kind: 'פעולה', label: 'מפה חיה', sub: 'כל האוטובוסים על המפה', go: () => openMap() },
    { kind: 'פעולה', label: 'בדיקת מחר עם העוזר', sub: 'מה חסר בסידור של מחר', go: () => openAssist(TOMORROW) },
  ];
  const order = { late: 0, delayed: 0, active: 1, blocked: 2, upcoming: 3, completed: 4 };
  [...d.trips].sort((a, b) => order[a.status] - order[b.status] || a.departure.localeCompare(b.departure)).forEach(t => items.push({
    kind: 'נסיעה', label: `קו ${t.routeCode} · ${t.school}`, sub: `${t.departure} · ${STATUS[t.status]?.[0] ?? ''} · ${t.driverName} · ${t.points.filter(p => p.kind === 'stop').map(p => p.name).join(', ')}`,
    hay: `${t.number} ${t.routeCode} קו ${t.routeCode} ${t.school} ${t.driverName} ${t.vehicleName} ${t.stops.map(s => s.name).join(' ')}`, go: () => openRide(t.id, TODAY, 'overview'),
  }));
  d.drivers.forEach(x => items.push({ kind: 'נהג', label: x.name, sub: x.routeCode ? `קו ${x.routeCode}` : 'נהג חלופי', go: () => { S.flash = x.id; location.hash = '#/drivers'; } }));
  d.vehicles.forEach(x => items.push({ kind: 'רכב', label: x.label, sub: x.capacity ? `${x.capacity} מקומות` : 'מספר מקומות לא ידוע', go: () => { S.flash = x.id; location.hash = '#/vehicles'; } }));
  return items;
}
function cmdResults() {
  const words = S.cmd.q.trim().split(/\s+/).filter(Boolean);
  const all = cmdItems();
  if (!words.length) return all.slice(0, 10);
  return all.filter(it => { const h = `${it.label} ${it.sub} ${it.hay ?? ''}`; return words.every(w => h.includes(w)); }).slice(0, 30);
}
function drawCmd() {
  const root = $('#cmd');
  if (!S.cmd) { root.innerHTML = ''; return; }
  const res = cmdResults();
  S.cmd.res = res;
  S.cmd.i = Math.min(S.cmd.i, Math.max(0, res.length - 1));
  const list = res.map((it, i) => `<li role="option" id="c-${i}" data-ci="${i}" aria-selected="${i === S.cmd.i}"><span class="t-kind">${it.kind}</span><span><b>${esc(it.label)}</b><br><small>${esc(it.sub)}</small></span>${i === S.cmd.i ? '<kbd class="t-kbd">↵</kbd>' : '<span></span>'}</li>`).join('');
  if (!$('.t-cmd')) {
    root.innerHTML = `<div class="t-cmd-scrim" data-act="cmd-close"><div class="t-cmd" role="dialog" aria-label="חיפוש">
      <input id="cmd-q" role="combobox" aria-expanded="true" aria-controls="cmd-list" autocomplete="off" placeholder="נסיעה, קו, יישוב, נהג, רכב או פעולה">
      <ul id="cmd-list" role="listbox"></ul></div></div>`;
    $('#cmd-q').focus();
  }
  $('#cmd-list').innerHTML = list || '<li class="t-cmd-empty">לא נמצא. נסו מספר קו או שם יישוב.</li>';
  $('#cmd-q').setAttribute('aria-activedescendant', res.length ? `c-${S.cmd.i}` : '');
  $(`#c-${S.cmd.i}`)?.scrollIntoView({ block: 'nearest' });
}
const openCmd = () => { S.pop = false; S.cmd = { q: '', i: 0 }; drawCmd(); };
const closeCmd = () => { S.cmd = null; drawCmd(); };
function pickCmd(i) { const it = S.cmd?.res?.[i]; closeCmd(); it?.go(); }

// ------------------------------------------------------------ driver phone (presenter only)
function paintPhone() {
  const slot = $('#phone-slot');
  if (!S.phone) { slot.innerHTML = ''; return; }
  if ($('#phone') && $('#phone').dataset.driver === S.driver) return;
  slot.innerHTML = `<div class="t-phone-float"><div class="t-phone ${S.offline ? 'is-offline' : ''}"><div class="t-phone-screen">
    <div class="t-status" aria-hidden="true"><span class="t-status-time num">${esc(S.data.clock)}</span><span class="t-island"></span><span class="t-status-icons"><span class="t-no-service">אין שירות</span><span class="t-signal"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg></span><svg viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" opacity=".4"/></svg></span></div>
    <iframe id="phone" data-driver="${esc(S.driver)}" title="אפליקציית הנהג" src="./driver.html?d=${encodeURIComponent(S.driver)}&date=${TODAY}&frame=1&theme=${S.theme}"></iframe>
    <span class="t-home" aria-hidden="true"></span>
  </div></div></div>`;
}

// ------------------------------------------------------------ render
async function render() {
  rail();
  clearSpot();
  const v = view();
  const main = $('#main');
  dropGrids();
  if (v === 'plan') {
    main.innerHTML = plannerPage();
    await planView(S.plan.view);
  } else if (v === 'drivers' || v === 'vehicles') {
    main.innerHTML = fleetPage(v); mountFleet(v);
  } else {
    main.innerHTML = ridesPage(); ridesMeta();
    if (S.rides === 'table') mountTable();
  }
  paintInspector(); paintAssist(); paintPhone(); paintTour();
}
function repaint() {
  railTick();
  const v = view();
  if (v === 'rides') paintRides();
  if (v === 'plan') paintPlanner();
  if ((v === 'drivers' || v === 'vehicles') && !document.activeElement?.matches?.('.t-date')) paintFleet();
  if (S.insp && !S.dirty && !(S.insp.tab === 'overview' && S.composing)) paintInspector();
  else if (S.insp && S.composing) { const body = $('#insp-body'); if (body && S.insp.tab === 'overview') { /* keep the draft; counts refresh on next open */ } }
  if (S.mapOpen) { mapUpdate(); paintMapList(); } else S.map?.update?.(S.data, S.insp?.id ?? null);
  if (S.inspMap && S.insp?.date === TODAY) S.inspMap.update(S.data, S.insp.id);
}
async function refresh() {
  try { await loadDay(TODAY); } catch (e) { toast(e.message, { bad: true, retry: refresh }); return; }
  if (S.insp && S.dirty && S.insp.date === TODAY) { S.stale = true; const el = $('#stale'); if (el && !el.innerHTML) el.innerHTML = '<div class="t-stale"><span>מישהו שינה את הנסיעה בינתיים.</span><button class="t-btn is-sm" data-act="reload">טעינה מחדש</button></div>'; }
  repaint();
}

// ------------------------------------------------------------ events
document.addEventListener('click', async e => {
  const link = e.target.closest('a[href^="#/"]');
  if (link && S.dirty) { e.preventDefault(); if (await leaveEdits()) { S.dirty = false; location.hash = link.getAttribute('href'); } return; }
  if (S.pop && !e.target.closest('.t-pop-wrap')) { S.pop = false; S.confirmReset = false; rail(); }
  if (!e.target.closest('.t-callout,.t-tour')) clearSpot();
  const call = e.target.closest('[data-call]');
  if (call) { e.preventDefault(); const [name, phone] = call.dataset.call.split('|'); toast(`מחייג ל${name} · ${phone}`); return; }
  const pick = e.target.closest('[data-theme-pick]');
  if (pick) { applyTheme(pick.dataset.themePick); rail(); return; }
  const ci = e.target.closest('[data-ci]');
  if (ci) { pickCmd(Number(ci.dataset.ci)); return; }
  if (S.picker && !e.target.closest('.t-picker') && !e.target.closest('[data-pick],[data-tpick],[data-rowmenu]')) closePicker();
  const pk = e.target.closest('[data-pick]');
  if (pk && !pk.disabled) { const [k, id] = pk.dataset.pick.split(':'); pickCrew(pk, k, id); return; }
  const tp = e.target.closest('[data-tpick]');
  if (tp) { const [k, code] = tp.dataset.tpick.split(':'); pickRegular(tp, k, code); return; }
  const rm = e.target.closest('[data-rowmenu]');
  if (rm) { rowMenu(rm, rm.dataset.rowmenu); return; }
  const ok = e.target.closest('[data-opt-ok]');
  if (ok) { const [scope, key] = ok.dataset.optOk.split('|'); const warn = ok.dataset.optWarn; (warn ? ask(`${ok.textContent.split(': ').pop()}: ${warn}. לשבץ בכל זאת? הנסיעה תישאר מסומנת עד שזה יסודר.`, 'לשבץ בכל זאת', 'ביטול') : Promise.resolve(true)).then(y => y && confirmOption(scope, key, ok.dataset.optId)); return; }
  const os = e.target.closest('[data-oscope]');
  if (os) { const [k, v] = os.dataset.oscope.split(/\|(?=[^|]+$)/); S.optScope[k] = v; paintPlanner(); return; }
  const om = e.target.closest('[data-opt-more]');
  if (om) { S.optMore[om.dataset.optMore] = !S.optMore[om.dataset.optMore]; view() === 'plan' ? paintPlanner() : paintRides(); return; }
  const ib = e.target.closest('[data-inbox-done]');
  if (ib) { const id = ib.dataset.inboxDone; run(async () => { await command('inbox-done', { id }); await loadDay(TODAY); repaint(); }, 'סומן כטופל'); return; }
  const ip = e.target.closest('[data-inbox-plan]');
  if (ip) { S.plan.day = ip.dataset.inboxPlan; S.plan.view = 'fix'; location.hash = '#/plan'; return; }
  const mz = e.target.closest('[data-mapz]');
  if (mz) { S.map?.zoom?.(Number(mz.dataset.mapz)); return; }
  const mf = e.target.closest('[data-mapf]');
  if (mf) { S.mapF = mf.dataset.mapf; paintMapSide(); mapUpdate(); return; }
  const msel = e.target.closest('[data-mapsel]');
  if (msel) { mapSelect(msel.dataset.mapsel); return; }
  const msh = e.target.closest('[data-mshift]');
  if (msh && !msh.disabled) { shiftMonth(Number(msh.dataset.mshift)); return; }
  const pp = e.target.closest('[data-prop-plan]');
  if (pp) { const [key, date] = pp.dataset.propPlan.split('|'); S.assist = null; paintAssist(); rail(); location.hash = '#/plan'; setTimeout(async () => { await planGo(date); const i = causes(date).findIndex(c => c.key === key); S.plan.ci = Math.max(0, i); paintPlanner(); }, 0); return; }
  const ft = e.target.closest('[data-fixtoday]');
  if (ft) { const i = Number(ft.dataset.fixtoday); location.hash = '#/plan'; S.plan.day = TODAY; S.plan.view = 'fix'; S.plan.ci = i; setTimeout(() => { S.plan.ci = i; planGo(TODAY).then(() => { S.plan.ci = i; paintPlanner(); }); }, 0); return; }
  const md = e.target.closest('[data-mday]');
  if (md) { S.mdayFocused = false; openMonthDay(md.dataset.mday); return; }
  const mdo = e.target.closest('[data-mdo]');
  if (mdo) { const [kind, school] = mdo.dataset.mdo.split('|'); S.mdo = kind ? { kind, school } : null; paintMonthDay(); return; }
  const ms = e.target.closest('[data-mset]');
  if (ms) { const [k, v] = ms.dataset.mset.split(':'); S.mdo[k] = v; if (k === 'why' && S.mdo.kind === 'day') S.mdo.to = $('#mday-to')?.value || S.mdo.to; paintMonthDay(); return; }
  const mg = e.target.closest('[data-mgo]');
  if (mg) { if (S.mdo?.kind === 'day') S.mdo.to = $('#mday-to')?.value || ''; monthDayGo(mg.dataset.mgo); return; }
  const mr = e.target.closest('[data-mrestore]');
  if (mr) { const date = S.mday; const v = mr.dataset.mrestore; run(async () => { await command('restore', v === 'all' ? { all: true } : { tripIds: v.split(',') }, null, date); await afterMonthChange(date); }, 'הנסיעות הוחזרו'); return; }
  const mal = e.target.closest('[data-mall]');
  if (mal) { S.plan.day = mal.dataset.mall; S.mday = null; paintMonthDay(); planView('all'); return; }
  const cix = e.target.closest('[data-ci]');
  if (cix && !cix.disabled) { S.plan.ci = Number(cix.dataset.ci); paintPlanner(); document.querySelector('.t-carousel .t-cause')?.focus?.(); return; }
  const tc = e.target.closest('[data-tip-close]');
  if (tc) { try { localStorage.setItem(`t-tip-${tc.dataset.tipClose}`, 'closed'); } catch {} tc.closest('.t-tip')?.remove(); return; }
  const wf = e.target.closest('[data-wf]');
  if (wf) { S.plan.wf = wf.dataset.wf; paintPlanner(); return; }
  const wo = e.target.closest('[data-wopen]');
  if (wo) { const o = S.plan.wopen ??= new Set(); o.has(wo.dataset.wopen) ? o.delete(wo.dataset.wopen) : o.add(wo.dataset.wopen); paintPlanner(); return; }
  const ff = e.target.closest('[data-ffilter]');
  if (ff) { S.fleetFilter = ff.dataset.ffilter; paintFleet(); return; }
  const ro = e.target.closest('[data-rec-open]');
  if (ro) { const [v, id] = ro.dataset.recOpen.split(':'); openRecord(v, id); return; }
  const cok = e.target.closest('[data-cause-ok]');
  if (cok) { const c = causeByKey(cok.dataset.causeOk); if (c) applyCause(c, c.applies, c.rec); return; }
  const cpk = e.target.closest('[data-cause-pick]');
  if (cpk) { const c = cpk.dataset.scope === 'board' ? S.focus?.cause : causeByKey(cpk.dataset.causePick); if (c) pickForCause(cpk, c, cpk.dataset.scope === 'board' ? TODAY : S.plan.day); return; }
  const ud = e.target.closest('[data-undo-done]');
  if (ud) { const list = (S.plan.done ?? []).filter(x => x.date === S.plan.day); const x = list[Number(ud.dataset.undoDone)]; if (x) run(x.undo, 'בוטל'); return; }
  const kn = e.target.closest('[data-prop-know]');
  if (kn) { if (kn.dataset.propKnow === 'expiring') location.hash = '#/drivers'; else { S.plan.view = 'all'; S.plan.showFile = true; paintPlanner(); } return; }
  const ck = e.target.closest('[data-chg-kind]');
  if (ck) { S.change.kind = ck.dataset.chgKind; S.change.id = ''; paintChange(); return; }
  const cr = e.target.closest('[data-chg-reason]');
  if (cr) { S.change.reason = cr.dataset.chgReason; document.querySelectorAll('[data-chg-reason]').forEach(b => b.setAttribute('aria-pressed', b === cr)); return; }
  const foc = e.target.closest('[data-focus]');
  if (foc) { focusFix(foc.dataset.focus); return; }
  if (e.target.closest('[data-pgo-today]')) { S.focus = null; S.plan.day = TODAY; S.plan.view = 'day'; location.hash = '#/plan'; return; }
  const del = e.target.closest('[data-away-del]');
  if (del) { S.rec.draft.away.splice(Number(del.dataset.awayDel), 1); paintRecord(); return; }
  const el = e.target.closest('[data-act],[data-ride],[data-plan-trip],[data-itab],[data-rides],[data-tfacet],[data-pview],[data-pgo],[data-psel],[data-paccept],[data-pres],[data-proute],[data-ride-open],[data-ack],[data-unack],[data-prop-apply],[data-prop-open],[data-prop-more],[data-ask],[data-tour],[data-tour-step]');
  if (!el) return;
  const ds = el.dataset;
  if (ds.ride) { openRide(ds.ride, TODAY, 'overview'); return; }
  if (ds.planTrip) { openRide(ds.planTrip, ds.date, ds.date === TODAY ? 'overview' : 'assign').then(paintPlannerSelection); return; }
  if (ds.itab) { if (S.insp.tab === 'assign' && ds.itab !== 'assign' && !(await leaveEdits())) return; S.dirty = false; S.insp.tab = ds.itab; S.composing = false; paintInspector(); return; }
  if (ds.rides) { S.rides = ds.rides; store.set('t-rides-view', S.rides); render(); return; }
  if (ds.tfacet) { S.table.facet = S.table.facet === ds.tfacet ? '' : ds.tfacet; document.querySelectorAll('[data-tfacet]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tfacet === S.table.facet)); paintTable(); return; }
  if (ds.pview) { planView(ds.pview); return; }
  if (ds.pgo !== undefined) { planGo(ds.pgo); return; }
  if (ds.paccept) { acceptSuggestion(ds.paccept); return; }
  if (ds.rideOpen) { openRide(ds.rideOpen, S.plan.day, 'overview'); return; }
  if (ds.ack) {
    const alertId = ds.ack;
    command('ack', { alertId }).then(() => toast('סומן כטופל', { undo: () => run(() => command('unack', { alertId }), 'הוחזר לטיפול') })).catch(err => toast(err.message, { bad: true }));
    return;
  }
  if (ds.unack) { run(() => command('unack', { alertId: ds.unack }), 'הוחזר לטיפול'); return; }
  if (ds.propApply) { applyProposal(ds.propApply); return; }
  if (ds.propOpen) { openProposal(ds.propOpen); return; }
  if (ds.propMore) { S.assist.open.add(ds.propMore); paintAssist(); return; }
  if (ds.ask) { S.assist.ask = ds.ask; runAssist(); return; }
  if (ds.tour) { tourGo(Number(ds.tour)); return; }
  if (ds.tourStep) { tourGo(Math.max(0, Math.min(BRIEF.length - 1, S.tour.step + Number(ds.tourStep)))); return; }
  const act = ds.act;
  const d = S.data;
  if (act === 'cmd') openCmd();
  if (act === 'change') { S.change = { kind: 'driver', id: '', from: S.plan.day, to: S.plan.day, reason: '' }; paintChange(); }
  if (act === 'change-close') { S.change = null; paintChange(); }
  if (act === 'focus-close') { S.focus = null; paintRides(); }
  if (act === 'rec-new') openRecord(view(), null);
  if (act === 'rec-close') { S.rec = null; paintRecord(); S.grids.fleet?.redrawRows(); }
  if (act === 'rec-avail') { S.rec.draft.available = S.rec.draft.available === false; el.setAttribute('aria-checked', S.rec.draft.available !== false); }
  if (act === 'away-add') { const from = $('#away-from').value, to = $('#away-to').value || from; if (!from) { toast('בחרו תאריך התחלה', { bad: true }); return; } S.rec.draft.away.push({ from, to: to < from ? from : to, reason: $('#away-reason').value.trim(), sub: $('#away-sub')?.value || '' }); paintRecord(); }
  if (act === 'rec-save') saveRecord();
  if (act === 'rec-archive') archiveRecord(false);
  if (act === 'rec-restore') archiveRecord(true);
  if (act === 'later') { S.rides = 'table'; S.table.facet = 'later'; store.set('t-rides-view', 'table'); render(); }
  if (act === 'cmd-close' && e.target === el) closeCmd();
  if (act === 'pop') { S.pop = !S.pop; S.confirmReset = false; rail(); }
  if (act === 'help') { S.help = true; paintHelp(); }
  if (act === 'help-close' && (e.target === el || el.matches('.t-icon-btn'))) { S.help = false; paintHelp(); }
  if (act === 'map') openMap();
  if (act === 'close-map') closeMap();
  if (act === 'close-ride') closeRide();
  if (act === 'assist') { S.assist ? (S.assist = null, paintAssist(), rail()) : openAssist(TOMORROW); }
  if (act === 'assist-today') openAssist(TODAY);
  if (act === 'assist-tomorrow') openAssist(TOMORROW);
  if (act === 'close-assist') { S.assist = null; paintAssist(); rail(); }
  if (act === 'publish-drafts') publishDrafts();
  if (act === 'auto-alloc') autoAllocate();
  if (act === 'toggle-ready') { S.plan.showReady = !S.plan.showReady; paintPlanner(); }
  if (act === 'toggle-file') { S.plan.showFile = !S.plan.showFile; paintPlanner(); }
  if (act === 'guide-hide') { store.set('t-plan-guide', '0'); $('.t-guide')?.remove(); }
  if (act === 'approve-all') { approveAll(); return; }
  if (act === 'map-fit') { S.map?.fitBuses?.(); return; }
  if (act === 'map-golan') { S.map?.overview?.(); return; }
  if (act === 'map-unsel') { S.mapSel = null; $('#map-card').hidden = true; paintMapSide(); mapUpdate(); return; }
  if (act === 'mday-close') { S.mday = null; S.mdo = null; paintMonthDay(); paintPlanner(); return; }
  if (act === 'change-day') { S.change = { kind: 'driver', id: '', from: S.mday, to: S.mday, reason: '' }; paintChange(); return; }
  if (act === 'tips-on') { try { ['plan', 'month', 'regular'].forEach(k => localStorage.removeItem(`t-tip-${k}`)); } catch {} S.help = false; paintHelp(); repaint(); toast('הטיפים יוצגו שוב'); return; }
  if (act === 'fleet-issues') { S.fleetFilter = S.fleetFilter === 'attn' ? 'all' : 'attn'; paintFleet(); }
  if (act === 'tour') { S.pop = false; tourGo(0); }
  if (act === 'tour-close') { S.tour = null; paintTour(); }
  if (act === 'play') { S.playing = !S.playing; tick(); rail(); }
  if (act === 'plus5') run(() => command('clock', { time: hhmm(minutes(d.clock) + 5) }));
  if (act === 'phone') { S.phone = !S.phone; el.setAttribute('aria-checked', S.phone); paintPhone(); }
  if (act === 'offline') {
    S.offline = !S.offline;
    el.setAttribute('aria-checked', S.offline);
    $('.t-phone')?.classList.toggle('is-offline', S.offline);
    $('#phone')?.contentWindow?.postMessage({ offline: S.offline }, location.origin);
    toast(S.offline ? 'הטלפון בלי קליטה' : 'הקליטה חזרה');
  }
  if (act === 'reset') {
    if (!S.confirmReset) { S.confirmReset = true; rail(); return; }
    S.insp = null; S.assist = null; S.tour = null; S.playing = false; S.confirmReset = false; S.pop = false; S.week = {};
    closeMap();
    run(async () => { await command('reset'); await loadDay(TODAY); $('#phone-slot').innerHTML = ''; await render(); }, 'חזרה ל־07:05');
  }
  if (act === 'compose') { S.composing = !S.composing; paintInspector(); if (S.composing) $('#note-text')?.focus(); }
  if (act === 'reload') { S.dirty = false; S.stale = false; await loadDay(S.insp.date); paintInspector(); }
  if (act === 'save-publish') run(() => saveRide(true), 'נשמר ופורסם לנהג');
  if (act === 'save-draft') run(() => saveRide(false), 'נשמר. הנהג יראה את השינוי אחרי פרסום.');
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.dataset.form === 'change') { saveChange(); return; }
  if (e.target.dataset.form === 'ask') { S.assist.ask = $('#ask-q').value.trim(); runAssist(); return; }
  if (e.target.dataset.form !== 'note') return;
  const trip = dataFor(S.insp.date).trips.find(t => t.id === S.insp.id);
  const text = $('#note-text').value.trim();
  if (!trip || !text) return;
  run(async () => { await command('note', { text }, trip, S.insp.date); S.composing = false; S.draft = ''; await loadDay(S.insp.date); paintInspector(); }, `ההודעה נשלחה ל${trip.driverName}`);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'note-text') S.draft = el.value;
  if (el.dataset.rec && S.rec) S.rec.draft[el.dataset.rec] = el.value;
  if (el.id === 'tq') { S.table.q = el.value; paintTable(); }
  if (el.id === 'pq') { S.plan.q = el.value; paintPlanner(); }
  if (el.id === 'map-q') { S.mapQ = el.value; paintMapList(); }
  if (el.id === 'cmd-q') { S.cmd.q = el.value; S.cmd.i = 0; drawCmd(); }
  if (el.closest('.t-insp') && el.matches('select,[data-stop-time],[data-stop-count]')) {
    S.dirty = true;
    const b = $('#save-publish'); if (b) { b.disabled = false; b.textContent = 'שמירה ופרסום לנהג'; }
    const dr = $('[data-act=save-draft]'); if (dr) dr.disabled = false;
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (['chg-who', 'chg-from', 'chg-to'].includes(el.id)) { changeImpact(); return; }
  if (el.dataset.opt) { S.opt[el.dataset.opt] = el.value; view() === 'plan' ? paintPlanner() : paintRides(); document.querySelector(`[data-opt="${CSS.escape(el.dataset.opt)}"][value="${CSS.escape(el.value)}"]`)?.focus(); return; }
  if (el.dataset.act === 'viewer') { S.viewer = el.value; store.set('t-viewer', S.viewer); refresh().then(rail); }
  if (el.dataset.act === 'driver') { S.driver = el.value; $('#phone-slot').innerHTML = ''; paintPhone(); }
  if (el.dataset.fleet) {
    const before = el.defaultValue; const kind = el.dataset.fleet; const id = el.dataset.id; const field = el.dataset.field;
    S.flash = id;
    command('fleet', { kind, entityId: id, [field]: el.value })
      .then(async () => { await loadDay(TODAY); const back = await giveBackOffer(kind, id); toast(`התאריך עודכן ל־${el.value.split('-').reverse().join('.')}${back ? ` · ${back.label}?` : ''}`, { undo: () => run(() => command('fleet', { kind, entityId: id, [field]: before }), 'התאריך הוחזר'), action: back ? { label: 'להחזיר', fn: back.fn } : null }); })
      .catch(err => toast(err.message, { bad: true }));
  }
});
document.addEventListener('keydown', e => {
  const typing = e.target.matches?.('input,textarea,select');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); S.cmd ? closeCmd() : openCmd(); return; }
  if (S.cmd) {
    if (e.key === 'Escape') { e.preventDefault(); closeCmd(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = S.cmd.res?.length || 1; S.cmd.i = (S.cmd.i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; drawCmd(); }
    if (e.key === 'Enter') { e.preventDefault(); pickCmd(S.cmd.i); }
    return;
  }
  if (e.target.matches?.('[role=tab][data-itab]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const tabs = [...document.querySelectorAll('[data-itab][role=tab]')];
    const i = tabs.indexOf(e.target);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
    S.insp.tab = tabs[next].dataset.itab; S.composing = false; paintInspector(); $(`#itab-${S.insp.tab}`)?.focus(); return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === '/') { e.preventDefault(); openCmd(); return; }
  if (e.key === '?') { S.help = !S.help; paintHelp(); return; }
  if ((e.key === 'p' || e.key === 'P' || e.key === 'פ') && view() === 'plan' && S.plan.view === 'day') { publishDrafts(); return; }
  if (e.key.toLowerCase() === 'm' || e.key === 'צ') { S.mapOpen ? closeMap() : openMap(); return; }
  if (e.key.toLowerCase() === 'a' || e.key === 'ש') { S.assist ? (S.assist = null, paintAssist(), rail()) : openAssist(TOMORROW); return; }
  if (e.key === 'Escape' && S.change) { S.change = null; paintChange(); return; }
  if (e.key === 'Escape' && S.picker) { const a = S.picker.anchor; closePicker(); a?.focus?.(); return; }
  if (e.key === 'Enter' && e.target.matches?.('[data-tpick]')) { e.target.click(); return; }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && view() === 'plan' && S.plan.view === 'fix' && !e.target.closest('input,textarea,select,[role=radio],.t-picker')) {
    const n = causes(S.plan.day).length; const next = (S.plan.ci ?? 0) + (e.key === 'ArrowLeft' ? 1 : -1);
    if (next >= 0 && next < n) { S.plan.ci = next; paintPlanner(); e.preventDefault(); } return;
  }
  if (e.key === 'Escape') {
    clearSpot();
    if (S.help) { S.help = false; paintHelp(); return; }
    if (S.pop) { S.pop = false; rail(); return; }
    if (S.rec) { S.rec = null; paintRecord(); S.grids.fleet?.redrawRows(); return; }
    if (S.mapOpen) { closeMap(); return; }
    if (S.insp) { closeRide(); return; }
    if (S.mday) { S.mday = null; S.mdo = null; paintMonthDay(); paintPlanner(); return; }
    if (S.assist) { S.assist = null; paintAssist(); rail(); return; }
    if (S.tour) { S.tour = null; paintTour(); }
  }
});
window.addEventListener('hashchange', async () => { S.rec = null; S.mday = null; if (!['drivers', 'vehicles'].includes(view())) S.flash = null; if (S.mapOpen && !S.tour) closeMap(); if (S.insp) { S.dirty = false; S.insp = null; } await render(); });

function tick() {
  clearInterval(tick.t);
  if (!S.playing) return;
  tick.t = setInterval(() => {
    const m = minutes(S.data.clock);
    if (m >= 9 * 60) { S.playing = false; clearInterval(tick.t); rail(); return; }
    command('clock', { time: hhmm(m + 1) }).catch(() => {});
  }, 2000);
}
function listen() {
  const es = new EventSource(`/api/transport/events?date=${TODAY}&viewer=${S.viewer}`);
  es.onmessage = () => refresh();
  es.onerror = () => { es.close(); setTimeout(listen, 3000); };
}

applyTheme(store.get('t-theme-v2', 'clean'));
if (!location.hash || location.hash === '#/live' || location.hash === '#/schedule') history.replaceState(null, '', location.hash === '#/schedule' ? '#/plan' : '#/rides');
if (location.hash === '#/fleet') history.replaceState(null, '', '#/drivers');
await loadDay(TODAY);
await render();
listen();
