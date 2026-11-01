// The name shift (site/gallery/pieces/name-shift: Fizlet → fzlt, the launch logo) in Chromium, mounted
// through @fzlt/core/slot as the gallery and its own page mount it: the poster is the final lockup; it
// waits posed until the figure is in view, then plays the story once (FIZ + LET, the press, the E and
// the i drop out, fzlt, the stack, the lockup) and settles to zero requestAnimationFrame calls on
// the final frame; the Replay key plays it again; Recall mid-play gives the page back byte for byte;
// reduced motion keeps the still lockup (the scene never loads); no console errors; no sideways
// scroll at 390; the live chunk stays inside the hero budget.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const BUDGET = 9728; // a gallery hero's live chunk (tests/small-packages.mjs, site/demos/layers/measure.mjs)
const chunk = await build({ stdin: { contents: 'export { mount as mount } from "./pieces/name-shift/scene.ts";', resolveDir: "site/gallery", loader: "ts" },
  bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "silent", write: false });
const live = gzipSync(chunk.outputFiles[0].contents).length;
assert.ok(live <= BUDGET, `live chunk ${live} B gzip (budget ${BUDGET})`);

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/name-shift/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "ns", write: false, logLevel: "silent",
})).outputFiles[0].text;
const artMod = (await build({ entryPoints: ["site/gallery/pieces/name-shift/art.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" })).outputFiles[0].text;
const A = await import("data:text/javascript;base64," + Buffer.from(artMod).toString("base64"));
const kit = readFileSync("src/ui/board-ui.css", "utf8");
// Every requestAnimationFrame the page asks for (the settle check counts them).
const RAF = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = (cb) => (window.__raf++, raf(cb));
};
// `gap`: room above the figure, so it mounts (within the slot's 200 px) still off screen.
// `wide`: the widest common fallback fonts (DejaVu, what a bare Linux CI has for system-ui and
// ui-monospace), so the lockup is checked where it is tightest.
const WIDE = ':root{--sans:"DejaVu Sans",sans-serif;--mono:"DejaVu Sans Mono",monospace}';
const page = (w, theme = "dark", gap = 0, wide = false) => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><style>${kit}body{margin:0;background:var(--bg)}${wide ? WIDE : ""}</style><script>(${RAF})()</script><body>
<main id="page"><h1>Host page</h1><div style="height:${gap}px"></div><div style="width:${w}px;max-width:100%;aspect-ratio:${w > 600 ? "16 / 9" : "1 / 1"};position:relative">${A.figure("test#name-shift", { style: "position:absolute;inset:0;margin:0" })}</div><p>Copy after.</p><div style="height:2400px"></div></main>
<script>${bundle}</script></body></html>`;
const FINAL = { "--a": 1, "--b": 1, "--r": 0, "--e": 1, "--o": 1, "--j": 1, "--i": 1, "--f": 1, "--g": 1, "--k1": 1, "--k2": 1, "--k3": 1, "--k4": 1, "--k5": 1, "--sb": 0, "--l": 1, "--m": 1 };

const browser = await chromium.launch(launchOptions());
const chromiumVersion = browser.version();
try {
  for (const [w, h, wide] of [[1100, 800, false], [390, 844, false], [390, 844, true], [320, 640, true]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await p.setContent(page(w, "dark", h, wide));
    // Just below the fold first: it mounts posed and waits (it plays once it is in view).
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      const f = document.querySelector("figure.ae-slot");
      window.slotted = ns.slot(f, () => (stage, el, first) => (window.scene = ns.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".ae-slot__placeholder")).display), "none", "the poster steps aside");
    assert.equal(await p.evaluate(() => document.querySelector("figure").hasAttribute("role")), false, "accessible: real text and a real key, so the slot drops role=img");
    await p.waitForTimeout(400);
    const posed = await p.evaluate(() => ({ t: scene.tl.time, playing: scene.tl.playing, a: document.querySelector("[data-fizlet-slot] .ns").style.getPropertyValue("--a") }));
    assert.ok(posed.t === 0 && !posed.playing, `@${w}: off screen it waits ${JSON.stringify(posed)}`);
    await p.evaluate(() => document.querySelector("figure").scrollIntoView({ block: "center" }));
    await p.waitForFunction(() => scene.tl.playing);
    // Off screen the kernel ran no frame: it poses on its first frame on screen (a story start, not the end).
    assert.ok(+(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .ns").style.getPropertyValue("--a"))) < 1, `@${w}: it starts from the start`);

    // Mid-shift: the E is out, fiz + lt are out, the i has dropped and the pair reads fzlt.
    await p.waitForFunction(() => scene.tl.time > 5.3, null, { timeout: 15000 });
    const mid = await p.evaluate(() => {
      const r = document.querySelector("[data-fizlet-slot] .ns"), v = (k) => +r.style.getPropertyValue(k);
      return { e: v("--e"), o: v("--o"), i: v("--i"), l: v("--l"), vowel: document.querySelector("[data-fizlet-slot] .ns-v").getBoundingClientRect().width };
    });
    assert.ok(mid.e === 1 && mid.o === 1 && mid.i === 1 && mid.l === 0 && mid.vowel < 0.5, `@${w}: mid-shift ${JSON.stringify(mid)}`);
    // The stacking moment: bricks on their way, fzlt lifted.
    await p.waitForFunction(() => scene.tl.time > 6.7, null, { timeout: 15000 });
    const stack = await p.evaluate(() => {
      const r = document.querySelector("[data-fizlet-slot] .ns"), v = (k) => +r.style.getPropertyValue(k);
      return { f: v("--f"), k1: v("--k1"), k5: v("--k5"), sb: v("--sb") };
    });
    assert.ok(stack.f === 1 && stack.k1 > 0 && stack.k5 < 1 && stack.sb === 1, `@${w}: stacking ${JSON.stringify(stack)}`);

    // The end: the lockup, still. The timeline stops, the kernel settles: no more frames.
    await p.waitForFunction(() => !scene.tl.playing, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const r0 = await p.evaluate(() => window.__raf);
    await p.waitForTimeout(1500);
    const settled = (await p.evaluate(() => window.__raf)) - r0;
    assert.equal(settled, 0, `@${w}: settled, ${settled} rAF calls in 1.5 s`);
    const end = await p.evaluate((F) => {
      const r = document.querySelector("[data-fizlet-slot] .ns");
      return Object.keys(F).filter((k) => +r.style.getPropertyValue(k) !== F[k]);
    }, FINAL);
    assert.deepEqual(end, [], `@${w}: the end frame is the poster's (the lockup)`);
    const lock = await p.evaluate(() => {
      const l = document.querySelector("[data-fizlet-slot] .ns-lock"), c = document.querySelector("[data-fizlet-slot] .ns-cap"), f = document.querySelector("figure").getBoundingClientRect();
      const inside = (el) => { const b = el.getBoundingClientRect(); return b.left >= f.left - 0.5 && b.right <= f.right + 0.5; };
      return { text: l.textContent, op: getComputedStyle(l).opacity, inside: inside(l) && inside(c) };
    });
    assert.deepEqual(lock, { text: "Fizlet™ · fzlt™", op: "1", inside: true }, `@${w}: the lockup Fizlet™ · fzlt™ and its caption, whole, inside the frame${wide ? " (wide fonts)" : ""}`);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), w, `@${w}: no sideways scroll`);

    // Replay: the key plays it from the start again.
    const key = p.locator("[data-fizlet-slot] .ns-re");
    const box = await key.boundingBox();
    assert.ok(box.height >= 44, `@${w}: the Replay key is ${box.height} px tall`);
    await key.click();
    await p.waitForTimeout(300);
    const again = await p.evaluate(() => ({ playing: scene.tl.playing, t: scene.tl.time, l: +document.querySelector("[data-fizlet-slot] .ns").style.getPropertyValue("--l") }));
    assert.ok(again.playing && again.t < 1 && again.l === 0, `@${w}: Replay plays it from the start ${JSON.stringify(again)}`);

    // Recall mid-play: the page comes back byte for byte.
    const back = await p.evaluate(() => (window.slotted.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    if (!back.same) console.log(await p.evaluate(() => { const a = document.body.innerHTML, b = window.before; let i = 0; while (a[i] === b[i]) i++; return [a.slice(i - 80, i + 120), b.slice(i - 80, i + 120)]; }));
    assert.deepEqual(back, { same: true, running: false }, `@${w}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `@${w}: no console errors`);
    await p.close();
  }

  // Reduced motion: the scene never loads; the poster is the final lockup, still; no frames.
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(390, theme, 0, theme === "light"));
    await p.evaluate(() => {
      window.made = 0;
      window.slotted = ns.slot(document.querySelector("figure.ae-slot"), () => (window.made++, ns.mount), { idle: 0 });
    });
    await p.waitForTimeout(1200);
    const still = await p.evaluate(() => {
      const ph = document.querySelector(".ae-slot__placeholder"), l = ph.querySelector(".ns-lock"), b = ph.querySelector(".ns-b5");
      const f = document.querySelector("figure").getBoundingClientRect(), r = l.getBoundingClientRect();
      return { made: window.made, mounted: window.slotted.mounted, poster: getComputedStyle(ph).display !== "none", lock: getComputedStyle(l).opacity, inside: r.left >= f.left - 0.5 && r.right <= f.right + 0.5, brick: getComputedStyle(b).opacity, role: document.querySelector("figure").getAttribute("role") };
    });
    assert.deepEqual(still, { made: 0, mounted: false, poster: true, lock: "1", inside: true, brick: "1", role: "img" }, `reduced motion (${theme}${theme === "light" ? ", wide fonts" : ""}): the still lockup, inside the frame`);
    const r0 = await p.evaluate(() => window.__raf);
    await p.waitForTimeout(1000);
    assert.equal(await p.evaluate(() => window.__raf) - r0, 0, `reduced motion (${theme}): no frames`);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390, "reduced motion: no sideways scroll at 390");
    assert.deepEqual(errs, []);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`name-shift: live chunk ${live} B gzip (budget ${BUDGET}); plays once in view, mid-shift fzlt, stacks, ends on the lockup and settles to 0 rAF; Replay plays it again; Recall exact; reduced motion still; no errors; no sideways scroll at 390 (Chromium ${chromiumVersion}) — ok`);
