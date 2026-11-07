// The demo without a server: the same engine runs in the browser, and this file answers the
// requests the screens make to /api/transport/* and /api/workspace/config. Each visitor gets
// their own copy of the demo, kept in this browser; the dispatcher screen and the driver's phone
// (an iframe on the same page) stay in step through a BroadcastChannel.
import { createTransportState, actorFor, snapshot, execute, weekday, TransportError, sourceData, monthSummary, DEMO_DATE } from '../transport/engine.ts';
import { proposalsFor } from '../transport/assistant.ts';

const KEY = 't-static-state-v1';
const channel = new BroadcastChannel('t-transport');
const local = new Set<(m: any) => void>();
let state: any = null;

function load() {
  if (state) return state;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.schema === 1 && saved.sourceHash === sourceData.source.sha256) { state = saved; return state; }
  } catch {}
  if (!state) { state = createTransportState(); state.sourceHash = sourceData.source.sha256; }
  return state;
}
// Days nobody touched are rebuilt from the schedule on demand, so only changed days are kept.
function save() {
  const touched = (d: any, date: string) => date === DEMO_DATE || d.events?.length || d.cancelled?.length || (d.acks && Object.keys(d.acks).length);
  const slim = { ...state, days: Object.fromEntries(Object.entries(state.days).filter(([date, d]) => touched(d, date))) };
  try { localStorage.setItem(KEY, JSON.stringify(slim)); } catch { /* full storage: keep going in memory */ }
}
function notify(message: any) { channel.postMessage(message); local.forEach(fn => fn(message)); }
channel.onmessage = e => { state = null; local.forEach(fn => fn(e.data)); };

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
async function handle(url: URL, init: RequestInit = {}) {
  const path = url.pathname.slice(url.pathname.indexOf('/api/'));
  if (path === '/api/workspace/config') return reply(200, { googleMapsBrowserKey: (globalThis as any).__MAPS_KEY || '' });
  try {
    const s = load();
    const headers = new Headers(init.headers || {});
    const viewer = String(headers.get('x-transport-viewer') || url.searchParams.get('viewer') || '');
    actorFor(s, viewer);
    const date = url.searchParams.get('date') || DEMO_DATE; weekday(date);
    if (path === '/api/transport/state') return reply(200, snapshot(s, date, viewer));
    if (path === '/api/transport/month') { if (actorFor(s, viewer).role !== 'dispatcher') throw new TransportError('זמין לסדרנים בלבד.', 403); return reply(200, monthSummary(s, date)); }
    if (path === '/api/transport/assistant') { if (actorFor(s, viewer).role !== 'dispatcher') throw new TransportError('העוזר זמין לסדרנים בלבד.', 403); return reply(200, proposalsFor(s, date, url.searchParams.get('ask') || '', null)); }
    if (path === '/api/transport/commands' && (init.method || 'GET').toUpperCase() === 'POST') {
      const command = JSON.parse(String(init.body || '{}'));
      const current = load(); const next = structuredClone(current);
      const result = execute(next, viewer, command);
      if (!result.duplicate) { state = next; save(); notify({ date: command.date, revision: next.revision }); }
      return reply(200, { ...result, state: snapshot(state, command.date, viewer) });
    }
    return reply(404, { error: 'הכתובת לא נמצאה.' });
  } catch (error: any) {
    return reply(error instanceof TransportError ? error.status : 500, { error: error instanceof TransportError ? error.message : 'לא ניתן לשמור את הפעולה. הנתונים לא עודכנו.' });
  }
}

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (!url.pathname.includes('/api/')) return realFetch(input, init);
  await Promise.resolve();
  return handle(url, init ?? (typeof input === 'string' ? {} : { method: input.method, headers: input.headers }));
}) as typeof fetch;

// Live updates: the screens listen with EventSource; here it is the channel instead.
class LocalEvents {
  onmessage: ((e: { data: string }) => void) | null = null; onerror: any = null; readyState = 1;
  private date: string; private fn: (m: any) => void;
  constructor(href: string) {
    const url = new URL(href, location.href); this.date = url.searchParams.get('date') || DEMO_DATE;
    this.fn = (m: any) => { if (!m?.date || m.date === this.date) this.onmessage?.({ data: JSON.stringify(m) }); };
    local.add(this.fn);
  }
  addEventListener(type: string, fn: any) { if (type === 'message') { const prev = this.onmessage; this.onmessage = e => { prev?.(e); fn(e); }; } }
  close() { local.delete(this.fn); this.readyState = 2; }
}
(globalThis as any).EventSource = LocalEvents;
