---
name: "Municipal workspace"
description: "Hebrew-first municipal workbench using the adopted AKA kit."
colors:
  accent: "#1977cc"
  accent-hover: "#10599c"
  accent-soft: "#f0f7ff"
  paper: "#FFFFFF"
  quiet: "#F8FAFC"
  ink: "#0E131C"
  secondary: "#5A6879"
  line: "#E4EBF2"
  line-strong: "#9AA6B5"
  warning: "#8A5716"
  success: "#1F7A54"
  success-soft: "#DDEBE3"
  error: "#B33A19"
typography:
  headline:
    fontFamily: "\"Heebo\", \"Assistant\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans Hebrew\", Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.025em"
  title:
    fontFamily: "\"Heebo\", \"Assistant\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans Hebrew\", Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.015em"
  body:
    fontFamily: "\"Heebo\", \"Assistant\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans Hebrew\", Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "\"Heebo\", \"Assistant\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans Hebrew\", Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.4
  grid:
    fontFamily: "\"Heebo\", \"Assistant\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "12px"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 13px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 13px"
  button-text:
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 3px"
  search:
    backgroundColor: "{colors.quiet}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
    height: "38px"
    padding: "0 12px"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "11px 13px"
  status-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.paper}"
    rounded: "{rounded.xs}"
    padding: "2px 7px"
  work-surface:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  grid-row-desktop:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.grid}"
    height: "40px"
  grid-row-compact:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.grid}"
    height: "60px"
---

# Design System: Municipal workspace

## Overview

**Creative North Star: "Operational white workbench"**

An operational white workbench for municipal staff: dense records, a quiet navigation rail, compact controls and contextual actions. Hebrew RTL and a shared record identity connect work, organisational memory and workflows.

The implementation adopts AKA theme revision `776496e`, with native-DOM adaptations and workspace-specific typography and layout. This file describes reused styles in the current code; provenance, the direction contract and demo boundaries remain in [docs/WORKSPACE-UX.md](docs/WORKSPACE-UX.md). [docs/DESIGN.md](docs/DESIGN.md) remains the separate product/architecture brief.

**Key Characteristics:**

- White work surfaces and a quiet navigation rail.
- Hebrew-first native typography and tabular operational numbers.
- Real AG Grid tables, semantic flags and contextual record details.

## Colors

### Primary

Blue accent identifies primary actions, links, active navigation, selected rows and keyboard focus. The deeper accent is the primary hover state; the pale accent is a selection wash.

### Secondary

Warning brown fills compact blocker flags with white text and marks unresolved facts. Success green marks verified actions, including closed requests and completed workflow steps; its soft background supports completed workflow markers. Error red identifies errors and failed notices.

**The Semantic Status Rule.** Use neutral dots for routine or ready states, labelled warning flags for blockers, green for verified actions, and blue for actions, selection and investigation.

### Neutral

Paper serves both canvas and work surfaces. Quiet separates the rail, grid headers and supporting bands. Ink carries primary content; secondary serves supporting text, including the workspace's muted alias. Default lines divide records and surfaces; strong lines define controls and resizing handles. Sidecar tonal ramps are synthesized panel previews, not additional shipped palette tokens.

## Typography

All page roles use the frontmatter's Hebrew-first native stack. Heebo and Assistant are preferred when installed; the entry document loads no webfonts. The grid uses the narrower stack recorded under `typography.grid`. Imported Outfit/display tokens are not the workspace font system.

- Page heading: headline role; mobile reduces it to (24px).
- Section heading: title role; mobile work-surface headings reduce to (16px). Inspector titles use (20px), rising to (22px) on mobile.
- Body: body role; supporting descriptions commonly use (13px).
- Buttons: label role. Grid cells use (12px); grid headers use (11px, weight 500). Status labels use (11px).
- Record totals use (30px, weight 550) with tabular numerals. Monetary and quantity columns also use tabular numerals; source IDs use bidi isolation where needed.

## Layout

The desktop shell has a right-hand rail (192px) and a flexible work area. The top bar is at least (76px) high; page padding is (36px 36px 56px). One dominant table or map anchors the vertical task flow. The inspector is sticky with its own vertical scroll, (370px) wide, reducing to (350px) at the 1250px breakpoint.

**The Contextual Records Rule.** Open the same record beside the current task; on smaller screens, present its details as a modal inspector.

- At widths up to (1250px), the rail becomes (180px), page padding becomes (28px 24px 40px), and supporting columns collapse as space requires.
- At widths up to (1200px), workflow steps and their selected detail stack vertically. Above this, the vertical step sequence is on the left and its detail on the right.
- At widths up to (1000px), the inspector becomes a fixed modal drawer (400px maximum viewport width), the task behind it dims, and background controls become inert. Maps stack above their route list.
- At widths up to (700px), navigation becomes a top strip, page padding becomes (24px 16px 40px), and the inspector fills the viewport. Settlement and request grids use condensed two-column layouts with (60px) rows; desktop rows are (40px). Settlement identity and amount share a cell beside status; request identity and location share a cell beside status. The access matrix retains its desktop columns and row density.
- At widths from (1600px), page inline padding becomes (48px) and primary content without an inspector is capped at (1440px).

Spacing uses the recorded small increments alongside component-specific measurements; this is not a uniform grid. AG Grid uses auto height so its rows participate in the page's vertical flow.

The workflow inspector is the selected step detail on the right of its vertical sequence at wide widths. The separate record inspector opens at inline end (physical left in RTL), matching the existing direction contract and desktop capture.

## Elevation & Depth

Work surfaces and desktop record details are flat, separated by borders and quiet tonal bands. Search results, small-screen inspectors and notices use diffuse shadows; their exact implemented values are in the sidecar. Imported AKA elevation tokens that these surfaces do not consume are not adopted here. Grid row animation is disabled; the reduced-motion query removes transitions and animations.

## Shapes

Controls and navigation use modest corners (6px); work surfaces use (10px); warning flags and small counters use (4px). Fine one-pixel borders carry structure. Small circular dots signal status; circular step markers carry sequence or completion. The inspector's structure follows the viewport rather than a floating card silhouette.

## Components

- **Buttons:** primary blue with white text, secondary white with a strong border, and blue text actions. Primary/secondary minimum height is (37px), increasing to (40px) on mobile; record primary actions reach (44px). Primary hover deepens blue; secondary hover uses quiet fill. Disabled primary buttons use a muted gray fill. Global keyboard focus is a blue outline (2px) offset by (3px).
- **Search and fields:** global search has quiet fill, a fine border and (38px) height, reducing to (35px) on mobile. Focus within changes the border to blue with a pale outline. Resolution inputs are white, strongly bordered and (38px) high; validation messages use error red.
- **Navigation and filters:** the rail highlights the current page with pale blue and blue text; work tabs use a blue underline. Segmented filters use a neutral selected fill with a stronger label and expose pressed state. The role select stays explicitly labelled as simulation.
- **Status flags:** warning states are filled labelled badges; routine/ready, verified/closed and investigation states retain the AKA dot-and-label pattern. Routine and ready states are intentionally neutral; green marks verified actions. The warning variant hides its dot. Status meaning remains in text.
- **Containers:** white, bordered work surfaces hold heading, progress, tools, grid and footer in sequence. Resolution forms use a stronger border. Memory entries use dividing lines; workflow details use a bordered container and a connected vertical step sequence with selectable details.
- **Operational grids:** actual AG Grid Community with Quartz parameters from AKA, RTL, (35px) headers, (12px) horizontal cell padding, sortable/filterable/resizable columns and quick search. Desktop settlement identity is pinned right; mobile settlement and request columns are condensed. Grid state is retained in memory separately by view and density. Rows open records by click or Enter; explicit record buttons remain keyboard reachable.
- **Communication:** a quiet personal-attention entry in the top bar opens a flat list of approvals, mentions and followed updates. Record conversations use the shared inspector; forms stay white, use native Hebrew typography and explicitly name recipients. Replies and decisions have distinct controls.
- **Inspector:** record heading, detail/source/conversation/activity/access tabs, facts, evidence and contextual actions share one record identity. Modal mode traps Tab, Escape closes, and opening focuses the record title; closing attempts to restore the trigger. Tabs support RTL arrow keys, Home and End.

## Do's and Don'ts

- Do use the adopted AKA semantic colors and the implemented Hebrew-first stack.
- Do retain the compact identity, amount and status presentation for mobile settlement rows.
- Do keep record actions, source evidence and history in their record context.
- Do preserve visible keyboard focus, labelled statuses and reduced-motion behavior.
