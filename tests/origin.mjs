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

    // Close the laptop (a tap on its screen, through @fzlt/core/input): night, asleep. Open it: day.
    const box = await p.evaluate(() => { const r = document.querySelector(".og-laptop").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.2 }; });
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
      await p.waitForFunction(() => document.querySelector(".og-cup").getAttribute("transform").startsWith("translate(246 326) scale(1) "), null, { timeout: 4000 }); // the morning sip is over
      s0 = await sau();
      await p.evaluate(() => (window.__hz.length = 0, window.scene.sip()));
      lifted = await p.waitForFunction(() => !document.querySelector(".og-cup").getAttribute("transform").startsWith("translate(246 326) scale(1) "), null, { timeout: 700 }).then(() => true, () => false);
    }
    assert.ok(lifted, "the cup lifts");
    assert.equal(await sau(), s0, "the saucer does not move");
    // The slurp comes during the sip: wait for it (state), with a generous ceiling for slow runners (#274).
    const slurp = await p.waitForFunction(() => window.__hz.includes(260), null, { timeout: 5000 }).then(() => true, () => false);
    assert.ok(slurp, "the slurp plays after a gesture");
    // Enter on the cup sips too (its key target is focusable).
    await p.waitForFunction(() => window.scene.stats().arm.sip === 0, null, { timeout: 3000 });
    await p.focus(".og-grip");
    await p.keyboard.press("Enter");
    // (By now his sips have him wired: at night the scene may say so instead, in the same frame.)
    const answered = await p.waitForFunction(() => /Sip|empty|asleep|reach|coffee/.test(document.querySelector(".og [role=status]").textContent), null, { timeout: 2000 }).then(() => true, () => false);
    assert.ok(answered, `Enter on the cup: ${await p.evaluate(() => document.querySelector(".og [role=status]").textContent)}`);
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
    // Wait on the squash itself (state), polled every frame: two fixed frames miss it on a loaded
    // runner, where the scene's 30 fps step can land a frame or two later. A 1 s ceiling still fails
    // a press that never shows.
    const squashed = await p.waitForFunction(() => /scale\(0\.93/.test(document.querySelector(".og-laptop").getAttribute("transform") ?? ""), null, { timeout: 1000, polling: "raf" }).then(() => true, () => false);
    assert.ok(squashed, "pressed: the laptop squashes while held");
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

  // ---------- The owner's review: the lid, the chair, the pours, the laptop as a toggle, the pen, the
  // scene's own palette (day light, night dark, whatever the page's theme), the plant's spot, the hint,
  // and the caffeine meter. State waits only: a frame-rate window is the one timed measurement.
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 }, colorScheme: "dark" });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    await p.evaluate((cup) => (window.scene = og.mount(document.getElementById("root"), { speed: 1, cup, reducedMotion: false })), CUP);
    const st = () => p.evaluate(() => window.scene.stats());
    const said = () => p.evaluate(() => document.querySelector(".og [role=status]").textContent);
    const quiet = async (what) => {
      await p.waitForFunction(() => window.scene.stats().toys === 0, null, { timeout: 9000 });
      await p.evaluate(() => window.scene.pause());
      // The kernel settles 0.4 s after its last busy frame: wait until two reads a frame apart agree.
      await p.waitForFunction(() => new Promise((r) => { const a = window.__raf; setTimeout(() => r(window.__raf === a), 500); }), null, { timeout: 5000, polling: 100 });
      assert.equal(await rafPerSec(p, 600), 0, `settled after ${what}`);
      await p.evaluate(() => window.scene.play());
    };
    // Colours as the browser computes them (hex, rgb() or color(srgb ...)), and WCAG contrast.
    await p.evaluate(() => {
      const ch = (s) => { const m = s.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/); if (m) return [+m[1], +m[2], +m[3]]; const n = s.match(/[\d.]+/g).map(Number); return [n[0] / 255, n[1] / 255, n[2] / 255]; };
      const lum = (c) => { const l = ch(c).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
      window.__lum = lum;
      window.__contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    });
    const palette = () => p.evaluate(() => {
      const og = document.querySelector(".og"), cs = (el) => getComputedStyle(el);
      const keys = [...og.querySelectorAll(".og-bar button")].map((b) => window.__contrast(cs(b).color, cs(b).backgroundColor));
      const why = window.__contrast(cs(og.querySelector(".og-why")).color, cs(og.querySelector(".og-why")).backgroundColor), hint = window.__contrast(cs(og.querySelector(".og-hint")).color, cs(og.querySelector(".og-hint")).backgroundColor);
      return { bg: window.__lum(cs(og).backgroundColor), keys: Math.min(...keys), why, hint, chair: window.__lum(cs(og.querySelector(".og-chair .o-chair")).fill) };
    });
    await p.waitForFunction(() => window.scene.state.awake && window.scene.state.open && +getComputedStyle(document.querySelector(".og")).getPropertyValue("--night") < 0.01, null, { timeout: 15000 });

    // Day (the page asks for dark: the scene keeps its own clock): the light palette.
    const day = await palette();
    assert.ok(day.bg > 0.8, `day: the light palette (${day.bg})`);
    for (const k of ["keys", "why", "hint"]) assert.ok(day[k] >= 4.5, `day: ${k} contrast ${day[k].toFixed(2)}`);
    assert.ok(day.chair < 0.05, `the chair is dark ink by day (${day.chair})`);
    // He sits on the chair: every part of it is under his body and arms (before them in paint order),
    // and only its dark edge shows: the back's top below his shoulder blades and its two arm ends at the
    // bottom. Nothing of it reaches his sides or his shoulders (the owner's mock).
    const back = await p.evaluate(() => {
      const torso = document.querySelector(".og-sit > path.o-shirt"), svg = document.querySelector(".og-svg");
      const top = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return document.elementFromPoint(q.x, q.y); };
      const under = [...document.querySelectorAll(".o-chair")].every((c) => [torso, document.querySelector(".og-arm-l"), document.querySelector(".og-arm-r")].every((b) => c.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      const box = [...document.querySelectorAll(".og-chair > *")].map((c) => c.getBBox()).reduce((a, r) => [Math.min(a[0], r.x), Math.min(a[1], r.y), Math.max(a[2], r.x + r.width)], [1e9, 1e9, -1e9]);
      return { under, box: box.map(Math.round), seen: !!top(400, 497)?.closest(".og-chair"), shirt: [[294, 490], [506, 490], [314, 474], [486, 474], [400, 470]].every(([x, y]) => !top(x, y)?.closest(".og-chair")) };
    });
    assert.deepEqual(back, { under: true, box: [288, 485, 512], seen: true, shirt: true }, "the chair under him: only its dark edge shows below his back");
    assert.equal(await p.evaluate(() => document.querySelector(".og-hint").textContent.includes("Click or double-click anything to see it move")), true, "the hint");
    // The lid: its far edge is wider than the base (and the hinge); the plant is top right.
    const geo = await p.evaluate(() => { const lid = document.querySelector(".og-screen path.o-lid").getBBox(), base = document.querySelector(".og-laptop > rect.o-face").getBBox(), pl = document.querySelector(".og-plant").getBBox(); const m = document.querySelector(".og-plant").transform.baseVal.consolidate().matrix; return { lid: [lid.x, lid.width], base: [base.x, base.width], plant: [m.e, m.f] }; });
    assert.ok(geo.lid[0] < geo.base[0] && geo.lid[1] > geo.base[1], `the lid's far edge is wider than the base: ${JSON.stringify(geo)}`);
    assert.ok(geo.plant[0] > 650 && geo.plant[1] < 200, `the plant is top right: ${geo.plant}`);

    // The pours: each stream starts at its spout's tip and leaves along the spout's angle.
    const spout = (box, tip, ang, sel) => p.evaluate(([box, tip, ang, sel]) => {
      const b = document.querySelector(box), s = document.querySelector(sel), d = s.getAttribute("d").match(/-?[\d.]+/g).map(Number);
      const at = (el, x, y) => new DOMPoint(x, y).matrixTransform(el.getScreenCTM());
      const t = at(b, tip[0], tip[1]), t2 = at(b, tip[0] + Math.cos(ang) * 10, tip[1] + Math.sin(ang) * 10), s0 = at(s, d[0], d[1]), s1 = at(s, d[2], d[3]);
      const a1 = Math.atan2(t2.y - t.y, t2.x - t.x), a2 = Math.atan2(s1.y - s0.y, s1.x - s0.x);
      return { off: Math.hypot(t.x - s0.x, t.y - s0.y), turn: Math.abs(((a1 - a2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) };
    }, [box, tip, ang, sel]);
    await p.evaluate(() => window.scene.refill());
    await p.waitForFunction(() => +document.querySelector(".og-stream").getAttribute("stroke-width") > 6, null, { timeout: 3000, polling: "raf" });
    const pot = await spout(".og-potb", [44, 0], 0, ".og-stream");
    assert.ok(pot.off < 0.6 && pot.turn < 0.02, `the coffee leaves the pot's spout: ${JSON.stringify(pot)}`);
    await quiet("the pour");
    await p.evaluate(() => window.scene.water());
    await p.waitForFunction(() => +document.querySelector(".og-wstream").getAttribute("stroke-width") > 3, null, { timeout: 3000, polling: "raf" });
    const can = await spout(".og-canb", [55.84, -13.38], -0.2307, ".og-wstream");
    assert.ok(can.off < 0.6 && can.turn < 0.02, `the water leaves the can's rose: ${JSON.stringify(can)}`);
    await quiet("watering");

    // Writing: he picks up the pen beside the book, writes, and puts it back: one pen, never two.
    await p.evaluate(() => {
      window.__pens = { both: 0, held: 0 };
      const f = () => { const a = getComputedStyle(document.querySelector(".og-pen")).display !== "none", b = getComputedStyle(document.querySelector(".og-dpen")).display !== "none"; if (a && b) window.__pens.both++; if (a) window.__pens.held++; if (window.__pens.on) requestAnimationFrame(f); };
      window.__pens.on = 1;
      requestAnimationFrame(f);
    });
    await p.evaluate(() => window.scene.write());
    await p.waitForFunction(() => window.scene.stats().pages === 1, null, { timeout: 2000 });
    await p.waitForFunction(() => window.scene.stats().toys === 0, null, { timeout: 9000 });
    const pens = await p.evaluate(() => ((window.__pens.on = 0), window.__pens)); // (the watcher's own frames stop here)
    await quiet("writing");
    assert.ok(pens.held > 5 && pens.both === 0, `the pen goes from the desk to his hand and back: ${JSON.stringify(pens)}`);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".og-dpen")).display), "inline", "the pen is back on the desk");

    // The laptop: open, a press on the keys lights that key and leaves it open; a press on the screen
    // closes it, and he sleeps and stays asleep through the night's "sleep"; closed, a press opens it.
    const lap = (f) => p.evaluate((f) => { const r = document.querySelector(".og-laptop").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * f }; }, f);
    let k = await lap(0.58);
    await p.mouse.click(k.x, k.y);
    await p.waitForFunction(() => window.scene.stats().lit > 0, null, { timeout: 2000 });
    assert.equal(await p.evaluate(() => window.scene.state.open), true, "keys light, the lid stays open");
    k = await lap(0.15);
    await p.mouse.click(k.x, k.y);
    await p.waitForFunction(() => !window.scene.state.open && !window.scene.state.awake, null, { timeout: 6000 });
    const z0 = (await st()).zzz;
    await p.waitForFunction((z) => window.scene.stats().zzz >= z + 8, z0, { timeout: 15000 });
    assert.deepEqual(await p.evaluate(() => [window.scene.state.open, window.scene.state.awake]), [false, false], "asleep through the night; he does not wake by himself");
    // Night: the dark palette, contrast held.
    const night = await palette();
    assert.ok(night.bg < 0.02, `night: the dark palette (${night.bg})`);
    for (const k of ["keys", "why", "hint"]) assert.ok(night[k] >= 4.5, `night: ${k} contrast ${night[k].toFixed(2)}`);
    k = await lap(0.5);
    await p.mouse.click(k.x, k.y);
    await p.waitForFunction(() => window.scene.state.open && window.scene.state.awake, null, { timeout: 8000 });
    await quiet("the laptop");

    // Caffeine: three sips close together; night comes and he stays up, the lid open, no Zzz; the
    // lid will not close ("one more commit"); once it wears off, he sleeps.
    for (let i = 1, tries = 0; i <= 3 && tries < 12; tries++) {
      // A sip waits until he is fully awake and the cup is down; one asked too early is refused: ask again.
      await p.waitForFunction(() => document.querySelector(".og-cup").getAttribute("transform").startsWith("translate(246 326) scale(1) ") && window.scene.state.awake, null, { timeout: 8000 });
      const c0 = (await st()).caffeine;
      await p.evaluate(() => window.scene.sip());
      if (await p.waitForFunction((c) => window.scene.stats().caffeine > c + 0.5, c0, { timeout: 3500 }).then(() => true, () => false)) i++;
    }
    assert.equal((await st()).wired, true, "three cups: wired");
    await p.waitForFunction(() => /Too much coffee/.test(document.querySelector(".og [role=status]").textContent), null, { timeout: 30000 });
    const z1 = (await st()).zzz;
    assert.deepEqual(await p.evaluate(() => [window.scene.state.awake, window.scene.state.open, +getComputedStyle(document.querySelector(".og")).getPropertyValue("--night") > 0.3]), [true, true, true], "night, and still awake at the laptop");
    k = await lap(0.15);
    await p.mouse.click(k.x, k.y);
    await p.waitForFunction(() => /One more commit/.test(document.querySelector(".og [role=status]").textContent), null, { timeout: 2000 });
    assert.equal(await p.evaluate(() => window.scene.state.open), true, "wired, he keeps it open");
    await p.waitForFunction(() => !window.scene.stats().wired && !window.scene.state.awake, null, { timeout: 30000 });
    assert.match(await said(), /wore off/);
    assert.equal((await st()).zzz, z1, "no Zzz while he was wired");

    // The phone's genre card: a sticker that pops in on a change, holds, fades; the name keeps the genre.
    await p.focus(".og-phone");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => +document.querySelector(".og-gchip").getAttribute("opacity") === 1 && !document.querySelector(".og-gchip").getAttribute("transform"), null, { timeout: 3000, polling: "raf" });
    assert.match(await p.evaluate(() => document.querySelector(".og-gchip").textContent + " · " + document.querySelector(".og-phone").getAttribute("aria-label")), /^ROCK · Music: rock\. Change style$/, "the card says the genre; so does the name");
    await p.waitForFunction(() => +document.querySelector(".og-gchip").getAttribute("opacity") === 0 && !window.scene.stats().genreCard, null, { timeout: 4000 });
    await quiet("the genre card");

    // The sip, frame by frame (sampled on every frame, by state): his hand takes the cup by its handle
    // and carries it; in each move (reach, lift, hold, lower, back) his elbow bends one
    // way only; his wrist stays straight; the cup and the coffee only move and scale (no turn, no skew,
    // the same top-down drawing); the fingers sit on the handle and stop short of the coffee; the handle
    // stays in sight beside his hand; and his hand paints over the cup and its shadow. Both looks.
    k = await lap(0.5);
    await p.mouse.click(k.x, k.y);
    for (const look of ["fizlet", "2015"]) {
      await p.evaluate((l) => window.scene.setLook(l), look);
      // One light: every object's shadow is offset by the same screen vector, whatever the object's own
      // turn (2015: 4,4 down-right; Fizlet: 0,7 straight down, the Board UI shadow).
      await p.waitForFunction(() => window.scene.stats().arm.sip === 0 && window.scene.state.awake, null, { timeout: 12000 });
      const offs = await p.evaluate(() => {
        const k = document.querySelector(".og-svg").getScreenCTM().a, c = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; };
        const pairs = { lamp: [".og-lamp .o-sh", ".og-lamp .o-face"], book: [".og-book .o-sh rect", ".og-book .o-face"], plant: [".og-plant .o-sh", ".og-plant .o-face"], laptop: [".og-laptop > .o-sh", ".og-laptop > .o-face"], phone: [".og-phone .o-sh rect", ".og-phone .o-face"], body: [".og-body path.o-sh", ".og-sit > path.o-shirt"] };
        const cup = new DOMPoint(39, 39).matrixTransform(document.querySelector(".og-cup").getScreenCTM()), cs = c(".og-cupsh circle");
        return { ...Object.fromEntries(Object.entries(pairs).map(([n, [a, o]]) => { const A = c(a), O = c(o); return [n, [Math.round((A[0] - O[0]) / k * 10) / 10, Math.round((A[1] - O[1]) / k * 10) / 10]]; })), cup: [Math.round((cs[0] - cup.x) / k * 10) / 10, Math.round((cs[1] - cup.y) / k * 10) / 10] };
      });
      const L = look === "2015" ? [4, 4] : [0, 7];
      for (const [n, [x, y]] of Object.entries(offs)) assert.ok(Math.abs(x - L[0]) < 0.3 && Math.abs(y - L[1]) < 0.3, `${look}: the ${n}'s shadow falls along the one light (${x}, ${y})`);
      let log = null;
      for (let i = 0; i < 6 && !log; i++) {
        await p.waitForFunction(() => window.scene.stats().arm.sip === 0 && window.scene.state.awake && window.scene.state.open, null, { timeout: 12000 });
        await p.evaluate(() => {
          window.__sip = [];
          const f = () => {
            const a = window.scene.stats().arm, cup = document.querySelector(".og-cup"), lq = document.querySelector(".og-liquid"), m = lq.getScreenCTM(), hm = document.querySelector(".og-hand-l").getScreenCTM();
            const h = document.querySelector(".og-handle").getBoundingClientRect(), g = new DOMPoint(4, 8).matrixTransform(hm), li = m.inverse();
            // Dry: the two fingertips and the thumb's tip (hand-local) stay outside the coffee's ellipse.
            const dry = Math.min(...[[2.6, 13], [6.5, 12], [10.9, 11]].map(([x, y]) => { const q = new DOMPoint(x, y).matrixTransform(hm).matrixTransform(li); return ((q.x - lq.getAttribute("cx")) / +lq.getAttribute("rx")) ** 2 + ((q.y - lq.getAttribute("cy")) / +lq.getAttribute("ry")) ** 2 - 1; }));
            // Seen: points along the handle's loop (its own coordinates) that no part of his hand or forearm covers.
            const hg = document.querySelector(".og-handle").parentNode.getScreenCTM(), shapes = [...document.querySelectorAll(".og-hand-l rect, .og-hand-l path, .og-arm-l .og-skin")].filter((e) => e.getBoundingClientRect().width > 0);
            let seen = 0;
            for (let j = 0; j < 24; j++) { const p = new DOMPoint(j < 16 ? 3 + (j >> 1) * 1.5 : 3, j < 16 ? (j & 1 ? 50 : 35) : 37 + (j - 16) * 1.5).matrixTransform(hg); if (!shapes.some((e) => { const l = p.matrixTransform(e.getScreenCTM().inverse()); return e.isPointInFill(l) || e.isPointInStroke(l); })) seen++; }
            const grip = document.querySelector(".og-grip-l"), after = (sel) => !!(document.querySelector(sel).compareDocumentPosition(grip) & Node.DOCUMENT_POSITION_FOLLOWING);
            const csh = document.querySelector(".og-cupsh"), cc = new DOMPoint(39, 39).matrixTransform(cup.getScreenCTM()), sr = csh.firstElementChild.getBoundingClientRect(), kk = document.querySelector(".og-svg").getScreenCTM().a;
            const sh = getComputedStyle(csh).display === "none" ? null : [(sr.x + sr.width / 2 - cc.x) / kk, (sr.y + sr.height / 2 - cc.y) / kk];
            if (a.sip > 0) window.__sip.push({ sh, s: a.sip, bend: a.bend, wrist: a.wrist, t: cup.getAttribute("transform"), skew: Math.abs(m.b) + Math.abs(m.c), aspect: Math.abs(m.a - m.d), up: document.querySelector(".og-upg").getAttribute("transform") ?? "", on: Math.hypot(h.x + h.width / 2 - g.x, h.y + h.height / 2 - g.y), dry, seen, above: getComputedStyle(grip).display !== "none" && after(".og-cup") && after(".og-cupsh") });
            if (!(window.__sip.length && a.sip === 0)) requestAnimationFrame(f);
          };
          requestAnimationFrame(f);
          window.scene.sip();
        });
        log = await p.waitForFunction(() => window.__sip.length > 10 && window.scene.stats().arm.sip === 0 && window.__sip, null, { timeout: 6000, polling: "raf" }).then((r) => r.jsonValue(), () => null);
      }
      assert.ok(log && log.length > 20 && Math.max(...log.map((r) => r.s)) > 0.99, `${look}: a whole sip was sampled (${log?.length} frames)`);
      // The moves, by the sip's value and its direction.
      const peak = log.findIndex((r) => r.s > 0.99), phase = (r, i) => (i <= peak ? (r.s < 0.35 ? "reach" : "lift") : r.s > 0.99 ? "hold" : r.s >= 0.35 ? "lower" : "back");
      const runs = {};
      log.forEach((r, i) => (runs[phase(r, i)] ??= []).push(r.bend));
      for (const [name, bends] of Object.entries(runs)) {
        const d = bends.slice(1).map((b, i) => b - bends[i]).filter((x) => Math.abs(x) > 0.15); // his breathing sways the shoulder by under 0.15°
        assert.ok(d.every((x) => x > 0) || d.every((x) => x < 0), `${look}: the elbow bends one way in "${name}" (${bends.map((b) => b.toFixed(1)).join(" ")})`);
      }
      assert.ok(log.every((r) => Math.abs(r.wrist) < 2), `${look}: the wrist stays in line with the forearm (worst ${Math.max(...log.map((r) => Math.abs(r.wrist))).toFixed(2)}°)`);
      assert.ok(log.every((r) => !/rotate|skew|matrix/.test(r.t + r.up) && r.skew < 1e-6 && r.aspect < 1e-6), `${look}: the cup and the coffee only move and scale`);
      // The cup's shadow goes with the cup, along the light, further out as it rises; it is gone before
      // the cup reaches his face.
      const L2 = look === "2015" ? [4, 4] : [0, 7], shs = log.filter((r) => r.sh);
      assert.ok(shs.every((r) => Math.abs(r.sh[0] * L2[1] - r.sh[1] * L2[0]) < 0.5 && r.sh[0] * L2[0] + r.sh[1] * L2[1] > 0), `${look}: the cup's shadow stays along the light`);
      assert.ok(Math.max(...shs.map((r) => Math.hypot(...r.sh))) > Math.hypot(...L2) * 1.3, `${look}: the cup's shadow moves further out as it rises`);
      assert.ok(log.filter((r) => r.s > 0.99).every((r) => !r.sh), `${look}: no cup shadow at his mouth`);
      const lifted = log.filter((r) => r.s > 0.4);
      assert.ok(lifted.every((r) => r.on < 4), `${look}: the fingers are on the handle while he holds it (worst ${Math.max(...lifted.map((r) => r.on)).toFixed(1)} px)`);
      assert.ok(lifted.every((r) => r.dry > 0), `${look}: the fingers stop short of the coffee`);
      assert.ok(lifted.every((r) => r.seen >= 5), `${look}: the handle shows beside his hand (fewest ${Math.min(...lifted.map((r) => r.seen))} of 24 points)`);
      assert.ok(lifted.every((r) => r.above), `${look}: the hand paints over the cup and its shadow`);
    }
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall after the review's toys");
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
    // Caffeine as state only: three sips, wired; the laptop's key will not close the lid.
    for (let i = 0; i < 3; i++) await p.evaluate(() => window.scene.sip()), await p.waitForFunction((n) => window.scene.stats().caffeine >= n, i + 1, { timeout: 2000 });
    assert.equal(await p.evaluate(() => window.scene.stats().wired), true, "wired at once");
    await p.focus(".og-laptop");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => /One more commit/.test(document.querySelector(".og [role=status]").textContent), null, { timeout: 2000 });
    assert.equal(await p.evaluate(() => window.scene.state.open), true);
    await still("caffeine");
    // The phone: Enter still changes the style (no head bob, no notes).
    await p.focus(".og-phone");
    await p.keyboard.press("Enter");
    // The genre card shows at once (no pop) and goes after a moment, with no fade.
    await p.waitForFunction(() => document.querySelector(".og-gchip").getAttribute("opacity") === "1.00" && !document.querySelector(".og-gchip").getAttribute("transform"), null, { timeout: 1000 });
    await p.waitForFunction(() => document.querySelector(".og-gchip").getAttribute("opacity") === "0.00", null, { timeout: 4000 });
    await p.waitForFunction(() => document.querySelector(".og-phone").getAttribute("aria-label") === "Music: rock. Change style", null, { timeout: 1000 });
    await still("a style change");
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall under reduced motion");
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("origin: day loop, laptop night/day, mode, show bricks, two looks, the cup's toys (press, double-tap refill, drag, flick and spill, keys), the notebook, the plant, the lamp, key lights, seeded typing, the phone's looping genres (constant bar period, bar-line switch, double-tap pause), the review (lid, chair, pours, laptop toggle, one pen, the scene's own palette and contrast, caffeine, the genre card, the hand on the handle), settle, 0 rAF/s paused/off screen, reduced motion, sound after a gesture, Recall: ok");
} finally {
  await browser.close();
}
