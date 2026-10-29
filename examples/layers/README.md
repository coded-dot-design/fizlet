# Layers: a game is a stack

A landing-page story graphic. A Battlefield Blitz-style board plays, turns and fans out into its
eight layers (real DOM layers in CSS 3D), each labelled with the bytes Blitz's own code spends on
it. The collision layer faults red, a scan patches it, it flashes green, and the stack folds back
into the game. By [Chris Cooley](https://coded.design/).

![The story, one cycle](screens/layers.gif)

- Source: [`site/demos/layers/`](../../site/demos/layers/) (`scene.ts` the scene, `poster.ts` the
  slot markup and still poster, `entry.ts` the host script, `data.ts` the layers and bytes).
- Build: `node site/demos/layers/build.mjs [outDir]` (default `site-dist/demos/layers/`). This page
  template is `page.mjs`.
- Measure: `node site/demos/layers/measure.mjs` writes `site/demos/layers/measured.json`; the
  caption prints only those numbers.
- Test: `npm run test:layers` (mounts, cycles once, settles, Recall is exact; reduced motion).

## Embed it

```html
<!-- poster(): the slot figure with its poster inline; POSTER_CSS in a <style> -->
<figure class="ae-slot lyr" data-slot-target="index#layers" role="img" aria-label="…">…</figure>
<script type="module" src="demos/layers/entry.js"></script>
```

Optional data attributes on the figure: `data-loops` (cycles before it settles, default 3),
`data-settle` (quiet seconds, default 0.5), `data-speed` (story clock, default 1).

## Behaviour

- **Lazy:** only the slot (`fizlet/slot`) loads up front; the scene chunk loads when the slot nears
  the viewport and the main thread is idle.
- **Calm:** 30 fps cap; after `data-loops` cycles it rests on the game frame and the kernel settles
  (no `requestAnimationFrame` at all). A pointer on the slot runs one more cycle. Off screen or in a
  hidden tab it pauses.
- **Reduced motion:** the scene never loads; the poster shows the still exploded view with every
  label (CSS only, sized by container queries).
- **Accessible:** the figure is `role="img"` with an `aria-label` describing the whole sequence.
- **Recall:** `destroy()` gives the page back exactly.

## Measured

See `site/demos/layers/measured.json`. On Fizlet 0.5.1, Chromium 153: live chunk 12,407 B gzip
(slot 1,957 B up front, scene 10,450 B lazy), poster 2,500 B gzip inline; at 4× CPU throttle,
script per frame 0.9 ms median, 4.9 ms p95; layout shift 0; 0 frames once settled; 0 scene bytes
before the slot nears the viewport.

Against the hero budgets in fizlet-engine `docs/LAYERS.md`: poster ≤ 6 KB ✔, CLS 0 ✔, 0 frames
settled ✔, **live chunk ≤ 10 KB ✘ (12.1 KB)**: kernel + slot + grid + sprite + fx take most of it.
The slot's 1,957 B also load before the slot is near (the budget says 0 B).
