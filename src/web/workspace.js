import { inboxPage, threadView, approvalPanel, activityWithComments } from './workspace-collaboration.js';
import { PEOPLE, canReadWorkspace, commentsFor, isFollowing, followRecord, addComment, notificationsFor, markNotificationRead, approvalsFor, attentionCount, decideApproval, settlementApproved, restoreCollaboration } from './workspace-model.js';
import { esc, icon } from './ui.js';
import { mountWorkspaceGrid, gridRecordButton } from './workspace-grid.js';
import { mountGoogleMap, googleDirectionsUrl } from './workspace-map.js';
import { statusDot, pageHeading } from './aka-kit/primitives.js';
import { SNAPSHOT, PERIOD, DEPOT, ROLES, SOURCES, WASTE, RATES, createWorkspace, sites, charges, requests, memories, record, amount, totals, resolveCharge, updateRequest, financeRows, routePlan } from './workspace-model.js';

const storageKey = 'municipal-workspace-skeleton-v1';
const model = createWorkspace();
const state = { role: 'manager', filter: 'issues', requestFilter: 'open', memoryFilter: 'all', panelTab: 'overview', improved: false, mapIssues: false, mapWaste: 'all', workflow: 'monthly', workflowStep: null, inboxFilter: 'action', threadPart: '', search: '', exportOpen: false };
let activeMap, activeGrid, lastTrigger, restoreWarning = false;
const gridQueries = { settlement: '', requests: '', access: '' };
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
  if (saved && ROLES[saved.role]) state.role = saved.role;
  if (saved?.resolutions) {
    // Reapply only validated actions instead of trusting a stored resolved flag.
    for (const [id, input] of Object.entries(saved.resolutions)) {
      try { resolveCharge(model, id, 'manager', input); } catch { restoreWarning = true; }
    }
  }
  if (saved?.requestUpdates) for (const [id, input] of Object.entries(saved.requestUpdates)) {
    try { updateRequest(model, id, 'manager', input.state); } catch { restoreWarning = true; }
  }
  if (Array.isArray(saved?.audit)) model.audit = saved.audit.filter(a => model.entities[a.subject] && typeof a.note === 'string' && typeof a.actor === 'string');
  restoreCollaboration(model, saved?.collaboration);
  model.prepared = Boolean(saved?.prepared && settlementApproved(model));
} catch { restoreWarning = true; }

const root = document.getElementById('workspace');
const money = n => n === null ? 'לא ידוע' : `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(n)} ₪`;
const number = n => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 }).format(n);
const date = s => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' }).format(new Date(s));
const label = { open: 'פתוחה', investigating: 'בבדיקה', closed: 'טופלה' };
const types = { settlement: 'התחשבנות', workflow: 'תהליך', site: 'יישוב / עסק', collection_point: 'נקודת פינוי', charge: 'חיוב', request: 'פניית שירות', rule: 'כלל', memory: 'ידע ארגוני', finding: 'ממצא מחושב' };
const issueNames = { quantity: 'פער בכמות', missing: 'חסרה אסמכתה', tariff: 'תעריף שונה' };
const sourceTitle = id => SOURCES.find(s => s.id === id)?.title ?? id;
const recordLink = (id, text) => `<button type="button" class="inline-link" data-open="${esc(id)}">${esc(text ?? record(model, id)?.title ?? id)}</button>`;

function save() {
  try { sessionStorage.setItem(storageKey, JSON.stringify({ role: state.role, resolutions: model.resolutions, requestUpdates: model.requestUpdates, audit: model.audit, collaboration: model.collaboration, prepared: model.prepared })); }
  catch { notify('הדפדפן אינו מאפשר שמירה. אפשר להמשיך, אך הפעולות יימחקו ברענון.', true); }
}
function route() {
  const [path, q = ''] = (location.hash.slice(1) || '/work/settlement').split('?');
  return { path, recordId: new URLSearchParams(q).get('record') };
}
function navigate(path) {
  state.exportOpen = false;
  if (route().path === path && !route().recordId) render(); else location.hash = path;
}
function openRecord(id, trigger) {
  if (trigger) lastTrigger = trigger;
  state.panelTab = 'overview'; state.threadPart = '';
  state.exportOpen = false;
  if (route().recordId === id) { render(); document.getElementById('record-title')?.focus(); }
  else location.hash = `${route().path}?record=${encodeURIComponent(id)}`;
}
function closeRecord() {
  history.replaceState(null, '', `${location.pathname}${location.search}#${route().path}`);
  render();
  const restored = lastTrigger?.dataset?.open && document.querySelector(`[data-open="${CSS.escape(lastTrigger.dataset.open)}"]`);
  if (restored) restored.focus(); else document.querySelector('h1')?.focus();
}
function notify(text, error = false) {
  const live = document.getElementById('notice');
  live.className = error ? 'notice error' : 'notice';
  live.textContent = text;
  live.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { live.hidden = true; }, 5500);
}
function allowed(e) { return canReadWorkspace(model, e.id, state.role); }
function visibleAudit() { return model.audit.filter(a => { const subject = record(model, a.subject); return subject && allowed(subject); }); }
function currentRecord() {
  const id = route().recordId;
  if (id?.startsWith('source-')) return { ...SOURCES.find(s => `source-${s.id}` === id), id, type: 'source' };
  const e = record(model, id);
  return e && allowed(e) ? e : null;
}

function shell() {
  const { path } = route();
  const section = path.split('/')[1];
  return `<a class="skip" href="#main-content">דלג לתוכן</a>
    <aside class="workspace-sidebar" aria-label="ניווט ראשי">
      <a class="workspace-brand" href="#/work/settlement"><span class="brand-mark">${icon('layers')}</span><span>מרחב המועצה<small>גליל עליון · תברואה</small></span></a>
      <nav>${[['work', 'grid', 'עבודה'], ['memory', 'doc', 'זיכרון ארגוני'], ['workflows', 'flow', 'תהליכים']].map(([id, i, name]) => `<a href="#/${id}${id === 'work' ? (ROLES[state.role].finance ? '/settlement' : '/map') : ''}" ${section === id ? 'aria-current="page"' : ''}>${icon(i)}${name}</a>`).join('')}</nav>
      <div class="sidebar-bottom"><a href="#/admin/connections" ${section === 'admin' ? 'aria-current="page"' : ''}>${icon('building')}ניהול המרחב</a><a href="./classic.html">לתצוגת הפלטפורמה הקודמת ${icon('external')}</a><p>סביבת הדגמה<small>נתונים ומיקומים לדוגמה</small></p></div>
    </aside>
    <div class="workspace-body">
      <header class="workspace-topbar"><span class="department-name">אגף התברואה</span><div class="search-wrap"><label class="global-search">${icon('search')}<input id="global-search" type="search" placeholder="חיפוש ביישובים, פניות וידע" aria-label="חיפוש במרחב" aria-controls="search-results" autocomplete="off"><kbd>⌘ K</kbd></label><div id="search-results" class="search-results" hidden></div></div><a class="attention-link" href="#/inbox" aria-label="לעיוני: ${attentionCount(model, state.role)} פריטים">לעיוני <span>${attentionCount(model, state.role)}</span></a><label class="role-switch"><span class="profile-avatar" aria-hidden="true">${state.role === 'manager' ? 'מ' : state.role === 'finance' ? 'כ' : 'פ'}</span><span class="role-demo-label">הדמיית תפקיד</span><select id="role-select" aria-label="הדמיית תפקיד">${Object.entries(ROLES).map(([id, r]) => `<option value="${id}" ${state.role === id ? 'selected' : ''}>${r.name} · ${r.title}</option>`).join('')}</select></label></header>
      <div class="content-grid ${route().recordId ? 'with-record' : ''}"><main id="main-content" class="page-body" tabindex="-1">${page()}</main>${route().recordId ? recordPanel() : ''}</div>
      <footer class="workspace-footer"><span>הדמיה אינטראקטיבית · פעולות נשמרות בדפדפן בלבד</span><span>ללא חיבור חי למערכות המועצה</span></footer>
    </div>`;
}
function page() {
  const { path } = route();
  if (path.startsWith('/work/')) return workPage(path);
  if (path === '/inbox') return inboxPage(model, state.role, state.inboxFilter);
  if (path === '/memory') return memoryPage();
  if (path === '/workflows') return workflowsPage();
  if (path.startsWith('/admin')) return adminPage(path);
  return `<div class="empty-state"><h1 tabindex="-1">התצוגה לא נמצאה</h1><a class="primary-button" href="#/work/settlement">חזרה לעבודה</a></div>`;
}
function workPage(path) {
  const tab = path.split('/')[2];
  return `<div class="page-heading"><div><h1 tabindex="-1">העבודה של האגף</h1><p>נתונים, החלטות וטיפול — באותו מרחב.</p></div><span class="snapshot">${date(SNAPSHOT)}.2026</span></div>
    <nav class="view-tabs" aria-label="תצוגות עבודה">${[['settlement', 'התחשבנות חודשית'], ['map', 'מפת הפינוי'], ['requests', 'פניות שירות']].map(([id, title]) => `<a href="#/work/${id}" ${tab === id ? 'aria-current="page"' : ''}>${title}${id === 'requests' ? `<span>${requests(model).filter(r => r.state !== 'closed').length}</span>` : ''}</a>`).join('')}</nav>
    ${tab === 'settlement' ? settlementPage() : tab === 'map' ? mapPage() : tab === 'requests' ? requestsPage() : '<p>התצוגה לא נמצאה.</p>'}`;
}
function settlementPage() {
  if (!ROLES[state.role].finance) return `<div class="empty-state">${icon('lock')}<h2>התחשבנות זמינה למנהל האגף ולכספים</h2><p>בתפקיד רכז הפינוי אפשר לבדוק נקודות פינוי ופניות שירות.</p><a class="primary-button" href="#/work/map">פתיחת מפת הפינוי</a></div>`;
  const t = totals(model);
  const signed = settlementApproved(model);
  return `<section class="work-surface"><div class="surface-heading"><div><h2>התחשבנות פינוי <span>${PERIOD}</span></h2><p>${t.count} חיובים${t.issues ? ` · <strong class="attention-text">${t.issues} דורשים בדיקה</strong>` : ' · כל החיובים נבדקו'} · ${money(t.knownAmount)}${t.missing ? ' + חיוב שטרם חושב' : ''}, לפני מע״מ</p></div><button type="button" class="primary-button" data-export ${!signed ? 'disabled' : ''} title="${t.issues ? 'יש להשלים את בדיקת החריגים' : !signed ? 'נדרש אישור צוות הכספים' : 'הכנת קובצי CSV לכספים'}">${icon('download')}${model.prepared ? 'הורדת קובצי כספים' : 'הכנת קבצים לכספים'}</button></div>
      <div class="process-track" aria-label="התקדמות ההתחשבנות"><span class="done">${icon('check')}איסוף נתונים</span>${icon('arrowLeft')}<span class="${t.issues ? 'current' : 'done'}">בדיקת התאמות</span>${icon('arrowLeft')}<span class="${!t.issues ? 'current' : ''}">אישור וקבצים לכספים</span></div>
      <div class="table-toolbar"><div class="segmented" aria-label="סינון חיובים">${[['issues', 'לבדיקה', t.issues], ['all', 'כל החיובים', t.count], ['ready', 'מוכנים', t.count - t.issues]].map(([id, title, n]) => `<button type="button" data-filter="${id}" aria-pressed="${state.filter === id}">${title}<span>${n}</span></button>`).join('')}</div><span class="source-line">${SOURCES.map(s => `<button type="button" data-open="source-${s.id}">${s.id === 'excel' ? 'Excel' : s.id.toUpperCase()}</button>`).join('<span> / </span>')}<small>נתוני דוגמה</small></span></div>
      <div class="grid-tools"><label>${icon('search')}<input id="grid-filter" type="search" placeholder="סינון שורות…" aria-label="סינון שורות בטבלה" value="${esc(gridQueries.settlement)}"></label><button type="button" class="text-button" data-grid-reset>איפוס עמודות וסינון</button></div><div id="settlement-grid" class="workspace-data-grid"></div>
      <div class="surface-footer"><span>${icon('shield')}אישור התאמות: מוטי · בדיקת תוצרים: כספים</span><span class="settlement-links">${recordLink('rule-tariff', 'כלל החישוב והמקורות')}${recordLink('settlement-september', signed ? 'אישור כספים התקבל' : 'אישור צוות הכספים')}</span></div></section>${state.exportOpen ? exportPreview() : ''}`;
}
function status(kind, text) { return statusDot(kind === 'verified' || kind === 'closed' ? 'success' : ['quantity', 'missing', 'tariff', 'open'].includes(kind) ? 'warning' : ['computed', 'investigating'].includes(kind) ? 'accent' : 'neutral', text); }
function requestsPage() {
  return `<section class="work-surface"><div class="surface-heading"><div><h2>פניות שמחוברות לשטח</h2><p>הפנייה, נקודת הפינוי והטיפול הקודם מופיעים יחד.</p></div><button class="text-button" type="button" data-open="source-crm">CRM ש. בינה ${icon('external')}</button></div><div class="table-toolbar"><div class="segmented">${[['open', 'פתוחות'], ['all', 'כל הפניות'], ['closed', 'טופלו']].map(([id, title]) => `<button type="button" data-requests-filter="${id}" aria-pressed="${state.requestFilter === id}">${title}</button>`).join('')}</div><span class="subtle">פניות לדוגמה</span></div><div class="grid-tools"><label>${icon('search')}<input id="grid-filter" type="search" placeholder="סינון פניות…" aria-label="סינון שורות בטבלה" value="${esc(gridQueries.requests)}"></label><button type="button" class="text-button" data-grid-reset>איפוס עמודות וסינון</button></div><div id="requests-grid" class="workspace-data-grid"></div></section>`;
}
function mapPoints() {
  return sites(model).map(s => model.entities[s.pointId]).filter(p => (state.mapWaste === 'all' || p.waste === state.mapWaste) && (!state.mapIssues || requests(model).some(r => r.pointId === p.id && r.state !== 'closed')));
}
function routeListMarkup(runs) {
  let offset = 0;
  return runs.map((run, i) => {
    const start = offset + 1; offset += run.stops.length;
    return `<div class="route-tour"><h3>סבב ${i + 1}<span>${number(run.load)} טונות</span></h3><ol start="${start}">${run.stops.map(p => `<li><button type="button" data-open="${p.id}"><span>${esc(model.entities[p.siteId].title)}<small>${esc(p.title)}</small></span>${requests(model).some(r => r.pointId === p.id && r.state !== 'closed') ? '<span class="point-alert" aria-label="פנייה פתוחה"></span>' : ''}</button></li>`).join('')}</ol><a class="inline-link google-route-link" href="${esc(googleDirectionsUrl(run.stops))}" target="_blank" rel="noopener noreferrer">פתיחת מסלול ב־Google Maps ${icon('external')}</a>${run.distanceMeters ? `<p class="run-metrics">${number(run.distanceMeters / 1000)} ק״מ · ${Math.ceil(run.durationMillis / 60000)} דקות נסיעה</p>` : ''}</div>`;
  }).join('') || '<p class="route-empty">אין נקודות שמתאימות לסינון.</p>';
}
function mapPage() {
  const points = mapPoints();
  const plan = routePlan(points, false);
  return `<section class="work-surface map-surface"><div class="surface-heading"><div><h2>מפת הפינוי ומסלולי הנסיעה</h2><p>נקודות פינוי, פניות ומסלולים על גבי Google Maps.</p></div><button type="button" class="${state.improved ? 'secondary-button' : 'primary-button'}" data-compare disabled title="נדרש חיבור Google Maps ו־Routes">${icon('flow')}${state.improved ? 'חזרה לסדר המקורי' : 'שיפור סדר העצירות'}</button></div><div class="map-toolbar"><label>סוג פסולת<select id="waste-select"><option value="all">כל הסוגים</option>${Object.entries(WASTE).map(([id, title]) => `<option value="${id}" ${state.mapWaste === id ? 'selected' : ''}>${title}</option>`).join('')}</select></label><label class="checkbox-label"><input type="checkbox" id="map-issues" ${state.mapIssues ? 'checked' : ''}>רק נקודות עם פנייה פתוחה</label><button type="button" class="text-button" data-map-fit>${icon('grid')}כל הנקודות</button></div>
    <div class="map-and-route"><div class="map-container"><div id="collection-map" aria-label="Google Maps: נקודות פינוי לדוגמה"></div><span class="map-fixture-label">נקודות לדוגמה · Google Maps</span><div id="map-fallback" hidden></div></div><aside class="route-list" aria-label="סדר נקודות הפינוי"><div class="route-list-heading"><strong>${state.improved ? 'סדר עצירות לפי Google Routes' : 'סדר עצירות מתוכנן'}</strong><span>${points.length} נקודות · עד 10 טונות לסבב לדוגמה</span></div><div id="route-stops">${routeListMarkup(plan.tours)}</div><div id="route-metrics" class="route-distance" aria-live="polite">טוען חיבור למפה…</div></aside></div><div class="surface-footer map-footnote"><span>${icon('info')}מסלולי Google הם לנסיעה רגילה. מגבלות משאית, סוגי פסולת ושעות מתקני קליטה עדיין מחייבות בדיקה.</span>${recordLink('memory-gps', 'מה נחשב לאישור פינוי?')}</div></section>`;
}

function memoryPage() {
  const list = memories(model).filter(allowed).filter(m => state.memoryFilter === 'all' || (state.memoryFilter === 'candidates' ? m.status === 'candidate' : state.memoryFilter === 'derived' ? m.status === 'derived' : m.status === 'approved'));
  return `${pageHeading('זיכרון ארגוני', 'כללים, החלטות וניסיון שנשארים עם הארגון.')}<div class="memory-layout"><section><div class="table-toolbar plain-toolbar"><div class="segmented">${[['all', 'הכל'], ['approved', 'נהלים וכללים'], ['derived', 'ממצאים מחושבים'], ['candidates', 'דורש בירור']].map(([id, title]) => `<button type="button" data-memory-filter="${id}" aria-pressed="${state.memoryFilter === id}">${title}</button>`).join('')}</div></div><div class="memory-list">${list.map(m => `<article class="memory-row"><div><span class="memory-category">${m.category}</span><h2>${recordLink(m.id)}</h2><p>${esc(m.summary)}</p><div class="memory-meta"><span>${esc(m.owner)}</span><span>גרסה ${m.version}</span>${status(m.status === 'derived' ? 'computed' : m.status === 'approved' ? 'ready' : 'missing', m.status === 'derived' ? 'נגזר מהמקורות' : m.status === 'approved' ? 'מאושר לדוגמה' : 'ממתין לבירור')}</div></div><button type="button" class="row-open" data-open="${m.id}" aria-label="פתיחת ${esc(m.title)}">${icon('arrowLeft')}</button></article>`).join('') || '<div class="empty-state"><h2>אין פריטים בסינון הזה</h2><button type="button" class="text-button" data-memory-filter="all">הצגת כל הידע</button></div>'}</div></section><aside class="memory-context"><h2>ידע שקשור לעבודה</h2><p>מכל חיוב או פנייה אפשר להגיע לכלל, למקור ולאדם שאחראי עליו.</p><div class="context-links">${recordLink('s5', 'עמיר: חיוב, תעריף ופנייה')}${recordLink('s3', 'מרכז מסחרי: אסמכתה חסרה')}</div><a class="text-button" href="#/admin/model">המודל המשותף ${icon('arrowLeft')}</a></aside></div>`;
}
function workflowsPage() {
  const t = totals(model);
  const flows = [
    { id: 'monthly', title: 'התחשבנות חודשית', owner: 'מוטי', label: t.issues ? `${t.issues} התאמות לבדיקה` : !settlementApproved(model) ? 'ממתין לאישור כספים' : model.prepared ? 'קובצי כספים הוכנו' : 'מאושר להכנת קבצים', link: '/work/settlement', steps: [['איסוף נתוני הפינוי', 'רכז הפינוי', true], ['התאמת כמויות ותעריפים', 'מוטי', !t.issues], ['אישור כספים והכנת קבצים', 'צוות הכספים', settlementApproved(model)]] },
    { id: 'collections', title: 'תכנון סבב פינוי', owner: 'רכז הפינוי', label: 'תכנון לדוגמה', link: '/work/map', steps: [['בדיקת נקודות ותדירות', 'רכז הפינוי', false], ['תכנון לפי קיבולת ואילוצים', 'רכז הפינוי', false], ['אישור וביצוע הפינוי', 'מוטי / צוות הפינוי', false]] },
    { id: 'requests', title: 'טיפול בפניית שירות', owner: 'רכז הפינוי', label: `${requests(model).filter(r => r.state !== 'closed').length} פניות פתוחות`, link: '/work/requests', steps: [['קליטת פנייה ושיוך למקום', 'מוקד המועצה', true], ['בדיקת עדויות וטיפול', 'רכז הפינוי', false], ['עדכון הפונה וסגירה', 'מוקד המועצה', false]] },
  ];
  const visibleFlows = flows.filter(f => f.id !== 'monthly' || ROLES[state.role].finance);
  const f = visibleFlows.find(f => f.id === state.workflow) || visibleFlows[0];
  const activeStep = f.steps.findIndex(s => !s[2]);
  const selected = Math.min(state.workflowStep ?? Math.max(activeStep, 0), f.steps.length - 1);
  const descriptions = {
    monthly: ['כמויות, שקילות ותעריפים נשמרים עם המקור שממנו התקבלו. בדוגמה הנתונים כבר נאספו.', 'משווים את קובץ החיוב לאסמכתאות ולכלל התעריפים. כל תיקון נשמר כהחלטה נפרדת.', 'נדרש אישור צוות הכספים לגרסת ההתחשבנות שנבדקה. לאחריו אפשר להפיק קובצי דוגמה; השליחה ל־ERP טרם חוברה.'],
    collections: ['נקודות פינוי משויכות ליישוב או לעסק. המיקומים, התדירויות והנפחים בדוגמה דורשים אימות בשטח.', 'מחלקים לסבבים לפי קיבולת לדוגמה ומחשבים כבישים וסדר עצירות באמצעות Google Routes.', 'התכנון אינו הוראת ביצוע. נדרשים אישור, שיבוץ צוות ואסמכתת פינוי ממערכת המקור.'],
    requests: ['הפנייה מקושרת למקום כדי לראות את השירות, החיוב וההיסטוריה יחד.', 'רכז הפינוי בודק עדויות ומעדכן את מצב הפנייה בהדגמה. מיקום רכב לבדו אינו הוכחת ביצוע.', 'סגירה נשמרת בהיסטוריית הרשומה. משלוח עדכון לפונה וסנכרון CRM יתווספו בחיבור האמיתי.'],
  };
  const stepDetail = `<section class="workflow-step-detail" aria-labelledby="step-detail-title"><h3 id="step-detail-title">${f.steps[selected][0]}</h3><dl class="record-facts"><div><dt>אחראי</dt><dd>${f.steps[selected][1]}</dd></div><div><dt>מצב בהדגמה</dt><dd>${f.steps[selected][2] ? 'הושלם בדוגמה' : f.id === 'monthly' && selected === activeStep ? f.label : 'שלב מתוכנן'}</dd></div></dl><p>${descriptions[f.id][selected]}</p><a class="text-button" href="#${f.link}">פתיחת הרשומות הקשורות ${icon('arrowLeft')}</a><button class="text-button" type="button" data-workflow-thread="workflow-${f.id}" data-thread-part="שלב ${selected + 1}: ${f.steps[selected][0]}">שיחה על השלב</button>${f.id === 'monthly' && selected === 2 ? recordLink('settlement-september', 'פתיחת בקשת אישור הכספים') : ''}</section>`;
  return `${pageHeading('תהליכים', 'אותה עבודה, עם שלבים ברורים ואחריות שנשמרת.')}<div class="workflow-layout"><nav class="workflow-list" aria-label="בחירת תהליך">${visibleFlows.map(w => `<button type="button" data-workflow="${w.id}" aria-pressed="${w.id === f.id}">${icon('flow')}<span><strong>${w.title}</strong><small>${w.label}</small></span></button>`).join('')}</nav><section class="workflow-detail"><div class="surface-heading"><div><h2>${f.title}</h2><p>בעל התהליך: ${f.owner} · הגדרת תהליך לדוגמה</p></div><a class="primary-button" href="#${f.link}">לפתיחת העבודה ${icon('arrowLeft')}</a></div><div class="workflow-stage-layout"><ol class="workflow-steps">${f.steps.map(([title, owner, done], i) => `<li class="${done ? 'done' : i === activeStep ? 'current' : ''}"><button type="button" data-workflow-step="${i}" aria-pressed="${i === selected}" aria-controls="step-detail-title"><span class="step-marker">${done ? icon('check') : i + 1}</span><span><strong>${title}</strong><small>${owner}</small>${i === activeStep ? `<span class="step-wait">${f.label}</span>` : ''}</span></button></li>`).join('')}</ol>${stepDetail}</div><div class="workflow-related"><h3>כללים שמנחים את התהליך</h3>${f.id === 'monthly' ? `${recordLink('rule-tariff')}${recordLink('rule-proof')}` : recordLink('memory-gps')}<h3>הפעולות האחרונות במרחב</h3>${visibleAudit().length ? auditMarkup(visibleAudit().slice(-4).reverse()) : '<p class="subtle">לא בוצעו פעולות בהדגמה. אישור התאמה או עדכון פנייה יופיעו כאן.</p>'}</div></section></div>`;
}
function adminPage(path) {
  const tab = path.split('/')[2] || 'connections';
  return `${pageHeading('ניהול המרחב', 'החיבורים, המבנה והרשאות הגישה שמשרתים את כל התצוגות.')}<nav class="view-tabs" aria-label="הגדרות המרחב">${[['connections', 'מקורות מידע'], ['model', 'המודל המשותף'], ['people', 'אנשים ותפקידים'], ['access', 'הרשאות']].map(([id, title]) => `<a href="#/admin/${id}" ${tab === id ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</nav>${tab === 'connections' ? connectionsView() : tab === 'model' ? modelView() : tab === 'people' ? peopleView() : accessView()}`;
}
function connectionsView() {
  return `<section class="work-surface"><div class="surface-heading"><div><h2>שלושה מקורות, רשומות משותפות</h2><p>ממשקי המערכות טרם חוברו. המבנה מוצג עם נתונים סינתטיים.</p></div></div><div class="source-list">${SOURCES.map(s => `<article><span class="source-logo">${s.id === 'excel' ? 'XLS' : s.id.toUpperCase()}</span><div><h3>${s.title}</h3><p>${s.purpose}</p><small>${s.status}</small></div><button class="secondary-button" type="button" data-open="source-${s.id}">מיפוי הרשומות ${icon('arrowLeft')}</button></article>`).join('')}</div><div class="source-conclusion"><h3>מה מחליף את האקסל?</h3><p>מסך ההתחשבנות מרכז את ההתאמות, שומר את הכללים ומפיק את קובצי הכספים. ה־ERP וה־CRM ממשיכים לנהל את רשומות המקור שלהם.</p></div></section>`;
}
function modelView() {
  const groups = [['site', 'יישובים ועסקים', 'לקוח משותף לחיוב ולפנייה'], ['collection_point', 'נקודות פינוי', 'מיקום, סוג פסולת ותדירות'], ['charge', 'חיובים', 'כמות, תעריף ואסמכתה'], ['request', 'פניות שירות', 'בעיה, מקום, מטפל ומצב'], ['rule', 'כללים', 'גרסה, מקור ובעל אחריות'], ['memory', 'ידע ארגוני', 'החלטות, נהלים והסברים']];
  return `<section class="work-surface"><div class="surface-heading"><div><h2>כל תצוגה משתמשת באותן רשומות</h2><p>דוגמת קשר: יישוב ← נקודת פינוי ← פנייה. החיוב קשור לאותו יישוב ולכלל חישוב.</p></div></div><div class="model-list">${groups.map(([type, title, desc]) => `<div><strong>${title}</strong><span>${desc}</span><span>${Object.values(model.entities).filter(e => e.type === type).length} רשומות דוגמה</span></div>`).join('')}</div><div class="source-conclusion"><h3>דוגמה לרשומה מקושרת</h3><p>${recordLink('s2', 'הגושרים')} מופיע בהתחשבנות, במפה ובפניות. שינוי בטיפול בפנייה משתקף בכל התצוגות.</p><p class="subtle">המודל של הסקלטון מדגים את הקשרים. שילוב סוגי התברואה בחבילות האונטולוגיה הקיימות הוא שלב האינטגרציה הבא.</p></div></section>`;
}
function peopleView() {
  return `<section class="work-surface"><div class="surface-heading"><div><h2>מי מחזיק את העבודה</h2><p>תפקידים לדוגמה לתהליכי הפינוי וההתחשבנות.</p></div></div><div class="people-list">${Object.entries(ROLES).map(([id, r]) => `<article><span class="profile-avatar">${r.name.slice(0, 1)}</span><div><h3>${r.name}</h3><p>${r.title}</p></div><span>${id === 'manager' ? 'אישור התאמות וכללים' : id === 'finance' ? 'בדיקת חיובים והכנת קבצים' : 'תכנון פינוי וטיפול בפניות'}</span></article>`).join('')}</div></section>`;
}
function accessView() {
  return `<section class="work-surface"><div class="surface-heading"><div><h2>גישה לפי תפקיד ומקור</h2><p>החלפת התפקיד בראש המסך מדגימה את ההבדלים בתצוגות ובפעולות.</p></div></div><div id="access-grid" class="workspace-data-grid"></div><div class="source-conclusion"><p>זו הדמיית הרשאות בדפדפן על נתונים סינתטיים. לפני חיבור מידע אמיתי יידרשו הזדהות ואכיפת גישה בשרת, לפי הרשאות המקור.</p><button type="button" class="text-button" data-reset>איפוס פעולות ההדגמה</button></div></section>`;
}

function recordPanel() {
  const e = currentRecord();
  if (!e?.title) return `<aside class="record-panel" aria-label="רשומה"><button class="panel-close" type="button" data-close aria-label="סגירת הרשומה">${icon('close')}</button><h2 tabindex="-1">הרשומה אינה זמינה</h2><p>הרשומה לא קיימת או שאינה גלויה בתפקיד שנבחר.</p></aside>`;
  const tabs = [['overview', 'פרטים'], ['evidence', 'מקורות'], ['conversation', `שיחה ${e.type !== 'source' ? commentsFor(model, e.id, state.role).length : ''}`], ['history', 'פעילות'], ['access', 'גישה']];
  return `<aside class="record-panel" aria-labelledby="record-title"><div class="record-heading"><button class="panel-close" type="button" data-close aria-label="סגירת הרשומה">${icon('close')}</button><h2 id="record-title" tabindex="-1">${esc(e.title)}</h2>${e.type !== 'source' ? `<span class="record-id"><bdi dir="ltr">${e.id}</bdi></span>` : ''}</div><div class="panel-tabs" role="tablist" aria-label="פרטי הרשומה">${tabs.map(([id, title]) => `<button role="tab" type="button" id="panel-tab-${id}" data-panel-tab="${id}" aria-controls="record-content" aria-selected="${state.panelTab === id}" tabindex="${state.panelTab === id ? 0 : -1}">${title}</button>`).join('')}</div><div id="record-content" role="tabpanel" aria-labelledby="panel-tab-${state.panelTab}" class="record-content">${state.panelTab === 'overview' ? recordOverview(e) : state.panelTab === 'evidence' ? evidenceView(e) : state.panelTab === 'conversation' ? e.type === 'source' ? '<p>השיחה נשמרת ברשומות המקושרות למקור.</p>' : threadView(model, state.role, e.id, state.threadPart) : state.panelTab === 'history' ? historyView(e) : permissionView(e)}</div></aside>`;
}
function recordOverview(e) {
  if (e.type === 'settlement') return `${approvalPanel(model, state.role, e.id)}<a class="text-button" href="#/work/settlement">פתיחת כל החיובים</a>`;
  if (e.type === 'workflow') return `<p>השיחה והבירורים נשמרים עם התהליך, גם כאשר נפתחים מתוך שלב.</p><a class="text-button" href="#/workflows">פתיחת התהליך</a>${threadView(model, state.role, e.id, state.threadPart)}`;
  if (e.type === 'source') return `<h3>${esc(e.purpose)}</h3><p class="subtle">${esc(e.status)} · נתוני הדגמה בלבד</p><h3>מיפוי אל המודל המשותף</h3><ul class="mapping-list">${e.maps.map(m => `<li>${esc(m)}</li>`).join('')}</ul><h3>הצעד הבא</h3><p>לקבל דוגמת ייצוא, לזהות מזהים משותפים ולאמת את מבנה המידע וההרשאות עם הספק.</p>`;
  if (e.type === 'charge') return chargeDetail(e);
  if (e.type === 'site') {
    const point = model.entities[e.pointId];
    return `<dl class="record-facts"><div><dt>סוג רשומה</dt><dd>${e.category}</dd></div><div><dt>נקודת פינוי</dt><dd>${recordLink(e.pointId, point.title)}</dd></div><div><dt>סוג פסולת</dt><dd>${WASTE[point.waste]}</dd></div></dl><h3>העבודה שקשורה למקום</h3><div class="linked-records">${ROLES[state.role].finance ? recordLink(e.chargeId, `חיוב ${PERIOD}`) : ''}${e.requestIds.map(id => recordLink(id)).join('') || '<p class="subtle">אין פניות שירות מקושרות.</p>'}</div><button class="secondary-button" type="button" data-locate="${point.id}">${icon('eye')}הצגה במפה</button>`;
  }
  if (e.type === 'collection_point') return `<dl class="record-facts"><div><dt>יישוב / עסק</dt><dd>${recordLink(e.siteId)}</dd></div><div><dt>סוג פסולת</dt><dd>${WASTE[e.waste]}</dd></div><div><dt>מכלים</dt><dd>${e.bins}</dd></div><div><dt>תדירות מתוכננת</dt><dd>${e.frequency}</dd></div><div><dt>ביקור מדווח אחרון</dt><dd>${date(e.lastVisit)}</dd></div><div><dt>כמות צפויה לסבב</dt><dd>${number(e.load)} טונות לדוגמה</dd></div></dl><h3>פניות בנקודה</h3><div class="linked-records">${requests(model).filter(r => r.pointId === e.id).map(r => recordLink(r.id)).join('') || '<p class="subtle">אין פניות מקושרות.</p>'}</div><p class="subtle">הביקור המדווח בדוגמה אינו תיעוד GPS חי.</p>${recordLink('memory-gps', 'איך בודקים שפינוי בוצע?')}`;
  if (e.type === 'request') return `<p class="request-state">${status(e.state, label[e.state])}</p><p>${esc(e.evidence)}</p><dl class="record-facts"><div><dt>מקום</dt><dd>${recordLink(e.siteId)}</dd></div><div><dt>נקודת פינוי</dt><dd>${recordLink(e.pointId)}</dd></div><div><dt>מטפל</dt><dd>${e.owner}</dd></div><div><dt>נפתחה</dt><dd>${date(e.opened)}</dd></div></dl>${ROLES[state.role].finance ? `<div class="linked-records">${recordLink(model.entities[e.siteId].chargeId, 'החיוב שקשור למקום')}</div>` : ''}<div class="record-action">${ROLES[state.role].dispatch && e.state !== 'closed' ? `<button class="primary-button" type="button" data-request-next="${e.id}" data-next="${e.state === 'open' ? 'investigating' : 'closed'}">${e.state === 'open' ? 'העברה לבדיקה' : 'סימון כטופלה בהדגמה'}</button>` : `<p class="subtle">${e.state === 'closed' ? 'הפנייה טופלה בדוגמה.' : 'עדכון טיפול זמין למנהל האגף ולרכז הפינוי.'}</p>`}</div>`;
  return `<p>${esc(e.body || e.summary)}</p><dl class="record-facts"><div><dt>אחראי</dt><dd>${esc(e.owner)}</dd></div><div><dt>מצב</dt><dd>${e.status === 'derived' ? 'מחושב מהמקורות · לא החלטה' : e.status === 'candidate' ? 'מוצע · ממתין לבירור' : 'מאושר לדוגמה'}</dd></div><div><dt>גרסה</dt><dd>${e.version}</dd></div>${e.method ? `<div><dt>שיטת חישוב</dt><dd><bdi dir="ltr">${e.method}@${e.version}</bdi></dd></div>` : ''}</dl><h3>רשומות קשורות</h3><div class="linked-records">${(e.related || []).filter(id => model.entities[id] && allowed(model.entities[id])).map(id => recordLink(id)).join('')}${(e.related || []).includes('workflow-monthly') ? '<a class="inline-link" href="#/workflows">תהליך ההתחשבנות</a>' : ''}</div>`;
}
function chargeDetail(c) {
  const site = model.entities[c.siteId];
  return `<div class="charge-total"><span>סכום לחיוב · לפני מע״מ</span><strong>${money(amount(c))}</strong>${status(c.resolved ? 'ready' : c.issue, c.resolved ? 'מוכן להכנת קבצים' : issueNames[c.issue])}</div><dl class="record-facts"><div><dt>יישוב / עסק</dt><dd>${recordLink(c.siteId)}</dd></div><div><dt>כמות לפי אסמכתה</dt><dd>${c.quantity === null ? 'חסרה אסמכתה' : `${number(c.quantity)} טונות`}</dd></div><div><dt>כמות בקובץ החיוב</dt><dd>${number(c.billedQuantity)} טונות</dd></div><div><dt>תעריף נוכחי</dt><dd>${money(c.rate)} לטונה</dd></div><div><dt>כלל חישוב</dt><dd>${recordLink(c.ruleId, 'תעריפים מאושרים · גרסה 2')}</dd></div></dl><div class="calculation"><span>החישוב</span><bdi dir="ltr">${c.quantity === null ? '? × ' + c.rate : `${number(c.quantity)} × ${c.rate}`} = ${amount(c) === null ? '?' : number(amount(c))} ₪</bdi></div>${approvalPanel(model, state.role, c.id)}<h3>קשור לאותו מקום</h3><div class="linked-records">${recordLink(site.pointId, 'נקודת הפינוי במפה')}${site.requestIds.map(id => recordLink(id)).join('')}</div>`;
}
function evidenceView(e) {
  if (e.type === 'source') return `<p>לא התקבלו עדיין קובצי מקור מהלקוח. המיפויים כאן מתארים את חוזה הנתונים הרצוי.</p>`;
  if (e.type === 'charge') return `<h3>מקורות החיוב</h3><div class="evidence-entry"><strong>ERP לדוגמה</strong><bdi dir="ltr">${e.evidence.erpRef}</bdi><span>כמות בקובץ החיוב: ${number(model.entities[e.id].billedQuantity)} טונות</span></div><div class="evidence-entry"><strong>Excel לדוגמה</strong><bdi dir="ltr">${e.evidence.workbook}</bdi><span>גיליון ${e.evidence.sheet} · שורה ${e.evidence.row}</span></div><div class="evidence-entry"><strong>אסמכתת שקילה</strong><span>${esc(model.resolutions[e.id]?.proof || e.evidence.weightRef || 'לא נמצאה אסמכתה בדוגמה')}</span></div><h3>כללים קשורים</h3><div class="linked-records">${recordLink('rule-tariff')}${recordLink('rule-proof')}</div>`;
  if (e.source) return `<h3>מקור ההגדרה</h3><p>${esc(e.source)}</p><p class="subtle">אסמכתה סינתטית להמחשת המבנה. לא מסמך שהתקבל מהמועצה.</p>`;
  return `<h3>מקורות מקושרים</h3><div class="linked-records">${(e.sources || []).map(id => recordLink(`source-${id}`, sourceTitle(id))).join('')}</div><p class="subtle">בחיבור האמיתי יישמרו מזהה הרשומה במקור, מיקום הראיה, מועד העדכון והרשאות המקור.</p>`;
}
function auditMarkup(list) {
  return `<ol class="audit-list">${list.map(a => `<li><strong>${esc(a.note)}</strong><span>${esc(a.actor)} · ${Number.isNaN(Date.parse(a.at)) ? '' : date(a.at)}</span></li>`).join('')}</ol>`;
}
function historyView(e) {
  if (e.type !== 'source') return activityWithComments(model, state.role, e.id, auditMarkup);
  const ids = [e.id, ...(e.type === 'site' ? [e.chargeId, ...e.requestIds] : [])];
  const list = visibleAudit().filter(a => ids.includes(a.subject)).reverse();
  return `<h3>פעולות על הרשומה</h3>${list.length ? auditMarkup(list) : '<p class="subtle">עדיין לא בוצעו פעולות על הרשומה בהדגמה.</p>'}<p class="history-note">פעולות ההדגמה נשמרות בכרטיסיית הדפדפן. יומן ארגוני משותף יתווסף בחיבור לשרת.</p>`;
}
function permissionView(e) {
  const financial = e.financial || e.type === 'settlement' || e.type === 'charge' || e.type === 'finding' || e.id === 'rule-tariff' || e.id === 'candidate-tariff';
  return `<h3>גישה לרשומה הזו</h3><dl class="record-facts"><div><dt>צפייה</dt><dd>${financial ? 'מנהל האגף וצוות הכספים' : 'עובדי האגף לפי תפקיד'}</dd></div><div><dt>אישור התאמה</dt><dd>מוטי, מנהל האגף</dd></div><div><dt>עדכון פנייה</dt><dd>מנהל האגף ורכז הפינוי</dd></div></dl><p class="subtle">זו הדמיית תפקיד על נתונים לדוגמה. הרשאות מקור ואכיפה בשרת יתווספו לפני חיבור מידע אמיתי.</p><a class="text-button" href="#/admin/access">לכללי הגישה במרחב ${icon('arrowLeft')}</a>`;
}
function exportPreview() {
  const rows = financeRows(model, state.role);
  return `<section class="export-preview"><div class="surface-heading"><div><h2>הקבצים מוכנים להכנה</h2><p>${rows.length} חיובים נבדקו · ${money(rows.reduce((s, r) => s + r.amount, 0))} לפני מע״מ</p></div><button type="button" class="panel-close" data-export-close aria-label="סגירת הכנת הקבצים">${icon('close')}</button></div><ol><li>סיכום חיובים לפי לקוח</li><li>פירוט כמויות, תעריפים ואסמכתאות</li><li>יומן התאמות ואישורים</li></ol><div class="export-actions"><button class="primary-button" type="button" data-download>${icon('download')}אישור והורדת 3 קובצי CSV</button><span>לא נשלח מידע ל־ERP. הקבצים הם לדוגמה.</span></div></section>`;
}
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
function downloadCsv(filename, rows) {
  const csv = '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const mapConfigPromise = fetch('/api/workspace/config').then(r => { if (!r.ok) throw new Error('לא ניתן לטעון את הגדרות המפה.'); return r.json(); });
async function initializeMap() {
  const element = document.getElementById('collection-map');
  if (!element) return;
  try {
    const config = await mapConfigPromise;
    if (!element.isConnected) return;
    const button = document.querySelector('[data-compare]');
    if (button) { button.disabled = !config.googleMapsBrowserKey; button.title = config.googleMapsBrowserKey ? 'סדר עצירות לפי נתוני כבישים של Google' : 'נדרש מפתח Google Maps עם Routes'; }
    const points = mapPoints();
    const controller = await mountGoogleMap(element, { config, runs: routePlan(points, false).tours, points, improve: state.improved, select: id => openRecord(id), titleFor: p => model.entities[p.siteId].title, onRoutes: result => {
      if (!element.isConnected) return;
      const metrics = document.getElementById('route-metrics');
      const notice = document.getElementById('map-fallback');
      if (result.status === 'ready') {
        metrics.textContent = `${number(result.distanceMeters / 1000)} ק״מ בכבישים · ${Math.ceil(result.durationMillis / 60000)} דקות נסיעה, ללא זמני שירות`;
        document.getElementById('route-stops').innerHTML = routeListMarkup(result.runs);
        notice.hidden = true;
      } else if (result.status === 'setup') {
        metrics.textContent = 'מסלולי נסיעה זמינים בקישורי Google Maps לכל סבב.';
        const reason = config.googleMapsConfigured ? 'המפתח הוגדר. חישוב מסלולים בתוך המפה ממתין לחיבור חשבון חיוב.' : 'נדרש מפתח Maps ו־Routes לחישוב מסלולים בתוך המפה.';
        notice.innerHTML = `<strong>מפת אזור הפינוי</strong><p>${reason} אפשר לפתוח כל סבב ישירות ב־Google Maps.</p><a href="#/admin/connections">הגדרות החיבור</a>`;
        document.querySelector('.map-fixture-label').textContent = 'מפת האזור · המיקומים לדוגמה';
        notice.hidden = false;
      } else {
        metrics.textContent = 'לא התקבלו מרחק וזמן נסיעה.';
        notice.textContent = result.message || 'לא ניתן לחשב את המסלול. בדקו את הגדרות החיבור.';
        notice.hidden = false;
      }
    } });
    if (element.isConnected) activeMap = controller; else controller.destroy();
  } catch (error) {
    if (!element.isConnected) return;
    const metrics = document.getElementById('route-metrics');
    if (metrics) metrics.textContent = error.message;
  }
}

function searchResults(q) {
  const target = document.getElementById('search-results');
  const term = q.trim().toLocaleLowerCase('he');
  if (!term) { target.hidden = true; return; }
  const list = [...Object.values(model.entities), ...memories(model).filter(e => e.type === 'finding')].filter(allowed).filter(e => `${e.title} ${e.id} ${e.summary || ''}`.toLocaleLowerCase('he').includes(term)).slice(0, 7);
  target.innerHTML = list.length ? list.map(e => `<button type="button" data-open="${e.id}"><span>${esc(e.title)}<small>${types[e.type]}</small></span>${icon('arrowLeft')}</button>`).join('') : '<p>לא נמצאו רשומות. נסו שם יישוב, פנייה או כלל.</p>';
  target.hidden = false;
}
function initializeGrids() {
  const settlement = document.getElementById('settlement-grid');
  const service = document.getElementById('requests-grid');
  const access = document.getElementById('access-grid');
  const compact = matchMedia('(max-width: 700px)').matches;
  if (settlement) {
    const rows = charges(model).filter(c => state.filter === 'all' || (state.filter === 'issues' ? !c.resolved : c.resolved)).map(c => ({ id: c.id, recordId: c.id, site: model.entities[c.siteId].title, waste: WASTE[c.waste], quantity: c.quantity, rate: c.rate, amount: amount(c), status: c.resolved ? 'מוכן' : issueNames[c.issue], kind: c.resolved ? 'ready' : c.issue }));
    activeGrid = mountWorkspaceGrid(settlement, { kind: 'settlement', compact, rows, selectedId: route().recordId, openRecord, quickFilter: gridQueries.settlement, columns: compact ? [
      { field: 'site', headerName: 'יישוב / עסק · סכום לחיוב', flex: 1, minWidth: 160, cellRenderer: p => `<div class="compact-grid-identity">${gridRecordButton(p.data.recordId, p.value)}<span class="grid-numeric">${money(p.data.amount)}</span></div>` },
      { field: 'status', headerName: 'מצב', width: 122, minWidth: 110, cellRenderer: p => status(p.data.kind, p.value) },
    ] : [
      { field: 'site', headerName: 'יישוב / עסק', pinned: 'right', width: 180, minWidth: 145, cellRenderer: p => gridRecordButton(p.data.recordId, p.value) },
      { field: 'waste', headerName: 'סוג פסולת', width: 130, minWidth: 110, flex: 1 },
      { field: 'quantity', headerName: 'טונות', width: 95, minWidth: 85, filter: 'agNumberColumnFilter', valueFormatter: p => p.value === null ? 'חסר נתון' : number(p.value), cellClass: 'grid-numeric' },
      { field: 'rate', headerName: '₪ / טונה', width: 100, minWidth: 90, filter: 'agNumberColumnFilter', valueFormatter: p => number(p.value), cellClass: 'grid-numeric' },
      { field: 'amount', headerName: 'סכום לחיוב', width: 135, minWidth: 115, flex: 1, filter: 'agNumberColumnFilter', valueFormatter: p => money(p.value), cellClass: 'grid-numeric' },
      { field: 'status', headerName: 'מצב', width: 145, minWidth: 130, flex: 1, cellRenderer: p => status(p.data.kind, p.value) },
    ] });
  } else if (service) {
    const rows = requests(model).filter(r => state.requestFilter === 'all' || (state.requestFilter === 'open' ? r.state !== 'closed' : r.state === 'closed')).map(r => ({ ...r, recordId: r.id, site: model.entities[r.siteId].title, status: label[r.state] }));
    activeGrid = mountWorkspaceGrid(service, { kind: 'requests', compact, rows, selectedId: route().recordId, openRecord, quickFilter: gridQueries.requests, columns: compact ? [
      { field: 'title', headerName: 'פנייה · יישוב / עסק', flex: 1, minWidth: 180, cellRenderer: p => `<div class="compact-grid-identity">${gridRecordButton(p.data.recordId, p.value)}<span>${esc(p.data.site)}</span></div>` },
      { field: 'status', headerName: 'מצב', width: 88, minWidth: 80, cellRenderer: p => status(p.data.state, p.value) },
    ] : [
      { field: 'title', headerName: 'פנייה', width: 270, minWidth: 190, flex: 2, cellRenderer: p => gridRecordButton(p.data.recordId, p.value) },
      { field: 'site', headerName: 'יישוב / עסק', width: 150, minWidth: 130, cellRenderer: p => gridRecordButton(p.data.siteId, p.value) },
      { field: 'owner', headerName: 'מטפל', width: 125, minWidth: 110, flex: 1 },
      { field: 'status', headerName: 'מצב', width: 110, minWidth: 90, cellRenderer: p => status(p.data.state, p.value) },
      { field: 'opened', headerName: 'נפתחה', width: 100, minWidth: 95, valueFormatter: p => date(p.value) },
    ] });
  } else if (access) {
    const rows = [['חיובים וסכומים', true, true, false], ['אישור התאמה', true, false, false], ['הכנת קובצי כספים', true, true, false], ['מפת נקודות ופניות', true, true, true], ['עדכון טיפול בפנייה', true, false, true]].map(([title, manager, finance, dispatcher], i) => ({ id: `permission-${i}`, title, manager: manager ? 'מותר' : 'ללא גישה', finance: finance ? 'מותר' : 'ללא גישה', dispatcher: dispatcher ? 'מותר' : 'ללא גישה' }));
    activeGrid = mountWorkspaceGrid(access, { kind: 'access', rows, openRecord, columns: [
      { field: 'title', headerName: 'רשומות / פעולה', width: 230, minWidth: 185, flex: 2 },
      { field: 'manager', headerName: 'מנהל האגף', minWidth: 125, flex: 1 },
      { field: 'finance', headerName: 'כספים', minWidth: 110, flex: 1 },
      { field: 'dispatcher', headerName: 'רכז פינוי', minWidth: 125, flex: 1 },
    ] });
  }
}

function render() {
  activeMap?.destroy(); activeMap = null;
  activeGrid?.destroy(); activeGrid = null;
  root.innerHTML = shell();
  syncInspectorMode();
  initializeGrids();
  initializeMap();
  document.title = `${route().path === '/inbox' ? 'לעיוני' : route().path.includes('memory') ? 'זיכרון ארגוני' : route().path.includes('workflows') ? 'תהליכים' : route().path.includes('admin') ? 'ניהול המרחב' : 'עבודת האגף'} · מרחב המועצה`;
}

function syncInspectorMode() {
  const panel = document.querySelector('.record-panel');
  const modal = Boolean(panel && matchMedia('(max-width: 1000px)').matches);
  if (panel) {
    if (modal) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
    else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
  }
  document.querySelectorAll('.workspace-sidebar, .workspace-topbar, .page-body, .workspace-footer, .skip').forEach(el => { el.inert = modal; });
}
window.addEventListener('resize', syncInspectorMode);
matchMedia('(max-width: 700px)').addEventListener('change', render);

document.addEventListener('click', event => {
  const inboxFilter = event.target.closest('[data-inbox-filter]');
  if (inboxFilter) { state.inboxFilter = inboxFilter.dataset.inboxFilter; render(); document.querySelector(`[data-inbox-filter="${state.inboxFilter}"]`)?.focus(); return; }
  const follow = event.target.closest('[data-follow]');
  if (follow) { followRecord(model, follow.dataset.follow, state.role, !isFollowing(model, follow.dataset.follow, state.role)); save(); render(); document.querySelector('[data-follow]')?.focus(); return; }
  const note = event.target.closest('[data-notification]');
  if (note) {
    const n = notificationsFor(model, state.role).find(n => n.id === note.dataset.notification);
    if (!n) return;
    markNotificationRead(model, n.id, state.role); save();
    state.panelTab = n.commentId ? 'conversation' : 'overview'; state.threadPart = '';
    if (route().recordId === n.subject) { render(); document.getElementById('record-title')?.focus(); }
    else location.hash = `${route().path}?record=${encodeURIComponent(n.subject)}`;
    return;
  }
  const thread = event.target.closest('[data-open-thread], [data-workflow-thread]');
  if (thread) {
    const id = thread.dataset.openThread || thread.dataset.workflowThread;
    state.panelTab = 'conversation'; state.threadPart = thread.dataset.threadPart || '';
    if (route().recordId === id) { render(); document.querySelector('#record-comment textarea')?.focus(); }
    else location.hash = `${route().path}?record=${encodeURIComponent(id)}`;
    return;
  }

  if (event.target.closest('.skip')) { event.preventDefault(); document.getElementById('main-content')?.focus(); return; }
  const open = event.target.closest('[data-open]');
  if (open) { openRecord(open.dataset.open, open); return; }
  if (event.target.closest('[data-close]')) { closeRecord(); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.filter = filter.dataset.filter; render(); document.querySelector(`[data-filter="${state.filter}"]`)?.focus(); return; }
  const requestsFilter = event.target.closest('[data-requests-filter]');
  if (requestsFilter) { state.requestFilter = requestsFilter.dataset.requestsFilter; render(); return; }
  const memoryFilter = event.target.closest('[data-memory-filter]');
  if (memoryFilter) { state.memoryFilter = memoryFilter.dataset.memoryFilter; render(); return; }
  const panelTab = event.target.closest('[data-panel-tab]');
  if (panelTab) { state.panelTab = panelTab.dataset.panelTab; render(); document.getElementById(`panel-tab-${state.panelTab}`)?.focus(); return; }
  const workflow = event.target.closest('[data-workflow]');
  if (workflow) { state.workflow = workflow.dataset.workflow; state.workflowStep = null; render(); document.querySelector(`[data-workflow="${state.workflow}"]`)?.focus(); return; }
  const step = event.target.closest('[data-workflow-step]');
  if (step) { state.workflowStep = Number(step.dataset.workflowStep); render(); document.querySelector(`[data-workflow-step="${state.workflowStep}"]`)?.focus(); return; }
  if (event.target.closest('[data-compare]')) { state.improved = !state.improved; render(); return; }
  if (event.target.closest('[data-map-fit]')) { activeMap?.fit(); return; }
  const locate = event.target.closest('[data-locate]');
  if (locate) { location.hash = `/work/map?record=${locate.dataset.locate}`; return; }
  const next = event.target.closest('[data-request-next]');
  if (next) {
    try { updateRequest(model, next.dataset.requestNext, state.role, next.dataset.next); save(); render(); document.getElementById('record-title')?.focus(); notify('מצב הפנייה עודכן בהדגמה.'); } catch (e) { notify(e.message, true); }
    return;
  }
  if (event.target.closest('[data-grid-reset]')) { const kind = route().path.endsWith('/requests') ? 'requests' : 'settlement'; gridQueries[kind] = ''; activeGrid?.reset(); render(); return; }
  if (event.target.closest('[data-export]')) {
    try { financeRows(model, state.role); state.exportOpen = true; render(); document.querySelector('.export-preview')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { notify(e.message, true); }
    return;
  }
  if (event.target.closest('[data-export-close]')) { state.exportOpen = false; render(); return; }
  if (event.target.closest('[data-download]')) {
    try {
      const rows = financeRows(model, state.role);
      downloadCsv('settlement-summary-2026-09.csv', [['יישוב / עסק', 'סכום לפני מעמ'], ...rows.map(r => [r.site, r.amount])]);
      downloadCsv('settlement-detail-2026-09.csv', [['מזהה', 'יישוב / עסק', 'טונות', 'תעריף', 'סכום', 'מקור', 'אסמכתת שקילה'], ...rows.map(r => [r.id, r.site, r.quantity, r.tariff, r.amount, r.source, r.proof])]);
      downloadCsv('settlement-decisions-2026-09.csv', [['רשומה', 'החלטה', 'מאשר', 'מועד'], ...model.audit.map(a => [a.subject, a.note, a.actor, a.at])]);
      model.prepared = true; save(); state.exportOpen = false; render(); notify('הוכנו 3 קובצי CSV לדוגמה. הדפדפן עשוי לבקש לאפשר הורדות מרובות.');
    } catch (e) { notify(e.message, true); }
    return;
  }
  if (event.target.closest('[data-reset]')) {
    Object.assign(model, createWorkspace()); state.exportOpen = false; save(); render(); notify('פעולות ההדגמה אופסו.'); return;
  }
  if (!event.target.closest('.search-wrap')) { const r = document.getElementById('search-results'); if (r) r.hidden = true; }
});
document.addEventListener('input', event => {
  if (event.target.id === 'global-search') searchResults(event.target.value);
  if (event.target.id === 'grid-filter') { const kind = route().path.endsWith('/requests') ? 'requests' : 'settlement'; gridQueries[kind] = event.target.value; activeGrid?.search(event.target.value); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'role-select') {
    state.role = event.target.value; state.exportOpen = false; save();
    if (!ROLES[state.role].finance && route().path === '/work/settlement') navigate('/work/map');
    else { history.replaceState(null, '', `${location.pathname}#${route().path}`); render(); }
  }
  if (event.target.id === 'waste-select') { state.mapWaste = event.target.value; render(); }
  if (event.target.id === 'map-issues') { state.mapIssues = event.target.checked; render(); }
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!['record-comment', 'approval-decision'].includes(form.id)) return;
  event.preventDefault();
  const data = new FormData(form);
  try {
    if (form.id === 'record-comment') {
      addComment(model, form.dataset.subject, state.role, data.get('body'), data.getAll('mentions'), data.get('part'));
      save(); render(); document.querySelector('#record-comment textarea')?.focus(); notify('התגובה נוספה לשיחה בהדגמה.');
    } else {
      decideApproval(model, form.dataset.approval, state.role, event.submitter?.value || 'approved', { ...Object.fromEntries(data), version: Number(data.get('version')) });
      save(); render(); document.getElementById('record-title')?.focus(); notify('ההחלטה נשמרה ובקשת האישור עודכנה.');
    }
  } catch (error) { form.querySelector('.form-error').textContent = error.message; }

});
document.addEventListener('keydown', event => {
  const dialog = document.querySelector('.record-panel[aria-modal="true"]');
  if (dialog && event.key === 'Tab') {
    const stops = [...dialog.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), a[href], input, select, textarea')];
    const first = stops[0], last = stops.at(-1);
    if (event.shiftKey && (document.activeElement === first || !stops.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !stops.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('global-search')?.focus(); }
  if (event.key === 'Escape') {
    const results = document.getElementById('search-results');
    if (results && !results.hidden) results.hidden = true; else if (route().recordId) closeRecord();
  }
  const tab = event.target.closest('[data-panel-tab]');
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-panel-tab]')];
    const i = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
  }
});
window.addEventListener('hashchange', () => {
  state.exportOpen = false;
  render();
  if (route().recordId) document.getElementById('record-title')?.focus();
});
if (!location.hash) history.replaceState(null, '', '#/work/settlement');
render();
if (restoreWarning) notify('חלק מפעולות ההדגמה השמורות לא נטענו. אפשר לאפס אותן בניהול המרחב.', true);
