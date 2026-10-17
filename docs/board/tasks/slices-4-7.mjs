// Slices 4–7. See docs/board/tasks/index.mjs for the schema.

export default [
  // ---------------------------------------------------------------- slice 4
  {
    id: 's4-epic',
    kind: 'epic',
    title: 'Slice 4 — Org map and responsibility inference',
    body: `
Turn the directory plus work traces into a living map of who does what, with
inferred responsibilities waiting for confirmation by the person and their
manager.

The map is what the learning layer routes by: "who to ask about food-safety
inspections" is a real query this slice must answer.

**Done when** the department map shows confirmed and candidate responsibilities
side by side.
`,
    done: [
      'Org map renders units, people, roles and reported responsibilities',
      'Every inferred responsibility shows its evidence and confidence',
      'People can confirm or reject what the system says they do, and opt out',
    ],
    labels: ['kind/epic', 'area/web'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's4-seed',
    epic: 's4-epic',
    title: 'Seed org graph from the directory',
    body: `
People, units, titles and reporting lines as entities and facts, with the
directory as their evidence. Handles the awkward cases: acting managers,
vacant positions, people in two units, contractors.

**Brief:** §5.2 seed from Entra.
`,
    done: [
      'The Sanitation & Health tree renders correctly from fixtures',
      'A vacant role is representable without inventing a person',
      'A contractor with no manager still appears and is flagged',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s2-entra', 's1-api'],
  },
  {
    id: 's4-inference',
    epic: 's4-epic',
    title: 'Responsibility inference from work traces',
    body: `
Signals: who is on email threads about a topic, document authorship, Teams
channels, case-system assignments. Output is a scored candidate fact ("Dana
probably handles fire-safety reviews for food premises") with evidence.

**Rule.** The score is declared with an owner (§2 principle 5), stored with the
inference, and shown to the person being inferred about.

**Brief:** §5.2 infer responsibilities.
`,
    done: [
      'Each signal type is implemented and independently testable',
      'Precision is measured against confirmed facts on the synthetic department',
      'An inference never appears as confirmed without a human',
    ],
    labels: ['area/ai', 'area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s4-seed', 's3-extract'],
  },
  {
    id: 's4-ui',
    epic: 's4-epic',
    title: 'Org map UI with responsibilities and who-to-ask',
    body: `
The map a department head actually uses: units, people, roles, responsibilities,
and "who to ask about X". Candidate items are visually distinct from confirmed
ones, and the evidence is one click away.

**Brief:** §5.2 output.
`,
    done: [
      'A unit view and a person view both show responsibilities with status',
      'Searching a topic returns the right person with a confidence indicator',
      'Works RTL and keyboard-only',
    ],
    labels: ['area/web'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s4-seed'],
  },
  {
    id: 's4-confirm',
    epic: 's4-epic',
    title: 'Confirmation flow, manager review and opt-out',
    body: `
The person (and their manager) confirm or correct inferred responsibilities.
Corrections are evidence, not overwrites. Staff can opt out of inference from
their own mail and chat, and the opt-out is honoured at inference time.

**Brief:** §10 risk "inferring responsibilities from email is sensitive".
`,
    done: [
      'Confirm, correct and reject each record who and when',
      'An opted-out person is never a subject of inference',
      'A manager sees pending confirmations for their team only',
    ],
    labels: ['area/web', 'area/security'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s4-inference'],
  },
  {
    id: 's4-precision',
    epic: 's4-epic',
    title: 'Responsibility precision metric',
    body: `
Measure precision of inferred responsibilities against confirmed facts, per
signal and per role, and publish it on the eval dashboard. This is the number
that decides whether inference is trustworthy enough to route interviews by.

**Brief:** §9 metrics.
`,
    done: [
      'Precision is reported per signal type with sample size',
      'The metric runs in CI against the synthetic department',
      'A regression threshold is declared with an owner',
    ],
    labels: ['area/eval'],
    priority: 'P1',
    size: 'S',
    dependsOn: ['s4-inference'],
  },

  // ---------------------------------------------------------------- slice 5
  {
    id: 's5-epic',
    kind: 'epic',
    title: 'Slice 5 — Dynamic form engine',
    body: `
Forms generated from the ontology, never hand-coded: a JSON Schema plus UI schema
derived from the types and properties being collected, validated by the ontology.

Three kinds in the POC: interview forms (learning layer), internal collection
(staff), and the service application form (the sanitation-fee discount), all
demonstrated internally.

**Done when** any type renders an accessible RTL form and "Fill with AI"
proposes values for review.
`,
    done: [
      'A form is generated from a type with no hand-written field markup',
      'Every field records whether a human typed it or the system proposed it',
      'The form works in Hebrew, Arabic and English, RTL and keyboard-only',
    ],
    labels: ['kind/epic', 'area/web'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's5-generate',
    epic: 's5-epic',
    title: 'Generate JSON Schema and UI schema from ontology types',
    body: `
Deterministic generation: types become objects, properties become fields with
type, unit, enum, help text and required-by-context rules. The generator is a
pure function so a form can be regenerated and diffed when the ontology changes.

**Brief:** §5.6 forms are generated from the ontology.
`,
    done: [
      'Golden-file tests pin the schema for each POC type',
      'A property description in the pack becomes the field help text',
      'Regeneration after an overlay change produces a readable diff',
    ],
    labels: ['area/web', 'area/db'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s1-packs'],
  },
  {
    id: 's5-validate',
    epic: 's5-epic',
    title: 'Validation from the ontology: types, units, enums, context rules',
    body: `
Validation lives in the domain, runs on the server and is mirrored on the client.
Required-by-context rules come from the pack (an inspection form requires a
premises id; an application requires a residency date). Units are normalized, not
guessed.

**Brief:** §5.6 validation.
`,
    done: [
      'Server rejects invalid submissions with field-level messages',
      'The same rules run client-side for instant feedback',
      'A rule change in the pack changes validation without code edits',
    ],
    labels: ['area/db', 'area/web'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s5-generate'],
  },
  {
    id: 's5-provenance',
    epic: 's5-epic',
    title: 'Per-field provenance: typed, prefilled or document-filled',
    body: `
Each submitted value records its origin: the person typed it, the system
prefilled it (and from which record), or a document filled it (and which
locator). Provenance survives into the resulting fact.

**Brief:** §5.6 per-field provenance.
`,
    done: [
      'A submitted form yields facts whose provenance names the actor and source',
      'A prefilled value the person edited is recorded as typed-by-person',
      'Provenance is visible in the record view, not only in the database',
    ],
    labels: ['area/api', 'area/web'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s5-validate', 's1-records'],
  },
  {
    id: 's5-fill-ai',
    epic: 's5-epic',
    title: '"Fill with AI" proposals that never overwrite human input',
    body: `
Proposes values from linked records and documents, field by field, with the
source of each proposal. Accepting is one click; the proposal is stored as a
candidate fact either way. It cannot modify a field the person has already typed.

**Brief:** §5.6 Fill with AI; §2 principle 4.
`,
    done: [
      'Proposals carry their source and confidence',
      'A typed field is never replaced without an explicit human action',
      'Declining a proposal is remembered so the same proposal is not repeated',
    ],
    labels: ['area/ai', 'area/web'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s5-provenance', 's3-extract'],
  },
  {
    id: 's5-i18n',
    epic: 's5-epic',
    title: 'RTL, Hebrew/Arabic/English, accessibility and mobile',
    body: `
Hebrew is the default for the POC; Arabic and English switch at runtime. RTL
layout is a first-class mode, not a mirror hack. Keyboard navigation, screen
reader labels, focus order and mobile layout are acceptance criteria.

**Brief:** §5.6 accessibility and language.
`,
    done: [
      'The whole app flips to RTL without layout defects',
      'Automated a11y checks pass; a manual keyboard pass is recorded',
      'Arabic form labels come from the ontology, not a translation table of convenience',
    ],
    labels: ['area/web'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s5-validate'],
  },
  {
    id: 's5-render',
    epic: 's5-epic',
    title: 'Renderers: web form and Teams Adaptive Card',
    body: `
One schema, two renderers. The web renderer is the full experience; the Adaptive
Card renderer covers short interviews (1–5 questions) inside Teams. Both submit
to the same endpoint with the same validation.

**Brief:** §5.6 rendering; §3 forms row.
`,
    done: [
      'The same interview form renders as web and as an Adaptive Card',
      'Both paths produce identical facts and provenance',
      'An Adaptive Card submission round-trips through the API in tests',
    ],
    labels: ['area/web'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s5-provenance'],
  },

  // ---------------------------------------------------------------- slice 6
  {
    id: 's6-epic',
    kind: 'epic',
    title: 'Slice 6 — Gap detection, value scoring and interviewing',
    body: `
The learning layer: find what the map does not know, rank by value, and close it
by asking the right person a short generated form.

**Done when** the top gaps produce interviews for the right person and the
answers become evidence that changes the map.
`,
    done: [
      'Gaps are detected from coverage, org map, processes, identity and unanswered queries',
      'The ranked queue explains its ordering with declared inputs',
      'A 3-question interview is generated, delivered, answered, and lands as evidence',
    ],
    labels: ['kind/epic', 'area/ai'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's6-detect',
    epic: 's6-epic',
    title: 'Gap detection from five sources',
    body: `
Coverage (missing attributes per type), org map (unknown owner of a
responsibility), process models (unclear step or decision rule), identity
resolution (ambiguous merge), and queries that could not be answered. Each gap
records what it blocks.

**Brief:** §5.5 gap detection.
`,
    done: [
      'Each source produces gaps with a stable identity so duplicates merge',
      'A gap names what it blocks (which records, which process, which question)',
      'Closing a gap is detected and the gap retires without manual cleanup',
    ],
    labels: ['area/ai', 'area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s1-records', 's4-seed'],
  },
  {
    id: 's6-score',
    epic: 's6-epic',
    title: 'Value scoring with declared inputs and owners',
    body: `
A gap is worth more when it blocks many records, a frequent process, a pending
automation, or a question someone actually asked. The inputs and their weights
are declared, owned and visible — no magic constants (§2 principle 5).

**Brief:** §5.5 prioritisation by value.
`,
    done: [
      'The score is decomposable in the UI: input, value, weight, owner',
      'Weights live in configuration with an owner and a change history',
      'Re-ordering the queue by hand is possible and audited',
    ],
    labels: ['area/ai', 'area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s6-detect'],
  },
  {
    id: 's6-interview',
    epic: 's6-epic',
    title: 'Interview generation: 1–5 prefilled questions with evidence',
    body: `
Pick the right person from the org map, then generate a short form: at most five
questions, prefilled with the system's best guess plus the evidence behind it,
and a "why are you being asked" line. The questions come from the gap, not from
a prompt template that could ask anything.

**Brief:** §5.5 interviewing.
`,
    done: [
      'Every question is traceable to the gap it closes',
      'The prefill shows its source so the person can disagree with it',
      'Generated interviews never exceed five questions',
    ],
    labels: ['area/ai'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s6-score', 's5-generate', 's4-inference'],
  },
  {
    id: 's6-etiquette',
    epic: 's6-epic',
    title: 'Delivery, attention budget and one-open-interview rule',
    body: `
Interviews go to Teams or the web app. At most one open interview per person,
never more than the declared attention budget per week, and skip or decline is a
first-class outcome that is never punished.

**Brief:** §5.5 interview etiquette; §10 over-interviewing risk.
`,
    done: [
      'A second interview for the same person is queued, not delivered',
      'The budget is a declared number with an owner',
      'Decline and skip are recorded and the gap is re-routed or retired',
    ],
    labels: ['area/api', 'area/web'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s6-interview'],
  },
  {
    id: 's6-answers',
    epic: 's6-epic',
    title: 'Answers become evidence; contradictions become new gaps',
    body: `
An answer is evidence with provenance (who, when, which form). It is not truth:
if it contradicts existing evidence, the system creates a contradiction gap and
shows both sides rather than picking a winner.

**Brief:** §5.5 answers become evidence; §9 adversarial "contradicting answer".
`,
    done: [
      'An answer lands as a candidate fact with the interview as its evidence',
      'A contradiction produces a gap naming both sources',
      'The person who answered can see what their answer changed',
    ],
    labels: ['area/ai', 'area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s6-etiquette', 's1-records'],
  },
  {
    id: 's6-active',
    epic: 's6-epic',
    title: 'Active filling from registries, documents and databases',
    body: `
Before asking a person, look for the answer: a registry lookup, a document, a
database row. The result is a candidate fact with its source, and the interview
is cancelled if the gap closes.

**Brief:** §5.5 active filling.
`,
    done: [
      'At least three lookup strategies are implemented for the POC domain',
      'A closed gap cancels pending interviews that only existed for it',
      'Lookup failures degrade to "ask a person", never to a guess',
    ],
    labels: ['area/ai', 'area/data'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s6-detect'],
  },
  {
    id: 's6-yield',
    epic: 's6-epic',
    title: 'Interview yield metric (gaps closed per question)',
    body: `
Measure how much each question actually closed, per role and per gap source, so
the questions can be tuned by evidence instead of intuition.

**Brief:** §9 metrics.
`,
    done: [
      'Yield is reported per interview and rolled up per role',
      'Questions that never close a gap are identified for review',
      'The metric runs on the synthetic department in CI',
    ],
    labels: ['area/eval'],
    priority: 'P2',
    size: 'S',
    dependsOn: ['s6-answers'],
  },

  // ---------------------------------------------------------------- slice 7
  {
    id: 's7-epic',
    kind: 'epic',
    title: 'Slice 7 — Event log, process mining, validation',
    body: `
Discover how food-licence applications actually flow: steps, order, variants,
roles, waiting times and rework loops — from an event log, using established
process-mining algorithms rather than hand-written rules.

**Done when** the service owner reviews the discovered model, corrects it, and
marks it validated.
`,
    done: [
      'The licence process is discovered with variants and waits',
      'The three most common variants cover a stated share of cases',
      'The owner validates a model and the validated version is versioned',
    ],
    labels: ['kind/epic', 'area/data'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's7-eventlog',
    epic: 's7-epic',
    title: 'Build the event log from work traces',
    body: `
Events: case created, document received, inspection scheduled, inspection done,
correction requested, approved, licence issued, fee charged. Keyed by case or
entity, with a timestamp, actor and source. Email contributes supplementary
events; the case system is the primary source (§10 risk).

**Brief:** §5.4 event log.
`,
    done: [
      'The licence event log covers 18 months of synthetic cases',
      'Every event cites the trace it came from',
      'Email-derived events are marked as supplementary and can be excluded',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s3-identity', 's2-sql'],
  },
  {
    id: 's7-miner',
    epic: 's7-epic',
    title: 'Process discovery: inductive miner over the event log',
    body: `
Implement or wrap inductive mining to produce a process tree, then a model with
fitness and precision. Handles noise and long-tail variants; the algorithm and
its parameters are declared, not tuned silently.

**Brief:** §5.4 process mining.
`,
    done: [
      'A process tree is produced from the log and rendered as a model',
      'Fitness and precision are computed and stored with the model version',
      'Noise threshold and parameters are declared with an owner',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s7-eventlog'],
  },
  {
    id: 's7-variants',
    epic: 's7-epic',
    title: 'Variants, waiting times, rework loops and bottlenecks',
    body: `
Answer "why do licence applications wait 12 days?" with evidence: which step
holds the case, which role, which variant is slow, where rework happens.

**Brief:** §5.4 validation view; §7 scenario 2.
`,
    done: [
      'Variant table shows frequency and duration per variant',
      'The slowest waiting step is identified with its role and median wait',
      'A rework loop is detectable and named',
    ],
    labels: ['area/data', 'area/web'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s7-miner'],
  },
  {
    id: 's7-validate',
    epic: 's7-epic',
    title: 'Validation view: owner reviews and corrects the model',
    body: `
The service owner sees a simple step view ("this is how food licences actually
flow; these 3 variants cover 85% of cases"), corrects it where the data is wrong
or the law requires otherwise, and marks it validated.

**Brief:** §5.4 validation.
`,
    done: [
      'Corrections are stored as evidence against the discovered model',
      'Validated status is versioned and never silently replaced by a re-mine',
      'The owner can see which steps the data supported weakly',
    ],
    labels: ['area/web'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s7-variants'],
  },
  {
    id: 's7-metrics',
    epic: 's7-epic',
    title: 'Process discovery fitness and precision metrics',
    body: `
Score discovered models against the validated model and against a holdout log,
so model choice and mining parameters are evidence-based.

**Brief:** §9 metrics.
`,
    done: [
      'Fitness and precision are reported per discovered model',
      'The metric is part of the eval suite run in CI',
      'A regression in either metric fails the build',
    ],
    labels: ['area/eval'],
    priority: 'P1',
    size: 'S',
    dependsOn: ['s7-miner'],
  },
];
