// Gallery "Big things, small packages" (site/gallery/pieces/small-packages) in Chromium: it mounts
// through @fzlt/core/slot, dependencies keep arriving, real clicks cut every one (play to the end), the
// crate shrinks to the Fizlet box with the kernel's gzip size measured on this build (and no number
// without one), it settles to zero frames, a tap plays again, Recall gives the page back byte for
// byte, the live chunk stays in its budget, and under reduced motion the poster is the joke and a
// tap shrinks it (the scene never loads).
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { measure } from "../scripts/sizes.mjs";

const BUDGET = 9728;
const kernel = (await measure()).find((s) => s.name === "@fzlt/core (kernel)").gzip;
// The live chunk, built as scripts/gallery.mjs builds it.
const chunk = await build({ stdin: { contents: 'export { mount as mount } from "./pieces/small-packages/scene.ts";', resolveDir: "site/gallery", loader: "ts" },
  bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "silent", write: false });
const live = gzipSync(chunk.outputFiles[0].contents).length;
assert.ok(live <= BUDGET, `live chunk ${live} B gzip (budget ${BUDGET})`);

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/small-packages/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "sp", write: false, logLevel: "silent",
})).outputFiles[0].text;
const posterMod = (await build({ entryPoints: ["site/gallery/pieces/small-packages/poster.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" })).outputFiles[0].text;
const P = await import("data:text/javascript;base64," + Buffer.from(posterMod).toString("base64"));
const entry = { id: "big-things-small-packages", title: "Big things, small packages", prompt: "a pixel dev drags a huge package.json", aspect: "16 / 9" };
const fig = P.figure(entry, kernel);
assert.throws(() => P.figure(entry, 0), /measured gzip size is required/, "no poster without a measured size");

const page = (figure) => `<!doctype html><html data-theme="dark"><meta charset="utf-8"><body style="margin:0">
<main id="page"><h1>Host page</h1><div id="card" style="width:768px">${figure}</div><p>Copy after.</p><div style="height:2400px"></div></main>
<script>${bundle}</script></body></html>`;
const NAMES = ["PAD-LEFT", "IS-ODD", "IS-EVEN", "IS-TRUE", "ADD-ONE", "NOOP", "POLYFILL", "UTILS", "HELPERS", "SHIM", "DEEP-COPY", "TO-ARRAY", "ONCE", "COLORS"];

const browser = await chromium.launch(launchOptions());
const chromiumVersion = browser.version();
try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(page(fig));
  const mount = () => p.evaluate(() => {
    const f = document.querySelector("figure.ae-slot");
    window.slotted = sp.slot(f, () => (stage, el, first) => (window.scene = sp.mount(stage, el, first)), { idle: 0 });
  });
  await p.evaluate(() => (window.before = document.body.innerHTML));
  await mount();
  await p.waitForFunction(() => window.scene);
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".ae-slot__placeholder")).display), "none", "the poster steps aside");

  // Dependencies keep arriving while he drags.
  await p.waitForTimeout(3000);
  const early = await p.evaluate(() => ({ n: scene.w.n[0], frames: scene.engine.stats().frames }));
  assert.ok(early.n > 3 && early.frames > 30, `the stack grows (${early.n} blocks, ${early.frames} frames)`);

  // Play to the end: real clicks on the top dependency until the crate shrinks.
  let cuts = 0;
  for (let k = 0; k < 80; k++) {
    const at = await p.evaluate((names) => {
      const w = scene.w, n = w.n[0];
      if (w.S[0] > 0) return "end";
      if (!n) return null;
      const i = n - 1, f = document.querySelector("figure").getBoundingClientRect();
      if (w.by[i] < 0 || w.bv[i]) return null; // wait for it to land in view
      return { x: f.left + ((w.bx[i] + (names[w.bk[i]].length * 4 + 5) / 2) / 192) * f.width, y: f.top + ((w.by[i] + 5.5) / 108) * f.height, n };
    }, NAMES);
    if (at === "end") break;
    if (at) await p.mouse.click(at.x, at.y), cuts++;
    await p.waitForTimeout(140);
  }
  await p.waitForFunction(() => scene.w.S[0] === 3, null, { timeout: 4000 });
  // Twelve dependencies a round (three on the crate, nine on the way): only clicks remove them.
  assert.ok(cuts >= 12, `played to the end in ${cuts} clicks`);
  const end = await p.evaluate(() => {
    const c = document.querySelector("[data-fizlet-slot] canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let go = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 0x39 && d[i + 1] === 0xff && d[i + 2] === 0xb0) go++;
    return { cap: document.querySelector("[data-fizlet-slot] p").textContent, label: scene.w.label, go };
  });
  const n = kernel.toLocaleString("en-US");
  assert.ok(end.cap.includes("Big things come in small packages.") && end.cap.includes(`Fizlet kernel: ${n} B gzip`), `the punchline carries the measured kernel size: ${end.cap}`);
  assert.equal(end.label, `${n} B GZIP`, "the box's sticker shows the measured size");
  assert.ok(end.go > 60, `the Fizlet box is drawn (${end.go} px)`);

  // Settles: no frames at all once still.
  await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 8000 });
  const f0 = await p.evaluate(() => scene.engine.stats().frames);
  await p.waitForTimeout(800);
  assert.equal(await p.evaluate(() => scene.engine.stats().frames), f0, "settled: 0 frames a second");

  // A tap plays again.
  const box = await p.locator("figure").boundingBox();
  await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await p.waitForTimeout(200);
  assert.deepEqual(await p.evaluate(() => [scene.w.S[0], scene.w.n[0], scene.engine.paused.length]), [0, 3, 0], "a tap starts a new round");

  // Off screen: paused.
  await p.evaluate(() => scrollTo(0, 2000));
  await p.waitForFunction(() => scene.engine.paused.includes("offscreen"), null, { timeout: 3000 });
  await p.evaluate(() => scrollTo(0, 0));

  // Recall: the page comes back byte for byte.
  await p.evaluate(() => window.slotted.destroy());
  assert.equal(await p.evaluate(() => document.body.innerHTML === window.before), true, "Recall: body.innerHTML is back exactly");
  assert.deepEqual(errs, []);

  // Without a measured size the punchline has no number (never a made-up one).
  await p.setContent(page(fig.replace(/ data-kernel-gzip="\d+"/, "")));
  await mount();
  await p.waitForFunction(() => window.scene);
  await p.waitForFunction(() => scene.engine.stats().frames > 2);
  // Skip the play (no dependencies left, none on the way): straight to the box.
  await p.waitForFunction(() => {
    const w = scene.w;
    if (!w.S[0]) (w.n[0] = 0), (w.S[9] = 0), scene.engine.wake();
    return w.S[0] === 3;
  }, null, { timeout: 6000, polling: 100 });
  await p.waitForTimeout(100);
  const bare = await p.evaluate(() => ({ cap: document.querySelector("[data-fizlet-slot] p").textContent, label: scene.w.label }));
  assert.ok(!/\d/.test(bare.cap) && bare.label === "", `no number without a measured one: ${bare.cap}`);
  await p.close();

  // Reduced motion: the poster is the joke; a tap shrinks it; nothing loads.
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
    const r = await ctx.newPage();
    await r.setContent(page(fig).replace('style="width:768px"', 'style="width:100%"'));
    await r.evaluate(() => {
      const f = document.querySelector("figure.ae-slot");
      sp.slot(f, () => (stage, el, first) => (window.scene = sp.mount(stage, el, first)), { idle: 0 });
    });
    const shown = () => r.evaluate(() => [...document.querySelectorAll(".sp-0, .sp-1")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.getAttribute("class")).join(" "));
    assert.equal(await shown(), "sp-0 sp-0", "reduced motion: the full stack and the setup");
    await r.locator("figure").click();
    await r.waitForTimeout(100);
    assert.equal(await shown(), "sp-1 sp-1", "a tap shrinks it");
    assert.ok((await r.locator("figure p.sp-1").textContent()).includes(`Fizlet kernel: ${n} B gzip`), "the poster's punchline carries the measured size");
    assert.equal(await r.evaluate(() => !!window.scene), false, "the scene never loads");
    await ctx.close();
  }
  console.log(`small-packages: ok (live chunk ${live} B gzip, kernel ${kernel} B, ${cuts} cuts, Chromium ${chromiumVersion})`);
} finally {
  await browser.close();
}
