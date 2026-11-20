// The perf fixture: fizlet.com's home-page demo ("Blast it. Recall it.") on a page of its own, so
// `npm run perf` and `npm run test:alloc` measure the package without the website. The figure is
// the home page's markup (its playFigure()), the script is its demo.ts on src/, and the styles are
// board-ui.css plus the demo's block of the site's stylesheet. buildFixture(out) writes
// out/index.html (served at /fizlet/, the path the targets in run.mjs and alloc.mjs open).
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = (f) => fileURLToPath(new URL(f, import.meta.url));

function demoPage() {
  const letters = [..."Hello, page."].map((c) => (c === " " ? " " : `<span class="dl" data-body data-flip>${c}</span>`)).join("");
  const words = "Every letter here is a real element on this page. Knock it around, then press Recall.".split(" ").map((w) => `<span class="dw" data-body>${w}</span>`).join(" ");
  return `<div class="demo-page" data-page>
      <h2 class="demo-title" aria-label="Hello, page.">${letters}</h2>
      <p class="demo-copy">${words}</p>
      <div class="demo-row"><span class="demo-btn" data-body>SIGN UP</span><span class="demo-chip" data-body>NEW</span><span class="demo-chip alt" data-body>v0.2</span></div>
    </div>`;
}

const stat = (k, label, v) => `<div><dt>${label}</dt><dd data-stat="${k}">${v}</dd></div>`;
const figure = `<figure class="demo panel lit" data-demo aria-label="Live demo: a small page you can blast. Recall puts it back.">
      <div class="demo-chrome"><i></i><i></i><i></i><span class="demo-url">your.page</span><span class="demo-state" data-state>BOOTING</span></div>
      <div class="demo-board" data-board>
        ${demoPage()}
        <canvas class="demo-fx" data-fx aria-hidden="true"></canvas>
        <div class="demo-slam" data-slam hidden><div class="bui-sticker"><span>RECALL</span><b>RESTORED</b></div></div>
        <p class="demo-hint" data-hint aria-hidden="true"><span class="blink"></span>CLICK THE PAGE</p>
      </div>
      <div class="demo-keys">
        <button class="bui-key bui-arcade bui-attack" type="button" data-blast>Blast<kbd>B</kbd></button>
        <button class="bui-key bui-arcade bui-cmd" type="button" data-recall>Recall<kbd>R</kbd></button>
        <button class="bui-key bui-icon-key" type="button" data-sound aria-pressed="false" aria-label="Sound"><span class="snd-off">off</span><span class="snd-on">on</span></button>
      </div>
      <dl class="demo-stats" aria-label="engine.stats(), live">
        ${stat("frames", "FRAMES", 0)}${stat("steps", "STEPS", 0)}${stat("dropped", "DROPPED", 0)}${stat("ms", "FRAME MS", "0.00")}
        ${stat("waves", "WAVES", "0/8")}${stat("particles", "PARTICLES", "0/420")}${stat("ledger", "LEDGER", 0)}${stat("layout", "LAYOUT IN STEP", 0)}
      </dl>
      <figcaption class="bui-label"><b>LIVE</b> · fizlet + input + fx + sound + debug, running this board</figcaption>
    </figure>`;

/** Build the fixture into `out` (served at /fizlet/). */
export async function buildFixture(out = "perf-dist") {
  const dir = out;
  mkdirSync(dir, { recursive: true });
  await build({ entryPoints: [here("./demo.ts")], bundle: true, minify: true, format: "esm", target: "es2022", outfile: join(dir, "demo.js"), logLevel: "silent" });
  copyFileSync("src/ui/board-ui.css", join(dir, "board-ui.css"));
  writeFileSync(join(dir, "demo.css"), readFileSync(here("./demo.css")));
  writeFileSync(join(dir, "index.html"), `<!doctype html>
<html class="bui" data-theme="dark" lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fizlet perf fixture</title>
<link rel="stylesheet" href="board-ui.css"><link rel="stylesheet" href="demo.css"></head>
<body><main class="wrap" style="padding-block:40px">${figure}</main>
<script type="module" src="demo.js"></script></body>
</html>
`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`perf fixture: ${await buildFixture(process.argv[2])}/index.html`);
