// Browser test for the layers story (site/demos/layers): it mounts through fzlt/slot and follows
// the page's scroll. Its progress is a pure function of the scroll position (the same frame however
// the page got there), it never captures the scroll (a wheel over it moves the page by the full
// amount), it settles (no requestAnimationFrame at all) once the scroll stops, the labels arrive one
// by one with their layers and never overlap, clip or smear, the arrow keys step through it, Recall
// gives the page back byte for byte, reduced motion keeps the still exploded poster, and the inline
// loader fetches no JS until the slot nears the viewport. Waits are on frames and state, not time.
// Run: node tests/layers.mjs (set CHROMIUM_PATH to use a preinstalled Chromium).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { serve } from "../site/demos/layers/serve.mjs";

const OUT = "site-dist/test-layers";
execFileSync(process.execPath, ["site/demos/layers/build.mjs", OUT], { stdio: "inherit" });
const html = readFileSync(`${OUT}/index.html`, "utf8");
const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mountSlot } from "./site/demos/layers/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "L", write: false, logLevel: "silent",
})).outputFiles[0].text;
// The built page, with room to scroll the figure all the way through. Its inline loader does not
// import the chunk: the test's own script mounts the scene through fzlt/slot and keeps the handle.
const PAGE = html
  .replace('import("./layers.js")', "0")
  .replace('<link rel="stylesheet" href="board-ui.css">', `<style>${readFileSync("src/ui/board-ui.css", "utf8")}</style>`)
  .replace("</main>", '</main><div style="height:150vh"></div>')
  .replace("</body>", () => `<script>${bundle}
(() => {
  const raf = (window.raf0 = window.requestAnimationFrame.bind(window));
  window.frames_ = 0;
  window.requestAnimationFrame = (cb) => raf((t) => (window.frames_++, cb(t)));
  window.states = [];
  // Layout shifts (CLS): the story moves only transforms.
  window.cls_ = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.cls_ += e.value; }).observe({ type: "layout-shift", buffered: true });
  window.before = document.body.innerHTML;
  window.watch_ = 1; // from here on, every listener the slot and the scene add
  window.handle = L.slot(document.querySelector("figure.lyr"), () => L.mountSlot, { idle: 0 });
  new MutationObserver(() => {
    const s = document.querySelector('[data-layer="collision"] .lz-tag')?.dataset.state;
    if (s != null && window.states[window.states.length - 1] !== s) window.states.push(s);
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
})();
</script></body>`);

const browser = await chromium.launch(launchOptions());
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✖ ${name}\n${e.stack}`);
  }
}

// Helpers, all counted in frames (the page's own, unwrapped requestAnimationFrame), never wall time.
// settled: the scene asked for no frame over 15 page frames (the kernel has settled).
const settled = (page) => page.evaluate(async () => {
  const f = () => new Promise(window.raf0);
  let last = -1, same = 0;
  for (let k = 0; k < 900 && same < 15; k++) (await f(), (same = window.frames_ === last ? same + 1 : 0), (last = window.frames_));
  return same >= 15;
});
const frames = (page, n) => page.evaluate(async (n) => { for (let k = 0; k < n; k++) await new Promise(window.raf0 ?? requestAnimationFrame); }, n);
// The page's scroll has stopped: scrollY unchanged over 10 page frames (a wheel or a fling may animate).
const still = (page) => page.evaluate(async () => {
  let last = -1, same = 0;
  for (let k = 0; k < 900 && same < 10; k++) (await new Promise(window.raf0), (same = scrollY === last ? same + 1 : 0), (last = scrollY));
  return scrollY;
});
// The scroll range the story spans (the scene's own rule: its middle from 85% to 25% of the viewport).
const span = (page) => page.evaluate(() => {
  const r = document.querySelector("figure.lyr").getBoundingClientRect(), vh = innerHeight, mid = r.top + r.height / 2 + scrollY;
  const a = Math.max(0, mid - vh * 0.85), b = Math.min(Math.max(a + vh * 0.4, mid - vh * 0.25), document.documentElement.scrollHeight - vh);
  return [a, b];
});
// What the scene shows right now: progress, pose, every tank and shell, the HUD, the labels.
const frameOf = (page) => page.evaluate(() => ({
  p: +document.querySelector(".lz").dataset.p,
  pose: document.querySelector(".lz-s").style.transform,
  // (a hidden shell or blast keeps its last place: only what shows counts)
  tanks: [...document.querySelectorAll(".lz-t,.lz-b,.lz-m")].map((t) => (t.style.display ? "-" : `${t.style.transform}/${t.style.opacity}`)).join(";"),
  hud: document.querySelector(".lz-hud").textContent,
  tags: [...document.querySelectorAll(".lz-tag")].map((t) => t.style.opacity).join(","),
  state: document.querySelector('[data-layer="collision"] .lz-tag').dataset.state,
}));
// Counts every wheel, touch or scroll listener the slot and the scene add without { passive: true }
// (it could block the scroll).
const PASSIVE = `<script>window.blocked_ = 0; { const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if (window.watch_ && /wheel|touch|scroll/.test(type) && !(o && o.passive) && !/InjectedScript/.test(new Error().stack)) window.blocked_++;
    return add.call(this, type, fn, o);
  }; }</script>`;
const open = async (page) => {
  await page.setContent(PAGE.replace("<head>", "<head>" + PASSIVE));
  await page.waitForFunction(() => window.handle.mounted && document.querySelector(".lz")?.dataset.p != null, null, { timeout: 30000 });
};

await test("mounts, rests on the game frame, settles with no scroll; no layout shift; Recall is exact", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await open(page);
  const m = await page.evaluate(() => ({
    layers: [...document.querySelectorAll("[data-layer]")].map((l) => l.dataset.layer),
    hidden: document.querySelector("[data-fizlet-slot]").getAttribute("aria-hidden"),
    label: document.querySelector("figure.lyr").getAttribute("aria-label"),
    desc: document.getElementById(document.querySelector("figure.lyr").getAttribute("aria-describedby")).textContent,
    controls: document.querySelectorAll("figure.lyr button,figure.lyr [role=slider]").length,
  }));
  assert.deepEqual(m.layers, ["grid", "characters", "movement", "collision", "rules", "fx", "input", "hud"]);
  assert.equal(m.hidden, "true");
  assert.equal(m.controls, 0, "no play key, no slider");
  // The Board UI kit styles it: the fire key is the kit's arcade key in the fire colour.
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".lz-fire")).backgroundColor), "rgb(255, 43, 78)");
  assert.equal(m.label, "The layers story");
  assert.match(m.desc, /scroll past it.*lift off one by one.*collision layer turns red.*snaps back.*arrow keys/);
  assert.ok(await settled(page), "settles with no scroll");
  const f = await frameOf(page);
  assert.equal(f.p, 0);
  assert.match(f.pose, /rotateX\(0deg\)/, "rests in game mode");
  // Scroll through the story and back: transforms only.
  const [a, b] = await span(page);
  for (let k = 0; k <= 10; k++) (await page.evaluate((y) => scrollTo(0, y), a + ((b - a) * k) / 10), await frames(page, 3));
  await page.evaluate(() => scrollTo(0, 0));
  assert.ok(await settled(page));
  assert.equal(await page.evaluate(() => window.cls_), 0, "no layout shift over the story");
  const [now, was] = await page.evaluate(() => (window.handle.destroy(), [document.body.innerHTML.trimEnd(), window.before.trimEnd()]));
  if (now !== was) { let i = 0; while (now[i] === was[i]) i++; console.log("DIFF at", i, JSON.stringify(was.slice(i - 60, i + 80)), "\nnow", JSON.stringify(now.slice(i - 60, i + 80))); }
  assert.ok(now === was, "destroy() gives the page back exactly");
  assert.deepEqual(errs, []);
  await page.close();
});

for (const [w, h] of [[1440, 900], [390, 844]])
  await test(`progress follows the scroll position, the same frame whichever way it got there; it settles (${w}px)`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await open(page);
    const [a, b] = await span(page);
    assert.ok(b - a > 200, `the story spans ${b - a}px of scroll`);
    const seen = [];
    for (const q of [0.25, 0.5, 0.62, 0.8, 1]) {
      const y = Math.round(a + (b - a) * q);
      await page.evaluate((y) => scrollTo(0, y), y);
      assert.ok(await settled(page), `settles at ${q}`);
      const f = await frameOf(page), want = (await page.evaluate(() => scrollY) - a) / (b - a);
      assert.ok(Math.abs(f.p - want) <= 0.002, `at ${q}: shows ${f.p}, scroll says ${want.toFixed(3)}`);
      seen.push([y, f]);
    }
    // Back to each position by another way (from the far end, then a stop past it): the same frame.
    for (const [y, f] of seen.reverse()) {
      await page.evaluate((y) => scrollTo(0, y + 120), y);
      await frames(page, 4);
      await page.evaluate((y) => scrollTo(0, y), y);
      assert.ok(await settled(page));
      assert.deepEqual(await frameOf(page), f, `the frame at scroll ${y} is the same`);
    }
    await page.close();
  });

await test("the story: the fault is found, scanned and patched as the page scrolls; it snaps back to the game", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await open(page);
  const [a, b] = await span(page);
  // A stop inside each state's window (story seconds of the scene's 12.4: fault 6.8–7.5, scan
  // 7.5–8.9, patched 8.9–9.6), each settled: state, not samples taken while the story eases there.
  for (const [at, want] of [[7.15, "FAULT"], [8.2, "SCANNING"], [9.25, "PATCHED"], [12.4, ""]]) {
    await page.evaluate((y) => scrollTo(0, y), Math.round(a + ((b - a) * at) / 12.4));
    assert.ok(await settled(page));
    assert.equal((await frameOf(page)).state, want, `at ${at} s`);
  }
  assert.ok(await settled(page));
  const f = await frameOf(page);
  assert.equal(f.p, 1);
  assert.match(f.pose, /rotateX\(0deg\)/, "back in game mode");
  assert.match(f.hud, /GREEN \d+VSPINK \d+/);
  assert.notEqual(f.hud, "GREEN 0VSPINK 0", "the game scored on the way");
  await page.close();
});

// No scroll capture: a wheel over the figure and a swipe-sized scroll move the page by the full
// amount, every listener the scene adds is passive (it never calls preventDefault), nothing locks.
await test("no scroll-jacking: a wheel over the figure scrolls the page by exactly its amount", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await open(page);
  const box = await page.locator("figure.lyr").boundingBox();
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, 860));
  for (const dy of [120, 120, 240, -120]) {
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, dy);
    assert.equal((await still(page)) - y0, dy, `wheel ${dy}: the page moved by ${dy}`);
  }
  assert.ok(await settled(page));
  const r = await page.evaluate(() => ({ blocked: window.blocked_, over: [getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow, document.body.style.cssText] }));
  assert.equal(r.blocked, 0, "no non-passive wheel, touch or scroll listener (Playwright's own aside)");
  assert.deepEqual(r.over, ["visible", "visible", ""], "no scroll lock");
  await page.close();
});

// A phone: a touch swipe up over the figure scrolls the page by the swipe (nothing holds it) and plays
// the story along with it.
await test("phone: a swipe up over the figure scrolls the page and plays the story", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await open(page);
  const cdp = await ctx.newCDPSession(page);
  const box = await page.locator("figure.lyr").boundingBox();
  const [a] = await span(page);
  await page.evaluate((y) => scrollTo(0, y), Math.ceil(a));
  assert.ok(await settled(page));
  const p0 = (await frameOf(page)).p, y0 = await page.evaluate(() => scrollY);
  // A finger down on the figure's middle, 20 moves of 10px up, lifted.
  const T = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: 195, y }] });
  const from = Math.min(780, box.y - y0 + box.height / 2 + 100);
  await T("touchStart", from);
  for (let k = 1; k <= 20; k++) await T("touchMove", from - k * 10);
  await T("touchEnd");
  const dy = (await still(page)) - y0;
  assert.ok(await settled(page));
  // The finger moved 200px (less the touch slop, plus any fling): the page went with it, and the
  // story moved by exactly that much scroll.
  assert.ok(dy >= 100, `the swipe moved the page ${dy}px (a 200px swipe)`);
  const [, b] = await span(page);
  const want = Math.min(1, (y0 + dy - a) / (b - a));
  assert.ok((await frameOf(page)).p > p0, "the story moved on");
  assert.ok(Math.abs((await frameOf(page)).p - want) <= 0.002, `the story followed: ${(await frameOf(page)).p} vs ${want.toFixed(3)}`);
  await ctx.close();
});

// Labels over a scroll through the story: every visible label faces the screen (not smeared into its
// layer's plane), sits inside the figure, overlaps no other label, and they arrive one at a time,
// bottom to top, each with its layer. Readable on a phone: 11px text at least.
for (const [w, h] of [[390, 844], [1440, 900]])
  await test(`labels arrive in sequence with their layers, never overlap, clip or smear (${w}px)`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await open(page);
    const [a, b] = await span(page);
    const bad = new Set(), order = [];
    for (let k = 0; k <= 80; k++) {
      await page.evaluate((y) => scrollTo(0, y), a + ((b - a) * k) / 80);
      await frames(page, 2);
      const r = await page.evaluate(() => {
        const f = document.querySelector("figure.lyr").getBoundingClientRect();
        const vis = [...document.querySelectorAll(".lz-tag")].filter((t) => +getComputedStyle(t).opacity > 0.05)
          .map((t) => ({ n: t.parentElement.dataset.layer, r: t.getBoundingClientRect(), px: parseFloat(getComputedStyle(t).fontSize) * +getComputedStyle(t.closest(".lz")).getPropertyValue("--se") }));
        const out = [];
        for (const { n, r, px } of vis) {
          if (r.height < 14) out.push(`${n} smeared (${r.height.toFixed(1)}px tall)`);
          if (px < 10.9) out.push(`${n} text ${px.toFixed(1)}px`);
          if (r.left < f.left - 0.5 || r.right > f.right + 0.5 || r.top < f.top - 0.5 || r.bottom > f.bottom + 0.5) out.push(`${n} outside the figure`);
        }
        for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
          const a = vis[i].r, b = vis[j].r;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) out.push(`${vis[i].n}/${vis[j].n} overlap`);
        }
        return { names: vis.map((v) => v.n), out };
      });
      for (const n of r.names) if (!order.includes(n)) order.push(n);
      for (const o of r.out) bad.add(o);
    }
    assert.deepEqual(order, ["grid", "characters", "movement", "collision", "rules", "fx", "input", "hud"], "in sequence, bottom to top");
    assert.deepEqual([...bad], []);
    await page.close();
  });

// Keyboard: the figure takes focus; the arrows step one stop at a time (each a label, then the fault,
// scan and patch), Home and End go to the ends, and the page does not scroll under the keys. A scroll
// hands it back to the scroll position.
await test("keyboard: arrows step through the layers one label at a time; Home/End; a scroll takes over", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await open(page);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("figure.lyr")), true, "Tab focuses the figure");
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector("figure.lyr")).outlineStyle), /solid/, "focus is visible");
  const y0 = await page.evaluate(() => scrollY);
  const shown = () => page.evaluate(() => [...document.querySelectorAll(".lz-tag")].filter((t) => +t.style.opacity > 0.99).length);
  let last = 0;
  for (let n = 1; n <= 8; n++) {
    await page.keyboard.press("ArrowRight");
    assert.ok(await settled(page));
    assert.equal(await shown(), n, `step ${n}: ${n} labels`);
    const p = (await frameOf(page)).p;
    assert.ok(p > last, "moves forward"), (last = p);
  }
  for (const s of ["FAULT", "SCANNING", "PATCHED"]) {
    await page.keyboard.press("ArrowDown");
    assert.ok(await settled(page));
    assert.equal((await frameOf(page)).state, s);
  }
  await page.keyboard.press("ArrowLeft");
  assert.ok(await settled(page));
  assert.equal((await frameOf(page)).state, "SCANNING", "ArrowLeft steps back");
  await page.keyboard.press("End");
  assert.ok(await settled(page));
  assert.equal((await frameOf(page)).p, 1);
  await page.keyboard.press("Home");
  assert.ok(await settled(page));
  assert.equal((await frameOf(page)).p, 0);
  assert.equal(await page.evaluate(() => scrollY), y0, "the keys did not scroll the page");
  await page.keyboard.press("End");
  assert.ok(await settled(page));
  const [a, b] = await span(page);
  await page.evaluate((y) => scrollTo(0, y), Math.round((a + b) / 2));
  assert.ok(await settled(page));
  const want = ((await page.evaluate(() => scrollY)) - a) / (b - a);
  assert.ok(Math.abs((await frameOf(page)).p - want) <= 0.002, "a scroll takes it back");
  const same = await page.evaluate(() => (window.handle.destroy(), document.body.innerHTML.trimEnd() === window.before.trimEnd()));
  assert.ok(same, "Recall exact after keys and scroll");
  await page.close();
});

await test("reduced motion: the scene never loads; the still exploded frame shows every label", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.setContent(PAGE);
  await frames(page, 20);
  await page.evaluate(() => scrollTo(0, 400));
  await frames(page, 20);
  const r = await page.evaluate(() => ({
    stage: !!document.querySelector("[data-fizlet-slot]"),
    labels: [...document.querySelectorAll(".lyr__t")].filter((t) => +getComputedStyle(t).opacity > 0.99).map((t) => t.textContent),
    flat: !getComputedStyle(document.querySelector(".lyr__s")).transform.startsWith("matrix3d"),
    overflow: document.documentElement.scrollWidth > innerWidth,
    frames: window.frames_,
  }));
  assert.equal(r.stage, false);
  assert.equal(r.labels.length, 8);
  assert.equal(r.flat, false, "exploded");
  assert.match(r.labels[0], /^Board: grid · 630 B gz$/);
  assert.equal(r.overflow, false);
  await page.close();
});

await test("the inline loader: no JS until the slot is near; then the live chunk mounts", async () => {
  const srv = await serve(OUT);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const js = [];
    page.on("request", (r) => r.url().endsWith(".js") && js.push(r.url().split("/").pop()));
    await page.route(srv.url, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: (await res.text()).replace("<main>", '<main><div style="height:5000px"></div>') });
    });
    await page.goto(srv.url);
    await frames(page, 30);
    assert.deepEqual(js, [], "no JS while the slot is far");
    await page.evaluate(() => document.querySelector("figure.lyr").scrollIntoView());
    await page.waitForSelector("[data-fizlet-slot] .lz", { timeout: 10000 });
    assert.deepEqual(js, ["layers.js"]);
    await page.close();
    const rm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const js2 = [];
    rm.on("request", (r) => r.url().endsWith(".js") && js2.push(r.url()));
    await rm.goto(srv.url);
    await frames(rm, 30);
    assert.deepEqual(js2, [], "reduced motion: nothing loads");
    await rm.close();
  } finally {
    srv.close();
  }
});

await test("hero budgets (fizlet-engine docs/LAYERS.md): live chunk ≤ 9,728 B, poster ≤ 6 KB gzip", async () => {
  const sizes = JSON.parse(readFileSync(`${OUT}/sizes.json`, "utf8"));
  assert.ok(sizes.live <= 10240 * 0.95, `live chunk ${sizes.live} B gzip (≥ 5% under 10 KB: ≤ 9,728)`);
  assert.ok(sizes.poster <= 6144, `inline poster + loader ${sizes.poster} B gzip`);
});

await browser.close();
if (failed) process.exit(1);
