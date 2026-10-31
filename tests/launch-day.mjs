// The launch-day pieces (site/gallery/pieces/launch/npm-i-fizlet.ts, recall-party.ts) in Chromium, each
// on its own stage (site/gallery/stages/<id>.html, its {{…}} slots filled from this checkout's
// measured numbers, as the site build fills them), mounted through fzlt/slot as the gallery does:
// it mounts (the poster steps aside), shows the measured numbers, plays its intro and settles to no
// frames with the page as it was and no sound made (none before a gesture); taps and keys really
// play (a brick snaps into the box, Space drops the one over the chute; confetti knocks letters
// loose, R brings them home and the scene measures every one back to the pixel); M mutes; it draws
// no frames off screen; its targets are 44 px at 390 wide; Recall mid-play gives the page back
// byte for byte; reduced motion keeps the still poster. Each ships ≤ 10,240 B gzip.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { fillStage, launchFacts } from "../scripts/launch-facts.mjs";

const PIECES = {
  "npm-i-fizlet": "site/gallery/pieces/launch/npm-i-fizlet.ts",
  "recall-party": "site/gallery/pieces/launch/recall-party.ts",
};
const facts = await launchFacts();
const comma = (n) => n.toLocaleString("en-US");

// The bytes each piece ships: its module bundled with its bricks, minified, gzipped.
for (const [id, mod] of Object.entries(PIECES)) {
  const js = (await build({ entryPoints: [mod], bundle: true, minify: true, format: "esm", target: "es2022", write: false, logLevel: "silent" })).outputFiles[0].contents;
  const gz = gzipSync(js).length;
  console.log(`${id}: ${gz} B gzip (module + bricks)`);
  assert.ok(gz <= 10240, `${id}: ${gz} B gzip, over 10,240`);
}

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount as npm } from "./site/gallery/pieces/launch/npm-i-fizlet.ts"; export { mount as party } from "./site/gallery/pieces/launch/recall-party.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id, w) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<script>window.audio = 0; const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio++; } };</script>
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:${w}px;aspect-ratio:16/9;margin:0">${fillStage(readFileSync(`site/gallery/stages/${id}.html`, "utf8"), facts)}</figure><p>After it.</p><div style="height:3000px"></div></main>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());

const until = (p, cond, frames, what) => p.evaluate(async ({ cond, frames, what }) => {
  const ok = new Function(`return (${cond})()`);
  const start = scene.engine.stats().frames;
  let last = start, lastAt = performance.now();
  for (;;) {
    if (ok()) return;
    const f = scene.engine.stats().frames;
    if (f - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    if (f !== last) (last = f), (lastAt = performance.now());
    else if (performance.now() - lastAt > 15000 && !scene.engine.running) throw new Error(`${what}: the scene stopped first`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), frames, what });
const quiet = (p) => p.evaluate(async () => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
});
const samePage = (p) => p.evaluate(() => {
  const fig = document.querySelector("figure").cloneNode(true);
  fig.querySelector("[data-fizlet-slot]")?.remove();
  fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
  const norm = (root) => {
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return norm(fig) === norm(was);
});
const at = async (p, x, y) => {
  const b = await p.locator("figure").boundingBox();
  return { x: b.x + (x / 160) * b.width, y: b.y + (y / 160) * b.width };
};
const click = async (p, x, y) => {
  const c = await at(p, x, y);
  await p.mouse.click(c.x, c.y);
};
const run = (p, sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60); }, sec);

const PLAY = {
  async "npm-i-fizlet"(p) {
    const text = await p.evaluate(() => document.querySelector(".ni-f").textContent);
    assert.equal(text, `${facts.deps} dependencies · ${comma(facts.pack.size)} B packed · ${comma(facts.pack.files)} files`, "npm-i-fizlet: the package's numbers, measured");
    assert.equal(facts.deps, 0, "Fizlet has no runtime dependencies");
    await p.evaluate(() => scene.engine.stop());
    // A tap on a brick on the belt drops it: the order needs it (it snaps in) or not (it bounces).
    const b = await p.evaluate(() => { const s = scene.sim; for (let i = 0; i < 6; i++) { const x = s.slotX(i) + 13; if (s.belt[i] >= 0 && x > 20 && x < 140) return { x, k: s.belt[i], need: s.need(s.belt[i]) && !((s.S[7] >> s.belt[i]) & 1) }; } return null; });
    assert.ok(b, "npm-i-fizlet: a brick in reach");
    await click(p, b.x, 27);
    await run(p, 0.6);
    let s = await p.evaluate(() => scene.state);
    assert.equal(s.mode, 2, "npm-i-fizlet: a tap starts play");
    assert.ok(b.need ? (s.have >> b.k) & 1 : s.nopes === 1, `npm-i-fizlet: the tapped brick ${b.need ? "snaps in" : "bounces out"}`);
    // Space drops the one over the chute (put a needed one there).
    const k = await p.evaluate(() => { const s = scene.sim; let k = -1; for (let j = 0; j < 12; j++) if (s.need(j) && !((s.S[7] >> j) & 1)) { k = j; break; } for (let i = 0; i < 6; i++) s.belt[i] = -1; s.belt[0] = k; s.S[4] = 108; return k; });
    await p.focus("[data-fizlet-slot]");
    await p.keyboard.press(" ");
    await run(p, 0.6);
    s = await p.evaluate(() => scene.state);
    assert.equal((s.have >> k) & 1, 1, "npm-i-fizlet: Space drops the brick over the chute and it snaps in");
    await p.evaluate(() => scene.engine.start());
  },
  async "recall-party"(p) {
    const text = await p.evaluate(() => document.querySelector(".rp-f").textContent);
    assert.ok(text.startsWith(`kernel ${comma(facts.kernel)} B gzip · ${facts.deps} dependencies`), `recall-party: the kernel's measured size (${text})`);
    await p.evaluate(() => scene.engine.stop());
    await click(p, 50, 14);
    await run(p, 0.5);
    let s = await p.evaluate(() => ({ ...scene.state, styled: [...document.querySelectorAll(".rp-h i")].filter((e) => e.style.getPropertyValue("--y")).length }));
    assert.equal(s.mode, 2, "recall-party: a tap starts the party");
    assert.ok(s.hits >= 1 && s.styled >= 1, `recall-party: the confetti knocks letters loose (${s.hits})`);
    await p.focus("[data-fizlet-slot]");
    await p.keyboard.press(" ");
    await run(p, 5);
    s = await p.evaluate(() => scene.state);
    assert.ok(s.loose >= 1 && s.pops === 3, "recall-party: Space fires a popper; the letters land and rest");
    await p.keyboard.press("r");
    await run(p, 2.5);
    s = await p.evaluate(() => scene.state);
    assert.deepEqual([s.recalls, s.loose, s.exact], [2, 0, 13], "recall-party: R brings every letter home, measured back to the pixel");
    await p.evaluate(() => scene.engine.start());
  },
};

try {
  for (const id of Object.keys(PIECES)) {
    const make = id === "npm-i-fizlet" ? "npm" : "party";
    for (const w of [1440, 390]) {
      const p = await browser.newPage({ viewport: { width: w, height: 900 } });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(page(id, w - 32));
      await p.evaluate(() => { let s = 0x2f6b1d3; Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); });
      await p.evaluate((make) => {
        window.before = document.body.innerHTML;
        window.figBefore = document.querySelector("figure").innerHTML;
        window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv[make](stage, el, first)), { idle: 0 });
      }, make);
      await p.waitForFunction(() => window.scene);
      const m = await p.evaluate(() => {
        const b = document.querySelector("[data-fizlet-slot] .ld-mute").getBoundingClientRect();
        return { canvas: document.querySelectorAll("[data-fizlet-slot] canvas").length, poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display, mute: [b.width, b.height], tab: document.querySelector("[data-fizlet-slot]").tabIndex };
      });
      assert.deepEqual(m, { canvas: 1, poster: "none", mute: [44, 44], tab: 0 }, `${id} @${w}: mounts its canvas and a 44 px mute button, takes focus; the poster steps aside`);
      if (id === "recall-party") {
        const h = await p.evaluate(() => document.querySelector("figure").getBoundingClientRect().width * 20 / 160);
        assert.ok(h >= 44, `${id} @${w}: the Recall button is ${h.toFixed(1)} px tall`);
      } else {
        const h = await p.evaluate(() => document.querySelector("figure").getBoundingClientRect().width * 25 / 160);
        assert.ok(h >= 44, `${id} @${w}: a brick's tap area is ${h.toFixed(1)} px tall`);
      }

      await until(p, () => scene.engine.stats().frames > 30, 600, `${id}: plays on load`);
      await until(p, () => scene.engine.paused.includes("settled"), 6000, `${id}: settles after the intro`);
      assert.equal(await quiet(p), 0, `${id} @${w}: settled, no frames`);
      assert.ok(await samePage(p), `${id} @${w}: settled with the page as it was`);
      assert.equal(await p.evaluate(() => window.audio), 0, `${id}: no sound before a gesture`);

      if (w === 1440) {
        await PLAY[id](p);
        // M mutes (the button says so), and again turns it back on.
        await p.focus("[data-fizlet-slot]");
        await p.keyboard.press("m");
        assert.equal(await p.evaluate(() => document.querySelector(".ld-mute").getAttribute("aria-pressed")), "true", `${id}: M mutes`);
        await p.keyboard.press("m");
        assert.equal(await p.evaluate(() => document.querySelector(".ld-mute").getAttribute("aria-pressed")), "false", `${id}: M again unmutes`);
        await until(p, () => scene.engine.paused.includes("settled"), 6000, `${id}: sleeps after play`);
        assert.ok(await samePage(p), `${id}: after play and Recall, the page is as it was`);
        // Off screen: a tap starts it, then it scrolls away: no frames.
        await click(p, 60, 27);
        await p.evaluate(() => window.scrollTo(0, 2500));
        await p.waitForTimeout(300);
        assert.equal(await quiet(p), 0, `${id}: off screen, no frames`);
        await p.evaluate(() => window.scrollTo(0, 0));
      }
      // Recall mid-play: a tap, then destroy: the page comes back byte for byte.
      await click(p, 60, 27);
      await until(p, () => scene.engine.running && scene.state.mode === 2, 600, `${id}: a tap plays`);
      const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
      if (!after.same) console.log(await p.evaluate(() => { const a = document.body.innerHTML, b = window.before; let i = 0; while (a[i] === b[i]) i++; return [a.slice(i - 80, i + 120), b.slice(i - 80, i + 120)]; }));
      assert.deepEqual(after, { same: true, running: false }, `${id} @${w}: Recall restores the page byte for byte`);
      assert.deepEqual(errs, [], `${id}: no page errors`);
      await p.close();
    }

    // Reduced motion: the poster is the still frame; the scene never mounts.
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(id, 720));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv[make](stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
    }, make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("launch-day: both mount with measured numbers, settle silent, play by tap and key (bricks snap or bounce; confetti, Recall back to the pixel), M mutes, no frames off screen, 44 px targets at 390, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
