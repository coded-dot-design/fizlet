// Scroll-lock hint (site/scroll-hint.ts) on the built gallery (run `npm run site` first): a wheel over
// a frame that keeps the page's scroll (a clipping slot with the kit's `overscroll-behavior:
// none`) opens the note on the frame's edge, puts the frame in its warning state, announces once,
// and the page still does not scroll (the lock itself is unchanged); the note closes on pointer
// leave and after 3 s, and stays quiet for 20 s on that frame. A wheel over a frame that lets the
// page scroll shows nothing. A vertical swipe on a phone gets the touch copy. SCROLL_HINT_SHOTS=<dir>
// saves the note at 1440 and 390, light and dark.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { ROOT as BASE } from "../site/layout.mjs";

const ROOT = "site-dist";
if (!existsSync(`${ROOT}/gallery/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let f = url.pathname.startsWith(BASE) ? join(ROOT, normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, "")) : "";
  if (f && existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!f || !existsSync(f) || !statSync(f).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const URL_ = `http://127.0.0.1:${server.address().port}${BASE}gallery/`;
const SHOTS = process.env.SCROLL_HINT_SHOTS;

const browser = await chromium.launch(launchOptions());
let failed = 0;

/** Every gallery frame, split by whether it keeps the page's scroll: a clipping slot (a scroll container) with the kit's `overscroll-behavior: none` ends the wheel's scroll chain there. */
const frames = (page) =>
  page.$$eval(".gal-item", (items) =>
    items.map((li) => {
      const f = li.querySelector("figure.ae-slot");
      const cs = getComputedStyle(f);
      return { id: li.id, locks: cs.overscrollBehaviorY === "none" && cs.overflowY !== "visible" };
    }),
  );

async function open(opts, theme = "dark") {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript((t) => { try { localStorage.setItem("dom-virus:theme", t); } catch {} }, theme);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL_);
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}
/** Scroll a frame to the screen's upper middle (room below it for the note), wait for its piece, return its centre. */
async function aim(page, id) {
  await page.evaluate((id) => { document.documentElement.style.scrollBehavior = "auto"; const f = document.querySelector(`#${id} figure.ae-slot`); scrollTo(0, scrollY + f.getBoundingClientRect().top - 140); }, id);
  await page.waitForTimeout(900);
  return page.$eval(`#${id} figure.ae-slot`, (f) => { const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
}
const state = (page, id) =>
  page.evaluate((id) => {
    const f = document.querySelector(`#${id} figure.ae-slot`);
    const n = document.querySelector(".scroll-hint[data-open]");
    return { y: scrollY, warn: f.hasAttribute("data-scroll-warn"), border: getComputedStyle(f).borderTopColor, note: n?.textContent ?? null, live: document.querySelector("[data-live-polite]")?.textContent ?? "" };
  }, id);

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${e.message.split("\n").join("\n     ")}`);
  }
}

await test("desktop: a wheel over a scroll-locked frame shows the note and warns; the page stays put; a free frame shows nothing", async () => {
  const { ctx, page, errs } = await open({ viewport: { width: 1440, height: 900 } });
  const all = await frames(page);
  const locked = all.find((f) => f.locks), free = all.find((f) => !f.locks);
  assert.ok(locked && free, `need one locking and one free gallery frame: ${JSON.stringify(all)}`);

  // A frame that lets the page scroll: the page moves, no note, no warning.
  let c = await aim(page, free.id);
  let before = await state(page, free.id);
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(500);
  let after = await state(page, free.id);
  assert.ok(after.y > before.y, `${free.id} lets the page scroll (${before.y} → ${after.y})`);
  assert.equal(after.note, null, `no note over ${free.id}`);
  assert.equal(after.warn, false);

  // The locked frame: the page does not scroll (unchanged lock), the note opens, the frame warns.
  c = await aim(page, locked.id);
  before = await state(page, locked.id);
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(450);
  after = await state(page, locked.id);
  assert.equal(after.y, before.y, `${locked.id} keeps the page's scroll`);
  assert.match(after.note ?? "", /Scrolling is paused over this demo.*Move off it to scroll the page\./);
  assert.equal(after.warn, true, "the frame is in its warning state");
  assert.notEqual(after.border, before.border, "the frame's border turns the warning colour");
  assert.match(after.live, /Scrolling is paused/, "announced through the polite live region");
  const edge = await page.evaluate((id) => {
    const f = document.querySelector(`#${id} figure.ae-slot`).getBoundingClientRect();
    const n = document.querySelector(".scroll-hint").getBoundingClientRect();
    return { gap: Math.round(n.top - f.bottom), inside: n.left >= f.left && n.right <= f.right + 1 };
  }, locked.id);
  assert.ok(Math.abs(edge.gap) <= 1 && edge.inside, `the note hangs from the frame's bottom edge: ${JSON.stringify(edge)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/scrollhint-1440-dark.png` });

  // Pointer leave closes it and the frame reverts.
  await page.mouse.move(4, c.y);
  await page.waitForTimeout(350);
  after = await state(page, locked.id);
  assert.equal(after.note, null, "closed on pointer leave");
  assert.equal(after.warn, false, "the frame reverts");

  // Within 20 s the same frame stays quiet.
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(450);
  assert.equal((await state(page, locked.id)).note, null, "no second note within 20 s");
  assert.deepEqual(errs, []);
  await ctx.close();
});

await test("desktop: the note closes on its own after about 3 s; reduced motion shows it without a slide", async () => {
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const locked = (await frames(page)).find((f) => f.locks);
  const c = await aim(page, locked.id);
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(400);
  assert.equal((await page.$eval(".scroll-hint > p", (p) => getComputedStyle(p).transitionDuration)), "0s", "no slide under reduced motion");
  assert.ok((await state(page, locked.id)).note, "shown");
  await page.waitForTimeout(3000);
  const s = await state(page, locked.id);
  assert.equal(s.note, null, "closed after 3 s");
  assert.equal(s.warn, false);
  await ctx.close();
});

await test("phone: a vertical swipe on a scroll-locked frame gets the touch copy; a free frame shows nothing", async () => {
  const { ctx, page, errs } = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, "light");
  const cdp = await ctx.newCDPSession(page);
  const swipe = async ({ x, y }) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 12 }] }), await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(400);
  };
  const all = await frames(page);
  const locked = all.find((f) => f.locks), free = all.find((f) => !f.locks);
  let before = await state(page, free.id);
  await swipe(await aim(page, free.id));
  let after = await state(page, free.id);
  assert.equal(after.note, null, `no note over ${free.id}`);
  before = await state(page, locked.id);
  await swipe(await aim(page, locked.id));
  after = await state(page, locked.id);
  assert.match(after.note ?? "", /Swipe outside the frame to scroll\./);
  assert.equal(after.warn, true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/scrollhint-390-light.png` });
  assert.deepEqual(errs, []);
  await ctx.close();
});

if (SHOTS) {
  // The other two: 1440 light, 390 dark (a wheel opens the note the same way at any width).
  for (const [w, h, theme] of [[1440, 900, "light"], [390, 844, "dark"]]) {
    const { ctx, page } = await open({ viewport: { width: w, height: h } }, theme);
    const locked = (await frames(page)).find((f) => f.locks);
    const c = await aim(page, locked.id);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${SHOTS}/scrollhint-${w}-${theme}.png` });
    await ctx.close();
  }
}

await browser.close();
server.close();
if (failed) {
  console.log(`\n${failed} scroll-hint check(s) failed`);
  process.exit(1);
}
console.log("\nscroll hint: all checks passed");
