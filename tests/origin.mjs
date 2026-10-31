// The origin hero (site/demos/origin/) in Chromium: it plays a day while on screen; closing the
// laptop gives night and sleep, opening it gives day; the mode toggle changes the screens; show
// bricks labels every part; 0 rAF/s paused and off screen; reduced motion is calm (no particles,
// settles); no audio before a gesture (and a mute key); destroy() gives the root back exactly.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { mount } from "./site/demos/origin/scene.ts"; export { ORIGIN_WHY } from "./site/demos/origin/copy.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "og", write: false, logLevel: "silent", define: { __ORIGIN_BRICKS__: '{"fx":2797,"timeline":2120}' },
})).outputFiles[0].text;

// rAF calls and AudioContexts made, counted from the first script on.
const PROBE = `<script>window.__raf=0;const r=requestAnimationFrame.bind(window);window.requestAnimationFrame=(cb)=>(window.__raf++,r(cb));
window.__hz=[];const sv=AudioParam.prototype.setValueAtTime;AudioParam.prototype.setValueAtTime=function(v,t){window.__hz.push(v);return sv.call(this,v,t)};window.__ac=0;const A=window.AudioContext;window.AudioContext=function(...a){window.__ac++;return new A(...a)};</script>`;
const PAGE = `<!doctype html><meta charset="utf-8">${PROBE}<body style="margin:0">
<main id="page"><h1>Host page</h1><div id="root" class="hero" data-x="1" style="width:800px;height:500px"></div><div id="spacer" style="height:3000px"></div><p>After.</p></main>
<script>${bundle}</script></body>`;
const CUP = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const browser = await chromium.launch(launchOptions());
const rafPerSec = async (p, ms = 1000) => {
  const a = await p.evaluate(() => window.__raf);
  await p.waitForTimeout(ms);
  return ((await p.evaluate(() => window.__raf)) - a) / (ms / 1000);
};
const vars = (p) => p.evaluate(() => {
  const s = getComputedStyle(document.querySelector(".og"));
  return { night: +s.getPropertyValue("--night"), sky: s.getPropertyValue("--sky").trim() };
});
try {
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    await p.evaluate((cup) => (window.scene = og.mount(document.getElementById("root"), { speed: 4, cup, reducedMotion: false })), CUP);

    // No sound before a gesture; the mute key is there.
    await p.waitForTimeout(400);
    assert.equal(await p.evaluate(() => window.__ac), 0, "no AudioContext before a gesture");
    assert.ok(await p.$(".og-bar button[data-k=sound]"), "a visible sound / mute key");
    // The why: real text in the DOM, the whole line for screen readers.
    assert.equal(await p.evaluate(() => document.querySelector(".og-why .og-vh").textContent), await p.evaluate(() => og.ORIGIN_WHY));

    // It plays a day on screen: night at first, then the sun is up, he is awake and the lid is open.
    const n0 = await vars(p);
    assert.ok(n0.night > 0.5, `starts at night (${n0.night})`);
    await p.waitForFunction(() => window.scene.state.open, null, { timeout: 8000 });
    await p.waitForTimeout(1500);
    const n1 = await vars(p);
    assert.ok(n1.night < 0.1 && n1.sky !== n0.sky, `day: ${JSON.stringify(n1)}`);
    assert.ok(await rafPerSec(p) > 10, "frames while the day plays");
    // No gesture yet: a sip makes no sound.
    await p.waitForFunction(() => window.scene.state.awake, null, { timeout: 8000 });
    await p.evaluate(() => window.scene.sip());
    await p.waitForTimeout(1500);
    assert.equal(await p.evaluate(() => window.__hz.length), 0, "no sound before a gesture, sip included");

    const beat = await p.evaluate(() => document.querySelector(".og-beat").textContent);
    assert.ok(beat.length > 10 && (await p.evaluate(() => og.ORIGIN_WHY)).includes(beat), "the caption shows a beat of the why");

    // Mode: the screens change.
    const shown = () => p.evaluate(() => [...document.querySelectorAll(".og-screen .og-code, .og-screen .og-des")].map((g) => getComputedStyle(g).display !== "none"));
    assert.deepEqual(await shown(), [true, false], "code on the laptop");
    await p.evaluate(() => window.scene.setMode("design"));
    await p.waitForTimeout(150);
    assert.deepEqual(await shown(), [false, true], "design on the laptop");
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector("[data-p=phone] .og-des")).display), "inline", "design on the phone");
    assert.equal(await p.evaluate(() => window.scene.state.mode), "design");

    // Show bricks: every label shows, with its brick and bytes.
    await p.evaluate(() => window.scene.setShowBricks(true));
    await p.waitForTimeout(400);
    const tags = await p.evaluate(() => [...document.querySelectorAll(".og-tag")].map((t) => [getComputedStyle(t).opacity, t.textContent]));
    assert.ok(tags.length >= 7 && tags.every(([o]) => o === "1"), `labels shown: ${JSON.stringify(tags)}`);
    assert.ok(tags.some(([, t]) => /fzlt\/fx 2,797 B/.test(t)) && tags.some(([, t]) => /fzlt\/timeline 2,120 B/.test(t)), "labels carry brick sizes");

    // Close the laptop (a tap on it, through fzlt/input): night, asleep. Open it: day.
    const box = await p.evaluate(() => { const r = document.querySelector(".og-laptop").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.6 }; });
    await p.mouse.click(box.x, box.y);
    assert.equal(await p.evaluate(() => window.__ac), 1, "the gesture unlocks sound");
    await p.waitForFunction(() => !window.scene.state.open, null, { timeout: 4000 });
    await p.waitForFunction(() => +getComputedStyle(document.querySelector(".og")).getPropertyValue("--night") > 0.5, null, { timeout: 8000 });
    // Asleep: the Zzz floats up; awake it does not.
    await p.waitForFunction(() => !window.scene.state.awake);
    const z0 = await p.evaluate(() => window.scene.stats().zzz);
    await p.waitForTimeout(1500);
    assert.ok((await p.evaluate(() => window.scene.stats().zzz)) > z0, "Zzz while asleep");
    // Nudge: a tap on the sleeper wakes him and the day starts.
    const head = await p.evaluate(() => { const r = document.querySelector(".og-head").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(head.x, head.y);
    await p.waitForFunction(() => window.scene.state.awake && window.scene.state.open, null, { timeout: 8000 });
    const z1 = await p.evaluate(() => window.scene.stats().zzz);
    await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => window.scene.stats().zzz), z1, "no Zzz while awake");
    // The sip: the cup lifts, the saucer stays; the slurp (260 Hz sawtooth start) plays after the gesture above.
    const fill0 = await p.evaluate(() => document.querySelector(".og-liquid").getAttribute("fill"));
    const sau = () => p.evaluate(() => JSON.stringify(document.querySelector(".og-saucer").getBoundingClientRect()));
    const s0 = await sau(), cup0 = await p.evaluate(() => JSON.stringify(document.querySelector(".og-cup").getBoundingClientRect()));
    await p.evaluate(() => (window.__hz.length = 0, window.scene.sip()));
    await p.waitForTimeout(500);
    assert.equal(await sau(), s0, "the saucer does not move");
    assert.notEqual(await p.evaluate(() => JSON.stringify(document.querySelector(".og-cup").getBoundingClientRect())), cup0, "the cup lifts");
    await p.waitForTimeout(800);
    assert.ok(await p.evaluate(() => window.__hz.includes(260)), "the slurp plays after a gesture");
    // The coffee cools: its colour later in the day differs from the morning's.
    await p.waitForTimeout(3000);
    assert.notEqual(await p.evaluate(() => document.querySelector(".og-liquid").getAttribute("fill")), fill0, "the coffee cools");
    await p.waitForFunction(() => +getComputedStyle(document.querySelector(".og")).getPropertyValue("--night") < 0.1, null, { timeout: 8000 });

    // Mute key.
    await p.click(".og-bar button[data-k=sound]");
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => window.scene.state.sound), false, "muted");

    // Pause: rest at 0 rAF/s; play: frames again.
    await p.evaluate(() => window.scene.pause());
    await p.waitForTimeout(800);
    assert.equal(await rafPerSec(p), 0, "0 rAF/s paused");
    await p.evaluate(() => window.scene.play());
    assert.ok(await rafPerSec(p) > 10, "frames after play");
    // Off screen: 0 rAF/s.
    await p.evaluate(() => scrollTo(0, 2500));
    await p.waitForTimeout(400);
    assert.equal(await rafPerSec(p), 0, "0 rAF/s off screen");
    await p.evaluate(() => scrollTo(0, 0));
    assert.ok(await rafPerSec(p) > 10, "frames back on screen");

    // Recall: the root and the page, byte for byte.
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "destroy() gives the page back exactly");
    assert.equal(await rafPerSec(p, 500), 0, "no frames after destroy");
    assert.deepEqual(errs, []);
    await p.close();
  }
  // ---------- Reduced motion: still frames, no particles, settles; the laptop still works ----------
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    await p.evaluate((cup) => (window.scene = og.mount(document.getElementById("root"), { cup })), CUP);
    await p.waitForTimeout(1200);
    assert.equal(await rafPerSec(p), 0, "settled: 0 rAF/s");
    assert.equal(await p.evaluate(() => window.scene.state.open), true, "a still day");
    const blank = () => p.evaluate(() => { const c = document.querySelector(".og canvas"); return !c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some((v) => v); });
    assert.ok(await blank(), "no particles");
    assert.equal(await p.evaluate(() => document.querySelector(".og-why .og-beat").textContent), await p.evaluate(() => og.ORIGIN_WHY), "the whole why, still");
    await p.evaluate(() => window.scene.setLaptop(false));
    await p.waitForFunction(() => !window.scene.state.open && +getComputedStyle(document.querySelector(".og")).getPropertyValue("--night") > 0.5);
    await p.waitForTimeout(800);
    assert.equal(await rafPerSec(p), 0, "settled at night");
    assert.ok(await blank(), "no particles at night either");
    await p.evaluate(() => window.scene.nudge());
    await p.waitForFunction(() => window.scene.state.open && window.scene.state.awake);
    assert.equal(await p.evaluate(() => window.scene.stats().zzz), 0, "no Zzz under reduced motion; the nudge still wakes him");
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall under reduced motion");
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("origin: day loop, laptop night/day, mode, show bricks, 0 rAF/s paused/off screen, reduced motion, sound after a gesture, Recall: ok");
} finally {
  await browser.close();
}
