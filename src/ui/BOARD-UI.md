# Board UI: the game board and controls design system

**Status:** v1.1 (2026-10-28). Lives in Fizlet (`src/ui/`, published as `fizlet/ui`); DOM
Battlefield keeps a copy in `board-ui/` until it imports the package. Live guide:
https://coded-dot-design.github.io/dom-battlefield/style-guide/ (built from the kit only). Kit:
`src/ui/board-ui.css` + `src/ui/board-ui.ts`. Tokens: `src/ui/tokens.json`.

This is the spec for **every DOM VIRUS game board**. A new board reuses this UI exactly: the keys,
their states, the cards, overlays, launch bursts, comms toast, tips, boot screen and the layouts
for desktop, compact desktop, full screen and phones. **The only thing that changes from game to
game is the palette** (section 3). If a board needs something this file does not cover, add it here
first, then build it.

Read order for an agent: sections 1, 2 and 3 (rules, palette), then the component you are
building, then section 16 (lessons: mistakes we already paid for) and section 17 (checklist).

---

## 1. Principles (the rules everything else follows)

1. **Everything you can press is a 3D key.** A face over a hard base *straight below* it. Never a
   diagonal or side shadow on the board (the hub's marketing site uses diagonal shadows; the
   board does not).
2. **One physical travel.** Face and base move together on one curve (transform + box-shadow,
   120ms ease-out, 50ms on press). They never snap separately.
3. **Colour is the job.** One colour per job (section 3). The same job is the same colour on
   desktop and phone, in dark and light. Never colour by decoration.
4. **Locked reads as down.** A key that is *on* rests pressed, takes the lock colour and breathes a
   soft glow. Tapping it again releases it. A locked key never calls.
5. **Call reads as up.** The one key the player should press next keeps its face up and sends a
   ring out from the bottom of its base. One caller at a time per area.
6. **Everything sits on the rim.** Keys, stickers and cards share one ink rim (`--rim`) in both
   themes: neon caps on an ink outline (cyberpunk meets Tron).
7. **Words are short and loud.** Mono caps, spaced. Group labels: **FIRST WORD** · detail. Keys:
   one or two words. Explanations go to the comms toast, never on an overlay.
8. **Overlays are a ritual.** Grey dim that blocks the board, a sticker that slams and presses in a
   little above centre, at most two big keys centred at the map's bottom edge.
9. **The field is the point.** Cards move away from your team, shrink to a key, and never cover
   each other; secondary controls hide when a step needs the map.
10. **Embed-safe and small.** One root class, no globals, every listener on one `AbortSignal`,
    reduced motion respected, a size budget in CI.

---

## 2. Files and how a board uses the kit

| File | What it is |
|---|---|
| `src/ui/board-ui.css` | Tokens and every component, scoped under `.bui`. CSS containment (Fizlet contract rule 8): the pad and the overlay are `contain: layout style` |
| `src/ui/board-ui.ts` | `mount`, `applyPalette`, `press`, `slam`, `toast`, `launch` (2.4 KB gzip; the CSS is 4.5 KB gzip, as `npm run size` measures them). The mount root is `contain: style`, the launch burst `contain: layout style` |
| `src/ui/tokens.json` | Machine-readable tokens, timings, breakpoints, z-layers, storage keys. **Authoritative**: published as `fizlet/ui/tokens.json`; the build (`scripts/tokens.mjs`) fails when a `board-ui.css` default (every palette role, ink, surface, `--k-*`, `--u`, motion curve) or `applyPalette`'s variable map disagrees with it |
| `src/ui/BOARD-UI.md` | This spec |
| `/style-guide/` (Battlefield site) | Live guide built from the kit only |

```html
<div class="bui" data-theme="dark" data-side="0">  <!-- the board root -->
  …board…
</div>
```

```ts
import { applyPalette, press, launch, slam, toast } from "./board-ui";
applyPalette(root, { sys: "#06c4ff", cmd: "#8573ee", teamA: "#4bce82", teamB: "#f4457a" });
```

### 2.1 Isolation: class scope or shadow DOM

- **Class scope (`.bui`)**: every kit rule starts with `.bui`, so the kit never styles the host
  page. Use it for first-party pages (the hub's guide, a game's own page). A host page's own CSS
  *can* still reach in (a global `button {}` rule, a reset).
- **Shadow DOM (`mount()`)**: for embeds on someone else's site. `mount(host, css, { theme, side,
  palette })` attaches a shadow root, adopts a shared constructed stylesheet and returns the
  `.bui` root to build in. **Stylesheet ownership:** the kit keeps one constructed sheet per CSS
  text (keyed by the text itself), so two games composed independently with different CSS each get
  their own, and boards mounted with the same text share one. The sheet is the kit's: treat it as
  read-only. It is appended to the shadow root's `adoptedStyleSheets`, never replacing sheets you
  adopted there. Nothing crosses either way. This is the engine contract (owned UI in a
  shadow root) and the default for `easterEgg` installs.
- The launch burst renders on `<body>` with **inline styles only**, so it works from inside a
  shadow root and survives any layout change.

Battlefield still ships its own copy of these rules (`bf-` prefixes). In the engine phase (E3) it
ports onto this kit; until then **Battlefield is the reference** and this kit must match it. When
they differ, Battlefield wins and this file is updated.

---

## 3. Palette: the only per-game input

### 3.1 Roles

| Role | Variable | Default (dark) | Job | Battlefield keys |
|---|---|---|---|---|
| sys | `--k-sys` | `#19f0ff` | navigation and system | Menu, stick, Center, Pan, pager, pickers, tips, focus ring, comms edge |
| cmd | `--k-cmd` | `#9a63ff` | command, planning, LOCKED orders | Command, routes, check, cards, grips, back tab, tank identity |
| fire | `--k-fire` | `#ff2b4e` | the main action | Fire, FIGHT |
| aim | `--k-aim` | `#ff7389` | aim modes (dim when off) | Auto, Lock |
| attack | `--k-attack` | `#ff2e88` | offensive order | Attack, Attack HQ, doors |
| advance | `--k-advance` | `#ff8a1f` | push to objective | Advance |
| fallin | `--k-fallin` | `#a8ff3e` | form up on the player | Fall in, Follow me |
| flag | `--k-flag` | `#f6f3ff` | white flag | Pause / Surrender, sticker face |
| go | `--k-go` | `#39ffb0` | start and confirm | primary keys, comms LED |
| teamA / teamB | `--team-a` / `--team-b` | `#39ffb0` / `#ff5c8f` | sides | Retreat (= your team), platoon keys, badges, surrender grid |
| hurt / critical | `--hurt` / `--critical` | `#ffc21a` / `#f0506e` | health | platoon key colour |

Surfaces: `--bg --surface --raised --card --ink --muted --line --rim` (dark and light values in
`tokens.json`). Inks: `--k-sys-ink --k-cmd-ink --k-fire-ink` are the text / thin-line twins,
deeper on light.

### 3.2 Derived (never passed in)

- A key's base is its own colour, deep: `color-mix(in srgb, var(--c) 45%, var(--rim))`.
- Card / orbit base: `--k-cmd-base = color-mix(in srgb, var(--k-cmd) 50%, var(--rim))`.
- Glow (dark only): rest 14u at 40%, hover 18u at 55%, press 22u at 70% of `--c`.
- Your team colour: `--team` = `--team-a`, or `--team-b` when the root has `data-side="1"`.

### 3.3 Passing a palette in

```ts
applyPalette(root, { cmd: "#8573ee", teamA: "#4bce82" });   // returns restore()
```

- Hex only (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`); anything else is ignored, so an embed config
  can never inject CSS.
- Any subset: missing roles keep the defaults.
- The same object is the engine config's `palette` (ENGINE.md, "Embed config").

### 3.4 Palette rules

- Every face must read with **rim-coloured text** (`#07060f`) on it: aim for contrast ≥ 4.5:1 for
  12u bold labels. Light faces (flag, fallin, go, sys) are fine; check deep reds and violets.
- `cmd` must differ clearly from `sys` and from both teams (locked orders must read as "locked",
  not as "team").
- `fire` and `aim` are one family (aim lighter). `attack` and `advance` are warm but not `fire`.
- Retreat is always your team colour: it means "home".
- Never use the map hues (terrain, grid) for controls, and never use control colours for terrain.

---

## 4. Units, type, spacing

- **One unit `--u`.** Desktop `1px`. Phones: `clamp(0.7px, min(100dvh / 390, 100dvw / 844), 1.3px)`
  (one unit = one pixel of the 844 × 390 landscape phone design). Desktop-touch full screen: 1.5px.
  Every length is `calc(N * var(--u))`, so a board scales as one piece.
- **Type:** mono (`ui-monospace, SFMono-Regular, Menlo, monospace`) for every control, label and
  sticker. Titles of places/missions may use the hub's display sans. Key labels 12u/700, group
  labels 9u (11u titles in full screen), sticker words 34u/900, sticker kickers 8u/800 at 4u
  tracking (blinking), sticker-key labels 10u/900 at 1.6u tracking.
- **Spacing:** keys 8u apart in a group; groups 14u+ apart with a 1px `--line` divider; card
  padding 14u; dock header row 54u; toast offset 12u from the header.
- **Radii:** base key 6u, arcade 10u, sticker key 12u, card 10u, dock 12u, pills 4–6u, round 50%.
- **Borders:** key 2u, sticker key 3u (white), card 2.5u (cmd), sticker 2.5u (rim).
- **Touch targets:** ≥ 44u on phones (keys are 44u; stick and fire are larger).

---

## 5. The 3D key

### 5.1 Anatomy and variables

```
 ┌──────────────┐  face: background var(--c) (arcade) or --surface (base key), 2u rim border
 │ ◆ Label  [K] │  icon 18u (stroke 2) · label · shortcut chip pushed to the right edge
 └──────────────┘
 ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  base: box-shadow 0 var(--py) 0 var(--edge)  (straight below)
```

| Variable | Base key | Arcade | Sticker key | Meaning |
|---|---|---|---|---|
| `--py` | 3u | 4u | 5u | base height (resting travel) |
| `--hy` | 1u | 2u | 2u | hover lift |
| `--edge` | `--line` | `--c` 45% into rim | `#f6f3ff` | base colour |
| `--c` | n/a | role colour | n/a | face colour |
| `--lock` | n/a | role or `--k-cmd` | n/a | colour when locked |
| `--glow*` | none | role glow | none | soft neon (dark theme) |

### 5.2 States (exact)

| State | Selector | Face | Base | Extra |
|---|---|---|---|---|
| rest | — | `transform: none` | `0 py 0 edge` | glow |
| hover | `:hover` on `(hover: hover) and (pointer: fine)` only, not locked/disabled | `translateY(-hy)` | `0 (py+hy) 0 edge-hover` | border `--border-hover` |
| press | `:active`, `.down` | `translateY(py)` | `0 0 0 edge` | 50ms |
| locked | `[aria-pressed=true]`, `[aria-expanded=true]`, `.active` | `translateY(py)` | `0 0 0` | background `--lock`; `breath` 1.8s |
| call | `.bui-call` | up | normal | `::after` ring from the base bottom, 1.4s; never on a locked key |
| disabled | `:disabled` | rest | rest | opacity .45, `not-allowed` |
| focus | `:focus-visible` | as state | as state | ring: 3u `--bg` gap + 6u `--k-sys-ink`, on face **and** base (two spread shadows, one at y=0, one at y=py); pressed keys get the face ring only |

Transitions: `transform 120ms ease-out, box-shadow 120ms ease-out, background-color 140ms,
border-color 140ms`. Locked keys in a footer bar keep a steady glow (no breath) so the bar stays
calm: `animation: none` on locked footer keys.

### 5.3 Press behaviour (JS)

- `press(el, fn, signal)`: touch fires on `touchstart` (prevent default when cancelable); a click
  within 800ms after an uncancelable touch is skipped. Pointer/pen fire on `pointerdown`. Second
  finger safe: a press never steals a finger that is on the stick.
- **Repaint synchronously** in the handler (apply `.active` / `aria-pressed` before returning). A
  frame between release and the locked state makes the key spring up and back down ("bounce").
- Hold keys (Fire) use `data-key` + touch tracking per touch identifier, and `.down` while held.
- Planning keeps native Enter/Space activation on buttons; a live battle maps Space to the main
  action except on focused buttons.

### 5.4 Families

- **Arcade** (`.bui-arcade` + role): orders, Command, aim, Fire, FIGHT, Menu, Pause. Icon + label
  + `kbd` on the right; icon-only in compact/phone modes (label stays the accessible name).
- **Base key**: header icons (help, full screen, sound, theme, Eject), segmented choices.
- **Icon key** (`.bui-icon-key`): 44u square.
- **Sticker key** (`.bui-sticker-key`): the big launch / overlay keys (section 9).
- **Round key** (`.bui-orb`): planning steps; caption + count badge (section 7).
- **Platoon key** (`.bui-unit`): number over size pips; health colours; `.active` = white outline
  2u at 2u offset; lost = disabled, pressed flat, number struck through.
- **Pager** (`.bui-pager`): ‹ ★ › as one sys bar; ★ = your own unit, pressed when you are selected.
- **Shortcut chip** (`kbd`): 9u mono, 1u currentColor border, 70% opacity, always right-aligned.

### 5.5 Touch pad (`fizlet/pad`, CSS section 11)

- **`.bui-pad`**: absolute along the board's bottom edge, notch-safe, 14u in from the edges; the
  move control under one thumb, the action keys under the other (right; `data-hand="left"` swaps).
  Only its controls take pointers; the rest of the strip lets the field through.
- **Stick** (`.bui-stick` + `.bui-knob`): Battlefield's cockpit stick, 128u, sys ring and arrows;
  the knob springs back (160ms), and follows the finger with no transition while `.down`.
- **D-pad** (`.bui-dpad`): four 44u sys arcade keys in a cross; one finger, eight ways; the arrows
  under the finger take `.down`. **Move keys**: the same arrows as round 62u keys in a row.
- **Action keys**: round `.bui-arcade` + role, 62u (Blitz's pad); the first is `.bui-primary`,
  96u. Caption 8u/900; `kbd` chip on the top-left rim, hidden on coarse pointers. Toggles use
  `aria-pressed` (locked state); hold and tap keys use `.down` while the finger is on them.

---


**Link keys.** A key that navigates is an `<a>` with `bui-key` plus its family
(`<a class="bui-key bui-arcade bui-go" href="play/">`). It gets the same face, base, hover lift,
press and focus ring as a `<button>` key; no underline. Use it for Play, Read the spec and similar.

## 6. Labels and voice

### 6.1 Group labels

Format: `<b>WORD</b> · DETAIL`. First word bold, `--ink`; the rest `--muted`, 9u mono caps, 1.4u
tracking.

| Group | Desktop bar | Compact desktop (icon keys) | Full-screen card | Phone |
|---|---|---|---|---|
| per-unit radio | **RADIO** · EACH TANK | **RADIO** | card title RADIO, label EACH TANK | rail key only |
| squad orders | **RADIO** · WHOLE SQUAD (· TANK 2 when one is selected) | **WHOLE SQUAD** | label WHOLE SQUAD | ORDERS · WHOLE SQUAD (drawer) |
| roster | **PLATOON** · RADIOS | **PLATOON** (on the map card) | **PLATOON** | PLATOON |
| aim | **AIM** · AUTO / LOCK | **AIM** | card title AIM | rail keys only |

Rename per game (e.g. SQUAD, CREW, SHIPS) but keep the grammar.

### 6.2 Copy

- Keys: one or two words, verbs or nouns (Fall in, Retreat, Command, Auto, Lock, Surrender).
- Stickers: kicker + one or two words (BATTLE PAUSED / GIVE UP?, INSERT COIN / GAME OVER,
  STAGE CLEAR / MISSION COMPLETE, SOMETHING WENT WRONG / REFRESH).
- Toast: one sentence of what happened or what to do next ("Tank 2: tap a square to send it, or
  Attack HQ."). Never long help on a key or overlay.
- Hints on keys: CLICK / TAP TO SHRINK (pointer-specific word), TAP WHERE IT GOES.

---

## 7. Cards

### 7.1 Anatomy

- Card: `--card` at 94%, 2.5u cmd border, 10u radius, base `0 5u 0 --k-cmd-base`.
- **Grip**: a 36 × 12u cmd tab centred on the top edge (dot pattern). Drag by it or any empty part
  (5px threshold before a drag starts; a mouse drag never becomes a click). A dragged card gets
  `data-moved` and keeps its place until the stage changes.
- **Fold key**: the card's icon/number is a real button. Click/tap/Enter/Space shrinks the card to
  that key; a hover/focus tip says "Click to shrink" / "Click to expand". A hint strip (CLICK THE
  NUMBER TO SHRINK) shows on first open.
- **Back tab** (`.bui-back-tab`): "‹ PREVIOUS STEP" on the top edge, left side, cmd, 22u tall. A
  card with a back tab keeps 22u of top padding so its title never meets the tab.
- **Height**: a card fits its content, up to a cap (the map height minus room for the launch key);
  its body scrolls past the cap. A resize handle can shorten a card, never stretch it past its
  content. No empty card over the map.
- **Status pill** (per-unit cards): on the top edge, right side, opposite the back tab (top -12u,
  right 14u, 22u tall). Flat: no hard shadow, because it is a readout, not a key. It breathes with
  the same locked glow as the selected unit key, so the pill and the key read as one. Colour and
  icon follow the unit's current order (attack, fall in, command, repair = team); grey and still
  for no order. Labels are short radio talk: PLOTTING (unsent route), ROGER · GRID 0412 (command
  location sent; the grid of the last waypoint), ATTACKING HQ, FOLLOWING YOU, HOLDING, REPAIRING,
  ON ITS OWN. Hidden in modes where it doesn't apply (e.g. Move HQ) and when the card is folded.
  No "mode" line on the card: the comms toast states the mode. With the pill on the edge, the
  card's mode switch and the unit number sit opposite each other on the body row.
- **Badge in a mode**: when a mode replaces the unit (Move HQ), the badge shows that mode's icon
  (the HQ glyph) and the title names the mode. Never an empty box.
- **Step keys** (orbit): beside settings cards, never beside the plan card; hidden when the card is
  folded. Round on phones (icon and caption together), rounded squares (14u) on desktop.
- **The first step is keys, not cards**: the step-picker keys have no grip and never drag; only the
  cards they open do.

### 7.2 Placement rules

1. Settings cards sit on the side **away from your team**; the plan card goes to the top corner
   away from your team.
2. Two floating cards never overlap: on unpin or drop, push the second card below the first
   (10px gap), else beside it, whichever side has room.
3. The step that needs the map (route planning) hides every secondary control (round keys) and
   offers one back tab instead.
4. Desktop battle: the plan card starts **shrunk, top-left**, the per-unit orders card **unpinned**
   beside it. Shrink/expand and pin/unpin are remembered (`<game>:battle-cards`).
5. Full screen: the roster card waits in the map's top corner on **your team's side** (settings
   cards sit on the far side) until the mini-map exists, then sits under it. Never in the middle
   (it would cover the launch key).

### 7.3 Orders card (per-unit tooltip)

- Pinned: rides above the selected unit pointing at it (below it near the top edge), clamped to
  the safe area. Unpinned: grows a grab bar, stays where dragged. Lock key toggles.
- Top: pager. Bottom: three round action keys (Attack HQ, Follow me, Command). Follow me on
  yourself is a grey pressed-in disabled key.
- A violet "TAP WHERE IT GOES" chip under it while a route is being placed.

### 7.4 Dock cards (full-screen RADIO / AIM)

- Padding 54u 14u 14u; gap 12u; title at (16u, 21u) 11u mono 0.2em; list/grid switch 28 × 24u at
  (12u, 12u) showing the **current** mode (list icon = labels, grid icon = icons only).
- Group labels inside drop their first word (EACH TANK, WHOLE SQUAD).
- Icons-only mode: 46u keys, header 48u, no titles. Remembered (`<game>:dock`).

---

## 8. Comms toast

- One line, 11.5u/600, `--surface` 97%, 1.5u line border, **4u sys left edge**, 7u radius, hard base
  `0 3u 0 --rim` + sys glow. A go-coloured LED dot leads.
- Desktop: lives in the header comms bar. Phone: a floating toast.
- Placement: never under the header (top = header height + 12u); in planning, in the open side
  between the safe edge and the open card's round keys; when the plan card is up, at the bottom
  centre over the field (it fades on its own); over an overlay at the top of the dim (it carries
  the overlay's explanation). z-index above keys and cards (34; 81 above the stale lock).
- New text replaces old (never stacks). Tap/swipe dismisses on phones.

---

## 9. Overlays

### 9.1 The rule

1. **Grey dim** (`#2a2d38` at 82%) over the board; everything behind is `inert` (keyboard focus is
   trapped in the overlay; the phone menu may keep the header live).
2. **Sticker** (`.bui-sticker`): tone face (flag white by default), 2.5u rim, 10u radius, rotated
   −4°, centred horizontally on the map, **40% down the map** (a little above centre).
3. **Slam and press** on every entry (1100ms): drops from 1.9× scale and +10° with a soft shadow
   far below, hits its hard base at 36%, settles (1.04 at 46%), holds to 72%, then presses into
   the screen (base 5u → 0, translate 5u). Restart with `slam()` (clear animation, reflow, restore):
   rewinding Web Animations is unreliable in Safari. Replay on `visibilitychange` to visible.
4. **Keys**: at most two sticker keys, centred, 20u above the map's bottom edge, 16u apart. Left:
   primary (navy, cyan icon). Right: secondary (dark, white glyph).
5. **Explanation** goes to the toast, not the overlay.
6. Focus moves to the first key; Esc / P resume from pause.

### 9.2 The set (Battlefield)

| Overlay | Kicker / word | Keys |
|---|---|---|
| Pause | BATTLE PAUSED / GIVE UP? | KEEP FIGHTING · SURRENDER |
| Result lost | INSERT COIN / GAME OVER | REMATCH · NEW CAMPAIGN |
| Result won | STAGE CLEAR / MISSION COMPLETE | REMATCH · NEW CAMPAIGN |
| Stale page | SOMETHING WENT WRONG / REFRESH | REFRESH BROWSER |

### 9.3 Surrender (the white flag)

- Icon: a 4 × 4 grid in your **team colour** with a **white flag** (white with a rim outline) in
  any theme; the face never turns red when pressed.
- Markup (64 × 64, `.bui-sticker-key.bui-second.bui-surrender`): `<g class="bui-cells">` (16 rects,
  `--i` = white-out order) · `<path class="bui-grid">` (the 16u grid lines) · `<rect class="bui-frame">`
  (white frame) · `<path class="bui-pole">` + `<path class="bui-cloth">` (the flag). The kit colours
  each part by class; never rely on SVG attributes (the key's icon rule overrides them).
- Press: the cells white out one by one (16 × 18ms, steps(2)), the flag waves (120ms × 4), a hurt
  cue plays, then at 480ms the game-over cue and the **launch burst** (section 10) as the board
  resets underneath.

---

## 10. Launch burst

For every key that starts or ends a game (Quick start, Plan battle, Start battle, PRESS START,
Surrender).

| t | What |
|---|---|
| 0–90ms | an inert copy of the key presses into its base and flips to its inverse (`invert(1) hue-rotate(180deg)`: light for dark, same hues) |
| 90ms | the key shatters into 6 chunks (3 × 2 clip-path copies) that fly out, spin and fall |
| 90–410ms | white flash (0.6 × min side), a core in the key's ink (0.45×), a round shock ring (scale 0.5 → 5) |
| 90–730ms | 12 square bits (5–9u) radiate, spin and drop 16u |
| 760ms | layer removed, original key restored |

Rules: the game action runs **synchronously in the click** (mobile full screen needs the user
activation). The burst layer is appended to `<body>` (a transformed ancestor would re-anchor
`position: fixed` when the action changes the layout). The original key is hidden
(`.bui-igniting`) during the burst and stays hidden if the action removes it (no fade back under
the pointer). Reduced motion: no burst, a 90ms press only. **Never cancel the burst from inside its
own action** (a reset that cancels effects must be told to keep it).

---

## 11. Button tips (help mode)

- The page dims (`--rim` at 45%); each control group gets a **3u dashed sys-ink ring** with a light
  halo (2u `--surface` 85% inside and out) that hugs the group's visible keys (union of their
  rects, not spacers or dividers).
- A sys tip label per group (`+` to open a note); notes open under/above their label.
- Desktop bottom bar: labels **above** their group; top of screen: below; elsewhere: beside, on
  the side with room. Phones: labels just inside the field beside their rail, stacked so none
  collide.
- Placement waits until the layout stops moving (8 still frames, max 90). Labels never leave the
  screen. The tips card sits at the top on desktop. "Don't show again" is remembered.

---

## 12. Boot screen and door hand-off

### 12.1 Boot (opening the game directly)

`t0 = 0.65s` (doors) or 0s (no doors):

1. Doors: two pink hatched halves (`--k-attack`, 135° stripes, 3u rim) fold open (rotateY ±100°,
   620ms after 120ms).
2. Grid fades in (500ms at t0+0.05s); random squares light up.
3. HQ placeholders draw their dashed squares (700ms at t0+0.35s), labels at t0+0.9s.
4. The game sticker slams in (t0+0.75s).
5. LOADING… (dots) at t0+0.4s until loaded **and** t0+1.7s, then PRESS START pops in (380ms
   spring) **in the same spot**: halfway between the sticker's bottom and the screen bottom. The
   sticker never moves.
6. PRESS START (click, tap, Enter, Space): launch burst; the sticker breaks up; header and readouts
   drop in from the top; the map frame draws from top-centre outward; the first card opens.

Skipped under `navigator.webdriver` (unless `?intro`) and reduced motion.

### 12.2 Hand-off from the hub cartridge

The hub grows its console screen into the same shut doors and navigates **with them shut** (no
stand-in screen). It sets `sessionStorage["dom-virus:doors"] = "shut"`. The game's pre-paint script
reads and clears it, paints the doors shut (`data-boot-doors="hold"`: every boot animation paused
at frame 0), and on `load` + one frame sets `open`: the doors open and the boot runs from the start.
Door colours must match exactly in both apps.

### 12.3 Back / forward

Leaving tears the game down (`pagehide` aborts the signal). A page restored from the bfcache
(`pageshow.persisted`, or any input after teardown) locks behind the stale overlay with a
REFRESH BROWSER key (`location.reload()`).

---

## 13. Layouts

### 13.1 Modes

| Mode | When | Shape |
|---|---|---|
| Phone cockpit | `(pointer: coarse) and (max-width: 1400px), (max-width: 759px)` | landscape only (rotate gate), full screen gate, left rail (menu, pause, readouts, Command, camera keys, stick), right rail (orders diamond, Auto, Lock, Fire), notch-safe |
| Desktop bar | wide pointer screens | header, map, bottom bar: RADIO (Command) · RADIO · WHOLE SQUAD (orders) · PLATOON · RADIOS (centre) · AIM (Auto, Lock) · Surrender (far right) |
| Compact desktop | the bar can't fit one line | icon keys; in battle the roster moves to a card under the mini-map |
| Full screen desktop | Fullscreen API | header hidden (its key joins the readouts), dock cards float on the map (RADIO bottom-left, AIM bottom-right), roster card under the mini-map |

### 13.2 Desktop bar thresholds

- Roster needs `52u per unit + 64u` and never wraps.
- Labels when docks + roster fit on one line.
- Icon keys when they don't, and always with more than 4 units below 1750px.
- Roster card on the map (battle only) when the bar is under 1180px, or more than 4 units below
  1160px, or icon keys still don't fit; with the roster gone the bar may show labels again.

### 13.3 Phone specifics

- Rails grow by the safe-area inset on their side; nothing sits under a notch.
- Command mode slides the right rail away and shrinks Fire by a third, slides it right clear of
  the safe area and turns its crosshair 45° into an ✕: tapping it closes command mode and fires.
  Desktop: Space, right-click or a red GUN OFF · FIGHT key leave command mode; the map gets a cmd
  frame.
- Menu opens the header over the dim (pause); full screen persists across games.

---

## 14. Motion (all timings)

| Motion | Spec |
|---|---|
| key travel | 120ms ease-out (press 50ms) |
| locked breath | 1.8s ease-in-out ∞ |
| call ring | 1.4s ease-out ∞ |
| sticker slam | 1100ms (section 9) |
| sticker kicker blink | 1s steps(2) ∞ |
| launch burst | 760ms (section 10) |
| surrender | 16 × 18ms white-out, wave 120ms × 4, burst at 480ms |
| boot | section 12 |
| toast in/out | opacity + translate 200ms |
| command rail slide | translate 240ms ease |
| springs | `cubic-bezier(.34, 1.7, .5, 1)` (pop-ins only, never key travel) |

Reduced motion: no loops, no bursts, no slams (static end states), instant transitions.

---

## 15. Sound cues (engine `sound` adapter)

| Event | Cue |
|---|---|
| Event | Cue |
|---|---|
| start / ready | `ready` (two rising notes) |
| fire | `fire` |
| hit / tank destroyed | `hit` |
| hurt / surrender press | `hurt` |
| win | `win` (three notes) |
| lose / surrender | `end` |

Cue names are `fizlet/sound`'s (`src/sound.ts`); it also has `boom`, `power` and `click`.

Audio unlocks on the first trusted gesture; cues have cooldowns; at most 8 voices; muted state is
remembered (`dom-virus:<game>:sound`).

---

## 16. Lessons (mistakes already paid for: do not repeat)

| Symptom | Cause | Rule |
|---|---|---|
| Key springs up then down on release | `.active` applied a frame later | Repaint in the press handler |
| Burst flies off to one side | Layer `position: fixed` inside a transformed ancestor; layout changed by the action | Append bursts to `<body>` |
| Burst never shows | The action's `reset()` cancelled all effects | Never cancel a burst from its own action |
| Square outline / red face on launch | Old effect | Use the burst in section 10 |
| Focus ring stops at the base | `outline` follows the face only | Ring as two spread shadows (section 5.2) |
| Sticker doesn't press in (phones) | Rewinding animations unreliable; overlay shown while hidden | `slam()` restart + replay on visibility |
| Toast under the header | Fixed top ignoring header height | top = header + 12u |
| Toast slides under a card | ID-based `:has()` selector out-ranked the open-side rule | Keep placement rules at one specificity; test with a card open on each side |
| Platoon row wraps | Roster width not counted | Measure 52u per unit before choosing labels/icons/card |
| Roster card over START | Placed against a hidden mini-map (zero rect) | Fall back to the map's top-right corner |
| Full screen lost on surrender | `reset()` exited full screen | Only the full-screen key exits |
| Game dead after Back | bfcache restored a torn-down page | Stale lock (section 12.3) |
| Boot sticker jumps when PRESS START lands | Status and key in the same flow | Absolute shared spot under the sticker |
| Tips invisible in light mode | Invalid `var(--rim)8c` backdrop; thin dotted rings | `color-mix` dim, 3u dashed ink rings |
| Card hidden by its twin | Two floating cards placed independently | 10px buffer rule |

---

## 17. New board checklist (target: one hour)

1. Wrap the board in `<div class="bui" data-theme data-side>`; include the kit CSS/TS.
2. Pass the game's palette (`applyPalette`), check every face with rim text (section 3.4).
3. Map each action to a role (section 3.1). Write labels with the grammar in section 6.
4. Build the bar groups: per-unit radio · squad orders · roster · aim/mode · flag (far right).
5. Overlays: pause, result, stale; stickers and keys from section 9 copy.
6. Launch keys use `launch()`; resets never cancel the burst.
7. Cards: grip, fold key, back tab, placement rules (section 7.2).
8. Toast placement per stage (section 8); tips mode (section 11).
9. Boot screen + door hand-off if it ships as a full-game cartridge (section 12).
10. Layout modes and thresholds (section 13); test phone 844×390, 1100, 1400, 1750, 1920, full
    screen, both themes, both sides, 4 and 12 units.
11. Reduced motion, keyboard (focus ring, Esc, shortcuts), screen reader names.
12. Size budget in CI; no layout reads in the frame loop; one `AbortSignal` teardown.
