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
- Reset before each run: the ↺ button at the top left. The day returns to
  07:05 on Sunday.

## What is real and what is staged

| On screen | Source |
|---|---|
| 710 weekly trips, stops, times, planned students, schools | The council's workbook (sheet "סידור נסיעות", every trip traced to its row) |
| "Needs review" flags (unverified counts, stops to clarify) | The workbook's own "לבדיקה" flags |
| Planned students above a bus's seats (6 Sunday trips) | Workbook seat counts for 8 routes; others say "לא ידוע" |
| Village locations | The council's public GIS (settlement midpoints) and Wikipedia; 3 places marked unknown |
| Road routes on the map | Google Routes API |
| Drivers, vehicles, plates, licence, test and service dates | **Demo data.** The workbook has no driver data. The real names and plates in it are not used. |
| Bus positions on the map | **Simulation** driven by the demo clock, labelled "סימולציה · אין GPS" |
| Route 10 (trip 10-1) | Driven live from the phone during the demo |

## Run of show (about 12 minutes)

1. **The morning, at 07:05** (עכשיו).
   - Seven buses are already moving across the Golan, each on its real road.
   - Four numbers at the top, and a short "דורש טיפול" list: one line per
     cause, not one per trip.
   - Say: "This is the workbook you use today, read as a live picture."
2. **What the system caught before the morning started.**
   - Bus 14's test expired on 6.11 and blocks 3 trips. Driver Yossi Hazan's
     licence expired and blocks 4.
   - Six trips are planned for more students than their bus has seats. That
     comes from your own file.
   - Click the bus-14 alert to open the fleet page, with the row highlighted.
3. **Fixing it** (סידור).
   - Open 14-1, pick "אוטובוס חלופי", save the assignment, then "פרסום לנהג".
   - The alert no longer lists 14-1.
   - Point out the rule: nothing reaches a driver until it's ready and
     published.
4. **The driver's morning.** The phone on the right is David Mizrahi, route 10.
   - Open 07:10, Avital – Merom Golan.
   - "התחלת נסיעה" is disabled until "the bus is stopped safely" is ticked.
     That's the brief's safety rule, and the server enforces it too.
   - At Ramat Trump, 15 are expected. Report 15 and depart.
   - At Kela Alon, 32 are expected. Press − twice and report **30**.
   - On the left, the top alert immediately reads "10-1: עלו 30 במקום 32 · 2
     חסרים", and the "תלמידים עלו" count shows 2 missing.
5. **No reception.**
   - Tick "ללא קליטה" above the phone and report the school drop-off. The
     phone keeps going and says the report is saved on the device. The
     dashboard doesn't change.
   - Untick it, and the report arrives within seconds.
6. **Time moves** (▶ or +5 דק׳).
   - Buses arrive and turn grey, and 12-1 shows as 8 minutes late.
   - Click a bus to see its stops: planned against reported, marked "דיווח
     נהג" or "סימולציה".
7. **Close on what we need from them** (below).

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
