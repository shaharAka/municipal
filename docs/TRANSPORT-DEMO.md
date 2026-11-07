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

## What is real and what is staged

| On screen | Source |
|---|---|
| 710 weekly trips, stops, times, planned students, schools | The council's workbook (sheet "סידור נסיעות", every trip traced to its row) |
| "Needs review" flags (unverified counts, stops to clarify) | The workbook's own "לבדיקה" flags |
| Planned students above a bus's seats (6 Sunday trips) | Workbook seat counts for 8 routes; others say "לא ידוע" |
| Village locations | The council's public GIS (settlement midpoints) and Wikipedia; 3 places marked unknown |
| Road routes on the map | Google Routes API |
| Drivers, vehicles, plates, licence, test and service dates | **Demo data.** The workbook has no driver data. The real names and plates in it are not used. |
| Bus positions on the map | **Simulation** driven by the demo clock; the ride's map tab says "לפי לוח הזמנים (עד לחיבור GPS)" |
| Route 10 (trip 10-1) | Driven live from the phone during the demo |

## Run of show (about 12 minutes)

The tour ("הבריף: 9 הנקודות") walks the same path and highlights each point; use
it, or drive by hand as below.

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
4. **בניית סידור.** Say: "the rides are already here, from your file; we only handle exceptions."
   - "סידור קבוע": every route from the workbook with its regular driver and bus.
     Bus 14 is red (expired test): click the bus chip, pick "אוטובוס חלופי", and route 14
     runs on it every day from now on (undo in the toast).
   - "חודש": each school day and how many rides lack a crew that can run them.
   - "יום" (tomorrow): only the rides that need a crew. Each row has a driver chip and a
     bus chip; clicking shows who is free at that hour, the rest with the reason ("בכל
     זאת" after a confirmation). "שיבוץ אוטומטי" fills what it can as drafts (one undo).
     The bar says how many changes, that only those drivers are notified, and "פרסום
     לנהגים" (or P) sends them.
   - On נהגים, add an absence for David Mizrahi on Tuesday with Ron Almog as the
     substitute: his Tuesday rides move to Ron as drafts.
5. **The driver's morning.** Turn on "טלפון הנהג על המסך": David Mizrahi,
   route 10.
   - "הנסיעה הבאה 07:10" (or "באיחור N דק׳"), "לנסיעה", one stop per screen. The count
     starts empty: he taps "עלו 15, כמתוכנן" or adjusts with + and −; the slide stays
     locked until he has counted.
   - He slides "עלו 15 · יציאה מהתחנה" ("מחליקים רק כשהרכב עומד"); the server
     refuses any report without that slide.
   - At Kela Alon, press − twice and slide: on the board, "קו 10: עלו 30 במקום
     32 · 2 חסרים" goes to the top.
   - Send him a note from the ride ("הודעה לנהג"): a badge on his "הודעות".
6. **No reception.** "הטלפון בלי קליטה": the phone shows "אין שירות", reports
   are saved on the phone and arrive when reception returns.
7. **נהגים** and **רכבים.** Licence, test and service dates, fit for duty / available
   for assignment, "רק מה שפג או עומד לפוג"; click a date to update it (with undo).
8. **Close on what we need from them** (below).

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
