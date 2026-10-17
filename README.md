# Municipal data platform POC

A proof of concept for a municipality on Microsoft cloud: a system that maps and learns the organization (structure, ontology,
workflows), fills its own gaps by interviewing people through generated forms, answers questions like "how many residents are
eligible for this service?", and grows automations from the data.

Start with the design brief: [docs/DESIGN.md](docs/DESIGN.md).

## POC scope

**Department:** Sanitation & Health (תברואה ובריאות) of the fictional City of Givat Rimon.
**Services:** food-business health licence (process mining and automation), sanitation-fee discount (eligibility and query),
sanitation and pest-control complaints (routing and SLA).

Runs locally against substitutes for the Azure services in the brief — SQLite for Postgres, fixture-backed Graph for Entra —
behind the interfaces production uses. See ADR-0001.

## Plan

The build plan is code: it lives in [docs/board/tasks](docs/board/tasks) and is synced to GitHub issues and the
[project board](https://github.com/users/shaharAka/projects/3).

```bash
node scripts/sync-board.mjs --dry-run   # what would change
node scripts/sync-board.mjs             # create/update issues and the board
```

96 tracked items: 15 epics and 81 tasks across the 10 slices of the brief plus four cross-cutting workstreams (domain
decisions, synthetic dataset, governance, evals). How it works: [docs/board/README.md](docs/board/README.md).
