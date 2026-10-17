// Slices 8–10. See docs/board/tasks/index.mjs for the schema.

export default [
  // ---------------------------------------------------------------- slice 8
  {
    id: 's8-epic',
    kind: 'epic',
    title: 'Slice 8 — Automation proposals and engine',
    body: `
From a validated process model, propose automations where the data shows
repetitive, rule-like steps; let the owner approve one; run it on new cases.

**Done when** an approved automation runs on a new food-licence application and
the run is auditable and reversible.
`,
    done: [
      'Two proposals are generated with evidence, frequency, time saved and risk',
      'The owner approves one and it runs on a new case',
      'Every run is logged and can be rolled back',
    ],
    labels: ['kind/epic', 'area/api'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's8-propose',
    epic: 's8-epic',
    title: 'Automation proposals from a validated process',
    body: `
Find repetitive, rule-like steps in the validated model: routing to the right
reviewer, reminding before an SLA breach, requesting a missing document,
generating a standard letter. Each proposal states the evidence, how often the
step occurs, the time saved and the risk if wrong.

**Brief:** §5.4 automation proposals; §7 scenario 4.
`,
    done: [
      'Routing and missing-document proposals are generated for the licence process',
      'Time saved is computed from the event log, not guessed',
      'A proposal with insufficient evidence is not generated',
    ],
    labels: ['area/ai', 'area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s7-validate'],
  },
  {
    id: 's8-engine',
    epic: 's8-epic',
    title: 'Lightweight automation engine: trigger, conditions, actions',
    body: `
Own the semantics: a declared trigger (case created, step waiting N days), a
condition tree, and an ordered action list, all versioned and owned. Approving a
proposal creates an enabled automation; changing it creates a new version.

**Brief:** §3 workflows/automation; §2 principle 3 (decisions go to people).
`,
    done: [
      'An automation is declarative, versioned and owned',
      'Disabling or superseding a version is audited',
      'Dry-run mode shows what a run would have done',
    ],
    labels: ['area/api'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s8-propose'],
  },
  {
    id: 's8-actions',
    epic: 's8-epic',
    title: 'Built-in actions: route, remind, request document, generate letter',
    body: `
The four actions the POC needs. Each action is idempotent, has a declared side
effect, and writes an audit entry. Outbound email is simulated locally and
routed through a real transport only when configured.

**Brief:** §5.4 examples.
`,
    done: [
      'Each action is individually tested against a case fixture',
      'Re-running an action does not duplicate its effect',
      'Sending a letter produces a stored draft the human can inspect',
    ],
    labels: ['area/api'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s8-engine'],
  },
  {
    id: 's8-powerautomate',
    epic: 's8-epic',
    title: 'Power Automate export of an approved automation',
    body: `
Export the same semantics as a Power Automate flow definition where the city
already lives in Power Platform, so an approved automation can run in their
tooling. The export is a translation of the model, never a re-implementation.

**Brief:** §3 export to Power Automate; §11 open question 4.
`,
    done: [
      'An approved routing automation exports to a valid flow definition',
      'The export is snapshot-tested against a fixture',
      'Unsupported constructs fail loudly instead of exporting silently wrong',
    ],
    labels: ['area/api'],
    priority: 'P2',
    size: 'M',
    dependsOn: ['s8-engine'],
  },
  {
    id: 's8-run',
    epic: 's8-epic',
    title: 'Run automations on new cases with audit and rollback',
    body: `
New licence applications trigger the enabled automations; each run records its
trigger, inputs, actions, outcome and duration, and can be reversed.

**Brief:** §8 slice 8 done-when.
`,
    done: [
      'A new case triggers the approved automation end to end',
      'A failed run retries with backoff and then surfaces as a gap',
      'Rollback restores the case to its pre-run state',
    ],
    labels: ['area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s8-actions'],
  },

  // ---------------------------------------------------------------- slice 9
  {
    id: 's9-epic',
    kind: 'epic',
    title: 'Slice 9 — Semantic layer, eligibility rules, smart query',
    body: `
The question from §1: "How many residents in my city are eligible for the
sanitation-fee discount?" answered as eligible / not eligible / unknown, with
the rule version used, the sources, and the unknowns turned into gaps.

**Done when** the demo question returns three numbers, an explain view, and a set
of gaps created from the unknowns.
`,
    done: [
      'Eligible, not eligible and unknown counts are produced from a versioned rule',
      'The answer explains plan, rule version, sources, freshness and unknowns',
      'Unknowns create gaps the learning layer can act on',
    ],
    labels: ['kind/epic', 'area/api'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's9-rules',
    epic: 's9-epic',
    title: 'Rule catalogue: versioned rules with owner, citation, effective dates',
    body: `
An eligibility rule is data: criteria over ontology properties, thresholds,
legal citation, named owner, effective date range, and a status (draft, approved,
superseded). It is versioned and never edited in place.

**Brief:** §4 rule; §5.7 eligibility questions.
`,
    done: [
      'A rule renders as a readable sentence and as a machine evaluable form',
      'Evaluation names the exact rule version used',
      'A rule without an owner cannot be approved',
    ],
    labels: ['area/db'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s1-records'],
  },
  {
    id: 's9-tristate',
    epic: 's9-epic',
    title: 'Tri-state eligibility evaluator: eligible, not eligible, unknown',
    body: `
Evaluate per person/household and return three outcomes, where unknown names the
missing input that blocked a decision (household income, disability certificate,
residency date). This is the capability that makes the answer honest, and it is a
domain function with tests, not a query.

**Brief:** §5.7 the answer has three parts.
`,
    done: [
      'Every criterion returns true, false or unknown with a reason code',
      'Combination logic is declared per criterion (unknown is not silently false)',
      'A gold test set of residents covers all three outcomes',
    ],
    labels: ['area/db', 'area/eval'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s9-rules'],
  },
  {
    id: 's9-planner',
    epic: 's9-epic',
    title: 'Query planner: typed plan, never free SQL',
    body: `
The planner (an AI role) turns a question into a typed plan: entities, filters,
metric, rule, aggregation, grouping. The server executes the plan against the
store with row-level security. Invalid plans fail with a reason the asker can
read.

**Brief:** §5.7 semantic layer.
`,
    done: [
      'A question produces a plan that is validated before execution',
      'The model never emits SQL; the executor only accepts plan objects',
      'An unanswerable question says what is missing instead of guessing',
    ],
    labels: ['area/ai', 'area/api'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s9-tristate', 's1-api'],
  },
  {
    id: 's9-execute',
    epic: 's9-epic',
    title: 'Plan execution with access control, freshness and sources',
    body: `
Execute plans with the asker's permissions, report data freshness per source, and
list which sources were consulted. A plan that would need denied records
degrades to an aggregate or a refusal.

**Brief:** §5.7; §2 principle 9.
`,
    done: [
      'Execution respects the same access rules as the record API',
      'Answers carry source freshness timestamps',
      'Denied individual-level access yields an aggregate plus an explanation',
    ],
    labels: ['area/api', 'area/security'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s9-planner'],
  },
  {
    id: 's9-privacy',
    epic: 's9-epic',
    title: 'Aggregate privacy: minimum cell size, suppression, aggregates-only roles',
    body: `
Counts below a declared minimum cell size are suppressed or rounded; staff
without access to individual records receive aggregates only. The minimum is a
declared number with an owner (§2 principle 5), not a constant in the code.

**Brief:** §5.7 privacy on aggregates.
`,
    done: [
      'Small counts are suppressed and the answer says so',
      'An aggregates-only role cannot retrieve individuals through any path',
      'The threshold is configurable with an owner and audit trail',
    ],
    labels: ['area/security', 'area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s9-execute'],
  },
  {
    id: 's9-explain',
    epic: 's9-epic',
    title: 'Explain view: plan, rule version, sources, unknowns',
    body: `
One screen behind "Explain this": the plan, the rule and its citation, the
sources and their freshness, and what could not be decided and why.

**Brief:** §5.7 explain.
`,
    done: [
      'Explain shows the plan in human terms and in its executed form',
      'Unknowns are grouped by cause with counts',
      'Explain works for any answer, including refusals',
    ],
    labels: ['area/web'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s9-execute'],
  },
  {
    id: 's9-draft-rule',
    epic: 's9-epic',
    title: 'Draft an eligibility rule from regulation text, provisional until approved',
    body: `
When no approved rule exists, propose a draft from the regulation or service
document with citations, mark the answer provisional, and route it to the owner.
Drafting never enables authoritative counts.

**Brief:** §5.7 no rule yet; §10 eligibility rules need legal ownership.
`,
    done: [
      'A draft rule cites the passage it came from',
      'Answers produced under a draft are visibly provisional',
      'Approval is required before the number can be quoted as final',
    ],
    labels: ['area/ai', 'area/web'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s9-rules', 's3-extract'],
  },
  {
    id: 's9-unknown-gaps',
    epic: 's9-epic',
    title: 'Turn unanswered parts of a question into targeted gaps',
    body: `
The unknowns from an eligibility answer become gaps with their value computed
from how many records they block, so the learning layer picks them up and asks
the right person — or looks the value up — instead of asking a human everything.

**Brief:** §5.7 unknowns become gaps; §7 scenario 5.
`,
    done: [
      'Unknowns from the demo question create ranked gaps',
      'Closing them moves the eligible/unknown split in a repeat run',
      'The loop is covered by a scenario eval',
    ],
    labels: ['area/ai', 'area/eval'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s9-execute', 's6-detect'],
  },

  // ---------------------------------------------------------------- slice 10
  {
    id: 's10-epic',
    kind: 'epic',
    title: 'Slice 10 — Assistant over everything, evals',
    body: `
One assistant over the org map, the processes and the data. It proposes forms,
rules and automations; it never decides. Answers group their evidence, cite
records, and say what was not checked.

**Done when** the scenario set passes, including the adversarial cases.
`,
    done: [
      'The six demo scenarios run end to end through the assistant or UI',
      'Adversarial cases are refused or ignored as required',
      'Model choice per role is backed by benchmark numbers',
    ],
    labels: ['kind/epic', 'area/ai'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's10-gateway',
    epic: 's10-epic',
    title: 'AI gateway with role routing and swappable models',
    body: `
One gateway, roles as configuration: extraction, interviewing, query planning,
answer writing, drafting. Each role declares its model, parameters, prompt
version and eval baseline, so models can be swapped and benchmarked
(§2 principle 8). Azure OpenAI in production; a deterministic local model for
tests.

**Brief:** §2 principle 8; §3 AI row.
`,
    done: [
      'Every AI call goes through the gateway and is audited',
      'A role can switch model by configuration with no code change',
      'The local stand-in makes tests deterministic and offline-capable',
    ],
    labels: ['area/ai'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's10-assistant',
    epic: 's10-epic',
    title: 'Assistant: org, process and data questions with evidence grouping',
    body: `
"Who handles fire-safety reviews?" "Why do licence applications wait 12 days?"
"How many are eligible?" Each answer groups its evidence, cites records, and
names what was not checked. It proposes; a human confirms.

**Brief:** §5.8 assistant.
`,
    done: [
      'All three question classes are answered from real system data',
      'Every answer lists its evidence and its gaps',
      'The assistant never writes a schema change or enables an automation',
    ],
    labels: ['area/ai', 'area/web'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s10-gateway', 's9-explain', 's4-ui', 's7-variants'],
  },
  {
    id: 's10-scenarios',
    epic: 's10-epic',
    title: 'Scenario eval harness with gold answers',
    body: `
The six scenarios from §7 plus the adversarial set, each with a gold answer, run
as an automated suite that gates CI. This is the acceptance mechanism from
§2 principle 10 and §9.

**Brief:** §7 scenarios, §9 evaluation.
`,
    done: [
      'Each scenario is one declarative spec with a gold answer',
      'A failure names the step and the expected versus actual',
      'The suite runs in under a few minutes on the synthetic dataset',
    ],
    labels: ['area/eval'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s1-api'],
  },
  {
    id: 's10-adversarial',
    epic: 's10-epic',
    title: 'Adversarial suite: injection, unauthorised access, contradiction',
    body: `
Three cases that must pass: an email instructing the AI to ignore its rules, a
clerk asking for individual data they cannot access, and an interview answer
that contradicts existing evidence. Each has a specified acceptable outcome.

**Brief:** §9 adversarial cases.
`,
    done: [
      'Injected instructions are ignored and logged',
      'The unauthorised request yields an aggregate or a refusal, with audit',
      'The contradicting answer becomes a gap, not an overwrite',
    ],
    labels: ['area/eval', 'area/security'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s10-scenarios', 's3-injection'],
  },
  {
    id: 's10-benchmark',
    epic: 's10-epic',
    title: 'Benchmark models per role: latency, quality, cost',
    body: `
Run each role against candidate models on the eval set and publish a comparison
table. The choice per role is a recorded decision with numbers behind it.

**Brief:** §9 model choice per role.
`,
    done: [
      'A benchmark table is published per role',
      'Cost is computed per scenario run',
      'The chosen model per role is recorded in the ADR set',
    ],
    labels: ['area/eval', 'area/ai'],
    priority: 'P2',
    size: 'M',
    dependsOn: ['s10-scenarios'],
  },
];
