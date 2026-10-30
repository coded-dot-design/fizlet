// The "how it works" labs (site/labs/) in Chromium: each runs on its own engine, its buttons work
// (pool cap and rejects with no new nodes, Recall restores only the game's letters, duel scores,
// board X-ray and bug cap, pipeline ships), each settles when idle and sleeps off screen, and
// destroy() gives every figure back byte for byte. Reduced motion: nothing plays on its own, the
// buttons still show their result.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const IDS = ["pool", "recall", "duel", "board", "pipeline"];
const mod = (await build({ entryPoints: ["site/labs/index.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" })).outputFiles[0].text;
const LABS = await import("data:text/javascript;base64," + Buffer.from(mod).toString("base64"));
const js = (await build({ entryPoints: ["site/labs/index.ts"], bundle: true, format: "iife", globalName: "labs", write: false, logLevel: "silent" })).outputFiles[0].text;
const css = readFileSync("site/labs/labs.css", "utf8") + readFileSync("src/ui/board-ui.css", "utf8");
const html = `<!doctype html><html class="bui" data-theme="dark"><body style="margin:0;background:var(--bg);font-family:system-ui">` +
  IDS.map((id) => `<section class="fzl-host fzl-lime" style="width:560px;padding:40px 30px 900px">${LABS[`${id}Figure`]()}</section>`).join("") + `</body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (n-- ? requestAnimationFrame(f) : ok()); f(); }), n);
async function open(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, ...opts });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(html);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  const before = await page.evaluate((ids) => {
    const fig = (id) => document.querySelector(`[data-fzl="${id}"]`);
    const out = Object.fromEntries(ids.map((id) => [id, fig(id).outerHTML]));
    window.run = Object.fromEntries(ids.map((id) => [id, labs[id](fig(id))]));
    return out;
  }, IDS);
  const fig = (id) => page.locator(`[data-fzl="${id}"]`);
  const show = async (id) => (await fig(id).scrollIntoViewIfNeeded(), frames(page));
  const paused = (id) => page.evaluate((id) => run[id].engine.paused, id);
  return { page, errors, before, fig, show, paused };
}

try {
  // ---------- Live: every button, settle, sleep off screen, Recall ----------
  {
    const { page, errors, before, fig, show, paused } = await open();
    // Pool: 32 nodes made once, the real pool's cap rejects, nothing new is ever created.
    await show("pool");
    const pool = fig("pool");
    assert.equal(await pool.locator(".arena i").count(), 32);
    for (let i = 0; i < 6; i++) await pool.locator("[data-spawn]").click();
    await frames(page);
    assert.equal(await pool.locator(".arena i").count(), 32, "no new nodes");
    assert.match(await pool.locator("[data-pool-readout]").textContent(), /^ACTIVE 32 \/ 32 · REJECTED [1-9]\d* · ALLOCATIONS 0$/);
    assert.deepEqual(await page.evaluate(() => run.pool.engine.stats().pools.sparks), { used: 32, cap: 32 }, "the readout is the engine's pool");
    assert.equal(await pool.locator(".pool-slots i.on").count(), 32);
    assert.notEqual(await pool.locator("[data-frame-ms]").textContent(), "", "frame meter");

    // Recall: the game's hits go through its ledger; your app's edit wins; Recall, then a reload.
    await show("recall");
    const rc = fig("recall"), victim = rc.locator("[data-victim]");
    const original = await victim.textContent();
    for (let i = 0; i < 3; i++) await rc.locator("[data-hit]").click();
    await frames(page);
    const hit = await victim.textContent();
    assert.equal(hit.length, original.length);
    assert.equal([...hit].filter((c, i) => c !== original[i] && /[01]/.test(c)).length, 3, "three letters owned");
    assert.equal(await victim.evaluate((el) => el.children.length), 0, "no element wrappers");
    assert.equal(await rc.locator("[data-owned]").textContent(), "OWNED 3");
    assert.equal(await rc.locator("ol li:not([hidden])").count(), 3, "three ledger rows");
    await rc.locator("[data-app-edit]").click();
    await frames(page);
    assert.equal(await rc.locator("[data-owned]").textContent(), "OWNED 2 · APP 1");
    assert.match(await rc.locator("ol li.app").textContent(), /→ \* · YOUR APP$/);
    await rc.locator("[data-recall]").click();
    await frames(page);
    const after = await victim.textContent();
    assert.deepEqual([...after].filter((c, i) => c !== original[i]), ["*"], "only the app's edit is left");
    assert.match(await rc.locator("ol li.app.back").textContent(), /· KEPT$/);
    await rc.locator("[data-recall]").click();
    await frames(page);
    assert.equal(await victim.textContent(), original, "the second Recall reloads the sentence");
    assert.equal(await rc.locator("ol li:not([hidden])").textContent(), "↻ page reloaded");
    for (let i = 0; i < 8; i++) await rc.locator("[data-hit]").click();
    await frames(page);
    assert.equal(await rc.locator("[data-owned]").textContent(), "OWNED 6 · CAP", "the ledger's cap");

    // Duel: a packet crosses the network and scores.
    await show("duel");
    const duel = fig("duel");
    await duel.locator('[data-fire="0"]').click();
    await page.waitForFunction(() => document.querySelector('[data-score="0"]').textContent !== "00");
    assert.equal(await duel.locator(".packet").count(), 2, "two packets, made once");

    // Board: X-ray draws what the game reads; the factory's pool caps at six; bugs walk.
    await show("board");
    const bd = fig("board");
    await bd.locator("[data-xray]").click();
    await frames(page);
    assert.equal(await bd.locator("[data-xray]").getAttribute("aria-pressed"), "true");
    assert.equal(await bd.locator(".xray b").count(), 4);
    for (let i = 0; i < 8; i++) await bd.locator("[data-factory]").click();
    await frames(page);
    assert.equal(await bd.locator("[data-bug-count]").textContent(), "BUGS 6 / 6 · CAP");
    const bugAt = () => bd.locator(".bugs i").first().evaluate((el) => el.style.transform);
    const first = await bugAt();
    await page.waitForTimeout(200);
    assert.notEqual(await bugAt(), first, "bugs walk");

    // Pipeline: ships itself the first time it is on screen; every stage lights.
    await show("pipeline");
    await page.waitForFunction(() => document.querySelector("[data-ship-readout]").textContent === "LIVE · 0 SERVERS", null, { timeout: 8000 });
    assert.equal(await fig("pipeline").locator(".stages li.lit").count(), 5);
    await fig("pipeline").locator("[data-ship]").click();
    await frames(page);
    assert.equal(await fig("pipeline").locator("[data-ship]").isDisabled(), true, "busy while shipping");

    // Off screen: asleep (the kernel's rule). On screen and idle: settled, no frames at all.
    for (const id of ["pool", "recall", "duel", "board"]) assert.ok((await paused(id)).includes("offscreen"), `${id} sleeps off screen`);
    await page.waitForFunction(() => run.pipeline.engine.paused.includes("settled"), null, { timeout: 8000 });
    await show("recall");
    await page.waitForFunction(() => run.recall.engine.paused.includes("settled"), null, { timeout: 4000 });
    await show("pool");
    await page.waitForFunction(() => run.pool.engine.paused.includes("settled"), null, { timeout: 20000 });
    const steps = await page.evaluate(() => run.pool.engine.steps);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => run.pool.engine.steps), steps, "a settled lab runs no steps");
    await pool.locator("[data-spawn]").click();
    await frames(page);
    assert.equal(await page.evaluate(() => run.pool.engine.running), true, "input wakes it");

    // Recall: destroy gives every figure back exactly, the letters joined into one text node.
    const back = await page.evaluate((ids) => {
      for (const id of ids) run[id].destroy();
      const hl = "highlights" in CSS ? CSS.highlights.has("lab-owned") : false;
      return { html: Object.fromEntries(ids.map((id) => [id, document.querySelector(`[data-fzl="${id}"]`).outerHTML])), nodes: document.querySelector("[data-victim]").childNodes.length, hl };
    }, IDS);
    for (const id of IDS) assert.equal(back.html[id], before[id], `${id}: destroy restores the figure exactly`);
    assert.equal(back.nodes, 1, "the sentence is one text node again");
    assert.equal(back.hl, false, "highlights gone");
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---------- Reduced motion: nothing plays on its own; the buttons still show their result ----------
  {
    const { page, errors, fig, show } = await open({ reducedMotion: "reduce" });
    await show("pool");
    await fig("pool").locator("[data-spawn]").click();
    await frames(page);
    assert.match(await fig("pool").locator("[data-pool-readout]").textContent(), /^ACTIVE 08 \/ 32/, "parked sparks, no fountain");
    await show("duel");
    await fig("duel").locator('[data-fire="1"]').click();
    await frames(page);
    assert.equal(await fig("duel").locator('[data-score="1"]').textContent(), "01", "a hit at once, no flight");
    await show("pipeline");
    await page.waitForTimeout(900);
    assert.equal(await fig("pipeline").locator("[data-ship-readout]").textContent(), "READY", "no auto ship");
    await fig("pipeline").locator("[data-ship]").click();
    await frames(page);
    assert.equal(await fig("pipeline").locator("[data-ship-readout]").textContent(), "LIVE · 0 SERVERS");
    assert.equal(await fig("pipeline").locator(".stages li.lit").count(), 5);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("labs: pool, recall, duel, board, pipeline: buttons, settle, offscreen sleep, Recall exact, reduced motion (Chromium) ok");
} finally {
  await browser.close();
}
