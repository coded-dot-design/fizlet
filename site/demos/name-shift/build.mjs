// The name shift's own page (demos/name-shift/): the launch logo animation, Fizlet → fzlt, as a
// full-screen hero. Built by scripts/site.mjs after the gallery, from the gallery's own build: the
// figure is the piece's poster (site/gallery/pieces/name-shift/art.ts), the live chunk is the
// gallery's (gallery/fizlet-to-fzlt.js) and the loader is the gallery's (gallery/gallery.js,
// @fzlt/core/slot), so every number on the page is the one its gallery card shows, measured on this build.
import { mkdirSync, writeFileSync } from "node:fs";
import { page, crumbs, esc } from "../../layout.mjs";
import { sizeBadge } from "../../size-badge.mjs";

export const ID = "fizlet-to-fzlt";
const fmt = (n) => n.toLocaleString("en-US");

/** `art`: the piece's art module (figure, CAPTION); `gallery`: buildGallery()'s result. */
export function buildNameShift({ out, version, gallery, art }) {
  const e = gallery.entries.find((x) => x.id === ID);
  if (!e) throw new Error(`demos/name-shift: no live gallery entry ${ID}`);
  const sizes = { live: e.size, loader: gallery.loader, total: e.size + gallery.loader };
  const fig = art.figure("name-shift#hero", { cls: " ns-hero" }).replace("<figure ", `<figure data-gallery="${ID}" `);
  const embed = `slot(figure, () => import("/gallery/${ID}.js").then((m) => m.mount))`;
  const body = `<style>
.ns-page { padding: 0 0 72px; }
.ns-page figure.ns-hero { position: relative; margin: 0; width: 100%; height: calc(100svh - 78px); min-height: 460px; max-height: 1100px; overflow: hidden; border-bottom: 2px solid var(--line); background: var(--bg); }
@media (max-width: 600px) { .ns-page figure.ns-hero { height: auto; min-height: 0; aspect-ratio: 1 / 1; } }
.ns-page .wrap { padding-top: 40px; }
.ns-title { font-size: clamp(34px, 5vw, 64px); line-height: 1; letter-spacing: -.04em; margin: 10px 0 16px; }
.ns-title span { font-family: var(--mono); letter-spacing: 0; color: var(--k-go); }
.ns-cap { margin: 14px 0 0; font: 12px/1.7 var(--mono); color: var(--muted); }
.ns-cap b { color: var(--ink); }
.ns-embed { overflow-x: auto; padding: 12px 14px; background: var(--code-bg); border: 2px solid var(--line); border-radius: 8px; font: 13px/1.6 var(--mono); }
</style>
<section class="ns-page" aria-labelledby="ns-title" data-demo-host>
  ${fig}
  <div class="wrap">
    ${crumbs("../../", [["gallery/", "Daily"]], "Fizlet → fzlt")}
    <p class="eyebrow"><span class="index">FZ</span> THE NAME SHIFT · A HERO SCENE</p>
    <h1 id="ns-title" class="ns-title">Fizlet → <span>fzlt</span></h1>
    <p class="lead">Fizlet is the name; fzlt is the short mark. Two keys, FIZ and LET, go into the press. The E and the I drop out, and fzlt comes out. The press stacks it on a wall of bricks, and it ends on the lockup. It plays once when it comes into view, then the page is still (no frames); the Replay key plays it again. With reduced motion you see the last frame, still. By <a href="https://coded.design/">Chris Cooley ↗</a>.</p>
    <p class="ns-cap">${sizeBadge(sizes.live, `gallery/${ID}.js`, "the name shift, its live chunk")} Live chunk <b>${fmt(sizes.live)} B</b> gzip (kernel + @fzlt/core/timeline + the scene) · loader <b>${fmt(sizes.loader)} B</b> (@fzlt/core/slot) · total <b>${fmt(sizes.total)} B</b>. Measured on this build.</p>
    <p class="ns-cap">Embed it in any slot: its figure (<code>figure()</code> in <code>site/gallery/pieces/name-shift/art.ts</code>) and one line:</p>
    <pre class="ns-embed"><code>${esc(embed)}</code></pre>
  </div>
</section>`;
  mkdirSync(`${out}/demos/name-shift`, { recursive: true });
  writeFileSync(`${out}/demos/name-shift/index.html`, page({
    title: "Fizlet → fzlt: the name shift · Fizlet",
    description: `The launch logo: FIZ and LET go into a press and come out as fzlt, then build a wall of bricks. ${fmt(sizes.live)} B gzip live, still once it ends. By Chris Cooley.`,
    base: "../../", version, path: "demos/name-shift/", body, scripts: ["site.js", "gallery/gallery.js"],
  }));
  writeFileSync(`${out}/demos/name-shift/sizes.json`, JSON.stringify(sizes));
  console.log(`Built ${out}/demos/name-shift/: live chunk ${sizes.live} B gzip, loader ${sizes.loader} B, total ${sizes.total} B`);
  return sizes;
}
