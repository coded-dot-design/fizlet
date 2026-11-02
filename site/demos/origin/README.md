# Origin: Code. Sleep. Drink. Repeat.

The origin hero, by Chris Cooley. A desk seen from above through one day: he sleeps at night, wakes with the sun, puts the headphones on, drinks his coffee and codes all day on the laptop and the phone, then night falls and he sleeps. The title flips to "Design. Sleep. Drink. Repeat." and the screens switch from code to design work. The headphones, coffee and laptop are the 2015 portfolio props; in the 2015 look the cup is the 2015 sprite sheet itself (`coffee.png`, 6,961 B).

**Two looks, one scene.** Inspired by the original 2015 portfolio, with Fizlet flair (`ORIGIN_CREDIT` in `copy.ts`). **Fizlet** (the default) is cyberpunk × Tron in flat colours: the same shapes repainted from the site's Board UI tokens (`--k-sys`, `--k-cmd`, `--k-attack`, `--k-go`, `--k-advance`, `--hurt`, `--k-flag` on the `--rim` night, the fallbacks being their dark values), plus the desk grid, neon edge lines (a wide faint stroke under a thin one) and pixel patterns (the cap's mesh, the spill). Like the home hero's stage it stays night in both themes. **2015** is the flat portfolio palette. The look is one class on the wrapper (`og--fz`), so the toggle costs no markup.

**Him.** A backwards trucker cap seen from above: the mesh crown and its seams, the foam panel and the bill toward you, the snapback strap at the front. The headphones' band goes over the cap and a cup sits over each ear; on the desk they lie open. Each arm is two bones (`arm()` in `art.ts`): a short upper arm under the sleeve (seen from above it hangs down), the elbow out, a tapered forearm, a hand with fingers and a thumb. Generic and stylised.

**The cup is a toy.** Tap: a sip (the nearer hand reaches it, then brings it up). Double-tap: a refill (a pot pours, the level comes back to full, steam). Drag: it lifts (bigger, its shadow grows and drifts) and goes down anywhere on the desk that is on screen; near the saucer it snaps back on. Flick (faster than 1,300 px/s at release): it knocks over, slides, and a puddle spreads (coffee in 2015, pixels in Fizlet); tap the spill, or wait 5 s, and it rights itself and refills. Out of his reach, he cannot sip. The cup's key target (`.og-grip`, at least 44 px) is focusable: Enter sips, R refills, the arrow keys move it, K knocks it over. Every press squashes on the next frame and pops on release (a spring on the kernel), with a tap sound once sound is unlocked. Changes are said in a polite `role="status"` line.

**The rest of the desk.**
- **The laptop:** seen from above, the open lid is as wide as the base at the hinge (a hinge bar), a little narrower at its far edge, and foreshortened to about two thirds of the base's depth. The screens are drawn foreshortened onto it.
- **Him:** broad shoulders and a V-shaped back (trapezius, shoulder blades). Each arm (`armD()` in `art.ts`) is a sleeve over the deltoid, a biceps swell, the elbow, and a forearm that tapers to the wrist.
- **Typing:** each hand types on random keys in its half, from a seeded generator (the `seed` option; never `Math.random`, no allocation in the step). The key lights up in the look's accent and fades. In design mode the right hand goes to the trackpad now and then.
- **The plant** (tap, or Enter): a can pours, drops spill around the pot and fade over 1 to 3 s, and it perks up.
- **The notebook** (tap, or Enter): his hand goes to it and he writes a line of code, or draws a star, a heart, a happy face, a lightning bolt, a triangle, a square, a house or a sun. The stroke draws on; the last three stay.
- **The lamp** (tap, or Enter): its pool and cone of light go off and on, and the night over the room lifts a little while it is on. It is the visitor's switch, independent of the day: the day no longer turns it on and off.
- **The phone** (tap, or Enter): the music changes from country to rock to pop and back.
  - Each genre is a one-bar loop with its own tempo, steps and synth voices, and no samples. It is scheduled 0.2 s ahead on the audio clock (`@fzlt/core/sound`'s `play(cue, 1, at)` and `time`), so it never drifts and has no gap at the seam.
  - A change waits for the next bar line, which sounded cleaner than a crossfade on these short voices.
  - The ♪ notes (their words, colours and rate) and his head bob follow the genre. The phone's screen shows the genre.
  - A double-tap (or Space, or P) pauses and resumes the loop. A tap waits 250 ms before it changes the genre, so a double-tap never does; that is cleaner than changing and reverting.
  - The button's name is "Music: rock. Change style", with ", paused" when paused.
  - The Sound key stays the master. Pausing the scene, going off screen, sleep and reduced motion stop the loop.

Page: `demos/origin/` (built by `build.mjs`, run from `scripts/site.mjs`). Test: `tests/origin.mjs` (in `npm run test:browser`).

## Mount API

```ts
import { mount, mountSlot } from "./scene";           // built: demos/origin/scene.js
import { ORIGIN_WHY, ORIGIN_WHY_BEATS, ORIGIN_TITLE } from "./copy";

mount(root: HTMLElement, opts?: {
  mode?: "code" | "design";   // what the screens show (default "code")
  look?: "fizlet" | "2015";   // the look (default "fizlet")
  sound?: boolean;            // armed (default true); silent until the visitor's first gesture
  showBricks?: boolean;       // label every moving part with its brick + gzip bytes
  reducedMotion?: boolean;    // default: prefers-reduced-motion
  controls?: boolean;         // the scene's key row: 2015 / Fizlet, Design mode, Show bricks, Sound, Pause (default true)
  speed?: number;             // clock speed (default 1: one day is 24 s)
  cup?: string;               // URL of coffee.png (default: next to scene.js)
  bricks?: Record<string, number>; // label sizes (default: measured by the build)
  seed?: number;              // his typing and doodles (default 2015): the same seed types the same keys
}) => {
  destroy(); setMode(m); setLook(l); setShowBricks(on); setSound(on); setLaptop(open);
  sip(); refill(); knock(angle?); nudge(); water(); write(); setLamp(on); pause(); play();
  readonly state: { mode, look, open, bricks, sound, paused, awake }; accessible: boolean;
  stats(): { particles, zzz, cup: { x, y, level, spilled, lifted }, toys, drops, pages, lamp, lit, keys, music: { genre, playing, paused, bars } };
  // toys: 0 once every toy's motion settles; keys: the first 32 keys typed; bars: when the loop's last bars began
}

// @fzlt/core/slot (the house way): slot(figure, () => import("./scene.js").then((m) => m.mountSlot))
// reads data-mode="design", data-look="2015", data-bricks="1", data-sound="0", data-speed from the figure.
```

- **Size and shape:** it fills `root` (give it a size). Drawn for 16:10; it crops to any shape around the middle (4:5 on phones keeps the laptop, phone, cup and him). If `root` is `position: static` it is made relative through the ledger (given back on destroy).
- **Poster:** `build.mjs` exports `poster(cup, look)` and `POSTER_CSS`: the same art, mid-morning, as static SVG (no JS), with the why caption and the credit, in the Fizlet look by default (`look = "2015"` drops the class). Use it as the slot placeholder and the reduced-motion still.
- **Events:** `origin:state` (bubbles) on `root` whenever the look, mode, lid, bricks, sound or pause change; `detail` is `state` (with `look`).
- **Accessible:** real buttons in the key row (the look key is `aria-pressed` for the Fizlet look), the laptop is a focusable button (Enter or Space closes and opens it), so is the cup (Enter, R, K, the arrows), the why is real text, and changes are said politely. So the scene returns `accessible: true` and @fzlt/core/slot drops `role="img"` from the figure: mount it in a figure **without** `role="img"` (slot's Ledger re-adds a removed attribute at the end of the attribute list, so a figure with one is not byte-exact after destroy; the demo page's figure has none).
- **Why copy:** `copy.ts` holds `ORIGIN_WHY`, the one source for the "why Fizlet exists" line (Chris, 2026-10-31). The scene shows it as four beats over the day (night: before; dawn: in between; day: we built it; afternoon: we shared it), with the whole line in the DOM for screen readers; under reduced motion and in the poster the whole line shows.

## Bricks (gzip, each brick alone, `npm run size`, this build)

| Brick | Bytes | What it moves |
|---|---|---|
| kernel | 3,413 | One loop at 30 fps, settle, auto-pause off screen and in a hidden tab, the ledger |
| @fzlt/core/timeline | 2,120 | The day/night cycle (sky, shade, sun, window light) on custom properties; wake/sleep, sip, pour, spill and the watering can on typed arrays |
| @fzlt/core/fx | 2,797 | ♪ notes, steam, sparks of code (swatch chips in design mode), the splash, the Zzz |
| @fzlt/core/sound | 1,073 | The phone's three looping genres on the audio clock, key clicks, the sip, taps, the pour, the spill, the scribble, the lamp, wake and sleep cues |
| @fzlt/core/input | 1,335 | The pointer (taps, the cup's drag and flick, double-taps on the cup and the phone); the keys of the lid, cup, plant, notebook, lamp and phone |
| @fzlt/core/sprite | 1,437 | The pixel coder on the phone (spriteURL) |
| @fzlt/core/slot | 1,819 | The page's loader (main.js) |

The live chunk (`scene.js`: six bricks + the scene, tree-shaken) is printed by the build and on the page: **32,755 B gzip** on this build. It grew from 28,156 B (before the plant, notebook, lamp, key lights and new body: +3,454 B to 31,610 B; the phone's loops: +1,145 B). The loader is 2,100 B, and the inline poster is 5,987 B (5,120 B before), the same markup for both looks.

## Rules

Off screen or in a hidden tab the kernel pauses it (0 rAF/s); `pause()` rests it at 0 rAF/s; reduced motion: a still day, the laptop still closes and opens with a 1.6 s CSS crossfade of the lighting, no particles, no typing, the cup's toys change state with no animation (no squash, no pour, the spill whole at once), settled at 0 rAF/s; every toy settles (`stats().toys` back to 0); sound only after a trusted gesture, with the Sound key to mute; the step writes only typed arrays (render writes the DOM, change-only); destroy() gives the root back byte for byte. All checked in `tests/origin.mjs`.
