# Response to the product and UX review

Reviewed [REVIEW-product-ux.md](REVIEW-product-ux.md) against the app on
18 Oct 2026. This is what changed, what was deliberately deferred, and how to
check it. The demo state is reset after the changes; `npm test` no longer
approves anything against the developer's running server.

## P0 — credibility

### 1.1 The ask box answers a different question

- The planner is now explicit: it detects the entity, the rule and any
  qualifier (waiting, open, without a licence, a period, a case ID, a status,
  a category). If any qualifier is not mapped, it refuses and says what it
  understood. It never returns the unfiltered count.
- Every answer carries `interpretationHe`: one line above the number, e.g.
  "כל 44 משקי הבית במודל, לפי כלל SAN-FEE-DISCOUNT גרסה 2".
- The three review questions are must-refuse cases in `tests/api.test.ts`; the
  supported "how many businesses?" still returns 26. The eval set also covers
  month, district, status, income, age/disability and year filters, and refuses
  non-count eligibility questions ("what is the rule?", "who is eligible?")
  instead of returning the aggregate.
- The top-bar question surface shows the interpretation, the rule and the
  sources. The landing answer shows the same.

### 1.2 The flagship answer cites the wrong sources

- `answerQuestion` filters sources to what the plan read: `sql` for the
  eligibility rule and for entity counts; `entra` for identity-only plans; none
  for a refusal.
- The UI no longer slices the source list; the answer footer now reads only
  "מערכות הפעלה" for the discount answer.
- A test asserts `answer.sources` is `['sql']`.

### 1.3 "ימי עבודה בשנה" are not workdays

- The metric is now "ימי המתנה של תיקים בשנה" / "ימי המתנה של תיקים שאפשר
  לקצר", across the approvals summary, the proposal cards, the source evidence
  and the docs. It is explicitly not staff workdays.
- The approval detail shows the basis ("62 תיקים בתצפית של 547 ימים ≈ 41
  תיקים בשנה") and the formula ("41 × 7.2 ≈ 295 ימי המתנה"), plus the declared
  assumption (60%, owner: Dana Levi).
- The undeclared `1.2` for routing moved into `PARAMS.routingDaysSavedPerCase`
  with an owner and a reason.
- The detail also shows the measured wait distribution with the median bin
  marked, and the risk with a reason.
- The "what approval does" note says the POC has no execution engine and no
  write-back, so the action is an approval, not a running job.

### 1.4 Connected and disconnected sources disagree

- `/api/outlook` and `/api/doclib` return `connected: false` and no items when
  the source is off. The source viewer shows a gate with a link to Sources.
- Search respects the same gate: mail is not returned when Exchange is off, and
  documents are not returned when SharePoint is off.
- The mailbox is now labelled "תיבת דואר משותפת · תברואה ובריאות", not a
  personal address; the fixture is a shared mailbox.
- A test toggles Exchange on, verifies the shared mailbox and messages, and
  toggles it off again.

### 1.5 Wording

- Missing attributes are named as attributes: "חסר נתון הכנסה של משק הבית",
  not "הכנסה נמוכה". The API carries `property_label_he`.
- "Who handles X?" now includes the inspectors for "פיקוח" and uses the share of
  the activity, e.g. "32 מתוך 62 ביקורות בשטח בוצעו על ידי אמיר חדד", not the
  person's count out of all their actions.
- Percentages use largest-remainder rounding and add to exactly 100:
  63 / 23 / 14.
- The no-match refusal and the no-rule refusal are Hebrew. Sensitivity labels
  keep the Purview value and add a Hebrew gloss.

### 1.6 English on screen

- The unanswerable fallback, the interview prefill sources, the case status card
  and the source evidence are Hebrew.
- Status/type labels in record and form sheets are translated; Latin codes stay
  LTR-isolated.

## P0 — whose day is this?

### 2.1 Every role gets the same home

The home is now role-shaped. The first block is:

- **Department head:** open cases, overdue against SLA, median case time,
  bottleneck, open cases by stage, and three findings (bottleneck, missing
  income, inferred responsibilities).
- **Licensing coordinator:** her open LIC cases, oldest and overdue first, with
  the stage, subject and age.
- **Food inspector:** her food inspections and the businesses waiting for one.
- **Field inspector:** inspections she has performed and open inspection cases;
  the fixture has no sanitation assignment, so the block says that instead of
  inventing a queue.
- **Rule owner:** questions waiting for them, the rule in force, unknown
  households.
- **Data steward:** model additions waiting and model coverage.
- **Secretary:** open cases and a link to the source viewer; no decisions she
  does not own.

The universal answer card and the large ask hero are gone. The top bar is the
single question/search surface (`⌘K`). The landing keeps one live answer as the
flagship. The head's home leads with department health, not the fee discount.

### 2.2 Empty services and case status

- Case status is answerable: "מה הסטטוס של תיק CASE-0001?" returns a case card
  with status, subject, service, dates and the last stage.
- Complaint counts are answerable: "כמה קריאות תברואה יש?" returns 42. A
  complaint question with a month or pest filter is refused with the
  interpretation, rather than silently counting everything.
- The README states the remaining limit explicitly.

### 2.3 The story a buyer needs

- The landing's internal stats (pages/facts) are replaced by three findings:
  12 days at the bottleneck, 6 households missing income, 39 inferred
  responsibilities.
- The head's first block repeats the findings in context and ends in the
  decision queue or the department picture.
- "לתצוגת האנליטיקאי" is removed from the landing; the analyst workbench stays
  reachable from the signed-in side rail.

## P0 — decisions and ownership

- **Owner filter:** `/api/approvals` returns only the items for the signed-in
  role. Head: automations and process validation. Coordinator: form research
  plus the gap. Rule owner: gap, form research and rule changes. Data
  steward: model additions. Secretary: none of the above. `?scope=all` returns
  department totals only, for the landing count, never the queue's details.
- **Model changes leave the head's queue** and go to the data steward. The
  shared packs are never edited; additions are a namespaced overlay.
- **Interview ownership:** the coordinator sends the question; the API marks it
  as sent and returns no questions to the sender. Only the recipient's session
  can answer (`403` otherwise). The rule owner sees "1 question waiting for you"
  and answers from home.
- **Data vs policy:** questions are tagged "נתון" or "החלטת בעל הכלל". The
  policy answer is recorded as the rule owner's decision, not as a fresh
  proposal waiting for the same person.
- **The question options no longer name a person who is not in the directory**
  (Roni Dayan is now the data steward).
- **"אישור והפעלה" explains itself:** the detail says the POC has no execution
  engine, no outbound reminder and no write-back. The button is "אישור
  האוטומציה".
- **One place to act:** source suggestions link to the owner's decisions; the
  source page no longer has approve buttons (it does keep the "personal review"
  note for responsibilities).
- **Gaps have their own action:** "שלח שאלה" for the coordinator, "ענה לשאלה" for
  the recipient, and "ממתין לשאלה ממיכל" for the rule owner before a question is
  sent.

## P1 and P2 addressed

- The process flow fits on a desktop panel; the variants show only their
  differences from the main path; waits are tied to what they depend on, not
  pinned on a role.
- Validation is a primary action on the department picture for the process
  owner; it writes a decision and removes the workflow suggestion from the
  queue and sources.
- The connect-email flow shows scope, legal/IT approvers, DPIA status and staff
  opt-out before the toggle.
- The source viewer is reachable from a fact ("הצג במקור") and deep-links to the
  message or document.
- Badge duplication is gone (the bell was removed; the nav badge is the count).
- The ask button is no longer amber; the amber stays for unknown/waiting.
- The empty forms block is hidden when there are no forms.
- Mobile leads with the role block, not the answer hero.

## Deliberately still open

- **Editable assumption:** the 60% assumption is shown with its owner and
  formula, but it is not an editable parameter in the UI. Changing it would need
  a declared-parameter edit flow and a recomputation; the analyst workbench is
  the only place to see the parameter today.
- **Process correction:** a process owner can validate; a "correct this step"
  editor is not built. The workbench shows the discovered model.
- **Full source highlight:** deep links open the exact message/document, but do
  not highlight the evidence span inside it.
- **Consent persistence:** the consent sheet is a UI gate and does not store a
  signed approval or an opt-out list. A production build needs both.
- **Case filters:** case status works for a single case; case counts by status,
  stage or date are not query plans yet. Complaint counts work; complaint
  filters do not.
- **The case overview is data-shaped:** all nine open LIC cases happen to sit at
  "חיוב אגרה" in the fixed fixture, so the stage mix is one bar. The screen is
  honest about the data, not flattering.
- **Frontend tests:** the API has 40 tests; the browser routes are verified with
  headless Chrome but there is no browser-matrix CI.
