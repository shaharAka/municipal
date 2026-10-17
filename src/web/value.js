// Two pages that show the value in one look: proactive rights (who is eligible
// and not receiving) and meetings to tasks (what was decided, by whom, and what
// is stuck). They own their clicks; home.js only routes to them.

import { esc, num, icon, ltr, mixed, shortDate, chip, emptyBox, toast, openSheet, setSheetBody, closeSheet, initials, navFor } from './ui.js';

let ctx = { api: null, refresh: async () => {}, kind: 'clerk' };
export const bind = (next) => {
  ctx = { ...ctx, ...next };
};

const shekel = (n) => `${num(Math.round(Number(n) || 0))} ₪`;
const cell = (n) => (n === null || n === undefined ? '<span class="v-suppressed" title="מספר קטן מ־5 מוסתר">פחות מ־5</span>' : num(n));

// ---------------------------------------------------------------- home strip

/** The initiatives on a person's home: what the two value pages want from them, if anything. */
export async function homeStrip({ api, kind }) {
  const tabs = navFor(kind);
  const [rights, meetings] = await Promise.all([
    tabs.includes('rights') ? api('/api/rights').catch(() => null) : null,
    tabs.includes('meetings') ? api('/api/meetings').catch(() => null) : null,
  ]);
  const cards = [];
  if (rights) {
    const t = rights.totals;
    const open = t.notReceiving === null ? null : t.notReceiving - t.outreachSent;
    cards.push(`
      <a class="v-strip-card" href="#/rights">
        <span class="v-strip-icon">${icon('users')}</span>
        <span class="v-strip-copy">
          <span class="v-strip-label">מיצוי זכויות</span>
          <strong>${shekel(t.unclaimedAnnual)} בשנה בהנחות ארנונה שלא מומשו</strong>
          <span>${
            rights.access.canSeeNames
              ? open
                ? `${num(open)} תושבים זכאים ממתינים לפנייה${kind === 'secretary' ? ' ממך' : ''}.`
                : 'כל הזכאים קיבלו פנייה.'
              : `${open === null ? 'משקי בית' : `${num(t.notReceiving)} משקי בית`} זכאים ולא מקבלים. השמות אצל מי שמטפל בבקשות הנחה.`
          }</span>
        </span>
        <span class="v-strip-go">${rights.access.canSeeNames && open ? 'לרשימה' : 'לפרטים'} ${icon('arrowLeft')}</span>
      </a>`);
  }
  if (meetings) {
    const c = meetings.counts;
    const mine = meetings.mine ?? [];
    const next = mine.slice().sort((a, b) => String(a.due ?? '9').localeCompare(String(b.due ?? '9')))[0];
    if (kind === 'head') {
      cards.push(`
        <a class="v-strip-card ${c.overdue || c.noOwner ? 'is-alert' : ''}" href="#/meetings">
          <span class="v-strip-icon">${icon('flow')}</span>
          <span class="v-strip-copy">
            <span class="v-strip-label">מהישיבה למשימות</span>
            <strong>${num(c.open)} החלטות הנהלה פתוחות</strong>
            <span>${[c.noOwner ? `${num(c.noOwner)} בלי אחראי` : '', c.overdue ? `${num(c.overdue)} באיחור` : '', c.readyForTasks ? `${num(c.readyForTasks)} מוכנות להפוך למשימות` : ''].filter(Boolean).join(' · ') || 'הכל משויך ובזמן.'}</span>
          </span>
          <span class="v-strip-go">לטיפול ${icon('arrowLeft')}</span>
        </a>`);
    } else if (next) {
      cards.push(`
        <a class="v-strip-card ${next.status === 'overdue' || next.status === 'due_soon' ? 'is-alert' : ''}" href="#/meetings">
          <span class="v-strip-icon">${icon('flow')}</span>
          <span class="v-strip-copy">
            <span class="v-strip-label">${mine.length === 1 ? 'משימה מישיבת ההנהלה' : `${num(mine.length)} משימות מישיבות ההנהלה`}</span>
            <strong>${mixed(next.text)}</strong>
            <span>${next.due ? `עד ${esc(shortDate(next.due))}` : 'ללא מועד'} · מישיבת ${esc(shortDate(next.meetingDate))}</span>
          </span>
          <span class="v-strip-go">לפרטים ${icon('arrowLeft')}</span>
        </a>`);
    }
  }
  if (!cards.length) return '';
  return `
    <section class="v-strip" aria-label="יוזמות">
      <p class="eyebrow">יוזמות · המערכת מצאה</p>
      <div class="v-strip-cards">${cards.join('')}</div>
    </section>`;
}

// ---------------------------------------------------------------- rights

export async function rightsPage() {
  const data = await ctx.api('/api/rights');
  const t = data.totals;
  const share = t.households ? t.notReceiving / t.households : 0;
  const perHousehold = t.notReceiving ? t.unclaimedAnnual / t.households : 0;
  return `
    <div class="view value-view">
      <header class="page-head">
        <div>
          <p class="eyebrow">מיצוי זכויות · יוזמה של העירייה</p>
          <h1>מי זכאי להנחה בארנונה ולא מקבל אותה</h1>
          <p class="page-sub">המערכת מצליבה את מרשם התושבים עם נתוני גביית הארנונה לפי כלל מוצהר, ומציגה את מי שזכאי ועדיין לא מימש את זכותו. במקום לחכות שהתושב יבקש, העירייה פונה אליו.</p>
        </div>
        <div class="head-figure"><b>${shekel(t.unclaimedAnnual)}</b><span>בשנה, בהנחות שלא מומשו</span></div>
      </header>

      <section class="v-tiles" aria-label="תמונת מצב">
        <div class="v-tile"><span>משקי בית שנבדקו</span><b>${num(t.households)}</b></div>
        <div class="v-tile"><span>עומדים בתנאי הזכאות</span><b>${cell(t.eligible)}</b></div>
        <div class="v-tile"><span>כבר מקבלים הנחה</span><b>${cell(t.receiving)}</b></div>
        <div class="v-tile is-key"><span>זכאים ולא מקבלים</span><b>${cell(t.notReceiving)}</b><small>${t.outreachSent ? `${num(t.outreachSent)} כבר קיבלו פנייה מהעירייה` : 'עדיין לא נשלחה פנייה'}</small></div>
      </section>

      <section class="v-card">
        <div class="section-head"><h2>לפי עילת זכאות</h2><span class="section-count">${esc(data.rule.name_he)} · גרסה ${num(data.rule.version)}</span></div>
        <div class="v-grounds">
          ${data.grounds.map((g) => groundCard(g, data)).join('')}
        </div>
        <p class="v-rule-line">${icon('doc')} ${esc(data.rule.citation)} · בעל הכלל: ${esc(data.rule.owner)} · <span class="v-demo-flag">${esc(data.rule.status_he)}</span></p>
      </section>

      ${data.access.canSeeNames ? worklist(data) : aggregateNotice(data)}

      ${boundaryPanel(data)}

      <section class="v-card v-quiet">
        <h2>המספרים שעליהם החישוב נשען</h2>
        <ul class="v-params">
          <li><b>${shekel(data.params.tariffPerSqm.value)} למ״ר בשנה</b> — ${esc(data.params.tariffPerSqm.reason)} <span>בעלים: ${esc(data.params.tariffPerSqm.owner)}</span></li>
          ${data.rule.grounds.filter((g) => g.connected).map((g) => `<li><b>${Math.round(g.rate * 100)}%</b> — שיעור ההנחה בעילה "${esc(g.label_he)}". <span>שיעור להדגמה</span></li>`).join('')}
          <li><b>פחות מ־${num(data.suppression.minCellSize)}</b> — מספר קטן מזה מוסתר ממי שאינו מטפל בבקשות הנחה. <span>בעלים: ${esc(data.suppression.owner)}</span></li>
        </ul>
        <p class="v-projection">${icon('info')} בנתוני ההדגמה: ${num(t.notReceiving)} מתוך ${num(t.households)} משקי בית (${Math.round(share * 100)}%). באותו שיעור, בעיר של 10,000 משקי בית היו כ־${num(Math.round(share * 10000))} משקי בית וכ־${shekel(Math.round(perHousehold * 10000))} בשנה. זו הכפלה פשוטה של המדגם, לא תחזית.</p>
      </section>
    </div>`;
}

function groundCard(g, data) {
  if (!g.connected) {
    return `
      <article class="v-ground is-locked">
        <header>${icon('lock')}<h3>${esc(g.labelHe)}</h3></header>
        <p class="v-ground-big">${num(g.unchecked)} <span>משקי בית שלא ניתן לבדוק</span></p>
        <p>אין לעירייה מקור מחובר על שירות מילואים. בכל אחד ממשקי הבית האלה גר תושב בין ${num(data.params.reservistAgeRange.value[0])} ל־${num(data.params.reservistAgeRange.value[1])}, ולכן אי אפשר לשלול זכאות.</p>
        <p class="v-ground-foot">${icon('key')} חיבור מקור של אישורי שירות מילואים ישלים את הבדיקה. מאיזה גוף יגיע המידע עדיין לא סוכם עם העירייה.</p>
      </article>`;
  }
  return `
    <article class="v-ground">
      <header>${icon('check')}<h3>${esc(g.labelHe)}</h3></header>
      <p class="v-ground-big">${cell(g.notReceiving)} <span>זכאים ולא מקבלים</span></p>
      <p>${cell(g.eligible)} עומדים בתנאי · ${shekel(g.unclaimedAnnual)} בשנה לא קוזזו מהחיוב</p>
      ${g.unchecked ? `<p class="v-ground-foot is-amber">${icon('question')} ב־${num(g.unchecked)} משקי בית עם אזרח ותיק אי אפשר לבדוק: חסר נתון ההכנסה של משק הבית.</p>` : `<p class="v-ground-foot">${icon('database')} ${esc(g.sourceHe)}</p>`}
    </article>`;
}

function worklist(data) {
  if (!data.worklist.length) return `<section class="v-card">${emptyBox('check', 'אין משקי בית שממתינים לפנייה', 'כל מי שזכאי כבר מקבל את ההנחה או קיבל פנייה מהעירייה.')}</section>`;
  return `
    <section class="v-card">
      <div class="section-head">
        <h2>תושבים שכדאי לפנות אליהם</h2>
        <span class="section-count">${icon('eye')} ${esc(data.access.whyHe)}</span>
      </div>
      <div class="v-list" role="list">
        ${data.worklist.map((h) => worklistRow(h)).join('')}
      </div>
    </section>`;
}

function worklistRow(h) {
  const best = h.qualifiers.find((q) => q.ground === h.bestGround) ?? h.qualifiers[0];
  const sent = h.outreach;
  return `
    <article class="v-row" role="listitem">
      <div class="v-avatar" aria-hidden="true">${esc(initials(best.name))}</div>
      <div class="v-row-main">
        <h3>${esc(best.name)} <span class="v-row-sub">${esc(h.address)}</span></h3>
        <p>${chip(best.groundHe, { tone: 'ok' })} ${h.qualifiers.length > 1 ? `<span class="v-row-sub">ועוד ${num(h.qualifiers.length - 1)} במשק הבית</span>` : ''}</p>
        <p class="v-evidence">${best.evidence.map((e) => `<span class="evidence-chip" title="${esc(`${e.table}.${e.column}`)}">${esc(e.sourceHe)} · ${ltr(e.row)} · ${esc(e.columnHe)}: ${/^\d{4}-\d{2}-\d{2}$/.test(e.value) ? esc(shortDate(e.value)) : esc(e.value)}</span>`).join('')}<span class="evidence-chip">גביית ארנונה · לא רשומה הנחה</span></p>
      </div>
      <div class="v-row-figures">
        <b>${shekel(h.unclaimedAnnual)}</b><span>בשנה, מתוך חיוב של ${shekel(h.annualArnona)}</span>
      </div>
      <div class="v-row-action">
        ${
          sent
            ? `<span class="status-pill status-on">${icon('check')} פנייה נשלחה · ${esc(sent.by.split(' (')[0])} · ${esc(shortDate(sent.at))}</span>`
            : `<button class="btn btn-small" type="button" data-v-letter="${esc(h.householdId)}">${icon('mail')} הכנת פנייה</button>`
        }
      </div>
    </article>`;
}

function aggregateNotice(data) {
  return `
    <section class="v-card v-locked-list">
      ${icon('lock')}
      <div>
        <h2>השמות והכתובות לא מוצגים לך</h2>
        <p>${esc(data.access.whyHe)} כאן מוצגים מספרים בלבד, ומספר קטן מ־${num(data.suppression.minCellSize)} מוסתר כדי שלא ניתן יהיה לזהות משק בית.</p>
      </div>
    </section>`;
}

function boundaryPanel(data) {
  const b = data.boundary;
  return `
    <section class="v-card v-boundary" aria-labelledby="v-boundary-title">
      <div class="section-head"><h2 id="v-boundary-title">גבול המידע: מה ראה מודל ה־AI</h2><span class="section-count">${icon('shield')} נבדק בכל חישוב</span></div>
      <div class="v-boundary-grid">
        <div>
          <h3>מנוע הכללים (בתוך המערכת)</h3>
          <p class="v-boundary-big">${num(b.rowsProcessed)} <span>משקי בית נבדקו</span></p>
          <ul>${b.engineRead.map((c) => `<li>${esc(c.he)} <span class="v-col">${ltr(c.code)}</span></li>`).join('')}</ul>
        </div>
        <div class="is-model">
          <h3>מודל ה־AI</h3>
          <p class="v-boundary-big">${num(b.rowsSentToModel)} <span>רשומות תושבים נשלחו</span></p>
          <p>החישוב מפעיל כלל מוצהר על שדות קבועים, והמכתב נבנה מתבנית קבועה, כך שהמודל לא היה מעורב כאן. כשמשתמשים בו כדי להבין שאלה בשפה חופשית, הוא רואה את השאלה, את שמות השדות ואת הכלל, ואף פעם לא את הנתונים עצמם.</p>
        </div>
      </div>
      <div class="v-deploy">
        <span><b>בענן של העירייה</b> הנתונים והמודל בתוך סביבת הענן של העירייה</span>
        <span class="is-here"><b>מפוצל</b> המנוע רץ ליד הנתונים, והמודל רואה רק את מבנה הנתונים ואת הכלל</span>
        <span><b>מקומי לחלוטין</b> גם המודל רץ על שרתי העירייה, בלי חיבור לאינטרנט</span>
      </div>
    </section>`;
}

async function openLetter(householdId) {
  openSheet({ title: 'פנייה יזומה לתושב', eyebrow: 'מיצוי זכויות', body: '<div class="sheet-loading">המכתב בהכנה…</div>', wide: true });
  try {
    const data = await ctx.api(`/api/rights/letter?household=${encodeURIComponent(householdId)}`);
    setSheetBody(
      `
      <div class="v-letter">
        <p class="v-letter-meta">${icon('info')} המכתב נבנה מתבנית קבועה ומהשדות שבמסך. אף רשומה לא נשלחה למודל.</p>
        <pre class="v-letter-text">${esc(data.letter.text)}</pre>
        <p class="v-letter-meta">${icon('shield')} השליחה נרשמת כהחלטה על שמך. מערכת הגבייה לא משתנה עד שהזכאות תיבדק סופית.</p>
      </div>`,
      `<button class="btn" type="button" data-v-send="${esc(householdId)}">${icon('check')} אישור ושליחה</button><button class="btn btn-quiet" type="button" data-close-sheet>לא עכשיו</button>`,
    );
  } catch (err) {
    setSheetBody(`<p>${esc(err.message ?? err)}</p>`);
  }
}

async function sendLetter(button) {
  button.disabled = true;
  try {
    await ctx.api('/api/rights/outreach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ household: button.dataset.vSend }),
    });
    closeSheet();
    toast('הפנייה נשלחה ונרשמה כהחלטה על שמך.');
    await ctx.refresh();
  } catch (err) {
    button.disabled = false;
    toast(String(err.message ?? err), 'error');
  }
}

// ---------------------------------------------------------------- meetings

const STATUS = {
  done: ['בוצע', 'ok'],
  overdue: ['באיחור', 'danger'],
  due_soon: ['בשבוע הקרוב', 'amber'],
  open: ['פתוח', ''],
};

let lastQuestion = '';

export async function meetingsPage() {
  const data = await ctx.api(`/api/meetings${lastQuestion ? `?q=${encodeURIComponent(lastQuestion)}` : ''}`);
  const c = data.counts;
  const canAct = ctx.kind === 'head';
  const recalled = data.recalled.map((id) => data.decisions.find((d) => d.id === id)).filter(Boolean);
  return `
    <div class="view value-view">
      <header class="page-head">
        <div>
          <p class="eyebrow">זיכרון ארגוני · מהישיבה למשימות</p>
          <h1>מה הוחלט, מי אחראי, ומה נתקע</h1>
          <p class="page-sub">המערכת קוראת את סיכומי ישיבות ההנהלה, מזהה החלטות, אחראים ומועדים, ובודקת מול הישיבות הבאות מה בוצע. משימות נוצרות רק כשאדם מאשר.</p>
        </div>
        <div class="head-figure"><b>${num(c.open)}</b><span>החלטות פתוחות</span></div>
      </header>

      <form class="v-recall" id="v-recall-form" role="search">
        <label for="v-recall-input">מה כבר הוחלט על…</label>
        <div class="v-recall-row">
          <input id="v-recall-input" name="q" type="search" value="${esc(lastQuestion)}" placeholder="למשל: שיבוץ ביקורות" autocomplete="off" />
          <button class="btn" type="submit">${icon('search')} חיפוש</button>
        </div>
        <div class="v-recall-chips">${['שיבוץ ביקורות', 'הנחות לתושבים', 'קריאות מזיקים'].map((q) => `<button type="button" class="chip-btn" data-v-recall="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        ${
          lastQuestion
            ? recalled.length
              ? `<div class="v-recall-results">${recalled.map((d) => decisionRow(d, data, { compact: true })).join('')}</div>`
              : `<p class="v-recall-empty">לא מצאנו החלטה בנושא הזה ב־${num(data.meetings.length)} סיכומי הישיבות.</p>`
            : ''
        }
      </form>

      ${
        data.alerts.length
          ? `<section class="v-card v-alerts">
              <div class="section-head"><h2>${icon('alert')} דורש תשומת לב</h2><span class="section-count">זוהה אוטומטית</span></div>
              ${data.alerts.map((d) => alertRow(d, data, canAct)).join('')}
            </section>`
          : ''
      }

      ${
        data.mine.length
          ? `<section class="v-card">
              <div class="section-head"><h2>המשימות שלי מהישיבות</h2><span class="section-count">${num(data.mine.length)}</span></div>
              ${data.mine.map((d) => decisionRow(d, data)).join('')}
            </section>`
          : ''
      }

      <section class="v-card">
        <div class="section-head">
          <h2>כל ההחלטות</h2>
          <span class="section-count">${num(c.total)} החלטות · ${num(c.done)} בוצעו · ${num(c.overdue)} באיחור · ${num(c.noOwner)} ללא אחראי</span>
        </div>
        ${data.meetings
          .slice()
          .reverse()
          .map(
            (m) => `
          <h3 class="v-meeting-title">${icon('doc')} ${esc(m.title)} · ${esc(shortDate(m.date))} <button type="button" class="text-link" data-v-minutes="${esc(m.id)}">לסיכום המלא</button></h3>
          ${data.decisions.filter((d) => d.meetingId === m.id).map((d) => decisionRow(d, data)).join('')}`,
          )
          .join('')}
        ${
          canAct
            ? `<div class="v-tasks-bar">
                <p>${c.readyForTasks ? `אפשר להפוך ${num(c.readyForTasks)} החלטות פתוחות שיש להן אחראי למשימות, עם תזכורת שלושה ימים לפני המועד.` : 'כל ההחלטות שיש להן אחראי כבר הפכו למשימות.'}${c.noOwner ? ` ${num(c.noOwner)} החלטות עדיין ממתינות לאחראי.` : ''}</p>
                <button class="btn" type="button" data-v-tasks ${c.readyForTasks ? '' : 'disabled'}>${icon('check')} יצירת משימות ותזכורות</button>
              </div>`
            : `<p class="v-tasks-note">${icon('info')} מנהלת המחלקה יוצרת את המשימות, וכל אחראי רואה כאן את המשימות שלו.</p>`
        }
      </section>
    </div>`;
}

function decisionRow(d, data, { compact = false } = {}) {
  const [label, tone] = STATUS[d.status] ?? STATUS.open;
  const owner = d.ownerName
    ? `<span class="v-owner">${esc(d.ownerName)}${d.assignedLater ? ' <small>נקבע עכשיו</small>' : ''}</span>`
    : `<span class="v-owner is-missing">${icon('alert')} ללא אחראי</span>`;
  return `
    <article class="v-decision">
      <div class="v-decision-main">
        <p class="v-decision-text">${mixed(d.text)}</p>
        <p class="v-decision-meta">
          ${owner}
          ${d.due ? `<span>${icon('clock')} עד ${esc(shortDate(d.due))}</span>` : `<span class="is-amber">${icon('clock')} ללא מועד</span>`}
          ${compact ? `<span>${esc(shortDate(d.meetingDate))} · ${esc(d.topic)}</span>` : ''}
          <button type="button" class="v-source" data-v-minutes="${esc(d.meetingId)}" data-v-line="${num(d.line)}">${icon('doc')} שורה ${num(d.line)}</button>
          ${d.doneLine ? `<button type="button" class="v-source" data-v-minutes="${esc(d.doneLine.meetingId)}" data-v-line="${num(d.doneLine.line)}">${icon('check')} בוצע ${esc(shortDate(d.doneAt))}</button>` : ''}
          ${d.linksTo === 'rights' ? `<a class="text-link" href="#/rights">לרשימת הזכאים ${icon('arrowLeft')}</a>` : ''}
        </p>
      </div>
      <div class="v-decision-side">
        <span class="status-pill tone-${tone}">${esc(label)}</span>
        ${d.task ? `<span class="v-task">${icon('bell')} משימה · תזכורת ${esc(shortDate(d.task.remindOn ?? d.task.due))}</span>` : ''}
      </div>
    </article>`;
}

function alertRow(d, data, canAct) {
  const days = d.due ? Math.round((Date.parse(data.asOf) - Date.parse(d.due)) / 86_400_000) : 0;
  const why = [
    d.flags.includes('no_owner') ? 'אין אחראי' : '',
    d.status === 'overdue' ? `המועד עבר לפני ${num(days)} ימים` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return `
    <article class="v-alert">
      <div>
        <p class="v-decision-text">${mixed(d.text)}</p>
        <p class="v-decision-meta"><span class="is-danger">${esc(why)}</span><span>מישיבת ${esc(shortDate(d.meetingDate))}</span>
          <button type="button" class="v-source" data-v-minutes="${esc(d.meetingId)}" data-v-line="${num(d.line)}">${icon('doc')} שורה ${num(d.line)}</button></p>
      </div>
      ${
        canAct && d.flags.includes('no_owner')
          ? `<form class="v-assign" data-v-assign="${esc(d.id)}">
              <label class="sr-only" for="v-owner-${esc(d.id)}">אחראי</label>
              <select id="v-owner-${esc(d.id)}" name="owner" required>
                <option value="">בחרו אחראי…</option>
                ${data.people.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.title)}</option>`).join('')}
              </select>
              <button class="btn btn-small" type="submit">קביעת אחראי</button>
            </form>`
          : ''
      }
    </article>`;
}

async function openMinutes(id, line) {
  openSheet({ title: 'סיכום ישיבה', eyebrow: 'המקור', body: '<div class="sheet-loading">טוען…</div>', wide: true });
  const data = await ctx.api(`/api/meetings/minutes?id=${encodeURIComponent(id)}`);
  const m = data.minutes;
  setSheetBody(`
    <p class="v-letter-meta">${icon('doc')} ${esc(m.path)} · ${esc(shortDate(m.date))}</p>
    <ol class="v-minutes">
      ${m.lines.map((l, i) => `<li class="${i + 1 === line ? 'is-hit' : ''}" ${i + 1 === line ? 'id="v-hit"' : ''}>${mixed(l)}</li>`).join('')}
    </ol>`);
  document.getElementById('v-hit')?.scrollIntoView({ block: 'center' });
}

async function confirmTasks() {
  const data = await ctx.api('/api/meetings');
  const ready = data.decisions.filter((d) => d.status !== 'done' && d.ownerId && !d.task);
  openSheet({
    title: 'יצירת משימות ותזכורות',
    eyebrow: 'מהישיבה למשימות',
    wide: true,
    body: `
      <p>ייווצרו ${num(ready.length)} משימות. כל אחראי יראה את המשימה שלו, ותזכורת תישלח שלושה ימים לפני המועד.</p>
      <ul class="v-confirm-list">${ready.map((d) => `<li><b>${esc(d.ownerName)}</b> · ${mixed(d.text)}${d.due ? ` · עד ${esc(shortDate(d.due))}` : ''}</li>`).join('')}</ul>
      <p class="v-letter-meta">${icon('shield')} היצירה נרשמת כהחלטה על שמך. בהדגמה הזו שום דבר לא נכתב ליומן או לתיבת הדואר של העובדים.</p>`,
    footer: `<button class="btn" type="button" data-v-tasks-confirm>${icon('check')} יצירה</button><button class="btn btn-quiet" type="button" data-close-sheet>ביטול</button>`,
  });
}

async function post(path, body) {
  return ctx.api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
}

// ---------------------------------------------------------------- events

document.addEventListener('click', async (event) => {
  const letter = event.target.closest('[data-v-letter]');
  if (letter) return openLetter(letter.dataset.vLetter);
  const send = event.target.closest('[data-v-send]');
  if (send) return sendLetter(send);
  const minutes = event.target.closest('[data-v-minutes]');
  if (minutes) return openMinutes(minutes.dataset.vMinutes, Number(minutes.dataset.vLine || 0));
  const recall = event.target.closest('[data-v-recall]');
  if (recall) {
    lastQuestion = recall.dataset.vRecall;
    return ctx.refresh();
  }
  if (event.target.closest('[data-v-tasks]')) return confirmTasks();
  const go = event.target.closest('[data-v-tasks-confirm]');
  if (go) {
    go.disabled = true;
    try {
      const result = await post('/api/meetings/tasks');
      closeSheet();
      toast(`נוצרו ${num(result.created.length)} משימות. ההחלטה נרשמה על שמך.`);
      await ctx.refresh();
    } catch (err) {
      go.disabled = false;
      toast(String(err.message ?? err), 'error');
    }
  }
});

document.addEventListener('submit', async (event) => {
  const recallForm = event.target.closest('#v-recall-form');
  if (recallForm) {
    event.preventDefault();
    lastQuestion = String(new FormData(recallForm).get('q') ?? '').trim();
    return ctx.refresh();
  }
  const assign = event.target.closest('[data-v-assign]');
  if (assign) {
    event.preventDefault();
    const owner = String(new FormData(assign).get('owner') ?? '');
    if (!owner) return;
    try {
      await post('/api/meetings/assign', { decision: assign.dataset.vAssign, owner });
      toast('האחראי נקבע. עכשיו אפשר להפוך את ההחלטה למשימה.');
      await ctx.refresh();
    } catch (err) {
      toast(String(err.message ?? err), 'error');
    }
  }
});
