// fzlt/css-clock in Chromium: a page's own paused @keyframes follow the kernel clock (computed
// values mid-way match the keyframes), an own delay composes with calc(), the engine settles to
// zero frames when the loops end and every animation is back on its first frame, and Recall
// restores the root byte for byte.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { cssClock } from "./src/css-clock.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><style>
@keyframes walk { 0%, 100% { transform: translateX(0px) } 50% { transform: translateX(40px) } }
@keyframes blink { 50% { opacity: 0 } }
#a { animation: walk 2s linear infinite paused; animation-delay: var(--fz-t, 0s) }
#b { animation: walk 2s linear infinite paused; animation-delay: calc(var(--fz-t, 0s) - 1s) }
#c { animation: blink 1s steps(2) infinite paused; animation-delay: var(--fz-t, 0s) }
i { display: block; width: 10px; height: 10px; background: red }
</style><body style="margin:0"><div id="root" style="color: red"><i id="a"></i><i id="b"></i><i id="c"></i></div><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(PAGE);
  const r = await p.evaluate(async () => {
    const root = document.getElementById("root"), before = root.outerHTML;
    const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
    const x = (id) => new DOMMatrix(getComputedStyle(document.getElementById(id)).transform).m41;
    const c = fz.cssClock(root, { span: 2, loops: 1, motion: true });
    while (parseFloat(root.style.getPropertyValue("--fz-t")) > -0.5 || !root.style.getPropertyValue("--fz-t")) await frame();
    const t = -parseFloat(root.style.getPropertyValue("--fz-t"));
    const mid = { t, a: x("a"), b: x("b"), c: +getComputedStyle(document.getElementById("c")).opacity };
    for (let i = 0; i < 300 && !c.engine.stats().paused.includes("settled"); i++) await frame();
    const rest = { t: root.style.getPropertyValue("--fz-t"), a: x("a"), b: x("b"), c: +getComputedStyle(document.getElementById("c")).opacity, settled: c.engine.stats().paused.includes("settled") };
    const f0 = c.engine.stats().frames;
    for (let i = 0; i < 20; i++) await frame();
    rest.framesWhileSettled = c.engine.stats().frames - f0;
    c.destroy();
    return { mid, rest, recall: root.outerHTML === before };
  });
  // walk is linear 0 → 40 px over the first second: x = 40 t (a), b is a second ahead.
  assert.ok(Math.abs(r.mid.a - 40 * r.mid.t) < 1, `a follows the clock: ${JSON.stringify(r.mid)}`);
  assert.ok(Math.abs(r.mid.b - 40 * (1 - r.mid.t)) < 1, `b's own delay composes: ${JSON.stringify(r.mid)}`);
  assert.equal(r.mid.c, 0, "the blink's second half: off");
  assert.deepEqual(r.rest, { t: "-2s", a: 0, b: 40, c: 1, settled: true, framesWhileSettled: 0 }, "rests on frame one and settles");
  assert.ok(r.recall, "Recall restores the root byte for byte");
  assert.deepEqual(errs, []);
  console.log("css-clock (Chromium): keyframes follow the kernel clock, rest on frame one, settle, Recall ✓");
} finally {
  await browser.close();
}
