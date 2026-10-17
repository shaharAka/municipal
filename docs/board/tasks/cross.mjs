// Cross-cutting workstreams: domain decisions, the synthetic dataset,
// governance, and the eval infrastructure. These are not slices; they run
// alongside and gate them.

export default [
  // ------------------------------------------------------- domain decisions
  {
    id: 'x-dec-epic',
    kind: 'epic',
    title: 'Domain decisions and the brief\'s open questions',
    body: `
The brief ends with five open questions for the owner. The POC answers them here
so no slice stalls waiting for a decision, and each answer is a short ADR with
its consequences recorded.

Answered already: department and services (Sanitation & Health), local
substitutes, synthetic-only data.
`,
    done: [
      'Every open question in §11 has a decision or an explicit deferral',
      'Each decision states what it rules out',
      'The demo narrative is fixed and testable',
    ],
    labels: ['kind/epic', 'area/docs'],
    priority: 'P0',
    size: 'S',
  },
  {
    id: 'x-dec-scope',
    epic: 'x-dec-epic',
    kind: 'decision',
    title: 'ADR-0002: POC scope is the Sanitation & Health department',
    body: `
**Decision.** The POC is the Sanitation & Health department (תברואה ובריאות) of
the fictional City of Givat Rimon, with three services:

1. **Food-business health licence** — the process-mining and automation target.
2. **Sanitation-fee discount** — the eligibility/query target.
3. **Sanitation and pest-control complaints** — the routing and SLA target.

Why this department: it has a genuine declared eligibility rule, a licence
process with real variants and waits, a high-volume complaint queue, and it
touches residents, businesses, properties and assets all at once — so the
ontology is exercised for real without inventing a fake city.

**Rules out.** Welfare and property-tax services, and multi-department rollout,
for this POC.
`,
    done: [
      'The three services are named with their trigger and outcome',
      'The demo scenarios are rewritten against these services',
      'The department roster exists as a fixture',
    ],
    labels: ['kind/decision', 'area/docs'],
    priority: 'P0',
    size: 'S',
  },
  {
    id: 'x-dec-data',
    epic: 'x-dec-epic',
    kind: 'decision',
    title: 'ADR-0003: synthetic-only data for the POC',
    body: `
**Decision.** All person-level data is synthetic and generated from a fixed seed;
no real staff mailboxes, no export of real residents. Directory structure mirrors
a real municipality (units, titles, reporting lines) so the org map is credible,
but every name is fictional.

**Consequence.** The demo is reproducible from a seed and can be shown in any
room; the Entra/Graph connectors are proven against fixtures, and the approval
work for real data (§10 risk) is deferred to a later phase with its own DPIA.
`,
    done: [
      'A seed reproduces the dataset byte-for-byte',
      'No fixture contains a real person or a real address',
      'The decision is stated in the demo script',
    ],
    labels: ['kind/decision', 'area/security'],
    priority: 'P0',
    size: 'S',
  },
  {
    id: 'x-dec-lang',
    epic: 'x-dec-epic',
    kind: 'decision',
    title: 'ADR-0004: Hebrew default, Arabic and English supported',
    body: `
**Decision.** Hebrew is the default UI language, RTL is the default layout
direction, and Arabic and English are supported from the same ontology labels.
Legal citations are Hebrew with an English translation field.

**Consequence.** Every label lives in the ontology packs, not in a translation
file added later; adding a language is a data change.
`,
    done: [
      'Labels for the POC types exist in he, ar and en',
      'A language switch flips direction and content without reload artifacts',
    ],
    labels: ['kind/decision', 'area/web'],
    priority: 'P0',
    size: 'S',
  },
  {
    id: 'x-dec-automation',
    epic: 'x-dec-epic',
    kind: 'decision',
    title: 'ADR-0005: own automation engine first, Power Automate export second',
    body: `
**Decision.** The POC runs approved automations in its own engine, and exports
the same model to Power Automate where the city already uses it. The engine owns
the semantics; the export is a translation.

**Rules out.** Building the POC as a Power Automate flow library, which would
lose the audit and rollback story.
`,
    done: [
      'The engine is the source of truth for an approved automation',
      'Export is verified against a flow definition fixture',
    ],
    labels: ['kind/decision', 'area/api'],
    priority: 'P1',
    size: 'S',
  },

  // -------------------------------------------------------------- synthetic data
  {
    id: 'x-data-epic',
    kind: 'epic',
    title: 'Synthetic dataset for Sanitation & Health',
    body: `
Every demo depends on one thing: a dataset with the right shape — realistic gaps,
realistic delays, realistic contradictions. Build it deliberately and version it,
because the gold answers are written against it.
`,
    done: [
      'The dataset builds from a seed into fixtures and CSV exports',
      'It contains the gaps and delays the demo scenarios need',
      'Gold answers match it exactly',
    ],
    labels: ['kind/epic', 'area/data'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 'x-data-org',
    epic: 'x-data-epic',
    title: 'Department directory fixture: ~25 staff, 4 units',
    body: `
Units: licensing and inspections, sanitation field operations, pest control, and
the department office. Include a deputy filling an acting role, one vacant
position, a contractor, and three people who split time between this department
and another — the cases that break naive org code.

**Brief:** §5.2 seed from Entra.
`,
    done: [
      'Reports-to relationships are consistent and cycle-free',
      'Acting roles, vacancy, contractor and split assignments all present',
      'The fixture matches the claims shape the auth port returns',
    ],
    labels: ['area/data'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['x-dec-scope'],
  },
  {
    id: 'x-data-residents',
    epic: 'x-data-epic',
    title: 'Residents, households and properties with deliberate gaps',
    body: `
About 1,200 residents in 600 households across 400 properties, seeded in
Givat Rimon. Deliberate gaps: ~18% missing household income for the discount
rule, ~7% with an expired disability certificate, ~4% with no residency date on
file. These gaps are what produce the "unknown" bucket, so their exact
composition is a fixture, not an accident.

**Brief:** §7 data; §5.7 unknown counts.
`,
    done: [
      'Gap composition matches the gold eligibility split',
      'Address normalization has a realistic dirty subset',
      'Household to property to fee links are complete',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['x-data-org', 's1-packs'],
  },
  {
    id: 'x-data-licence',
    epic: 'x-data-epic',
    title: 'Food-licence cases and an 18-month event log',
    body: `
~300 licence applications across ~180 food premises, with the event log the
process-mining slice needs: received, documents requested, inspection scheduled,
inspection done, corrections requested, re-inspection, approved, issued, fee
charged. Build in the real-world shapes: two long waiting steps, a rework loop
after failed inspection, seasonal batches before holidays.

**Brief:** §5.4 event log; §7 scenario 2.
`,
    done: [
      'Three dominant variants emerge, covering ~85% of cases',
      'The waiting bottleneck is reproducible from the log',
      'Email is supplementary only; the case system carries the bulk',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['x-data-org'],
  },
  {
    id: 'x-data-eligibility',
    epic: 'x-data-epic',
    title: 'Sanitation-fee discount rule and gold eligibility labels',
    body: `
The declared rule: a household qualifies for the sanitation-fee discount on one
of three grounds — senior householder (age threshold, declared with owner and
citation to the municipal bylaw), disability certificate on file, or income below
a declared threshold. Effective dates and a superseded version are included so
the "which rule version" part of the answer is real.

Gold labels per household: eligible, not eligible, or unknown with a reason code.
`,
    done: [
      'The rule has two versions with an effective-date boundary',
      'Gold counts are computed from the generator, not by hand',
      'Every unknown has a reason code the answer can surface',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['x-data-residents', 's9-rules'],
  },
  {
    id: 'x-data-docs',
    epic: 'x-data-epic',
    title: 'Mailbox and document corpus for the department',
    body: `
A sample food-licence mailbox with realistic threads (document chasing,
inspection scheduling, fee questions, one angry complaint), a SharePoint
library of licence conditions, inspection reports and fee spreadsheets, and one
scanned Hebrew inspection report for the OCR path. Include one document
containing instructions addressed to an AI.

**Brief:** §7 data; §9 adversarial case.
`,
    done: [
      'Threads connect to case entities through identity resolution',
      'Formats cover PDF, Word, Excel and a scanned image',
      'The adversarial document is present and labelled in the spec',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['x-data-licence'],
  },

  // ----------------------------------------------------------------- governance
  {
    id: 'x-gov-epic',
    kind: 'epic',
    title: 'Privacy, security and governance',
    body: `
§6 says these are must-haves even for a POC. Treated as a workstream, not a
closing checklist: the constraints shape slices 1, 2, 9 and 10 as they are built.
`,
    done: [
      'Every read and AI call is audited and reviewable',
      'Sensitivity labels are honoured through ingestion and retrieval',
      'Retention and erasure work on the learned layer, not just the source',
    ],
    labels: ['kind/epic', 'area/security'],
    priority: 'P0',
    size: 'M',
  },
  {
    id: 'x-gov-dpia',
    epic: 'x-gov-epic',
    title: 'Data map and DPIA outline for the Israeli Privacy Protection Law',
    body: `
What the system holds, where it came from, who can see it, how long it lives,
and what legal basis covers it — written so the municipality's counsel can review
it (Amendment 13 obligations included). Synthetic data now; the document is the
one that unlocks real data later.

**Brief:** §6 legal review.
`,
    done: [
      'Every entity and property in the POC maps to a data category and a purpose',
      'Retention per category is declared with an owner',
      'The outline is reviewed against the law by the named counsel contact',
    ],
    labels: ['area/docs', 'area/security'],
    priority: 'P1',
    size: 'M',
  },
  {
    id: 'x-gov-labels',
    epic: 'x-gov-epic',
    title: 'Sensitivity label mapping through the whole path',
    body: `
Purview labels (or their local equivalent) are read at ingestion, stored on the
source item, inherited by facts derived from it, and enforced at retrieval and
in aggregates. A derived fact may never be less sensitive than its source.

**Brief:** §6 respect labels; §3 governance row.
`,
    done: [
      'A labelled document yields facts with the same label',
      'Retrieval filters by label before ranking',
      'A test proves a derived value cannot downgrade sensitivity',
    ],
    labels: ['area/security'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s3-pipeline'],
  },
  {
    id: 'x-gov-retention',
    epic: 'x-gov-epic',
    title: 'Retention policy and erasure from the learned layer',
    body: `
Declared retention per data category, applied by a scheduled job, plus erasure:
a person's facts and derived values are removed on request, with the audit trail
retained and the derived caches (embeddings, aggregates) invalidated.

**Brief:** §6 retention and erasure.
`,
    done: [
      'A retention job archives and deletes per declared policy',
      'Erasing a person removes their facts and embeddings',
      'An erasure run is reproducible in a test and leaves an audit record',
    ],
    labels: ['area/security', 'area/db'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s1-records'],
  },
  {
    id: 'x-gov-audit-review',
    epic: 'x-gov-epic',
    title: 'Audit coverage review across every read path',
    body: `
Walk every path that reads data — API, search, forms, AI tools, aggregates,
exports — and prove each writes an audit entry with the right attributes. Fix
the ones that do not.

**Brief:** §6 audit log of every query, interview and AI call.
`,
    done: [
      'A checklist covers every read path with a test per path',
      'Gaps found are fixed, not documented as known limitations',
      'An auditor can reconstruct who saw what, when',
    ],
    labels: ['area/security', 'area/eval'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s0-audit', 's9-execute'],
  },

  // ----------------------------------------------------------------------- evals
  {
    id: 'x-eval-epic',
    kind: 'epic',
    title: 'Evaluation infrastructure and acceptance',
    body: `
Acceptance comes from evals and scenarios, not demos (§2 principle 10). The
harness lands early and gates every slice, so "done" means measured, not shown.
`,
    done: [
      'One command runs the scenario suite and prints a scoreboard',
      'CI fails on regression against declared thresholds',
      'Every metric in §9 is computed, not asserted',
    ],
    labels: ['kind/epic', 'area/eval'],
    priority: 'P0',
    size: 'M',
  },
  {
    id: 'x-eval-runner',
    epic: 'x-eval-epic',
    title: 'Eval runner: declarative scenario to scored result',
    body: `
A scenario is a file: setup, actions, expected outcome, tolerances. The runner
executes it against a seeded dataset, records the transcript, and scores it.
Runs are reproducible from the seed alone.

**Brief:** §9 scenario evals.
`,
    done: [
      'A scenario file needs no code to add',
      'Failed comparisons print expected versus actual with the data slice involved',
      'Transcripts are stored for review, including AI prompts and outputs',
    ],
    labels: ['area/eval'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 'x-eval-gold',
    epic: 'x-eval-epic',
    title: 'Gold answer set for six scenarios and adversarial cases',
    body: `
Hand-checked answers for the six demo scenarios plus the adversarial set: counts,
which person should be asked, which variants cover 85%, which automation should
be proposed, and the three adversarial outcomes.

**Brief:** §7, §9.
`,
    done: [
      'Every scenario has a gold answer traceable to the generator',
      'Gold answers are versioned alongside the dataset',
      'A changed dataset fails the gold check loudly',
    ],
    labels: ['area/eval'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['x-data-epic'],
  },
  {
    id: 'x-eval-metrics',
    epic: 'x-eval-epic',
    title: 'Metrics: query correctness, interview yield, time to first automation',
    body: `
Implement the §9 metrics end to end and publish them on one scoreboard:
responsibility precision, process fitness and precision, query correctness
including the unknown bucket, interview yield, and time to first useful
automation.

**Brief:** §9 metrics.
`,
    done: [
      'Each metric has a definition, an owner and a threshold',
      'The scoreboard renders from the last CI run',
      'Unknown-bucket correctness is graded separately from the eligible count',
    ],
    labels: ['area/eval'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['x-eval-runner'],
  },
];
