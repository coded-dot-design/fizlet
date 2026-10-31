// The FILET factory on /bricks/ (site/factory/), a small animation section under the periodic table,
// in Chromium. Run `npm run site` first.
// - Full width, below the table (not the hero), no sideways scroll, every target ≥ 44 px: 1440×900,
//   390×844, 375×667, 844×390; on phones, scrolled to it, the bricks, belt, machine, cartridge slot and
//   HUD fit one screen.
// - Loads its live chunk only near the viewport; the stack is knocked over once the scene is up.
// - Keyboard play: four sends make a cartridge named from names.json, labelled FIZLET, announced.
// - Settles to 0 frames; Recall is exact (reduced motion turned on takes the scene down).
// - No AudioContext before a gesture; mute persists across a reload and keeps it silent.
// - Reduced motion: no live chunk, scattered from the first paint, the cartridge simply appears, 0 frames.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const ROOT = "site-dist";
if (!existsSync(`${ROOT}/bricks/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const NAMES = JSON.parse(readFileSync("site/factory/names.json", "utf8"));
const ALL = [...NAMES.soon.map((g) => g.name), ...NAMES.rolls];
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
const srv = createServer((q, r) => {
  let p = normalize(decodeURIComponent(new URL(q.url, "http://x").pathname)).replace(/^\/+/, "");
  if (p === "" || p.endsWith("/")) p += "index.html";
  const f = join(ROOT, p);
  if (!existsSync(f)) return r.writeHead(404).end();
  r.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise((d) => srv.once("listening", d));
const URL_ = `http://127.0.0.1:${srv.address().port}/bricks/`;
const browser = await chromium.launch(launchOptions());

// Counts rAF callbacks and AudioContexts made.
const PROBE = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = (cb) => raf((t) => (window.__raf++, cb(t)));
  window.__audio = 0;
  const A = window.AudioContext;
  if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); window.__audio++; } };
};
let fails = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`ok - ${name}`); } catch (e) { fails++; console.log(`not ok - ${name}\n  ${e.message.split("\n").join("\n  ")}`); }
};
const errorsOf = (page) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  return errs;
};
const frames = async (page, ms) => {
  const a = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__raf)) - a;
};

// 1. Size, overflow and targets at three viewports (reduced motion off).
for (const [w, h] of [[1440, 900], [390, 844], [375, 667], [844, 390]]) {
  await check(`a section below the table, no overflow, 44 px targets at ${w}×${h}`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = errorsOf(page);
    await page.goto(URL_);
    const m = await page.evaluate(() => {
      const hero = document.querySelector(".fac-hero"), r = hero.getBoundingClientRect();
      const small = [...hero.querySelectorAll("button:not([hidden]), a")].map((b) => [b.className || b.textContent.trim(), b.getBoundingClientRect()])
        .filter(([, b]) => b.width < 44 || b.height < 44).map(([n, b]) => `${n} ${b.width.toFixed(0)}×${b.height.toFixed(0)}`);
      const table = document.querySelector(".pt-hero").getBoundingClientRect();
      return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, scroll: document.documentElement.scrollWidth, small, below: r.top >= table.bottom };
    });
    assert.equal(m.w, m.vw, "the section is full width");
    assert.ok(m.below, "the section sits below the periodic table");
    assert.ok(m.scroll <= m.vw, `no sideways scroll (${m.scroll} > ${m.vw})`);
    assert.deepEqual(m.small, [], "targets under 44 px");
    // Phones: everything that plays is on the first screen (the bricks, the belt, the machine, the
    // cartridge's slot and the HUD); the copy and the keys may follow below.
    if (w < 600) {
      await page.evaluate(() => scrollTo({ top: document.querySelector(".fac-hero").getBoundingClientRect().top + scrollY, behavior: "instant" }));
      const out = await page.evaluate(() => {
        const cart = document.querySelector(".fac-cart");
        cart.hidden = false;
        const off = [".fac-lane", ".fac-machine", ".fac-cart", ".fac-hud", ".fac-b"].flatMap((s) => [...document.querySelectorAll(s)].map((e) => [s, e.getBoundingClientRect()]))
          .filter(([, r]) => r.top < 0 || r.bottom > innerHeight || r.left < -1 || r.right > innerWidth + 1).map(([s, r]) => `${s} ${r.left.toFixed(0)},${r.top.toFixed(0)}–${r.right.toFixed(0)},${r.bottom.toFixed(0)}`);
        cart.hidden = true;
        return off;
      });
      assert.deepEqual(out, [], `the play area fits one ${w}×${h} screen`);
    }
    assert.deepEqual(errs, []);
    await page.close();
  });
}

// 2. Live: scatter, keyboard play, settle, sound after a gesture only, Recall.
await check("scatter on load, keyboard play makes a FIZLET cartridge, settles to 0 frames, Recall exact", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = errorsOf(page);
  await page.addInitScript(PROBE);
  // Hold the live chunk until the page as drawn is recorded.
  let open;
  const gate = new Promise((d) => (open = d));
  await page.route("**/factory/factory.js", async (r) => (await gate, r.continue()));
  await page.goto(URL_);
  await page.evaluate(() => document.querySelector(".fac-hero").scrollIntoView({ behavior: "instant" }));
  // The controller's own state stays (the knocked-over floor, each brick's floor spot); the rest is Recall's.
  const html = () => page.evaluate(() => document.querySelector(".fac-hero").outerHTML.replace(" fac-down", "").replace(/ data-s="\d+"/g, ""));
  const before = await html();
  open();
  await page.waitForSelector(".fac-hero [data-fizlet-slot] canvas", { timeout: 15000 });
  await page.waitForSelector(".fac-hero.fac-down");
  // Mid-tumble, the bricks move through the scene's ledger.
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll(".fac-b")].some((t) => t.style.translate)), "bricks tumble");
  await page.waitForTimeout(1600);
  assert.equal(await frames(page, 1500), 0, "settled after the scatter: no frames");
  assert.equal(await page.evaluate(() => window.__audio), 0, "no AudioContext before a gesture");
  // Recall: reduced motion on takes the scene down; the hero is as the page drew it.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => !document.querySelector("[data-fizlet-slot]"));
  const after = await html();
  assert.equal(after, before, "Recall: the hero comes back exactly");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForSelector(".fac-hero [data-fizlet-slot] canvas", { timeout: 15000 });
  await page.waitForTimeout(1200);
  // Keyboard: the kernel (Enter), input (Space), fx (Enter), the Z (Enter).
  for (const [id, key] of [["kernel", "Enter"], ["input", "Space"], ["fx", "Enter"], ["z", "Enter"]]) {
    await page.focus(`.fac-b[data-id="${id}"]`);
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }
  assert.ok(await page.evaluate(() => window.__audio) <= 1, "one AudioContext at most, after the gesture");
  await page.waitForSelector(".fac-cart:not([hidden])", { timeout: 8000 });
  const cart = await page.evaluate(() => ({ name: document.querySelector(".fac-cart strong").textContent, brand: document.querySelector(".fac-brand").textContent, say: document.querySelector(".fac-say").textContent, z: getComputedStyle(document.querySelector(".fac-zs")).color }));
  assert.ok(ALL.includes(cart.name), `the name ${cart.name} is in names.json`);
  assert.equal(cart.brand, "FIZLET");
  assert.match(cart.say, new RegExp(`^Cartridge made: ${cart.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`));
  await page.waitForTimeout(3500); // the blast's debris lands, then the kernel settles
  assert.equal(await frames(page, 1500), 0, "settled after the run: no frames");
  // Press the cartridge: a new roll.
  await page.focus(".fac-cart");
  await page.keyboard.press("Enter");
  await page.waitForFunction((n) => document.querySelector(".fac-cart strong").textContent !== n, cart.name, { timeout: 8000 });
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check("mute persists and keeps it silent", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(PROBE);
  await page.goto(URL_);
  await page.click(".fac-mute");
  assert.equal(await page.getAttribute(".fac-mute", "aria-pressed"), "true");
  assert.equal(await page.evaluate(() => localStorage.getItem("fizlet:factory:mute")), "1");
  await page.reload();
  assert.equal(await page.getAttribute(".fac-mute", "aria-pressed"), "true", "mute kept after a reload");
  await page.evaluate(() => document.querySelector(".fac-hero").scrollIntoView({ behavior: "instant" }));
  await page.waitForSelector(".fac-hero [data-fizlet-slot] canvas", { timeout: 15000 });
  for (let i = 0; i < 4; i++) await page.click(".fac-go");
  await page.waitForSelector(".fac-cart:not([hidden])", { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__audio), 0, "muted: no AudioContext even after gestures");
  await ctx.close();
});

await check("reduced motion: scattered from the start, no live chunk, the cartridge simply appears, 0 frames", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const js = [];
  page.on("request", (r) => r.url().endsWith(".js") && js.push(r.url()));
  await page.addInitScript(PROBE);
  await page.goto(URL_);
  assert.ok(await page.evaluate(() => document.querySelector(".fac-hero").classList.contains("fac-down")), "scattered");
  const k = await page.evaluate(() => { const t = document.querySelector('.fac-b[data-id="kernel"]'), s = getComputedStyle(t); return [s.rotate, s.getPropertyValue("--r").trim()]; });
  assert.equal(k[0], k[1], "the kernel lies at its floor spot");
  await page.focus(".fac-go");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.querySelector(".fac-cart").hidden), false, "the cartridge is out at once");
  assert.match(await page.textContent(".fac-say"), /^Cartridge made: /);
  assert.equal(await frames(page, 1000), 0, "no frames");
  assert.ok(!js.some((u) => u.includes("factory/")), "the live chunk never loads");
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".fac-hero *")].filter((e) => e.style.translate || e.style.transform).length), 0, "nothing moves");
  await ctx.close();
});

await browser.close();
srv.close();
if (fails) {
  console.log(`${fails} failed`);
  process.exit(1);
}
console.log("factory: all passed");
