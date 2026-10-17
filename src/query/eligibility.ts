// Eligibility: the question from the brief, answered honestly.
//
// A count is only part of an answer. A household is eligible, not eligible, or —
// often — undecidable because an attribute is missing. The third bucket is what
// makes the number usable, so it is computed per household and reported with the
// attribute that blocked it. Unknowns become gaps; gaps become questions to a
// person (slice 6) or a lookup (slice 5).

import type { Graph } from '../graph/graph.ts';
import { refFor, stableId, type Provenance } from '../graph/graph.ts';
import { RULES, REFERENCE_DATE, SUPPRESSION, type Criterion, type RuleSeed } from '../seed/eligibility-rules.ts';

export type HouseholdOutcome = {
  householdRef: string;
  state: 'eligible' | 'not_eligible' | 'unknown';
  ground: string | null;
  unknownGrounds: string[];
  reasons: string[];
};

export type Evaluation = {
  rule: RuleSeed;
  outcomes: HouseholdOutcome[];
  counts: { eligible: number; notEligible: number; unknown: number; total: number };
  unknownByReason: { reason: string; count: number; ground: string; property: string; label_he: string; label_en: string }[];
  suppressed: boolean;
  suppressionNote: string | null;
};

export type QueryPlan = {
  metric: 'count';
  entity: 'household' | 'resident' | 'business' | 'case';
  rule_code?: string;
  filter?: Record<string, unknown>;
};

export type QueryAnswer = {
  answer_id: string;
  question: string;
  plan: QueryPlan;
  rule: { code: string; version: number; status: string; owner: string; citation: string; effective_from: string; logic: string } | null;
  counts: { eligible: number | null; notEligible: number | null; unknown: number | null; total: number | null; value?: number };
  suppression: { applied: boolean; minCellSize: number; owner: string };
  unknownReasons: Evaluation['unknownByReason'];
  provisional: boolean;
  sources: { system: string; label: string; asOf: string }[];
  freshness: string;
  explain: { plan: QueryPlan; ruleVersion: number | null; steps: string[]; whatWasNotChecked: string[] };
  gapsCreated: number;
  refused: string | null;
};

const DAY = 86_400_000;

const ageAt = (birthDate: string, at: string): number | null => {
  const born = Date.parse(birthDate);
  const ref = Date.parse(at);
  if (!Number.isFinite(born) || !Number.isFinite(ref)) return null;
  return Math.floor((ref - born) / (365.2425 * DAY));
};

const provenance = (asOf: string, source: string): Provenance => ({
  kind: 'computed',
  source,
  method: 'eligibility evaluator v1',
  as_of: asOf,
  evidence_class: 'model_estimate',
});

export function seedRules(graph: Graph, capturedAt: string): void {
  for (const rule of RULES) {
    const ref = refFor('eligibility_rule', `${rule.code}-v${rule.version}`);
    graph.addPage({ ref, type: 'eligibility_rule', title: `${rule.name_en} v${rule.version}`, properties: {}, createdAt: capturedAt });
    const values: Record<string, unknown> = {
      rule_id: ref,
      code: rule.code,
      name_he: rule.name_he,
      name_en: rule.name_en,
      service_code: rule.service_code,
      status: rule.status,
      owner: rule.owner,
      citation: rule.citation,
      effective_from: rule.effective_from,
      ...(rule.effective_to ? { effective_to: rule.effective_to } : {}),
      version: rule.version,
      logic: rule.logic,
      criteria: rule.criteria,
    };
    for (const [property, value] of Object.entries(values)) {
      graph.setProperty({
        pageRef: ref,
        property,
        value,
        status: 'confirmed',
        provenance: { ...provenance(capturedAt, 'declared rule'), evidence_class: 'asserted', confirmed_by_role: rule.owner },
        evidenceIds: [],
      });
    }
    const serviceRef = refFor('service', rule.service_code);
    if (graph.page(serviceRef)) graph.addEdge({ kind: 'rule_for', from: ref, to: serviceRef });
  }
}

function evaluateCriterion(
  criterion: Criterion,
  residents: { ref: string; birth_date?: string; disability_certificate_expiry?: string }[],
  household: { income_band?: string },
  referenceDate: string,
): { state: boolean | 'unknown'; reason: string | null } {
  switch (criterion.operator) {
    case 'age_gte': {
      let sawMissing = false;
      for (const resident of residents) {
        if (!resident.birth_date) {
          sawMissing = true;
          continue;
        }
        const age = ageAt(resident.birth_date, referenceDate);
        if (age !== null && age >= Number(criterion.value)) return { state: true, reason: null };
      }
      return sawMissing ? { state: 'unknown', reason: criterion.unknown_reason } : { state: false, reason: null };
    }
    case 'valid_on': {
      for (const resident of residents) {
        const expiry = resident.disability_certificate_expiry;
        if (expiry && expiry >= referenceDate) return { state: true, reason: null };
      }
      return { state: false, reason: null };
    }
    case 'equals': {
      const value = household.income_band;
      if (value === undefined || value === null || value === '') {
        return { state: 'unknown', reason: criterion.unknown_reason };
      }
      return { state: value === criterion.value, reason: null };
    }
    case 'lte': {
      if (household.income_band === undefined) return { state: 'unknown', reason: criterion.unknown_reason };
      return { state: false, reason: null };
    }
    default:
      return { state: 'unknown', reason: criterion.unknown_reason };
  }
}

export function evaluateRule(
  graph: Graph,
  rule: RuleSeed,
  opts: { referenceDate?: string; capturedAt: string },
): Evaluation {
  const referenceDate = opts.referenceDate ?? REFERENCE_DATE;
  const households = graph.ofType('household');
  const outcomes: HouseholdOutcome[] = [];
  const reasonTally = new Map<string, { count: number; criterion: Criterion }>();

  for (const household of households) {
    const residentPages = graph.edges
      .filter((e) => e.kind === 'member_of_household' && e.to === household.ref)
      .map((e) => graph.page(e.from))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        ref: p.ref,
        birth_date: p.properties.birth_date as string | undefined,
        disability_certificate_expiry: p.properties.disability_certificate_expiry as string | undefined,
      }));

    const results = rule.criteria.map((criterion) => ({
      criterion,
      ...evaluateCriterion(
        criterion,
        residentPages,
        { income_band: household.properties.income_band as string | undefined },
        referenceDate,
      ),
    }));

    const hit = results.find((r) => r.state === true);
    if (hit) {
      outcomes.push({ householdRef: household.ref, state: 'eligible', ground: hit.criterion.ground, unknownGrounds: [], reasons: [] });
      continue;
    }
    const unknown = results.filter((r) => r.state === 'unknown');
    if (unknown.length) {
      for (const u of unknown) {
        const existing = reasonTally.get(u.criterion.unknown_reason) ?? { count: 0, criterion: u.criterion };
        existing.count++;
        reasonTally.set(u.criterion.unknown_reason, existing);
      }
      outcomes.push({
        householdRef: household.ref,
        state: 'unknown',
        ground: null,
        unknownGrounds: unknown.map((u) => u.criterion.ground),
        reasons: unknown.map((u) => u.criterion.unknown_reason as string),
      });
      continue;
    }
    outcomes.push({ householdRef: household.ref, state: 'not_eligible', ground: null, unknownGrounds: [], reasons: [] });
  }

  const counts = {
    eligible: outcomes.filter((o) => o.state === 'eligible').length,
    notEligible: outcomes.filter((o) => o.state === 'not_eligible').length,
    unknown: outcomes.filter((o) => o.state === 'unknown').length,
    total: outcomes.length,
  };

  const suppressed = counts.eligible > 0 && counts.eligible < SUPPRESSION.minCellSize;
  return {
    rule,
    outcomes,
    counts,
    unknownByReason: [...reasonTally.entries()].map(([reason, entry]) => ({
      reason,
      count: entry.count,
      ground: entry.criterion.ground,
      property: entry.criterion.property,
      label_he: entry.criterion.label_he,
      label_en: entry.criterion.label_en,
    })),
    suppressed,
    suppressionNote: suppressed
      ? `Fewer than ${SUPPRESSION.minCellSize} households qualify; the count is suppressed so it cannot identify a household.`
      : null,
  };
}

// ------------------------------------------------------------------ planning

export function planQuestion(question: string): { plan: QueryPlan | null; refusal: string | null } {
  const q = question.trim();
  if (!q) return { plan: null, refusal: 'Ask a question about residents, households, businesses or cases.' };

  const wantsEligibility = /(זכאי|זכאות|eligible|entitled)/i.test(q);
  const mentionsDiscount = /(הנחה|אגרת תברואה|discount|fee)/i.test(q);
  if (wantsEligibility || mentionsDiscount) {
    return { plan: { metric: 'count', entity: 'household', rule_code: 'SAN-FEE-DISCOUNT', filter: {} }, refusal: null };
  }
  if (/(תושבים|residents?)/i.test(q)) return { plan: { metric: 'count', entity: 'resident', filter: {} }, refusal: null };
  if (/(בתי עסק|business|עסקים)/i.test(q)) return { plan: { metric: 'count', entity: 'business', filter: {} }, refusal: null };
  if (/(תיקים|cases|בקשות|licen[cs]es)/i.test(q)) return { plan: { metric: 'count', entity: 'case', filter: {} }, refusal: null };

  return {
    plan: null,
    refusal:
      'I can only answer questions declared against the ontology and the rule catalogue today: eligibility for the sanitation-fee discount, or counts of residents, businesses and cases.',
  };
}

// ----------------------------------------------------------------- execution

export function answerQuestion(
  graph: Graph,
  question: string,
  opts: { capturedAt: string; sources: { system: string; label: string }[] },
): QueryAnswer {
  const { plan, refusal } = planQuestion(question);
  const answerId = stableId('ANS', question);
  const sources = opts.sources.map((s) => ({ ...s, asOf: opts.capturedAt }));

  if (!plan) {
    return {
      answer_id: answerId,
      question,
      plan: { metric: 'count', entity: 'resident' },
      rule: null,
      counts: { eligible: null, notEligible: null, unknown: null, total: null },
      suppression: { applied: false, minCellSize: SUPPRESSION.minCellSize, owner: SUPPRESSION.owner },
      unknownReasons: [],
      provisional: false,
      sources,
      freshness: opts.capturedAt,
      explain: {
        plan: { metric: 'count', entity: 'resident' },
        ruleVersion: null,
        steps: ['The question did not match a declared metric or rule, so no query was run.'],
        whatWasNotChecked: ['Everything: nothing was executed.'],
      },
      gapsCreated: 0,
      refused: refusal,
    };
  }

  if (!plan.rule_code) {
    const type = plan.entity;
    const count = graph.ofType(type).length;
    const suppressed = count > 0 && count < SUPPRESSION.minCellSize;
    return {
      answer_id: answerId,
      question,
      plan,
      rule: null,
      counts: { eligible: null, notEligible: null, unknown: null, total: null, value: suppressed ? null : count },
      suppression: { applied: suppressed, minCellSize: SUPPRESSION.minCellSize, owner: SUPPRESSION.owner },
      unknownReasons: [],
      provisional: false,
      sources,
      freshness: opts.capturedAt,
      explain: {
        plan,
        ruleVersion: null,
        steps: [`Counted every ${type} page in the graph.`],
        whatWasNotChecked: ['Whether a count below the minimum cell size should be published.'],
      },
      gapsCreated: 0,
      refused: null,
    };
  }

  const inForce = RULES.filter(
    (r) =>
      r.code === plan.rule_code &&
      r.status === 'approved' &&
      r.effective_from <= REFERENCE_DATE &&
      (!r.effective_to || r.effective_to >= REFERENCE_DATE),
  ).sort((a, b) => b.version - a.version)[0];

  if (!inForce) {
    return {
      answer_id: answerId,
      question,
      plan,
      rule: null,
      counts: { eligible: null, notEligible: null, unknown: null, total: null },
      suppression: { applied: false, minCellSize: SUPPRESSION.minCellSize, owner: SUPPRESSION.owner },
      unknownReasons: [],
      provisional: true,
      sources,
      freshness: opts.capturedAt,
      explain: {
        plan,
        ruleVersion: null,
        steps: [`No approved rule version is in force on ${REFERENCE_DATE}.`],
        whatWasNotChecked: ['The count, because there is no approved rule to count with.'],
      },
      gapsCreated: 0,
      refused: 'No approved eligibility rule is in force for this date. The answer would be provisional; a rule owner has to approve one first.',
    };
  }

  const evaluation = evaluateRule(graph, inForce, { capturedAt: opts.capturedAt });
  const gapsCreated = createGaps(graph, evaluation, opts.capturedAt);

  const answer: QueryAnswer = {
    answer_id: answerId,
    question,
    plan,
    rule: {
      code: inForce.code,
      version: inForce.version,
      status: inForce.status,
      owner: inForce.owner,
      citation: inForce.citation,
      effective_from: inForce.effective_from,
      logic: inForce.logic,
    },
    counts: {
      eligible: evaluation.counts.eligible,
      notEligible: evaluation.counts.notEligible,
      unknown: evaluation.counts.unknown,
      total: evaluation.counts.total,
    },
    suppression: { applied: evaluation.suppressed, minCellSize: SUPPRESSION.minCellSize, owner: SUPPRESSION.owner },
    unknownReasons: evaluation.unknownByReason,
    provisional: false,
    sources,
    freshness: opts.capturedAt,
    explain: {
      plan,
      ruleVersion: inForce.version,
      steps: [
        `Read ${evaluation.counts.total} households with their residents, from the line-of-business tables.`,
        `Applied ${inForce.code} v${inForce.version}, in force from ${inForce.effective_from}, with ${inForce.criteria.length} grounds joined by "${inForce.logic}".`,
        'A household is eligible if any ground holds; undecidable if none holds and a ground is missing; otherwise not eligible.',
      ],
      whatWasNotChecked: evaluation.unknownByReason.length
        ? evaluation.unknownByReason.map((r) => `${r.count} households: ${r.property} is missing, so ${r.label_en} cannot be decided.`)
        : ['Every criterion had the data it needed.'],
    },
    gapsCreated,
    refused: null,
  };

  persistAnswer(graph, answer, opts.capturedAt);
  return answer;
}

function persistAnswer(graph: Graph, answer: QueryAnswer, capturedAt: string): void {
  const ref = refFor('query_answer', answer.answer_id);
  graph.addPage({ ref, type: 'query_answer', title: answer.question, properties: {}, createdAt: capturedAt });
  const values: Record<string, unknown> = {
    answer_id: answer.answer_id,
    question: answer.question,
    rule_code: answer.rule?.code ?? '',
    rule_version: answer.rule?.version ?? 1,
    eligible: answer.counts.eligible ?? 0,
    not_eligible: answer.counts.notEligible ?? 0,
    unknown: answer.counts.unknown ?? 0,
    total: answer.counts.total ?? 0,
    suppressed: answer.suppression.applied,
    computed_at: capturedAt,
    plan: answer.plan,
    unknown_reasons: Object.fromEntries(answer.unknownReasons.map((r) => [r.reason, r.count])),
  };
  for (const [property, value] of Object.entries(values)) {
    graph.setProperty({
      pageRef: ref,
      property,
      value,
      status: 'confirmed',
      provenance: provenance(capturedAt, 'query executor'),
      evidenceIds: [],
    });
  }
  const ruleRef = refFor('eligibility_rule', `${answer.rule?.code}-v${answer.rule?.version}`);
  if (graph.page(ruleRef)) graph.addEdge({ kind: 'answer_of', from: ref, to: ruleRef });
}

/**
 * Every undecidable household is a gap with a named cause. The gap is a
 * knowledge candidate: it is in no answer until a person supplies the value.
 */
function createGaps(graph: Graph, evaluation: Evaluation, capturedAt: string): number {
  let created = 0;
  for (const entry of evaluation.unknownByReason) {
    const id = stableId('GAP', evaluation.rule.code, entry.reason);
    const ref = refFor('knowledge_candidate', id);
    if (graph.page(ref)) continue;
    graph.addPage({
      ref,
      type: 'knowledge_candidate',
      title: `Gap: ${entry.property} missing for the discount rule`,
      properties: {},
      createdAt: capturedAt,
    });
    const values: Record<string, unknown> = {
      candidate_id: id,
      candidate_kind: 'property',
      subject_ref: `${evaluation.rule.code}-v${evaluation.rule.version}`,
      proposal: {
        property: entry.property,
        scope: 'household',
        blocked_decisions: entry.count,
        rule: evaluation.rule.code,
        ground: entry.ground,
      },
      evidence_summary: `${entry.count} of ${evaluation.counts.total} discount decisions cannot be made because ${entry.property} is missing.`,
      support_count: entry.count,
      status: 'open',
      proposed_by: 'eligibility gap detection v1',
    };
    for (const [property, value] of Object.entries(values)) {
      graph.setProperty({
        pageRef: ref,
        property,
        value,
        status: 'candidate',
        provenance: {
          kind: 'inferred',
          source: 'eligibility evaluator',
          method: 'gap detection v1',
          as_of: capturedAt,
          evidence_class: 'attributed',
        },
        evidenceIds: [],
      });
    }
    created++;
  }
  return created;
}
