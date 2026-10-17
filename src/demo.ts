// Headless walk-through of the POC loop, printed as it runs.
//
//   npm run demo
//
// Every number below is computed from the graph at that moment. Nothing is a
// fixture baked into this file.

import { buildDemo } from './platform.ts';

const rule = (title: string) => console.log(`\n${'─'.repeat(78)}\n${title}\n${'─'.repeat(78)}`);
const num = (n: number) => n.toLocaleString('en-GB');

const demo = await buildDemo();
const p = demo.primary;
const g = p.graph;

rule(`1 · CONNECT — ${p.organization} (${p.fixture.tenantName})`);
for (const source of p.report.sources) {
  console.log(
    `  ${source.label.padEnd(32)} ${source.pages.toString().padStart(5)} pages   ${source.endpoints.join(', ')}`,
  );
}
console.log(`  documents read: ${p.report.documents.length} · mail messages: ${g.ofType('message').length}`);
if (p.report.findings.length) {
  for (const finding of p.report.findings) {
    console.log(`  ! ${finding.kind} in "${finding.document}": ${finding.excerpt.slice(0, 70)}…`);
  }
}

rule('2 · MAP — the integrated data, in the ontology');
console.log(
  `  ${g.pages.size} pages · ${g.edges.length} edges · ${num(g.facts.length)} facts, each with provenance and a locator`,
);
const byStatus = g.stats().byStatus;
console.log(
  `  facts: ${num(byStatus.confirmed)} confirmed by a declared rule, ${num(byStatus.candidate)} candidate (a model or an inference proposed them)`,
);
const types = Object.entries(g.stats().byType).sort((a, b) => b[1] - a[1]);
console.log('  ' + types.map(([t, n]) => `${t} ${n}`).join(' · '));
const mapCoverage = p.report.coverage;
const mapped = mapCoverage.filter((c) => c.mappedFrom).length;
console.log(`  ontology coverage: ${mapped}/${mapCoverage.length} properties have a source behind them`);
for (const candidate of p.report.schemaCandidates) {
  console.log(
    `  ? candidate "${candidate.proposal.property}" on ${(candidate.proposal.page_types ?? [candidate.proposal.page_type]).join(' & ')} — ${candidate.support_count} rows, awaiting a person`,
  );
}

rule('3 · ORGANIZE — structure and who does what');
for (const unit of p.org.units) {
  const head = p.org.people.find((person) => person.ref === unit.headRef);
  console.log(`  ${unit.name.padEnd(24)} ${String(unit.headcount).padStart(2)} people   head: ${head?.name ?? '—'}`);
}
const resp = p.org.responsibilities;
console.log(`\n  ${resp.length} inferred responsibilities, each a candidate awaiting confirmation:`);
for (const r of resp.sort((a, b) => b.support - a.support).slice(0, 6)) {
  const person = p.org.people.find((x) => x.ref === r.personRef);
  console.log(`    ${(person?.name ?? '').padEnd(14)} ${r.summary}`);
}

rule('4 · DISCOVER — how the work actually moves');
for (const model of p.models) {
  console.log(`\n  ${model.serviceName} (${model.serviceCode}) — ${model.caseCount} cases over ${model.windowDays} days`);
  console.log(`    median case ${model.medianTotalDays} days · p90 ${model.p90TotalDays} · ${model.variants.length} variants`);
  console.log(`    top three variants cover ${Math.round(model.coverageOfTopVariants * 100)}% of cases`);
  for (const v of model.variants.slice(0, 3)) {
    console.log(`      ${String(Math.round(v.coverageShare * 100)).padStart(3)}%  ${String(v.caseCount).padStart(3)} cases  ${v.sequence.slice(0, 5).join(' → ')}${v.sequence.length > 5 ? ' → …' : ''}`);
  }
  const worst = model.steps.slice(0, 3);
  console.log('    slowest steps (median wait to the next event):');
  for (const step of worst) {
    console.log(`      ${step.labels.padEnd(20)} ${String(step.medianWaitDays).padStart(5)} days   ${step.role}`);
  }
}

rule('5 · GROW — automations proposed from the evidence');
for (const proposal of p.proposals) {
  console.log(`\n  [${proposal.risk} risk] ${proposal.title}`);
  console.log(`    ${proposal.rationale}`);
  console.log(
    `    ${proposal.expectedCasesPerYear} cases/yr · ${proposal.timeSavedDaysPerCase} days/case · ${num(proposal.annualDaysSaved)} days/yr`,
  );
  console.log(`    evidence: ${proposal.evidence.join(' · ')}`);
}

rule('6 · ACCESS — permissions mirrored from the source');
for (const viewer of p.viewers) {
  const hidden = g
    .ofType('document')
    .filter((doc) => (g.view(viewer, doc.ref)?.facts.length ?? 0) === 0)
    .map((doc) => doc.title);
  const user = p.fixture.users.find((u) => u.id === viewer.id);
  console.log(
    `  ${String(user?.displayName).padEnd(14)} sees ${p.fixture.drives[0].items.length - hidden.length}/${p.fixture.drives[0].items.length} documents${hidden.length ? ` — hidden: ${hidden.join(', ')}` : ''}`,
  );
}

rule(`7 · REUSE — onboard ${demo.secondary.organization} from ${p.organization}'s graph`);
const d = demo.diff;
console.log(`  template: ${d.source_template.id} v${d.source_template.version} (${d.source_template.organization})`);
console.log(
  `  coverage: units ${Math.round(d.summary.unit_coverage * 100)}% · roles ${Math.round(d.summary.role_coverage * 100)}% · process steps ${Math.round(d.summary.step_coverage * 100)}%`,
);
for (const m of d.units.matched) {
  const mark = m.verdict === 'same' ? '=' : '≈';
  console.log(`  ${mark} ${m.template.name} → ${m.target.name}  (${m.verdict}, similarity ${m.similarity}, role overlap ${m.roleOverlap})`);
}
for (const u of d.units.added) console.log(`  + ${u.name} (${u.name_en}) — ${u.headcount} people`);
for (const u of d.units.missing) console.log(`  - ${u.name} (${u.name_en}) — not in the target`);
console.log(`  roles added: ${d.roles.added.join(', ') || '—'}`);
console.log(`  roles missing: ${d.roles.missing.join(', ') || '—'}`);
for (const proc of d.process) {
  if (proc.steps.added.length || proc.steps.missing.length) {
    console.log(
      `  ${proc.service_code}: +${proc.steps.added.join(',') || '—'}  -${proc.steps.missing.join(',') || '—'}  (median ${proc.median_days_delta >= 0 ? '+' : ''}${proc.median_days_delta} days)`,
    );
  }
}
console.log('\n  the work left for a person is the difference above, not a re-mapping of the whole city.');

await demo.close();
console.log('\nDone.\n');
