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
  unknownByReason: {
    reason: string;
    count: number;
    ground: string;
    property: string;
    property_label_he: string;
    label_he: string;
    label_en: string;
  }[];
  suppressed: boolean;
  suppressionNote: string | null;
};

export type QueryPlan = {
  metric: 'count';
  entity: 'household' | 'resident' | 'business' | 'case' | 'complaint';
  rule_code?: string;
  filter?: Record<string, unknown>;
};

export type QueryAnswer = {
  answer_id: string;
  question: string;
  /** One line in Hebrew saying what the system understood before it ran. */
  interpretationHe: string;
  plan: QueryPlan;
  rule: { code: string; version: number; status: string; owner: string; citation: string; effective_from: string; logic: string } | null;
  counts: { eligible: number | null; notEligible: number | null; unknown: number | null; total: number | null; value?: number };
  suppression: { applied: boolean; minCellSize: number; owner: string };
  unknownReasons: Evaluation['unknownByReason'];
  provisional: boolean;
  sources: { system: string; label: string; asOf: string }[];
  freshness: string;
  explain: { plan: QueryPlan; ruleVersion: number | null; steps: string[]; whatWasNotChecked: string[] };
  /** The derivation in the language the person reads. */
  explainHe: { steps: string[]; whatWasNotChecked: string[] };
  gapsCreated: number;
  refused: string | null;
};

const DAY = 86_400_000;

const ENTITY_HE: Record<QueryPlan['entity'], string> = {
  household: 'משקי בית',
  resident: 'תושבים',
  business: 'עסקים',
  case: 'תיקים',
  complaint: 'קריאות תברואה',
};

const ENTITY_DEF_HE: Record<QueryPlan['entity'], string> = {
  household: 'משקי הבית',
  resident: 'התושבים',
  business: 'העסקים',
  case: 'התיקים',
  complaint: 'קריאות התברואה',
};

const ENTITY_SOURCE: Record<QueryPlan['entity'], string> = {
  household: 'sql',
  resident: 'sql',
  business: 'sql',
  case: 'sql',
  complaint: 'sql',
};

/** The attribute that is missing, not the rule criterion that could not be applied. */
const PROPERTY_LABELS_HE: Record<string, string> = {
  income_band: 'נתון הכנסה של משק הבית',
  birth_date: 'תאריך לידה',
  disability_certificate_expiry: 'תוקף תעודת נכות',
  inspection_zone: 'אזור הפיקוח',
};

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
  opts: { referenceDate?: string; capturedAt: string; missingPolicy?: 'unknown' | 'not_eligible' },
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
    if (unknown.length && (opts.missingPolicy ?? 'unknown') === 'unknown') {
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
      property_label_he: PROPERTY_LABELS_HE[entry.criterion.property] ?? entry.criterion.property,
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

type PlannedQuestion = {
  plan: QueryPlan | null;
  refusal: string | null;
  interpretationHe: string;
};

const ENTITY_PATTERNS: { entity: QueryPlan['entity']; pattern: RegExp; labelHe: string }[] = [
  { entity: 'household', pattern: /(משקי\s*בית|משק\s*בית|households?)/i, labelHe: 'משקי בית' },
  { entity: 'resident', pattern: /(תושבים|תושב|residents?)/i, labelHe: 'תושבים' },
  { entity: 'business', pattern: /(בתי\s*עסק|עסקים|עסק|business(?:es)?)/i, labelHe: 'עסקים' },
  { entity: 'case', pattern: /(תיקים|תיק|cases?)/i, labelHe: 'תיקים' },
  { entity: 'complaint', pattern: /(קריאות|קריאה|תלונות|תלונה|complaints?)/i, labelHe: 'קריאות תברואה' },
];

/** Words that describe a filter or a slice the planner does not implement yet. */
const QUALIFIERS: { pattern: RegExp; labelHe: string }[] = [
  { pattern: /(ממתין|ממתינים|ממתינות|מחכה|מחכים|מחכות|waiting|pending)/i, labelHe: 'ממתין' },
  { pattern: /(פתוחים|פתוחות|פתוח|open)/i, labelHe: 'פתוח' },
  { pattern: /(בלי|ללא)\s+רישיון/i, labelHe: 'בלי רישיון' },
  { pattern: /(פיקוח|ביקורת|inspection)/i, labelHe: 'פיקוח' },
  { pattern: /(החודש|השבוע|היום|כרגע|השנה|this month|this week|today|now)/i, labelHe: 'תקופה' },
  { pattern: /(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|january|february|march|april|may|june|july|august|september|october|november|december)/i, labelHe: 'חודש' },
  { pattern: /(חורף|קיץ|אביב|סתיו|רבעון|quarter)/i, labelHe: 'תקופה' },
  { pattern: /(?:^|\s)(באזור|בשכונה|בשכונת|ברחוב|לפי|במחוז|ביישוב|בקריית)(?=\s|$|[?.,!])/i, labelHe: 'מיקום או חיתוך' },
  { pattern: /(מעל|מתחת|יותר\s*מ|פחות\s*מ|above|below)/i, labelHe: 'סף' },
  { pattern: /(סטטוס|status|נסגר|נסגרו|סגור|סגורים|סגורות|closed|בטיפול|חריג|חריגה|חריגים|באיחור|overdue|פעיל|פעילים|active|טופל|טופלו)/i, labelHe: 'סטטוס' },
  { pattern: /(הכנסה|הכנסות|income|שכר)/i, labelHe: 'נתון הכנסה' },
  { pattern: /(נכות|נכה|אזרח\s*ותיק|גיל|ותק|disability|\bage\b)/i, labelHe: 'מאפיין תושב' },
  { pattern: /\b20\d{2}\b/, labelHe: 'שנה' },
  { pattern: /(אתמול|לאחרונה|לפני|אחרי|last\s+week|yesterday|recently)/i, labelHe: 'תקופה' },
  { pattern: /(שירות|service|\bLIC\b|\bSAN\b|\bCMP\b)/i, labelHe: 'שירות' },
  { pattern: /(מזיקים|מכרסמים|ריח|רעש|pests?|מסוג|סוג\s+קריאה)/i, labelHe: 'סוג קריאה' },
  { pattern: /\b(?:CASE|BUS|HHD|CMP|PRP)-\d+/i, labelHe: 'מזהה רשומה' },
];

export function planQuestion(question: string): PlannedQuestion {
  const q = question.trim();
  if (!q) {
    return {
      plan: null,
      refusal: 'לא הוקלדה שאלה.',
      interpretationHe: 'לא הוקלדה שאלה, ולכן לא הורצה דבר.',
    };
  }

  const isCount = /(כמה|מה\s*מספר|how\s*many|what\s*number)/i.test(q);
  const wantsEligibility = /(זכאי|זכאות|eligible|entitled|הנחה)/i.test(q);
  const entities = ENTITY_PATTERNS.filter((entry) => entry.pattern.test(q));
  const qualifiers = QUALIFIERS.filter((entry) => entry.pattern.test(q)).map((entry) => entry.labelHe);
  const entity = entities.length === 1 ? entities[0] : null;
  const entityLabel = entity?.labelHe ?? 'רשומה';

  if (wantsEligibility) {
    // Eligibility is a count plan. "What is the rule?" and "who is eligible?"
    // are different questions; answering them with the aggregate would be the
    // same credibility failure as dropping a filter.
    if (!isCount) {
      return {
        plan: null,
        refusal: 'לא הצגתי מספר, כי זו אינה שאלת ספירה.',
        interpretationHe:
          'הבנתי שמדובר בזכאות להנחת אגרת תברואה, אבל השאלה אינה שואלת כמה זכאים. לא הוצג מספר; אפשר לשאול "כמה משקי בית זכאים?".',
      };
    }
    // The declared rule is a household rule. A question about businesses and
    // discounts is a different rule, not a filter we may silently drop.
    if (entities.some((entry) => entry.entity === 'business')) {
      return {
        plan: null,
        refusal: 'הכלל המוכר הוא הנחה למשקי בית; שאלת זכאות על עסקים אינה ממופה עדיין.',
        interpretationHe:
          'הבנתי שמדובר בעסקים ובהנחה, אבל כלל הזכאות המוכר הוא למשקי בית. לא הוצג מספר.',
      };
    }
    const otherEntity = entities.find((entry) => entry.entity !== 'household');
    if (otherEntity) {
      return {
        plan: null,
        refusal: `הכלל המוכר הוא הנחה למשקי בית; שאלת זכאות על ${otherEntity.labelHe} אינה ממופה עדיין.`,
        interpretationHe: `הבנתי שמדובר ב${otherEntity.labelHe} ובהנחה, אבל כלל הזכאות המוכר חל על משקי בית. לא הוצג מספר.`,
      };
    }
    if (qualifiers.length) {
      return {
        plan: null,
        refusal: 'לא הצגתי מספר, כי הסינון בשאלה עדיין לא ממופה למודל.',
        interpretationHe: `הבנתי שמדובר בזכאות להנחת אגרת תברואה, אבל הסינון (${qualifiers.join(', ')}) לא נתמך עדיין.`,
      };
    }
    return {
      plan: { metric: 'count', entity: 'household', rule_code: 'SAN-FEE-DISCOUNT', filter: {} },
      refusal: null,
      interpretationHe: 'כל משקי הבית במודל, לפי כלל SAN-FEE-DISCOUNT.',
    };
  }

  if (entities.length > 1) {
    return {
      plan: null,
      refusal: 'השאלה מתייחסת ליותר מסוג רשומה אחד.',
      interpretationHe: `הבנתי שמדובר ב${entities.map((entry) => entry.labelHe).join(' ו')}, ולכן לא בחרתי סוג אחד לספור.`,
    };
  }

  if (entity && isCount) {
    if (qualifiers.length) {
      return {
        plan: null,
        refusal: 'לא הצגתי מספר, כי הסינון בשאלה עדיין לא ממופה למודל.',
        interpretationHe: `הבנתי שמדובר ב${entity.labelHe}, אבל הסינון (${qualifiers.join(', ')}) לא נתמך עדיין. לא הוצג מספר.`,
      };
    }
    return {
      plan: { metric: 'count', entity: entity.entity, filter: {} },
      refusal: null,
      interpretationHe: `כל ${entity.labelHe} במודל, ללא סינון.`,
    };
  }

  if (entity && qualifiers.length) {
    return {
      plan: null,
      refusal: 'לא הצגתי מספר, כי לא זוהתה שאלת ספירה נתמכת.',
      interpretationHe: `הבנתי שמדובר ב${entity.labelHe}; הסינון (${qualifiers.join(', ')}) ושאלת הסטטוס לא נתמכים עדיין.`,
    };
  }

  return {
    plan: null,
    refusal:
      'אפשר לשאול על זכאות להנחת אגרת תברואה, או לספור משקי בית, תושבים, עסקים, תיקים וקריאות תברואה.',
    interpretationHe:
      'לא זוהתה שאלה נתמכת. השאלה לא הורצה, ולכן לא הוצג מספר.',
  };
}

// ----------------------------------------------------------------- execution

export function answerQuestion(
  graph: Graph,
  question: string,
  opts: { capturedAt: string; sources: { system: string; label: string }[] },
): QueryAnswer {
  const { plan, refusal, interpretationHe } = planQuestion(question);
  const answerId = stableId('ANS', question);
  const readSystems = plan ? (plan.rule_code ? ['sql'] : [ENTITY_SOURCE[plan.entity]]) : [];
  const sources = opts.sources
    .filter((source) => readSystems.includes(source.system))
    .map((source) => ({ ...source, asOf: opts.capturedAt }));

  if (!plan) {
    return {
      answer_id: answerId,
      question,
      interpretationHe,
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
      explainHe: {
        steps: ['השאלה לא תאמה מדד או כלל מוצהר, ולכן לא הורצה שאילתה.'],
        whatWasNotChecked: ['הכול: דבר לא הורץ.'],
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
      interpretationHe: `כל ${ENTITY_DEF_HE[type]} במודל${suppressed ? '; המדד מוסתר בשל גודל תא מינימלי' : ''}.`,
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
      explainHe: {
        steps: [`נספרו כל ${ENTITY_HE[type]} בגרף.`],
        whatWasNotChecked: ['האם מותר לפרסם מדד מתחת לגודל התא המינימלי.'],
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
      interpretationHe: `${interpretationHe} לא נמצאה גרסת כלל מאושרת ותקפה, ולכן לא הוצג מספר.`,
      plan,
      rule: null,
      counts: { eligible: null, notEligible: null, unknown: null, total: null },
      suppression: { applied: false, minCellSize: SUPPRESSION.minCellSize, owner: SUPPRESSION.owner },
      unknownReasons: [],
      provisional: true,
      sources: [],
      freshness: opts.capturedAt,
      explain: {
        plan,
        ruleVersion: null,
        steps: [`No approved rule version is in force on ${REFERENCE_DATE}.`],
        whatWasNotChecked: ['The count, because there is no approved rule to count with.'],
      },
      explainHe: {
        steps: [`אין גרסת כלל מאושרת ותקפה ל-${REFERENCE_DATE}.`],
        whatWasNotChecked: ['הספירה — כי אין כלל מאושר לספור לפיו.'],
      },
      gapsCreated: 0,
      refused: 'אין גרסת כלל מאושרת ותקפה לתאריך הזה. התשובה תהיה בגדר טיוטה עד שבעל הכלל יאשר גרסה.',
    };
  }

  const evaluation = evaluateRule(graph, inForce, { capturedAt: opts.capturedAt });
  const gapsCreated = createGaps(graph, evaluation, opts.capturedAt);

  const answer: QueryAnswer = {
    answer_id: answerId,
    question,
    interpretationHe: `כל ${evaluation.counts.total} משקי הבית במודל, לפי כלל ${inForce.code} גרסה ${inForce.version}${inForce.effective_from ? ` (בתוקף מ-${inForce.effective_from})` : ''}.`,
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
    explainHe: {
      steps: [
        `נקראו ${evaluation.counts.total} משקי בית והתושבים שלהם מטבלאות מערכות ההפעלה.`,
        `הופעל ${inForce.code} גרסה ${inForce.version}, בתוקף מ-${inForce.effective_from}, עם ${inForce.criteria.length} עילות בקישור ״${inForce.logic === 'any' ? 'או' : 'ו'}״.`,
        'משק בית זכאי אם עילה אחת מתקיימת; לא ניתן להכריע אם אף עילה אינה מתקיימת וחסר נתון; אחרת — אינו זכאי.',
      ],
      whatWasNotChecked: evaluation.unknownByReason.length
        ? evaluation.unknownByReason.map((r) => `${r.count} משקי בית: חסר ${r.property_label_he} (${r.property}), ולכן לא ניתן להכריע.`)
        : ['לכל קריטריון היה הנתון הנדרש.'],
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
