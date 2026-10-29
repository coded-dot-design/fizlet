# Style guide — Fizlet

Preset: cyberpunk-tron · flat colors only (no gradients, blur or glow) · hard shadows straight below · the shared 3D key from the Fizlet Board UI kit

**Fizlet wears the board.** Neon faces on an ink rim, hard bases straight below, a gridded field,
mono caps labels. Cyber Punk palette, Tron geometry, paint kept flat because paint is the budget.
Every page is a Board UI root (`<html class="bui">`), so colours, keys and cards come from the kit:
`src/ui/tokens.json` (authoritative), `src/ui/board-ui.css`, spec `src/ui/BOARD-UI.md`.
<!-- src: site/layout.mjs:59; site/site.css:1-4; README.md 0.5.1 (tokens.json is the authoritative source; the build fails if board-ui.css drifts) -->

```tokens
{
  "brand": "fizlet",
  "version": "0.5.1",
  "byline": { "text": "by Chris Cooley", "href": "https://coded.design/" },
  "color": {
    "bg": "#07060f",
    "surface": "#110d22",
    "raised": "#1d1738",
    "card": "#120f26",
    "ink": "#f6f3ff",
    "muted": "#aea4d6",
    "line": "#3b3170",
    "rim": "#07060f",
    "codeBg": "#0b0918",
    "sys": "#19f0ff",
    "cmd": "#9a63ff",
    "cmdInk": "#b48cff",
    "fire": "#ff2b4e",
    "aim": "#ff7389",
    "attack": "#ff2e88",
    "advance": "#ff8a1f",
    "fallin": "#a8ff3e",
    "flag": "#f6f3ff",
    "go": "#39ffb0",
    "teamA": "#39ffb0",
    "teamB": "#ff5c8f",
    "hurt": "#ffc21a",
    "critical": "#f0506e",
    "panelBase": "#3f296a",
    "light": {
      "bg": "#eef0fb",
      "surface": "#ffffff",
      "raised": "#e6e4f8",
      "card": "#ffffff",
      "ink": "#1b1636",
      "muted": "#5d5684",
      "line": "#b9b2e3",
      "rim": "#07060f",
      "codeBg": "#f6f5fd",
      "sysInk": "#0088b3",
      "cmdInk": "#6a3ae6",
      "fireInk": "#d4143a",
      "hl": "#0e8a5f"
    }
  },
  "font": {
    "sans": "Inter, \"SF Pro Display\", \"Segoe UI\", system-ui, -apple-system, Arial, sans-serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "body": "16px/1.6 sans",
    "h1": "800 clamp(52px, 7.4vw, 104px)/0.92 sans, -0.05em",
    "h2": "800 clamp(32px, 4.4vw, 54px)/1.02 sans, -0.035em",
    "eyebrow": "700 11px/1.4 mono, 0.16em, uppercase",
    "wordmark": "mono 19px, 0.1em: FIZLET"
  },
  "key": {
    "base": { "border": "2px", "radius": "6px", "minHeight": "40px", "shadow": "0 3px 0 #3b3170" },
    "arcade": { "radius": "10px", "minHeight": "44px", "font": "700 12px mono", "text": "#07060f", "border": "#07060f" },
    "arcadeShadow": {
      "go": "0 4px 0 #1e7657",
      "sys": "0 4px 0 #0f6f7b",
      "cmd": "0 4px 0 #49307b",
      "attack": "0 4px 0 #771845"
    },
    "sticker": { "face": "#10233f", "icon": "#19f0ff", "border": "#f6f3ff", "shadow": "0 5px 0 #f6f3ff", "radius": "12px" },
    "roles": { "go": "start, try it", "sys": "read, navigate", "cmd": "Recall", "attack": "Blast, play" }
  },
  "shadow": {
    "panel": "0 6px 0 #3f296a",
    "install": "0 4px 0 #3f296a",
    "chip": "0 3px 0 #3f296a",
    "sticker": "0 3px 0 #07060f"
  },
  "radius": { "panel": "14px", "hint": "12px", "code": "10px", "chip": "8px", "tag": "5px" },
  "layout": { "page": "1200px", "gutter": "30px", "minWidth": "320px", "testedAt": "360px" }
}
```

<!-- src: colours src/ui/tokens.json:8-35 and src/ui/board-ui.css:15-62; codeBg/hl site/site.css:13,19-20;
fonts site/site.css:6-7,40,98-108,132-143,246-249,468-473; keys src/ui/tokens.json:46-49, board-ui.css:80-98,155-174,376-394;
shadows site/site.css:122,184,508,1180; layout site/site.css:8-9,39. panelBase and arcadeShadow are the shipped
color-mix() values resolved to hex: --base = cmd 38% into rim (site.css:11); arcade edge = face 45% into rim (board-ui.css:158). -->

## Rules

1. **Flat paint.** Solid hex faces. No gradients, no blur, no glow on anything new.
2. **Shadows are hard and straight below** (x 0, blur 0). Never to the side, never on the diagonal.
3. **Every key, sticker and card sits on the ink rim** `#07060f`, the same in both themes.
4. **Colour is a job, not decoration:** go = start, sys = read and navigate, cmd = Recall and lit
   panels, attack = emphasis and play. One role per key.
5. **Never fork the 3D key.** Anything new for a key goes into the kit and `BOARD-UI.md` first.
6. **Grids are the board.** Background grids are 1px lines at 44px (hero), 30px, 22px or 20px.
7. **Numbers on the page are measured.** Sizes are read from `scripts/sizes.mjs` at build time,
   never typed in. Diagrams use real counts and real defaults.
8. **Section heads:** a tilted number sticker (−4°) and a mono caps kicker, a two-line `h2` whose
   second line is an `<em>` in attack pink, then a lead paragraph. <!-- src: site/site.css:114-125, 149-153 -->
9. **System fonts only**, inline SVG line icons on a 20px grid, static HTML, no framework.
   <!-- src: site/layout.mjs:16-37, 71-73 -->
10. **The byline** "by Chris Cooley" links to <https://coded.design/> on every page.
11. **Dark is the default**; light swaps in the `-ink` twins for thin neon text. Reduced motion
    turns every kit animation and transition off and hides the launch burst.
    <!-- src: site/layout.mjs:59; src/ui/board-ui.css:857-866; site/site.css:32-36 -->
12. Nothing overflows sideways at 360px, and every key keeps its focus ring.

## The shared 3D key

The one component every brand shares. A **face over a hard base straight below it**, moving on
one curve so the two never snap apart. <!-- src: src/ui/board-ui.css:69-78 -->

- **States:** rest · hover (fine pointers only, lifts 1–2px) · press (face drops onto the base) ·
  locked (`aria-pressed="true"`, rests down) · call (a ring leaves the base) · disabled.
- **Families on the site:** `.bui-arcade` + role for every call to action; `.bui-icon-key` for the
  header's GitHub and theme keys; `.bui-sticker` for the RECALL / RESTORED slam.
  <!-- src: site/pages/index.mjs:178-179; site/layout.mjs:86-88 -->
- **Focus** wraps the face *and* the base: a 3px background gap, then a 6px `sys-ink` ring.
  <!-- src: src/ui/board-ui.css:137-151 -->
- **Motion:** transform + shadow 120ms ease-out, press 50ms. <!-- src: src/ui/tokens.json:56 -->

## Current styles (documented, Phase 2 lock)

What ships on the Fizlet site today, recorded as is.

- **Shell:** sticky header with the Fizlet mark (three pixel bubbles fizzing up a cyan grid tile,
  one popping pink), the wordmark `DOM ENGINE V0.5.1` / **FIZLET** in mono, nav, GitHub, theme and
  a green **Start** key. <!-- src: site/layout.mjs:39-41, 78-91 -->
- **Footer base** reads "© 2026 coded.design · MIT licence · no runtime dependencies" and "Created
  by Chris Cooley", with Chris Cooley linked to https://coded.design/. <!-- src: site/layout.mjs:133 -->
- **Panels:** `--card` face, 2px `--line` border, 14px radius, `0 6px 0` hard base. <!-- src: site/site.css:179-185 -->
- **Hero:** "The page / *is the board.*" beside a live demo on a gridded `your.page` board, with
  Blast and Recall keys and a live `engine.stats()` strip. <!-- src: site/pages/index.mjs:175-195 -->
- **Diagrams in kit pieces:** the read → step → render stack, one rAF for many engines, the ledger,
  size chips with a budget bar, the roadmap. Mechanism, never illustration.
- **Theme** is shared with DOM VIRUS and DOM Battlefield through one stored choice.
  <!-- src: site/layout.mjs:74 -->

## Exceptions (Phase 2 lock)

These shipped styles are not flat. They are documented here and stay as they are; the tokens above
hold the flat target for new pages. All glows are off in the light theme.

- **Board UI arcade key glow:** a soft halo at rest, hover and press (14 / 18 / 22u at 40 / 55 / 70%),
  and a breathing glow when locked. <!-- src: src/ui/board-ui.css:161-163, 181-188; src/ui/tokens.json:40 -->
- **Other kit glows and washes:** dock and stick halos, the comms LED, two radial fills.
  <!-- src: src/ui/board-ui.css:539, 654, 663, 802-835 -->
- **Lit panel glow** around `.panel.lit` (dark theme). <!-- src: site/site.css:186-189 -->
- **Header** `backdrop-filter` blur over a translucent background. <!-- src: site/site.css:199-200 -->
- **Hero** radial violet wash and a masked grid fade. <!-- src: site/site.css:449, 458 -->
- **Text glow** on the hero `em` and the demo's hot letters. <!-- src: site/site.css:476, 600 -->
- **LED dots** with a small halo. <!-- src: site/site.css:130, 773, 1084 -->
- **Blitz card** pink radial wash. <!-- src: site/site.css:1266 -->
- **Grid lines** are drawn with 1px linear-gradient stripes (hard lines, no fade).
  <!-- src: site/site.css:456-457, 573-574, 921-922, 1516-1517, 1539-1540 -->

None of these go inside a demo board, a canvas or a game.
