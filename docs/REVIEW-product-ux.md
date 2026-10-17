# Product and UX review: the signed-in surface

Reviewed 18 Oct 2026 against the running app (`npm start`, demo state), the
screenshots in `docs/screenshots/`, `docs/DESIGN.md`, `docs/UX.md` and
`docs/USE-CASES.md`. I signed in as the department head, the licensing
coordinator and the food inspector. I did not approve anything, so the demo
state is unchanged.

## Verdict

The visual craft is good. The RTL handling is careful, the palette is calm and
consistent, the decision queue's master–detail layout is right, and the landing
page explains the product in one look.

The problems are about the product, not the polish:

1. **Some numbers on screen are wrong or overstated.** The product's whole
   argument is "every number comes from the data, with its rule and source".
   A municipal director checks that first, and today it fails.
2. **The screens are built around what the system can do, not around what each
   person does in their day.** Every role gets almost the same home. The nav
   changes, but the content doesn't.
3. **Who owns each decision is muddled.** People are asked to decide things that
   aren't theirs, and an interview meant for someone else is answered by
   whoever clicks the button.

Fix section 1 before anyone outside sees the demo. Sections 2 and 3 decide
whether it reads as a product or a capability tour.

---

## 1 · Credibility bugs (P0)

### 1.1 The ask box answers a different question, confidently

| Asked | Answered |
|---|---|
| כמה עסקים יש בעיר? | 26 עסקים |
| כמה עסקים ממתינים לפיקוח כרגע? | 26 עסקים |
| כמה עסקים פתוחים בלי רישיון? | 26 עסקים |

The planner keeps the entity and drops the filter. For a product whose promise
is "לא ניחשתי", this is the worst possible failure, because it looks like a
real answer.

**Fix:** if any part of the question isn't mapped to the plan, refuse or say
what was understood ("הבנתי: כל העסקים בעיר — הסינון 'ממתינים לפיקוח' לא
נתמך עדיין"). Always show the interpreted plan in one line above the number.
Add these three questions to the eval set as must-refuse cases.

### 1.2 The flagship answer cites the wrong sources

`/api/answer` lists all four systems, including Exchange and SharePoint, which
are switched off. The UI keeps the first three (`src/web/views.js:539`), so
the footer reads "זהות העובדים · דואר העבודה · מסמכי המחלקה". It cites two
disconnected sources and drops Azure SQL, the only one the eligibility rule
actually reads.

**Fix:** the API should return only the sources the plan read. The UI should
show all of them, not a slice.

### 1.3 "ימי עבודה בשנה" are not workdays

`annualDaysSaved = cases per year × median wait × 0.6`
(`src/process/discover.ts:269`). That counts days an applicant's case sits
waiting. It does not count staff time. A reminder before an inspection-scheduling
deadline doesn't save the city 295 workdays. The pulse headline, "483 ימי
עבודה בשנה שאפשר לחסוך", is roughly two full-time staff in a 17-person
department. It's the first number a director will challenge, and it won't
survive.

Also, `discover.ts:298` (`casesPerYear * 1.2`) is an undeclared constant. That
breaks principle 5 of the brief.

**Fix:** rename the metric to what it measures ("ימי המתנה של מבקשים שיתקצרו
בשנה" or "ימים שתיק מחכה"), show the formula in the detail pane, and move the
1.2 into `PARAMS` with an owner. If staff time matters, measure it separately
(touches per case × minutes per touch) and label it as an assumption.

### 1.4 The same data shows up as connected and disconnected

- Sources says Exchange is **לא מחובר**. Systems shows 55 messages from it, and
  "מה למדנו מההודעה" works.
- Dana's own inbox contains Michal's message to Amir ("נשלח אל אמיר חדאד").
  A mailbox shows the owner's mail, or it's a shared mailbox and is labelled
  as one.

### 1.5 Wording that gives the wrong meaning

- "חסר **הכנסה נמוכה**" names the rule's criterion, not the missing attribute.
  It should say "חסר נתון הכנסה של משק הבית". The landing page already says it
  correctly.
- "מי מטפל בפיקוח?" answers with Michal, the coordinator who *schedules*
  inspections, not the inspectors. "62 מתוך 290 פעולות" uses her total actions
  as the denominator. For "who handles X", the useful number is her share of X:
  "כל 62 השיבוצים נעשו על ידי מיכל".
- 64% + 23% + 14% = 101%. Round so the shares add to 100, or drop the
  percentages; the bar already shows them.

### 1.6 English on screen

- The unanswerable-question fallback is English: "I can only answer questions
  declared…" (`src/query/eligibility.ts:255`). That breaks the rule in UX.md
  that generated English isn't shown to people.
- The sensitivity labels in Systems ("Internal", "Confidential") are fine if they
  mirror Purview exactly, but they need a Hebrew gloss next to them.

---

## 2 · Whose day is this? (P0 for the narrative)

### 2.1 Every role gets the same home

| Role | What the home leads with | What that person actually needs |
|---|---|---|
| Department head (Dana) | Fee-discount eligibility, 4 tasks, pulse | Department health: open cases by stage against SLA, overdue cases, the bottleneck trend, decisions that are hers |
| Licensing coordinator (Michal) | The same eligibility answer, "10 החלטות ממתינות לך", the same pulse | Her queue: cases waiting on her (scheduling, missing documents), what's overdue today, and which automations would take work off her |
| Food inspector (Amir) | The same eligibility answer with a "סגור את הפער" button, a bottleneck he can't act on, "483 ימי עבודה" | This week's inspections, each business's history and open findings, and the corrections letters to write |

The fee-discount question belongs to the treasury. Its rule owner, Moshe Tal,
isn't even one of the five people who can sign in. Putting it at the top of
every home in a sanitation department says the product is a demo of a query
engine.

**Recommendation:** keep one shell, but give each role a different first block:

- **Head:** a "department in one look" block. The question box moves to the top
  bar, where ⌘K already exists. Today there are two entry points, the top-bar
  search and the hero box, and they do overlapping things.
- **Coordinator:** "what's waiting on you" as a case list, with automations
  presented as "this would remove N of these".
- **Inspector:** "your inspections", with the explain/evidence sheets reused on
  a business.

The eligibility answer stays as a scenario reached from the question box, a
saved answer, or the landing page. It shouldn't be every person's home.

### 2.2 Two of the three scoped services are empty shells

The README scopes three services. The picture tabs show complaints (42 cases)
and the discount (28), but "כמה תלונות על מזיקים היו החודש?" is refused, and so
is "מה הסטטוס של תיק CASE-0001?", the most common question any clerk asks.
Either narrow the stated scope to licensing plus eligibility, or make case status
and complaint counts answerable. Case status is the cheapest way to make the ask
box feel useful every day.

### 2.3 The story a buyer needs isn't on screen

The pitch is "it learned your department". The information architecture mirrors
the system's internals (sources → research → decisions → model). A city director
evaluating this wants three things in the first minute:

1. **What it found that we didn't know:** a 12-day wait at inspection
   scheduling, carrying 46% of the case time; 6 households stuck on a missing
   income field; who actually does what.
2. **What it cost staff:** one 3-question interview, and no project.
3. **What's waiting for my decision.**

Consider a "findings" layer: three findings, each opening its evidence, each
ending in a decision. The landing page is close to this already. Its stats
(1,578 records, 8,182 facts) are internal measures that mean nothing to a buyer.
Replace them with the findings.

---

## 3 · Decisions and ownership (P0)

- **The queue isn't filtered by owner.** Michal sees "10 החלטות ממתינות לך",
  the same 10 as the head. That includes ontology additions and an automation
  that sends reminders *to her*. "One decision, one approver" (UX.md) isn't true
  yet.
- **Model changes go to the wrong person.** "מאפיין מוצע: שפת דיור" in a
  department head's queue contradicts the brief, which says the ontology steward
  decides. Move these to the workbench or a steward role. That also settles open
  question 3 in USE-CASES.md.
- **The interview is answered by the wrong person.** Dana clicks "פתח שאלה
  קצרה", gets a form addressed to Moshe Tal, and can submit it herself. The
  action should be "שלח למשה טל", followed by a "ממתין לתשובה" state on the gap.
  Answering should only be possible in Moshe's session.
- **The interview loops back on itself.** The questions go to Moshe, the rule
  owner. His answer produces a rule-change proposal that waits for… the rule
  owner. Question 2 ("what should the eligibility check do when income is
  missing?") is a policy question, not a data question. Split it: data
  questions go to whoever holds the data, and policy changes go straight to the
  rule owner as a proposal. Question 3 suggests "רון דיין", who isn't in the
  directory list.
- **"אישור והפעלה" doesn't say what happens.** The product is read-only, so what
  runs? Say so on the button's detail: what triggers it, from when, who gets
  notified, and how to turn it off.
- **The same item can be approved in two places.** Sources ("הוסיפו תזכורת
  אוטומטית…") and Decisions both offer it. Keep one place to act and link to it
  from the other.
- **Gaps sit in a queue whose promise is one action per item, but a gap can't
  be approved.** Either give gaps their own action ("שלח שאלה") or move them out
  of the queue into a "פערים" section.

---

## 4 · Screen by screen

### Landing

The strongest screen. Two changes:

- Swap the internal stats for findings (see 2.3).
- Remove "לתצוגת האנליטיקאי" from the front door. It's a back-office link.

### Home

- The header says "10 החלטות ממתינות לך", but the list says "4 פריטים". Use one
  number, or explain the gap ("4 שלך, 6 של המחלקה").
- The bell (10) and the nav badge (10) repeat the same count. Keep one.
- The answer card takes the best space permanently, even though it's a preloaded
  answer. After the first visit it's noise. Collapse it to one line, or let the
  person pin answers they care about.
- "39 אחריויות שממתינות לאדם" doesn't say *which* person. For the head, show
  "N עדיין לא אושרו על ידי העובדים" and link to the org map.
- The amber "שאל" button clashes with the visual system's own rule that amber
  means unknown. Use the action green.

### Decisions

- The detail pane is about 40% empty, and its evidence is a row of chips. Show
  what the claim rests on: a small distribution of the 62 waits, the 12-day
  median marked, and the 60% assumption as an editable value with its owner.
- "62 מקרים" and "41 מקרים בשנה" sit side by side with no link. Say "62 תיקים
  ב־547 ימים ≈ 41 בשנה".
- "סיכון נמוך" has no reason. Every risk label needs one line saying why.

### Department picture

- **The core claim is half off-screen.** The measured flow needs horizontal
  scrolling ("גללו לרוחב כדי לראות את כל 10 השלבים"). This flow *is* the
  "discovered, not written" argument. Make it fit: wrap it, or collapse
  short-wait steps into one node and expand only the slow ones.
- **The variants are cut at exactly the step where they differ.** All three start
  "קבלת בקשה ← …" and end in "…". Show only where each one departs from the
  main path ("+ בקשת מסמכים", "+ דרישת תיקונים").
- "100% מהתיקים במסלולים המובילים" reads as synthetic, because real logs never
  do that. Either add noise to the fixtures so the top three cover about 85%,
  or hide the metric when it's trivial.
- **The waits are pinned on people.** "שיבוץ פיקוח · רכזת רישוי · 12 ימים"
  reads as blame on one person, and the department head will show this screen
  to her staff. Tie each wait to the step and what it depends on (for example,
  inspector availability), not to the role.
- **Validation is the brief's step 2, but it's a small chip here.** "ממתין
  לאישור" sits in the corner. Make "this is how it really works — אשר / תקן" the
  primary action on this screen for the process owner.

### Sources

- **Connecting work email is one toggle for a department head.** The brief
  itself (§6, §10) says staff email needs written approval from the
  municipality, a privacy impact assessment (DPIA) and transparency to staff.
  The first question from any Israeli municipal lawyer will be "who approved
  reading mail?" Show the scope, the approval (legal and IT, with names), and
  the staff opt-out in the connect flow. That turns the objection into a
  feature.
- **The suggestions don't match the department.** "טופס קליטת עובד חדש" is the
  research suggestion from the directory. It's unrelated to anything the
  sanitation department struggles with. Pick suggestions that close a gap shown
  elsewhere, such as a missing-income collection form.
- The empty "טפסים שנולדו מהמודל" block at the bottom of the page should
  disappear when it's empty, or show what one would look like.

### Systems

The Outlook and SharePoint rendering is faithful, but as a top-level nav item
its purpose is unclear: it looks like "we rebuilt Outlook". It's really an
evidence viewer. Remove it from the nav and open it in context instead: "הצג
במקור" from a fact, an answer, or a responsibility, deep-linked to the exact
message or file and highlighting the span. That's also the strongest
provenance demo in the product.

### Mobile

On the phone, the question hero and the answer push every task below the fold.
On mobile, lead with the attention list. The full-width amber "שאל" button
outweighs everything else on the screen.

---

## 5 · Priorities

**P0 — before any external demo**

1. The ask box refuses or states its interpretation instead of dropping filters (1.1).
2. Answer sources are only the ones read (1.2).
3. The "ימי עבודה" metric is renamed and its formula shown; the undeclared constant is declared (1.3).
4. Connected versus disconnected sources are consistent everywhere (1.4); the wording fixes and the English fallback are done (1.5, 1.6).
5. The decision queue is filtered by owner, and model changes leave the head's queue (3).
6. The interview is *sent*, not answered by whoever clicked; data and policy questions are split (3).
7. Each role gets a different first block on its home (2.1).

**P1**

8. The measured flow fits on screen; variants show only their differences; validation is the primary action.
9. Systems becomes an in-context evidence viewer.
10. The connect-email flow shows approval, scope and staff opt-out.
11. Case status and complaint counts become answerable, or the stated scope is narrowed (2.2).
12. A findings layer on the landing page and the head's home (2.3).

**P2**

13. Badge duplication, the color of the "שאל" button, the empty-state blocks, percentage rounding, and mobile ordering.

## Not covered by this review

- Approving anything. That would change the demo state, so the success and
  undo flows, toasts and the "recent decisions" list are unreviewed.
- Keyboard-only paths, screen readers and reduced motion.
- The secretary role (Hila) and the sanitation inspector (Eitan).
- The analyst workbench (`workbench.html`).
