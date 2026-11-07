/**
 * The design language, as values. `docs/design/design-language.md` says how to use them;
 * `docs/design/studio-visual-language.md` is the look, and it now leads.
 *
 * Shahar, 7 Oct: "I don't like the kit so much. I think we have better UI elements in AKA Studio — cleaner and more
 * modern." So the look is Studio's **gen3 / Notebook**, read from its code (`fe-notebook`, `origin/main` @
 * `8634f4a9c`): Tailwind slate neutrals, Outfit everywhere at 12–14px, status as tinted pills, the AI in black. Our
 * structure and behaviour do not change (page frame, list and record pages, step rail, explain, manifest navigation,
 * one primary, RTL, i18n).
 *
 * **The owner's reference then moved four numbers and the nav marker.** 8 Oct, on the roles-and-permissions page: "I
 * added the html example more for the design, feel, style, colors as it is modern and clean and has the studio vibe."
 * Its values, measured from the rendered page rather than remembered, are in `roles-permissions-reference.md`: a
 * bluer canvas, rounder cards, fully-rounded buttons, a 26px page title, and a **tinted accent square** for the
 * active nav item instead of a block of orange. The shell, the navigation model, the grouping and the collapse
 * behaviour stay exactly as #230 left them: this is a token and component-geometry pass, not a redesign.
 *
 * **The secondary palette is the brand's, not Studio's.** 8 Oct, on the colours: "I was also looking at the color
 * palette you use aside from the main colors and I don't like them (you can look at aka-foods.com for the colors we
 * use)". aka-foods.com is behind a Cloudflare challenge, so the authority is the product that carries the palette:
 * **`~/Repositories/aka-foods-platform/app/globals.css`, `:root`** — the AKA brand tokens, the same palette the Trend
 * Book and Studio share, under the names below. Check that file, do not guess.
 *
 * | brand token | value | this file |
 * |---|---|---|
 * | `--aka-ink` / `--ink` | `#0E131C` | `text.primary`, `brand.navy` |
 * | `--ink-2` | `#222222` | the brand's second ink (open branches) |
 * | `--ink-3` | `#2B3C5C` | the brand's third ink (open branches) |
 * | `--aka-muted` / `--muted` | `#6B7A8C` | `entity.default`, charts (the brand's hex, unchanged) |
 * | the kit's deeper slate | `#5A6879` | `text.muted`, `text.secondary`, `text.tertiary`, `text.tableHeader` (AA at 12–14px) |
 * | `--muted-2` | `#9AA6B5` | `text.subtle`, `border.strong`, `utility.textDisabled` |
 * | `--aka-rule` / `--line-2` | `#EEF1F5` | `border.light/subtle/soft/divider/quiet`, `surface.quiet`, `utility.bgDisabled` |
 * | `--line` | `#E4EBF2` | `border.default`, `border.nav`, `surface.quietHover` |
 * | `--aka-panel` / `--paper` | `#F8FAFC` | `surface.subtle`, `surface.hover`, `surface.navHover` |
 * | `--paper-2` | `#EFF3F7` | `surface.active`, `surface.inset`, `surface.navIconHover` |
 * | `--ok` / `--ok-50` | `#1F7A54` on `#DDEBE3` | `status.success` |
 * | `--warn` / `--warn-50` | `#8A5716` on `#F0E2CB` | `status.warning` |
 * | `--err` / `--err-50` | `#B33A19` on `#F8DAD3` | `status.danger` |
 * | `--aka-blue` / `--blue` | `#1977CC` | `accent` (already the brand's; its hover/active steps stay) |
 * | `--aka-light-blue` | `#80C2EC` | `chart.blueLight` |
 * | `--aka-teal` / `--teal` | `#43CCC3` | `chart.teal`, `brand.teal` |
 * | `--aka-light-teal` | `#A1E5E1` | `chart.tealLight` |
 * | `--aka-orange` / `--orange` | `#FF6F3C` | `chart.orange`, `brand.orange` |
 * | `--aka-light-peach` | `#FFC5B1` | `chart.peach` |
 * | `--aka-ice-blue` / `--blue-50` | `#E0F4FC` | `brand.sky` |
 * | `--teal-50` | `#E0F6F5` | `brand.teal50`, `areaHue.make.tint` |
 * | `--orange-50` | `#FFEDE6` | `brand.orange50`, `areaHue.control.tint` |
 *
 * **20 Oct: the Warehouse direction is now the shared app baseline.** White canvas, quiet paper sidebar,
 * compact flat panels and controls, and a narrow navigation rail replace the earlier rounded-card geometry.
 * The brand palette, accessible muted ink, accent steps, AI black, and generic grey
 * ladder in `neutral` (a slate step the brand never names is left where it is rather than invented twice — it is in
 * this file, so it can still be changed in one place).
 *
 * Colour still means something, and only four things (design-language §1 says each one in full):
 * - accent (AKA blue): you — the one primary action, where you are, what you selected, focus. Also the **measure**: how
 *   sure Atlas is is a blue bar (`chart.blue`, `chart.blueLight` for the quiet step), because a measure is a series and
 *   not a status;
 * - ai (black): the AI — what it read, suggested or can do;
 * - status (the brand's ok / warn / err triad): state, as a tinted pill or a small dot;
 * - area hue (`areaHue`): what an area does to the food — make is teal, control is orange, every other area is grey.
 *   Decoration: a dot by an area's heading and a borderless tint behind a record's type mark, never a button, a
 *   selected state, a rail door or text, and never the only signal (the icon and the heading say the same).
 *
 * **Contrast, checked on every pair this slice touched** (WCAG 2.1, `sRGB`):
 * - ok `#1F7A54` on ok-50 `#DDEBE3` is **4.30:1** — below AA's 4.5 for text this size (12px/600 in a pill) and above
 *   the 3:1 large-text floor. It is the brand's own pair, so it ships as the brand's and the shortfall is reported
 *   (PR body) rather than silently darkened; ok on white is 5.29:1, which is the fallback if the owner wants AA.
 * - warn `#8A5716` on `#F0E2CB` is 4.76:1 (AA); err `#B33A19` on `#F8DAD3` is 4.51:1 (AA); each ink on white is
 *   6.08:1 and 5.94:1.
 * - muted: the brand's `#6B7A8C` is 4.39:1 on white and 3.87:1 on its own rule — under AA for the 12–14px words
 *   the interface actually sets in it (a column heading, a meta line, a footer total). It was reported and then
 *   **substituted for text only**: `mutedInk` `#5A6879` is white 5.69:1, paper `#F8FAFC` 5.44, paper-2 `#EFF3F7`
 *   5.10, rule `#EEF1F5` 5.02, `line` `#E4EBF2` 4.73 — AA on every surface. `aka.muted` keeps the brand's hex for
 *   `entity.default` and the charts, where it is a mark, not a sentence. A sentence that wants more weight than that
 *   uses `text.primary` (`#0E131C`, 18.61:1) or `colors.accent.onSoft` (6.64:1).
 * - subtle `#9AA6B5` on white is 2.47:1: placeholders, icons, separators and empty values only, never a sentence
 *   (unchanged rule, from the brand's `--muted-2`).
 * - The chart's light steps are marks, not text: light blue `#80C2EC` is 1.94:1 and teal `#43CCC3` 1.97:1 on white,
 *   under 1.4.11's 3:1 for a graphic that is the only way to read a value — which is why every point in `Chart` also
 *   prints its value as text, and why emphasis is the accent blue (4.61:1). Orange `#FF6F3C` on white is 2.77:1, the
 *   same kind of mark.
 * - Area hue, measured by `tokens.test.ts` from these values: the glyph on a tint is `text.quiet` (`--ink-3` `#2B3C5C`),
 *   9.81:1 on teal-50 `#E0F6F5` and 9.72:1 on orange-50 `#FFEDE6` (non-text needs 3:1, even AA text would pass); the
 *   tints themselves are 1.12:1 and 1.13:1 on white, and the heading dots 1.97:1 (teal) and 2.77:1 (orange): all
 *   decoration under 1.4.11, because the glyph's shape and the heading's words carry the meaning. That is why a hue
 *   is never the only signal, and why neither is ever used for text.
 * - `#27a4f5` (Studio's primary fill) stays for shapes that carry no text: the progress fill and the focus glow.
 *   Text and fills use the brand's `#1977cc` (4.61:1); hover and pressed use `#10599c` (7.16:1).
 *
 * Deprecated aliases (`neutral.studio`, `brand.purple*`, `accent.dark|light|borderSoft`) point at the current values
 * so open branches keep compiling; new code uses the semantic names.
 *
 * This is the only file in web/ allowed to contain hex colours (eslint `no-restricted-syntax`).
 * Every token is also published as a CSS variable (cssVariables.ts) and generates the Tailwind theme
 * (tailwindTheme.ts → theme.generated.css), so the kit's classes and the CSS variables read the same values.
 */

/**
 * The brand's own neutrals, hex for hex from `aka-foods-platform/app/globals.css` `:root` (the token name is in the
 * comment beside each). These are the values the secondary palette below is built from; nothing here is a choice of
 * ours.
 */
const aka = {
  /** `--aka-ink` / `--ink` */
  ink: '#0E131C',
  /** `--ink-2` */
  ink2: '#222222',
  /** `--ink-3` */
  ink3: '#2B3C5C',
  /** `--aka-muted` / `--muted` */
  muted: '#6B7A8C',
  /** `--muted-2` */
  muted2: '#9AA6B5',
  /** `--aka-rule` / `--line-2` — the brand's lighter rule, used for row separators and hover borders. */
  rule: '#EEF1F5',
  /** `--line` — the brand's frame hairline: the chrome, a sidebar's edge, a header's. */
  line: '#E4EBF2',
  /** `--aka-panel` / `--paper` — the brand's page background and its row hover. */
  paper: '#F8FAFC',
  /** `--paper-2` — the brand's selected/active fill. */
  paper2: '#EFF3F7',
  /** `--aka-white` */
  white: '#FFFFFF',
} as const;

/**
 * The kit's grey for words at 12–14px — a column heading, a meta line, a footer total. The brand's one muted
 * (`aka.muted`, `#6B7A8C`) is 4.39:1 on white and 3.87:1 on the brand's own rule, under AA's 4.5:1 for text that
 * small, so the roles that carry a **word** take this one step deeper slate and the brand's hex stays exactly where
 * the brand names it (`aka.muted`, `entity.default`, charts). On every surface the kit lands it on: white 5.69:1,
 * paper 5.44, paper-2 5.10, rule 5.02, `line` 4.73 — AA everywhere, and one value, not a special case per screen.
 */
const mutedInk = '#5A6879' as const;

/**
 * The brand's status pairs: an ink on its tint (`--ok`/`--ok-50`, `--warn`/`--warn-50`, `--err`/`--err-50`). The
 * brand names no border for a pill — its own pill is the tint with the ink on it — so `border` is the tint too.
 */
const akaStatus = {
  ok: { ink: '#1F7A54', tint: '#DDEBE3' },
  warn: { ink: '#8A5716', tint: '#F0E2CB' },
  err: { ink: '#B33A19', tint: '#F8DAD3' },
} as const;

/**
 * The brand's chart series, in the brand's own order: a hue and its light partner (`--aka-blue`/`--aka-light-blue`,
 * `--aka-teal`/`--aka-light-teal`, `--aka-orange`/`--aka-light-peach`). One series draws in `blue` with `blueLight`
 * as its quiet step; a second series is `teal`, a third `orange`, and their light partners are the same hues one step
 * quieter. A chart that needs a fourth series gets a token here, not a hex in a component.
 */
const akaChart = {
  blue: '#1977CC',
  blueLight: '#80C2EC',
  teal: '#43CCC3',
  tealLight: '#A1E5E1',
  orange: '#FF6F3C',
  peach: '#FFC5B1',
} as const;

// Tailwind slate, Studio's whole neutral scale (`theme/tokens.ts` `neutral`, and the two most-used colours in gen3).
// **Kept deliberately** (§ Colour): a grey the brand does not name is left as it was rather than re-invented, and it
// lives only here, so it is still one edit away. No semantic role below points at it: every role that needs a grey
// takes the brand's (ink, muted, muted-2, rule, line, paper, paper-2). What still reads this ladder is nothing — it
// stays for the classes `ink-*` an open branch may hold, and for the next step a real design asks for, named in one
// place instead of written into a component.
const ink = {
  0: '#ffffff',
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const;

// AKA blue. Studio's accent with its `dark` promoted: the fill and the text are the one that passes AA.
// The brand's blue is the same `#1977cc`; its soft/hover/active steps are the part the brand does not name, so they
// stay (the owner's approved reference).
const blue = {
  main: '#1977cc',
  hover: '#10599c',
  active: '#10599c',
  soft: '#f0f7ff',
  softHover: '#e3eff7',
  border: '#c8e1f5',
  text: '#1977cc',
  /** Text on `soft`: `#1977cc` on `#f0f7ff` is 4.27:1, which fails for small text (§2). */
  onSoft: '#10599c',
  /** Studio's `accent.main`, for shapes that carry no text (progress fill, focus glow). */
  bright: '#27a4f5',
  contrastText: '#ffffff',
} as const;

// The AI is black (Studio's AiActionButton), and its greys — its fills and hairline are the brand's neutrals now.
// Black is what says "this is the AI"; it needs no hue, and the brand names none for it.
const black = {
  main: '#000000',
  hover: '#1a1a1a',
  active: '#2a2a2a',
  soft: aka.rule,
  softHover: aka.line,
  border: aka.line,
  text: aka.ink,
  contrastText: '#ffffff',
} as const;

const brand = {
  blue: blue.main,
  /** aka-foods.com's sky, `--aka-ice-blue` / `--blue-50`. A brand value, not an interface surface (§7.5). */
  sky: '#e0f4fc',
  /** `--aka-orange` / `--orange`. */
  orange: akaChart.orange,
  /**
   * The brand's orange one step down (`--orange-2`). It was the active nav square's resting fill; the reference
   * replaced that square with the accent, so nothing in the kit uses this now; it is kept for open branches.
   */
  orangeStrong: '#E55A2A',
  /**
   * The orange **wash** a contaminant cell starts on, and the light end of its heat scale (#342, spec §7.6).
   *
   * Studio's own `#FFF1D3`, measured from its table rather than remembered. The brand does not name it — the
   * nearest light partner is `chart.peach` (`#FFC5B1`), which is a good deal hotter and would make every
   * contaminant column shout — so it is added here rather than approximated, which is what this file is for: a
   * colour the interface uses belongs where it can be changed in one place.
   */
  orangeWash: '#FFF1D3',
  /** `--aka-teal` / `--teal`. */
  teal: akaChart.teal,
  /** `--teal-50`: the brand's pale teal, hex for hex. A tint to sit behind a glyph; never text, never a button. */
  teal50: '#E0F6F5',
  /** `--orange-50`: the brand's pale orange, hex for hex. As `teal50`. */
  orange50: '#FFEDE6',
  /** `--ink`, the brand's ink. */
  navy: aka.ink,
} as const;

/**
 * Area hue (design-language §1): what an area does to the food. **Make** (Innovate, Products) is the brand's teal,
 * **control** (the Quality lab) its orange; an area that declares neither is grey. Which area has which is declared with
 * the area (`aka_new_platform/modules.py:AREAS[...]["hue"]`), not here — this is only what each hue looks like.
 *
 * `tint` is the borderless tile behind a record's type mark (the brand's `-50`, so the glyph in `text.quiet` passes
 * 3:1 with room to spare); `dot` is the 8px dot by an area's heading in Browse (the brand's full hue). Light teal is
 * deliberately not here: it is not a third family, and `chart.tealLight` stays a chart's quiet step.
 */
const areaHue = {
  make: { tint: brand.teal50, dot: brand.teal },
  control: { tint: brand.orange50, dot: brand.orange },
} as const;

/**
 * The status triads are the brand's (`--ok`/`--ok-50`, `--warn`/`--warn-50`, `--err`/`--err-50`): one ink, one tint,
 * and `border` is the tint because the brand names no third value — its own pill is a tint with the ink on it. `main`
 * and `text` are the same ink: the brand gives a status one colour, and a dot and a word in the same state should
 * not be two different greens.
 */
/** Solid badge pairs add clear attention without tinting the surrounding workspace. */
const status = {
  success: { main: akaStatus.ok.ink, text: akaStatus.ok.ink, soft: akaStatus.ok.tint, border: akaStatus.ok.tint, solid: '#087F5B', onSolid: '#FFFFFF' },
  warning: { main: akaStatus.warn.ink, text: akaStatus.warn.ink, soft: akaStatus.warn.tint, border: akaStatus.warn.tint, solid: '#FFD166', onSolid: '#553C00' },
  danger: { main: akaStatus.err.ink, text: akaStatus.err.ink, soft: akaStatus.err.tint, border: akaStatus.err.tint, solid: '#D92D20', onSolid: '#FFFFFF' },
  // Studio has a fifth blue here (`#2563eb`); we keep info as the accent, because a second near-identical blue
  // would mean nothing (design-language §1). The pair is 6.64:1.
  info: { main: blue.main, text: blue.onSoft, soft: blue.soft, border: blue.border },
  // The brand's quiet pair: its muted ink on its rule. `--muted` on `--aka-rule` is 3.87:1 — a neutral pill is a
  // label, not a sentence (design-language §1); text that must be read uses `text.primary`.
  neutral: { main: aka.muted2, text: aka.muted, soft: aka.rule, border: aka.line },
} as const;

export const tokens = {
  colors: {
    /** The brand's chart series (see `akaChart`): a hue and its light partner, in the brand's order. */
    chart: akaChart,
    /** What an area does to the food (see `areaHue`): a tint behind a type mark and a dot by a heading. Decoration only. */
    areaHue,
    /**
     * The Model surface's knowledge graph: one colour per **role** a record type plays, not one per type (a graph with
     * twenty-four hues says nothing). `surface/model/graphData.ts` assigns each type a role; this is what a role looks
     * like. Roles are drawn from what the brand already names — chart blue and teal, the status inks, the muted greys —
     * so chrome stays blue / ink / muted and **red is kept for the one thing that went wrong** (`alert`: an incident).
     * `sense` is the one hue the brand does not name; it is carried over from the classic graph (`--sense`) so what
     * people perceive keeps its own colour. The last four are the drawing's own: the links, the links of the focused
     * record, a hovered link, and the canvas.
     */
    graph: {
      accent: akaChart.blue,
      brand: akaChart.teal,
      material: akaStatus.warn.ink,
      supply: akaChart.orange,
      conform: akaStatus.ok.ink,
      sense: '#C45292',
      flow: aka.ink3,
      support: aka.muted,
      neutral: aka.muted2,
      alert: akaStatus.err.ink,
      /** What the organization has learned (an `insight`): black, because black is how the AI is marked (design-language §7). */
      learned: black.main,
      link: aka.muted,
      linkFocus: akaChart.blue,
      linkHover: aka.ink,
      canvas: aka.white,
    },
    neutral: {
      ...ink,
      /** @deprecated use colors.text / colors.border */
      studio: {
        textPrimary: aka.ink,
        textSecondary: aka.muted,
        textMuted: aka.muted2,
        border: aka.line,
        borderSoft: aka.rule,
      },
    },
    accent: {
      ...blue,
      /** @deprecated use accent.text */
      dark: blue.text,
      /** @deprecated use accent.soft */
      light: blue.soft,
      /** @deprecated use accent.border */
      borderSoft: blue.border,
    },
    ai: {
      ...black,
      /** A quiet wash for text the AI read or wrote, before a person confirms it. */
      wash: aka.paper2,
    },
    status: {
      // `live` (a state that is happening now) and `chart` (the colour a chart draws this state in) are the brand's
      // one ink for the state: the brand gives a status a single colour, so a live dot, a bar and a pill of the same
      // state cannot drift into three greens. `dark` was Studio's red-800; the brand has no darker err.
      success: { ...status.success, hover: status.success.text, bg: status.success.soft, live: status.success.main, chart: status.success.main },
      warning: { ...status.warning, hover: status.warning.text, bg: status.warning.soft, chart: status.warning.main },
      danger: { ...status.danger, hover: status.danger.text, bg: status.danger.soft, chart: status.danger.main, dark: status.danger.main },
      info: { ...status.info, hover: blue.hover, bg: status.info.soft, badge: blue.main, dark: blue.active, chart: blue.main, live: blue.main },
      neutral: status.neutral,
    },
    /** The brand, hex for hex from `aka-foods-platform/app/globals.css`. Blue is the accent; orange is where you are. */
    brand: {
      ...brand,
      /** @deprecated AI is colors.ai (black). */
      purpleText: black.text,
      /** @deprecated AI is colors.ai (black). */
      purpleBg: black.soft,
      /** @deprecated AI is colors.ai (black). */
      purpleBgLight: black.soft,
      /** @deprecated AI is colors.ai (black). */
      purpleBorder: black.border,
    },
    /** Entity marks are grey; the icon tells the kind, not a colour. The brand's muted. */
    entity: {
      default: aka.muted,
    },
    utility: {
      textDisabled: aka.muted2,
      bgDisabled: aka.rule,
    },
    surface: {
      /** Shared operational canvas: flat white, separated by fine borders rather than tinted cards. */
      canvas: aka.white,
      card: aka.white,
      /** A quiet neutral rail; the top bar stays white. */
      sidebar: aka.paper,
      /** The brand's page background (`--paper`), which is also what a row takes under the pointer. */
      subtle: aka.paper,
      hover: aka.paper,
      /** The brand's selected fill (`--paper-2`, its own `.nav-row.active`). */
      active: aka.paper2,
      elevated: aka.white,
      inset: aka.paper2,
      /** The whole active navigation row takes a quiet blue tint; icons remain unboxed. */
      navActive: blue.soft,
      /** A visible hover step on the quiet paper sidebar. */
      navHover: aka.paper2,
      /** The square behind a nav row's icon, under the pointer: one step deeper, `--paper-2`. */
      navIconHover: aka.paper2,
      /** The search trigger's grey pill (§7.15), and other quiet fills: the brand's rule, not a grey of ours. */
      quiet: aka.rule,
      quietHover: aka.line,
      /** A meter's or a bar's track, under the fill: the brand's frame hairline (`--line`). */
      track: aka.line,
      /** A control's resting fill — a switch that is off: the brand's mid grey (`--muted-2`, 2.47:1 on white). */
      control: aka.muted2,
    },
    border: {
      /** The brand's frame hairline (`--line`), which is what its own chrome and panels are drawn with. */
      default: aka.line,
      /** One step lighter (`--aka-rule` / `--line-2`), the brand's row separator. */
      light: aka.rule,
      subtle: aka.rule,
      soft: aka.rule,
      /** A border that has to read as a border: the brand's mid grey (`--muted-2`). */
      strong: aka.muted2,
      focus: blue.main,
      divider: aka.rule,
      /** The sidebar's and the top bar's hairline (§7.4): the brand's `--line`, as on its own chrome. */
      nav: aka.line,
      /** The omnibox field, its kbd chips and the assistant panel: the brand's lighter rule. */
      quiet: aka.rule,
    },
    text: {
      /** The brand's ink (`--aka-ink`). 18.61:1 on white. */
      primary: aka.ink,
      /** Secondary text: the kit's deeper slate (5.44:1 on paper, AA; see the contrast note above). */
      secondary: mutedInk,
      tertiary: mutedInk,
      /** Labels and meta (`mutedInk`, 5.44:1 on paper — AA at 12–14px, see the contrast note above). */
      muted: mutedInk,
      /** Placeholders, icons, separators and empty values only (`--muted-2`, 2.47:1 on white). */
      subtle: aka.muted2,
      /** A table's column headings: the kit's deeper slate, at 12px/500 on the header tint (5.02:1, AA). */
      tableHeader: mutedInk,
      /** kbd chips and text-only buttons: the brand's ink at its quiet end (`--ink-3`). */
      quiet: aka.ink3,
      /** The active nav item's label and icon: the accent, as in the reference's rail (§7.12). */
      navActive: blue.text,
      inverse: aka.white,
      accent: blue.text,
      link: blue.text,
      error: status.danger.text,
      success: status.success.text,
      warning: status.warning.text,
    },
    overlay: {
      backdrop: 'rgba(82, 90, 106, 0.4)',
    },
    scrollbar: {
      /** The brand's mid grey, so the scrollbar is a brand value too. */
      thumb: aka.muted2,
      thumbHover: aka.muted,
    },
  },
  radius: {
    none: '0px',
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
    /** Text fields, selects, checkboxes: a field is not a pill. Studio's `radius.sm`, 109 uses in gen3 (§7.6). */
    control: '6px',
    /** Compact panels, tables, cards and callouts share the control radius. */
    panel: '6px',
    /** Dialogs and drawers. */
    dialog: '16px',
    /** The omnibox field, a tooltip, and a square icon button (`AiSendButton` is 32px; 999 would make it a circle). */
    action: '6px',
    /** Ordinary actions share the compact field geometry. */
    button: '6px',
    /** Tags, filter chips, counts. */
    chip: '4px',
  },
  // Ordinary content is flat; elevation is reserved for floating surfaces.
  elevation: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    card: 'none',
    /** The page header's type tile: the same material as a card, since the sky band behind it is gone (§7.5). */
    tile: 'none',
    popover: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    modal: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
    /**
     * The assistant's panel, which floats beside the page as a rounded card (owner, 12 Oct): the reference card's blue-tinted
     * softness at a larger radius of blur, so the card reads as lifted off the canvas rather than drawn on it, with a
     * tight contact shadow under it. A real shadow, for a thing that floats (design language §3).
     */
    panel: '0 12px 32px rgba(19, 58, 111, 0.12), 0 2px 6px rgba(19, 58, 111, 0.06)',
    /** The AI action's own shadow (Studio's `AiActionButton`): it lifts off the page it acts on. */
    ai: '0 8px 20px rgba(15, 23, 42, 0.16)',
    /**
     * The glow on a field that has focus (Studio's composer): the field also takes an accent border, so the glow
     * supports the border rather than being the only signal. Used inset on rows that cannot take an outline.
     */
    focusRing: '0 0 0 3px rgba(39, 164, 245, 0.25)',
    /**
     * @deprecated rows no longer lift on hover (§7.16: a flat `surface.hover` tint instead). Kept for open branches.
     */
    raised: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    /**
     * @deprecated buttons carry no shadow now: the secondary is a white button with an accent border (§7.9), the
     * primary a flat accent fill. Kept for open branches.
     */
    button: 'none',
    /** @deprecated see `button`. */
    buttonPrimary: 'none',
  },
  typography: {
    /** Outfit for everything, as in Studio (`theme/tokens.ts` `typography.fontFamily`, `App.css`). */
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Hebrew', sans-serif",
    /** Kept as its own name because `font-display` reads it; it is the same Outfit stack — Outfit is the display face. */
    displayFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Hebrew', sans-serif",
    /** Outfit has no Hebrew, so a Hebrew glyph falls through to the system's Noto Sans Hebrew (#106). */
    monoFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
    // Studio's scale (§1), with the reference's two title steps folded in. 12 and 13 dominate in gen3; 11 is pills and
    // small-caps labels only.
    fontSize: {
      xs: '11px',
      sm: '12px',
      md: '13px',
      base: '14px',
      lg: '16px',
      /** A section title: the reference's 17px/600. */
      xl: '17px',
      /** A page title: the reference's 26px/600. */
      '2xl': '26px',
      '3xl': '32px',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.4,
      relaxed: 1.5,
      loose: 1.6,
    },
    letterSpacing: {
      /** The reference's page title: −0.26px, which is this at the 26px `2xl`. */
      title: '-0.01em',
      heading: '-0.01em',
      /** The small-caps kind label a card may carry (§7.22). */
      caps: '0.03em',
      normal: '0',
    },
  },
  motion: {
    duration: {
      fast: '120ms',
      normal: '200ms',
      slow: '300ms',
    },
    easing: {
      ease: 'ease',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  zIndex: {
    base: 0,
    raised: 1,
    sticky: 10,
    shell: 100,
    panel: 1100,
    drawer: 1200,
    modal: 1300,
    toast: 1400,
    tooltip: 1500,
  },
  /** Heights of things you press or type in. Studio's own field is 32px; the AI action is 32 / 40px (§4). */
  control: {
    xs: '32px',
    sm: '36px',
    md: '40px',
    lg: '44px',
  },
  layout: {
    /** Compact desktop navigation; collapse retains its established anchor and 64px rail. */
    sidebarWidth: '192px',
    sidebarCollapsed: '64px',
    /** @deprecated the rail became the sidebar */
    railWidth: '192px',
    /** Compact global search and assistant controls, with one fine lower border. */
    topBarHeight: '54px',
    /** A row in a table: denser than ours was, ~40px at `8px 12px` cells (§7.16). */
    rowHeight: '40px',
    /** A row on a settings page: a label, a line of help, a control. */
    settingRowHeight: '56px',
    /**
     * A status pill: 12px/600 with `4px 11px` padding, the reference's tag (23px tall). Ours also fits an icon and a
     * remove button, so it is the height the reference's padding produces rather than a number of our own.
     */
    tagHeight: '23px',
    /** Reading width: a document, a form, a conversation. */
    column: '760px',
    /** Detail pages: main column plus a side column. */
    page: '1120px',
    /** Lists and tables. */
    wide: '1280px',
    sideColumn: '320px',
    assistantWidth: '420px',
    /** The page keeps this width while the assistant pushes it; below it the assistant floats. */
    assistantPageMin: '640px',
    assistantGutter: '12px',
    assistantMin: '360px',
    assistantMax: '760px',
  },
} as const;

export type DesignTokens = typeof tokens;

/** Physical concept-render materials and studio lighting, never semantic UI/status colours. */
export const packagingRenderPalette = {
  stage: '#f0eeea', cocoa: '#755541', shell: '#e0dfd5', closure: '#242421',
  paper: '#dfd9cc', white: '#ffffff', heel: '#c5b79d', ambientGround: '#9d9284',
  keyLight: '#fff9ef', fillLight: '#e4ebff', exportInk: '#232323',
} as const;
