// Reusing the learned graph for the next municipality.
//
// The first organization produces a template: its units, roles, services and
// discovered process shapes — the structure, without its people or its data.
// A new organization starts from that template, and the work is the difference:
// which units, roles and steps are the same, which are new, which are missing,
// and which are the same thing under a different name.
//
// The output is an overlay draft, not a schema change: a person accepts it.

import type { Graph } from '../graph/graph.ts';
import type { OrgMap } from '../org/orgmap.ts';
import type { ProcessModel } from '../process/discover.ts';
import { ACTIVITY_LABELS } from '../cloud/fixtures.ts';

export type OrgTemplate = {
  template_id: string;
  template_version: string;
  built_from: { organization: string; captured_at: string; pages: number; edges: number };
  units: { key: string; name: string; name_en: string; headcount: number; roles: string[] }[];
  roles: string[];
  services: { code: string; name_en: string; sla_days: number | null }[];
  process: { service_code: string; steps: string[]; variant_count: number; median_total_days: number }[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set(['ו', 'של', 'the', 'and', 'of', 'department', 'מחלקת', 'אגף', 'יחידת']);

const tokens = (s: string) => new Set(norm(s).split(' ').filter((w) => w && !STOP.has(w)));

/** Jaccard over words; enough to find the same unit under another name. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export function exportTemplate(
  graph: Graph,
  org: OrgMap,
  models: ProcessModel[],
  meta: { organization: string; capturedAt: string },
): OrgTemplate {
  const roles = new Set<string>();
  for (const person of graph.ofType('person')) {
    const title = String(person.properties.job_title ?? '');
    if (title) roles.add(title);
  }
  const services = graph.ofType('service').map((s) => ({
    code: String(s.properties.code ?? ''),
    name_en: String(s.properties.name_en ?? s.title),
    sla_days: (s.properties.sla_days as number | undefined) ?? null,
  }));

  return {
    template_id: `template-${slug(meta.organization)}`,
    template_version: '1.0.0',
    built_from: {
      organization: meta.organization,
      captured_at: meta.capturedAt,
      pages: graph.pages.size,
      edges: graph.edges.length,
    },
    units: org.units.map((u) => ({
      key: slug(u.name),
      name: u.name,
      name_en: u.nameEn,
      headcount: u.headcount,
      roles: u.roles.map((r) => r.title),
    })),
    roles: [...roles],
    services,
    process: models.map((m) => ({
      service_code: m.serviceCode,
      steps: m.steps.map((s) => s.activity),
      variant_count: m.variants.length,
      median_total_days: m.medianTotalDays,
    })),
  };
}

export type UnitMatch = {
  template: { key: string; name: string; name_en: string; headcount: number; roles: string[] };
  target: { name: string; name_en: string; headcount: number; roles: string[] };
  similarity: number;
  roleOverlap: number;
  verdict: 'same' | 'renamed' | 'unsure';
  note: string;
};

export type DiffReport = {
  source_template: { id: string; organization: string; version: string };
  target_organization: string;
  units: {
    matched: UnitMatch[];
    added: { name: string; name_en: string; headcount: number; roles: string[] }[];
    missing: { name: string; name_en: string; headcount: number; roles: string[] }[];
  };
  roles: { matched: string[]; added: string[]; missing: string[] };
  services: { matched: string[]; added: string[]; missing: string[] };
  process: {
    service_code: string;
    steps: { matched: string[]; added: string[]; missing: string[] };
    /** Activity code -> what a person reads. Codes alone are not a demo. */
    step_labels: Record<string, string>;
    variant_delta: number;
    median_days_delta: number;
  }[];
  summary: {
    unit_coverage: number;
    role_coverage: number;
    step_coverage: number;
    identical_steps: number;
    new_steps: number;
  };
  proposed_overlay: {
    overlay: string;
    organization_id: string;
    description: string;
    labels: Record<string, { he?: string; en?: string }>;
  };
};

export function diffAgainstTemplate(
  template: OrgTemplate,
  graph: Graph,
  org: OrgMap,
  models: ProcessModel[],
  meta: { organization: string; organizationId: string },
): DiffReport {
  const matched: UnitMatch[] = [];
  const usedTemplate = new Set<string>();
  const usedTarget = new Set<string>();

  const candidates: UnitMatch[] = [];
  for (const tu of template.units) {
    for (const target of org.units) {
      const sim = similarity(tu.name, target.name);
      const roleOverlap = jaccard(new Set(tu.roles), new Set(target.roles.map((r) => r.title)));
      const verdict: UnitMatch['verdict'] =
        sim >= 0.5 ? 'same' : roleOverlap >= 0.5 || sim >= 0.25 ? 'renamed' : 'unsure';
      candidates.push({
        template: tu,
        target: {
          name: target.name,
          name_en: target.nameEn,
          headcount: target.headcount,
          roles: target.roles.map((r) => r.title),
        },
        similarity: Number(sim.toFixed(2)),
        roleOverlap: Number(roleOverlap.toFixed(2)),
        verdict,
        note:
          verdict === 'same'
            ? 'Name matches; treated as the same unit.'
            : verdict === 'renamed'
              ? 'Different name, same roles — presented as a rename for a person to accept.'
              : 'Weak match; left unmatched on purpose rather than guessed.',
      });
    }
  }
  candidates.sort((a, b) => b.similarity + b.roleOverlap - (a.similarity + a.roleOverlap));
  for (const c of candidates) {
    if (c.verdict === 'unsure') continue;
    if (usedTemplate.has(c.template.key) || usedTarget.has(c.target.name)) continue;
    usedTemplate.add(c.template.key);
    usedTarget.add(c.target.name);
    matched.push(c);
  }

  const added = org.units
    .filter((u) => !usedTarget.has(u.name))
    .map((u) => ({ name: u.name, name_en: u.nameEn, headcount: u.headcount, roles: u.roles.map((r) => r.title) }));
  const missing = template.units
    .filter((u) => !usedTemplate.has(u.key))
    .map((u) => ({ name: u.name, name_en: u.name_en, headcount: u.headcount, roles: u.roles }));

  const targetRoles = new Set(org.units.flatMap((u) => u.roles.map((r) => r.title)));
  const templateRoles = new Set(template.roles);
  const roles = {
    matched: [...templateRoles].filter((r) => targetRoles.has(r)),
    added: [...targetRoles].filter((r) => !templateRoles.has(r)),
    missing: [...templateRoles].filter((r) => !targetRoles.has(r)),
  };

  const targetServices = new Set(graph.ofType('service').map((s) => String(s.properties.code ?? '')));
  const templateServices = new Set(template.services.map((s) => s.code));
  const services = {
    matched: [...templateServices].filter((s) => targetServices.has(s)),
    added: [...targetServices].filter((s) => !templateServices.has(s)),
    missing: [...templateServices].filter((s) => !targetServices.has(s)),
  };

  const process: DiffReport['process'] = [];
  for (const pm of template.process) {
    const current = models.find((m) => m.serviceCode === pm.service_code);
    if (!current) {
      process.push({
        service_code: pm.service_code,
        steps: { matched: [], added: [], missing: pm.steps },
        step_labels: labelsFor(pm.steps),
        variant_delta: -pm.variant_count,
        median_days_delta: 0,
      });
      continue;
    }
    const currentSteps = new Set(current.steps.map((s) => s.activity));
    const templateSteps = new Set(pm.steps);
    process.push({
      service_code: pm.service_code,
      steps: {
        matched: pm.steps.filter((s) => currentSteps.has(s)),
        added: [...currentSteps].filter((s) => !templateSteps.has(s)),
        missing: pm.steps.filter((s) => !currentSteps.has(s)),
      },
      step_labels: labelsFor([...pm.steps, ...currentSteps]),
      variant_delta: current.variants.length - pm.variant_count,
      median_days_delta: Number((current.medianTotalDays - pm.median_total_days).toFixed(1)),
    });
  }

  const stepTotals = process.reduce(
    (acc, p) => {
      acc.matched += p.steps.matched.length;
      acc.added += p.steps.added.length;
      acc.missing += p.steps.missing.length;
      return acc;
    },
    { matched: 0, added: 0, missing: 0 },
  );

  return {
    source_template: {
      id: template.template_id,
      organization: template.built_from.organization,
      version: template.template_version,
    },
    target_organization: meta.organization,
    units: { matched, added, missing },
    roles,
    services,
    process,
    summary: {
      unit_coverage: template.units.length ? Number((matched.length / template.units.length).toFixed(2)) : 0,
      role_coverage: templateRoles.size ? Number((roles.matched.length / templateRoles.size).toFixed(2)) : 0,
      step_coverage: stepTotals.matched + stepTotals.missing > 0
        ? Number((stepTotals.matched / (stepTotals.matched + stepTotals.missing)).toFixed(2))
        : 0,
      identical_steps: stepTotals.matched,
      new_steps: stepTotals.added,
    },
    proposed_overlay: {
      overlay: slug(meta.organization),
      organization_id: meta.organizationId,
      description: `Overlay accepted from the ${template.built_from.organization} template on ${new Date().toISOString().slice(0, 10)}. It records only what differs.`,
      labels: Object.fromEntries(
        [...matched, ...added.map((a) => ({ target: a }))]
          .filter((m) => 'target' in m && m.target.name)
          .map((m) => [slug(m.target.name_en || m.target.name), { he: m.target.name, en: m.target.name_en }]),
      ),
    },
  };
}

function labelsFor(codes: string[]): Record<string, string> {
  return Object.fromEntries(codes.map((code) => [code, ACTIVITY_LABELS[code] ?? code]));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'org'
  );
}
