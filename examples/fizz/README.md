# Fizz: a Fizlet hero

By [Chris Cooley](https://coded.design/). The live page is at
<https://coded-dot-design.github.io/fizlet/demos/fizz/>; the source is in
[`site/demos/fizz/`](../../site/demos/fizz/).

An 80s arcade soda can: the tab pops, fizz sprays from the opening, a drip runs down the side and
the page itself zooms in on it. It mounts through `fizlet/slot`, so it can be a hero or a story
graphic, and it is built from the kernel (`settle` + `fps`), `fizlet/fx` and `fizlet/sprite` only.

```html
<div style="overflow: clip">                     <!-- clips the zoom -->
  <main data-fizz-zoom>                          <!-- "the page": this is what zooms -->
    <figure class="ae-slot" data-slot-target="fizz#hero" role="img" aria-label="A pixel soda can pops open and fizzes">
      <svg class="ae-slot__placeholder">…the still frame…</svg>
    </figure>
  </main>
</div>
<script type="module">
  import { slot } from "fizlet/slot";
  slot("fizz#hero", () => import("./scene.js").then((m) => m.mount));
</script>
```

- **Lazy:** nothing but the slot loads until the figure is near the viewport and the main thread
  is idle. A tap before then loads it at once and pops the tab.
- **Reduced motion:** the scene never loads; the poster is the still frame.
- **Settles:** the engine runs at 30 fps while something moves, then sleeps (no frames at all).
- **Recall:** `destroy()` removes the canvas and gives back every style the zoom wrote, exactly.

Run it: `npm run site`, serve `site-dist/`, open `/examples/fizz/`. [index.html](index.html) is the
whole host page.
