// The Fizlet periodic table, the hero of /bricks/ (site/periodic.mjs, site/periodic.ts), in Chromium.
// Run `npm run site` first.
// - Every brick and every planned brick is a key, by number, in its family's column, like a brick card
//   at tile scale: its status sticker on the top edge, its size measured on this build with its colour
//   dot top right (planned keys: dashed, no size), its symbol in the middle.
// - A click (or Enter) presses the key (aria-expanded: the kit's press), lights it, says PRESSED and
//   opens that brick's quick view, one at a time; Esc and the close key close it; arrow keys move.
// - 0 frames at rest and after opening and closing; reduced motion: the quick view simply appears.
// - Phones (390): no page-level sideways scroll (the table scrolls in its own box), the quick view is
//   a bottom sheet. No console errors.
// - The sticker sheet: one valid SVG per brick, each a download. Symbol chips: the name on hover and
//   focus, and as the accessible name.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { BRICKS, PLANNED } from "../site/bricks.mjs";
import { measure } from "../scripts/sizes.mjs";

const ROOT = "site-dist";
if (!existsSync(`${ROOT}/bricks/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
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
const SIZES = await measure();
// Every tile: each brick, a module with its own symbol (presence/check: "14b", after its brick), each planned brick.
const ALL = [
  ...BRICKS.flatMap((b) => [{ id: b.id, no: b.no, at: b.no, sym: b.sym, name: b.name, planned: false, size: b.sizes[0], status: b.status },
    ...b.modules.slice(1).filter((m) => m.sym).map((m) => ({ id: m.name.split("/").slice(-2).join("-"), no: `${b.no}b`, at: b.no + 0.5, sym: m.sym, name: m.name, planned: false, size: m.size, status: b.status, part: true }))]),
  ...PLANNED.map((p) => ({ id: p.name.split("/").pop(), no: p.no, at: p.no, sym: p.sym, name: p.name, planned: true })),
].sort((a, b) => a.at - b.at);

const PROBE = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = (cb) => raf((t) => (window.__raf++, cb(t)));
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
const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errs = errorsOf(page);
  await page.addInitScript(PROBE);
  await page.goto(URL_);
  return { ctx, page, errs };
};
const state = (page) => page.evaluate(() => {
  const card = document.querySelector(".pt-card");
  return {
    expanded: [...document.querySelectorAll('.el-key[aria-expanded="true"]')].map((k) => k.dataset.el),
    hidden: card.hidden, name: card.querySelector(".pt-q-name")?.textContent ?? "", link: card.querySelector(".pt-q-go")?.getAttribute("href") ?? "",
    size: card.querySelector(".pt-q-size b")?.textContent ?? "", meter: !!card.querySelector(".meter"), focus: document.activeElement?.dataset?.el ?? document.activeElement?.className ?? "",
  };
});

await check("every brick and every planned brick is a key, by number, in its family; sizes measured; planned dashed", async () => {
  const { ctx, page, errs } = await open();
  const keys = await page.evaluate(() => [...document.querySelectorAll(".pt-table .el-key")].map((k) => ({
    id: k.dataset.el, sym: k.querySelector(".el-sym").textContent, no: k.querySelector(".el-no").textContent, sz: k.querySelector(".el-sz")?.textContent ?? "", flags: [...k.querySelectorAll(".el-flags .brick-sticker")].map((x) => x.textContent), dot: !!k.querySelector(".el-sz .el-dot"),
    planned: k.classList.contains("el-planned"), border: getComputedStyle(k).borderTopStyle, label: k.getAttribute("aria-label"), area: getComputedStyle(k).gridArea,
  })));
  assert.equal(keys.length, ALL.length, "one key per brick, symbol module and planned brick");
  assert.deepEqual(keys.map((k) => k.id), ALL.map((e) => e.id), "in number order, the kernel first");
  for (const [i, k] of keys.entries()) {
    const e = ALL[i];
    assert.equal(k.sym, e.sym, `${e.id}: its symbol`);
    assert.equal(k.no, String(e.no), `${e.id}: its number`);
    assert.ok(k.label.startsWith(`${e.name}, ${e.sym}, number ${e.no}`), `${e.id}: named in full first (${k.label})`);
    if (e.planned) {
      assert.ok(k.planned && k.border === "dashed", `${e.id}: planned, dashed`);
      assert.equal(k.sz, "", `${e.id}: no size`);
      assert.deepEqual(k.flags, ["ROADMAP"], `${e.id}: the ROADMAP sticker`);
    } else {
      assert.equal(k.border, "solid", `${e.id}: solid`);
      assert.equal(k.sz, `${(SIZES.find((s) => s.name === e.size).gzip / 1024).toFixed(1)}K`, `${e.id}: the measured size`);
      assert.ok(k.dot, `${e.id}: the size has its colour dot`);
      assert.deepEqual(k.flags, [...(e.id === "kernel" ? ["KERNEL"] : []), e.status.toUpperCase()], `${e.id}: its status sticker on the top edge`);
    }
  }
  assert.match(keys[0].area, /^2 \/ 1/, "the kernel: top of the first column");
  // In-house: presence and presence/check in their own column, with its note; shipped, sizes measured.
  const inhouse = await page.evaluate(() => { const col = (id) => getComputedStyle(document.querySelector(`.el-key[data-el="${id}"]`)).gridColumnStart; return { a: col("presence"), b: col("presence-check"), note: document.querySelector(".pt-fam-note")?.textContent, noteCol: document.querySelector(".pt-fam-note") && getComputedStyle(document.querySelector(".pt-fam-note")).gridColumnStart }; });
  assert.equal(inhouse.a, inhouse.b, "presence and presence/check share a column");
  assert.equal(inhouse.noteCol, inhouse.a, "the In-house note sits in their column");
  assert.equal(inhouse.note, "Used in our games. Not a supported multiplayer service.");
  // The hero is the page's one h1 and fills the first screen.
  const hero = await page.evaluate(() => ({ h1: document.querySelectorAll("h1").length, inHero: !!document.querySelector(".pt-hero h1"), h: document.querySelector(".pt-hero").getBoundingClientRect().height }));
  assert.equal(hero.h1, 1);
  assert.ok(hero.inHero, "the h1 is the table's headline");
  assert.ok(hero.h >= 900, `full viewport (${hero.h})`);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check("a click opens that brick's quick view (pressed, lit, PRESSED); one at a time; planned says planned; 0 frames at rest and after", async () => {
  const { ctx, page, errs } = await open();
  await page.waitForTimeout(1200);
  assert.equal(await frames(page, 1000), 0, "0 frames at rest");
  await page.click('.el-key[data-el="fx"]');
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400); // the kit's 140 ms colour change
  let s = await state(page);
  assert.deepEqual(s.expanded, ["fx"]);
  assert.equal(s.hidden, false);
  assert.equal(s.name, "@fzlt/core/fx");
  assert.equal(s.link, "fx.html");
  assert.equal(s.size, `${SIZES.find((x) => x.name === "@fzlt/core/fx").gzip.toLocaleString("en-US")} B`);
  const lit = await page.evaluate(() => { const k = document.querySelector('.el-key[data-el="fx"]'), p = document.createElement("i"); p.style.color = "var(--tone)"; k.append(p); const tone = getComputedStyle(p).color; p.remove(); return { bg: getComputedStyle(k).backgroundColor, tone, on: getComputedStyle(k.querySelector(".el-on")).display, t: new DOMMatrix(getComputedStyle(k).transform).m42 }; });
  assert.equal(lit.bg, lit.tone, "lit in its colour");
  assert.notEqual(lit.on, "none", "says PRESSED");
  assert.ok(lit.t > 0, "the key is down");
  await page.click('.el-key[data-el="actor"]');
  s = await state(page);
  assert.deepEqual(s.expanded, ["actor"], "one open at a time");
  assert.equal(s.name, "@fzlt/core/actor");
  assert.equal(s.meter, false, "planned: no size");
  assert.match(await page.textContent(".pt-card"), /Planned/);
  assert.equal(s.link, "#planned");
  await page.click('.el-key[data-el="actor"]');
  s = await state(page);
  assert.deepEqual(s.expanded, [], "pressed again: closed");
  assert.equal(s.hidden, true);
  await page.waitForTimeout(600);
  assert.equal(await frames(page, 1000), 0, "0 frames after open and close");
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check("keyboard: one tab stop, arrows move, Enter opens, Esc closes and keeps focus", async () => {
  const { ctx, page, errs } = await open();
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".el-key")].filter((k) => k.tabIndex === 0).length), 1, "one tab stop");
  await page.focus('.el-key[data-el="kernel"]');
  const at = () => page.evaluate(() => document.activeElement.dataset.el);
  await page.keyboard.press("ArrowRight"); assert.equal(await at(), "input");
  await page.keyboard.press("ArrowDown"); assert.equal(await at(), "pad");
  await page.keyboard.press("ArrowRight"); assert.equal(await at(), "agent", "the next column, same row");
  await page.keyboard.press("ArrowUp"); assert.equal(await at(), "snapshot");
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); assert.equal(await at(), "kernel");
  await page.keyboard.press("ArrowLeft"); assert.equal(await at(), "kernel", "stops at the edge");
  await page.keyboard.press("End"); assert.equal(await at(), ALL.at(-1).id);
  await page.keyboard.press("Home"); assert.equal(await at(), "kernel");
  await page.keyboard.press("Enter");
  let s = await state(page);
  assert.deepEqual(s.expanded, ["kernel"]);
  assert.equal(s.name, "@fzlt/core");
  assert.match(await page.textContent("[data-pt-say]"), /^@fzlt\/core: quick view open/);
  await page.keyboard.press("Escape");
  s = await state(page);
  assert.deepEqual(s.expanded, []);
  assert.equal(s.hidden, true);
  assert.equal(s.focus, "kernel", "focus stays on the key");
  // Esc from inside the quick view: back to its key.
  await page.keyboard.press("Space");
  await page.focus(".pt-q-go");
  await page.keyboard.press("Escape");
  s = await state(page);
  assert.equal(s.hidden, true);
  assert.equal(s.focus, "kernel", "focus back on the key");
  // The close key.
  await page.keyboard.press("Enter");
  await page.click(".pt-x");
  assert.equal((await state(page)).hidden, true);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check("reduced motion: the quick view simply appears (no transition), 0 frames", async () => {
  const { ctx, page, errs } = await open({ reducedMotion: "reduce" });
  await page.click('.el-key[data-el="slot"]');
  const m = await page.evaluate(() => { const c = document.querySelector(".pt-card"), s = getComputedStyle(c); return { dur: s.transitionDuration, running: c.getAnimations().length, op: s.opacity, tr: s.translate }; });
  assert.match(m.dur, /^0s(, 0s)*$/, `no transition (${m.dur})`);
  assert.equal(m.running, 0, "nothing animates");
  assert.equal(m.op, "1");
  assert.equal(m.tr, "none");
  assert.equal(await frames(page, 800), 0);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check("phone 390: no page-level sideways scroll; the table scrolls in its box; the quick view is a bottom sheet", async () => {
  const { ctx, page, errs } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const m = await page.evaluate(() => { const s = document.querySelector(".pt-scroll"); return { page: document.documentElement.scrollWidth, vw: innerWidth, box: s.scrollWidth > s.clientWidth, tile: document.querySelector(".el-key").getBoundingClientRect().width }; });
  assert.ok(m.page <= m.vw, `no sideways page scroll (${m.page} > ${m.vw})`);
  assert.ok(m.box, "the table scrolls sideways in its own box");
  assert.ok(m.tile >= 44, `tiles are 44 px targets or more (${m.tile})`);
  await page.tap('.el-key[data-el="fx"]');
  await page.waitForTimeout(500);
  const c = await page.evaluate(() => { const r = document.querySelector(".pt-card").getBoundingClientRect(); return { pos: getComputedStyle(document.querySelector(".pt-card")).position, l: r.left, r: r.right, b: r.bottom, t: r.top, vw: innerWidth, vh: innerHeight, page: document.documentElement.scrollWidth }; });
  assert.equal(c.pos, "fixed");
  assert.ok(Math.abs(c.b - c.vh) < 1 && c.l === 0 && Math.abs(c.r - c.vw) < 1, `bottom sheet: ${JSON.stringify(c)}`);
  assert.ok(c.t > c.vh * 0.2, "it leaves the table in view above it");
  assert.ok(c.page <= c.vw, "no sideways scroll with the sheet open");
  await page.tap(".pt-x");
  assert.equal(await page.evaluate(() => document.querySelector(".pt-card").hidden), true);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await check("stickers: one valid SVG per brick, each a download; symbol chips are named in full", async () => {
  const { ctx, page, errs } = await open();
  const files = await page.evaluate(() => [...document.querySelectorAll("#stickers a.stk")].map((a) => ({ href: a.getAttribute("href"), dl: a.getAttribute("download") })));
  assert.equal(files.length, ALL.length, "one sticker per brick");
  for (const e of ALL) assert.ok(files.some((f) => f.dl === `fizlet-brick-${e.id}.svg`), `${e.id}: its sticker`);
  const bad = await page.evaluate(async (hrefs) => {
    const out = [];
    for (const h of hrefs) {
      const res = await fetch(h), type = res.headers.get("content-type"), doc = new DOMParser().parseFromString(await res.text(), "image/svg+xml");
      const root = doc.documentElement;
      if (!res.ok || type !== "image/svg+xml" || doc.querySelector("parsererror") || root.localName !== "svg" || root.namespaceURI !== "http://www.w3.org/2000/svg" || !root.querySelector("title")?.textContent || !root.getAttribute("viewBox")) out.push(h);
    }
    return out;
  }, files.map((f) => f.href));
  assert.deepEqual(bad, [], "valid SVG");
  await page.locator("#stickers").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll("#stickers img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
  // The footer's brick chips: the symbol shows, the name is the accessible name and opens on focus.
  const chip = page.locator(".foot-map a.sym-chip", { hasText: "fx" }).first();
  assert.equal(await chip.evaluate((a) => a.querySelector(".el-sym").textContent), "fx");
  const shut = await chip.evaluate((a) => a.querySelector(".sym-name").getBoundingClientRect().width);
  assert.equal(shut, 0, "the name is folded at rest");
  await page.evaluate(() => document.querySelectorAll(".foot-map details").forEach((d) => (d.open = true)));
  assert.equal(await page.getByRole("link", { name: "view-canvas", exact: true }).count(), 1, "named in full");
  await page.getByRole("link", { name: "view-canvas", exact: true }).focus();
  assert.ok(await page.getByRole("link", { name: "view-canvas", exact: true }).evaluate((a) => a.querySelector(".sym-name").getBoundingClientRect().width) > 20, "focus opens the name");
  assert.deepEqual(errs, []);
  await ctx.close();
});

await browser.close();
srv.close();
if (fails) {
  console.log(`${fails} failed`);
  process.exit(1);
}
console.log("periodic: all passed");
