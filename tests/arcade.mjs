// @fzlt/core/arcade in Chromium, with a tiny game on it: a ship that fires up the page. Play turns
// letters into bits and scores; an action key from the definition works from the keyboard and the
// scoreboard; a link on the page doesn't navigate while a run is live; P pauses; the game reporting
// over() gives the page back at once and keeps the scoreboard with the result until Escape; Recall
// restores the page byte for byte; a run that fails to start leaves nothing; phones get the pad; a
// live run locks pinch and double-tap zoom on the page, and stopping gives them back.
import assert from "node:assert/strict";
import { build, transform } from "esbuild";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const kit = (await transform(readFileSync("src/ui/board-ui.css", "utf8"), { loader: "css", minify: true })).code;
const GAME = `
import { arcade, skirmishHud, MODE, PX, PON, KX, KY, FIRE, VW, VH, TARGET_HP } from "./src/arcade.ts";
export function launch(options = {}) {
  return arcade({
    id: "test-game", title: "Test Game", color: "#06c4ff", css: ${JSON.stringify(kit)}, fire: true,
    hint: "Fire up the page", actions: [{ id: "end", key: "KeyK", label: "K · End" }],
    readouts: [["Score", "team", (v) => String(v).padStart(6, "0")], ["Shots"]],
    meter: { label: "Progress" }, colors: ["#06c4ff"], cues: { fire: "fire" },
    ...(options.skirmish ? { hud: skirmishHud({ readouts: [{ label: "Score" }, { label: "Shots" }], overlays: [] }) } : {}),
    create(ctx) {
      const e = ctx.engine, c = ctx.ctl, s = new Float64Array(6); // x, y, score, shots, over, cooldown
      e.add({ step(_, dt) {
        if (s[4]) return;
        if (e.steps === 1) (s[0] = c[VW] / 2), (s[1] = c[VH] * 0.8);
        s[0] = Math.min(Math.max(s[0] + c[KX] * 300 * dt, 10), c[VW] - 10);
        if (c[MODE] === 1 && c[PON]) s[0] += Math.sign(c[PX] - s[0]) * Math.min(Math.abs(c[PX] - s[0]), 300 * dt);
        if ((s[5] -= dt) <= 0 && c[FIRE]) {
          s[5] = 0.1; s[3]++;
          const i = ctx.board.hit(s[0], s[1], s[0], 0);
          if (i >= 0 && ctx.board.consume(i, "binary")) (s[2] += 2), e.events.emit("bit", 0, 0, s[0], s[1]);
          e.events.emit("fire");
        }
        if (ctx.input.hit("end")) s[4] = 1;
      } });
      c[TARGET_HP] = 100;
      // In-page art: a mark that follows the page, moved every frame (its mutations never rescan the board).
      const art = ctx.attach(document.getElementById("board"));
      const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      mark.setAttribute("width", "20"); mark.setAttribute("height", "20");
      art.append(mark);
      return {
        reset() { s.fill(0); },
        over: () => s[4],
        react(ev) { if (ev.type === "bit") ctx.popup(ev.x, ev.y - 40, 2, null, 0), ctx.spark(ev.x, ev.y - 40, 4, 0); },
        draw(g) { g.fillStyle = "#06c4ff"; g.fillRect(s[0] - 6, s[1] - 6, 12, 12); mark.setAttribute("data-x", String(Math.round(s[0]))); mark.innerHTML = s[3] % 2 ? "<rect width='4' height='4'/>" : ""; },
        hud(out) { out[0] = s[2]; out[1] = s[3]; out[2] = s[2]; },
        meter: () => ["BITS", s[2] + " / 40", s[2] / 40],
        stats: () => ({ score: s[2], shots: s[3] }),
      };
    },
  }, options);
}`;
const bundle = (await build({ stdin: { contents: GAME, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "iife", globalName: "T", write: false, logLevel: "silent" })).outputFiles[0].text;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font:18px/1.6 system-ui;background:#101514;color:#e1ebdb">
<div data-virus-ignore><button id="outside">Outside</button></div>
<main id="board" style="max-width:900px;margin:auto;padding:30px">
<h1 style="font-size:56px">The page is the board.</h1>
<p>Real words and <a href="#away" id="link">a link</a>. Every letter here is terrain for the test ship to shoot at.</p>
<p>More words, more letters, more terrain all the way across the line so the ship always hits something.</p>
<button id="factory">A factory</button>
<form><input id="field"></form>
</main><script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const html = (p) => p.evaluate(() => document.documentElement.outerHTML);
const snap = (p) => p.evaluate(() => window.g.getSnapshot());
let where = "desktop";
try {
  const p = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(PAGE);
  const before = await html(p);
  await p.evaluate(() => (window.g = T.launch({ root: "#board", seed: 3, sound: false })).start());
  const host = p.locator("[data-fizlet-host=test-game]");
  assert.equal(await host.count(), 1);
  assert.equal((await snap(p)).status, "running");
  assert.equal(await p.locator("#board > [data-fizlet-host=test-game-art]").count(), 1, "the in-page art is attached to the board");
  assert.equal(await p.locator("#board").evaluate((b) => b.style.position), "relative", "a static board becomes relative");
  const ui = (sel) => host.evaluate((h, s) => h.shadowRoot.querySelector(s)?.textContent ?? null, sel);
  // Play: hold fire and sweep the pointer; letters become bits, the score readout and meter follow.
  await p.keyboard.down("Space");
  for (let x = 200; x <= 900; x += 70) await p.mouse.move(x, 600), await p.waitForTimeout(120);
  await p.keyboard.up("Space");
  let s = await snap(p);
  assert.ok(s.score > 0 && s.shots > 0, `scored ${s.score} from ${s.shots} shots`);
  assert.ok(s.board.spent > 0 && s.board.measurements <= 900, JSON.stringify(s.board));
  assert.ok(Number(await p.locator("#board [data-fizlet-host=test-game-art]").evaluate((h) => h.shadowRoot.querySelector("svg").getAttribute("data-x"))) > 0, "the art follows the game");
  assert.match(await p.locator("#board").innerText(), /[01]/, "letters became bits");
  assert.equal(await ui(".bui-readout b"), String(s.score).padStart(6, "0"), "the score readout");
  assert.match(await ui(".mt span"), /\/ 40/, "the meter");
  assert.match(await ui("nav"), /K · End/, "the action key is on the scoreboard");
  // The factory is painted with its health.
  assert.match(await p.locator("#factory").getAttribute("style"), /linear-gradient/);
  // The page's link fires instead of navigating; fields keep their keys.
  await p.click("#link");
  assert.ok(!p.url().endsWith("#away"));
  await p.click("#field");
  await p.keyboard.type("ok");
  assert.equal(await p.inputValue("#field"), "ok");
  await p.fill("#field", "");
  await p.locator("#field").blur();
  // P pauses (time stands still), P resumes.
  await p.mouse.move(500, 300);
  await p.keyboard.press("KeyP");
  assert.equal((await snap(p)).status, "paused");
  const t = (await snap(p)).elapsed;
  await p.waitForTimeout(250);
  assert.equal((await snap(p)).elapsed, t);
  await p.keyboard.press("KeyP");
  // The action ends the run: the page is back at once, the scoreboard stays, Escape closes it.
  await p.keyboard.press("KeyK");
  await p.waitForFunction(() => window.g.getSnapshot().status === "gameover");
  assert.equal(await host.count(), 1, "the scoreboard stays with the result");
  assert.match(await ui(".msg"), /GAME OVER/);
  assert.ok((await snap(p)).score >= s.score, "the result keeps the score");
  await p.keyboard.press("Escape");
  assert.equal((await snap(p)).status, "idle");
  assert.equal(await html(p), before, "Recall: the page byte for byte");
  // Recall mid-run, from the exit key.
  await p.evaluate(() => window.g.start());
  await p.keyboard.down("Space");
  await p.waitForTimeout(600);
  await p.keyboard.up("Space");
  await host.evaluate((h) => h.shadowRoot.querySelector("[data-a=exit]").click());
  assert.equal(await html(p), before, "the exit key restores the page");
  // A run that fails to start leaves nothing behind.
  const failed = await p.evaluate(() => { try { T.launch({ targetSelector: "[[bad" }).start(); return "started"; } catch { return "threw"; } });
  assert.equal(failed, "threw");
  assert.equal(await html(p), before, "a failed start changes nothing");
  assert.deepEqual(errs, []);
  await p.close();

  where = "hidpi and drag";
  // A 2x screen: the canvas covers the viewport at its CSS size (its backing store is denser), so what
  // it draws lines up with the page. Every preset's panel drags (not by its keys) and stays on screen.
  for (const skirmish of [false, true]) {
    const hd = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 });
    const hp = await hd.newPage();
    await hp.setContent(PAGE);
    await hp.evaluate((skirmish) => (window.g = T.launch({ root: "#board", sound: false, skirmish })).start(), skirmish);
    await hp.waitForTimeout(100);
    const at = () => hp.locator("[data-fizlet-host=test-game]").evaluate((h) => {
      const c = h.shadowRoot.querySelector("canvas"), p = h.shadowRoot.querySelector(".bui>section"), t = p.querySelector("b").getBoundingClientRect();
      return { w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height, cw: c.width, x: t.left + 4, y: t.top + t.height / 2, box: p.getBoundingClientRect().toJSON() };
    });
    const a = await at();
    assert.deepEqual([a.w, a.h, a.cw], [1000, 700, 1500], "the canvas is the viewport's CSS size at 2x (backing 1.5x)");
    await hp.mouse.move(a.x, a.y);
    await hp.mouse.down();
    const dy = a.box.top > 350 ? -250 : 250; // toward open space
    await hp.mouse.move(a.x - 200, a.y + dy, { steps: 5 });
    await hp.mouse.up();
    const b = await at();
    assert.ok(Math.abs(b.box.left - (a.box.left - 200)) < 2 && Math.abs(b.box.top - (a.box.top + dy)) < 2, `${skirmish ? "skirmish" : "arcade"} panel dragged: ${JSON.stringify([a.box.left, a.box.top, b.box.left, b.box.top])}`);
    await hp.mouse.move(b.x, b.y);
    await hp.mouse.down();
    await hp.mouse.move(-900, -900, { steps: 3 });
    await hp.mouse.up();
    const c = await at();
    assert.ok(c.box.left >= 0 && c.box.top >= 0, "and stays on screen");
    await hd.close();
  }

  where = "phone";
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  await pp.setContent(PAGE);
  await pp.evaluate(() => (window.g = T.launch({ root: "#board", sound: false })).start());
  const pad = await pp.locator("[data-fizlet-host=test-game]").evaluate((h) => ({ stick: !!h.shadowRoot.querySelector(".bui-stick"), keys: h.shadowRoot.querySelectorAll(".bui-pad button").length, compact: h.shadowRoot.querySelector(".ar").classList.contains("compact") }));
  assert.ok(pad.stick && pad.keys >= 2 && pad.compact, JSON.stringify(pad));
  // Touch lock (@fzlt/core/touch): while a run is live a pinch anywhere on the page (the board) never
  // zooms it and the page is touch-action: manipulation (no double-tap zoom); stop() gives both back.
  // Raw touch points: Chromium's synthesized touch pinch never zooms headless.
  where = "phone touch lock";
  const cdp = await phone.newCDPSession(pp);
  const pinch = async () => {
    const pts = (type, l) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: l.map(([x, y], id) => ({ x, y, id })) });
    await pts("touchStart", [[180, 120], [210, 120]]);
    for (let i = 1; i <= 10; i++) await pts("touchMove", [[180 - i * 12, 120], [210 + i * 12, 120]]);
    await pts("touchEnd", []);
    await pp.waitForTimeout(300);
    return pp.evaluate(() => [visualViewport.scale, getComputedStyle(document.documentElement).touchAction]);
  };
  assert.deepEqual(await pinch(), [1, "manipulation"], "a live run: a pinch on the page does not zoom; no double-tap zoom");
  await pp.evaluate(() => window.g.stop());
  const [scale, ta] = await pinch();
  assert.ok(scale > 1.2 && ta === "auto", `stopped: the page pinch-zooms again (${scale}, ${ta})`);
  await phone.close();
  console.log("arcade: play, in-page art, readouts and meter, action key, target paint, links and fields, pause, game over then Escape, Recall exact, failed start, 2x canvas at CSS size, every preset's panel drags, phone pad, phone touch lock and its release passed.");
} catch (err) {
  console.error(`arcade test failed at: ${where}`);
  throw err;
} finally {
  await browser.close();
}
