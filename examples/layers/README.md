# Layers: a game is a stack

A landing-page story graphic. A Battlefield Blitz-style board plays, turns and fans out into its
eight layers (real DOM layers in CSS 3D), each labelled with the bytes Blitz's own code spends on
it. The collision layer faults red, a scan patches it, it flashes green, and the stack folds back
into the game. It wears the Board UI kit (`src/ui`, from DOM Battlefield): every colour is a kit
token, the on-screen control is the kit's arcade fire key, and the figure is a `.bui` root, so the
host page loads `board-ui.css`. Visitors can drive it: a play/pause key and a 3D slider that scrubs
the explode/assemble timeline. By [Chris Cooley](https://coded.design/).

![The story, one cycle](screens/layers.gif)

- Source: [`site/demos/layers/`](../../site/demos/layers/) (`scene.ts` the scene, `poster.ts` the
  slot markup, still poster and inline loader, `entry.ts` the live chunk's entry, `data.ts` the
  layers and bytes).
- Build: `node site/demos/layers/build.mjs [outDir]` (default `site-dist/demos/layers/`). This page
  template is `page.mjs`.
- Measure: `node site/demos/layers/measure.mjs` writes `site/demos/layers/measured.json`; the
  caption prints only those numbers.
- Test: `npm run test:layers` (mounts, cycles once, settles, Recall is exact; labels never collide;
  the controls by keyboard and pointer, with and without the scene; reduced motion; no JS before the
  slot is near; the hero budgets).

## Embed it

```html
<!-- poster(): the slot figure with its poster and controls inline; POSTER_CSS in a <style> -->
<figure class="ae-slot lyr bui" data-slot-target="index#layers" aria-label="The layers story" aria-describedby="lyr-d">…</figure>
<!-- loader("demos/layers/layers.js"): ~850 B inline; the controls' controller, and it imports the
     live chunk when the slot is near -->
<script type="module">…</script>
```

Optional data attributes on the figure: `data-loops` (cycles before it settles, default 3),
`data-settle` (quiet seconds, default 0.5), `data-speed` (story clock, default 1).

## Behaviour

- **Controls:** a play/pause key (the kit's arcade key, `go`) on one side and a slider on the other:
  vertical down the right edge when the slot is wide, along the bottom when it is tall. The slider is
  a small copy of the stack (eight tilted plates on a kit rail, the collision plate in green) that
  fans out as the real one does, with the kit's arcade key as its knob. It scrubs the
  explode/assemble timeline: 0 assembled (the game), 100 exploded (every label in). Dragging or keys
  pause the story; play resumes it from that pose. `role="slider"` with arrows (±5), Page Up/Down
  (±25), Home and End; touch and mouse drag; the kit's focus ring on the knob. One writer at a time:
  before the scene loads (and under reduced motion) the inline controller moves the slider and the
  poster itself; once the scene is mounted it forwards input as a `lyr` event and the scene writes
  the controls through its ledger, so Recall gives them back exactly.
- **Lazy:** no JS file loads up front. An ~850 B inline script (the controls' controller and loader) imports `layers.js` (`fizlet/slot`
  and the scene, one file) when the slot comes within 200px or is tapped; the slot then waits for an
  idle main thread and mounts the scene. The tap that triggers the load is not replayed (the scene
  takes no tap input; a pointer only wakes a settled scene).
- **Calm:** 30 fps cap; after `data-loops` cycles it rests on the game frame and the kernel settles
  (no `requestAnimationFrame` at all). Paused, or after a scrub, it settles too; play runs it again.
  Off screen or in a hidden tab it pauses.
- **Labels:** shown only while the stack is fully open, never while it moves. The exploded gap
  widens on narrow slots to keep a 28px label pitch, and the scene measures its widest label at
  mount, so labels never overlap, clip or smear at any width (`npm run test:layers` checks a full
  cycle at 390 and 1440).
- **Reduced motion:** the scene never loads and the play key is hidden; the poster shows the still
  exploded view with every label (CSS only, sized by container queries). The slider still scrubs it:
  one CSS variable (`--e`) poses the poster, so dragging moves it with no animation running.
- **Accessible:** the figure is labelled "The layers story" and described (`aria-describedby`) by a
  visually hidden paragraph that tells the whole sequence; the picture itself is `aria-hidden`, the
  controls are real, labelled controls.
- **Recall:** `destroy()` gives the page back exactly.

## Measured

See `site/demos/layers/measured.json`. On Fizlet 0.10.1, Chromium 153: live chunk 9,716 B gzip
(`fizlet/slot` + scene, loaded only once the slot is near); poster, controls and inline script
5,253 B gzip (script 848 B); at 4× CPU throttle, script per frame 1.0 ms median, 3.0 ms p95, 5.7 ms
max; layout shift 0; 0 frames once settled; 0 B of JS fetched before the slot nears the viewport.

Against the hero budgets in fizlet-engine `docs/LAYERS.md`: live chunk ≥ 5% under 10 KB ✔, poster ≤ 6 KB ✔,
0 B JS before the slot is near ✔, CLS 0 ✔, 0 frames settled ✔. `npm run test:layers` fails the
build if the live chunk or the poster goes over.

How it fits: the tanks patrol fixed loops (the dotted rectangles on the movement layer), so the hero
carries no path search and no `fizlet/grid` (−1.5 KB); slot and scene ship as one file loaded by the
inline loader; the scene's state styles live in the page CSS; the stack's bounds are precomputed
(`build.mjs` checks them against the formula). Bricks in the live chunk: kernel, slot, sprite, fx.
