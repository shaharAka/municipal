// Slices 0–3. See docs/board/tasks/index.mjs for the schema.
// POC domain: Sanitation & Health department (תברואה ובריאות) of the fictional
// City of Givat Rimon. Services: food-business health licence, sanitation-fee
// discount, sanitation/pest-control complaints.

export default [
  // ---------------------------------------------------------------- slice 0
  {
    id: 's0-epic',
    kind: 'epic',
    title: 'Slice 0 — Repo, skeleton, auth, audit',
    body: `
The shell everything else stands on: a repo that runs, a signed-in staff member,
and an audit log that records every read, write and AI call from the first commit.

**Runtime decision.** The brief names Azure Container Apps + Azure Postgres +
Entra + Graph. This machine has no Docker, no Postgres, no Azure CLI, so the POC
runs locally against substitutes that sit behind the same interfaces production
will use. That is the single most load-bearing decision in the build: get the
adapter boundaries right here and the Azure path is a swap, not a rewrite.

**Done when** a staff member signs in locally, sees an empty workspace, and their
visit appears in the audit log.
`,
    done: [
      'Signed-in staff member sees an empty workspace',
      'Every API request lands in an append-only audit log',
      'CI is green on typecheck, lint and tests',
    ],
    labels: ['kind/epic', 'area/infra'],
    priority: 'P0',
    size: 'M',
  },
  {
    id: 's0-adr',
    epic: 's0-epic',
    title: 'ADR-0001: runtime, local substitutes and adapter boundaries',
    body: `
Record the decisions that the rest of the build depends on, before code exists.

**Decide.**
- Language/runtime: TypeScript on Node 22, npm workspaces (no pnpm on this machine).
- API: Fastify. Web: Vite + React + TypeScript.
- Store: Postgres in production; SQLite locally through one repository interface.
- Graph/Entra: real Microsoft Graph client behind a GraphPort interface, with a
  fixture-backed fake for local runs.
- AI: one gateway with role routing; Azure OpenAI in production, deterministic
  local stand-in for tests and offline demos.
- Auth: OIDC/Entra adapter with a local claims-based sign-in.

**Constraint from the brief.** Local substitutes may not leak into domain code:
no SQLite-specific SQL in repositories, no Graph types outside the adapter.

**Brief:** §3 architecture table, §8 slice 0.
`,
    done: [
      'ADR merged under docs/decisions/ with the rejected alternatives listed',
      'Every Azure service in §3 named with its local substitute',
      'An interface sketch exists for Store, GraphPort, AIGateway and AuthPort',
    ],
    labels: ['kind/decision', 'area/docs'],
    priority: 'P0',
    size: 'S',
  },
  {
    id: 's0-workspace',
    epic: 's0-epic',
    title: 'Monorepo layout and shared packages',
    body: `
Set up npm workspaces with the packages the slices will need:
apps/api, apps/web, packages/domain (ontology, records, rules), packages/store
(repository interfaces + sqlite/postgres drivers), packages/connectors,
packages/ai, packages/eval.

**Brief:** §8 slice 0.
`,
    done: [
      'npm run build and npm test work from the root',
      'Dependency direction is one-way (domain depends on nothing it does not own)',
      'A dependency-cruiser or eslint-import rule fails the build on a cycle',
    ],
    labels: ['area/infra'],
    priority: 'P0',
    size: 'S',
    dependsOn: ['s0-adr'],
  },
  {
    id: 's0-store',
    epic: 's0-epic',
    title: 'Store adapter: SQLite locally, Postgres in production',
    body: `
One repository interface over both engines, plus migration tooling that runs on
both. Locally the store is a file, so a demo is a fresh checkout and a command.

**Includes.** schema migrations, transactional writes, an outbox table for jobs,
and a test suite that runs against both engines when Postgres is available.

**Brief:** §3 system store (Postgres, RLS, pgvector).
`,
    done: [
      'npm run db:reset gives a clean local database',
      'The same repository test suite passes on SQLite and on Postgres',
      'No engine-specific SQL outside packages/store',
    ],
    labels: ['area/db', 'area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s0-workspace'],
  },
  {
    id: 's0-auth',
    epic: 's0-epic',
    title: 'Auth port with local staff sign-in mirroring Entra claims',
    body: `
Staff authenticate through an AuthPort. Production resolves OIDC against Entra
ID; locally a claims fixture stands in, carrying objectId, displayName, mail,
department, manager and group membership — the same claims the org map and every
permission check will read.

**Brief:** §3 identity; §2 principle 9 (permissions on every read and write).
`,
    done: [
      'A staff member can sign in and out locally',
      'Session carries the claims the org map needs',
      'Unauthenticated calls to the API are rejected and audited',
    ],
    labels: ['area/api', 'area/security'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s0-workspace', 's0-store'],
  },
  {
    id: 's0-audit',
    epic: 's0-epic',
    title: 'Append-only audit log: query, interview and AI call',
    body: `
Every read of a record, every interview delivered or answered and every AI call
writes an audit entry: who, what, which records, which purpose, when, and the
model and prompt version for AI calls.

**Rules.** The log is append-only, readable only by the auditor role, and written
on the same transaction boundary as the action it records.

**Brief:** §6 purpose and access; §9 acceptance needs this for the unauthorised-
access scenario.
`,
    done: [
      'Query, interview and AI calls all produce audit entries',
      'A test proves the log cannot be updated or deleted through the API',
      'Auditor role can read the log; nobody else can',
    ],
    labels: ['area/security', 'area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s0-auth'],
  },

  // ---------------------------------------------------------------- slice 1
  {
    id: 's1-epic',
    kind: 'epic',
    title: 'Slice 1 — Ontology packs, records, provenance, RLS',
    body: `
The shared model from §4, made real: entities, facts that are never silently
overwritten, evidence with exact locators, schema candidates that only a person
accepts, and row-level access mirrored from the source.

This slice defines the language every later slice speaks. The tri-state
eligibility story in slice 9 is only credible if facts can stay *unknown* here,
so the record model must distinguish "no value" from "value we have not checked".

**Done when** entities and facts with evidence round-trip through the API, with
access enforced per person.
`,
    done: [
      'Entities, facts and evidence round-trip through the API',
      'A fact can be candidate, confirmed or rejected, and every change is versioned',
      'A person without access to a record cannot read it through any endpoint',
    ],
    labels: ['kind/epic', 'area/db'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's1-pack-format',
    epic: 's1-epic',
    title: 'Ontology pack format and loader',
    body: `
A declarative format for packs: types, properties (with data type, unit, enum,
cardinality), relations, sensitivity defaults and required-by-context rules.
Packs are data, not code, so a city can read and diff them.

**Brief:** §2 principle 1, §5.3 seed packs.
`,
    done: [
      'A pack is validated on load, with a readable error for every mistake',
      'Packs are versioned and loading a new version never mutates existing facts',
      'TypeScript types are generated from packs so code cannot drift from the schema',
    ],
    labels: ['area/db', 'area/docs'],
    priority: 'P0',
    size: 'M',
  },
  {
    id: 's1-packs',
    epic: 's1-epic',
    title: 'Municipal seed packs: nine domains',
    body: `
Write the seed packs named in §5.3, trimmed to what the Sanitation & Health
department actually touches but complete enough to extend:
People & org, Residents & households, Property & addresses, Businesses &
licences, Services & eligibility, Applications & cases, Payments & fees, Assets &
infrastructure, Documents.

For this department the load-bearing ones are: Resident, Household, Property,
Business (food premises), Licence, Inspection, Fee, Discount, Complaint, Case.
`,
    done: [
      'Nine packs load and render in the ontology browser',
      'Food-business and sanitation-fee types carry the fields the demo needs',
      'Every property has a description a non-engineer can understand',
    ],
    labels: ['area/data', 'area/db'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s1-pack-format'],
  },
  {
    id: 's1-overlay',
    epic: 's1-epic',
    title: 'City overlay: extend the packs without forking them',
    body: `
A city adds properties, enum values and relations in an overlay that layers over
the shipped packs. Conflicts are surfaced, never resolved silently. Overlay
entries are themselves versioned and owned.

**Brief:** §2 principle 1 ("the model never silently changes the schema").
`,
    done: [
      'The overlay can add a property to a shipped type without editing the pack',
      'A conflicting redefinition fails with a named owner and a diff',
      'Removing an overlay entry leaves existing facts readable',
    ],
    labels: ['area/db'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s1-packs'],
  },
  {
    id: 's1-records',
    epic: 's1-epic',
    title: 'Record model: entity, fact, evidence and versioning',
    body: `
Implement §4 exactly: source items by reference with content hash, sensitivity
label and access list; evidence with an exact locator (message id + span, file +
page + cell, row + column); facts with status, confidence, evidence and
confirming party; facts versioned, never overwritten.

A fact that was never observed and a fact observed as empty are different things
— model the difference now, it is what makes "unknown" answerable later.

**Brief:** §4 shared model, §2 principles 2 and 3.
`,
    done: [
      'Facts carry evidence, confidence and confirmer, and change history is readable',
      'Rejecting a fact keeps it visible with its reason',
      'Absent and empty are distinguishable in queries',
    ],
    labels: ['area/db', 'area/api'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s1-pack-format'],
  },
  {
    id: 's1-schema-candidates',
    epic: 's1-epic',
    title: 'Schema candidates: propose, accept, rename, map',
    body: `
A schema candidate proposes a new type, property, relation or enum value with the
evidence that suggested it and an example count. A steward accepts, renames or
maps it to an existing property; nothing reaches the live schema otherwise.

**Brief:** §2 principle 1, §5.3 schema discovery.
`,
    done: [
      'A candidate is stored with its evidence and frequency',
      'Accept, rename and map each produce a versioned schema change',
      'Rejected candidates stay queryable so the same proposal is not re-raised weekly',
    ],
    labels: ['area/db', 'area/web'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s1-records'],
  },
  {
    id: 's1-rls',
    epic: 's1-epic',
    title: 'Row-level access mirroring and enforcement',
    body: `
Every source item keeps the access list it had in the source. Every read —
API, form, report or AI tool call — is filtered by the asking person's access.
Postgres RLS in production; an equivalent guard in the local store so the rule
is tested from day one, not bolted on for Azure.

**Brief:** §2 principle 9, §5.1 access mirroring, §6 least privilege.
`,
    done: [
      'Queries return only records the asker could see in the source',
      'A denied read is not distinguishable from a missing record',
      'Tests cover admin, inspector and clerk roles on the same data',
    ],
    labels: ['area/security', 'area/db'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s1-records', 's0-auth'],
  },
  {
    id: 's1-api',
    epic: 's1-epic',
    title: 'Entity and fact API with evidence round-trip',
    body: `
CRUD with a confirmation workflow: create a candidate fact with evidence, read
the graph around an entity, confirm or reject a fact as an authorised person.
This is the contract slices 3–10 consume; freeze it early and version it.

**Brief:** §8 slice 1 done-when.
`,
    done: [
      'An entity with facts and evidence round-trips through the API in one call',
      'OpenAPI schema published and used to generate the web client',
      'Contract tests fail on an accidental breaking change',
    ],
    labels: ['area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s1-records', 's1-rls'],
  },

  // ---------------------------------------------------------------- slice 2
  {
    id: 's2-epic',
    kind: 'epic',
    title: 'Slice 2 — Connectors: Entra, Graph, SQL/CSV',
    body: `
Read-only connectors that bring evidence in, each declaring what it reads, with
which permission, and how it syncs (webhook plus delta). No writes back to any
source, ever, in the POC.

**Done when** items land with their sensitivity labels and access lists, and
reads are permission-filtered.
`,
    done: [
      'Entra directory sync stores people, managers, units and groups',
      'Mail and drive items land with label, access list and content hash',
      'An item the connector is not allowed to read is skipped and counted, not silently dropped',
    ],
    labels: ['kind/epic', 'area/api'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's2-port',
    epic: 's2-epic',
    title: 'Connector port: declared reads, permission and sync mode',
    body: `
One interface every connector implements: what it reads, which permission it
needs, whether it supports delta and webhooks, and how it reports progress and
failures. The POC department scope is a parameter, not a hard-coded filter.

**Brief:** §5.1 connectors.
`,
    done: [
      'Connector metadata is queryable so a steward can see what is connected and why',
      'Sync is resumable from a stored delta token',
      'Failures surface as gaps, not as silent gaps in the data',
    ],
    labels: ['area/api'],
    priority: 'P0',
    size: 'M',
  },
  {
    id: 's2-entra',
    epic: 's2-epic',
    title: 'Entra ID directory connector (Graph users, manager, groups)',
    body: `
Seed the org from the directory: /users with department and title, manager and
directReports, group membership. Locally this runs against a fixture of the
Sanitation & Health department; the same code path runs against Graph.

**Brief:** §3 identity, §5.2 seed from Entra.
`,
    done: [
      'The department tree loads with managers and units',
      'People get deterministic ids stable across syncs',
      'The fake and the real client are interchangeable without touching callers',
    ],
    labels: ['area/api'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s2-port', 's0-auth'],
  },
  {
    id: 's2-mail',
    epic: 's2-epic',
    title: 'Graph mail connector with delta and change notifications',
    body: `
Scoped to the department's mailboxes. Delta queries for backfill, change
notifications for new mail, with the subscription lifecycle handled (renew,
missed notifications fall back to delta).

**Brief:** §3 email via Graph; §5.1 sync mode.
`,
    done: [
      'A sample mailbox backfills and then receives incremental changes',
      'A dropped subscription is detected and recovered without duplicates',
      'Message bodies are stored by reference plus hash, never duplicated into the store',
    ],
    labels: ['area/api'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s2-port'],
  },
  {
    id: 's2-drive',
    epic: 's2-epic',
    title: 'SharePoint/OneDrive connector with site-scoped permissions',
    body: `
Department site only. Files land by reference with version, hash and the site's
access list; deletions in the source mark items as withdrawn rather than erasing
the evidence trail.

**Brief:** §3 files; §6 least privilege (site-scoped permissions).
`,
    done: [
      'A department site syncs files with sensitivity labels preserved',
      'A deleted source file stops appearing in evidence but keeps its audit trail',
      'Site scoping is enforced by the connector, not by a post-filter',
    ],
    labels: ['area/api', 'area/security'],
    priority: 'P1',
    size: 'L',
    dependsOn: ['s2-port'],
  },
  {
    id: 's2-sql',
    epic: 's2-epic',
    title: 'Read-only SQL and CSV connector for line-of-business data',
    body: `
Resident, property, fee and licence data arrives from the city's systems. The
POC uses CSV exports and a read-only SQL connection; both map into source items
at row granularity with column-level provenance.

**Brief:** §3 line-of-business data; §5.1.
`,
    done: [
      'A CSV export and a SQL table produce identical evidence structures',
      'Every cell keeps row and column so a value can be pointed at',
      'A read-only connection is enforced at the driver level, not by convention',
    ],
    labels: ['area/api', 'area/data'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s2-port'],
  },
  {
    id: 's2-scope',
    epic: 's2-epic',
    title: 'Department scoping and permission-filtered read proof',
    body: `
Application access policies are simulated locally: connectors can only see the
Sanitation & Health mailboxes and document libraries. Prove the filter holds for
reads through the API, the search index and the AI tools.

**Brief:** §6 least privilege; adversarial case "a person without access asking
for individual data".
`,
    done: [
      'A request scoped outside the department returns nothing, with an audit entry',
      'Search and AI tool calls apply the same scope as the API',
      'A test asserts a Finance mailbox is invisible to the department scopes',
    ],
    labels: ['area/security'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s2-mail', 's1-rls'],
  },

  // ---------------------------------------------------------------- slice 3
  {
    id: 's3-epic',
    kind: 'epic',
    title: 'Slice 3 — Ingestion, extraction, identity resolution',
    body: `
Fetch, classify, parse, extract and embed. Extraction produces candidate facts
and entities with locators — never confirmed facts.

**Done when** a document's values appear as candidates attached to entities,
with a locator that opens the evidence.
`,
    done: [
      'A licence PDF yields candidate facts linked to a Business entity',
      'Every extracted value can be traced to page and span in the source',
      'Injected instructions inside a document do not change system behaviour',
    ],
    labels: ['kind/epic', 'area/ai'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's3-pipeline',
    epic: 's3-epic',
    title: 'Ingestion pipeline with label-aware classification',
    body: `
fetch, then: honour the Purview sensitivity label (skip what policy forbids and
count it), parse, extract, embed. Idempotent by content hash; re-running a
pipeline never duplicates facts.

**Brief:** §5.1 ingestion pipeline; §6 respect labels.
`,
    done: [
      'Re-ingesting the same source item changes nothing',
      'A policy-forbidden item is skipped with an auditable reason',
      'Pipeline stages are individually observable (counts, timings, failures)',
    ],
    labels: ['area/ai', 'area/api'],
    priority: 'P0',
    size: 'L',
  },
  {
    id: 's3-parsers',
    epic: 's3-epic',
    title: 'Parsers: PDF, Word, Excel, image OCR, email, HTML',
    body: `
Documents the department actually holds: licence conditions (PDF), inspection
reports (PDF/Word), fee spreadsheets (Excel), scanned forms (image). Each parser
preserves locators (page, cell, span); a parser that cannot locate a value is a
bug, not a fallback.

**Brief:** §3 file parsing incl. OCR.
`,
    done: [
      'Each format yields text with page or cell coordinates',
      'A scanned Hebrew inspection report parses with readable text',
      'Unparseable files become gaps with the failure reason',
    ],
    labels: ['area/ai', 'area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s3-pipeline'],
  },
  {
    id: 's3-extract',
    epic: 's3-epic',
    title: 'Extraction of candidate facts and entities with locators',
    body: `
Extraction is a routed AI role (§2 principle 8) with a strict contract: it may
only emit values for known types and properties, each with evidence and
confidence. Unknown shapes become schema candidates, not invented properties.

**Brief:** §5.1 extraction; §2 principle 4 (AI only proposes).
`,
    done: [
      'Extraction output validates against the ontology before it is stored',
      'An unknown field is offered as a schema candidate with examples',
      'Confidence is stored and visible, never used to auto-confirm',
    ],
    labels: ['area/ai'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s3-parsers', 's1-records'],
  },
  {
    id: 's3-embeddings',
    epic: 's3-epic',
    title: 'Embeddings and semantic retrieval behind a vector port',
    body: `
pgvector in production; a local index with the same query interface for demos.
Retrieval respects access filtering before ranking, so a person cannot infer a
document they cannot read from its snippets.

**Brief:** §3 search; §2 principle 9.
`,
    done: [
      'Semantic search returns passages with locators',
      'Filtered retrieval cannot return a passage the asker cannot see',
      'The port swaps local for pgvector without changing callers',
    ],
    labels: ['area/db', 'area/ai'],
    priority: 'P1',
    size: 'M',
    dependsOn: ['s3-pipeline'],
  },
  {
    id: 's3-identity',
    epic: 's3-epic',
    title: 'Identity resolution with declared keys and scored matches',
    body: `
Match the same resident, business or property across sources using declared keys
(national id where lawful, normalized address, business registry number) plus
scored candidates. Ambiguous merges are never auto-applied: they become gaps for
a person.

**Brief:** §5.1 identity resolution.
`,
    done: [
      'Declared keys and match scores are visible and owned, not hard-coded',
      'A low-confidence match becomes a gap with both candidate records',
      'A confirmed merge is reversible and audited',
    ],
    labels: ['area/data'],
    priority: 'P0',
    size: 'L',
    dependsOn: ['s3-extract', 's2-sql'],
  },
  {
    id: 's3-injection',
    epic: 's3-epic',
    title: 'Prompt-injection defence for untrusted source content',
    body: `
Documents and emails are hostile input. Instructions found inside content are
data: the extraction and assistant roles must treat them as text, never as
commands, and the adversarial eval from §9 must pass.

**Implementation.** Content is delimited and typed as untrusted, tool access is
allow-listed per role, and an egress check blocks any action not on the plan.

**Brief:** §9 adversarial cases.
`,
    done: [
      'The "ignore previous instructions" email from the eval set has no effect',
      'Extraction of that email still records the attempt as a fact for review',
      'A regression test fails if a prompt template interpolates raw content into instructions',
    ],
    labels: ['area/ai', 'area/security', 'area/eval'],
    priority: 'P0',
    size: 'M',
    dependsOn: ['s3-extract'],
  },
];
