// The stage aspect contract (site/gallery/aspect.ts) in Chromium, on the three pilot pieces (Pumpkin
// Slice, the transformer's KO fight, Haunted Page), each in its real gallery card markup and CSS:
// at 1440×900, 390×844 (portrait) and 844×390 (landscape) the stage's class (data-aspect) matches
// the frame (a phone held upright gets the piece's square or portrait figure, in CSS), nothing
// spills out of the stage, the scene settles to no frames and Recall gives the page back byte for
// byte. A rotate mid-play switches the layout; the layout key flips it, is remembered across a
// reload, and Recall stays exact.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { entries } from "../scripts/gallery.mjs";
import { entryFigure, shapeKey } from "../site/pages/gallery.mjs";

const PILOTS = {
  "pumpkin-slice": { fn: "slice", phone: "tall" },
  "transformer-fights-diffuser-ko": { fn: "fight", phone: "square" },
  "haunted-page": { fn: "haunt", phone: "tall" },
};
const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { shapes } from "./site/gallery/shape.ts"; export { mount as slice } from "./site/gallery/anims/pumpkin-slice.ts"; export { mount as fight } from "./site/gallery/anims/transformer-fights-diffuser-ko.ts"; export { mount as haunt } from "./site/gallery/anims/haunted-page.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "pp", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const all = entries();
const html = (id) => {
  const e = all.find((x) => x.id === id);
  return `<!doctype html><html class="bui" data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style><body style="margin:0">
<main id="page" style="max-width:760px;padding:0 16px"><h1>Host page</h1><div class="gal-stage">${entryFigure(e, {})}${shapeKey(e)}</div><p>Copy after it.</p></main>
<script>${bundle};pp.shapes()</script></body></html>`;
};
const URL_ = (id) => `http://stage.test/${id}/`;

const browser = await chromium.launch(launchOptions());
const ctx = await browser.newContext();
await ctx.route("http://stage.test/**", (r) => r.fulfill({ contentType: "text/html", body: html(r.request().url().split("/")[3]) }));
const settled = (p) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 25000 });
const frames = (p, n) => p.waitForFunction((n) => scene.engine.stats().frames >= n, n, { timeout: 15000 });
const mount = (p, fn) =>
  p.evaluate((fn) => {
    window.before = document.body.innerHTML;
    window.hero = pp.slot(document.querySelector("figure"), () => (stage, el, first) => (window.scene = pp[fn](stage, el, first)), { idle: 0 });
  }, fn).then(() => p.waitForFunction(() => window.scene));
const klass = (p) => p.waitForFunction(() => document.querySelector("[data-fizlet-slot]")?.dataset.aspect).then((h) => h.jsonValue());
// The class the frame's own size says (the same thresholds as aspect.ts) and anything outside it.
const look = (p) =>
  p.evaluate(() => {
    const fig = document.querySelector("figure"), f = fig.getBoundingClientRect(), r = f.width / f.height;
    const out = [...fig.querySelectorAll("[data-fizlet-slot] canvas, .gal-mini > *")].filter((el) => {
      const b = el.getBoundingClientRect(), slack = el.tagName === "CANVAS" ? 6 : 1; // a pixel canvas rounds up to its art pixel
      return b.width && (b.left < f.left - 1 || b.right > f.right + 1 || b.top < f.top - 1 || b.bottom > f.bottom + slack);
    }).map((el) => el.className || el.tagName);
    return { frame: r > 1.4 ? "wide" : r >= 0.8 ? "square" : "tall", out, overflow: fig.scrollWidth > fig.clientWidth + 1 };
  });
const recall = (p) => p.evaluate(() => (hero.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
const tapMid = async (p) => {
  const b = await p.locator("figure").boundingBox();
  await p.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
};

try {
  for (const [id, { fn, phone }] of Object.entries(PILOTS)) {
    for (const [w, h, want] of [[1440, 900, "wide"], [390, 844, phone], [844, 390, "wide"]]) {
      const at = `${id} at ${w}×${h}`;
      const p = await ctx.newPage({});
      await p.setViewportSize({ width: w, height: h });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.goto(URL_(id));
      await p.evaluate(() => localStorage.clear());
      await p.reload();
      await mount(p, fn);
      assert.equal(await klass(p), want, `${at}: the stage is ${want}`);
      await frames(p, 3);
      const l = await look(p);
      assert.deepEqual(l, { frame: want, out: [], overflow: false }, `${at}: the frame is ${want} and nothing spills out of it`);
      await tapMid(p);
      await settled(p);
      const still = await p.evaluate(() => new Promise((r) => { const a = scene.engine.stats().frames; requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r(scene.engine.stats().frames - a)))); }));
      assert.equal(still, 0, `${at}: settled, no frames`);
      await tapMid(p);
      await frames(p, 2);
      assert.deepEqual(await recall(p), { same: true, running: false }, `${at}: Recall gives the page back byte for byte, mid-play`);
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await p.close();
    }

    // A rotate mid-play: portrait to landscape switches the layout; it settles; Recall is exact.
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(URL_(id));
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await mount(p, fn);
    assert.equal(await klass(p), phone, `${id}: portrait first`);
    await tapMid(p);
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForFunction(() => document.querySelector("[data-fizlet-slot]").dataset.aspect === "wide", null, { timeout: 10000 });
    assert.deepEqual((await look(p)).out, [], `${id}: rotated, nothing spills out`);
    await settled(p);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction((k) => document.querySelector("[data-fizlet-slot]").dataset.aspect === k, phone, { timeout: 10000 });
    await tapMid(p);
    assert.deepEqual(await recall(p), { same: true, running: false }, `${id}: Recall exact after rotating mid-play`);

    // The layout key: on a phone it pins wide (the scene re-lays itself out), a reload keeps it,
    // a tap mid-play flips it back to the piece's own shape; Recall stays exact throughout.
    await p.reload();
    const key = p.locator("button[data-shape-for]");
    assert.match(await key.getAttribute("aria-label"), /^Layout: switch this piece to wide$/, `${id}: the key says what it does`);
    const kb = await key.boundingBox();
    assert.ok(kb.width >= 44 && kb.height >= 44, `${id}: a 44 px tap target`);
    await key.click();
    assert.equal(await p.locator("figure").getAttribute("data-shape"), "wide", `${id}: the key pins wide`);
    await p.reload();
    assert.equal(await p.locator("figure").getAttribute("data-shape"), "wide", `${id}: remembered across a reload`);
    await mount(p, fn);
    assert.equal(await klass(p), "wide", `${id}: pinned wide on a phone`);
    await tapMid(p);
    await key.click();
    await p.waitForFunction((k) => document.querySelector("[data-fizlet-slot]").dataset.aspect === k, phone, { timeout: 10000 });
    assert.deepEqual((await look(p)).out, [], `${id}: flipped, nothing spills out`);
    await key.click();
    await p.waitForFunction(() => document.querySelector("[data-fizlet-slot]").dataset.aspect === "wide", null, { timeout: 10000 });
    await settled(p);
    assert.deepEqual(await recall(p), { same: true, running: false }, `${id}: Recall exact after the key flipped it mid-play`);
    await p.evaluate(() => localStorage.clear());
    await p.close();

    // Reduced motion: the poster stays, at the phone shape; the scene never mounts.
    const rm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await rm.route("http://stage.test/**", (r) => r.fulfill({ contentType: "text/html", body: html(id) }));
    await rm.goto(URL_(id));
    await rm.evaluate(() => (window.hero = pp.slot(document.querySelector("figure"), () => () => { throw new Error("mounted"); }, { idle: 0 })));
    await rm.waitForTimeout(0);
    const poster = await rm.evaluate(() => ({ stage: !!document.querySelector("[data-fizlet-slot]"), ...(() => { const f = document.querySelector("figure").getBoundingClientRect(); const r = f.width / f.height; return { frame: r > 1.4 ? "wide" : r >= 0.8 ? "square" : "tall" }; })() }));
    assert.deepEqual(poster, { stage: false, frame: phone }, `${id}: reduced motion keeps the poster, in the phone shape`);
    await rm.close();
    console.log(`ok ${id}: wide 1440, ${phone} 390 portrait, wide 844 landscape, rotate, layout key, Recall exact`);
  }
} finally {
  await browser.close();
}
