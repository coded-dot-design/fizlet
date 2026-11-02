// The origin hero (site/demos/origin/) in Chromium: it plays a day while on screen; closing the
// laptop gives night and sleep, opening it gives day; the mode toggle changes the screens; show
// bricks labels every part; 0 rAF/s paused and off screen; reduced motion is calm (no particles,
// settles); no audio before a gesture (and a mute key); destroy() gives the root back exactly. The two
// looks (the look key, origin:state, Recall in both) and the cup's toys (press feedback, double-tap
// refill, drag, flick and spill, keys), each settling; under reduced motion they change with no animation.
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
    // Read the night now: at 4x the dawn comes 0.3 s after mount.
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const n0 = await vars(p);

    // No sound before a gesture; the mute key is there.
    await p.waitForTimeout(400);
    assert.equal(await p.evaluate(() => window.__ac), 0, "no AudioContext before a gesture");
    assert.ok(await p.$(".og-bar button[data-k=sound]"), "a visible sound / mute key");
    // The why: real text in the DOM, the whole line for screen readers.
    assert.equal(await p.evaluate(() => document.querySelector(".og-why .og-vh").textContent), await p.evaluate(() => og.ORIGIN_WHY));

    // It plays a day on screen: night at first, then the sun is up, he is awake and the lid is open.
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
    assert.ok(tags.some(([, t]) => /@fzlt\/core\/fx 2,797 B/.test(t)) && tags.some(([, t]) => /@fzlt\/core\/timeline 2,120 B/.test(t)), "labels carry brick sizes");

    // Close the laptop (a tap on it, through @fzlt/core/input): night, asleep. Open it: day.
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
    // At 4x he is awake for about 4 s: if a slow machine let him doze off, wake him and try again.
    let lifted = false, s0;
    for (let i = 0; i < 4 && !lifted; i++) {
      if (!(await p.evaluate(() => window.scene.state.awake))) await p.evaluate(() => window.scene.setLaptop(true)), await p.waitForFunction(() => window.scene.state.awake, null, { timeout: 8000 });
      await p.waitForFunction(() => document.querySelector(".og-cup").getAttribute("transform").startsWith("translate(196 268) rotate(0 "), null, { timeout: 4000 }); // the morning sip is over
      s0 = await sau();
      await p.evaluate(() => (window.__hz.length = 0, window.scene.sip()));
      lifted = await p.waitForFunction(() => !document.querySelector(".og-cup").getAttribute("transform").startsWith("translate(196 268) rotate(0 "), null, { timeout: 700 }).then(() => true, () => false);
    }
    assert.ok(lifted, "the cup lifts");
    assert.equal(await sau(), s0, "the saucer does not move");
    await p.waitForTimeout(800);
    assert.ok(await p.evaluate(() => window.__hz.includes(260)), "the slurp plays after a gesture");
    // Enter on the cup sips too (its key target is focusable).
    await p.waitForFunction(() => !document.querySelector(".og-cup").getAttribute("transform").includes("rotate(-"), null, { timeout: 3000 });
    await p.focus(".og-grip");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => /Sip|empty/.test(document.querySelector(".og [role=status]").textContent), null, { timeout: 2000 });
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
  // ---------- Two looks: the look key, the event, Recall in both ----------
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    await p.evaluate((cup) => {
      window.looks = [];
      document.getElementById("root").addEventListener("origin:state", (e) => window.looks.push(e.detail.look));
      window.scene = og.mount(document.getElementById("root"), { speed: 4, cup, reducedMotion: false });
    }, CUP);
    const key = ".og-bar button[data-k=look]";
    await p.waitForTimeout(200);
    assert.deepEqual(await p.evaluate((k) => [window.scene.state.look, document.querySelector(".og").classList.contains("og--fz"), document.querySelector(k).getAttribute("aria-pressed"), document.querySelector(k).textContent], key), ["fizlet", true, "true", "2015Fizlet"], "Fizlet is the default look; the key reads 2015 / Fizlet");
    await p.click(key);
    await p.waitForFunction((k) => document.querySelector(k).getAttribute("aria-pressed") === "false", key);
    assert.deepEqual(await p.evaluate(() => [window.scene.state.look, document.querySelector(".og").classList.contains("og--fz"), window.looks.at(-1)]), ["2015", false, "2015"], "the key switches to 2015 and says so in origin:state");
    assert.match(await p.evaluate(() => document.querySelector(".og [role=status]").textContent), /2015 look/, "the change is announced");
    await p.click(key);
    await p.waitForFunction(() => window.looks.at(-1) === "fizlet");
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall after switching looks");
    // Mounted in the 2015 look (data-look="2015" through mountSlot does the same).
    await p.evaluate((cup) => (window.scene = og.mount(document.getElementById("root"), { speed: 4, cup, reducedMotion: false, look: "2015" })), CUP);
    await p.waitForTimeout(300);
    assert.deepEqual(await p.evaluate((k) => [window.scene.state.look, document.querySelector(".og").classList.contains("og--fz"), document.querySelector(k).getAttribute("aria-pressed")], key), ["2015", false, "false"]);
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall in the 2015 look");
    assert.deepEqual(errs, []);
    await p.close();
  }

  // ---------- The cup's toys: press feedback, double-tap refill, drag, flick and spill, keys, settle ----------
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    // A slow day: it stays night (the cup a little full, 0.15) for the whole test.
    await p.evaluate((cup) => (window.scene = og.mount(document.getElementById("root"), { speed: 0.02, cup, reducedMotion: false })), CUP);
    await p.waitForTimeout(300);
    const st = () => p.evaluate(() => window.scene.stats());
    const said = () => p.evaluate(() => document.querySelector(".og [role=status]").textContent);
    const grip = async () => p.evaluate(() => { const r = document.querySelector(".og-grip").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
    // Every toy settles: no toy motion left, and paused the page asks for 0 frames.
    const settles = async (what) => {
      await p.waitForFunction(() => window.scene.stats().toys === 0, null, { timeout: 9000 });
      await p.evaluate(() => window.scene.pause());
      await p.waitForTimeout(800);
      assert.equal(await rafPerSec(p, 600), 0, `settled after ${what}`);
      await p.evaluate(() => window.scene.play());
    };
    const g0 = await grip();
    assert.ok(g0.w >= 44 && g0.h >= 44, `the cup's hit area is ${g0.w}x${g0.h}`);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".og-grip")).cursor), "grab", "a grab cursor on the cup");

    // Press feedback within a frame: the laptop squashes while held, then pops back.
    const lap = await p.evaluate(() => { const r = document.querySelector(".og-laptop").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.7 }; });
    await p.mouse.move(lap.x, lap.y);
    await p.mouse.down();
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.match(await p.evaluate(() => document.querySelector(".og-laptop").getAttribute("transform")), /scale\(0\.93/, "pressed: squashed on the next frame");
    await p.mouse.up();
    await p.waitForFunction(() => !document.querySelector(".og-laptop").getAttribute("transform"), null, { timeout: 3000 });
    await settles("a press");

    // Double-tap the cup: the pot pours, the level comes back to full, steam.
    assert.ok((await st()).cup.level < 0.5, "a little coffee left");
    let g = await grip();
    // Two taps 120 ms apart (a person's double-tap; two presses inside one frame count once).
    await p.mouse.click(g.x, g.y);
    await p.waitForTimeout(120);
    await p.mouse.click(g.x, g.y);
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".og-pot")).display !== "none", null, { timeout: 2000 });
    assert.match(await said(), /Refill/, "the refill is announced");
    await p.waitForFunction(() => window.scene.stats().cup.level === 1, null, { timeout: 4000 });
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".og-pot")).display === "none", null, { timeout: 4000 });
    await settles("a refill");

    // Drag: it lifts while held and goes down where it is let go.
    const c0 = (await st()).cup;
    g = await grip();
    await p.mouse.move(g.x, g.y);
    await p.mouse.down();
    for (let i = 1; i <= 10; i++) (await p.mouse.move(g.x + i * 14, g.y - i * 3), await p.waitForTimeout(40));
    await p.waitForFunction(() => window.scene.stats().cup.lifted, null, { timeout: 2000 });
    assert.match(await said(), /Picked up/);
    await p.waitForTimeout(250);
    await p.mouse.up();
    const c1 = (await st()).cup;
    assert.ok(c1.x - c0.x > 100 && c0.y - c1.y > 15 && !c1.spilled, `the cup moved: ${JSON.stringify([c0, c1])}`);
    await settles("a drag");
    assert.equal((await st()).cup.lifted, false, "set down");

    // A fast flick knocks it over: a puddle; it rights itself and refills on its own.
    g = await grip();
    await p.mouse.move(g.x, g.y);
    await p.mouse.down();
    await p.waitForTimeout(60);
    await p.mouse.move(g.x + 20, g.y);
    await p.waitForTimeout(60);
    for (let i = 1; i <= 4; i++) await p.mouse.move(g.x + 20 + i * 70, g.y + i * 10);
    await p.mouse.up();
    await p.waitForFunction(() => window.scene.stats().cup.spilled, null, { timeout: 2000 });
    assert.match(await said(), /Knocked over/);
    await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".og-pud")).display), "inline", "the spill shows");
    assert.equal((await st()).cup.level, 0, "spilled empty");
    await p.waitForFunction(() => !window.scene.stats().cup.spilled, null, { timeout: 8000 });
    await p.waitForFunction(() => window.scene.stats().cup.level === 1, null, { timeout: 4000 });
    await settles("a spill and its recovery");

    // Keys on the cup: the arrows move it, R refills, K knocks it over, Enter rights it.
    await p.focus(".og-grip");
    const k0 = (await st()).cup;
    await p.keyboard.press("ArrowLeft");
    await p.keyboard.press("ArrowLeft");
    await p.keyboard.press("ArrowUp");
    await p.waitForTimeout(200);
    const k1 = (await st()).cup;
    assert.deepEqual([Math.round(k0.x - k1.x), Math.round(k0.y - k1.y)], [36, 18], "arrows move the cup");
    await p.keyboard.press("k");
    await p.waitForFunction(() => window.scene.stats().cup.spilled);
    await p.waitForTimeout(600);
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => !window.scene.stats().cup.spilled, null, { timeout: 3000 });
    assert.match(await said(), /Back up|Refill/, "Enter on a spill rights it");
    await p.waitForFunction(() => window.scene.stats().cup.level === 1, null, { timeout: 4000 });
    await settles("the keys");
    await p.keyboard.press("r");
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".og-pot")).display !== "none", null, { timeout: 2000 });
    await settles("R");
    // Enter asks for a sip: asleep, he can't (the sip itself is checked above, awake).
    await p.focus(".og-grip");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => /asleep|Sip/.test(document.querySelector(".og [role=status]").textContent), null, { timeout: 2000 });

    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall after the toys");
    assert.deepEqual(errs, []);
    await p.close();
  }

  // ---------- The desk's other toys: the notebook, the plant, the lamp, the key lights; seeded typing ----------
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    // Speed 1: he is awake for 15 s, long enough to write three times.
    await p.evaluate((cup) => (window.scene = og.mount(document.getElementById("root"), { speed: 1, cup, reducedMotion: false })), CUP);
    const st = () => p.evaluate(() => window.scene.stats());
    const said = () => p.evaluate(() => document.querySelector(".og [role=status]").textContent);
    const settles = async (what) => {
      await p.waitForFunction(() => window.scene.stats().toys === 0, null, { timeout: 9000 });
      await p.evaluate(() => window.scene.pause());
      await p.waitForTimeout(800);
      assert.equal(await rafPerSec(p, 600), 0, `settled after ${what}`);
      await p.evaluate(() => window.scene.play());
    };
    const centre = (sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }, sel);
    await p.waitForFunction(() => window.scene.state.awake && window.scene.state.open, null, { timeout: 9000 });
    await p.waitForTimeout(1200);

    // Typing: the keys he presses light up (in a pool of four) and fade.
    await p.waitForFunction(() => [...document.querySelectorAll(".o-klit")].some((k) => +k.getAttribute("opacity") > 0.5), null, { timeout: 4000 });
    assert.ok((await st()).lit > 0, "a key is lit");

    // The notebook: a click (press, then release) and two more from code; each is a line of code or a
    // doodle, drawn on; the last three stay.
    for (const sel of [".og-book", ".og-plant", ".og-lamp"]) {
      const c = await centre(sel);
      assert.ok(c.w >= 44 && c.h >= 44, `${sel} is ${c.w}x${c.h}`);
    }
    const b = await centre(".og-book");
    await p.mouse.click(b.x, b.y);
    await p.waitForFunction(() => window.scene.stats().pages === 1, null, { timeout: 2000 });
    assert.match(await said(), /He (wrote a line of code|drew )/, "what he wrote is said");
    await settles("writing");
    for (let i = 2; i <= 3; i++) {
      await p.evaluate(() => window.scene.write());
      await p.waitForFunction((n) => window.scene.stats().pages === n, i, { timeout: 2000 });
      await settles("writing");
    }
    const inks = await p.evaluate(() => [...document.querySelectorAll(".og-ink")].map((e) => [!!e.getAttribute("d"), e.getAttribute("stroke-dashoffset")]));
    assert.deepEqual(inks, [[true, "0"], [true, "0"], [true, "0"]], `three drawings, fully drawn: ${JSON.stringify(inks)}`);
    await p.evaluate(() => window.scene.write());
    await p.waitForFunction(() => window.scene.stats().pages === 4);
    await settles("a fourth drawing (it reuses the first line)");

    // The plant: watered, drops spill around it and clear; it perks up.
    const pl = await centre(".og-plant");
    await p.mouse.click(pl.x, pl.y);
    await p.waitForFunction(() => window.scene.stats().drops > 3, null, { timeout: 3000 });
    assert.match(await said(), /Watering/);
    await p.waitForFunction(() => window.scene.stats().drops === 0, null, { timeout: 6000 });
    assert.match(await p.evaluate(() => document.querySelector(".og-leaves").getAttribute("transform")), /scale\(1\.07/, "the plant perks up");
    await settles("watering");

    // The lamp: Enter on it switches it off (the light goes), and back on.
    await p.focus(".og-lamp");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".og")).getPropertyValue("--lamp").trim() === "0", null, { timeout: 2000 });
    assert.deepEqual([(await st()).lamp, await p.evaluate(() => document.querySelector(".og-lamp").getAttribute("aria-label")), await said()], [false, "Turn the lamp on", "Lamp off."]);
    await settles("the lamp off");
    await p.keyboard.press(" ");
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".og")).getPropertyValue("--lamp").trim() === "1", null, { timeout: 2000 });
    assert.equal((await st()).lamp, true);
    await settles("the lamp on");

    // He sleeps: the typing stops and the key lights fade out.
    await p.evaluate(() => window.scene.setLaptop(false));
    await p.waitForFunction(() => window.scene.stats().lit === 0, null, { timeout: 6000 });
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall after the desk's toys");

    // Seeded typing: the same seed types the same keys; another seed types others.
    const typed = async (seed) => {
      await p.evaluate(([cup, seed]) => (window.scene = og.mount(document.getElementById("root"), { speed: 4, cup, reducedMotion: false, seed })), [CUP, seed]);
      await p.waitForFunction(() => window.scene.stats().keys.length >= 16, null, { timeout: 15000 });
      const k = (await st()).keys.slice(0, 16);
      await p.evaluate(() => window.scene.destroy());
      return k;
    };
    const a = await typed(7), a2 = await typed(7), b2 = await typed(8);
    assert.deepEqual(a2, a, `seed 7 types the same keys: ${a}`);
    assert.notDeepEqual(b2, a, "seed 8 types others");
    assert.ok(a.every((k) => k === 99 || (k >= 0 && k < 60)), "keys on the keyboard");
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall");
    assert.deepEqual(errs, []);
    await p.close();
  }

  // ---------- The phone: three genres, each a loop on the audio clock; a double-tap pauses ----------
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    // Every frequency set on the audio clock, with its time.
    await p.evaluate(() => {
      window.__ht = [];
      const sv = AudioParam.prototype.setValueAtTime;
      AudioParam.prototype.setValueAtTime = function (v, t) { window.__ht.push([v, t]); return sv.call(this, v, t); };
    });
    await p.evaluate((cup) => (window.scene = og.mount(document.getElementById("root"), { speed: 0.5, cup, reducedMotion: false })), CUP);
    const label = () => p.evaluate(() => document.querySelector(".og-phone").getAttribute("aria-label"));
    const at = (f) => p.evaluate((f) => window.__ht.filter(([v]) => Math.abs(v - f) < 0.01).map(([, t]) => t), f);
    // Each loop's first note (once a bar): country 98 Hz, rock 82.4 Hz, pop 523.25 Hz; loop voices only.
    const LOOP = [98, 147, 82.4, 110, 130, 523.25, 659.25, 784, 7000, 8000];
    const loopNotes = () => p.evaluate((L) => window.__ht.filter(([v]) => L.some((f) => Math.abs(v - f) < 0.01)).length, LOOP);
    const BAR = [8 * 60 / 110 / 2, 8 * 60 / 132 / 2, 16 * 60 / 118 / 4];
    await p.waitForFunction(() => window.scene.state.awake && window.scene.state.open, null, { timeout: 15000 });
    await p.waitForTimeout(3000);
    // A trusted gesture (on the sky: nothing there to press) unlocks the audio.
    const root = await p.evaluate(() => { const r = document.getElementById("root").getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await p.mouse.click(root.x + 400, root.y + 30);
    assert.equal(await label(), "Music: country. Change style");
    // Country loops at a constant period: one bar of 8 eighths at 110 bpm.
    await p.waitForTimeout(5200);
    const c98 = await at(98);
    assert.ok(c98.length >= 2, `country bars scheduled: ${c98}`);
    for (let i = 1; i < c98.length; i++) assert.ok(Math.abs(c98[i] - c98[i - 1] - BAR[0]) < 1e-6, `bar ${i}: ${c98[i] - c98[i - 1]} s, not ${BAR[0]}`);
    // One click: after 250 ms (no second tap) the style changes; the loop takes it at the next bar line.
    const ph = await p.evaluate(() => { const r = document.querySelector(".og-phone").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
    assert.ok(ph.w >= 44 && ph.h >= 44, `the phone is ${ph.w}x${ph.h}`);
    await p.mouse.click(ph.x, ph.y);
    await p.waitForFunction(() => window.scene.stats().music.genre === "rock", null, { timeout: 1000 });
    assert.equal(await label(), "Music: rock. Change style");
    assert.match(await p.evaluate(() => document.querySelector(".og [role=status]").textContent), /Music: rock/);
    assert.equal(await p.evaluate(() => document.querySelector(".og-genre").textContent), "ROCK", "the phone shows the genre");
    await p.waitForTimeout(BAR[0] * 1000 + 2400);
    const r82 = await at(82.4), last98 = Math.max(...(await at(98)).filter((t) => t < r82[0]));
    assert.ok(r82.length >= 2, `rock bars: ${r82}`);
    assert.ok(Math.abs(r82[0] - last98 - BAR[0]) < 1e-6, `rock starts on the bar line after the last country bar (${r82[0] - last98})`);
    for (let i = 1; i < r82.length; i++) assert.ok(Math.abs(r82[i] - r82[i - 1] - BAR[1]) < 1e-6, `rock bar ${i}: ${r82[i] - r82[i - 1]}`);
    // A double-click pauses the loop (the style stays): no loop notes are scheduled, the phone shows pause.
    await p.mouse.click(ph.x, ph.y);
    await p.waitForTimeout(120);
    await p.mouse.click(ph.x, ph.y);
    await p.waitForFunction(() => window.scene.stats().music.paused, null, { timeout: 1000 });
    await p.waitForTimeout(500);
    assert.deepEqual([(await p.evaluate(() => window.scene.stats().music.genre)), await label(), await p.evaluate(() => getComputedStyle(document.querySelector(".og-pz")).display)], ["rock", "Music: rock, paused. Change style", "inline"], "paused, still rock");
    const n0 = await loopNotes();
    await p.waitForTimeout(1200);
    assert.equal(await loopNotes(), n0, "no loop notes while paused");
    // Double-click again: it plays on.
    await p.mouse.click(ph.x, ph.y);
    await p.waitForTimeout(120);
    await p.mouse.click(ph.x, ph.y);
    await p.waitForFunction(() => !window.scene.stats().music.paused, null, { timeout: 1000 });
    await p.waitForTimeout(800);
    assert.ok(await loopNotes() > n0, "the loop plays again");
    assert.equal(await p.evaluate(() => window.scene.stats().music.genre), "rock", "a double-click never changes the style");
    // The keyboard: Enter cycles (pop, country, rock: three presses come back), P pauses.
    await p.focus(".og-phone");
    const seen = [];
    for (const g of ["pop", "country", "rock"]) {
      await p.keyboard.press("Enter");
      await p.waitForFunction((g) => document.querySelector(".og-phone").getAttribute("aria-label").startsWith(`Music: ${g}.`), g, { timeout: 1000 });
      seen.push(await label());
    }
    assert.deepEqual(seen, ["Music: pop. Change style", "Music: country. Change style", "Music: rock. Change style"], "three presses cycle the three genres; the name follows");
    await p.keyboard.press("p");
    await p.waitForFunction(() => window.scene.stats().music.paused);
    await p.keyboard.press(" ");
    await p.waitForFunction(() => !window.scene.stats().music.paused);
    // Pause the scene: the loop stops too.
    await p.evaluate(() => window.scene.pause());
    await p.waitForTimeout(400);
    const n1 = await loopNotes();
    await p.waitForTimeout(1000);
    assert.equal(await loopNotes(), n1, "the scene paused: no loop notes");
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall after the music");
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
    // The cup's toys change state with no animation, and the scene settles after each.
    const still = async (what) => (await p.waitForTimeout(700), assert.equal(await rafPerSec(p), 0, `settled after ${what} (reduced motion)`));
    await p.focus(".og-grip");
    await p.keyboard.press("k");
    await p.waitForFunction(() => window.scene.stats().cup.spilled && getComputedStyle(document.querySelector(".og-pud")).display === "inline", null, { timeout: 2000 });
    assert.equal(await p.evaluate(() => [window.scene.stats().cup.spilled, getComputedStyle(document.querySelector(".og-pud")).display].join()), "true,inline", "spilled at once");
    assert.equal(await p.evaluate(() => document.querySelector(".og-pud").getAttribute("transform").endsWith("scale(1.00)")), true, "the whole puddle at once, no spreading");
    await still("a spill");
    assert.ok(await blank(), "no splash");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(100);
    assert.deepEqual(await p.evaluate(() => [window.scene.stats().cup.spilled, window.scene.stats().cup.level, getComputedStyle(document.querySelector(".og-pot")).display]), [false, 1, "none"], "righted and refilled at once, no pour");
    await still("righting it");
    const r0 = await p.evaluate(() => window.scene.stats().cup.x);
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => window.scene.stats().cup.x) - r0, 18, "arrows move it");
    await still("a move");
    const g = await p.evaluate(() => { const r = document.querySelector(".og-grip").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(g.x, g.y);
    await p.mouse.down();
    for (let i = 1; i <= 6; i++) (await p.mouse.move(g.x - i * 10, g.y + i * 4), await p.waitForTimeout(40));
    assert.equal(await p.evaluate(() => window.scene.stats().cup.lifted), true, "a drag lifts it at once");
    await p.waitForTimeout(250);
    await p.mouse.up();
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => window.scene.stats().toys), 0, "no toy motion left");
    await still("a drag");
    await p.evaluate(() => window.scene.refill());
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".og-pot")).display), "none", "a refill with no pour");
    await still("a refill");
    // The notebook, the plant, the lamp: whole at once, no hand, no can, no drops, no fade.
    await p.evaluate(() => window.scene.write());
    await p.waitForTimeout(100);
    assert.deepEqual(await p.evaluate(() => [window.scene.stats().pages, document.querySelector(".og-ink").getAttribute("stroke-dashoffset"), !!document.querySelector(".og-ink").getAttribute("d"), getComputedStyle(document.querySelector(".og-pen")).display]), [1, "0", true, "none"], "drawn at once");
    await still("writing");
    await p.evaluate(() => window.scene.water());
    await p.waitForTimeout(100);
    assert.deepEqual(await p.evaluate(() => [window.scene.stats().drops, getComputedStyle(document.querySelector(".og-can")).display, document.querySelector(".og-leaves").getAttribute("transform")]), [0, "none", "scale(1.070)"], "perked at once, no can, no drops");
    await still("watering");
    await p.evaluate(() => window.scene.setLamp(false));
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".og")).getPropertyValue("--lamp").trim()), "0", "the lamp is off at once");
    await still("the lamp");
    // The phone: Enter still changes the style (no head bob, no notes).
    await p.focus(".og-phone");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => document.querySelector(".og-phone").getAttribute("aria-label") === "Music: rock. Change style", null, { timeout: 1000 });
    await still("a style change");
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall under reduced motion");
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("origin: day loop, laptop night/day, mode, show bricks, two looks, the cup's toys (press, double-tap refill, drag, flick and spill, keys), the notebook, the plant, the lamp, key lights, seeded typing, the phone's looping genres (constant bar period, bar-line switch, double-tap pause), settle, 0 rAF/s paused/off screen, reduced motion, sound after a gesture, Recall: ok");
} finally {
  await browser.close();
}
