// Gallery and hero stages: a tap stays a tap. Every stage figure has a touch-action that turns off
// double-tap zoom (manipulation, pan-y or none), the viewport never disables zoom, and text inputs are
// at least 16 px at phone width (iOS zooms the page on focus below that). Run after `npm run site`.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import assert from "node:assert/strict";

const root = new URL("../site-dist/", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(root, p)); res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const OK = new Set(["manipulation", "pan-y", "none", "pan-x pan-y"]);
let stages = 0;
for (const path of ["/", "/gallery/", "/gallery/page/2/", "/make/"]) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  const viewport = await page.getAttribute('meta[name="viewport"]', "content");
  assert.ok(viewport && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(viewport), `${path}: the viewport must not disable zoom (${viewport})`);
  const found = await page.$$eval(":is(.gal-stage, .fizz-slot, .hero-stage) figure.ae-slot", (els) => els.map((e) => getComputedStyle(e).touchAction));
  for (const t of found) assert.ok(OK.has(t), `${path}: a stage has touch-action "${t}" (double-tap zooms)`);
  stages += found.length;
  const small = await page.$$eval("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([readonly]), textarea:not([readonly]), select", (els) => els.filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => `#${e.id || e.name} ${getComputedStyle(e).fontSize}`));
  assert.deepEqual(small, [], `${path}: text inputs under 16 px zoom the page on iOS focus`);
}
assert.ok(stages > 10, `expected stages on the checked pages, found ${stages}`);
console.log(`stage touch: ${stages} stages tap-safe (no double-tap zoom), viewport zoomable, inputs ≥ 16 px`);
await browser.close(); server.close();
