// Tiny Byte Runner (site/gallery/pieces/tiny-byte-runner.ts) in Chromium, on its own stage, mounted
// through fizlet/slot as the gallery does: it mounts (the poster steps aside), plays its intro and
// settles to no frames with the page as it was; an arrow key starts a round and steers; the frog
// eats crumbs and, off the trail, the page's letters (gone through the ledger); a power square makes
// a fly edible; the round ends, Recall puts every letter back and it sleeps again; the mute key
// shows only after a gesture and is 44 px; Recall mid-play gives the page back byte for byte;
// reduced motion keeps the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const ID = "tiny-byte-runner";
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
const eaten = (p) => p.evaluate(() => document.querySelectorAll(".tbr-h i.e").length);
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
    key: document.querySelector(".tbr-snd").hidden,
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

  // The keys: → starts a round along the top trail (crumbs), ↓ leaves it through the headline (letters).
  await p.evaluate(() => scene.engine.stop());
  await p.focus("[data-fizlet-slot]");
  await p.keyboard.press("ArrowRight");
  let s = await p.evaluate(() => ({ mode: scene.sim.S[0], key: document.querySelector(".tbr-snd").hidden }));
  assert.deepEqual(s, { mode: 2, key: false }, "→ starts a round; the sound key appears after the gesture");
  await run(p, 0.6);
  assert.ok((await p.evaluate(() => scene.sim.S[15])) >= 2, "the frog eats crumbs along the trail");
  await p.keyboard.press("ArrowDown");
  await run(p, 0.6);
  const e1 = await eaten(p);
  assert.ok(e1 >= 1, `off the trail, the frog eats the page's letters (${e1})`);
  // A power square: the flies turn edible, and one that meets the frog is eaten.
  const ate = await p.evaluate(() => {
    const m = scene.sim, S = m.S;
    const k = [...m.DK].findIndex((k, i) => k === 2 && !m.DE[i]);
    (S[3] = m.DX[k]), (S[4] = m.DY[k]);
    for (let i = 0; i < 3; i++) scene.engine.advance(1 / 60);
    const pow = S[9];
    let f = [...m.QS].findIndex((q) => q === 1);
    for (let i = 0; i < 120 && f < 0; i++) (scene.engine.advance(1 / 60), (f = [...m.QS].findIndex((q) => q === 1)));
    (m.QX[f] = S[3] + 1), (m.QY[f] = S[4]);
    scene.engine.advance(1 / 60);
    return { pow: pow > 3, eaten: m.QS[f] === 2, score: S[7] };
  });
  assert.deepEqual({ pow: ate.pow, eaten: ate.eaten }, { pow: true, eaten: true }, "a power square makes the flies edible, and the frog eats one");

  // The round ends; Recall puts every letter back; it sleeps with the page as it was.
  await run(p, 16);
  s = await p.evaluate(() => scene.sim.S[0]);
  assert.equal(s, 1, "the round ended and Recall finished (idle)");
  assert.equal(await eaten(p), 0, "every letter is back");
  await p.evaluate(() => scene.engine.start());
  await until(p, () => scene.engine.paused.includes("settled"), 4000, "sleeps after the round");
  assert.ok(await samePage(p), "after the round, the page's elements are as they were");

  // The sound key: 44 px, toggles.
  const k = await p.evaluate(() => { const b = document.querySelector(".tbr-snd"), r = b.getBoundingClientRect(); b.click(); return { w: r.width, h: r.height, pressed: b.getAttribute("aria-pressed") }; });
  assert.deepEqual(k, { w: 44, h: 44, pressed: "false" }, "the sound key is 44 px and mutes");

  // Recall mid-play: a tap starts a round, then destroy: the page comes back byte for byte.
  const fb = await p.locator("figure").boundingBox();
  await p.mouse.click(fb.x + fb.width / 2, fb.y + fb.height * 0.6);
  await until(p, () => scene.engine.running && scene.sim.S[0] === 2, 600, "a tap starts the next round");
  await p.evaluate(() => (scene.sim.S[3] = 40, scene.sim.S[4] = 20));
  await until(p, () => document.querySelectorAll(".tbr-h i.e").length > 0, 900, "letters are eaten");
  // Byte for byte. The one exception is fizlet/slot's, not the piece's: an accessible scene (this one
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

  // Phone width: a tap plays and turns the frog; a swipe turns it.
  const q0 = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await q0.setContent(page(390));
  await mountOn(q0);
  const qb = await q0.locator("figure").boundingBox();
  await q0.touchscreen.tap(qb.x + qb.width * 0.25, qb.y + qb.height * 0.7);
  await until(q0, () => scene.sim.S[0] === 2, 600, "phone: a tap starts a round");
  const dir = await q0.evaluate(() => scene.sim.S[5]);
  assert.equal(dir, 1, "phone: a tap below the frog turns it down");
  await q0.evaluate(() => scene.engine.stop());
  const b0 = await q0.evaluate(() => scene.sim.S[5]);
  await q0.evaluate(() => { const st = document.querySelector("[data-fizlet-slot]"), r = st.getBoundingClientRect(), o = { pointerId: 7, isPrimary: true, bubbles: true, pointerType: "touch" }; st.dispatchEvent(new PointerEvent("pointerdown", { ...o, clientX: r.left + 100, clientY: r.top + 100 })); st.dispatchEvent(new PointerEvent("pointermove", { ...o, clientX: r.left + 40, clientY: r.top + 104 })); st.dispatchEvent(new PointerEvent("pointerup", { ...o, clientX: r.left + 40, clientY: r.top + 104 })); });
  assert.equal(await q0.evaluate(() => scene.sim.S[6]), 2, "phone: a swipe left turns the frog left");
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
  console.log("tiny-byte-runner: mounts, plays the intro and settles; → plays, the frog eats crumbs and (off the trail) letters, a power square makes a fly edible; the round ends, Recall puts every letter back and it sleeps; 44 px mute key after a gesture; phone tap and swipe turn; Recall exact mid-play; reduced motion still — ok");
} finally {
  await browser.close();
}
