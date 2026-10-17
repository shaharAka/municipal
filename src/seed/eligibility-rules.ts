// The declared discount rules. Two versions, because a rule that never changed
// is a rule nobody has audited: the age threshold moved from 70 to 67 when the
// bylaw was amended, and an answer must say which version decided it.

export type Criterion = {
  code: string;
  label_he: string;
  label_en: string;
  ground: 'senior_age' | 'disability' | 'income';
  applies_to: 'resident' | 'household';
  property: string;
  operator: 'age_gte' | 'valid_on' | 'equals' | 'lte';
  value: number | string | boolean;
  unknown_reason: string;
};

export type RuleSeed = {
  code: string;
  version: number;
  name_he: string;
  name_en: string;
  service_code: 'LIC' | 'FEE' | 'CMP';
  status: 'draft' | 'approved' | 'superseded';
  owner: string;
  citation: string;
  effective_from: string;
  effective_to?: string;
  logic: 'any' | 'all';
  criteria: Criterion[];
};

const SENIOR: Criterion = {
  code: 'SENIOR',
  label_he: 'אזרח ותיק',
  label_en: 'Senior householder',
  ground: 'senior_age',
  applies_to: 'resident',
  property: 'birth_date',
  operator: 'age_gte',
  value: 67,
  unknown_reason: 'birth_date_missing',
};

const DISABILITY: Criterion = {
  code: 'DISABILITY',
  label_he: 'תעודת נכות בתוקף',
  label_en: 'Valid disability certificate',
  ground: 'disability',
  applies_to: 'resident',
  property: 'disability_certificate_expiry',
  operator: 'valid_on',
  value: 'reference_date',
  unknown_reason: 'disability_certificate_missing',
};

const INCOME: Criterion = {
  code: 'INCOME',
  label_he: 'הכנסה נמוכה',
  label_en: 'Low income',
  ground: 'income',
  applies_to: 'household',
  property: 'income_band',
  operator: 'equals',
  value: 'LOW',
  unknown_reason: 'income_band_missing',
};

export const RULES: RuleSeed[] = [
  {
    code: 'SAN-FEE-DISCOUNT',
    version: 1,
    name_he: 'הנחה באגרת תברואה',
    name_en: 'Sanitation fee discount',
    service_code: 'FEE',
    status: 'superseded',
    owner: 'משה טל, רכז גזברות',
    citation: 'נוהל הנחות באגרת תברואה (תשפ"ד), סעיף 2',
    effective_from: '2024-01-01',
    effective_to: '2025-12-31',
    logic: 'any',
    criteria: [SENIOR, DISABILITY].map((c) =>
      c.ground === 'senior_age' ? { ...c, value: 70 } : c,
    ),
  },
  {
    code: 'SAN-FEE-DISCOUNT',
    version: 2,
    name_he: 'הנחה באגרת תברואה',
    name_en: 'Sanitation fee discount',
    service_code: 'FEE',
    status: 'approved',
    owner: 'משה טל, רכז גזברות',
    citation: 'צו עזר לתברואה (תיקון תשפ"ו), סעיף 12(א); נוהל הנחות, סעיף 2',
    effective_from: '2026-01-01',
    logic: 'any',
    criteria: [SENIOR, DISABILITY, INCOME],
  },
];

/** Declared, owned: the smallest count this answer may show without rounding. */
export const SUPPRESSION = {
  minCellSize: 5,
  owner: 'גלית אדלר, יועצת משפטית',
  reason: 'A cell below five can identify a household in a small city.',
};

export const REFERENCE_DATE = '2026-10-17';
