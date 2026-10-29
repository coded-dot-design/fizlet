// The example host page for the layers story: a plain page with one slot. The figure (and its
// poster) is inline; the scene loads through fizlet/slot. The caption prints only measured numbers
// (site/demos/layers/measured.json, written by site/demos/layers/measure.mjs). The page is a Board UI
// root: colours, keys and cards come from the kit (src/ui/board-ui.css), no style of its own.
const kb = (b) => `${(b / 1024).toFixed(1)} KB`;

export function page({ figure, css, measured: m }) {
  const caption = m
    ? `Live chunk ${kb(m.bytes.live)} gzip: slot ${kb(m.bytes.entry)} up front, scene ${kb(m.bytes.scene)} once the slot is near. Poster ${kb(m.bytes.poster)} inline. ` +
      `At 4× CPU throttle, script per frame ${m.frame.p50} ms median, ${m.frame.p95} ms p95, capped at ${m.frame.fps} fps. ` +
      `Layout shift ${m.cls}. Settled: ${m.settledFrames} frames. Measured in Chromium ${m.chromium.split(".")[0]} on Fizlet ${m.version}.`
    : "Not measured yet: run node site/demos/layers/measure.mjs.";
  return `<!doctype html>
<html lang="en" class="bui" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Layers · Fizlet</title>
<meta name="description" content="A game is a stack of layers. Battlefield Blitz fans out into its bricks, one faults, gets patched, and folds back.">
<link rel="stylesheet" href="board-ui.css">
<style>
:root{color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,"SF Pro Display","Segoe UI",system-ui,-apple-system,Arial,sans-serif}
main{max-width:1200px;margin:0 auto;padding:32px 16px 48px}
.k{font:700 11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--k-sys-ink);margin:0}
h1{font-weight:800;font-size:clamp(32px,4.4vw,54px);line-height:1.02;letter-spacing:-.035em;margin:8px 0 12px}
h1 em{font-style:normal;color:var(--k-attack)}
p{max-width:62ch;color:var(--muted)}
figcaption,.cap{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted);margin-top:12px}
a{color:var(--k-sys-ink)}
${css}
</style>
</head>
<body>
<main>
<p class="k">Layers</p>
<h1>A game is a stack.<br><em>Each layer, one brick.</em></h1>
<p>Battlefield Blitz turns sideways and fans out into its layers, each labelled with the bytes its own code costs. One layer faults, a scan patches it, and the stack folds back into the game.</p>
${figure}
<p class="cap">${caption}</p>
<p class="cap">Layer bytes: Battlefield Blitz c8c8ca4, layer manifest (game code per layer, min + gzip; Effects is all brick, min). Built on fizlet, fizlet/slot, fizlet/grid, fizlet/sprite and fizlet/fx. By <a href="https://coded.design/">Chris Cooley</a>.</p>
</main>
<script type="module" src="entry.js"></script>
</body>
</html>
`;
}
