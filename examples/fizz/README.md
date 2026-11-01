# Fizz: a Fizlet hero

By [Chris Cooley](https://coded.design/). The live page is at
<https://coded-dot-design.github.io/fizlet/demos/fizz/>; the source is in
[`site/demos/fizz/`](../../site/demos/fizz/).

An 80s arcade soda can, side view and top-down view of the same moment. Tap it: the can crunches,
the tab pops, and the fizz sprays up and out of the card while a drip runs down the side. The camera
moves inside the card only: in on the opening, across to the view straight down into the can, then
home. It mounts through `@fzlt/core/slot`, so it can be a hero or a story graphic, and it is built from
the kernel (`settle` + `fps`), `@fzlt/core/fx`, `@fzlt/core/sprite` and `@fzlt/core/camera` only.

```html
<div>                                            <!-- the spray may fly over this box, and above it -->
  <figure class="ae-slot" data-slot-target="fizz#hero" role="img" aria-label="A pixel soda can, side and top views, crunches, pops and fizzes">
    <svg class="ae-slot__placeholder">…the still frame…</svg>
  </figure>
</div>
<script type="module">
  import { slot } from "@fzlt/core/slot";
  slot("fizz#hero", () => import("./scene.js").then((m) => m.mount));
</script>
```

- **Lazy:** nothing but the slot loads until the figure is near the viewport and the main thread
  is idle. A tap before then loads it at once and crunches the can.
- **Out of the card:** the spray draws on a layer over the figure's parent, reaching up above the
  card (over the card's width only). It never takes a pointer.
- **Reduced motion:** the scene never loads; the poster is the still frame.
- **Settles:** the engine runs at 30 fps while something moves, then sleeps (no frames at all).
- **Recall:** `destroy()` removes both canvases and gives back every style it wrote, exactly.

Run it: `npm run site`, serve `site-dist/`, open `/examples/fizz/`. [index.html](index.html) is the
whole host page.
