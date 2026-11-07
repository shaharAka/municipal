---
name: "Golan school transport"
description: "Calm, Hebrew-first screens for dispatchers who run school transport from a spreadsheet today, and a phone app for drivers."
colors:
  frame: "#1d2024"
  ink: "#1d2024"
  ink-2: "#3a3f47"
  muted: "#5c626b"
  faint: "#8a919b"
  bg: "#f4f5f6"
  surface: "#ffffff"
  surface-2: "#f9fafb"
  line: "#e3e6ea"
  line-2: "#cfd4da"
  primary: "#3557d8"
  primary-hover: "#2c4bc4"
  accent: "#3557d8"
  accent-text: "#2f4fc9"
  accent-soft: "#ebf0fd"
  hi: "#f28500"
  hi-soft: "#fff4e6"
  warn: "#9a4a00"
  warn-soft: "#fff4e6"
  bad: "#c8253a"
  bad-soft: "#fdeef0"
  ok: "#167349"
  ok-soft: "#e4f3ec"
typography:
  display:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.01em"
  panel-title:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  small:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  emphasis:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
  driver-caption:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
  driver-small:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  driver-secondary:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.35
  driver-body:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.35
  driver-title:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
  driver-large:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.15
  driver-hero:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.05
  driver-count:
    fontFamily: "\"IBM Plex Sans Hebrew\", \"Heebo\", -apple-system, \"Segoe UI\", Arial, sans-serif"
    fontSize: "84px"
    fontWeight: 700
    lineHeight: 1
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  2xl: "22px"
  full: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  top-bar:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.surface}"
    height: "56px"
  number-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.lg}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "14px"
  pill:
    backgroundColor: "{colors.pill-gray}"
    textColor: "#ffffff"
    typography: "{typography.small}"
    rounded: "{rounded.full}"
    height: "22px"
  grid-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    height: "48px"
---

# Design System: Golan school transport

## Overview

**North star: "Calmer than the spreadsheet."** The people who use this today run the
council's school transport from an Excel workbook and a phone. Every screen has to feel
easier than that workbook on the first morning: a few numbers, what needs them now, and
the map. Nothing that reads like a control room, and nothing that apologises for itself.

This replaces the old municipal workspace design (the AKA-kit blue workbench). That
design is not a reference for this product. [docs/DESIGN.md](docs/DESIGN.md) remains the
separate product and architecture brief. [docs/TRANSPORT-DEMO.md](docs/TRANSPORT-DEMO.md)
holds the demo run of show.

**Key characteristics**

- One question per screen. "נסיעות" answers "what needs me now"; "בניית סידור" answers "is
  tomorrow ready"; "נהגים" and "רכבים" answer "who and what is legal to drive".
- Plain Hebrew verbs on buttons ("להתקשר לדוד", "לתיקון בסידור", "טופל"), never jargon.
- Numbers first, tables second, settings last.
- Hebrew RTL throughout; tabular figures for every time and count.

## Colors

Every colour is a CSS custom property, and a theme is one block of them on
`<html data-theme>`. The roles are fixed; only the values change between themes.

| Role | Used for | Never used for |
|---|---|---|
| `frame` | the top bar | content |
| `primary` | the one action that matters on a card or form | decoration |
| `accent` | what is moving now: buses on the map, the route line, "בדרך" | warnings |
| `hi` | the selected row, the clock dot, the presenter's bus | large filled areas |
| `warn` | things to check: workbook notes, overlaps already in the council's file | anything on the road now |
| `bad` | children at risk: late, missing, not accounted for | anything else |
| `ok` | valid and published | "moving" |

**The single-red rule.** Red means a child may be at risk. A failed save is a red toast;
a status that is merely "not ready" is `warn`, never red.

**The no-block-of-orange rule.** The highlight colour stays small: a dot, an outline, a
tinted row. A large orange area next to the dark frame reads as a taxi app.

### Themes

| Theme | Frame | Leads | Highlight | Notes |
|---|---|---|---|---|
| `royal` (default) | charcoal | royal blue | tangerine | Blue leads; tangerine stays small. |
| `paper` | paper white | ink black for actions, cornflower for moving buses | deep cornflower | Light frame, the quietest option. |
| `flame` | jet black | jet black for buses and actions | flame orange | Buses in black so orange never meets the late-red. |
| `navy` | midnight navy | navy | coral | Soft-blue canvas. The late-red is a raspberry, so it doesn't read as coral. |

All themes keep body text at 4.5:1 or better on its own background. `faint` is for
icons and borders only, never for text a person must read.

## Typography

IBM Plex Sans Hebrew (400, 500, 600, 700) from Google Fonts, falling back to Heebo and the
system stack.

- Display (26px, 600): the big numbers on the landing tiles.
- Headline (22px, 600): the page title and the greeting.
- Panel title (19px, 600): the ride panel's and the assistant's heading.
- Title (16px, 600): card and section titles.
- Body (14px): everything else; alert titles go up to 15px.
- Label (13px, 500): buttons, chips, field labels.
- Emphasis (15px, 600): alert titles, the trip school name, the bigger figures in a row.
- Small (12px): pills, the line under a table, secondary detail.

The driver app has its own mobile scale, tuned for glare and a moving cab. It uses
caption 12, small 13, secondary 15, body 17, title 20, large title 32, the next-trip time
44, and the stop count 84.

No text below 12px. Weight steps are 400, 500 and 600; 700 only in the route code badge.

## Layout

Built like a modern CRM: rides are the records.

- **Shell:** a 236px sidebar (brand, search, נסיעות, בניית סידור, נהגים, רכבים, עוזר
  התכנון, the clock, the signed-in person, help, and the presenter menu) and the
  work area. There is no top bar.
- **נסיעות:** a page header (greeting, one meta line, one line saying the numbers follow
  the timetable unless marked "דיווח נהג"), then a board of four columns: דורש טיפול,
  יוצאות בשעה הקרובה (with a link to the rest of the day), בדרך, הגיעו (compact rows).
  A table view (AG Grid) is one toggle away.
- **Ride panel (inspector):** opens at the inline end over the work area, 460px, with
  tabs סקירה, מפה, שיבוץ ותחנות, פעילות; the sticky footer holds at most one primary
  action. Focus moves into it and back to the card on close.
- **Live map:** never the page. It opens full screen over the work area (button or M),
  fitted to the buses; overlapping buses become one round count.
- **בניית סידור:** one day at a time (tomorrow first). Rows are drivers or buses, the axis
  is the day, each trip a block showing its time. Drag a block to another row to
  reassign; drops are drafts until one publish bar sends them.
- **נהגים, רכבים:** one page each, a page header and one AG Grid filling the height.
- **Assistant:** a panel at the inline end, like the ride panel.
- **Driver app:** a phone layout with safe areas, one stop per screen, controls in the
  thumb zone, slide-to-confirm for anything that reports, and a count that starts empty.

## Elevation and depth

Flat by default: 1px lines and tonal surfaces (`bg` → `surface` → `surface-2`). Cards
carry a faint one-pixel shadow; popovers, the command bar and toasts use the larger shadow.
There are no gradients and no glass effects.

## Shapes

Radii come from one scale: 6px for keys and small badges, 8px for small buttons and
inputs, 10px for buttons and controls, 12px for cards, tiles, grids and the inspector,
16px for overlays, 22px for the phone's sheets and its "next trip" card, and full for
pills, avatars and anything round. The phone frame in the demo dock copies a real
device's radii and colours. It's presenter chrome and sits outside this scale. Borders are 1px. A card never gets a
coloured side stripe: state shows in the text, a pill, or a full hairline border in the
state's colour.

## Icons

There is one line set: 24px viewBox, 1.75 stroke, round caps and joins, `currentColor`.
Icons are monochrome. Severity comes from the glyph's colour, not from a tinted tile behind
it. The map hides Google's own pins and road shields. Buses and stops are our only
markers.

## Components

- **Plan block:** neutral grey with its time; red only when the trip cannot run or a move
  made it clash; amber when the council's own file has two trips at once; dashed while a
  change is not yet published.
- **Alert card:** a bold one-line title and a muted line of detail, then at most two
  buttons. One is the primary action (call the driver, or fix in the schedule) and the other
  is "טופל". "טופל" can be undone from the toast, and handled items collapse into "טופלו
  (N)".
- **Trip row:** the route code badge, the school, where the trip is now, and the count
  with a status pill. The badge is `accent` while the trip is moving, `bad` when it is late,
  and quiet otherwise.
- **Pills:** one word on a solid, saturated colour with white text, no pastels, so a
  status reads from across the room: `pill-info` teal for "בדרך", `pill-ok` green for
  "הגיעה" and "מומלץ", `pill-warn` orange for late, `pill-bad` red for "לא יצאה",
  "חסומה" and an expired licence or test, and `pill-gray` for not yet left. Every pill
  colour passes 4.5:1 with white. The page around pills stays neutral, so colour shows
  up only where it carries a status.
- **Options:** every problem lists all the free replacements as a radio list. The
  recommended one comes first, is pre-selected and tagged "מומלץ". Each option has one
  line of reasons with no full stop, built the same way so options can be compared. The
  ones that don't fit sit under "לא מתאימים כרגע" with the reason in red, and can still be
  chosen ("שיבוץ בכל זאת", after a confirm). The one primary button names the change:
  "אישור: רון אלמוג".
- **Grids:** AG Grid Community 33.2.4, Quartz theme on our tokens, RTL. Rows are 48px,
  or 56px with two lines. Clicking a row or pressing Enter opens the inspector. A date
  cell shows a badge only when the date needs attention.
- **The הדגמה menu:** the theme picker, the clock, the driver's phone, reception, who is
  signed in, and reset. These controls are for presenting and never appear in the
  product's own screens.

## Do's and don'ts

- Do put one primary action on a card. Everything else is secondary or ghost.
- Do write button labels as plain verbs in the user's words.
- Do lead a status line with what needs action, then the scope: "3 דברים דורשים טיפול ·
  18 בדרך".
- Do write a toast as what changed plus one action: "רון אלמוג שובץ ב־4 נסיעות · נשלח
  לנהגים · ביטול". Errors say what to do: "בחרו תאריך התחלה".
- Do keep counts and times in tabular figures.
- Don't add "demo", "simulation" or disclaimer text to the screens. The presenter says it
  once.
- Don't use coloured side stripes, gradient text, glass effects, or decorative colour
  blocks.
- Don't show more than one list at a time on the landing screen.
