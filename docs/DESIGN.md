# Municipal Data Platform POC: design brief

Status: design for a mockup proof of concept, 17 Oct 2026. Audience: the agent who will build it. Decide-first: this doc states the
target. Where it says "decide", it decides; where something is genuinely open it is listed at the end.

## 1. What we are building

A system for a municipality on **Microsoft cloud** that **maps and learns the organization**: its structure (people, units, roles),
its **ontology** (what the city deals with: residents, households, properties, businesses, services, applications…), and its
**workflows** (how work actually moves). It then **grows automations from that knowledge**.

Four capabilities, one shared model underneath:

1. **Connect and map**: read the city's existing sources (Entra ID directory, work email, SharePoint/OneDrive, Teams, line-of-business
   databases) into evidence, and build a living map of the organization, its entities and its processes.
2. **Learn and fill gaps**: a learning layer that finds what the map doesn't know yet (unknown owners, missing attributes, unclear
   steps), and fills it actively. It interviews the right people with short generated forms and proposes ontology changes from data.
3. **Generate forms on the fly**: a dynamic form engine driven by the ontology. It produces the forms the system needs, whether to
   ask a question, collect data or let a resident apply for a service.
4. **Answer questions**: a smart query layer that answers things like *"How many people in my city are eligible for this service?"*
   from the data, with the rule it used, the data behind it and what it couldn't know.

This is a **POC/mockup**. It shows the loop end to end on one department with realistic but synthetic or anonymized data. It is not a
production system, but it is built on the architecture production would use.

### Non-goals for the POC
- No writes back into the city's source systems. Read-only connectors; the system's own store holds what it learns.
- No resident-facing launch. Resident service forms are demonstrated internally.
- No replacement of existing tools: we integrate (Power Platform, Dynamics, existing databases) rather than rebuild.

## 2. Principles (taken from the Omni platform)

These are the decisions that made Omni coherent. Apply them here unchanged unless this doc says otherwise.

1. **One ontology, extended in layers.** A shared municipal ontology ships as packs (people and org, residents and households,
   property, business, services and eligibility, cases and applications, assets), and each city extends it with an overlay. New types
   and properties arrive as **candidates** that a person accepts. The model never silently changes the schema.
2. **Everything is a record with provenance.** Every fact knows where it came from (source, document, message, interview answer),
   when, and who confirmed it. Values read out of sources start as **proposals** until a person or a declared rule accepts them.
3. **Evidence flows automatically, decisions go to people.** Extracted facts, statistics and discovered patterns are recorded and
   used automatically, carrying their confidence. Anything that changes how the city works (a new workflow, a schema change, an
   automation, an eligibility rule) is a **decision**, proposed by the system and approved by its owner.
4. **The AI only proposes** (Omni's D49). The assistant and the learning layer draft; people approve. Nothing the model writes
   becomes authoritative without acceptance or a declared rule.
5. **No hidden heuristics.** Every number that decides something is derived from data, declared with an owner (a threshold, an
   eligibility rule, a priority), stated by the assistant with reasons and then checked, or purely numerical. No magic constants.
6. **Explain everything.** Every answer, count, form suggestion and discovered workflow can show how it was reached: inputs, rule,
   sources, what was unknown.
7. **Connect, don't replace.** Existing systems stay the system of record for what they own. We read from them and propose; writes
   back are a later, permissioned step.
8. **Roles, not models.** AI use is routed by role (extraction, interviewing, query planning, answer writing) through one AI layer,
   so models can be swapped and benchmarked. Default to Azure OpenAI; allow local or other models per role.
9. **Permissions on every read and write.** The system never shows a person, or the AI on their behalf, anything they couldn't see
   in the source. Sensitivity labels from the source are respected.
10. **Design first, test-decide-cut over.** Each slice starts with a short decide-first note. Acceptance comes from evals and
    scenarios, not demos alone.

## 3. Architecture on Microsoft cloud

| Concern | Choice (POC) | Why |
|---|---|---|
| Identity, org chart | **Entra ID** via **Microsoft Graph** (`/users`, `manager`, `directReports`, groups) | the org's real structure and the identity for every permission check |
| Email, files, chat, calendar | **Graph**: Outlook mail, OneDrive/SharePoint drives, Teams messages, calendar | where the work actually happens; delegated + application permissions, scoped to the POC department |
| Line-of-business data | read-only connectors to **Azure SQL / SQL Server / Dataverse**, or CSV exports for the POC | resident, property, service and case data |
| System store | **Azure Database for PostgreSQL Flexible Server** with row-level security and **pgvector** | one relational store for records, facts, provenance and embeddings, per-tenant isolation like Omni |
| Search | Postgres full-text + pgvector, optionally **Azure AI Search** | semantic retrieval over documents and messages |
| AI | **Azure OpenAI / AI Foundry**, deployed with no data retention or training; roles routed through one gateway | data stays in the tenant's region |
| Compute | **Azure Container Apps** (API, workers), **Azure Functions** for connector webhooks | simple, scalable |
| Events and jobs | **Service Bus** or Postgres outbox + workers | ingestion, learning and interview jobs |
| Workflows/automation | own lightweight engine (trigger → conditions → actions), with export to **Power Automate** where the city uses it | own the semantics; reuse their automation tooling |
| Forms | own schema-driven form engine (JSON Schema + UI schema); optional rendering in **Teams** (Adaptive Cards) and the web | interviews in Teams, applications on the web |
| Governance | **Microsoft Purview** sensitivity labels and classification read and respected; audit to **Azure Monitor / Log Analytics**; secrets in **Key Vault** | public-sector compliance |
| Region | the city's Azure region (e.g. Israel Central if applicable) | data residency |

Integration surface: Graph (change notifications/webhooks plus delta queries for incremental sync), database read connectors,
and file parsing for PDF, Word, Excel and images (OCR).

## 4. The shared model

Everything in the system is one of these. This is the Omni record model adapted.

- **Source item:** a raw thing we read (an email, a file, a row, a Teams message), stored by reference with a content hash, its
  sensitivity label and its access list. The original stays in the source.
- **Evidence:** a passage or value inside a source item, with an exact locator (message id + span, file + page + cell, row + column).
- **Entity:** a typed record from the ontology (Person, OrgUnit, Role, Resident, Household, Property, Business, Service, Application,
  Case, Asset, Document…).
- **Fact:** an attribute value or a relation between entities. Status is **candidate**, **confirmed** or **rejected**. It carries its
  evidence, its confidence and who or what confirmed it. Facts are versioned and never overwritten silently.
- **Schema candidate:** a proposed new type, property, relation or enum value, with the evidence that suggested it.
- **Process model:** a discovered or declared workflow: steps, roles, inputs, outputs, typical durations, variants. Status is
  **discovered**, **validated** or **executable**.
- **Rule:** a declared, versioned rule (eligibility, routing, SLA), with its owner, its legal citation where relevant and its
  effective dates.
- **Gap:** something the system knows it doesn't know (an unknown owner, a missing attribute, an unclear step), with its estimated
  value.
- **Interview:** a generated form sent to a person to close one or more gaps, and the answers it produced, which become evidence.

## 5. Components

### 5.1 Connect and ingest
- **Connectors:** Graph for mail, drives, Teams and directory; read-only SQL and Dataverse; file upload. Each connector declares what
  it reads, with which permission, and its sync mode (webhook plus delta).
- **Ingestion pipeline:** fetch, then classify (honour the Purview label; skip what policy forbids), parse, extract and embed.
  Extraction produces **candidate facts and entities** with evidence locators, never confirmed facts.
- **Identity resolution:** match the same person, resident, property or business across sources using declared keys (national ID
  where lawful, address normalization, business registry number) plus scored matches. Ambiguous merges become gaps for a person.
- **Access mirroring:** each item keeps the source's access list, and every query filters by the asking person's access.

### 5.2 Map the organization
- **Seed** from Entra: people, managers, units, groups, titles.
- **Infer responsibilities** from work traces: who handles which kind of request, who approves, who is consulted. Signals include
  email threads on a topic, document authorship, Teams channels and case-system assignments. Inferences are **candidate facts**
  ("Dana probably handles business-licence fire-safety reviews", with evidence and confidence), shown to the person and their
  manager to confirm.
- **Output:** an org map (units, roles, people, responsibilities, who to ask about what) that the rest of the system routes by.

### 5.3 Learn the ontology
- **Seed packs** for the municipal domain: People & org, Residents & households, Property & addresses, Businesses & licences, Services &
  eligibility, Applications & cases, Payments & fees, Assets & infrastructure, Documents.
- **Schema discovery:** recurring fields in forms, spreadsheets and database tables that the ontology doesn't have become **schema
  candidates** ("applications carry a 'fire inspection date' 92% of the time"), each with examples. An ontology steward accepts,
  renames or maps them to existing properties.
- **Coverage metrics:** per type, how many records exist, how many attributes are known, and what is missing. This feeds gap detection.

### 5.4 Discover and grow workflows
- **Event log:** turn work traces into events (case created, email sent to X, document approved, status changed), keyed by the case
  or entity they belong to.
- **Process mining:** discover process models per service. This means steps, order, variants, roles, waiting times and rework loops.
  Use established process-mining algorithms (for example inductive mining) over the event log, not hand-written rules.
- **Validation:** the service owner reviews the discovered model in a simple step view ("this is how business licences actually flow;
  these 3 variants cover 85% of cases"), corrects it, and marks it **validated**.
- **Automation proposals:** from a validated model, the system proposes automations where the data shows repetitive, rule-like steps.
  Examples: routing an application to the right reviewer, reminding before an SLA breach, requesting a missing document, generating a
  standard letter. Each proposal shows the evidence, how often the step happens, the time saved and the risk. The owner approves.
  Approved automations run in our engine or are exported to Power Automate.

### 5.5 The learning layer (gap filling)
- **Gap detection** comes from: ontology coverage (missing attributes), the org map (unknown owner of a responsibility), process
  models (unclear step, unknown decision rule), identity resolution (ambiguous merge), and queries that couldn't be answered.
- **Prioritization by value**, not fixed weights: a gap is worth more when it blocks many records, a frequent process, a pending
  automation or a question someone actually asked. Declare the scoring inputs and their owner (principle 5).
- **Interviewing:** for the top gaps, the system picks the right person from the org map and generates a **short targeted form**
  (section 5.6): 1–5 questions, prefilled with its current best guess and evidence. The form goes to them in Teams or the web app.
  - **Answers become evidence** with provenance, not truth: an answer that contradicts other evidence becomes a new gap.
  - **Interview etiquette:** at most one open interview per person at a time, never more than the declared attention budget, and
    skip and decline are always allowed.
- **Active filling** without people where possible: look up registries, documents or databases that would answer the gap, and record
  the result as a candidate.

### 5.6 Dynamic form engine
- **Forms are generated from the ontology,** never hand-coded: a form is a JSON Schema plus UI schema derived from the types and
  properties it collects, with validation from the ontology (types, units, enums, required-by-context rules).
- **Three kinds:** interview forms (the learning layer), internal data-collection forms (staff), and service application forms
  (residents; demonstrated internally in the POC).
- **Per-field provenance:** each field records whether a person typed it, the system prefilled it (and from what), or a document
  filled it.
- **"Fill with AI"** proposes values from linked records and documents for the person to review. It never overwrites what a person
  typed.
- **Accessibility and language:** right-to-left and multilingual (Hebrew, Arabic, English), keyboard and screen-reader accessible,
  and mobile-friendly.
- **Rendering:** web, plus Adaptive Cards in Teams for short interviews.

### 5.7 Smart query
- **Semantic layer:** questions are planned over the ontology and a catalogue of declared **metrics and rules**, not by having the
  model write free SQL against raw tables.
  - The planner (an AI role) turns the question into a typed query plan: entities, filters, rule, aggregation.
  - The server executes the plan as SQL against the store or approved sources, with row-level security for the asking person.
- **Eligibility questions** ("How many residents are eligible for X?") use a **declared, versioned eligibility rule**: criteria,
  thresholds, legal citation, owner and effective date.
  - **The answer has three parts:** the count; **how many couldn't be decided** because data is missing (for example "eligible:
    1,240; not eligible: 8,300; unknown: 2,100, mostly missing household income"); and the rule version used.
  - **Unknowns become gaps.** The learning layer can then target them.
- **Privacy on aggregates:** counts below a declared minimum cell size are suppressed or rounded. Staff without access to individual
  records only get aggregates. Optional differential privacy for published figures.
- **Explain:** every answer shows the plan, the rule, the data sources and freshness, and the unknowns ("Explain this").
- **No rule yet?** If an eligibility rule doesn't exist, the system proposes a draft from the regulation text or service
  documents, with citations, for the owner to approve. Until then the answer is marked provisional.

### 5.8 Assistant
- One assistant over all of the above: ask about the org ("who handles fire-safety reviews?"), the processes ("why do licence
  applications wait 12 days?"), the data ("how many…?").
- It proposes forms, rules and automations; it never decides.
- **Answers group their evidence,** cite their records, and say what wasn't checked.

## 6. Privacy, security and governance (must-haves even for a POC)
- **POC data:** synthetic or properly anonymized data for residents. Real staff data (Entra, email) only with the municipality's
  written approval, scoped to the POC department, read-only.
- **Least privilege:** Graph application permissions limited to the department's mailboxes and sites (application access policies,
  site-scoped permissions).
- **Purpose and access:** respect Purview sensitivity labels. Mirror source access on every read. Keep an audit log of every query,
  interview and AI call.
- **AI data handling:** Azure OpenAI deployed with no data retention for training. Prompts and outputs are logged in our tenant only.
- **Retention and erasure:** declared retention policies, and the ability to erase a person's data from the learned layer.
- **Legal review:** a data protection impact assessment and a review against the applicable privacy law (for an Israeli municipality,
  the Privacy Protection Law and its recent amendments, plus government cloud guidelines). This must be confirmed by the
  municipality's counsel before any real data is used.

## 7. POC scope and demo scenarios

Pick **one department and one or two services** (suggested: business licensing, or a welfare or discount service with clear
eligibility rules). Data: Entra directory for the department, a sample mailbox and SharePoint site, and a synthetic resident,
household and property database.

1. **Map:** connect Entra plus a sample of email and documents, and show the org map with inferred responsibilities waiting for
   confirmation.
2. **Discover:** build the event log for "business licence application", and show the discovered process with its variants and
   bottlenecks; the owner validates it.
3. **Learn:** the system lists its top gaps, generates a 3-question interview form for the right person, and their answers update
   the map and the process.
4. **Grow:** the system proposes two automations (routing, missing-document request) with evidence and time saved; the owner
   approves; one runs.
5. **Ask:** "How many residents are eligible for the senior property-tax discount?" returns eligible, not eligible and unknown, with
   the rule, the sources, and the unknowns turned into gaps.
6. **Form:** generate the service application form from the ontology, with "Fill with AI" from linked records.

## 8. Build plan (slices)

| # | Slice | Done when |
|---|---|---|
| 0 | Repo, Azure skeleton (Container Apps, Postgres+pgvector, Key Vault, Entra app registration), auth, audit log | a signed-in staff member sees an empty workspace |
| 1 | Ontology packs + overlay + record/fact/provenance model + RLS | entities and facts with evidence round-trip through the API |
| 2 | Connectors: Entra (directory), Graph mail + drive (delta + webhook), CSV/SQL read | items land with labels and access lists; permission-filtered reads |
| 3 | Ingestion: parse + extract candidate facts with locators; identity resolution | a document's values appear as candidates linked to entities |
| 4 | Org map + responsibility inference + confirm UI | the department map with confirmed and candidate responsibilities |
| 5 | Dynamic form engine (schema from ontology, validation, provenance, RTL, Teams card rendering) | any type renders an accessible form; Fill with AI proposes |
| 6 | Gap detection + value scoring + interview generation and delivery | top gaps produce interviews; answers become evidence |
| 7 | Event log + process mining + validation view | a discovered process with variants and waits, validated by its owner |
| 8 | Automation proposals + engine (+ Power Automate export) | an approved automation runs on new cases |
| 9 | Semantic layer + rules catalogue + query planner + eligibility answers with unknowns + aggregate privacy | the eligibility question answers with eligible/not/unknown and Explain |
| 10 | Assistant over everything + evals | the scenario set passes |

Each slice: a short decide-first note, tests, and an eval scenario.

## 9. Evaluation and acceptance
- **Scenario evals**, scored against gold answers on the synthetic data: the six scenarios in section 7, plus adversarial cases. Those
  include an email containing instructions to the AI (must be ignored), a person without access asking for individual data (must get
  aggregates or a refusal), and a contradicting interview answer (must become a gap).
- **Metrics:**
  - responsibility inference precision against confirmed facts;
  - process discovery fitness and precision against the validated model;
  - query correctness on gold counts, including unknowns;
  - interview yield (gaps closed per question);
  - time to first useful automation.
- **Model choice per role** is decided by benchmark on these evals (latency, quality, cost), as in Omni.

## 10. Risks
- **Data access approval** can take longer than the build. Start on synthetic data and design for approval scopes.
- **Inferring responsibilities from email** is sensitive. It needs transparency to staff and an opt-out, so make confirmation by the
  person part of the flow.
- **Process mining on email** is noisy. Prefer case-system logs where they exist, and use email as supplementary evidence.
- **Eligibility rules need legal ownership.** The system drafts them; a named owner approves them.
- **Over-interviewing** causes fatigue. Respect the declared attention budget and one open interview per person.

## 11. Open questions for the owner
1. Which department and service for the POC?
2. Is real staff email allowed in the POC, or synthetic only?
3. Which existing systems must be connected first (case system, GIS, finance, Dynamics, SharePoint lists)?
4. Should the system propose Power Automate flows, or run its own engine only?
5. Which languages are needed: Hebrew, Arabic, English?
