# Origin: the home page's origin hero

The Origin section sits on the home page right after the hero and its stats strip. It holds the title
loop ("Code. Sleep. Drink. Repeat.", with a toggle to "Design. Sleep. Drink. Repeat."), the Sound key,
the hero stage (the 2015 desk at night) and, below it, 2015 by hand against Fizlet. By Chris Cooley.

| File | What |
|---|---|
| `section.mjs` | The section's HTML (the home page module calls `originSection()`) |
| `poster.mjs` | The poster SVG: first paint, the reduced-motion still, the placeholder scene's art |
| `contract.ts` | The mount contract, as types |
| `main.ts` → `origin/main.js` | The loader: the toggle, the sound gate, `fizlet/slot` |
| `scene.ts` → `origin/scene.js` | **The placeholder scene.** The origin-story scene replaces this file |
| `build.mjs` | Builds both scripts and measures them (gzip) for the size badge |

The CSS lives in `site/site.css`, between `ORIGIN` and `END ORIGIN`.

## The mount contract (for the scene)

`scene.ts` has one export:

```ts
export function mount(figure: HTMLElement, opts: OriginOptions): { destroy(): void }

interface OriginOptions {
  reduced: boolean;      // prefers-reduced-motion when mounted
  sound: SoundGate;      // the page's one sound gate
  stage: HTMLElement;    // the contained box to draw in (made and removed by the slot)
  first: SlotTap | null; // the tap that woke the scene, if one did: { x, y, at }
}
interface SoundGate {
  readonly on: boolean;                          // true only after a gesture turned sound on
  ctx(): AudioContext | null;                    // the page's context while on, else null
  listen(fn: (on: boolean) => void): () => void; // called on every change; returns unsubscribe
}
```

Types: `contract.ts`. What the scene must do:

1. **Load lazily, through `fizlet/slot`.** The loader calls `slot(figure, load)`. The scene chunk is
   fetched only once the figure nears the viewport and the main thread is idle, or on a first tap. It
   is never part of first paint. Keep it in `scene.ts` and import only Fizlet bricks (`src/…`). No
   runtime dependencies.
2. **Draw inside `opts.stage`.** It is `position:absolute; inset:0; contain:strict`, sized to the
   figure. Never write to the figure itself; reading it is fine. The slot has already hidden the poster
   (`.ae-slot__placeholder`). Clone it if you want its art.
3. **Settle.** Create the engine with `settle` (and `fps` for ambient motion), and call `busy()` only
   while something moves. When idle, or when the figure is off screen, the page sees **0
   requestAnimationFrame calls**. Something scheduled for later holds the engine awake with
   `busy(sec)`. A tap (`pointerdown` on the figure) or a mode flip may wake it again.
4. **Read the mode.** `figure.dataset.mode` is `"code"` or `"design"`. Every flip also dispatches
   `origin:mode` on the figure (`detail`: the new mode). The poster's CSS already shows the matching
   laptop screen (`[data-mode] .og-code / .og-design`).
5. **Sound only through the gate.** Never create an `AudioContext`. Call `opts.sound.ctx()` when a cue
   plays. It returns `null` until the viewer turns sound on with a real press (and while muted), so
   nothing can play before a gesture. Never autoplay. The viewer's choice is saved by the loader
   (`localStorage` `fizlet:origin-sound`) and is not the scene's job.
6. **Recall is exact.** `destroy()` removes every node, style, attribute and listener the scene
   added. Use the engine's ledger and `engine.signal` for listeners. Afterwards the figure's
   `outerHTML` is byte for byte what it was before the mount. The test checks this.
7. **Reduced motion shows the poster.** Under `prefers-reduced-motion: reduce` the loader never mounts
   the scene, so the poster is the still frame. If `opts.reduced` is true (a scene mounted another way),
   draw one still frame and ask for no frames.
8. **The poster is required.** First paint and the reduced-motion frame are the SVG from `poster.mjs`,
   inside the figure. The real scene may replace that art too, as long as it stays an inline,
   `aria-hidden` `.ae-slot__placeholder` and keeps the stage's aspect ratio. The figure reserves its
   space with `aspect-ratio`: 16 / 9, or 1 / 1 at 600 px and below. CLS is 0.
9. **Accessible.** The figure is `role="img"` with an `aria-label`, and the stage is `aria-hidden`.
   Controls a viewer needs live outside the stage, like the toggle and the Sound key. If the scene adds
   its own buttons, they must be real buttons, 44 px, keyboard-operable.
10. **Measured.** `build.mjs` measures `scene.js` in gzip, and the size badge shows the number. Any
   number in the copy comes from a measurement, never from a guess.

`tests/site.mjs` ("origin") checks all of this. Swap the scene in, run
`npm run site && npm run test:site`, and the same checks hold the real scene to the contract.

## Today's placeholder

`scene.ts` clones the poster into the stage and plays a 4.5 s idle loop on the kernel, capped at 30 fps:
steam rises off the coffee, notes float off the headphones, the screen types its lines and the cursor
blinks. Then it settles to 0 frames. A tap or a mode flip plays the loop again. A tap blips only when
the gate is on.

## The grid

`.has-grid` and the `--grid-*` tokens live in `site/site.css`, in the `GRID` block. `page()` in
`site/layout.mjs` adds the class to every page's first section or article, which is its hero. The
same values are exported in `src/ui/tokens.json` (`grid`) for Battlefield, Blitz and DOM VIRUS. That
port is a follow-up.
