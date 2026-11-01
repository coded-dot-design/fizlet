// The genre minis (gallery #071–#086) in Chromium, each in its real gallery card markup and CSS
// (Board UI + site.css + its own stage sheet), mounted through @fzlt/core/slot as the gallery does.
// On every stage a mini can have on the site (the four side-on minis lay themselves out per stage
// class, site/gallery/aspect.ts: wide on a desktop or a phone held sideways, square on a phone held
// upright, and tall, forced; the others are 16:9 everywhere), at 1440, 390 and 360:
//   - the controls (every visible key; a full-stage, see-through tap target is the stage, not a key)
//     cover at most 20% of the stage, and each is 44 px or more on touch widths;
//   - no control overlaps the play: for the side-on minis, everything drawn above the floor line
//     (bike, ghost, slots, bag, gloves, fighters) in the canvas's own art box; for Freeze Plan, its
//     tanks and flag, where the plan is made (time frozen);
//   - a scripted play (a few key presses and taps) changes the game's state.
// Once per mini: it settles to no frames after play; under reduced motion it never mounts (the
// poster stays, no frames); Recall gives the page back byte for byte. Run after `npm run build`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { entries } from "../scripts/gallery.mjs";
import { entryFigure, shapeKey } from "../site/pages/gallery.mjs";

// Gallery #071–#086. `floor`: the art's lowest line of play (art units, 160 × 90), for the side-on minis.
const all = entries();
const MINIS = all.filter((e) => e.no >= 71 && e.no <= 86).sort((a, b) => a.no - b.no);
assert.equal(MINIS.length, 16, "sixteen genre minis");
const FLOOR = { redline: 66, "dirt-lab": 76, "bag-beat": 71, "toast-tell": 70 };
// The art's header and HUD band (a share of the art box from its top): Redline's heat gauge, Dirt Lab's
// prompt, the ring's timer and pips, Freeze Plan's orders and legs.
const HUD = { redline: 16 / 90, "dirt-lab": 16 / 90, "bag-beat": 16 / 90, "toast-tell": 16 / 90, "freeze-plan-radio-platoon": 20 / 108 };
for (const id of Object.keys(FLOOR)) assert.ok(MINIS.find((e) => e.id === id)?.phone, `${id}: lays itself out per stage class (phone shape)`);

const fnOf = (e) => "m" + e.no;
const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts";\n' + MINIS.map((e) => `export { ${e.export} as ${fnOf(e)} } from "./site/gallery/${e.module}";`).join("\n"),
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "mc", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
// The card's stage at the gallery's own widths (628 px on a desktop, the phone's width less the card's gutters).
const page = (e) => `<!doctype html><html class="bui" data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style><body style="margin:0">
<main id="page" style="width:min(628px, calc(100vw - 68px));margin:24px auto"><div class="gal-stage">${entryFigure(e, {})}${e.phone ? shapeKey(e) : ""}</div><p>Copy after it.</p></main>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const ctxs = new Map();
const ctxFor = async (w, h, touch, rm = false) => {
  const k = `${w}x${h}${touch}${rm}`;
  if (!ctxs.has(k)) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, reducedMotion: rm ? "reduce" : "no-preference" });
    await c.route("http://minis.test/**", (r) => r.fulfill({ contentType: "text/html", body: page(MINIS.find((e) => e.id === r.request().url().split("/")[3])) }));
    ctxs.set(k, c);
  }
  return ctxs.get(k);
};
const RATIO = { wide: "16 / 9", square: "1 / 1", tall: "3 / 4" };
const klass = (w, h) => (w > h * 1.4 ? "wide" : w >= h * 0.8 ? "square" : "tall");

/** Open a mini's card; `force` pins the figure's aspect (a class the screen alone would not give). */
async function open(e, w, h, touch, force) {
  const p = await (await ctxFor(w, h, touch)).newPage();
  const errs = [];
  p.on("pageerror", (x) => errs.push(x.message));
  await p.goto(`http://minis.test/${e.id}/`);
  // Live, as the gallery marks it (gallery.ts): TAP TO PLAY shows.
  await p.evaluate(() => (document.querySelector("figure").dataset.live = "1"));
  if (force) await p.evaluate((r) => document.querySelector("figure").style.setProperty("aspect-ratio", r, "important"), RATIO[force]);
  await p.evaluate((fn) => {
    window.before = document.body.cloneNode(true);
    window.hero = mc.slot(document.querySelector("figure"), () => (stage, el, first) => (window.scene = mc[fn](stage, el, first)), { idle: 0 });
  }, fnOf(e));
  await p.waitForFunction(() => window.scene);
  await p.waitForFunction(() => scene.engine.stats().frames >= 2, null, { timeout: 15000 });
  return { p, errs };
}

/** The stage, its visible controls (a see-through key over the whole stage is the stage itself) and the play's boxes. */
const measure = (p, floor, id) =>
  p.evaluate(({ floor, id, hud }) => {
    const st = document.querySelector("[data-fizlet-slot]"), s = st.getBoundingClientRect();
    const keys = [...st.querySelectorAll("button")].map((b) => ({ b, r: b.getBoundingClientRect(), cs: getComputedStyle(b) }))
      .filter(({ r, cs }) => r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !(r.width * r.height > 0.8 * s.width * s.height && cs.backgroundColor === "rgba(0, 0, 0, 0)"))
      .map(({ b, r }) => ({ name: b.getAttribute("aria-label") || b.textContent, x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }));
    // The union of the keys' boxes, on a 1 px grid over the stage.
    const W = Math.ceil(s.width), H = Math.ceil(s.height), grid = new Uint8Array(W * H);
    for (const k of keys) for (let y = Math.max(0, Math.floor(k.y)); y < Math.min(H, Math.ceil(k.y + k.h)); y++) grid.fill(1, Math.max(0, Math.floor(k.x)) + y * W, Math.min(W, Math.ceil(k.x + k.w)) + y * W);
    let area = 0;
    for (let i = 0; i < grid.length; i++) area += grid[i];
    const play = [];
    const cv = st.querySelector("canvas"), c = cv && cv.getBoundingClientRect();
    // The art box as the kits draw it: the canvas's own width, 9 / 16 of it down (160 × 90 units).
    const art = c && id in hud && { x: c.left - s.left, y: c.top - s.top, w: c.width, h: c.width * (floor ? 9 / 16 : 108 / 192), ch: c.height };
    // TAP TO PLAY (the live figure's ::after), in stage space.
    const fig = st.closest("figure"), f = fig.getBoundingClientRect(), a = getComputedStyle(fig, "::after");
    const tap = a.content === '"TAP TO PLAY"' && a.display !== "none"
      ? { name: "TAP TO PLAY", x: f.left - s.left + parseFloat(a.left), y: f.top - s.top + parseFloat(a.top), w: parseFloat(a.width), h: parseFloat(a.height) }
      : null;
    if (floor && c) {
      // The art box (160 × 90 units): everything above the floor line is play.
      play.push({ name: "play above the floor", x: art.x, y: art.y, w: art.w, h: (floor / 90) * art.h });
    } else if (id === "freeze-plan-radio-platoon" && c) {
      // The board (192 × 108 units): the six tanks (alive) and the HQ flag.
      const u = c.width / 192;
      for (let i = 0; i < 6; i++) if (scene.HP[i] > 0) play.push({ name: `tank ${i}`, x: c.left - s.left + (scene.X[i] - 8) * u, y: c.top - s.top + (scene.Y[i] - 8) * u, w: 16 * u, h: 16 * u });
      play.push({ name: "flag", x: c.left - s.left + 172 * u, y: c.top - s.top + 44 * u, w: 16 * u, h: 20 * u });
    }
    return { id, w: s.width, h: s.height, keys, area, play, art, tap };
  }, { floor, id, hud: HUD });
const hit = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

function check(m, at, touch, keyed) {
  if (keyed) assert.ok(m.keys.length >= 1, `${at}: has its keys`);
  const share = m.area / (m.w * m.h);
  assert.ok(share <= 0.2, `${at}: the controls cover ${(share * 100).toFixed(1)}% of the stage (at most 20%)`);
  if (touch) for (const k of m.keys) assert.ok(k.w >= 43.5 && k.h >= 43.5, `${at}: ${k.name} is 44 px or more on touch (${k.w.toFixed(1)} × ${k.h.toFixed(1)})`);
  for (const k of m.keys) for (const a of m.play) assert.ok(!hit(k, a), `${at}: ${k.name} never covers ${a.name}`);
  placed(m, at);
  return share;
}
/** The art box and TAP TO PLAY: where the stage sheet puts them. */
function placed(m, at) {
  const r = m.art;
  if (r) {
    // The art box: drawn whole (the canvas is the art's own shape), inside the stage, centred across it.
    const px = (n) => n.toFixed(1);
    assert.ok(Math.abs(r.ch - r.h) <= 2, `${at}: the canvas is the art's shape (${px(r.w)} × ${px(r.ch)}, the art ${px(r.w)} × ${px(r.h)})`);
    // (2 px: a wide figure's stage is a px or two short of 16:9 once its border is off.)
    const inside = (a) => a.x >= -2 && a.y >= -2 && a.x + a.w <= m.w + 2 && a.y + a.h <= m.h + 2;
    assert.ok(inside(r), `${at}: the art box is inside the stage (${px(r.x)}, ${px(r.y)}, ${px(r.w)} × ${px(r.h)} in ${px(m.w)} × ${px(m.h)})`);
    const gap = Math.abs(r.x - (m.w - r.x - r.w));
    assert.ok(gap <= 2, `${at}: the art box is centred across the stage (left ${px(r.x)}, right ${px(m.w - r.x - r.w)})`);
    for (const a of m.play) assert.ok(inside(a), `${at}: ${a.name} is inside the stage, not clipped`);
    // TAP TO PLAY never covers the game's header and HUD (the art's top band: scores, gauges, prompts).
    const hud = { name: "the header and HUD", x: r.x, y: r.y, w: r.w, h: r.h * HUD[m.id] };
    if (m.tap) assert.ok(!hit(m.tap, hud), `${at}: TAP TO PLAY never covers ${hud.name} (${px(m.tap.x)}, ${px(m.tap.y)} vs the art's top ${px(hud.y + hud.h)})`);
  }
}

/** The game's own numbers: a scene's state, its sim's, or its own state array. */
const state = (p) => p.evaluate(() => JSON.stringify(scene.state ?? [...(scene.sim?.S ?? scene.S ?? [])]));
const tapAt = async (p, touch, fx, fy) => {
  const b = await p.locator("[data-fizlet-slot]").boundingBox();
  if (touch) await p.touchscreen.tap(b.x + b.width * fx, b.y + b.height * fy);
  else await p.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
};
const press = (p, id) => p.locator(`[data-fizlet-slot] button[data-id="${id}"]`).click();
// Each mini's scripted play: real keys, taps and key presses; the check is what the game says.
const PLAY = {
  redline: async (p, touch) => {
    const k = p.locator('[data-fizlet-slot] button[data-id="7"]'), b = await k.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(400);
    const s = await p.evaluate(() => ({ mode: scene.sim.S[0], gas: scene.sim.S[5], x: scene.sim.S[2] }));
    await p.mouse.up();
    assert.deepEqual([s.mode, s.gas], [1, 1], "redline: holding GAS races");
    // The stage is the big button: a press anywhere holds the gas too.
    const st = await p.locator("[data-fizlet-slot]").boundingBox();
    await p.mouse.move(st.x + st.width * 0.5, st.y + st.height * 0.3);
    await p.mouse.down();
    const g = await p.evaluate(() => scene.sim.S[5]);
    await p.mouse.up();
    assert.equal(g, 1, "redline: a press on the stage is gas");
    assert.equal(await p.evaluate(() => scene.sim.S[5]), 0, "redline: letting go of the stage lets off the gas");
  },
  "dirt-lab": async (p) => {
    await press(p, 3); // GAP
    assert.equal(await p.evaluate(() => scene.sim.S[13]), 3, "dirt-lab: the palette picks GAP");
    assert.equal(await p.locator('[data-fizlet-slot] button[data-id="3"]').getAttribute("aria-pressed"), "true", "dirt-lab: GAP shows picked");
    // Tap the fourth slot on the track (art x 16 + 3.5 × 16, y 50): the gap goes there.
    const c = await p.locator("[data-fizlet-slot] canvas").boundingBox();
    await p.mouse.click(c.x + (72 / 160) * c.width, c.y + (50 / 90) * c.height);
    assert.equal(await p.evaluate(() => scene.sim.track[3]), 3, "dirt-lab: a tap on a slot drops the piece");
    await press(p, 4); // RACE
    assert.equal(await p.evaluate(() => scene.sim.S[0]), 1, "dirt-lab: RACE races");
    assert.equal(await p.locator('[data-fizlet-slot] button[data-id="7"]').isVisible(), true, "dirt-lab: racing shows GAS");
  },
  "bag-beat": async (p, touch) => {
    const a = await p.evaluate(() => scene.sim.S[7] + scene.sim.S[8]);
    await press(p, 1);
    await p.waitForTimeout(700);
    await tapAt(p, touch, 0.5, 0.35);
    await p.waitForTimeout(700);
    await p.focus("[data-fizlet-slot]");
    await p.keyboard.press("Space");
    const s = await p.evaluate(() => ({ mode: scene.sim.S[0], bot: scene.sim.S[14], tries: scene.sim.S[7] + scene.sim.S[8] }));
    assert.deepEqual([s.mode, s.bot], [1, 0], "bag-beat: PUNCH starts a round of your own");
    assert.ok(s.tries > a || s.tries >= 1, "bag-beat: punches land (hits or clunks)");
  },
  "toast-tell": async (p, touch) => {
    await press(p, 3);
    const s = await p.evaluate(() => ({ mode: scene.sim.S[0], bot: scene.sim.S[11] }));
    assert.deepEqual(s, { mode: 1, bot: 0 }, "toast-tell: PUNCH starts your bout");
    await press(p, 2);
    await p.waitForTimeout(500);
    await tapAt(p, touch, 0.5, 0.3);
    assert.equal(await p.evaluate(() => scene.sim.S[0]), 1, "toast-tell: still fighting after DUCK and a tap");
  },
  "freeze-plan-radio-platoon": async (p) => {
    await p.locator(".fpr-go").click();
    await p.waitForFunction(() => scene.S[0] === 1, null, { timeout: 5000 });
  },
};
// The rest: a tap on the stage and the keys they name in their labels (Space, arrows); the game's numbers move.
const generic = async (p, touch) => {
  const a = await state(p);
  await tapAt(p, touch, 0.5, 0.5);
  await p.focus("[data-fizlet-slot]");
  for (const k of ["Space", "ArrowUp", "ArrowRight", "Space"]) await p.keyboard.press(k), await p.waitForTimeout(120);
  await p.keyboard.down("Space");
  await p.waitForTimeout(500);
  await p.keyboard.up("Space");
  assert.notEqual(await state(p), a, "taps and keys change the game's state");
};

const settled = async (p, at) => {
  await p.evaluate(() => {
    scene.engine.stop();
    for (let i = 0; i < 60 * 40 && !scene.engine.paused.includes("settled"); i++) scene.engine.advance(1 / 60);
    scene.engine.start();
  });
  await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 30000 });
  const n = await p.evaluate(async () => {
    const a = scene.engine.stats().frames;
    for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
    return scene.engine.stats().frames - a;
  });
  assert.equal(n, 0, `${at}: settles to no frames after play`);
};
// Recall: the page's DOM equal to the one before the mount, node for node (the slot puts the figure's
// role back last, so the attribute order can differ; the attributes and values are the same).
const recall = (p) => p.evaluate(() => (hero.destroy(), { same: document.body.isEqualNode(window.before), running: scene.engine.running }));

// The screens: a desktop; phones held upright (their natural stage) and sideways (a wide stage on touch).
const SCREENS = [
  { w: 1440, h: 900, touch: false, label: "1440" },
  { w: 390, h: 844, touch: true, label: "390" },
  { w: 360, h: 740, touch: true, label: "360" },
  { w: 844, h: 390, touch: true, label: "390 sideways" },
  { w: 740, h: 360, touch: true, label: "360 sideways" },
];
const rows = [];
try {
  for (const e of MINIS) {
    const re = !!e.phone, floor = FLOOR[e.id];
    let first = true;
    for (const sc of SCREENS) {
      // A side-on mini takes every class: the screen's own, and the others forced (wide only where the
      // screen is wide; a phone held upright pins wide with the layout key, measured below).
      const upright = sc.h > sc.w;
      const forced = re ? (upright ? ["tall"] : sc.w > 1000 ? ["square", "tall"] : []) : [];
      if (!re && sc.h < sc.w && sc.w < 1000) continue; // a 16:9 mini on a sideways phone is the same stage as the desktop's, smaller: covered at 1440 and upright
      for (const force of [null, ...forced]) {
        const { p, errs } = await open(e, sc.w, sc.h, sc.touch, force);
        const m = await measure(p, floor, e.id);
        const cls = klass(m.w, m.h), at = `#${e.no} ${e.id} at ${sc.label}, ${cls}${force ? " (forced)" : ""}`;
        if (force) assert.equal(cls, force, `${at}: the stage is ${force}`);
        else if (re) assert.equal(cls, upright ? "square" : "wide", `${at}: the site's own stage`);
        const share = check(m, at, sc.touch, !!PLAY[e.id]);
        await (PLAY[e.id] ?? generic)(p, sc.touch);
        if (floor || e.id !== "freeze-plan-radio-platoon") check(await measure(p, floor, e.id), `${at}, after play`, sc.touch, !!PLAY[e.id]);
        rows.push(`${at}: controls ${(share * 100).toFixed(1)}%, ${m.keys.length} keys`);
        if (first) {
          await settled(p, at);
          assert.deepEqual(await recall(p), { same: true, running: false }, `${at}: Recall gives the page back byte for byte`);
          first = false;
        }
        assert.deepEqual(errs, [], `${at}: no page errors`);
        await p.close();
      }
    }
    // A phone held upright, pinned wide with the layout key: still 44 px keys under the floor line.
    if (re) {
      const { p, errs } = await open(e, 390, 844, true, "wide");
      const m = await measure(p, floor, e.id), at = `#${e.no} ${e.id} at 390, pinned wide`;
      for (const k of m.keys) assert.ok(k.w >= 43.5 && k.h >= 43.5, `${at}: ${k.name} is 44 px or more`);
      for (const k of m.keys) for (const a of m.play) assert.ok(!hit(k, a), `${at}: ${k.name} never covers ${a.name}`);
      placed(m, at);
      rows.push(`${at}: controls ${((m.area / (m.w * m.h)) * 100).toFixed(1)}% (a 181 px stage: the owner's pick)`);
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await p.close();
    }
    // Reduced motion: the poster stays; nothing mounts, no frames.
    const rm = await (await ctxFor(1440, 900, false, true)).newPage();
    await rm.goto(`http://minis.test/${e.id}/`);
    const still = await rm.evaluate(async (fn) => {
      let raf = 0;
      const was = requestAnimationFrame;
      window.requestAnimationFrame = (f) => (raf++, was(f));
      mc.slot(document.querySelector("figure"), () => mc[fn], { idle: 0 });
      await new Promise((r) => setTimeout(r, 300));
      return { stage: !!document.querySelector("[data-fizlet-slot]"), raf };
    }, fnOf(e));
    assert.deepEqual(still, { stage: false, raf: 0 }, `#${e.no} ${e.id}: reduced motion keeps the poster, no frames`);
    await rm.close();
  }
  console.log(rows.join("\n"));
  console.log(`minis controls: ${MINIS.length} minis; keys at most 20% of the stage, 44 px on touch, clear of the play; play, settle, reduced motion and Recall`);
} finally {
  await browser.close();
}
