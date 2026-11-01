// @fzlt/core/arcade's `hud` option in Chromium. Leaving `hud` out, or passing `arcadeHud()`, renders the
// card byte for byte as it was before the option existed (tests/fixtures/arcade-card.json, captured
// from 0.17.0's arcade). The `arcade` preset renders only the keys it names. The `skirmish` preset
// renders its bar (readouts in their formats, the armor bar and its low state, aim toggles, counted
// keys, and the Auto fire / Next gate / Restart / fold keys a game asks for), its feed and banner from
// the event ring, and runs its flow on @fzlt/core/match: the countdown on the flow's clock (the game's
// engine waits), pause / surrender asked of match from P and the pause key, the result sticker
// that outlives the game's engine until REMATCH or EXIT; it writes nothing on unchanged frames,
// keeps the final numbers after the run, and Recall gives the page back exactly; phones get the pad with the aim toggles and the counts. Both presets
// allocate nothing in the steady state (minor GCs over 200k HUD writes, best of 3).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { bundle, page, shadowHtml } from "./arcade-game.mjs";
import { gcStats } from "./perf/harness.mjs";

const golden = JSON.parse(readFileSync("tests/fixtures/arcade-card.json", "utf8"));
const SKIRMISH = `{ readouts: [{ label: "Kills", tone: "team" }, { label: "Time", kind: "clock" }, { label: "Rank", kind: "rank" }, { label: "Armor", kind: "bar", low: 0.3 }, { label: "Streak", tone: "enemy" }],
  feed: { on: "kill", line: (a, b) => NAMES[a] + " ✕ " + NAMES[b] }, banner: { on: "streak", text: (a) => [a + " KILL STREAK", "AIRSTRIKE"] },
  aim: ["auto", "lock"], counts: { strike: 5 }, result: { stats: ["kills", "shots"], best: "kills" } }`;
const pages = {
  omitted: page(await bundle()),
  card: page(await bundle("arcadeHud()", ["arcadeHud"])),
  picked: page(await bundle(`arcadeHud({ header: ["sound", "exit"], nav: ["restart"] })`, ["arcadeHud"])),
  cardSpy: page(await bundle("spy(arcadeHud())", ["arcadeHud"])),
  skirmish: page(await bundle(`spy(skirmishHud(${SKIRMISH}))`, ["skirmishHud"])),
  keys: page(await bundle(`skirmishHud({ readouts: [{ label: "Kills" }], header: ["sound", "pause", "fold", "exit"], nav: ["auto", "next", "restart"] })`, ["skirmishHud"])),
};

const browser = await chromium.launch(launchOptions());
const DESK = { viewport: { width: 1100, height: 760 } }, PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const html = (p) => p.evaluate(() => document.documentElement.outerHTML);
const snap = (p) => p.evaluate(() => window.g.getSnapshot());
const open = async (ctx, which, set = {}) => {
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  // Served from an origin (not about:blank), so the result card's best can use localStorage.
  await p.route("http://fizlet.test/", (r) => r.fulfill({ body: pages[which], contentType: "text/html" }));
  await p.goto("http://fizlet.test/");
  const before = await html(p);
  await p.evaluate((set) => (window.g = T.launch({ root: "#board", seed: 3, sound: false }, set)).start(), set);
  return { p, errs, before };
};
// Reads inside the scoreboard's shadow root.
const sh = (p, fn, arg) => p.locator("[data-fizlet-host=test-game]").evaluate((h, [f, a]) => new Function("r", "a", `return (${f})(r, a)`)(h.shadowRoot, a), [fn.toString(), arg]);
const text = (p, sel) => sh(p, (r, s) => r.querySelector(s)?.textContent ?? null, sel);
// The flow's overlay keys (@fzlt/core/match): the ones on show, and one by name.
const shown = (p) => sh(p, (r) => [...r.querySelectorAll(".bui-overlay [data-k]")].filter((b) => b.style.display !== "none").map((b) => b.textContent));
const press = (p, k) => sh(p, (r, k) => r.querySelector(`.bui-overlay [data-k=${k}]`).click(), k);
const frames = (p, n = 3) => p.evaluate((n) => new Promise((ok) => { const f = () => (n-- ? requestAnimationFrame(f) : ok()); f(); }), n);

let where = "card: byte for byte";
try {
  // ---------- The card: omitted, arcadeHud(), and the pieces it names ----------
  for (const which of ["omitted", "card"]) {
    const desk = await browser.newContext(DESK);
    const { p, errs } = await open(desk, which);
    assert.equal(await shadowHtml(p), golden.desktop, `${which}: the card at start`);
    await p.keyboard.press("KeyK");
    await p.waitForFunction(() => window.g.getSnapshot().status === "gameover");
    assert.equal(await shadowHtml(p), golden.over, `${which}: the card with the result`);
    assert.deepEqual(errs, []);
    await desk.close();
    const phone = await browser.newContext(PHONE);
    assert.equal(await shadowHtml((await open(phone, which)).p), golden.phone, `${which}: the folded card and the pad`);
    await phone.close();
  }
  where = "card: picked keys";
  {
    const desk = await browser.newContext(DESK);
    const { p } = await open(desk, "picked");
    assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll("header button")].map((b) => b.dataset.a)), ["sound", "exit"]);
    assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll("nav button")].map((b) => b.dataset.a ?? b.dataset.act)), ["end", "strike", "restart"]);
    assert.equal(await text(p, ".bui-readout b"), "000000", "readouts as before");
    assert.ok(await sh(p, (r) => !!r.querySelector(".mt [role=progressbar]")), "the meter");
    await p.keyboard.press("KeyP"); // P still pauses without a pause key
    assert.equal((await snap(p)).status, "paused");
    await desk.close();
  }

  // ---------- Skirmish: the bar, the countdown ----------
  where = "skirmish: bar and countdown";
  const desk = await browser.newContext(DESK);
  const { p, errs, before } = await open(desk, "skirmish", { sk: 1 });
  // At once: the countdown is up and the engine waits for it.
  const first = await p.locator("[data-fizlet-host=test-game]").evaluate((h) => [h.shadowRoot.querySelector(".bui-sticker span").textContent, h.shadowRoot.querySelector(".bui-sticker b").textContent, window.g.getSnapshot().status, window.g.getSnapshot().elapsed]);
  assert.deepEqual(first, ["GET READY", "3", "running", 0], "the countdown");
  assert.equal(await sh(p, (r) => r.querySelector(".ar")), null, "no card");
  assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll(".sk .bui-readout")].map((x) => [x.firstChild.data, x.dataset.tone ?? ""])), [["Kills", "team"], ["Time", ""], ["Rank", ""], ["Armor", ""], ["Streak", "enemy"]]);
  assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll(".sk .bui-readout > b")].map((b) => b.textContent)), ["0", "3:00", "#1", "0"], "formats: num, clock, rank, num");
  assert.deepEqual(await sh(p, (r) => { const i = r.querySelector(".sk [role=progressbar]"); return [i.getAttribute("aria-valuenow"), i.style.width, i.classList.contains("low")]; }), ["100", "100%", false], "the armor bar");
  assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll(".sk nav button")].map((b) => b.dataset.a === "aim" ? b.dataset.aim : b.dataset.a ?? b.dataset.act)), ["aim-auto", "aim-lock", "end", "strike", "full", "sound", "pause", "exit"]);
  assert.equal(await text(p, "[data-act=strike] .bui-badge"), "2", "the counted key");
  await p.keyboard.press("KeyP"); // the countdown can't be paused: match owns the phase
  assert.equal((await snap(p)).status, "running");
  await p.waitForFunction(() => window.g.getSnapshot().elapsed > 0, null, { timeout: 4000 });
  assert.equal(await sh(p, (r) => r.querySelector(".bui-overlay").hidden), true, "the countdown is gone");
  assert.equal(await sh(p, (r) => r.querySelectorAll(".bui-overlay").length), 1, "one overlay: match's");

  where = "skirmish: values";
  await p.evaluate(() => { T.state[7] = 65; T.state[8] = 3; T.state[9] = 0.25; T.state[10] = 4; });
  await frames(p);
  assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll(".sk .bui-readout > b")].map((b) => b.textContent)), ["0", "1:05", "#3", "4"]);
  assert.deepEqual(await sh(p, (r) => { const i = r.querySelector(".sk [role=progressbar]"); return [i.getAttribute("aria-valuenow"), i.style.width, i.classList.contains("low")]; }), ["25", "25%", true], "the armor bar runs low");
  // Unchanged frames write nothing (the comms toast's own timer aside).
  const quiet = await sh(p, (r) => new Promise((ok) => {
    let n = 0;
    const mo = new MutationObserver((l) => (n += l.filter((m) => !m.target.closest?.(".msg") && !m.target.parentElement?.closest(".msg")).length));
    mo.observe(r, { subtree: true, childList: true, attributes: true, characterData: true });
    setTimeout(() => (mo.disconnect(), ok(n)), 400);
  }));
  assert.equal(quiet, 0, "no writes while nothing changes");

  where = "skirmish: play, feed, banner, counts, aim";
  await p.keyboard.down("Space");
  for (let x = 200; x <= 900; x += 70) await p.mouse.move(x, 600), await p.waitForTimeout(120);
  await p.keyboard.up("Space");
  await frames(p);
  const kills = (await snap(p)).kills;
  assert.ok(kills > 0, `kills ${kills}`);
  assert.equal(await text(p, ".sk .bui-readout b"), String(kills), "the kills readout");
  const feed = await sh(p, (r) => [...r.querySelectorAll(".sk-feed li")].map((li) => li.textContent));
  assert.equal(feed.length, 4, "four rows");
  assert.match(feed[0], /^YOU ✕ (RAVEN|BISON|VIPER)$/);
  await p.keyboard.press("KeyB");
  await frames(p);
  assert.equal(await text(p, "[data-act=strike] .bui-badge"), "1", "the count follows the game");
  assert.equal(await text(p, ".sk-ban b"), "3 KILL STREAK", "the banner");
  assert.match(await sh(p, (r) => r.querySelector(".sk-ban").className), /^sk-ban [ab]$/);
  await sh(p, (r) => r.querySelector("[data-aim=aim-lock]").click());
  await frames(p);
  assert.equal(await sh(p, (r) => r.querySelector("[data-aim=aim-lock]").getAttribute("aria-pressed")), "true");
  assert.equal(await p.evaluate(() => T.state[12]), 1, "the game reads the aim toggle");

  where = "skirmish: pause and surrender";
  await p.keyboard.press("KeyP");
  assert.equal((await snap(p)).status, "paused");
  assert.deepEqual(await sh(p, (r) => [r.querySelector(".bui-overlay").hidden, r.querySelector(".bui-overlay").dataset.phase, r.querySelector(".bui-sticker span").textContent, r.querySelector(".bui-sticker b").textContent]), [false, "paused", "BATTLE PAUSED", "GIVE UP?"]);
  assert.deepEqual(await shown(p), ["KEEP FIGHTING", "SURRENDER"]);
  assert.equal(await sh(p, (r) => r.querySelector("[data-a=pause]").getAttribute("aria-label")), "Resume game (P)", "the shell follows match");
  await press(p, "resume"); // keep fighting
  assert.equal((await snap(p)).status, "running");
  assert.equal(await sh(p, (r) => r.querySelector(".bui-overlay").hidden), true);
  await sh(p, (r) => r.querySelector("[data-a=pause]").click()); // the bar's pause key asks match too
  assert.equal((await snap(p)).status, "paused");
  await p.keyboard.press("KeyP");
  assert.equal((await snap(p)).status, "running", "P resumes");
  await p.keyboard.press("KeyP");
  await press(p, "surrender"); // the white flag waves, then the run ends
  await p.waitForFunction(() => window.g.getSnapshot().status === "gameover", null, { timeout: 4000 });
  // The page is back at once; the scoreboard (outside <body>) stays with the result.
  assert.equal(await p.evaluate(() => document.body.outerHTML), before.slice(before.indexOf("<body"), before.lastIndexOf("</html>")), "the page is back at once");

  where = "skirmish: result";
  assert.deepEqual(await sh(p, (r) => [r.querySelector(".bui-sticker span").textContent, r.querySelector(".bui-sticker b").textContent]), ["WHITE FLAG", "GAME OVER"]);
  assert.deepEqual(await shown(p), ["REMATCH", "EXIT"]);
  const shots = (await snap(p)).shots;
  assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll(".sk-res > *")].map((x) => x.textContent)), ["KILLS", String(kills), "SHOTS", String(shots), "BEST KILLS", String(kills)]);
  assert.equal(await text(p, ".sk .bui-readout b"), String(kills), "the bar keeps the final numbers");
  // The result outlives the game's engine (its end gave the page back) until it is dismissed.
  await p.waitForTimeout(300);
  assert.deepEqual(await sh(p, (r) => [r.querySelector(".bui-overlay").hidden, r.querySelector(".bui-overlay").dataset.phase]), [false, "end"], "the result stays up");
  // Rematch: a fresh run (a new countdown), the best is remembered.
  await press(p, "again");
  assert.equal((await snap(p)).status, "running");
  assert.equal(await text(p, ".bui-sticker b"), "3", "a new countdown");
  assert.equal(await p.evaluate(() => localStorage.getItem("fizlet:test-game:best")), String(kills));
  await p.keyboard.press("Escape");
  assert.equal(await html(p), before, "Recall during the countdown: the page byte for byte");
  await p.evaluate(() => window.g.start());
  await p.waitForFunction(() => window.g.getSnapshot().elapsed > 0, null, { timeout: 4000 });
  // Fire mid-run, held until a shot is out (state, not wall time), then leave by the exit key.
  const fired = (await snap(p)).shots;
  await p.keyboard.down("Space");
  await p.waitForFunction((n) => window.g.getSnapshot().shots > n, fired, { timeout: 4000 });
  await p.keyboard.up("Space");
  await sh(p, (r) => r.querySelector("[data-a=exit]").click());
  assert.equal((await snap(p)).status, "idle");
  assert.equal(await html(p), before, "Recall mid-run (the exit key): the page byte for byte");
  // A run that ends by itself (the game's K): STAGE CLEAR is for wins; EXIT on the result is Recall.
  await p.evaluate(() => window.g.start());
  await p.waitForFunction(() => window.g.getSnapshot().elapsed > 0, null, { timeout: 4000 });
  await p.keyboard.press("KeyK");
  await p.waitForFunction(() => window.g.getSnapshot().status === "gameover", null, { timeout: 4000 });
  assert.deepEqual(await sh(p, (r) => [r.querySelector(".bui-sticker span").textContent, r.querySelector(".bui-sticker b").textContent]), ["INSERT COIN", "GAME OVER"]);
  await press(p, "next");
  assert.equal((await snap(p)).status, "idle");
  assert.equal(await html(p), before, "EXIT on the result: the page byte for byte");
  assert.deepEqual(errs, []);
  await desk.close();

  where = "skirmish: Auto fire, Next gate, Restart, fold";
  {
    const ctx = await browser.newContext(DESK);
    const { p, errs } = await open(ctx, "keys", { sk: 1 });
    assert.deepEqual(await sh(p, (r) => [...r.querySelectorAll(".sk nav button")].map((b) => b.dataset.a ?? b.dataset.act)), ["end", "strike", "auto", "gate", "restart", "sound", "pause", "fold", "exit"]);
    await p.waitForFunction(() => window.g.getSnapshot().elapsed > 0, null, { timeout: 4000 });
    const shots = (await snap(p)).shots;
    await sh(p, (r) => r.querySelector("[data-a=auto]").click());
    assert.deepEqual(await sh(p, (r) => [r.querySelector("[data-a=auto]").getAttribute("aria-pressed"), r.querySelector("[data-a=auto]").textContent]), ["true", "Fire: on"]);
    await p.waitForFunction((n) => window.g.getSnapshot().shots > n + 2, shots, { timeout: 4000 });
    await sh(p, (r) => r.querySelector("[data-a=auto]").click());
    assert.equal(await sh(p, (r) => r.querySelector("[data-a=auto]").textContent), "Auto fire");
    await sh(p, (r) => r.querySelector("[data-a=gate]").click());
    await sh(p, (r) => r.querySelector("[data-a=fold]").click());
    assert.deepEqual(await sh(p, (r) => { const f = r.querySelector("[data-a=fold]"); return [r.querySelector(".sk").classList.contains("compact"), f.getAttribute("aria-expanded"), f.getAttribute("aria-label"), getComputedStyle(r.querySelector("[data-a=restart]")).display, getComputedStyle(r.querySelector("[data-a=pause]")).display !== "none"]; }), [true, "false", "Expand scoreboard", "none", true], "fold: the text keys go, the header stays");
    await sh(p, (r) => r.querySelector("[data-a=fold]").click());
    await sh(p, (r) => r.querySelector("[data-a=restart]").click());
    assert.deepEqual([(await snap(p)).status, (await snap(p)).elapsed, await text(p, ".bui-sticker b")], ["running", 0, "3"], "Restart: a fresh run and its countdown");
    assert.deepEqual(errs, []);
    await ctx.close();
  }

  where = "skirmish: phone";
  {
    const phone = await browser.newContext(PHONE);
    const { p, errs } = await open(phone, "skirmish", { sk: 1 });
    const pad = await sh(p, (r) => ({
      stick: !!r.querySelector(".bui-stick"),
      keys: [...r.querySelectorAll(".bui-pad [data-i]")].map((k) => [k.getAttribute("aria-label"), k.getAttribute("aria-pressed"), k.querySelector(".bui-badge")?.textContent ?? null]),
    }));
    assert.ok(pad.stick);
    assert.deepEqual(pad.keys, [["Hold to fire (Space)", null, null], ["End", null, null], ["Strike", null, "2"], ["Auto aim", "false", null], ["Lock", "false", null]]);
    assert.deepEqual(errs, []);
    await phone.close();
  }

  // ---------- Zero allocation in the steady state (the HUD's write, as the shell calls it) ----------
  where = "zero allocation";
  const ctx = await browser.newContext(DESK);
  const gcs = {};
  for (const [which, set] of [["cardSpy", {}], ["skirmish", { sk: 1 }]]) {
    const { p } = await open(ctx, which, set);
    await p.waitForFunction(() => window.g.getSnapshot().elapsed > 0, null, { timeout: 4000 });
    await p.keyboard.press("KeyP"); // no frames: only the loop below writes
    const cdp = await ctx.newCDPSession(p);
    const run = async (moving) => {
      let best = Infinity;
      for (let w = 0; w < 3 && best > 0; w++) {
        const events = [];
        cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
        const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
        await cdp.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "v8", "disabled-by-default-v8.gc"] }, transferMode: "ReportEvents" });
        await p.evaluate((moving) => {
          const { v, r } = window.__hud, s = T.state;
          r.engine.events.clear();
          for (let i = 0; i < 200000; i++) {
            if (moving) (s[6] = i % 600), (s[9] = (i % 100) / 100), (s[2] = i % 600);
            v.write();
          }
        }, moving);
        await cdp.send("Tracing.end");
        await done;
        cdp.removeAllListeners("Tracing.dataCollected");
        best = Math.min(best, gcStats(events).minorGC);
      }
      return best;
    };
    gcs[which] = { still: await run(false), moving: which === "skirmish" ? await run(true) : null };
    await p.close();
  }
  console.log(`# minor GCs over 200k HUD writes (best of 3): card unchanged ${gcs.cardSpy.still} · skirmish unchanged ${gcs.skirmish.still}, every value changing ${gcs.skirmish.moving}`);
  assert.ok(gcs.cardSpy.still <= 1, `card: ${gcs.cardSpy.still} minor GCs`);
  assert.ok(gcs.skirmish.still <= 1, `skirmish: ${gcs.skirmish.still} minor GCs`);
  // Changing values reuse @fzlt/core/hud's cached strings (0..1023).
  assert.ok(gcs.skirmish.moving <= 1, `skirmish, values changing: ${gcs.skirmish.moving} minor GCs`);
  await ctx.close();
  console.log("arcade hud: card byte for byte (omitted and arcadeHud()), picked keys, skirmish bar / formats / armor bar / counts / aim / feed / banner, the flow on @fzlt/core/match (countdown, pause, surrender, result that stays, REMATCH, EXIT), Auto fire / Next gate / Restart / fold, change-only, Recall exact, phone pad, zero allocation passed.");
} catch (err) {
  console.error(`arcade hud test failed at: ${where}`);
  throw err;
} finally {
  await browser.close();
}
