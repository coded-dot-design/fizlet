// Page-cost gate (`npm run perf:page`, after `npm run site`): each page in page-budgets.json, live
// vs poster-only, desktop and mobile (4x CPU), best of PAGE_RUNS (default 3). Writes a JSON report
// and exits 1 when a page adds more than its budget. See page-cost.mjs for how it is measured.
//   PAGE_RUNS (default 3)   PAGE_OUT (default page-cost-results.json)   PAGE_ONLY=<page name>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { launch, serve } from "./harness.mjs";
import { PROFILES, measurePage, verdict } from "./page-cost.mjs";

const RUNS = Number(process.env.PAGE_RUNS ?? 3);
const cfg = JSON.parse(readFileSync(new URL("./page-budgets.json", import.meta.url), "utf8"));
if (!existsSync("site-dist/index.html")) throw new Error("site-dist/ is missing: run `npm run site` first");

const site = await serve("site-dist", "/fizlet/");
const browser = await launch();
const report = [], over = [];
try {
  for (const pg of cfg.pages.filter((p) => !process.env.PAGE_ONLY || p.name === process.env.PAGE_ONLY)) {
    for (const [profName, prof] of Object.entries(PROFILES)) {
      const runs = [];
      // Interleaved, so a slow patch of the machine lands on both variants.
      for (let i = 0; i < RUNS; i++) for (const v of ["live", "poster"]) {
        const r = await measurePage(browser, `${site.origin}/fizlet/`, pg, v, prof);
        if (r.errors.length) over.push(`${pg.name} ${profName} ${v}: page errors: ${r.errors.join("; ")}`);
        runs.push(r);
      }
      const v = verdict(`${pg.name} ${profName}`, runs, cfg.budgets[profName]);
      over.push(...v.over);
      report.push({ page: pg.name, profile: profName, ...v, runs });
      const f = (k) => `${k} ${v.live[k]} vs ${v.poster[k]} (+${v.delta[k]}, budget +${cfg.budgets[profName][k]})`;
      console.log(`${pg.name.padEnd(6)} ${profName.padEnd(7)} ${f("cls")} · ${f("tapMs")} · ${f("idlePts")}`);
    }
  }
} finally {
  await browser.close();
  await site.close();
}
const machine = `${cpus()[0]?.model ?? "unknown CPU"} × ${cpus().length}, Chromium ${browser.version()}, best of ${RUNS}`;
console.log(`machine ${machine}`);
const out = process.env.PAGE_OUT ?? "page-cost-results.json";
writeFileSync(out, JSON.stringify({ machine, runs: RUNS, budgets: cfg.budgets, report, over, pass: over.length === 0 }, null, 2) + "\n");
console.log(`report  ${out}`);
if (over.length) {
  for (const o of over) console.error(`OVER ${o}`);
  process.exit(1);
}
