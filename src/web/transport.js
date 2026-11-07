// Dispatcher control center: what is on the road now, what to fix before a bus leaves,
// the day's schedule, and the fleet. One status model, two queues, demo controls tucked away.
import { mountTransportMap } from './transport-map.js';

const DAYS = [
  { label: 'ראשון', date: '2026-11-08' }, { label: 'שני', date: '2026-11-09' }, { label: 'שלישי', date: '2026-11-10' },
  { label: 'רביעי', date: '2026-11-11' }, { label: 'חמישי', date: '2026-11-12' }, { label: 'שישי', date: '2026-11-13' },
];
const DISPATCHERS = [{ id: 'shuki', name: 'שוקי' }, { id: 'inbal', name: 'ענבל' }];
const TODAY = DAYS[0].date;
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const S = {
  viewer: store.get('t-viewer', 'shuki'), data: null, selected: null, phone: true, playing: false,
  day: TODAY, dir: 'morning', sched: null, drawer: null, flash: null, offline: false, driver: 'driver-10', map: null,
  pop: false, confirmReset: false, expand: {}, composing: false, draft: '', tab: 'stops', q: '', facet: new Set(), dirty: false, stale: false, cmd: null,
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = s => document.querySelector(s);
const num = n => (n == null ? '—' : Number(n).toLocaleString('he-IL'));
const heDate = iso => iso.split('-').reverse().slice(0, 2).map(Number).join('.');
const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const FLEET_CAUSE = /רישיון|רישוי|טיפול|זמין|חסר שיבוץ/;

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
  alert: svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  wrench: svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>'),
  doc: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  msg: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  sliders: svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  route: svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>'),
};
const STATUS = {
  upcoming: ['טרם יצאה', ''], blocked: ['חסומה', 'is-blocked'], late: ['לא יצאה', 'is-bad'],
  active: ['בדרך', 'is-active'], delayed: ['מאחרת', 'is-bad'], completed: ['הושלמה', 'is-done'],
};
const pill = status => { const [t, c] = STATUS[status] ?? STATUS.upcoming; return `<span class="t-pill ${c}">${t}</span>`; };

// ------------------------------------------------------------ server
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', 'x-transport-viewer': S.viewer, ...(opts.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'הפעולה נכשלה');
  return body;
}
const stateFor = date => api(`/api/transport/state?date=${date}`);
const command = (type, data = {}, trip = null, date = TODAY) =>
  api('/api/transport/commands', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), type, date, tripId: trip?.id, version: trip?.version, data }) });

function toast(text, { bad = false, undo = null } = {}) {
  const el = document.createElement('div');
  el.className = `t-toast${bad ? ' is-bad' : ''}`;
  el.innerHTML = `<span>${esc(text)}</span>${undo ? '<button type="button">ביטול</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { el.remove(); undo(); };
  $('#toast').replaceChildren(el);
  setTimeout(() => el.remove(), undo ? 6000 : 2800);
}
async function run(fn, ok) {
  try { await fn(); if (ok) toast(ok); return true; } catch (e) { toast(e.message, { bad: true }); return false; }
}
const view = () => (location.hash.replace('#/', '') || 'live').split('?')[0];

// ------------------------------------------------------------ top bar
function top() {
  const v = view();
  const d = S.data;
  const me = DISPATCHERS.find(p => p.id === S.viewer) ?? DISPATCHERS[0];
  const link = (k, label, badge = '') => `<a href="#/${k}" ${v === k ? 'aria-current="page"' : ''}>${label}${badge}</a>`;
  $('#top').innerHTML = `
    <a class="t-brand" href="#/live" aria-label="מערך ההסעות, מועצה אזורית גולן"><span class="t-sign">${I.bus}הסעות</span><span>מועצה אזורית גולן</span></a>
    <nav class="t-nav" aria-label="ניווט">
      ${link('live', 'עכשיו', '<span class="t-badge" id="b-road" hidden></span>')}
      ${link('schedule', 'סידור')}
      ${link('fleet', 'צי ונהגים', '<span class="t-badge" id="b-fleet" hidden></span>')}
    </nav>
    <div class="t-spacer"></div>
    <button class="t-search" data-act="cmd" aria-label="חיפוש (Command K)">${I.search}<span>נסיעה, קו, נהג או יישוב</span><kbd class="t-kbd">⌘K</kbd></button>
    <div class="t-clock" id="clock" title="שעון ההדגמה"><span class="t-live-dot"></span><span class="num" id="clock-time">${esc(d?.clock ?? '')}</span><small>יום ${esc(d?.weekday ?? 'ראשון')} ${heDate(TODAY)}</small></div>
    <div class="t-pop-wrap">
      <button class="t-btn" data-act="pop" aria-expanded="${S.pop}" aria-haspopup="dialog">${I.sliders} הדגמה</button>
      ${S.pop ? demoTray() : ''}
    </div>
    <span class="t-avatar" aria-hidden="true">${esc(me.name[0])}</span>
    <select class="t-select" data-act="viewer" aria-label="מחובר כסדרן">${DISPATCHERS.map(p => `<option value="${p.id}" ${p.id === S.viewer ? 'selected' : ''}>${p.name} · סדרן</option>`).join('')}</select>`;
  topTick();
}
function topTick() {
  const d = S.data;
  if (!d) return;
  const road = d.alerts.filter(a => a.queue === 'road' && !a.handled).length;
  const fleet = d.alerts.filter(a => a.kind === 'fleet' && a.level === 'high' && !a.handled).length;
  const set = (id, n, label) => { const el = $(id); if (el) { el.hidden = !n; el.textContent = n; el.setAttribute('aria-label', `${n} ${label}`); } };
  set('#b-road', road, 'פתוחים בכביש'); set('#b-fleet', fleet, 'חוסמים');
  if ($('#clock-time')) $('#clock-time').textContent = d.clock;
  if ($('#pop-clock')) $('#pop-clock').textContent = d.clock;
  $('#clock')?.classList.toggle('is-playing', S.playing);
  const st = $('.t-status-time'); if (st) st.textContent = d.clock;
}
function demoTray() {
  const d = S.data;
  const drivers = d.drivers.filter(x => d.trips.some(t => t.driverId === x.id && t.published && !t.issues.length));
  return `<div class="t-pop" role="dialog" aria-label="שליטה בהדגמה">
    <h3>שליטה בהדגמה. לא חלק מהמוצר.</h3>
    <div class="t-pop-row"><span>השעה <b class="num" id="pop-clock">${esc(d.clock)}</b></span>
      <span style="display:flex;gap:6px"><button class="t-btn is-sm" data-act="play">${S.playing ? `${I.pause} עצירה` : `${I.play} הרצה`}</button><button class="t-btn is-sm" data-act="plus5">+5 דק׳</button></span></div>
    <hr>
    <div class="t-pop-row"><span id="l-phone">טלפון הנהג ליד המפה</span><button class="t-switch" role="switch" aria-checked="${S.phone}" aria-labelledby="l-phone" data-act="phone"></button></div>
    <div class="t-pop-row"><label for="drv">נהג בטלפון</label><select id="drv" class="t-select" data-act="driver">${drivers.map(x => `<option value="${x.id}" ${x.id === S.driver ? 'selected' : ''}>${esc(x.name)} · קו ${esc(x.routeCode)}</option>`).join('')}</select></div>
    <div class="t-pop-row"><span id="l-off">הטלפון ללא קליטה</span><button class="t-switch" role="switch" aria-checked="${S.offline}" aria-labelledby="l-off" data-act="offline"></button></div>
    <hr>
    <div class="t-pop-row"><span>חזרה ל־07:05, בלי דיווחים</span><button class="t-btn is-sm" data-act="reset">${I.reset} ${S.confirmReset ? 'לאפס? שוב' : 'איפוס'}</button></div>
  </div>`;
}

// ------------------------------------------------------------ live: side panel
function statusline(trips) {
  const moving = trips.filter(t => t.status === 'active' || t.status === 'delayed');
  const late = trips.filter(t => t.status === 'late' || t.status === 'delayed');
  const done = trips.filter(t => t.status === 'completed');
  const counted = [...moving, ...done].filter(t => t.direction === 'morning');
  const reported = counted.reduce((s, t) => s + (t.live.boarded || 0), 0);
  const planned = counted.reduce((s, t) => s + t.points.filter((p, i) => p.kind === 'stop' && i <= t.live.departedIndex).reduce((a, p) => a + (p.planned || 0), 0), 0);
  const missing = planned - reported;
  return `<div class="t-statusline">
    <span><b class="num">${num(moving.length)}</b>בדרך</span>
    <span class="${late.length ? 'is-bad' : ''}"><b class="num">${num(late.length)}</b>מאחרות</span>
    <span><b class="num">${num(done.length)}</b>הושלמו</span>
    <span class="${missing > 0 ? 'is-bad' : ''}"><b class="num">${num(reported)}</b>תלמידים עלו${missing > 0 ? ` · ${num(missing)} חסרים` : ''}</span>
    <span class="t-sim">${I.clock}מיקומים וכמויות: סימולציה לפי שעון ההדגמה, אין GPS. קו 10 מדווח מהטלפון.</span>
  </div>`;
}
function roadAlert(a) {
  return `<div class="t-alert is-${a.level}">
    <span class="t-alert-icon">${I.alert}</span>
    <div class="t-alert-main">
      <button class="t-alert-open" data-alert="${esc(a.id)}"><b>${esc(a.title)}</b><span class="t-detail">${esc(a.detail)}</span></button>
      <div class="t-alert-actions">
        ${a.call ? `<a class="t-btn is-sm is-primary" href="tel:${esc(a.call.phone)}" data-call="${esc(a.call.name)}|${esc(a.call.phone)}">${I.call} ${esc(a.call.name)}</a>` : ''}
        <button class="t-btn is-sm" data-ack="${esc(a.id)}">${I.check} טופל</button>
      </div>
    </div>
  </div>`;
}
function roadSection(road) {
  const open = road.filter(a => !a.handled);
  const handled = road.filter(a => a.handled);
  return `<section class="t-sec ${open.length ? 'is-road' : ''}" aria-labelledby="h-road">
    <div class="t-sec-head"><h2 id="h-road">עכשיו בכביש</h2><span>${open.length ? `${num(open.length)} פתוחים` : ''}</span></div>
    ${open.map(roadAlert).join('') || '<p class="t-empty">אין דבר פתוח בכביש.</p>'}
    ${handled.length ? `<details class="t-handled"><summary>טופלו (${num(handled.length)})</summary>
      ${handled.map(a => `<div class="t-handled-row"><span><s>${esc(a.title)}</s><br>${esc(a.handled.by)}${a.handled.note ? ` · ${esc(a.handled.note)}` : ''}</span><button class="t-btn is-sm is-ghost" data-unack="${esc(a.id)}">החזרה</button></div>`).join('')}
    </details>` : ''}
  </section>`;
}
function prepSection(prep) {
  const open = prep.filter(a => !a.handled);
  if (!open.length) return '';
  return `<section class="t-sec" aria-labelledby="h-prep">
    <div class="t-sec-head"><h2 id="h-prep">לפני יציאה</h2><span>${num(open.length)} לתיקון</span></div>
    ${open.map(a => `<button class="t-prep" data-alert="${esc(a.id)}">
      <span class="t-alert-icon ${a.level === 'high' ? 'is-high' : ''}">${a.kind === 'fleet' ? I.wrench : I.doc}</span>
      <span><b>${esc(a.title)}</b><span class="t-detail">${esc(a.detail)}</span></span>${I.chev}</button>`).join('')}
  </section>`;
}
function tripRow(t) {
  const next = t.points[t.live.departedIndex + 1];
  const where = t.status === 'completed' ? 'הגיעה'
    : t.live.blockedReason && t.live.phase === 'pending' ? t.live.blockedReason
    : t.live.phase === 'pending' ? `יוצאת ${t.departure}` : next ? `לקראת ${next.name}` : '';
  const figure = t.live.boarded != null
    ? `<span dir="ltr"><b class="num">${num(t.live.boarded)}</b>/${num(t.planned)}</span>`
    : `<b class="num">${num(t.planned)}</b> תלמידים`;
  const tone = ['upcoming', 'completed', 'blocked'].includes(t.status) ? 'is-quiet' : ['late', 'delayed'].includes(t.status) ? 'is-bad' : '';
  return `<button class="t-row ${t.id === S.selected ? 'is-selected' : ''}" data-trip="${t.id}">
    <span class="t-code ${tone}">${esc(t.routeCode)}</span>
    <span><b>${esc(t.school)}</b><span class="t-sub">${esc(where)}${t.live.lateMinutes ? ` · ${t.live.lateMinutes} דק׳` : ''}${t.live.mode === 'manual' ? ' · מהטלפון' : ''}</span></span>
    <span class="t-figure">${figure}<br>${pill(t.status)}</span>
  </button>`;
}
function tripSection(key, title, trips, limit = 5) {
  if (!trips.length) return '';
  const open = S.expand[key];
  const shown = open ? trips : trips.slice(0, limit);
  return `<section class="t-sec" aria-labelledby="h-${key}">
    <div class="t-sec-head"><h2 id="h-${key}">${title}</h2><span class="num">${num(trips.length)}</span></div>
    ${shown.map(tripRow).join('')}
    ${trips.length > limit ? `<button class="t-more" data-expand="${key}">${open ? 'פחות' : `כל ה־${num(trips.length)}`}</button>` : ''}
  </section>`;
}
function overview() {
  const d = S.data;
  const now = minutes(d.clock);
  const late = d.trips.filter(t => t.status === 'late' || t.status === 'delayed').sort((a, b) => b.live.lateMinutes - a.live.lateMinutes);
  const moving = d.trips.filter(t => t.status === 'active').sort((a, b) => a.departure.localeCompare(b.departure));
  const soon = d.trips.filter(t => ['upcoming', 'blocked'].includes(t.status) && minutes(t.departure) - now <= 45).sort((a, b) => a.departure.localeCompare(b.departure));
  const done = d.trips.filter(t => t.status === 'completed' && t.direction === 'morning');
  return `${statusline(d.trips)}
    ${roadSection(d.alerts.filter(a => a.queue === 'road'))}
    ${tripSection('late', 'מאחרות', late)}
    ${tripSection('moving', 'בדרך', moving)}
    ${tripSection('soon', 'יוצאות ב־45 הדקות הקרובות', soon)}
    ${prepSection(d.alerts.filter(a => a.queue === 'prep'))}
    ${tripSection('done', 'הושלמו הבוקר', done, 0)}
    <p class="t-foot">${num(d.trips.length)} נסיעות ביום ${esc(d.weekday)}, מתוך קובץ הסידור של המועצה.</p>`;
}

// ------------------------------------------------------------ live: trip record
function record(t) {
  const d = t.live.departedIndex;
  const road = S.data.alerts.filter(a => a.tripId === t.id && a.queue === 'road' && !a.handled);
  const stops = t.points.map((p, i) => {
    const c = t.live.stopCounts[p.id];
    const cls = i <= d ? 'is-done' : i === d + 1 && t.live.phase !== 'pending' ? 'is-next' : '';
    const label = p.kind === 'school' ? 'בי״ס' : String(t.points.slice(0, i + 1).filter(x => x.kind === 'stop').length);
    const count = p.kind === 'school'
      ? (t.direction === 'morning' && i <= d ? `<b class="num">${num(t.live.boarded)}</b> ירדו` : '')
      : c ? `<span dir="ltr"><b class="num ${c.expected != null && c.count !== c.expected ? 'is-off' : ''}">${num(c.count)}</b>/${num(p.planned)}</span><div class="t-source">${c.source === 'driver' ? 'דיווח נהג' : 'סימולציה'}</div>`
      : `<span class="num">${num(p.planned)}</span> צפויים`;
    return `<li class="${cls}"><span class="t-dot ${p.kind === 'school' ? 'is-school' : ''}">${label}</span><span><b>${esc(p.name)}</b><small>${esc(p.time ?? '')}${p.located ? '' : ' · מיקום לא ידוע'}</small></span><span class="t-count-cell">${count}</span></li>`;
  }).join('');
  const events = [...(t.events ?? [])].reverse();
  const feed = events.map(e => `<li><span class="t-who ${e.source === 'driver' ? 'is-driver' : ''}" aria-hidden="true">${esc((e.actor || '?')[0])}</span><span><b>${esc(e.actor)}</b> <small>${e.source === 'driver' ? 'נהג' : 'סדרן'}</small><br>${esc(e.text)}</span></li>`).join('');
  const blocked = t.live.blockedReason && t.live.phase === 'pending';
  return `<div class="t-rec-head">
      <button class="t-back" data-act="back">${I.back} כל הנסיעות</button>
      <div class="t-rec-title"><span class="t-code ${['late', 'delayed'].includes(t.status) ? 'is-bad' : ['upcoming', 'completed', 'blocked'].includes(t.status) ? 'is-quiet' : ''}">${esc(t.routeCode)}</span><h2>${esc(t.school)}</h2>${pill(t.status)}</div>
      <div class="t-meta"><span>נסיעה <b class="num">${esc(t.number)}</b></span><span>${t.direction === 'morning' ? 'איסוף בוקר' : 'פיזור צהריים'}</span><span>יציאה <b class="num">${esc(t.departure)}</b></span>${t.live.lateMinutes ? `<span style="color:var(--bad)">${t.live.lateMinutes} דק׳ איחור</span>` : ''}</div>
      <div class="t-meta">${I.user}<span><b>${esc(t.driverName)}</b></span>${I.bus}<span><b>${esc(t.vehicleName)}</b> · ${t.capacity ? `${num(t.capacity)} מקומות` : 'מקומות: לא ידוע'}</span></div>
      ${blocked ? `<ul class="t-issues is-bad"><li><b>לא תצא:</b> ${esc(t.live.blockedReason)}</li></ul>` : t.issues.length ? `<ul class="t-issues">${t.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${road.length ? `<ul class="t-issues is-bad">${road.map(a => `<li>${esc(a.title)}</li>`).join('')}</ul>` : ''}
      <div class="t-actions">
        ${blocked ? `<button class="t-btn is-primary" data-act="to-schedule">${I.wrench} תיקון השיבוץ</button>` : ''}
        ${t.driverContact ? `<a class="t-btn ${blocked ? '' : 'is-primary'}" href="tel:${esc(t.driverContact)}" data-call="${esc(t.driverName)}|${esc(t.driverContact)}">${I.call} התקשרות</a>` : ''}
        <button class="t-btn" data-act="compose" aria-expanded="${S.composing}">${I.msg} הודעה לנהג</button>
        ${blocked ? '' : `<button class="t-btn is-ghost" data-act="to-schedule">${I.route} שיבוץ ותחנות</button>`}
      </div>
      ${S.composing ? `<form class="t-composer" data-form="note">
        <label class="sr-only" for="note-text">הודעה ל${esc(t.driverName)}</label>
        <textarea id="note-text" placeholder="תופיע בלשונית ההודעות באפליקציה של ${esc(t.driverName)}" maxlength="300">${esc(S.draft)}</textarea>
        <div class="t-actions"><button class="t-btn is-primary is-sm" type="submit">שליחה</button><button class="t-btn is-sm is-ghost" type="button" data-act="compose">ביטול</button></div>
      </form>` : ''}
    </div>
    <div class="t-tabs-mini" role="tablist">
      <button role="tab" data-tab="stops" aria-selected="${S.tab === 'stops'}">תחנות</button>
      <button role="tab" data-tab="log" aria-selected="${S.tab === 'log'}">יומן${events.length ? ` (${num(events.length)})` : ''}</button>
    </div>
    ${S.tab === 'stops' ? `<ol class="t-timeline">${stops}</ol>` : `<ul class="t-feed">${feed || '<li class="t-empty" style="display:block">אין עדיין דיווחים או הודעות.</li>'}</ul>`}
    <p class="t-foot">מיקום האוטובוס: סימולציה לפי שעון ההדגמה, לא GPS. ${t.live.mode === 'manual' ? 'הכמויות מדיווחי הנהג.' : 'הכמויות: סימולציה.'} מקור: ${esc(t.source.sheet)} ${esc(t.source.range)}</p>`;
}
function renderSide() {
  const side = $('#side');
  if (!side || !S.data) return;
  const active = document.activeElement;
  const focusId = side.contains(active) ? active.id : null;
  const caret = focusId && active.selectionStart != null ? active.selectionStart : null;
  const scroll = side.scrollTop;
  const trip = S.data.trips.find(t => t.id === S.selected);
  side.innerHTML = trip ? record(trip) : overview();
  side.scrollTop = scroll;
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (caret != null) el.setSelectionRange?.(caret, caret); } }
}
function select(id) {
  S.selected = id; S.composing = false; S.draft = ''; S.tab = 'stops';
  if (view() !== 'live') { location.hash = '#/live'; return; }
  renderSide();
  $('#side').scrollTop = 0;
  S.map?.update?.(S.data, id);
  if (!id) S.map?.overview?.();
}

function livePage() {
  return `<section class="t-live ${S.phone ? 'with-phone' : ''}">
    <aside class="t-side" id="side" aria-label="מצב הנסיעות"></aside>
    <div class="t-map"><div class="t-map-canvas" id="map"></div>
      <div class="t-map-note">
        <span class="t-legend"><i style="background:var(--accent)"></i>בדרך</span>
        <span class="t-legend"><i style="background:var(--bad)"></i>מאחרת</span>
        <span class="t-legend"><i style="background:#fff;border:1px solid var(--line-2)"></i>הושלמה</span>
        <span>סימולציה · אין GPS</span>
      </div>
    </div>
    ${S.phone ? phoneDock() : ''}
  </section>`;
}
function phoneDock() {
  return `<div class="t-phone-dock"><div class="t-phone ${S.offline ? 'is-offline' : ''}"><div class="t-phone-screen">
    <div class="t-status" aria-hidden="true"><span class="t-status-time num">${esc(S.data.clock)}</span><span class="t-island"></span><span class="t-status-icons"><span class="t-no-service">אין שירות</span><span class="t-signal"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg></span><svg viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" opacity=".4"/></svg></span></div>
    <iframe id="phone" title="אפליקציית הנהג" src="./driver.html?d=${encodeURIComponent(S.driver)}&date=${TODAY}&frame=1"></iframe>
    <span class="t-home" aria-hidden="true"></span>
  </div></div></div>`;
}

// ------------------------------------------------------------ grids
// AG Grid Community with the Omni kit's DataGrid conventions: Quartz theme on our tokens, RTL,
// a toolbar of search and facet chips above, a summary line, an inspector docked beside, a count below.
const AG = window.agGrid;
const gridTheme = AG?.themeQuartz.withParams({
  backgroundColor: 'var(--surface)', foregroundColor: 'var(--ink)', borderColor: 'var(--line)',
  rowBorder: { color: '#eceef1' }, headerBackgroundColor: 'var(--surface-2)', headerTextColor: 'var(--muted)',
  rowHoverColor: '#f5f6f8', accentColor: 'var(--accent)', selectedRowBackgroundColor: 'var(--tangerine-soft)',
  fontFamily: 'var(--font)', fontSize: 13, headerFontSize: 12, headerFontWeight: 500, headerHeight: 36,
  cellHorizontalPadding: 12, wrapperBorderRadius: 12, wrapperBorder: false,
});
S.grids = {};
function grid(el, key, options) {
  if (!AG) { el.innerHTML = '<p class="t-empty">טעינת הטבלה נכשלה. בדקו את החיבור לרשת.</p>'; return null; }
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

// ------------------------------------------------------------ schedule
const blocking = x => x.issues.find(i => FLEET_CAUSE.test(i));
const tripState = x => (x.issues.length ? 'fix' : x.published ? 'published' : 'draft');
const FACETS = [['fix', 'לתיקון'], ['draft', 'טיוטה'], ['published', 'פורסמה']];
function schedStatus(x) {
  if (blocking(x)) return `<span class="t-pill is-blocked">${esc(blocking(x))}</span>`;
  if (x.issues.length) return `<span class="t-pill is-warn">${esc(x.issues[0])}</span>`;
  return x.published ? '<span class="t-pill is-ok">פורסמה לנהג</span>' : '<span class="t-pill">טיוטה</span>';
}
const byDir = t => S.dir === 'all' || t.direction === S.dir;
function schedRows() {
  const q = S.q.trim();
  return S.sched.trips.filter(byDir)
    .filter(t => !q || [t.number, t.routeCode, t.school, t.driverName, t.vehicleName, ...t.stops.map(s => s.name)].join(' ').includes(q))
    .filter(t => !S.facet.size || S.facet.has(tripState(t)))
    .sort((a, b) => a.departure.localeCompare(b.departure));
}
const schedColumns = () => [
  { headerName: 'יציאה', field: 'departure', width: 86, minWidth: 76, cellClass: 't-gcell num', sort: 'asc' },
  { headerName: 'קו', field: 'routeCode', width: 78, minWidth: 70, comparator: (a, b) => (Number(a) || 1e9) - (Number(b) || 1e9) || String(a).localeCompare(b), cellRenderer: p => `<span class="t-code is-quiet">${esc(p.value)}</span>` },
  { headerName: 'בית ספר ותחנות', field: 'school', flex: 2.4, minWidth: 260, cellRenderer: p => two(esc(p.value), esc(p.data.points.filter(x => x.kind === 'stop').map(x => x.name).join(' · '))) },
  { headerName: 'תלמידים', field: 'planned', width: 100, cellClass: endCell, headerClass: 't-ghead-end' },
  { headerName: 'נהג', field: 'driverName', flex: 1, minWidth: 120 },
  { headerName: 'רכב', field: 'vehicleName', flex: 1, minWidth: 110 },
  { headerName: 'מצב', colId: 'state', flex: 1.5, minWidth: 180, valueGetter: p => FACETS.findIndex(([k]) => k === tripState(p.data)), cellRenderer: p => schedStatus(p.data) },
];
function schedulePage() {
  return `<div class="t-page t-page-full">
    <header class="t-page-head">
      <div><h1>סידור הסעות</h1><p id="sched-meta"></p></div>
      <div class="t-spacer"></div>
      <div class="t-seg" role="group" aria-label="יום">${DAYS.map(x => `<button data-day="${x.date}" aria-pressed="${x.date === S.day}">${x.label}</button>`).join('')}</div>
    </header>
    <div class="t-toolbar">
      <label class="t-search-field">${I.search}<span class="sr-only">חיפוש בסידור</span><input id="q" type="search" placeholder="קו, בית ספר, יישוב או נהג" value="${esc(S.q)}"></label>
      <div class="t-seg" role="group" aria-label="כיוון">${[['morning', 'בוקר'], ['afternoon', 'צהריים'], ['all', 'הכל']].map(([k, l]) => `<button data-dir="${k}" aria-pressed="${k === S.dir}">${l}</button>`).join('')}</div>
      <div class="t-chips" id="facets" role="group" aria-label="מצב"></div>
    </div>
    <div class="t-workspace" id="workspace">
      <div class="t-grid-col"><div class="t-grid t-grid-main" id="g-sched"></div><p class="t-grid-foot" id="sched-foot"></p></div>
      <div id="inspector"></div>
    </div>
  </div>`;
}
function paintSchedule() {
  const d = S.sched;
  const inDir = d.trips.filter(byDir);
  const rows = schedRows();
  const count = k => inDir.filter(t => tripState(t) === k).length;
  $('#sched-meta').innerHTML = [`יום ${esc(d.weekday)} ${heDate(d.date)}`, `${num(d.trips.length)} נסיעות`, `${num(d.trips.filter(x => x.issues.length).length)} לתיקון לפני פרסום`].join(' · ');
  $('#facets').innerHTML = FACETS.map(([k, l]) => `<button class="t-chip" data-facet="${k}" aria-pressed="${S.facet.has(k)}">${l} <span class="num">${num(count(k))}</span></button>`).join('')
    + (S.facet.size ? '<button class="t-btn is-ghost is-sm" data-act="clear-facets">ניקוי</button>' : '');
  $('#sched-foot').textContent = `מוצגות ${num(rows.length)} מתוך ${num(d.trips.length)} נסיעות · מקור: קובץ הסידור של המועצה`;
  const g = S.grids.sched;
  if (g) { g.setGridOption('rowData', rows); g.redrawRows(); }
  paintInspector();
}
function paintInspector() {
  const t = S.sched?.trips.find(x => x.id === S.drawer);
  $('#workspace')?.classList.toggle('has-inspector', Boolean(t));
  const slot = $('#inspector');
  if (slot) slot.innerHTML = t ? inspector(t, S.sched) : '';
}
function openTrip(id) {
  if (S.dirty && id !== S.drawer && !confirm('לצאת בלי לשמור את השינויים?')) return;
  S.drawer = id; S.dirty = false; S.stale = false;
  paintInspector();
  S.grids.sched?.redrawRows();
}
function inspector(t, d) {
  const editable = t.live.phase === 'pending';
  const driverOk = x => x.licenseUntil >= S.day;
  const busOk = v => v.available !== false && v.testUntil >= S.day && (v.capacity == null || v.capacity >= (t.planned || 0));
  const rank = ok => (a, b) => (b.id === t.driverId || b.id === t.vehicleId) - (a.id === t.driverId || a.id === t.vehicleId) || ok(b) - ok(a);
  const driverOpt = x => `<option value="${x.id}" ${x.id === t.driverId ? 'selected' : ''}>${esc(x.name)}${x.routeCode ? ` · קו ${esc(x.routeCode)}` : ' · חלופי'}${driverOk(x) ? '' : ' · רישיון פג'}</option>`;
  const busOpt = v => `<option value="${v.id}" ${v.id === t.vehicleId ? 'selected' : ''}>${esc(v.label)}${v.capacity ? ` · ${v.capacity} מק׳` : ''}${v.testUntil < S.day ? ' · טסט פג' : v.capacity != null && v.capacity < (t.planned || 0) ? ' · קטן מדי' : ''}</option>`;
  const done = t.published && !t.issues.length;
  return `<section class="t-insp t-drawer" aria-label="נסיעה ${esc(t.number)}">
    <header class="t-insp-head">
      <div><h2><span class="t-code is-quiet">${esc(t.routeCode)}</span> ${esc(t.school)}</h2>
        <p>נסיעה ${esc(t.number)} · ${t.direction === 'morning' ? 'איסוף בוקר' : 'פיזור צהריים'} · יציאה ${esc(t.departure)} · ${num(t.planned)} תלמידים</p></div>
      <button class="t-btn is-ghost is-sm" data-act="close-drawer" aria-label="סגירה">${I.x}</button>
    </header>
    <div class="t-insp-body">
      <div id="stale">${S.stale ? '<div class="t-stale"><span>הסידור השתנה בינתיים.</span><button class="t-btn is-sm" data-act="reload">טעינה מחדש</button></div>' : ''}</div>
      ${t.issues.length ? `<ul class="t-issues ${blocking(t) ? 'is-bad' : ''}">${t.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<ul class="t-issues is-ok"><li>${t.published ? 'פורסמה לנהג' : 'מוכנה לפרסום'}</li></ul>`}
      <div class="t-field"><label for="f-driver">נהג</label><select id="f-driver" class="t-select" ${editable ? '' : 'disabled'}>${[...d.drivers].sort(rank(driverOk)).map(driverOpt).join('')}</select></div>
      <div class="t-field"><label for="f-bus">רכב · המתאימים ראשונים</label><select id="f-bus" class="t-select" ${editable ? '' : 'disabled'}>${[...d.vehicles].sort(rank(busOk)).map(busOpt).join('')}</select></div>
      <div class="t-field"><label>תחנות · שעה · תלמידים</label>
        <div class="t-stops-edit">${t.stops.map((s, i) => `<div><span>${esc(s.name)}</span><input data-stop-time="${i}" value="${esc(s.time)}" inputmode="numeric" aria-label="שעה ב${esc(s.name)}" ${editable ? '' : 'disabled'}><input data-stop-count="${i}" type="number" min="0" value="${esc(s.planned ?? '')}" aria-label="תלמידים ב${esc(s.name)}" ${editable ? '' : 'disabled'}></div>`).join('')}</div>
      </div>
      <p class="t-source">${editable ? 'כל שינוי מחזיר את הנסיעה לטיוטה עד שמפרסמים שוב.' : 'הנסיעה כבר יצאה. אי אפשר לשנות אותה.'} מקור: ${esc(t.source.sheet)} ${esc(t.source.range)}</p>
    </div>
    <footer class="t-insp-foot">
      <button class="t-btn is-primary" id="save-publish" data-act="save-publish" ${editable && (!done || S.dirty) ? '' : 'disabled'}>${done && !S.dirty ? `${I.check} פורסמה לנהג` : 'שמירה ופרסום לנהג'}</button>
      <button class="t-btn is-ghost" data-act="save-draft" ${editable && S.dirty ? '' : 'disabled'}>שמירה כטיוטה</button>
    </footer>
  </section>`;
}
async function saveTrip(t, publish) {
  const driverId = $('#f-driver').value;
  const vehicleId = $('#f-bus').value;
  const stops = t.stops.map((s, i) => ({ name: s.name, time: $(`[data-stop-time="${i}"]`).value.trim(), planned: Number($(`[data-stop-count="${i}"]`).value) }));
  const latest = async () => (await stateFor(S.day)).trips.find(x => x.id === t.id);
  if (driverId !== t.driverId || vehicleId !== t.vehicleId) await command('assign', { driverId, vehicleId }, t, S.day);
  if (stops.some((s, i) => s.time !== t.stops[i].time || s.planned !== t.stops[i].planned)) {
    const now = await latest();
    await command('edit', { departure: stops[0]?.time && t.direction === 'morning' ? stops[0].time : t.departure, stops }, now, S.day);
  }
  S.dirty = false; S.stale = false;
  let fresh = await latest();
  if (publish) {
    if (fresh.issues.length) { await reloadSchedule(); throw new Error(`נשמר כטיוטה. לפני פרסום: ${fresh.issues[0]}`); }
    if (!fresh.published) await command('publish', {}, fresh, S.day);
  }
  await reloadSchedule();
}
async function reloadSchedule() { S.sched = await stateFor(S.day); paintSchedule(); }

// ------------------------------------------------------------ fleet
const daysLeft = iso => Math.round((Date.parse(iso) - Date.parse(TODAY)) / 86_400_000);
const due = (iso, soon = 14) => !iso ? '<span class="t-pill">לא ידוע</span>' : daysLeft(iso) < 0 ? '<span class="t-pill is-bad">פג תוקף</span>' : daysLeft(iso) <= soon ? `<span class="t-pill is-warn">בעוד ${daysLeft(iso)} ימים</span>` : '<span class="t-pill is-ok">בתוקף</span>';
// The date and, only when it needs attention, its state: a valid date needs no badge.
const dateCell = (kind, field, label, soon = 14) => ({
  cellRenderer: p => `<span class="t-datecell"><input type="date" class="t-date num" data-fleet="${kind}" data-id="${p.data.id}" data-field="${field}" value="${esc(p.data[field])}" aria-label="${esc(label(p.data))}">${!p.data[field] || daysLeft(p.data[field]) <= soon ? due(p.data[field], soon) : ''}</span>`,
  suppressKeyboardEvent: () => true, sortable: true, flex: 1, minWidth: 230,
});
function fleetPage() {
  const d = S.data;
  const problems = d.alerts.filter(a => a.kind === 'fleet' && a.level === 'high');
  return `<div class="t-page t-page-full">
    <header class="t-page-head"><div><h1>צי ונהגים</h1><p>${[`${num(d.drivers.length)} נהגים`, `${num(d.vehicles.length)} רכבים`, problems.length ? `${num(problems.length)} חוסמים נסיעות היום` : 'הכל בתוקף'].join(' · ')}</p></div></header>
    <div class="t-fleet">
      <section><div class="t-sec-title"><h2>נהגים</h2><span>לחיצה על תאריך לעדכון</span></div><div class="t-grid t-grid-fleet" id="g-drivers"></div></section>
      <section><div class="t-sec-title"><h2>רכבים</h2><span>טסט וטיפול</span></div><div class="t-grid t-grid-fleet" id="g-buses"></div></section>
    </div>
    <p class="t-grid-foot">נהגים, רכבים ותוקפים הם נתוני הדגמה. אין להם מקור בקובץ הסידור.</p>
  </div>`;
}
function fleetRows() {
  const d = S.data;
  const trips = (field, id) => d.trips.filter(t => t[field] === id).length;
  return {
    drivers: [...d.drivers].sort((a, b) => (a.licenseUntil < b.licenseUntil ? -1 : 1)).map(x => ({ ...x, today: trips('driverId', x.id) })),
    buses: [...d.vehicles].sort((a, b) => ((a.testUntil || '9') < (b.testUntil || '9') ? -1 : 1)).map(x => ({ ...x, today: trips('vehicleId', x.id) })),
  };
}
function mountFleet() {
  const rows = fleetRows();
  const flash = { 't-flash': p => p.data?.id === S.flash };
  const g1 = grid($('#g-drivers'), 'drivers', {
    rowData: rows.drivers, rowClassRules: flash,
    columnDefs: [
      { headerName: 'נהג', field: 'name', flex: 1.4, minWidth: 170, cellRenderer: p => two(esc(p.value), `${p.data.routeCode ? `קו ${esc(p.data.routeCode)}` : 'חלופי'} · <span dir="ltr">${esc(p.data.contact)}</span>`) },
      { headerName: 'רישיון', field: 'licenseType', width: 84 },
      { headerName: 'רישיון בתוקף עד', field: 'licenseUntil', ...dateCell('driver', 'licenseUntil', x => `תוקף רישיון של ${x.name}`) },
      { headerName: 'נסיעות היום', field: 'today', width: 110, cellClass: endCell },
    ],
  });
  const g2 = grid($('#g-buses'), 'buses', {
    rowData: rows.buses, rowClassRules: flash,
    columnDefs: [
      { headerName: 'רכב', field: 'label', flex: 1.2, minWidth: 140, cellRenderer: p => two(esc(p.value), `<span dir="ltr">${esc(p.data.registration)}</span>`) },
      { headerName: 'מקומות', field: 'capacity', width: 84, minWidth: 76, cellClass: endCell, valueFormatter: p => (p.value ? num(p.value) : 'לא ידוע') },
      { headerName: 'טסט בתוקף עד', field: 'testUntil', ...dateCell('vehicle', 'testUntil', x => `תוקף טסט ל${x.label}`) },
      { headerName: 'טיפול הבא', field: 'serviceDue', ...dateCell('vehicle', 'serviceDue', x => `מועד טיפול ל${x.label}`, 7) },
    ],
  });
  if (S.flash) for (const g of [g1, g2]) { const n = g?.getRowNode(S.flash); if (n) setTimeout(() => g.ensureNodeVisible(n, 'middle'), 50); }
}
function paintFleet() {
  const rows = fleetRows();
  S.grids.drivers?.setGridOption('rowData', rows.drivers);
  S.grids.buses?.setGridOption('rowData', rows.buses);
}

// ------------------------------------------------------------ command bar
function cmdItems() {
  const d = S.data;
  const items = [
    { kind: 'מסך', label: 'עכשיו', sub: 'מה קורה בכביש', go: () => { S.selected = null; location.hash = '#/live'; } },
    { kind: 'מסך', label: 'סידור', sub: 'שיבוץ, תחנות ופרסום', go: () => { location.hash = '#/schedule'; } },
    { kind: 'מסך', label: 'צי ונהגים', sub: 'רישיונות, טסטים וטיפולים', go: () => { location.hash = '#/fleet'; } },
  ];
  const order = { late: 0, delayed: 0, active: 1, blocked: 2, upcoming: 3, completed: 4 };
  [...d.trips].sort((a, b) => order[a.status] - order[b.status] || a.departure.localeCompare(b.departure)).forEach(t => items.push({
    kind: 'נסיעה', label: `${t.number} · ${t.school}`, sub: `${t.departure} · ${STATUS[t.status]?.[0] ?? ''} · ${t.driverName} · ${t.points.filter(p => p.kind === 'stop').map(p => p.name).join(', ')}`,
    hay: `${t.number} ${t.routeCode} קו ${t.routeCode} ${t.school} ${t.driverName} ${t.vehicleName} ${t.stops.map(s => s.name).join(' ')}`, go: () => select(t.id),
  }));
  d.drivers.forEach(x => items.push({ kind: 'נהג', label: x.name, sub: x.routeCode ? `קו ${x.routeCode}` : 'חלופי', go: () => { S.flash = x.id; location.hash = '#/fleet'; render(); } }));
  d.vehicles.forEach(x => items.push({ kind: 'רכב', label: x.label, sub: x.capacity ? `${x.capacity} מקומות` : 'מקומות לא ידוע', go: () => { S.flash = x.id; location.hash = '#/fleet'; render(); } }));
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
  const list = res.map((it, i) => `<li role="option" id="c-${i}" data-ci="${i}" aria-selected="${i === S.cmd.i}"><span class="t-kind">${it.kind}</span><span><b style="font-weight:500">${esc(it.label)}</b><br><small>${esc(it.sub)}</small></span>${i === S.cmd.i ? '<kbd class="t-kbd">↵</kbd>' : '<span></span>'}</li>`).join('');
  if (!$('.t-cmd')) {
    root.innerHTML = `<div class="t-cmd-scrim" data-act="cmd-close"><div class="t-cmd" role="dialog" aria-label="חיפוש">
      <input id="cmd-q" role="combobox" aria-expanded="true" aria-controls="cmd-list" autocomplete="off" placeholder="חיפוש נסיעה, קו, יישוב, נהג או רכב">
      <ul id="cmd-list" role="listbox"></ul></div></div>`;
    $('#cmd-q').focus();
  }
  $('#cmd-list').innerHTML = list || '<li class="t-cmd-empty" style="display:block">לא נמצא. נסו מספר קו או שם יישוב.</li>';
  $('#cmd-q').setAttribute('aria-activedescendant', res.length ? `c-${S.cmd.i}` : '');
  $(`#c-${S.cmd.i}`)?.scrollIntoView({ block: 'nearest' });
}
const openCmd = () => { S.pop = false; S.cmd = { q: '', i: 0 }; drawCmd(); };
const closeCmd = () => { S.cmd = null; drawCmd(); };
function pickCmd(i) { const it = S.cmd?.res?.[i]; closeCmd(); it?.go(); }

// ------------------------------------------------------------ render
async function render() {
  top();
  const v = view();
  const main = $('#main');
  if (v !== 'live') { dropGrids(); S.map = null; }
  if (v === 'schedule') {
    S.sched = await stateFor(S.day); S.stale = false;
    main.innerHTML = schedulePage();
    grid($('#g-sched'), 'sched', {
      rowData: schedRows(), columnDefs: schedColumns(), rowHeight: 56,
      rowClassRules: { 't-grid-selected': p => p.data?.id === S.drawer },
      onRowClicked: e => { if (!e.event?.target?.closest?.('a,button,input,select')) openTrip(e.data.id); },
      onCellKeyDown: e => { if (e.event?.key === 'Enter') openTrip(e.data.id); },
      onGridReady: e => e.api.setGridAriaProperty('label', 'סידור הסעות'),
    });
    paintSchedule();
    return;
  }
  if (v === 'fleet') { main.innerHTML = fleetPage(); mountFleet(); return; }
  if (!$('#map') || S.phoneChanged) {
    main.innerHTML = livePage();
    S.phoneChanged = false;
    renderSide();
    const config = await fetch('/api/workspace/config').then(r => r.json()).catch(() => ({}));
    S.map = await mountTransportMap($('#map'), { config, onSelect: id => select(id) }).catch(e => (toast(e.message, { bad: true }), null));
  } else renderSide();
  S.map?.update?.(S.data, S.selected);
}
async function refresh() {
  try { S.data = await stateFor(TODAY); } catch (e) { toast(e.message, { bad: true }); return; }
  topTick();
  const v = view();
  if (v === 'live') { if ($('#map')) { renderSide(); S.map?.update?.(S.data, S.selected); } else await render(); return; }
  if (v === 'schedule' && S.grids.sched) {
    if (S.day !== TODAY) return;
    if (S.dirty) { S.stale = true; const el = $('#stale'); if (el && !el.innerHTML) el.innerHTML = '<div class="t-stale"><span>הסידור השתנה בינתיים.</span><button class="t-btn is-sm" data-act="reload">טעינה מחדש</button></div>'; return; }
    S.sched = S.data; paintSchedule(); return;
  }
  if (v === 'fleet' && S.grids.drivers) { if (!document.activeElement?.matches?.('.t-date')) paintFleet(); return; }
  await render();
}

// ------------------------------------------------------------ events
document.addEventListener('click', e => {
  if (S.pop && !e.target.closest('.t-pop-wrap')) { S.pop = false; S.confirmReset = false; top(); }
  const call = e.target.closest('[data-call]');
  if (call) { e.preventDefault(); const [name, phone] = call.dataset.call.split('|'); toast(`חיוג ל${name} · ${phone} (בהדגמה אין חיוג)`); return; }
  const ci = e.target.closest('[data-ci]');
  if (ci) { pickCmd(Number(ci.dataset.ci)); return; }
  const el = e.target.closest('[data-act],[data-trip],[data-alert],[data-day],[data-dir],[data-facet],[data-ack],[data-unack],[data-expand],[data-tab]');
  if (!el) return;
  const d = S.data;
  const trip = d?.trips.find(t => t.id === S.selected);
  if (el.dataset.trip) { select(el.dataset.trip); return; }
  if (el.dataset.expand) { S.expand[el.dataset.expand] = !S.expand[el.dataset.expand]; renderSide(); return; }
  if (el.dataset.tab) { S.tab = el.dataset.tab; renderSide(); return; }
  if (el.dataset.ack) {
    const alertId = el.dataset.ack;
    command('ack', { alertId }).then(() => toast('סומן כטופל', { undo: () => run(() => command('unack', { alertId }), 'הוחזר לטיפול') })).catch(err => toast(err.message, { bad: true }));
    return;
  }
  if (el.dataset.unack) { run(() => command('unack', { alertId: el.dataset.unack }), 'הוחזר לטיפול'); return; }
  if (el.dataset.alert) {
    const a = d.alerts.find(x => x.id === el.dataset.alert);
    if (!a) return;
    if (a.kind === 'fleet') { S.flash = a.entityId; location.hash = '#/fleet'; return; }
    if (a.queue === 'prep') { const t = d.trips.find(x => x.id === a.tripId); S.day = TODAY; S.dir = t?.direction ?? 'morning'; S.drawer = a.tripId; S.dirty = false; location.hash = '#/schedule'; return; }
    select(a.tripId); return;
  }
  if (el.dataset.day) { if (S.dirty && !confirm('לצאת בלי לשמור את השינויים?')) return; S.day = el.dataset.day; S.drawer = null; S.dirty = false; render(); return; }
  if (el.dataset.dir) { S.dir = el.dataset.dir; document.querySelectorAll('[data-dir]').forEach(b => b.setAttribute('aria-pressed', b.dataset.dir === S.dir)); paintSchedule(); return; }
  if (el.dataset.facet) { const k = el.dataset.facet; S.facet.has(k) ? S.facet.delete(k) : S.facet.add(k); paintSchedule(); return; }
  const act = el.dataset.act;
  if (act === 'cmd') openCmd();
  if (act === 'cmd-close' && e.target === el) closeCmd();
  if (act === 'pop') { S.pop = !S.pop; S.confirmReset = false; top(); }
  if (act === 'back') select(null);
  if (act === 'play') { S.playing = !S.playing; tick(); top(); }
  if (act === 'plus5') run(() => command('clock', { time: hhmm(minutes(d.clock) + 5) }));
  if (act === 'phone') { S.phone = !S.phone; S.phoneChanged = true; S.pop = false; render(); }
  if (act === 'offline') {
    S.offline = !S.offline;
    el.setAttribute('aria-checked', S.offline);
    $('.t-phone')?.classList.toggle('is-offline', S.offline);
    $('#phone')?.contentWindow?.postMessage({ offline: S.offline }, location.origin);
    toast(S.offline ? 'הטלפון ללא קליטה' : 'הקליטה חזרה');
  }
  if (act === 'reset') {
    if (!S.confirmReset) { S.confirmReset = true; top(); return; }
    S.selected = null; S.playing = false; S.confirmReset = false; S.pop = false; S.expand = {};
    run(() => command('reset'), 'ההדגמה אופסה ל־07:05').then(() => { S.phoneChanged = true; render(); });
  }
  if (act === 'compose') { S.composing = !S.composing; renderSide(); if (S.composing) $('#note-text')?.focus(); }
  if (act === 'to-schedule' && trip) { S.day = TODAY; S.dir = trip.direction; S.drawer = trip.id; S.dirty = false; location.hash = '#/schedule'; }
  const t = S.sched?.trips.find(x => x.id === S.drawer);
  if (act === 'clear-facets') { S.facet.clear(); paintSchedule(); }
  if (act === 'close-drawer') { if (S.dirty && !confirm('לצאת בלי לשמור את השינויים?')) return; S.drawer = null; S.dirty = false; paintInspector(); S.grids.sched?.redrawRows(); }
  if (act === 'reload') { S.dirty = false; S.stale = false; reloadSchedule(); }
  if (act === 'save-publish' && t) run(() => saveTrip(t, true), 'נשמר ופורסם לנהג');
  if (act === 'save-draft' && t) run(() => saveTrip(t, false), 'נשמר כטיוטה. הנהג לא רואה עד הפרסום.');
});
document.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'note') return;
  e.preventDefault();
  const trip = S.data.trips.find(t => t.id === S.selected);
  const text = $('#note-text').value.trim();
  if (!trip || !text) return;
  run(async () => { await command('note', { text }, trip); S.composing = false; S.draft = ''; await refresh(); }, `ההודעה נשלחה ל${trip.driverName}`);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'note-text') S.draft = el.value;
  if (el.id === 'q') { S.q = el.value; paintSchedule(); }
  if (el.id === 'cmd-q') { S.cmd.q = el.value; S.cmd.i = 0; drawCmd(); }
  if (el.closest('.t-drawer') && (el.matches('select,input'))) { S.dirty = true; const b = $('#save-publish'); if (b) { b.disabled = false; b.textContent = 'שמירה ופרסום לנהג'; } const dr = $('[data-act=save-draft]'); if (dr) dr.disabled = false; }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'viewer') { S.viewer = el.value; store.set('t-viewer', S.viewer); refresh().then(top); }
  if (el.dataset.act === 'driver') { S.driver = el.value; S.phoneChanged = true; render(); }
  if (el.dataset.fleet) run(() => command('fleet', { kind: el.dataset.fleet, entityId: el.dataset.id, [el.dataset.field]: el.value }), 'התוקף עודכן');
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
  if (e.key === '/' && !typing) { e.preventDefault(); openCmd(); return; }
  if (e.key === 'Escape') {
    if (S.pop) { S.pop = false; top(); return; }
    if (S.composing) { S.composing = false; renderSide(); return; }
    if (view() === 'live' && S.selected) select(null);
  }
});
window.addEventListener('hashchange', () => { if (view() !== 'fleet') S.flash = null; render(); });

function tick() {
  clearInterval(tick.t);
  if (!S.playing) return;
  tick.t = setInterval(() => {
    const m = minutes(S.data.clock);
    if (m >= 9 * 60) { S.playing = false; clearInterval(tick.t); topTick(); top(); return; }
    command('clock', { time: hhmm(m + 1) }).catch(() => {});
  }, 2000);
}
function listen() {
  const es = new EventSource(`/api/transport/events?date=${TODAY}&viewer=${S.viewer}`);
  es.onmessage = () => refresh();
  es.onerror = () => { es.close(); setTimeout(listen, 3000); };
}

S.data = await stateFor(TODAY);
await render();
listen();
