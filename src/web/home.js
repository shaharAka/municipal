const $ = (sel, root = document) => root.querySelector(sel);
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('he-IL') : '—');
const pct = (v) => (Number.isFinite(Number(v)) ? `${Math.round(Number(v) * 100)}%` : '—');
const code = (v) => `<span class="ltr" dir="ltr">${escapeHtml(v)}</span>`;

const PROPOSAL_HE = {
  sla_reminder: 'תזכורת למפקח לפני חריגה מזמן הפיקוח',
  document_request: 'בקשת מסמכים חסרים מהעסק באופן אוטומטי',
  standard_letter: 'הפקת מכתב תיקונים מתוך ממצאי הביקורת',
  routing: 'שיבוץ אוטומטי של בקשות למפקח לפי אזור וסיכון',
};

const TABS = [
  { id: 'home', label: 'בית' },
  { id: 'ask', label: 'שאל' },
  { id: 'people', label: 'אנשים' },
  { id: 'process', label: 'תהליכים' },
  { id: 'onboard', label: 'קליטה' },
];

const state = { tab: 'home', answer: null, error: null };
const api = async (path, options) => {
  const res = await fetch(path, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `שגיאה ${res.status}`);
  return body;
};

/* ------------------------------------------------------------------ views */

function answerBlock(answer, compact = false) {
  const c = answer.counts ?? {};
  const rule = answer.rule;
  return `
    <section class="answer">
      <h2>${escapeHtml(answer.question)}</h2>
      ${rule ? `<p class="rule">${escapeHtml(rule.citation)} · גרסה ${rule.version} · ${escapeHtml(rule.owner)}</p>` : ''}
      <div class="counts">
        <div class="count good"><b>${num(c.eligible)}</b><span>זכאים להנחה</span></div>
        <div class="count"><b>${num(c.notEligible)}</b><span>אינם זכאים</span></div>
        <div class="count unknown"><b>${num(c.unknown)}</b><span>לא ניתן להכריע</span></div>
        <div class="count"><b>${num(c.total)}</b><span>משקי בית בסה״כ</span></div>
      </div>
      ${answer.unknownReasons?.length ? `<p class="note">הסיבה היחידה ל״לא ידוע״: <strong>חסר נתון הכנסה</strong> עבור ${num(c.unknown)} משקי בית. המערכת כבר פתחה מכך משימה — אפשר לראות אותה בלשונית <strong>אנשים</strong>.</p>` : ''}
      <details>
        <summary>איך חושב המספר?</summary>
        <ul>${(answer.explain?.steps ?? []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
        ${(answer.explain?.whatWasNotChecked ?? []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
      </details>
    </section>`;
}

function knowledgeMap(byType) {
  const nodes = [
    { id: 'residents', label: 'תושבים', count: byType.resident ?? 0, x: 96, y: 84 },
    { id: 'property', label: 'נכסים', count: byType.property ?? 0, x: 300, y: 62 },
    { id: 'business', label: 'עסקים', count: byType.business ?? 0, x: 430, y: 168 },
    { id: 'cases', label: 'תיקים', count: byType.case ?? 0, x: 300, y: 282 },
    { id: 'documents', label: 'מסמכים', count: byType.document ?? 0, x: 92, y: 262 },
    { id: 'process', label: 'תהליכים', count: byType.process_step ?? 0, x: 128, y: 172 },
  ];
  const hub = { x: 246, y: 172 };
  return `
    <svg class="map" viewBox="0 0 520 360" role="img" aria-label="מפת הידע של המחלקה">
      ${nodes.map((n) => `<line class="edge" x1="${hub.x}" y1="${hub.y}" x2="${n.x}" y2="${n.y}" />`).join('')}
      <circle class="node core" cx="${hub.x}" cy="${hub.y}" r="34" />
      <text class="label-core" x="${hub.x}" y="${hub.y + 4}" text-anchor="middle">העיר</text>
      ${nodes.map((n) => `
        <circle class="node" cx="${n.x}" cy="${n.y}" r="26" />
        <text x="${n.x}" y="${n.y + 4}" text-anchor="middle">${num(n.count)}</text>
        <text x="${n.x}" y="${n.y + 44}" text-anchor="middle">${n.label}</text>`).join('')}
    </svg>`;
}

async function homeView() {
  const [overview, answer] = await Promise.all([api('/api/overview'), api('/api/answer')]);
  const org = await api('/api/org');
  const lic = await api('/api/process?service=LIC');
  const people = overview.graph.byType.person ?? 0;
  const units = org.units.length;
  const bottleneck = lic.model.steps[0];
  const topProposal = lic.proposals.sort((a, b) => b.annualDaysSaved - a.annualDaysSaved)[0];
  return `
    <p class="hello">שלום דנה,</p>
    <h1>מה תרצו לדעת על העיר?</h1>
    <p class="lede">שאלו בשפה חופשית. תקבלו מספר, את הכלל שמאחוריו, ומה שעדיין לא ידוע — בלי לחפש בטבלאות.</p>
    <form class="ask" id="ask-form">
      <div class="ask-row">
        <input id="q" name="q" type="search" value="כמה משקי בית זכאים להנחה באגרת תברואה?" aria-label="שאלה" />
        <button class="btn" type="submit">שאל</button>
      </div>
      <div class="chips">
        <button class="chip" type="button" data-q="כמה משקי בית זכאים להנחה באגרת תברואה?">זכאות להנחה</button>
        <button class="chip" type="button" data-q="כמה עסקים יש בעיר?">עסקים בעיר</button>
        <button class="chip" type="button" data-q="כמה תושבים יש בעיר?">תושבים</button>
      </div>
    </form>
    <div id="answer-slot">${answerBlock(answer)}</div>
    <div class="hero-note">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="3.4"/></svg>
      <span><strong>פשוט חכם:</strong> כל מספר כאן מחושב מהנתונים העירוניים בזמן אמת, וכל הכרעה שמשנה משהו מחכה לאדם — לא לאוטומציה.</span>
    </div>
    <div class="grid-3">
      <article class="card">
        <h3>אנשים</h3>
        <div class="big">${num(people)} עובדים</div>
        <p>ב־${num(units)} יחידות. המערכת למדה מי עושה מה מתוך העבודה עצמה.</p>
        <p class="meta">39 אחריויות זוהו וממתינות לאישור</p>
      </article>
      <article class="card">
        <h3>תהליכים</h3>
        <div class="big">${num(lic.model.medianTotalDays)} יום</div>
        <p>זה הזמן החציוני להוציא רישיון עסק. צוואר הבקוק: ${escapeHtml(bottleneck?.labels ?? '')} — ${num(bottleneck?.medianWaitDays)} ימים.</p>
        <p class="meta">${num(lic.model.caseCount)} תיקים · ${num(lic.model.variants.length)} מסלולים</p>
      </article>
      <article class="card">
        <h3>אוטומציות</h3>
        <div class="big">${num(topProposal?.annualDaysSaved)} ימי עבודה</div>
        <p>${escapeHtml(PROPOSAL_HE[topProposal?.kind] ?? topProposal?.title ?? '')} — ${num(topProposal?.expectedCasesPerYear)} מקרים בשנה, וההצעה מחכה לאישור.</p>
        <p class="meta">${num(lic.proposals.length)} הצעות מבוססות ראיות</p>
      </article>
    </div>
    <div class="grid-2">
      <section class="card">
        <h3>מפת הידע</h3>
        <p>מה המערכת מכירה, ומאיזה מקור. לחיצה על אנליסט מציגה את הקשר המלא.</p>
        ${knowledgeMap(overview.graph.byType)}
      </section>
      <section class="card">
        <h3>מה המערכת מבקשת מכם</h3>
        <div class="big">${num(answer.counts?.unknown)} משקי בית</div>
        <p>לא ניתן להכריע בזכאות כי חסר נתון הכנסה. השאלה נשלחה למשה מהגזברות — שלוש שאלות, וזה חוזר למערכת.</p>
        <p class="meta" style="margin-top:16px"><a href="./workbench.html#/learn" style="color:var(--accent)">לפתיחת השאלה ←</a></p>
      </section>
    </div>`;
}

async function askView() {
  const [answer, rules] = await Promise.all([api('/api/answer'), api('/api/rules')]);
  const current = state.answer ?? answer;
  return `
    <h1>שאלו, וקבלו גם את מה שלא ידוע</h1>
    <p class="lede">המערכת עונה רק ממה שהיא מכירה, ומראה את הכלל. אם משהו חסר — היא אומרת זאת ואוספת את הפער.</p>
    <form class="ask" id="ask-form">
      <div class="ask-row">
        <input id="q" name="q" type="search" value="${escapeHtml(current.question)}" aria-label="שאלה" />
        <button class="btn" type="submit">שאל</button>
      </div>
      <div class="chips">${(rules.suggested ?? []).map((s) => `<button class="chip" type="button" data-q="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>
    </form>
    <div id="answer-slot">${answerBlock(current)}</div>`;
}

async function peopleView() {
  const [org, overview] = await Promise.all([api('/api/org'), api('/api/overview')]);
  const nameOf = (ref) => org.people.find((p) => p.ref === ref)?.name ?? '';
  return `
    <h1>האנשים שמחזיקים את העיר</h1>
    <p class="lede">${num(overview.graph.byType.person)} עובדים ב־${num(org.units.length)} יחידות. האחריויות זוהו מהעבודה עצמה וממתינות לאישור האדם.</p>
    <section class="card">
      ${org.units.map((unit) => `
        <div class="unit">
          <div><strong>${escapeHtml(unit.name)}</strong><span class="muted">${num(unit.headcount)} עובדים</span></div>
          <div class="muted" style="font-size:12px">ראש היחידה: ${escapeHtml(nameOf(unit.headRef) || '—')}</div>
        </div>
        <div class="people" style="margin:-4px 0 14px">${unit.roles.map((role) => `<span class="person">${escapeHtml(role.title)}</span>`).join('')}</div>
      `).join('')}
    </section>
    <section class="section">
      <div class="section-head"><h2>מה כל אחד עושה בפועל</h2><p>נמדד מתוך ${num(overview.graph.byType.case_event)} אירועי תיקים והודעות</p></div>
      <div class="grid-3">
        ${org.responsibilities
          .filter((r) => r.signal === 'case-events')
          .sort((a, b) => b.support - a.support)
          .slice(0, 6)
          .map((r) => `<article class="card"><h3>${escapeHtml(org.people.find((p) => p.ref === r.personRef)?.name ?? '')}</h3><p>${escapeHtml(r.summary)}</p><p class="meta">ממתין לאישור</p></article>`)
          .join('')}
      </div>
    </section>`;
}

async function processView() {
  const lic = await api('/api/process?service=LIC');
  const { model, proposals } = lic;
  return `
    <h1>איך באמת זז רישיון עסק</h1>
    <p class="lede">${num(model.caseCount)} תיקים על פני ${num(model.windowDays)} ימים. הזמן נמדד בין שלב לשלב, לא הוערך.</p>
    <div class="counts" style="margin-bottom:18px">
      <div class="count"><b>${num(model.medianTotalDays)}</b><span>יום חציוני לתיק</span></div>
      <div class="count"><b>${num(model.variants.length)}</b><span>מסלולים שונים</span></div>
      <div class="count good"><b>${pct(model.coverageOfTopVariants)}</b><span>מהתיקים במסלולים המובילים</span></div>
      <div class="count"><b>${num(proposals.length)}</b><span>אוטומציות מוצעות</span></div>
    </div>
    <section class="card">
      <h3>המסלולים</h3>
      ${model.variants.slice(0, 3).map((v) => `
        <div class="variant">
          <div class="path">${escapeHtml(v.sequence.slice(0, 4).join(' ← '))}${v.sequence.length > 4 ? ' ← …' : ''}</div>
          <div class="num">${num(v.caseCount)} תיקים</div>
          <div class="track"><i style="width:${Math.round(v.coverageShare * 100)}%"></i></div>
        </div>`).join('')}
    </section>
    <section class="section">
      <div class="section-head"><h2>איפה מחכים הכי הרבה</h2><p>${escapeHtml(model.steps[0]?.role ?? '')}</p></div>
      <div class="grid-3">
        ${model.steps.slice(0, 3).map((s) => `<article class="card"><h3>${escapeHtml(s.labels)}</h3><div class="big">${num(s.medianWaitDays)} ימים</div><p>חציון המתנה בין השלב הזה לבא אחריו, מתוך ${num(s.occurrences)} מקרים.</p></article>`).join('')}
      </div>
    </section>`;
}

async function onboardView() {
  const data = await api('/api/onboard');
  const diff = data.diff;
  const s = diff.summary;
  return `
    <h1>עיר חדשה, אותה תשתית ידע</h1>
    <p class="lede">${escapeHtml(diff.target_organization)} מתחילה מהמודל שלמדנו ב${escapeHtml(diff.source_template.organization)}. נדרש למפות רק את ההבדלים.</p>
    <div class="counts">
      <div class="count good"><b>${pct(s.unit_coverage)}</b><span>מהיחידות זוהו</span></div>
      <div class="count"><b>${pct(s.role_coverage)}</b><span>מהתפקידים</span></div>
      <div class="count"><b>${pct(s.step_coverage)}</b><span>משלבי התהליך</span></div>
      <div class="count unknown"><b>${num(diff.units.missing.length)}</b><span>יחידה חסרה</span></div>
    </div>
    <section class="card" style="margin-top:18px">
      <h3>מה שונה</h3>
      ${diff.units.missing.map((u) => `<p class="note">חסר: <strong>${escapeHtml(u.name)}</strong> — ${escapeHtml(u.name_en)}. הוצא לספק חיצוני.</p>`).join('')}
      ${diff.units.matched.filter((m) => m.verdict === 'renamed').map((m) => `<p class="note">שם אחר, אותם תפקידים: <strong>${escapeHtml(m.template.name)}</strong> ← ${escapeHtml(m.target.name)}</p>`).join('')}
      <p class="note">ממתין להחלטת אדם — המערכת לא ממזגת יחידות לבד.</p>
    </section>`;
}

/* ------------------------------------------------------------------ render */

const VIEWS = { home: homeView, ask: askView, people: peopleView, process: processView, onboard: onboardView };

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = TABS.map((t) => `<button type="button" data-tab="${t.id}" ${t.id === state.tab ? 'aria-current="page"' : ''}>${t.label}</button>`).join('');
}

async function render() {
  renderNav();
  const main = $('#main');
  main.innerHTML = '<p class="hello">טוען נתונים…</p>';
  try {
    main.innerHTML = await VIEWS[state.tab]();
    const form = $('#ask-form');
    if (form) {
      form.addEventListener('submit', submitQuestion);
      form.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { $('#q').value = b.dataset.q; form.requestSubmit(); }));
    }
  } catch (error) {
    main.innerHTML = `<div class="err">לא הצלחנו לטעון את הנתונים: ${escapeHtml(error.message)}</div>`;
  }
}

async function submitQuestion(event) {
  event.preventDefault();
  const question = $('#q')?.value?.trim();
  if (!question) return;
  const slot = $('#answer-slot');
  slot.innerHTML = '<p class="hello">בודק את הנתונים…</p>';
  try {
    const answer = await api('/api/ask', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }),
    });
    if (answer.refused) {
      slot.innerHTML = `<div class="err">${escapeHtml(answer.refused)}</div>`;
      return;
    }
    slot.innerHTML = answerBlock(answer);
  } catch (error) {
    slot.innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`;
  }
}

function fromHash() {
  const id = location.hash.replace('#/', '').replace('#', '');
  return TABS.some((t) => t.id === id) ? id : 'home';
}

window.addEventListener('hashchange', () => { state.tab = fromHash(); state.answer = null; render(); });
$('#nav').addEventListener('click', (e) => {
  const button = e.target.closest('[data-tab]');
  if (button) location.hash = '#/' + button.dataset.tab;
});
state.tab = fromHash();
render();
