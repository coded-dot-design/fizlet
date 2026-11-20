// Stack it (site/demos/stack) in Chromium: the intro bursts the bricks out, stacks five, makes a
// shooter and rates it, then settles (zero frames) on your turn; you tap and drag bricks onto the
// pad, press FINISHED and get your own app and rating (a movie here); without the kernel it falls
// apart; REBUILD goes back to the bricks; Recall gives the page back byte for byte; with reduced
// motion nothing animates (every move jumps) and FINISHED still assembles the app.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { mount } from "./site/demos/stack/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "sk", write: false, logLevel: "silent",
})).outputFiles[0].text;
// The bricks' measured bytes (site/demos/stack/data.ts): what the stacks below weigh.
const B = Object.fromEntries([...readFileSync("site/demos/stack/data.ts", "utf8").matchAll(/([a-z-]+) [a-z]+ (\d+)(?=[,"])/g)].map((m) => [m[1], +m[2]]));
const kb = (...ids) => (ids.reduce((a, id) => a + B[id], 0) / 1024).toFixed(1) + " KB";
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const PAGE = `<!doctype html><html class="bui" data-theme="dark"><meta charset="utf-8"><style>${css}</style>
<body style="margin:0"><main id="page"><h1>Host page</h1><div id="stage" style="position:relative;width:900px;height:560px;overflow:hidden"></div></main><script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const wait = (p, ms) => p.waitForTimeout(ms);
const frames = (p) => p.evaluate(() => window.scene.engine.stats().frames);
const pressed = (p, id) => p.getAttribute(`.sk-b:has(b:text-is("${id}"))`, "aria-pressed");
/** Frames drawn over 1 s once still: the kernel settles, so 0. */
async function still(p) {
  await p.waitForFunction(() => window.scene.engine.paused.includes("settled"), null, { timeout: 20000 });
  const f0 = await frames(p);
  await wait(p, 1000);
  return (await frames(p)) - f0;
}
try {
  {
    const p = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.body.innerHTML);
    await p.evaluate(() => (window.scene = sk.mount(document.getElementById("stage"))));
    assert.equal(await p.locator(".sk-b").count(), 20, "every brick, by its real name");
    assert.equal(await p.textContent('.sk-b:has(b:text-is("KERNEL")) span'), B.kernel.toLocaleString("en-US") + " B", "each wears its measured size");
    // The intro: the hand stacks five bricks, they become a shooter, and it gets its stars.
    await p.waitForFunction(() => document.querySelectorAll('.sk-b[aria-pressed="true"]').length === 5, null, { timeout: 20000 });
    await p.waitForFunction(() => !document.querySelector(".sk-rate").hidden, null, { timeout: 20000 });
    assert.match(await p.textContent(".sk-rate"), new RegExp(`★★★★★SHIP IT${kb("kernel", "input", "sprite", "fx", "hud")} · ALL USED5 of 5 stars`), "the intro's shooter: five stars");
    // Then it is your turn: the bricks go home, and the scene settles.
    await p.waitForFunction(() => !document.querySelector('.sk-b[aria-pressed="true"]') && document.querySelector(".sk-rate").hidden, null, { timeout: 20000 });
    assert.equal(await still(p), 0, "zero frames once still (your turn)");
    assert.equal(await p.isDisabled(".sk-go"), true, "FINISHED waits for a brick");

    // Tap three bricks onto the pad, drag a fourth there.
    for (const id of ["KERNEL", "TIMELINE", "CAMERA"]) await p.click(`.sk-b:has(b:text-is("${id}"))`);
    for (const id of ["KERNEL", "TIMELINE", "CAMERA"]) assert.equal(await pressed(p, id), "true", `${id}: a tap stacks it`);
    await wait(p, 700);
    const fx = await p.locator('.sk-b:has(b:text-is("FX"))').boundingBox(), pad = await p.locator(".sk-pad").boundingBox();
    await p.mouse.move(fx.x + fx.width / 2, fx.y + fx.height / 2);
    await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(fx.x + fx.width / 2 + ((pad.x + pad.width / 2 - fx.x - fx.width / 2) * k) / 8, fx.y + fx.height / 2 + ((pad.y - 140 - fx.y - fx.height / 2) * k) / 8);
    await p.mouse.up();
    assert.equal(await pressed(p, "FX"), "true", "a brick dragged onto the pad lands on the stack");
    const movie = kb("kernel", "timeline", "camera", "fx");
    await p.waitForFunction((w) => document.querySelector(".sk-tag").textContent === w, movie, { timeout: 20000 }); // the stack wears its weight
    // FINISHED: the stack becomes its app (timeline + camera: a movie) and gets rated.
    await wait(p, 600);
    await p.click(".sk-go");
    await p.waitForFunction(() => !document.querySelector(".sk-rate").hidden, null, { timeout: 20000 });
    assert.match(await p.textContent(".sk-rate"), new RegExp(`★★★★★SHIP IT${movie} · ALL USED5 of 5 stars`), "your movie: four bricks, five stars");
    assert.equal(await p.textContent(".sk-go"), "REBUILD");
    assert.ok(await p.evaluate(() => document.querySelector(".sk").classList.contains("sk-app")), "the app shows; the bricks are in it");
    assert.equal(await still(p), 0, "zero frames once the app has played");
    // REBUILD: back to the bricks, the stack as it was; take the kernel off and it falls apart.
    await p.click(".sk-go");
    await p.waitForFunction(() => !document.querySelector(".sk").classList.contains("sk-app"), null, { timeout: 20000 });
    await wait(p, 300);
    await p.click('.sk-b:has(b:text-is("KERNEL"))');
    assert.equal(await pressed(p, "KERNEL"), "false", "a tap on a stacked brick takes it back");
    await wait(p, 600);
    await p.click(".sk-go");
    await p.waitForFunction(() => !document.querySelector(".sk-rate").hidden, null, { timeout: 20000 });
    assert.match(await p.textContent(".sk-rate"), /☆☆☆☆☆.*NO KERNEL, NO LOOP.*ADD THE KERNEL/, "no kernel: no app, no stars");
    assert.equal(await p.locator('.sk-b[aria-pressed="true"]').count(), 0, "the stack falls apart");
    // Keyboard: Enter on a brick stacks it.
    await p.focus('.sk-b:has(b:text-is("HUD"))');
    await p.keyboard.press("Enter");
    assert.equal(await pressed(p, "HUD"), "true", "Enter stacks a brick");
    assert.equal(await still(p), 0, "zero frames once still");
    await p.evaluate(() => window.scene.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML), before, "Recall: the page back byte for byte");
    assert.deepEqual(errs, []);
    await p.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.setContent(PAGE);
    await p.evaluate(() => (window.scene = sk.mount(document.getElementById("stage"))));
    await wait(p, 300);
    assert.equal(await p.locator('.sk-b[aria-pressed="true"]').count(), 0, "reduced motion: no intro, your turn at once");
    assert.equal(await still(p), 0, "reduced motion: still");
    await p.click('.sk-b:has(b:text-is("KERNEL"))');
    await p.click('.sk-b:has(b:text-is("INPUT"))');
    await p.click(".sk-go");
    await p.waitForFunction(() => !document.querySelector(".sk-rate").hidden, null, { timeout: 20000 });
    assert.match(await p.textContent(".sk-rate"), /ALL USED/, "reduced motion: a click assembles the app at once");
    assert.equal(await still(p), 0, "reduced motion: the app is one still frame");
    await ctx.close();
  }
  console.log("stack: intro stacks five and rates the shooter, settles (0 frames); tap and drag stack, FINISHED makes and rates your app, no kernel falls apart, REBUILD, keyboard, Recall exact; reduced motion jumps — ok");
} finally {
  await browser.close();
}
