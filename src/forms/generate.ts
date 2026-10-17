// Forms generated from the ontology. Never hand-coded.
//
// A form is three documents derived from one page type: a JSON Schema for the
// value, a UI schema a renderer follows, and an Adaptive Card for Teams. The
// same source decides validation, which is why a form cannot drift from the
// model it was generated from.

import type { Ontology, Schema } from '../ontology/compose.ts';
import { validateValue } from '../ontology/compose.ts';
import type { Graph } from '../graph/graph.ts';
import { refFor, type Provenance } from '../graph/graph.ts';

export type FormKind = 'interview' | 'application' | 'internal';

export type FormField = {
  name: string;
  labelHe: string;
  labelEn: string;
  description: string;
  widget: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  required: boolean;
  readOnly: boolean;
  options: string[];
  unit: string | null;
  sensitivity: number;
};

export type FormSpec = {
  form_id: string;
  kind: FormKind;
  page_type: string;
  titleHe: string;
  titleEn: string;
  direction: 'rtl' | 'ltr';
  fields: FormField[];
  json_schema: Record<string, unknown>;
  ui_schema: Record<string, unknown>;
  adaptive_card: Record<string, unknown>;
};

const HEBREW_LABELS: Record<string, string> = {
  income_band: 'רצועת הכנסה',
  household_size: 'מספר נפשות במשק הבית',
  discount_status: 'מצב ההנחה',
  first_name: 'שם פרטי',
  last_name: 'שם משפחה',
  birth_date: 'תאריך לידה',
  residency_start_date: 'תחילת תושבות',
  disability_certificate_expiry: 'תוקף תעודת נכות',
  national_id: 'מספר זהות',
  phone: 'טלפון',
  address_raw: 'כתובת',
  resident_id: 'מזהה תושב',
  household_id: 'מזהה משק בית',
  property_id: 'מזהה נכס',
  street_name: 'רחוב',
  house_number: 'מספר בית',
  city: 'עיר',
  floor_area_sqm: 'שטח (מ״ר)',
  sanitation_fee_annual: 'אגרת תברואה שנתית',
  business_name: 'שם העסק',
  registry_number: 'מספר עוסק',
  category: 'סוג עסק',
  risk_level: 'רמת סיכון',
  contact_name: 'איש קשר',
  contact_email: 'דואר אלקטרוני',
  licence_status: 'מצב רישיון',
};

const humanize = (name: string) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const ID_LIKE = /(^|_)(id)$/;

function widgetFor(schema: Schema, name: string): FormField['widget'] {
  if (schema.enum) return 'select';
  if (schema.format === 'date' || schema.format === 'date-time') return 'date';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'boolean') return 'checkbox';
  if (/text$|description|notes|findings/i.test(name)) return 'textarea';
  return 'text';
}

/**
 * Generates the whole form from a page type. `only` narrows it to the fields a
 * particular conversation needs, in the order given.
 */
export function generateForm(
  onto: Ontology,
  pageType: string,
  kind: FormKind,
  opts: { only?: string[]; titleHe?: string; titleEn?: string } = {},
): FormSpec {
  const spec = onto.pageTypes[pageType];
  if (!spec) throw new Error(`No page type "${pageType}" in the ontology`);

  const names = opts.only?.length
    ? opts.only.filter((name) => spec.properties[name])
    : Object.keys(spec.properties).filter((name) => name !== 'provenance');

  const fields: FormField[] = names.map((name) => {
    const schema = spec.properties[name];
    const readOnly = ID_LIKE.test(name);
    return {
      name,
      labelHe: HEBREW_LABELS[name] ?? humanize(name),
      labelEn: humanize(name),
      description: schema.description ?? '',
      widget: widgetFor(schema, name),
      required: spec.required.includes(name),
      readOnly,
      options: [...(schema.enum ?? [])].map(String),
      unit: schema['x-unit'] ?? null,
      sensitivity: name === 'national_id' || name === 'phone' ? 3 : 1,
    };
  });

  const properties: Record<string, unknown> = {};
  for (const name of names) properties[name] = schemaOf(onto, spec.properties[name]);
  const required = fields.filter((f) => f.required).map((f) => f.name);

  const titleHe = opts.titleHe ?? spec.description ?? pageType;
  const titleEn = opts.titleEn ?? `${humanize(pageType)} form`;

  return {
    form_id: `form-${kind}-${pageType}${opts.only?.length ? '-' + opts.only.join('-') : ''}`,
    kind,
    page_type: pageType,
    titleHe,
    titleEn,
    direction: 'rtl',
    fields,
    json_schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: titleEn,
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
    ui_schema: {
      order: names,
      direction: 'rtl',
      fields: Object.fromEntries(
        fields.map((field) => [
          field.name,
          {
            widget: field.widget,
            label_he: field.labelHe,
            label_en: field.labelEn,
            help: field.description,
            required: field.required,
            read_only: field.readOnly,
            options: field.options,
            unit: field.unit,
            sensitivity: field.sensitivity,
          },
        ]),
      ),
    },
    adaptive_card: adaptiveCard(titleEn, fields),
  };
}

function schemaOf(onto: Ontology, schema: Schema): Record<string, unknown> {
  if (!schema.$ref) return { ...schema };
  const name = schema.$ref.replace('#/defs/', '');
  const def = onto.defs[name];
  return def ? { ...def } : { type: 'string' };
}

function adaptiveCard(title: string, fields: FormField[]): Record<string, unknown> {
  const body: Record<string, unknown>[] = [{ type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true }];
  for (const field of fields) {
    const label = field.labelEn;
    const inputId = field.name;
    if (field.widget === 'select') {
      body.push({
        type: 'Input.ChoiceSet',
        id: inputId,
        label,
        isRequired: field.required,
        style: 'compact',
        choices: field.options.map((option) => ({ title: option, value: option })),
      });
    } else if (field.widget === 'date') {
      body.push({ type: 'Input.Date', id: inputId, label, isRequired: field.required });
    } else if (field.widget === 'checkbox') {
      body.push({ type: 'Input.Toggle', id: inputId, title: label });
    } else if (field.widget === 'number') {
      body.push({ type: 'Input.Number', id: inputId, label, isRequired: field.required });
    } else {
      body.push({ type: 'Input.Text', id: inputId, label, isRequired: field.required, isMultiline: field.widget === 'textarea' });
    }
  }
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
    actions: [{ type: 'Action.Submit', title: 'Send' }],
  };
}

// --------------------------------------------------------------- submission

export type FormSubmission = {
  values: Record<string, unknown>;
  typed_by: string;
  prefilled: Record<string, string>;
};

export type BuiltFact = { property: string; value: unknown; provenance: Provenance; status: 'candidate' | 'confirmed' };

/** Validates a submission against the form's own schema, not a copy of it. */
export function validateSubmission(
  onto: Ontology,
  form: FormSpec,
  submission: FormSubmission,
  asOf: string,
): { problems: string[]; facts: BuiltFact[] } {
  const problems: string[] = [];
  const schema = form.json_schema as Schema;
  const known = new Set(form.fields.map((f) => f.name));

  for (const key of Object.keys(submission.values)) {
    if (!known.has(key)) problems.push(`"${key}" is not a field on this form`);
  }
  for (const field of form.fields) {
    const value = submission.values[field.name];
    if (value === undefined || value === null || value === '') {
      if (field.required) problems.push(`${field.name} is required`);
      continue;
    }
    const propertySchema = (schema.properties as Record<string, Schema>)[field.name];
    validateValue(propertySchema, value, onto, field.name, problems);
  }
  if (problems.length) return { problems, facts: [] };

  const facts: BuiltFact[] = form.fields
    .filter((f) => submission.values[f.name] !== undefined && submission.values[f.name] !== null && submission.values[f.name] !== '')
    .map((field) => {
      const prefilledBy = submission.prefilled[field.name] ? 'system' : 'person';
      return {
        property: field.name,
        value: submission.values[field.name],
        status: prefilledBy === 'person' ? 'confirmed' : 'candidate',
        provenance: {
          kind: prefilledBy === 'person' ? 'recorded' : 'copied',
          source: prefilledBy === 'person' ? `form ${form.form_id}` : submission.prefilled[field.name],
          method: `generated form ${form.form_id} v1`,
          as_of: asOf,
          evidence_class: prefilledBy === 'person' ? 'asserted' : 'attributed',
          confirmed_by_role: prefilledBy === 'person' ? submission.typed_by : undefined,
        },
      };
    });
  return { problems: [], facts };
}

// --------------------------------------------------------- fill with AI

export type Proposal = {
  property: string;
  value: unknown;
  source: string;
  evidence_class: 'copied' | 'attributed';
  note: string;
};

/**
 * Proposes values for empty fields from the subject's own record and the pages
 * it links to. Proposals are returned; they are never applied here, and they
 * never replace a value a person already typed.
 */
export function proposeValues(graph: Graph, form: FormSpec, subjectRef: string | null, typed: Record<string, unknown> = {}): Proposal[] {
  const proposals: Proposal[] = [];
  const subject = subjectRef ? graph.page(subjectRef) : undefined;
  const seen = new Set<string>();

  const consider = (pageRef: string, source: string) => {
    const page = graph.page(pageRef);
    if (!page) return;
    for (const field of form.fields) {
      if (seen.has(field.name) || typed[field.name] !== undefined) continue;
      const value = page.properties[field.name];
      if (value === undefined || value === null || value === '') continue;
      seen.add(field.name);
      proposals.push({
        property: field.name,
        value,
        source: `${source}:${pageRef}`,
        evidence_class: 'copied',
        note: `Read from ${page.type} ${page.title}`,
      });
    }
  };

  if (subject) consider(subject.ref, 'same record');
  if (subject) {
    for (const edge of graph.edges.filter((e) => e.from === subject.ref)) consider(edge.to, `linked by ${edge.kind}`);
  }
  return proposals;
}
