// The HTTP surface: a tiny router, the API the workbench reads, and the static
// files. No framework, because the POC must run from a checkout with no install;
// swapping in Fastify is a container-level change nothing else sees.

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { buildDemo, captureTime, type Demo, type Platform } from './platform.ts';
import { CONNECTIONS } from './cloud/registry.ts';
import { publicView, stats as ontologyStats } from './ontology/compose.ts';
import { MAPPINGS } from './ontology/mappings.ts';
import { PARAMS } from './process/discover.ts';
import { whoHandles } from './org/orgmap.ts';
import { refFor, type Viewer } from './graph/graph.ts';

const WEB = new URL('./web/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4173);

const json = (res: ServerResponse, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  res.end(text);
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

async function serveStatic(res: ServerResponse, path: string) {
  const file = path === '/' ? 'index.html' : path.slice(1);
  const full = join(WEB, file);
  if (!full.startsWith(WEB)) return json(res, 403, { error: 'forbidden' });
  try {
    const body = await readFile(full);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

function viewerFor(platform: Platform, url: URL): Viewer {
  const id = url.searchParams.get('viewer');
  return platform.viewers.find((v) => v.id === id) ?? platform.viewers[0];
}

function viewerName(platform: Platform, viewer: Viewer): string {
  const user = platform.fixture.users.find((u) => u.id === viewer.id);
  return user ? `${user.displayName} (${user.jobTitle})` : viewer.id;
}

function overview(platform: Platform, demo: Demo) {
  const g = platform.graph;
  return {
    organization: {
      name: platform.organization,
      nameHe: platform.fixture.tenantName,
      profileId: platform.profileId,
      organizationId: platform.organizationId,
      domain: platform.fixture.domain,
      capturedAt: captureTime,
    },
    graph: g.stats(),
    ontology: ontologyStats(platform.ontology),
    sources: platform.report.sources,
    connections: CONNECTIONS,
    documents: platform.report.documents.length,
    schemaCandidates: platform.report.schemaCandidates.length,
    findings: platform.report.findings,
    problems: platform.report.problems,
    services: platform.models.map((m) => ({
      code: m.serviceCode,
      name: m.serviceName,
      cases: m.caseCount,
      medianDays: m.medianTotalDays,
      bottleneck: m.bottleneck?.activity ?? null,
      bottleneckDays: m.bottleneck?.medianWaitDays ?? null,
      proposals: platform.proposals.filter((p) => p.serviceCode === m.serviceCode).length,
    })),
    secondOrganization: {
      name: demo.secondary.organization,
      profileId: demo.secondary.profileId,
      pages: demo.secondary.graph.pages.size,
    },
  };
}

function mappingView(platform: Platform) {
  return {
    mappings: MAPPINGS.map((m) => ({
      id: m.id,
      system: m.system,
      source: m.source,
      sourceKind: m.sourceKind,
      pageType: m.pageType,
      fields: m.fields,
      edges: m.edges ?? [],
      acceptance: m.acceptance ?? null,
      unmapped: m.unmapped ?? [],
      run: platform.report.mappings.find((r) => r.id === m.id) ?? null,
    })),
    coverage: platform.report.coverage,
    candidates: platform.report.schemaCandidates,
    sources: platform.report.sources,
  };
}

function processView(platform: Platform, code: string) {
  const model = platform.models.find((m) => m.serviceCode === code) ?? platform.models[0];
  const proposals = platform.proposals.filter((p) => p.serviceCode === model.serviceCode);
  return {
    model,
    proposals,
    params: PARAMS,
    automations: platform.graph
      .ofType('automation_proposal')
      .map((p) => ({
        ref: p.ref,
        title: p.title,
        kind: p.properties.proposal_kind,
        status: p.properties.status,
        approved_by: p.properties.approved_by ?? null,
      })),
  };
}

function orgView(platform: Platform) {
  return {
    viewers: platform.viewers.map((v) => ({ ...v, label: viewerName(platform, v) })),
    units: platform.org.units,
    people: platform.org.people,
    responsibilities: platform.org.responsibilities,
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, demo: Demo, url: URL, parts: string[]) {
  const platform = demo.primary;
  const viewer = viewerFor(platform, url);

  if (parts[1] === 'overview') return json(res, 200, overview(platform, demo));
  if (parts[1] === 'connections') return json(res, 200, { connections: CONNECTIONS });
  if (parts[1] === 'ontology') {
    return json(res, 200, {
      ...publicView(platform.ontology),
      coverage: platform.report.coverage,
      stats: ontologyStats(platform.ontology),
    });
  }
  if (parts[1] === 'mapping') return json(res, 200, mappingView(platform));
  if (parts[1] === 'viewers') {
    return json(res, 200, {
      viewers: platform.viewers.map((v) => ({ ...v, label: viewerName(platform, v) })),
    });
  }
  if (parts[1] === 'org') return json(res, 200, orgView(platform));
  if (parts[1] === 'process') {
    return json(res, 200, processView(platform, url.searchParams.get('service') ?? 'LIC'));
  }
  if (parts[1] === 'automations') {
    if (req.method === 'POST' && parts[2]) {
      const ref = decodeURIComponent(parts[2]);
      const page = platform.graph.page(ref);
      if (!page || page.type !== 'automation_proposal') return json(res, 404, { error: 'no such proposal' });
      const decisionRef = refFor('decision', 'approve-' + page.ref.replace(/[^a-z0-9]/gi, '-'));
      platform.graph.addPage({
        ref: decisionRef,
        type: 'decision',
        title: 'Approved: ' + page.title,
        properties: {},
        createdAt: new Date().toISOString(),
      });
      const values: Record<string, unknown> = {
        decision_id: decisionRef,
        kind: 'automation_approved',
        status: 'approved',
        decided_at: new Date().toISOString(),
        decided_by: viewerName(platform, viewer),
        rationale: 'Approved in the workbench from the measured evidence.',
        subject_ref: page.ref,
      };
      for (const [property, value] of Object.entries(values)) {
        platform.graph.setProperty({
          pageRef: decisionRef,
          property,
          value,
          status: 'confirmed',
          provenance: {
            kind: 'recorded',
            source: 'workbench approval',
            method: 'person decision',
            as_of: new Date().toISOString(),
            evidence_class: 'asserted',
            confirmed_by_role: viewerName(platform, viewer),
          },
          evidenceIds: [],
        });
      }
      platform.graph.addEdge({ kind: 'approves', from: decisionRef, to: page.ref });
      for (const [property, value] of Object.entries({
        status: 'approved',
        approved_by: viewerName(platform, viewer),
        approved_at: new Date().toISOString(),
      }) as [string, unknown][]) {
        platform.graph.setProperty({
          pageRef: page.ref,
          property,
          value,
          status: 'confirmed',
          provenance: {
            kind: 'recorded',
            source: 'workbench approval',
            method: 'person decision',
            as_of: new Date().toISOString(),
            evidence_class: 'asserted',
            confirmed_by_role: viewerName(platform, viewer),
          },
          evidenceIds: [],
        });
      }
      return json(res, 200, { ok: true, decision: decisionRef, status: 'approved' });
    }
    return json(res, 200, processView(platform, platform.models[0].serviceCode));
  }
  if (parts[1] === 'pages') {
    const type = url.searchParams.get('type') ?? 'document';
    const pages = platform.graph.ofType(type).map((p) => platform.graph.view(viewer, p.ref));
    return json(res, 200, { viewer: viewerName(platform, viewer), pages });
  }
  if (parts[1] === 'page') {
    const ref = url.searchParams.get('ref') ?? '';
    const view = platform.graph.view(viewer, ref);
    if (!view) return json(res, 404, { error: 'not found', ref });
    return json(res, 200, view);
  }
  if (parts[1] === 'search') {
    return json(res, 200, { query: url.searchParams.get('q') ?? '', results: whoHandles(platform.org, url.searchParams.get('q') ?? '') });
  }
  if (parts[1] === 'template') return json(res, 200, platform.template);
  if (parts[1] === 'onboard') {
    return json(res, 200, {
      diff: demo.diff,
      template: demo.primary.template,
      second: {
        organization: demo.secondary.organization,
        stats: demo.secondary.graph.stats(),
        models: demo.secondary.models.map((m) => ({ code: m.serviceCode, cases: m.caseCount, medianDays: m.medianTotalDays, variants: m.variants.length })),
      },
    });
  }
  if (parts[1] === 'security') {
    const labelCounts: Record<string, number> = {};
    for (const doc of platform.report.documents) labelCounts[doc.label] = (labelCounts[doc.label] ?? 0) + 1;
    const documents = platform.graph.ofType('document').map((page) => {
      const view = platform.graph.view(viewer, page.ref);
      return {
        ref: page.ref,
        name: page.title,
        label: String(page.properties.sensitivity_label ?? ''),
        facts: view?.facts.length ?? 0,
        hiddenFactCount: view?.hiddenFactCount ?? 0,
        visible: Boolean(view?.facts.length),
        flags: platform.report.documents.find((d) => d.ref === page.ref)?.flags ?? 0,
      };
    });
    // A finding quoted from a document the asker cannot see is itself a leak.
    const visibleNames = new Set(documents.filter((d) => d.visible).map((d) => d.name));
    return json(res, 200, {
      findings: platform.report.findings.filter((f) => visibleNames.has(f.document)),
      findingsWithheld: platform.report.findings.filter((f) => !visibleNames.has(f.document)).length,
      documents,
      labelCounts,
      viewer: viewerName(platform, viewer),
      exampleHidden: documents.filter((d) => !d.visible),
    });
  }
  if (parts[1] === 'candidates') {
    if (req.method === 'POST' && parts[2] === 'accept') {
      const body = await readBody(req);
      const candidateId = String(body.id ?? '');
      const candidate = platform.report.schemaCandidates.find((c) => c.id === candidateId);
      if (!candidate) return json(res, 404, { error: 'no such candidate' });
      candidate.status = 'accepted';
      // The page is the record; the report is a view of it.
      for (const page of platform.graph.ofType('knowledge_candidate')) {
        if (String(page.properties.candidate_id) !== candidate.id) continue;
        platform.graph.setProperty({
          pageRef: page.ref,
          property: 'status',
          value: 'accepted',
          status: 'confirmed',
          provenance: {
            kind: 'recorded',
            source: 'workbench acceptance',
            method: 'person decision',
            as_of: new Date().toISOString(),
            evidence_class: 'asserted',
            confirmed_by_role: viewerName(platform, viewer),
          },
          evidenceIds: [],
        });
      }
      return json(res, 200, {
        ok: true,
        candidate: { id: candidate.id, status: candidate.status, proposition: candidate.proposal },
        overlayDraft: {
          overlay: platform.profileId,
          organization_id: platform.organizationId,
          description: `Tenant addition accepted from candidate ${candidate.id} on ${new Date().toISOString().slice(0, 10)}. It is namespaced and additive; the packs are not edited.`,
          extend_page_types: Object.fromEntries(
            (candidate.proposal.page_types ?? [candidate.proposal.page_type]).map((type) => [
              type,
              { properties: { ['x_' + candidate.proposal.property]: { type: 'string', description: candidate.reason } } },
            ]),
          ),
          note: 'A tenant addition is namespaced x_<slug> and applied as an overlay; it never edits the pack.',
        },
      });
    }
    return json(res, 200, { candidates: platform.report.schemaCandidates });
  }
  return json(res, 404, { error: 'unknown endpoint', path: url.pathname });
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function main() {
  console.log('Building the POC platform (two municipalities)…');
  const started = Date.now();
  const demo = await buildDemo();
  const p = demo.primary;
  console.log(
    `  ${p.organization}: ${p.graph.pages.size} pages, ${p.graph.edges.length} edges, ${p.graph.facts.length} facts in ${Date.now() - started}ms`,
  );
  console.log(`  ${demo.secondary.organization}: ${demo.secondary.graph.pages.size} pages`);
  if (p.report.problems.length) {
    console.warn('  problems:', p.report.problems.slice(0, 5));
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (parts[0] === 'api') {
        return await handleApi(req, res, demo, url, parts);
      }
      if (parts[0] === 'health') return json(res, 200, { ok: true });
      return await serveStatic(res, url.pathname);
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: String(err) });
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\nWorkbench: http://127.0.0.1:${PORT}\n`);
  });
}

await main();
