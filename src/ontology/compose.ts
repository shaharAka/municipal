// The composer: packs -> baseline ontology -> tenant overlay.
//
// This follows the AKA ontology engine's model (aka-food/aka-new-platform):
// a baseline of packs that only point down, and a tenant overlay that adds
// without editing. The same document shape is used here as `world_schema_json`,
// authored as JSON so the POC needs no YAML parser; `aka-ontology build`
// produces a document of exactly this shape.
//
// What the composer refuses, because a silent success is worse than a loud
// failure: a pack redefining a def or a type, an edge kind pointing at an
// unknown type, a required property that does not exist, an overlay colliding
// with the baseline's names in strict mode, and an enum extension of a property
// that has no enum.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Schema = {
  type?: string | string[];
  enum?: unknown[];
  format?: string;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
  $ref?: string;
  description?: string;
  'x-unit'?: string;
};

export type PageTypeSpec = {
  description?: string;
  properties: Record<string, Schema>;
  required: string[];
};

export type EdgeKindSpec = {
  description?: string;
  from: string[];
  to: string[];
  lineage?: 'upstream' | 'downstream';
  payload?: Record<string, Schema>;
  payload_required?: string[];
  inverse?: { label: string; group?: string };
};

export type InferenceRule = { id: string; description: string; if: string; then: string };

export type Learning = {
  observations?: { metric: string; subject: string; value: string; quantity?: Record<string, unknown> }[];
  learnings?: {
    name: string;
    insight_kind: string;
    about: string[];
    from: string[];
    aggregates: { name: string; function: string; metric: string }[];
    question: string;
  }[];
};

export type PackDoc = {
  pack: string;
  title: string;
  description?: string;
  defs?: Record<string, Schema>;
  page_types?: Record<string, Omit<PageTypeSpec, 'required'> & { required?: string[] }>;
  edge_kinds?: Record<string, Omit<EdgeKindSpec, 'from' | 'to'> & { from: string | string[]; to: string | string[] }>;
  inference_rules?: InferenceRule[];
  learning?: Learning;
  units?: Record<string, { dimension: string; factor: string; aliases?: string[] }>;
};

export type OverlayDoc = {
  overlay: string;
  organization_id: string;
  description?: string;
  labels?: Record<string, { he?: string; en?: string }>;
  page_types?: Record<string, Omit<PageTypeSpec, 'required'> & { required?: string[] }>;
  extend_page_types?: Record<string, { properties?: Record<string, Schema>; required_add?: string[] }>;
  extend_enums?: { page_type: string; property: string; add: unknown[] }[];
  edge_kinds?: Record<string, Omit<EdgeKindSpec, 'from' | 'to'> & { from: string | string[]; to: string | string[] }>;
  learning?: Learning;
};

export type Ontology = {
  version: string;
  packs: string[];
  overlayName?: string;
  organizationId?: string;
  defs: Record<string, Schema>;
  units: Record<string, { dimension: string; factor: string; aliases: string[] }>;
  pageTypes: Record<string, PageTypeSpec>;
  edgeKinds: Record<string, EdgeKindSpec>;
  inferenceRules: InferenceRule[];
  learning: { observations: NonNullable<Learning['observations']>; learnings: NonNullable<Learning['learnings']> };
  labels: Record<string, { he?: string; en?: string }>;
};

export class OntologyError extends Error {
  constructor(problems: string[]) {
    super('Ontology is invalid:\n  - ' + problems.join('\n  - '));
  }
}

const asArray = (v: string | string[]) => (Array.isArray(v) ? v : [v]);

export const PACK_DIR = new URL('./packs/', import.meta.url).pathname;

export function loadPacks(dir = PACK_DIR): PackDoc[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as PackDoc);
}

export function composeBaseline(packs: PackDoc[], version = '1.0.0'): Ontology {
  const problems: string[] = [];
  const defs: Record<string, Schema> = {};
  const units: Ontology['units'] = {};
  const pageTypes: Record<string, PageTypeSpec> = {};
  const edgeKinds: Record<string, EdgeKindSpec> = {};
  const inferenceRules: InferenceRule[] = [];
  const learning = { observations: [], learnings: [] } as Ontology['learning'];

  for (const pack of packs) {
    for (const [name, def] of Object.entries(pack.defs ?? {})) {
      if (defs[name]) problems.push(`def "${name}" is declared twice (pack "${pack.pack}")`);
      defs[name] = def;
    }
    for (const [name, u] of Object.entries(pack.units ?? {})) {
      if (units[name]) problems.push(`unit "${name}" is declared twice (pack "${pack.pack}")`);
      units[name] = { dimension: u.dimension, factor: u.factor, aliases: u.aliases ?? [] };
    }
    for (const [name, spec] of Object.entries(pack.page_types ?? {})) {
      if (pageTypes[name]) {
        problems.push(`page type "${name}" is declared twice (pack "${pack.pack}")`);
        continue;
      }
      pageTypes[name] = { ...spec, required: spec.required ?? [] } as PageTypeSpec;
    }
    for (const [name, spec] of Object.entries(pack.edge_kinds ?? {})) {
      if (edgeKinds[name]) {
        problems.push(`edge kind "${name}" is declared twice (pack "${pack.pack}")`);
        continue;
      }
      edgeKinds[name] = { ...spec, from: asArray(spec.from), to: asArray(spec.to) } as EdgeKindSpec;
    }
    inferenceRules.push(...(pack.inference_rules ?? []));
    learning.observations.push(...(pack.learning?.observations ?? []));
    learning.learnings.push(...(pack.learning?.learnings ?? []));
  }

  // Every declared type must be internally consistent before it is used.
  for (const [name, spec] of Object.entries(pageTypes)) {
    for (const req of spec.required) {
      if (!spec.properties[req]) problems.push(`page type "${name}": required property "${req}" is not declared`);
    }
  }
  for (const [name, spec] of Object.entries(edgeKinds)) {
    for (const side of ['from', 'to'] as const) {
      for (const t of spec[side]) {
        if (t !== '*' && !pageTypes[t]) problems.push(`edge kind "${name}": ${side} type "${t}" is not a known page type`);
      }
    }
    for (const req of spec.payload_required ?? []) {
      if (!spec.payload?.[req]) problems.push(`edge kind "${name}": required payload "${req}" is not declared`);
    }
  }
  if (problems.length) throw new OntologyError(problems);

  return {
    version,
    packs: packs.map((p) => p.pack),
    defs,
    units,
    pageTypes,
    edgeKinds,
    inferenceRules,
    learning,
    labels: {},
  };
}

/**
 * Applies a tenant overlay. Additive only: it adds pages, properties, enum
 * values and edge kinds, and it may relabel what exists. It may not redefine.
 */
export function applyOverlay(baseline: Ontology, overlay: OverlayDoc, opts: { strict?: boolean } = {}): Ontology {
  const problems: string[] = [];
  const next: Ontology = structuredClone(baseline);
  next.overlayName = overlay.overlay;
  next.organizationId = overlay.organization_id;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(overlay.organization_id)) {
    problems.push(`overlay "${overlay.overlay}": organization_id must be a uuid`);
  }

  // A tenant's own names are namespaced so a later pack release cannot collide.
  const tenantName = (name: string, kind: string) => {
    if (!opts.strict) return name;
    if (/^x_/.test(name)) return name;
    problems.push(`overlay "${overlay.overlay}": ${kind} "${name}" must be namespaced as x_<slug> in strict mode`);
    return name;
  };

  for (const [name, spec] of Object.entries(overlay.page_types ?? {})) {
    const safe = tenantName(name, 'page type');
    if (next.pageTypes[safe]) {
      problems.push(`overlay "${overlay.overlay}": page type "${safe}" already exists; use extend_page_types`);
      continue;
    }
    next.pageTypes[safe] = { ...spec, required: spec.required ?? [] } as PageTypeSpec;
  }

  for (const [name, add] of Object.entries(overlay.extend_page_types ?? {})) {
    const target = next.pageTypes[name];
    if (!target) {
      problems.push(`overlay "${overlay.overlay}": extend_page_types names unknown page type "${name}"`);
      continue;
    }
    for (const [prop, schema] of Object.entries(add.properties ?? {})) {
      const safe = tenantName(prop, 'property');
      if (target.properties[safe]) {
        problems.push(`overlay "${overlay.overlay}": property "${name}.${safe}" already exists; an overlay may not redefine it`);
        continue;
      }
      target.properties[safe] = schema;
    }
    for (const req of add.required_add ?? []) {
      if (!target.properties[req]) {
        problems.push(`overlay "${overlay.overlay}": required_add "${name}.${req}" is not a property`);
        continue;
      }
      if (!target.required.includes(req)) target.required.push(req);
    }
  }

  for (const ext of overlay.extend_enums ?? []) {
    const type = next.pageTypes[ext.page_type];
    const prop = type?.properties[ext.property];
    if (!type) {
      problems.push(`overlay "${overlay.overlay}": extend_enums names unknown page type "${ext.page_type}"`);
      continue;
    }
    if (!prop) {
      problems.push(`overlay "${overlay.overlay}": extend_enums names unknown property "${ext.page_type}.${ext.property}"`);
      continue;
    }
    if (!prop.enum) {
      problems.push(`overlay "${overlay.overlay}": "${ext.page_type}.${ext.property}" has no enum to extend`);
      continue;
    }
    for (const value of ext.add) {
      if (prop.enum.includes(value)) continue;
      prop.enum.push(value);
    }
  }

  for (const [name, spec] of Object.entries(overlay.edge_kinds ?? {})) {
    const safe = tenantName(name, 'edge kind');
    if (next.edgeKinds[safe]) {
      problems.push(`overlay "${overlay.overlay}": edge kind "${safe}" already exists`);
      continue;
    }
    next.edgeKinds[safe] = { ...spec, from: asArray(spec.from), to: asArray(spec.to) } as EdgeKindSpec;
  }

  for (const [name, labels] of Object.entries(overlay.labels ?? {})) {
    next.labels[name] = { ...(next.labels[name] ?? {}), ...labels };
  }

  next.learning.observations.push(...(overlay.learning?.observations ?? []));
  next.learning.learnings.push(...(overlay.learning?.learnings ?? []));

  for (const [name, spec] of Object.entries(next.edgeKinds)) {
    for (const side of ['from', 'to'] as const) {
      for (const t of spec[side]) {
        if (t !== '*' && !next.pageTypes[t]) problems.push(`edge kind "${name}": ${side} type "${t}" is not a known page type`);
      }
    }
  }

  if (problems.length) throw new OntologyError(problems);
  return next;
}

// ------------------------------------------------------------- validation

function resolve(schema: Schema, onto: Ontology, seen: string[] = []): Schema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.replace('#/defs/', '');
  if (seen.includes(name)) throw new Error('circular $ref: ' + seen.join(' -> '));
  const def = onto.defs[name];
  if (!def) throw new Error('unknown $ref: ' + schema.$ref);
  return { ...resolve(def, onto, seen.concat(name)), ...stripRef(schema) };
}

const stripRef = (s: Schema) => {
  const { $ref, ...rest } = s;
  return rest;
};

const typeMatches = (value: unknown, type?: string | string[]): boolean => {
  if (!type) return true;
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    switch (t) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && Number.isFinite(value);
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  });
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

/** Validates one value against one schema, with the composer's strictness. */
export function validateValue(
  schema: Schema,
  value: unknown,
  onto: Ontology,
  where: string,
  problems: string[] = [],
): string[] {
  const s = resolve(schema, onto);
  if (!typeMatches(value, s.type)) {
    problems.push(`${where}: expected ${String(s.type ?? 'any')}, got ${JSON.stringify(value)}`);
    return problems;
  }
  if (s.enum && !s.enum.includes(value)) {
    problems.push(`${where}: "${String(value)}" is not one of ${s.enum.map(String).join(', ')}`);
  }
  if (s.format === 'date' && typeof value === 'string' && !DATE.test(value)) {
    problems.push(`${where}: "${value}" is not a date (YYYY-MM-DD)`);
  }
  if (s.format === 'date-time' && typeof value === 'string' && !DATE_TIME.test(value)) {
    problems.push(`${where}: "${value}" is not a date-time`);
  }
  if (typeof value === 'number') {
    if (s.minimum !== undefined && value < s.minimum) problems.push(`${where}: ${value} is below the minimum ${s.minimum}`);
    if (s.maximum !== undefined && value > s.maximum) problems.push(`${where}: ${value} is above the maximum ${s.maximum}`);
  }
  if (Array.isArray(value) && s.items) {
    value.forEach((item, i) => validateValue(s.items as Schema, item, onto, `${where}[${i}]`, problems));
  }
  if (s.properties && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const req of s.required ?? []) {
      if (record[req] === undefined) problems.push(`${where}: missing required "${req}"`);
    }
    for (const key of Object.keys(record)) {
      const propSchema = s.properties[key];
      if (!propSchema) {
        problems.push(`${where}: unknown property "${key}"`);
        continue;
      }
      if (record[key] === undefined || record[key] === null) continue;
      validateValue(propSchema, record[key], onto, `${where}.${key}`, problems);
    }
  }
  return problems;
}

export type Page = { ref: string; type: string; title: string; properties: Record<string, unknown> };
export type Edge = { id: string; kind: string; from: string; to: string; payload?: Record<string, unknown> };

/** Validates a page against its type. Unknown properties are refused. */
export function pageProblems(onto: Ontology, page: Page): string[] {
  const spec = onto.pageTypes[page.type];
  if (!spec) return [`${page.ref}: unknown page type "${page.type}"`];
  const problems: string[] = [];
  for (const req of spec.required) {
    if (page.properties[req] === undefined) problems.push(`${page.ref}: missing required property "${req}"`);
  }
  for (const [key, value] of Object.entries(page.properties)) {
    const schema = spec.properties[key];
    if (!schema) {
      problems.push(`${page.ref}: property "${key}" is not on page type "${page.type}"`);
      continue;
    }
    if (value === undefined || value === null) continue;
    validateValue(schema, value, onto, `${page.ref}.${key}`, problems);
  }
  return problems;
}

export function edgeProblems(onto: Ontology, edge: Edge, typeOf: (ref: string) => string | undefined): string[] {
  const spec = onto.edgeKinds[edge.kind];
  if (!spec) return [`${edge.id}: unknown edge kind "${edge.kind}"`];
  const problems: string[] = [];
  const fromType = typeOf(edge.from);
  const toType = typeOf(edge.to);
  if (!fromType) return [`${edge.id}: from page "${edge.from}" does not exist`];
  if (!toType) return [`${edge.id}: to page "${edge.to}" does not exist`];
  if (!spec.from.includes('*') && !spec.from.includes(fromType)) {
    problems.push(`${edge.id}: ${edge.kind} cannot leave a ${fromType}`);
  }
  if (!spec.to.includes('*') && !spec.to.includes(toType)) {
    problems.push(`${edge.id}: ${edge.kind} cannot arrive at a ${toType}`);
  }
  const payload = edge.payload ?? {};
  for (const req of spec.payload_required ?? []) {
    if (payload[req] === undefined) problems.push(`${edge.id}: missing required payload "${req}"`);
  }
  for (const [key, value] of Object.entries(payload)) {
    const schema = spec.payload?.[key];
    if (!schema) {
      problems.push(`${edge.id}: unknown payload "${key}" on ${edge.kind}`);
      continue;
    }
    if (value === undefined || value === null) continue;
    validateValue(schema, value, onto, `${edge.id}.${key}`, problems);
  }
  return problems;
}

// ------------------------------------------------------------------- stats

export function stats(onto: Ontology) {
  return {
    version: onto.version,
    packs: onto.packs,
    pageTypes: Object.keys(onto.pageTypes).length,
    edgeKinds: Object.keys(onto.edgeKinds).length,
    inferenceRules: onto.inferenceRules.length,
    observations: onto.learning.observations.length,
    learnings: onto.learning.learnings.length,
    defs: Object.keys(onto.defs).length,
    perPack: onto.packs.map((p) => p),
  };
}

/** A read-only view of the ontology for the API and the workbench UI. */
export function publicView(onto: Ontology) {
  return {
    version: onto.version,
    packs: onto.packs,
    overlay: onto.overlayName ?? null,
    pageTypes: Object.entries(onto.pageTypes).map(([name, spec]) => ({
      name,
      description: spec.description ?? '',
      required: spec.required,
      properties: Object.entries(spec.properties).map(([propName, schema]) => ({
        name: propName,
        type: resolve(schema, onto).type ?? (schema.$ref ? 'object' : 'string'),
        enum: schema.enum ?? resolve(schema, onto).enum ?? null,
        format: schema.format ?? null,
        unit: schema['x-unit'] ?? null,
        description: schema.description ?? '',
        required: spec.required.includes(propName),
      })),
    })),
    edgeKinds: Object.entries(onto.edgeKinds).map(([name, spec]) => ({
      name,
      description: spec.description ?? '',
      from: spec.from,
      to: spec.to,
      lineage: spec.lineage ?? null,
      payload: Object.keys(spec.payload ?? {}),
    })),
    inferenceRules: onto.inferenceRules,
    learning: onto.learning,
  };
}
