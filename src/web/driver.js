// Driver app: today's trips, then one stop per screen. A single deliberate slide
// confirms "the bus is stopped" and reports; nothing else sends `stationary`.
// Without reception, reports wait on the device and go out in order later.
const params = new URLSearchParams(location.search);
const ME = params.get('d') || 'driver-10';
const DATE = params.get('date') || '2026-11-08';
const QUEUE_KEY = `t-queue-${ME}-${DATE}`;
const SEEN_KEY = `t-seen-${ME}`;
const DISPATCH_PHONE = '04-0000000'; // demo number for the transport desk
if (params.has('frame') || window.top !== window) document.body.dataset.frame = '';
const THEMES = ['royal', 'paper', 'flame', 'navy'];
const setTheme = t => { if (THEMES.includes(t)) document.documentElement.dataset.theme = t; };
setTheme(params.get('theme') ?? (() => { try { return localStorage.getItem('t-theme'); } catch { return null; } })());

const S = { data: null, tab: 'today', trip: null, count: null, sheet: null, delay: null, offline: false, busy: false, toast: null };

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const queue = () => read(QUEUE_KEY, '[]');
// One slide queues a report and a departure; the driver made one report.
const pendingReports = () => queue().filter(c => c.type === 'report' || c.type === 'delay' || (c.type === 'start' && c.data?.count != null)).length;
const minutes = t => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : 0);
const svg = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  back: svg('<path d="m9 6 6 6-6 6"/>'),
  chev: svg('<path d="m15 6-6 6 6 6"/>', 'class="i m-chev"'),
  more: svg('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  go: svg('<path d="m10 6-6 6 6 6M4 12h16"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  bus: svg('<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/>'),
  today: svg('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  chat: svg('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  nav: svg('<path d="m4 11 16-7-7 16-2-7-7-2Z"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
  noSignal: svg('<path d="M4 20h1M9 20v-4M14 20v-8M19 20V8M3 3l18 18"/>'),
  saved: svg('<path d="M12 4v10m0 0-4-4m4 4 4-4M5 18h14"/>'),
};

// ------------------------------------------------------------ data and commands
async function api(path, opts = {}) {
  if (S.offline) throw Object.assign(new Error('offline'), { network: true });
  let r;
  try { r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', 'x-transport-viewer': ME } }); }
  catch { throw Object.assign(new Error('offline'), { network: true }); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'הדיווח לא נשמר');
  return body;
}
const load = async () => { S.data = await api(`/api/transport/state?date=${DATE}`); };
const tripById = id => S.data?.trips.find(t => t.id === id);
function nextPoint(t) {
  const pts = t.direction === 'morning' ? t.points : t.points.filter(p => p.kind === 'stop');
  return pts.find(p => !t.departures.includes(p.id)) ?? null;
}
/** Sends one command. `stationary` is only ever set by the slide gesture. */
async function send(type, data, tripId, stationary) {
  const t = tripById(tripId);
  const body = { id: crypto.randomUUID(), type, date: DATE, tripId, version: t.version, data: stationary ? { ...data, stationary: true } : data };
  try {
    const r = await api('/api/transport/commands', { method: 'POST', body: JSON.stringify(body) });
    S.data = r.state;
    return 'sent';
  } catch (e) {
    if (!e.network) throw e;
    write(QUEUE_KEY, [...queue(), { id: body.id, type, tripId, data: body.data }]);
    mirror(t, type, data);
    return 'saved';
  }
}
function mirror(t, type, data) {
  if (type === 'start') { t.phase = 'active'; if (t.direction === 'afternoon') { t.boarded = data.count; t.onBoard = data.count; } }
  if (type === 'report') {
    t.reports[data.stopId] = { count: data.count, source: 'driver', expected: t.points.find(p => p.id === data.stopId)?.planned };
    if (data.stopId === 'school' || t.direction === 'afternoon') t.onBoard -= data.count; else { t.onBoard += data.count; t.boarded = (t.boarded || 0) + data.count; }
  }
  if (type === 'depart') { t.departures.push(data.stopId); if (!nextPoint(t)) t.phase = 'completed'; }
  if (type === 'delay') t.delayMinutes = data.minutes;
  t.version++;
}
async function flush() {
  const q = queue();
  if (!q.length || S.offline) return;
  try {
    const fresh = await api(`/api/transport/state?date=${DATE}`);
    const versions = Object.fromEntries(fresh.trips.map(t => [t.id, t.version]));
    for (const c of q) {
      const r = await api('/api/transport/commands', { method: 'POST', body: JSON.stringify({ id: c.id, type: c.type, date: DATE, tripId: c.tripId, version: versions[c.tripId], data: c.data }) });
      versions[c.tripId] = r.state.trips.find(t => t.id === c.tripId)?.version ?? versions[c.tripId];
      write(QUEUE_KEY, queue().filter(x => x.id !== c.id));
      S.data = r.state;
    }
    toast('הדיווחים שנשמרו נשלחו לסדרן');
  } catch (e) { if (!e.network) toast(e.message, 'bad'); }
}
function toast(text, kind = '') {
  S.toast = { text, kind };
  render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { S.toast = null; render(); }, 2400);
}

// ------------------------------------------------------------ screens
const notes = () => (S.data?.trips ?? []).flatMap(t => (t.notes ?? []).map(n => ({ ...n, trip: t }))).sort((a, b) => (a.at < b.at ? 1 : -1));
const unread = () => { const seen = new Set(read(SEEN_KEY, '[]')); return notes().filter(n => !seen.has(n.id)).length; };
function netBanner() {
  const q = pendingReports();
  if (!S.offline && !queue().length) return '';
  return `<div class="m-net" role="status">${S.offline ? I.noSignal : I.saved}<span>${S.offline ? 'אין קליטה. ' : ''}${q ? `${q === 1 ? 'דיווח אחד שמור' : `${q} דיווחים שמורים`} במכשיר ויישלח${q === 1 ? '' : 'ו'} כשתחזור קליטה` : 'דיווחים יישמרו במכשיר'}</span></div>`;
}
function tabs() {
  const n = unread();
  return `<nav class="m-tabs" aria-label="ניווט">
    <button class="m-tab" data-tab="today" ${S.tab === 'today' ? 'aria-current="page"' : ''}>${I.today}היום</button>
    <button class="m-tab" data-tab="messages" ${S.tab === 'messages' ? 'aria-current="page"' : ''}>${I.chat}הודעות${n ? `<span class="m-badge">${n}</span>` : ''}</button>
  </nav>`;
}
function todayScreen() {
  const d = S.data;
  const me = d.drivers?.[0];
  const trips = [...d.trips].sort((a, b) => a.departure.localeCompare(b.departure));
  const clock = minutes(d.clock);
  const now = trips.find(t => t.phase === 'active') ?? trips.find(t => t.phase === 'pending' && minutes(t.departure) >= clock - 45);
  const later = trips.filter(t => t !== now && t.phase === 'pending');
  const done = trips.filter(t => t.phase === 'completed');
  const cell = t => `<button class="m-cell ${t.phase === 'completed' ? 'is-done' : ''}" data-open="${t.id}">
      <span class="m-time num">${esc(t.departure)}</span>
      <span><b>${esc(t.school)}</b><small>${t.direction === 'morning' ? 'איסוף' : 'פיזור'} · ${t.stops.length} תחנות · ${t.planned} תלמידים</small></span>
      ${t.phase === 'completed' ? `<span class="m-check">${I.check}</span>` : I.chev}
    </button>`;
  return `<header class="m-nav"><div class="m-nav-row"><span></span><a class="m-nav-btn" href="tel:${DISPATCH_PHONE}" aria-label="התקשרות למוקד ההסעות">${I.phone}</a></div>
      <h1 class="m-large">בוקר טוב, ${esc(me?.name.split(' ')[0] ?? '')}</h1><p class="m-sub">יום ${esc(d.weekday)} · ${esc(d.clock)}</p></header>
    ${netBanner()}
    <main class="m-scroll">
      ${now ? `<button class="m-now" data-open="${now.id}">
          <small>${now.phase === 'active' ? 'בדרך עכשיו' : 'הנסיעה הבאה'}</small>
          <span class="m-now-time num">${esc(now.departure)}</span>
          <b>${esc(now.school)}</b>
          <small>${now.direction === 'morning' ? 'איסוף' : 'פיזור'} · ${now.stops.length} תחנות · ${now.planned} תלמידים</small>
          <span class="m-now-go">${now.phase === 'active' ? 'המשך הנסיעה' : 'לנסיעה'} ${I.go}</span>
        </button>` : `<div class="m-empty">${I.check}<div>אין נסיעות נוספות היום</div></div>`}
      ${later.length ? `<section class="m-section"><h2>בהמשך היום</h2><div class="m-group">${later.map(cell).join('')}</div></section>` : ''}
      ${done.length ? `<section class="m-section"><h2>הושלמו</h2><div class="m-group">${done.map(cell).join('')}</div></section>` : ''}
    </main>${tabs()}`;
}
function messagesScreen() {
  const list = notes();
  write(SEEN_KEY, list.map(n => n.id));
  return `<header class="m-nav"><div class="m-nav-row"></div><h1 class="m-large">הודעות</h1><p class="m-sub">מהסדרנים</p></header>
    <main class="m-scroll"><section class="m-section">${list.length ? list.map(n => `<div class="m-msg"><small>${esc(n.actor)} · ${esc(n.trip.number)} · ${new Date(n.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</small>${esc(n.text)}</div>`).join('') : `<div class="m-empty">${I.chat}<div>אין הודעות</div></div>`}</section></main>${tabs()}`;
}
function slider(label) {
  return `<div class="m-slide ${S.busy ? 'is-busy' : ''}" data-slide>
      <span class="m-slide-fill"></span><span class="m-slide-label">${esc(label)}</span>
      <span class="m-slide-knob" role="button" tabindex="0" aria-label="${esc(label)}">${I.go}</span>
    </div>`;
}
function tripScreen(t) {
  const pts = t.direction === 'morning' ? t.points : t.points.filter(p => p.kind === 'stop');
  const next = nextPoint(t);
  const nav = `<header class="m-nav"><div class="m-nav-row">
      <button class="m-nav-back" data-back>${I.back}היום</button>
      <span class="m-nav-title">${esc(t.number)} · ${esc(t.school)}</span>
      <button class="m-nav-btn" data-sheet="more" aria-label="פעולות נוספות">${I.more}</button>
    </div></header>`;
  if (t.phase === 'completed') {
    const planned = t.points.filter(p => p.kind === 'stop').reduce((s, p) => s + (p.planned || 0), 0);
    const carried = t.boarded ?? 0;
    return `${nav}${netBanner()}<main class="m-scroll"><div class="m-finish">
        <div class="m-ring">${I.check}</div><h1>הנסיעה הושלמה</h1>
        <p><span class="num">${carried}</span> תלמידים הוסעו ל${esc(t.school)}</p>
        ${carried !== planned && t.direction === 'morning' ? `<p class="m-off">${planned - carried > 0 ? `${planned - carried} פחות מהתכנון` : `${carried - planned} יותר מהתכנון`} · ${queue().length ? 'הסדרן יעודכן כשתחזור קליטה' : 'הסדרן עודכן'}</p>` : ''}
      </div></main>
      <div class="m-dock"><button class="m-cancel" data-back style="margin:0;background:var(--m-accent);color:#fff">חזרה להיום</button></div>`;
  }
  const atSchoolStart = t.phase === 'pending' && t.direction === 'afternoon';
  const target = atSchoolStart ? { id: 'start', name: t.school, time: t.departure, kind: 'school' } : next;
  const dropping = target.kind === 'school' && !atSchoolStart || t.direction === 'afternoon' && !atSchoolStart;
  const expected = atSchoolStart ? t.planned : target.kind === 'school' ? (t.onBoard ?? 0) : target.planned ?? 0;
  if (S.count == null) S.count = expected;
  const off = S.count !== expected;
  const kind = atSchoolStart ? 'עלייה בבית הספר' : target.kind === 'school' ? 'הגעה לבית הספר' : dropping ? 'תחנת פיזור' : t.phase === 'pending' ? 'תחנה ראשונה' : 'תחנת איסוף';
  const verb = atSchoolStart || !dropping ? 'עלו' : 'ירדו';
  const label = atSchoolStart ? `עלו ${S.count} · יציאה לפיזור` : target.kind === 'school' ? `ירדו ${S.count} · סיום הנסיעה` : `${verb} ${S.count} · יציאה מהתחנה`;
  const index = pts.findIndex(p => p.id === target.id);
  return `${nav}
    <div class="m-steps" aria-label="התקדמות">${pts.map((p, i) => `<i class="${t.departures.includes(p.id) ? 'is-done' : i === index ? 'is-now' : ''}"></i>`).join('')}</div>
    ${netBanner()}
    <main class="m-scroll m-screen-in">
      <div class="m-stop"><span class="m-kind">${kind}</span><h1>${esc(target.name)}</h1><p class="num">${esc(target.time ?? '')}${t.onBoard ? ` · ${t.onBoard} ברכב` : ''}</p></div>
      <div class="m-count">
        <button data-step="1" aria-label="הוספת תלמיד">${I.plus}</button>
        <output class="num ${off ? 'is-off' : ''}" aria-live="polite" aria-label="${verb} ${S.count}">${S.count}</output>
        <button data-step="-1" aria-label="הפחתת תלמיד">${I.minus}</button>
      </div>
      <p class="m-expected ${off ? 'is-off' : ''}">${verb === 'עלו' ? 'צפויים לעלות' : 'צפויים לרדת'} <b class="num">${expected}</b>${off ? ` · ${S.count < expected ? expected - S.count + ' פחות' : S.count - expected + ' יותר'}` : ''}</p>
    </main>
    <div class="m-dock">${slider(label)}<p class="m-dock-note">מחליקים רק כשהרכב עומד</p></div>`;
}
function sheet(t) {
  if (!S.sheet) return '';
  const next = t && nextPoint(t);
  if (S.sheet === 'more') {
    const ll = next?.lat != null ? `${next.lat},${next.lng}` : null;
    return `<div class="m-scrim" data-close></div><div class="m-sheet" role="dialog" aria-label="פעולות"><div class="m-grabber"></div>
      <div class="m-group">
        <button class="m-action" data-sheet="delay">${I.clock}דיווח על איחור</button>
        ${ll ? `<a class="m-action" href="https://waze.com/ul?ll=${ll}&navigate=yes" target="_blank" rel="noopener">${I.nav}ניווט לתחנה ב־Waze</a>
        <a class="m-action" href="https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving" target="_blank" rel="noopener">${I.nav}ניווט לתחנה ב־Google Maps</a>` : ''}
        <a class="m-action" href="tel:${DISPATCH_PHONE}">${I.phone}התקשרות למוקד ההסעות</a>
      </div><button class="m-cancel" data-close>ביטול</button></div>`;
  }
  if (S.sheet === 'delay') {
    return `<div class="m-scrim" data-close></div><div class="m-sheet" role="dialog" aria-label="דיווח על איחור"><div class="m-grabber"></div>
      <h3>כמה דקות איחור?</h3>
      <div class="m-chips">${[5, 10, 15, 20].map(m => `<button data-minutes="${m}" aria-pressed="${S.delay === m}">${m}</button>`).join('')}</div>
      ${S.delay ? slider(`איחור של ${S.delay} דק׳ · דיווח`) : ''}
      <button class="m-cancel" data-close>ביטול</button></div>`;
  }
  return '';
}
function render() {
  const t = S.trip && tripById(S.trip);
  const screen = t ? tripScreen(t) : S.tab === 'messages' ? messagesScreen() : todayScreen();
  const toastHtml = S.toast ? `<div class="m-toast ${S.toast.kind === 'saved' ? 'is-saved' : S.toast.kind === 'bad' ? 'is-bad' : ''}" role="status">${S.toast.kind === 'saved' ? I.saved : S.toast.kind === 'bad' ? I.noSignal : I.check}<span>${esc(S.toast.text)}</span></div>` : '';
  document.getElementById('app').innerHTML = `<div class="m-app">${screen}${sheet(t)}${toastHtml}</div>`;
  bindSlides();
}

// ------------------------------------------------------------ actions
async function confirmSlide() {
  const t = tripById(S.trip);
  if (!t || S.busy) return;
  S.busy = true;
  let result = 'sent';
  try {
    if (S.sheet === 'delay') {
      result = await send('delay', { minutes: S.delay }, t.id, true);
      S.sheet = null; S.delay = null;
      navigator.vibrate?.(30);
      toast(result === 'saved' ? 'נשמר במכשיר · יישלח כשתחזור קליטה' : 'האיחור נשלח לסדרן', result);
    } else {
      const count = S.count;
      if (t.phase === 'pending' && t.direction === 'afternoon') result = await send('start', { count }, t.id, true);
      else {
        if (t.phase === 'pending') await send('start', {}, t.id, true);
        const next = nextPoint(tripById(t.id));
        await send('report', { stopId: next.id, count }, t.id, true);
        result = await send('depart', { stopId: next.id }, t.id, true);
      }
      S.count = null;
      navigator.vibrate?.(30);
      toast(result === 'saved' ? 'נשמר במכשיר · יישלח כשתחזור קליטה' : 'נשלח לסדרן', result);
    }
  } catch (e) { toast(e.message, 'bad'); }
  S.busy = false;
  render();
}
function bindSlides() {
  document.querySelectorAll('[data-slide]').forEach(track => {
    const knob = track.querySelector('.m-slide-knob');
    const fill = track.querySelector('.m-slide-fill');
    const labelEl = track.querySelector('.m-slide-label');
    const rtl = getComputedStyle(track).direction === 'rtl';
    let start = null, max = 0;
    const set = p => {
      const px = p * max;
      knob.style.transform = `translateX(${rtl ? -px : px}px)`;
      fill.style.width = `${64 + px}px`;
      labelEl.style.opacity = String(1 - p * 1.4);
    };
    knob.addEventListener('pointerdown', e => { start = e.clientX; max = track.clientWidth - 64; try { knob.setPointerCapture(e.pointerId); } catch {} });
    knob.addEventListener('pointermove', e => { if (start == null) return; set(Math.min(1, Math.max(0, (rtl ? start - e.clientX : e.clientX - start) / max))); });
    const end = e => {
      if (start == null) return;
      const p = Math.min(1, Math.max(0, (rtl ? start - e.clientX : e.clientX - start) / max));
      start = null;
      if (p > 0.85) { set(1); track.classList.add('is-done'); confirmSlide(); }
      else { knob.style.transition = 'transform .25s cubic-bezier(.16,1,.3,1)'; set(0); setTimeout(() => (knob.style.transition = ''), 260); }
    };
    knob.addEventListener('pointerup', end);
    knob.addEventListener('pointercancel', end);
    // Keyboard and switch access: a deliberate key press on the focused control.
    knob.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(1); confirmSlide(); } });
  });
}
document.addEventListener('click', e => {
  const el = e.target.closest('button,[data-close]');
  if (!el) return;
  if (el.dataset.open) { S.trip = el.dataset.open; S.count = null; S.sheet = null; render(); window.scrollTo(0, 0); return; }
  if ('back' in el.dataset) { S.trip = null; S.sheet = null; render(); return; }
  if (el.dataset.tab) { S.tab = el.dataset.tab; render(); return; }
  if (el.dataset.step) { S.count = Math.max(0, (S.count ?? 0) + Number(el.dataset.step)); navigator.vibrate?.(8); render(); return; }
  if (el.dataset.sheet) { S.sheet = el.dataset.sheet; S.delay = null; render(); return; }
  if ('close' in el.dataset) { S.sheet = null; S.delay = null; render(); return; }
  if (el.dataset.minutes) { S.delay = Number(el.dataset.minutes); render(); }
});
window.addEventListener('message', e => {
  if (e.origin !== location.origin) return;
  if (typeof e.data?.theme === 'string') setTheme(e.data.theme);
  if (typeof e.data?.offline !== 'boolean') return;
  S.offline = e.data.offline; render(); if (!S.offline) flush();
});
window.addEventListener('online', flush);
setInterval(flush, 5000);

try { await load(); } catch (e) { S.data = { trips: [], drivers: [], weekday: '', clock: '' }; toast(e.network ? 'אין קליטה' : e.message, 'bad'); }
render();
const es = new EventSource(`/api/transport/events?date=${DATE}&viewer=${ME}`);
es.onmessage = async () => { if (S.offline || queue().length || S.busy) return; try { await load(); render(); } catch {} };
