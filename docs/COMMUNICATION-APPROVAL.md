# Communication and approval

The former UI could record a correction but did not show the human handoff:
who asked, who needs to answer, which evidence was reviewed and what remains
blocked. This extension makes that work visible in the same record context.

## AKA reference

Read against fetched main revision `776496e` of `aka-food/aka-new-platform`:
`web/src/comms/Thread.tsx`, `Follow.tsx`, `activity.ts`, `pages/NeedsYouPage.tsx`,
`platform/aka_new_platform/notifications.py`, its communication tests, and D54.
The municipal implementation adapts those contracts to the native DOM skeleton.

## Working demo

- **Conversation:** shared by authorized readers of a record. Explicit directory
  recipients receive mentions; comments without recipients notify only existing
  followers. Authors are not told about their own acts. Workflow-stage context
  is retained. Discussion of a computed finding attaches to its durable source.
- **Personal attention:** top-bar “לעיוני” opens approvals, mentions and quiet
  updates. Read state belongs to the recipient. Reading never approves work.
- **Approval:** each exception has a named requester and approver, a request
  version, source basis, due date and retained decisions. Ask for information
  or return for correction requires a reason. A reply does not resubmit work.
- **Finance:** only the Finance persona can sign the completed settlement.
  Unresolved exceptions block the task; changed figures/evidence invalidate
  the approval. Export is gated on the current signature.
- **Activity:** comments and recorded decisions appear in one chronological
  record history. Following is separate from a decision and from permission.

## Boundaries and integration

Everything here uses synthetic data and session storage. Role switching is
identity simulation; it is not server authentication. No email, Teams or other
external communication is sent. Dates are illustrative and do not run timers.
There is no claim of durable signatures or transactional delivery.

Production must reuse the shared ontology and workflow engine: persisted
comment/watch/notification records, authenticated principals, source ACL checks,
versioned approval instances and append-only decisions, transactionally emitted
notifications, and explicit outbox/delivery states for approved external sends.
Tenant workflow configuration, real assignments, reminders, escalation and
retention belong to that integration.
