# Value pages and a page-by-page pass: hand-off package

Built 18 Oct 2026 in a separate copy of this repo while DeepSeek was working.
It is based on the working tree as it stood at 01:04 (uncommitted, unchanged
since). Nothing in `src/` or `tests/` here has been changed; everything is in
the patch.

## Apply

```bash
git apply docs/value-pages/value-pages.patch
npm test        # 46 tests: the 40 existing ones plus 6 new
npm start
```

`git apply --check` passes against the current working tree. If the tree moves
before you apply it, use `git apply --3way`.

## What it adds for a customer demo

Two pages, made from the customer conversations (Ofakim, Upper Galilee), plus a
pass over every existing page.

### 1. מיצוי זכויות (`#/rights`): Ofakim's ask

"Who is eligible for an arnona discount and isn't getting it?"

- A declared demo rule `ARNONA-RELIEF` with three grounds:
  - a valid disability certificate;
  - a senior (67+) in a low-income household;
  - active reserve service.
- It runs over residents, households and properties, and crosses the result
  with a read-only arnona billing flag.
- **Result on the demo data:** 7 of 44 households are eligible, 5 aren't
  receiving the discount, about ₪19,796 a year unclaimed.
- **Names are gated by role, not by clearance level.**
  - The secretary (Hila) and the treasury coordinator (Moshe) see the worklist,
    with the evidence for each resident (record, field, value).
  - Everyone else sees counts only, with anything below 5 hidden. The letter
    endpoint returns 403 to them.
- **One real action.** "הכנת פנייה" opens a Hebrew letter built from a fixed
  template. "אישור ושליחה" records an `outreach_approved` decision in the
  sender's name, and the row shows "פנייה נשלחה". The billing system isn't
  touched.
- **The security answer for Linoy.** A "גבול המידע" panel shows what the rule
  engine read (44 households, the exact fields) and what the AI model received
  (0 resident records). It also shows the three deployment levels from the
  brief-coverage review.
- **Reservists are reported, not invented.** No source is connected, so 26
  households show as "לא ניתן לבדוק". Where that data comes from is the open
  question for Bernard.
- All rates and the arnona tariff are declared values for the demo, each with
  an owner (`RIGHTS_PARAMS`, `ARNONA_RULE`). They are not the city's numbers.

### 2. מהישיבה למשימות (`#/meetings`): Upper Galilee's ask

"What was decided, who owns it, and what's stuck?"

- Two management-meeting minutes (15.9 and 14.10) are stored with
  line-numbered text. Decisions are extracted by a declared format
  (`הוחלט:` / `אחראי:` / `עד:` / `בוצע:`), not by a model.
- Owners are matched to the directory. "בוצע:" in a later meeting closes an
  earlier decision. Each decision links to its exact line in the source.
- **Result:** 8 decisions, 1 closed by the next meeting, 1 overdue by 17 days,
  2 without an owner.
- **Proactive alert:** a "דורש תשומת לב" box at the top lists ownerless and
  overdue decisions. The head can assign an owner in place.
- **Recall:** a "מה כבר הוחלט על…" search covers past decisions.
- **One real action.** Only the head can create tasks; others get 403. "יצירת
  משימות ותזכורות" creates them with a reminder 3 days before the due date and
  records a `meeting_tasks_created` decision. Each owner sees "המשימות שלי"
  here and on their home.
- The October decision to list households that didn't claim their discount
  links straight to the rights page. That connects the two demos.

### 3. Changes to the existing pages

**Initiatives on every home.** An "יוזמות · המערכת מצאה" strip under the role
block shows what the two pages want from this person:

- **Hila:** "5 תושבים זכאים ממתינים לפנייה ממך" and her meeting task. Her home
  used to say "הכל מטופל".
- **Dana:** the unclaimed ₪ and "7 open decisions · 2 without an owner · 1
  overdue".
- **Amir:** his task due 20.10.

**Landing.** The headline becomes "העירייה יודעת. עכשיו היא יכולה לפעול", and
the three findings are the unclaimed ₪, the bottleneck, and decisions without
an owner.

**Coordinator's queue (Michal).** All 9 open licensing cases have their last
event at "חיוב אגרה", the final step of every measured variant. They aren't
waiting on her. They finished and were never closed, the oldest for 292 days.

- The queue now says so: "השלב האחרון בוצע · ממתין לסגירת התיק".
- The head gets it as a finding: "9 תיקים שסיימו את כל השלבים ולא נסגרו".
- The final step is read from `process.model.variants[].sequence`, not
  hard-coded.

**Department picture.** "מה כל אחד עושה בפועל" is one row per person with
activity chips. It used to show Michal four times in a row.

**Empty task list.** It no longer says "פריט אחד" and "הכל מטופל" at the same
time.

**Header.** The "מחובר/ת · role" pill is removed; the user chip in the top bar
and the side rail already show it.

**A rendering bug in `mixed()` (`ui.js`).** The helper wrapped every Latin run
in an LTR span, including the `quot` inside `&quot;`. Any text with a quote,
apostrophe, `<` or `&` showed raw entities. The regex now skips anything right
after `&`, `#` or a word character.

### 4. Hebrew copy

| Before | After | Where |
|---|---|---|
| צוואר הבקוק / צוואר בקוק | צוואר הבקבוק | landing, home, picture, flow |
| חריגים מול SLA 30 יום | חורגים מיעד של 30 ימים | head and coordinator blocks |
| p90 18 / p90 · 35 יום | 90% עד 18 ימים / 90% מהתיקים עד 35 ימים | histogram, picture, evidence |
| ב-POC … / עודכן … · POC | בהדגמה הזו … / נכון ל־… · גרסת הדגמה | approval note, consent sheet, landing |
| התהליך זוהה מלוג התיקים | מיומן התיקים | picture |
| המתנה 1 ימים | המתנה של יום | flow |
| בקשת מסמכים ממתין חציון של 10 ימים מרגע היצירה… | בשלב "בקשת מסמכים" תיק ממתין בחציון 10 ימים (19 מקרים), כלומר 38% מ־26 הימים שתיק נמשך בחציון. | automation rationale |
| אשר שהתהליך הזה נכון | אישור התהליך כפי שנמדד | picture button |
| 12 משקי בית לא ניתנים להכרעה (contradicts the 6 elsewhere) | ל־12 משקי בית אין נתון הכנסה, ובחלקם זה מונע הכרעה בזכאות | sources |
| השדה income_band · נגזר מטיפוס household | השדה: רמת הכנסה של משק הבית · נגזר מהמודל של משק בית | sources |
| מסעדה השכונה, קונדיטוריה הוותיק | מסעדת השכונה, קונדיטוריית הכיכר | fixture business names (construct state; the random draws are unchanged, so every other number is identical) |

One test assertion moves with the business names: `'מאפייה השכונה'` becomes
`'מאפיית השכונה'`.

## Files

| File | Change |
|---|---|
| `src/value/rights.ts`, `meetings.ts`, `api.ts` | new: the two engines and their HTTP routes |
| `src/web/value.js`, `value.css` | new: the two pages, the home strip and their styles (all classes `v-*`) |
| `tests/value.test.ts` | new: 6 tests covering name gating, suppression, the zero-rows-to-model claim, letter language, extraction and task creation |
| `src/server.ts` | 2 lines: import, and routing `/api/rights` and `/api/meetings` before the 404 |
| `src/web/home.js` | nav routes, landing data, home strip slot, button text |
| `src/web/ui.js` | two nav entries and roles, the `mixed()` fix |
| `src/web/views.js` | `homeView` slot, head and coordinator blocks, landing, grouping by person, copy |
| `src/web/index.html` | one stylesheet link |
| `src/ontology/packs/00-core.json` | two decision kinds: `outreach_approved`, `meeting_tasks_created` |
| `src/process/discover.ts`, `src/research/sources.ts`, `src/cloud/fixtures.ts` | copy only |

## Screens

The app exposes the guided scenarios through the **סיור** button in the top bar
(and **סיור מודרך** on the landing page). Scenario 1 opens Hila's rights page
and the first letter; scenario 2 opens Dana's meetings page.

- `screens/before/` and `screens/after/`: landing, the head's home, Michal's
  home and Hila's home side by side; plus every new page and mobile.
- `screens/flows/`, in order:
  1. Hila opens the letter.
  2. She sends it.
  3. Dana opens a decision's source line.
  4. Dana searches what was decided about inspection scheduling.
  5. Dana confirms the task list.
  6. The tasks are created.
  7. Amir's home shows his task.
  8. Dana's "החלטות אחרונות" shows both new decisions with names.

## Limits and notes for DeepSeek

- **State is in memory**, like the connector toggles. Outreach, assignments and
  tasks reset when the server restarts.
- **The arnona billing flag is synthetic.** It is derived from the household id
  so it doesn't disturb the fixture's random stream, and it lives outside the
  graph, so the README's model counts are unchanged.
- **Meeting minutes live in `meetings.ts`, not in the SharePoint fixture.**
  Moving them into the drive would change the document counts and the
  source-viewer tests. Worth doing later, so the minutes show up under "הצגת
  המקור".
- **Nothing is sent.** The letter and the tasks are recorded decisions. As
  elsewhere in the POC, nothing is written back to billing, mail or calendars.
- **Roles.** The nav adds `rights` for the head, secretary and treasury, and
  `meetings` for everyone except treasury.

## Applied since: palette and simplification (18 Oct, 01:20–02:00)

The patch above is applied. Two changes were made directly in the repo after
it. They aren't in `value-pages.patch`.

1. **Palette: civic signage.**
   - Every hard-coded color in `home.css` moved onto tokens first. That step
     was verified pixel for pixel: 0.000% change on all 18 screens.
   - Then the token block was swapped. All 24 text pairs pass WCAG AA. The
     old muted gray failed: 4.04–4.49 against its backgrounds.
   - See `docs/UX.md` → Visual system.
2. **Less text, one fold for the reasoning.** Words per page, before → after:

   | Page | Before | After |
   |---|---|---|
   | Landing | 266 | 136 |
   | Head's home | 370 | 170 |
   | Rights (Hila) | 654 | 207 |
   | Decisions | 362 | 225 |
   | Department picture | 764 | 260 |
   | Meetings | 455 | 348 |

   The department picture went from 2,666px to 989px tall. Formulas,
   assumptions, the data boundary and the org map now sit in a closed "איך זה
   חושב" fold. Automations appear once, in the decision queue. A decision
   appears once on the meetings page. The rules are in `docs/UX.md` → "Less
   than what it replaces".

`screens/after/` and `screens/flows/` were refreshed on 18 Oct after both
changes. `screens/before/` is kept as the historical pre-value-pages state.
