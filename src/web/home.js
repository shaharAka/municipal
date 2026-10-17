import {
  esc,
  num,
  icon,
  initials,
  toast,
  openSheet,
  setSheetBody,
  closeSheet,
  errorBox,
  skeleton,
  parsePerson,
  roleKind,
  navFor,
  NAV,
} from './ui.js';
import * as views from './views.js';
import * as value from './value.js';
import * as demo from './demo.js';

const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  viewers: null,
  role: null,
  roleLabel: '',
  tab: 'home',
  filter: 'all',
  approvalPick: '',
  service: 'LIC',
  ws: { tab: 'mail', msg: 0, doc: 0 },
  cache: new Map(),
  shell: null,
  answer: null,
  approvals: null,
  interview: null,
  sheetDirty: false,
  formSubjects: [],
  find: null,
  signedIn: false,
  demo: null,
};

/* --------------------------------------------------------------------- data */

async function api(path, options = {}) {
  const url = new URL(path, location.origin);
  if (state.role) url.searchParams.set('viewer', state.role);
  const key = url.pathname + url.search;
  const cacheable = !options.method || String(options.method).toUpperCase() === 'GET';
  if (cacheable && state.cache.has(key)) return state.cache.get(key);
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`תגובה לא תקינה מהשרת (${response.status})`);
  }
  if (!response.ok) throw new Error(body?.error ?? `שגיאה ${response.status}`);
  if (cacheable) state.cache.set(key, body);
  return body;
}

const postJson = (path, body) =>
  api(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

function invalidate() {
  state.cache.clear();
  state.shell = null;
}

function tabFromHash() {
  const id = location.hash.replace(/^#\/?/, '');
  return NAV[id] ? id : 'home';
}

function allowedTab(tab) {
  if (!state.role) return false;
  return navFor(roleKind(state.roleLabel)).includes(tab);
}

function setUrlRole(role) {
  const url = new URL(location.href);
  if (role) url.searchParams.set('role', role);
  else url.searchParams.delete('role');
  history.replaceState(null, '', url);
}

/* -------------------------------------------------------------------- boot */

async function boot() {
  state.tab = tabFromHash();
  const roleParam = new URLSearchParams(location.search).get('role');
  try {
    const viewerData = await api('/api/viewers');
    state.viewers = viewerData.viewers ?? [];
  } catch {
    state.viewers = [];
  }
  if (roleParam) {
    const viewer = state.viewers.find((v) => v.id === roleParam);
    if (viewer) {
      state.role = viewer.id;
      state.roleLabel = viewer.label;
      state.signedIn = true;
      if (!allowedTab(state.tab)) state.tab = 'home';
    }
  }
  await render();
}

/* ------------------------------------------------------------------ render */

async function render() {
  document.body.dataset.mode = state.role ? 'app' : 'landing';
  if (!state.role) {
    await renderLanding();
    return;
  }
  try {
    await ensureShell();
    renderChrome();
    await renderMain();
  } catch (error) {
    const main = $('#main');
    if (main) main.innerHTML = errorBox(error.message);
  }
}

async function renderLanding() {
  const main = $('#main');
  if (!main) return;
  main.innerHTML = `<div class="landing-loading"><span class="mark">${icon('building')}</span><p>טוען את מפת העיר…</p></div>`;
  try {
    const [viewers, answer, overview, approvals, rights, meetings] = await Promise.all([
      api('/api/viewers').catch(() => ({ viewers: state.viewers ?? [] })),
      api('/api/answer').catch(() => null),
      api('/api/overview').catch(() => null),
      api('/api/approvals?scope=all').catch(() => null),
      api('/api/rights').catch(() => null),
      api('/api/meetings').catch(() => null),
    ]);
    state.viewers = viewers.viewers ?? [];
    main.innerHTML = views.landingView({ viewers: state.viewers, answer, overview, approvals, rights, meetings });
    document.title = 'כניסה · מערכת המידע העירונית';
    const sidebar = $('#sidebar');
    if (sidebar) sidebar.innerHTML = '';
    const topbar = $('#topbar');
    if (topbar) topbar.innerHTML = '';
  } catch (error) {
    main.innerHTML = errorBox(error.message, '<button class="btn" type="button" data-retry>ניסיון נוסף</button>');
  }
}

async function ensureShell() {
  if (state.shell) return state.shell;
  const [connectors, approvals] = await Promise.all([api('/api/connectors'), api('/api/approvals')]);
  state.shell = { connectors, approvals };
  state.approvals = approvals;
  return state.shell;
}

function renderChrome() {
  const sidebar = $('#sidebar');
  const topbar = $('#topbar');
  if (!sidebar || !topbar) return;
  const kind = roleKind(state.roleLabel);
  const tabs = navFor(kind);
  if (!tabs.includes(state.tab)) state.tab = 'home';
  const person = parsePerson(state.roleLabel);
  const pending = Number(state.shell?.approvals?.counts?.total ?? 0);
  const sources = state.shell?.connectors?.sources ?? [];
  const connected = sources.filter((source) => source.enabled).length;

  sidebar.innerHTML = `
    <a class="side-brand" href="#/home" aria-label="בית">
      <span class="mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-5h6v5"/></svg>
      </span>
      <span class="side-brand-text"><strong>גבעת רימון</strong><span>תברואה ובריאות</span></span>
    </a>

    <nav class="side-nav" aria-label="ניווט ראשי">
      <p class="side-label">העבודה שלי</p>
      ${tabs
        .filter((id) => ['home', 'rights', 'meetings', 'approvals', 'insights'].includes(id))
        .map(
          (id) => `<a class="nav-item ${state.tab === id ? 'is-active' : ''}" href="#/${id}" aria-label="${NAV[id].label}" title="${NAV[id].label}" ${state.tab === id ? 'aria-current="page"' : ''}>
            ${icon(NAV[id].icon)}<span>${NAV[id].label}</span>
            ${id === 'approvals' && pending ? `<b class="nav-badge">${num(pending)}</b>` : ''}
          </a>`,
        )
        .join('')}
      <p class="side-label">מערכות ומקורות</p>
      ${tabs
        .filter((id) => ['sources', 'workspace'].includes(id))
        .map(
          (id) => `<a class="nav-item ${state.tab === id ? 'is-active' : ''}" href="#/${id}" aria-label="${NAV[id].label}" title="${NAV[id].label}" ${state.tab === id ? 'aria-current="page"' : ''}>
            ${icon(NAV[id].icon)}<span>${NAV[id].label}</span>
          </a>`,
        )
        .join('')}
    </nav>

    <div class="side-sources">
      <div class="side-sources-head"><span class="dot ${connected ? 'dot-live' : ''}"></span><span>${num(connected)} מתוך ${num(sources.length)} מקורות מחוברים</span></div>
      <div class="side-source-dots">${sources.map((source) => `<span class="source-dot ${source.enabled ? 'is-on' : ''}" title="${esc(source.nameHe)}"></span>`).join('')}</div>
      <a class="text-link" href="#/sources">לניהול המקורות ${icon('arrowLeft')}</a>
    </div>

    <div class="side-bottom">
      <button class="user-card" type="button" data-switch-role aria-label="החלפת זהות">
        <span class="avatar avatar-2">${esc(initials(person.name))}</span>
        <span class="user-copy"><strong>${esc(person.name)}</strong><span>${esc(person.title)}</span></span>
        ${icon('switch', 'user-switch')}
      </button>
      <a class="analyst-link" href="./workbench.html">${icon('layers')} תצוגת אנליטיקאי</a>
    </div>`;

  topbar.innerHTML = `
    <div class="crumbs"><span>גבעת רימון</span><span class="crumb-sep">/</span><strong>${esc(NAV[state.tab]?.label ?? 'בית')}</strong></div>
    <div class="top-actions">
      <button class="search-trigger" type="button" data-open-palette aria-label="שאלו או חפשו">
        ${icon('search')}<span>שאלו או חפשו</span><kbd>⌘K</kbd>
      </button>
      <button class="btn btn-quiet btn-small demo-trigger" type="button" data-demo-open aria-label="סיור מודרך">
        ${icon('spark')}<span>סיור</span>
      </button>
      <button class="user-btn" type="button" data-switch-role aria-label="החלפת זהות">
        <span class="avatar avatar-2">${esc(initials(person.name))}</span>
        <span>${esc(person.name)}</span>${icon('chevronDown')}
      </button>
    </div>`;
}

async function renderMain() {
  const main = $('#main');
  if (!main) return;
  if (!allowedTab(state.tab)) state.tab = 'home';
  const kind = roleKind(state.roleLabel);
  let timer = setTimeout(() => {
    if (main) main.innerHTML = skeleton(state.tab === 'home' ? 'home' : 'cards');
  }, 180);
  try {
    let html = '';
    if (state.tab === 'home') {
      const [overview, answer, org, process, interviews, valueStrip] = await Promise.all([
        api('/api/overview'),
        api('/api/answer'),
        api('/api/org'),
        api('/api/process?service=LIC'),
        api('/api/interviews'),
        value.homeStrip({ api, kind }).catch(() => ''),
      ]);
      state.answer = answer;
      const approvals = state.shell.approvals;
      const gap = approvals.pending.find((item) => item.kind === 'gap') ?? null;
      html = views.homeView({
        viewer: { id: state.role, label: state.roleLabel },
        kind,
        overview,
        answer,
        org,
        process,
        approvals,
        interviews,
        connectors: state.shell.connectors,
        gap,
        valueStrip,
      });
    } else if (state.tab === 'approvals') {
      const approvals = await api('/api/approvals');
      state.shell = { ...state.shell, approvals };
      state.approvals = approvals;
      html = views.approvalsView({ approvals, filter: state.filter, pick: state.approvalPick, showOrg: navFor(kind).includes('insights') });
    } else if (state.tab === 'insights') {
      const [overview, org, process] = await Promise.all([
        api('/api/overview'),
        api('/api/org'),
        api(`/api/process?service=${encodeURIComponent(state.service)}`),
      ]);
      html = views.insightsView({
        overview,
        org,
        process,
        service: state.service,
        proposals: process.proposals ?? [],
        canApprove: navFor(kind).includes('approvals'),
      });
    } else if (state.tab === 'sources') {
      const connectors = await api('/api/connectors');
      state.shell = { ...state.shell, connectors };
      html = views.sourcesView({ connectors, showInsights: navFor(kind).includes('insights'), kind });
    } else if (state.tab === 'rights' || state.tab === 'meetings') {
      value.bind({ api, kind, refresh: async () => { invalidate(); await render(); } });
      html = state.tab === 'rights' ? await value.rightsPage() : await value.meetingsPage();
    } else if (state.tab === 'workspace') {
      const [outlook, doclib] = await Promise.all([api('/api/outlook'), api('/api/doclib')]);
      html = views.workspaceView({ outlook, doclib, ws: state.ws, kind });
    }
    clearTimeout(timer);
    timer = null;
    main.innerHTML = `<div class="view-enter">${html}</div>`;
    document.title = `${NAV[state.tab]?.label ?? 'בית'} · מערכת המידע העירונית`;
    if (state.tab === 'approvals') renderChrome();
  } catch (error) {
    clearTimeout(timer);
    timer = null;
    main.innerHTML = errorBox(error.message, '<button class="btn" type="button" data-retry>ניסיון נוסף</button>');
  }
}

/* --------------------------------------------------------------- interaction */

async function selectRole(id, label, { tab = 'home' } = {}) {
  stopDemo();
  state.role = id;
  state.roleLabel = label || state.viewers?.find((v) => v.id === id)?.label || '';
  state.signedIn = true;
  state.tab = tab;
  state.answer = null;
  state.filter = 'all';
  state.approvalPick = '';
  state.service = 'LIC';
  state.ws = { tab: 'mail', msg: 0, doc: 0 };
  invalidate();
  setUrlRole(id);
  const url = new URL(location.href);
  url.hash = `#/${tab}`;
  history.replaceState(null, '', url);
  closeSheet();
  await render();
}

function exitRole() {
  stopDemo();
  state.role = null;
  state.roleLabel = '';
  state.signedIn = false;
  invalidate();
  setUrlRole(null);
  history.replaceState(null, '', location.pathname);
  closeSheet();
  render();
}

function openDemo() {
  stopDemo();
  openSheet({
    title: 'סיור מודרך',
    eyebrow: 'ארבעה תרחישים · ארבעה מסכים אמיתיים',
    body: demo.hubBody(),
    wide: true,
  });
}

const waitFor = async (selector, timeout = 2600) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const found = document.querySelector(selector);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return null;
};

async function runDemoAction(action) {
  if (!action) return true;
  if (action.kind === 'palette') {
    openPalette(action.question);
    return true;
  }
  const target = await waitFor(action.selector);
  if (!target) return false;
  if (action.kind === 'focus') {
    target.classList.add('is-demo-focus');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => target.classList.remove('is-demo-focus'), 5200);
    return true;
  }
  target.click();
  return true;
}

async function startDemo(id) {
  const scenario = demo.scenarioById(id);
  if (!scenario) return;
  const viewer = (state.viewers ?? []).find((entry) => roleKind(entry.label) === scenario.roleKind);
  if (!viewer) {
    toast('לא נמצא תפקיד מתאים לתרחיש הזה.', 'error');
    return;
  }
  closeSheet();
  if (state.role !== viewer.id) {
    await selectRole(viewer.id, viewer.label, { tab: scenario.tab });
  } else if (state.tab !== scenario.tab) {
    state.tab = scenario.tab;
    const url = new URL(location.href);
    url.hash = `#/${scenario.tab}`;
    history.replaceState(null, '', url);
    renderChrome();
    await renderMain();
    window.scrollTo({ top: 0 });
  }
  const ran = await runDemoAction(scenario.action);
  if (!ran) {
    toast('התרחיש לא מצא את היעד במסך. נסו שוב מהסיור.', 'error');
    return;
  }
  state.demo = { id: scenario.id, step: 0 };
  renderDemoCoach();
}

function renderDemoCoach() {
  const run = state.demo;
  if (!run) return;
  const scenario = demo.scenarioById(run.id);
  const step = scenario?.steps?.[run.step];
  if (!scenario || !step) {
    stopDemo();
    return;
  }
  let coach = document.getElementById('demo-coach');
  if (!coach) {
    coach = document.createElement('aside');
    coach.id = 'demo-coach';
    coach.className = 'demo-coach';
    coach.setAttribute('aria-live', 'polite');
    document.body.append(coach);
  }
  const last = run.step === scenario.steps.length - 1;
  coach.innerHTML = `
    <div class="demo-coach-top">
      <span>${icon('spark')} סיור · ${esc(scenario.titleHe)}</span>
      <button class="demo-coach-exit" type="button" data-demo-stop aria-label="יציאה מהסיור">${icon('close')}</button>
    </div>
    <div class="demo-coach-progress">
      <b>שלב ${num(run.step + 1)} מתוך ${num(scenario.steps.length)}</b>
      <span class="demo-dots" aria-hidden="true">${scenario.steps.map((_, index) => `<i class="${index <= run.step ? 'is-done' : ''}"></i>`).join('')}</span>
    </div>
    <p class="demo-coach-text">${esc(step.textHe)}</p>
    <div class="demo-coach-actions">
      ${run.step > 0 ? `<button class="btn btn-quiet btn-small" type="button" data-demo-back>${icon('arrowRight')} חזור</button>` : ''}
      <button class="btn btn-small" type="button" data-demo-next>${last ? 'סיום' : 'השלב הבא'} ${last ? icon('check') : icon('arrowLeft')}</button>
    </div>`;
  document.querySelectorAll('.is-demo-focus').forEach((element) => element.classList.remove('is-demo-focus'));
  const target = step.selector ? document.querySelector(step.selector) : null;
  if (target) {
    target.classList.add('is-demo-focus');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function stopDemo() {
  state.demo = null;
  document.querySelectorAll('.is-demo-focus').forEach((element) => element.classList.remove('is-demo-focus'));
  document.getElementById('demo-coach')?.remove();
}

function advanceDemo(delta) {
  const run = state.demo;
  if (!run) return;
  const scenario = demo.scenarioById(run.id);
  if (!scenario) {
    stopDemo();
    return;
  }
  const next = run.step + delta;
  if (next < 0) return;
  if (next >= scenario.steps.length) {
    stopDemo();
    return;
  }
  state.demo = { ...run, step: next };
  renderDemoCoach();
}

function openRoleSheet() {
  if (!state.viewers?.length) return;
  openSheet({ title: 'החלפת זהות', eyebrow: 'המשך העבודה', body: views.roleSheetBody(state.viewers), wide: true });
}

function openExplain() {
  openSheet({ title: 'איך חושב המספר', eyebrow: 'שקיפות מלאה', body: '<p class="muted">אוסף את הראיות…</p>', wide: true });
  const answer = state.answer;
  if (answer) {
    setSheetBody(views.explainBody(answer));
    return;
  }
  api('/api/answer')
    .then((fresh) => setSheetBody(views.explainBody(fresh)))
    .catch((error) => setSheetBody(errorBox(error.message)));
}

async function openGap(gapRef) {
  if (!gapRef) return;
  openSheet({ title: 'שליחת שאלה', eyebrow: 'סגירת פער', body: '<p class="muted">מכין את השאלות מהפער…</p>', wide: true });
  try {
    const result = await postJson('/api/interviews/open', { gapRef });
    if (!result.interview) {
      setSheetBody(errorBox(result.reason ?? 'לא נמצא אדם שיכול לענות.'));
      return;
    }
    if (result.sent) {
      invalidate();
      state.sheetDirty = true;
      const count = Number(result.interview.attentionCost ?? result.interview.questions?.length ?? 0);
      setSheetBody(`
        <div class="result-hero"><span class="result-icon">${icon('mail')}</span><div><h3>השאלה נשלחה ל${esc(result.interview.personName)}</h3><p>${num(count)} שאלות עם הניחוש שלנו. התשובה תירשם על שמו; אין אפשרות לענות במקומו.</p></div></div>
        <p class="sheet-note">${icon('clock')} הפער יישאר פתוח עד שתחזור תשובה. אפשר לעקוב אחריו במרכז ההכרעות.</p>
        <div class="sheet-actions"><button class="btn" type="button" data-close-sheet>סגור</button></div>`);
      document.getElementById('sheet-title').textContent = result.existing ? 'השאלה כבר ממתינה' : 'השאלה נשלחה';
      document.getElementById('sheet-eyebrow').textContent = 'ממתין לתשובה';
      return;
    }
    state.interview = result.interview;
    setSheetBody(views.interviewBody(result.interview));
    document.getElementById('sheet-title').textContent = `שאלה קצרה ל${result.interview.personName}`;
    document.getElementById('sheet-eyebrow').textContent = result.existing ? 'שאלה שכבר פתוחה' : 'סגירת פער';
  } catch (error) {
    setSheetBody(errorBox(error.message));
  }
}

async function openOwnInterview(ref) {
  openSheet({ title: 'השאלות שממתינות לך', eyebrow: 'סגירת פער', body: '<p class="muted">טוען את השאלות…</p>', wide: true });
  try {
    const data = await api('/api/interviews');
    const interview = (data.interviews ?? []).find((item) => item.ref === ref && item.status === 'open');
    if (!interview) {
      setSheetBody(errorBox('השאלה כבר נסגרה או שאינה פתוחה יותר.'));
      return;
    }
    state.interview = interview;
    setSheetBody(views.interviewBody(interview));
  } catch (error) {
    setSheetBody(errorBox(error.message));
  }
}

async function submitInterview(form) {
  const ref = form.dataset.ref;
  const answers = {};
  const data = new FormData(form);
  for (const [key, value] of data.entries()) answers[key] = value;
  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'שולח…';
  }
  try {
    const result = await postJson('/api/interviews/answer', { ref, answers });
    invalidate();
    setSheetBody(views.interviewResultBody(result));
    document.getElementById('sheet-title').textContent = 'התשובה נשמרה';
    document.getElementById('sheet-eyebrow').textContent = 'ראיה חדשה';
    toast('התשובה נרשמה כראיה');
  } catch (error) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'שליחת התשובה';
    }
    setSheetBody(errorBox(error.message));
  }
}

async function openMyResponsibilities() {
  openSheet({ title: 'האחריויות שלך', eyebrow: 'מה למדנו מהעבודה', body: '<p class="muted">אוסף את מה שנגזר מהעבודה שלך…</p>', wide: true });
  try {
    const org = await api('/api/org');
    setSheetBody(views.myResponsibilitiesBody(org, state.role));
  } catch (error) {
    setSheetBody(errorBox(error.message));
  }
}

async function confirmResponsibility(button) {
  const row = button.closest('[data-resp-row]');
  const ref = button.dataset.respRef;
  const accept = button.dataset.respConfirm === 'accept';
  if (!ref || button.disabled) return;
  row?.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    await postJson(`/api/responsibilities/${encodeURIComponent(ref)}/confirm`, { accept });
    invalidate();
    state.sheetDirty = true;
    const pill = row?.querySelector('.status-pill');
    if (pill) {
      pill.className = `status-pill ${accept ? 'status-on' : ''}`;
      pill.textContent = accept ? 'אושר' : 'לא מדויק';
    }
    row?.querySelector('.resp-actions')?.remove();
    toast(accept ? 'האחריות אושרה ונרשמה החלטה' : 'סומן כלא מדויק. האחריות נשארת כהצעה.');
  } catch (error) {
    row?.querySelectorAll('button').forEach((b) => (b.disabled = false));
    toast(error.message, 'error');
  }
}

async function openForm(type, kind, only = '') {
  openSheet({ title: 'טופס מהמודל', eyebrow: `טופס ${kind === 'application' ? 'בקשה' : 'פנימי'} · ${type}`, body: '<p class="muted">בונה את הטופס מהמודל…</p>', wide: true });
  try {
    const [formData, pages] = await Promise.all([
      api(`/api/forms?type=${encodeURIComponent(type)}&kind=${encodeURIComponent(kind)}${only ? `&only=${encodeURIComponent(only)}` : ''}`),
      api(`/api/pages?type=${encodeURIComponent(type)}`),
    ]);
    state.formSubjects = (pages.pages ?? []).slice(0, 12);
    if (!state.formSubjects.length) {
      setSheetBody(errorBox('אין רשומה מסוג זה למלא עליה.'));
      return;
    }
    setSheetBody(views.formBody(formData.form, state.formSubjects, { type, kind }));
  } catch (error) {
    setSheetBody(errorBox(error.message));
  }
}

function fillFormFields(subject) {
  const form = document.getElementById('form-submit');
  if (!form) return;
  const properties = subject.properties ?? {};
  form.querySelectorAll('[data-field]').forEach((control) => {
    const value = properties[control.dataset.field];
    if (value === undefined || value === null) return;
    if (control.type === 'checkbox') control.checked = value === true || value === 'true';
    else control.value = String(value);
  });
}

async function submitForm(form) {
  const data = new FormData(form);
  const subject = String(data.get('__subject') ?? '');
  const values = {};
  form.querySelectorAll('[data-field]').forEach((control) => {
    if (control.type === 'checkbox') values[control.dataset.field] = control.checked;
    else if (control.value !== '') values[control.dataset.field] = control.type === 'number' ? Number(control.value) : control.value;
  });
  const submit = form.querySelector('button[type="submit"]');
  const problems = document.getElementById('form-problems');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'שומר…';
  }
  if (problems) problems.innerHTML = '';
  try {
    const result = await postJson('/api/forms/submit', {
      type: form.dataset.type,
      kind: form.dataset.kind,
      subject,
      values,
    });
    invalidate();
    state.sheetDirty = true;
    const subjectTitle = state.formSubjects.find((s) => s.ref === subject)?.title ?? subject;
    setSheetBody(views.formResultBody(result, subjectTitle));
    document.getElementById('sheet-title').textContent = 'הטופס נשמר';
    toast('הערכים נשמרו על הרשומה');
  } catch (error) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'שמירה על הרשומה';
    }
    if (problems) problems.innerHTML = `<div class="inline-warn">${icon('alert')} ${esc(error.message)}</div>`;
  }
}

async function openPalette(seed = '') {
  openSheet({
    title: 'שאלו או חפשו',
    eyebrow: 'מספר, כלל ומקור — או חיפוש בכל המערכות',
    body: `
      <form class="palette-form" id="palette-form" role="search">
        <span class="ask-input-wrap">${icon('search')}<input id="palette-input" name="q" type="search" autocomplete="off" placeholder="למשל: רישיון, הנחה, פיקוח" value="${esc(seed)}" /></span>
        <button class="btn" type="submit">חיפוש</button>
      </form>
      <p class="palette-hint">${icon('info')} שאלה נתמכת מקבלת תשובה עם כלל ומקור; אחרת המערכת מחפשת בכל המערכות. התוצאות מסוננות לפי ההרשאה שלך.</p>
      <div id="palette-results"></div>`,
    wide: true,
  });
  setTimeout(() => document.getElementById('palette-input')?.focus(), 30);
  if (seed.trim()) runPaletteQuery(seed);
}

async function runPaletteQuery(query) {
  const out = document.getElementById('palette-results');
  if (out) out.innerHTML = '<p class="muted">מחפש תשובה מוצהרת…</p>';
  try {
    const answer = await api('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: query }),
    });
    state.answer = answer;
    const allGap = state.approvals?.pending?.find((item) => item.kind === 'gap') ?? null;
    const kind = roleKind(state.roleLabel);
    const gap = allGap && (kind !== 'rule' || allGap.interview) ? allGap : null;
    if (answer.refused && !answer.assistant) {
      const results = await api('/api/find?q=' + encodeURIComponent(query));
      state.find = results;
      if (out) out.innerHTML = views.answerCard(answer, { gap }) + views.inlineResults(results);
    } else if (out) {
      out.innerHTML = views.answerCard(answer, { gap });
    }
  } catch (error) {
    if (out) out.innerHTML = errorBox(error.message);
  }
}

async function openSource(type, ref) {
  try {
    if (type === 'message') {
      const outlook = await api('/api/outlook');
      if (!outlook.connected) {
        closeSheet();
        toast('הדואר לא מחובר. חברו את המקור כדי להציג את ההודעה.', 'error');
        location.hash = '#/sources';
        return;
      }
      const index = (outlook.messages ?? []).findIndex((message) => message.graphRef === ref);
      state.ws = { ...state.ws, tab: 'mail', msg: Math.max(0, index) };
    } else {
      const doclib = await api('/api/doclib');
      if (!doclib.connected) {
        closeSheet();
        toast('ספריית המסמכים לא מחוברת. חברו את המקור כדי להציג את המסמך.', 'error');
        location.hash = '#/sources';
        return;
      }
      const index = (doclib.documents ?? []).findIndex((document) => document.graphRef === ref);
      state.ws = { ...state.ws, tab: 'docs', doc: Math.max(0, index) };
    }
    closeSheet();
    if (location.hash === '#/workspace') await renderMain();
    else location.hash = '#/workspace';
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function openRecord(ref) {
  openSheet({ title: 'מה המערכת למדה', eyebrow: 'רשומה', body: '<p class="muted">קורא את הרשומה…</p>', wide: true });
  try {
    const page = await api('/api/page?ref=' + encodeURIComponent(ref));
    setSheetBody(views.recordBody(page));
    document.getElementById('sheet-title').textContent = page.title;
  } catch (error) {
    setSheetBody(errorBox(error.message));
  }
}

async function approve(kind, id, button) {
  if (!id || button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.dataset.label = button.textContent;
    button.textContent = 'רושם…';
  }
  try {
    if (kind === 'automation') await postJson(`/api/automations/${encodeURIComponent(id)}/approve`);
    else if (kind === 'suggestion') await postJson(`/api/suggestions/${encodeURIComponent(id)}/approve`);
    else if (kind === 'property') await postJson('/api/candidates/accept', { id });
    else throw new Error('סוג החלטה לא נתמך');
    invalidate();
    state.approvalPick = '';
    toast(kind === 'property' ? 'המאפיין נוסף לשכבת ההרחבה של העיר' : 'ההחלטה נרשמה על שם המאשר');
    const card = button?.closest('[data-approval-id]');
    if (card) {
      card.classList.add('is-leaving');
      await new Promise((resolve) => setTimeout(resolve, 240));
    }
    await ensureShell();
    renderChrome();
    await renderMain();
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.label ?? 'אישור';
    }
    toast(error.message, 'error');
  }
}

async function approveSuggestion(id, button) {
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.textContent = 'רושם…';
  }
  try {
    await postJson(`/api/suggestions/${encodeURIComponent(id)}/approve`);
    invalidate();
    toast('ההצעה אושרה ונרשמה החלטה');
    await ensureShell();
    renderChrome();
    await renderMain();
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = 'אישור';
    }
    toast(error.message, 'error');
  }
}

async function applySourceToggle(id, enabled) {
  const card = document.querySelector(`.source-card [data-source-toggle="${CSS.escape(id)}"]`)?.closest('.source-card');
  if (card) card.classList.add('is-busy');
  try {
    await postJson(`/api/connectors/${encodeURIComponent(id)}/toggle`, { enabled });
    invalidate();
    toast(enabled ? 'המקור חובר. המחקר מתחיל להציע.' : 'המקור נותק. הנתונים שלמדנו נשארו במודל.');
    await ensureShell();
    renderChrome();
    await renderMain();
  } catch (error) {
    if (card) card.classList.remove('is-busy');
    toast(error.message, 'error');
  }
}

async function toggleSource(id, button) {
  const source = state.shell?.connectors?.sources.find((entry) => entry.id === id);
  if (!source) return;
  const enabled = !source.enabled;
  if (enabled && source.consent) {
    openSheet({
      title: `חיבור ${source.nameHe}`,
      eyebrow: 'לפני שהמערכת קוראת',
      body: views.sourceConsentBody(source),
      wide: true,
    });
    return;
  }
  if (button) button.disabled = true;
  await applySourceToggle(id, enabled);
}

/* ------------------------------------------------------------------- events */

document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-demo-stop]')) {
    stopDemo();
    return;
  }
  if (event.target.closest('[data-demo-back]')) {
    advanceDemo(-1);
    return;
  }
  if (event.target.closest('[data-demo-next]')) {
    advanceDemo(1);
    return;
  }
  if (event.target.closest('[data-demo-open]')) {
    openDemo();
    return;
  }
  const demoStart = event.target.closest('[data-demo-start]');
  if (demoStart) {
    startDemo(demoStart.dataset.demoStart);
    return;
  }
  const role = event.target.closest('[data-role]');
  if (role) {
    selectRole(role.dataset.role, role.dataset.roleLabel);
    return;
  }
  if (event.target.closest('[data-exit-role]')) {
    exitRole();
    return;
  }
  if (event.target.closest('[data-switch-role]')) {
    openRoleSheet();
    return;
  }
  if (event.target.closest('[data-close-sheet]')) {
    closeSheet();
    return;
  }
  if (event.target.closest('[data-open-palette]')) {
    openPalette();
    return;
  }
  if (event.target.closest('[data-explain]')) {
    openExplain();
    return;
  }
  if (event.target.closest('[data-my-responsibilities]')) {
    openMyResponsibilities();
    return;
  }
  const formOpen = event.target.closest('[data-form-open]');
  if (formOpen) {
    openForm(formOpen.dataset.formType, formOpen.dataset.formKind, formOpen.dataset.formOnly);
    return;
  }
  const respConfirm = event.target.closest('[data-resp-confirm]');
  if (respConfirm) {
    confirmResponsibility(respConfirm);
    return;
  }
  const gap = event.target.closest('[data-gap-open]');
  if (gap) {
    openGap(gap.dataset.gapOpen);
    return;
  }
  const ownInterview = event.target.closest('[data-interview-open]');
  if (ownInterview) {
    openOwnInterview(ownInterview.dataset.interviewOpen);
    return;
  }
  const validateProcess = event.target.closest('[data-validate-process]');
  if (validateProcess) {
    const code = validateProcess.dataset.validateProcess;
    validateProcess.disabled = true;
    validateProcess.textContent = 'רושם…';
    try {
      await postJson(`/api/process/${encodeURIComponent(code)}/validate`);
      invalidate();
      toast('התהליך אושר ונרשמה החלטה');
      await ensureShell();
      renderChrome();
      await renderMain();
    } catch (error) {
      validateProcess.disabled = false;
      validateProcess.textContent = 'אישור התהליך כפי שנמדד';
      toast(error.message, 'error');
    }
    return;
  }
  const pick = event.target.closest('[data-approval-pick]');
  if (pick) {
    state.approvalPick = pick.dataset.approvalPick;
    await renderMain();
    if (window.innerWidth < 900) {
      document.querySelector('.approval-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    state.filter = filter.dataset.filter;
    await renderMain();
    return;
  }
  const service = event.target.closest('[data-service]');
  if (service) {
    state.service = service.dataset.service;
    await renderMain();
    return;
  }
  const wsTab = event.target.closest('[data-ws-tab]');
  if (wsTab) {
    state.ws = { ...state.ws, tab: wsTab.dataset.wsTab };
    await renderMain();
    return;
  }
  const msg = event.target.closest('[data-msg]');
  if (msg) {
    state.ws = { ...state.ws, msg: Number(msg.dataset.msg) };
    await renderMain();
    return;
  }
  const doc = event.target.closest('[data-doc]');
  if (doc) {
    state.ws = { ...state.ws, doc: Number(doc.dataset.doc) };
    await renderMain();
    return;
  }
  const page = event.target.closest('[data-page]');
  if (page) {
    openRecord(page.dataset.page);
    return;
  }
  const record = event.target.closest('[data-record]');
  if (record) {
    openRecord(record.dataset.record);
    return;
  }
  const sourceOpen = event.target.closest('[data-source-open]');
  if (sourceOpen) {
    await openSource(sourceOpen.dataset.sourceOpen, sourceOpen.dataset.sourceRef);
    return;
  }
  const sourceConsent = event.target.closest('[data-source-consent]');
  if (sourceConsent) {
    const id = sourceConsent.dataset.sourceConsent;
    closeSheet();
    await applySourceToggle(id, true);
    return;
  }
  const source = event.target.closest('[data-source-toggle]');
  if (source) {
    toggleSource(source.dataset.sourceToggle, source);
    return;
  }
  const suggest = event.target.closest('[data-approve-suggestion]');
  if (suggest) {
    approveSuggestion(suggest.dataset.approveSuggestion, suggest);
    return;
  }
  const approveButton = event.target.closest('[data-approve]');
  if (approveButton) {
    approve(approveButton.dataset.approve, approveButton.dataset.id, approveButton);
    return;
  }
  if (event.target.closest('[data-retry]')) {
    invalidate();
    await render();
    return;
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'form-subject') return;
  if (event.target.matches('[data-form-subject]')) {
    const subject = state.formSubjects.find((s) => s.ref === event.target.value);
    if (subject) fillFormFields(subject);
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'form-submit') {
    event.preventDefault();
    submitForm(event.target);
    return;
  }
  if (event.target.id === 'interview-form') {
    event.preventDefault();
    submitInterview(event.target);
    return;
  }
  if (event.target.id === 'palette-form') {
    event.preventDefault();
    const query = event.target.querySelector('input[name="q"]')?.value?.trim();
    if (query) runPaletteQuery(query);
  }
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (state.role) openPalette();
  }
  if (event.key === 'Escape') {
    const dialog = document.getElementById('sheet');
    if (dialog?.open) dialog.close();
  }
});

window.addEventListener('hashchange', async () => {
  if (!state.role) return;
  stopDemo();
  state.tab = tabFromHash();
  if (!allowedTab(state.tab)) state.tab = 'home';
  renderChrome();
  await renderMain();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

const dialog = document.getElementById('sheet');
if (dialog) {
  dialog.addEventListener('close', () => {
    if (state.interview) {
      state.interview = null;
      renderMain();
    } else if (state.sheetDirty) {
      state.sheetDirty = false;
      render();
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

boot();
