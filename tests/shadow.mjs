// Domain shadow tokens (BOARD-UI.md 4.1) in Chromium. With no tokens set, every hard shadow, press
// and hit area in the kit and the arcade's shadow-DOM HUD computes exactly as before the tokens
// existed (tests/fixtures/shadow-defaults.json, captured from 0.20.0's CSS; `--write` recaptures).
// With --shadow-x / --shadow-y set once at the page's :root, a key's base and its press both follow
// the new direction, in the page and through the arcade's shadow root (custom properties inherit
// across :host), and the page-keys check (the face drops by its base, a click on the base lands)
// passes at the new angle.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { build, transform } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { bundle, page as gamePage } from "./arcade-game.mjs";
import { checkKeys } from "./keys.mjs";

const GOLDEN = "tests/fixtures/shadow-defaults.json";
const WRITE = process.argv.includes("--write");
const kit = (await transform(readFileSync("src/ui/board-ui.css", "utf8"), { loader: "css", minify: true })).code;

// pressCue (Enter shows the press) for the page-keys check.
const cue = (await build({ stdin: { contents: 'import { pressCue } from "./src/ui/board-ui.ts"; pressCue(document);', resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "iife", write: false, logLevel: "silent" })).outputFiles[0].text;
const ICON = '<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>';
const KEYS = `
<button type="button">Base</button> <button type="button" class="down">Base down</button> <button type="button" aria-pressed="true">Base locked</button> <button type="button" disabled>Off</button>
<a class="bui-key" href="#a">Link key</a> <a class="bui-key bui-arcade bui-go" href="#b">${ICON} Go</a> <button type="button" class="bui-key bui-icon-key" aria-label="Icon">${ICON}</button>
${["sys", "cmd", "fire", "aim", "attack", "advance", "fallin", "retreat", "flag", "go"].map((r) => `<button type="button" class="bui-arcade bui-${r}">${r} <kbd>K</kbd></button>`).join(" ")}
<button type="button" class="bui-arcade bui-cmd" aria-pressed="true">Locked</button> <button type="button" class="bui-arcade bui-fire bui-call">Call</button> <button type="button" class="bui-arcade bui-aim" aria-pressed="true">Aim on</button>
<span class="bui-seg"><button type="button" aria-pressed="true">Light</button><button type="button">Heavy</button></span>
<button type="button" class="bui-arcade bui-unit"><b>1</b><span class="bui-pips"><s></s><s></s></span></button> <button type="button" class="bui-arcade bui-unit" data-hp="hurt" disabled><b>2</b></button>
<button type="button" class="bui-orb">${ICON}<small>MOVE</small><span class="bui-badge">3</span></button>
<button type="button" class="bui-sticker-key">${ICON}<b>START</b></button> <button type="button" class="bui-sticker-key bui-plan"><b>PLAN</b></button> <button type="button" class="bui-sticker-key bui-second"><b>SURRENDER</b></button>
<div class="bui-card" style="margin:20px 0"><button type="button" class="bui-grip" aria-label="Move"></button><button type="button" class="bui-back-tab">${ICON} BACK</button>Card</div>
<div class="bui-dock" style="width:240px"><span class="bui-dock-title">RADIO</span><button type="button" class="bui-dock-switch">${ICON}</button></div>
<div class="bui-toast" role="status">Comms</div>
<span class="bui-tip-ring"><button type="button" class="bui-arcade">Tip</button></span> <button type="button" class="bui-tip-label">Label</button>
<div class="bui-pad" style="position:relative"><div class="bui-pad-move"><div class="bui-stick down"><i class="bui-knob"></i></div></div><div class="bui-pad-keys"><button type="button" class="bui-arcade bui-fire">F</button></div></div>
<div class="bui-readouts"><div class="bui-readout"><span>Kills</span><b>3</b></div></div>
<div class="bui-overlay" style="position:relative;height:200px"><div class="bui-sticker"><span>PAUSED</span><b>HOLD</b></div><div class="bui-overlay-keys"><button type="button" class="bui-sticker-key"><b>GO</b></button></div></div>`;
const kitPage = (rootCss = "") => `<!doctype html><html><head><meta charset="utf-8"><style>${rootCss}</style><style>${kit}</style></head>
<body style="margin:0;background:#07060f"><main class="bui" style="padding:24px;display:flow-root">${KEYS}</main>
<main class="bui" data-theme="light" style="padding:24px;background:#eef0fb;display:flow-root">${KEYS}</main><script>${cue}</script></body></html>`;

// Every shadow / travel property of every element (and its ::before / ::after) under `root`.
const dump = (root) => {
  const out = [];
  for (const [i, e] of [...root.querySelectorAll("*")].entries()) {
    for (const pseudo of ["", "::before", "::after"]) {
      const s = getComputedStyle(e, pseudo || null);
      if (pseudo && s.content === "none") continue;
      out.push(`${i} ${e.tagName.toLowerCase()}.${[...e.classList].join(".")}${pseudo} ` + ["box-shadow", "text-shadow", "filter", "transform", "translate", "inset"].map((p) => s.getPropertyValue(p)).join(" | "));
    }
  }
  return out;
};
// The kit's keyframes sampled at fixed times (slam, call ring, locked breath), each paused there.
const sampleAnimations = (root) => {
  const out = [];
  for (const a of root.getAnimations({ subtree: true }).filter((a) => a.animationName)) {
    a.pause();
    for (const t of [0, 200, 400, 600, 900, 1100]) {
      a.currentTime = t;
      const s = getComputedStyle(a.effect.target, a.effect.pseudoElement || null);
      out.push(`${a.animationName}${a.effect.pseudoElement ?? ""}@${t} ${s.boxShadow} | ${s.translate} | ${s.transform}`);
    }
  }
  return out;
};

const browser = await chromium.launch(launchOptions());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const fail = [];
const run = async (name, fn) => { try { await fn(); console.log(`ok - ${name}`); } catch (e) { fail.push(name); console.log(`not ok - ${name}\n  ${String(e.message).split("\n").join("\n  ")}`); } };

/** Hover each key in turn (fine pointer), then keyboard-focus each: the rows those states add. */
async function interactive(p, sel) {
  const rows = [];
  const n = await p.locator(sel).count();
  for (let i = 0; i < n; i++) {
    const k = p.locator(sel).nth(i);
    if (!(await k.isVisible()) || (await k.isDisabled())) continue;
    await k.hover({ force: true });
    await p.evaluate(() => document.getAnimations().forEach((a) => a instanceof CSSTransition && a.finish()));
    rows.push(`hover ${i} ` + (await k.evaluate((e) => { const s = getComputedStyle(e), b = getComputedStyle(e, "::before"); return [s.boxShadow, s.transform, b.transform, b.inset].join(" | "); })));
  }
  await p.mouse.move(1, 1);
  await p.keyboard.press("Shift"); // keyboard modality: focus() now shows :focus-visible
  for (let i = 0; i < n; i++) {
    const k = p.locator(sel).nth(i);
    if (!(await k.isVisible()) || (await k.isDisabled())) continue;
    rows.push(`focus ${i} ` + (await k.evaluate((e) => { e.focus(); const s = getComputedStyle(e); e.blur(); return s.boxShadow; })));
  }
  return rows;
}

async function capture() {
  const out = {};
  const p = await ctx.newPage();
  await p.setContent(kitPage());
  await p.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; }));
  out.kit = await p.evaluate(`(${dump})(document.body)`);
  out.kitAnimations = await p.evaluate(`(${sampleAnimations})(document)`);
  out.kitStates = await interactive(p, "main.bui:first-of-type :is(button, .bui-key)");
  await p.close();
  // The arcade HUD presets, in their shadow root: the card and the skirmish bar (+ its countdown overlay).
  for (const [name, src, imports, set] of [["card", "", [], {}], ["skirmish", "skirmishHud({ readouts: [{ label: \"Kills\" }, { label: \"Armor\", kind: \"bar\" }], aim: [\"auto\"], counts: { strike: 2 }, result: { stats: [\"kills\"] } })", ["skirmishHud"], { sk: 1 }]]) {
    const g = await ctx.newPage();
    await g.setContent(gamePage(await bundle(src, imports)));
    await g.evaluate((set) => (window.g = T.launch({ root: "#board", seed: 3, sound: false }, set)).start(), set);
    await g.waitForTimeout(150);
    const root = "document.querySelector('[data-fizlet-host=test-game]').shadowRoot";
    await g.evaluate(`${root}.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; })`);
    out[name] = await g.evaluate(`(${dump})(${root})`);
    await g.evaluate(() => window.g.stop?.());
    await g.close();
  }
  return out;
}

await run("defaults: every shadow, press and hit area computes as before the tokens", async () => {
  const now = await capture();
  if (WRITE) { writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + "\n"); console.log(`  wrote ${GOLDEN}`); return; }
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  for (const k of Object.keys(golden)) assert.deepEqual(now[k], golden[k], `${k}: differs from the pre-token render`);
});

// A key's rest base (first box-shadow offset) and its pressed face (transform), in px.
const keyState = (e) => {
  const m = (s) => [...(s.boxShadow.match(/(-?[\d.]+)px (-?[\d.]+)px/) ?? []).slice(1).map(Number)];
  e.style.transition = "none";
  const rest = m(getComputedStyle(e));
  e.classList.add("down");
  const t = new DOMMatrix(getComputedStyle(e).transform), base = m(getComputedStyle(e));
  e.classList.remove("down");
  e.style.transition = "";
  return { rest, press: [t.m41, t.m42], pressedBase: base };
};

for (const [x, y] of [[1, 1], [-1, 0.5], [0.7071, 0.7071]]) {
  const css = `:root{--shadow-x:${x};--shadow-y:${y}}`;
  await run(`${css}: base and press follow in the page`, async () => {
    const p = await ctx.newPage();
    await p.setContent(kitPage(css));
    for (const [sel, py] of [["main button:not([class])", 3], ["main .bui-arcade.bui-sys", 4], ["main .bui-sticker-key", 5], ["main .bui-orb", 5], ["main .bui-tip-label", 2]]) {
      const s = await p.locator(sel).first().evaluate(keyState);
      const want = [py * x, py * y];
      for (const [got, label] of [[s.rest, "rest base"], [s.press, "pressed face"]])
        assert.ok(Math.abs(got[0] - want[0]) < 0.05 && Math.abs(got[1] - want[1]) < 0.05, `${sel} ${label}: ${got} vs ${want}`);
      assert.deepEqual(s.pressedBase, [0, 0], `${sel}: the pressed base is gone`);
    }
    // The sticker's hard base and the card's follow too (no press: a fixed depth, 5u).
    for (const sel of ["main .bui-card", "main .bui-toast"]) {
      const [bx, by] = await p.locator(sel).first().evaluate((e) => getComputedStyle(e).boxShadow.match(/(-?[\d.]+)px (-?[\d.]+)px/).slice(1).map(Number));
      assert.ok(Math.abs(bx / by - x / y) < 0.01, `${sel}: base along the domain angle (${bx}, ${by})`);
    }
    await p.close();
  });
  await run(`${css}: the arcade's shadow-DOM HUD follows through :host`, async () => {
    const g = await ctx.newPage();
    await g.setContent(gamePage(await bundle()).replace("<head>", `<head><style>${css}</style>`));
    await g.evaluate(() => (window.g = T.launch({ root: "#board", seed: 3, sound: false })).start());
    const s = await g.evaluate(`(() => { const r = document.querySelector('[data-fizlet-host=test-game]').shadowRoot;
      const card = getComputedStyle(r.querySelector('.ar')).boxShadow.match(/(-?[\\d.]+)px (-?[\\d.]+)px/).slice(1).map(Number);
      return { card, key: (${keyState})(r.querySelector('.ar header button')) }; })()`);
    assert.ok(Math.abs(s.card[0] - 5 * x) < 0.05 && Math.abs(s.card[1] - 5 * y) < 0.05, `card base ${s.card}`);
    assert.ok(Math.abs(s.key.press[0] - 3 * x) < 0.05 && Math.abs(s.key.press[1] - 3 * y) < 0.05, `header key press ${s.key.press}`);
    await g.evaluate(() => window.g.stop?.());
    await g.close();
  });
}

await run("page keys at three angles: the face drops by its base, a click on the base lands", async () => {
  const p = await ctx.newPage();
  // Page keys as a site lays them out (spaced, none breathing or calling), at 45° and at -1 / 0.5.
  // (A base link key needs a box to move: an inline <a> ignores transform, so its face never drops.)
  const PAGE = `<a class="bui-key" href="#a" style="display:inline-block">Link</a> <a class="bui-key bui-arcade bui-go" href="#b">${ICON} Go</a> <button type="button" class="bui-key bui-icon-key" aria-label="Icon">${ICON}</button>
${["sys", "cmd", "fire", "attack", "flag"].map((r) => `<a class="bui-key bui-arcade bui-${r}" href="#${r}">${r}</a>`).join(" ")} <button type="button" class="bui-key bui-sticker-key">${ICON}<b>START</b></button>`;
  for (const css of [":root{--shadow-x:1;--shadow-y:1}", ":root{--shadow-x:-1;--shadow-y:0.5}", ":root{--shadow-x:1;--shadow-y:0}"]) {
    await p.setContent(`<!doctype html><style>${css} main .bui-key{margin:14px}</style><style>${kit}</style><main class="bui" style="padding:24px">${PAGE}</main><script>${cue}</script>`);
    assert.equal(await checkKeys(p, css), 9);
  }
  await p.close();
});

await browser.close();
if (fail.length) { console.log(`\n${fail.length} failed`); process.exit(1); }
console.log("\nshadow tokens: all ok");
