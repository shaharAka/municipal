// The HTTP surface: a tiny router, the API the workbench reads, and the static
// files. No framework, because the POC must run from a checkout with no install;
// swapping in Fastify is a container-level change nothing else sees.

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { buildDemo, captureTime, type Demo, type Platform } from './platform.ts';
import { CONNECTIONS } from './cloud/registry.ts';
import { publicView, stats as ontologyStats } from './ontology/compose.ts';
import { MAPPINGS } from './ontology/mappings.ts';
import { PARAMS, approveAutomation } from './process/discover.ts';
import { whoHandles } from './org/orgmap.ts';
import { ACTIVITY_LABELS } from './cloud/fixtures.ts';
import { SERVICES } from './seed/services.ts';
import { answerQuestion } from './query/eligibility.ts';
import { REFERENCE_DATE, RULES, SUPPRESSION } from './seed/eligibility-rules.ts';
import { generateForm, proposeValues, validateSubmission, type FormKind } from './forms/generate.ts';
import { answerInterview, listInterviews, openInterview, ATTENTION } from './interviews/engine.ts';
import { SOURCES, research, approveSuggestion, type Suggestion, type SourceId } from './research/sources.ts';
import { refFor, type Viewer } from './graph/graph.ts';

const WEB = new URL('./web/', import.meta.url).pathname;

// Which sources a person turned on, and what research found once they did.
const connectors: { enabled: Set<string>; suggestions: Map<string, Suggestion> } = {
  enabled: new Set(SOURCES.filter((s) => s.enabledByDefault).map((s) => s.id)),
  suggestions: new Map(),
};
const PORT = Number(process.env.PORT ?? 4173);

const json = (res: ServerResponse, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  res.end(text);
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

async function serveStatic(res: ServerResponse, path: string) {
  const file = path === '/' ? 'index.html' : path.slice(1);
  const full = join(WEB, file);
  if (!full.startsWith(WEB)) return json(res, 403, { error: 'forbidden' });
  try {
    const body = await readFile(full);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

function viewerFor(platform: Platform, url: URL): Viewer {
  const id = url.searchParams.get('viewer');
  return platform.viewers.find((v) => v.id === id) ?? platform.viewers[0];
}

function viewerName(platform: Platform, viewer: Viewer): string {
  const user = platform.fixture.users.find((u) => u.id === viewer.id);
  return user ? `${user.displayName} (${user.jobTitle})` : viewer.id;
}

const SOURCE_LABELS_HE: Record<string, string> = {
  entra: 'זהות העובדים',
  exchange: 'דואר העבודה',
  sharepoint: 'מסמכי המחלקה',
  sql: 'מערכות הפעלה',
};

const SERVICE_LABELS_HE: Record<string, string> = {
  LIC: 'רישוי עסק',
  FEE: 'הנחה באגרת תברואה',
  CMP: 'קריאות תברואה',
};

const RISK_HE: Record<string, string> = { low: 'נמוך', medium: 'בינוני', high: 'גבוה' };

const SUGGESTION_AUDIENCE: Record<string, string[]> = {
  workflow: ['head'],
  form: ['clerk', 'rule'],
  automation: ['head'],
  responsibility: [],
};

function viewerKind(platform: Platform, viewer: Viewer): 'head' | 'clerk' | 'field' | 'secretary' | 'rule' | 'steward' {
  const user = platform.fixture.users.find((u) => u.id === viewer.id);
  const title = `${user?.jobTitle ?? ''} ${user?.jobTitleEn ?? ''}`;
  if (/מנהל|מנהלת|head/i.test(title)) return 'head';
  if (/אחראית נתונים|data steward|steward/i.test(title)) return 'steward';
  if (/רכז גזברות|treasury|finance|rule owner/i.test(title)) return 'rule';
  if (/מפקח|מפקחת|מדביר|inspector/i.test(title)) return 'field';
  if (/מזכיר|secretary/i.test(title)) return 'secretary';
  return 'clerk';
}

function suggestionAudience(kind: string): string[] {
  return SUGGESTION_AUDIENCE[kind] ?? [];
}

const PROPERTY_LABELS_HE: Record<string, string> = {
  income_band: 'הכנסה',
  inspection_zone: 'אזור פיקוח',
  preferredLanguage: 'שפת דיוור',
  officeLocation: 'מיקום משרד',
};

/** The same permission check the document library uses, so search cannot leak. */
function canReadDocument(platform: Platform, viewer: Viewer, itemId: string): boolean {
  const permissions = platform.fixture.permissions[itemId] ?? [];
  if (!permissions.length) return true;
  const viewerUser = platform.fixture.users.find((u) => u.id === viewer.id);
  const viewerGroups = viewerUser?.groupIds ?? [];
  return permissions.some((perm) => {
    const userId = perm.grantedToV2?.user?.id;
    const groupId = perm.grantedToV2?.group?.id;
    return Boolean((userId && userId === viewer.id) || (groupId && viewerGroups.includes(groupId)));
  });
}

/** A source that is on has run its research, whichever screen asks first. */
function refreshResearch(platform: Platform, viewer: Viewer): void {
  for (const id of connectors.enabled) {
    for (const suggestion of research(id as SourceId, {
      graph: platform.graph,
      ontology: platform.ontology,
      org: platform.org,
      models: platform.models,
      proposals: platform.proposals,
      capturedAt: captureTime,
      actor: viewerName(platform, viewer),
    })) {
      if (!connectors.suggestions.has(suggestion.id)) connectors.suggestions.set(suggestion.id, suggestion);
    }
  }
}

/** The raw evidence behind a page, so a demo can show the source, not the conclusion. */
function evidenceOf(platform: Platform, pageRef: string, property?: string) {
  const facts = platform.graph.currentFacts(pageRef);
  const fact = property ? facts.find((f) => f.property === property) : facts[0];
  if (!fact) return null;
  const evidence = fact?.evidenceIds.map((id) => platform.graph.evidence.get(id)).find(Boolean);
  if (!evidence) return null;
  return {
    system: evidence.sourceSystem,
    locator: Object.entries(evidence.locator).map(([k, v]) => `${k}=${v}`).join(' · '),
    excerpt: evidence.excerpt.slice(0, 220),
  };
}

function buildTour(platform: Platform) {
  const g = platform.graph;
  const households = g.ofType('household');
  const missing = households.filter((h) => !h.properties.income_band).slice(0, 2);
  const senior = g.ofType('resident').find((r) => {
    const birth = String(r.properties.birth_date ?? '');
    return birth && 2026 - Number(birth.slice(0, 4)) >= 67;
  });
  // The absence of a value is itself the evidence: no fact exists for income_band.
  const missingEvidence = missing.length
    ? evidenceOf(platform, missing[0].ref, 'income_band') ?? {
        system: 'Azure SQL · dbo.households',
        locator: `dbo.households#${missing[0].title}`,
        excerpt: 'income_band = NULL — אין ערך רשום',
      }
    : null;
  const seniorEvidence = senior ? evidenceOf(platform, senior.ref, 'birth_date') : null;
  const messages = g.ofType('message')
    .filter((m) => /הנחה|רישיון|פיקוח|מסמכים/.test(String(m.properties.subject)))
    .slice(0, 3)
    .map((m) => ({ subject: m.properties.subject, from: m.properties.from_address, received: String(m.properties.received_at).slice(0, 10) }));
  const responsibilities = platform.org.responsibilities.filter((r) => r.signal === 'mail').slice(0, 3);
  const person = platform.graph.ofType('person').find((p) => /רכז|coordinator|רכזת/i.test(String(p.properties.job_title ?? '')))
    ?? platform.graph.ofType('person')[0];
  const personEvidence = person ? evidenceOf(platform, person.ref, 'job_title') : null;
  const unitCounts = platform.org.units.map((u) => `${u.name} (${u.headcount})`);
  const openGap = platform.graph.ofType('knowledge_candidate')
    .find((p) => String(p.properties.proposed_by).includes('eligibility') && String(p.properties.candidate_kind) === 'property');
  const document = platform.report.documents.find((d) => /הנחה|תעריף/.test(d.name));
  const form = generateForm(platform.ontology, 'household', 'application', { only: ['household_size', 'income_band', 'discount_status'] });
  const answer = platform.answer;

  return {
    scenarios: [
      {
        id: 'eligibility',
        titleHe: 'כמה משקי בית זכאים להנחה',
        promiseHe: 'שאלה אחת, ותשובה שאפשר לעמוד מאחוריה.',
        steps: [
          {
            kind: 'source',
            system: 'Azure SQL · dbo.households',
            locator: missingEvidence?.locator ?? 'dbo.households',
            excerpt: missingEvidence?.excerpt ?? 'income_band = NULL',
            didHe: 'המערכת קראה את טבלת משקי הבית. אין צורך שאף אחד יפיק קובץ או יבנה אקסל.',
            savedHe: 'לא נשלחה פנייה לגזברות ולא נבנה אקסל.',
          },
          {
            kind: 'source',
            system: 'Azure SQL · dbo.residents',
            locator: seniorEvidence?.locator ?? 'dbo.residents',
            excerpt: seniorEvidence?.excerpt ?? 'birth_date',
            didHe: `שדה תאריך הלידה הופך לגיל מול תאריך הייחוס. ${senior ? 'אחד התושבים עובר את גיל 67 ולכן משק הבית זכאי.' : ''}`,
            savedHe: 'לא חושב גיל ידנית ולא נבדק תיק אחר תיק.',
          },
          {
            kind: 'result',
            titleHe: 'התשובה, עם הכלל שמאחוריה',
            counts: answer.counts,
            rule: answer.rule,
            unknown: answer.unknownReasons,
          },
        ],
      },
      {
        id: 'mail',
        titleHe: 'מה למדנו מדואר העבודה',
        promiseHe: 'הדואר לא נכתב בשבילנו, אבל הוא מספר מי עושה מה.',
        steps: [
          {
            kind: 'sources',
            system: 'Exchange Online',
            items: messages,
            didHe: 'המערכת קראה הודעות אמיתיות של המחלקה: מי כתב, על מה, ומתי.',
            savedHe: 'לא נשאל איש "מי מטפל בזה".',
          },
          {
            kind: 'inference',
            titleHe: 'מה נגזר מהן',
            items: responsibilities.map((r) => ({ name: platform.org.people.find((p) => p.ref === r.personRef)?.name ?? '', summary: r.summary })),
            didHe: 'כל אחריות היא הצעה עם מספר האירועים שמאחוריה — לא קביעה.',
            savedHe: 'לא נכתב מסמך תפקידים ולא התקיים דיון.',
          },
          {
            kind: 'action',
            titleHe: 'מה האדם עושה',
            textHe: 'מאשר את האחריויות בקליק אחד. מרגע האישור הן הופכות לבסיס לניתוב ולשאלות.',
            action: { type: 'approve-responsibility', labelHe: 'אשר את האחריויות' },
          },
        ],
      },
      {
        id: 'people',
        titleHe: 'מי עובד כאן ומי אחראי',
        promiseHe: 'מבנה הארגון מגיע מהמערכת, לא משאל.',
        steps: [
          {
            kind: 'source',
            system: 'Microsoft Entra ID · /users',
            locator: personEvidence?.locator ?? '/users',
            excerpt: personEvidence?.excerpt ?? 'job_title',
            didHe: 'המערכת קראה את העובדים, התפקידים וקווי הדיווח מהמערכת הארגונית.',
            savedHe: 'לא רואיינה אף אחת מהיחידות ולא עודכן ארגון ידני.',
          },
          {
            kind: 'inference',
            titleHe: 'היחידות שנגזרו',
            items: unitCounts.map((label) => ({ name: label, summary: 'אנשים שמשויכים ליחידה' })),
            didHe: 'השיוך ליחידה נגזר מהשדה הארגוני בכל רשומת עובד.',
            savedHe: 'לא נבנה ארגון מחדש בתרשים.',
          },
          {
            kind: 'action',
            titleHe: 'מה האדם עושה',
            textHe: 'מאשר הצעת טופס קליטה שנוצרה מהמודל — או דוחה אותה.',
            action: { type: 'approve-responsibility', labelHe: 'אשר את האחריויות' },
          },
        ],
      },
      {
        id: 'interview',
        titleHe: 'איך סוגרים פער בלי פגישה',
        promiseHe: 'שלוש שאלות, עם הניחוש המוכן מראש.',
        steps: [
          {
            kind: 'source',
            system: 'פער שזוהה מהתשובה',
            locator: openGap?.title ?? '',
            excerpt: String(openGap?.properties.evidence_summary ?? ''),
            didHe: 'המערכת זיהתה שהפער חוסם החלטות, ומצאה מי מחזיק את הנתון לפי מפת הארגון.',
            savedHe: 'לא נקבעה פגישה ולא נשלח מייל "מי יודע?".',
          },
          {
            kind: 'inference',
            titleHe: 'השאלות שנשלחו',
            items: [
              { name: 'איפה נשמר הנתון?', summary: 'ניחוש מוכן: גזברות' },
              { name: 'מה לעשות כשהערך חסר?', summary: 'ניחוש מוכן: להשאיר לא ידוע' },
              { name: 'מי יכול לספק אותו?', summary: 'נבחר מרשימת האחראים' },
            ],
            didHe: 'השאלות נגזרו מהפער, לא מתבנית שיחה כללית.',
            savedHe: 'לא ניסחו שאלות ולא נבחרו נמענים.',
          },
          {
            kind: 'action',
            titleHe: 'התשובה משנה משהו',
            textHe: 'התשובה נשמרת כראיה. סתירה לכלל יוצרת הצעה עם מספרי מה-יקרה-אם — והבעלים מאשר.',
            action: { type: 'interview', labelHe: 'פתח וענה כמו משה' },
          },
        ],
      },
      {
        id: 'form',
        titleHe: 'טופס מתוך המודל',
        promiseHe: 'לא כותבים טופס. מגזירים אותו מהמודל.',
        steps: [
          {
            kind: 'source',
            system: 'SharePoint · מסמכי המחלקה',
            locator: document?.ref ?? '',
            excerpt: document ? `${document.name} · ${document.label}` : '',
            didHe: 'הנוהל והתעריף הם המקור לשדות שנדרשים מבקש.',
            savedHe: 'לא נשלחה ספציפיקציה למפתחים.',
          },
          {
            kind: 'fields',
            titleHe: 'השדות שנגזרו מהמודל',
            items: form.fields.map((f) => ({ label: f.labelHe, rule: f.widget === 'select' ? `בחירה: ${f.options.join(' / ')}` : f.widget })),
            didHe: 'אותו מקור משמש גם ליצירת הטופס וגם לבדיקת התקינות. לכן הם לא יכולים לסתור זה את זה.',
            savedHe: 'לא תוחזק טופס נפרד מהחוקים שלו.',
          },
          {
            kind: 'action',
            titleHe: 'ממלאים ומגישים',
            textHe: 'המילוי נשמר על משק הבית עם מקור וזהות המגיש.',
            action: { type: 'fill-form', labelHe: 'צור טופס ומלא דוגמה' },
          },
        ],
      },
    ],
  };
}

/** A real ingestion run, stage by stage, with the counts and first records it landed. */
function buildReplay(platform: Platform) {
  const g = platform.graph;
  const sample = (type: string, property: string) => {
    const page = g.ofType(type)[0];
    if (!page) return null;
    const facts = g.currentFacts(page.ref);
    const fact = facts.find((f) => f.property === property) ?? facts[0];
    const evidence = fact?.evidenceIds.map((id) => g.evidence.get(id)).find(Boolean);
    return { ref: page.title, excerpt: String(evidence?.excerpt ?? fact?.value ?? '').slice(0, 140) };
  };
  const count = (type: string) => g.ofType(type).length;
  return [
    {
      id: 'entra', system: 'Microsoft Entra ID', titleHe: 'זהות העובדים',
      unit: 'עובדים', count: count('person'),
      samples: [sample('person', 'display_name'), sample('group', 'display_name')].filter(Boolean),
      didHe: 'נקראו העובדים, התפקידים וקווי הדיווח. נגזרו יחידות וקווי דיווח.',
    },
    {
      id: 'sql', system: 'Azure SQL', titleHe: 'מערכות הפעלה',
      unit: 'רשומות', count: count('resident') + count('household') + count('property') + count('business') + count('case') + count('case_event'),
      samples: [sample('resident', 'birth_date'), sample('case', 'service_code')].filter(Boolean),
      didHe: 'כל רשומה הפכה לדף במודל עם ערך, מקור ומיקום מדויק.',
    },
    {
      id: 'exchange', system: 'Exchange Online', titleHe: 'דואר העבודה',
      unit: 'הודעות', count: count('message'),
      samples: [sample('message', 'subject')].filter(Boolean),
      didHe: 'ההודעות נקראו לפי משתתפים. מכאן נגזרו אחריויות כהצעות בלבד.',
    },
    {
      id: 'sharepoint', system: 'SharePoint / OneDrive', titleHe: 'מסמכי המחלקה',
      unit: 'מסמכים', count: count('document'),
      samples: [sample('document', 'name')].filter(Boolean),
      didHe: 'המסמכים נרשמו עם תווית הרגישות והרשאות המקור שלהם.',
    },
  ];
}

function caseSummary(platform: Platform, caseId: string) {
  const graph = platform.graph;
  const page = graph.page(refFor('case', caseId));
  if (!page || page.type !== 'case') return null;
  const events = graph.edges
    .filter((edge) => edge.kind === 'event_of' && edge.to === page.ref)
    .map((edge) => graph.page(edge.from))
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((a, b) => Date.parse(String(b.properties.occurred_at ?? '')) - Date.parse(String(a.properties.occurred_at ?? '')));
  const latest = events[0];
  const subjectRef = String(page.properties.subject_ref ?? '');
  const subject =
    graph.page(refFor('business', subjectRef)) ??
    graph.page(refFor('resident', subjectRef)) ??
    graph.page(refFor('property', subjectRef));
  return {
    ref: page.ref,
    title: page.title,
    status: String(page.properties.status ?? ''),
    service: String(page.properties.service_code ?? ''),
    serviceLabel: SERVICE_LABELS_HE[String(page.properties.service_code ?? '')] ?? String(page.properties.service_code ?? ''),
    openedAt: page.properties.opened_at ?? null,
    closedAt: page.properties.closed_at ?? null,
    stage: String(latest?.properties.activity ?? ''),
    stageLabel: ACTIVITY_LABELS[String(latest?.properties.activity ?? '')] ?? String(latest?.properties.activity ?? ''),
    lastEventAt: latest?.properties.occurred_at ?? null,
    subjectRef,
    subjectName: subject?.title ?? subjectRef,
  };
}

function assist(platform: Platform, question: string) {
  const keywords = ['פיקוח', 'רישיון', 'הנחה', 'קריאה', 'תעריף', 'ביקורת', 'מסמכים', 'בקשות'];
  const caseId = /\b(CASE-\d+)/i.exec(question)?.[1];
  if (caseId) {
    const summary = caseSummary(platform, caseId);
    if (summary) {
      return {
        kind: 'case' as const,
        headline: `סטטוס תיק ${caseId}`,
        case: summary,
        hint: 'הנתונים נקראו מיומן התיק ומהמערכות שמזינות אותו.',
      };
    }
  }
  if (/(^|\s)(מי|who|אחראי|מטפל)/i.test(question)) {
    const key = keywords.find((word) => question.includes(word)) ?? '';
    return {
      kind: 'people' as const,
      headline: key ? `מי מטפל ב${key}?` : 'מי אחראי על זה?',
      people: whoHandles(platform.org, key),
      hint: 'אחריויות שזוהו מהעבודה עצמה. כל אחת נושאת את מספר האירועים שמאחוריה.',
    };
  }
  if (/(למה|כמה זמן|מחכים|צוואר|why|how long)/i.test(question)) {
    const model = platform.models.find((m) => m.serviceCode === 'LIC') ?? platform.models[0];
    if (model) {
      return {
        kind: 'process' as const,
        headline: `למה ${SERVICE_LABELS_HE[model.serviceCode] ?? model.serviceName} ממתין`,
        detail: `חציון ${model.medianTotalDays} יום לתיק, ${model.caseCount} תיקים.`,
        steps: model.steps.slice(0, 3).map((step) => ({ label: step.labels, days: step.medianWaitDays, role: step.role })),
        hint: 'הזמן נמדד בין אירועי התיק, לא הוערך.',
      };
    }
  }
  return null;
}

const DAY_MS = 86_400_000;

/** The department's case queue, computed from the event log rather than a status table. */
function buildCasesOverview(platform: Platform, viewer: Viewer) {
  const graph = platform.graph;
  const viewerUser = platform.fixture.users.find((u) => u.id === viewer.id);
  const viewerTitle = String(viewerUser?.jobTitle ?? '');
  const myPersonRef = refFor('person', viewer.id);
  const openCases: {
    ref: string;
    title: string;
    service: string;
    serviceLabel: string;
    stage: string;
    stageLabel: string;
    stageRole: string;
    openedAt: string;
    ageDays: number;
    overdue: boolean;
    subjectRef: string;
    subjectName: string;
  }[] = [];
  const stageCounts = new Map<string, number>();
  let closed = 0;
  let total = 0;

  const roleFor = (service: string, activity: string) =>
    platform.models.find((model) => model.serviceCode === service)?.steps.find((step) => step.activity === activity)?.role ?? '';

  for (const page of graph.ofType('case')) {
    total++;
    const status = String(page.properties.status ?? '');
    if (status !== 'OPEN') {
      closed++;
      continue;
    }
    const service = String(page.properties.service_code ?? '');
    const openedAt = String(page.properties.opened_at ?? '');
    const events = graph.edges
      .filter((edge) => edge.kind === 'event_of' && edge.to === page.ref)
      .map((edge) => graph.page(edge.from))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .sort((a, b) => Date.parse(String(b.properties.occurred_at ?? '')) - Date.parse(String(a.properties.occurred_at ?? '')));
    const stage = String(events[0]?.properties.activity ?? '');
    const subjectRef = String(page.properties.subject_ref ?? '');
    const subject =
      graph.page(refFor('business', subjectRef)) ??
      graph.page(refFor('resident', subjectRef)) ??
      graph.page(refFor('property', subjectRef));
    const openedMs = Date.parse(openedAt);
    const ageDays = Number.isFinite(openedMs) ? Math.max(0, Math.floor((Date.parse(captureTime) - openedMs) / DAY_MS)) : 0;
    const sla = SERVICES.find((entry) => entry.code === service)?.sla_days ?? 30;
    const stageLabel = ACTIVITY_LABELS[stage] ?? stage;
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    openCases.push({
      ref: page.ref,
      title: page.title,
      service,
      serviceLabel: SERVICES.find((entry) => entry.code === service)?.name_he ?? service,
      stage,
      stageLabel,
      stageRole: roleFor(service, stage),
      openedAt,
      ageDays,
      overdue: ageDays > sla,
      subjectRef,
      subjectName: subject?.title ?? subjectRef,
    });
  }

  let inspectionsDone = 0;
  for (const event of graph.ofType('case_event')) {
    const activity = String(event.properties.activity ?? '');
    if (!['INSPECTION_DONE', 'REINSPECTION'].includes(activity)) continue;
    if (graph.out('event_actor', event.ref)[0]?.to === myPersonRef) inspectionsDone++;
  }

  const openInspections = openCases.filter((entry) => ['INSPECTION_SCHEDULED', 'REINSPECTION'].includes(entry.stage));
  const myCases = openCases.filter(
    (entry) =>
      (entry.stageRole && viewerTitle && entry.stageRole.includes(viewerTitle)) ||
      (/רכזת רישוי/.test(viewerTitle) && entry.service === 'LIC'),
  );
  const sorted = [...openCases].sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.ageDays - a.ageDays);

  return {
    total,
    open: openCases.length,
    closed,
    overdue: openCases.filter((entry) => entry.overdue).length,
    slaDays: 30,
    stages: [...stageCounts.entries()]
      .map(([activity, count]) => ({ activity, label: ACTIVITY_LABELS[activity] ?? activity, count }))
      .sort((a, b) => b.count - a.count),
    openCases: sorted,
    myWork: {
      title: viewerTitle,
      inspectionsDone,
      openInspections,
      myCases,
    },
  };
}

function overview(platform: Platform, demo: Demo, viewer: Viewer) {
  const g = platform.graph;
  return {
    organization: {
      name: platform.organization,
      nameHe: platform.fixture.tenantName,
      profileId: platform.profileId,
      organizationId: platform.organizationId,
      domain: platform.fixture.domain,
      capturedAt: captureTime,
    },
    graph: g.stats(),
    ontology: ontologyStats(platform.ontology),
    sources: platform.report.sources,
    connections: CONNECTIONS,
    documents: platform.report.documents.length,
    schemaCandidates: platform.report.schemaCandidates.length,
    findings: platform.report.findings,
    problems: platform.report.problems,
    org: {
      units: platform.org.units.length,
      people: platform.org.people.length,
      responsibilities: platform.org.responsibilities.length,
      openResponsibilities: g
        .ofType('knowledge_candidate')
        .filter((p) => String(p.properties.candidate_kind) === 'responsibility' && String(p.properties.status) === 'open').length,
      confirmedResponsibilities: g
        .ofType('knowledge_candidate')
        .filter((p) => String(p.properties.candidate_kind) === 'responsibility' && String(p.properties.status) === 'accepted').length,
    },
    cases: buildCasesOverview(platform, viewer),
    decisions: g
      .ofType('decision')
      .map((p) => ({
        ref: p.ref,
        title: p.title,
        kind: p.properties.kind ?? null,
        decidedBy: p.properties.decided_by ?? null,
        decidedAt: p.properties.decided_at ?? null,
      }))
      .slice(-4)
      .reverse(),
    services: platform.models.map((m) => ({
      code: m.serviceCode,
      name: m.serviceName,
      nameHe: SERVICE_LABELS_HE[m.serviceCode] ?? m.serviceName,
      cases: m.caseCount,
      medianDays: m.medianTotalDays,
      bottleneck: m.bottleneck?.activity ?? null,
      bottleneckDays: m.bottleneck?.medianWaitDays ?? null,
      proposals: platform.proposals.filter((p) => p.serviceCode === m.serviceCode).length,
    })),
    secondOrganization: {
      name: demo.secondary.organization,
      profileId: demo.secondary.profileId,
      pages: demo.secondary.graph.pages.size,
    },
  };
}

function mappingView(platform: Platform) {
  return {
    mappings: MAPPINGS.map((m) => ({
      id: m.id,
      system: m.system,
      source: m.source,
      sourceKind: m.sourceKind,
      pageType: m.pageType,
      fields: m.fields,
      edges: m.edges ?? [],
      acceptance: m.acceptance ?? null,
      unmapped: m.unmapped ?? [],
      run: platform.report.mappings.find((r) => r.id === m.id) ?? null,
    })),
    coverage: platform.report.coverage,
    candidates: platform.report.schemaCandidates,
    sources: platform.report.sources,
  };
}

function processView(platform: Platform, code: string) {
  const model = platform.models.find((m) => m.serviceCode === code) ?? platform.models[0];
  const proposals = platform.proposals
    .filter((p) => p.serviceCode === model.serviceCode)
    .map((p) => ({
      ...p,
      status: String(platform.graph.page(p.ref ?? '')?.properties.status ?? 'proposed'),
    }));
  const modelPage = platform.graph.page(refFor('process_model', model.serviceCode));
  return {
    model: { ...model, status: String(modelPage?.properties.status ?? 'discovered') },
    proposals,
    params: PARAMS,
    automations: platform.graph
      .ofType('automation_proposal')
      .map((p) => ({
        ref: p.ref,
        title: p.title,
        kind: p.properties.proposal_kind,
        status: p.properties.status,
        approved_by: p.properties.approved_by ?? null,
      })),
  };
}

function orgView(platform: Platform) {
  const statusOf = (candidateRef: string) =>
    String(
      (platform.graph.page(candidateRef) ?? platform.graph.page(refFor('knowledge_candidate', candidateRef)))?.properties.status ?? 'open',
    );
  const responsibilities = platform.org.responsibilities.map((r) => ({ ...r, status: statusOf(r.candidateRef) }));
  return {
    viewers: platform.viewers.map((v) => ({ ...v, label: viewerName(platform, v) })),
    units: platform.org.units,
    people: platform.org.people.map((p) => ({
      ...p,
      responsibilities: responsibilities.filter((r) => r.personRef === p.ref),
    })),
    responsibilities,
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, demo: Demo, url: URL, parts: string[]) {
  const platform = demo.primary;
  const viewer = viewerFor(platform, url);

  if (parts[1] === 'overview') return json(res, 200, overview(platform, demo, viewer));
  if (parts[1] === 'connections') return json(res, 200, { connections: CONNECTIONS });
  if (parts[1] === 'ontology') {
    return json(res, 200, {
      ...publicView(platform.ontology),
      coverage: platform.report.coverage,
      stats: ontologyStats(platform.ontology),
    });
  }
  if (parts[1] === 'mapping') return json(res, 200, mappingView(platform));
  if (parts[1] === 'viewers') {
    return json(res, 200, {
      viewers: platform.viewers.map((v) => ({ ...v, label: viewerName(platform, v) })),
    });
  }
  if (parts[1] === 'org') return json(res, 200, orgView(platform));
  if (parts[1] === 'process') {
    if (req.method === 'POST' && parts[3] === 'validate') {
      const code = decodeURIComponent(parts[2] ?? '');
      const model = platform.models.find((entry) => entry.serviceCode === code);
      if (!model) return json(res, 404, { error: 'no such process' });
      const modelRef = refFor('process_model', code);
      const modelPage = platform.graph.page(modelRef);
      if (!modelPage) return json(res, 404, { error: 'no process page' });
      const at = new Date().toISOString();
      const actor = viewerName(platform, viewer);
      const provenance = {
        kind: 'recorded' as const,
        source: 'process validation',
        method: 'person decision',
        as_of: at,
        evidence_class: 'asserted' as const,
        confirmed_by_role: actor,
      };
      platform.graph.setProperty({
        pageRef: modelRef,
        property: 'status',
        value: 'validated',
        status: 'confirmed',
        provenance,
        evidenceIds: [],
      });
      const decisionRef = refFor('decision', 'validate-' + code);
      if (!platform.graph.page(decisionRef)) {
        platform.graph.addPage({
          ref: decisionRef,
          type: 'decision',
          title: `אושר התהליך — ${SERVICE_LABELS_HE[code] ?? model.serviceName}`,
          properties: {},
          createdAt: at,
        });
        for (const [property, value] of Object.entries({
          decision_id: decisionRef,
          kind: 'process_validated',
          status: 'approved',
          decided_at: at,
          decided_by: actor,
          rationale: 'התהליך שאותר מהלוג אושר כמתאר את העבודה בפועל.',
          subject_ref: modelRef,
        })) {
          platform.graph.setProperty({ pageRef: decisionRef, property, value, status: 'confirmed', provenance, evidenceIds: [] });
        }
        platform.graph.addEdge({ kind: 'approves', from: decisionRef, to: modelRef });
      }
      return json(res, 200, { ok: true, status: 'validated', decision: decisionRef });
    }
    return json(res, 200, processView(platform, url.searchParams.get('service') ?? 'LIC'));
  }
  if (parts[1] === 'automations') {
    if (req.method === 'POST' && parts[2]) {
      const ref = decodeURIComponent(parts[2]);
      const result = approveAutomation(platform.graph, ref, viewerName(platform, viewer), new Date().toISOString());
      if (!result) return json(res, 404, { error: 'no such proposal' });
      return json(res, 200, { ok: true, decision: result.decisionRef, status: 'approved' });
    }
    return json(res, 200, processView(platform, platform.models[0].serviceCode));
  }
  if (parts[1] === 'pages') {
    const type = url.searchParams.get('type') ?? 'document';
    const pages = platform.graph.ofType(type).map((p) => platform.graph.view(viewer, p.ref));
    return json(res, 200, { viewer: viewerName(platform, viewer), pages });
  }
  if (parts[1] === 'page') {
    const ref = url.searchParams.get('ref') ?? '';
    const view = platform.graph.view(viewer, ref);
    if (!view) return json(res, 404, { error: 'not found', ref });
    return json(res, 200, view);
  }
  if (parts[1] === 'search') {
    return json(res, 200, { query: url.searchParams.get('q') ?? '', results: whoHandles(platform.org, url.searchParams.get('q') ?? '') });
  }
  if (parts[1] === 'template') return json(res, 200, platform.template);
  if (parts[1] === 'onboard') {
    return json(res, 200, {
      diff: demo.diff,
      template: demo.primary.template,
      second: {
        organization: demo.secondary.organization,
        stats: demo.secondary.graph.stats(),
        models: demo.secondary.models.map((m) => ({ code: m.serviceCode, cases: m.caseCount, medianDays: m.medianTotalDays, variants: m.variants.length })),
      },
    });
  }
  if (parts[1] === 'answer') return json(res, 200, platform.answer);
  if (parts[1] === 'rules') {
    return json(res, 200, {
      reference_date: REFERENCE_DATE,
      suppression: SUPPRESSION,
      rules: RULES.map((rule) => ({
        ...rule,
        in_force:
          rule.status === 'approved' &&
          rule.effective_from <= REFERENCE_DATE &&
          (!rule.effective_to || rule.effective_to >= REFERENCE_DATE),
      })),
      suggested: [
        'How many households are eligible for the sanitation fee discount?',
        'How many businesses are there?',
        'How many residents are there?',
      ],
    });
  }
  if (parts[1] === 'ask') {
    const body = await readBody(req);
    const question = String(body.question ?? '').trim();
    const answer = answerQuestion(platform.graph, question, {
      capturedAt: captureTime,
      sources: platform.report.sources.map((s) => ({ system: s.system, label: s.label })),
    });
    // A data question the catalogue cannot answer may still be answerable from
    // the org map or the discovered process — the assistant routes, it does not guess.
    const assistant = answer.refused ? assist(platform, question) : null;
    return json(res, 200, { ...answer, assistant });
  }
  if (parts[1] === 'connectors') {
    if (req.method === 'POST' && parts[3] === 'toggle') {
      const body = await readBody(req);
      const id = decodeURIComponent(parts[2]) as SourceId;
      if (!SOURCES.some((s) => s.id === id)) return json(res, 404, { error: 'unknown source' });
      if (body.enabled) connectors.enabled.add(id); else connectors.enabled.delete(id);
    }
    refreshResearch(platform, viewer);
    return json(res, 200, {
      sources: SOURCES.map((source) => ({
        ...source,
        enabled: connectors.enabled.has(source.id),
        suggestions: [...connectors.suggestions.values()]
          .filter((s) => s.source === source.id && s.action.type !== 'approve_automation')
          .map((s) => ({
            ...s,
            audience: suggestionAudience(s.kind),
            covered:
              s.action.type === 'validate_process' &&
              String(platform.graph.page(refFor('process_model', s.action.processCode))?.properties.status ?? '') === 'validated',
          })),
      })),
      forms: platform.graph.ofType('form_definition').map((p) => ({
        ref: p.ref, name: p.title, page_type: p.properties.page_type,
        kind: p.properties.kind, field_count: p.properties.field_count, status: p.properties.status,
        fields: p.properties.fields ?? [],
      })),
    });
  }
  if (parts[1] === 'suggestions' && parts[3] === 'approve') {
    const id = decodeURIComponent(parts[2]);
    const suggestion = connectors.suggestions.get(id);
    if (!suggestion) return json(res, 404, { error: 'unknown suggestion' });
    if (suggestion.status === 'approved') return json(res, 200, { suggestion });
    const artifact = approveSuggestion(suggestion, {
      graph: platform.graph, ontology: platform.ontology, org: platform.org,
      models: platform.models, proposals: platform.proposals,
      capturedAt: captureTime, actor: viewerName(platform, viewer),
    });
    suggestion.status = 'approved';
    suggestion.artifact = artifact;
    return json(res, 200, { suggestion });
  }
  if (parts[1] === 'outlook') {
    if (!connectors.enabled.has('exchange')) {
      return json(res, 200, {
        connected: false,
        source: 'exchange',
        viewer: viewerName(platform, viewer),
        shared: true,
        mailbox: null,
        messages: [],
      });
    }
    const messages = platform.fixture.messages.map((m) => ({
      graphRef: refFor('message', m.id),
      id: m.id,
      subject: m.subject,
      from: m.from.emailAddress.name,
      fromAddress: m.from.emailAddress.address,
      to: m.toRecipients.map((r) => r.emailAddress.name),
      received: m.receivedDateTime,
      label: m.sensitivityLabel.name,
      body: m.body.content,
    }));
    return json(res, 200, {
      connected: true,
      source: 'exchange',
      shared: true,
      mailbox: 'תיבת דואר משותפת · תברואה ובריאות',
      viewer: viewerName(platform, viewer),
      messages,
    });
  }
  if (parts[1] === 'doclib') {
    if (!connectors.enabled.has('sharepoint')) {
      return json(res, 200, {
        connected: false,
        source: 'sharepoint',
        library: null,
        viewer: viewerName(platform, viewer),
        visible: 0,
        total: 0,
        documents: [],
      });
    }
    const drive = platform.fixture.drives[0];
    const documents = drive.items.filter((d) => canReadDocument(platform, viewer, d.id)).map((d) => ({
      graphRef: refFor('document', d.id),
      id: d.id,
      name: d.name,
      modified: d.lastModifiedDateTime,
      label: d.sensitivityLabel.name,
      size: d.size,
      webUrl: d.webUrl,
      pages: d.pageBreaks.length + 1,
      text: d.contentText.slice(0, 900),
    }));
    return json(res, 200, {
      connected: true,
      source: 'sharepoint',
      library: drive.name,
      webUrl: drive.webUrl,
      viewer: viewerName(platform, viewer),
      visible: documents.length,
      total: drive.items.length,
      documents,
    });
  }
  if (parts[1] === 'forms' && parts[2] === 'submit' && req.method === 'POST') {
    const body = await readBody(req);
    const type = String(body.type ?? 'household');
    const kind = (body.kind ?? 'application') as FormKind;
    const values = (body.values ?? {}) as Record<string, unknown>;
    const form = generateForm(platform.ontology, type, kind, { only: Object.keys(values) });
    const submission = validateSubmission(
      platform.ontology,
      form,
      { values, typed_by: viewerName(platform, viewer), prefilled: {} },
      captureTime,
    );
    if (submission.problems.length) return json(res, 400, { problems: submission.problems });
    const subject = String(body.subject ?? '');
    if (!platform.graph.page(subject)) return json(res, 400, { problems: ['no such subject record'] });
    for (const fact of submission.facts) {
      platform.graph.setProperty({
        pageRef: subject,
        property: fact.property,
        value: fact.value,
        status: fact.status,
        provenance: fact.provenance,
        evidenceIds: [],
      });
    }
    return json(res, 200, {
      written: submission.facts.length,
      subject,
      properties: Object.fromEntries(submission.facts.map((f) => [f.property, f.value])),
    });
  }
  if (parts[1] === 'find') {
    const query = String(url.searchParams.get('q') ?? '').trim();
    if (!query) return json(res, 200, { q: '', groups: [] });
    const lower = query.toLowerCase();
    // A source that is off cannot be searched either: the same rule as Systems.
    const messages = connectors.enabled.has('exchange')
      ? platform.fixture.messages
          .filter((m) => m.subject.includes(query) || m.body.content.includes(query))
          .slice(0, 6)
          .map((m) => ({ kind: 'הודעה', id: m.id, ref: refFor('message', m.id), title: m.subject, snippet: m.body.content.slice(0, 130), where: 'Exchange' }))
      : [];
    // Search must never be a side door around the source's access list.
    const readableDocuments = connectors.enabled.has('sharepoint')
      ? platform.fixture.drives[0].items.filter((d) => canReadDocument(platform, viewer, d.id))
      : [];
    const documents = readableDocuments
      .filter((d) => d.name.includes(query) || d.contentText.includes(query))
      .slice(0, 6)
      .map((d) => ({ kind: 'מסמך', id: d.id, ref: refFor('document', d.id), title: d.name, snippet: d.contentText.slice(0, 130), where: 'SharePoint' }));
    const pages = [...platform.graph.pages.values()]
      .filter((p) => p.title.includes(query) && p.type !== 'message' && p.type !== 'document')
      .filter((p) => Boolean(platform.graph.view(viewer, p.ref)))
      .slice(0, 8)
      .map((p) => ({ kind: 'רשומה', id: p.ref, ref: p.ref, title: p.title, snippet: p.type, where: 'גרף הידע' }));
    const rules = RULES
      .filter((r) => r.name_he.includes(query) || r.code.toLowerCase().includes(lower))
      .map((r) => ({ kind: 'כלל', id: `${r.code}-v${r.version}`, ref: refFor('eligibility_rule', `${r.code}-v${r.version}`), title: `${r.name_he} · גרסה ${r.version}`, snippet: r.citation, where: 'קטלוג כללים' }));
    return json(res, 200, {
      q: query,
      hiddenDocuments: connectors.enabled.has('sharepoint') ? platform.fixture.drives[0].items.length - readableDocuments.length : 0,
      groups: [
        { source: 'דואר', items: messages },
        { source: 'מסמכים', items: documents },
        { source: 'גרף הידע', items: pages },
        { source: 'כללים', items: rules },
      ].filter((g) => g.items.length),
    });
  }
  if (parts[1] === 'tour') return json(res, 200, buildTour(platform));
  if (parts[1] === 'approvals') {
    refreshResearch(platform, viewer);
    const kind = viewerKind(platform, viewer);
    const includeAll = url.searchParams.get('scope') === 'all';
    const openProposals = platform.proposals.filter(
      (p) => p.ref && String(platform.graph.page(p.ref)?.properties.status ?? '') !== 'approved',
    );
    const coveredAutomations = new Set(platform.proposals.map((p) => p.ref).filter(Boolean));
    // The sql source proposes "approve the top automation" while the automation
    // itself is already waiting. One decision, not two rows for the same thing.
    const suggestions = [...connectors.suggestions.values()]
      .filter((s) => s.status === 'new' && connectors.enabled.has(s.source))
      .filter((s) => !(s.action.type === 'approve_automation' && coveredAutomations.has(s.action.proposalRef)))
      .filter(
        (s) =>
          !(
            s.action.type === 'validate_process' &&
            String(platform.graph.page(refFor('process_model', s.action.processCode))?.properties.status ?? '') === 'validated'
          ),
      )
      .map((s) => ({
        kind: 'suggestion',
        id: s.id,
        subkind: s.kind,
        titleHe: s.titleHe,
        whyHe: s.whyHe,
        evidenceHe: s.evidenceHe,
        sourceHe: SOURCE_LABELS_HE[s.source] ?? s.source,
        metaHe: `הצעת מחקר · ${SOURCE_LABELS_HE[s.source] ?? s.source}`,
        impactHe: s.kind === 'form' ? 'טופס חדש' : s.kind === 'workflow' ? 'אישור תהליך' : s.kind === 'automation' ? 'אוטומציה' : 'אחריויות',
        audience: suggestionAudience(s.kind),
      }));

    const automations = openProposals.map((p) => ({
      kind: 'automation',
      audience: ['head'],
      id: p.ref!,
      titleHe: p.titleHe,
      whyHe: p.rationaleHe,
      evidenceHe: p.evidenceHe,
      impactHe: `${p.annualDaysSaved} ימי המתנה של תיקים בשנה`,
      metaHe: `${p.expectedCasesPerYear} מקרים בשנה · סיכון ${RISK_HE[p.risk] ?? p.risk} · ${SERVICE_LABELS_HE[p.serviceCode ?? ''] ?? ''}`,
      annualDaysSaved: p.annualDaysSaved,
      risk: p.risk,
      basisHe: p.basisHe,
      formulaHe: p.formulaHe,
      assumptionHe: p.assumptionHe,
      riskReasonHe: p.riskReasonHe,
      waitSamples: p.waitSamples,
      waitMedian: p.waitMedian,
      waitP90: p.waitP90,
      waitCount: p.waitCount,
      whatHappensHe:
        'האישור רושם החלטה ומסמן את האוטומציה כמאושרת. ב-POC אין מנוע הרצה המחובר לתור אמיתי, ולכן לא נשלחת הודעה בפועל; אין כתיבה חזרה למערכות המקור.',
    }));

    const openCandidates = platform.graph
      .ofType('knowledge_candidate')
      .filter((c) => String(c.properties.status) === 'open');
    const responsibilityCandidates = openCandidates.filter((c) => String(c.properties.candidate_kind) === 'responsibility');

    const gapCandidates = openCandidates.filter(
      (c) => String(c.properties.proposed_by ?? '').includes('eligibility') && String(c.properties.candidate_kind) === 'property',
    );
    const propertyCandidates = openCandidates.filter(
      (c) => String(c.properties.candidate_kind) === 'property' && !String(c.properties.proposed_by ?? '').includes('eligibility'),
    );

    const answer = platform.answer;
    const gaps = gapCandidates.map((c) => {
      const proposal = (c.properties.proposal ?? {}) as Record<string, unknown>;
      const property = String(proposal.property ?? '');
      const reason = answer.unknownReasons.find((r) => r.property === property);
      const blocked = Number(proposal.blocked_decisions ?? c.properties.support_count ?? 0);
      const labelHe = reason?.property_label_he ?? reason?.label_he ?? property;
      const openInterview = platform.graph
        .ofType('interview')
        .find((interview) => String(interview.properties.gap_ref) === c.ref && String(interview.properties.status) === 'open');
      const respondent = openInterview ? platform.graph.page(String(openInterview.properties.person_ref)) : null;
      // The sender may know a question is waiting; only the respondent can answer it.
      const interview = openInterview
        ? {
            ref: openInterview.ref,
            personName: respondent?.title ?? '',
            personRef: String(openInterview.properties.person_ref ?? ''),
            isMine: String(openInterview.properties.person_ref ?? '') === refFor('person', viewer.id),
          }
        : null;
      return {
        kind: 'gap',
        audience: ['clerk', 'rule'],
        id: String(c.properties.candidate_id ?? ''),
        ref: c.ref,
        titleHe: `פער מידע: ${labelHe}`,
        whyHe: `${blocked} מתוך ${answer.counts.total ?? 0} החלטות זכאות לא ניתנות להכרעה כי חסר ${labelHe}. אפשר לסגור את הפער בשאלה קצרה למי שמחזיק את הנתון.`,
        evidenceHe: [`חוסם ${blocked} החלטות`, `כלל ${String(proposal.rule ?? answer.rule?.code ?? '')}`],
        impactHe: `${blocked} החלטות חסומות`,
        metaHe: interview
          ? `ממתין לתשובה מ${interview.personName}`
          : 'פער פתוח · דורש אדם, לא אישור',
        blocked,
        interview,
      };
    });

    const properties = propertyCandidates.map((c) => {
      const proposal = (c.properties.proposal ?? {}) as Record<string, unknown>;
      const property = String(proposal.property ?? '');
      const labelHe = PROPERTY_LABELS_HE[property] ?? property;
      const pageTypes = (proposal.page_types as string[] | undefined) ?? [];
      const support = Number(c.properties.support_count ?? 0);
      return {
        kind: 'property',
        audience: ['steward'],
        id: String(c.properties.candidate_id ?? ''),
        field: property,
        titleHe: `מאפיין מוצע: ${labelHe}`,
        whyHe: `${labelHe} (${property}) מופיע ב-${support} רשומות ואין לו מקום באונטולוגיה. הוספה מאושרת נכנסת כשכבת הרחבה של העיר, לא כעריכת המודל המשותף.`,
        evidenceHe: [`${support} רשומות`, ...(pageTypes.length ? [`טיפוסים: ${pageTypes.join(', ')}`] : [])],
        impactHe: `${support} רשומות`,
        metaHe: 'שינוי מודל · מוסיף, לא משנה',
        support,
      };
    });

    // An interview can propose a rule change. It carries its what-if counts and
    // waits for the rule owner — it is not an overlay candidate we can accept.
    const ruleChanges = openCandidates
      .filter((c) => String(c.properties.candidate_kind) === 'eligibility_rule')
      .map((c) => {
        const proposal = (c.properties.proposal ?? {}) as Record<string, unknown>;
        const whatIf = (proposal.what_if ?? {}) as { eligible?: number; not_eligible?: number; unknown?: number };
        const property = String(proposal.property ?? '');
        const labelHe =
          answer.unknownReasons.find((r) => r.property === property)?.property_label_he ?? property;
        const target = String(proposal.to ?? 'unknown') === 'not_eligible' ? 'אינו זכאי' : 'לא ידוע';
        return {
          kind: 'rule',
          audience: ['rule'],
          id: String(c.properties.candidate_id ?? ''),
          titleHe: `שינוי כלל מוצע: חסר ${labelHe} → ${target}`,
          whyHe: `התשובה בשאלה מציעה לקבוע מה קורה כשחסר ${labelHe}. החלת השינוי תכריע ${answer.counts.unknown ?? 0} משקי בית שהיום אינם ניתנים להכרעה — אבל היא טעונה את אישור בעל הכלל.`,
          evidenceHe: [
            `מה יקרה אם: ${whatIf.eligible ?? 0} זכאים · ${whatIf.not_eligible ?? 0} לא זכאים · ${whatIf.unknown ?? 0} לא ידוע`,
          ],
          impactHe: `${answer.counts.unknown ?? 0} החלטות יוכרעו`,
          metaHe: 'שינוי כלל · ממתין לבעל הכלל',
          whatIf,
        };
      });

    const allPending = [...automations, ...suggestions, ...gaps, ...properties, ...ruleChanges];
    // scope=all is the landing count, not a directory of everyone's decisions.
    // It returns totals only; the item details stay with their owners.
    const pending = includeAll ? [] : allPending.filter((item) => item.audience?.includes(kind));
    const counted = includeAll ? allPending : pending;
    const countKind = (value: string) => counted.filter((item) => item.kind === value).length;
    return json(res, 200, {
      viewerKind: kind,
      scope: includeAll ? 'all' : 'mine',
      pending,
      counts: {
        total: counted.length,
        automations: countKind('automation'),
        suggestions: countKind('suggestion'),
        gaps: countKind('gap'),
        properties: countKind('property'),
        rules: countKind('rule'),
        responsibilities: responsibilityCandidates.length,
      },
      responsibilities: {
        count: responsibilityCandidates.length,
        people: new Set(responsibilityCandidates.map((c) => String(c.properties.subject_ref ?? ''))).size,
        note: 'אחריויות מאושרות על ידי האדם שהן מתארות, לא על ידי מנהל.',
      },
    });
  }
  if (parts[1] === 'replay') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const stages = buildReplay(platform);
    send('start', { stages: stages.length, organization: platform.organization });
    (async () => {
      for (const stage of stages) {
        await new Promise((r) => setTimeout(r, 700));
        send('stage', stage);
      }
      await new Promise((r) => setTimeout(r, 300));
      send('done', { pages: platform.graph.pages.size, facts: platform.graph.facts.length });
      res.end();
    })().catch(() => res.end());
    return;
  }
  if (parts[1] === 'learning') {
    const decisions = platform.graph.ofType('decision').map((p) => ({
      ref: p.ref, title: p.title, kind: p.properties.kind, status: p.properties.status,
      decided_by: p.properties.decided_by ?? null, decided_at: p.properties.decided_at ?? null,
      subject_ref: p.properties.subject_ref ?? null,
    }));
    const candidates = platform.graph.ofType('knowledge_candidate').map((p) => ({
      ref: p.ref, kind: p.properties.candidate_kind, status: p.properties.status,
      summary: p.properties.evidence_summary, support: p.properties.support_count,
      proposed_by: p.properties.proposed_by, proposal: p.properties.proposal,
    }));
    const forms = platform.graph.ofType('form_definition').map((p) => ({
      ref: p.ref, name: p.title, page_type: p.properties.page_type, kind: p.properties.kind,
      field_count: p.properties.field_count, status: p.properties.status,
    }));
    const queries = platform.graph.ofType('query_answer').map((p) => ({
      ref: p.ref, question: p.properties.question, rule_version: p.properties.rule_version,
      eligible: p.properties.eligible, not_eligible: p.properties.not_eligible, unknown: p.properties.unknown,
    }));
    return json(res, 200, {
      decisions, candidates, forms, queries,
      counts: {
        accepted: candidates.filter((c) => c.status === 'accepted').length,
        proposed: candidates.filter((c) => c.status === 'open').length,
        decisions: decisions.length,
        forms: forms.length,
      },
      ontology: { version: platform.ontology.version, packs: platform.ontology.packs, page_types: Object.keys(platform.ontology.pageTypes).length },
    });
  }
  if (parts[1] === 'forms') {
    const pageType = url.searchParams.get('type') ?? 'household';
    const kind = (url.searchParams.get('kind') ?? 'application') as FormKind;
    const only = url.searchParams.get('only')?.split(',').filter(Boolean);
    try {
      return json(res, 200, { form: generateForm(platform.ontology, pageType, kind, { only }) });
    } catch (err) {
      return json(res, 400, { error: String(err) });
    }
  }
  if (parts[1] === 'form-proposals') {
    const body = await readBody(req);
    const form = generateForm(platform.ontology, String(body.type ?? 'household'), 'application', { only: body.only as string[] | undefined });
    return json(res, 200, {
      proposals: proposeValues(platform.graph, form, (body.subject as string) ?? null, (body.typed as Record<string, unknown>) ?? {}),
    });
  }
  if (parts[1] === 'interviews') {
    const myPersonRef = refFor('person', viewer.id);
    const kind = viewerKind(platform, viewer);
    if (req.method === 'POST' && parts[2] === 'open') {
      // The coordinator owns the gap conversation. A manager or a rule owner
      // cannot send a question on her behalf.
      if (kind !== 'clerk') {
        return json(res, 403, { error: 'שליחת שאלה על פער היא של רכזת הרישוי, לא של התפקיד הזה.' });
      }
      const body = await readBody(req);
      const gapRef = String(body.gapRef ?? '');
      const result = openInterview(platform.graph, platform.org, gapRef, { capturedAt: captureTime });
      if (!result.interview) return json(res, 400, { ...result, attention: ATTENTION });
      const isMine = result.interview.personRef === myPersonRef;
      return json(res, 200, {
        ...result,
        sent: !isMine,
        interview: isMine ? result.interview : { ...result.interview, questions: [] },
        attention: ATTENTION,
      });
    }
    if (req.method === 'POST' && parts[2] === 'answer') {
      const body = await readBody(req);
      const ref = String(body.ref ?? '');
      const interview = platform.graph.page(ref);
      if (!interview || interview.type !== 'interview') return json(res, 404, { error: 'לא נמצאה שאלה.' });
      if (String(interview.properties.person_ref ?? '') !== myPersonRef) {
        const respondent = platform.graph.page(String(interview.properties.person_ref ?? ''));
        return json(res, 403, {
          error: `השאלה מיועדת ל${respondent?.title ?? 'אדם אחר'}; רק האדם שאליו נשלחה יכול לענות.`,
        });
      }
      const result = answerInterview(
        platform.graph,
        ref,
        (body.answers ?? {}) as Record<string, string>,
        viewerName(platform, viewer),
        captureTime,
        { policyOwner: viewerKind(platform, viewer) === 'rule' },
      );
      return json(res, result.interview ? 200 : 400, result);
    }
    const gapAudience = kind === 'clerk' || kind === 'rule';
    const gaps = (gapAudience ? platform.graph.ofType('knowledge_candidate') : [])
      .filter((p) => String(p.properties.status) === 'open' && String(p.properties.candidate_kind) === 'property')
      .map((p) => ({
        ref: p.ref,
        summary: p.properties.evidence_summary,
        support: p.properties.support_count,
        proposal: p.properties.proposal,
        proposed_by: p.properties.proposed_by,
      }))
      // A gap that blocks a real decision outranks a column nobody asked about.
      .sort((a, b) => {
        const weight = (gap: { proposed_by: unknown }) => (String(gap.proposed_by).includes('eligibility') ? 1 : 0);
        return weight(b) - weight(a) || Number(b.support) - Number(a.support);
      });
    const interviews = listInterviews(platform.graph).filter((interview) => interview.personRef === myPersonRef);
    return json(res, 200, { viewerKind: kind, interviews, gaps, attention: ATTENTION });
  }
  if (parts[1] === 'security') {
    const labelCounts: Record<string, number> = {};
    for (const doc of platform.report.documents) labelCounts[doc.label] = (labelCounts[doc.label] ?? 0) + 1;
    const documents = platform.graph.ofType('document').map((page) => {
      const view = platform.graph.view(viewer, page.ref);
      return {
        ref: page.ref,
        name: page.title,
        label: String(page.properties.sensitivity_label ?? ''),
        facts: view?.facts.length ?? 0,
        hiddenFactCount: view?.hiddenFactCount ?? 0,
        visible: Boolean(view?.facts.length),
        flags: platform.report.documents.find((d) => d.ref === page.ref)?.flags ?? 0,
      };
    });
    // A finding quoted from a document the asker cannot see is itself a leak.
    const visibleNames = new Set(documents.filter((d) => d.visible).map((d) => d.name));
    return json(res, 200, {
      findings: platform.report.findings.filter((f) => visibleNames.has(f.document)),
      findingsWithheld: platform.report.findings.filter((f) => !visibleNames.has(f.document)).length,
      documents,
      labelCounts,
      viewer: viewerName(platform, viewer),
      exampleHidden: documents.filter((d) => !d.visible),
    });
  }
  if (parts[1] === 'responsibilities' && parts[2] && parts[3] === 'confirm') {
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
    const candidateRef = decodeURIComponent(parts[2]);
    const page = platform.graph.page(candidateRef) ?? platform.graph.page(refFor('knowledge_candidate', candidateRef));
    if (!page || page.type !== 'knowledge_candidate' || String(page.properties.candidate_kind) !== 'responsibility') {
      return json(res, 404, { error: 'no such responsibility' });
    }
    const pageRef = page.ref;
    const body = await readBody(req);
    const accept = body.accept !== false;
    const status = accept ? 'accepted' : 'rejected';
    const at = new Date().toISOString();
    const actor = viewerName(platform, viewer);
    for (const [property, value] of Object.entries({ status, reviewed_at: at, reviewed_by: actor })) {
      platform.graph.setProperty({
        pageRef,
        property,
        value,
        status: 'confirmed',
        provenance: {
          kind: 'recorded',
          source: 'responsibility review',
          method: 'person decision',
          as_of: at,
          evidence_class: 'asserted',
          confirmed_by_role: actor,
        },
        evidenceIds: [],
      });
    }
    const decisionRef = refFor('decision', 'resp-' + pageRef.replace(/[^a-z0-9]/gi, '-'));
    if (!platform.graph.page(decisionRef)) {
      platform.graph.addPage({
        ref: decisionRef,
        type: 'decision',
        title: `${accept ? 'אושרה' : 'נדחתה'} אחריות — ${page.title}`,
        properties: {},
        createdAt: at,
      });
      for (const [property, value] of Object.entries({
        decision_id: decisionRef,
        kind: accept ? 'responsibility_confirmed' : 'responsibility_rejected',
        status: 'approved',
        decided_at: at,
        decided_by: actor,
        rationale: accept
          ? 'האדם שהאחריות מתארת אישר שהיא מדויקת.'
          : 'האדם שהאחריות מתארת אמר שהיא אינה מדויקת.',
        subject_ref: pageRef,
      })) {
        platform.graph.setProperty({
          pageRef: decisionRef,
          property,
          value,
          status: 'confirmed',
          provenance: {
            kind: 'recorded',
            source: 'responsibility review',
            method: 'person decision',
            as_of: at,
            evidence_class: 'asserted',
            confirmed_by_role: actor,
          },
          evidenceIds: [],
        });
      }
      platform.graph.addEdge({ kind: 'approves', from: decisionRef, to: pageRef });
    }
    return json(res, 200, { ok: true, status, decision: decisionRef });
  }
  if (parts[1] === 'candidates') {
    if (req.method === 'POST' && parts[2] === 'accept') {
      const body = await readBody(req);
      const candidateId = String(body.id ?? '');
      const candidate = platform.report.schemaCandidates.find((c) => c.id === candidateId);
      if (!candidate) return json(res, 404, { error: 'no such candidate' });
      candidate.status = 'accepted';
      // The page is the record; the report is a view of it.
      let subjectRef = refFor('knowledge_candidate', candidate.id);
      for (const page of platform.graph.ofType('knowledge_candidate')) {
        if (String(page.properties.candidate_id) !== candidate.id) continue;
        subjectRef = page.ref;
        platform.graph.setProperty({
          pageRef: page.ref,
          property: 'status',
          value: 'accepted',
          status: 'confirmed',
          provenance: {
            kind: 'recorded',
            source: 'workbench acceptance',
            method: 'person decision',
            as_of: new Date().toISOString(),
            evidence_class: 'asserted',
            confirmed_by_role: viewerName(platform, viewer),
          },
          evidenceIds: [],
        });
      }
      const decisionRef = refFor('decision', 'accept-' + candidate.id);
      if (!platform.graph.page(decisionRef)) {
        platform.graph.addPage({
          ref: decisionRef,
          type: 'decision',
          title: 'אושרה הוספת מאפיין: ' + (PROPERTY_LABELS_HE[candidate.proposal.property] ?? candidate.proposal.property),
          properties: {},
          createdAt: new Date().toISOString(),
        });
        for (const [property, value] of Object.entries({
          decision_id: decisionRef,
          kind: 'schema_candidate_accepted',
          status: 'approved',
          decided_at: new Date().toISOString(),
          decided_by: viewerName(platform, viewer),
          rationale: 'אושרה הוספה כשכבת הרחבה של העיר; החבילות המשותפות לא נערכו.',
          subject_ref: subjectRef,
        })) {
          platform.graph.setProperty({
            pageRef: decisionRef,
            property,
            value,
            status: 'confirmed',
            provenance: {
              kind: 'recorded',
              source: 'workbench acceptance',
              method: 'person decision',
              as_of: new Date().toISOString(),
              evidence_class: 'asserted',
              confirmed_by_role: viewerName(platform, viewer),
            },
            evidenceIds: [],
          });
        }
        platform.graph.addEdge({ kind: 'approves', from: decisionRef, to: subjectRef });
      }
      return json(res, 200, {
        ok: true,
        candidate: { id: candidate.id, status: candidate.status, proposition: candidate.proposal },
        overlayDraft: {
          overlay: platform.profileId,
          organization_id: platform.organizationId,
          description: `Tenant addition accepted from candidate ${candidate.id} on ${new Date().toISOString().slice(0, 10)}. It is namespaced and additive; the packs are not edited.`,
          extend_page_types: Object.fromEntries(
            (candidate.proposal.page_types ?? [candidate.proposal.page_type]).map((type) => [
              type,
              { properties: { ['x_' + candidate.proposal.property]: { type: 'string', description: candidate.reason } } },
            ]),
          ),
          note: 'A tenant addition is namespaced x_<slug> and applied as an overlay; it never edits the pack.',
        },
      });
    }
    return json(res, 200, { candidates: platform.report.schemaCandidates });
  }
  return json(res, 404, { error: 'unknown endpoint', path: url.pathname });
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function main() {
  console.log('Building the POC platform (two municipalities)…');
  const started = Date.now();
  const demo = await buildDemo();
  const p = demo.primary;
  console.log(
    `  ${p.organization}: ${p.graph.pages.size} pages, ${p.graph.edges.length} edges, ${p.graph.facts.length} facts in ${Date.now() - started}ms`,
  );
  console.log(`  ${demo.secondary.organization}: ${demo.secondary.graph.pages.size} pages`);
  if (p.report.problems.length) {
    console.warn('  problems:', p.report.problems.slice(0, 5));
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (parts[0] === 'api') {
        return await handleApi(req, res, demo, url, parts);
      }
      if (parts[0] === 'health') return json(res, 200, { ok: true });
      return await serveStatic(res, url.pathname);
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: String(err) });
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\nWorkbench: http://127.0.0.1:${PORT}\n`);
  });
}

await main();
