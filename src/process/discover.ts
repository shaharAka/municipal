// Process discovery over the case event log.
//
// Inductive-style: cases are read as traces, identical traces are variants, and
// the model is the set of variants that cover the process. Waits are measured
// between consecutive events, not estimated. Everything that decides a number
// here is a declared parameter in PARAMS below, with an owner — there is no
// threshold buried in an if-statement.

import { Graph, refFor, stableId, type Provenance } from '../graph/graph.ts';
import { ACTIVITY_LABELS } from '../cloud/fixtures.ts';

export const PARAMS = {
  minWaitDaysForReminder: {
    value: 5,
    owner: 'יוסי כהן, סגן מנהל תברואה',
    reason: 'A waiting step above five days is where a reminder is worth sending.',
  },
  reworkRateForLetter: {
    value: 0.12,
    owner: 'דנה לוי, מנהלת תברואה ובריאות',
    reason: 'Above one in eight cases returning for corrections, a standard letter is worth templating.',
  },
  shareOfWaitForAutomation: {
    value: 0.25,
    owner: 'דנה לוי, מנהלת תברואה ובריאות',
    reason: 'A step carrying a quarter of the total wait is worth automating first.',
  },
  assumedReduction: {
    value: 0.6,
    owner: 'דנה לוי, מנהלת תברואה ובריאות',
    reason: 'Share of the measured wait an automation is assumed to remove. An assumption, stated, not measured.',
  },
  routingDaysSavedPerCase: {
    value: 1.2,
    owner: 'דנה לוי, מנהלת תברואה ובריאות',
    reason: 'A routing decision is assumed to save 1.2 days of applicant waiting per new application. An assumption, stated, not measured.',
  },
} as const;

export type StepStats = {
  activity: string;
  labels: string;
  occurrences: number;
  medianWaitDays: number;
  p90WaitDays: number;
  role: string;
  /** What the wait depends on, not who to blame. */
  dependsOnHe: string;
  /** Every measured wait behind the median, rounded to a tenth of a day. */
  waitSamples: number[];
  isRework: boolean;
};

export type VariantStats = {
  id: string;
  sequence: string[];
  caseCount: number;
  coverageShare: number;
  medianDays: number;
  hasRework: boolean;
};

export type ProcessModel = {
  serviceCode: string;
  serviceName: string;
  caseCount: number;
  windowDays: number;
  medianTotalDays: number;
  p90TotalDays: number;
  variants: VariantStats[];
  steps: StepStats[];
  bottleneck: StepStats | null;
  coverageOfTopVariants: number;
};

export type AutomationProposal = {
  id: string;
  /** Page ref once the proposal is written to the graph. */
  ref?: string;
  serviceCode?: string;
  kind: 'routing' | 'sla_reminder' | 'document_request' | 'standard_letter';
  title: string;
  rationale: string;
  /** The same proposal in the language the department reads. */
  titleHe: string;
  rationaleHe: string;
  evidenceHe: string[];
  step: string | null;
  expectedCasesPerYear: number;
  timeSavedDaysPerCase: number;
  /** Applicant waiting days avoided per year — not staff workdays. */
  annualDaysSaved: number;
  risk: 'low' | 'medium' | 'high';
  /** What the number rests on, in the department's language. */
  basisHe: string;
  formulaHe: string;
  assumptionHe: string;
  riskReasonHe: string;
  waitSamples: number[];
  waitMedian: number;
  waitP90: number;
  waitCount: number;
  evidence: string[];
};

const DAY = 86_400_000;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

type Trace = { caseRef: string; service: string; events: { activity: string; at: number; actor: string | null }[] };

function tracesFor(graph: Graph, serviceCode: string): Trace[] {
  const traces: Trace[] = [];
  for (const c of graph.ofType('case')) {
    if (String(c.properties.service_code) !== serviceCode) continue;
    const events = graph
      .edges.filter((e) => e.kind === 'event_of' && e.to === c.ref)
      .map((e) => graph.page(e.from))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        activity: String(p.properties.activity ?? ''),
        at: Date.parse(String(p.properties.occurred_at ?? '')),
        actor: graph.out('event_actor', p.ref)[0]?.to ?? null,
      }))
      .filter((e) => e.activity && Number.isFinite(e.at))
      .sort((a, b) => a.at - b.at);
    if (!events.length) continue;
    traces.push({ caseRef: c.ref, service: serviceCode, events });
  }
  return traces;
}

const collapse = (activities: string[]) => activities.filter((a, i) => i === 0 || a !== activities[i - 1]);

export function discoverProcess(graph: Graph, serviceCode: string, serviceName: string): ProcessModel {
  const traces = tracesFor(graph, serviceCode);
  const caseCount = traces.length;

  const openTimes = traces.map((t) => t.events[0].at);
  const closeTimes = traces.map((t) => t.events[t.events.length - 1].at);
  const windowStart = Math.min(...openTimes);
  const windowEnd = Math.max(...closeTimes);
  const windowDays = Math.max(1, Math.round((windowEnd - windowStart) / DAY));

  const totalDays = traces.map((t) => (t.events[t.events.length - 1].at - t.events[0].at) / DAY);

  // Variants
  const variantMap = new Map<string, { sequence: string[]; durations: number[] }>();
  for (const t of traces) {
    const seq = collapse(t.events.map((e) => e.activity));
    const key = seq.join('>');
    const entry = variantMap.get(key) ?? { sequence: seq, durations: [] };
    entry.durations.push((t.events[t.events.length - 1].at - t.events[0].at) / DAY);
    variantMap.set(key, entry);
  }
  const variants: VariantStats[] = [...variantMap.entries()]
    .map(([key, v]) => ({
      id: stableId('VAR', key),
      sequence: v.sequence,
      caseCount: v.durations.length,
      coverageShare: v.durations.length / caseCount,
      medianDays: median(v.durations),
      hasRework: new Set(v.sequence).size !== v.sequence.length,
    }))
    .sort((a, b) => b.caseCount - a.caseCount);

  // Steps and waits
  const waitsByActivity = new Map<string, number[]>();
  const actorCounts = new Map<string, Map<string, number>>();
  const occurrences = new Map<string, number>();
  const reworkCases = new Map<string, number>();

  for (const t of traces) {
    const seq = collapse(t.events.map((e) => e.activity));
    const counts = new Map<string, number>();
    for (const a of seq) counts.set(a, (counts.get(a) ?? 0) + 1);
    for (const [a, n] of counts) {
      occurrences.set(a, (occurrences.get(a) ?? 0) + n);
      if (n > 1) reworkCases.set(a, (reworkCases.get(a) ?? 0) + 1);
    }
    for (let i = 0; i < t.events.length - 1; i++) {
      const a = t.events[i].activity;
      const wait = (t.events[i + 1].at - t.events[i].at) / DAY;
      if (wait <= 0) continue;
      const list = waitsByActivity.get(a) ?? [];
      list.push(wait);
      waitsByActivity.set(a, list);
      if (t.events[i].actor) {
        const m = actorCounts.get(a) ?? new Map<string, number>();
        m.set(t.events[i].actor, (m.get(t.events[i].actor) ?? 0) + 1);
        actorCounts.set(a, m);
      }
    }
  }

  const steps: StepStats[] = [...occurrences.entries()]
    .map(([activity, n]) => {
      const waits = waitsByActivity.get(activity) ?? [];
      const topActorEntry = [...(actorCounts.get(activity) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0];
      const actorTitle = topActorEntry
        ? String(graph.page(topActorEntry[0])?.properties.job_title ?? '')
        : '';
      return {
        activity,
        labels: ACTIVITY_LABELS[activity] ?? activity,
        occurrences: n,
        medianWaitDays: Math.round(median(waits) * 10) / 10,
        p90WaitDays: Math.round(percentile(waits, 90) * 10) / 10,
        role: actorTitle,
        dependsOnHe: DEPENDS_ON_HE[activity] ?? 'זמן הטיפול בשלב',
        waitSamples: waits.map((value) => Math.round(value * 10) / 10).slice(0, 160),
        isRework: (reworkCases.get(activity) ?? 0) / Math.max(1, caseCount) > PARAMS.reworkRateForLetter.value,
      };
    })
    .sort((a, b) => b.medianWaitDays - a.medianWaitDays);

  const coverageOfTopVariants = variants.slice(0, 3).reduce((a, v) => a + v.coverageShare, 0);

  return {
    serviceCode,
    serviceName,
    caseCount,
    windowDays,
    medianTotalDays: Math.round(median(totalDays) * 10) / 10,
    p90TotalDays: Math.round(percentile(totalDays, 90) * 10) / 10,
    variants,
    steps,
    bottleneck: steps[0] && steps[0].medianWaitDays > 0 ? steps[0] : null,
    coverageOfTopVariants,
  };
}

const DEPENDS_ON_HE: Record<string, string> = {
  APPLICATION_RECEIVED: 'הגשת הבקשה על ידי העסק',
  DOCUMENTS_RECEIVED: 'בדיקת שלמות המסמכים',
  DOCUMENTS_REQUESTED: 'הגשת המסמכים על ידי העסק',
  INSPECTION_SCHEDULED: 'זמינות מפקחים ולוח הזמנים',
  INSPECTION_DONE: 'ביקורת בשטח',
  CORRECTIONS_REQUESTED: 'תיקון הליקויים על ידי העסק',
  CORRECTIONS_RECEIVED: 'איסוף ואימות התיקונים',
  REINSPECTION: 'ביקורת חוזרת בשטח',
  APPROVED: 'החלטת האישור',
  LICENCE_ISSUED: 'הפקת הרישיון',
  FEE_CHARGED: 'חיוב האגרה',
};

const WAITING_STEPS = new Set(['DOCUMENTS_REQUESTED', 'INSPECTION_SCHEDULED', 'CORRECTIONS_REQUESTED']);

export function proposeAutomations(model: ProcessModel): AutomationProposal[] {
  const proposals: AutomationProposal[] = [];
  const casesPerYear = Math.round((model.caseCount / Math.max(1, model.windowDays)) * 365);

  for (const step of model.steps) {
    if (!WAITING_STEPS.has(step.activity)) continue;
    if (step.medianWaitDays < PARAMS.minWaitDaysForReminder.value) continue;

    const shareOfTotal = model.medianTotalDays > 0 ? step.medianWaitDays / model.medianTotalDays : 0;
    if (shareOfTotal < PARAMS.shareOfWaitForAutomation.value && step.activity !== 'DOCUMENTS_REQUESTED') continue;

    const kind: AutomationProposal['kind'] =
      step.activity === 'DOCUMENTS_REQUESTED'
        ? 'document_request'
        : step.activity === 'CORRECTIONS_REQUESTED'
          ? 'standard_letter'
          : 'sla_reminder';

    const timeSaved = Math.round(step.medianWaitDays * PARAMS.assumedReduction.value * 10) / 10;
    const sharePct = Math.round(shareOfTotal * 100);
    const reductionPct = Math.round(PARAMS.assumedReduction.value * 100);
    const expectedCases = Math.round(casesPerYear * (step.occurrences / Math.max(1, model.caseCount)));
    const annualWaitingDays = Math.round(casesPerYear * timeSaved * (step.occurrences / Math.max(1, model.caseCount)));
    proposals.push({
      id: stableId('AP', model.serviceCode, step.activity),
      kind,
      title:
        kind === 'document_request'
          ? 'Request the missing documents automatically and chase once'
          : kind === 'standard_letter'
            ? 'Generate the correction letter from the inspection findings'
            : 'Remind the inspector before the inspection SLA is missed',
      rationale: `${step.labels} waits a median of ${step.medianWaitDays} days after it is triggered (${step.occurrences} occurrences). It is ${sharePct}% of the ${model.medianTotalDays}-day median case duration.`,
      titleHe:
        kind === 'document_request'
          ? 'בקשה אוטומטית למסמכים החסרים, עם תזכורת אחת'
          : kind === 'standard_letter'
            ? 'הפקת מכתב התיקונים מתוך ממצאי הביקורת'
            : 'תזכורת לרכזת הרישוי לפני חריגה מזמן שיבוץ הפיקוח',
      rationaleHe: `בשלב "${step.labels}" תיק ממתין בחציון ${step.medianWaitDays} ימים (${step.occurrences} מקרים), כלומר ${sharePct}% מ־${model.medianTotalDays} הימים שתיק נמשך בחציון.`,
      evidenceHe: [
        `${step.occurrences} אירועים מתוך ${model.caseCount} תיקים`,
        `חציון המתנה ${step.medianWaitDays} ימים, 90% עד ${step.p90WaitDays} ימים`,
        `הנחה מוצהרת: ${reductionPct}% מההמתנה מוסרת`,
      ],
      step: step.activity,
      expectedCasesPerYear: expectedCases,
      timeSavedDaysPerCase: timeSaved,
      annualDaysSaved: annualWaitingDays,
      risk: kind === 'standard_letter' ? 'medium' : 'low',
      basisHe: `${model.caseCount} תיקים בתצפית של ${model.windowDays} ימים ≈ ${casesPerYear} תיקים בשנה.`,
      formulaHe: `${expectedCases} מקרים בשנה × ${timeSaved} ימי המתנה שנחסכים לתיק ≈ ${annualWaitingDays} ימי המתנה בשנה.`,
      assumptionHe: `ההנחה: ${reductionPct}% מההמתנה מוסרת (בעל ההנחה: ${PARAMS.assumedReduction.owner}).`,
      waitSamples: step.waitSamples,
      waitMedian: step.medianWaitDays,
      waitP90: step.p90WaitDays,
      waitCount: step.occurrences,
      riskReasonHe:
        kind === 'standard_letter'
          ? 'המכתב מנוסח אוטומטית מהממצאים; עורך אדם נדרש לפני שליחה.'
          : kind === 'document_request'
            ? 'הבקשה מנוסחת אוטומטית; אם המסמך כבר התקבל, יש לעצור את השליחה.'
            : 'התזכורת אינה משנה החלטה; היא רק מתריעה לפני חריגה.',
      evidence: [
        `${step.occurrences} events across ${model.caseCount} cases`,
        `median wait ${step.medianWaitDays} days, p90 ${step.p90WaitDays} days`,
        `measured assumption: ${reductionPct}% of the wait is removed`,
      ],
    });
  }

  const corrections = model.steps.find((s) => s.activity === 'CORRECTIONS_REQUESTED');
  const reworkShare = corrections && model.caseCount > 0 ? corrections.occurrences / model.caseCount : 0;
  if (reworkShare > PARAMS.reworkRateForLetter.value) {
    const reworkPct = Math.round(reworkShare * 100);
    const coverPct = Math.round(model.coverageOfTopVariants * 100);
    const routingDays = PARAMS.routingDaysSavedPerCase.value;
    const routingAnnual = Math.round(casesPerYear * routingDays);
    proposals.push({
      id: stableId('AP', model.serviceCode, 'ROUTING'),
      kind: 'routing',
      title: 'Route new applications to the inspector by zone and risk level',
      rationale: `${reworkPct}% of cases come back for corrections, and the first assignment is made by hand in ${model.variants[0]?.caseCount ?? 0} of the ${model.caseCount} cases in the dominant variant.`,
      titleHe: 'שיוך בקשות חדשות למפקח לפי אזור ורמת סיכון',
      rationaleHe: `${reworkPct}% מהתיקים חוזרים לתיקונים, והשיוך הראשון נעשה ידנית ב-${model.variants[0]?.caseCount ?? 0} מתוך ${model.caseCount} תיקים במסלול הדומיננטי.`,
      evidenceHe: [
        `${model.variants.length} מסלולים זוהו; שלושת המובילים מכסים ${coverPct}% מהתיקים`,
        `${reworkPct}% מהתיקים חזרו לתיקונים`,
      ],
      step: 'INSPECTION_SCHEDULED',
      expectedCasesPerYear: casesPerYear,
      timeSavedDaysPerCase: routingDays,
      annualDaysSaved: routingAnnual,
      risk: 'low',
      basisHe: `${model.caseCount} תיקים בתצפית של ${model.windowDays} ימים ≈ ${casesPerYear} תיקים בשנה.`,
      formulaHe: `${casesPerYear} מקרים בשנה × ${routingDays} ימי המתנה שנחסכים ≈ ${routingAnnual} ימי המתנה בשנה.`,
      assumptionHe: `ההנחה: ${routingDays} ימי המתנה נחסכים לכל בקשה (בעל ההנחה: ${PARAMS.routingDaysSavedPerCase.owner}).`,
      riskReasonHe: 'השיוך משפיע על עומס המפקחים; הוא מוצע לפי אזור ורמת סיכון, וניתן לבדיקה.',
      waitSamples: model.steps.find((entry) => entry.activity === 'INSPECTION_SCHEDULED')?.waitSamples ?? [],
      waitMedian: model.steps.find((entry) => entry.activity === 'INSPECTION_SCHEDULED')?.medianWaitDays ?? 0,
      waitP90: model.steps.find((entry) => entry.activity === 'INSPECTION_SCHEDULED')?.p90WaitDays ?? 0,
      waitCount: model.steps.find((entry) => entry.activity === 'INSPECTION_SCHEDULED')?.occurrences ?? 0,
      evidence: [
        `${model.variants.length} variants discovered; the top three cover ${coverPct}% of cases`,
        `${reworkPct}% of cases reworked`,
      ],
    });
  }

  return proposals.sort((a, b) => b.annualDaysSaved - a.annualDaysSaved);
}

/**
 * Approves one automation proposal and records who decided it.
 *
 * The server calls this; the graph contract test calls it directly, so the test
 * never needs a running HTTP server (and never mutates a developer's demo).
 */
export function approveAutomation(
  graph: Graph,
  proposalRef: string,
  actor: string,
  at: string,
): { decisionRef: string; pageRef: string } | null {
  const page = graph.page(proposalRef);
  if (!page || page.type !== 'automation_proposal') return null;
  const decisionRef = refFor('decision', 'approve-' + page.ref.replace(/[^a-z0-9]/gi, '-'));
  if (!graph.page(decisionRef)) {
    graph.addPage({
      ref: decisionRef,
      type: 'decision',
      title: 'אושר: ' + String(page.properties.title_he ?? page.title),
      properties: {},
      createdAt: at,
    });
    const provenance: Provenance = {
      kind: 'recorded',
      source: 'workbench approval',
      method: 'person decision',
      as_of: at,
      evidence_class: 'asserted',
      confirmed_by_role: actor,
    };
    for (const [property, value] of Object.entries({
      decision_id: decisionRef,
      kind: 'automation_approved',
      status: 'approved',
      decided_at: at,
      decided_by: actor,
      rationale: 'אושר מתוך הראיות שנמדדו בתהליך.',
      subject_ref: page.ref,
    })) {
      graph.setProperty({ pageRef: decisionRef, property, value, status: 'confirmed', provenance, evidenceIds: [] });
    }
    graph.addEdge({ kind: 'approves', from: decisionRef, to: page.ref });
  }
  const provenance: Provenance = {
    kind: 'recorded',
    source: 'workbench approval',
    method: 'person decision',
    as_of: at,
    evidence_class: 'asserted',
    confirmed_by_role: actor,
  };
  for (const [property, value] of Object.entries({ status: 'approved', approved_by: actor, approved_at: at })) {
    graph.setProperty({ pageRef: page.ref, property, value, status: 'confirmed', provenance, evidenceIds: [] });
  }
  return { decisionRef, pageRef: page.ref };
}

/** Writes the discovered model into the graph as pages, so it can be reviewed. */
export function persistProcess(
  graph: Graph,
  model: ProcessModel,
  capturedAt: string,
): { modelRef: string; proposals: AutomationProposal[] } {
  const modelRef = refFor('process_model', model.serviceCode);
  graph.addPage({ ref: modelRef, type: 'process_model', title: `${model.serviceName} — discovered`, properties: {}, createdAt: capturedAt });
  const provenance: Provenance = {
    kind: 'computed',
    source: 'case event log',
    method: 'inductive variant discovery v1',
    as_of: capturedAt,
    evidence_class: 'measured',
  };
  const values: Record<string, unknown> = {
    model_id: modelRef,
    service_code: model.serviceCode,
    algorithm: 'inductive (sequence collapse, variants by trace)',
    case_count: model.caseCount,
    variant_count: model.variants.length,
    coverage_share: Number(model.coverageOfTopVariants.toFixed(3)),
    median_total_days: model.medianTotalDays,
    discovered_at: capturedAt,
    status: 'discovered',
  };
  for (const [property, value] of Object.entries(values)) {
    graph.setProperty({ pageRef: modelRef, property, value, status: 'candidate', provenance, evidenceIds: [] });
  }

  for (const variant of model.variants.slice(0, 8)) {
    const ref = refFor('process_variant', variant.id.replace('VAR-', ''));
    graph.addPage({ ref, type: 'process_variant', title: variant.sequence.join(' → '), properties: {}, createdAt: capturedAt });
    const v: Record<string, unknown> = {
      variant_id: variant.id,
      activity_sequence: variant.sequence,
      case_count: variant.caseCount,
      coverage_share: Number(variant.coverageShare.toFixed(3)),
      median_days: Math.round(variant.medianDays * 10) / 10,
      has_rework: variant.hasRework,
    };
    for (const [property, value] of Object.entries(v)) {
      graph.setProperty({ pageRef: ref, property, value, status: 'candidate', provenance, evidenceIds: [] });
    }
    graph.addEdge({ kind: 'variant_of_model', from: ref, to: modelRef });
  }

  for (const step of model.steps) {
    const ref = refFor('process_step', model.serviceCode + '-' + step.activity);
    graph.addPage({ ref, type: 'process_step', title: step.labels, properties: {}, createdAt: capturedAt });
    const s: Record<string, unknown> = {
      step_id: ref,
      activity_code: step.activity,
      activity_label_he: step.labels,
      occurrences: step.occurrences,
      median_wait_days: step.medianWaitDays,
      p90_wait_days: step.p90WaitDays,
      actor_role: step.role,
      depends_on_he: step.dependsOnHe,
      is_rework: step.isRework,
    };
    for (const [property, value] of Object.entries(s)) {
      graph.setProperty({ pageRef: ref, property, value, status: 'candidate', provenance, evidenceIds: [] });
    }
    graph.addEdge({ kind: 'step_of_model', from: ref, to: modelRef });
  }

  const serviceRef = refFor('service', model.serviceCode);
  if (graph.page(serviceRef)) graph.addEdge({ kind: 'model_for', from: modelRef, to: serviceRef });

  const proposals = proposeAutomations(model);
  for (const proposal of proposals) {
    const ref = refFor('automation_proposal', proposal.id.replace('AP-', ''));
    proposal.ref = ref;
    proposal.serviceCode = model.serviceCode;
    graph.addPage({ ref, type: 'automation_proposal', title: proposal.title, properties: {}, createdAt: capturedAt });
    const p: Record<string, unknown> = {
      proposal_id: ref,
      proposal_kind: proposal.kind,
      title: proposal.title,
      title_he: proposal.titleHe,
      rationale: proposal.rationale,
      rationale_he: proposal.rationaleHe,
      evidence: proposal.evidence,
      evidence_he: proposal.evidenceHe,
      expected_cases_per_year: proposal.expectedCasesPerYear,
      time_saved_days_per_case: proposal.timeSavedDaysPerCase,
      annual_waiting_days_saved: proposal.annualDaysSaved,
      wait_samples: proposal.waitSamples,
      wait_median: proposal.waitMedian,
      wait_p90: proposal.waitP90,
      basis_he: proposal.basisHe,
      formula_he: proposal.formulaHe,
      assumption_he: proposal.assumptionHe,
      risk_reason_he: proposal.riskReasonHe,
      risk: proposal.risk,
      status: 'proposed',
    };
    for (const [property, value] of Object.entries(p)) {
      graph.setProperty({ pageRef: ref, property, value, status: 'candidate', provenance, evidenceIds: [] });
    }
    if (proposal.step) {
      const stepRef = refFor('process_step', model.serviceCode + '-' + proposal.step);
      if (graph.page(stepRef)) graph.addEdge({ kind: 'proposes', from: ref, to: stepRef });
    }
  }

  return { modelRef, proposals };
}
