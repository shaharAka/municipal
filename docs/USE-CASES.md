# Use cases the demo walks through

Four scenarios, chosen because each one removes a specific daily pain in the
Sanitation & Health department. Every step is a real click on real data; nothing
on the demo page is a simulation. The screen is `/` → **תרחישים**.

## The test every scenario must pass

A clerk or a department head should be able to answer, after one pass:

1. **What did I not have to do?** (search a system, ask a colleague, build a spreadsheet)
2. **What did the system decide?** (nothing that changes how the city works)
3. **What is it waiting for me to decide?**

If a screen cannot answer all three, it is complexity we added, not removed.

## 1 · Eligibility — "how many households qualify?"

| | |
|---|---|
| Pain today | The question goes to finance; someone opens a spreadsheet, joins two extracts by hand, and answers three days later without saying what they could not check. |
| What the system does | 28 eligible, 10 not eligible, **6 undecidable** — with the approved rule version, its citation and owner, and the attribute that blocked each unknown. |
| Clicks | Ask once. |
| Why it is simpler | The answer arrives with its own audit trail. Nobody has to reconstruct *how* the number was reached, and nobody is tempted to round the unknown away. |

## 2 · The gap — "who can close the missing six?"

| | |
|---|---|
| Pain today | Nobody knows who owns the income attribute, so the gap survives every renewal cycle. |
| What the system does | Opens three prefilled questions to the finance liaison (chosen from the org map), records the answer as evidence, and turns the contradiction with the rule into a **rule-change proposal with what-if numbers** (28 / 16 / 0). |
| Clicks | Open the question, answer it. Two. |
| Why it is simpler | The interview is three questions with the best guess already filled. The person confirms or corrects rather than composing an answer, and the change still waits for the rule owner. |

## 3 · A new source — "what happens when we connect mail?"

| | |
|---|---|
| Pain today | Connecting a system is an IT project measured in months, and the first output is usually a dashboard nobody asked for. |
| What the system does | Enabling work email runs its research and returns suggestions with evidence: 39 inferred responsibilities and a missing step in the licence process. Approving the responsibilities writes a decision with the approver's name. |
| Clicks | Connect, approve. Two. |
| Why it is simpler | The source does not need a specification up front. It produces proposals a person can accept in one click, and the proposals arrive with the reason attached. |

## 4 · A form — "the form changes, now what?"

| | |
|---|---|
| Pain today | Every field change is a development ticket, and the form drifts from the rules it is supposed to enforce. |
| What the system does | Generates the form from the page type, renders it in Hebrew, validates against the generated schema, and writes the submitted values onto the household with provenance. |
| Clicks | Create, fill, submit. |
| Why it is simpler | The form cannot contradict the model because both come from the same source. A new field is a model change, not a form rewrite. |

## What stays human, by design

- No eligibility rule changes without its owner.
- No automation runs before approval.
- No ontology change is applied by the system; proposals become a namespaced overlay when a person accepts them.
- Every unknown keeps a name and a next step instead of becoming a zero.

## Still open — decide before the first external demo

1. Should the unknown bucket be resolved by policy (as scenario 2 proposes) or by collecting documents from residents?
2. Is "one open interview per person" the right ceiling, or three questions a week?
3. Should the approval queue be a screen of its own, or stay where the proposals are raised?
