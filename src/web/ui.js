// Small, dependency-free UI helpers shared by the views and the app shell.

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('he-IL') : '—');

export const pct = (v) => (Number.isFinite(Number(v)) ? `${Math.round(Number(v) * 100)}%` : '—');

/** Percentages that add to exactly 100 (largest remainder). */
export const splitPct = (values) => {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((value) => (Number(value || 0) / total) * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remaining; i++) floors[order[i % order.length].index] += 1;
  return floors;
};

export const sensitivityHe = (label) =>
  ({ Public: 'ציבורי', Internal: 'פנימי', Confidential: 'סודי', Restricted: 'מוגבל', 'Highly Confidential': 'סודי ביותר' })[label] ?? '';

export const ltr = (v, cls = '') => `<span class="ltr${cls ? ` ${cls}` : ''}" dir="ltr">${esc(v)}</span>`;

/** Escape a Hebrew sentence and isolate the Latin tokens inside it. */
export const mixed = (v) =>
  esc(v).replace(/([A-Za-z][A-Za-z0-9_.\-]*)/g, '<span class="ltr" dir="ltr">$1</span>');

export const initials = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');

export const heDate = (iso) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

export const shortDate = (iso) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

export const timeOf = (iso) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(date);
};

export const fileSize = (bytes) => {
  if (!Number.isFinite(Number(bytes))) return '—';
  const kb = Math.max(1, Math.round(Number(bytes) / 1024));
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${num(kb)} KB`;
};

export const sourceNameHe = (id) =>
  ({ entra: 'זהות העובדים', exchange: 'דואר העבודה', sharepoint: 'מסמכי המחלקה', sql: 'מערכות הפעלה' })[id] ?? id;

export const serviceNameHe = (code) =>
  ({ LIC: 'רישוי עסק', FEE: 'הנחה באגרת תברואה', CMP: 'קריאות תברואה' })[code] ?? code;

export const riskHe = (risk) => ({ low: 'נמוך', medium: 'בינוני', high: 'גבוה' })[risk] ?? risk;

export const statusHe = (status) => ({ confirmed: 'מאושר', candidate: 'מועמד', rejected: 'נדחה', open: 'פתוח', accepted: 'אושר', proposed: 'מוצע' })[status] ?? status;

export const typeHe = (type) =>
  ({
    document: 'מסמך',
    message: 'הודעה',
    person: 'אדם',
    household: 'משק בית',
    resident: 'תושב',
    business: 'עסק',
    case: 'תיק',
    property: 'נכס',
    rule: 'כלל',
    decision: 'החלטה',
    knowledge_candidate: 'מועמד ידע',
  })[type] ?? type;

export const parsePerson = (label) => {
  const text = String(label ?? '');
  const match = /^(.*?)\s*\((.*)\)\s*$/.exec(text);
  return { name: (match?.[1] ?? text).trim(), title: (match?.[2] ?? '').trim() };
};

export const roleKind = (label) => {
  const text = String(label ?? '');
  if (/מנהל|מנהלת|head/i.test(text)) return 'head';
  if (/אחראית נתונים|data steward|steward/i.test(text)) return 'steward';
  if (/רכז גזברות|treasury|finance|rule owner/i.test(text)) return 'rule';
  if (/מפקח|מפקחת|מדביר|inspector/i.test(text)) return 'field';
  if (/מזכיר|secretary/i.test(text)) return 'secretary';
  return 'clerk';
};

export const NAV = {
  home: { label: 'בית', icon: 'home' },
  approvals: { label: 'מרכז הכרעות', icon: 'decisions' },
  insights: { label: 'תמונת המחלקה', icon: 'chart' },
  sources: { label: 'מקורות', icon: 'database' },
  workspace: { label: 'הצגת המקור', icon: 'grid' },
};

export const NAV_BY_ROLE = {
  head: ['home', 'approvals', 'insights', 'sources', 'workspace'],
  clerk: ['home', 'approvals', 'insights', 'sources', 'workspace'],
  secretary: ['home', 'approvals', 'sources', 'workspace'],
  field: ['home', 'insights', 'workspace'],
  rule: ['home', 'approvals', 'sources'],
  steward: ['home', 'approvals', 'sources'],
};

export const navFor = (kind) => NAV_BY_ROLE[kind] ?? NAV_BY_ROLE.clerk;

export const roleWhat = (kind) =>
  ({
    head: 'אישורים, תמונת המחלקה והמקורות שמאחוריה',
    clerk: 'פערים, שאלות ואישורים שממתינים לאדם',
    secretary: 'פניות, אישורים ומסמכים שמחכים לטיפול',
    field: 'העבודה בשטח והמערכות שבהן היא מתנהלת',
    rule: 'השאלות וההחלטות על כלל הזכאות',
    steward: 'שינויי המודל וכיסוי הנתונים',
  })[kind] ?? '';

const PATHS = {
  home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  decisions: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.3 2.3L16 9.5"/>',
  chart: '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
  database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 14.5A5.5 5.5 0 0 1 21 20"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17.5v.1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  arrowLeft: '<path d="M14 6l-6 6 6 6"/>',
  arrowRight: '<path d="M10 6l6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.7"/><path d="M20 5v6h-6"/>',
  external: '<path d="M14 4h6v6M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 6.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flow: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M8.5 6H13a2 2 0 0 1 2 2v1.5M8.5 18H13a2 2 0 0 0 2-2v-1.5"/>',
  key: '<circle cx="8" cy="8" r="4"/><path d="m11 11 8 8M16 16l2-2M19 19l2-2"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2-2.5 3.8"/><path d="M12 17.2v.1"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  building: '<path d="M4 21V7l8-4 8 4v14M9 21v-5h6v5M8 10h.1M12 10h.1M16 10h.1M8 13h.1M12 13h.1M16 13h.1"/>',
  switch: '<path d="M7 4 3.5 7.5 7 11M3.5 7.5H15a5 5 0 0 1 5 5M17 20l3.5-3.5L17 13M20.5 16.5H9a5 5 0 0 1-5-5"/>',
  download: '<path d="M12 4v10M8 10.5l4 4 4-4M5 19h14"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="icon${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? PATHS.info}</svg>`;

export const microsoftMark = () =>
  `<span class="ms-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;

export const badge = (text, tone = 'neutral') => `<span class="badge badge-${tone}">${esc(text)}</span>`;

export const chip = (text, { tone = '', ltr: isLtr = false, iconName = '' } = {}) =>
  `<span class="chip${tone ? ` chip-${tone}` : ''}">${iconName ? icon(iconName, 'chip-icon') : ''}${
    isLtr ? ltr(text) : esc(text)
  }</span>`;

export const emptyBox = (iconName, title, text, extra = '') =>
  `<section class="empty"><span class="empty-icon">${icon(iconName)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p>${extra}</section>`;

export const errorBox = (message, action = '') =>
  `<section class="empty empty-error"><span class="empty-icon">${icon('alert')}</span><h2>לא הצלחנו לטעון את המסך</h2><p>${esc(
    message,
  )}</p>${action}</section>`;

export const skeleton = (kind = 'cards') => {
  const card = '<div class="sk-card"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></div>';
  if (kind === 'home') {
    return `<div class="skeleton"><div class="sk sk-pill"></div><div class="sk sk-hero"></div><div class="sk sk-grid">${card}${card}${card}</div></div>`;
  }
  return `<div class="skeleton"><div class="sk sk-pill"></div><div class="sk sk-line w50 sk-title"></div><div class="sk sk-grid">${card}${card}${card}</div></div>`;
};

export const toast = (message, tone = 'ok') => {
  const region = document.getElementById('toasts');
  if (!region) return;
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon(tone === 'error' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
  region.append(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  }, 4200);
};

export const openSheet = ({ title, eyebrow = '', body = '', wide = false, footer = '' }) => {
  const dialog = document.getElementById('sheet');
  if (!dialog) return;
  const titleEl = document.getElementById('sheet-title');
  const eyebrowEl = document.getElementById('sheet-eyebrow');
  const bodyEl = document.getElementById('sheet-body');
  if (titleEl) titleEl.textContent = title;
  if (eyebrowEl) {
    eyebrowEl.textContent = eyebrow;
    eyebrowEl.hidden = !eyebrow;
  }
  if (bodyEl) bodyEl.innerHTML = body;
  const footerEl = document.getElementById('sheet-foot');
  if (footerEl) {
    footerEl.innerHTML = footer;
    footerEl.hidden = !footer;
  }
  dialog.classList.toggle('sheet-wide', wide);
  if (!dialog.open) dialog.showModal();
  if (bodyEl) bodyEl.scrollTop = 0;
};

export const setSheetBody = (body, footer = undefined) => {
  const bodyEl = document.getElementById('sheet-body');
  if (bodyEl) bodyEl.innerHTML = body;
  if (footer !== undefined) {
    const footerEl = document.getElementById('sheet-foot');
    if (footerEl) {
      footerEl.innerHTML = footer;
      footerEl.hidden = !footer;
    }
  }
  if (bodyEl) bodyEl.scrollTop = 0;
};

export const closeSheet = () => {
  const dialog = document.getElementById('sheet');
  if (dialog?.open) dialog.close();
};

export const lineBar = (value, max, tone = 'primary') => {
  const width = max > 0 ? Math.max(2, Math.min(100, Math.round((value / max) * 100))) : 0;
  return `<span class="mini-track"><i class="mini-fill ${tone}" style="width:${width}%"></i></span>`;
};
