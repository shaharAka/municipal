// Declared data: the services the department runs, with their SLA and owner.
//
// Not discovered and not inferred: a service with an SLA is a decision, so it
// carries an owner and a citation before any case can be measured against it.

export type ServiceSeed = {
  code: 'LIC' | 'FEE' | 'CMP';
  name_he: string;
  name_en: string;
  sla_days: number;
  requires_inspection: boolean;
  rule_owner: string;
  source_citation: string;
};

export const SERVICES: ServiceSeed[] = [
  {
    code: 'LIC',
    name_he: 'רישיון עסק - מזון',
    name_en: 'Food business licence',
    sla_days: 30,
    requires_inspection: true,
    rule_owner: 'דנה לוי, מנהלת תברואה ובריאות',
    source_citation: 'נוהל רישוי עסק מזון 2025, סעיף 7',
  },
  {
    code: 'FEE',
    name_he: 'הנחה באגרת תברואה',
    name_en: 'Sanitation fee discount',
    sla_days: 21,
    requires_inspection: false,
    rule_owner: 'משה טל, רכז גזברות',
    source_citation: 'נוהל הנחות באגרת תברואה, סעיף 2',
  },
  {
    code: 'CMP',
    name_he: 'קריאת תברואה והדברה',
    name_en: 'Sanitation and pest complaint',
    sla_days: 7,
    requires_inspection: false,
    rule_owner: 'יוסי כהן, סגן מנהל',
    source_citation: 'נוהל קריאות תברואה 2024',
  },
];
