// Browser contract tests (Playwright + Chromium): the ledger gives the page back exactly, auto-pause
// rules, one real requestAnimationFrame for many engines, destroy leaves nothing running, and the
// debug guard catches layout reads in a step, and fizlet/slot (lazy, reduced motion, a11y, Recall).
// debug guard catches layout reads in a step. Sprites: pixel-exact Sherman tile, drawn pixels, cache
// cap, SVG for page characters, and no JS heap allocation in a draw loop (sampled heap profiler).
// rules, one real requestAnimationFrame for many engines, destroy leaves nothing running, the
// debug guard catches layout reads in a step, and the touch pad (real multi-touch through CDP).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const bundle = (await build({
  stdin: { contents: 'export * from "./src/index.ts"; export { guardLayout } from "./src/debug.ts"; export { controls } from "./src/input.ts"; export { embed } from "./src/embed.ts"; export { sound } from "./src/sound.ts"; export { hud } from "./src/hud.ts"; export { slot, findSlot } from "./src/slot.ts"; export { sprites, spriteURL } from "./src/sprite.ts"; export { sherman } from "./tests/fixtures/sherman.mjs"; export { pad } from "./src/pad.ts"; export { mount, readouts } from "./src/ui/board-ui.ts"; export { match } from "./src/match.ts"; export { launch } from "./src/ui/board-ui.ts"; export { boardPage } from "./src/board-page.ts"; export { perf } from "./src/perf.ts"; export { setting, PERF_KEY } from "./src/ui/board-ui.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fizlet", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body>
<h1 id="title" class="hero" style="color: red">Hello <b>page</b></h1>
<p id="copy" data-x="1">Some text to wreck.</p>
<input id="field">
<div style="height:3000px"></div>
<div id="far">far down</div>
<script>${bundle}</script></body>`;

const CSS = readFileSync("src/ui/board-ui.css", "utf8");
/** fizlet/pad on a phone-sized board: names, scheme swaps (no new listeners), fire while steering
 *  with two real fingers, the d-pad, move keys, toggles, keyboard, reduced motion, exact Recall. */
async function padTest() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: "reduce" });
  const tp = await ctx.newPage();
  const errs = [];
  tp.on("pageerror", (e) => errs.push(e.message));
  await tp.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0"><style>${CSS}</style>
<div class="bui" id="board" style="position:relative;width:844px;height:390px"><p id="keep" class="x" style="margin:0">field</p></div><script>${bundle}</script></body>`);
  const cdp = await ctx.newCDPSession(tp);
  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })) });
  const centre = (sel) => tp.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width];
  }, sel);

  const setup = await tp.evaluate(() => {
    // Record every listener added from here on (target, type, signal) to prove none leak.
    const added = (window.added = []), orig = (window.origAdd = EventTarget.prototype.addEventListener);
    EventTarget.prototype.addEventListener = function (type, fn, opt) {
      added.push({ type, signal: opt && opt.signal });
      return orig.call(this, type, fn, opt);
    };
    const board = document.getElementById("board");
    window.before = board.outerHTML;
    const e = (window.e = fizlet.createEngine({ root: board }));
    const c = (window.c = fizlet.controls(e, { keys: { up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], fire: ["Space"], auto: ["KeyQ"], jump: ["KeyJ"] }, stick: "left" }));
    window.base = added.length;
    const p = (window.p = fizlet.pad(e, c, { actions: [
      { intent: "fire", label: "", name: "Hold to fire (Space)", hold: true, key: "SPACE", icon: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="5"/></svg>' },
      { intent: "auto", label: "AUTO", name: "Auto-aim (Q)", role: "aim", toggle: true, key: "Q" },
      { intent: "jump", label: "JUMP" },
    ] }));
    const mine = added.length - window.base;
    for (const s of ["dpad", "buttons", "stick", "buttons", "dpad", "stick", "dpad", "buttons", "stick", "stick"]) p.setScheme(s);
    const named = [...p.el.querySelectorAll("button, [role=application]")].every((n) => n.getAttribute("aria-label"));
    return { mine, afterSwaps: added.length - window.base, scheme: p.scheme, named, moveNodes: p.el.querySelector(".bui-pad-move").children.length, ignored: p.el.hasAttribute("data-fizlet-ignore") };
  });
  assert.deepEqual(setup, { mine: setup.mine, afterSwaps: setup.mine, scheme: "stick", named: true, moveNodes: 1, ignored: true }, "ten scheme swaps add no listeners and leave one move control");

  // Two fingers: drive with the stick, then hold FIRE while still steering.
  const [sx, sy, sw] = await centre(".bui-stick"), [fx, fy] = await centre(".bui-primary");
  await touch("touchStart", [[sx, sy, 1]]);
  await touch("touchMove", [[sx + 40, sy, 1]]);
  await touch("touchStart", [[sx + 40, sy, 1], [fx, fy, 2]]);
  const both = await tp.evaluate(() => (e.advance(0), {
    x: c.stick.x, y: c.stick.y, active: c.stick.active, axis: c.axis("left", "right", 0), fire: c.down("fire"), hit: c.hit("fire"),
    knob: p.el.querySelector(".bui-knob").style.translate, keys: [...p.el.querySelectorAll(".down")].map((n) => n.className).join("|"),
  }));
  const want = (40 / (sw * 0.36) - 0.15) / 0.85;
  assert.ok(Math.abs(both.x - want) < 0.02 && Math.abs(both.y) < 1e-9 && both.active, `steering x ${both.x} (want ${want.toFixed(3)})`);
  assert.equal(both.axis, both.x, "axis() reads the pad stick like the field stick");
  assert.deepEqual([both.fire, both.hit], [true, true], "fire held while steering");
  assert.ok(both.knob.startsWith("40") && /bui-stick down/.test(both.keys) && /bui-primary down/.test(both.keys), `knob drawn in render, both pressed (${both.knob}; ${both.keys})`);
  await touch("touchEnd", [[fx, fy, 2]]); // lift FIRE only (touchEnd lists the lifted points)
  const one = await tp.evaluate(() => (e.advance(0), { fire: c.down("fire"), steering: c.stick.active }));
  assert.deepEqual(one, { fire: false, steering: true }, "lifting FIRE keeps the stick");
  await touch("touchEnd", [[sx + 40, sy, 1]]);
  const none = await tp.evaluate(() => (e.advance(0), { active: c.stick.active, x: c.stick.x, knob: p.el.querySelector(".bui-knob").style.translate, down: p.el.querySelectorAll(".down").length }));
  assert.deepEqual(none, { active: false, x: 0, knob: "", down: 0 }, "the stick lets go and the knob returns");

  // D-pad: one finger, eight ways; a scheme swap mid-press lets go.
  await tp.evaluate(() => p.setScheme("dpad"));
  const [dx, dy, dw] = await centre(".bui-dpad");
  await touch("touchStart", [[dx + dw * 0.35, dy - dw * 0.35, 3]]);
  const diag = await tp.evaluate(() => [c.down("up"), c.down("right"), c.down("down"), c.down("left"), p.el.querySelectorAll(".down").length]);
  assert.deepEqual(diag, [true, true, false, false, 3], "up-right holds two intents (dpad + two arrows pressed)");
  await touch("touchMove", [[dx - dw * 0.4, dy, 3]]);
  const rolled = await tp.evaluate(() => [c.down("up"), c.down("right"), c.down("left")]);
  assert.deepEqual(rolled, [false, false, true], "rolling the thumb changes direction without lifting");
  await tp.evaluate(() => p.setScheme("buttons"));
  const swapped = await tp.evaluate(() => [c.down("left"), p.el.querySelectorAll(".down").length, p.el.querySelectorAll(".bui-pad-move > button").length]);
  assert.deepEqual(swapped, [false, 0, 4], "a swap releases held directions; buttons shows four move keys");
  await touch("touchEnd", [[dx - dw * 0.4, dy, 3]]);

  // Move keys: hold LEFT and FIRE together.
  const [lx, ly] = await centre('.bui-pad-move [data-d="2"]');
  await touch("touchStart", [[lx, ly, 4], [fx, fy, 5]]);
  const keys2 = await tp.evaluate(() => [c.down("left"), c.down("fire")]);
  await touch("touchEnd", [[lx, ly, 4], [fx, fy, 5]]);
  const keys3 = await tp.evaluate(() => [c.down("left"), c.down("fire")]);
  assert.deepEqual([keys2, keys3], [[true, true], [false, false]], "move keys and fire are separate fingers");

  // Toggle: a tap flips the intent and paints at once; game code flipping it repaints in render.
  const [ax, ay] = await centre('[data-i="1"]');
  await touch("touchStart", [[ax, ay, 6]]);
  await touch("touchEnd", [[ax, ay, 6]]);
  const tog = await tp.evaluate(() => {
    const k = p.el.querySelector('[data-i="1"]'), out = [c.down("auto"), k.getAttribute("aria-pressed")];
    c.press("auto", false);
    e.advance(0);
    return [...out, k.getAttribute("aria-pressed")];
  });
  assert.deepEqual(tog, [true, "true", "false"], "toggle on by tap, off from game code");
  // Some Chromium builds deliver a touch tap's click with detail 0: it must not flip the toggle back.
  const tog2 = await tp.evaluate(() => {
    const k = p.el.querySelector('[data-i="1"]');
    k.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 41, pointerType: "touch", isPrimary: true }));
    k.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 41, pointerType: "touch", isPrimary: true }));
    k.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    const on = c.down("auto");
    k.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })); // a real keyboard press later still taps
    return [on, c.down("auto")];
  });
  assert.deepEqual(tog2, [true, false], "a tap's click is not a second tap; a keyboard click still is");

  // Keyboard: Enter on a focused key is one tap.
  await tp.focus('[data-i="2"]');
  await tp.keyboard.press("Enter");
  const kb = await tp.evaluate(() => (e.advance(0), [c.hit("jump"), c.down("jump")]));
  assert.deepEqual(kb, [true, false], "keyboard activation taps");

  // Reduced motion: the kit turns transitions off (the knob snaps back).
  const still = await tp.evaluate(() => (p.setScheme("stick"), getComputedStyle(p.el.querySelector(".bui-knob")).transitionDuration));
  assert.equal(still, "0s");

  // Recall: pad.destroy(), then a second pad given back by engine.destroy(); listeners all aborted.
  const recall = await tp.evaluate(() => {
    const board = document.getElementById("board");
    p.destroy();
    const first = board.outerHTML === window.before;
    const q = fizlet.pad(e, c, { scheme: "dpad", side: "left", actions: [{ intent: "fire", label: "FIRE", hold: true }] });
    q.setScheme("buttons");
    e.destroy();
    EventTarget.prototype.addEventListener = window.origAdd;
    const leaked = window.added.slice(window.base).filter((l) => !l.signal || !l.signal.aborted).map((l) => l.type);
    return { first, second: board.outerHTML === window.before, leaked };
  });
  assert.deepEqual(recall, { first: true, second: true, leaked: [] }, "destroy restores the board exactly and aborts every listener");
  assert.deepEqual(errs, []);
  await ctx.close();
}

/** Contract rule 8: CSS containment on every root Fizlet owns, measured on a real board. Each
 *  contained root lays out exactly as it did without containment (every box inside it, to the
 *  pixel), host boxes get none, and Recall still gives the page back byte for byte. */
async function containTest() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const cp = await ctx.newPage();
  const errs = [];
  cp.on("pageerror", (e) => errs.push(e.message));
  await cp.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0"><style>${CSS}</style>
<div class="bui" id="board" style="position:relative;width:844px;height:390px"><p id="keep" style="margin:0">field <b data-k>0</b></p><ul class="feed"></ul></div>
<h1 id="h">Glyphs for the board</h1><button id="go" type="button">GO</button><div id="ui"></div><script>${bundle}</script></body>`);
  const out = await cp.evaluate(async () => {
    const snap = () => document.documentElement.outerHTML;
    const before = snap();
    const board = document.getElementById("board");
    const e = fizlet.createEngine({ root: board });
    const c = fizlet.controls(e, { keys: { fire: ["Space"] } });
    const p = fizlet.pad(e, c, { actions: [{ intent: "fire", label: "FIRE" }] });
    const m = fizlet.match(e, board, { count: 0 });
    let kills = 3;
    const h = fizlet.hud(e, board).num("[data-k]", () => kills).feed(".feed", 2, "kill", (a) => "kill " + a);
    const b = fizlet.boardPage(e);
    b.refresh();
    e.advance(0.1);
    const ui = fizlet.mount(document.getElementById("ui"), "");
    // The launch burst lives on <body> while it runs; fire it from a key on the kit's own root.
    const key = ui.appendChild(document.createElement("button"));
    key.textContent = "GO";
    fizlet.launch(key, () => {});
    const burst = document.querySelector("body > .bui-burst");
    const contain = (el) => (el ? getComputedStyle(el).contain : "missing");
    // Every box inside a root, with its containment on and then off: nothing may move or resize.
    const boxes = (el) => [el, ...el.querySelectorAll("*")].map((n) => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].join(); }).join("|");
    const same = (el) => {
      const on = boxes(el), was = el.style.getPropertyValue("contain");
      el.style.setProperty("contain", "none");
      const off = boxes(el);
      was ? el.style.setProperty("contain", was) : el.style.removeProperty("contain");
      if (!el.getAttribute("style")) el.removeAttribute("style");
      return on === off && on.length > 0;
    };
    const res = {
      contain: {
        mount: contain(ui), pad: contain(p.el), overlay: contain(m.el), burst: contain(burst),
        // Host boxes stay the host's: the board root, hud markup, board-page text, the page itself.
        board: contain(board), hud: contain(board.querySelector("[data-k]")), feed: contain(board.querySelector(".feed")),
        text: contain(document.getElementById("h")), body: contain(document.body), html: contain(document.documentElement),
      },
      still: { pad: same(p.el), overlay: !m.el.hidden && same(m.el), burst: same(burst) },
      shown: board.querySelector("[data-k]").textContent,
    };
    // Recall: the engine gives back the board, the burst ends, the kit mount is the host's to remove.
    await new Promise((r) => setTimeout(r, 1000));
    e.destroy();
    document.getElementById("ui").shadowRoot.replaceChildren();
    res.burstGone = !document.querySelector(".bui-burst");
    // A shadow root can't be detached; compare the light DOM, which is all the page serialises.
    res.back = snap() === before;
    return res;
  });
  assert.deepEqual(out.contain, {
    mount: "style", pad: "layout style", overlay: "layout style", burst: "layout style",
    board: "none", hud: "none", feed: "none", text: "none", body: "none", html: "none",
  }, "every root Fizlet owns is contained; host boxes are not");
  assert.deepEqual(out.still, { pad: true, overlay: true, burst: true }, "containment moves and resizes nothing");
  assert.equal(out.shown, "3", "the hud still writes into the host's markup");
  assert.equal(out.burstGone, true, "the launch burst removes itself");
  assert.equal(out.back, true, "Recall restores the page exactly with containment on");
  assert.deepEqual(errs, []);
  await ctx.close();
}

/** fizlet/perf on a real board: off by default, the kit's Settings switch (persisted, storage
 *  failures ignored) and the key toggle it in step, the chart moves with real frames, it settles
 *  with the engine (no frames, no dropped-frame burst on wake), no layout reads in a step, and
 *  Recall gives the board back byte for byte. */
async function perfTest() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const pp = await ctx.newPage();
  const errs = [];
  pp.on("pageerror", (e) => errs.push(e.message));
  // A real origin (about:blank denies localStorage outright, which the switch survives too).
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0"><style>${CSS}</style>
<div class="bui" id="board" style="position:relative;width:844px;height:390px;background:#07060f"><p id="keep" style="margin:0">field</p></div>
<div class="bui" id="settings"><button id="perf-set" type="button" class="bui-key">Performance overlay</button></div><script>${bundle}</script></body>`;
  await pp.route("http://fizlet.test/", (r) => r.fulfill({ body: html, contentType: "text/html" }));
  await pp.goto("http://fizlet.test/");
  const wait = (ms) => pp.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
  const setup = await pp.evaluate(() => {
    const board = document.getElementById("board");
    window.before = board.outerHTML;
    const e = (window.e = fizlet.createEngine({ root: board, settle: 0.3 }));
    window.moving = true;
    e.add({ step: (en) => window.moving && en.busy() });
    fizlet.guardLayout(e);
    let s;
    const p = (window.p = fizlet.perf(e, { change: (on) => s?.set(on) }));
    const btn = document.getElementById("perf-set");
    s = window.s = fizlet.setting(btn, fizlet.PERF_KEY, (on) => p.show(on), e.signal);
    const off = { on: p.on, hidden: p.el.hidden, aria: p.el.getAttribute("aria-hidden"), pressed: btn.getAttribute("aria-pressed"), stored: localStorage.getItem(fizlet.PERF_KEY) };
    btn.click();
    const cs = getComputedStyle(p.el);
    return {
      off,
      on: { on: p.on, hidden: p.el.hidden, aria: p.el.hasAttribute("aria-hidden"), pressed: btn.getAttribute("aria-pressed"), stored: localStorage.getItem(fizlet.PERF_KEY) },
      contain: cs.contain, events: cs.pointerEvents, parent: p.el.parentElement.id, ignore: p.el.hasAttribute("data-fizlet-ignore"),
      // Board UI tokens: the card is the kit's surface on the rim.
      look: [cs.backgroundColor, cs.borderTopColor, cs.position, cs.top, cs.right].join(),
    };
  });
  assert.deepEqual(setup.off, { on: false, hidden: true, aria: "true", pressed: "false", stored: null }, "off by default, hidden from assistive tech");
  assert.deepEqual(setup.on, { on: true, hidden: false, aria: false, pressed: "true", stored: "1" }, "the Settings switch shows it and remembers");
  assert.ok(["layout paint style", "content"].includes(setup.contain), `contained root (${setup.contain})`);
  assert.deepEqual([setup.events, setup.parent, setup.ignore], ["none", "board", true]);
  assert.equal(setup.look, "rgb(17, 13, 34),rgb(7, 6, 15),absolute,8px,8px", "kit tokens, top right of the board");

  await pp.evaluate(() => e.start());
  await wait(700);
  const pixels = () => pp.evaluate(() => {
    const c = p.el.querySelector("canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let lit = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) (lit++, (sum = (sum * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13 + i) % 1e9));
    return { lit, sum, frames: p.frames, text: [...p.el.querySelectorAll("b")].map((b) => b.textContent) };
  });
  const a = await pixels();
  await wait(250);
  const b = await pixels();
  assert.ok(a.frames > 15 && b.frames > a.frames, `frames recorded (${a.frames} → ${b.frames})`);
  assert.ok(a.lit > 100, `the chart draws (${a.lit} lit pixels)`);
  assert.notEqual(a.sum, b.sum, "the chart moves with the frames");
  const [fps, ms, , work, live, mb] = b.text;
  assert.ok(+fps > 10 && +ms > 0 && +work >= 0 && live === "0" && /^(\d+|--)$/.test(mb), `readouts ${b.text.join(" ")}`);

  // The key flips it, and the Settings switch follows (and stores it).
  await pp.keyboard.press("F9");
  const keyed = await pp.evaluate(() => [p.on, p.el.hidden, p.el.getAttribute("aria-hidden"), s.on, document.getElementById("perf-set").getAttribute("aria-pressed"), localStorage.getItem(fizlet.PERF_KEY)]);
  assert.deepEqual(keyed, [false, true, "true", false, "false", "0"], "F9 hides it; the switch and storage follow");
  await pp.keyboard.press("F9");
  assert.equal(await pp.evaluate(() => p.on && s.on), true);

  // Settle: nothing moves, the engine sleeps, the chart rests with it; waking costs no dropped frames.
  await pp.evaluate(() => (window.moving = false));
  await wait(700);
  const slept = await pixels();
  await wait(300);
  const still = await pixels();
  const rest = await pp.evaluate(() => ({ paused: e.paused.join(), dropped: p.dropped, violations: e.violations }));
  assert.equal(rest.paused, "settled");
  assert.deepEqual([still.frames, still.sum], [slept.frames, slept.sum], "no frames and an unchanged chart while settled");
  await pp.evaluate(() => ((window.moving = true), e.wake()));
  await wait(200);
  const woke = await pp.evaluate(() => ({ frames: p.frames, dropped: p.dropped }));
  assert.ok(woke.frames > still.frames, "frames again after wake");
  assert.ok(woke.dropped - rest.dropped < 3, `a 1 s sleep is not dropped frames (${rest.dropped} → ${woke.dropped})`);
  assert.equal(rest.violations, 0, "no layout reads in a step");

  // Storage that throws: the switch still works (it just forgets); a stored "1" switches it on.
  const blocked = await pp.evaluate(() => {
    const saved = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
    const k = document.createElement("button"), seen = [];
    const t = fizlet.setting(k, "x", (on) => seen.push(on), e.signal);
    k.click();
    Object.defineProperty(window, "localStorage", saved);
    localStorage.setItem("y", "1");
    const back = fizlet.setting(document.createElement("button"), "y", () => {}, e.signal);
    return { seen, on: t.on, pressed: k.getAttribute("aria-pressed"), restored: back.on };
  });
  assert.deepEqual(blocked, { seen: [false, true], on: true, pressed: "true", restored: true });

  // Recall: the board comes back byte for byte; the key and the system go with the engine.
  const recall = await pp.evaluate(async () => {
    e.destroy();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "F9" }));
    return { back: document.getElementById("board").outerHTML === window.before, left: document.querySelectorAll(".fizlet-perf").length, on: p.on };
  });
  assert.deepEqual(recall, { back: true, left: 0, on: true }, "Recall exact; the key is gone");
  // perf.destroy() alone gives the page back too, and the engine keeps running.
  const alone = await pp.evaluate(async () => {
    const board = document.getElementById("board"), before = board.outerHTML;
    const e2 = fizlet.createEngine({ root: board });
    const q = fizlet.perf(e2, { on: true, corner: "bl" });
    e2.start();
    await new Promise((r) => setTimeout(r, 100));
    const shown = getComputedStyle(q.el).bottom + " " + getComputedStyle(q.el).left;
    q.destroy();
    const res = { shown, back: board.outerHTML === before, running: e2.running };
    e2.destroy();
    return res;
  });
  assert.deepEqual(alone, { shown: "8px 8px", back: true, running: true });
  assert.deepEqual(errs, []);
  await ctx.close();
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let where = "start";
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(PAGE);

  where = "ledger";
  const result = await page.evaluate(() => {
    const { createEngine } = fizlet;
    // Attribute order is not a value the page can see; compare with attributes sorted.
    const snap = () => [...document.body.querySelectorAll("*")].map((n) => n.tagName + [...n.attributes].map((a) => a.name + "=" + a.value).sort().join("|") + "#" + [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join("")).join("\n");
    const before = snap();
    const e = createEngine();
    const L = e.ledger;
    const title = document.getElementById("title"), copy = document.getElementById("copy");
    L.text(copy.firstChild, "S0me t3xt t0 wr3ck.");
    L.style(title, "transform", "rotate(4deg)");
    L.style(title, "color", "lime");
    L.style(copy, "--hp", "3");
    L.attr(copy, "data-x", "2");
    L.attr(copy, "aria-busy", "true");
    L.attr(title, "class", null);
    L.cls(copy, "smashed", true);
    const debris = L.add(document.createElement("canvas"));
    document.body.append(debris);
    const during = snap();
    // Writing the same value again touches nothing (change-only).
    let mutations = 0;
    const mo = new MutationObserver((list) => (mutations += list.length));
    mo.observe(document.body, { subtree: true, attributes: true, characterData: true, childList: true });
    L.style(title, "transform", "rotate(4deg)");
    L.attr(copy, "data-x", "2");
    L.cls(copy, "smashed", true);
    L.text(copy.firstChild, "S0me t3xt t0 wr3ck.");
    const flushed = mo.takeRecords().length + mutations;
    mo.disconnect();
    e.destroy();
    const titleStyle = document.getElementById("title").getAttribute("style");
    return { same: snap() === before, changed: during !== before, flushed, size: L.size, titleStyle };
  });
  assert.equal(result.changed, true, "the engine changed the page");
  assert.equal(result.flushed, 0, "rewriting the same values makes no DOM mutations");
  assert.equal(result.same, true, "destroy (Recall) restores the exact DOM");
  assert.equal(result.size, 0);
  assert.equal(result.titleStyle, "color: red", "the style attribute text comes back byte for byte");

  where = "host-wins";
  const host = await page.evaluate(() => {
    const e = fizlet.createEngine(), L = e.ledger;
    const copy = document.getElementById("copy");
    L.style(copy, "color", "blue");
    L.attr(copy, "data-x", "9");
    copy.style.color = "purple"; // the host page edits after us
    copy.setAttribute("data-x", "host");
    const refused = !L.style(copy, "color", "green") && !L.attr(copy, "data-x", "10");
    e.destroy();
    const keep = copy.style.color === "purple" && copy.getAttribute("data-x") === "host";
    copy.style.color = "";
    copy.removeAttribute("style");
    copy.setAttribute("data-x", "1");
    return { refused, keep };
  });
  assert.deepEqual(host, { refused: true, keep: true }, "a newer host edit always wins");

  where = "one-raf";
  const raf = await page.evaluate(async () => {
    let calls = 0;
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => (calls++, real(cb));
    const engines = [1, 2, 3, 4].map(() => fizlet.createEngine());
    let steps = 0;
    engines.forEach((e) => (e.add({ step: () => steps++ }), e.start()));
    await new Promise((r) => setTimeout(r, 500));
    const frames = engines[0].stats().frames;
    engines.forEach((e) => e.destroy());
    window.requestAnimationFrame = real;
    return { calls, frames, steps };
  });
  assert.ok(raf.frames > 5, "it ran");
  assert.ok(raf.calls <= raf.frames + 2, `one rAF per frame for 4 engines (calls ${raf.calls}, frames ${raf.frames})`);
  assert.ok(raf.steps > raf.frames * 3, "every engine stepped");

  where = "auto-pause";
  const pause = await page.evaluate(async () => {
    const out = {};
    const root = document.getElementById("title");
    const e = fizlet.createEngine({ root });
    e.start();
    out.running = e.running;
    // Hidden tab.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.hidden = e.paused.join();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.back = e.running;
    // Typing in the host page's field.
    document.getElementById("field").focus();
    out.editing = e.paused.join();
    document.getElementById("field").blur();
    out.afterEdit = e.running;
    // Root scrolled off screen.
    document.getElementById("far").scrollIntoView();
    await new Promise((r) => setTimeout(r, 300));
    out.offscreen = e.paused.join();
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
    out.onscreen = e.running;
    e.destroy();
    // After destroy, page events no longer reach it.
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.dead = e.running === false && e.signal.aborted;
    return out;
  });
  assert.deepEqual(pause, { running: true, hidden: "hidden", back: true, editing: "editable", afterEdit: true, offscreen: "offscreen", onscreen: true, dead: true });

  where = "observers-abort";
  const obs = await page.evaluate(() => {
    // Count every observer and listener the kernel makes, and whether each one is let go.
    const Real = window.IntersectionObserver, made = [];
    window.IntersectionObserver = class extends Real {
      constructor(cb, o) { super(cb, o); this.live = true; made.push(this); }
      disconnect() { this.live = false; super.disconnect(); }
    };
    const listening = new Set(), targets = [document, window];
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, o) {
      if (targets.includes(this) && o?.signal) {
        const key = [this, type, fn];
        listening.add(key);
        o.signal.addEventListener("abort", () => listening.delete(key));
      }
      return add.call(this, type, fn, o);
    };
    const root = document.getElementById("title");
    const opts = { root, pause: { reducedMotion: true } };
    const out = {};
    try {
      // 1. The engine's own signal: destroy().
      const a = fizlet.createEngine(opts);
      a.start();
      out.made = made.length;
      a.destroy();
      a.destroy();
      out.destroy = made.filter((o) => o.live).length;
      // 2. A parent AbortSignal aborted while running.
      const p = new AbortController();
      fizlet.createEngine({ ...opts, signal: p.signal }).start();
      p.abort();
      out.parent = made.filter((o) => o.live).length;
      // 3. A parent signal already aborted before the engine starts.
      const q = new AbortController();
      q.abort();
      const c = fizlet.createEngine({ ...opts, signal: q.signal });
      c.start();
      out.preAborted = made.filter((o) => o.live).length;
      out.running = c.running;
      out.listeners = listening.size;
    } finally {
      window.IntersectionObserver = Real;
      EventTarget.prototype.addEventListener = add;
    }
    return out;
  });
  assert.deepEqual(obs, { made: 1, destroy: 0, parent: 0, preAborted: 0, running: false, listeners: 0 }, "every observer and listener goes on destroy, on abort, and on abort before start");

  where = "layout-guard";
  const guard = await page.evaluate(() => {
    const e = fizlet.createEngine();
    fizlet.guardLayout(e);
    const el = document.getElementById("copy");
    e.add({ read: () => el.getBoundingClientRect(), step: () => el.offsetWidth, render: () => el.clientWidth });
    e.advance(1 / 60 + 1e-6);
    const v = e.violations;
    e.destroy();
    return v;
  });
  assert.equal(guard, 1, "only the read inside the step counts");

  where = "input";
  const inp = await page.evaluate(() => {
    const e = fizlet.createEngine({ root: document.getElementById("title") });
    const c = fizlet.controls(e, { keys: { fire: ["Space"], left: ["KeyA"], right: ["KeyD"] } });
    e.start();
    const key = (type, code, target = window) => target.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
    key("keydown", "Space");
    key("keydown", "KeyD");
    e.advance(0);
    const first = [c.hit("fire"), c.down("fire"), c.axis("left", "right")];
    e.advance(0);
    const second = [c.hit("fire"), c.down("fire")];
    key("keyup", "Space");
    e.advance(0);
    const released = c.down("fire");
    // Keys typed in the host page's own field never count.
    key("keydown", "KeyA", document.getElementById("field"));
    e.advance(0);
    const typed = c.down("left");
    c.press("fire");
    e.advance(0);
    const onScreen = c.hit("fire");
    c.press("fire", false);
    e.destroy();
    key("keydown", "Space");
    return { first, second, released, typed, onScreen, after: c.down("fire") };
  });
  assert.deepEqual(inp, { first: [true, true, 1], second: [false, true], released: false, typed: false, onScreen: true, after: false });

  // Hardening (engineering review of 0.2.4): every item is checked, then all failures reported.
  const fails = [];
  const check = (name, actual, expected) => {
    try {
      assert.deepEqual(actual, expected);
    } catch {
      fails.push(`${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
    }
  };

  where = "input-hardening";
  const hard = await page.evaluate(() => {
    const out = {};
    const pad = document.createElement("div");
    pad.style.cssText = "position:fixed;left:100px;top:100px;width:400px;height:200px";
    document.body.append(pad);
    const key = (type, code, extra = {}) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...extra }));
    const ptr = (type, at, o) => at.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", ...o }));
    const fresh = (opts = {}) => {
      const e = fizlet.createEngine({ pause: { hidden: false, offscreen: false, editable: false } });
      const c = fizlet.controls(e, { target: pad, stick: "left", keys: { left: ["KeyA", "ArrowLeft"], fire: ["Space"] }, ...opts });
      e.start();
      return [e, c];
    };
    let [e, c] = fresh();

    // 1. Several physical bindings for one action.
    key("keydown", "KeyA");
    key("keydown", "ArrowLeft");
    key("keyup", "KeyA");
    e.advance(0);
    out.bindings = [c.down("left"), c.axis("left", "fire")];
    key("keyup", "ArrowLeft");
    e.advance(0);
    out.bindingsUp = c.down("left");
    // Auto-repeat keydowns are one press.
    key("keydown", "KeyA");
    key("keydown", "KeyA", { repeat: true });
    key("keyup", "KeyA");
    e.advance(0);
    out.repeat = c.down("left");

    // 2. Release outside the target, pointercancel outside, lostpointercapture.
    ptr("pointerdown", pad, { clientX: 400, clientY: 150 });
    e.advance(0);
    const pressed = c.pointer.down;
    ptr("pointerup", document.body, { clientX: 700, clientY: 500 });
    e.advance(0);
    out.upOutside = [pressed, c.pointer.down];
    ptr("pointerdown", pad, { clientX: 400, clientY: 150 });
    ptr("pointercancel", document.body);
    e.advance(0);
    out.cancelOutside = c.pointer.down;
    ptr("pointerdown", pad, { clientX: 400, clientY: 150 });
    ptr("lostpointercapture", pad);
    e.advance(0);
    out.lostCapture = c.pointer.down;
    const touch = { pointerType: "touch", pointerId: 7 };
    ptr("pointerdown", pad, { ...touch, clientX: 150, clientY: 150 });
    ptr("pointermove", pad, { ...touch, clientX: 210, clientY: 150 });
    e.advance(0);
    const stickOn = [c.stick.active, c.stick.x];
    ptr("pointerup", document.body, touch);
    out.stickUpOutside = [...stickOn, c.stick.active, c.stick.x];
    ptr("pointerdown", pad, { ...touch, clientX: 150, clientY: 150 });
    ptr("lostpointercapture", pad, touch);
    out.stickLost = c.stick.active;

    // 3. Multitouch: the stick keeps its finger; a second finger aims without moving the stick,
    // and the stick finger never moves the pointer.
    const A = { pointerType: "touch", pointerId: 11 }, B = { pointerType: "touch", pointerId: 12 }, C = { pointerType: "touch", pointerId: 13 };
    ptr("pointerdown", pad, { ...A, clientX: 150, clientY: 150 });
    ptr("pointerdown", pad, { ...B, clientX: 450, clientY: 180 });
    ptr("pointerdown", pad, { ...C, clientX: 160, clientY: 160 }); // a second finger on the stick side
    ptr("pointermove", pad, { ...C, clientX: 100, clientY: 100 });
    ptr("pointermove", pad, { ...B, clientX: 460, clientY: 190 });
    ptr("pointermove", pad, { ...A, clientX: 120, clientY: 150 });
    e.advance(0);
    out.multitouch = [c.stick.active, c.stick.x, c.pointer.x];
    ptr("pointerup", pad, C);
    ptr("pointerup", pad, B);
    out.multitouchUp = [c.stick.active, c.stick.x];
    ptr("pointerup", pad, A);

    // 4. Blur, pause and destroy drop held keys, the pointer and the stick.
    const holdAll = () => {
      key("keydown", "Space");
      ptr("pointerdown", pad, { clientX: 400, clientY: 150 });
      ptr("pointerdown", pad, { ...A, clientX: 150, clientY: 150 });
      c.press("left");
    };
    const held = () => [c.down("fire"), c.down("left"), c.pointer.down, c.stick.active];
    holdAll();
    window.dispatchEvent(new Event("blur"));
    out.blur = held();
    key("keyup", "Space");
    c.press("left", false);
    holdAll();
    e.stop();
    out.pause = held();
    e.start();
    key("keyup", "Space");
    e.advance(0);
    out.resumedNoGhost = c.hit("fire");
    holdAll();
    e.destroy();
    out.destroy = held();

    // 5. A press is seen by exactly one step, across frames with 0 steps and with several.
    [e, c] = fresh();
    let seen = 0;
    e.add({ step: () => (seen += c.hit("fire") ? 1 : 0) });
    key("keydown", "Space");
    e.advance(0); // a frame with no step (first frame, paused catch-up)
    const outside = c.hit("fire");
    e.advance(0);
    e.advance(e.dt * 3 + 1e-9); // three steps
    e.advance(e.dt);
    out.zeroThenSteps = [outside, seen];
    key("keyup", "Space");
    seen = 0;
    key("keydown", "Space");
    e.advance(e.dt * 3 + 1e-9);
    e.advance(e.dt * 3 + 1e-9);
    out.severalSteps = seen;
    key("keyup", "Space");
    seen = 0;
    ptr("pointerdown", pad, { clientX: 400, clientY: 150 });
    ptr("pointerup", pad, {});
    let pseen = 0;
    e.add({ step: () => (pseen += c.pointer.hit ? 1 : 0) });
    e.advance(0);
    e.advance(e.dt * 3 + 1e-9);
    out.pointerHit = pseen;
    e.destroy();

    // 6. Independent disposal: the controls go, the engine keeps running.
    [e, c] = fresh();
    let steps = 0;
    e.add({ step: () => steps++ });
    holdAll();
    c.dispose?.();
    c.dispose?.(); // idempotent
    key("keyup", "Space");
    key("keydown", "Space");
    ptr("pointerdown", pad, { clientX: 400, clientY: 150 });
    e.advance(e.dt);
    out.dispose = [typeof c.dispose, e.running, steps, c.down("fire"), c.hit("fire"), c.pointer.down, c.stick.active];
    e.destroy();

    // 7. Pointer events never measure layout; the read phase does, once per frame.
    [e, c] = fresh();
    const real = Element.prototype.getBoundingClientRect;
    let reads = 0;
    Element.prototype.getBoundingClientRect = function () {
      reads++;
      return real.call(this);
    };
    for (let i = 0; i < 20; i++) ptr("pointermove", pad, { clientX: 300 + i, clientY: 150 });
    const inEvents = reads;
    e.advance(0);
    Element.prototype.getBoundingClientRect = real;
    out.measure = [inEvents, reads, c.pointer.x, c.pointer.y];
    e.destroy();
    pad.remove();
    return out;
  });
  check("1 bindings: A + ArrowLeft, release A", hard.bindings, [true, -1]);
  check("1 bindings: release both", hard.bindingsUp, false);
  check("1 bindings: auto-repeat", hard.repeat, false);
  check("2 pointerup outside the target", hard.upOutside, [true, false]);
  check("2 pointercancel outside the target", hard.cancelOutside, false);
  check("2 lostpointercapture", hard.lostCapture, false);
  check("2 stick released outside", hard.stickUpOutside, [true, 1, false, 0]);
  check("2 stick lostpointercapture", hard.stickLost, false);
  check("3 multitouch: stick x, pointer x stays on finger B", hard.multitouch, [true, -0.5, 360]);
  check("3 multitouch: other fingers lifting keep the stick", hard.multitouchUp, [true, -0.5]);
  check("4 blur clears", hard.blur, [false, false, false, false]);
  check("4 pause clears", hard.pause, [false, false, false, false]);
  check("4 no ghost press after resume", hard.resumedNoGhost, false);
  check("4 destroy clears", hard.destroy, [false, false, false, false]);
  check("5 hit: 0-step frames then steps → seen once (and true outside steps meanwhile)", hard.zeroThenSteps, [true, 1]);
  check("5 hit: several steps per frame → seen once", hard.severalSteps, 1);
  check("5 pointer hit: seen once", hard.pointerHit, 1);
  check("6 dispose", hard.dispose, ["function", true, 1, false, false, false, false]);
  check("7 no layout reads in pointer events; one in read", hard.measure, [0, 1, 219, 50]);

  where = "sound-hardening";
  const snd = await page.evaluate(async () => {
    const Real = window.AudioContext, made = [];
    window.AudioContext = class extends Real {
      constructor() {
        super();
        made.push(this);
      }
    };
    window.__made = made;
    const out = {};
    // 8. A custom player: no AudioContext, no unlock listeners; dispose is its own.
    const e = fizlet.createEngine({ pause: { hidden: false, offscreen: false, editable: false } });
    let played = 0;
    const s = fizlet.sound(e, { cues: { boom: "boom" }, play: () => played++ });
    window.__s8 = { e, s, played: () => played };
    e.start();
    return out;
  });
  await page.mouse.click(5, 5);
  await page.keyboard.press("Shift");
  const s8 = await page.evaluate(() => {
    const { e, s, played } = window.__s8;
    const made = window.__made.length;
    e.add({ step: (x) => x.events.emit("boom") });
    e.advance(e.dt);
    const before = played();
    s.dispose?.();
    e.advance(e.dt);
    const after = played();
    const r = [made, before, after, typeof s.dispose, e.running];
    e.destroy();
    return r;
  });
  check("8 custom player: no AudioContext, plays, dispose stops it, engine runs", s8, [0, 1, 1, "function", true]);

  // 9. The synth: a gesture starts it; muted, gestures leave it suspended; switched back on, a
  // suspended context (the browser or the OS paused it) resumes on any later gesture.
  await page.evaluate(() => {
    const e = fizlet.createEngine({ pause: { hidden: false, offscreen: false, editable: false } });
    window.__s9 = { e, s: fizlet.sound(e, { cues: {} }) };
    e.start();
  });
  const state = () => page.evaluate(() => window.__made.at(-1)?.state ?? "none");
  const settle = () => page.waitForTimeout(150);
  await page.mouse.click(5, 5);
  await settle();
  const first = await state();
  await page.evaluate(() => (window.__s9.s.on = false));
  await settle();
  const muted = await state();
  await page.mouse.click(5, 5);
  await page.keyboard.press("Shift");
  await settle();
  const mutedGesture = await state();
  await page.evaluate(() => ((window.__s9.s.on = true), window.__made.at(-1).suspend()));
  await settle();
  await page.mouse.click(5, 5);
  await settle();
  const later = await state();
  await page.evaluate(() => window.__made.at(-1).suspend());
  await settle();
  await page.keyboard.press("Shift");
  await settle();
  const later2 = await state();
  const s9dispose = await page.evaluate(async () => {
    const { e, s } = window.__s9;
    s.dispose?.();
    await new Promise((r) => setTimeout(r, 100));
    const r = [window.__made.at(-1).state, e.running];
    e.destroy();
    window.AudioContext = Object.getPrototypeOf(window.AudioContext);
    return r;
  });
  check("9 synth: first gesture, muted, muted+gesture, later gesture, another later gesture", [first, muted, mutedGesture, later, later2], ["running", "suspended", "suspended", "running", "running"]);
  check("9 synth dispose closes its context, engine runs", s9dispose, ["closed", true]);

  where = "embed-hardening";
  const embHard = await page.evaluate(async () => {
    // 10. Closing while the async load is pending: the load must not mount afterwards.
    let release, mounted = 0;
    const gate = new Promise((r) => (release = r));
    const game = fizlet.embed(() => gate.then(() => () => (mounted++, { destroy() {} })), { name: "slow", open: false });
    const p = game.open();
    game.close();
    release();
    await p;
    await new Promise((r) => setTimeout(r, 20));
    const afterClose = [game.opened, mounted, document.querySelectorAll('[data-fizlet-host="slow"]').length];
    // Escape while loading also cancels; a fresh open() afterwards still works.
    let release2;
    const gate2 = new Promise((r) => (release2 = r));
    const g2 = fizlet.embed(() => gate2.then(() => () => (mounted++, { destroy() {} })), { name: "slow2", open: false });
    g2.open();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const reopen = g2.open();
    release2();
    await reopen;
    await new Promise((r) => setTimeout(r, 20));
    const reopened = [g2.opened, mounted, document.querySelectorAll('[data-fizlet-host="slow2"]').length];
    game.destroy();
    g2.destroy();
    return { afterClose, reopened, left: document.querySelectorAll("[data-fizlet-host], [data-slow-ignore], [data-slow2-ignore]").length };
  });
  check("10 close during load: never mounts", embHard.afterClose, [false, 0, 0]);
  check("10 Escape cancels the load; a later open mounts once", embHard.reopened, [true, 1, 1]);
  check("10 destroy leaves nothing", embHard.left, 0);
  assert.deepEqual(fails, [], `hardening checks failed:\n  ${fails.join("\n  ")}`);

  where = "embed";
  const emb = await page.evaluate(async () => {
    let mounted = 0, destroyed = 0, cmd = "";
    const game = fizlet.embed(() => (host) => {
      mounted++;
      cmd = host.style.getPropertyValue("--k-cmd") + "|" + host.style.getPropertyValue("--k-sys");
      return { destroy: () => destroyed++ };
    }, { name: "blitz", palette: { cmd: "#8573ee", sys: "red; background: url(x)" }, easterEgg: { sequence: ["KeyB", "Enter"].map((k) => (k === "KeyB" ? "b" : k)), gesture: false, scope: { sequence: "all" } } });
    const press = (key) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    const dormant = mounted;
    press("b");
    press("Enter");
    await new Promise((r) => setTimeout(r, 50));
    const opened = game.opened;
    const toggle = [...document.querySelectorAll("[data-blitz-ignore]")].some((h) => h.shadowRoot?.querySelector("button"));
    press("Escape");
    const closed = !game.opened && destroyed === 1;
    game.destroy();
    // open: false waits closed behind the toggle key.
    const waiting = fizlet.embed(() => () => ({ destroy() {} }), { name: "wait", open: false });
    const waitKey = [...document.querySelectorAll("[data-wait-ignore]")].some((h) => h.shadowRoot?.querySelector("button")?.textContent.includes("WAIT"));
    const waitClosed = !waiting.opened;
    waiting.destroy();
    return { dormant, mounted, opened, toggle, closed, cmd, waitKey, waitClosed, left: document.querySelectorAll("[data-fizlet-host], [data-blitz-ignore]").length };
  });
  assert.deepEqual(emb, { dormant: 0, mounted: 1, opened: true, toggle: true, closed: true, cmd: "#8573ee|", waitKey: true, waitClosed: true, left: 0 }, "dormant until the sequence, palette hex only, Escape closes, destroy cleans up");

  where = "hud";
  const hd = await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "hud-test";
    box.innerHTML = '<div class="hud"><b data-k>0</b><b data-t>3:00</b><div class="hp"><i><u data-hp role="progressbar"></u></i></div></div><ol class="feed"><li></li><li></li></ol><div class="banner"><b></b><span></span></div>';
    document.body.append(box);
    const snap = () => box.outerHTML;
    const before = snap();
    const e = fizlet.createEngine({ root: box });
    const s = new Float64Array([0, 180, 1]), q = [];
    e.add({ step: (x) => q.splice(0).forEach((t) => x.events.emit(t[0], t[1], t[2])) });
    fizlet.hud(e, box)
      .num("[data-k]", () => s[0])
      .num("[data-t]", [s, 1], "clock")
      .meter("[data-hp]", [s, 2], 0.34)
      .flag(".hp", "low", () => s[2] <= 0.34)
      .feed(".feed", 3, "kill", (a, b) => "T" + a + " ✕ T" + b)
      .banner(".banner", "streak", (a) => [a + " KILL STREAK", "AIRSTRIKE"]);
    e.advance(1 / 60);
    let records = 0;
    const mo = new MutationObserver((l) => (records += l.length));
    mo.observe(box, { subtree: true, attributes: true, characterData: true, childList: true });
    for (let i = 0; i < 120; i++) e.advance(1 / 60);
    const idle = records + mo.takeRecords().length;
    s[0] = 3;
    s[1] = 65.4;
    s[2] = 2 / 6;
    q.push(["kill", 1, 2], ["kill", 3, 4], ["kill", 5, 6], ["kill", 7, 8], ["streak", 3, 0]);
    e.advance(1 / 60);
    const $ = (sel) => box.querySelector(sel);
    const shown = {
      k: $("[data-k]").textContent, t: $("[data-t]").textContent, w: $("[data-hp]").style.width, now: $("[data-hp]").getAttribute("aria-valuenow"),
      low: $(".hp").classList.contains("low"), feed: [...box.querySelectorAll(".feed li")].map((li) => li.textContent),
      banner: $(".banner b").textContent + " / " + $(".banner span").textContent,
    };
    mo.disconnect();
    e.destroy();
    const same = snap() === before;
    box.remove();
    return { idle, shown, same };
  });
  assert.equal(hd.idle, 0, "HUD: 0 mutations over 120 frames where nothing changed (board rule R2)");
  assert.deepEqual(hd.shown, { k: "3", t: "1:05", w: "33%", now: "33", low: true, feed: ["T7 ✕ T8", "T5 ✕ T6", "T3 ✕ T4"], banner: "3 KILL STREAK / AIRSTRIKE" });
  assert.equal(hd.same, true, "HUD: destroy restores the DOM exactly (rows it added go too)");

  assert.deepEqual(errors, []);
  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, input/sound/embed hardening, embed, hud passed.");
  where = "slot";
  // The markup and CSS astro-base-engine renders for `[slot animation]` (engine/astro_base_engine/render.py).
  const fig = (target, label) => `<figure class="ae-slot ae-slot--16x9" data-slot="animation" data-slot-target="${target}" role="img" aria-label="${label}"><p class="ae-slot__placeholder">Animation here: ${label}</p><figcaption class="ae-slot__fallback">Still: ${label}</figcaption></figure>`;
  const SLOT_PAGE = `<!doctype html><meta charset="utf-8"><style>.ae-slot{margin:0;display:grid;place-items:center;border:1px dashed #999;aspect-ratio:16/9;width:400px}</style><body>
${fig("home#hero", "Sparks over the logo")}<div style="height:3000px"></div>${fig("home#below", "A blast below the fold")}
<script>${bundle}</script></body>`;
  const sp = await browser.newPage({ viewport: { width: 800, height: 600 } });
  sp.on("pageerror", (e) => errors.push(e.message));
  await sp.setContent(SLOT_PAGE);
  await sp.evaluate(() => {
    // Attribute order is not a value the page can see; compare with attributes sorted.
    window.snap = () => [...document.body.querySelectorAll("*")].map((n) => n.tagName + [...n.attributes].map((a) => a.name + "=" + a.value).sort().join("|") + "#" + [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join("")).join("\n");
    window.before = snap();
    window.loads = 0;
    // A scene: its own engine on the stage, a canvas that fills it.
    window.scene = (accessible) => () => (loads++, (stage) => {
      const e = fizlet.createEngine({ root: stage }), c = e.ledger.add(document.createElement("canvas"));
      stage.append(c);
      e.add({ render: () => {} });
      e.start();
      return { destroy: () => e.destroy(), accessible };
    });
    window.frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  const lazy = await sp.evaluate(async () => {
    const below = fizlet.slot("home#below", scene(false), { margin: "0px" });
    await frame();
    const idle = { mounted: below.mounted, loads };
    below.el.scrollIntoView();
    await frame();
    await frame();
    const f = below.el, stage = f.querySelector("[data-fizlet-slot]");
    const cs = stage && getComputedStyle(stage);
    const on = {
      mounted: below.mounted, loads, target: stage?.dataset.fizletSlot, contain: cs?.contain, size: [stage?.clientWidth, stage?.clientHeight].join("x"),
      role: f.getAttribute("role"), label: f.getAttribute("aria-label"), hidden: stage?.getAttribute("aria-hidden"),
      placeholder: getComputedStyle(f.querySelector(".ae-slot__placeholder")).display, canvas: !!stage?.querySelector("canvas"),
    };
    below.destroy();
    window.scrollTo(0, 0);
    const missing = fizlet.slot("nope#nothing", scene(false));
    missing.destroy();
    return { idle, on, back: snap() === before, missingEl: missing.el };
  });
  assert.deepEqual(lazy.idle, { mounted: false, loads: 0 }, "nothing loads before the slot nears the viewport");
  assert.deepEqual(lazy.on, { mounted: true, loads: 1, target: "home#below", contain: "strict", size: "400x225", role: "img", label: "A blast below the fold", hidden: "true", placeholder: "none", canvas: true }, "the scene mounts contained, sized to the slot, role=img + aria-label kept");
  assert.equal(lazy.back, true, "destroy gives the slot back exactly");
  assert.equal(lazy.missingEl, null, "an unknown target is inert");

  const a11y = await sp.evaluate(async () => {
    const hero = fizlet.slot(fizlet.findSlot("home#hero"), scene(true));
    await frame();
    await frame();
    const role = hero.el.getAttribute("role"), label = hero.el.getAttribute("aria-label"), hidden = hero.el.querySelector("[data-fizlet-slot]").hasAttribute("aria-hidden");
    hero.destroy();
    return { role, label, hidden, back: snap() === before };
  });
  assert.deepEqual(a11y, { role: null, label: "Sparks over the logo", hidden: false, back: true }, "a scene with real accessible content drops role=img; destroy puts it back");

  await sp.emulateMedia({ reducedMotion: "reduce" });
  const calm = await sp.evaluate(async () => {
    loads = 0;
    const hero = fizlet.slot("home#hero", scene(false));
    await frame();
    await frame();
    const reduced = { mounted: hero.mounted, loads, fallback: getComputedStyle(hero.el.querySelector(".ae-slot__fallback")).display, same: snap() === before };
    window.heroSlot = hero;
    return reduced;
  });
  assert.deepEqual(calm, { mounted: false, loads: 0, fallback: "block", same: true }, "reduced motion: the fallback stays, the scene never loads");
  await sp.emulateMedia({ reducedMotion: "no-preference" });
  const allowed = await sp.evaluate(async () => (await frame(), await frame(), heroSlot.mounted));
  assert.equal(allowed, true, "motion allowed again: the scene mounts");
  await sp.emulateMedia({ reducedMotion: "reduce" });
  const stopped = await sp.evaluate(async () => {
    await frame();
    const r = { mounted: heroSlot.mounted, same: snap() === before };
    heroSlot.destroy();
    return r;
  });
  assert.deepEqual(stopped, { mounted: false, same: true }, "reduced motion turned on mid-scene: the scene goes, the fallback comes back");
  await sp.emulateMedia({ reducedMotion: "no-preference" });
  // Page profile: the load waits for an idle main thread; a first tap skips the wait and reaches the
  // scene as numbers; input wakes a settled engine.
  const pp = await sp.evaluate(async () => {
    const out = {}, ric = window.requestIdleCallback, idleQ = [];
    window.requestIdleCallback = (cb) => idleQ.push(cb);
    let got = "unset";
    const capture = () => (stage, figure, first) => ((got = first), { destroy() {} });
    const hero = fizlet.slot("home#hero", capture);
    await frame();
    await frame();
    out.beforeIdle = { mounted: hero.mounted, queued: idleQ.length };
    idleQ.splice(0).forEach((cb) => cb({ didTimeout: false, timeRemaining: () => 10 }));
    await frame();
    out.afterIdle = { mounted: hero.mounted, first: got };
    hero.destroy();
    const below = fizlet.slot("home#below", capture, { margin: "0px" });
    await frame();
    const r = below.el.getBoundingClientRect();
    below.el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true, clientX: r.left + 30, clientY: r.top + 20 }));
    await frame();
    out.tap = { mounted: below.mounted, idleWaits: idleQ.length, x: Math.round(got?.x), y: Math.round(got?.y), number: typeof got?.at, event: got instanceof Event };
    below.destroy();
    window.requestIdleCallback = ric;
    const e = fizlet.createEngine({ settle: 0.05 });
    fizlet.controls(e, { keys: { go: ["Space"] } });
    e.start();
    for (let i = 0; i < 12 && e.running; i++) await frame();
    out.settled = e.paused.join();
    dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
    out.woke = e.running;
    e.destroy();
    out.same = snap() === before;
    return out;
  });
  assert.deepEqual(pp.beforeIdle, { mounted: false, queued: 1 }, "near the viewport: the load waits for an idle main thread");
  assert.deepEqual(pp.afterIdle, { mounted: true, first: null }, "idle: the scene mounts, with no first tap");
  assert.deepEqual(pp.tap, { mounted: true, idleWaits: 0, x: 30, y: 20, number: "number", event: false }, "a first tap loads at once and reaches the scene as numbers");
  assert.equal(pp.settled, "settled", "nothing busy: the engine settles");
  assert.equal(pp.woke, true, "its own key wakes it");
  assert.equal(pp.same, true);
  await sp.close();

  assert.deepEqual(errors, []);
  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, observers let go on abort, layout guard, input, embed, slot (idle wait, first tap, settle) passed.");
  where = "sprite";
  const spr = await page.evaluate(async () => {
    const { sprites, spriteURL, sherman } = fizlet;
    // Reference: the hull tile exactly as sherman-bytes/src/sprites.ts paints it (copied for the test).
    const original = (color, frame) => {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 32;
      const c = tile.getContext("2d");
      c.fillStyle = "#151020";
      c.fillRect(3, 5, 26, 7);
      c.fillRect(3, 21, 26, 7);
      c.fillStyle = "#8573ee";
      for (let i = 0; i < 6; i++) (c.fillRect(4 + i * 4 + frame, 6, 2, 5), c.fillRect(4 + i * 4 + frame, 22, 2, 5));
      c.fillStyle = color;
      c.fillRect(5, 11, 22, 11);
      c.fillRect(9, 9, 13, 15);
      c.fillRect(25, 13, 4, 7);
      c.fillStyle = "#241a35";
      c.fillRect(7, 12, 4, 9);
      c.fillRect(13, 13, 4, 7);
      c.fillStyle = "#06c4ff";
      c.fillRect(20, 14, 2, 5);
      c.fillRect(18, 16, 6, 1);
      return tile;
    };
    const pixels = (t) => {
      const c = document.createElement("canvas");
      c.width = t.width;
      c.height = t.height;
      const x = c.getContext("2d");
      x.drawImage(t, 0, 0);
      return x.getImageData(0, 0, t.width, t.height).data;
    };
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const sp = sprites(sherman, { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }, { team: "#fff8d4" }] });
    const out = {};
    out.offscreen = sp.tile("hull") instanceof OffscreenCanvas;
    out.identical = [0, 1].every((f) => same(pixels(sp.tile("hull", f)), pixels(original("#39ffb0", f)))) && same(pixels(sp.tile("hull", 0, 1, 1)), pixels(original("#ff5c8f", 0)));
    // Drawn pixels: pivot at (x, y), scale, rotation, palette.
    const cv = document.createElement("canvas");
    cv.width = cv.height = 200;
    const ctx = cv.getContext("2d");
    const at = (x, y) => "#" + [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
    sp.draw(ctx, "hull", 0, 50, 50);
    sp.draw(ctx, sp.ids.hull, 0, 140, 50, 0, 2, 1);
    sp.draw(ctx, "hull", 0, 50, 150, Math.PI);
    sp.draw(ctx, "turret", 0, 140, 150, 0, 1, 2);
    out.drawn = [at(50 - 16 + 20, 50 - 16 + 16), at(50 - 16 + 6, 50 - 16 + 16), at(50 - 16 + 4, 50 - 16 + 6), at(0, 0),
      at(140 - 32 + 41, 50 - 32 + 33), at(140 - 32 + 12, 50 - 32 + 32), at(50 - 5, 150 - 1), at(140 - 7 + 1, 150 - 8 + 8)];
    // The cache is capped.
    const small = sprites(sherman, { cap: 4, palettes: [{}, {}, {}] });
    for (let p = 0; p < 3; p++) for (let s = 1; s <= 3; s++) small.draw(ctx, "hull", 0, 0, 0, 0, s, p);
    out.cap = [small.size, small.baked];
    // An SVG page character: same size, crisp.
    const img = new Image();
    img.src = spriteURL(sherman.hull, 1, sp.palettes, 1);
    await img.decode();
    out.img = [img.naturalWidth, img.naturalHeight];
    return out;
  });
  assert.deepEqual(spr, {
    offscreen: true, identical: true,
    drawn: ["#06c4ff", "#39ffb0", "#8573ee", "#000000", "#06c4ff", "#ff5c8f", "#06c4ff", "#fff8d4"],
    cap: [4, 9], img: [32, 32],
  }, "sprite tiles match the Sherman original, draw places the pivot, the cache stays capped");

  where = "sprite-alloc";
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    const sp = fizlet.sprites(fizlet.sherman, { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }] });
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const ctx = cv.getContext("2d"), a = new Float64Array(1);
    window.drawLoop = (n) => {
      for (let k = 0; k < n; k++) {
        for (let i = 0; i < 32; i++) sp.draw(ctx, i & 1, (i >> 1) & 1, i * 7.5, 40.25, a[0] + i, 1 + ((i >> 2) & 1), (i >> 3) & 1);
        a[0] += 0.01;
      }
    };
    window.drawLoop(2000); // bake and warm up
  });
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.startSampling", { samplingInterval: 64, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
  await page.evaluate(() => window.drawLoop(5000)); // 160k draws
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const inDraw = (n, under) => {
    const here = under || /(^|\.)(draw|tile|drawLoop)$/.test(n.callFrame.functionName);
    return (here ? n.selfSize : 0) + n.children.reduce((s, c) => s + inDraw(c, here), 0);
  };
  const bytes = inDraw(profile.head, false);
  assert.ok(bytes < 16384, `JS heap allocated by 160k sprite draws: ${bytes} bytes (sampled)`);

  assert.deepEqual(errors, []);
  console.log(`Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, embed, sprite (draw loop: ${bytes} bytes sampled) passed.`);
  where = "pad";
  await padTest();

  assert.deepEqual(errors, []);
  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, embed, pad passed.");
  {
  where = "ui-mount";
  const ui = await page.evaluate(() => {
    // Two games composed independently on one page, each with its own kit CSS.
    const a = document.createElement("div"), b = document.createElement("div"), c = document.createElement("div");
    document.body.append(a, b, c);
    const ra = fizlet.mount(a, ".bui { --probe: one; }"), rb = fizlet.mount(b, ".bui { --probe: two; }"), rc = fizlet.mount(c, ".bui { --probe: one; }");
    const probe = (r) => getComputedStyle(r).getPropertyValue("--probe").trim();
    const out = {
      a: probe(ra), b: probe(rb), c: probe(rc),
      shared: a.shadowRoot.adoptedStyleSheets[0] === c.shadowRoot.adoptedStyleSheets[0],
      own: a.shadowRoot.adoptedStyleSheets[0] !== b.shadowRoot.adoptedStyleSheets[0],
      sheets: [a, b, c].map((h) => h.shadowRoot.adoptedStyleSheets.length).join(),
      leak: [...document.styleSheets].length + document.adoptedStyleSheets.length,
    };
    a.remove(), b.remove(), c.remove();
    return out;
  });
  assert.deepEqual(ui, { a: "one", b: "two", c: "one", shared: true, own: true, sheets: "1,1,1", leak: 0 }, "each CSS text gets its own shared sheet; nothing reaches the page");

  assert.deepEqual(errors, []);
  where = "ui-readouts";
  const kitCss = readFileSync("src/ui/board-ui.css", "utf8");
  const ro = await page.evaluate((css) => {
    const h = document.createElement("div");
    document.body.append(h);
    const root = fizlet.mount(h, css);
    const { group, values } = fizlet.readouts(root, [["Score", "team"], ["Hostile", "enemy"], ["Time"]], true);
    values[0].textContent = "12";
    const probe = (v) => { const i = root.appendChild(document.createElement("i")); i.style.color = `var(${v})`; const c = getComputedStyle(i).color; i.remove(); return c; };
    const cs = (e) => getComputedStyle(e);
    const out = {
      n: values.length, cls: group.className, text: group.children[0].textContent,
      label: cs(group.children[0]).fontSize, value: cs(values[0]).fontSize, upper: cs(group.children[0]).textTransform,
      team: cs(values[0]).color === probe("--team-ink"), enemy: cs(values[1]).color === probe("--team-b"), plain: cs(values[2]).color === probe("--ink"),
      flat: cs(group).boxShadow, nums: cs(values[0]).fontVariantNumeric,
    };
    h.remove();
    return out;
  }, kitCss);
  assert.deepEqual(ro, { n: 3, cls: "bui-readouts bui-on-map", text: "Score12", label: "8px", value: "20px", upper: "uppercase", team: true, enemy: true, plain: true, flat: "none", nums: "tabular-nums" }, "readouts: Battlefield's metrics, toned by the palette, flat");

  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, embed, ui mount, readouts passed.");
  }
  where = "match";
  await page.addStyleTag({ content: readFileSync("src/ui/board-ui.css", "utf8") });
  const mt = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (ok, ms = 3000) => {
      for (const t0 = performance.now(); !ok() && performance.now() - t0 < ms; ) await wait(20);
      return ok();
    };
    const key = (code, target = window) => target.dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true, cancelable: true }));
    const board = document.createElement("div");
    board.className = "bui";
    board.setAttribute("style", "position: relative; width: 640px; height: 400px");
    board.innerHTML = '<canvas width="640" height="400"></canvas><button type="button" id="game-key">FIRE</button>';
    document.body.prepend(board);
    const snap = () => document.body.outerHTML;
    const before = snap();
    const e = fizlet.createEngine({ root: board });
    const events = [], ends = [];
    e.add({ render: (x) => { for (let i = 0; i < x.events.size; i++) x.events.at(i).type.startsWith("match:") && events.push(x.events.at(i).type); } });
    const m = fizlet.match(e, board, { count: 1, seconds: 60, launch: fizlet.launch, end: (r) => void ends.push(r.why) });
    e.start();
    const ov = m.el, gameKey = document.getElementById("game-key");
    const shown = () => [...ov.querySelectorAll("[data-k]")].filter((k) => getComputedStyle(k).display !== "none").map((k) => k.textContent);
    const view = () => ({ phase: m.phase, open: !ov.hidden && getComputedStyle(ov).display !== "none", words: ov.querySelector(".bui-sticker").textContent, keys: shown(), focus: document.activeElement === ov ? "dialog" : document.activeElement?.textContent ?? "", inert: gameKey.inert });
    const out = {};
    out.intro = view();
    ov.querySelector("[data-k=start]").click();
    out.count = view();
    out.played = await until(() => m.phase === "play");
    out.play = view();
    gameKey.focus();
    key("Escape");
    out.paused = { ...view(), running: e.running };
    key("KeyP");
    out.resumed = { ...view(), running: e.running };
    // Keys typed into the page's own field never pause.
    key("KeyP", document.getElementById("field"));
    out.typed = m.phase;
    // A hidden tab during play shows the pause overlay; coming back keeps it up until the player chooses.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.hidden = m.phase;
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.back = { phase: m.phase, open: !ov.hidden };
    // Surrender: the white flag, then the launch burst on <body>, then the result.
    const flag = ov.querySelector("[data-k=surrender]");
    flag.click();
    out.go = flag.classList.contains("go");
    key("Escape");
    out.noResume = m.phase;
    out.burst = await until(() => document.querySelector(".bui-burst"));
    out.ended = await until(() => m.phase === "end");
    out.end = view();
    // Rematch → count → play; reduced motion: the surrender ends at once (no wave wait, no burst).
    ov.querySelector("[data-k=again]").click();
    await until(() => m.phase === "play");
    window.mt = { m, e, ov, out, events, ends, before, snap, board, key, wait };
    return out;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  Object.assign(mt, await page.evaluate(async () => {
    const { m, e, ov, out, events, ends, before, snap, board, key, wait } = window.mt;
    delete window.mt;
    key("Escape");
    ov.querySelector("[data-k=surrender]").click();
    await wait(30);
    out.reducedEnd = m.phase;
    out.ends = ends;
    ov.querySelector("[data-k=next]").click();
    out.back2intro = m.phase;
    e.advance(0);
    out.events = events;
    await wait(900); // let the first burst finish
    e.destroy();
    out.same = snap() === before;
    board.remove();
    return out;
  }));
  await page.emulateMedia({ reducedMotion: null });
  assert.deepEqual(mt.intro, { phase: "intro", open: true, words: "PLAYER 1READY?", keys: ["PRESS START"], focus: "PRESS START", inert: true }, "intro: sticker, one key, focus on it, the board behind is inert");
  assert.deepEqual(mt.count, { phase: "count", open: true, words: "GET READY1", keys: [], focus: "dialog", inert: true });
  assert.ok(mt.played, "the countdown ends in play");
  assert.deepEqual({ ...mt.play, focus: undefined }, { phase: "play", open: false, words: "GET READY1", keys: [], focus: undefined, inert: false });
  assert.deepEqual(mt.paused, { phase: "paused", open: true, words: "BATTLE PAUSEDGIVE UP?", keys: ["KEEP FIGHTING", "SURRENDER"], focus: "KEEP FIGHTING", inert: true, running: false }, "Escape pauses: the surrender question, focus on KEEP FIGHTING, engine stopped");
  assert.deepEqual(mt.resumed, { phase: "play", open: false, words: "BATTLE PAUSEDGIVE UP?", keys: [], focus: "FIRE", inert: false, running: true }, "P resumes and focus goes back");
  assert.equal(mt.typed, "play");
  assert.equal(mt.hidden, "paused", "a hidden tab pauses with the overlay");
  assert.deepEqual(mt.back, { phase: "paused", open: true });
  assert.equal(mt.go, true, "the white flag waves");
  assert.equal(mt.noResume, "paused", "no resume once the flag is up");
  assert.ok(mt.burst, "the launch burst lives on <body>");
  assert.ok(mt.ended);
  assert.deepEqual(mt.end, { phase: "end", open: true, words: "WHITE FLAGGAME OVER", keys: ["REMATCH", "NEW GAME"], focus: "REMATCH", inert: true });
  assert.equal(mt.reducedEnd, "end", "reduced motion: surrender ends without the wait");
  assert.deepEqual(mt.ends, ["flag", "flag"]);
  assert.equal(mt.back2intro, "intro");
  assert.deepEqual(mt.events.slice(0, 7), ["match:count", "match:play", "match:paused", "match:play", "match:paused", "match:flag", "match:lost"]);
  assert.equal(mt.same, true, "destroy (Recall) restores the exact DOM: overlay gone, inert and focus marks undone");

  assert.deepEqual(errors, []);
  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, embed, match passed.");

  {
  where = "board-page";
  const bp = await browser.newPage({ viewport: { width: 800, height: 600 } });
  bp.on("pageerror", (e) => errors.push(e.message));
  await bp.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;font:20px/1.2 monospace}h1,p{margin:0 0 10px}</style><body>
<h1 id="h">Hello world</h1>
<p id="p">Eat <b>these</b> 42 words, <a href="#">not links</a>.</p>
<p data-fizlet-ignore>ignored text</p>
<p class="skip">excluded text</p>
<p style="display:none">hidden text</p>
<p><input id="field" value="field text"> <code>code text</code></p>
<div id="game"><p>game text</p><button>host key</button></div>
<button id="go">Go</button> <input type="button" value="nope">
<div style="height:2000px"></div><p id="below">far below</p>
<script>${bundle}</script></body>`);
  const board = await bp.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const snap = () => document.documentElement.outerHTML;
    const before = snap();
    const e = fizlet.createEngine({ root: document.getElementById("game") });
    const b = fizlet.boardPage(e, { exclude: ".skip", color: "#f4457a" });
    b.refresh();
    const out = {};
    // Indexed: only letters and digits of eligible text (no links, fields, code, ignored, excluded, host).
    out.count = b.glyphs.count;
    const G = b.glyphs, idx = new Int32Array(64);
    const box = (node, i) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); return r.getBoundingClientRect(); };
    const H = document.getElementById("h").firstChild;
    const onScreen = [...Array(G.count).keys()].filter((i) => G.w[i] > 0).length;
    out.onScreen = onScreen;
    // near: a point on the "w" of "world" finds exactly that glyph.
    const rw = box(H, 6);
    const k = b.near(rw.left + rw.width / 2, rw.top + rw.height / 2, 1, idx);
    out.near = k === 1 && Math.abs(G.x[idx[0]] - rw.left) < 0.5 && Math.abs(G.y[idx[0]] - rw.top) < 0.5;
    // hit: a shot from the left along the heading meets "H" first; from the right, "d".
    const rh = box(H, 0), rd = box(H, 10), mid = rh.top + rh.height / 2;
    const first = b.hit(-50, mid, 790, mid), t = b.t, last = b.hit(790, mid, -50, mid);
    out.hit = Math.abs(G.x[first] - rh.left) < 0.5 && Math.abs(G.x[last] - rd.left) < 0.5 && t > 0 && t < 0.1;
    out.miss = b.hit(-50, 590, 790, 590);
    // The hot-path forms read typed arrays (no number boxes) and agree with near / hit.
    const seg = new Float64Array([0, -50, mid, 790, mid, 0]), cp = new Float64Array([0, rw.left + rw.width / 2, rw.top + rw.height / 2, 1]), idx2 = new Int32Array(64);
    out.hitAt = b.hitAt(seg, 1) === first && Math.abs(seg[5] - t) < 1e-9;
    out.nearAt = b.nearAt(cp, 1, idx2) === 1 && idx2[0] === idx[0];
    // Targets: the page's button only (not the host's, not a field).
    out.targets = b.targets.map((t) => [t.el.id, t.w > 0, t.hp]);
    // consume from a step is queued, written in render through the ledger, into the same Text node.
    fizlet.guardLayout(e);
    const P = document.getElementById("p").firstChild;
    const rp = box(P, 0), pmid = rp.top + rp.height / 2;
    let picked = -1, again = true;
    e.add({ step() {
      if (picked >= 0) return;
      picked = b.hit(-50, pmid, 790, pmid);
      b.consume(picked);
      again = b.consume(picked);
      b.near(400, 300, 300, idx);
    } });
    e.advance(1 / 60 + 1e-6);
    out.consumed = [P.data, again, G.spent[picked], document.getElementById("p").firstChild === P];
    // Erase writes a no-break space; outside a step it writes at once.
    b.consume(b.hit(-50, pmid, 790, pmid), "erase");
    out.erased = P.data;
    out.highlight = CSS.highlights.size === 1;
    // Steps never read layout, even across refreshes and rescans.
    for (let i = 0; i < 40; i++) e.advance(1 / 60);
    out.violations = e.violations;
    // A rescan sees new text; geometry of spent glyphs stays out of near/hit.
    const np = document.createElement("p");
    np.textContent = "new";
    document.getElementById("h").after(np);
    await tick();
    for (let i = 0; i < 40; i++) e.advance(1 / 60);
    out.rescanned = b.glyphs.count - out.count;
    out.spentKept = [...b.glyphs.spent].filter(Boolean).length;
    np.remove();
    await tick();
    // The host edits a text we changed: it wins, our next write is refused, Recall leaves it.
    b.near(rw.left + rw.width / 2, rw.top + rw.height / 2, 1, idx);
    b.consume(idx[0]);
    const headingAfter = H.data;
    H.data = "Host wins";
    b.near(rh.left + 2, rh.top + 4, 1, idx);
    out.refused = b.consume(idx[0]);
    e.destroy();
    out.headingAfter = headingAfter;
    out.hostKept = H.data;
    H.data = "Hello world";
    out.restored = snap() === before;
    out.highlightGone = CSS.highlights.size === 0;
    // Range-read cap: 5 per refresh, the rest picked up by the next refreshes.
    const e2 = fizlet.createEngine(), b2 = fizlet.boardPage(e2, { reads: 5 });
    b2.refresh();
    const reads = [b2.reads];
    let measured = 0;
    for (let i = 0; i < 60; i++) (e2.advance(1 / 60), reads.push(b2.reads));
    for (let i = 0; i < b2.glyphs.count; i++) if (b2.glyphs.w[i] > 0) measured++;
    out.cap = Math.max(...reads) <= 5;
    const ref = fizlet.boardPage(e2);
    ref.refresh();
    let all = 0;
    for (let i = 0; i < ref.glyphs.count; i++) if (ref.glyphs.w[i] > 0) all++;
    out.capCovers = measured === all && all > 30 && ref.reads === all;
    // maxGlyphs caps the index.
    const b3 = fizlet.boardPage(e2, { maxGlyphs: 7, maxTargets: 0 });
    b3.refresh();
    out.maxGlyphs = [b3.glyphs.count, b3.targets.length];
    // Scrolling re-measures at the dirty rate: the paragraph far below comes on screen.
    const far = () => { let n = 0; for (let i = 0; i < ref.glyphs.count; i++) if (ref.glyphs.w[i] > 0 && ref.glyphs.y[i] > 300) n++; return n; };
    const farBefore = far();
    const scrolled = new Promise((r) => addEventListener("scroll", r, { once: true }));
    scrollTo(0, 1800);
    await scrolled;
    for (let i = 0; i < 10; i++) e2.advance(1 / 60);
    out.scroll = [farBefore, far()];
    scrollTo(0, 0);
    await tick();
    for (let i = 0; i < 10; i++) e2.advance(1 / 60);
    // A write queued in a read survives a rescan in the same frame (indices renumber, slots don't).
    let fired = 0;
    e2.add({ read() {
      if (fired++) return;
      ref.near(rh.left + 2, rh.top + 4, 1, q2);
      ref.consume(q2[0]);
      ref.refresh();
    } });
    const q2 = new Int32Array(4);
    e2.advance(0);
    out.queuedSurvives = /^[01]ello world$/.test(H.data);
    e2.destroy();
    out.restored2 = snap() === before;
    return out;
  });
  // Eligible: "Hello world" 10, "Eat these 42 words" 15, "far below" 8 (off screen) and "hidden text"
  // 10 (display: none): indexed, but only what is on screen gets geometry.
  assert.equal(board.count, 43, "glyph index: letters and digits of eligible text only");
  assert.equal(board.onScreen, 25, "off-screen glyphs are indexed but have no geometry");
  assert.equal(board.near, true, "near finds the glyph under the point");
  assert.equal(board.hit, true, "hit returns the first glyph along the segment");
  assert.equal(board.miss, -1);
  assert.equal(board.hitAt, true, "hitAt reads the segment from a typed array and agrees with hit (t in p[i + 4])");
  assert.equal(board.nearAt, true, "nearAt reads the circle from a typed array and agrees with near");
  assert.deepEqual(board.targets, [["go", true, 100]], "targets: the page's button only");
  assert.match(board.consumed[0], /^[01]at $/, "consume writes a literal 0/1 into the same Text node");
  assert.deepEqual(board.consumed.slice(1), [false, 1, true]);
  assert.equal(board.erased, board.consumed[0][0] + "\u00a0t ", "erase writes a no-break space");
  assert.equal(board.highlight, true);
  assert.equal(board.violations, 0, "no layout reads in the step");
  assert.equal(board.rescanned, 3, "a rescan indexes new text");
  assert.equal(board.spentKept, 2, "spent glyphs survive a rescan");
  assert.match(board.headingAfter, /^Hello [01]orld$/);
  assert.equal(board.refused, false, "a host-edited node is no longer ours");
  assert.equal(board.hostKept, "Host wins", "Recall never restores over a newer host edit");
  assert.equal(board.restored, true, "destroy gives the page back byte for byte");
  assert.equal(board.highlightGone, true);
  assert.equal(board.cap, true, "Range reads per refresh never pass the cap");
  assert.equal(board.capCovers, true, "capped refreshes still cover every on-screen glyph");
  assert.deepEqual(board.maxGlyphs, [7, 0]);
  assert.deepEqual(board.scroll, [0, 8], "scrolling re-measures: far text comes on screen");
  assert.equal(board.queuedSurvives, true, "a queued write survives a rescan");
  assert.equal(board.restored2, true);

  where = "board-page allocation";
  // Steady state: frames between refreshes (no time passes) plus near / hit / step. The sampling heap
  // profiler counts objects the young GC already swept (the heap size alone hides them). One object
  // a frame shows as ~16+ bytes a frame; the board's frames show ~0.
  await bp.evaluate(() => {
    const e = fizlet.createEngine(), b = fizlet.boardPage(e), q = new Int32Array(64);
    b.refresh();
    window.__bp = { e, run(n) { for (let i = 0; i < n; i++) (e.advance(0), b.near(100, 20, 40, q), b.hit(0, 20, 800, 20)); } };
    __bp.run(50000);
  });
  const cdp = await bp.context().newCDPSession(bp);
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.startSampling", { samplingInterval: 128, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
  await bp.evaluate(() => __bp.run(400000));
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const perFrame = profile.samples.reduce((s, x) => s + x.size, 0) / 400000;
  assert.ok(perFrame < 2, `steady-state frames allocate nothing (${perFrame.toFixed(2)} bytes a frame)`);
  assert.equal(await bp.evaluate(() => (__bp.e.destroy(), delete window.__bp, document.querySelectorAll("style").length)), 1, "Recall");
  await bp.close();

  assert.deepEqual(errors, []);
  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, embed, board-page passed.");
  }

  where = "perf";
  await perfTest();
  console.log("Browser: perf overlay (off by default, Settings switch + key in step, chart moves, settles with the engine, Recall exact) passed.");

  where = "containment";
  await containTest();
  console.log("Browser: CSS containment on every owned root (mount, pad, match overlay, launch burst; slot stage strict), nothing moves, Recall exact passed.");
} catch (e) {
  console.error(`::error title=Fizlet browser test (${where})::${e.message}`);
  throw e;
} finally {
  await browser.close();
}
