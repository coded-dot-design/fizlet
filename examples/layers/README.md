# Layers: a game is a stack

A landing-page story graphic. A Battlefield Blitz-style board plays, turns and fans out into its
eight layers (real DOM layers in CSS 3D), each labelled with the bytes Blitz's own code spends on
it. The collision layer faults red, a scan patches it, it flashes green, and the stack folds back
into the game. It wears the Board UI kit (`src/ui`, from DOM Battlefield): every colour is a kit
token, the on-screen control is the kit's arcade fire key, and the figure is a `.bui` root, so the
host page loads `board-ui.css`. By [Chris Cooley](https://coded.design/).

![The story, one cycle](screens/layers.gif)

- Source: [`site/demos/layers/`](../../site/demos/layers/) (`scene.ts` the scene, `poster.ts` the
  slot markup, still poster and inline loader, `entry.ts` the live chunk's entry, `data.ts` the
  layers and bytes).
- Build: `node site/demos/layers/build.mjs [outDir]` (default `site-dist/demos/layers/`). This page
  template is `page.mjs`.
- Measure: `node site/demos/layers/measure.mjs` writes `site/demos/layers/measured.json`; the
  caption prints only those numbers.
- Test: `npm run test:layers` (mounts, cycles once, settles, Recall is exact; reduced motion; no JS
  before the slot is near; the hero budgets).

## Embed it

```html
<!-- poster(): the slot figure with its poster inline; POSTER_CSS in a <style> -->
<figure class="ae-slot lyr bui" data-slot-target="index#layers" role="img" aria-label="…">…</figure>
<!-- loader("demos/layers/layers.js"): ~300 B inline; imports the live chunk when the slot is near -->
<script type="module">…</script>
```

Optional data attributes on the figure: `data-loops` (cycles before it settles, default 3),
`data-settle` (quiet seconds, default 0.5), `data-speed` (story clock, default 1).

## Behaviour

- **Lazy:** no JS file loads up front. A ~300 B inline loader imports `layers.js` (`fizlet/slot`
  and the scene, one file) when the slot comes within 200px or is tapped; the slot then waits for an
  idle main thread and mounts the scene. The tap that triggers the load is not replayed (the scene
  takes no tap input; a pointer only wakes a settled scene).
- **Calm:** 30 fps cap; after `data-loops` cycles it rests on the game frame and the kernel settles
  (no `requestAnimationFrame` at all). A pointer on the slot runs one more cycle. Off screen or in a
  hidden tab it pauses.
- **Reduced motion:** nothing loads; the poster shows the still exploded view with every
  label (CSS only, sized by container queries).
- **Accessible:** the figure is `role="img"` with an `aria-label` describing the whole sequence.
- **Recall:** `destroy()` gives the page back exactly.

## Measured

See `site/demos/layers/measured.json`. On Fizlet 0.8.1, Chromium 153: live chunk 10,054 B gzip
(`fizlet/slot` + scene, loaded only once the slot is near); poster and loader inline 2,962 B gzip
(loader 308 B); at 4× CPU throttle, script per frame 0.8 ms median, 2.6 ms p95, 6.3 ms max; layout
shift 0; 0 frames once settled; 0 B of JS fetched before the slot nears the viewport.

Against the hero budgets in fizlet-engine `docs/LAYERS.md`: live chunk ≤ 10 KB ✔, poster ≤ 6 KB ✔,
0 B JS before the slot is near ✔, CLS 0 ✔, 0 frames settled ✔. `npm run test:layers` fails the
build if the live chunk or the poster goes over.

How it fits: the tanks patrol fixed loops (the dotted rectangles on the movement layer), so the hero
carries no path search and no `fizlet/grid` (−1.5 KB); slot and scene ship as one file loaded by the
inline loader; the scene's state styles live in the page CSS; the stack's bounds are precomputed
(`build.mjs` checks them against the formula). Bricks in the live chunk: kernel, slot, sprite, fx.
