import {
  esc,
  num,
  pct,
  ltr,
  heDate,
  shortDate,
  timeOf,
  fileSize,
  initials,
  icon,
  microsoftMark,
  badge,
  chip,
  mixed,
  splitPct,
  sensitivityHe,
  statusHe,
  typeHe,
  emptyBox,
  parsePerson,
  roleKind,
  roleWhat,
  navFor,
  NAV,
  sourceNameHe,
  riskHe,
} from './ui.js';

const cityMark = () => `
  <span class="mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-5h6v5"/>
    </svg>
  </span>`;

const toneFor = (kind) =>
  ({ automation: 'green', suggestion: 'blue', gap: 'amber', property: 'violet', rule: 'red', responsibility: 'teal' })[kind] ?? 'neutral';

const kindLabel = (kind) =>
  ({ automation: 'אוטומציה', suggestion: 'הצעת מחקר', gap: 'פער מידע', property: 'מאפיין מודל', rule: 'שינוי כלל' })[kind] ?? kind;

const kindIcon = (kind) =>
  ({ automation: 'flow', suggestion: 'spark', gap: 'question', property: 'layers', rule: 'shield' })[kind] ?? 'info';

/* ------------------------------------------------------------------ landing */

export function landingView({ viewers, answer, overview, approvals }) {
  const counts = answer?.counts ?? {};
  const total = Number(counts.total ?? 0) || 1;
  const org = overview?.org ?? {};
  const graph = overview?.graph ?? {};
  const lic = (overview?.services ?? []).find((service) => service.code === 'LIC') ?? {};
  const bottleneckDays = Number(lic?.bottleneckDays ?? 0);
  const medianDays = Number(lic?.medianDays ?? 0);
  const bottleneckShare = medianDays ? Math.round((bottleneckDays / medianDays) * 100) : 0;
  const openResp = Number(org?.openResponsibilities ?? 0);
  const confirmedResp = Number(org?.confirmedResponsibilities ?? 0);
  const roles = viewers
    .map((viewer, index) => {
      const person = parsePerson(viewer.label);
      const kind = roleKind(viewer.label);
      const tabs = navFor(kind).map((id) => NAV[id]?.label).filter(Boolean);
      const clearance = Number(viewer.clearance ?? 0);
      return `
        <button class="role-row" type="button" data-role="${esc(viewer.id)}" data-role-label="${esc(viewer.label)}">
          <span class="avatar avatar-${index % 5}">${esc(initials(person.name))}</span>
          <span class="role-main">
            <strong>${esc(person.name)}</strong>
            <span class="role-title">${esc(person.title)}</span>
            <span class="role-tabs">${esc(tabs.slice(0, 3).join(' · '))}</span>
          </span>
          <span class="role-side">
            <span class="clearance">${clearance >= 3 ? 'סיווג 3' : 'סיווג 1'}</span>
            ${icon('arrowLeft')}
          </span>
        </button>`;
    })
    .join('');

  const preview = answer
    ? `
      <div class="preview">
        <div class="preview-top">
          <span class="preview-label">${icon('spark')} שאלה נפוצה</span>
          ${answer.rule ? `<span class="preview-rule">${ltr(answer.rule.code)} · גרסה ${esc(answer.rule.version)}</span>` : ''}
        </div>
        <p class="preview-question">${esc(answer.question)}</p>
        <div class="preview-counts">
          <span class="pv-good"><b>${num(counts.eligible)}</b>זכאים</span>
          <span><b>${num(counts.notEligible)}</b>אינם זכאים</span>
          <span class="pv-warn"><b>${num(counts.unknown)}</b>לא ידוע</span>
        </div>
        <div class="preview-bar" aria-hidden="true">
          <i class="pv-seg-good" style="width:${(Number(counts.eligible ?? 0) / total) * 100}%"></i>
          <i class="pv-seg-plain" style="width:${(Number(counts.notEligible ?? 0) / total) * 100}%"></i>
          <i class="pv-seg-warn" style="width:${(Number(counts.unknown ?? 0) / total) * 100}%"></i>
        </div>
        <p class="preview-note">${icon('info')} ${num(counts.unknown)} משקי בית אינם ניתנים להכרעה — חסר נתון הכנסה. גם זה חלק מהתשובה.</p>
      </div>`
    : `<div class="preview preview-empty"><p>טוען דוגמה מהנתונים…</p></div>`;

  const pending = Number(approvals?.counts?.total ?? 0);

  return `
    <div class="landing">
      <div class="landing-orb" aria-hidden="true"></div>
      <div class="landing-grid">
        <section class="landing-intro">
          <div class="landing-brand">
            ${cityMark()}
            <div>
              <p class="city">עיריית גבעת רימון</p>
              <p class="system">מערכת המידע העירונית · תברואה ובריאות</p>
            </div>
          </div>
          <p class="eyebrow">גרסת הדגמה · נתונים סינתטיים</p>
          <h1>העיר יודעת.<br><span>עכשיו אפשר לשאול.</span></h1>
          <p class="landing-lead">
            כל מה שהמחלקה עושה נמצא במערכות שלה. המערכת מחברת אותן, לומדת מהן,
            ועונה על שאלות עם הכלל והמקור שמאחורי כל מספר — כולל מה שעדיין לא ידוע.
          </p>
          ${preview}
          <ul class="landing-findings" aria-label="מה המערכת מצאה">
            <li><b>${num(bottleneckDays)}</b><span>ימים בצוואר הבקוק</span><em>${num(bottleneckShare)}% מזמן התיק</em></li>
            <li><b>${num(counts.unknown)}</b><span>משקי בית בלי נתון הכנסה</span><em>לא ניתן להכריע, לא אפס</em></li>
            <li><b>${num(openResp)}</b><span>אחריויות שזוהו מהעבודה</span><em>${num(confirmedResp)} אושרו עדיין</em></li>
          </ul>
        </section>

        <section class="landing-who" aria-labelledby="who-title">
          <div class="who-head">
            <p class="eyebrow">כניסה למערכת</p>
            <h2 id="who-title">מי נכנס עכשיו?</h2>
            <p>זהות אמיתית מהספרייה הארגונית. כל תפקיד רואה את מה שהוא צריך להחליט — ולא את כל המערכת.</p>
          </div>
          <div class="role-list" role="list">${roles}</div>
          <div class="who-foot">
            <span>${pending} החלטות ממתינות במחלקה כרגע</span>
            <span>${icon('lock')} גישה לפי הרשאות המקור</span>
          </div>
        </section>
      </div>
      <footer class="landing-foot">
        <span>${icon('lock')} קריאה בלבד מהמערכות · הרשאות המקור נשמרות</span>
        <span>עודכן ${shortDate(overview?.organization?.capturedAt)} · POC</span>
      </footer>
    </div>`;
}

export function roleSheetBody(viewers) {
  return `
    <p class="sheet-lead">התפקיד קובע את התפריט, את סדר הדברים בבית, ואת מה שמותר לקרוא במקור. הנתונים עצמם זהים.</p>
    <div class="role-list role-list-sheet">
      ${viewers
        .map((viewer, index) => {
          const person = parsePerson(viewer.label);
          const kind = roleKind(viewer.label);
          return `<button class="role-row" type="button" data-role="${esc(viewer.id)}" data-role-label="${esc(viewer.label)}">
            <span class="avatar avatar-${index % 5}">${esc(initials(person.name))}</span>
            <span class="role-main"><strong>${esc(person.name)}</strong><span class="role-title">${esc(person.title)}</span><span class="role-tabs">${esc(roleWhat(kind))}</span></span>
            <span class="role-side">${Number(viewer.clearance) >= 3 ? 'סיווג 3' : 'סיווג 1'}${icon('arrowLeft')}</span>
          </button>`;
        })
        .join('')}
    </div>
    <div class="sheet-actions"><button class="btn btn-quiet" type="button" data-exit-role>${icon('switch')} חזרה למסך הכניסה</button></div>`;
}

/* --------------------------------------------------------------------- home */

export function homeView({ viewer, kind, overview, answer, org, process, approvals, interviews, connectors, gap }) {
  const person = parsePerson(viewer?.label);
  const pending = approvals?.pending?.length ?? 0;
  const openInterviews = (interviews?.interviews ?? []).filter((i) => i.status === 'open');
  const focus = focusItems({ kind, approvals, process, gap, openInterviews, pending });
  const viewerRef = viewer?.id ? `mun:person:${viewer.id}` : '';
  const mine = viewerRef ? (org?.responsibilities ?? []).filter((r) => r.personRef === viewerRef) : [];
  const headline =
    ({
      head: 'המחלקה במבט אחד, וההחלטות שמחכות לך.',
      clerk: 'התיקים שלך, וההחלטות שדורשות אותך.',
      field: 'הביקורות שלך והמערכות שבהן אתה עובד.',
      rule: 'השאלות וההחלטות על כלל הזכאות.',
      steward: 'שינויי המודל והכיסוי של הנתונים.',
      secretary: 'המשימות והמסמכים שמחכים לך.',
    })[kind] ?? 'מה מחכה לך היום.';

  return `
    <div class="view home-view">
      <header class="page-head">
        <div>
          <p class="eyebrow">${heDate(overview?.organization?.capturedAt)} · נתוני הדגמה</p>
          <h1>שלום, ${esc(person.name.split(' ')[0])}</h1>
          <p class="page-sub">${esc(headline)}</p>
        </div>
        <span class="head-status">${icon('check')} מחובר/ת · ${esc(person.title)}</span>
      </header>

      ${roleHomeBlock({ kind, overview, answer, org, process, approvals, openInterviews, mine, viewer })}

      <div class="home-columns">
        <section class="home-main" aria-labelledby="focus-title">
          ${focusList(focus, person.name, navFor(kind).includes('approvals'), pending)}
        </section>
        <aside class="rail">
          ${mine.length ? personalCard(mine) : ''}
          ${navFor(kind).includes('sources') ? sourcesCard(connectors, navFor(kind).includes('sources')) : ''}
          ${decisionsCard(overview?.decisions ?? [])}
        </aside>
      </div>

      <p class="data-note">${icon('shield')} כל מספר במסך מגיע מהנתונים, עם הכלל והמקור. ההחלטות נשמרות על שם האדם שאישר אותן.</p>
    </div>`;
}

function roleHomeBlock({ kind, overview, answer, org, process, approvals, openInterviews, mine, viewer }) {
  const cases = overview?.cases;
  const myWork = cases?.myWork;
  if (kind === 'head') {
    const open = Number(cases?.open ?? 0);
    const overdue = Number(cases?.overdue ?? 0);
    const median = Number(process?.model?.medianTotalDays ?? 0);
    const bottleneck = process?.model?.bottleneck;
    const bottleneckDays = Number(bottleneck?.medianWaitDays ?? 0);
    const share = median ? Math.round((bottleneckDays / median) * 100) : 0;
    const gapCount = Number(answer?.counts?.unknown ?? 0);
    const openResp = Number(overview?.org?.openResponsibilities ?? 0);
    const confirmedResp = Number(overview?.org?.confirmedResponsibilities ?? 0);
    return `
      <section class="role-block role-head">
        <header class="role-block-head">
          <div>
            <p class="eyebrow">המחלקה במבט אחד</p>
            <h2>${num(open)} תיקים פתוחים · ${num(overdue)} חריגים מול SLA</h2>
            <p>הזמן נמדד מיומן התיקים. ${num(median)} יום חציון לתיק, ${num(bottleneckDays)} ימים בצוואר הבקוק.</p>
          </div>
          <button class="btn btn-quiet btn-small" type="button" data-open-palette>${icon('search')} שאלו שאלה</button>
        </header>
        <div class="role-metrics">
          <div><b>${num(open)}</b><span>תיקים פתוחים</span></div>
          <div class="is-warn"><b>${num(overdue)}</b><span>חריגים מול SLA ${num(cases?.slaDays ?? 30)} יום</span></div>
          <div><b>${num(median)}</b><span>יום חציון לתיק</span></div>
          <div><b>${num(bottleneckDays)}</b><span>ימים בצוואר הבקוק</span></div>
        </div>
        <div class="role-lower">
          <div class="stage-block">
            <h3>תיקים פתוחים לפי שלב</h3>
            ${(cases?.stages ?? []).map((stage) => `<div class="stage-row"><span>${esc(stage.label)}</span><div class="bar"><i style="width:${Math.round((Number(stage.count) / Math.max(1, open)) * 100)}%"></i></div><b>${num(stage.count)}</b></div>`).join('') || '<p class="muted">אין תיקים פתוחים.</p>'}
          </div>
          <div class="findings-block">
            <h3>מה גילינו</h3>
            <a class="finding-row" href="#/insights"><span class="finding-num">${num(bottleneckDays)}</span><div><strong>${esc(bottleneck?.labels ?? '')} הוא צוואר הבקוק</strong><p>${num(share)}% מזמן התיק. ${num(bottleneck?.occurrences ?? 0)} תיקים נמדדו.</p></div></a>
            <div class="finding-row"><span class="finding-num">${num(gapCount)}</span><div><strong>משקי בית בלי נתון הכנסה</strong><p>לא ניתן להכריע בזכאות. השאלה נשלחת מהרכזת אל משה טל, ובעל הכלל מכריע.</p></div></div>
            <a class="finding-row" href="#/insights"><span class="finding-num">${num(openResp)}</span><div><strong>אחריויות שזוהו מהעבודה</strong><p>${num(confirmedResp)} אושרו עדיין. האחריות מוצגת לאדם עצמו, לא למנהל.</p></div></a>
          </div>
        </div>
      </section>`;
  }

  if (kind === 'clerk') {
    const myCases = myWork?.myCases ?? [];
    const overdue = myCases.filter((entry) => entry.overdue).length;
    return `
      <section class="role-block role-clerk">
        <header class="role-block-head">
          <div>
            <p class="eyebrow">התור שלך</p>
            <h2>${num(myCases.length)} תיקים פתוחים · ${num(overdue)} חריגים</h2>
            <p>לפי השלב האחרון ביומן התיק. הזמן נמדד מתאריך פתיחת התיק.</p>
          </div>
          <a class="text-link" href="#/approvals">להחלטות שלי ${icon('arrowLeft')}</a>
        </header>
        ${
          myCases.length
            ? `<div class="case-list">${myCases
                .slice(0, 5)
                .map(
                  (entry) => `<button class="case-row" type="button" data-record="${esc(entry.ref)}">
                    <span class="case-row-main"><strong>${esc(entry.subjectName)}</strong><span>${esc(entry.stageLabel)} · ${esc(entry.serviceLabel)}</span></span>
                    <span class="case-row-meta">${num(entry.ageDays)} ימים${entry.overdue ? ` · ${badge('חריג', 'red')}` : ''}</span>
                    ${icon('arrowLeft')}
                  </button>`,
                )
                .join('')}${myCases.length > 5 ? `<p class="rail-note">ועוד ${num(myCases.length - 5)} תיקים ב<a href="#/insights">תמונת המחלקה</a>.</p>` : ''}</div>`
            : '<p class="muted">אין תיקים פתוחים בתור שלך כרגע.</p>'
        }
        <div class="role-block-foot">${icon('info')} ${num(overdue)} חריגים מול SLA ${num(cases?.slaDays ?? 30)} יום. ${icon('clock')} הזמן נמדד מתאריך פתיחת התיק.</div>
      </section>`;
  }

  if (kind === 'field') {
    const openInspections = myWork?.openInspections ?? [];
    const done = Number(myWork?.inspectionsDone ?? 0);
    const food = /מזון/.test(String(myWork?.title ?? ''));
    const workLabel = food ? 'ביקורות מזון' : 'ביקורות תברואה';
    const headline = done
      ? `${num(done)} ${workLabel} שביצעת · ${num(openInspections.length)} פתוחות`
      : `אין ${workLabel} משויכות אליך במקור`;
    return `
      <section class="role-block role-field">
        <header class="role-block-head">
          <div>
            <p class="eyebrow">העבודה שלך</p>
            <h2>${headline}</h2>
            <p>${food ? 'הביקורות בתיקי רישיון עסק מגיעות מיומן התיק, וההיסטוריה נספרת רק כשהופעת בה כפעיל.' : 'המקור אינו מקצה ביקורות תברואה לאדם, ולכן אינן מיוחסות אליך. זו מגבלה של הנתונים, לא של המסך.'}</p>
          </div>
          <a class="text-link" href="#/insights">לתמונת התהליך ${icon('arrowLeft')}</a>
        </header>
        <div class="role-metrics">
          <div><b>${num(done)}</b><span>${food ? 'ביקורות מזון שביצעת' : 'ביקורות תברואה שביצעת'}</span></div>
          <div><b>${num(openInspections.length)}</b><span>ביקורות פתוחות</span></div>
          <div><b>${num(cases?.open ?? 0)}</b><span>תיקים פתוחים במחלקה</span></div>
        </div>
        ${
          openInspections.length
            ? `<div class="case-list">${openInspections
                .slice(0, 5)
                .map(
                  (entry) => `<button class="case-row" type="button" data-record="${esc(entry.ref)}"><span class="case-row-main"><strong>${esc(entry.subjectName)}</strong><span>${esc(entry.stageLabel)} · ${esc(entry.serviceLabel)}</span></span><span class="case-row-meta">${num(entry.ageDays)} ימים</span>${icon('arrowLeft')}</button>`,
                )
                .join('')}</div>`
            : `<p class="muted">${food ? 'אין תיקי רישיון עסק פתוחים בשלב ביקורת כרגע.' : 'אין ביקורות פתוחות שמשויכות אליך, כי המקור לא מקצה אותן.'}</p>`
        }
        <div class="role-block-foot">${icon('info')} ${food ? 'ההיסטוריה האישית מחושבת מאירועי ביקורת בתיקי רישיון העסק. אין כאן שיבוץ עתידי, כי הוא לא קיים במקור.' : 'המקור הוא יומן התיקים; אין בו שדה של מפקח תברואה, ולכן המסך לא ממציא שיבוץ.'}</div>
      </section>`;
  }

  if (kind === 'rule') {
    const open = openInterviews.length;
    const rule = answer?.rule;
    const unknown = Number(answer?.counts?.unknown ?? 0);
    return `
      <section class="role-block role-rule">
        <header class="role-block-head">
          <div>
            <p class="eyebrow">כלל הזכאות</p>
            <h2>${open === 1 ? 'שאלה אחת ממתינה ממך' : open ? `${num(open)} שאלות ממתינות ממך` : 'אין שאלות פתוחות'}</h2>
            <p>${rule ? `${ltr(rule.code)} גרסה ${esc(rule.version)} · ${esc(rule.owner)} · ${esc(rule.citation)}` : 'כלל הזכאות נקרא מהקטלוג.'}</p>
          </div>
          ${open ? `<button class="btn btn-small" type="button" data-interview-open="${esc(openInterviews[0].ref)}">${icon('question')} ענה לשאלה</button>` : ''}
        </header>
        <div class="role-metrics">
          <div><b>${num(unknown)}</b><span>משקי בית לא ניתנים להכרעה</span></div>
          <div><b>${num(open)}</b><span>שאלות פתוחות</span></div>
          <div><b>${num(approvals?.pending?.length ?? 0)}</b><span>החלטות שלך</span></div>
        </div>
        <div class="role-block-foot">${icon('info')} ${open ? 'השאלות נשלחו אליך ממיכל; התשובות נרשמות על שמך. שאלת מדיניות נרשמת כהחלטת בעל הכלל.' : 'אין שאלה שממתינה לך. ההחלטות על הכלל מופיעות למטה.'}</div>
      </section>`;
  }

  if (kind === 'steward') {
    const properties = (approvals?.pending ?? []).filter((item) => item.kind === 'property');
    return `
      <section class="role-block role-steward">
        <header class="role-block-head">
          <div>
            <p class="eyebrow">המודל</p>
            <h2>${num(properties.length)} שינויי מודל ממתינים</h2>
            <p>הוספות נכנסות כשכבת הרחבה של העיר. החבילות המשותפות לא נערכות.</p>
          </div>
          <a class="text-link" href="#/approvals">להחלטות ${icon('arrowLeft')}</a>
        </header>
        <div class="role-block-foot">${icon('layers')} ${num(overview?.ontology?.pageTypes?.length ?? 0)} טיפוסים · ${num(overview?.graph?.pages ?? 0)} רשומות · ${num(overview?.graph?.facts ?? 0)} עובדות. ${num(mine.length)} אחריויות אישיות.</div>
      </section>`;
  }

  // Secretary / default: a small, honest queue.
  const open = Number(cases?.open ?? 0);
  return `
    <section class="role-block role-clerk">
      <header class="role-block-head">
        <div><p class="eyebrow">המשימות שלך</p><h2>${num(open)} תיקים פתוחים במחלקה</h2><p>פניות, מסמכים ואישורים שמחכים לאדם. אין החלטות שמחכות לך כרגע.</p></div>
        <a class="text-link" href="#/workspace">למערכות ${icon('arrowLeft')}</a>
      </header>
      <div class="role-block-foot">${icon('info')} אפשר לפתוח את דואר העבודה ואת ספריית המסמכים, ולעקוב אחרי הפערים וההחלטות של המחלקה.</div>
    </section>`;
}

function focusItems({ kind, approvals, process, gap, openInterviews, pending }) {
  const items = [];

  if (kind === 'field') {
    items.push({
      tone: 'blue',
      icon: 'mail',
      reason: 'המערכות שלך',
      title: 'הדואר ומסמכי המחלקה',
      why: 'הקריאה מתוך הכלים עצמם, עם תוויות הרגישות וההרשאה שלך — לקריאה בלבד.',
      impact: 'M365',
      cta: 'למערכות',
      href: '#/workspace',
    });
    const bottleneck = process?.model?.bottleneck;
    if (bottleneck) {
      items.push({
        tone: 'amber',
        icon: 'clock',
        reason: 'מה נמדד בתהליך',
        title: `${bottleneck.labels} · ${num(bottleneck.medianWaitDays)} ימים`,
        why: `${num(bottleneck.occurrences)} תיקים נמדדו. זו ההמתנה הארוכה ביותר, לא עומס של אדם אחד.`,
        impact: `${num(bottleneck.occurrences)} תיקים`,
        cta: 'לתמונת התהליך',
        href: '#/insights',
      });
    }
    return items;
  }

  const myInterview = openInterviews[0] ?? null;
  if (gap && !(gap.interview?.isMine && myInterview)) {
    const open = gap.interview;
    const ruleWaiting = kind === 'rule' && !open;
    items.push({
      tone: open || ruleWaiting ? 'blue' : 'amber',
      icon: 'question',
      reason: open ? 'ממתין לתשובה' : ruleWaiting ? 'פער שממתין לשאלה' : 'פער שחוסם החלטה',
      title: gap.titleHe ?? `פער מידע: ${gap.proposal?.property ?? ''}`,
      why: open
        ? `השאלה נשלחה ל${open.personName}. התשובה תחזור כהחלטה, לא כניחוש.`
        : ruleWaiting
          ? 'הפער נמצא אצלך, אבל השאלה נשלחת על ידי רכזת הרישוי. עד שהיא תגיע, אין כאן טופס לענות עליו.'
          : gap.whyHe ?? gap.summary ?? '',
      impact: gap.impactHe ?? `${num(gap.support ?? gap.proposal?.blocked_decisions)} החלטות`,
      cta: open || ruleWaiting ? '' : 'שלח שאלה',
      action: open ? (open.isMine ? 'interview' : 'pending') : ruleWaiting ? 'pending' : 'gap',
      interviewRef: open?.ref,
      gapRef: gap.ref,
      pending: open && !open.isMine ? `ממתין ל${open.personName}` : ruleWaiting ? 'ממתין לשאלה ממיכל' : '',
    });
  }

  const ordered = [
    ...(approvals?.pending ?? []).filter((item) => item.kind === 'suggestion'),
    ...(approvals?.pending ?? []).filter((item) => item.kind === 'automation'),
    ...(approvals?.pending ?? []).filter((item) => item.kind === 'property'),
  ];
  for (const item of ordered.slice(0, Math.max(0, 4 - items.length))) {
    if (item.kind === 'gap') continue;
    items.push({
      tone: toneFor(item.kind),
      icon: kindIcon(item.kind),
      reason: kindLabel(item.kind),
      title: item.titleHe,
      why: item.whyHe,
      impact: item.impactHe ?? item.metaHe,
      cta: 'להחלטה',
      href: '#/approvals',
    });
  }

  if (!items.length) {
    const emptyHref = kind === 'field' ? '#/workspace' : navFor(kind).includes('insights') ? '#/insights' : '#/approvals';
    items.push({
      tone: 'green',
      icon: 'check',
      reason: 'הכל מטופל',
      title: 'אין דבר שממתין לך',
      why: 'השאלות נענו וההצעות טופלו. אפשר לשאול שאלה חדשה או לפתוח את תמונת המחלקה.',
      impact: '0 פתוחים',
      cta: kind === 'field' ? 'למערכות' : navFor(kind).includes('insights') ? 'לתמונת המחלקה' : 'למרכז ההכרעות',
      href: emptyHref,
    });
  }
  return items.slice(0, 4);
}

function focusList(items, name, showMore = false, totalPending = 0) {
  return `
    <section class="focus-card">
      <header class="section-head">
        <div>
          <p class="eyebrow">המשימות שלי</p>
          <h2 id="focus-title">מה מחכה ל${esc(name.split(' ')[0])}</h2>
        </div>
        <div class="focus-head-actions">
          <span class="section-count">${items.length === 1 ? 'פריט אחד' : `${items.length} פריטים`}</span>
          ${showMore ? `<a class="text-link" href="#/approvals">לכל ${totalPending ? `${num(totalPending)} ` : ''}ההחלטות ${icon('arrowLeft')}</a>` : ''}
        </div>
      </header>
      <div class="focus-list">
        ${items
          .map(
            (item, index) => `
          <article class="focus-row">
            <span class="focus-rank">${index + 1}</span>
            <span class="focus-icon tone-${item.tone}">${icon(item.icon)}</span>
            <div class="focus-copy">
              <p class="focus-reason">${esc(item.reason)}</p>
              <h3>${mixed(item.title)}</h3>
              <p class="focus-why">${mixed(item.why)}</p>
            </div>
            <div class="focus-side">
              <span class="focus-impact">${esc(item.impact)}</span>
              ${
                item.pending
                  ? `<span class="pending-pill">${icon('clock')} ${esc(item.pending)}</span>`
                  : item.action === 'gap'
                    ? `<button class="btn btn-small" type="button" data-gap-open="${esc(item.gapRef)}">${esc(item.cta)}</button>`
                    : item.action === 'interview'
                      ? `<button class="btn btn-small" type="button" data-interview-open="${esc(item.interviewRef)}">${esc(item.cta)}</button>`
                      : `<a class="btn btn-small ${index === 0 ? '' : 'btn-quiet'}" href="${esc(item.href)}">${esc(item.cta)}</a>`
              }
            </div>
          </article>`,
          )
          .join('')}
      </div>
    </section>`;
}

function personalCard(mine) {
  const open = mine.filter((r) => r.status === 'open');
  const accepted = mine.filter((r) => r.status === 'accepted');
  return `
    <section class="rail-card rail-personal">
      <header class="rail-head"><h3>מה למדנו עליך</h3><span>${open.length ? `${num(open.length)} ממתינות` : `${num(accepted.length)} אושרו`}</span></header>
      ${open.length ? `<p class="personal-summary">${mixed(open[0].summaryHe ?? open[0].summary)}</p>` : '<p class="rail-note">האחריויות שזוהו מהעבודה שלך אושרו.</p>'}
      <button class="btn btn-quiet btn-small" type="button" data-my-responsibilities>${open.length ? 'לבדיקה ואישור' : 'לצפייה באחריויות'}</button>
    </section>`;
}

export function myResponsibilitiesBody(org, viewerId) {
  const personRef = `mun:person:${viewerId}`;
  const mine = (org?.responsibilities ?? []).filter((r) => r.personRef === personRef);
  if (!mine.length) {
    return emptyBox('check', 'לא זוהו אחריויות', 'המערכת לא מצאה עדיין עבודה שמזוהה איתך. זה לא אומר שלא עובדים — זה אומר שאין עדיין ראיה.');
  }
  const open = mine.filter((r) => r.status === 'open');
  return `
    <div class="interview-head">
      <div><span class="avatar avatar-2">${esc(initials((org.people ?? []).find((p) => p.ref === personRef)?.name ?? ''))}</span><div><strong>${esc((org.people ?? []).find((p) => p.ref === personRef)?.name ?? '')}</strong><span>${esc((org.people ?? []).find((p) => p.ref === personRef)?.title ?? '')}</span></div></div>
      <span class="interview-cost">${icon('users')} ${num(mine.length)} אחריויות · ${num(open.length)} ממתינות</span>
    </div>
    <p class="sheet-lead">האחריויות נגזרו מהעבודה עצמה — מאירועי תיקים ומשרשורי דואר. אישור שלך הופך אותן לראיה; תיקון משאיר אותן כהצעה.</p>
    <div class="resp-review-list">
      ${mine
        .map(
          (r) => `<div class="resp-review" data-resp-row="${esc(r.candidateRef)}">
            <div class="resp-review-main">
              <p class="resp-review-summary">${mixed(r.summaryHe ?? r.summary)}</p>
              <span class="resp-review-meta">${r.signal === 'mail' ? 'משרשורי דואר' : 'מאירועי תיקים'} · ${num(r.support)} ראיות</span>
            </div>
            <span class="status-pill ${r.status === 'accepted' ? 'status-on' : ''}">${r.status === 'accepted' ? 'אושר' : r.status === 'rejected' ? 'לא מדויק' : 'ממתין'}</span>
            ${
              r.status === 'open'
                ? `<div class="resp-actions">
                    <button class="btn btn-small" type="button" data-resp-confirm="accept" data-resp-ref="${esc(r.candidateRef)}">מדויק</button>
                    <button class="btn btn-quiet btn-small" type="button" data-resp-confirm="reject" data-resp-ref="${esc(r.candidateRef)}">לא מדויק</button>
                  </div>`
                : ''
            }
          </div>`,
        )
        .join('')}
    </div>
    <div class="sheet-note">${icon('shield')} אישור או תיקון נרשמים כהחלטה על שמך. האחריות לא נמחקת — היא משתנה מסטטוס ״ממתין״ ל״אושר״ או ״לא מדויק״.</div>`;
}

function sourcesCard(connectors, canManage = true) {
  const sources = connectors?.sources ?? [];
  const connected = sources.filter((s) => s.enabled);
  return `
    <section class="rail-card rail-sources">
      <header class="rail-head"><h3>מקורות מחוברים</h3>${canManage ? `<a class="text-link" href="#/sources">ניהול ${icon('arrowLeft')}</a>` : ''}</header>
      <div class="source-mini-list">
        ${sources
          .map(
            (source) => `
          <div class="source-mini ${source.enabled ? 'is-on' : ''}">
            <span class="dot ${source.enabled ? 'dot-live' : ''}"></span>
            <span class="source-mini-name">${esc(source.nameHe)}</span>
            <span class="source-mini-status">${source.enabled ? 'מחובר' : 'כבוי'}</span>
          </div>`,
          )
          .join('')}
      </div>
      <p class="rail-note">${connected.length} מתוך ${sources.length} מחוברים · קריאה בלבד</p>
    </section>`;
}

function decisionsCard(decisions) {
  if (!decisions.length) {
    return `
      <section class="rail-card">
        <header class="rail-head"><h3>החלטות אחרונות</h3></header>
        <p class="rail-note">עדיין אין החלטות. הן יופיעו כאן עם שם המאשר והזמן.</p>
      </section>`;
  }
  return `
    <section class="rail-card">
      <header class="rail-head"><h3>החלטות אחרונות</h3><span>${decisions.length}</span></header>
      <ol class="decision-list">
        ${decisions
          .map(
            (decision) => `
          <li>
            <span class="decision-dot">${icon('check')}</span>
            <div><p>${esc(decision.title)}</p><span>${esc(String(decision.decidedBy ?? '').split(' (')[0])} · ${shortDate(decision.decidedAt)}</span></div>
          </li>`,
          )
          .join('')}
      </ol>
    </section>`;
}

/* ------------------------------------------------------------------- answer */

export function answerCard(answer, { gap = null, compact = false } = {}) {
  if (!answer) {
    return `<section class="answer-card answer-empty"><p>אפשר לשאול שאלה חדשה בכל רגע.</p></section>`;
  }

  if (answer.refused) {
    return refusalCard(answer);
  }

  const counts = answer.counts ?? {};
  const total = Number(counts.total ?? 0);
  const rule = answer.rule;
  const eligible = Number(counts.eligible ?? 0);
  const notEligible = Number(counts.notEligible ?? 0);
  const unknown = Number(counts.unknown ?? 0);
  const hasTri = Number.isFinite(Number(counts.eligible)) && counts.eligible !== null;
  const single = !hasTri && Number.isFinite(Number(counts.value));
  const unknownReason = answer.unknownReasons?.[0];
  const sourceLabels = (answer.sources ?? []).map((s) => sourceNameHe(s.system) ?? s.label).join(' · ');
  const gapRef = gap?.ref ?? null;
  const shares = splitPct([eligible, notEligible, unknown]);

  return `
    <section class="answer-card" aria-labelledby="answer-question">
      <header class="answer-head">
        <div>
          <p class="eyebrow">תשובה מהנתונים</p>
          <h2 id="answer-question">${mixed(answer.question)}</h2>
        </div>
        <button class="btn btn-ghost btn-small" type="button" data-explain>${icon('info')} איך חושב</button>
      </header>
      ${
        rule
          ? `<div class="rule-line">
              <span class="badge badge-rule">${ltr(rule.code)} · גרסה ${esc(rule.version)}</span>
              <span>${esc(rule.owner ?? '')}</span>
              <span class="rule-citation">${esc(rule.citation ?? '')}</span>
            </div>`
          : ''
      }
      ${answer.interpretationHe ? `<p class="interpretation">${icon('key')} <span>${mixed(answer.interpretationHe)}</span></p>` : ''}
      ${
        single
          ? `<div class="single-answer"><b>${num(counts.value)}</b><span>${esc({ business: 'עסקים', resident: 'תושבים', complaint: 'קריאות תברואה', household: 'משקי בית', case: 'תיקים' }[answer.plan?.entity] ?? 'רשומות')}</span></div>`
          : hasTri
            ? `
              <div class="answer-counts">
                <div class="metric metric-good"><b>${num(eligible)}</b><span>זכאים</span><span class="metric-sub">${shares[0]}%</span></div>
                <div class="metric"><b>${num(notEligible)}</b><span>אינם זכאים</span><span class="metric-sub">${shares[1]}%</span></div>
                <div class="metric metric-warn"><b>${num(unknown)}</b><span>לא ניתן להכריע</span><span class="metric-sub">${shares[2]}%</span></div>
                <div class="metric metric-total"><b>${num(total)}</b><span>משקי בית</span><span class="metric-sub">בסה״כ</span></div>
              </div>
              <div class="seg-bar" role="img" aria-label="זכאים ${eligible}, אינם זכאים ${notEligible}, לא ידוע ${unknown}">
                <i class="seg-good" style="width:${(eligible / Math.max(1, total)) * 100}%"></i>
                <i class="seg-plain" style="width:${(notEligible / Math.max(1, total)) * 100}%"></i>
                <i class="seg-warn" style="width:${(unknown / Math.max(1, total)) * 100}%"></i>
              </div>
              ${
                unknown > 0
                  ? `<div class="unknown-note">
                      <span class="unknown-icon">${icon('alert')}</span>
                      <div>
                        <strong>${num(unknown)} משקי בית לא ניתנים להכרעה${unknownReason ? ` — חסר ${esc(unknownReason.property_label_he ?? unknownReason.label_he)}` : ''}.</strong>
                        <p>הפער לא נעלם בתוך המספר הכולל: הוא נשמר, ממופה ומוכן לשאלה למי שמחזיק את הנתון.${answer.provisional ? ' התשובה היא בגדר טיוטה עד לאישור הכלל.' : ''}</p>
                      </div>
                      ${
                        gapRef
                          ? gap?.interview?.isMine
                            ? `<button class="btn btn-small" type="button" data-interview-open="${esc(gap.interview.ref)}">ענה לשאלה</button>`
                            : gap?.interview
                              ? `<span class="pending-pill">${icon('clock')} ממתין ל${esc(gap.interview.personName)}</span>`
                              : `<button class="btn btn-small" type="button" data-gap-open="${esc(gapRef)}">שלח שאלה</button>`
                          : ''
                      }
                    </div>`
                  : ''
              }
            `
            : `<div class="single-answer"><b>${num(counts.value)}</b><span>תוצאה</span></div>`
      }
      ${
        answer.suppression?.applied
          ? `<p class="inline-warn">${icon('lock')} המדד מתחת לגודל התא המינימלי (${num(answer.suppression.minCellSize)}) ולכן הוא מוסתר.</p>`
          : ''
      }
      <footer class="answer-foot">
        <span>${icon('shield')} נכון ל־${shortDate(answer.freshness)}${sourceLabels ? ` · מקורות: ${esc(sourceLabels)}` : ''}</span>
        ${answer.gapsCreated ? `<span>${icon('question')} הפער נרשם כמשימה</span>` : ''}
      </footer>
    </section>`;
}

function refusalCard(answer) {
  const assistant = answer.assistant;
  if (assistant?.kind === 'people') {
    return `
      <section class="answer-card">
        <header class="answer-head"><div><p class="eyebrow">מהמפה הארגונית</p><h2>${esc(assistant.headline)}</h2></div></header>
        <p class="answer-sub">${esc(assistant.hint)}</p>
        <div class="people-grid">
          ${(assistant.people ?? [])
            .map(
              (person) => `<article class="person-card"><span class="avatar avatar-1">${esc(initials(person.name))}</span><div><strong>${esc(person.name)}</strong><span>${esc(person.title)}</span><p>${esc(person.summaryHe ?? person.summary)}</p></div></article>`,
            )
            .join('') || '<p class="muted">לא נמצא אחראי מזוהה.</p>'}
        </div>
      </section>`;
  }
  if (assistant?.kind === 'case') {
    const c = assistant.case;
    const status = c.status === 'CLOSED' ? 'סגור' : c.status === 'OPEN' ? 'פתוח' : c.status;
    return `
      <section class="answer-card">
        <header class="answer-head"><div><p class="eyebrow">מהלוג התיק</p><h2>${esc(assistant.headline)}</h2></div><button class="btn btn-small btn-quiet" type="button" data-record="${esc(c.ref)}">לפתיחת הרשומה</button></header>
        <div class="case-status">
          <div class="case-status-head"><span class="status-pill ${c.status === 'OPEN' ? 'status-on' : ''}">${esc(status)}</span><strong>${esc(c.subjectName)}</strong><span>${esc(c.serviceLabel)}</span></div>
          <div class="case-fields">
            <div><span>נפתח</span><strong>${shortDate(c.openedAt)}</strong></div>
            <div><span>נסגר</span><strong>${c.closedAt ? shortDate(c.closedAt) : '—'}</strong></div>
            <div><span>שלב אחרון</span><strong>${esc(c.stageLabel)}</strong></div>
            <div><span>עודכן</span><strong>${c.lastEventAt ? shortDate(c.lastEventAt) : '—'}</strong></div>
          </div>
        </div>
        <p class="inline-note">${icon('info')} ${esc(assistant.hint)}</p>
      </section>`;
  }
  if (assistant?.kind === 'process') {
    return `
      <section class="answer-card">
        <header class="answer-head"><div><p class="eyebrow">מהלוג של התיקים</p><h2>${esc(assistant.headline)}</h2></div></header>
        <p class="answer-sub">${esc(assistant.detail)}</p>
        <div class="mini-steps">
          ${(assistant.steps ?? [])
            .map(
              (step) => `<div class="mini-step"><b>${num(step.days)}</b><span>ימים</span><strong>${esc(step.label)}</strong><span>${esc(step.role)}</span></div>`,
            )
            .join('')}
        </div>
        <p class="inline-note">${icon('info')} ${esc(assistant.hint)}</p>
      </section>`;
  }
  return `
    <section class="answer-card answer-refused">
      <header class="answer-head"><div><p class="eyebrow">אין תשובה מוצהרת</p><h2>${esc(answer.refused)}</h2></div></header>
      ${answer.interpretationHe ? `<p class="interpretation">${icon('key')} <span>${mixed(answer.interpretationHe)}</span></p>` : ''}
      <p>לא ניחשתי. אפשר לחפש את הביטוי בכל המערכות, או לשאול שאלה אחרת.</p>
      <div class="answer-actions"><button class="btn btn-quiet btn-small" type="button" data-open-palette>${icon('search')} חיפוש בכל המערכות</button></div>
    </section>`;
}

/* ----------------------------------------------------------------- approvals */

export function approvalsView({ approvals, filter = 'all', pick = '', showOrg = true }) {
  const counts = approvals.counts ?? {};
  const pending = approvals.pending ?? [];
  const groups = [
    { id: 'automation', label: 'אוטומציות', items: pending.filter((p) => p.kind === 'automation') },
    { id: 'suggestion', label: 'הצעות מחקר', items: pending.filter((p) => p.kind === 'suggestion') },
    { id: 'model', label: 'פערים ומודל', items: pending.filter((p) => ['gap', 'property', 'rule'].includes(p.kind)) },
  ].filter((group) => group.items.length);
  const filterMatches = (group) =>
    filter === 'all' ||
    (filter === 'automations' && group.id === 'automation') ||
    (filter === 'suggestions' && group.id === 'suggestion') ||
    (filter === 'model' && group.id === 'model');
  const visibleGroups = filter === 'all' ? groups : groups.filter(filterMatches);
  const visibleItems = visibleGroups.flatMap((group) => group.items);
  const selected = visibleItems.find((item) => item.id === pick) ?? visibleItems[0] ?? null;
  const days = (counts.automations ? pending.filter((p) => p.kind === 'automation') : []).reduce(
    (sum, item) => sum + Number(item.annualDaysSaved ?? 0),
    0,
  );
  const filters = [
    { id: 'all', label: 'הכל', count: counts.total ?? 0 },
    { id: 'automations', label: 'אוטומציות', count: counts.automations ?? 0 },
    { id: 'suggestions', label: 'הצעות מחקר', count: counts.suggestions ?? 0 },
    { id: 'model', label: 'פערים ומודל', count: (counts.gaps ?? 0) + (counts.properties ?? 0) + (counts.rules ?? 0) },
  ];

  return `
    <div class="view approvals-view">
      <header class="page-head">
        <div>
          <p class="eyebrow">מרכז ההכרעות</p>
          <h1>מה מחכה להחלטה שלך</h1>
          <p class="page-sub">כל פריט עם הסיבה שלו, הראיה שלו ופעולה אחת. שום דבר לא משתנה עד שמישהו מאשר.</p>
        </div>
        <div class="head-figure"><b>${num(counts.total)}</b><span>פריטים פתוחים</span></div>
      </header>

      <div class="decision-summary">
        ${approvalSummary(approvals, days)
          .map((entry) => `<div><b>${entry.value}</b><span>${esc(entry.label)}</span></div>`)
          .join('')}
      </div>

      ${
        pending.length
          ? `<div class="approval-layout">
              <aside class="approval-queue" aria-label="תור ההחלטות">
                <div class="seg" role="tablist" aria-label="סינון החלטות">
                  ${filters
                    .map(
                      (f) => `<button class="seg-btn ${filter === f.id ? 'is-active' : ''}" type="button" role="tab" aria-selected="${filter === f.id}" data-filter="${f.id}">${esc(f.label)}<span>${num(f.count)}</span></button>`,
                    )
                    .join('')}
                </div>
                <div class="queue-groups">
                  ${visibleGroups
                    .map(
                      (group) => `<div class="queue-group">
                        <h3>${esc(group.label)}<span>${num(group.items.length)}</span></h3>
                        ${group.items.map((item) => queueRow(item, selected?.id === item.id)).join('')}
                      </div>`,
                    )
                    .join('')}
                </div>
                ${
                  approvals.responsibilities?.count
                    ? showOrg
                      ? `<a class="queue-note" href="#/insights">${icon('users')} ${num(approvals.responsibilities.count)} אחריויות ממתינות לאישור האדם — לתמונת המחלקה</a>`
                      : `<p class="queue-note">${icon('users')} ${num(approvals.responsibilities.count)} אחריויות ממתינות לאישור האדם, לא למנהל.</p>`
                    : ''
                }
              </aside>
              <section class="approval-detail" aria-label="פרטי ההחלטה">
                ${approvalDetail(selected, approvals.viewerKind)}
              </section>
            </div>`
          : emptyBox('check', 'אין החלטות פתוחות', 'כל מה שהמערכת הציעה טופל. פריטים חדשים יופיעו כאן אחרי מחקר או שינוי בנתונים.')
      }
    </div>`;
}

function approvalSummary(approvals, days) {
  const counts = approvals.counts ?? {};
  const viewer = approvals.viewerKind ?? 'head';
  if (viewer === 'head') {
    return [
      { value: num(days), label: 'ימי המתנה של תיקים בשנה בהצעות האוטומציה' },
      { value: num(counts.automations ?? 0), label: counts.automations === 1 ? 'אוטומציה פתוחה' : 'אוטומציות פתוחות' },
      { value: num(counts.suggestions ?? 0), label: counts.suggestions === 1 ? 'אישור תהליך או טופס' : 'אישורי תהליך או טופס' },
    ];
  }
  if (viewer === 'steward') {
    return [
      { value: num(counts.properties ?? 0), label: counts.properties === 1 ? 'מאפיין מוצע' : 'מאפיינים מוצעים' },
      { value: num(counts.total ?? 0), label: counts.total === 1 ? 'פריט פתוח' : 'פריטים פתוחים' },
      { value: '0', label: 'עריכות בחבילות המשותפות' },
    ];
  }
  if (viewer === 'rule') {
    return [
      { value: num(counts.gaps ?? 0), label: counts.gaps === 1 ? 'פער פתוח' : 'פערים פתוחים' },
      { value: num(counts.suggestions ?? 0), label: counts.suggestions === 1 ? 'הצעת מחקר' : 'הצעות מחקר' },
      { value: num(counts.rules ?? 0), label: 'שינויי כלל פתוחים' },
    ];
  }
  if (viewer === 'clerk') {
    return [
      { value: num(counts.gaps ?? 0), label: counts.gaps === 1 ? 'פער שחוסם החלטה' : 'פערים שחוסמים החלטה' },
      { value: num(counts.suggestions ?? 0), label: counts.suggestions === 1 ? 'הצעת מחקר' : 'הצעות מחקר' },
      { value: num(counts.total ?? 0), label: counts.total === 1 ? 'פריט פתוח' : 'פריטים פתוחים' },
    ];
  }
  return [
    { value: num(counts.total ?? 0), label: counts.total === 1 ? 'פריט פתוח' : 'פריטים פתוחים' },
    { value: '0', label: 'אוטומציות פתוחות' },
    { value: '0', label: 'שינויי מודל פתוחים' },
  ];
}

function queueRow(item, selected) {
  const tone = toneFor(item.kind);
  return `
    <button class="queue-row ${selected ? 'is-active' : ''}" type="button" data-approval-pick="${esc(item.id)}" aria-pressed="${selected}">
      <span class="queue-kind tone-${tone}">${icon(kindIcon(item.kind))}</span>
      <span class="queue-main">
        <span class="queue-title">${mixed(item.titleHe)}</span>
        <span class="queue-meta">${esc(item.impactHe ?? '')}${item.metaHe ? ` · ${esc(item.metaHe)}` : ''}</span>
      </span>
      <span class="queue-arrow">${icon('arrowLeft')}</span>
    </button>`;
}

function waitDistribution(item) {
  const samples = (item.waitSamples ?? []).filter((value) => Number.isFinite(Number(value))).map(Number);
  if (samples.length < 3) return '';
  const max = Math.max(...samples, 1);
  const median = Number(item.waitMedian ?? 0);
  const p90 = Number(item.waitP90 ?? 0);
  const binCount = 6;
  const size = Math.max(1, Math.ceil(max / binCount));
  const bins = Array.from({ length: binCount }, (_, index) => ({ from: index * size, to: index * size + size - 1, count: 0 }));
  for (const value of samples) {
    const index = Math.min(binCount - 1, Math.floor(value / size));
    bins[index].count++;
  }
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  const medianBin = Math.min(binCount - 1, Math.floor(median / size));
  return `
    <div class="wait-histogram">
      <div class="hist-head"><h3>התפלגות ההמתנה</h3><span>${num(samples.length)} דגימות · חציון ${num(median)} יום · p90 ${num(p90)}</span></div>
      <div class="hist-bars">
        ${bins
          .map(
            (bin, index) => `<div class="hist-col ${index === medianBin ? 'is-median' : ''}" title="${bin.from}–${bin.to} ימים: ${bin.count} תיקים"><i style="height:${Math.max(3, Math.round((bin.count / maxCount) * 100))}%"></i><span>${bin.from}–${bin.to}</span></div>`,
          )
          .join('')}
      </div>
      <p class="hist-caption">העמודה המודגשת מכילה את החציון. כל עמודה היא מספר תיקים בטווח הימים; הזנב הארוך הוא מה שההצעה מנסה לקצר.</p>
    </div>`;
}

function approvalDetail(item, viewerKind = 'head') {
  if (!item) {
    return emptyBox('check', 'התור ריק', 'אין פריטים בסינון הזה. אפשר לבחור סינון אחר.');
  }
  const tone = toneFor(item.kind);
  const approveLabel = item.kind === 'property' ? 'הוספה למודל' : item.kind === 'automation' ? 'אישור האוטומציה' : 'אישור';
  const canApprove = item.kind === 'automation' || item.kind === 'suggestion' || item.kind === 'property';
  return `
    <div class="detail-top">
      <span class="kind-badge tone-${tone}">${icon(kindIcon(item.kind))} ${esc(kindLabel(item.kind))}</span>
      ${item.kind === 'rule' ? `<span class="pending-pill">${icon('clock')} ממתין לבעל הכלל</span>` : ''}
    </div>
    <h2>${mixed(item.titleHe)}</h2>
    <p class="detail-why">${mixed(item.whyHe)}</p>
    ${
      item.whatIf
        ? `<div class="what-if detail-what-if">
            <span class="what-if-label">מה יקרה אם בעל הכלל יאשר</span>
            <div class="what-if-counts">
              <span class="what-if-good"><b>${num(item.whatIf.eligible)}</b>זכאים</span>
              <span><b>${num(item.whatIf.not_eligible)}</b>לא זכאים</span>
              <span><b>${num(item.whatIf.unknown)}</b>לא ידוע</span>
            </div>
          </div>`
        : ''
    }
    <div class="detail-metrics">
      <div><span>השפעה</span><strong>${esc(item.impactHe ?? '—')}</strong></div>
      <div><span>הקשר</span><strong>${esc(item.metaHe ?? '')}</strong></div>
      ${item.field ? `<div><span>מאפיין</span><strong>${ltr(item.field)}</strong></div>` : ''}
    </div>
    ${
      item.formulaHe
        ? `<div class="formula-box"><h3>איך חושב המספר</h3><p>${mixed(item.basisHe ?? '')}</p><p>${mixed(item.formulaHe)}</p><p class="formula-assumption">${mixed(item.assumptionHe ?? '')}</p></div>`
        : ''
    }
    ${item.riskReasonHe ? `<p class="risk-reason">${icon('info')} ${mixed(item.riskReasonHe)}</p>` : ''}
    ${item.whatHappensHe ? `<div class="execution-note">${icon('alert')} ${mixed(item.whatHappensHe)}</div>` : ''}
    ${item.waitSamples?.length >= 3 ? waitDistribution(item) : ''}
    ${
      item.evidenceHe?.length
        ? `<h3 class="detail-subtitle">הראיות</h3><div class="evidence-row detail-evidence">${item.evidenceHe.map((e) => `<span class="evidence-chip">${mixed(e)}</span>`).join('')}</div>`
        : ''
    }
    <div class="detail-source">${icon('shield')} ${item.kind === 'gap' ? 'פער נסגר על ידי אדם, לא באישור גורפ' : item.kind === 'rule' ? 'ההחלטה נשארת אצל בעל הכלל' : 'ההחלטה תירשם על שמך, עם הזמן והמקור'}</div>
    <footer class="detail-foot">
      ${
        item.kind === 'gap'
          ? item.interview?.isMine
            ? `<button class="btn" type="button" data-interview-open="${esc(item.interview.ref)}">${icon('question')} ענה לשאלה</button>`
            : item.interview
              ? `<span class="pending-pill">${icon('clock')} ממתין לתשובה מ${esc(item.interview.personName)}</span>`
              : viewerKind === 'rule'
                ? `<span class="pending-pill">${icon('clock')} ממתין לשאלה ממיכל</span>`
                : `<button class="btn" type="button" data-gap-open="${esc(item.ref)}">${icon('question')} שלח שאלה</button>`
          : item.kind === 'rule'
            ? `<span class="pending-pill">${icon('clock')} ממתין לבעל הכלל</span>`
            : canApprove
              ? `<button class="btn" type="button" data-approve="${item.kind}" data-id="${esc(item.id)}">${esc(approveLabel)}</button>`
              : ''
      }
      <span class="detail-hint">${item.kind === 'gap' ? (item.interview ? 'התשובה תירשם על שם האדם שאליו נשלחה.' : 'שלוש שאלות, עם הניחוש שלנו מוכן.') : 'אפשר לחזור לפריט הזה מהתור בכל רגע.'}</span>
    </footer>`;
}

/* ------------------------------------------------------------------- sources */

export function sourcesView({ connectors, showInsights = true, kind = 'head' }) {
  const sources = connectors?.sources ?? [];
  const forms = connectors?.forms ?? [];
  const connected = sources.filter((s) => s.enabled).length;
  const allSuggestions = sources.flatMap((source) => source.suggestions ?? []);
  const suggestions = allSuggestions.length;
  const mine = allSuggestions.filter((s) => s.status === 'new' && (s.audience ?? []).includes(kind)).length;
  return `
    <div class="view sources-view">
      <header class="page-head">
        <div>
          <p class="eyebrow">מקורות המידע</p>
          <h1>מאיפה המערכת יודעת</h1>
          <p class="page-sub">כל מקור שמחובר מפעיל מחקר משלו. המחקר מציע — אדם מאשר. שום דבר לא נכתב חזרה למערכת המקור.</p>
        </div>
        <div class="head-figure"><b>${num(connected)}/${num(sources.length)}</b><span>מקורות מחוברים</span></div>
      </header>

      <div class="source-summary">
        <span>${icon('shield')} קריאה בלבד · הרשאות המקור נשמרות</span>
        <span>${icon('spark')} ${Number(suggestions) === 1 ? 'הצעת מחקר אחת' : `${num(suggestions)} הצעות מחקר`} · ${num(mine)} בטיפולך</span>
        ${showInsights ? `<a class="text-link" href="#/insights">מה זה מאפשר ${icon('arrowLeft')}</a>` : ''}
      </div>

      <div class="source-grid">
        ${sources.map((source) => sourceCard(source, kind)).join('')}
      </div>

      ${
        forms.length
          ? `<section class="approval-section">
              <div class="section-head"><div><h2>טפסים שנולדו מהמודל</h2><p>כל טופס נגזר מטיפוס באונטולוגיה. אין כאן קוד טופס.</p></div><span class="section-count">${num(forms.length)}</span></div>
              <div class="form-grid">${forms
                .map(
                  (form) => `<article class="form-card"><span class="form-icon">${icon('doc')}</span><div><h3>${esc(form.name)}</h3><p>${num(form.field_count)} שדות · ${form.kind === 'application' ? 'טופס בקשה' : 'טופס פנימי'}</p><span>${ltr(form.page_type)}</span></div><button class="btn btn-quiet btn-small" type="button" data-form-open="${esc(form.ref)}" data-form-type="${esc(form.page_type)}" data-form-kind="${esc(form.kind)}" data-form-only="${esc((form.fields ?? []).join(','))}">פתיחה</button></article>`,
                )
                .join('')}</div>
            </section>`
          : ''
      }

      <p class="data-note">${icon('info')} חיבור מקור חדש אינו מחליף את המערכת שלו. הוא רק פותח קריאה מסוננת לפי הרשאות, ומפעיל מחקר שמציע מה אפשר ללמוד ממנו.</p>
    </div>`;
}

function sourceCard(source, kind = 'head') {
  const on = Boolean(source.enabled);
  const tone = { entra: 'blue', sql: 'violet', exchange: 'green', sharepoint: 'amber' }[source.id] ?? 'teal';
  const sourceIcon = { entra: 'key', sql: 'database', exchange: 'mail', sharepoint: 'doc' }[source.id] ?? 'database';
  const suggestions = source.suggestions ?? [];
  const pending = suggestions.filter((s) => s.status === 'new');
  return `
    <article class="source-card ${on ? 'is-on' : ''}">
      <header class="source-head">
        <span class="source-icon tone-${tone}">${icon(sourceIcon)}</span>
        <div class="source-title"><h2>${esc(source.nameHe)}</h2><span>${ltr(source.nameEn)}</span></div>
        <button class="switch ${on ? 'is-on' : ''}" type="button" role="switch" aria-checked="${on}" aria-label="${on ? 'כיבוי' : 'חיבור'} ${esc(source.nameHe)}" data-source-toggle="${esc(source.id)}"><span></span></button>
      </header>
      <p class="source-desc">${esc(source.descriptionHe)}</p>
      <div class="source-facts">
        <span>${icon('database')} ${on ? esc(source.evidenceHe) : `במקור, טרם נקרא: ${esc(source.evidenceHe)}`}</span>
        <span class="status-pill ${on ? 'status-on' : 'status-off'}">${on ? 'מחובר · נקרא' : 'לא מחובר · לא נקרא'}</span>
      </div>
      ${
        on
          ? `<div class="research">
              <div class="research-head"><span>${icon('spark')} מחקר</span><b>${pending.length === 1 ? 'הצעה אחת' : `${num(pending.length)} הצעות`}</b></div>
              ${
                suggestions.length
                  ? suggestions.map(suggestionCard).join('')
                  : `<p class="rail-note">המחקר עדיין לא מצא הצעות חדשות מהמקור הזה.</p>`
              }
            </div>`
          : `<div class="source-unlock"><span class="unlock-label">מה זה יאפשר</span><strong>${esc(source.unlocksHe)}</strong><button class="btn btn-small" type="button" data-source-toggle="${esc(source.id)}">חיבור המקור</button></div>`
      }
    </article>`;
}

const AUDIENCE_HE = {
  head: 'מנהלת המחלקה',
  clerk: 'רכזת הרישוי',
  rule: 'בעל הכלל',
  steward: 'אחראית הנתונים',
  secretary: 'מזכירת המחלקה',
};

function suggestionCard(suggestion, kind = 'head') {
  const approved = suggestion.status === 'approved' || Boolean(suggestion.covered);
  const audience = suggestion.audience ?? [];
  const mine = audience.includes(kind);
  const owner = audience.map((role) => AUDIENCE_HE[role] ?? role).filter(Boolean).join(' או ');
  const isPersonal = suggestion.kind === 'responsibility';
  return `
    <div class="suggestion ${approved ? 'is-approved' : ''}">
      <div class="suggestion-top">
        <strong>${mixed(suggestion.titleHe)}</strong>
        ${
          approved
            ? `<span class="status-pill status-on">${icon('check')} אושר</span>`
            : isPersonal
              ? '<span class="pending-pill">אישור אישי</span>'
              : mine
                ? '<a class="btn btn-quiet btn-small" href="#/approvals">להחלטה</a>'
                : `<span class="pending-pill">בטיפול אצל ${esc(owner || 'המחלקה')}</span>`
        }
      </div>
      <p>${mixed(suggestion.whyHe)}</p>
      <div class="evidence-row">${(suggestion.evidenceHe ?? []).map((e) => `<span class="evidence-chip">${esc(e)}</span>`).join('')}</div>
      ${isPersonal && !approved ? `<p class="inline-note">${icon('users')} האחריויות מוצגות לאדם שהן מתארות בבית שלו, לא לאישור גורפ.</p>` : ''}
      ${approved && suggestion.artifact ? `<p class="artifact-line">${icon('check')} נוצר: ${esc(suggestion.artifact.labelHe)}</p>` : ''}
      ${suggestion.covered && !suggestion.artifact ? `<p class="artifact-line">${icon('check')} התהליך אושר בתמונת המחלקה</p>` : ''}
    </div>`;
}

export function sourceConsentBody(source) {
  const consent = source.consent ?? {};
  return `
    <p class="sheet-lead">${esc(source.descriptionHe)} חיבור הוא <strong>קריאה בלבד</strong>; המידע נשאר במערכת המקור.</p>
    <div class="consent-block"><h3>${icon('eye')} מה ייקרא</h3><p>${esc(consent.scopeHe ?? source.unlocksHe)}</p></div>
    <div class="consent-block"><h3>${icon('shield')} מי אישר</h3><ul>${(consent.approversHe ?? []).map((name) => `<li>${esc(name)}</li>`).join('')}</ul><p>${esc(consent.dpiaHe ?? '')}</p></div>
    <div class="consent-block"><h3>${icon('users')} הזכות לאי-השתתפות</h3><p>${esc(consent.optOutHe ?? '')}</p></div>
    <div class="sheet-note">${icon('info')} ב-POC האישורים מוצגים כתנאי לחיבור, אך לא נשמרת חתימה משפטית. חיבור בסביבה אמיתית מותנה באישור ובבדיקת פרטיות.</div>
    <div class="sheet-actions"><button class="btn" type="button" data-source-consent="${esc(source.id)}">אשרו והפעילו</button><button class="btn btn-quiet" type="button" data-close-sheet>לא עכשיו</button></div>`;
}

/* ------------------------------------------------------------------ insights */

export function insightsView({ overview, org, process, service, proposals, canApprove = true }) {
  const services = overview?.services ?? [];
  const current = services.find((s) => s.code === service) ?? services[0];
  const model = process?.model;
  const steps = model?.steps ?? [];
  const variants = model?.variants ?? [];
  const bottleneck = model?.bottleneck;
  const totalWait = steps.reduce((sum, s) => sum + Number(s.medianWaitDays ?? 0), 0);
  const maxWaits = Math.max(1, ...steps.map((s) => Number(s.medianWaitDays ?? 0)));
  const units = org?.units ?? [];
  const people = org?.people ?? [];
  const responsibilities = (org?.responsibilities ?? [])
    .filter((r) => r.signal === 'case-events')
    .sort((a, b) => b.support - a.support)
    .slice(0, 6);
  const pendingProposals = (proposals ?? []).filter((p) => p.status !== 'approved');
  const nameOf = (ref) => people.find((p) => p.ref === ref)?.name ?? '';

  return `
    <div class="view insights-view">
      <header class="page-head">
        <div>
          <p class="eyebrow">תמונת המחלקה</p>
          <h1>איך באמת עובדת המחלקה</h1>
          <p class="page-sub">התהליך זוהה מלוג התיקים, לא נכתב ביד. הזמן נמדד בין אירוע לאירוע — לא הוערך.</p>
        </div>
        <div class="head-status">${icon('flow')} ${num(model?.caseCount)} תיקים · ${num(model?.windowDays)} ימי תצפית</div>
      </header>

      <div class="service-tabs" role="tablist" aria-label="שירות">
        ${services.map((s) => `<button class="service-tab ${s.code === current?.code ? 'is-active' : ''}" type="button" role="tab" aria-selected="${s.code === current?.code}" data-service="${esc(s.code)}">${esc(s.nameHe)}<span>${num(s.cases)} תיקים</span></button>`).join('')}
      </div>

      <div class="kpi-strip">
        <div class="kpi"><b>${num(model?.medianTotalDays)}</b><span>יום חציון לתיק</span><small>p90 · ${num(model?.p90TotalDays)} יום</small></div>
        <div class="kpi"><b>${num(variants.length)}</b><span>מסלולים שונים</span><small>בתצפית הזו כל תיק שייך לאחד מהם</small></div>
        <div class="kpi kpi-warn"><b>${num(bottleneck?.medianWaitDays)}</b><span>ימים בצוואר הבקוק</span><small>${esc(bottleneck?.labels ?? '')} · ${pct(Number(bottleneck?.medianWaitDays ?? 0) / Math.max(1, Number(model?.medianTotalDays ?? 1)))} מהזמן</small></div>
        <div class="kpi"><b>${num(pendingProposals.length)}</b><span>אוטומציות מוצעות</span><small>מבוססות על השלבים שנמדדו</small></div>
      </div>

      <section class="panel flow-panel">
        <div class="section-head">
          <div><p class="eyebrow">המסלול הנפוץ</p><h2>${esc(current?.nameHe ?? '')}: ${num(variants[0]?.caseCount)} תיקים, ${num(variants[0]?.medianDays)} ימים</h2></div>
          <div class="flow-status">
            ${model?.status === 'validated' ? `<span class="status-pill status-on">${icon('check')} תהליך מאושר</span>` : `<span class="status-pill">${icon('clock')} תהליך שנמדד · ממתין לאישור</span>`}
            ${model?.status !== 'validated' && canApprove ? `<button class="btn btn-small" type="button" data-validate-process="${esc(model?.serviceCode ?? service)}">אשר שהתהליך הזה נכון</button>` : ''}
            <span class="section-count">${icon('clock')} המתנה חציונית</span>
          </div>
        </div>
        ${flowTrack(variants[0]?.sequence ?? [], steps, bottleneck, pendingProposals)}
        <p class="flow-hint">${icon('arrowLeft')} גללו לרוחב כדי לראות את כל ${num((variants[0]?.sequence ?? []).length)} השלבים</p>
        <div class="flow-legend">
          <span><i class="lg lg-measured"></i> נמדד מהלוג</span>
          <span><i class="lg lg-bottleneck"></i> צוואר בקוק</span>
          <span><i class="lg lg-proposed"></i> מוצע לאישור</span>
          <span><i class="lg lg-gate"></i> שער אישור אדם</span>
        </div>
      </section>

      <div class="insight-grid">
        <section class="panel">
          <div class="section-head"><div><h2>המסלולים</h2><p>שלושת המסלולים מכסים את כל התיקים</p></div></div>
          <div class="variant-list">
            ${variants
              .map((variant, index) => {
                const labelOf = (activity) => steps.find((step) => step.activity === activity)?.labels ?? activity;
                const main = variants[0]?.sequence ?? [];
                const added = variant.sequence.filter((activity) => !main.includes(activity));
                const missing = main.filter((activity) => !variant.sequence.includes(activity));
                const difference =
                  index === 0
                    ? 'המסלול הראשי'
                    : [...added.map((activity) => `+ ${labelOf(activity)}`), ...missing.map((activity) => `− ${labelOf(activity)}`)].join(' · ') || 'אותו מסלול, בסדר אחר';
                return `
              <div class="variant-row">
                <span class="variant-rank">${index + 1}</span>
                <div class="variant-body">
                  <div class="variant-top"><strong title="${esc(variant.sequence.map(labelOf).join(' ← '))}">${esc(difference)}</strong><span>${num(variant.caseCount)} תיקים · ${num(variant.medianDays)} ימים</span></div>
                  <div class="bar"><i style="width:${Math.round(Number(variant.coverageShare ?? 0) * 100)}%"></i></div>
                  <span class="variant-share">${pct(variant.coverageShare)}</span>
                </div>
              </div>`;
              })
              .join('')}
          </div>
        </section>
        <section class="panel">
          <div class="section-head"><div><h2>איפה מחכים</h2><p>חציון ההמתנה אחרי כל שלב</p></div></div>
          <div class="wait-list">
            ${steps
              .slice(0, 6)
              .map(
                (step) => `<div class="wait-row"><div class="wait-top"><strong>${esc(step.labels)}</strong><span>${num(step.medianWaitDays)} ימים</span></div><div class="bar bar-soft"><i style="width:${Math.round((Number(step.medianWaitDays) / maxWaits) * 100)}%"></i></div><span class="wait-role">${esc(step.dependsOnHe || step.role || '')} · ${num(step.occurrences)} מקרים</span></div>`,
              )
              .join('')}
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="section-head"><div><p class="eyebrow">המשך הטיפול</p><h2>${canApprove ? 'אוטומציות שממתינות לאישור' : 'אוטומציות מוצעות'}</h2><p>כל אחת נובעת מהמתנה מדודה, ומציגה את ההשפעה השנתית שלה.</p></div>${canApprove ? `<a class="text-link" href="#/approvals">לכל ההחלטות ${icon('arrowLeft')}</a>` : ''}</div>
        <div class="proposal-grid">
          ${pendingProposals
            .map(
              (p) => `
            <article class="proposal-card">
              <div class="proposal-top"><span class="kind-badge tone-green">${icon('flow')} אוטומציה</span><span class="risk risk-${esc(p.risk)}">סיכון ${esc(riskHe(p.risk))}</span></div>
              <h3>${mixed(p.titleHe)}</h3>
              <p>${mixed(p.rationaleHe)}</p>
              <div class="proposal-impact"><b>${num(p.annualDaysSaved)}</b><span>ימי המתנה של תיקים בשנה</span><em>${num(p.expectedCasesPerYear)} מקרים</em></div>
              <div class="evidence-row">${(p.evidenceHe ?? []).map((e) => `<span class="evidence-chip">${esc(e)}</span>`).join('')}</div>
              ${p.formulaHe ? `<details class="proposal-formula"><summary>איך חושב המספר</summary><p>${mixed(p.basisHe ?? '')}</p><p>${mixed(p.formulaHe)}</p><p class="formula-assumption">${mixed(p.assumptionHe ?? '')}</p><p>${mixed(p.riskReasonHe ?? '')}</p></details>` : ''}
              ${canApprove ? `<button class="btn btn-small" type="button" data-approve="automation" data-id="${esc(p.ref)}">אישור והפעלה</button>` : '<span class="pending-pill">ממתין לבעל התהליך</span>'}
            </article>`,
            )
            .join('') || '<p class="muted">אין הצעות אוטומציה לשירות הזה.</p>'}
        </div>
      </section>

      <section class="panel">
        <div class="section-head"><div><p class="eyebrow">הארגון</p><h2>מי מחזיק את העבודה</h2><p>${num(units.length)} יחידות · ${num(people.length)} עובדים · ${num(org?.responsibilities?.length)} אחריויות שזוהו מהעבודה</p></div></div>
        <div class="unit-grid">
          ${units
            .map(
              (unit) => `<article class="unit-card"><div class="unit-top"><h3>${esc(unit.name)}</h3><span>${num(unit.headcount)} עובדים</span></div><p>ראש היחידה: ${esc(nameOf(unit.headRef) || '—')}</p><div class="chip-row">${unit.roles.map((role) => `<span class="chip chip-small">${esc(role.title)}</span>`).join('')}</div></article>`,
            )
            .join('')}
        </div>
        <div class="resp-list">
          <h3 class="sheet-subtitle">מה כל אחד עושה בפועל</h3>
          ${responsibilities
            .map(
              (r) => `<div class="resp-row"><span class="avatar avatar-2">${esc(initials(nameOf(r.personRef)))}</span><div><strong>${esc(nameOf(r.personRef))}</strong><p>${mixed(r.summaryHe ?? r.summary)}</p></div><span class="resp-support">${num(r.support)} אירועים</span></div>`,
            )
            .join('')}
        </div>
      </section>

      <div class="model-strip">
        <span>${icon('layers')} המודל</span>
        <span><b>${num(overview?.graph?.pages)}</b> רשומות</span>
        <span><b>${num(overview?.graph?.facts)}</b> עובדות</span>
        <span><b>${num(overview?.graph?.evidence)}</b> ראיות</span>
        <span><b>${num(overview?.ontology?.pageTypes?.length)}</b> טיפוסים</span>
        <span class="model-note">כל עובדה נושאת מקור, מיקום וסטטוס</span>
      </div>
    </div>`;
}

function flowTrack(sequence, steps, bottleneck, proposals) {
  if (!sequence.length) return `<p class="muted">לא נמצא מסלול לתצוגה.</p>`;
  const proposedSteps = new Set((proposals ?? []).map((p) => p.step).filter(Boolean));
  const items = sequence.map((activity, index) => {
    const step = steps.find((s) => s.activity === activity) ?? {
      activity,
      labels: activity,
      medianWaitDays: 0,
      occurrences: 0,
      role: '',
    };
    const isBottleneck = bottleneck?.activity === activity;
    const isGate = /APPROVED|LICENCE_ISSUED|DISCOUNT_APPROVED/.test(activity);
    return `
      <div class="flow-step ${isBottleneck ? 'is-bottleneck' : ''} ${isGate ? 'is-gate' : ''}">
        ${index === 0 ? '<span class="flow-start">התחלה</span>' : ''}
        <span class="flow-index">${num(step.occurrences)}</span>
        <strong>${esc(step.labels)}</strong>
        <span class="flow-wait ${step.medianWaitDays > 0 ? '' : 'is-zero'}">${step.medianWaitDays > 0 ? `המתנה ${num(step.medianWaitDays)} ימים` : 'ללא המתנה'}</span>
        ${isBottleneck ? `<span class="flow-flag">${icon('alert')} צוואר בקוק</span>` : ''}
        ${proposedSteps.has(activity) ? `<span class="flow-flag flag-proposed">${icon('spark')} מוצע כאן</span>` : ''}
      </div>
      ${index < sequence.length - 1 ? `<span class="flow-link" aria-hidden="true">${icon('arrowLeft')}</span>` : ''}`;
  });
  return `<div class="flow-scroll"><div class="flow-track">${items.join('')}</div></div>`;
}

/* ----------------------------------------------------------------- workspace */

export function workspaceView({ outlook, doclib, ws, kind }) {
  const tab = ws?.tab === 'docs' ? 'docs' : 'mail';
  const mailOn = outlook?.connected !== false;
  const docsOn = doclib?.connected !== false;
  return `
    <div class="view workspace-view">
      <header class="page-head">
        <div>
          <p class="eyebrow">הצגת המקור</p>
          <h1>המקור שמאחורי הנתונים</h1>
          <p class="page-sub">לא מחליפים את Outlook או SharePoint — מציגים את המקור כדי לאמת מה נלמד, לפי ההרשאה שלך.</p>
        </div>
        <div class="head-status">${icon('lock')} תצוגת מקור · לקריאה בלבד</div>
      </header>

      <div class="workspace-tabs" role="tablist" aria-label="מערכת">
        <button class="service-tab ${tab === 'mail' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${tab === 'mail'}" data-ws-tab="mail">${icon('mail')} דואר נכנס <span>${mailOn ? num(outlook?.messages?.length ?? 0) : 'כבוי'}</span></button>
        <button class="service-tab ${tab === 'docs' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${tab === 'docs'}" data-ws-tab="docs">${icon('doc')} ספריית מסמכים <span>${docsOn ? num(doclib?.visible ?? 0) : 'כבוי'}</span></button>
        <span class="workspace-viewer">${icon('eye')} ${esc(outlook?.viewer ?? doclib?.viewer ?? '')}</span>
      </div>

      ${tab === 'mail' ? (mailOn ? mailPane(outlook, ws?.msg ?? 0) : sourceGate('exchange')) : docsOn ? docPane(doclib, ws?.doc ?? 0) : sourceGate('sharepoint')}
    </div>`;
}

function sourceGate(source) {
  const exchange = source === 'exchange';
  return `
    <section class="source-gate">
      <span class="gate-icon">${icon(exchange ? 'mail' : 'doc')}</span>
      <h2>${exchange ? 'דואר העבודה' : 'מסמכי המחלקה'} לא מחובר</h2>
      <p>המערכת לא קוראת מהמקור הזה עד שהוא מחובר, ולכן אין כאן ${exchange ? 'הודעות' : 'מסמכים'} להצגה. זה לא אומר שאין — זה אומר שלא הורשה לקרוא.</p>
      <a class="btn" href="#/sources">${icon('database')} חיבור המקור</a>
      <p class="rail-note">${icon('shield')} קריאה בלבד · הרשאות המקור נשמרות</p>
    </section>`;
}

function m365Bar(product, meta) {
  return `
    <div class="m365-bar">
      <span class="m365-product">${microsoftMark()}<strong>${esc(product)}</strong></span>
      <span class="m365-meta">${esc(meta)}</span>
      <span class="m365-readonly">${icon('lock')} קריאה בלבד</span>
    </div>`;
}

function mailPane(outlook, index) {
  const messages = outlook?.messages ?? [];
  const current = messages[index] ?? messages[0];
  return `
    <section class="m365-frame">
      ${m365Bar('Outlook', outlook?.mailbox ?? '')}
      <div class="mail-grid">
        <nav class="mail-rail" aria-label="תיקיות">
          <span class="rail-item is-active">${icon('mail')} דואר נכנס <b>${num(messages.length)}</b></span>
          <span class="rail-item">${icon('doc')} טיוטות</span>
          <span class="rail-item">${icon('arrowLeft')} נשלח</span>
          <span class="rail-item">${icon('clock')} ארכיון</span>
          <p class="rail-note">${icon('shield')} תוויות הרגישות מגיעות מהמקור</p>
        </nav>
        <div class="mail-list" role="listbox" aria-label="הודעות">
          ${messages
            .map(
              (message, i) => `
            <button class="mail-item ${i === index ? 'is-active' : ''}" type="button" role="option" aria-selected="${i === index}" data-msg="${i}">
              <span class="mail-from">${esc(message.from)}</span>
              <span class="mail-subject">${esc(message.subject)}</span>
              <span class="mail-snippet">${esc(String(message.body ?? '').replace(/\s+/g, ' ').slice(0, 70))}</span>
              <span class="mail-meta">${timeOf(message.received)} · ${esc(message.label)}${sensitivityHe(message.label) ? ` · ${esc(sensitivityHe(message.label))}` : ''}</span>
            </button>`,
            )
            .join('')}
        </div>
        <div class="mail-read">
          ${
            current
              ? `
            <header class="mail-read-head">
              <div class="mail-reader"><span class="avatar avatar-3">${esc(initials(current.from))}</span><div><strong>${esc(current.from)}</strong><span>${ltr(current.fromAddress)}</span></div></div>
              <span class="mail-time">${shortDate(current.received)} · ${timeOf(current.received)}</span>
            </header>
            <h2>${esc(current.subject)}</h2>
            <div class="mail-labels">${badge(current.label, current.label === 'Restricted' || current.label === 'Highly Confidential' ? 'red' : 'neutral')}${sensitivityHe(current.label) ? `<span class="label-gloss">${esc(sensitivityHe(current.label))}</span>` : ''}<span>נשלח אל ${esc((current.to ?? []).join(', '))}</span></div>
            <div class="mail-body">${esc(current.body)}</div>
            <footer class="mail-foot">
              <span>${icon('shield')} ${esc(current.label)}${sensitivityHe(current.label) ? ` · ${esc(sensitivityHe(current.label))}` : ''} · ההרשאה נבדקה לפני הקריאה</span>
              ${current.graphRef ? `<button class="btn btn-small" type="button" data-page="${esc(current.graphRef)}">${icon('spark')} מה למדנו מההודעה</button>` : ''}
            </footer>`
              : '<p class="muted">אין הודעות להצגה.</p>'
          }
        </div>
      </div>
    </section>`;
}

function docPane(doclib, index) {
  const documents = doclib?.documents ?? [];
  const current = documents[index] ?? documents[0];
  const hidden = Number(doclib?.total ?? 0) - Number(doclib?.visible ?? documents.length);
  return `
    <section class="m365-frame">
      ${m365Bar('SharePoint', doclib?.library ?? '')}
      <div class="doc-grid">
        <div class="doc-table-wrap">
          <table class="doc-table">
            <thead><tr><th>שם</th><th>שונה</th><th>רגישות</th><th>גודל</th></tr></thead>
            <tbody>
              ${documents
                .map(
                  (doc, i) => `
                <tr class="${i === index ? 'is-active' : ''}" data-doc="${i}" tabindex="0">
                  <td class="doc-name"><span class="doc-icon">${icon(/xlsx|XLSX/.test(doc.name) ? 'chart' : 'doc')}</span>${esc(doc.name)}</td>
                  <td>${shortDate(doc.modified)}</td>
                  <td>${doc.label === 'Restricted' ? badge('מוגבל', 'red') : `${esc(doc.label)}${sensitivityHe(doc.label) ? ` · ${esc(sensitivityHe(doc.label))}` : ''}`}</td>
                  <td>${fileSize(doc.size)}</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>
          ${
            hidden > 0
              ? `<p class="hidden-docs">${icon('lock')} ${num(hidden)} מסמכים מוסתרים מההרשאה שלך. הם לא מוצגים ולא ניתנים לחיפוש.</p>`
              : ''
          }
        </div>
        <aside class="doc-preview">
          ${
            current
              ? `
            <p class="eyebrow">תצוגה מקדימה</p>
            <h3>${esc(current.name)}</h3>
            <div class="doc-meta">${badge(current.label, 'neutral')}<span>${num(current.pages)} עמודים</span><span>${shortDate(current.modified)}</span></div>
            <pre class="doc-text">${esc(current.text)}</pre>
            ${current.graphRef ? `<button class="btn btn-small" type="button" data-page="${esc(current.graphRef)}">${icon('spark')} מה למדנו מהמסמך</button>` : ''}`
              : '<p class="muted">אין מסמכים להצגה.</p>'
          }
        </aside>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------- sheets */

export function formBody(form, subjects, { type, kind }) {
  const subject = subjects[0];
  const valueOf = (name) => {
    const value = subject?.properties?.[name];
    return value === undefined || value === null ? '' : String(value);
  };
  return `
    <p class="sheet-lead">${esc(form.titleHe || form.titleEn || 'טופס מהמודל')} · ${form.kind === 'application' ? 'טופס בקשה' : 'טופס פנימי'} · ${ltr(form.page_type)}</p>
    <p class="form-source">${icon('layers')} השדות, הסוגים והחוקים נגזרים מהטיפוס <strong>${ltr(form.page_type)}</strong> באונטולוגיה. אין כאן קוד טופס.</p>
    <form id="form-submit" data-type="${esc(type)}" data-kind="${esc(kind)}">
      <label class="field field-subject">
        <span>על איזו רשומה למלא?</span>
        <select name="__subject" class="select" data-form-subject>
          ${subjects.map((s) => `<option value="${esc(s.ref)}">${esc(s.title)}${s.properties?.household_size ? ` · ${num(s.properties.household_size)} נפשות` : ''}</option>`).join('')}
        </select>
      </label>
      <div class="form-fields">
        ${form.fields
          .map((field) => {
            const value = valueOf(field.name);
            const common = `data-field="${esc(field.name)}" ${field.readOnly ? 'readonly' : ''}`;
            const control =
              field.widget === 'select'
                ? `<select class="select" ${common}>${field.options
                    .map((option) => `<option ${String(option) === value ? 'selected' : ''}>${esc(option)}</option>`)
                    .join('')}</select>`
                : field.widget === 'date'
                  ? `<input class="input" type="date" ${common} value="${esc(value)}" />`
                  : field.widget === 'checkbox'
                    ? `<input class="checkbox" type="checkbox" ${common} ${value === 'true' ? 'checked' : ''} />`
                    : `<input class="input" type="${field.widget === 'number' ? 'number' : 'text'}" ${common} value="${esc(value)}" placeholder="${esc(field.description || field.labelEn)}" />`;
            return `<label class="field ${field.readOnly ? 'is-readonly' : ''}"><span>${esc(field.labelHe)}${field.required ? ' <em>*</em>' : ''}${field.readOnly ? ` <small>מהמודל</small>` : ''}</span>${control}${field.description ? `<small class="field-help">${esc(field.description)}</small>` : ''}</label>`;
          })
          .join('')}
      </div>
      <div class="form-actions">
        <button class="btn" type="submit">שמירה על הרשומה</button>
        <button class="btn btn-quiet" type="button" data-close-sheet>ביטול</button>
        <span class="interview-note">${icon('shield')} כל שדה נשמר עם מי מילא ומתי.</span>
      </div>
      <div id="form-problems" role="status"></div>
    </form>`;
}

export function formResultBody(result, subjectTitle) {
  return `
    <div class="result-hero"><span class="result-icon">${icon('check')}</span><div><h3>הערכים נשמרו על הרשומה</h3><p>${num(result.written)} ערכים על ${esc(subjectTitle)}. כל ערך נשמר עם מקור, מי מילא ומתי.</p></div></div>
    <div class="fact-list-wrap">
      <h3 class="sheet-subtitle">מה נכתב</h3>
      <ul class="fact-list">${Object.entries(result.properties ?? {}).map(([property, value]) => `<li><span class="fact-name">${ltr(property)}</span><span class="fact-value">${esc(String(value))}</span><span class="fact-status">${esc(statusHe('confirmed'))}</span></li>`).join('')}</ul>
    </div>
    <p class="sheet-note">${icon('info')} הנתונים לא נכתבו חזרה למערכת המקור. הם נשמרו במודל של העיר, עם הראיה של הטופס.</p>
    <div class="sheet-actions"><button class="btn" type="button" data-close-sheet>סגור</button><a class="btn btn-quiet" href="#/approvals" data-close-sheet>למרכז ההכרעות</a></div>`;
}

export function explainBody(answer) {
  const rule = answer.rule;
  const unknown = answer.unknownReasons?.[0];
  const steps = answer.explainHe?.steps ?? [];
  const notChecked = answer.explainHe?.whatWasNotChecked ?? [];
  return `
    <div class="rule-card">
      <div class="rule-card-top">
        <span class="badge badge-rule">${ltr(rule?.code ?? '')} · גרסה ${esc(rule?.version ?? '')}</span>
        <span class="status-pill status-on">${icon('check')} ${esc(rule?.status === 'approved' ? 'מאושר' : 'טיוטה')}</span>
      </div>
      <p class="rule-cite">${esc(rule?.citation ?? '')}</p>
      <div class="rule-meta"><span>בעל הכלל: ${esc(rule?.owner ?? '—')}</span><span>בתוקף מ־${shortDate(rule?.effective_from)}</span></div>
    </div>
    <h3 class="sheet-subtitle">איך הגענו למספר</h3>
    <ol class="step-list">${steps.map((step) => `<li>${mixed(step)}</li>`).join('')}</ol>
    ${
      notChecked.length
        ? `<div class="what-was-not-checked"><span class="unknown-icon">${icon('alert')}</span><div><h3>מה לא נבדק</h3><ul>${notChecked.map((line) => `<li>${mixed(line)}</li>`).join('')}</ul></div></div>`
        : ''
    }
    ${
      unknown
        ? `<div class="sheet-note">${icon('info')} ${num(unknown.count)} משקי בית חסרים את ${esc(unknown.property_label_he ?? unknown.label_he)} (${ltr(unknown.property)}). זה מה שהופך אותם ל״לא ידוע״ — ולא לאפס.</div>`
        : ''
    }
    <h3 class="sheet-subtitle">המקורות</h3>
    <ul class="source-list">${(answer.sources ?? []).map((source) => `<li><span>${esc(sourceNameHe(source.system) ?? source.label)}</span><span>${shortDate(source.asOf)}</span></li>`).join('')}</ul>
    <div class="plan-line">${icon('key')} תוכנית: ${ltr(answer.plan?.metric ?? '')} על ${ltr(answer.plan?.entity ?? '')}${answer.plan?.rule_code ? ` באמצעות ${ltr(answer.plan.rule_code)}` : ''}</div>
    ${answer.suppression?.applied ? `<p class="inline-warn">${icon('lock')} המדד מוסתר בגלל גודל תא מינימלי ${num(answer.suppression.minCellSize)}.</p>` : ''}`;
}

export function interviewBody(interview) {
  const questions = interview.questions ?? [];
  return `
    <div class="interview-head">
      <div><span class="avatar avatar-4">${esc(initials(interview.personName))}</span><div><strong>${esc(interview.personName)}</strong><span>${esc(interview.personTitle)}</span></div></div>
      <span class="interview-cost">${icon('clock')} ${num(questions.length)} שאלות · כדקה</span>
    </div>
    <p class="sheet-lead">המערכת מכינה את השאלות, ממלאת את הניחוש שלה מראש, ומאפשרת לדלג או לסרב. תשובת נתון נשמרת כראיה; החלטת מדיניות נרשמת על שם בעל הכלל.</p>
    <form class="interview-form" id="interview-form" data-ref="${esc(interview.ref)}">
      ${questions
        .map(
          (question, index) => `
        <fieldset class="question">
          <legend><span class="q-index">${index + 1}</span><span class="q-category ${question.category === 'policy' ? 'is-policy' : ''}">${question.category === 'policy' ? 'החלטת בעל הכלל' : 'נתון'}</span>${mixed(question.prompt_he)}</legend>
          ${
            question.kind === 'choice'
              ? `<div class="choice-grid">${(question.options ?? [])
                  .map(
                    (option, i) => `<label class="choice ${option === question.prefill ? 'is-prefilled' : ''}"><input type="radio" name="${esc(question.id)}" value="${esc(option)}" ${option === question.prefill || (!question.prefill && i === 0) ? 'checked' : ''} /><span>${esc(option)}</span>${option === question.prefill ? `<em>הניחוש שלנו</em>` : ''}</label>`,
                  )
                  .join('')}</div>`
              : `<select class="select" name="${esc(question.id)}">${(question.options ?? [])
                  .map((option) => `<option ${option === question.prefill ? 'selected' : ''}>${esc(option)}</option>`)
                  .join('')}</select>`
          }
          ${question.prefill_source ? `<p class="q-source">${icon('info')} ${mixed(question.prefill_source)}</p>` : ''}
          ${question.category === 'policy' ? '<p class="q-policy-note">זו אינה שאלת נתון: זו החלטת מדיניות, והיא תירשם על שם בעל הכלל.</p>' : ''}
        </fieldset>`,
        )
        .join('')}
      <div class="interview-actions">
        <button class="btn" type="submit">שליחת התשובה</button>
        <button class="btn btn-quiet" type="button" data-close-sheet>לא עכשיו</button>
        <span class="interview-note">${icon('shield')} אפשר לדלג או לסרב בלי הסבר.</span>
      </div>
    </form>`;
}

export function interviewResultBody(result) {
  const whatIf = result.whatIf;
  return `
    <div class="result-hero"><span class="result-icon">${icon('check')}</span><div><h3>התשובה נשמרה כראיה</h3><p>התשובה נרשמה על שם האדם שענה, עם הזמן והמקור.</p></div></div>
    ${
      result.contradiction
        ? `<div class="contradiction">${icon('alert')}<div><strong>סתירה לכלל הקיים</strong><p>${esc(result.contradiction)}</p></div></div>`
        : ''
    }
    ${
      whatIf
        ? `<div class="what-if result-what-if">
            <span class="what-if-label">מה יקרה אם בעל הכלל יאשר את השינוי</span>
            <div class="what-if-counts">
              <span class="what-if-good"><b>${num(whatIf.eligible)}</b>זכאים</span>
              <span><b>${num(whatIf.notEligible)}</b>לא זכאים</span>
              <span><b>${num(whatIf.unknown)}</b>לא ידוע</span>
            </div>
            <p>אלה המספרים אחרי השינוי. עד לאישור בעל הכלל — לא משתנה דבר בתשובות.</p>
          </div>`
        : ''
    }
    ${
      result.ruleDecisionRef
        ? `<div class="result-hero result-decision"><span class="result-icon">${icon('shield')}</span><div><h3>ההחלטה נרשמה על שם בעל הכלל</h3><p>המדיניות אושרה. הגרסה הבאה של הכלל תכלול אותה; המספרים הנוכחיים לא משתנים עד אז.</p></div></div>`
        : `<p class="sheet-note">${icon('info')} תשובת הנתון נשמרה כראיה. הצעת שינוי המדיניות ממתינה לבעל הכלל.</p>`
    }
    <div class="sheet-actions"><button class="btn" type="button" data-close-sheet>סגור</button><a class="btn btn-quiet" href="#/approvals" data-close-sheet>למרכז ההכרעות</a></div>`;
}

export function searchBody(results) {
  if (!results) return '<p class="muted">מחפש…</p>';
  const groups = results.groups ?? [];
  if (!groups.length) {
    return `<p class="sheet-lead">לא נמצאו תוצאות${results.q ? ` ל״${esc(results.q)}״` : ''}. נסו מילה אחרת.</p>`;
  }
  return `
    <p class="sheet-lead">${num(groups.reduce((sum, group) => sum + group.items.length, 0))} תוצאות${results.q ? ` ל״${esc(results.q)}״` : ''}${results.hiddenDocuments ? ` · ${num(results.hiddenDocuments)} מסמכים מוסתרים מההרשאה שלך` : ''}</p>
    ${groups
      .map(
        (group) => `
      <section class="result-group">
        <h3>${esc(group.source)}<span>${num(group.items.length)}</span></h3>
        ${group.items
          .map(
            (item) => `<button class="result-row" type="button" data-record="${esc(item.ref)}"><div><strong>${esc(item.title)}</strong><p>${esc(item.snippet)}</p></div><span class="badge badge-neutral">${esc(item.kind)}</span></button>`,
          )
          .join('')}
      </section>`,
      )
      .join('')}`;
}

export function recordBody(page) {
  const facts = page?.facts ?? [];
  const evidence = facts.flatMap((fact) => (fact.evidence ?? []).slice(0, 1));
  return `
    <p class="sheet-lead">${esc(page?.title ?? '')} · ${esc(typeHe(page?.type))} ${ltr(page?.type ?? '')}</p>
    ${['message', 'document'].includes(page?.type) ? `<div class="sheet-actions"><button class="btn btn-small btn-quiet" type="button" data-source-open="${esc(page.type)}" data-source-ref="${esc(page.ref)}">${icon('external')} הצג במקור</button></div>` : ''}
    ${
      facts.length
        ? `<ul class="fact-list">${facts
            .slice(0, 12)
            .map(
              (fact) => `<li><span class="fact-name">${ltr(fact.property)}</span><span class="fact-value">${esc(String(fact.value))}</span><span class="fact-status">${esc(statusHe(fact.status))}</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="muted">אין עובדות גלויות על הרשומה הזו.</p>'
    }
    ${
      evidence.length
        ? `<h3 class="sheet-subtitle">הראיה</h3>${evidence.map((e) => `<pre class="evidence-quote">${esc(e.excerpt ?? '')}</pre>`).join('')}`
        : ''
    }
    ${page?.hiddenFactCount ? `<p class="inline-warn">${icon('lock')} ${num(page.hiddenFactCount)} עובדות מוסתרות מההרשאה שלך.</p>` : ''}
    <p class="sheet-note">${icon('shield')} מה שנבחר כאן הוא מה שהמערכת למדה. המקור נשאר במערכת שלו.</p>`;
}

export function inlineResults(results) {
  if (!results?.groups?.length) return '';
  return `
    <section class="inline-results">
      <div class="section-head"><div><p class="eyebrow">לא הייתה תשובה מוצהרת</p><h2>מצאנו אזכורים במקורות</h2></div><span class="section-count">${num(results.groups.reduce((sum, group) => sum + group.items.length, 0))} תוצאות</span></div>
      ${results.groups
        .map(
          (group) => `<div class="inline-group"><h3>${esc(group.source)}</h3>${group.items
            .slice(0, 4)
            .map(
              (item) => `<button class="inline-hit" type="button" data-record="${esc(item.ref)}"><span class="badge badge-neutral">${esc(item.kind)}</span><div><strong>${esc(item.title)}</strong><p>${esc(item.snippet)}</p></div>${icon('arrowLeft')}</button>`,
            )
            .join('')}</div>`,
        )
        .join('')}
      ${results.hiddenDocuments ? `<p class="inline-note">${icon('lock')} ${num(results.hiddenDocuments)} מסמכים לא הוצגו בגלל הרשאות המקור.</p>` : ''}
    </section>`;
}
