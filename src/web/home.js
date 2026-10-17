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
  { id: 'sources', label: 'מקורות' },
  { id: 'approvals', label: 'אישורים' },
  { id: 'workspace', label: 'מערכות' },
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


/* ------------------------------------------------------------------- map */
function canvas(process) {
  const model = process.model;
  const proposals = process.proposals ?? [];
  const steps = model.steps;
  const seq = model.variants[0]?.sequence ?? steps.map((s) => s.activity);
  const byActivity = new Map(steps.map((s) => [s.activity, s]));
  const proposedSteps = new Set(proposals.map((p) => p.step).filter(Boolean));
  const maxWait = Math.max(...steps.map((s) => s.medianWaitDays), 1);
  const W = 1120;
  const gap = 138;
  const startX = W - 70;
  const y = 92;
  const nodes = seq.map((activity, i) => {
    const step = byActivity.get(activity) ?? { activity, labels: activity, medianWaitDays: 0, occurrences: 0, role: '', isRework: false };
    const isGate = /APPROVED|LICENCE_ISSUED|DISCOUNT_APPROVED/.test(activity);
    const isBottleneck = step.medianWaitDays >= maxWait * 0.9 && maxWait > 0;
    const isProposed = proposedSteps.has(activity);
    const x = startX - i * gap;
    return { ...step, x, y, isGate, isBottleneck, isProposed };
  });
  const width = Math.max(W, 140 + nodes.length * gap);
  return `
    <div class="canvas-wrap">
      <svg class="flow" viewBox="0 0 ${width} 330" role="img" aria-label="מפת התהליך">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b9cdc7" />
          </marker>
        </defs>
        <text x="${startX}" y="26" class="lane">מסלול נפוץ · ${num(model.caseCount)} תיקים · חציון ${num(model.medianTotalDays)} יום</text>
        <text x="${startX}" y="44" class="lane-sub">כיוון הזרימה: מימין לשמאל</text>
        ${nodes.map((n, i) => {
          const prev = nodes[i - 1];
          const arrow = prev ? `<line x1="${prev.x - 58}" y1="${n.y}" x2="${n.x + 62}" y2="${n.y}" class="edge" marker-end="url(#arrow)" />` : '';
          const wait = n.medianWaitDays > 0 ? `<text x="${(n.x + 62 + (prev?.x ?? n.x) - 58) / 2}" y="${n.y - 10}" class="wait" text-anchor="middle">${num(n.medianWaitDays)} ימים</text>` : '';
          return `${arrow}${wait}`;
        }).join('')}
        ${nodes.map((n) => `
          <g class="node-group ${n.isBottleneck ? 'bottleneck' : ''}">
            <rect x="${n.x - 58}" y="${n.y - 30}" width="116" height="60" rx="12" class="box ${n.isBottleneck ? 'is-bottleneck' : ''} ${n.isGate ? 'is-gate' : ''}" />
            <text x="${n.x}" y="${n.y - 6}" text-anchor="middle" class="node-label">${escapeHtml(n.labels)}</text>
            <text x="${n.x}" y="${n.y + 12}" text-anchor="middle" class="node-meta">${num(n.medianWaitDays)} ימים</text>
            ${n.isProposed ? `<circle cx="${n.x + 50}" cy="${n.y - 30}" r="7" class="suggest-dot" /><text x="${n.x + 50}" y="${n.y - 26}" text-anchor="middle" class="dot-label">!</text>` : ''}
            ${n.isGate ? `<text x="${n.x}" y="${n.y + 46}" text-anchor="middle" class="gate-label">אישור אדם</text>` : ''}
          </g>`).join('')}
        <text x="${startX}" y="300" class="lane">מקורות: מערכות הפעלה · דואר העבודה · מסמכי המחלקה</text>
      </svg>
    </div>
    <div class="legend">
      <span><i class="sw measured"></i> נמדד מהנתונים</span>
      <span><i class="sw bottleneck"></i> צוואר בקוק</span>
      <span><i class="sw proposed"></i> מוצע לאישור</span>
      <span><i class="sw gate"></i> שער אישור אדם</span>
    </div>`;
}

async function mapView() {
  const process = await api('/api/process?service=LIC');
  const { model, proposals } = process;
  return `
    <h1>תהליך רישוי העסק — כמו שהוא קורה</h1>
    <p class="lede">${num(model.caseCount)} תיקים, ${num(model.variants.length)} מסלולים. הזמן נמדד בין שלב לשלב; האוטומציות המוצעות מסומנות ולא מופעלות.</p>
    ${canvas(process)}
    <section class="section">
      <div class="section-head"><h2>הצעות על גבי התהליך</h2><p>כל הצעה מבוססת מדידה, וממתינה לאישור</p></div>
      <div class="grid-3">
        ${proposals.slice(0, 3).map((p) => `<article class="card"><h3>${escapeHtml(PROPOSAL_HE[p.kind] ?? p.title)}</h3><div class="big">${num(p.annualDaysSaved)} ימים</div><p>${escapeHtml(p.rationale)}</p><p class="meta">${p.status === 'approved' ? 'אושר' : 'ממתין לאישור'}</p></article>`).join('')}
      </div>
    </section>`;
}

/* ---------------------------------------------------------------- learning */
async function learningView() {
  const [data, mapping] = await Promise.all([api('/api/learning'), api('/api/mapping')]);
  const open = data.candidates.filter((c) => c.status === 'open');
  const accepted = data.candidates.filter((c) => c.status === 'accepted');
  return `
    <h1>איך המודל משתנה</h1>
    <p class="lede">המודל לא משתנה מעצמו. המערכת מציעה, אדם מאשר, והשינוי נרשם כשכבת הרחבה של העיר — לא כעריכה של החלקים המשותפים.</p>
    <div class="counts">
      <div class="count good"><b>${num(data.counts.accepted)}</b><span>שינויים שאושרו</span></div>
      <div class="count"><b>${num(data.counts.proposed)}</b><span>הצעות פתוחות</span></div>
      <div class="count"><b>${num(data.counts.decisions)}</b><span>החלטות מתועדות</span></div>
      <div class="count"><b>${num(data.counts.forms)}</b><span>טפסים שנוצרו</span></div>
    </div>
    <section class="section">
      <div class="section-head"><h2>הצעות לשינוי המודל</h2><p>שדות שקיימים בנתונים ואין להם מקום באונטולוגיה</p></div>
      <div class="grid-3">
        ${open.filter((c) => c.kind === 'property').map((c) => `<article class="card">
          <h3>${escapeHtml(c.proposal?.property ?? 'שדה')}</h3>
          <p>${escapeHtml(c.summary)}</p>
          <p class="meta">${num(c.support)} רשומות · ${escapeHtml((c.proposal?.page_types ?? []).join(', '))}</p>
          <button class="btn small" type="button" data-accept-candidate="${c.ref}" style="margin-top:10px">הוספה כשכבת הרחבה</button>
        </article>`).join('')}
      </div>
      <div id="overlay-slot"></div>
    </section>
    <section class="section">
      <div class="section-head"><h2>מה כבר נכנס למודל</h2><p>כל שינוי נרשם עם מי אישר ומתי</p></div>
      <div class="grid-3">
        ${accepted.slice(0, 6).map((c) => `<article class="card"><h3>${escapeHtml(c.proposal?.property ?? c.kind)}</h3><p>${escapeHtml(c.summary)}</p><p class="meta">אושר · ${escapeHtml(String(c.proposed_by ?? ''))}</p></article>`).join('') || '<p class="hello">עדיין אין שינויים מאושרים.</p>'}
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2>אחריויות שממתינות לאישור האדם</h2><p>${num(data.candidates.filter((c) => c.kind === 'responsibility' && c.status === 'open').length)} אחריויות זוהו מהעבודה</p></div>
      <p class="hello">אישורן מתבצע בשאלה אישית (לשונית אנשים) — לא בהודעה גורפת.</p>
    </section>`;
}


/* ------------------------------------------------------------------- forms */
async function formsView() {
  const data = await api('/api/learning');
  const forms = data.forms ?? [];
  const pick = state.formPick && forms.some((f) => f.ref === state.formPick) ? state.formPick : forms[0]?.ref;
  const current = forms.find((f) => f.ref === pick);
  const form = current ? (await api(`/api/forms?type=${encodeURIComponent(current.page_type)}&kind=${encodeURIComponent(current.kind)}`)).form : null;
  return `
    <h1>טפסים שנולדו מהמודל</h1>
    <p class="lede">כל טופס נגזר מטיפוס באונטולוגיה. השדות, החוקים והשפה מגיעים ממנו — ולכן הטופס לא יכול לסתור את המודל.</p>
    ${forms.length ? `
      <div class="chips">${forms.map((f) => `<button class="chip ${f.ref === pick ? 'active' : ''}" type="button" data-form-pick="${f.ref}">${escapeHtml(f.name)}</button>`).join('')}</div>
      <div class="grid-2" style="margin-top:18px">
        <section class="card">
          <p class="eyebrow">תצוגה מקדימה</p>
          <h3>${escapeHtml(current.name)}</h3>
          <p class="meta">${num(current.field_count)} שדות · ${current.kind === 'application' ? 'טופס בקשה' : 'טופס פנימי'} · ${escapeHtml(current.page_type)}</p>
          <div class="form-preview">
            ${form.fields.map((field) => `<label class="field">
              <span>${escapeHtml(field.labelHe)}${field.required ? ' *' : ''}</span>
              ${field.widget === 'select'
                ? `<select disabled>${field.options.map((o) => `<option>${escapeHtml(o)}</option>`).join('')}</select>`
                : field.widget === 'date' ? '<input type="date" disabled />'
                : field.widget === 'checkbox' ? '<input type="checkbox" disabled />'
                : `<input type="text" placeholder="${escapeHtml(field.description || field.labelEn)}" disabled />`}
            </label>`).join('')}
          </div>
        </section>
        <section class="card">
          <p class="eyebrow">מאיפה זה מגיע</p>
          <h3>השדות והחוקים</h3>
          <p>הטופס נבנה מהטיפוס <strong>${escapeHtml(current.page_type)}</strong>, כולל סוגי ערכים, רשימות בחירה ושדות חובה. אין כאן קוד טופס.</p>
          <p class="meta">נוצר ב־${escapeHtml(current.status === 'approved' ? 'אישור' : 'טיוטה')} · ${num(form.fields.filter((f) => f.required).length)} שדות חובה</p>
          <details><summary>הצג את הסכימה</summary><pre class="code-block" style="direction:ltr;text-align:left">${escapeHtml(JSON.stringify(form.json_schema, null, 2).slice(0, 1200))}</pre></details>
        </section>
      </div>`
    : `<section class="card"><h3>עדיין אין טפסים</h3><p>אשרו הצעה מסוג טופס בלשונית <a href="#/sources" style="color:var(--accent)">מקורות</a> — והטופס יופיע כאן, מוכן לשימוש.</p></section>`}`;
}


/* -------------------------------------------------------------------- demo */
const SCENARIOS = [
  {
    id: 'eligibility',
    n: '1',
    titleHe: 'כמה משקי בית זכאים להנחה?',
    painHe: 'היום: פנייה לגזברות, אקסל, ובדיקה ידנית של כל תיק.',
    doHe: 'שואלים בשפה חופשית. המערכת מחזירה שלושה מספרים, את הכלל והגרסה שלו, ומה שלא ניתן להכריע.',
    steps: [{ action: 'ask', label: 'שאל את המערכת' }],
  },
  {
    id: 'gap',
    n: '2',
    titleHe: 'מי יכול לסגור את הפער?',
    painHe: 'היום: אף אחד לא יודע מי מחזיק את נתון ההכנסה, אז הפער נשאר.',
    doHe: 'המערכת פותחת שלוש שאלות למשה מהגזברות. התשובה נשמרת כראיה, וסתירה לכלל הופכת להצעה עם מספרי "מה יקרה אם".',
    steps: [
      { action: 'interview-open', label: 'פתח שאלה למשה' },
      { action: 'interview-answer', label: 'ענה בשלוש תשובות' },
    ],
  },
  {
    id: 'source',
    n: '3',
    titleHe: 'מה קורה כשמחברים מקור חדש?',
    painHe: 'היום: חיבור מערכת חדשה הוא פרויקט IT של חודשים.',
    doHe: 'מחברים את הדואר. המחקר מציע אחריויות ושלב חסר בתהליך, עם הראיות. אדם מאשר — ואז זה נכנס למודל.',
    steps: [
      { action: 'source-enable', label: 'חבר את הדואר' },
      { action: 'approve-responsibilities', label: 'אשר את האחריויות' },
    ],
  },
  {
    id: 'form',
    n: '4',
    titleHe: 'טופס שנולד מהמודל',
    painHe: 'היום: כל שינוי בטופס דורש פיתוח, וכל טופס נכתב מחדש.',
    doHe: 'מייצרים טופס מהמודל, ממלאים אותו, והערך נשמר על משק הבית עם מקור וחתימת מגיש.',
    steps: [
      { action: 'form-create', label: 'צור טופס' },
      { action: 'form-fill', label: 'מלא ומסור' },
    ],
  },
];
function demoView() {
  return `
    <h1>ארבעה תרחישים, חמישה קליקים</h1>
    <p class="lede">כל תרחיש מתחיל מכאב אמיתי במחלקה. כל כפתור כאן מבצע פעולה אמיתית על הנתונים — לא הדמיה.</p>
    <div class="scenario-grid">
      ${SCENARIOS.map((scenario) => `
        <article class="card scenario">
          <div class="row-between"><span class="step-n">${scenario.n}</span><h3>${escapeHtml(scenario.titleHe)}</h3></div>
          <p class="pain">${escapeHtml(scenario.painHe)}</p>
          <p>${escapeHtml(scenario.doHe)}</p>
          <div class="chips" style="margin-top:12px">
            ${scenario.steps.map((step) => `<button class="btn small" type="button" data-demo-action="${step.action}">${escapeHtml(step.label)}</button>`).join('')}
          </div>
          <div class="demo-out" id="out-${scenario.id}" role="status"></div>
        </article>`).join('')}
    </div>
    <p class="hello" style="margin-top:26px">מה שהמערכת לעולם לא עושה לבד: לא משנה מודל, לא מפעילה אוטומציה, לא קובעת זכאות. זה תמיד מחכה לאדם.</p>`;
}

async function runDemoAction(action, out) {
  out.innerHTML = '<p class="hello">פועל…</p>';
  const show = (html) => { out.innerHTML = html; };
  try {
    if (action === 'ask') {
      const answer = await api('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'כמה משקי בית זכאים להנחה באגרת תברואה?' }) });
      show(`<div class="counts">${[['זכאים', answer.counts.eligible, 'good'], ['אינם זכאים', answer.counts.notEligible, ''], ['לא ידוע', answer.counts.unknown, 'unknown']].map(([label, value, tone]) => `<div class="count ${tone}"><b>${num(value)}</b><span>${label}</span></div>`).join('')}</div><p class="note">כלל ${answer.rule.code} גרסה ${answer.rule.version} · ${escapeHtml(answer.rule.owner)}</p>`);
      return;
    }
    if (action === 'interview-open') {
      const data = await api('/api/interviews');
      const gap = data.gaps[0];
      const result = await api('/api/interviews/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gapRef: gap.ref }) });
      state.demo = { interviewRef: result.interview.ref };
      show(`<p class="note">נפתחה שאלה אל <strong>${escapeHtml(result.interview.personName)}</strong> · ${result.interview.questions.length} שאלות. ${escapeHtml(result.interview.questions[0].prompt_he)}</p>`);
      return;
    }
    if (action === 'interview-answer') {
      const ref = state.demo?.interviewRef ?? (await api('/api/interviews')).interviews.find((i) => i.status === 'open')?.ref;
      if (!ref) { show('<p class="note">צריך קודם לפתוח שאלה.</p>'); return; }
      const result = await api('/api/interviews/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref, answers: { source_system: 'גזברות - מערכת חיובים', missing_policy: 'להקצות ללא זכאות', who_can_supply: 'משה טל, רכז גזברות' } }) });
      show(`<p class="note">התשובה נשמרה. סתירה לכלל: ${escapeHtml(result.contradiction ?? '')}</p><p class="note">מה יקרה אם יאושר: <strong>${num(result.whatIf.eligible)}</strong> זכאים · <strong>${num(result.whatIf.notEligible)}</strong> לא זכאים · <strong>${num(result.whatIf.unknown)}</strong> לא ידוע</p>`);
      return;
    }
    if (action === 'source-enable') {
      const data = await api('/api/connectors/exchange/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
      const source = data.sources.find((s2) => s2.id === 'exchange');
      show(`<p class="note">הדואר מחובר. המחקר מצא <strong>${source.suggestions.length}</strong> הצעות: ${source.suggestions.map((s2) => escapeHtml(s2.titleHe)).join(' · ')}</p>`);
      return;
    }
    if (action === 'approve-responsibilities') {
      const data = await api('/api/connectors');
      const suggestion = data.sources.find((s2) => s2.id === 'exchange')?.suggestions.find((s2) => s2.kind === 'responsibility');
      if (!suggestion) { show('<p class="note">צריך קודם לחבר את הדואר.</p>'); return; }
      const result = await api(`/api/suggestions/${encodeURIComponent(suggestion.id)}/approve`, { method: 'POST' });
      show(`<p class="note">אושר: <strong>${escapeHtml(result.suggestion.artifact.labelHe)}</strong>. נשמרה החלטה על שם המאשר.</p>`);
      return;
    }
    if (action === 'form-create') {
      const data = await api('/api/connectors');
      const suggestion = data.sources.find((s2) => s2.id === 'entra')?.suggestions.find((s2) => s2.kind === 'form');
      if (!suggestion) { show('<p class="note">אין הצעת טופס כרגע.</p>'); return; }
      const result = await api(`/api/suggestions/${encodeURIComponent(suggestion.id)}/approve`, { method: 'POST' });
      state.demo = { ...(state.demo ?? {}), form: result.suggestion.artifact.spec };
      show(`<p class="note">נוצר טופס: <strong>${escapeHtml(result.suggestion.artifact.labelHe)}</strong></p><div class="form-preview">${result.suggestion.artifact.spec.fields.map((f) => `<label class="field"><span>${escapeHtml(f.labelHe)}</span><input disabled placeholder="${escapeHtml(f.labelHe)}" /></label>`).join('')}</div>`);
      return;
    }
    if (action === 'form-fill') {
      const pages = await api('/api/pages?type=household');
      const household = (pages.pages ?? []).find((p) => p.properties.income_band && p.properties.household_size);
      if (!household) { show('<p class="note">לא נמצא משק בית למילוי.</p>'); return; }
      const result = await api('/api/forms/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'household', kind: 'application', subject: household.ref, values: { household_size: 4, income_band: 'LOW', discount_status: 'PENDING' } }) });
      show(`<p class="note">נשמרו <strong>${result.written}</strong> ערכים על ${escapeHtml(household.title)}: ${Object.entries(result.properties).map(([k, v]) => `${k}=${v}`).join(' · ')}</p>`);
      return;
    }
  } catch (error) {
    show(`<div class="err">${escapeHtml(error.message)}</div>`);
  }
}


/* ---------------------------------------------------------------- workspace */
function outlookPane(messages, index) {
  const current = messages[index] ?? messages[0];
  return `
    <div class="outlook">
      <div class="ol-rail">
        <div class="ol-account"><span class="ol-avatar">ג</span><div><strong>${escapeHtml(current?.to?.[0] ?? '')}</strong><span>${escapeHtml(messages.length)} הודעות</span></div></div>
        <nav class="ol-folders">
          <span class="ol-folder active">דואר נכנס <b>${num(messages.length)}</b></span>
          <span class="ol-folder">נשלח</span>
          <span class="ol-folder">נמחק</span>
          <span class="ol-folder">ארכיון</span>
        </nav>
        <p class="ol-note">תצוגת מקור · לקריאה בלבד</p>
      </div>
      <div class="ol-list">
        <div class="ol-search">חיפוש <span class="tiny muted">בדואר של המחלקה</span></div>
        ${messages.map((m, i) => `<button class="ol-item ${i === index ? 'active' : ''}" type="button" data-msg="${i}">
          <span class="ol-from">${escapeHtml(m.from)}</span>
          <span class="ol-subject">${escapeHtml(m.subject)}</span>
          <span class="ol-meta">${escapeHtml(m.label)} · ${escapeHtml(m.received.slice(0, 10))}</span>
        </button>`).join('')}
      </div>
      <div class="ol-read">
        ${current ? `
          <h3>${escapeHtml(current.subject)}</h3>
          <div class="ol-head"><span class="ol-avatar small">${escapeHtml(current.from.slice(0, 1))}</span><div><strong>${escapeHtml(current.from)}</strong><span class="tiny muted">${escapeHtml(current.fromAddress)} · ${escapeHtml(current.received.slice(0, 16).replace('T', ' '))}</span></div></div>
          <div class="ol-body">${escapeHtml(current.body)}</div>
          <p class="ol-label">רגישות: ${escapeHtml(current.label)}</p>
          ${current.graphRef ? `<button class="btn small" type="button" data-graph="${current.graphRef}">מה למדנו מההודעה</button>` : ''}` : ''}
      </div>
    </div>`;
}
function sharepointPane(documents, index) {
  const current = documents[index] ?? documents[0];
  return `
    <div class="sp">
      <div class="sp-bar">
        <span class="sp-brand">SharePoint · מסמכי המחלקה</span>
        <span class="sp-actions">חדש · העלאה · שיתוף</span>
      </div>
      <div class="sp-grid">
        <table class="sp-table">
          <thead><tr><th>שם</th><th>שונה</th><th>רגישות</th><th>גודל</th></tr></thead>
          <tbody>${documents.map((d, i) => `<tr class="${i === index ? 'active' : ''}" data-doc="${i}">
            <td class="sp-name"><span class="sp-icon">${/xlsx/.test(d.name) ? '▦' : '▤'}</span>${escapeHtml(d.name)}</td>
            <td>${escapeHtml(d.modified.slice(0, 10))}</td>
            <td>${d.label === 'Restricted' ? '<span class="sp-lock">מוגבל</span>' : escapeHtml(d.label)}</td>
            <td>${num(Math.round(d.size / 1024))} KB</td>
          </tr>`).join('')}</tbody>
        </table>
        <aside class="sp-preview">
          <p class="eyebrow">תצוגה מקדימה</p>
          <h4>${escapeHtml(current.name)}</h4>
          <p class="tiny muted">${num(current.pages)} עמודים · ${escapeHtml(current.label)}</p>
          <pre class="sp-text">${escapeHtml(current.text)}</pre>
          ${current.graphRef ? `<button class="btn small" type="button" data-graph="${current.graphRef}">מה למדנו מהמסמך</button>` : ''}
        </aside>
      </div>
    </div>`;
}
async function workspaceView() {
  const viewerId = state.role ?? '';
  const query = `?viewer=${encodeURIComponent(viewerId)}`;
  const [outlook, doclib] = await Promise.all([api('/api/outlook' + query), api('/api/doclib' + query)]);
  return `
    <h1>המערכות שהאנשים כבר מכירים</h1>
    <p class="lede">אותו מידע, במראה של הכלים שהמחלקה עובדת איתם. הקריאה משם לקריאה בלבד, והמערכת לומדת מהעותק שלה.</p>
    <div class="ms-strip"><span class="ms-logo" aria-hidden="true"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i></span><strong>Microsoft 365</strong><span class="muted">תצוגת מקור · לקריאה בלבד · ${escapeHtml(doclib.viewer)} רואה ${num(doclib.visible)} מתוך ${num(doclib.total)} מסמכים</span></div>
    <div id="ws-graph" role="status"></div>
    <section class="section">
      <div class="section-head"><h2>דואר נכנס</h2><p>${escapeHtml(outlook.mailbox)} · ${num(outlook.messages.length)} הודעות</p></div>
      <div class="ms ms-outlook">${outlookPane(outlook.messages, state.ws?.msg ?? 0)}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>ספריית המסמכים</h2><p>${num(doclib.documents.length)} קבצים · תוויות הרגישות מגיעות מהמקור</p></div>
      <div class="ms ms-sp">${sharepointPane(doclib.documents, state.ws?.doc ?? 0)}</div>
    </section>`;
}

/* -------------------------------------------------------------------- find */
async function findView() {
  return `
    <h1>חיפוש אחד, על כל המערכות</h1>
    <p class="lede">לא צריך לדעת אם זה היה במייל, במסמך, בגרף או בכלל. מחפשים פעם אחת ומקבלים את המקור עם הציטוט.</p>
    <form class="ask" data-form="find" role="search">
      <div class="ask-row">
        <input name="q" type="search" placeholder="למשל: רישיון, הנחה, פיקוח" aria-label="חיפוש" />
        <button class="btn" type="submit">חפש</button>
      </div>
    </form>
    <div id="find-out" role="status" aria-live="polite"></div>`;
}
async function runFind(form) {
  const out = document.getElementById('find-out');
  const query = form.querySelector('input[name="q"]').value.trim();
  if (!query) return;
  out.innerHTML = '<p class="hello">מחפש…</p>';
  try {
    const data = await api('/api/find?q=' + encodeURIComponent(query));
    out.innerHTML = data.groups.length
      ? data.groups.map((group) => `<section class="section"><div class="section-head"><h2>${escapeHtml(group.source)}</h2><p>${num(group.items.length)} תוצאות</p></div>
          <div class="find-list">${group.items.map((item) => `<button class="card find-hit" type="button" data-find-ref="${escapeHtml(item.ref)}">
            <span class="badge">${escapeHtml(item.kind)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.snippet)}</p>
          </button>`).join('')}</div></section>`).join('')
      : '<p class="hello">לא נמצאו תוצאות. נסו מילה אחרת.</p>';
  } catch (error) {
    out.innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`;
  }
}

/* --------------------------------------------------------------- approvals */
async function approvalsView() {
  const data = await api('/api/approvals');
  const label = { suggestion: 'הצעת מחקר', automation: 'אוטומציה', candidate: 'שינוי מודל' };
  return `
    <h1>מה מחכה לאישור</h1>
    <p class="lede">כל פריט כאן הוא הצעה של המערכת. שום דבר לא משתנה עד שמישהו מאשר, וכל אישור נרשם עם שמו.</p>
    <div class="counts">
      <div class="count"><b>${num(data.counts.suggestions)}</b><span>הצעות מחקר</span></div>
      <div class="count"><b>${num(data.counts.automations)}</b><span>אוטומציות</span></div>
      <div class="count"><b>${num(data.counts.candidates)}</b><span>שינויי מודל</span></div>
      <div class="count good"><b>${num(data.pending.length)}</b><span>בסה״כ ממתין</span></div>
    </div>
    <section class="section">
      ${data.pending.length ? `<div class="approval-list">${data.pending.map((item) => `<article class="card approval" data-approval="${escapeHtml(item.id)}" data-kind="${item.kind}">
        <div class="row-between"><span class="badge">${label[item.kind] ?? item.kind}</span><button class="btn small" type="button" data-approve-kind="${item.kind}" data-approve-id="${escapeHtml(item.id)}">אישור</button></div>
        <h3>${escapeHtml(item.titleHe)}</h3>
        <p>${escapeHtml(item.whyHe)}</p>
        ${item.evidenceHe?.length ? `<div class="chips evidence">${item.evidenceHe.slice(0, 3).map((e) => `<span class="chip static">${escapeHtml(e)}</span>`).join('')}</div>` : ''}
        <div class="approval-out" role="status"></div>
      </article>`).join('')}</div>` : '<p class="hello">אין פריטים שממתינים לאישור.</p>'}
    </section>`;
}

/* ------------------------------------------------------------------ render */

async function sourcesView() {
  const data = await api('/api/connectors');
  const badge = (n) => `<span class="count-pill">${n}</span>`;
  return `
    <h1>מקורות המידע של העיר</h1>
    <p class="lede">כל מקור שמחברים מפעיל מחקר משלו. המחקר מציע — אדם מאשר. שום דבר לא משתנה עד לאישור.</p>
    <div class="source-grid">
      ${data.sources.map((source) => `
        <article class="card source ${source.enabled ? 'on' : ''}">
          <div class="source-top">
            <div>
              <h3>${escapeHtml(source.nameHe)}</h3>
              <p class="meta">${escapeHtml(source.nameEn)}</p>
            </div>
            <button class="toggle ${source.enabled ? 'on' : ''}" type="button" data-toggle-source="${source.id}" aria-pressed="${source.enabled}">
              ${source.enabled ? 'מחובר' : 'חיבור'}
            </button>
          </div>
          <p>${escapeHtml(source.descriptionHe)}</p>
          <p class="meta">${escapeHtml(source.evidenceHe)}</p>
          ${source.enabled
            ? `<div class="research">
                 <p class="research-title">מחקר · ${source.suggestions.length} הצעות ${source.suggestions.length ? '' : '— עדיין אין'}</p>
                 ${source.suggestions.map((suggestion) => `
                   <div class="suggestion ${suggestion.status === 'approved' ? 'done' : ''}">
                     <div class="suggestion-top">
                       <strong>${escapeHtml(suggestion.titleHe)}</strong>
                       ${suggestion.status === 'approved' ? '<span class="pill ok">אושר</span>' : `<button class="btn small" type="button" data-approve-suggestion="${suggestion.id}">אישור</button>`}
                     </div>
                     <p>${escapeHtml(suggestion.whyHe)}</p>
                     <div class="chips evidence">${suggestion.evidenceHe.map((e) => `<span class="chip static">${escapeHtml(e)}</span>`).join('')}</div>
                     ${suggestion.artifact ? `<p class="artifact">נוצר: ${escapeHtml(suggestion.artifact.labelHe)}</p>` : ''}
                   </div>`).join('')}
               </div>`
            : `<p class="unlocks">מה זה יאפשר: ${escapeHtml(source.unlocksHe)}</p>`}
        </article>`).join('')}
    </div>
    ${data.forms?.length ? `<section class="section">
      <div class="section-head"><h2>טפסים שנוצרו</h2><p>נגזרו מהמודל, לא נכתבו ביד</p></div>
      <div class="grid-3">${data.forms.map((f) => `<article class="card"><h3>${escapeHtml(f.name)}</h3><p>${num(f.field_count)} שדות · ${f.kind === 'application' ? 'טופס בקשה' : 'טופס פנימי'}</p><p class="meta">${escapeHtml(f.page_type)}</p></article>`).join('')}</div>
    </section>` : ''}`;
}


/* -------------------------------------------------------------------- tour */
function startReplay(button) {
  const out = document.getElementById('replay-out');
  if (!out || button.dataset.busy === '1') return;
  button.dataset.busy = '1'; button.disabled = true; out.innerHTML = '';
  const source = new EventSource('/api/replay');
  source.addEventListener('stage', (event) => {
    const stage = JSON.parse(event.data);
    out.insertAdjacentHTML('beforeend', `<div class="replay-stage">
      <div class="replay-head"><span class="sys">${escapeHtml(stage.system)}</span><strong>${escapeHtml(stage.titleHe)}</strong>
      <span class="replay-count">${num(stage.count)} ${escapeHtml(stage.unit)}</span></div>
      ${(stage.samples ?? []).map((x) => `<pre class="evid">${escapeHtml(x.excerpt)}</pre>`).join('')}
      <p class="did">${escapeHtml(stage.didHe)}</p></div>`);
  });
  source.addEventListener('done', (event) => {
    const summary = JSON.parse(event.data);
    out.insertAdjacentHTML('beforeend', `<p class="note ok-note">הקליטה הושלמה: ${num(summary.pages)} דפים ו־${num(summary.facts)} עובדות, כל אחת עם מקור.</p>`);
    source.close(); button.disabled = false; button.dataset.busy = '0';
  });
  source.onerror = () => {
    source.close(); button.disabled = false; button.dataset.busy = '0';
    out.insertAdjacentHTML('beforeend', '<div class="err">הקליטה נעצרה. נסו שוב.</div>');
  };
}
function tourStep(step, index) {
  const badge = `<span class="step-badge">${index + 1}</span>`;
  const saved = step.savedHe ? `<p class="saved">מה שנחסך: ${escapeHtml(step.savedHe)}</p>` : '';
  if (step.kind === 'source') return `<div class="tour-step">${badge}<div class="tour-body">
    <p class="src"><span class="sys">${escapeHtml(step.system)}</span><code class="locator">${escapeHtml(step.locator)}</code></p>
    <pre class="evid">${escapeHtml(step.excerpt)}</pre>
    <p class="did"><strong>מה המערכת עשתה:</strong> ${escapeHtml(step.didHe)}</p>${saved}</div></div>`;
  if (step.kind === 'sources') return `<div class="tour-step">${badge}<div class="tour-body">
    <p class="src"><span class="sys">${escapeHtml(step.system)}</span></p>
    <div class="mail-list">${step.items.map((m) => `<div class="mail"><div class="mail-top"><strong>${escapeHtml(m.subject)}</strong><span class="tiny muted">${escapeHtml(m.received)}</span></div><p class="tiny muted">${escapeHtml(m.from)}</p></div>`).join('')}</div>
    <p class="did"><strong>מה המערכת עשתה:</strong> ${escapeHtml(step.didHe)}</p>${saved}</div></div>`;
  if (step.kind === 'inference' || step.kind === 'fields') return `<div class="tour-step">${badge}<div class="tour-body">
    <p class="tour-title">${escapeHtml(step.titleHe)}</p>
    <ul class="inferred">${step.items.map((item) => `<li><strong>${escapeHtml(item.name ?? item.label)}</strong> ${escapeHtml(item.summary ?? item.rule ?? '')}</li>`).join('')}</ul>
    <p class="did"><strong>מה המערכת עשתה:</strong> ${escapeHtml(step.didHe)}</p>${saved}</div></div>`;
  if (step.kind === 'result') {
    const c = step.counts ?? {};
    return `<div class="tour-step">${badge}<div class="tour-body"><p class="tour-title">${escapeHtml(step.titleHe)}</p>
      <div class="counts">${[['זכאים', c.eligible, 'good'], ['אינם זכאים', c.notEligible, ''], ['לא ידוע', c.unknown, 'unknown'], ['סה״כ', c.total, '']].map(([l, v, t]) => `<div class="count ${t}"><b>${num(v)}</b><span>${l}</span></div>`).join('')}</div>
      <p class="note">כלל ${escapeHtml(step.rule?.code ?? '')} גרסה ${step.rule?.version ?? ''} · ${escapeHtml(step.rule?.owner ?? '')}</p></div></div>`;
  }
  return `<div class="tour-step">${badge}<div class="tour-body"><p class="tour-title">${escapeHtml(step.titleHe)}</p><p>${escapeHtml(step.textHe)}</p>
    <button class="btn small" type="button" data-tour-action="${step.action.type}">${escapeHtml(step.action.labelHe)}</button></div></div>`;
}
async function tourView() {
  const data = await api('/api/tour');
  const scenarios = data.scenarios;
  const pick = Math.min(state.tour.pick, scenarios.length - 1);
  const scenario = scenarios[pick];
  const shown = Math.min(Math.max(1, state.tour.shown), scenario.steps.length);
  const done = shown >= scenario.steps.length;
  return `
    <h1>סיור: איך המערכת באמת עושה את זה</h1>
    <p class="lede">שלב אחר שלב, עם הנתונים עצמם: מאיזה מקור הגיע הערך, מה נגזר ממנו, ומה נחסך מכם.</p>
    <section class="card replay-card">
      <div class="row-between"><div><p class="eyebrow">קליטה חיה</p><h2 style="font-size:17px;margin:2px 0 4px">מה קורה כשמחברים את המקורות</h2>
      <p class="tiny muted">כל שלב מגיע בזמן אמת: מספר הרשומות שנקלטו ודוגמה אמיתית מהמקור.</p></div>
      <button class="btn" type="button" data-action="replay">התחל קליטה</button></div>
      <div id="replay-out" role="log" aria-live="polite"></div>
    </section>
    <div class="chips">${scenarios.map((sc, i) => `<button class="chip ${i === pick ? 'active' : ''}" type="button" data-tour-scenario="${i}">${escapeHtml(sc.titleHe)}</button>`).join('')}</div>
    <section class="card tour-card" style="margin-top:16px">
      <p class="eyebrow">${escapeHtml(scenario.promiseHe)}</p>
      <h2 style="font-size:19px;margin:4px 0 14px">${escapeHtml(scenario.titleHe)}</h2>
      ${scenario.steps.slice(0, shown).map((step, i) => tourStep(step, i)).join('')}
      <div class="row-between" style="margin-top:16px"><span class="tiny muted">${shown} מתוך ${scenario.steps.length} שלבים</span>
      ${done ? '<a class="btn quiet" href="#/learning">איך זה נרשם במודל ←</a>' : '<button class="btn" type="button" data-tour-next="1">השלב הבא</button>'}</div>
      <div id="tour-out">${state.tour.out ?? ''}</div>
    </section>`;
}
async function runTourAction(type) {
  const slot = document.getElementById('tour-out');
  const set = (html) => { state.tour.out = html; if (slot) slot.innerHTML = html; };
  set('<p class="hello">פועל…</p>');
  try {
    if (type === 'approve-responsibility') {
      const data = await api('/api/connectors');
      const suggestion = data.sources.find((x) => x.id === 'exchange')?.suggestions.find((x) => x.kind === 'responsibility');
      if (!suggestion) { set('<div class="err">צריך לחבר קודם את הדואר בלשונית מקורות.</div>'); return; }
      const result = await api(`/api/suggestions/${encodeURIComponent(suggestion.id)}/approve`, { method: 'POST' });
      set(`<p class="note ok-note">אושר: <strong>${escapeHtml(result.suggestion.artifact.labelHe)}</strong> — ונרשמה החלטה עם שם המאשר.</p>`);
      return;
    }
    if (type === 'interview') {
      const existing = await api('/api/interviews');
      const gap = existing.gaps[0];
      if (!gap) { set('<div class="err">לא נמצא פער פתוח.</div>'); return; }
      const opened = await api('/api/interviews/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gapRef: gap.ref }) });
      const answered = await api('/api/interviews/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: opened.interview.ref, answers: { source_system: 'גזברות - מערכת חיובים', missing_policy: 'להקצות ללא זכאות', who_can_supply: 'משה טל, רכז גזברות' } }) });
      set(`<p class="note"><strong>${escapeHtml(opened.interview.personName)}</strong> ענה. סתירה לכלל: ${escapeHtml(answered.contradiction ?? 'אין')}</p>
        <div class="counts">${[['זכאים', answered.whatIf?.eligible, 'good'], ['לא זכאים', answered.whatIf?.notEligible, ''], ['לא ידוע', answered.whatIf?.unknown, 'unknown']].map(([l, v, t]) => `<div class="count ${t}"><b>${num(v)}</b><span>${l}</span></div>`).join('')}</div>
        <p class="note">אלה המספרים אם תאושר ההצעה. עד אישור בעל הכלל — לא משתנה דבר.</p>`);
      return;
    }
    if (type === 'fill-form') {
      const pages = await api('/api/pages?type=household');
      const household = (pages.pages ?? []).find((x) => x.properties.income_band && x.properties.household_size);
      if (!household) { set('<div class="err">לא נמצא משק בית.</div>'); return; }
      const result = await api('/api/forms/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'household', kind: 'application', subject: household.ref, values: { household_size: 4, income_band: 'LOW', discount_status: 'PENDING' } }) });
      set(`<p class="note ok-note">נשמרו ${num(result.written)} ערכים על ${escapeHtml(household.title)}: ${Object.entries(result.properties).map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(String(v))}`).join(' · ')}</p>`);
      return;
    }
  } catch (error) {
    set(`<div class="err">${escapeHtml(error.message)}</div>`);
  }
}


/* ------------------------------------------------------------- simple home */
function simpleAnswer(answer) {
  const c = answer.counts ?? {};
  return `<section class="answer">
    <div class="answer-head">
      <div><h2>${escapeHtml(answer.question)}</h2>
      ${answer.rule ? `<p class="rule">${escapeHtml(answer.rule.citation)} · גרסה ${answer.rule.version}</p>` : ''}</div>
      <button class="engine-btn" type="button" data-engine="eligibility">איך הגענו לזה؟</button>
    </div>
    <div class="counts">
      <div class="count good"><b>${num(c.eligible)}</b><span>זכאים</span></div>
      <div class="count"><b>${num(c.notEligible)}</b><span>אינם זכאים</span></div>
      <div class="count unknown"><b>${num(c.unknown)}</b><span>לא ידוע</span></div>
      <div class="count"><b>${num(c.total)}</b><span>משקי בית</span></div>
    </div>
    ${answer.unknownReasons?.length ? `<p class="note">הסיבה ל״לא ידוע״: חסר נתון הכנסה. <button class="engine-btn" type="button" data-engine="interview">איך מטפלים בזה?</button></p>` : ''}
  </section>`;
}
function tasksFor(role, data) {
  const { approvals, interviews, lic, answer } = data;
  if (/מנהל|head/i.test(role)) {
    return [
      { label: 'פריטים שממתינים לאישור', value: approvals.pending.length, href: '#/approvals' },
      { label: 'אוטומציות מוצעות', value: approvals.counts.automations, href: '#/approvals' },
      { label: 'הצעות לשינוי המודל', value: approvals.counts.candidates, href: '#/approvals' },
    ];
  }
  if (/רכז|מזכיר|coordinator|clerk/i.test(role)) {
    return [
      { label: 'משקי בית בלי נתון הכנסה', value: answer.counts?.unknown ?? 0, href: '#/ask' },
      { label: 'שאלות פתוחות לאנשים', value: interviews.interviews.filter((i) => i.status === 'open').length, href: '#/demo' },
      { label: 'פערים שממתינים לאדם', value: interviews.gaps.length, href: '#/approvals' },
    ];
  }
  return [
    { label: 'המתנה חציונית לשיבוץ פיקוח (ימים)', value: lic.model.steps[0]?.medianWaitDays ?? 0, href: '#/demo' },
    { label: 'תיקים פתוחים', value: lic.model.caseCount, href: '#/demo' },
    { label: 'הצעות אוטומציה על התהליך', value: lic.proposals.length, href: '#/approvals' },
  ];
}
async function simpleHome() {
  const [overview, answer, org, lic, viewers, approvals, interviews] = await Promise.all([
    api('/api/overview'), api('/api/answer'), api('/api/org'), api('/api/process?service=LIC'),
    api('/api/viewers'), api('/api/approvals'), api('/api/interviews'),
  ]);
  const roles = viewers.viewers;
  const role = state.role && roles.some((r) => r.id === state.role) ? state.role : roles[0]?.id;
  const roleLabel = roles.find((r) => r.id === role)?.label ?? '';
  const tasks = tasksFor(roleLabel, { approvals, interviews, lic, answer });
  const top = [...lic.proposals].sort((a, b) => b.annualDaysSaved - a.annualDaysSaved)[0];
  return `
    <p class="hello">שלום דנה,</p>
    <h1>מה תרצו לדעת על העיר?</h1>
    <p class="lede">שאלו בשפה חופשית. תקבלו מספר, את הכלל שמאחוריו, ומה שלא ידוע.</p>
    <form class="ask" id="ask-form">
      <div class="ask-row">
        <input id="q" name="q" type="search" value="כמה משקי בית זכאים להנחה באגרת תברואה?" aria-label="שאלה" />
        <button class="btn" type="submit">שאל</button>
      </div>
      <div class="chips">
        <button class="chip" type="button" data-q="כמה עסקים יש בעיר?">עסקים</button>
        <button class="chip" type="button" data-q="כמה תושבים יש בעיר?">תושבים</button>
        <button class="chip" type="button" data-q="מי מטפל בפיקוח?">מי מטפל בפיקוח</button>
      </div>
    </form>
    <div id="answer-slot">${simpleAnswer(answer)}</div>
    <section class="card mine">
      <h2>המשימות שלי</h2>
      <p class="sub">${escapeHtml(roleLabel)} · רק מה שממתין לכם, בלי גרפים</p>
      ${tasks.map((t) => `<div class="task"><div><p>${escapeHtml(t.label)}</p></div><div style="display:flex;align-items:center;gap:14px"><span class="num">${num(t.value)}</span><a href="${t.href}">פתח</a></div></div>`).join('')}
    </section>
    <div class="home-grid">
      <article class="card mini"><h3>אנשים</h3><div class="val">${num(overview.graph.byType.person)}</div><p>${num(org.units.length)} יחידות · ${num(org.responsibilities.length)} אחריויות שזוהו</p><button class="engine-btn" type="button" data-engine="people">מה למדנו?</button></article>
      <article class="card mini"><h3>תהליכים</h3><div class="val">${num(lic.model.medianTotalDays)} יום</div><p>חציון רישיון עסק · ${num(lic.model.caseCount)} תיקים</p><button class="engine-btn" type="button" data-engine="mail">מה למדנו?</button></article>
      <article class="card mini"><h3>אוטומציות</h3><div class="val">${num(top?.annualDaysSaved ?? 0)}</div><p>ימי עבודה בשנה שאפשר לחסוך</p><button class="engine-btn" type="button" data-engine="form">איך נראה הפתרון?</button></article>
    </div>`;
}

/* --------------------------------------------------------------- engine modal */
async function openEngine(kind) {
  const dialog = document.getElementById('engine');
  const body = document.getElementById('engine-body');
  const title = document.getElementById('engine-title');
  if (!dialog || !body) return;
  const titles = { eligibility: 'איך הגענו למספר', interview: 'איך סוגרים את הפער', mail: 'מה למדנו מהדואר', people: 'מה למדנו מהמערכת הארגונית', form: 'איך נולד הטופס' };
  title.textContent = titles[kind] ?? 'איך הגענו לזה';
  body.innerHTML = '<p class="hello">אוסף את הראיות…</p>';
  dialog.showModal();
  try {
    const data = await api('/api/tour');
    const scenario = data.scenarios.find((sc) => sc.id === kind) ?? data.scenarios[0];
    body.innerHTML = scenario.steps.map((step) => {
      const cls = step.kind === 'action' ? 'ev-row action' : 'ev-row evidence';
      const tag = step.kind === 'action' ? '<span class="tag act">פעולה</span>' : '<span class="tag ev">ראיה</span>';
      if (step.kind === 'source') return `<div class="${cls}">${tag}<div class="ev-top"><span class="sys">${escapeHtml(step.system)}</span><code class="locator">${escapeHtml(step.locator)}</code></div><pre class="ev-quote">${escapeHtml(step.excerpt)}</pre><p class="ev-did">${escapeHtml(step.didHe)}</p></div>`;
      if (step.kind === 'sources') return `<div class="${cls}">${tag}<div class="ev-top"><span class="sys">${escapeHtml(step.system)}</span></div>${step.items.map((m) => `<pre class="ev-quote">${escapeHtml(m.subject)} — ${escapeHtml(m.from)}</pre>`).join('')}<p class="ev-did">${escapeHtml(step.didHe)}</p></div>`;
      if (step.kind === 'inference' || step.kind === 'fields') return `<div class="${cls}">${tag}<div class="ev-top"><strong>${escapeHtml(step.titleHe)}</strong></div><ul class="inferred">${step.items.map((i) => `<li><strong>${escapeHtml(i.name ?? i.label)}</strong> ${escapeHtml(i.summary ?? i.rule ?? '')}</li>`).join('')}</ul><p class="ev-did">${escapeHtml(step.didHe)}</p></div>`;
      if (step.kind === 'result') return `<div class="${cls}">${tag}<strong>${escapeHtml(step.titleHe)}</strong><p class="ev-did">כלל ${escapeHtml(step.rule?.code ?? '')} גרסה ${step.rule?.version ?? ''} · ${escapeHtml(step.rule?.owner ?? '')}</p></div>`;
      return `<div class="${cls}">${tag}<strong>${escapeHtml(step.titleHe)}</strong><p class="ev-did">${escapeHtml(step.textHe)}</p></div>`;
    }).join('');
  } catch (error) {
    body.innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`;
  }
}

function roleKind(label) {
  if (/מנהל|head/i.test(label)) return 'head';
  if (/רכז|מזכיר|coordinator|clerk|permits/i.test(label)) return 'clerk';
  return 'field';
}
function tabsFor(kind) {
  const ids = {
    head: ['home', 'approvals', 'sources', 'workspace'],
    clerk: ['home', 'ask', 'sources', 'approvals'],
    field: ['home', 'ask', 'workspace'],
  }[kind];
  return TABS.filter((t) => ids.includes(t.id));
}
function roleSelectView(viewers) {
  return `
    <div class="role-hero">
      <p class="eyebrow">כניסה למערכת</p>
      <h1>מי נכנס עכשיו?</h1>
      <p class="lede">כל תפקיד רואה את מה שהוא צריך לעשות — לא את כל המערכת.</p>
      <div class="role-grid">
        ${viewers.map((v) => {
          const kind = roleKind(v.label);
          const what = {
            head: 'אישורים, מצב המחלקה ומקורות המידע',
            clerk: 'שאלות, בקשות והפערים שממתינים לאדם',
            field: 'העבודה בשטח והמערכות היומיומיות',
          }[kind];
          return `<button class="role-card" type="button" data-pick-role="${v.id}" data-role-label="${escapeHtml(v.label)}">
            <span class="role-avatar">${escapeHtml(v.label.slice(0, 1))}</span>
            <strong>${escapeHtml(v.label.split('(')[0].trim())}</strong>
            <span class="role-title">${escapeHtml(v.label.match(/\(([^)]+)\)/)?.[1] ?? '')}</span>
            <span class="role-what">${what}</span>
            <span class="role-go">כניסה ←</span>
          </button>`;
        }).join('')}
      </div>
      <p class="tiny muted" style="margin-top:22px">התפקיד קובע אילו פריטים בתפריט ובמסך הבית יוצגו. הנתונים עצמם זהים.</p>
    </div>`;
}

const VIEWS = { home: simpleHome, ask: askView, find: findView, sources: sourcesView, map: mapView, workspace: workspaceView, approvals: approvalsView, learning: learningView, forms: formsView, demo: tourView, people: peopleView, process: processView, onboard: onboardView };

function renderNav() {
  const nav = $('#nav');
  if (!state.role) { nav.innerHTML = ''; return; }
  const kind = roleKind(state.roleLabel ?? '');
  const tabs = tabsFor(kind);
  const roleName = (state.roleLabel ?? '').split('(')[0].trim();
  nav.innerHTML = tabs.map((t) => `<button type="button" data-tab="${t.id}" ${t.id === state.tab ? 'aria-current="page"' : ''}>${t.label}</button>`).join('')
    + `<button class="role-switch" type="button" data-reset-role>${escapeHtml(roleName)} · החלפה</button>`;
}

async function render() {
  if (!state.viewers) {
    try { state.viewers = (await api('/api/viewers')).viewers; } catch { state.viewers = []; }
  }
  if (!state.role) {
    $('#nav').innerHTML = '';
    $('#main').innerHTML = roleSelectView(state.viewers);
    document.title = 'כניסה · מערכת המידע העירונית';
    return;
  }
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
      const extra = answer.assistant;
      if (extra?.kind === 'people') {
        slot.innerHTML = `<section class="answer"><h2>${escapeHtml(extra.headline)}</h2>
          <p class="rule">${escapeHtml(extra.hint)}</p>
          <div class="grid-3">${(extra.people ?? []).map((person) => `<article class="card"><h3>${escapeHtml(person.name)}</h3><p>${escapeHtml(person.title)}</p><p class="meta">${num(person.support)} אירועים · ממתין לאישור</p></article>`).join('') || '<p class="hello">לא מצאתי אחראי מזוהה.</p>'}</div></section>`;
        return;
      }
      if (extra?.kind === 'process') {
        slot.innerHTML = `<section class="answer"><h2>${escapeHtml(extra.headline)}</h2>
          <p class="rule">${escapeHtml(extra.detail)}</p>
          <div class="grid-3">${(extra.steps ?? []).map((step) => `<article class="card"><h3>${escapeHtml(step.label)}</h3><div class="big">${num(step.days)} ימים</div><p>${escapeHtml(step.role)}</p></article>`).join('')}</div>
          <p class="note">${escapeHtml(extra.hint)}</p></section>`;
        return;
      }
      slot.innerHTML = `<div class="err">${escapeHtml(answer.refused)}</div>`;
      return;
    }
    slot.innerHTML = simpleAnswer(answer);
  } catch (error) {
    slot.innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`;
  }
}

function fromHash() {
  const id = location.hash.replace('#/', '').replace('#', '');
  return TABS.some((t) => t.id === id) ? id : 'home';
}

document.addEventListener('click', async (event) => {
  const accept = event.target.closest('[data-accept-candidate]');
  if (accept) {
    accept.disabled = true;
    const res = await fetch('/api/candidates/accept', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: accept.dataset.acceptCandidate }),
    });
    const body = await res.json();
    const slot = document.getElementById('overlay-slot');
    if (slot) slot.innerHTML = `<pre class="code-block" style="margin-top:16px;direction:ltr;text-align:left">${escapeHtml(JSON.stringify(body.overlayDraft, null, 2))}</pre>`;
    accept.textContent = 'נוסף';
    return;
  }
  const toggle = event.target.closest('[data-toggle-source]');
  if (toggle) {
    const enabled = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.disabled = true;
    await fetch(`/api/connectors/${encodeURIComponent(toggle.dataset.toggleSource)}/toggle`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }),
    });
    if (location.hash !== '#/sources') location.hash = '#/sources';
    else render();
    return;
  }
  const findHit = event.target.closest('[data-find-ref]');
  if (findHit) {
    const out = document.getElementById('find-out');
    out.innerHTML = '<p class="hello">קורא את הרשומה…</p>';
    api('/api/page?ref=' + encodeURIComponent(findHit.dataset.findRef))
      .then((page) => {
        out.innerHTML = `<div class="card"><p class="eyebrow">מה שמור על הרשומה</p><h3>${escapeHtml(page.title)}</h3>
          <ul class="inferred">${(page.facts ?? []).map((f) => `<li><strong>${escapeHtml(f.property)}</strong>: ${escapeHtml(String(f.value))} <span class="tiny muted">· ${escapeHtml(f.status)}</span></li>`).join('') || '<li>אין עובדות.</li>'}</ul>
          <a class="btn quiet" href="#/workspace">חזרה למערכות המקור ←</a></div>`;
      })
      .catch((error) => { out.innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`; });
    return;
  }
  const pick = event.target.closest('[data-pick-role]');
  if (pick) {
    state.role = pick.dataset.pickRole;
    state.roleLabel = pick.dataset.roleLabel;
    state.tab = 'home';
    const url = new URL(location.href);
    url.searchParams.set('role', state.role);
    history.replaceState(null, '', url);
    render();
    return;
  }
  if (event.target.closest('[data-reset-role]')) {
    state.role = null; state.roleLabel = null;
    const url = new URL(location.href);
    url.searchParams.delete('role');
    history.replaceState(null, '', url);
    render();
    return;
  }
  const roleChip = event.target.closest('[data-role]');
  if (roleChip) { state.role = roleChip.dataset.role; render(); return; }
  const engineBtn = event.target.closest('[data-engine]');
  if (engineBtn) { openEngine(engineBtn.dataset.engine); return; }
  if (event.target.closest('[data-close-engine]')) { document.getElementById('engine')?.close(); return; }
  const approveItem = event.target.closest('[data-approve-kind]');
  if (approveItem) {
    const card = approveItem.closest('.approval');
    const out = card?.querySelector('.approval-out');
    approveItem.disabled = true;
    try {
      const kind = approveItem.dataset.approveKind;
      const id = approveItem.dataset.approveId;
      if (kind === 'suggestion') await api(`/api/suggestions/${encodeURIComponent(id)}/approve`, { method: 'POST' });
      else if (kind === 'automation') await api(`/api/automations/${encodeURIComponent(id)}/approve`, { method: 'POST' });
      else await api('/api/candidates/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
      if (out) out.innerHTML = '<p class="ok-note">אושר ונרשמה החלטה.</p>';
      approveItem.remove();
    } catch (error) {
      approveItem.disabled = false;
      if (out) out.innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`;
    }
    return;
  }
  const graphBtn = event.target.closest('[data-graph]');
  if (graphBtn) {
    const slot = document.getElementById('ws-graph');
    if (slot) {
      slot.innerHTML = '<p class="hello">קורא את מה שנשמר על המקור…</p>';
      const page = await api('/api/page?ref=' + encodeURIComponent(graphBtn.dataset.graph));
      const facts = (page.facts ?? []).map((f) => `<li><strong>${escapeHtml(f.property)}</strong>: ${escapeHtml(String(f.value))} <span class="tiny muted">· ${escapeHtml(f.status)} · ${escapeHtml(f.provenance?.evidence_class ?? '')}</span></li>`).join('');
      const evidence = (page.facts ?? []).flatMap((f) => f.evidence ?? []).slice(0, 3);
      slot.innerHTML = `<div class="card ws-learned"><p class="eyebrow">מה נשמר בגרף</p><h3>${escapeHtml(page.title)}</h3>
        <ul class="inferred">${facts || '<li>אין עובדות שמורות.</li>'}</ul>
        ${evidence.map((e) => `<pre class="evid">${escapeHtml(e.excerpt ?? '')}</pre>`).join('')}
        ${page.hiddenFactCount ? `<p class="note">${num(page.hiddenFactCount)} עובדות מוסתרות מהצופה הזה.</p>` : ''}
      </div>`;
      slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  const msg = event.target.closest('[data-msg]');
  if (msg) { state.ws = { ...(state.ws ?? {}), msg: Number(msg.dataset.msg) }; render(); return; }
  const doc = event.target.closest('[data-doc]');
  if (doc) { state.ws = { ...(state.ws ?? {}), doc: Number(doc.dataset.doc) }; render(); return; }
  const replay = event.target.closest('[data-action="replay"]');
  if (replay) { startReplay(replay); return; }
  const tourScenario = event.target.closest('[data-tour-scenario]');
  if (tourScenario) {
    state.tour = { pick: Number(tourScenario.dataset.tourScenario), shown: 1, out: null };
    render();
    return;
  }
  const tourNext = event.target.closest('[data-tour-next]');
  if (tourNext) { state.tour.shown += 1; state.tour.out = null; render(); return; }
  const tourAction = event.target.closest('[data-tour-action]');
  if (tourAction) { runTourAction(tourAction.dataset.tourAction); return; }
  const demo = event.target.closest('[data-demo-action]');
  if (demo) {
    const scenarioId = demo.closest('.scenario')?.querySelector('.demo-out')?.id?.replace('out-', '');
    const out = document.getElementById('out-' + scenarioId);
    if (out) runDemoAction(demo.dataset.demoAction, out);
    return;
  }
  const pickForm = event.target.closest('[data-form-pick]');
  if (pickForm) {
    state.formPick = pickForm.dataset.formPick;
    render();
    return;
  }
  const approve = event.target.closest('[data-approve-suggestion]');
  if (approve) {
    approve.disabled = true;
    await fetch(`/api/suggestions/${encodeURIComponent(approve.dataset.approveSuggestion)}/approve`, { method: 'POST' });
    render();
  }
});

window.addEventListener('hashchange', () => { state.tab = fromHash(); state.answer = null; render(); });
$('#nav').addEventListener('click', (e) => {
  const button = e.target.closest('[data-tab]');
  if (button) location.hash = '#/' + button.dataset.tab;
});
state.tab = fromHash();
const urlRole = new URLSearchParams(location.search).get('role');
if (urlRole) state.role = urlRole;
if (state.role) {
  state.viewers = state.viewers ?? null;
  api('/api/viewers').then((v) => {
    state.viewers = v.viewers;
    state.roleLabel = v.viewers.find((x) => x.id === state.role)?.label ?? '';
    render();
  }).catch(() => render());
} else {
  render();
}
