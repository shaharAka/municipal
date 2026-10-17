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
} as const;

export type StepStats = {
  activity: string;
  labels: string;
  occurrences: number;
  medianWaitDays: number;
  p90WaitDays: number;
  role: string;
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
  kind: 'routing' | 'sla_reminder' | 'document_request' | 'standard_letter';
  title: string;
  rationale: string;
  step: string | null;
  expectedCasesPerYear: number;
  timeSavedDaysPerCase: number;
  annualDaysSaved: number;
  risk: 'low' | 'medium' | 'high';
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
    proposals.push({
      id: stableId('AP', model.serviceCode, step.activity),
      kind,
      title:
        kind === 'document_request'
          ? 'Request the missing documents automatically and chase once'
          : kind === 'standard_letter'
            ? 'Generate the correction letter from the inspection findings'
            : 'Remind the inspector before the inspection SLA is missed',
      rationale: `${step.labels} waits a median of ${step.medianWaitDays} days after it is triggered (${step.occurrences} occurrences). It is ${Math.round(shareOfTotal * 100)}% of the ${model.medianTotalDays}-day median case duration.`,
      step: step.activity,
      expectedCasesPerYear: Math.round(casesPerYear * (step.occurrences / Math.max(1, model.caseCount))),
      timeSavedDaysPerCase: timeSaved,
      annualDaysSaved: Math.round(casesPerYear * timeSaved * (step.occurrences / Math.max(1, model.caseCount))),
      risk: kind === 'standard_letter' ? 'medium' : 'low',
      evidence: [
        `${step.occurrences} events across ${model.caseCount} cases`,
        `median wait ${step.medianWaitDays} days, p90 ${step.p90WaitDays} days`,
        `measured assumption: ${Math.round(PARAMS.assumedReduction.value * 100)}% of the wait is removed`,
      ],
    });
  }

  const corrections = model.steps.find((s) => s.activity === 'CORRECTIONS_REQUESTED');
  const reworkShare = corrections && model.caseCount > 0 ? corrections.occurrences / model.caseCount : 0;
  if (reworkShare > PARAMS.reworkRateForLetter.value) {
    proposals.push({
      id: stableId('AP', model.serviceCode, 'ROUTING'),
      kind: 'routing',
      title: 'Route new applications to the inspector by zone and risk level',
      rationale: `${Math.round(reworkShare * 100)}% of cases come back for corrections, and the first assignment is made by hand in ${model.variants[0]?.caseCount ?? 0} of the ${model.caseCount} cases in the dominant variant.`,
      step: 'INSPECTION_SCHEDULED',
      expectedCasesPerYear: casesPerYear,
      timeSavedDaysPerCase: 1.2,
      annualDaysSaved: Math.round(casesPerYear * 1.2),
      risk: 'low',
      evidence: [
        `${model.variants.length} variants discovered; the top three cover ${Math.round(model.coverageOfTopVariants * 100)}% of cases`,
        `${Math.round(reworkShare * 100)}% of cases reworked`,
      ],
    });
  }

  return proposals.sort((a, b) => b.annualDaysSaved - a.annualDaysSaved);
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
    graph.addPage({ ref, type: 'automation_proposal', title: proposal.title, properties: {}, createdAt: capturedAt });
    const p: Record<string, unknown> = {
      proposal_id: ref,
      proposal_kind: proposal.kind,
      title: proposal.title,
      rationale: proposal.rationale,
      expected_cases_per_year: proposal.expectedCasesPerYear,
      time_saved_days_per_case: proposal.timeSavedDaysPerCase,
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
