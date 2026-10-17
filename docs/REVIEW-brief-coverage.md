# Brief coverage: what was built against docs/DESIGN.md

Reviewed 18 Oct 2026 against the code on `main` (including the uncommitted
work), the tests (40) and the running app. Companion to
[REVIEW-product-ux.md](REVIEW-product-ux.md).

Legend: ✅ built · ◐ partial · ⚠ built differently from the brief · ✗ missing

> **Update, 18 Oct:** the product-UX pass fixed several findings below —
> interviews are now sent to and answered only by their respondent, the source
> viewer and search are connection-gated, the waiting metric is renamed, the
> ask planner refuses filters it cannot map, and the suite is 40 tests. See
> [REVIEW-product-ux-response.md](REVIEW-product-ux-response.md). The rest of
> this audit is kept as written.

## Verdict

The **foundation** follows the brief closely, and some parts go beyond it:

- ontology packs with an overlay that can only add;
- facts that carry provenance and are never overwritten;
- source access mirrored on every read;
- rule versions with owner and citation;
- three-part answers that keep their unknowns;
- forms generated from the ontology;
- a template diff for the next municipality.

The **loop the brief is about** — connect → map → learn → grow — is mostly
staged rather than real. Three of its four verbs don't do what the brief says:

| Verb | Brief | Built |
|---|---|---|
| **Connect** | Connecting a source reads it | All four sources are still ingested at startup for the demo graph; the toggle now gates the source viewer, search and research, so a disconnected source returns a gate, not data. A live crawler on connect is still not built. |
| **Learn** | Interview answers update the map and the process (§7.3); a contradicting answer becomes a new gap (§5.5, §9) | Exactly one gap type is ever interviewed (missing household income). The answer doesn't fill any data. A contradicting answer becomes a rule-change proposal, not a gap. The interview is now sent to and answered only by its respondent; the policy answer is recorded as the rule owner's decision. |
| **Grow** | The owner approves and **one automation runs** (§7.4); slice 8 is done when "an approved automation runs on new cases" | Approving writes a decision page and changes a status. Nothing runs, and there is no Power Automate export. |
| **Map** | Responsibilities are inferred from mail, documents, Teams and case assignments, and confirmed by the person and their manager | Inferred from case events and mail subjects (regex topics). The person confirms; the manager path was dropped (a deliberate UX choice, but not recorded as a decision against the brief). |

DeepSeek's summary says slices 4–10 are "now visible". Visible is accurate. By
the brief's own "done when" column, most of those slices aren't done.

---

## The six demo scenarios (§7)

| # | Scenario | Status | What's missing |
|---|---|---|---|
| 1 | **Map:** connect Entra + mail + docs, org map with inferred responsibilities awaiting confirmation | ◐ | Connecting is cosmetic (see above). No document-authorship or Teams signals. No manager confirmation. |
| 2 | **Discover:** event log → process with variants and bottleneck; the owner validates | ◐ | Variants come from grouping traces, not process mining; the README discloses this. Validation is approve-only; the brief says the owner *corrects* the model, then marks it validated. No fitness or precision. |
| 3 | **Learn:** top gaps → 3-question interview → answers update the map and the process | ◐ | One hard-wired gap type. Answers don't update the map or the process. The interview isn't delivered to its respondent; it opens in whoever clicked's session. |
| 4 | **Grow:** two automations (routing, missing-document request) with evidence and time saved; the owner approves; **one runs** | ◐ | Both proposals exist (plus two more). The metric is now "ימי המתנה של תיקים" with its formula and owner; **nothing runs**. |
| 5 | **Ask:** "senior property-tax discount" → eligible / not / unknown with rule, sources and unknowns as gaps | ⚠ ✅ | Swapped for the sanitation-fee discount. That's reasonable for a sanitation department, and the rule has a senior-age ground, but no ADR records the swap. The answer's mechanics match the brief. Free-form questions with unmapped filters are now refused with the interpretation (UX review, 1.1). |
| 6 | **Form:** service application form from the ontology, with "Fill with AI" from linked records | ◐ | The household application form is generated and validated. Fill with AI exists in the engine and a test, **but not in the product UI**. |

---

## Component by component

### §4 Shared model
| Item | Status | Note |
|---|---|---|
| Source item with content hash, label, access list | ✅ | `graph.ts`, `ingest.ts` |
| Evidence with exact locator | ✅ | row+column, message+span, file+page |
| Fact status candidate / confirmed / rejected, versioned | ✅ | |
| Fact confidence | ⚠ | Counts ("62 of 290") instead of scores. A deliberate choice, and a good one. |
| Schema candidate | ✅ | `knowledge_candidate` |
| Process status discovered → validated → executable | ◐ | `executable` is declared but nothing can reach it |
| Rule: versioned, owner, citation, effective dates | ✅ | |
| Gap with estimated value | ◐ | Ranked by a hard-coded weight ("eligibility gaps first", `server.ts` interviews route). Brief §5.5 asks for declared scoring inputs with an owner. |
| Interview | ✅ | |

### §5.1 Connect and ingest
| Item | Status |
|---|---|
| Graph directory, mail and drive in Graph's real shapes; delta links | ✅ (mocked, faithfully) |
| Webhooks / change notifications | ◐ mock shape only |
| Azure SQL read connector | ✅ (mocked) |
| **Teams messages** | ✗ |
| **File upload, PDF / Word / OCR parsing** | ✗ |
| **Embeddings / semantic retrieval** | ✗ (search is keyword) |
| **Identity resolution** across sources (declared keys + scored matches; ambiguous merges → gaps) | ✗ |
| Purview labels honoured, access mirrored | ✅ |
| Connecting a source actually gates ingestion | ✗ (see verdict) |

### §5.2 Map the organization
| Item | Status |
|---|---|
| Seeded from Entra: units, heads from reporting lines | ✅ |
| Responsibilities from case assignments | ✅ |
| From mail threads | ◐ regex on subject lines |
| From document authorship, Teams channels | ✗ |
| Confirmed by the person | ✅ |
| Confirmed by the manager | ✗ (dropped on purpose; record it) |

### §5.3 Learn the ontology
| Item | Status |
|---|---|
| Seed packs: people/org, residents/households, property, business/licences, services/eligibility, cases | ✅ |
| Payments and fees | ◐ only `fee_obligation` inside cases |
| **Assets and infrastructure** | ✗ |
| Documents | ✅ in core |
| Schema discovery from unmapped columns, with examples | ✅ |
| Steward accepts | ✅ (but the queue sends it to the department head) |
| Steward renames or maps to an existing property | ✗ |
| Coverage metrics per type | ✅ |

### §5.4 Workflows
| Item | Status |
|---|---|
| Event log from cases | ✅ |
| Process mining (inductive or similar) | ⚠ variant grouping; disclosed |
| Waits, bottleneck, variants | ✅ |
| Validation view: owner **corrects**, then validates | ◐ validate only |
| Automation proposals with evidence, frequency, time saved, risk | ✅ (time-saved metric mislabelled) |
| **Approved automation runs in our engine, or exports to Power Automate** | ✗ |

### §5.5 Learning layer
| Item | Status |
|---|---|
| Gaps from unanswerable queries | ✅ |
| Gaps from ontology coverage, unknown owners in the org map, unclear process steps, ambiguous merges | ✗ (only query unknowns and unmapped columns become gaps) |
| Prioritised by value with declared inputs | ◐ hard-coded weight |
| 1–5 prefilled questions to the person chosen from the org map | ✅ |
| One open interview per person, decline allowed | ✅ |
| Delivered to that person (Teams or their own web session) | ✗ |
| Answer becomes evidence | ✅ |
| Contradicting answer becomes a **new gap** | ⚠ becomes a rule-change proposal instead |
| Active filling without people (registry or database lookup) | ✗ |

### §5.6 Forms
| Item | Status |
|---|---|
| JSON Schema + UI schema from the ontology; validation | ✅ |
| Three kinds: interview, internal, application | ✅ |
| Per-field provenance | ✅ |
| Fill with AI never overwrites a typed value | ✅ engine + test · ✗ UI |
| Adaptive Card | ✅ generated (not delivered) |
| Hebrew | ✅ |
| **Arabic, English** | ✗ |

### §5.7 Smart query
| Item | Status |
|---|---|
| Typed plan over a catalogue, never free SQL | ✅ |
| Eligibility: three counts, rule version, unknowns → gaps | ✅ |
| Minimum cell size | ✅ |
| Explain | ✅ |
| Unsupported question refused, not guessed | ✅ refuses unknown entities and unmapped filters |
| **Staff without access to individual records get aggregates only** | ✗ no record-level path to protect yet, so it isn't tested |
| No rule in force → answer marked provisional | ✅ (refuses) |
| **Draft a rule from regulation text with citations** | ✗ |

### §5.8 Assistant
| Item | Status |
|---|---|
| Questions about the org, processes and data | ◐ fixed routes; "who handles inspection" includes the inspector and the scheduler |
| Proposes forms, rules and automations from conversation | ✗ |

### §6 Governance
| Item | Status |
|---|---|
| Permission mirroring on every read | ✅ (documents and search tested) |
| **Audit log of every query, interview and AI call** | ✗ (only decisions record a name) |
| **Retention / erasure from the learned layer** | ✗ |
| Real sign-in | ✗ disclosed (slice 0) |

### §8 Slices: "done when"
| # | Done when | Status |
|---|---|---|
| 0 | Signed-in staff see an empty workspace; audit log | ✗ (demo identity; no audit) |
| 1 | Entities and facts with evidence round-trip | ✅ |
| 2 | Items land with labels and access lists; permission-filtered reads | ✅ (mocked) |
| 3 | Document values appear as candidates; identity resolution | ◐ no identity resolution |
| 4 | Map with confirmed and candidate responsibilities | ✅ |
| 5 | Any type renders an accessible form; Fill with AI proposes | ◐ Fill with AI not in the UI |
| 6 | Top gaps produce interviews; answers become evidence | ◐ one gap type |
| 7 | Discovered process, validated by its owner | ◐ validate without correct |
| 8 | **An approved automation runs on new cases** | ✗ |
| 9 | Eligibility answer with unknowns and Explain | ✅ |
| 10 | Assistant over everything; the scenario set passes | ◐ |

### §9 Evaluation
| Item | Status |
|---|---|
| Scenario checks against exact expected numbers | ◐ tests pin exact counts for eligibility, process and template |
| Adversarial: instruction in an email is ignored | ✅ tested |
| Adversarial: no-access person asks for individual data | ◐ tested for documents, not for records |
| Adversarial: contradicting answer becomes a gap | ⚠ tested, but it asserts a rule proposal |
| Metrics: responsibility precision, process fitness and precision, query correctness, interview yield, time to first automation | ✗ none computed |
| Model choice per role by benchmark | ✗ disclosed |

---

## Not disclosed in the README's "Honest limits"

The README is candid about synthetic data, the stand-in model, variant-based
discovery and demo identity. It doesn't mention:

- Source toggles don't gate ingestion.
- Approved automations don't run, and there is no export.
- Interviews are now delivered to their respondent, and only that person can answer.
- No identity resolution, Teams, file parsing, embeddings, Arabic or English, audit log, or erasure.
- Fill with AI isn't in the product UI.
- No rule drafting from regulation text.
- ADRs 0002–0005 are cited (README, board) but don't exist.

## What to do next, in order

1. **Make the loop real before adding surface.** The brief's demo is "connect →
   map → learn → grow". Each verb needs one real effect:
   - Connect: toggling mail on gates the source viewer, search and research;
     the demo graph is already ingested at startup.
   - Learn: the interview is delivered to the respondent and only they can
     answer. A data answer fills or locates the missing value. A contradicting
     answer opens a gap.
   - Grow: an approved SLA reminder runs on the next replayed cases, and the
     screen shows what it did. `/api/replay` already exists to build on.
2. **Close the scenario gaps that are cheap:** Fill with AI in the form UI;
   process validation with "correct a step"; a declared, owned scoring function
   for gaps.
3. **Record the deliberate deviations as ADRs:** the fee discount instead of
   the property-tax discount, no manager confirmation, counts instead of
   confidence, contradiction → rule proposal. Also write or remove the missing
   ADRs 0002–0005.
4. **Then the larger missing pieces**, as the brief orders them: identity
   resolution (slice 3), audit log (slice 0), aggregate-only access for record
   queries, rule drafting from regulation text, and the evaluation metrics.
5. Arabic and English, Teams, OCR and embeddings can wait. The brief lists them,
   but none of them is on the demo path.

---

## Against what customers are asking for

Two more inputs, from 13–18 Oct 2026:

- **Ofakim:** a conversation with Bernard Padlon, the city's CIO, summarised
  by Neri. Linoy is responsible for information security there.
- **Upper Galilee Regional Council:** our 8-slide pitch,
  `upper_galilee_council_ai_presentation.pdf`.

### What each one asks for, and where the brief and the build stand

| Customer need | Who | Brief | Build |
|---|---|---|---|
| **Proactive rights exhaustion:** find residents who are probably eligible for an **arnona** discount (reservists, disability) but don't claim it, and surface them for handling | Ofakim | Close. §5.7 counts the eligible; scenario 5 was a property-tax (arnona) discount | ✗ Counts only. Switched to the sanitation fee. No "eligible but not receiving" cross-check, no per-resident worklist, no reservist ground |
| **Core data never goes to an external AI**; on-prem being considered; **keep the rules engine that reads sensitive data separate from the model** | Ofakim | ◐ Azure in-tenant, no data retention, "roles, not models" | ✅ **Already built this way, but never shown.** The model only turns the question into a typed plan; a deterministic engine applies the rule to the records; a local model sits behind the same protocol (`cloud/registry.ts`). Missing: a log of what the model saw, and an audit log |
| **Act, not just retrieve:** start services for residents; "שלוח בקשת השלמה?", "לשלוח זימון?", decisions → tasks with reminders | Both | ◐ Automations run in our own engine; no writes back to source systems | ✗ Read-only; nothing runs |
| **Organisational memory:** "what was already decided about X, and what's still open", with links to the source | Upper Galilee | ◐ §5.8 assistant | ◐ Keyword search over mail and docs; no extraction of decisions, commitments or owners |
| **Decisions → tasks** from a management meeting, flagging decisions without an owner | Upper Galilee | ✗ | ✗ |
| **Collect data from settlements** and detect who hasn't reported | Upper Galilee | ◐ The interview and form engine, but for internal staff only | ◐ Interviews go to staff only |
| **Cross-department proactive alerts** (an infrastructure delay affecting a kindergarten) | Upper Galilee | ✗ One department by design | ✗ |
| **Governance:** permissions, usage policy, approval of actions, logging | Both | ✅ §2, §6 | ◐ Permissions ✅, approvals ✅, **logging ✗** |
| **Pilot in one department, measuring** time saved, accuracy, adoption, implementation effort and security compliance | Upper Galilee | ✅ §7, §9 | ◐ One department ✅; "time saved" is mislabelled; accuracy isn't measured |

### What this tells us

1. **Ofakim is asking for what the brief already describes, and the build moved
   away from it.** The brief's scenario 5 was an arnona discount. Bernard's
   example is an arnona discount. DeepSeek swapped it for the sanitation fee. The
   engine is most of the way there; what's missing is the turn from "how many?"
   to "who, and are they getting it?".
2. **The security answer is already in the architecture.** Bernard's own note,
   "separate the rules engine from the AI model", is how the query layer works.
   It's the strongest thing to show Linoy, and it's invisible today.
3. **Both customers buy the action, not the answer.** Ofakim wants "from
   reactive to proactive service". Upper Galilee's slides all end in a proposed
   action ("לשלוח?", "להעביר לאישור?"). The "grow" step, the one the build
   stages rather than runs, is the one customers are paying for.
4. **The Upper Galilee pitch and the brief describe different products.** The
   pitch is everyday employee productivity: memory, coordination, tasks. The
   brief and the build are about data, ontology, eligibility and processes.
   The current demo fits Ofakim far better than Upper Galilee. Decide whether
   the brief grows to cover memory and tasks, or Upper Galilee gets a separate
   demo.

### Can it be secure on Microsoft? (Neri's question)

Yes. There are three levels, and the build already supports the middle one:

| Level | Where the data is | Where the model runs | Fits |
|---|---|---|---|
| **A · In the city's Azure tenant** | The city's tenant. Israel Central stores data at rest in Israel | Azure OpenAI / Foundry. **To check:** whether the models we need can be deployed in Israel Central. If not, prompts would cross the border, which is probably a blocker for resident data | Cities that already accept Microsoft 365 or Azure for sensitive data |
| **B · Split: rules engine on the data, model on the schema** | Resident records stay with the engine, on-prem or in-tenant | Anywhere. It sees the question, the ontology and the rule text, **never rows**. Names reach only authorised staff, and only through the engine | Bernard's own requirement. **This is how the query path already works.** Caveat: reading free text (mail, documents) does need the model to see content, so that part needs level A or C |
| **C · Fully on-prem** | City hardware | Azure Local (disconnected) with Foundry Local, which Microsoft announced in Feb 2026 for "qualified customers"; or open-weights models on the city's own GPUs. The build's model slot is protocol-compatible, so in principle the swap is configuration | When on-prem is mandatory |

Questions for Bernard and Linoy:

- Is fully on-prem mandatory, or is level B acceptable, and for which data
  classes?
- Which core systems are involved (arnona billing, the population registry,
  welfare)?
- Where would reservist and disability status come from?
- What's the legal basis for using that data for proactive outreach? This is a
  purpose-limitation question under the Privacy Protection Law (Amendment 13)
  and needs counsel.

### How this changes the priorities above

Do these alongside step 1 ("make the loop real"), not after it:

1. **Bring back the arnona scenario**, with disability and reservist grounds,
   and add **"eligible and not receiving"**: cross the rule result with billing
   (`fee_obligation` is already in the model). Show a worklist of named
   residents to the authorised clerk only, and aggregates to everyone else.
   That also makes the brief's aggregate-only requirement (§5.7) real and
   testable.
2. **Show the separation on screen:** "מה המודל ראה" on every answer (the
   question, the schema and the rule, no rows), plus an audit log of AI calls.
   That's the security demo for Linoy.
3. **Make one action real per customer:**
   - Ofakim: an outreach task or letter for an eligible resident, approved by a
     clerk.
   - Upper Galilee: a completion request to the settlements that haven't
     reported.
4. **Write a deployment ADR** with levels A, B and C, using `cloud/registry.ts`
   as the swap point.

Sources for the Microsoft facts:
[Israel Central region](https://www.azurespeed.com/Information/AzureRegions/IsraelCentral) ·
[Microsoft Sovereign Cloud, disconnected operations (Feb 2026)](https://blogs.microsoft.com/blog/2026/02/24/microsoft-sovereign-cloud-adds-governance-productivity-and-support-for-large-ai-models-securely-running-even-when-completely-disconnected/) ·
[Azure Local AI workloads](https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/azure-local/ai-workloads-overview)
