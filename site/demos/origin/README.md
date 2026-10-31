# Origin: Code. Sleep. Drink. Repeat.

The origin hero, by Chris Cooley. A desk seen from above through one day: he sleeps at night, wakes with the sun, puts the headphones on, drinks his coffee and codes all day on the laptop and the phone, then night falls and he sleeps. The title flips to "Design. Sleep. Drink. Repeat." and the screens switch from code to design work. The headphones, coffee and laptop are the 2015 portfolio props; the cup is the 2015 sprite sheet itself (`coffee.png`, 6,961 B).

Page: `demos/origin/` (built by `build.mjs`, run from `scripts/site.mjs`). Test: `tests/origin.mjs` (in `npm run test:browser`).

## Mount API

```ts
import { mount, mountSlot } from "./scene";           // built: demos/origin/scene.js
import { ORIGIN_WHY, ORIGIN_WHY_BEATS, ORIGIN_TITLE } from "./copy";

mount(root: HTMLElement, opts?: {
  mode?: "code" | "design";   // what the screens show (default "code")
  sound?: boolean;            // armed (default true); silent until the visitor's first gesture
  showBricks?: boolean;       // label every moving part with its brick + gzip bytes
  reducedMotion?: boolean;    // default: prefers-reduced-motion
  controls?: boolean;         // the scene's key row: Design mode, Show bricks, Sound, Pause (default true)
  speed?: number;             // clock speed (default 1: one day is 24 s)
  cup?: string;               // URL of coffee.png (default: next to scene.js)
  bricks?: Record<string, number>; // label sizes (default: measured by the build)
}) => {
  destroy(); setMode(m); setShowBricks(on); setSound(on); setLaptop(open);
  pause(); play(); readonly state: { mode, open, bricks, sound, paused }; accessible: boolean;
}

// fizlet/slot (the house way): slot(figure, () => import("./scene.js").then((m) => m.mountSlot))
// reads data-mode="design", data-bricks="1", data-sound="0", data-speed from the figure.
```

- **Size and shape:** it fills `root` (give it a size). Drawn for 16:10; it crops to any shape around the middle (4:5 on phones keeps the laptop, phone, cup and him). If `root` is `position: static` it is made relative through the ledger (given back on destroy).
- **Poster:** `build.mjs` exports `poster()` and `POSTER_CSS`: the same art, mid-morning, as static SVG (no JS), with the why caption. Use it as the slot placeholder and the reduced-motion still.
- **Events:** `origin:state` (bubbles) on `root` whenever mode, lid, bricks, sound or pause change; `detail` is `state`.
- **Accessible:** real buttons in the key row, the laptop is a focusable button (Enter or Space closes and opens it), the why is real text. So the scene returns `accessible: true` and fizlet/slot drops `role="img"` from the figure: mount it in a figure **without** `role="img"` (slot's Ledger re-adds a removed attribute at the end of the attribute list, so a figure with one is not byte-exact after destroy; the demo page's figure has none).
- **Why copy:** `copy.ts` holds `ORIGIN_WHY`, the one source for the "why Fizlet exists" line (Chris, 2026-10-31). The scene shows it as four beats over the day (night: before; dawn: in between; day: we built it; afternoon: we shared it), with the whole line in the DOM for screen readers; under reduced motion and in the poster the whole line shows.

## Bricks (gzip, each brick alone, `npm run size`, this build)

| Brick | Bytes | What it moves |
|---|---|---|
| kernel | 3,413 | One loop at 30 fps, settle, auto-pause off screen and in a hidden tab, the ledger |
| fizlet/timeline | 2,120 | The day/night cycle (sky, shade, sun, window light, lamp) on custom properties; wake/sleep and sip on a typed array |
| fizlet/fx | 2,797 | ♪ notes, steam, sparks of code (swatch chips in design mode), the Zzz |
| fizlet/sound | 1,019 | The beat, key clicks, the sip, wake and sleep cues |
| fizlet/input | 1,335 | Taps on the laptop, cup, phone and headphones; the lid key |
| fizlet/sprite | 1,437 | The pixel coder on the phone (spriteURL) |
| fizlet/slot | 1,819 | The page's loader (main.js) |

The live chunk (`scene.js`: six bricks + the scene, tree-shaken) is printed by the build and on the page: **19,533 B gzip** on this build; loader 2,100 B; inline poster 3,551 B.

## Rules

Off screen or in a hidden tab the kernel pauses it (0 rAF/s); `pause()` rests it at 0 rAF/s; reduced motion: a still day, the laptop still closes and opens with a 1.6 s CSS crossfade of the lighting, no particles, no typing, settled at 0 rAF/s; sound only after a trusted gesture, with the Sound key to mute; the step writes only typed arrays (render writes the DOM, change-only); destroy() gives the root back byte for byte. All checked in `tests/origin.mjs`.
