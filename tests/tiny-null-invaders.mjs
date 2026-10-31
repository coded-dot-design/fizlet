// Tiny Null Invaders (site/gallery/pieces/tiny-null-invaders.ts) in Chromium, on its own stage, mounted
// through fzlt/slot as the gallery does: it mounts (the poster steps aside), plays its intro and
// settles to no frames with the page as it was; Space starts a round and the gun really shoots the
// page (letters turn to binary in the DOM text, a factory drains, XP upgrades the gun); the arrow
// keys steer; the round ends, Recall puts every letter back and it sleeps again; the mute key shows
// only after a gesture and is 44 px; Recall mid-play gives the page back byte for byte; reduced
// motion keeps the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const ID = "tiny-null-invaders";
const bundle = (await build({
  stdin: { contents: `export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/${ID}.ts";`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (w) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${ID}" role="img" aria-label="${ID}" style="position:relative;width:${w}px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${ID}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
const until = (p, cond, frames, what) => p.evaluate(async ({ cond, frames, what }) => {
  const ok = new Function(`return (${cond})()`);
  const start = scene.engine.stats().frames;
  for (;;) {
    if (ok()) return;
    if (scene.engine.stats().frames - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), frames, what });
const samePage = (p) => p.evaluate(() => {
  const fig = document.querySelector("figure").cloneNode(true);
  fig.querySelector("[data-fizlet-slot]")?.remove();
  fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
  const norm = (root) => {
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    for (const e of root.querySelectorAll("[class='']")) e.removeAttribute("class");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return norm(fig) === norm(was);
});
const run = (p, sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60); }, sec);
const binary = (p) => p.evaluate(() => [...document.querySelectorAll(".tni-h i")].filter((e) => e.textContent === "0" || e.textContent === "1").length);
const mountOn = async (p) => {
  await p.evaluate(() => {
    let s = 0x2f6b1d3;
    Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    window.before = document.body.innerHTML;
    window.figBefore = document.querySelector("figure").innerHTML;
    window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
  });
  await p.waitForFunction(() => window.scene);
};

try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(page(720));
  await mountOn(p);
  const m = await p.evaluate(() => ({
    canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
    poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    key: document.querySelector(".tni-snd").hidden,
    role: document.querySelector("[data-fizlet-slot]").getAttribute("role"),
  }));
  assert.deepEqual(m, { canvas: 1, poster: "none", key: true, role: "application" }, "mounts its canvas; the poster steps aside; no sound key before a gesture; the stage is a labelled application");

  await until(p, () => scene.engine.stats().frames > 30, 600, "plays on load");
  await until(p, () => scene.engine.paused.includes("settled"), 4000, "settles after the intro");
  const quiet = await p.evaluate(async () => {
    const a = scene.engine.stats().frames;
    for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
    return scene.engine.stats().frames - a;
  });
  assert.equal(quiet, 0, "settled, no frames");
  assert.ok(await samePage(p), "settled with the page's elements as they were");

  // The keys: Space starts a round, → steers; the gun shoots the headline into binary.
  await p.evaluate(() => scene.engine.stop());
  await p.focus("[data-fizlet-slot]");
  await p.keyboard.press("Space");
  let s = await p.evaluate(() => ({ mode: scene.sim.S[0], key: document.querySelector(".tni-snd").hidden }));
  assert.deepEqual(s, { mode: 2, key: false }, "Space starts a round; the sound key appears after the gesture");
  const x0 = await p.evaluate(() => scene.sim.S[3]);
  await p.keyboard.down("ArrowRight");
  await run(p, 0.4);
  await p.keyboard.up("ArrowRight");
  assert.ok((await p.evaluate(() => scene.sim.S[3])) > x0 + 8, "→ steers the ship right");
  await p.evaluate(() => (scene.sim.S[4] = 70));
  await run(p, 1.5);
  const b1 = await binary(p);
  assert.ok(b1 >= 2, `shots turn letters into binary in the page's text (${b1})`);
  // Steer under the left factory (SIGN UP) and keep firing: it drains, XP upgrades the gun.
  await p.evaluate(() => (scene.sim.S[4] = scene.sim.FX[0] + scene.sim.FW[0] / 2));
  let drained = false;
  for (let k = 0; k < 40 && !drained; k++) {
    await run(p, 0.2);
    drained = await p.evaluate(() => !!document.querySelector(".tni-f").style.getPropertyValue("--hp"));
  }
  assert.ok(drained, "the factory drains (its --hp, through the ledger)");
  s = await p.evaluate(() => ({ gun: scene.sim.S[8], xp: scene.sim.S[7] }));
  assert.ok(s.gun >= 1, `XP upgrades the gun (xp ${s.xp}, gun ${s.gun})`);

  // The round ends; Recall puts every letter back; it sleeps with the page as it was.
  await run(p, 16);
  s = await p.evaluate(() => scene.sim.S[0]);
  assert.equal(s, 1, "the round ended and Recall finished (idle)");
  assert.equal(await binary(p), 0, "every letter is back");
  await p.evaluate(() => scene.engine.start());
  await until(p, () => scene.engine.paused.includes("settled"), 4000, "sleeps after the round");
  assert.ok(await samePage(p), "after the round, the page's elements are as they were");

  // The sound key: 44 px, toggles.
  const k = await p.evaluate(() => { const b = document.querySelector(".tni-snd"), r = b.getBoundingClientRect(); b.click(); return { w: r.width, h: r.height, pressed: b.getAttribute("aria-pressed") }; });
  assert.deepEqual(k, { w: 44, h: 44, pressed: "false" }, "the sound key is 44 px and mutes");

  // Recall mid-play: a tap starts a round, then destroy: the page comes back byte for byte.
  const fb = await p.locator("figure").boundingBox();
  await p.mouse.click(fb.x + fb.width / 2, fb.y + fb.height * 0.6);
  await until(p, () => scene.engine.running && scene.sim.S[0] === 2, 600, "a tap starts the next round");
  await until(p, () => [...document.querySelectorAll(".tni-h i")].some((e) => e.textContent === "0" || e.textContent === "1"), 600, "letters go binary");
  // Byte for byte. The one exception is fzlt/slot's, not the piece's: an accessible scene (this one
  // is a keyboard-playable application) has the figure's role="img" taken off and put back, and on
  // main the slot puts it back as the last attribute (#215 restores it in place). Everything else,
  // every letter and the factories included, must match exactly.
  const after = await p.evaluate(() => {
    h.destroy();
    const now = document.body.innerHTML, slotFixed = now.replace(/(<figure class="ae-slot" data-slot-target="[^"]+")( aria-label="[^"]*" style="[^"]*") role="img">/, '$1 role="img"$2>');
    return { same: now === window.before || slotFixed === window.before, running: scene.engine.running };
  });
  assert.deepEqual(after, { same: true, running: false }, "Recall restores the page byte for byte");
  assert.deepEqual(errs, [], "no page errors");
  await p.close();

  // Phone width: a tap plays and steers there.
  const q0 = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await q0.setContent(page(390));
  await mountOn(q0);
  const qb = await q0.locator("figure").boundingBox();
  await q0.touchscreen.tap(qb.x + qb.width * 0.25, qb.y + qb.height * 0.7);
  await until(q0, () => scene.sim.S[0] === 2, 600, "phone: a tap starts a round");
  const tx = await q0.evaluate(() => scene.sim.S[4]);
  assert.ok(Math.abs(tx - 40) < 3, `phone: the tap steers to where it landed (${tx})`);
  await q0.close();

  // Reduced motion: the poster is the still frame; the scene never mounts.
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(720));
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv.mount(stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, "reduced motion keeps the poster");
  await ctx.close();
  console.log("tiny-null-invaders: mounts, plays the intro and settles; Space plays, → steers, shots turn letters to binary, a factory drains, XP upgrades the gun; the round ends, Recall puts every letter back and it sleeps; 44 px mute key after a gesture; phone tap steers; Recall exact mid-play; reduced motion still — ok");
} finally {
  await browser.close();
}
