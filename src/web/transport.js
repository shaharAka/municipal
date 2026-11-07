// Dispatcher control center: what is moving now, the day's schedule, and the fleet.
import { mountTransportMap } from './transport-map.js';

const DAYS = [
  { label: 'ראשון', date: '2026-11-08' }, { label: 'שני', date: '2026-11-09' }, { label: 'שלישי', date: '2026-11-10' },
  { label: 'רביעי', date: '2026-11-11' }, { label: 'חמישי', date: '2026-11-12' }, { label: 'שישי', date: '2026-11-13' },
];
const DISPATCHERS = [{ id: 'shuki', name: 'שוקי' }, { id: 'inbal', name: 'ענבל' }];
const TODAY = DAYS[0].date;
const S = {
  viewer: localStorage.getItem('t-viewer') || 'shuki', data: null, selected: null, phone: true, playing: false,
  day: TODAY, dir: 'morning', sched: null, drawer: null, flash: null, offline: false, driver: 'driver-10', map: null,
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = s => document.querySelector(s);
const num = n => (n == null ? '—' : Number(n).toLocaleString('he-IL'));
const heDate = iso => iso.split('-').reverse().slice(0, 2).map(Number).join('.');
const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  bus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6"/></svg>',
};
const STATUS = { upcoming: ['טרם יצאה', ''], late: ['לא יצאה', 'is-bad'], active: ['בדרך', 'is-active'], delayed: ['מאחרת', 'is-bad'], completed: ['הושלמה', 'is-ok'] };
const chip = status => { const [t, c] = STATUS[status] ?? STATUS.upcoming; return `<span class="t-chip ${c}">${t}</span>`; };

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', 'x-transport-viewer': S.viewer, ...(opts.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'הפעולה נכשלה');
  return body;
}
const stateFor = date => api(`/api/transport/state?date=${date}`);
async function command(type, data = {}, trip = null, date = TODAY) {
  return api('/api/transport/commands', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), type, date, tripId: trip?.id, version: trip?.version, data }) });
}
function toast(text, bad = false) {
  const el = $('#toast');
  el.innerHTML = `<div class="t-toast${bad ? ' is-bad' : ''}">${esc(text)}</div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.innerHTML = ''), 2600);
}
async function run(fn, ok) {
  try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, true); }
}

const view = () => (location.hash.replace('#/', '') || 'live').split('?')[0];

// ------------------------------------------------------------ top bar
function top() {
  const d = S.data;
  const fleetCount = d ? d.alerts.filter(a => a.kind === 'fleet' && a.level === 'high').length : 0;
  const v = view();
  $('#top').innerHTML = `
    <div class="t-brand"><span class="t-mark">${ICON.bus}</span><b>מערך ההסעות</b><span>מועצה אזורית גולן</span></div>
    <nav class="t-nav" aria-label="ניווט">
      <a href="#/live" ${v === 'live' ? 'aria-current="page"' : ''}>עכשיו</a>
      <a href="#/schedule" ${v === 'schedule' ? 'aria-current="page"' : ''}>סידור</a>
      <a href="#/fleet" ${v === 'fleet' ? 'aria-current="page"' : ''}>צי ונהגים${fleetCount ? `<span class="t-count">${fleetCount}</span>` : ''}</a>
    </nav>
    <div class="t-spacer"></div>
    <div class="t-clock" aria-label="שעון ההדגמה">
      <span class="t-day">יום ${esc(d?.weekday ?? 'ראשון')} ${heDate(TODAY)}</span>
      <span class="t-time num">${esc(d?.clock ?? '')}</span>
      <button class="t-icon-btn" data-act="play" aria-pressed="${S.playing}" title="${S.playing ? 'עצירת השעון' : 'הרצת השעון'}" aria-label="${S.playing ? 'עצירת השעון' : 'הרצת השעון'}">${S.playing ? ICON.pause : ICON.play}</button>
      <button class="t-btn" data-act="plus5" title="קידום השעון ב־5 דקות">+5 דק׳</button>
    </div>
    <button class="t-btn" data-act="phone" aria-pressed="${S.phone}">${ICON.phone} אפליקציית נהג</button>
    <select class="t-select" data-act="viewer" aria-label="סדרן">${DISPATCHERS.map(p => `<option value="${p.id}" ${p.id === S.viewer ? 'selected' : ''}>${p.name} · סדרן</option>`).join('')}</select>
    <button class="t-icon-btn" data-act="reset" title="איפוס ההדגמה" aria-label="איפוס ההדגמה">${ICON.reset}</button>`;
}

// ------------------------------------------------------------ live
function kpis(trips) {
  const moving = trips.filter(t => t.status === 'active' || t.status === 'delayed');
  const late = trips.filter(t => t.status === 'late' || t.status === 'delayed');
  const done = trips.filter(t => t.status === 'completed');
  const counted = [...moving, ...done].filter(t => t.direction === 'morning');
  const reported = counted.reduce((s, t) => s + (t.live.boarded || 0), 0);
  const planned = counted.reduce((s, t) => s + t.points.filter((p, i) => p.kind === 'stop' && i <= t.live.departedIndex).reduce((a, p) => a + (p.planned || 0), 0), 0);
  return `<div class="t-kpis">
    <div class="t-kpi"><b class="num">${num(moving.length)}</b><span>בדרך</span></div>
    <div class="t-kpi ${late.length ? 'is-bad' : ''}"><b class="num">${num(late.length)}</b><span>מאחרות</span></div>
    <div class="t-kpi"><b class="num">${num(done.length)}</b><span>הושלמו</span></div>
    <div class="t-kpi ${reported !== planned ? 'is-bad' : ''}"><b class="num">${num(reported)}</b><span>תלמידים עלו${reported !== planned ? ` · ${num(planned - reported)} חסרים` : ''}</span></div>
  </div>`;
}
const tripRow = t => {
  const next = t.points[t.live.departedIndex + 1];
  const where = t.status === 'completed' ? 'הגיעה' : t.live.phase === 'pending' ? `יוצאת ${t.departure}` : next ? `לקראת ${next.name}` : '';
  const figure = t.live.boarded != null ? `<b class="num">${num(t.live.boarded)}</b> <span class="t-sub">מתוך ${num(t.planned)}</span>` : `<b class="num">${num(t.planned)}</b> <span class="t-sub">תלמידים</span>`;
  return `<button class="t-row ${t.id === S.selected ? 'is-selected' : ''}" data-trip="${t.id}">
    <span class="t-code">${esc(t.routeCode)}</span>
    <span><b>${esc(t.school)}</b><span class="t-sub">${esc(where)}${t.live.lateMinutes ? ` · ${t.live.lateMinutes} דק׳ איחור` : ''}${t.live.mode === 'manual' ? ' · דיווח נהג' : ''}</span></span>
    <span class="t-figure">${figure}<br>${chip(t.status)}</span>
  </button>`;
};
function sidePanel() {
  const d = S.data;
  const trip = d.trips.find(t => t.id === S.selected);
  if (trip) return detail(trip);
  const now = minutes(d.clock);
  const moving = d.trips.filter(t => ['active', 'delayed', 'late'].includes(t.status) || (t.live.mode === 'manual' && t.status !== 'completed' && minutes(t.departure) - now <= 60))
    .sort((a, b) => b.live.lateMinutes - a.live.lateMinutes || a.departure.localeCompare(b.departure));
  const soon = d.trips.filter(t => t.status === 'upcoming' && !moving.includes(t) && minutes(t.departure) - now <= 45);
  const alerts = d.alerts;
  return `${kpis(d.trips)}
    <section class="t-section"><h2>דורש טיפול <span>${num(alerts.length)}</span></h2>
      ${alerts.slice(0, 6).map(a => `<button class="t-alert is-${a.level}" data-alert="${esc(a.id)}"><i></i><span><b>${esc(a.title)}</b><span>${esc(a.detail)}</span></span></button>`).join('') || '<p class="t-empty">אין דבר שדורש טיפול.</p>'}
    </section>
    <section class="t-section"><h2>בדרך עכשיו <span>${num(moving.length)}</span></h2>${moving.map(tripRow).join('') || '<p class="t-empty">אין נסיעות בדרך.</p>'}</section>
    <section class="t-section"><h2>יוצאות ב־45 הדקות הקרובות <span>${num(soon.length)}</span></h2>${soon.slice(0, 6).map(tripRow).join('')}</section>`;
}
function detail(t) {
  const d = t.live.departedIndex;
  const counts = t.live.stopCounts;
  const items = t.points.map((p, i) => {
    const c = counts[p.id];
    const cls = i <= d ? 'is-done' : i === d + 1 && t.live.phase !== 'pending' ? 'is-next' : '';
    const label = p.kind === 'school' ? 'בי״ס' : String(t.points.slice(0, i + 1).filter(x => x.kind === 'stop').length);
    const count = p.kind === 'school'
      ? (t.direction === 'morning' && i <= d ? `<b class="num">${num(t.live.boarded)}</b> ירדו` : '')
      : c ? `<b class="num ${c.count !== c.expected ? 'is-off' : ''}">${num(c.count)}</b> / ${num(p.planned)}<div class="t-source">${c.source === 'driver' ? 'דיווח נהג' : 'סימולציה'}</div>`
      : `<span class="num">${num(p.planned)}</span> צפויים`;
    return `<li class="${cls}"><span class="t-dot">${label}</span><span><b>${esc(p.name)}</b><small>${esc(p.time ?? '')}${p.located ? '' : ' · מיקום לא ידוע'}</small></span><span class="t-count-cell">${count}</span></li>`;
  }).join('');
  return `<div class="t-detail-head">
      <button class="t-back" data-act="back">→ כל הנסיעות</button>
      <h2><span class="t-code" style="padding:0 8px">${esc(t.routeCode)}</span>${esc(t.school)} ${chip(t.status)}</h2>
      <div class="t-meta"><span>נסיעה ${esc(t.number)} · ${t.direction === 'morning' ? 'איסוף בוקר' : 'פיזור צהריים'} · ${esc(t.departure)}</span></div>
      <div class="t-meta"><span>${esc(t.driverName)}${t.driverContact ? ` · <span class="num" dir="ltr">${esc(t.driverContact)}</span>` : ''}</span><span>${esc(t.vehicleName)} · ${t.capacity ? `${t.capacity} מקומות` : 'מקומות לא ידוע'}</span></div>
      ${t.issues.length ? `<ul class="t-issues">${t.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    </div>
    <ol class="t-timeline">${items}</ol>
    <div class="t-section"><div class="t-actions">
      <button class="t-btn" data-act="note">הודעה לנהג</button>
      <button class="t-btn" data-act="to-schedule">שיבוץ ותחנות</button>
    </div>
    ${t.notes?.length ? `<p class="t-source" style="margin-top:10px">${t.notes.map(n => `${esc(n.actor)}: ${esc(n.text)}`).join('<br>')}</p>` : ''}
    <p class="t-source" style="margin-top:10px">מיקום האוטובוס: סימולציה לפי שעון ההדגמה, לא GPS. ${t.live.mode === 'manual' ? 'הכמויות: דיווחי הנהג.' : 'הכמויות: סימולציה.'}</p></div>`;
}
function livePage() {
  return `<section class="t-live ${S.phone ? 'with-phone' : ''}">
    <aside class="t-side" id="side">${sidePanel()}</aside>
    <div class="t-map"><div class="t-map-canvas" id="map"></div>
      <div class="t-map-note"><span class="t-legend"><i style="background:var(--t-accent)"></i>בדרך</span><span class="t-legend"><i style="background:var(--t-bad)"></i>מאחרת</span><span class="t-legend"><i style="background:var(--aka-colors-neutral-400)"></i>הושלמה</span><span>מיקומים: סימולציה · אין GPS</span></div>
    </div>
    ${S.phone ? phoneDock() : ''}
  </section>`;
}
function phoneDock() {
  const drivers = S.data.drivers.filter(d => S.data.trips.some(t => t.driverId === d.id && t.published && !t.issues.length));
  return `<div class="t-phone-dock"><div>
    <div class="t-phone-tools">
      <select class="t-select" data-act="driver" aria-label="נהג">${drivers.map(d => `<option value="${d.id}" ${d.id === S.driver ? 'selected' : ''}>${esc(d.name)} · קו ${esc(d.routeCode)}</option>`).join('')}</select>
      <label><input type="checkbox" data-act="offline" ${S.offline ? 'checked' : ''}> ללא קליטה</label>
    </div>
    <div class="t-phone ${S.offline ? 'is-offline' : ''}"><div class="t-phone-screen">
      <div class="t-status" aria-hidden="true"><span class="t-status-time num">${esc(S.data.clock)}</span><span class="t-island"></span><span class="t-status-icons"><span class="t-no-service">אין שירות</span><span class="t-signal"><svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg></span><svg viewBox="0 0 27 13" aria-hidden="true"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" opacity=".4"/></svg></span></div>
      <iframe id="phone" title="אפליקציית הנהג" src="./driver.html?d=${encodeURIComponent(S.driver)}&date=${TODAY}&frame=1"></iframe>
      <span class="t-home" aria-hidden="true"></span>
    </div></div>
  </div></div>`;
}

// ------------------------------------------------------------ schedule
function schedulePage() {
  const d = S.sched;
  const trips = d.trips.filter(t => S.dir === 'all' || t.direction === S.dir).sort((a, b) => a.departure.localeCompare(b.departure));
  const t = d.trips.find(x => x.id === S.drawer);
  const status = x => (x.issues.length ? `<span class="t-chip is-warn">${esc(x.issues[0])}</span>` : x.published ? '<span class="t-chip is-ok">פורסמה לנהג</span>' : '<span class="t-chip">טיוטה</span>');
  return `<div class="t-page">
    <div class="t-page-head">
      <div><h1>סידור הסעות</h1><p>${num(d.trips.length)} נסיעות ביום ${esc(d.weekday)} · ${num(d.trips.filter(x => x.issues.length).length)} דורשות טיפול לפני פרסום</p></div>
      <div class="t-spacer"></div>
      <div class="t-seg" role="group" aria-label="יום">${DAYS.map(x => `<button data-day="${x.date}" aria-pressed="${x.date === S.day}">${x.label}</button>`).join('')}</div>
      <div class="t-seg" role="group" aria-label="כיוון">${[['morning', 'בוקר'], ['afternoon', 'צהריים'], ['all', 'הכל']].map(([k, l]) => `<button data-dir="${k}" aria-pressed="${k === S.dir}">${l}</button>`).join('')}</div>
    </div>
    <div class="t-layout ${t ? 'has-drawer' : ''}">
      <div class="t-card"><table class="t-table">
        <thead><tr><th>יציאה</th><th>קו</th><th>בית ספר</th><th class="num">תחנות</th><th class="num">תלמידים</th><th>נהג</th><th>רכב</th><th>מצב</th></tr></thead>
        <tbody>${trips.map(x => `<tr data-row="${x.id}" class="${x.id === S.drawer ? 'is-selected' : ''}">
          <td class="num">${esc(x.departure)}</td><td><span class="t-code" style="width:44px">${esc(x.routeCode)}</span></td>
          <td>${esc(x.school)}<div class="t-source">${esc(x.points.filter(p => p.kind === 'stop').map(p => p.name).join(' · '))}</div></td>
          <td class="num">${num(x.stops.length)}</td><td class="num">${num(x.planned)}</td>
          <td>${esc(x.driverName)}</td><td>${esc(x.vehicleName)}</td><td>${status(x)}</td></tr>`).join('')}</tbody>
      </table></div>
      ${t ? drawer(t, d) : ''}
    </div></div>`;
}
function drawer(t, d) {
  const editable = t.live.phase === 'pending';
  const driverOpt = dd => `<option value="${dd.id}" ${dd.id === t.driverId ? 'selected' : ''}>${esc(dd.name)}${dd.routeCode ? ` · קו ${esc(dd.routeCode)}` : ' · חלופי'}${dd.licenseUntil < S.day ? ' · רישיון פג' : ''}</option>`;
  const busOpt = v => `<option value="${v.id}" ${v.id === t.vehicleId ? 'selected' : ''}>${esc(v.label)}${v.capacity ? ` · ${v.capacity} מק׳` : ''}${v.testUntil < S.day ? ' · טסט פג' : ''}</option>`;
  return `<aside class="t-card t-drawer" aria-label="נסיעה ${esc(t.number)}">
    <h2><span>${esc(t.number)} · ${esc(t.school)}</span><button class="t-back" data-act="close-drawer">סגירה</button></h2>
    <div class="t-drawer-body">
      ${t.issues.length ? `<ul class="t-issues">${t.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<ul class="t-issues is-ok"><li>${t.published ? 'פורסמה לנהג' : 'מוכנה לפרסום'}</li></ul>`}
      <div class="t-field"><label for="f-driver">נהג</label><select id="f-driver" class="t-select" ${editable ? '' : 'disabled'}>${d.drivers.map(driverOpt).join('')}</select></div>
      <div class="t-field"><label for="f-bus">רכב</label><select id="f-bus" class="t-select" ${editable ? '' : 'disabled'}>${d.vehicles.map(busOpt).join('')}</select></div>
      <div class="t-actions">
        <button class="t-btn" data-act="assign" ${editable ? '' : 'disabled'}>שמירת שיבוץ</button>
        <button class="t-btn is-primary" data-act="publish" ${editable && !t.published ? '' : 'disabled'}>פרסום לנהג</button>
      </div>
      <div class="t-field"><label>תחנות · שעה · תלמידים</label>
        <div class="t-stops-edit">${t.stops.map((s, i) => `<div><span>${esc(s.name)}</span><input data-stop-time="${i}" value="${esc(s.time)}" aria-label="שעה ב${esc(s.name)}" ${editable ? '' : 'disabled'}><input data-stop-count="${i}" type="number" min="0" value="${esc(s.planned ?? '')}" aria-label="תלמידים ב${esc(s.name)}" ${editable ? '' : 'disabled'}></div>`).join('')}</div>
      </div>
      <button class="t-btn" data-act="save-stops" ${editable ? '' : 'disabled'}>שמירת תחנות</button>
      <p class="t-source">מקור: ${esc(t.source.sheet)} ${esc(t.source.range)}</p>
    </div></aside>`;
}

// ------------------------------------------------------------ fleet
function fleetPage() {
  const d = S.data;
  const left = iso => Math.round((Date.parse(iso) - Date.parse(TODAY)) / 86_400_000);
  const due = (iso, soon = 14) => !iso ? '<span class="t-chip">לא ידוע</span>' : left(iso) < 0 ? '<span class="t-chip is-bad">פג תוקף</span>' : left(iso) <= soon ? `<span class="t-chip is-warn">בעוד ${left(iso)} ימים</span>` : '<span class="t-chip is-ok">בתוקף</span>';
  const tripsOf = (field, id) => d.trips.filter(t => t[field] === id).length;
  const drivers = [...d.drivers].sort((a, b) => (a.licenseUntil < b.licenseUntil ? -1 : 1));
  const buses = [...d.vehicles].sort((a, b) => ((a.testUntil || '9') < (b.testUntil || '9') ? -1 : 1));
  const problems = d.alerts.filter(a => a.kind === 'fleet');
  return `<div class="t-page">
    <div class="t-page-head"><div><h1>צי ונהגים</h1><p>${num(d.drivers.length)} נהגים · ${num(d.vehicles.length)} רכבים · ${problems.length ? `${problems.length} דורשים טיפול` : 'הכל בתוקף'}</p></div></div>
    <div class="t-layout" style="grid-template-columns:1fr 1fr">
      <div class="t-card"><h2>נהגים</h2><table class="t-table">
        <thead><tr><th>נהג</th><th>רישיון</th><th>תוקף</th><th></th><th class="num">נסיעות היום</th></tr></thead>
        <tbody>${drivers.map(x => `<tr class="${S.flash === x.id ? 't-flash' : ''}"><td>${esc(x.name)}<div class="t-source">${x.routeCode ? `קו ${esc(x.routeCode)}` : 'חלופי'} · <span dir="ltr">${esc(x.contact)}</span></div></td><td>${esc(x.licenseType)}</td>
          <td><input type="date" class="t-date-input" data-fleet="driver" data-id="${x.id}" data-field="licenseUntil" value="${esc(x.licenseUntil)}" aria-label="תוקף רישיון של ${esc(x.name)}"></td><td>${due(x.licenseUntil)}</td><td class="num">${num(tripsOf('driverId', x.id))}</td></tr>`).join('')}</tbody></table></div>
      <div class="t-card"><h2>רכבים</h2><table class="t-table">
        <thead><tr><th>רכב</th><th class="num">מקומות</th><th>טסט</th><th></th><th>טיפול</th><th></th></tr></thead>
        <tbody>${buses.map(x => `<tr class="${S.flash === x.id ? 't-flash' : ''}"><td>${esc(x.label)}<div class="t-source num" dir="ltr" style="text-align:right">${esc(x.registration)}</div></td><td class="num">${x.capacity ? num(x.capacity) : 'לא ידוע'}</td>
          <td><input type="date" class="t-date-input" data-fleet="vehicle" data-id="${x.id}" data-field="testUntil" value="${esc(x.testUntil)}" aria-label="תוקף טסט ל${esc(x.label)}"></td><td>${due(x.testUntil)}</td>
          <td><input type="date" class="t-date-input" data-fleet="vehicle" data-id="${x.id}" data-field="serviceDue" value="${esc(x.serviceDue)}" aria-label="מועד טיפול ל${esc(x.label)}"></td><td>${due(x.serviceDue, 7)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <p class="t-source" style="margin-top:12px">נהגים, רכבים ותוקפים הם נתוני הדגמה: אין להם מקור בקובץ הסידור.</p></div>`;
}

// ------------------------------------------------------------ render and events
async function render() {
  top();
  const v = view();
  const main = $('#main');
  if (v === 'schedule') { S.sched = await stateFor(S.day); main.innerHTML = schedulePage(); S.map = null; return; }
  if (v === 'fleet') { main.innerHTML = fleetPage(); S.map = null; return; }
  const phoneSrc = $('#phone')?.src;
  if (!$('#map') || S.phoneChanged) {
    main.innerHTML = livePage();
    S.phoneChanged = false;
    const config = await fetch('/api/workspace/config').then(r => r.json()).catch(() => ({}));
    S.map = await mountTransportMap($('#map'), { config, onSelect: id => { S.selected = id; refresh(); } }).catch(e => (toast(e.message, true), null));
  } else {
    $('#side').innerHTML = sidePanel();
    if (phoneSrc && $('#phone') && $('#phone').src !== phoneSrc) $('#phone').src = phoneSrc;
  }
  S.map?.update?.(S.data, S.selected);
}
async function refresh() {
  try { S.data = await stateFor(TODAY); } catch (e) { toast(e.message, true); return; }
  if (view() === 'live' && $('#map')) { top(); $('#side').innerHTML = sidePanel(); S.map?.update?.(S.data, S.selected); const st = $('.t-status-time'); if (st) st.textContent = S.data.clock; }
  else await render();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-trip],[data-alert],[data-row],[data-day],[data-dir]');
  if (!el) return;
  const d = S.data;
  const trip = d?.trips.find(t => t.id === S.selected);
  if (el.dataset.trip) { S.selected = el.dataset.trip; refresh(); return; }
  if (el.dataset.alert) {
    const a = d.alerts.find(x => x.id === el.dataset.alert);
    if (a.kind === 'fleet') { S.flash = a.entityId; location.hash = '#/fleet'; return; }
    const t = d.trips.find(x => x.id === a.tripId);
    if (a.kind === 'ready' || a.kind === 'publish' || t?.live.phase === 'pending' && !t.live.position) { S.day = TODAY; S.dir = t?.direction ?? 'morning'; S.drawer = a.tripId; location.hash = '#/schedule'; return; }
    S.selected = a.tripId; refresh(); return;
  }
  if (el.dataset.row) { S.drawer = el.dataset.row; render(); return; }
  if (el.dataset.day) { S.day = el.dataset.day; S.drawer = null; render(); return; }
  if (el.dataset.dir) { S.dir = el.dataset.dir; render(); return; }
  const act = el.dataset.act;
  if (act === 'back') { S.selected = null; S.map?.overview?.(); refresh(); }
  if (act === 'play') { S.playing = !S.playing; tick(); top(); }
  if (act === 'plus5') run(() => command('clock', { time: hhmm(minutes(d.clock) + 5) }));
  if (act === 'phone') { S.phone = !S.phone; S.phoneChanged = true; render(); }
  if (act === 'reset' && confirm('לאפס את יום ההדגמה לשעה 07:05?')) { S.selected = null; S.playing = false; run(() => command('reset'), 'ההדגמה אופסה'); }
  if (act === 'note' && trip) { const text = prompt(`הודעה לנהג ${trip.driverName}`); if (text) run(() => command('note', { text }, trip), 'ההודעה נשלחה לנהג'); }
  if (act === 'to-schedule' && trip) { S.day = TODAY; S.dir = trip.direction; S.drawer = trip.id; location.hash = '#/schedule'; }
  const t = S.sched?.trips.find(x => x.id === S.drawer);
  if (act === 'close-drawer') { S.drawer = null; render(); }
  if (act === 'assign' && t) run(async () => { await command('assign', { driverId: $('#f-driver').value, vehicleId: $('#f-bus').value }, t, S.day); await render(); }, 'השיבוץ נשמר · נדרש פרסום');
  if (act === 'publish' && t) run(async () => { await command('publish', {}, t, S.day); await render(); }, 'הסידור פורסם לנהג');
  if (act === 'save-stops' && t) run(async () => {
    const stops = t.stops.map((s, i) => ({ name: s.name, time: document.querySelector(`[data-stop-time="${i}"]`).value.trim(), planned: Number(document.querySelector(`[data-stop-count="${i}"]`).value) }));
    await command('edit', { departure: stops[0]?.time && t.direction === 'morning' ? stops[0].time : t.departure, stops }, t, S.day); await render();
  }, 'התחנות נשמרו · נדרש פרסום');
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'viewer') { S.viewer = el.value; localStorage.setItem('t-viewer', S.viewer); refresh(); }
  if (el.dataset.act === 'driver') { S.driver = el.value; S.phoneChanged = true; render(); }
  if (el.dataset.act === 'offline') { S.offline = el.checked; $('.t-phone')?.classList.toggle('is-offline', S.offline); $('#phone')?.contentWindow?.postMessage({ offline: S.offline }, location.origin); toast(S.offline ? 'הטלפון ללא קליטה' : 'הקליטה חזרה'); }
  if (el.dataset.fleet) run(() => command('fleet', { kind: el.dataset.fleet, entityId: el.dataset.id, [el.dataset.field]: el.value }), 'התוקף עודכן');
});
window.addEventListener('hashchange', () => { if (view() !== 'fleet') S.flash = null; render(); });

function tick() {
  clearInterval(tick.t);
  if (!S.playing) return;
  tick.t = setInterval(() => {
    const m = minutes(S.data.clock);
    if (m >= 9 * 60) { S.playing = false; clearInterval(tick.t); top(); return; }
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
