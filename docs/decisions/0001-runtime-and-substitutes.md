# ADR-0001: Runtime, local substitutes and adapter boundaries

- **Status:** proposed
- **Date:** 2026-10-17
- **Task:** board task `s0-adr` (Slice 0)
- **Brief:** §3 architecture, §8 slice 0

## Context

The brief specifies a Microsoft-cloud POC: Entra ID, Microsoft Graph, Azure
Database for PostgreSQL with pgvector, Azure OpenAI, Container Apps, Service Bus,
Key Vault, Purview labels.

The machine this is being built on has Node 22 and Python 3.14. It has **no
Docker, no PostgreSQL, no Azure CLI, and no Azure subscription wired up**. Two
things follow:

1. The POC has to run, end to end, on this machine without a cloud account. A
   POC that only exists as Terraform has no demo, and the brief's acceptance is
   scenario evals, not infrastructure.
2. Whatever runs locally must not become a second architecture. The Azure path
   has to remain a swap of implementations, not a rewrite.

## Decision

**Language and runtime.** TypeScript on Node 22, npm workspaces. One repository,
one lockfile, one `npm test`.

**Shape.**

```
apps/api        Fastify HTTP API
apps/web        Vite + React + TypeScript
packages/domain ontology, records, rules, eligibility evaluation
packages/store  Store interface + per-engine drivers + migrations
packages/connectors  GraphPort, SqlPort, file ingestion
packages/ai     AIGateway, role routing, prompt versions
packages/eval   scenario runner and metrics
```

Dependencies point one way: `apps/*` → `packages/*` → `packages/domain`. Domain
code depends on nothing outside itself.

**Substitution is per port, never per call site.** Every Azure service is reached
through an interface declared in the package that owns the concern; production
and local implementations both satisfy it.

| Azure service (brief §3) | Local substitute | Interface | Owner |
|---|---|---|---|
| Entra ID (users, manager, groups) | fixture directory, ~25 staff | `AuthPort`, `DirectoryPort` | connectors |
| Graph: mail, drives, Teams, calendar | fixture mailbox + document corpus | `GraphPort` | connectors |
| Azure SQL / Dataverse / CSV | CSV exports, seeded SQLite LOB file | `SqlPort` | connectors |
| Postgres Flexible Server + pgvector | SQLite file (+ in-process cosine index) | `Store`, `VectorPort` | store |
| Azure OpenAI / AI Foundry | deterministic local model + recorded fixtures | `AIGateway` | ai |
| Container Apps | `npm start` / `npm run dev` | — | apps |
| Service Bus / outbox | outbox table + in-process worker | `Queue` | store |
| Key Vault | `.env` (gitignored) | `SecretsPort` | apps/api |
| Purview sensitivity labels | label field on fixtures, same enum as Purview | `LabelPort` | connectors |
| Azure Monitor / Log Analytics | stdout JSON + audit table | `AuditSink` | apps/api |

**What "local substitute" may not do.**

- No engine-specific SQL outside `packages/store` drivers. Repositories speak the
  interface; SQLite dialect stays in the SQLite driver.
- No Microsoft Graph types outside `packages/connectors`.
- No AI prompt or model name outside `packages/ai` role configuration.
- No `process.env` reads outside the composition root.
- Behaviour that matters to a scenario (access filtering, tri-state eligibility,
  provenance) is implemented once, in the domain, and tested against the local
  store. It is not stubbed locally and "done properly" on Azure.

**Production implementations land when the port is exercised, not at the end.**
`PostgresStore`, `MsGraphClient` and `AzureOpenAIProvider` are written next to
their local counterparts as soon as the interface stabilises, and are covered by
the same contract tests (skipped when the service is absent).

## Rejected alternatives

**Install the real stack locally** (Homebrew PostgreSQL + pgvector, local Azure
emulators). Closest to production, but adds an install that can fail on any
machine and blocks the first demo behind a database. The Postgres driver is
still written and contract-tested; it is simply not the only way to run.

**Infrastructure-as-code only.** Produces what §3 describes and nothing anyone
can watch. The brief's acceptance is evals, so this fails the brief.

**Next.js full-stack.** Would collapse API and web into one app and hide the
boundary the assistant, automations and connectors all need. Kept separate.

**Python backend.** Fine for the AI and process-mining work, but the Form engine,
the Adaptive Card renderer and the Power Automate export are all Node/TypeScript
territory. One language, one lockfile.

## Consequences

- The demo runs from a clean checkout with `npm install && npm run demo`, offline
  apart from the install.
- Two store drivers mean the repository test suite is a genuine contract suite;
  bugs that hide behind "it works on SQLite" surface as test failures.
- The local AI stand-in must be deterministic, so tests can assert exact answers.
  That means it is not a quality proxy: model quality is measured only in the
  benchmark slice (10), against a real endpoint.
- RLS is not free locally. The store enforces access in the repository layer with
  the same predicate Postgres RLS will apply, so the rule is tested from day one.

## Revisit when

- Real staff data is approved: the Entra and Graph clients stop being fixtures,
  and the DPIA (task `x-gov-dpia`) gates that switch.
- Postgres is available in CI: promote `PostgresStore` to the default used by
  the eval suite.
- Any local substitute starts accumulating behaviour that production would
  contradict. That is the signal the boundary is wrong, not that the substitute
  needs more features.

## Amendment, 2026-10-17 (same day, after the first slice)

Two rows above were written before the first line of code and are corrected here
rather than edited silently:

- **API framework.** Node's `http` module, not Fastify. The HTTP layer is a
  router and a static file handler; a framework buys nothing at this size and
  costs an install. The ADR's point — that the Azure path is a swap, not a
  rewrite — is unaffected.
- **Language runtime.** TypeScript, run directly through Node 22's type
  stripping. No build step and no bundler, so the demo runs from a checkout with
  no `npm install`. `tsc` is not yet wired up as a gate; the tests are.
- **The ontology layer was rebuilt** on the AKA engine's model after reviewing
  `aka-food/aka-new-platform`. See ADR-0006.
