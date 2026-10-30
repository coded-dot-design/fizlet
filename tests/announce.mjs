// fizlet/announce in Chromium: the region is one polite status in the accessibility tree (hidden to
// the eye, not to the reader), takes no room and no clicks (no scroll, no layout shift, no hit
// target even for a long sentence), reads events in words on the real clock at most once per gap,
// and Recall leaves the page byte for byte as it was.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { announce } from "./src/announce.ts"; export { createEngine } from "./src/kernel/index.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><title>announce</title><body style="margin:0"><main id="root"><h1>Game</h1><button id="b">Play</button></main><script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
try {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(PAGE);
  const before = await p.evaluate(() => document.body.outerHTML);
  await p.evaluate(() => {
    const root = document.getElementById("root");
    const e = (window.e = fz.createEngine({ root }));
    let s = 0;
    window.fire = 0;
    e.add({ step: (en) => window.fire && en.events.emit("score", (s += 10)) });
    window.a = fz.announce(e, { gap: 0.5, words: (ev) => (ev.type === "score" ? `Score ${ev.a}` : null) });
    e.start();
    window.a.say("hi", "Ready. ".repeat(40)); // a long sentence: still no room taken
  });
  await p.waitForFunction(() => document.querySelector("[data-fz-announce]")?.textContent);
  const status = p.getByRole("status");
  assert.equal(await status.count(), 1, "one status region");
  assert.match(await status.textContent(), /^Ready\./);
  const snap = await p.locator("body").ariaSnapshot();
  assert.match(snap, /status: Ready\./, `in the accessibility tree:\n${snap}`);
  const box = await p.evaluate(() => {
    const el = document.querySelector("[data-fz-announce]"), r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + 1, r.top + 1);
    return { scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], hit: hit === el, live: el.getAttribute("aria-live"), atomic: el.getAttribute("aria-atomic"), buttonTop: document.getElementById("b").getBoundingClientRect().top };
  });
  assert.deepEqual(box.scroll, [400, 300], "no scroll from a long sentence");
  assert.equal(box.hit, false, "no hit target");
  assert.equal(box.live, "polite");
  assert.equal(box.atomic, "true");
  // Score ticks every step for a second: read at most once per 0.5 s gap, latest value each time.
  const writes = await p.evaluate(async () => {
    const el = document.querySelector("[data-fz-announce]"), seen = [];
    const mo = new MutationObserver(() => seen.push(el.textContent));
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    window.fire = 1;
    await new Promise((ok) => setTimeout(ok, 1000));
    window.fire = 0;
    await new Promise((ok) => setTimeout(ok, 700));
    mo.disconnect();
    return seen;
  });
  assert.ok(writes.length >= 2 && writes.length <= 3, `about one write per gap over 1 s: ${JSON.stringify(writes)}`);
  for (const w of writes) assert.match(w, /^Score \d+ ?$/, "the score alone, coalesced");
  const n = (w) => +w.match(/\d+/)[0];
  assert.ok(n(writes.at(-1)) >= 500, `the last write is the latest score: ${writes.at(-1)}`);
  await p.evaluate(() => window.e.destroy());
  assert.equal(await p.evaluate(() => document.body.outerHTML), before, "Recall: the page byte for byte");
  assert.deepEqual(errs, []);
  console.log("announce (Chromium): one polite status in the tree, no room or hit target, coalesced once per gap, Recall ✓");
} finally {
  await browser.close();
}
