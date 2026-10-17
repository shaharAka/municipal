import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;

const get = async (path: string) => {
  const res = await fetch(BASE + path);
  assert.equal(res.status, 200, `${path} -> ${res.status}`);
  return res.json();
};

before(async () => {
  server = spawn(process.execPath, ['src/server.ts'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + '/api/overview');
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});

after(() => {
  server?.kill();
});

test('the API answers every surface the workbench reads', async () => {
  const overview = await get('/api/overview');
  assert.equal(overview.organization.name, 'Givat Rimon');
  assert.ok(overview.graph.pages > 1500);
  assert.equal(overview.connections.length, 6);
  assert.ok(overview.services.length >= 3);

  const mapping = await get('/api/mapping');
  assert.ok(mapping.mappings.length >= 14);
  assert.ok(mapping.coverage.length > 100);
  assert.ok(mapping.candidates.some((c: any) => c.proposal.property === 'inspection_zone'));

  const ontology = await get('/api/ontology');
  assert.ok(ontology.pageTypes.length >= 20);
  assert.ok(ontology.edgeKinds.length >= 20);
  assert.ok(ontology.learning.learnings.length >= 1);

  const org = await get('/api/org');
  assert.equal(org.units.length, 5);
  assert.ok(org.responsibilities.length > 20);

  const lic = await get('/api/process?service=LIC');
  assert.equal(lic.model.caseCount, 62);
  assert.ok(lic.proposals.length >= 3);
  assert.ok(lic.params.assumedReduction.owner);

  const onboard = await get('/api/onboard');
  assert.ok(onboard.diff.units.matched.length >= 1);
  assert.ok(onboard.diff.proposed_overlay.organization_id);

  const security = await get('/api/security');
  assert.ok(security.findings.some((f: any) => f.kind === 'instruction-injection'));

  // A service's proposals are counted from the process they belong to.
  const licService = overview.services.find((s: any) => s.code === 'LIC');
  assert.equal(licService.proposals, 4);
});

test('access filtering holds through the HTTP surface', async () => {
  const { viewers } = await get('/api/viewers');
  const head = viewers.find((v: any) => v.clearance === 3);
  const inspector = viewers.find((v: any) => v.clearance < 3 && /מפקח/.test(v.label));

  const asHead = await get(`/api/pages?type=document&viewer=${head.id}`);
  const asInspector = await get(`/api/pages?type=document&viewer=${inspector.id}`);
  assert.equal(asHead.pages.length, 6);
  const headVisible = asHead.pages.filter((p: any) => p.facts.length > 0).length;
  const inspectorVisible = asInspector.pages.filter((p: any) => p.facts.length > 0).length;
  assert.ok(inspectorVisible < headVisible, 'a restricted document must disappear for the inspector');
  assert.ok(asInspector.pages.some((p: any) => p.hiddenFactCount > 0));
});

test('a finding quoted from a document the viewer cannot see is withheld', async () => {
  const { viewers } = await get('/api/viewers');
  const clerk = viewers[viewers.length - 1];
  const asClerk = await get(`/api/security?viewer=${clerk.id}`);
  const asHead = await get(`/api/security?viewer=${viewers[0].id}`);

  assert.ok(asHead.findings.length >= 1);
  assert.equal(asClerk.findings.length, 0);
  assert.equal(asClerk.findingsWithheld, asHead.findings.length);
  assert.equal(asClerk.documents.filter((d: any) => d.visible).length, 4);
  assert.equal(asClerk.documents.filter((d: any) => !d.visible).length, 2);
});

test('a person approving an automation creates a decision with their name on it', async () => {
  const process = await get('/api/process?service=LIC');
  const proposal = process.proposals.find((p: any) => p.kind === 'sla_reminder');
  assert.ok(proposal);

  const res = await fetch(`${BASE}/api/automations/${encodeURIComponent(proposal.ref)}/approve`, { method: 'POST' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'approved');

  const decision = await get(`/api/page?ref=${encodeURIComponent(body.decision)}`);
  assert.equal(decision.type, 'decision');
  assert.equal(decision.properties.kind, 'automation_approved');
  assert.match(decision.properties.decided_by, /דנה לוי/);

  const after = await get('/api/process?service=LIC');
  const updated = after.automations.find((a: any) => a.ref === proposal.ref);
  assert.equal(updated.status, 'approved');
});

test('the eligibility question answers over HTTP with its rule and unknowns', async () => {
  const rules = await get('/api/rules');
  assert.equal(rules.rules.length, 2);
  assert.equal(rules.reference_date, '2026-10-17');
  assert.equal(rules.rules.find((r: any) => r.version === 2).in_force, true);
  assert.equal(rules.rules.find((r: any) => r.version === 1).in_force, false);

  const answer = await get('/api/answer');
  assert.equal(answer.rule.version, 2);
  assert.equal(answer.counts.eligible + answer.counts.notEligible + answer.counts.unknown, answer.counts.total);
  assert.ok(answer.unknownReasons.some((r: any) => r.property === 'income_band'));

  const ask = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'How many households are eligible for the sanitation fee discount?' }),
  });
  assert.equal(ask.status, 200);
  const fresh = await ask.json();
  assert.equal(fresh.refused, null);
  assert.equal(fresh.rule.version, 2);

  const refused = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'Who won the match last night?' }),
  });
  const refusedBody = await refused.json();
  assert.ok(refusedBody.refused);
  assert.equal(refusedBody.counts.eligible, null);
});
