// fizlet/timeline in Chromium: real elements animate on the kernel clock (transform, opacity,
// clip-path, a custom property, a stagger), values are right mid-way, the engine settles to zero
// frames when the timeline ends, a looping scene stops asking for frames when paused, Recall mid-play
// restores the page byte for byte (a host inline style included), and with reduced motion play()
// lands on the end state at once.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine, scheduler } from "./src/kernel/index.ts"; export { timeline } from "./src/timeline.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<main id="page"><div id="cart" style="width:80px;height:40px;background:#ff2e88;color: red; opacity: 0.5"></div>
<div id="screen" style="width:200px;height:120px;background:#19f0ff"></div>
<ul id="list"><li>one</li><li>two</li><li>three</li></ul></main><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const before = document.body.innerHTML;
      const $ = (id) => document.getElementById(id);
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      const wait = async (cond, max = 600) => {
        for (let i = 0; i < max && !cond(); i++) await frame();
      };
      const e = fz.createEngine({ settle: 0.25 }), seen = [];
      e.add({ render: (e) => { for (let i = 0; i < e.events.size; i++) seen.push(e.events.at(i).type); } });
      // The cartridge flies in and boots; the screen grows (clip-path); the list staggers in.
      const tl = fz.timeline(e)
        .to($("cart"), { transform: ["translate(0px,-200px) rotate(-8deg)", "translate(0px,0px) rotate(0deg)"], opacity: [0, 1] }, { dur: 0.6, ease: "linear" })
        .label("boot")
        .to($("screen"), { "clip-path": ["inset(50% 50% 50% 50%)", "inset(0% 0% 0% 0%)"], "--glow": ["0", "1"] }, { dur: 0.4, ease: "inOut" })
        .to(document.querySelectorAll("#list li"), { opacity: [0, 1], translate: ["0px 12px", "0px 0px"] }, { at: "boot", dur: 0.3, stagger: 0.1 });
      e.start();
      const ended = tl.done();
      tl.play();
      await wait(() => tl.time >= 0.3);
      const t = tl.time, cs = getComputedStyle($("cart"));
      const mid = { t, opacity: +cs.opacity, transform: $("cart").style.transform, box: $("cart").getBoundingClientRect().top, li: $("list").children[2].style.opacity };
      await ended;
      await frame();
      const end = { transform: $("cart").style.transform, opacity: $("cart").style.opacity, clip: getComputedStyle($("screen")).clipPath, glow: $("screen").style.getPropertyValue("--glow"),
        li: [...$("list").children].map((x) => x.style.opacity + "|" + x.style.translate) };
      await wait(() => e.paused.includes("settled"));
      const settled = e.paused.includes("settled"), r0 = fz.scheduler.requests;
      for (let i = 0; i < 20; i++) await frame();
      const idleRequests = fz.scheduler.requests - r0;
      // A looping scene (a turret sweeping), paused: no more frames once the engine settles.
      const loop = fz.timeline(e, { repeat: Infinity, yoyo: true }).to($("screen"), { rotate: ["-20deg", "20deg"] }, { dur: 0.5, ease: "inOut" });
      loop.play();
      await wait(() => loop.time > 1.2);
      const looping = { playing: loop.playing, running: e.running };
      loop.pause();
      await wait(() => e.paused.includes("settled"));
      const r1 = fz.scheduler.requests;
      for (let i = 0; i < 20; i++) await frame();
      const pausedRequests = fz.scheduler.requests - r1;
      // Recall mid-play: everything the timelines touched comes back byte for byte.
      tl.play();
      loop.play();
      await frame();
      await frame();
      const touched = $("cart").getAttribute("style") !== 'width:80px;height:40px;background:#ff2e88;color: red; opacity: 0.5';
      e.destroy();
      return { mid, end, settled, idleRequests, looping, pausedRequests, touched, same: document.body.innerHTML === before, seen };
    });
    assert.ok(r.mid.t > 0.25 && r.mid.t < 0.6, `mid-way (${r.mid.t})`);
    const k = r.mid.t / 0.6;
    assert.ok(Math.abs(r.mid.opacity - k) < 0.05, `opacity follows the playhead (${r.mid.opacity} vs ${k})`);
    assert.match(r.mid.transform, /^translate\(0px, -?[\d.]+px\) rotate\(-?[\d.]+deg\)$/);
    assert.equal(r.mid.li, "0", "a staggered item holds its first keyframe until it starts");
    assert.deepEqual(r.end, { transform: "translate(0px, 0px) rotate(0deg)", opacity: "1", clip: "inset(0%)", glow: "1", li: ["1|0px", "1|0px", "1|0px"] });
    assert.equal(r.settled, true, "done: the engine settles");
    assert.equal(r.idleRequests, 0, "settled: no frames at all");
    assert.deepEqual(r.looping, { playing: true, running: true }, "a loop keeps it awake");
    assert.equal(r.pausedRequests, 0, "paused loop: no frames");
    assert.equal(r.touched, true);
    assert.equal(r.same, true, "Recall mid-play restores the page byte for byte");
    assert.deepEqual(r.seen.slice(0, 3), ["timeline:start", "boot", "timeline:end"], "events on the ring, in order");
    assert.deepEqual(errs, []);
    await p.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const $ = (id) => document.getElementById(id);
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      const e = fz.createEngine(), tl = fz.timeline(e).to($("cart"), { opacity: [0, 1], transform: ["scale(0.5)", "scale(1)"] }, { dur: 3 });
      e.start();
      tl.play();
      // Wait for frames, not wall time: the first frame advances no time, the next step lands it.
      for (let i = 0; i < 60 && (e.steps < 1 || tl.playing); i++) await frame();
      await frame();
      const out = { reduced: tl.reduced, playing: tl.playing, time: tl.time, opacity: $("cart").style.opacity, transform: $("cart").style.transform, fewSteps: e.steps < 12 };
      e.destroy();
      return out;
    });
    assert.deepEqual(r, { reduced: true, playing: false, time: 3, opacity: "1", transform: "scale(1)", fewSteps: true }, "reduced motion: play() lands on the end state at once");
    await ctx.close();
  }
  {
    // Off screen and back (a real IntersectionObserver): the engine pauses, then the loop plays on
    // (dom-virus#33: the engine's pause hook used to pause the timeline for good).
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await p.setContent(PAGE.replace('<main id="page">', '<main id="page" style="padding-bottom:3000px">'));
    const r = await p.evaluate(async () => {
      const $ = (id) => document.getElementById(id);
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      const wait = async (cond, max = 120) => {
        for (let i = 0; i < max && !cond(); i++) await frame();
        return cond();
      };
      const e = fz.createEngine({ root: $("screen") });
      const tl = fz.timeline(e, { repeat: Infinity }).to($("screen"), { rotate: ["0deg", "90deg"] }, { dur: 1, ease: "linear" });
      e.start();
      tl.play();
      await wait(() => tl.time > 0.2);
      scrollTo(0, 2000);
      const away = await wait(() => e.paused.includes("offscreen"));
      const t = tl.time;
      scrollTo(0, 0);
      const back = await wait(() => !e.paused.length);
      const moved = await wait(() => tl.time > t + 0.1);
      e.destroy();
      return { away, back, moved, playing: tl.playing, recall: $("screen").style.rotate };
    });
    assert.deepEqual(r, { away: true, back: true, moved: true, playing: true, recall: "" }, "off screen and back: the loop plays on; Recall after");
    await p.close();
  }
  console.log("timeline: animates real elements, right mid-way, settles to 0 frames (done or paused), Recall exact mid-play, reduced motion jumps to the end — ok");
} finally {
  await browser.close();
}
