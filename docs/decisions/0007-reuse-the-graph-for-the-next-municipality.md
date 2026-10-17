# ADR-0007: reuse the learned graph as a template, and onboard by difference

- **Status:** accepted
- **Date:** 2026-10-17
- **Related:** ADR-0006, brief §2 principle 1 (one ontology, extended in layers)

## Context

The POC maps one department. The reason to map it properly is the next
municipality: they should start from what was learned, not from zero. The owner's
instruction was explicit — *come to a similar organization, start from that graph
and map only the differences*.

## Decision

**A template is exported from the learned graph.** Units, roles, services and
discovered process shapes — the structure, with no people and no records. It is
versioned (`template-givat-rimon v1.0.0`) and carries what it was built from.

**Onboarding is a diff, and the diff is the work queue.** A new organization's
graph is compared to the template and classified:

- **same** — the name matches after normalization; nothing to do.
- **renamed** — different name, same roles; a person accepts the rename.
- **added / missing** — genuinely new or genuinely absent; a person decides
  whether it is a local variant or a gap in the mapping.
- process steps get the same treatment per service: matched, added, missing.

**Matching is structural, and ambiguity is left unresolved.** Names are compared
after normalization by Jaccard over words, and units are also compared by role
overlap. A pair below both thresholds is *not* matched; the report says unsure
rather than guessing. Guessing a rename is exactly the kind of hidden heuristic
the brief forbids.

**The differences are expressed as an overlay draft.** The output is a
`proposed_overlay` document in the ADR-0006 shape (labels today; extend_page_types
and extend_enums when the difference is schema-level). It is a proposal: a person
accepts it. This keeps the AKA rule that a tenant never edits the baseline.

## Proven on the demo data

Givat Rimon → Kiryat Gefen, two deliberately different departments:

| | |
|---|---|
| Units | 4 of 5 matched; two renamed by evidence (role overlap 1.0 and 0.17) |
| Missing | pest control — outsourced in the target, so it must not be copied |
| Added role | permits officer (`רכזת היתרים`) for the coordinator |
| Process | licence gains a `DIGITAL_SIGNATURE` step; complaints (CMP) absent entirely |
| Coverage | units 80%, roles 38%, steps 73% |

The 38% role coverage is the point: structural matching finds the units, and the
role differences are what a person resolves.

## Consequences

- The second organization is built by the same pipeline against the same packs;
  nothing is forked. The diff is data, not a branch.
- A template imported from another municipality is only as good as its process
  measurements. Where the template has no measured process, it still gives units
  and roles, and the diff reports the missing steps.
- Renames accumulate as overlay labels, so the next onboarding starts from a
  richer template rather than re-deriving the same rename.

## Rejected

**Build the second municipality as a separate project.** Duplicates the pipeline
and guarantees drift between two demos.

**Auto-apply matches above a similarity score.** A threshold would silently
merge two different units; the brief requires a person to accept anything that
changes how the city works.
