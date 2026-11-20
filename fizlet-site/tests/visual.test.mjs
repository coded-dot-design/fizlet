// Visual tests for the design system: every component cell on /design-system/ (each shared
// component in each state) at 1440 and 390 wide, dark and light, against the committed baselines
// in tests/visual/ (pixelmatch, threshold 0.1, at most MAX_DIFF of the pixels may differ).
// The page's colours are also read back from the browser and checked against the values (and so
// the contrast ratios) src/lib/tokens.ts computes from tokens.json.
//
//   npm test                         compare (a missing baseline fails)
//   npm run test:visual:update       rewrite the baselines (then look at the diff before committing)
//
// Fonts: the cells render in Inter and JetBrains Mono from @fontsource-variable (the --sans and
// --mono tokens pointed at them), so a baseline does not depend on the machine's installed fonts.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { serve } from "../scripts/serve.mjs";
import { tokens, colour, hex } from "../src/lib/tokens.ts";

const BASE_DIR = "tests/visual";
const OUT_DIR = "test-results/visual";
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";
const MAX_DIFF = 0.005; // 0.5% of a cell's pixels (anti-aliasing between Chromium builds)
const WIDTHS = [1440, 390];
const THEMES = ["dark", "light"];
const require = createRequire(import.meta.url);
const FONTS = {
  "/__ds-fonts/sans.woff2": require.resolve("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"),
  "/__ds-fonts/mono.woff2": require.resolve("@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2"),
};
const FONT_CSS = `@font-face { font-family: "DS Test Sans"; src: url(/__ds-fonts/sans.woff2) format("woff2"); font-weight: 100 900; }
@font-face { font-family: "DS Test Mono"; src: url(/__ds-fonts/mono.woff2) format("woff2"); font-weight: 100 800; }
html:root { --sans: "DS Test Sans", sans-serif; --mono: "DS Test Mono", monospace; }`;

let dist, server, browser, base;
before(async () => {
  dist = mkdtempSync(join(tmpdir(), "fizlet-ds-"));
  execFileSync(process.execPath, ["node_modules/astro/bin/astro.mjs", "build", "--outDir", dist], { stdio: "pipe", env: { ...process.env, PUBLIC_ROBOTS: "" } });
  server = await serve(dist);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => { await browser?.close(); server?.close(); if (dist) rmSync(dist, { recursive: true, force: true }); });

async function open(width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("dom-virus:theme", t); } catch {} }, theme);
  await ctx.route("**/__ds-fonts/*", (r) => r.fulfill({ body: readFileSync(FONTS[new URL(r.request().url()).pathname]), contentType: "font/woff2" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}/design-system/`, { waitUntil: "load" });
  await page.addStyleTag({ content: FONT_CSS });
  await page.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => {}))); await document.fonts.ready; });
  return { ctx, page, errors };
}

const name = (cell, theme, width) => `${cell}--${theme}-${width}.png`;
const seen = new Set();

for (const width of WIDTHS) for (const theme of THEMES) {
  test(`component cells match their baselines: ${width} ${theme}`, async () => {
    const { ctx, page, errors } = await open(width, theme);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
    const cells = await page.$$eval("[data-ds-cell]", (els) => els.map((e) => e.dataset.dsCell));
    assert.ok(cells.length >= 40, `only ${cells.length} cells`);
    const failed = [];
    for (const cell of cells) {
      const file = name(cell, theme, width);
      seen.add(file);
      const shot = await page.locator(`[data-ds-cell="${cell}"]`).screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      const path = join(BASE_DIR, file);
      if (UPDATE) { mkdirSync(BASE_DIR, { recursive: true }); writeFileSync(path, shot); continue; }
      if (!existsSync(path)) { failed.push(`${file}: no baseline (npm run test:visual:update)`); continue; }
      const a = PNG.sync.read(readFileSync(path)), b = PNG.sync.read(shot);
      const fail = (why) => { mkdirSync(OUT_DIR, { recursive: true }); writeFileSync(join(OUT_DIR, file), shot); failed.push(`${file}: ${why}`); };
      if (a.width !== b.width || a.height !== b.height) { fail(`size ${b.width}x${b.height}, baseline ${a.width}x${a.height}`); continue; }
      const diff = new PNG({ width: a.width, height: a.height });
      const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      if (n / (a.width * a.height) > MAX_DIFF) { fail(`${(100 * n / (a.width * a.height)).toFixed(2)}% of pixels differ`); writeFileSync(join(OUT_DIR, file.replace(/\.png$/, ".diff.png")), PNG.sync.write(diff)); }
    }
    await ctx.close();
    assert.deepEqual(errors, [], "console errors on /design-system/");
    assert.deepEqual(failed, [], `visual differences (actuals in ${OUT_DIR}/)`);
  });
}

test("no stale baselines: every file in tests/visual is a cell the page renders", { skip: UPDATE }, async () => {
  const want = new Set();
  const { ctx, page } = await open(1440, "dark");
  for (const cell of await page.$$eval("[data-ds-cell]", (els) => els.map((e) => e.dataset.dsCell))) for (const w of WIDTHS) for (const t of THEMES) want.add(name(cell, t, w));
  await ctx.close();
  const stale = readdirSync(BASE_DIR).filter((f) => f.endsWith(".png") && !want.has(f));
  assert.deepEqual(stale, [], "baselines for cells the page no longer renders");
});

test("the browser paints every colour token as tokens.ts computes it (so the contrast ratios hold)", async () => {
  for (const theme of THEMES) {
    const { ctx, page } = await open(1440, theme);
    const names = tokens().filter((t) => t.group !== "type" && colour(t.name, theme)).map((t) => t.name);
    const painted = await page.evaluate((names) => {
      const probe = document.createElement("i");
      document.body.append(probe);
      const bg = getComputedStyle(probe);
      const out = {};
      for (const n of names) { probe.style.backgroundColor = `var(${n})`; out[n] = bg.backgroundColor; }
      probe.style.backgroundColor = "var(--bg)"; out["--bg@"] = bg.backgroundColor;
      probe.remove();
      return out;
    }, names);
    // A translucent token is composited over --bg, as tokens.ts does for its contrast ratios.
    // Chromium reports color-mix() results as color(srgb r g b / a), channels 0-1.
    const parse = (s) => {
      const m = s.replace(/^color\(srgb/, "").match(/[\d.e-]+/g).map(Number);
      const rgb = s.startsWith("color(") ? m.slice(0, 3).map((v) => v * 255) : m.slice(0, 3);
      return [...rgb, m[3] ?? 1];
    };
    const bgc = parse(painted["--bg@"]);
    for (const n of names) {
      const [r, g, b, a] = parse(painted[n]);
      const got = [r, g, b].map((v, i) => v * a + bgc[i] * (1 - a));
      const want = colour(n, theme);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i] - want[i]) <= 1.5, `${theme} ${n}: browser ${painted[n]}, tokens.ts ${hex(want)}`);
    }
    await ctx.close();
  }
});

test("a forced state cell paints what the real pseudo-class paints (key: hover, active, focus-visible)", async () => {
  const { ctx, page } = await open(1440, "dark");
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const props = ["transform", "box-shadow", "border-color", "outline-style", "outline-color", "background-color"];
  const styleOf = (sel) => page.$eval(sel, (el, props) => Object.fromEntries(props.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])), props);
  for (const state of ["hover", "active", "focus-visible"]) {
    const sel = `[data-ds-cell="key--default"] .bui-key`;
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [state] });
    const real = await styleOf(sel);
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
    const forced = await styleOf(`[data-ds-cell="key--${state}"] .bui-key`);
    assert.deepEqual(forced, real, `key ${state}`);
  }
  await ctx.close();
});
