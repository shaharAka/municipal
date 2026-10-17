# ADR-0006: adopt the AKA ontology engine's model

- **Status:** accepted
- **Date:** 2026-10-17
- **Related:** `aka-food/aka-new-platform` `ontology/` (composer, baseline packs, tenant overlay)

## Context

The brief asks for one municipal ontology that ships as packs and is extended by
a city (principle 1), facts with provenance (principle 2), proposals that only a
person turns into schema (principles 3–4), and no hidden heuristics (principle 5).

The AKA platform already runs an ontology engine built on exactly those ideas:
a foundation and baseline packs that only point down, a tenant overlay that adds
without editing, a composer that validates and refuses loudly, instance graphs
validated against the composed schema, and a learning section where code computes
aggregates and a model reasons over the evidence.

Writing a second, home-grown model would have produced a POC that looks right and
teaches the municipality something a production build would have to unlearn.

## Decision

Adopt the AKA engine's document model and its rules, reimplemented for this stack.

**Same shape.** A pack is `pack / title / description / defs / page_types /
edge_kinds / inference_rules / learning`. A page type has JSON-Schema properties
and `required`. An edge kind declares `from`, `to`, optional `lineage`, `payload`
and `payload_required`. An overlay is `overlay / organization_id / labels /
page_types / extend_page_types / extend_enums / edge_kinds / learning`.

**Same layering.** Baseline packs are composed in a fixed order; a pack may not
redeclare a def, type or edge kind. An overlay adds pages, properties, enum
values and edge kinds, may relabel what exists, and may not redefine it. In strict
mode a tenant's own names must be namespaced (`x_<slug>`).

**Same validation stance.** Unknown properties are refused, not ignored; an edge
pointing at an unknown page type fails composition; a page that misses a required
property fails validation. A silent success is worse than a loud failure.

**Same provenance vocabulary.** The `provenance` def (`kind`, `source`, `method`,
`as_of`, `evidence_class`, `locator`, `confirmed_by_role`) and the evidence-class
labels (`measured`, `sourced`, `extracted`, `attributed`, `asserted`,
`model_estimate`) are taken as they are. There are no numeric confidence weights,
for the reason the engine gives: a stored weight becomes a cutoff nobody declared.
An inference carries the count of what it rests on instead.

**Same learning stance.** Aggregates (medians, p90, counts) are computed by code;
the reasoning model gets the aggregates and the question. No threshold is decided
by a regex or a score buried in an `if`.

## Where this POC diverges, and why

| AKA engine | Here | Why |
|---|---|---|
| Python + `uv`, PyYAML, `jsonschema` | TypeScript on Node 22, no dependencies | The POC must run from a checkout with no install. Node's type stripping runs the `.ts` files directly. |
| Packs authored in YAML | Packs authored in JSON | Same document shape (`world_schema_json`); avoids a YAML parser. Converting to YAML is mechanical. |
| Foundation science layer (FoodOn/ChEBI) | A `core` municipal pack | There is no municipal equivalent of FoodOn worth inventing. The core pack plays the same role until one exists. |
| Units registry with exact rationals | `d`, `m2`, `ILS` declared per property | Municipal fees are not multi-unit physical science; the registry is present but deliberately small. |
| 25-module baseline | 22 page types across 6 packs | Only what the sanitation and health demo reads. The shape allows packs to be added without a schema change. |

## Consequences

- Moving a pack from this POC into the AKA engine is a YAML conversion plus a
  re-run of the same composer rules, not a re-modelling exercise.
- The composer is ~450 lines we own. It validates, but it is not the Python
  implementation: where they differ, the Python one is authoritative.
- Because there is no numeric confidence, the UI must show support counts and
  evidence rather than a percentage — which is the honest thing to show anyway.

## Rejected

**Keep the ad-hoc TypeScript types.** What this repo had an hour before this ADR.
It had no overlay, no composition rules, no learning section, and no way to
accept a pack from another module without editing code.

**Embed the Python ontology package.** A second runtime and a package manager,
for a POC whose whole value is running anywhere.

**Invent a municipal foundation ontology now.** The right move later, with a
named standards body behind it; premature without one.
