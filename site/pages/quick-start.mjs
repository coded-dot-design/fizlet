// The quick start: shown on the home page, and run for real on examples/quick-start.html (the
// site test clicks it), so the snippet people copy is a snippet we know works.
import { esc, icon, REPO } from "../layout.mjs";

export const QUICK_START = (src) => `<canvas id="board" width="640" height="320"></canvas>
<script src="${src}"></script>
<script>
  const { createEngine, effects } = fizlet;
  const canvas = document.getElementById("board"), ctx = canvas.getContext("2d");
  const engine = createEngine({ root: canvas }), fx = effects();
  canvas.onclick = (ev) => fx.blast(ev.offsetX * 640 / canvas.clientWidth, ev.offsetY * 320 / canvas.clientHeight);
  engine.add({
    step: (e, dt) => fx.step(dt),
    render: () => (ctx.clearRect(0, 0, 640, 320), fx.drawGround(ctx), fx.draw(ctx)),
  });
  engine.start();
</script>`;

export function quickStartPage({ site }) {
  const shown = QUICK_START(`${site}fizlet.js`);
  // The live copy loads the bundle from this build (so it also works before a deploy).
  const live = QUICK_START("../fizlet.js").replace('<canvas id="board"', '<canvas id="board" class="qs-canvas" aria-label="Click to blast"');
  return `
<section class="section qs" aria-labelledby="qs-title">
  <div class="wrap">
    <div class="split qs-top">
      <div>
        <p class="eyebrow"><span class="index">EX</span> QUICK START · RUNNING</p>
        <h1 id="qs-title" class="qs-title">Ten lines<br><em>to a blast.</em></h1>
        <p class="lead">This page runs the snippet below, as is. Click the board. Scroll it away and the engine pauses; switch tabs and it stops.</p>
      </div>
      <div class="panel lit qs-stage">${live}<span class="bui-label"><b>LIVE</b> · CLICK THE BOARD TO BLAST</span></div>
    </div>
    <div class="qs-grid">
      <div class="panel code-card"><div class="code-head"><span class="bui-label"><b>SOURCE</b> · the whole thing</span><button class="bui-key copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div><pre class="code"><code>${esc(shown)}</code></pre></div>
    </div>
    <div class="split-keys"><a class="bui-key bui-arcade bui-sys" href="../#start">${icon("down", 16)}Back to quick start</a><a class="bui-key bui-arcade bui-cmd" href="${REPO}#readme">${icon("book", 16)}The API</a></div>
  </div>
</section>`;
}
