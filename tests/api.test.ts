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
  const clerk = viewers.find((v: any) => /מזכירת מחלקה/.test(v.label));
  const head = viewers.find((v: any) => /מנהלת תברואה/.test(v.label));
  assert.ok(clerk && head);
  const asClerk = await get(`/api/security?viewer=${clerk.id}`);
  const asHead = await get(`/api/security?viewer=${head.id}`);

  assert.ok(asHead.findings.length >= 1);
  assert.equal(asClerk.findings.length, 0);
  assert.equal(asClerk.findingsWithheld, asHead.findings.length);
  assert.equal(asClerk.documents.filter((d: any) => d.visible).length, 4);
  assert.equal(asClerk.documents.filter((d: any) => !d.visible).length, 2);
});

test('the approval queue is filtered by owner, in Hebrew, and separate from responsibilities', async () => {
  const { viewers } = await get('/api/viewers');
  const head = viewers.find((v: any) => /מנהלת תברואה/.test(v.label));
  const clerk = viewers.find((v: any) => /רכזת רישוי/.test(v.label));
  const steward = viewers.find((v: any) => /אחראית נתונים/.test(v.label));
  assert.ok(head && clerk && steward);

  const headQueue = await get(`/api/approvals?viewer=${head.id}`);
  assert.equal(headQueue.viewerKind, 'head');
  assert.equal(headQueue.pending.length, headQueue.counts.total);
  assert.ok(headQueue.pending.some((p: any) => p.kind === 'automation'));
  assert.equal(headQueue.pending.some((p: any) => p.kind === 'gap'), false);
  assert.equal(headQueue.pending.some((p: any) => p.kind === 'property'), false);

  const clerkQueue = await get(`/api/approvals?viewer=${clerk.id}`);
  assert.equal(clerkQueue.viewerKind, 'clerk');
  assert.ok(clerkQueue.pending.some((p: any) => p.kind === 'suggestion'));
  assert.ok(clerkQueue.pending.some((p: any) => p.kind === 'gap'));
  assert.equal(clerkQueue.pending.some((p: any) => p.kind === 'automation'), false);

  const stewardQueue = await get(`/api/approvals?viewer=${steward.id}`);
  assert.equal(stewardQueue.viewerKind, 'steward');
  assert.ok(stewardQueue.pending.length > 0);
  assert.ok(stewardQueue.pending.every((p: any) => p.kind === 'property'));

  const all = await get('/api/approvals?scope=all');
  assert.equal(all.scope, 'all');
  assert.equal(all.pending.length, 0, 'the landing count does not expose the queue');
  assert.ok(all.counts.gaps > 0);
  assert.ok(all.counts.properties > 0);
  assert.ok(all.counts.total > headQueue.pending.length);
  assert.ok(all.responsibilities.count > 20);
  for (const item of headQueue.pending) {
    assert.ok(item.titleHe && item.whyHe, `${item.kind} carries Hebrew presentation fields`);
  }

  const lic = await get('/api/process?service=LIC');
  for (const proposal of lic.proposals) {
    assert.ok(proposal.titleHe && proposal.rationaleHe, `${proposal.kind} is presentable in Hebrew`);
    assert.ok(proposal.evidenceHe.length > 0);
  }

  const org = await get('/api/org');
  assert.ok(org.responsibilities.every((r: any) => r.summaryHe));

  const answer = await get('/api/answer');
  assert.ok(answer.explainHe.steps.length > 0);
  assert.ok(answer.explainHe.whatWasNotChecked.length > 0);
});

test('search follows source connection and document access', async () => {
  const { viewers } = await get('/api/viewers');
  const secretary = viewers.find((v: any) => /מזכירת מחלקה/.test(v.label));
  const off = await get(`/api/find?q=${encodeURIComponent('רישיון')}&viewer=${secretary.id}`);
  assert.equal(off.groups.some((group: any) => group.source === 'מסמכים'), false);
  assert.equal(off.groups.some((group: any) => group.source === 'דואר'), false);

  await fetch(`${BASE}/api/connectors/sharepoint/toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  const on = await get(`/api/find?q=${encodeURIComponent('רישיון')}&viewer=${secretary.id}`);
  assert.ok(on.hiddenDocuments >= 1);
  const documents = on.groups.find((group: any) => group.source === 'מסמכים')?.items ?? [];
  assert.equal(documents.some((item: any) => item.title.includes('תנאי רישיון')), false);
  await fetch(`${BASE}/api/connectors/sharepoint/toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
});

test('a person confirms an inferred responsibility and a decision records it', async () => {
  const { viewers } = await get('/api/viewers');
  const clerk = viewers.find((v: any) => /רכזת רישוי/.test(v.label));
  const org = await get(`/api/org?viewer=${clerk.id}`);
  const mine = org.responsibilities.filter(
    (r: any) => r.personRef === `mun:person:${clerk.id}` && r.status === 'open',
  );
  assert.ok(mine.length > 0);

  const res = await fetch(`${BASE}/api/responsibilities/${encodeURIComponent(mine[0].candidateRef)}/confirm?viewer=${clerk.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accept: true }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'accepted');

  const decision = await get(`/api/page?ref=${encodeURIComponent(body.decision)}`);
  assert.equal(decision.properties.kind, 'responsibility_confirmed');
  assert.match(decision.properties.decided_by, /מיכל/);

  const after = await get(`/api/org?viewer=${clerk.id}`);
  assert.equal(after.responsibilities.find((r: any) => r.candidateRef === mine[0].candidateRef).status, 'accepted');
});

test('a disconnected source has no data until it is connected', async () => {
  const before = await get('/api/outlook');
  assert.equal(before.connected, false);
  assert.equal(before.messages.length, 0);
  assert.equal(before.shared, true);

  const docsBefore = await get('/api/doclib');
  assert.equal(docsBefore.connected, false);
  assert.equal(docsBefore.documents.length, 0);

  await fetch(`${BASE}/api/connectors/exchange/toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  const after = await get('/api/outlook');
  assert.equal(after.connected, true);
  assert.ok(after.messages.length > 0);
  assert.match(after.mailbox, /משותפת/);

  await fetch(`${BASE}/api/connectors/exchange/toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
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

test('the ask box refuses a filter it cannot map instead of dropping it', async () => {
  const ask = async (question: string) => {
    const res = await fetch(`${BASE}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    assert.equal(res.status, 200);
    return res.json();
  };

  for (const question of [
    'כמה עסקים ממתינים לפיקוח כרגע?',
    'כמה עסקים פתוחים בלי רישיון?',
    'כמה בתי עסק עם הכנסה נמוכה?',
    'כמה קריאות תברואה היו בינואר?',
    'כמה עסקים במחוז?',
    'כמה עסקים בשכונת הצפון?',
    'כמה תושבים זכאים להנחה?',
    'מה הכלל להנחת אגרת תברואה?',
    'מי זכאי להנחה?',
    'כמה תיקים נסגרו?',
    'כמה תיקים עם חריגה?',
    'כמה תושבים עם נכות?',
    'כמה תיקים בשנת 2025?',
    'מה הסטטוס של תיק CASE-0001?',
  ]) {
    const body = await ask(question);
    assert.ok(body.refused, `${question} is refused`);
    assert.equal(body.counts.value ?? null, null);
    assert.ok(body.interpretationHe, `${question} explains what was understood`);
  }

  const supported = await ask('כמה עסקים יש בעיר?');
  assert.equal(supported.refused, null);
  assert.equal(supported.counts.value, 26);
  assert.match(supported.interpretationHe, /עסקים/);

  const complaints = await ask('כמה קריאות תברואה יש?');
  assert.equal(complaints.refused, null);
  assert.equal(complaints.counts.value, 42);

  const who = await ask('מי מטפל בפיקוח?');
  assert.equal(who.assistant.kind, 'people');
  const whoRefs = who.assistant.people.map((person: any) => person.personRef);
  assert.equal(new Set(whoRefs).size, whoRefs.length, 'one card per person');
  assert.ok(who.assistant.people.some((person: any) => person.name === 'אמיר חדאד'));

  const caseStatus = await ask('מה הסטטוס של תיק CASE-0001?');
  assert.equal(caseStatus.assistant.kind, 'case');
  assert.equal(caseStatus.assistant.case.status, 'CLOSED');
  assert.equal(caseStatus.assistant.case.subjectName, 'מאפייה השכונה');

  const filterRefusal = await ask('כמה עסקים ממתינים לפיקוח כרגע?');
  assert.match(filterRefusal.interpretationHe, /עסקים/);
  assert.match(filterRefusal.interpretationHe, /לא נתמך/);
});

test('an answer cites only the sources its plan read', async () => {
  const answer = await get('/api/answer');
  assert.deepEqual(
    answer.sources.map((source: any) => source.system),
    ['sql'],
  );
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

test('an interview is sent to its owner and only that person can answer it', async () => {
  const { viewers } = await get('/api/viewers');
  const head = viewers.find((v: any) => /מנהלת תברואה/.test(v.label));
  const clerk = viewers.find((v: any) => /רכזת רישוי/.test(v.label));
  const owner = viewers.find((v: any) => /רכז גזברות/.test(v.label));
  assert.ok(head && clerk && owner);

  const headBefore = await get(`/api/interviews?viewer=${head.id}`);
  assert.equal(headBefore.gaps.length, 0, 'the head does not own the gap queue');

  const before = await get(`/api/interviews?viewer=${clerk.id}`);
  const gap = before.gaps.find((g: any) => String(g.proposed_by).includes('eligibility'));
  assert.ok(gap);

  const headSend = await fetch(`${BASE}/api/interviews/open?viewer=${head.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gapRef: gap.ref }),
  });
  assert.equal(headSend.status, 403);

  const sent = await fetch(`${BASE}/api/interviews/open?viewer=${clerk.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gapRef: gap.ref }),
  }).then((res) => res.json());
  assert.equal(sent.sent, true);
  assert.equal(sent.interview.questions.length, 0);
  const ref = sent.interview.ref;

  const wrong = await fetch(`${BASE}/api/interviews/answer?viewer=${head.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ref, answers: { source_system: 'גזברות - מערכת חיובים' } }),
  });
  assert.equal(wrong.status, 403);

  const right = await fetch(`${BASE}/api/interviews/answer?viewer=${owner.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ref,
      answers: {
        source_system: 'גזברות - מערכת חיובים',
        missing_policy: 'להקצות ללא זכאות',
        who_can_supply: 'משה טל, רכז גזברות',
      },
    }),
  });
  assert.equal(right.status, 200);
  const answered = await right.json();
  assert.equal(answered.interview.status, 'answered');
  assert.ok(answered.ruleDecisionRef);

  const decision = await get(`/api/page?ref=${encodeURIComponent(answered.ruleDecisionRef)}`);
  assert.equal(decision.properties.kind, 'eligibility_rule_approved');
  assert.match(decision.properties.decided_by, /משה/);
});

test('the process owner validates the discovered process and its suggestion leaves the queue', async () => {
  const before = await get('/api/process?service=LIC');
  assert.notEqual(before.model.status, 'validated');
  const beforeQueue = await get('/api/approvals?scope=all');

  const res = await fetch(`${BASE}/api/process/LIC/validate`, { method: 'POST' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'validated');

  const after = await get('/api/process?service=LIC');
  assert.equal(after.model.status, 'validated');

  const decision = await get(`/api/page?ref=${encodeURIComponent(body.decision)}`);
  assert.equal(decision.properties.kind, 'process_validated');

  const all = await get('/api/approvals?scope=all');
  assert.equal(all.counts.total, beforeQueue.counts.total - 1, 'the validated workflow suggestion left the department count');
  assert.equal(all.counts.suggestions, beforeQueue.counts.suggestions - 1);

  const connectors = await get('/api/connectors');
  const sql = connectors.sources.find((source: any) => source.id === 'sql');
  assert.ok(sql.suggestions.some((suggestion: any) => suggestion.covered));
});
