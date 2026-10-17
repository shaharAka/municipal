// Proactive rights: which households meet a declared discount rule and are not
// receiving it. This is the turn from "how many are eligible?" to "who is
// eligible, and are they getting it?".
//
// The rule engine reads the resident records here, in the platform. No record
// is sent to a model: the calculation is declared criteria over columns, and
// the outreach letter is a declared template. Names and addresses leave this
// module only for a viewer whose role handles discount requests; everyone else
// gets counts, suppressed below the declared minimum cell size.

import type { Fixture } from '../cloud/fixtures.ts';
import { REFERENCE_DATE, SUPPRESSION } from '../seed/eligibility-rules.ts';

type Row = Record<string, unknown>;

export type GroundCode = 'DISABILITY' | 'SENIOR_LOW_INCOME' | 'RESERVIST';

export type Ground = {
  code: GroundCode;
  label_he: string;
  reads: string[];
  /** Share of the annual charge the ground removes. Declared for the demo, not quoted from law. */
  rate: number;
  connected: boolean;
  source_he: string;
};

export const ARNONA_RULE = {
  code: 'ARNONA-RELIEF',
  version: 1,
  name_he: 'הנחה בארנונה למגורים',
  owner: 'משה טל, רכז גזברות',
  citation: 'תקנות הסדרים במשק המדינה (הנחה מארנונה), התשנ״ג–1993',
  status_he: 'כלל להדגמה · השיעורים טעונים אישור של היועצת המשפטית',
  effective_from: '2026-01-01',
  grounds: [
    {
      code: 'DISABILITY',
      label_he: 'תעודת נכות בתוקף',
      reads: ['dbo.residents.disability_certificate_expiry'],
      rate: 0.4,
      connected: true,
      source_he: 'מערכות הפעלה · מרשם התושבים',
    },
    {
      code: 'SENIOR_LOW_INCOME',
      label_he: 'אזרח ותיק, בן 67 ומעלה, במשק בית עם הכנסה נמוכה',
      reads: ['dbo.residents.birth_date', 'dbo.households.income_band'],
      rate: 0.25,
      connected: true,
      source_he: 'מערכות הפעלה · מרשם התושבים',
    },
    {
      code: 'RESERVIST',
      label_he: 'שירות מילואים פעיל',
      reads: ['אישורי שירות מילואים'],
      rate: 0.05,
      connected: false,
      source_he: 'אישורי שירות מילואים · לא מחובר',
    },
  ] as Ground[],
};

/** Declared, owned: every number this page multiplies by. */
export const RIGHTS_PARAMS = {
  tariffPerSqm: {
    value: 58,
    owner: 'משה טל, רכז גזברות',
    reason: 'תעריף ארנונה שנתי למ״ר מגורים. ערך להדגמה, לא התעריף של העירייה.',
  },
  reservistAgeRange: {
    value: [21, 45] as const,
    owner: 'משה טל, רכז גזברות',
    reason: 'טווח הגילים שבו אי אפשר לשלול שירות מילואים בלי המקור.',
  },
};

export type Outreach = { by: string; at: string; letter: string; residentId: string };

// The billing system's discount flag is read-only and lives outside the graph.
// It is derived from the household id, so it never disturbs the fixture's
// random stream (and the numbers every other screen shows).
const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 100;
};

export function arnonaBilling(householdId: string): { discountApplied: boolean } {
  return { discountApplied: hash(`arnona|${householdId}`) < 30 };
}

const ageOn = (birth: unknown, on: string) => {
  if (typeof birth !== 'string' || !birth) return null;
  const b = new Date(birth);
  const d = new Date(on);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
};

export type Qualifier = {
  residentId: string;
  name: string;
  firstName: string;
  ground: GroundCode;
  groundHe: string;
  evidence: { table: string; row: string; column: string; value: string; sourceHe: string; columnHe: string }[];
};

export type HouseholdResult = {
  householdId: string;
  address: string;
  street: string;
  city: string;
  annualArnona: number;
  qualifiers: Qualifier[];
  bestGround: GroundCode | null;
  unclaimedAnnual: number;
  receiving: boolean;
  cannotCheck: ('income_band_missing' | 'reservist_source_not_connected')[];
};

export function evaluateHouseholds(fixture: Fixture): HouseholdResult[] {
  const rows = (name: string) => (fixture.tables[name]?.rows ?? []) as Row[];
  const properties = new Map(rows('properties').map((p) => [String(p.property_id), p]));
  const residents = rows('residents');
  const [minAge, maxAge] = RIGHTS_PARAMS.reservistAgeRange.value;
  const ground = (code: GroundCode) => ARNONA_RULE.grounds.find((g) => g.code === code)!;

  return rows('households').map((hh) => {
    const id = String(hh.household_id);
    const property = properties.get(String(hh.property_id)) ?? {};
    const area = Number(property.floor_area_sqm ?? 0);
    const annualArnona = Math.round(area * RIGHTS_PARAMS.tariffPerSqm.value);
    const members = residents.filter((r) => String(r.household_id) === id);
    const qualifiers: Qualifier[] = [];
    const cannotCheck = new Set<HouseholdResult['cannotCheck'][number]>();

    for (const r of members) {
      const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim();
      const base = { residentId: String(r.resident_id), name, firstName: String(r.first_name ?? '') };
      const expiry = r.disability_certificate_expiry;
      if (typeof expiry === 'string' && expiry >= REFERENCE_DATE) {
        qualifiers.push({
          ...base,
          ground: 'DISABILITY',
          groundHe: ground('DISABILITY').label_he,
          evidence: [{ table: 'dbo.residents', row: base.residentId, column: 'disability_certificate_expiry', value: expiry.slice(0, 10), sourceHe: 'מרשם התושבים', columnHe: 'תוקף תעודת נכות' }],
        });
      }
      const age = ageOn(r.birth_date, REFERENCE_DATE);
      if (age !== null && age >= 67) {
        if (hh.income_band === 'LOW') {
          qualifiers.push({
            ...base,
            ground: 'SENIOR_LOW_INCOME',
            groundHe: ground('SENIOR_LOW_INCOME').label_he,
            evidence: [
              { table: 'dbo.residents', row: base.residentId, column: 'birth_date', value: String(r.birth_date).slice(0, 10), sourceHe: 'מרשם התושבים', columnHe: 'תאריך לידה' },
              { table: 'dbo.households', row: id, column: 'income_band', value: 'נמוכה', sourceHe: 'משקי בית', columnHe: 'רמת הכנסה' },
            ],
          });
        } else if (hh.income_band == null) {
          cannotCheck.add('income_band_missing');
        }
      }
      if (age !== null && age >= minAge && age <= maxAge) cannotCheck.add('reservist_source_not_connected');
    }

    // One discount per household: the largest ground applies.
    const best = qualifiers.reduce<Qualifier | null>(
      (acc, q) => (!acc || ground(q.ground).rate > ground(acc.ground).rate ? q : acc),
      null,
    );
    const receiving = arnonaBilling(id).discountApplied;
    return {
      householdId: id,
      address: String(property.address_raw ?? ''),
      street: String(property.street_name ?? ''),
      city: String(property.city ?? ''),
      annualArnona,
      qualifiers,
      bestGround: best?.ground ?? null,
      unclaimedAnnual: best && !receiving ? Math.round(annualArnona * ground(best.ground).rate) : 0,
      receiving,
      cannotCheck: [...cannotCheck],
    };
  });
}

const suppress = (n: number) => (n > 0 && n < SUPPRESSION.minCellSize ? null : n);

export function rightsView(
  fixture: Fixture,
  access: { canSeeNames: boolean; whyHe: string },
  outreach: Map<string, Outreach>,
) {
  const all = evaluateHouseholds(fixture);
  const eligible = all.filter((h) => h.qualifiers.length);
  const notReceiving = eligible.filter((h) => !h.receiving);
  const open = notReceiving.filter((h) => !outreach.has(h.householdId));
  const unclaimed = notReceiving.reduce((a, h) => a + h.unclaimedAnnual, 0);
  const shown = (n: number) => (access.canSeeNames ? n : suppress(n));

  const grounds = ARNONA_RULE.grounds.map((g) => {
    const hit = eligible.filter((h) => h.bestGround === g.code);
    const missing = hit.filter((h) => !h.receiving);
    return {
      code: g.code,
      labelHe: g.label_he,
      sourceHe: g.source_he,
      connected: g.connected,
      rate: g.rate,
      eligible: access.canSeeNames ? hit.length : suppress(hit.length),
      notReceiving: access.canSeeNames ? missing.length : suppress(missing.length),
      unclaimedAnnual: missing.reduce((a, h) => a + h.unclaimedAnnual, 0),
      unchecked:
        g.code === 'RESERVIST'
          ? all.filter((h) => h.cannotCheck.includes('reservist_source_not_connected')).length
          : g.code === 'SENIOR_LOW_INCOME'
            ? all.filter((h) => h.cannotCheck.includes('income_band_missing')).length
            : 0,
    };
  });

  return {
    rule: ARNONA_RULE,
    params: RIGHTS_PARAMS,
    suppression: SUPPRESSION,
    asOf: REFERENCE_DATE,
    access,
    totals: {
      households: all.length,
      eligible: shown(eligible.length),
      receiving: shown(eligible.length - notReceiving.length),
      notReceiving: shown(notReceiving.length),
      outreachSent: notReceiving.length - open.length,
      unclaimedAnnual: unclaimed,
      incomeMissing: all.filter((h) => h.cannotCheck.includes('income_band_missing')).length,
      reservistUnchecked: all.filter((h) => h.cannotCheck.includes('reservist_source_not_connected')).length,
    },
    grounds,
    worklist: access.canSeeNames
      ? notReceiving
          .sort((a, b) => b.unclaimedAnnual - a.unclaimedAnnual)
          .map((h) => ({ ...h, outreach: outreach.get(h.householdId) ?? null }))
      : [],
    boundary: {
      engineRead: [
        { he: 'תוקף תעודת נכות', code: 'dbo.residents.disability_certificate_expiry' },
        { he: 'תאריך לידה', code: 'dbo.residents.birth_date' },
        { he: 'רמת הכנסה של משק הבית', code: 'dbo.households.income_band' },
        { he: 'שטח הנכס', code: 'dbo.properties.floor_area_sqm' },
        { he: 'האם רשומה הנחה בארנונה', code: 'billing.arnona_discount' },
      ],
      rowsProcessed: all.length,
      rowsSentToModel: 0,
    },
  };
}

export function outreachLetter(h: HouseholdResult, clerk: string): { residentId: string; text: string } | null {
  const best = h.qualifiers.find((q) => q.ground === h.bestGround);
  if (!best) return null;
  const amount = h.unclaimedAnnual.toLocaleString('he-IL');
  const text = [
    'הנדון: ייתכן שמגיעה לך הנחה בארנונה',
    '',
    `שלום ${best.name},`,
    '',
    `לפי הנתונים שבידי העירייה, ייתכן שמשק הבית שלך ברחוב ${h.address.split(',')[0]} זכאי להנחה בארנונה על בסיס: ${best.groundHe}.`,
    `לפי החיוב הנוכחי, ההנחה שווה כ־${amount} ₪ בשנה.`,
    '',
    'אין צורך למלא טופס: אפשר להשיב למכתב זה או לפנות למוקד העירוני, ואנחנו נשלים את הבדיקה מול המסמכים.',
    '',
    `פנינו אליך ביוזמתנו, לפי ${ARNONA_RULE.name_he} (${ARNONA_RULE.citation}).`,
    '',
    'בברכה,',
    clerk,
    `עיריית ${h.city}`,
  ].join('\n');
  return { residentId: best.residentId, text };
}
