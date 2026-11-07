# Municipal workspace UX

Scope: the new default web surface at `/`. Mode: Operate. The owner selected
the structure and named `aka-food/aka-new-platform` as the frontend and
knowledge-layer reference; this is an extension of that established system.

## Direction contract

**Thesis:** the same municipal records support a person's work, organisational
memory and workflows. Operational tasks have direct, contextual actions.

**Own world:** use the copied AKA kit tokens, flat white work surfaces, quiet
sidebar, compact controls, 40px desktop AG Grid rows (60px condensed phone rows) and restrained semantic colour.
Keep Hebrew RTL and the existing icon vocabulary.

**Story:** a manager reviews settlement discrepancies; a dispatcher opens the
same place on Google Maps and follows its CRM request. A computed finding
links to immutable example inputs and its versioned rule. A human decision is
a separate event.

**First viewport:** narrow right sidebar with Work, Memory and Workflows;
search and role simulation in the top bar; three work-view tabs; one dominant
operational grid or map. Record details open at inline end without navigating
away. Administration stays subordinate.

**Form:** owner-specified workbench with dense tables and contextual inspector.
No concept tournament: the owner approved the structure and supplied the
reference. Code-first skeleton; no generated artwork.

**Finish:** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance. The existing `docs/DESIGN.md` remains the architecture brief; this
surface extends it and documents its actual implementation here.

## Imported and adapted code

Reference revision: `aka-food/aka-new-platform` `776496e`.

- `src/design/aka-kit/theme/tokens.ts`: copied verbatim.
- `src/design/aka-kit/theme/cssVariables.ts`: copied; import extension adjusted
  for Node's native TypeScript loader.
- `scripts/build-aka-theme.mjs`: emits browser CSS/JS from those sources.
- `src/web/aka-kit/primitives.js`: native-DOM adaptations of StatusDot and
  PageHeader conventions. This POC does not import the React/Radix runtime.
- Recorded/derived knowledge follows `docs/design/knowledge-layers.md` in the
  reference: derived findings recompute without changing source observations.

## Implementation boundaries

ERP, CRM and Excel use example data. Role simulation is not authenticated
server authorisation. Browser decisions are local to the session. Maps and
road geometry use Google; vehicle capacity is handled by the demo's run
partitioning, while truck restrictions and operational validation remain open.
No estimated straight-line distance is presented as a road route.

## Finish evidence — 24 October 2026

Independent Impeccable review: **ship** after five material fixes: phone rows
retain identity, amount and exception; workflow inspector is to the right;
approval surfaces are white with explicit semantic flags; role simulation and
browser-only decisions are visible; redundant record eyebrow removed. The
verdict covers the reviewed UI skeleton, not production integration readiness.

Desktop and phone captures are in `docs/screenshots/workspace/`. All 55 tests
pass, including a mocked Google adapter contract test for road geometry,
optimized order and overlay cleanup. Live Google billing and road-route calls were subsequently verified on
24 October 2026; see the live verification section of WORKSPACE-PLAN.md. AG Grid sort/filter, discrepancy approvals, missing-weight
validation, guarded export preparation, role restrictions, record links and
request status updates were checked in the browser.

## Communication and approval surface

AKA reference revision `776496e`: `web/src/comms/Thread.tsx`, `Follow.tsx`,
`activity.ts`, `pages/NeedsYouPage.tsx`, `platform/aka_new_platform/notifications.py`,
and D54. This extends the same workbench, with one personal top-bar entry
and a conversation tab on the shared inspector. It adapts semantics and native
rendering; it does not import the Python service or React components.

Conversations stay with a record or workflow step. Mentions name directory
principals; follows produce quiet updates. Personal read state is independent
of decision state. A human decision carries requester, approver, request
version, evidence basis, rationale and history. Finance signs the reconciled
month before export; changed figures invalidate that signature.

Communication extension finish review: **ship**. The reviewer checked desktop
conversation and Finance handoff captures, plus phone inbox and approval views.
All 63 tests pass; source-version, permission and export gates are covered.
