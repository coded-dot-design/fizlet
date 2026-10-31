// Dirt Lab (site/gallery/pieces/dirt-lab.ts) in Chromium, on its own stage, mounted through
// fizlet/slot as the gallery does: the demo ride plays and the scene settles to no frames with the
// page as it was; then the whole game by keyboard only: pick and place pieces, race, hold gas to the
// flag (a finish), then a gap with no ramp (a crash) and back to the builder; the track goes into the
// address as #t= and a fresh load reads it back; a malformed or oversized #t= is refused (the
// default track, no error); Recall gives the page and the address back; reduced motion keeps the poster.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount, encodeTrack, decodeTrack } from "./site/gallery/pieces/dirt-lab.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#dirt-lab" role="img" aria-label="Dirt Lab" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync("site/gallery/stages/dirt-lab.html", "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;
const ORIGIN = "http://fizlet.test/gallery/";
const browser = await chromium.launch(launchOptions());
const open = async (hash = "", opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, ...opts });
  await ctx.route("http://fizlet.test/**", (r) => r.fulfill({ contentType: "text/html", body: html }));
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(ORIGIN + hash);
  return { ctx, p, errs };
};
const mount = (p) => p.evaluate(() => {
  window.bodyWas = document.body.cloneNode(true);
  window.href = location.href;
  window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
}).then(() => p.waitForFunction(() => window.scene));
const run = (p, sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60); }, sec);
const st = (p) => p.evaluate(() => ({ mode: scene.sim.S[0], x: scene.sim.S[2], track: cv.encodeTrack(scene.sim.track), crashes: scene.sim.S[26], finishes: scene.sim.S[27], cur: scene.sim.S[12] }));
const until = (p, cond, frames, what) => p.evaluate(async ({ cond, frames, what }) => {
  const ok = new Function(`return (${cond})()`), start = scene.engine.stats().frames;
  while (!ok()) {
    if (scene.engine.stats().frames - start > frames) throw new Error(what);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), frames, what });
const press = async (p, ...keys) => { for (const k of keys) await p.keyboard.press(k); };

try {
  // Pure: the hash round-trips, and bad ones are refused whole.
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      const t = new Uint8Array([0, 1, 3, 0, 2, 2, 1, 0]), out = new Uint8Array(8);
      const code = cv.encodeTrack(t), ok = cv.decodeTrack("#t=" + code, out);
      const bad = ["#t=", "#t=-rg", "#t=-rg-b-r--", "#t=-rgxb-r-", "#t=<script>", "#t=" + "r".repeat(5000), "#x=-rg-b-r-", "#t=-RG-B-R-"].map((h) => {
        const o = new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9]);
        return cv.decodeTrack(h, o) || o.some((v) => v !== 9);
      });
      return { code, ok, same: [...out].join() === [...t].join(), amp: cv.decodeTrack("#dirt-lab&t=" + code, new Uint8Array(8)), bad };
    });
    assert.deepEqual(r, { code: "-rg-bbr-", ok: true, same: true, amp: true, bad: [false, false, false, false, false, false, false, false] }, "dirt-lab: the hash round-trips; malformed and oversized ones are refused and change nothing");
    await ctx.close();
  }

  const { ctx, p, errs } = await open();
  await mount(p);
  const m = await p.evaluate(() => ({ canvas: document.querySelectorAll("[data-fizlet-slot] canvas").length, buttons: document.querySelectorAll("[data-fizlet-slot] button:not([hidden])").length, poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display, role: document.querySelector("figure").getAttribute("role") }));
  assert.deepEqual(m, { canvas: 1, buttons: 6, poster: "none", role: null }, "dirt-lab: mounts its canvas and its controls (palette, RACE, mute); the figure drops role=img for the real controls");
  const small = await p.evaluate(() => [...document.querySelectorAll("[data-fizlet-slot] button")].filter((b) => !b.hidden).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
  assert.equal(small, 0, "dirt-lab: every control is 44 px or more");
  // The demo rides the default track to the flag, then it sleeps: no frames, the page as it was.
  await until(p, () => scene.sim.S[27] >= 1, 900, "dirt-lab: the demo reaches the flag");
  await until(p, () => scene.engine.paused.includes("settled"), 900, "dirt-lab: settles after the demo");
  const quiet = await p.evaluate(async () => { const a = scene.engine.stats().frames; for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r)); return scene.engine.stats().frames - a; });
  assert.equal(quiet, 0, "dirt-lab: settled, no frames");
  assert.equal(await p.evaluate(() => location.href === window.href), true, "dirt-lab: the demo leaves the address alone");

  // Keyboard only: focus the stage, an all-flat track (1 picks FLAT, Enter drops, → moves), race.
  await p.focus("[data-fizlet-slot]");
  await p.evaluate(() => scene.engine.stop());
  await press(p, "Digit1");
  for (let i = 0; i < 8; i++) await press(p, "Enter", "ArrowRight");
  await press(p, "ArrowRight", "Digit2", "Enter"); // slot 1: a ramp (→ wrapped from 7 to 0, then 1)
  assert.equal((await st(p)).track, "-r------", "dirt-lab: keys pick and place pieces");
  await press(p, "KeyR");
  assert.equal((await st(p)).mode, 1, "dirt-lab: R races");
  assert.equal(await p.evaluate(() => location.hash), "#t=-r------", "dirt-lab: the race puts the track into the address");
  await p.keyboard.down("Space");
  let s = null;
  for (let i = 0; i < 160 && (s = await st(p)).mode === 1; i++) {
    // Lean forward in the air, level on the ground: the keyboard rider lands flat.
    const [air, a, av] = await p.evaluate(() => [scene.sim.S[8], scene.sim.S[6], scene.sim.S[7]]);
    const want = !air ? "" : a + av * 0.25 < -0.08 ? "ArrowRight" : a + av * 0.25 > 0.08 ? "ArrowLeft" : "";
    for (const k of ["ArrowLeft", "ArrowRight"]) k === want ? await p.keyboard.down(k) : await p.keyboard.up(k);
    await run(p, 0.05);
  }
  await p.keyboard.up("Space");
  await p.keyboard.up("ArrowRight");
  await p.keyboard.up("ArrowLeft");
  assert.equal(s.mode, 3, `dirt-lab: holding gas rides to the flag (mode ${s.mode}, x ${s.x})`);
  assert.equal(s.finishes, 2, "dirt-lab: a finish");
  await run(p, 3);
  assert.equal((await st(p)).mode, 0, "dirt-lab: back to the builder after the flag");

  // A gap with no ramp before it: into the pit, the rider goes over the bars.
  await press(p, "ArrowLeft", "Digit4", "Enter", "KeyR");
  await p.keyboard.down("Space");
  await run(p, 3);
  await p.keyboard.up("Space");
  s = await st(p);
  assert.equal(s.crashes, 1, "dirt-lab: a gap without a ramp is a crash");
  await run(p, 3);
  assert.equal((await st(p)).mode, 0, "dirt-lab: back to the builder after the crash");
  // A tap on a slot drops the picked piece there.
  const fig = await p.locator("figure").boundingBox();
  await p.mouse.click(fig.x + ((16 + 5 * 16 + 8) / 160) * fig.width, fig.y + (60 / 90) * fig.height);
  assert.equal((await st(p)).track[5], "g", "dirt-lab: a tap drops the picked piece on the slot");
  // M mutes (aria-pressed on the mute key).
  await press(p, "KeyM");
  assert.equal(await p.evaluate(() => document.querySelector('[data-id="8"]').getAttribute("aria-pressed")), "true", "dirt-lab: M mutes");
  // A tap on RACE hands the keys to the stage: Space is gas at once (the RACE key hides itself).
  await p.click('[data-id="4"]');
  await p.keyboard.down("Space");
  await run(p, 0.5);
  await p.keyboard.up("Space");
  assert.ok((await st(p)).x > 15, "dirt-lab: after a tap on RACE, Space is gas");
  await run(p, 20);
  await p.evaluate(() => scene.engine.start());
  await until(p, () => scene.engine.paused.includes("settled"), 900, "dirt-lab: sleeps in the builder");

  // Recall: the page and the address come back.
  // The figure gets role=img back through the slot's ledger (the attribute is re-set, so it comes
  // back last in the list): the same node, attribute for attribute (isEqualNode).
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.isEqualNode(window.bodyWas), href: location.href === window.href, running: scene.engine.running }));
  assert.deepEqual(after, { same: true, href: true, running: false }, "dirt-lab: Recall restores the page byte for byte and the address");
  assert.deepEqual(errs, [], "dirt-lab: no page errors");
  await ctx.close();

  // A shared link: the track comes back from #t=, and the scene waits in the builder (no demo).
  {
    const { ctx, p, errs } = await open("#t=-rg--brg");
    await mount(p);
    const s = await st(p);
    assert.deepEqual([s.track, s.mode], ["-rg--brg", 0], "dirt-lab: a shared #t= loads that track into the builder");
    await ctx.close();
    assert.deepEqual(errs, []);
  }
  for (const bad of ["#t=zzzzzzzz", "#t=" + "-".repeat(4000), "#t=%3Cimg%20src%3Dx%3E"]) {
    const { ctx, p, errs } = await open(bad);
    await mount(p);
    const s = await st(p);
    assert.deepEqual([s.track, s.mode], ["-rg--br-", 1], `dirt-lab: a bad #t= (${bad.slice(0, 20)}) is refused: the default track and its demo`);
    // Any key during the demo ends it: the builder is yours at once.
    await p.focus("[data-fizlet-slot]");
    await p.keyboard.press("Digit4");
    const d = await p.evaluate(() => ({ mode: scene.sim.S[0], bot: scene.sim.S[23], palette: !document.querySelector('[data-id="3"]').hidden }));
    assert.deepEqual(d, { mode: 0, bot: 0, palette: true }, "dirt-lab: a key during the demo hands over the builder");
    assert.deepEqual(errs, []);
    await ctx.close();
  }

  // Reduced motion: the poster stays; the scene never mounts.
  {
    const { ctx, p } = await open("", { reducedMotion: "reduce" });
    const rm = await p.evaluate(async () => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv.mount(stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, drawn: img.naturalWidth > 100 };
    });
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, drawn: true }, "dirt-lab: reduced motion keeps the poster");
    await ctx.close();
  }
  console.log("dirt-lab: demo then settles; build, race, finish and crash by keyboard; tap places; #t= round-trips, bad hashes refused; Recall exact (page and address); reduced motion still — ok");
} finally {
  await browser.close();
}
