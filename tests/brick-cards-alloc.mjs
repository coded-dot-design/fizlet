// The brick cards' allocation a frame (site/cards/): each card mounted on its own, its engine stopped
// and driven by hand (a tap every 20 frames keeps it busy: blasts, balls, paths, flights), JS heap
// bytes sampled by V8's heap profiler over FRAMES frames after a warm-up. Best of 3 runs a card
// (the profiler samples, so one run can catch a stray browser allocation). Run on its own
// (`node tests/brick-cards-alloc.mjs`, one Chromium, nothing else running): concurrency skews it.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

// Every card (site/cards/*.ts but the frame), so a new card is measured without editing this file.
export const IDS = readdirSync("site/cards").filter((f) => f.endsWith(".ts") && f !== "frame.ts").map((f) => f.slice(0, -3)).filter((id) => !process.env.ALLOC_ONLY || process.env.ALLOC_ONLY.split(",").includes(id));
const FRAMES = Number(process.env.ALLOC_FRAMES ?? 6000), RUNS = 3;
/** Bytes a frame a card may allocate (sampled): less than one small object. */
export const MAX_BYTES_PER_FRAME = Number(process.env.ALLOC_MAX ?? 16);
/** A whole moving frame (render included), so a regression in a card's drawing shows too. */
export const MAX_FRAME = Number(process.env.ALLOC_FRAME_MAX ?? 1024);

const js = (await build({
  stdin: { contents: IDS.map((id) => `import ${id} from "./site/cards/${id}.ts";`).join("") + `window.cards = { ${IDS.join(", ")} };`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", minify: false, write: false, logLevel: "silent",
})).outputFiles[0].text;

const browser = await chromium.launch(launchOptions());
const result = {};
try {
  for (const id of IDS) {
    const runs = [];
    for (let r = 0; r < RUNS; r++) {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setContent(`<!doctype html><html data-theme="dark"><body style="margin:0"><figure data-bytes="2048" data-tag="${id.toUpperCase()}" style="--tone:#39ffb0;position:relative;width:560px;height:350px;margin:0"><div id="stage" style="position:absolute;inset:0"></div></figure></body></html>`);
      await page.addScriptTag({ content: js });
      await page.evaluate((id) => {
        const slot = document.querySelector("figure"), stage = document.getElementById("stage");
        const s = (window.card = window.cards[id](stage, slot, null));
        s.engine.stop();
        window.drive = function drive(n, junk) {
          for (let i = 0; i < n; i++) {
            if (i % 20 === 0) s.tap(40 + ((i * 37) % 240), 40 + ((i * 53) % 130));
            s.engine.advance(1 / 60);
            if (junk) window.keep = { i }; // the self-check: one object a frame must show up
          }
        };
        window.drive(20000); // warm up: pools filled, the JIT settled (as fe anim --measure does)
      }, id);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("HeapProfiler.enable");
      await cdp.send("HeapProfiler.collectGarbage");
      await cdp.send("HeapProfiler.startSampling", { samplingInterval: 128, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
      await page.evaluate(([n, junk]) => window.drive(n, junk), [FRAMES, process.env.ALLOC_SELFCHECK === "1"]);
      const { profile } = await cdp.send("HeapProfiler.stopSampling");
      // What the card's frames allocated (under drive(), not the harness), split by phase: under a
      // system's step (the simulation: must be nothing) and everything else (render: canvas calls
      // box their fractional arguments, a Blink binding cost; only while it moves, never once settled).
      const sum = { step: 0, all: 0 }, by = {};
      const walk = (node, inside, inStep) => {
        const fn = node.callFrame.functionName, here = inside || fn === "drive", st = inStep || (here && fn === "step");
        if (here && node.selfSize) {
          sum.all += node.selfSize;
          if (st) sum.step += node.selfSize;
          const k = `${st ? "step>" : ""}${fn || "(anon)"}:${node.callFrame.lineNumber}`;
          by[k] = (by[k] ?? 0) + node.selfSize;
        }
        for (const c of node.children) walk(c, here, st);
      };
      walk(profile.head, false, false);
      assert.deepEqual(errors, [], `${id}: page errors`);
      runs.push({ step: sum.step / FRAMES, all: sum.all / FRAMES });
      if (process.env.ALLOC_TOP) console.log(id, Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${(v / FRAMES).toFixed(0)}`).join(" · "));
      await page.close();
    }
    result[id] = { step: Math.min(...runs.map((r) => r.step)), all: Math.min(...runs.map((r) => r.all)) };
    console.log(`alloc  ${id.padEnd(9)} step ${result[id].step.toFixed(1)} B/frame · whole frame ${result[id].all.toFixed(1)} B (best of ${RUNS})`);
  }
  for (const id of IDS) assert.ok(result[id].step <= MAX_BYTES_PER_FRAME, `${id}: step allocates ${result[id].step.toFixed(1)} B a frame > ${MAX_BYTES_PER_FRAME}`);
  for (const id of IDS) assert.ok(result[id].all <= MAX_FRAME, `${id}: a moving frame allocates ${result[id].all.toFixed(1)} B > ${MAX_FRAME}`);
  console.log(`brick cards alloc: ${IDS.length} cards, step ≤ ${MAX_BYTES_PER_FRAME} B a frame, a moving frame ≤ ${MAX_FRAME} B, over ${FRAMES} frames`);
} finally {
  await browser.close();
}
