// Driver app: today's trips, then one stop at a time. Every report needs the
// bus to be stationary; without reception, reports wait on the device and are
// sent in order when the connection returns.
const params = new URLSearchParams(location.search);
const ME = params.get('d') || 'driver-10';
const DATE = params.get('date') || '2026-11-08';
const QUEUE_KEY = `t-queue-${ME}-${DATE}`;
const S = { data: null, trip: null, count: null, safe: false, offline: false, delays: false, error: '' };

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const queue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };
const saveQueue = q => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {} };

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

// The next point to report: morning ends at the school; afternoon starts there with the start report.
function nextPoint(t) {
  const pts = t.direction === 'morning' ? t.points : t.points.filter(p => p.kind === 'stop');
  return pts.find(p => !t.departures.includes(p.id)) ?? null;
}

async function send(type, data, tripId) {
  const t = tripById(tripId);
  const body = { id: crypto.randomUUID(), type, date: DATE, tripId, version: t.version, data: { stationary: true, ...data } };
  try {
    const r = await api('/api/transport/commands', { method: 'POST', body: JSON.stringify(body) });
    S.data = r.state;
  } catch (e) {
    if (!e.network) throw e;
    saveQueue([...queue(), { id: body.id, type, tripId, data: body.data }]);
    applyLocally(t, type, data);
  }
}
// Mirror a queued report on the device so the driver can keep going.
function applyLocally(t, type, data) {
  if (type === 'start') { t.phase = 'active'; if (t.direction === 'afternoon') { t.boarded = data.count; t.onBoard = data.count; } }
  if (type === 'report') { t.reports[data.stopId] = { count: data.count, source: 'driver' }; const p = t.points.find(x => x.id === data.stopId); if (p?.kind === 'school' || t.direction === 'afternoon') t.onBoard -= data.count; else { t.onBoard += data.count; t.boarded = (t.boarded || 0) + data.count; } }
  if (type === 'depart') { t.departures.push(data.stopId); if (data.stopId === 'school' || !nextPoint(t)) t.phase = 'completed'; }
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
      saveQueue(queue().filter(x => x.id !== c.id));
      S.data = r.state;
    }
    render();
  } catch (e) { if (!e.network) { S.error = e.message; render(); } }
}

// ------------------------------------------------------------ screens
function banner() {
  const q = queue().length;
  if (S.offline || q) return `<div class="d-banner">${S.offline ? 'אין קליטה. ' : ''}${q ? `${q} דיווחים שמורים במכשיר וישלחו כשתחזור קליטה.` : 'הדיווחים יישמרו במכשיר.'}</div>`;
  if (S.error) return `<div class="d-banner">${esc(S.error)}</div>`;
  return '';
}
function listScreen() {
  const me = S.data.drivers[0];
  const trips = [...S.data.trips].sort((a, b) => a.departure.localeCompare(b.departure));
  return `<header class="d-head"><small>יום ${esc(S.data.weekday)} · ${DATE.split('-').reverse().slice(0, 2).map(Number).join('.')}</small><h1>בוקר טוב, ${esc(me?.name.split(' ')[0] ?? '')}</h1></header>
    ${banner()}
    <div class="d-body-pad">
      ${trips.map(t => `<button class="d-card d-trip" data-open="${t.id}">
        <span class="d-time">${esc(t.departure)}</span>
        <span><b>${esc(t.school)}</b><span class="d-sub">${t.direction === 'morning' ? 'איסוף' : 'פיזור'} · ${t.stops.length} תחנות · ${t.planned} תלמידים</span></span>
        <span class="t-chip ${t.phase === 'completed' ? 'is-ok' : t.phase === 'active' ? 'is-active' : ''}">${t.phase === 'completed' ? 'הושלמה' : t.phase === 'active' ? 'בדרך' : 'הבאה'}</span>
      </button>`).join('') || '<p class="t-empty">אין נסיעות משובצות להיום.</p>'}
    </div>`;
}
function tripScreen(t) {
  const pts = t.direction === 'morning' ? t.points : t.points.filter(p => p.kind === 'stop');
  const next = nextPoint(t);
  const head = `<header class="d-head"><button class="d-back" data-back>→ הנסיעות שלי</button><small>${esc(t.number)} · ${t.direction === 'morning' ? 'איסוף בוקר' : 'פיזור צהריים'}</small><h1>${esc(t.school)}</h1>
    <div class="d-progress">${pts.map(p => `<i class="${t.departures.includes(p.id) ? 'is-done' : ''}"></i>`).join('')}</div></header>`;
  if (t.phase === 'completed') return `${head}${banner()}<div class="d-body-pad"><div class="d-card d-done"><b>הנסיעה הושלמה</b>${t.boarded != null ? `${t.boarded} תלמידים הוסעו` : ''}</div><button class="d-primary" data-back>חזרה לנסיעות</button></div>`;

  const starting = t.phase === 'pending';
  const atSchoolStart = starting && t.direction === 'afternoon';
  const dropping = next?.kind === 'school' || t.direction === 'afternoon';
  const expected = atSchoolStart ? t.planned : next?.kind === 'school' ? t.onBoard : next?.planned ?? 0;
  if (S.count == null) S.count = expected;
  const off = S.count !== expected;
  const stepper = `<div class="d-stepper"><button data-step="1" aria-label="הוספה">+</button><output class="${off ? 'd-off' : ''}" aria-live="polite">${S.count}<small>${atSchoolStart ? 'עלו בבית הספר' : dropping ? 'ירדו' : 'עלו'} · צפויים ${expected}</small></output><button data-step="-1" aria-label="הפחתה">−</button></div>`;
  const nav = next?.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}&travelmode=driving` : null;
  const safe = `<label class="d-safe ${S.safe ? 'is-on' : ''}"><input type="checkbox" data-safe ${S.safe ? 'checked' : ''}> הרכב עומד במקום בטוח</label>`;

  if (starting && !atSchoolStart) {
    return `${head}${banner()}<div class="d-body-pad">
      <div class="d-card d-next"><small>יציאה בשעה ${esc(t.departure)}</small><h2>${esc(t.points[0].name)}</h2><p>תחנה ראשונה · ${t.points[0].planned} תלמידים</p></div>
      <div class="d-card"><ul class="d-stops">${t.points.map(p => `<li><span>${esc(p.name)}</span><span>${esc(p.time ?? '')}</span></li>`).join('')}</ul></div>
      ${safe}<button class="d-primary" data-act="start" ${S.safe ? '' : 'disabled'}>התחלת נסיעה</button></div>`;
  }
  const title = atSchoolStart ? 'עלייה בבית הספר' : next.kind === 'school' ? 'הגעה לבית הספר' : dropping ? 'תחנת פיזור' : 'תחנת איסוף';
  const action = atSchoolStart ? `עלו ${S.count} · יציאה לפיזור` : next.kind === 'school' ? `ירדו ${S.count} · סיום נסיעה` : dropping ? `ירדו ${S.count} · המשך` : `עלו ${S.count} · יציאה מהתחנה`;
  return `${head}${banner()}<div class="d-body-pad">
    <div class="d-card d-next"><small>${title}</small><h2>${esc(atSchoolStart ? t.school : next.name)}</h2><p>${esc(atSchoolStart ? t.departure : next.time ?? '')}${t.onBoard ? ` · ${t.onBoard} ברכב` : ''}</p>${stepper}</div>
    ${safe}
    <button class="d-primary" data-act="report" ${S.safe ? '' : 'disabled'}>${action}</button>
    <div class="d-row">${nav ? `<a class="d-secondary" href="${nav}" target="_blank" rel="noopener">ניווט</a>` : ''}<button class="d-secondary" data-delay>${t.delayMinutes ? `דווח איחור ${t.delayMinutes} דק׳` : 'דיווח על איחור'}</button></div>
    ${S.delays ? `<div class="d-delays">${[5, 10, 15, 20].map(m => `<button data-minutes="${m}">${m} דק׳</button>`).join('')}</div>` : ''}
  </div>`;
}
function render() {
  const t = S.trip && tripById(S.trip);
  document.getElementById('app').innerHTML = `<div class="d-app">${t ? tripScreen(t) : listScreen()}</div>`;
}

document.addEventListener('click', async e => {
  const el = e.target.closest('button,[data-back]');
  if (!el) return;
  S.error = '';
  if (el.dataset.open) { S.trip = el.dataset.open; S.count = null; S.safe = false; S.delays = false; render(); return; }
  if ('back' in el.dataset) { S.trip = null; render(); return; }
  if (el.dataset.step) { S.count = Math.max(0, (S.count ?? 0) + Number(el.dataset.step)); render(); return; }
  if ('delay' in el.dataset) { S.delays = !S.delays; render(); return; }
  const t = tripById(S.trip);
  try {
    if (el.dataset.minutes) { await send('delay', { minutes: Number(el.dataset.minutes) }, t.id); S.delays = false; }
    if (el.dataset.act === 'start') await send('start', {}, t.id);
    if (el.dataset.act === 'report') {
      if (t.phase === 'pending') await send('start', { count: S.count }, t.id);
      else {
        const next = nextPoint(t);
        await send('report', { stopId: next.id, count: S.count }, t.id);
        await send('depart', { stopId: next.id }, t.id);
      }
      S.safe = false;
    }
    S.count = null;
  } catch (err) { S.error = err.message; }
  render();
});
document.addEventListener('change', e => { if ('safe' in e.target.dataset) { S.safe = e.target.checked; render(); } });
window.addEventListener('message', e => {
  if (e.origin !== location.origin || typeof e.data?.offline !== 'boolean') return;
  S.offline = e.data.offline; render(); if (!S.offline) flush();
});
window.addEventListener('online', flush);
setInterval(flush, 5000);

try { await load(); } catch (e) { S.error = e.network ? 'אין קליטה' : e.message; S.data = { trips: [], drivers: [], weekday: '' }; }
render();
const es = new EventSource(`/api/transport/events?date=${DATE}&viewer=${ME}`);
es.onmessage = async () => { if (S.offline || queue().length) return; try { await load(); render(); } catch {} };
