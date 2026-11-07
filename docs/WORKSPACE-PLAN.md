# Shared municipal workspace — implementation plan

Updated 24 October 2026 from the Upper Galilee meeting notes and product discussion.

## Scope and navigation

The default workspace has three primary destinations: Work, Organisational
memory, Workflows. Administration contains organisation, sources and access.
Work has three views of the same records: Settlement, Collections map, Service
requests. A consistent record panel exposes linked entities, evidence,
calculation, history and permissions without opening a separate subsystem.

## User stories and acceptance

- Moti closes a monthly settlement: inspect exceptions, confirm matches, prepare
  finance files. Counts and exports change with the same underlying records.
- Finance explains a disputed charge: trace amount → quantity → tariff → source
  and find related CRM requests. Unknown weights block export.
- Dispatch inspects collections: select a point on the map, open the same entity
  as in settlement and requests, inspect collection evidence and route order.
- CRM staff investigate missed service: link request to place, scheduled visit
  and owner. Vehicle proximity is not proof of collection.
- Another employee takes over: retrieve approved rules, their evidence, prior
  corrections and the people responsible for each step.

## This delivery: working UI skeleton

- [x] Clean RTL shell, responsive navigation and shared record panel.
- [x] Synthetic shared model, record links and source references.
- [x] Settlement filters, discrepancy review and guarded CSV preparation.
- [x] Google Maps view, shared record selection and Google Routes adapter.
- [x] Live in-map road routes and stop optimization verified against Google APIs.
- [x] Service-request list, owners and locally simulated status updates.
- [x] Organisational memory and workflow views linked to shared records.
- [x] Administration: source mappings, people and role/access examples.
- [x] Communication: record/step conversations, explicit mentions, follows, personal read state and quiet updates.
- [x] Approval handoffs: named requester/approver, source/version binding, information requests, resubmission and Finance gate.
- [x] Model and existing regression tests: 63 passing. Desktop/mobile browser
  checks completed; independent Impeccable finish review: **ship** for the UI.

## Next: customer evidence and integrations

1. Get three months of original spreadsheets and finance outputs, tariffs and
   agreements, and one corrected/disputed charge.
2. Verify ERP and S. Bina CRM products, export formats/API contracts, stable IDs,
   access scopes and freshness. Start with approved exports if needed.
3. Add sanitation types through ontology packs/tenant overlays, map imported
   records, and preserve source ACLs, evidence locators and fact versions.
4. Replace browser-local demo state with workflow instances, persisted decisions,
   authenticated roles and server-side permission checks.
5. Reproduce an approved month; test a held-out month. Measure preparation time,
   corrections, output agreement, confirmation effort and custom code required.
6. Connect bin inventory, visit/weight events and GPS. Validate the map against
   reality before routing with road distances, shifts, capacities, waste-type
   compatibility, receiving-facility hours and service commitments.

## Boundaries

New example ERP/CRM/Excel records are not live integrations. Map coordinates and
route loads are illustrative. Capacity partitioning is local; driving geometry,
distance, duration and stop ordering come from Google Routes. No straight-line
route is drawn. Live route calculation requires an enabled billing account and
a restricted browser key. This is not a truck-routing or savings claim.
The legacy licensing/eligibility demo remains at `/classic.html`.

## Implementation choices

- AG Grid Community 36.2.0 for settlement, requests and permission tables; 40px
  rows, sorting, column filters, resizing, horizontal scrolling and reset.
- AKA kit theme copied from `aka-food/aka-new-platform` revision `776496e`,
  with native-DOM primitive adapters; see [WORKSPACE-UX.md](WORKSPACE-UX.md).
- Recorded source inputs, derived findings and human decisions remain distinct.
- Google Cloud project `municipal-512612`; Maps JavaScript and Routes APIs
  enabled. Browser key is limited to localhost:4173 and those two APIs.
- `.env.local` is ignored by Git. `GOOGLE_MAPS_BROWSER_KEY` is the public,
  referrer-restricted browser key; `GOOGLE_MAPS_ROUTES_ENABLED=false` keeps
  the API path off when needed. Local routing is now enabled after billing linkage. Optional `GOOGLE_MAPS_MAP_ID`
  defaults to Google's demo map ID. Restart the server after changing these.

## Communication and approval extension

See [COMMUNICATION-APPROVAL.md](COMMUNICATION-APPROVAL.md). The personal inbox
is a top-bar entry; the three primary navigation destinations remain intact.
Replies are not decisions. Watches do not inflate the attention count.
Next integration work must persist comments, watches, notifications, approval
requests and decisions as ontology records, bind real people, enforce source
ACLs on the server, and use workflow instances/outbox delivery with audited
versions. Browser-local data is not a replacement for those controls.

## Google Maps live verification — 24 October 2026

Project `municipal-512612` is linked to the approved billing account ending
FDE812. Local route loading is enabled; browser-key restrictions are unchanged.
Live Maps JavaScript / Routes calls rendered road geometry for two synthetic
capacity runs. Original order returned 107.6 km / 123 minutes; Google stop-order
optimization returned 84.3 km / 97 minutes. These are example driving estimates,
not observed travel, service duration or operational savings.

A live single-stop response exposed an invalid optimization index. Single-stop
runs now skip order optimization, and multi-stop results must be a complete
valid permutation before rendering. The adapter regression and all 63 tests pass.
Screenshot: `docs/screenshots/workspace/map-live.jpg`.
