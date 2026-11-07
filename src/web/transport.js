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
  viewer: store.get('t-viewer', 'shuki'), theme: 'royal', data: null, week: {}, playing: false,
  rides: store.get('t-rides-view', 'board'), mapOpen: false, map: null, inspMap: null,
  insp: null, // { id, date, tab }
  dirty: false, stale: false, composing: false, draft: '',
  plan: { day: TOMORROW, by: 'driver', q: '', onlyIssues: false, drag: null, ci: -1 }, table: { q: '', facet: '' },
  assist: null, // { date, ask, busy, result, applied: Set }
  tour: null, // { step }
  phone: false, offline: false, driver: 'driver-10', pop: false, confirmReset: false, cmd: null, help: false, flash: null,
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
const FLEET_CAUSE = /רישיון|טסט|טיפול|זמין|חסר שיבוץ/;

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
};
const STATUS = {
  upcoming: ['טרם יצאה', ''], blocked: ['חסומה', 'is-blocked'], late: ['לא יצאה', 'is-bad'],
  active: ['בדרך', 'is-active'], delayed: ['מאחרת', 'is-bad'], completed: ['הגיעה', 'is-done'],
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
function toast(text, { bad = false, undo = null, retry = null } = {}) {
  const el = document.createElement('div');
  el.className = `t-toast${bad ? ' is-bad' : ''}`;
  el.setAttribute('role', bad ? 'alert' : 'status');
  el.innerHTML = `<span>${esc(text)}</span>${undo ? '<button type="button" data-t="undo">ביטול</button>' : ''}${retry ? '<button type="button" data-t="retry">לנסות שוב</button>' : ''}${bad ? `<button type="button" data-t="close" aria-label="סגירה">${I.x}</button>` : ''}`;
  el.querySelector('[data-t=undo]')?.addEventListener('click', () => { el.remove(); undo(); });
  el.querySelector('[data-t=retry]')?.addEventListener('click', () => { el.remove(); retry(); });
  el.querySelector('[data-t=close]')?.addEventListener('click', () => el.remove());
  $('#toast').replaceChildren(el);
  if (!bad) setTimeout(() => el.remove(), undo ? 7000 : 3200);
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
  { id: 'royal', name: 'פחם וכחול מלכותי', note: 'כחול מוביל, כתום רק להדגשה', sw: ['#1d2024', '#3557d8', '#f28500'] },
  { id: 'paper', name: 'נייר, דיו וכחול דגנית', note: 'בהיר ושקט, שחור לפעולות', sw: ['#f7f5ef', '#17171a', '#6c93ea'] },
  { id: 'flame', name: 'שחור, לבן רך וכתום להבה', note: 'אוטובוסים בשחור, כתום למותג', sw: ['#0f0f10', '#f6f4ef', '#e8590c'] },
  { id: 'navy', name: 'כחול רך, כחול לילה ואלמוג', note: 'רקע כחלחל, אלמוג להדגשה', sw: ['#eef3fa', '#13213c', '#ff6f59'] },
];
function applyTheme(id) {
  if (!THEMES.some(t => t.id === id)) id = 'royal';
  S.theme = id;
  document.documentElement.dataset.theme = id;
  store.set('t-theme', id);
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
      ${item('plan', I.calendar, 'בניית סידור')}
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
  const road = d.alerts.filter(a => a.queue === 'road' && !a.handled).length;
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
    <span class="t-ride-foot">${figure}${t.live.mode === 'manual' && t.live.boarded != null ? '<span class="t-src">דיווח נהג</span>' : ''}</span>
  </button>`;
}
function alertCard(a, lead = true) {
  const fix = a.kind === 'blocked' && a.fix;
  const p = lead ? 'is-primary' : '';
  return `<div class="t-alert is-${a.level}">
    <button class="t-alert-open" data-ride="${esc(a.tripId)}"><b>${esc(a.title)}</b><span class="t-detail">${esc(a.detail)}</span></button>
    <div class="t-actions">
      ${fix ? `<button class="t-btn ${p} is-sm" data-act="assist-today">${I.assist} הצעה להחלפה עכשיו</button>` : ''}
      ${a.call ? `<a class="t-btn ${p} is-sm" href="tel:${esc(a.call.phone)}" data-call="${esc(a.call.name)}|${esc(a.call.phone)}">${I.call} להתקשר ל${esc(firstName(a.call.name))}</a>` : ''}
      <button class="t-btn is-sm" data-ack="${esc(a.id)}">${I.check} טופל</button>
    </div>
  </div>`;
}
function boardColumns() {
  const d = S.data;
  const now = minutes(d.clock);
  const road = d.alerts.filter(a => a.queue === 'road');
  return {
    open: road.filter(a => !a.handled), handled: road.filter(a => a.handled),
    soon: d.trips.filter(t => ['upcoming', 'blocked'].includes(t.status) && minutes(t.departure) - now <= 60).sort((a, b) => a.departure.localeCompare(b.departure)),
    later: d.trips.filter(t => ['upcoming', 'blocked'].includes(t.status) && minutes(t.departure) - now > 60),
    moving: d.trips.filter(t => t.status === 'active' || t.status === 'delayed').sort((a, b) => b.live.lateMinutes - a.live.lateMinutes || a.departure.localeCompare(b.departure)),
    done: d.trips.filter(t => t.status === 'completed').sort((a, b) => b.departure.localeCompare(a.departure)),
    prep: d.alerts.filter(a => a.queue === 'prep' && !a.handled && a.level !== 'low'),
  };
}
function boardHtml() {
  const c = boardColumns();
  const col = (key, title, count, body, tone = '') => `<section class="t-col ${tone}" aria-labelledby="col-${key}"><header><h2 id="col-${key}">${title}</h2><span class="num">${num(count)}</span></header><div class="t-col-body">${body}</div></section>`;
  const attention = (c.open.length ? c.open.map((a, i) => alertCard(a, i === 0)).join('') : `<div class="t-calm">${I.check}<b>הכל בסדר</b><span>אין כרגע משהו שדורש טיפול.</span></div>`)
    + (c.handled.length ? `<details class="t-handled"><summary>טופלו (${num(c.handled.length)})</summary>${c.handled.map(a => `<div class="t-handled-row"><span><s>${esc(a.title)}</s><br>${esc(a.handled.by)}</span><button class="t-btn is-sm is-ghost" data-unack="${esc(a.id)}">החזרה</button></div>`).join('')}</details>` : '')
    + (c.prep.length ? `<button class="t-prep-link" data-act="assist-today">${I.assist}<span><b>${num(c.prep.length)} דברים לסדר לפני היציאה</b><small>העוזר מציע תיקון לכל אחד</small></span>${I.chev}</button>` : '');
  const list = (ts, empty) => ts.map(rideCard).join('') || `<p class="t-empty">${empty}</p>`;
  return `<div class="t-board" id="board">
    ${col('now', 'דורש טיפול', c.open.length, attention, c.open.length ? 'is-attn' : '')}
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
      <div><h1>${hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'}, ${esc(me.name)}</h1><p id="rides-meta"></p><p class="t-source">מיקומים וספירות לפי לוח הזמנים, חוץ ממה שמסומן "דיווח נהג".</p></div>
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
  if (el) el.textContent = [`יום ${d.weekday} ${heDate(d.date)}`, `${num(d.trips.length)} נסיעות היום`, `${num(c.moving.length)} בדרך`, c.open.length ? `${num(c.open.length)} דורשים טיפול` : 'אין מה לטפל'].join(' · ');
}
function paintRides() {
  ridesMeta();
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
  const stops = t.points.map((p, i) => {
    const c = today ? t.live.stopCounts[p.id] : null;
    const cls = today && i <= d ? 'is-done' : today && i === d + 1 && t.live.phase !== 'pending' ? 'is-next' : '';
    const label = p.kind === 'school' ? 'בי״ס' : String(t.points.slice(0, i + 1).filter(x => x.kind === 'stop').length);
    const count = p.kind === 'school'
      ? (today && t.direction === 'morning' && i <= d ? `<b class="num">${num(t.live.boarded)}</b> ירדו` : '')
      : c ? `<span dir="ltr"><b class="num ${c.expected != null && c.count !== c.expected ? 'is-off' : ''}">${num(c.count)}</b>/${num(p.planned)}</span><div class="t-source">${c.source === 'driver' ? 'דיווח נהג' : 'משוער'}</div>`
      : `<span class="num">${num(p.planned)}</span> צפויים`;
    return `<li class="${cls}"><span class="t-dot ${p.kind === 'school' ? 'is-school' : ''}">${label}</span><span><b>${esc(p.name)}</b><small>${esc(p.time ?? '')}${p.located ? '' : ' · מיקום לא ידוע'}</small></span><span class="t-count-cell">${count}</span></li>`;
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
  S.mapOpen = true;
  $('#mapfull').innerHTML = `<div class="t-mapfull" role="dialog" aria-modal="true" aria-label="מפה חיה">
    <header><h2>${I.map} מפה חיה</h2>
      <span class="t-legend"><i style="background:var(--accent)"></i>בדרך</span>
      <span class="t-legend"><i style="background:var(--bad)"></i>מאחר</span>
      <span class="t-legend"><i class="is-dashed"></i>עוד לא יצא</span>
      <span class="t-legend"><i style="background:#fff;border:1px solid var(--line-2)"></i>הגיע</span>
      <span class="t-legend"><i class="is-cluster">3</i>כמה אוטובוסים, לחיצה מקרבת</span>
      <span class="t-spacer"></span>
      <span class="t-source">מיקום לפי לוח הזמנים, ולפי הטלפון בקו 10</span>
      <button class="t-icon-btn" data-act="close-map" aria-label="סגירת המפה">${I.x}</button></header>
    <div class="t-mapfull-canvas" id="map"></div></div>`;
  const config = S.config ?? (S.config = await fetch('/api/workspace/config').then(r => r.json()).catch(() => ({})));
  S.map = await mountTransportMap($('#map'), { config, onSelect: id => openRide(id, TODAY, 'overview') }).catch(e => (toast(e.message, { bad: true }), null));
  S.map?.update?.(S.data, S.insp?.id ?? null);
  S.map?.fitBuses?.();
  $('[data-act=close-map]')?.focus();
}
function closeMap() { S.mapOpen = false; S.map?.destroy?.(); S.map = null; $('#mapfull').innerHTML = ''; }

// ------------------------------------------------------------ plan builder: one day, drivers × time, drag to reassign
// Quiet by default: every trip is a grey block with its route number. Colour only marks a conflict
// (two trips at once, an expired licence or test, too few seats). Drops are drafts until published.
const PX_MIN = 1.7; // pixels per minute
// A trip occupies its driver from departure to its last stop, as the council's workbook lists them
// (no estimated school arrival), so only overlaps the workbook itself contains count as conflicts.
const span = t => { const ms = t.stops.map(x => (/^\d\d:\d\d$/.test(x.time || '') ? minutes(x.time) : -1)).filter(m => m >= 0); const s = Math.min(minutes(t.departure), ...ms); return [s, Math.max(s + 5, ...ms)]; };
const blockMin = (t, r) => (t.routeCode === r.home ? 50 : 72);
const editableTrip = (t, date) => t.phase === 'pending' && (date !== TODAY || t.live.phase === 'pending');
function planModel(date) {
  const d = dataFor(date);
  const by = S.plan.by;
  const key = by === 'driver' ? 'driverId' : 'vehicleId';
  const people = by === 'driver' ? d.drivers : d.vehicles;
  const valid = r => (by === 'driver' ? r.available !== false && r.licenseUntil >= date : r.available !== false && r.testUntil >= date);
  const rows = people.map(r => ({ id: r.id, home: by === 'driver' ? r.routeCode : r.id.replace(/^bus-/, ''), label: by === 'driver' ? r.name : r.label, sub: by === 'driver' ? (r.routeCode ? `קו ${r.routeCode}` : 'חלופי') : (r.capacity ? `${r.capacity} מקומות` : ''), valid: valid(r), why: by === 'driver' ? 'הרישיון פג' : 'הטסט פג', trips: [] }));
  const byId = new Map(rows.map(r => [r.id, r]));
  for (const t of d.trips) byId.get(t[key])?.trips.push(t);
  const conflicts = new Map(); // tripId -> reason: stops the trip, or a clash someone made (red)
  const notes = new Map(); // tripId -> reason: an overlap already in the council's workbook (amber, to check)
  for (const r of rows) {
    const ts = r.trips.sort((a, b) => span(a)[0] - span(b)[0]);
    ts.forEach((t, i) => {
      const [s, e] = span(t);
      const clash = ts.find((o, j) => j !== i && span(o)[0] < e && s < span(o)[1]);
      const own = x => x.routeCode === r.home;
      if (clash && own(t) && own(clash)) notes.set(t.id, `בקובץ המועצה יש שתי נסיעות של קו ${t.routeCode} באותה שעה (${clash.departure})`);
      if (clash && !(own(t) && own(clash))) conflicts.set(t.id, `באותה שעה כמו קו ${clash.routeCode} (${clash.departure})`);
      else if (!r.valid) conflicts.set(t.id, by === 'driver' ? 'הרישיון של הנהג פג' : 'הטסט של הרכב פג');
      else { const b = t.blockers.find(x => (by === 'driver' ? !/טסט|רכב/.test(x) : !/רישיון|נהג/.test(x))) ?? t.blockers[0]; if (b) conflicts.set(t.id, b); }
    });
    r.lanes = [];
    for (const t of ts) { const [s, e] = span(t); const end = s + Math.max(e - s, blockMin(t, r) / PX_MIN) + 2; const lane = r.lanes.findIndex(l => l <= s); if (lane < 0) r.lanes.push(end); else r.lanes[lane] = end; t._lane = lane < 0 ? r.lanes.length - 1 : lane; }
  }
  const q = S.plan.q.trim();
  let shown = rows.filter(r => r.trips.length || !r.valid || /חלופי/.test(r.sub) || r.id === 'bus-spare');
  if (q) shown = shown.filter(r => [r.label, r.sub, ...r.trips.map(t => `קו ${t.routeCode} ${t.school}`)].join(' ').includes(q));
  if (S.plan.onlyIssues) shown = shown.filter(r => r.trips.some(t => conflicts.has(t.id)));
  shown.sort((a, b) => Number(b.trips.some(t => conflicts.has(t.id))) - Number(a.trips.some(t => conflicts.has(t.id))) || Number(!a.trips.length) - Number(!b.trips.length) || (span(a.trips[0] ?? { stops: [], departure: '23:00' })[0] - span(b.trips[0] ?? { stops: [], departure: '23:00' })[0]));
  const all = d.trips.map(span);
  const from = Math.floor(Math.min(...all.map(x => x[0]), 6 * 60) / 60) * 60 - 30;
  const to = Math.ceil(Math.max(...all.map(x => x[1]), 16 * 60) / 60) * 60;
  return { d, rows: shown, conflicts, notes, from, to, key };
}
function plannerPage() {
  return `<div class="t-page t-page-full">
    <header class="t-page-head">
      <div><h1>בניית סידור</h1><p id="plan-meta"></p></div>
      <div class="t-spacer"></div>
      <div class="t-seg" role="group" aria-label="יום">${DAYS.map(d => `<button data-pday="${d.date}" aria-pressed="${S.plan.day === d.date}">${d.date === TOMORROW ? 'מחר' : d.date === TODAY ? 'היום' : d.label}<i class="t-dot-bad" data-pday-dot="${d.date}" hidden></i></button>`).join('')}</div>
    </header>
    <div class="t-toolbar">
      <div class="t-seg" role="group" aria-label="שורות לפי"><button data-pby="driver" aria-pressed="${S.plan.by === 'driver'}">נהגים</button><button data-pby="vehicle" aria-pressed="${S.plan.by === 'vehicle'}">רכבים</button></div>
      <label class="t-search-field">${I.search}<span class="sr-only">חיפוש</span><input id="pq" type="search" placeholder="נהג, קו או בית ספר" value="${esc(S.plan.q)}"></label>
      <span class="t-spacer"></span>
      <span id="plan-conflicts"></span>
    </div>
    <div class="t-tl" id="timeline" aria-label="סידור לפי ${S.plan.by === 'driver' ? 'נהג' : 'רכב'} ושעה"><p class="t-empty">טוען…</p></div>
    <div id="plan-bar"></div>
  </div>`;
}
async function loadPlanDay() { if (!dataFor(S.plan.day)) await loadDay(S.plan.day); }
async function loadWeek() { await Promise.all(DAYS.map(d => (dataFor(d.date) ? null : loadDay(d.date)))); }
function paintPlanner() {
  const el = $('#timeline');
  if (!el || !dataFor(S.plan.day)) return;
  const { d, rows, conflicts, notes, from, to } = planModel(S.plan.day);
  const px = m => (m - from) * PX_MIN;
  const width = px(to);
  const hours = []; for (let m = Math.ceil(from / 60) * 60; m <= to; m += 60) hours.push(m);
  const now = S.plan.day === TODAY ? minutes(S.data.clock) : null;
  const scroll = { x: el.scrollLeft, y: el.scrollTop };
  el.innerHTML = `<div class="t-tl-inner" style="--tl-w:${width}px">
    <div class="t-tl-head"><div class="t-tl-label"></div><div class="t-tl-axis">${hours.map(m => `<span style="inset-inline-start:${px(m)}px">${hhmm(m)}</span>`).join('')}${now != null ? `<i class="t-tl-now" style="inset-inline-start:${px(now)}px" title="עכשיו ${S.data.clock}"></i>` : ''}</div></div>
    ${rows.map(r => `<div class="t-tl-row ${r.valid ? '' : 'is-invalid'}" data-prow="${r.id}" style="--lanes:${Math.max(1, r.lanes.length)}">
      <div class="t-tl-label"><b>${esc(r.label)}</b><small>${r.valid ? esc(r.sub) : `<span class="t-warn-text">${r.why}</span>`}</small></div>
      <div class="t-tl-track">${hours.map(m => `<i class="t-tl-grid" style="inset-inline-start:${px(m)}px"></i>`).join('')}
        ${r.trips.map(t => { const [s, e] = span(t); const c = conflicts.get(t.id) ?? notes.get(t.id); const can = editableTrip(t, S.plan.day); return `<button class="t-blk ${conflicts.has(t.id) ? 'is-conflict' : notes.has(t.id) ? 'is-note' : ''} ${!t.published ? 'is-draft' : ''} ${can ? '' : 'is-done'} ${S.insp?.id === t.id ? 'is-open' : ''}" data-plan-trip="${t.id}" data-date="${S.plan.day}" ${can ? 'draggable="true"' : ''} style="inset-inline-start:${px(s)}px;width:${Math.max(blockMin(t, r), (e - s) * PX_MIN)}px;--lane:${t._lane}" title="${esc(`קו ${t.routeCode} · ${t.departure} · ${t.school}${c ? `\n${c}` : ''}`)}" aria-label="${esc(`קו ${t.routeCode}, ${t.departure}, ${t.school}${c ? `, ${c}` : ''}`)}">${t.routeCode === r.home ? esc(t.departure) : `<b>${esc(t.routeCode)}</b> ${esc(t.departure)}`}</button>`; }).join('')}
      </div></div>`).join('') || '<p class="t-empty">אין שורות שמתאימות.</p>'}
  </div>`;
  el.scrollLeft = scroll.x; el.scrollTop = scroll.y;
  const n = conflicts.size;
  const drafts = d.trips.filter(t => !t.published && editableTrip(t, S.plan.day)).length;
  $('#plan-meta').textContent = [`${dayWord(S.plan.day)}, ${dayOf(S.plan.day).label} ${heDate(S.plan.day)}`, `${num(d.trips.length)} נסיעות`, n ? `${num(n)} לתיקון` : 'הכל יכול לצאת', notes.size ? `${num(notes.size)} לבדוק מול הקובץ` : null].filter(Boolean).join(' · ');
  $('#plan-conflicts').innerHTML = n
    ? `<button class="t-btn is-sm" data-act="next-conflict">${num(n)} לתיקון · לבא</button><button class="t-btn is-sm is-ghost" data-act="assist-plan">${I.assist} הצעה לתיקון</button><button class="t-chip" data-act="only-issues" aria-pressed="${S.plan.onlyIssues}">רק מה שצריך תיקון</button>`
    : '<span class="t-ok-text">כל הנסיעות ביום הזה יכולות לצאת</span>';
  $('#plan-bar').innerHTML = drafts ? `<div class="t-plan-bar" role="status"><span><b>${num(drafts)}</b> ${drafts === 1 ? 'שינוי שהנהג עוד לא רואה' : 'שינויים שהנהגים עוד לא רואים'}</span><button class="t-btn is-primary" data-act="publish-drafts">פרסום לנהגים</button></div>` : '';
  for (const day of DAYS) { const dot = document.querySelector(`[data-pday-dot="${day.date}"]`); const dd = dataFor(day.date); if (dot && dd) dot.hidden = !planModelConflicts(day.date); }
}
function planModelConflicts(date) { const keep = S.plan.onlyIssues; S.plan.onlyIssues = false; const n = planModel(date).conflicts.size; S.plan.onlyIssues = keep; return n; }
function paintPlannerSelection() { document.querySelectorAll('.t-blk').forEach(x => x.classList.toggle('is-open', x.dataset.planTrip === S.insp?.id)); }
async function moveTrip(tripId, rowId) {
  const date = S.plan.day;
  const d = dataFor(date);
  const t = d.trips.find(x => x.id === tripId);
  const key = S.plan.by === 'driver' ? 'driverId' : 'vehicleId';
  if (!t || t[key] === rowId) return;
  const before = { tripId, driverId: t.driverId, vehicleId: t.vehicleId };
  const name = S.plan.by === 'driver' ? d.drivers.find(x => x.id === rowId)?.name : d.vehicles.find(x => x.id === rowId)?.label;
  try {
    await command('plan', { assignments: [{ tripId, [key]: rowId }], publish: false, reason: `הועבר ל${name}` }, null, date);
    await loadDay(date); paintPlanner(); if (S.insp?.id === tripId) paintInspector();
    toast(`קו ${t.routeCode} (${t.departure}) עבר ל${name}`, { undo: () => run(async () => { await command('plan', { assignments: [before], publish: t.published, reason: 'בוטל' }, null, date); await loadDay(date); paintPlanner(); }, 'השינוי בוטל') });
  } catch (e) { toast(e.message, { bad: true }); }
}
async function publishDrafts() {
  const date = S.plan.day;
  const ids = dataFor(date).trips.filter(t => !t.published && editableTrip(t, date)).map(t => ({ tripId: t.id }));
  if (!ids.length) return;
  await run(async () => { await command('plan', { assignments: ids, publish: true, reason: 'פורסם לנהג' }, null, date); await loadDay(date); paintPlanner(); }, 'פורסם. מה שאין בו התנגשות כבר אצל הנהגים.');
}
function nextConflict() {
  const blocks = [...document.querySelectorAll('.t-blk.is-conflict')];
  if (!blocks.length) return;
  S.plan.ci = ((S.plan.ci ?? -1) + 1) % blocks.length;
  const b = blocks[S.plan.ci];
  b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  b.focus({ preventScroll: true });
  spot(`[data-plan-trip="${b.dataset.planTrip}"]`, b.title.split('\n')[1] ?? b.title);
}
// drag and drop (pointer-free HTML5 drag; click or Enter opens the same trip for keyboard users)
document.addEventListener('dragstart', e => {
  const b = e.target.closest?.('.t-blk[draggable="true"]'); if (!b) return;
  e.dataTransfer.setData('text/plain', b.dataset.planTrip); e.dataTransfer.effectAllowed = 'move';
  S.plan.drag = b.dataset.planTrip; b.classList.add('is-dragging'); document.body.classList.add('is-planning-drag'); clearSpot();
});
document.addEventListener('dragend', () => { S.plan.drag = null; document.querySelectorAll('.is-dragging,.is-drop-ok,.is-drop-bad').forEach(x => x.classList.remove('is-dragging', 'is-drop-ok', 'is-drop-bad')); document.body.classList.remove('is-planning-drag'); });
document.addEventListener('dragover', e => {
  const row = e.target.closest?.('[data-prow]'); if (!row || !S.plan.drag) return;
  e.preventDefault();
  const t = dataFor(S.plan.day).trips.find(x => x.id === S.plan.drag);
  const { rows } = planModel(S.plan.day);
  const r = rows.find(x => x.id === row.dataset.prow);
  const [s, en] = span(t);
  const clash = !r?.valid || r.trips.some(o => o.id !== t.id && span(o)[0] < en && s < span(o)[1]);
  document.querySelectorAll('.is-drop-ok,.is-drop-bad').forEach(x => x !== row && x.classList.remove('is-drop-ok', 'is-drop-bad'));
  row.classList.toggle('is-drop-ok', !clash); row.classList.toggle('is-drop-bad', clash);
  e.dataTransfer.dropEffect = 'move';
});
document.addEventListener('drop', e => {
  const row = e.target.closest?.('[data-prow]'); if (!row || !S.plan.drag) return;
  e.preventDefault(); const id = S.plan.drag; S.plan.drag = null; moveTrip(id, row.dataset.prow);
});

// ------------------------------------------------------------ the planning assistant
async function openAssist(date = TOMORROW, askText = '') {
  S.assist = { date, ask: askText, busy: true, result: null, applied: new Set(), open: new Set() };
  paintAssist(); rail();
  await runAssist();
}
async function runAssist() {
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
  const card = p => {
    const done = a.applied.has(p.id);
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
      ${a.busy ? '<p class="t-empty">בודק את הסידור…</p>' : r ? `<p class="t-answer">${esc(r.summary)}</p>${r.proposals.filter(p => p.tone === 'fix').map(card).join('')}${r.proposals.some(p => p.tone === 'info') ? `<h3 class="t-insp-h">כדאי לדעת</h3>${r.proposals.filter(p => p.tone === 'info').map(card).join('')}` : ''}` : ''}
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
    toast(`בוצע: ${p.title}`, { undo: () => run(async () => { await command('plan', { assignments: undo, publish: true, reason: 'בוטל לבקשת הסדרן' }, null, a.date); a.applied.delete(id); await loadDay(a.date); await runAssist(); repaint(); }, 'השינוי בוטל') });
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
const due = (iso, soon = 14) => !iso ? '<span class="t-pill">לא ידוע</span>' : daysLeft(iso) < 0 ? '<span class="t-pill is-bad">פג</span>' : daysLeft(iso) <= soon ? `<span class="t-pill is-warn">בעוד ${daysLeft(iso)} ימים</span>` : '';
const dateCell = (kind, field, label, soon = 14) => ({
  cellRenderer: p => `<span class="t-datecell"><input type="date" class="t-date num" data-fleet="${kind}" data-id="${p.data.id}" data-field="${field}" value="${esc(p.data[field])}" aria-label="${esc(label(p.data))}">${due(p.data[field], soon)}</span>`,
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
      <div class="t-spacer"></div><button class="t-chip" data-act="fleet-issues" aria-pressed="${Boolean(S.fleetIssues)}">רק מה שפג או עומד לפוג</button></header>
    <div class="t-grid t-grid-main" id="g-fleet"></div>
    <p class="t-grid-foot">לחיצה על תאריך כדי לעדכן אותו.</p>
  </div>`;
}
function fleetRows(v) {
  const d = S.data;
  const trips = (field, id) => d.trips.filter(t => t[field] === id).length;
  const soon = (iso, n) => !iso || daysLeft(iso) <= n;
  return isPeople(v)
    ? [...d.drivers].filter(x => !S.fleetIssues || soon(x.licenseUntil, 30)).sort((a, b) => (a.licenseUntil < b.licenseUntil ? -1 : 1)).map(x => ({ ...x, today: trips('driverId', x.id) }))
    : [...d.vehicles].filter(x => !S.fleetIssues || soon(x.testUntil, 30) || soon(x.serviceDue, 7)).sort((a, b) => ((a.testUntil || '9') < (b.testUntil || '9') ? -1 : 1)).map(x => ({ ...x, today: trips('vehicleId', x.id) }));
}
function mountFleet(v) {
  const flash = { 't-flash': p => p.data?.id === S.flash };
  const columnDefs = isPeople(v) ? [
    { headerName: 'נהג', field: 'name', flex: 1.4, minWidth: 180, cellRenderer: p => two(esc(p.value), p.data.routeCode ? `קו ${esc(p.data.routeCode)}` : 'נהג חלופי') },
    { headerName: 'טלפון', field: 'contact', width: 140, cellRenderer: p => `<span dir="ltr" class="num">${esc(p.value)}</span>` },
    { headerName: 'רישיון', field: 'licenseType', width: 90 },
    { headerName: 'רישיון בתוקף עד', field: 'licenseUntil', ...dateCell('driver', 'licenseUntil', x => `תוקף רישיון של ${x.name}`, 30) },
    { headerName: 'רכב קבוע', colId: 'bus', width: 130, valueGetter: p => S.data.vehicles.find(v => v.id === `bus-${p.data.routeCode}`)?.label ?? '—' },
    { headerName: 'כשיר לנהיגה', colId: 'fit', width: 130, valueGetter: p => (p.data.available !== false && daysLeft(p.data.licenseUntil) >= 0 ? 'כן' : 'לא'), cellRenderer: p => (p.value === 'כן' ? '<span class="t-quiet">כן</span>' : '<span class="t-pill is-bad">לא</span>') },
    { headerName: 'נסיעות היום', field: 'today', width: 120, cellClass: endCell },
  ] : [
    { headerName: 'רכב', field: 'label', flex: 1.2, minWidth: 160, cellRenderer: p => two(esc(p.value), `<span dir="ltr">${esc(p.data.registration)}</span>`) },
    { headerName: 'מקומות', field: 'capacity', width: 100, cellClass: endCell, cellRenderer: p => (p.value ? num(p.value) : '<span class="t-quiet">לא בקובץ</span>') },
    { headerName: 'טסט בתוקף עד', field: 'testUntil', ...dateCell('vehicle', 'testUntil', x => `תוקף טסט ל${x.label}`, 30) },
    { headerName: 'טיפול הבא', field: 'serviceDue', ...dateCell('vehicle', 'serviceDue', x => `מועד טיפול ל${x.label}`, 7) },
    { headerName: 'זמין לשיבוץ', colId: 'fit', width: 130, valueGetter: p => (p.data.available !== false && daysLeft(p.data.testUntil) >= 0 && daysLeft(p.data.serviceDue) >= 0 ? 'כן' : 'לא'), cellRenderer: p => (p.value === 'כן' ? '<span class="t-quiet">כן</span>' : '<span class="t-pill is-bad">לא</span>') },
    { headerName: 'נסיעות היום', field: 'today', width: 120, cellClass: endCell },
  ];
  const g = grid($('#g-fleet'), 'fleet', { rowData: fleetRows(v), rowClassRules: flash, columnDefs });
  if (S.flash) { const n = g?.getRowNode(S.flash); if (n) setTimeout(() => g.ensureNodeVisible(n, 'middle'), 50); }
}
function paintFleet() { S.grids.fleet?.setGridOption('rowData', fleetRows(view())); }

// ------------------------------------------------------------ the brief, point by point (presenter tour)
const BRIEF = [
  { title: 'מטרת המוצר', text: 'מקום אחד לתכנן, לעקוב בזמן אמת ולראות את כל המערך: נסיעות, נהגים, אוטובוסים ותלמידים.', go: () => { S.rides = 'board'; location.hash = '#/rides'; }, spot: '#board', say: 'כל המערך סביב הנסיעות: מה דורש טיפול, מה יוצא, מה בדרך ומה הגיע.' },
  { title: 'ממשק הסדרנים', text: 'סידור יומי, שיוך נהג ורכב, תחנות ותלמידים, מצב כל נסיעה, מתוכנן מול בפועל, והתראות.', go: async () => { location.hash = '#/rides'; await wait(400); const t = S.data.trips.find(x => x.status === 'active'); if (t) await openRide(t.id, TODAY, 'overview'); }, spot: '.t-insp', say: 'כל נסיעה נפתחת בצד: תחנות עם מתוכנן מול בפועל, הנהג, הרכב, והתראות עם פעולה.' },
  { title: 'ממשק הנהג', text: 'סידור העבודה, תחנה אחת בכל מסך, ספירה, אישור יציאה בהחלקה, ופיזור.', go: async () => { if (!S.phone) { S.phone = true; paintPhone(); } }, spot: '.t-phone', say: 'הנהג רואה רק את הנסיעות שלו. מחליקים רק כשהרכב עומד.' },
  { title: 'נהגים וצי רכב', text: 'פרטי קשר, סוג רישיון ותוקפו, טסט, טיפולים וזמינות, עם התראה לפני שפג.', go: () => { S.fleetIssues = true; location.hash = '#/drivers'; }, spot: '#g-fleet', say: 'מה שפג או עומד לפוג, ולחיצה על תאריך מעדכנת.' },
  { title: 'תהליך העבודה', text: 'שלב 1: בונים את הסידור למחר. משם הנהג רואה, מדווח, והדשבורד מתעדכן.', go: () => { location.hash = '#/plan'; }, spot: '#timeline', say: 'מחר במבט אחד: כל נהג והנסיעות שלו. גוררים נסיעה לנהג אחר, והתנגשויות נצבעות.' },
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
        <li><b>בניית סידור</b>: כל נהג והנסיעות שלו לאורך היום. גוררים נסיעה לנהג אחר. אדום: התנגשות. מקווקו: עוד לא פורסם.</li>
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
      </ul></section>
    </div></div></div>`;
  slot.querySelector('[data-act=help-close].t-icon-btn')?.focus();
}

// ------------------------------------------------------------ command bar
function cmdItems() {
  const d = S.data;
  const items = [
    { kind: 'מסך', label: 'נסיעות', sub: 'מה דורש טיפול, מה בדרך ומה הגיע', go: () => { location.hash = '#/rides'; } },
    { kind: 'מסך', label: 'בניית סידור', sub: 'נהגים מול שעות, גוררים כדי לשבץ', go: () => { location.hash = '#/plan'; } },
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
    await loadPlanDay(); paintPlanner(); loadWeek().then(paintPlanner);
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
  S.map?.update?.(S.data, S.insp?.id ?? null);
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
  const el = e.target.closest('[data-act],[data-ride],[data-plan-trip],[data-itab],[data-rides],[data-tfacet],[data-pday],[data-pby],[data-ack],[data-unack],[data-prop-apply],[data-prop-open],[data-prop-more],[data-ask],[data-tour],[data-tour-step]');
  if (!el) return;
  const ds = el.dataset;
  if (ds.ride) { openRide(ds.ride, TODAY, 'overview'); return; }
  if (ds.planTrip) { openRide(ds.planTrip, ds.date, ds.date === TODAY ? 'overview' : 'assign').then(paintPlannerSelection); return; }
  if (ds.itab) { if (S.insp.tab === 'assign' && ds.itab !== 'assign' && !(await leaveEdits())) return; S.dirty = false; S.insp.tab = ds.itab; S.composing = false; paintInspector(); return; }
  if (ds.rides) { S.rides = ds.rides; store.set('t-rides-view', S.rides); render(); return; }
  if (ds.tfacet) { S.table.facet = S.table.facet === ds.tfacet ? '' : ds.tfacet; document.querySelectorAll('[data-tfacet]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tfacet === S.table.facet)); paintTable(); return; }
  if (ds.pday) { S.plan.day = ds.pday; S.plan.ci = -1; document.querySelectorAll('[data-pday]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pday === S.plan.day)); await loadPlanDay(); paintPlanner(); return; }
  if (ds.pby) { S.plan.by = ds.pby; document.querySelectorAll('[data-pby]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pby === S.plan.by)); paintPlanner(); return; }
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
  if (act === 'only-issues') { S.plan.onlyIssues = !S.plan.onlyIssues; paintPlanner(); }
  if (act === 'next-conflict') nextConflict();
  if (act === 'publish-drafts') publishDrafts();
  if (act === 'assist-plan') openAssist(S.plan.day);
  if (act === 'fleet-issues') { S.fleetIssues = !S.fleetIssues; el.setAttribute('aria-pressed', S.fleetIssues); paintFleet(); }
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
  if (el.id === 'tq') { S.table.q = el.value; paintTable(); }
  if (el.id === 'pq') { S.plan.q = el.value; paintPlanner(); }
  if (el.id === 'cmd-q') { S.cmd.q = el.value; S.cmd.i = 0; drawCmd(); }
  if (el.closest('.t-insp') && el.matches('select,[data-stop-time],[data-stop-count]')) {
    S.dirty = true;
    const b = $('#save-publish'); if (b) { b.disabled = false; b.textContent = 'שמירה ופרסום לנהג'; }
    const dr = $('[data-act=save-draft]'); if (dr) dr.disabled = false;
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'viewer') { S.viewer = el.value; store.set('t-viewer', S.viewer); refresh().then(rail); }
  if (el.dataset.act === 'driver') { S.driver = el.value; $('#phone-slot').innerHTML = ''; paintPhone(); }
  if (el.dataset.fleet) {
    const before = el.defaultValue; const kind = el.dataset.fleet; const id = el.dataset.id; const field = el.dataset.field;
    command('fleet', { kind, entityId: id, [field]: el.value })
      .then(() => toast(`התאריך עודכן ל־${el.value.split('-').reverse().join('.')}`, { undo: () => run(() => command('fleet', { kind, entityId: id, [field]: before }), 'התאריך הוחזר') }))
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
  if (e.key.toLowerCase() === 'm' || e.key === 'צ') { S.mapOpen ? closeMap() : openMap(); return; }
  if (e.key.toLowerCase() === 'a' || e.key === 'ש') { S.assist ? (S.assist = null, paintAssist(), rail()) : openAssist(TOMORROW); return; }
  if (e.key === 'Escape') {
    clearSpot();
    if (S.help) { S.help = false; paintHelp(); return; }
    if (S.pop) { S.pop = false; rail(); return; }
    if (S.mapOpen) { closeMap(); return; }
    if (S.insp) { closeRide(); return; }
    if (S.assist) { S.assist = null; paintAssist(); rail(); return; }
    if (S.tour) { S.tour = null; paintTour(); }
  }
});
window.addEventListener('hashchange', async () => { if (!['drivers', 'vehicles'].includes(view())) S.flash = null; if (S.mapOpen && !S.tour) closeMap(); if (S.insp) { S.dirty = false; S.insp = null; } await render(); });

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

applyTheme(store.get('t-theme', 'royal'));
if (!location.hash || location.hash === '#/live' || location.hash === '#/schedule') history.replaceState(null, '', location.hash === '#/schedule' ? '#/plan' : '#/rides');
if (location.hash === '#/fleet') history.replaceState(null, '', '#/drivers');
await loadDay(TODAY);
await render();
listen();
