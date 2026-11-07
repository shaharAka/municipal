# Municipal workspace

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Municipal staff and department managers. The first customer scenario is Moti's
sanitation department at the Upper Galilee Regional Council. Finance staff
review settlement outputs; dispatchers investigate collections and complaints.

## Product Purpose

Connect existing municipal systems into one shared ontology, organisational
memory, workflow and permissions layer. Give each person a clear place to
complete their work while preserving the context and evidence behind it.

## Operating Context

Confirmed integration targets are the council's ERP, its S. Bina CRM, and the
Excel settlement/dashboard process. Vendor endpoints, actual schemas and access
are not verified yet. Excel supplies initial inputs and calculation knowledge;
the product replaces manual reconciliation and dashboard maintenance. The ERP
and CRM remain systems of record.

## Capabilities and Constraints

- Work views: monthly settlement, collection map, service requests.
- Shared records connect settlements/businesses, collection points, visits,
  weights, charges, complaints, people, rules and process instances.
- Organisational memory preserves rules, decisions, evidence and corrections.
- Shared record conversations, explicit person mentions and follows feed a personal attention inbox.
- Replies, requests for information and signed decisions are distinct; settlement export requires Finance approval.
- Workflow actions have owners and require approval where appropriate.
- Permissions belong to records, sources and actions, not just navigation.
- Maps support inspection and route comparison. Driving-time optimisation needs
  verified road-network data and operational constraints.
- Current sanitation UI uses explicitly synthetic fixtures. Its role switch and
  browser-local actions demonstrate interaction; production identity and
  server-side access enforcement remain integration work.

## Product Principles

1. Shared platform underneath; task-specific views above it.
2. One record retains the same identity across work, map, memory and workflows.
3. Show the evidence and the next useful action in the record's context.
4. Ask people about consequential ambiguities; never silently adopt a new rule.
5. Keep estimated, observed and unknown information distinguishable.

## Accessibility & Inclusion

Hebrew-first, RTL, keyboard accessible, responsive desktop and mobile web.
