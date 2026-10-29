# Fizlet: visual style guide

Preset: cyberpunk-tron · flat colors in the game layer (hard, unblurred shadows; the shadow angle is a brand token). Read by astro-base-engine; the site renders its own look.

> **Status: Proposed: awaiting owner approval.** The family rulebook (`dom-virus/brand/README.md`,
> §1) says that a brand without a visual guide proposes one from the shared system and asks before
> using it. This file writes down what the Fizlet site in `site/` already does. It invents no new
> look. Until the owner approves it, treat it as a description, not a rule. Any change to the
> values below goes to the owner first.

- **Brand level:** engine (rulebook §1). Sites: `fizlet.com` (preferred) or `fizlet.coded.design`.
  Today the site is at <https://coded-dot-design.github.io/fizlet/>.
- **Voice:** [`voice.md`](voice.md).
- **Sources, in order of authority:**
  1. The Board UI kit, the shared design system and the source of truth for every colour, key and
     motion: [`src/ui/board-ui.css`](../src/ui/board-ui.css), [`src/ui/tokens.json`](../src/ui/tokens.json)
     and the spec [`src/ui/BOARD-UI.md`](../src/ui/BOARD-UI.md).
  2. The site's page furniture: [`site/site.css`](../site/site.css) (header, footer, panels, type,
     diagrams).
  3. The page shell and the mark: [`site/layout.mjs`](../site/layout.mjs).
  4. The pages: [`site/pages/index.mjs`](../site/pages/index.mjs),
     [`site/pages/quick-start.mjs`](../site/pages/quick-start.mjs) and
     [`site/pages/not-found.mjs`](../site/pages/not-found.mjs). The live demo is
     [`site/demo.ts`](../site/demo.ts).
- If this file and the kit ever disagree, the kit wins. Fix this file.

---

## 1. The idea in one line

**Fizlet wears the Battlefield board.** Every page is a Board UI root (`<html class="bui">`,
`site/layout.mjs:59`). That puts the page on the same tokens, keys, stickers and cards as the DOM
Battlefield game board: neon faces on an ink rim, with hard bases straight below. `site/site.css`
adds only page furniture on top of the kit (`site/site.css:1-4`). This is the "cyberpunk meets Tron"
default from the rulebook (§2), in its newest form, which matches rulebook §9: the Fizlet site
"looks like the newest work (Battlefield's design and diagrams)".

## 2. Tokens

These are exact values, read from the files named in each `source`. The kit's tokens are given in
`u`: 1 `u` is `1px` on desktop, and on phones it is clamped to the viewport
(`src/ui/board-ui.css:13`, `src/ui/tokens.json:44`). The site's own furniture is in plain `px`.

```tokens
{
  "brand": "fizlet",
  "status": "proposed",
  "root": { "html": "<html lang=\"en\" class=\"bui\" data-theme=\"dark\">", "source": "site/layout.mjs:59" },
  "color": {
    "source": "src/ui/board-ui.css:14-64 (also src/ui/tokens.json:5-41)",
    "surfaces": {
      "bg":      { "var": "--bg",      "dark": "#07060f", "light": "#eef0fb" },
      "surface": { "var": "--surface", "dark": "#110d22", "light": "#ffffff" },
      "raised":  { "var": "--raised",  "dark": "#1d1738", "light": "#e6e4f8" },
      "card":    { "var": "--card",    "dark": "#120f26", "light": "#ffffff" },
      "ink":     { "var": "--ink",     "dark": "#f6f3ff", "light": "#1b1636" },
      "muted":   { "var": "--muted",   "dark": "#aea4d6", "light": "#5d5684" },
      "line":    { "var": "--line",    "dark": "#3b3170", "light": "#b9b2e3" },
      "rim":     { "var": "--rim",     "dark": "#07060f", "light": "#07060f", "note": "the same in both themes" }
    },
    "roles": {
      "sys":      { "var": "--k-sys",     "value": "#19f0ff", "job": "navigation, focus, links, code ink, the mark's grid" },
      "cmd":      { "var": "--k-cmd",     "value": "#9a63ff", "job": "lit panels, outline numerals, panel bases, Recall" },
      "fire":     { "var": "--k-fire",    "value": "#ff2b4e" },
      "aim":      { "var": "--k-aim",     "value": "#ff7389" },
      "attack":   { "var": "--k-attack",  "value": "#ff2e88", "job": "section-heading emphasis, Blast, Blitz, the mark's popping bubble" },
      "advance":  { "var": "--k-advance", "value": "#ff8a1f" },
      "fallin":   { "var": "--k-fallin",  "value": "#a8ff3e" },
      "flag":     { "var": "--k-flag",    "value": "#f6f3ff" },
      "go":       { "var": "--k-go",      "value": "#39ffb0", "job": "Start / Quick start, done, live LEDs" },
      "teamA":    { "var": "--team-a",    "value": "#39ffb0", "job": "hero emphasis, the mark's bubbles" },
      "teamB":    { "var": "--team-b",    "value": "#ff5c8f" },
      "hurt":     { "var": "--hurt",      "value": "#ffc21a", "job": "a long frame, 'partly done'" },
      "critical": { "var": "--critical",  "value": "#f0506e" }
    },
    "inks": {
      "sysInk":  { "var": "--k-sys-ink",  "dark": "#19f0ff", "light": "#0088b3" },
      "cmdInk":  { "var": "--k-cmd-ink",  "dark": "#b48cff", "light": "#6a3ae6" },
      "fireInk": { "var": "--k-fire-ink", "dark": "#ff2b4e", "light": "#d4143a" }
    },
    "site": {
      "source": "site/site.css:5-21",
      "base":   { "var": "--base",    "dark": "color-mix(in srgb, var(--k-cmd) 38%, var(--rim))", "light": "color-mix(in srgb, var(--k-cmd) 30%, var(--line))", "job": "a panel's hard base" },
      "grid":   { "var": "--grid",    "dark": "color-mix(in srgb, var(--k-sys) 9%, transparent)", "light": "color-mix(in srgb, var(--k-cmd) 9%, transparent)" },
      "codeBg": { "var": "--code-bg", "dark": "#0b0918", "light": "#f6f5fd" },
      "hl":     { "var": "--hl",      "dark": "var(--k-go)", "light": "#0e8a5f", "job": "live readouts (LAYOUT IN STEP, TESTED IN CHROMIUM)" },
      "themeColor": { "value": "#07060f", "source": "site/layout.mjs:66" }
    },
    "stickerKey": { "face": "#10233f", "icon": "#19f0ff", "border": "#f6f3ff", "source": "src/ui/board-ui.css:372-394" }
  },
  "font": {
    "sans": { "var": "--sans", "stack": "Inter, \"SF Pro Display\", \"Segoe UI\", system-ui, -apple-system, Arial, sans-serif", "source": "site/site.css:6", "use": "headings and body" },
    "mono": { "var": "--mono", "stack": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", "source": "site/site.css:7", "use": "labels, eyebrows, nav, numbers, code, wordmark" },
    "kitMono": { "stack": "ui-monospace, \"SFMono-Regular\", Menlo, monospace", "source": "src/ui/board-ui.css:50", "use": "every key, label and sticker" },
    "webfonts": "none loaded: system stacks only (site/layout.mjs:71-73 links no font files)",
    "body": { "value": "16px/1.6 var(--sans)", "source": "site/site.css:40" },
    "h1Hero": { "size": "clamp(52px, 7.4vw, 104px)", "lineHeight": 0.92, "tracking": "-0.05em", "source": "site/site.css:468-473" },
    "h2": { "size": "clamp(32px, 4.4vw, 54px)", "weight": 800, "lineHeight": 1.02, "tracking": "-0.035em", "source": "site/site.css:132-143" },
    "h3": { "size": "19px", "tracking": "-0.02em", "lineHeight": 1.2, "source": "site/site.css:144-148" },
    "lead": { "size": "18px", "lineHeight": 1.65, "maxWidth": "620px", "source": "site/site.css:154-160" },
    "eyebrow": { "value": "700 11px/1.4 var(--mono)", "tracking": "0.16em", "case": "uppercase", "source": "site/site.css:98-108" },
    "nav": { "value": "700 11px var(--mono)", "tracking": "0.14em", "case": "uppercase", "source": "site/site.css:255-263" },
    "code": { "value": "12.5px/1.6 var(--mono)", "phone": "11.5px", "source": "site/site.css:392-402, 1626-1628" },
    "statNumber": { "value": "800 32px/1 var(--mono)", "tracking": "-0.03em", "source": "site/site.css:1146-1149" },
    "kitKeyLabel": { "value": "700 12u mono", "source": "src/ui/BOARD-UI.md §4" }
  },
  "radius": {
    "source": "site/site.css (lines given) and src/ui/BOARD-UI.md §4",
    "panel": "14px (site.css:183)",
    "hint": "12px: install box, pipeline stage, quick-start step (site.css:507, 1219, 1442)",
    "code": "10px: code block, demo board, stats strip, phase row (site.css:400, 571, 707, 934)",
    "chip": "8px: size chip, nav link, skip link (site.css:1179, 262, 83)",
    "tag": "5-6px: brick tag, phase pill, section-number sticker (site.css:877, 1364, 121)",
    "kit": { "key": "6u", "arcade": "10u", "stickerKey": "12u", "card": "10u", "dock": "12u", "pill": "4-6u", "round": "50%" }
  },
  "shadow": {
    "rule": "hard and offset STRAIGHT BELOW (x = 0, blur = 0); never to the side",
    "panel": { "value": "0 6px 0 var(--base)", "source": "site/site.css:184" },
    "panelLit": { "dark": "0 6px 0 color-mix(in srgb, var(--k-cmd) 55%, var(--rim)), 0 0 28px color-mix(in srgb, var(--k-cmd) 22%, transparent)", "light": "0 6px 0 color-mix(in srgb, var(--k-cmd) 55%, var(--line))", "source": "site/site.css:186-192" },
    "card": { "value": "0 5px 0 var(--base)", "use": "pipeline stage, quick-start step", "source": "site/site.css:1220, 1443" },
    "install": { "value": "0 4px 0 var(--base)", "source": "site/site.css:508" },
    "chip": { "value": "0 3px 0 var(--base)", "source": "site/site.css:1180" },
    "sticker": { "value": "0 3px 0 var(--rim)", "use": "section number, brick tag", "source": "site/site.css:122, 878" },
    "keyBase": { "base": "3u", "arcade": "4u", "stickerKey": "5u", "hoverLift": "base 1u, arcade and sticker 2u", "edgeArcade": "color-mix(in srgb, var(--c) 45%, var(--rim))", "source": "src/ui/board-ui.css:80-174, 372-374" },
    "keyGlowDarkOnly": { "rest": "0 0 14u", "hover": "0 0 18u", "press": "0 0 22u", "alpha": "40% / 55% / 70%", "source": "src/ui/board-ui.css:161-178" },
    "focus": { "value": "3u var(--bg) gap + 6u var(--k-sys-ink) ring, on the face and the base", "source": "src/ui/board-ui.css:138-151" },
    "focusPage": { "value": "outline: 3px solid var(--k-sys-ink); outline-offset: 3px", "source": "site/site.css:64-67" }
  },
  "motion": {
    "source": "src/ui/board-ui.css:47-48, 99-131, 183-213; src/ui/tokens.json:55-65; site/site.css:27-36, 664-674",
    "keyTravel": "transform + box-shadow 120ms ease-out; press 50ms",
    "locked": "breath 1.8s ease-in-out infinite",
    "call": "ring 1.4s ease-out infinite, from the bottom of the base",
    "slam": "1100ms",
    "launch": "760ms in total",
    "spring": "cubic-bezier(0.34, 1.7, 0.5, 1)",
    "out": "cubic-bezier(0.15, 0.8, 0.3, 1)",
    "blink": "1.1s steps(2) infinite (CLICK THE PAGE hint)",
    "scroll": "smooth, scroll-padding-top 90px",
    "reduced": "all kit animations and transitions off, launch burst hidden; blink and the NOW pill stop; smooth scroll off; the demo stays paused"
  },
  "layout": {
    "source": "site/site.css:8-9, 68-73, 203-208, 281-319, 782-788, 1551-1645",
    "page": "1200px max",
    "gutter": "30px; 18px at max-width 520px",
    "header": "sticky, min-height 76px, 2px --line bottom border",
    "section": "padding-top clamp(70px, 10vw, 120px); head max 780px, 44px below",
    "breakpoints": [1080, 960, 900, 860, 600, 520, 400, 380],
    "minWidth": "320px (body); every page tested at 360px wide"
  },
  "storage": { "theme": "localStorage dom-virus:theme (shared with DOM VIRUS and Battlefield)", "source": "site/layout.mjs:74, site/site.ts:3-9" }
}
```

## 3. The shared 3D key

The 3D key is the one component every brand shares (rulebook §2). It is the Board UI kit's key
family, specified in [`BOARD-UI.md` §5](../src/ui/BOARD-UI.md) and built in
`src/ui/board-ui.css:69-250`.

- **Anatomy:** a face over a hard base, straight below it (`box-shadow: 0 var(--py) 0 var(--edge)`).
  The face and the base move together on one curve and never snap apart.
- **States:** rest, hover (fine pointers only: lifts by `--hy`), press (`:active`, `.down`: the face
  drops onto the base), locked (`aria-pressed="true"` and similar: rests down and breathes in the
  lock colour), call (`.bui-call`: a ring leaves the base), disabled (45% opacity).
- **Families the site uses:**
  - `.bui-arcade` + a role, as a link key (`<a class="bui-key bui-arcade bui-go">`). Used for every
    call to action: Quick start, Start, The contract, Run the example, Play Blitz
    (`site/pages/index.mjs:178-179, 360, 407`).
  - `.bui-icon-key`: the header's GitHub, theme and sound keys (`site/layout.mjs:86-87`).
  - `.bui-sticker`: the slam stickers RECALL / RESTORED (`index.mjs:190`) and ERROR 404 / NO PAGE
    (`not-found.mjs:47`).
  - `.bui-sticker-key` is part of the family but not used on the site today.
- **Role colour is the job:**
  - `bui-go`: start, try it.
  - `bui-sys`: read, go to a section.
  - `bui-cmd`: Recall, the arcade.
  - `bui-attack`: Blast, play Blitz.
- **Never restyle the key per page.** If a key needs something new, add it to the kit (and to
  BOARD-UI.md) first.

## 4. How Fizlet differs from DOM VIRUS and Battlefield

| | DOM VIRUS (parent hub) | DOM Battlefield site | Fizlet site |
|---|---|---|---|
| System | Its own hub CSS (`dom-virus/site-kit/style.css`) | Board UI root | Board UI root (`site/layout.mjs:59`) |
| Background | `#100a1b` (`style.css:3`) | `#07060f` | `#07060f` |
| Shadows | **Diagonal**, e.g. `7px 7px 0` (`style.css:480`) | Straight below | Straight below (`site/site.css:10`) |
| Accent | Per game (`accent-<colour>`, pink `#f4457a` by default) | Board palette by role | Board palette by role; no per-page accent |
| Mark | DOM VIRUS skull | Battlefield tank mark | **Fizlet mark**: three pixel bubbles fizzing up a cyan grid tile, one popping in pink (`site/layout.mjs:39-41`) |
| Wordmark | DOM VIRUS | DOM BATTLEFIELD | `DOM ENGINE` + version / **FIZLET** in mono (`layout.mjs:82`) |
| Extra tokens | n/a | `--base`, `--grid` | adds `--code-bg` and `--hl` for code and live readouts (`site.css:13-20`) |
| Hero | Game art and cartridges | Hero arena on the game sprites | A live engine demo on a fake page (`your.page`) next to the headline |

What Fizlet shares: the 3D key, the rim, the palette, the mono labels, the header and footer
furniture (`site/site.css` mirrors `dom-battlefield/site/src/styles/site.css` on purpose, so the two
read as siblings), and the shared theme key in storage.

What makes Fizlet look like Fizlet:

- **Code is first-class.** Code cards (`.code-card`), the install box and copy keys sit on the same
  panels as the copy.
- **Measured-number furniture:**
  - the stats strip (`.stats`);
  - the spec cards (`.spec-card`);
  - the size chips with a budget bar (`.size-chips`);
  - the meter on each brick card (`.meter`);
  - the roadmap phase cards with checklists (`.phase`, `.checks`).
- **Diagrams drawn in kit pieces** (section 5), not illustrations or game art.

## 5. Diagrams and experiments

The site explains the engine with diagrams built from HTML and the kit's own parts, plus one live
experiment. This follows the Under the Hood page on DOM VIRUS
(`dom-virus/site-kit/components/UnderTheHood.astro`), translated into the Board UI look.

**The live demo** (`site/pages/index.mjs:185-209`, `site/demo.ts`):

- A `.panel.lit` figure with:
  - browser chrome (three dots, a `your.page` URL pill, a state pill);
  - a gridded board (22px grid);
  - a canvas for effects;
  - arcade keys (Blast `B`, Recall `R`, sound);
  - an `engine.stats()` readout strip (`.demo-stats`, 4 × 2 on desktop, 2 columns on phones).
- **It runs on Fizlet itself**, and its caption says which bricks run it
  (`LIVE · fizlet + input + fx + sound + debug`).
- **Every number shown is live from the engine,** never animated for show.

**Diagram patterns** (all in `site/site.css`):

| Pattern | Class | Shows | Lines |
|---|---|---|---|
| Phase stack | `.phases` | READ → STEP × 0–4 → RENDER, each row a rim card with a coloured left edge (`--tone`) on a gridded panel | 913-973 |
| Frame strip | `.loop`, `.raf`, `.engines`, `.steps`, `.slots` | One rAF for three engines, steps with a cap of 4 and dashed dropped steps, a 24-slot pool | 975-1051 |
| Ledger table | `.ledger` | What `engine.ledger` owns, with a green "TESTED IN CHROMIUM" LED | 1053-1128 |
| Spec cards + size chips | `.spec-grid`, `.size-chips` | Hard limits and measured sizes, each chip with a budget bar (`--v` = gzip / budget) | 1130-1201 |
| Pipeline | `.pipeline` | src → check → tag → vendor → Pages, joined by 2px violet connectors, last stage in `--k-go` | 1203-1246 |
| Roadmap | `.roadmap`, `.phase` | E0–E6, coloured by state: done `--k-go`, now `--k-sys` (breathing pill), part `--hurt`, next outlined | 1315-1417 |

Rules for new diagrams and experiments:

1. **Mechanism, not decoration.** Draw the real thing: real counts (12 frames, 24 slots, cap 4), real
   API names, real defaults.
2. **Build from the kit:**
   - rim borders (`2px solid var(--rim)`);
   - hard bases straight below;
   - role colours by job;
   - mono caps labels in the `.bui-label` grammar `<b>WORD</b> · DETAIL`.
3. **Grids are the board.** Gridded backgrounds use `--grid` at 44px (hero), 30px (phases), 22px
   (demo, 404) or 20px (quick start).
4. **An experiment:**
   - runs on Fizlet;
   - shows `stats()`;
   - pauses offscreen;
   - has a reduced-motion still frame (section 7);
   - gives the page back (a Recall key or `destroy()`).
5. **Each diagram has a text alternative:** an `aria-label` on the figure, or an `sr` span for
   states such as "(done)" / "(to do)".
6. **Numbers in a diagram follow the same rules as copy** ([`voice.md`](voice.md#limits-numbers-and-claims)):
   measured or a named default, never made up.

Section heads follow one pattern (`index.mjs:228-232`):

- an eyebrow with a tilted number sticker (`.eyebrow .index`, rotated −4°, `site.css:115-125`) and a
  mono caps kicker;
- a two-line `h2` whose second line is an `<em>` in `--k-attack`;
- a `.lead` paragraph.

## 6. Cartridge and the shadow angle

**Fizlet has no cartridge.** Cartridges are the game template (rulebook §5). Each brand sets its
`--shadow-angle`, and Fizlet is an engine, not a game, so nothing on the Fizlet site uses one.

If a Fizlet cartridge is ever needed (for example a FIZLET slot on the DOM VIRUS console), the
proposal is a **vertical shadow** (straight below), to match the Board UI rule. That is an open
question for the owner (section 10).

## 7. Light and dark themes, reduced motion, accessibility

**Themes:**

- **Dark is the default** (`data-theme="dark"` in `site/layout.mjs:59`). Light is the kit's
  `[data-theme="light"]` set plus the site's overrides (`site/site.css:16-21, 190-192, 478-481, 602-604, 951-953`).
- The toggle (`[data-theme-toggle]`, `site/site.ts:3-9`) stores `dom-virus:theme`, so one choice
  follows the visitor across DOM VIRUS, Battlefield and Fizlet.
- The page does not follow `prefers-color-scheme` on a first visit (open question).
- **In light:**
  - the rim stays ink `#07060f`;
  - key glows, panel glows and text glows switch off;
  - `-ink` twins replace thin neon text (`--k-sys-ink #0088b3`, `--k-cmd-ink #6a3ae6`);
  - the hero emphasis deepens to `color-mix(in srgb, var(--team-a) 55%, #0b3d2c)`.

**Reduced motion** (tested: `tests/site.mjs:169-175`):

- Kit animations and transitions are off and the launch burst is hidden (`src/ui/board-ui.css:711-720`).
- Smooth scroll, the blink and the NOW pill's breath stop (`site/site.css:32-36, 1646-1651`).
- The demo engine stays paused (`pause: { reducedMotion: true }`, `site/demo.ts:46`). A click jumps
  straight to the settled result, and the state pill reads `STILL · REDUCED MOTION`
  (`site/demo.ts:216, 244`).

**Accessibility, as built:**

- skip link (`layout.mjs:77`);
- `lang`, one `h1` per page, labelled landmarks and sections (`aria-labelledby`);
- `aria-hidden` on decorative SVG and canvases;
- `aria-pressed` on toggles;
- `kbd` shortcut chips, with the label still the accessible name;
- a focus ring on the face and the base of every key, plus a 3px outline on everything else;
- touch targets of 44u for keys and 42px for header icon keys (`site.css:273-276`);
- no horizontal overflow at 360px (tested, `tests/site.mjs:54-76`).

**Contrast (WCAG ratios, computed from the token hex values on 2026-10-28):**

| Pair | Dark | Light |
|---|---|---|
| `--ink` on `--bg` | 18.41 | 15.22 |
| `--muted` on `--bg` | 8.72 | 5.91 |
| `--muted` on `--card` | 8.09 | 6.71 |
| `--k-sys-ink` on `--bg` (links, `code`, eyebrow bold) | 14.35 | **3.58** |
| `--k-sys-ink` on `--card` | n/a | **4.06** |
| `--k-attack` on `--bg` (h2 `em`, large text) | 5.76 | 3.08 (passes only as large text) |
| `--hl` on `--code-bg` (live readouts) | n/a | **4.03** |
| Rim text on key faces (go / sys / cmd / attack / fire) | 15.46 / 14.35 / 5.38 / 5.76 / 5.48 | same |

Every dark pair passes AA. **In light, `--k-sys-ink` (small links and `code`) and `--hl` (small
readouts) fall under 4.5:1**, which the rulebook (§10) requires in both themes. Fixing that is a kit
change (`src/ui/board-ui.css:60`) and the owner's call. See the open questions.

## 8. Effects: what is allowed where

The rulebook (§2) asks for flat colour, with no gradients, blurs or glows **in the game layer**
unless measured, and for hard, unblurred shadows. On the Fizlet site:

- Keys and panels follow it: flat faces, hard bases straight below.
- Page furniture adds a few soft effects, all **outside the game layer** and all **dark theme
  only** where they glow:
  - the hero's radial violet wash (`site.css:449`);
  - the Blitz card's pink wash (`site.css:1265-1267`);
  - the sticky header's `backdrop-filter: blur(10px)` (`site.css:200`);
  - text glow on the hero `em` and the demo's hot letters (`site.css:476, 600`);
  - the kit's key glows and the `.panel.lit` glow;
  - LED dots with a small glow (`site.css:130, 773, 1084`).
- Keep these to the page frame. Never put them inside the demo board, the canvas or a game.

## 9. Never do this

1. Never put a shadow to the side or on the diagonal. Bases go straight below (that is the
   DOM VIRUS hub's look, not Fizlet's).
2. Never fork the 3D key or restyle it on one page. Change the kit and BOARD-UI.md first.
3. Never pick a colour for decoration. Pick it for its job: go = start, sys = navigate/read,
   cmd = Recall/lit, attack = emphasis/play.
4. Never use a game's art, cartridge, skull or tank as Fizlet's mark or hero. Games appear in the
   "Built on Fizlet" section only.
5. Never add a webfont, an icon font, an image-heavy hero or a framework. The site is static HTML
   with system fonts and inline SVG icons on a 20px grid (`layout.mjs:16-37`).
6. Never show a number that isn't measured or a real default. Sizes come from
   `scripts/sizes.mjs` at build time, not typed in.
7. Never let a demo run under reduced motion, keep running offscreen, or leave the page changed
   after Recall.
8. Never put gradients, blurs or glows inside the game layer (the demo board, the canvas).
9. Never ship a page that overflows sideways at 360px or loses its focus ring.
10. Never hard-code another site's host in a page: links go through `site/layout.mjs` constants,
    and later `family.json` (rulebook §4).

## 10. Open questions for the owner

1. **Approve this guide** as Fizlet's visual guide (rulebook §1). Until then it is a description.
2. **Light-theme contrast:**
   - `--k-sys-ink #0088b3` measures 3.58:1 on `--bg` and 4.06:1 on `--card`;
   - `--hl #0e8a5f` measures 4.03:1 on `--code-bg`.
   - Deepen them in the kit (that affects every board), or only on the site?
3. **First-visit theme:** keep dark by default (the rulebook default), or follow
   `prefers-color-scheme` when no choice is stored?
4. **Cartridge:** does Fizlet ever get one (for example on the DOM VIRUS console)? If so, confirm a
   vertical `--shadow-angle`.
5. **Soft effects in the page frame** (section 8): fine as page furniture, or should they be
   measured and listed the way the game layer would be?
6. **Fonts:** `Inter` heads the sans stack but is never loaded, so most visitors see
   SF Pro / Segoe UI / system-ui. Keep system-only, or self-host Inter (with a size cost)?
7. **Social image:** the rulebook's audit (§10) lists Fizlet with no Open Graph image. A generated
   1200 × 630 card needs a layout: the mark, the wordmark and the measured kernel size.
