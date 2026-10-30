// The page-cost gate's pure parts: the poster-only page, best of N, and the verdict against budgets.
// (The browser run is `npm run perf:page`, in the CI perf job.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { best, exceptionsFor, median, posterOnly, verdict } from "./perf/page-cost.mjs";

test("page cost: the poster page drops every module script but the site chrome", () => {
  const html = `<script>theme()</script><script type="application/ld+json">{}</script>
<script type="module">{const f=1}</script><script type="module" src="./site.js"></script>
<script type="module" src="./demo.js"></script><script type="module" src="./demos/fizz/main.js"></script>`;
  const out = posterOnly(html, ["./site.js"]);
  assert.match(out, /<script>theme\(\)<\/script>/);
  assert.match(out, /ld\+json/);
  assert.match(out, /src="\.\/site\.js"/);
  assert.doesNotMatch(out, /demo\.js|main\.js|const f/);
  assert.equal((out.match(/<script/g) ?? []).length, 3);
});

test("page cost: median and best of N", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.ok(Number.isNaN(median([])));
  assert.equal(best([9, 4, 7]), 4);
});

const budget = { cls: 0, tapMs: 8, idlePts: 3 };
const run = (variant, cls, tapMs, idlePct) => ({ variant, cls, tapMs, idlePct });

test("page cost: within budget passes, measured as best live minus best poster", () => {
  const v = verdict("p", [run("live", 0, 20, 9), run("poster", 0, 14, 7), run("live", 0, 30, 6), run("poster", 0, 13, 5)], budget);
  assert.deepEqual(v.over, []);
  assert.deepEqual(v.live, { cls: 0, tapMs: 20, idlePts: 6 });
  assert.deepEqual(v.delta, { cls: 0, tapMs: 7, idlePts: 1 });
});

test("page cost: each budget fails on its own, CLS at 0.000", () => {
  const v = verdict("home desktop", [run("live", 0.002, 22, 10), run("poster", 0, 13, 6.5)], budget);
  assert.deepEqual(v.over, [
    "home desktop: cls +0.002 over the poster page (budget +0)",
    "home desktop: tapMs +9 over the poster page (budget +8)",
    "home desktop: idlePts +3.5 over the poster page (budget +3)",
  ]);
  // Below CLS's reported precision is 0.000.
  assert.deepEqual(verdict("p", [run("live", 0.0004, 1, 1), run("poster", 0, 1, 1)], budget).over, []);
});

test("page cost: a missing measure fails, it never passes by default", () => {
  assert.equal(verdict("p", [run("live", 0, NaN, 1), run("poster", 0, 1, 1)], budget).over.length, 1);
  assert.equal(verdict("p", [run("poster", 0, 1, 1)], budget).over.length, 3);
});

test("page cost: the budgets are the page budgets (CLS 0, tap +8/+24 ms, idle +3/+10 points)", () => {
  const cfg = JSON.parse(readFileSync(new URL("./perf/page-budgets.json", import.meta.url), "utf8"));
  assert.deepEqual(cfg.budgets, { desktop: { cls: 0, tapMs: 8, idlePts: 3 }, mobile: { cls: 0, tapMs: 24, idlePts: 10 } });
  for (const p of cfg.pages) assert.ok(p.name && typeof p.path === "string" && Array.isArray(p.keep) && p.exclude, p.name);
});

test("page cost: a named exception reports one measure over budget, never past its ceiling", () => {
  const runs = [run("live", 0.002, 22, 12), run("poster", 0, 13, 2)];
  const v = verdict("home desktop", runs, budget, { idlePts: { task: "G20", ceiling: 12 } });
  // Only the excepted measure moves out of `over`; the others still fail.
  assert.deepEqual(v.excepted, ["home desktop: idlePts +10 over the poster page (budget +3): exception G20 (ceiling +12)"]);
  assert.equal(v.over.length, 2);
  assert.doesNotMatch(v.over.join("\n"), /idlePts/);
  // Worse than when the exception was written: it fails again.
  const worse = verdict("home desktop", [run("live", 0, 1, 15), run("poster", 0, 1, 2)], budget, { idlePts: { task: "G20", ceiling: 12 } });
  assert.deepEqual(worse.over, ["home desktop: idlePts +13 over the poster page (budget +3), and over its exception G20's ceiling +12"]);
  // Within budget: nothing to except.
  assert.deepEqual(verdict("p", [run("live", 0, 1, 3), run("poster", 0, 1, 2)], budget, { idlePts: { task: "G20", ceiling: 12 } }).excepted, []);
});

test("page cost: every exception is named, tracked, measured and narrow", () => {
  const cfg = JSON.parse(readFileSync(new URL("./perf/page-budgets.json", import.meta.url), "utf8"));
  for (const x of cfg.exceptions ?? []) {
    const id = `${x.page} ${x.profile} ${x.measure}`;
    assert.ok(cfg.pages.some((p) => p.name === x.page) && cfg.budgets[x.profile], `${id}: a gated page and profile`);
    assert.ok(x.measure !== "cls", `${id}: CLS has no exceptions`);
    assert.ok(x.measure in cfg.budgets[x.profile], `${id}: a gated measure`);
    assert.match(x.task, /^G\d+$/, `${id}: names its roadmap task`);
    assert.match(x.track, /^https:\/\/github\.com\//, `${id}: links its tracking task`);
    assert.ok(x.why?.length > 40, `${id}: says why`);
    assert.ok(x.ceiling > cfg.budgets[x.profile][x.measure], `${id}: a ceiling above the budget`);
    assert.match(x.measured ?? "", /\d/, `${id}: the measured runs its ceiling comes from`);
  }
  const keys = (cfg.exceptions ?? []).map((x) => `${x.page} ${x.profile} ${x.measure}`);
  assert.equal(new Set(keys).size, keys.length, "one exception per page, profile and measure");
  assert.deepEqual(Object.keys(exceptionsFor(cfg, "nope", "desktop")), []);
});
