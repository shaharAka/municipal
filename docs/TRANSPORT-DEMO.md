# School transport demo: Golan Regional Council

For the Sunday 8 Nov 2026 meeting with Tzachi Buchnik, Shuki and Inbal.
Built from Neri's product brief and the council's own workbook
(`סידור מקור תשפז 2026-2027`).

## Run it

```bash
npm run dev
```

- Dispatchers: <http://127.0.0.1:4173/transport.html>
- Driver app on its own: <http://127.0.0.1:4173/driver.html?d=driver-10>
- On a real phone over the same Wi-Fi: run `HOST=0.0.0.0 npm run dev`, then
  open `http://<laptop-ip>:4173/driver.html?d=driver-10` on the phone.
- Reset before each run: the sliders button at the bottom of the sidebar, then
  "איפוס" twice. The day returns to 07:05 and fleet edits are undone. The same
  menu holds **"הבריף: 9 הנקודות"** (a guided tour, below), the colour theme, the
  clock (▶, +5 דק׳), the driver's phone (off until you turn it on), "הטלפון בלי
  קליטה", and who is signed in.
- Shortcuts: ⌘K or / search, M live map, A planning assistant, ? help, Esc close.
- The laptop needs internet: Google Maps, and the tables (AG Grid Community
  33.2.4 from jsDelivr, the version Omni's kit uses).
- The assistant reads requests with Claude when `ANTHROPIC_API_KEY` is in
  `.env.local` (Claude Opus 5.5, structured output, server-side fallback on).
  Without a key it uses built-in rules for the same requests. Either way it only
  proposes; nothing changes until someone presses "אישור והחלה".
- The screens carry no "demo" or "simulation" labels. Say it once, out loud: bus
  positions follow the timetable until GPS is connected, and drivers and buses
  are made up.

## Online copy (GitHub Pages)

`https://shaharaka.github.io/municipal/` is a static copy for people to try on their own. The same
engine runs in the visitor's browser instead of on a server, so each visitor gets their own demo,
kept in that browser; the demo menu's reset starts it over. The dispatcher screen and the driver's
phone on the same page stay in step. It is rebuilt on every push to `design/shared-workspace`
(`.github/workflows/pages.yml`, `npm run build:pages`). Not in the online copy: the Claude-backed
reading of free text in the assistant (the built-in rules still work), and the live Google map
unless the repository has a `GOOGLE_MAPS_BROWSER_KEY` secret whose key allows `shaharaka.github.io`.

## What is real and what is staged

| On screen | Source |
|---|---|
| 710 weekly trips, stops, times, planned students, schools | The council's workbook (sheet "סידור נסיעות", every trip traced to its row) |
| "Needs review" flags (unverified counts, stops to clarify) | The workbook's own "לבדיקה" flags |
| Planned students above a bus's seats (6 Sunday trips) | Workbook seat counts for 8 routes; others say "לא ידוע" |
| Routes 16–18 already split on the demo morning | **Staged.** The demo starts as if Inbal split those overloaded rides yesterday (a second bus and driver that only work on Fridays), so the board opens with three problems: Yossi's licence, bus 14's test, and route 15, left open to show a split live. The workbook's numbers are unchanged. |
| Village locations | The council's public GIS (settlement midpoints) and Wikipedia; 3 places marked unknown |
| Road routes on the map | Google Routes API |
| Drivers, vehicles, plates, licence, test and service dates | **Demo data.** The workbook has no driver data. The real names and plates in it are not used. |
| Bus positions on the map | **Simulation** driven by the demo clock; the ride's map tab says "לפי לוח הזמנים (עד לחיבור GPS)" |
| Route 10 (trip 10-1) | Driven live from the phone during the demo |

## Run of show (about 12 minutes)

The tour ("הבריף: 9 הנקודות", in the demo menu, or press B) walks the brief point by point.
Each point has one to three scenes: the platform moves to the right screen, the rest of the
screen dims around the one thing to look at, and a card shows the point, the brief's own words
and what this screen answers. Next and Back (or the arrow keys) move scene by scene; the numbers
jump to a point; Esc closes. A link can open a point directly: `transport.html?tour=5` or
`?tour=5.3` (point 5, third scene). Use it, or drive by hand as below.

1. **נסיעות, 07:05.** A board, like a CRM pipeline: דורש טיפול, יוצאות בשעה
   הקרובה, בדרך, הגיעו. Say: "This is your workbook, read as a live picture."
   - Click any ride: one panel with the stops (planned against reported), the
     driver with a call button, the bus, and tabs for the map and activity.
   - "מפה חיה" (or M) opens every bus on the map; overlapping buses cluster.
2. **What needs them now.** The first column, ordered by risk to children:
   missing children first, then a bus that never came, then paperwork.
   - "להתקשר ל…" and "טופל" (with undo).
   - Bus 14's expired test and Yossi Hazan's expired licence are one card each,
     with "הצעה לתיקון".
3. **The assistant** (A, or "3 דברים לסדר לפני היציאה").
   - It lists one fix per cause with the reason ("הטסט של אוטובוס 14 פג ב־6.11.
     לאוטובוס החלופי 60 מקומות והוא פנוי בשעות האלה").
   - "אישור והחלה" swaps the bus in every trip and publishes to the drivers;
     the toast offers "ביטול".
   - Type "דוד מזרחי לא מגיע מחר": it moves his trips to a free driver, with
     the reason, for approval.
4. **סידור.** Say: "the rides are already here, from your file; you only handle what changed."
   - Tomorrow opens as "5 דברים לסדר מחר". Each card is a person or a bus first (Yossi Hazan,
     a red "רישיון פג"), then every free replacement, the recommended one tagged "מומלץ" and
     already selected, each with a one-line reason. Drivers or buses that don't fit sit under
     "הצגת כל הנהגים", greyed, with why.
   - "לכמה זמן?": "כל השבוע" is recommended, so one approval fixes Yossi's 15 rides on every day,
     not five times. "רק מחר" and "קבוע בקו 21" are the other two.
   - "אישור: רון אלמוג · 15 נסיעות" sends it; the toast says what changed and offers undo.
     "אישור כל ההמלצות" does every card at once, with one undo.
   - Too many students and no bigger bus free: the card offers to split the ride, with the
     stops that move, the second bus and a free driver.
   - "משהו השתנה": David Mizrahi, Tuesday, sick. Before saving it says how many rides need a
     substitute; the planner then jumps to Tuesday.
   - "כל החודש": a calendar with a clear pill per day, problems that repeat every day said once
     above it, and who is out. "הסידור הקבוע": the source of truth, one row per route with its
     regular driver and bus as people, a status pill when one can't drive, and the days as a strip.
5. **Ron's phone** (open `driver.html?d=driver-spare` after step 4). "שיבוץ חדש · מחר · 4
   נסיעות", one slide confirms them all. "יש לי בעיה עם השיבוץ" offers four quick reasons, a
   note, or just "רק שיתקשרו אליי"; it lands on the board at once with a call button.
   "זמינות": a switch per day this week; turning one off asks why and tells the dispatcher.
6. **The driver's morning.** Turn on "טלפון הנהג על המסך": David Mizrahi,
   route 10.
   - "הנסיעה הבאה 07:10" (or "באיחור N דק׳"), "לנסיעה", one stop per screen. The count
     starts empty: he taps "עלו 15, כמתוכנן" or adjusts with + and −; the slide stays
     locked until he has counted.
   - He slides "עלו 15 · יציאה מהתחנה" ("מחליקים רק כשהרכב עומד"); the server
     refuses any report without that slide.
   - At Kela Alon, press − twice and slide: on the board, "קו 10: עלו 30 במקום
     32 · 2 חסרים" goes to the top.
   - Send him a note from the ride ("הודעה לנהג"): a badge on his "הודעות".
7. **No reception.** "הטלפון בלי קליטה": the phone shows "אין שירות", reports
   are saved on the phone and arrive when reception returns.
8. **נהגים** and **רכבים.** A directory: avatar, name and one status pill (זמין, רישיון פג,
   מחלה עד 10.11), filters for "דורשים טיפול" and "לא זמינים השבוע", and each record shows the
   week's rides and its absences.
9. **Close on what we need from them** (below).

## The month planner: user stories it answers

Each story is something Shuki or Inbal do in Excel today. "כל החודש" → click a day.

| Story | Where |
|---|---|
| Hanukkah: no school 7–14 December | Day panel → "אין הסעות ביום הזה", reason "חג", "עד תאריך". Grey in the calendar, one undo. |
| A school is on a trip on Thursday, no afternoon ride | Day panel → the school → "ביטול" → "צהריים" → "טיול". The drivers are told; "החזרה" puts them back. |
| Short day: a school finishes an hour early | Day panel → the school → "שינוי שעה" → "שעה מוקדם". Stops move with the departure. |
| A driver is on leave next week | Day panel → "נהג או רכב לא זמינים" (the same form as "משהו השתנה"). |
| What is different on this day from the regular schedule? | Day panel → "מה השתנה מהסידור הקבוע". |
| Change the driver or bus of one ride | Day panel → "כל הנסיעות, נסיעה־נסיעה". |
| Which days still need work this month? | The calendar: one pill per day, counted the same way as the planner ("5 בעיות"). |

Still open, to ask them: a driver's or a route's month at a glance, repeating changes ("every Friday"),
and publishing a whole week to the drivers at once.

## The brief's questions, answered from the workbook

| Question in the brief | What the file shows |
|---|---|
| How are routes, stops and daily schedules defined? | Schedule code = the physical bus; a trip = day + schedule code + trip number; stops in visit order with time and student count |
| Morning and afternoon lines? | Yes: "בוקר – איסוף" and "צהריים – פיזור", different every day; Friday has its own structure |
| Council drivers or contractors? | Both appear: a hired-buses sheet (שכור תשפ"ו) and operator names on Friday |
| Counts or specific students? | The cleaned sheets have counts only, and the demo stays with counts. One sheet holds parents' names and phones, and it is not loaded. |
| Who updates licences and vehicle tests? | Not in the file. The fleet screen shows what such a record needs. |

## Questions for Tzachi, Shuki and Inbal

1. Which GPS provider is on the buses, and does it have an API? The map is
   built to swap the simulation for real positions.
2. Who owns the driver and vehicle records today (licences, tests, service
   dates), the council or the contractors?
3. Do drivers have smartphones in the cab? Is reception a problem on specific
   routes?
4. Where is "ילקוט רועים"? And what are "תחנה לבירור" and "גנים דרום הגולן"?
   These three are the only places we couldn't locate.
5. What happens today when a count is short at a stop: who is called, and how
   fast?
