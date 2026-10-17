// From the meeting to the work: decisions are read out of management-meeting
// minutes, matched to people in the directory, checked against later minutes,
// and turned into tasks only when a person approves.
//
// Extraction is declared, not generated: a line that starts "הוחלט:" is a
// decision, "אחראי/ת:" names its owner and "עד:" its date; "בוצע:" in a later
// meeting closes the decision it shares the most words with. Every decision
// keeps the document and the line it came from.

import type { Fixture } from '../cloud/fixtures.ts';
import { REFERENCE_DATE } from '../seed/eligibility-rules.ts';

export type Minutes = { id: string; title: string; date: string; path: string; lines: string[] };

export const MINUTES: Minutes[] = [
  {
    id: 'MIN-2026-09-15',
    title: 'סיכום ישיבת הנהלת המחלקה',
    date: '2026-09-15',
    path: 'מסמכי המחלקה › ישיבות הנהלה › 2026-09-15.docx',
    lines: [
      'משתתפים: דנה לוי, יוסי כהן, מיכל ברק, הילה קורן, רונית דיין',
      'נושא: עומס בשיבוץ ביקורות לרישוי עסקים',
      'הוחלט: לפתוח יומן שיבוץ משותף למפקחי המזון | אחראית: מיכל ברק | עד: 2026-10-01',
      'הוחלט: לבחון תוספת מפקח במשרה חלקית לעונת הקיץ | אחראי: יוסי כהן | עד: 2026-11-15',
      'נושא: קריאות מזיקים באזור התעשייה',
      'הוחלט: לרכז את קריאות המזיקים מהרבעון האחרון לדוח אחד למועצת העיר | עד: 2026-09-30',
      'הוחלט: לזמן את קבלן ההדברה לפגישת תיאום | אחראי: ליאור אשכנזי',
    ],
  },
  {
    id: 'MIN-2026-10-14',
    title: 'סיכום ישיבת הנהלת המחלקה',
    date: '2026-10-14',
    path: 'מסמכי המחלקה › ישיבות הנהלה › 2026-10-14.docx',
    lines: [
      'משתתפים: דנה לוי, יוסי כהן, מיכל ברק, הילה קורן, משה טל',
      'נושא: מעקב החלטות מהישיבה הקודמת',
      'בוצע: יומן שיבוץ משותף למפקחי המזון הופעל | 2026-09-28',
      'נושא: הנחות לתושבים',
      'הוחלט: להכין רשימת משקי בית שזכאים להנחה בארנונה ולא מימשו אותה | אחראית: הילה קורן | עד: 2026-10-31',
      'הוחלט: לבקש מהגזברות את נתוני ההכנסה החסרים | עד: 2026-10-25',
      'נושא: ביקורות לפני החורף',
      'הוחלט: לשלוח לבעלי מסעדות תזכורת לנקות מפרידי שומן לפני עונת הגשמים | אחראי: אמיר חדאד | עד: 2026-10-20',
      'הוחלט: להציג לראש העיר את צוואר הבקבוק בשיבוץ הפיקוח | אחראית: דנה לוי | עד: 2026-11-05',
    ],
  },
];

export type MeetingDecision = {
  id: string;
  text: string;
  meetingId: string;
  meetingDate: string;
  topic: string;
  line: number;
  path: string;
  ownerName: string | null;
  ownerId: string | null;
  ownerTitle: string | null;
  due: string | null;
  status: 'done' | 'open' | 'overdue' | 'due_soon';
  doneAt: string | null;
  doneLine: { meetingId: string; line: number } | null;
  flags: ('no_owner' | 'no_date' | 'owner_not_in_directory')[];
  linksTo: 'rights' | null;
};

export type Task = { decisionId: string; ownerId: string; ownerName: string; due: string | null; remindOn: string | null; createdBy: string; createdAt: string };

// Hebrew prefixes (ו, ה, ב, ל, מ, ש) are stripped so "המזון" meets "מזון".
const words = (text: string) =>
  new Set(
    text
      .replace(/[^֐-׿a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/^[והבלמש](?=[֐-׿]{3,})/, ''))
      .filter((w) => w.length > 2),
  );

const overlap = (a: string, b: string) => {
  const A = words(a);
  let n = 0;
  for (const w of words(b)) if (A.has(w)) n++;
  return n;
};

const field = (parts: string[], keys: RegExp) => parts.find((p) => keys.test(p))?.replace(keys, '').trim() || null;

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

export function extractDecisions(fixture: Fixture): MeetingDecision[] {
  const people = fixture.users.map((u) => ({ id: u.id, name: u.displayName, title: u.jobTitle }));
  const decisions: MeetingDecision[] = [];
  const done: { text: string; at: string; meetingId: string; line: number }[] = [];

  for (const m of MINUTES) {
    let topic = '';
    m.lines.forEach((raw, i) => {
      const line = i + 1;
      if (raw.startsWith('נושא:')) topic = raw.replace('נושא:', '').trim();
      if (raw.startsWith('בוצע:')) {
        const [text, at] = raw.replace('בוצע:', '').split('|').map((s) => s.trim());
        done.push({ text, at: at || m.date, meetingId: m.id, line });
      }
      if (!raw.startsWith('הוחלט:')) return;
      const parts = raw.replace('הוחלט:', '').split('|').map((s) => s.trim());
      const ownerName = field(parts, /^אחראי(ת)?:/);
      const due = field(parts, /^עד:/);
      const owner = ownerName ? people.find((p) => p.name === ownerName) : undefined;
      const flags: MeetingDecision['flags'] = [];
      if (!ownerName) flags.push('no_owner');
      else if (!owner) flags.push('owner_not_in_directory');
      if (!due) flags.push('no_date');
      decisions.push({
        id: `${m.id}-L${line}`,
        text: parts[0],
        meetingId: m.id,
        meetingDate: m.date,
        topic,
        line,
        path: m.path,
        ownerName,
        ownerId: owner?.id ?? null,
        ownerTitle: owner?.title ?? null,
        due,
        status: 'open',
        doneAt: null,
        doneLine: null,
        flags,
        linksTo: /משקי בית.*הנחה|הנחה.*משקי בית/.test(parts[0]) ? 'rights' : null,
      });
    });
  }

  // A later "בוצע:" closes the earlier decision it shares the most words with.
  for (const d of done) {
    const best = decisions
      .filter((x) => x.meetingDate <= d.at || x.meetingDate < REFERENCE_DATE)
      .map((x) => ({ x, n: overlap(x.text, d.text) }))
      .sort((a, b) => b.n - a.n)[0];
    if (best && best.n >= 2) {
      best.x.status = 'done';
      best.x.doneAt = d.at;
      best.x.doneLine = { meetingId: d.meetingId, line: d.line };
    }
  }

  for (const d of decisions) {
    if (d.status === 'done' || !d.due) continue;
    if (d.due < REFERENCE_DATE) d.status = 'overdue';
    else if (d.due <= addDays(REFERENCE_DATE, 7)) d.status = 'due_soon';
  }
  return decisions;
}

/** "What was decided about X?" — the decisions that share the most words with the question. */
export function recall(decisions: MeetingDecision[], question: string) {
  return decisions
    .map((d) => ({ d, n: overlap(`${d.topic} ${d.text}`, question) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.d.meetingDate.localeCompare(a.d.meetingDate))
    .slice(0, 5)
    .map((x) => x.d);
}

export function meetingsView(
  fixture: Fixture,
  viewerId: string,
  tasks: Map<string, Task>,
  assigned: Map<string, { ownerId: string; ownerName: string }>,
  question: string,
) {
  const decisions = extractDecisions(fixture).map((d) => {
    const a = assigned.get(d.id);
    return a ? { ...d, ownerId: a.ownerId, ownerName: a.ownerName, flags: d.flags.filter((f) => f !== 'no_owner'), assignedLater: true } : { ...d, assignedLater: false };
  });
  const open = decisions.filter((d) => d.status !== 'done');
  return {
    asOf: REFERENCE_DATE,
    meetings: MINUTES.map((m) => ({ id: m.id, title: m.title, date: m.date, path: m.path, decisions: decisions.filter((d) => d.meetingId === m.id).length })),
    decisions: decisions.map((d) => ({ ...d, task: tasks.get(d.id) ?? null })),
    alerts: open.filter((d) => d.status === 'overdue' || d.flags.includes('no_owner')),
    mine: decisions.filter((d) => d.ownerId === viewerId && d.status !== 'done').map((d) => ({ ...d, task: tasks.get(d.id) ?? null })),
    counts: {
      total: decisions.length,
      done: decisions.filter((d) => d.status === 'done').length,
      open: open.length,
      overdue: open.filter((d) => d.status === 'overdue').length,
      noOwner: open.filter((d) => d.flags.includes('no_owner')).length,
      tasks: tasks.size,
      readyForTasks: open.filter((d) => d.ownerId && !tasks.has(d.id)).length,
    },
    question,
    recalled: question ? recall(decisions, question).map((d) => d.id) : [],
    people: fixture.users
      .filter((u) => (u as { employeeType?: string }).employeeType !== 'Contractor')
      .map((u) => ({ id: u.id, name: u.displayName, title: u.jobTitle })),
  };
}

export function createTasks(
  fixture: Fixture,
  tasks: Map<string, Task>,
  assigned: Map<string, { ownerId: string; ownerName: string }>,
  actor: string,
  at: string,
): Task[] {
  const created: Task[] = [];
  for (const d of extractDecisions(fixture)) {
    if (d.status === 'done' || tasks.has(d.id)) continue;
    const owner = assigned.get(d.id) ?? (d.ownerId ? { ownerId: d.ownerId, ownerName: d.ownerName ?? '' } : null);
    if (!owner) continue;
    const task: Task = {
      decisionId: d.id,
      ownerId: owner.ownerId,
      ownerName: owner.ownerName,
      due: d.due,
      remindOn: d.due ? (d.due < REFERENCE_DATE ? REFERENCE_DATE : addDays(d.due, -3)) : null,
      createdBy: actor,
      createdAt: at,
    };
    tasks.set(d.id, task);
    created.push(task);
  }
  return created;
}

export function minutesDocument(id: string) {
  return MINUTES.find((m) => m.id === id) ?? null;
}
