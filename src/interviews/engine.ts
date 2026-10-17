// Interviewing: the smallest possible way to close a gap without a meeting.
//
// A gap becomes one short form for one person, chosen from the org map. The
// form is generated from the gap, not from a prompt template that could ask
// anything. At most five questions, always prefilled with the system's best
// guess, and declining is a first-class answer.
//
// The answers become evidence with provenance — never truth. An answer that
// contradicts the current behaviour of a rule produces a proposed rule change
// with its what-if numbers, which a person still has to accept.

import type { Graph } from '../graph/graph.ts';
import { refFor, stableId, type Provenance } from '../graph/graph.ts';
import type { OrgMap } from '../org/orgmap.ts';
import { RULES, REFERENCE_DATE } from '../seed/eligibility-rules.ts';
import { evaluateRule } from '../query/eligibility.ts';

export const ATTENTION = {
  maxOpenPerPerson: {
    value: 1,
    owner: 'דנה לוי, מנהלת תברואה ובריאות',
    reason: 'One open interview per person. A second one queues behind it, it is not delivered.',
  },
  maxQuestions: {
    value: 5,
    owner: 'דנה לוי, מנהלת תברואה ובריאות',
    reason: 'Five questions is the point where an interview stops being a favour and becomes a task.',
  },
} as const;

export type InterviewQuestion = {
  id: string;
  prompt_he: string;
  prompt_en: string;
  kind: 'choice' | 'text' | 'person';
  options?: string[];
  prefill?: string;
  prefill_source?: string;
};

export type InterviewView = {
  ref: string;
  gapRef: string;
  personRef: string;
  personName: string;
  personTitle: string;
  status: string;
  questions: InterviewQuestion[];
  answers: Record<string, string>;
  deliveredAt: string;
  answeredAt: string | null;
  attentionCost: number;
  yieldRate: number | null;
  gapSummary: string;
};

const RISK_LABELS: Record<string, RegExp> = {
  income_band: /גזברות|finance|כלכל/i,
  inspection_zone: /נתונים|steward/i,
  preferredLanguage: /נתונים|steward/i,
  officeLocation: /נתונים|steward|מנהל/i,
};

const provenance = (asOf: string, source: string, actor?: string): Provenance => ({
  kind: 'recorded',
  source,
  method: 'interview engine v1',
  as_of: asOf,
  evidence_class: 'asserted',
  ...(actor ? { confirmed_by_role: actor } : {}),
});

function respondentFor(graph: Graph, org: OrgMap, property: string): { ref: string; name: string; title: string } | null {
  const pattern = RISK_LABELS[property] ?? /מנהל|head/i;
  const person = org.people.find((p) => pattern.test(p.title));
  if (!person) return null;
  return { ref: person.ref, name: person.name, title: person.title };
}

function buildQuestions(property: string, labelHe: string, respondentName: string, currentBehaviour: string): InterviewQuestion[] {
  return [
    {
      id: 'source_system',
      prompt_he: `איפה נשמר ${labelHe}?`,
      prompt_en: `Where is "${property}" kept?`,
      kind: 'choice',
      options: ['גזברות - מערכת חיובים', 'ביטוח לאומי - ממשק נתונים', 'לשכת התושבים', 'אין מקור מסודר'],
      prefill: 'גזברות - מערכת חיובים',
      prefill_source: 'org map: the finance liaison owns fee data',
    },
    {
      id: 'missing_policy',
      prompt_he: `כאשר ${labelHe} חסר, מה צריכה לעשות בדיקת הזכאות?`,
      prompt_en: `When "${property}" is missing, what should the eligibility check do?`,
      kind: 'choice',
      options: ['להשאיר "לא ידוע" (המצב היום)', 'לדחות את הבקשה עד לקבלת הנתון', 'להקצות ללא זכאות'],
      prefill: currentBehaviour,
      prefill_source: 'current rule behaviour, computed from the last answer',
    },
    {
      id: 'who_can_supply',
      prompt_he: 'מי יכול לספק את הערך לבקשות הפתוחות?',
      prompt_en: 'Who can supply the value for the open cases?',
      kind: 'person',
      options: ['רון דיין, אחראי נתונים מחלקתי', 'משה טל, רכז גזברות', 'הילה קורן, מזכירת מחלקה'],
      prefill: respondentName,
      prefill_source: 'org map: closest responsibility match',
    },
  ];
}

export function openInterview(
  graph: Graph,
  org: OrgMap,
  gapRef: string,
  opts: { capturedAt: string; personRef?: string },
): { interview: InterviewView | null; existing: boolean; reason?: string } {
  const gap = graph.page(gapRef);
  if (!gap || gap.type !== 'knowledge_candidate') return { interview: null, existing: false, reason: 'No such gap.' };

  const proposal = (gap.properties.proposal ?? {}) as Record<string, unknown>;
  const property = String(proposal.property ?? '');
  const labelHe = String(gap.properties.evidence_summary ?? property).slice(0, 60);

  const respondent = opts.personRef
    ? (() => {
        const page = graph.page(opts.personRef!);
        return page ? { ref: page.ref, name: page.title, title: String(page.properties.job_title ?? '') } : null;
      })()
    : respondentFor(graph, org, property);
  if (!respondent) return { interview: null, existing: false, reason: 'No person in the org map can answer this.' };

  const open = graph
    .ofType('interview')
    .find((i) => String(i.properties.person_ref) === respondent.ref && String(i.properties.status) === 'open');
  if (open) {
    return { interview: viewInterview(graph, open.ref), existing: true, reason: 'One open interview at a time; this one is already waiting.' };
  }

  const questions = buildQuestions(
    property,
    HEBREW_PROPERTY_LABELS[property] ?? property,
    respondent.name,
    'להשאיר "לא ידוע" (המצב היום)',
  ).slice(0, ATTENTION.maxQuestions.value);

  const ref = refFor('interview', stableId('INT', gapRef, respondent.ref).replace('INT-', ''));
  graph.addPage({ ref, type: 'interview', title: `Interview: ${property}`, properties: {}, createdAt: opts.capturedAt });

  const values: Record<string, unknown> = {
    interview_id: ref,
    gap_ref: gapRef,
    person_ref: respondent.ref,
    status: 'open',
    questions,
    attention_cost: questions.length,
    delivered_at: opts.capturedAt,
    yield: 0,
  };
  for (const [name, value] of Object.entries(values)) {
    graph.setProperty({
      pageRef: ref,
      property: name,
      value,
      status: 'candidate',
      provenance: provenance(opts.capturedAt, 'interview generation'),
      evidenceIds: [],
    });
  }
  graph.addEdge({ kind: 'interview_closes', from: ref, to: gapRef });
  graph.addEdge({ kind: 'interview_for', from: ref, to: respondent.ref });

  return { interview: viewInterview(graph, ref), existing: false };
}

const HEBREW_PROPERTY_LABELS: Record<string, string> = {
  income_band: 'רצועת ההכנסה של משק הבית',
  inspection_zone: 'אזור הפיקוח',
  preferredLanguage: 'שפת הדיוור',
  officeLocation: 'מיקום המשרד',
};

export function answerInterview(
  graph: Graph,
  interviewRef: string,
  answers: Record<string, string>,
  actor: string,
  capturedAt: string,
): {
  interview: InterviewView | null;
  contradiction: string | null;
  proposalRef: string | null;
  whatIf: { eligible: number; notEligible: number; unknown: number } | null;
} {
  const page = graph.page(interviewRef);
  if (!page || page.type !== 'interview') return { interview: null, contradiction: null, proposalRef: null, whatIf: null };

  const questions = (page.properties.questions ?? []) as InterviewQuestion[];
  const clean = Object.fromEntries(
    Object.entries(answers)
      .filter(([key]) => questions.some((q) => q.id === key))
      .map(([key, value]) => [key, String(value).slice(0, 500)]),
  );
  const answered = Object.keys(clean).length;

  graph.setProperty({
    pageRef: interviewRef,
    property: 'answers',
    value: clean,
    status: 'confirmed',
    provenance: provenance(capturedAt, 'interview answer', actor),
    evidenceIds: [],
  });
  graph.setProperty({
    pageRef: interviewRef,
    property: 'status',
    value: 'answered',
    status: 'confirmed',
    provenance: provenance(capturedAt, 'interview answer', actor),
    evidenceIds: [],
  });
  graph.setProperty({
    pageRef: interviewRef,
    property: 'answered_at',
    value: capturedAt,
    status: 'confirmed',
    provenance: provenance(capturedAt, 'interview answer', actor),
    evidenceIds: [],
  });
  graph.setProperty({
    pageRef: interviewRef,
    property: 'yield',
    value: Number((answered / Math.max(1, questions.length)).toFixed(2)),
    status: 'confirmed',
    provenance: provenance(capturedAt, 'interview answer', actor),
    evidenceIds: [],
  });

  const policyAnswer = clean.missing_policy ?? '';
  const gap = graph.page(String(page.properties.gap_ref ?? ''));
  const property = String(((gap?.properties.proposal ?? {}) as Record<string, unknown>).property ?? '');
  const currentRule = RULES.filter((r) => r.status === 'approved' && !r.effective_to).sort((a, b) => b.version - a.version)[0];

  if (policyAnswer && !policyAnswer.includes('המצב היום') && property) {
    const policy = policyAnswer.includes('להקצות ללא זכאות') ? 'not_eligible' : 'unknown';
    const whatIf = evaluateRule(graph, currentRule, {
      capturedAt,
      missingPolicy: policy as 'unknown' | 'not_eligible',
    }).counts;
    const proposalRef = refFor(
      'knowledge_candidate',
      stableId('KC', 'rule-change', currentRule.code, policy).replace('KC-', ''),
    );
    if (!graph.page(proposalRef)) {
      graph.addPage({
        ref: proposalRef,
        type: 'knowledge_candidate',
        title: `Rule change proposed: missing ${property} → ${policy}`,
        properties: {},
        createdAt: capturedAt,
      });
      const values: Record<string, unknown> = {
        candidate_id: stableId('KC', 'rule-change', currentRule.code, policy),
        candidate_kind: 'eligibility_rule',
        subject_ref: refFor('eligibility_rule', `${currentRule.code}-v${currentRule.version}`),
        proposal: {
          change: 'missing_value_policy',
          property,
          to: policy,
          what_if: { eligible: whatIf.eligible, not_eligible: whatIf.notEligible, unknown: whatIf.unknown },
        },
        evidence_summary: `${actor} answered that a missing ${property} should lead to "${policyAnswer}". Applying that would move ${whatIf.unknown} undecided households and needs the rule owner's approval.`,
        support_count: answered,
        status: 'open',
        proposed_by: 'interview engine v1',
      };
      for (const [name, value] of Object.entries(values)) {
        graph.setProperty({
          pageRef: proposalRef,
          property: name,
          value,
          status: 'candidate',
          provenance: {
            kind: 'inferred',
            source: interviewRef,
            method: 'interview answer interpretation v1',
            as_of: capturedAt,
            evidence_class: 'attributed',
          },
          evidenceIds: [],
        });
      }
    }
    return {
      interview: viewInterview(graph, interviewRef),
      contradiction: `The rule leaves this undecided; the answer says "${policyAnswer}".`,
      proposalRef,
      whatIf,
    };
  }

  return { interview: viewInterview(graph, interviewRef), contradiction: null, proposalRef: null, whatIf: null };
}

export function viewInterview(graph: Graph, ref: string): InterviewView {
  const page = graph.page(ref)!;
  const person = graph.page(String(page.properties.person_ref ?? ''));
  const gap = graph.page(String(page.properties.gap_ref ?? ''));
  const questions = (page.properties.questions ?? []) as InterviewQuestion[];
  const answers = (page.properties.answers ?? {}) as Record<string, string>;
  return {
    ref,
    gapRef: String(page.properties.gap_ref ?? ''),
    personRef: String(page.properties.person_ref ?? ''),
    personName: person?.title ?? '',
    personTitle: String(person?.properties.job_title ?? ''),
    status: String(page.properties.status ?? 'open'),
    questions,
    answers,
    deliveredAt: String(page.properties.delivered_at ?? ''),
    answeredAt: (page.properties.answered_at as string) ?? null,
    attentionCost: Number(page.properties.attention_cost ?? questions.length),
    yieldRate: page.properties.yield === undefined ? null : Number(page.properties.yield),
    gapSummary: String(gap?.properties.evidence_summary ?? ''),
  };
}

export function listInterviews(graph: Graph): InterviewView[] {
  return graph.ofType('interview').map((page) => viewInterview(graph, page.ref));
}
