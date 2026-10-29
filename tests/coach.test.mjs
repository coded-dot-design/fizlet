// fizlet/coach: tour steps and tips frame by frame like DOM Battlefield Blitz's practice coach, flag
// reads and writes like DOM Battlefield's tips switch (and survives blocked storage), the card shows
// and rings in a real browser, and tour allocates nothing per frame.
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { minorGCs } from "./gc.mjs";
import { launchOptions } from "./chromium.mjs";

const { createEngine } = await import("../src/index.ts");
const { tour, flag } = await import("../src/coach.ts");
const { seeded } = await import("../src/kernel/random.ts");

// ---- DOM Battlefield Blitz (dom-battlefield-blitz src/game.ts @ b60931a, MIT): the coach tour replaces.
const COACH = ["DRIVE", "FIRE", "AUTO AIM", "AIM LOCK", "LONG SHOT", "AIRSTRIKE", "POWER TILES", "KILL STREAK", "SUPPLY CRATE", "YOUR KEYS"].map((t) => [t, `${t} text`, ""]);
const TRICKS = ["t0", "t1", "t2", "t3", "t4", "t5", "t6"];
function blitzCoach(events) {
  const c = { cStep: 0, cT: 0, coachShown: -1, card: null };
  // coachStep (game.ts 1091–1105), its done list reduced to the inputs the test drives
  c.step = (dt, did) => {
    c.cT += dt;
    const done = [...did.slice(0, 9), did[9] || c.cT > 9][c.cStep];
    if (c.cStep < COACH.length && done) {
      c.cStep++;
      c.cT = 0;
      events.push(`power@${c.cStep}`);
    }
  };
  // coachFrame (game.ts 1106–1116), DOM writes recorded as the card
  c.frame = () => {
    const key = c.cStep < COACH.length ? c.cStep : COACH.length + (((c.cT / 6) | 0) % TRICKS.length);
    if (key === c.coachShown) return;
    c.coachShown = key;
    const [title, text] = c.cStep < COACH.length ? COACH[c.cStep] : ["TRICK", TRICKS[key - COACH.length], ""];
    c.card = [c.cStep < COACH.length ? `${c.cStep + 1}/${COACH.length}` : "✓", c.cStep < COACH.length ? title : `FREE PLAY · ${title}`, text];
  };
  return c;
}
// DOM Battlefield (dom-battlefield src/client.ts 232–238 and 2070–2073, MIT): the tips switch flag replaces.
const TIPS = "dom-battlefield:tips";
function tipsOff() {
  try {
    return localStorage.getItem(TIPS) === "off";
  } catch {
    return false;
  }
}
const tipsOffClick = () => {
  try {
    localStorage.setItem(TIPS, "off");
  } catch {}
};
// ----

test("tour: frame by frame the same steps, timing and cards as Blitz's practice coach", () => {
  const e = createEngine(), dt = 1 / 60, R = seeded(9);
  const ref = [], mine = [];
  const b = blitzCoach(ref), c = tour(e);
  e.add({ render: (x) => { for (let i = 0; i < x.events.size; i++) { const v = x.events.at(i); if (v.type === "coach:step") mine.push(`power@${v.a}`); } } });
  let card = null;
  e.add({
    step() {
      // the player does a step's thing now and then; the last step also passes on its own after 9 s
      const did = Array.from({ length: 10 }, (_, k) => k < 9 && R() < 0.004);
      b.step(dt, did);
      c.tick(dt);
      const done = [...did.slice(0, 9), did[9] || c.time[0] > 9][c.step];
      if (done) c.pass();
      b.frame();
      const k = c.show();
      if (k >= 0)
        card = k < COACH.length ? [`${k + 1}/${COACH.length}`, COACH[k][0], COACH[k][1]] : ["✓", "FREE PLAY · TRICK", TRICKS[k - COACH.length]];
    },
  });
  const seen = new Set();
  for (let f = 0; f < 60 * 240; f++) {
    e.advance(dt);
    assert.deepEqual([c.step, c.time[0], card], [b.cStep, b.cT, b.card], `frame ${f}`);
    seen.add(card?.[2]);
  }
  assert.deepEqual(mine, ref, "coach:step on the ring where Blitz powered up");
  assert.ok(c.done && seen.size >= 15, `it went through every step and some tips (${seen.size} cards)`);
});

test("flag: the same answers as Battlefield's tips switch, and never throws", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const tips = flag(TIPS, "off");
  assert.equal(tips.on, tipsOff());
  tips.mark();
  assert.equal(tips.on, true);
  assert.equal(tipsOff(), true, "Battlefield reads the flag the brick wrote");
  tips.clear();
  tipsOffClick();
  assert.equal(tips.on, true, "the brick reads the flag Battlefield wrote");
  store.set(TIPS, "on");
  assert.equal(tips.on, tipsOff());
  // Storage blocked (sandboxed iframe, private mode): every call answers "not set", nothing throws.
  globalThis.localStorage = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceeded"); }, removeItem() { throw new Error("SecurityError"); } };
  assert.equal(tips.on, false);
  assert.equal(tips.on, tipsOff());
  tips.mark(); tips.clear(); tipsOffClick();
  // No localStorage at all (Node, workers).
  delete globalThis.localStorage;
  assert.equal(tips.on, false);
  tips.mark();
});

test("card: shows the step, writes only changes, rings its control, ends (Chromium)", async (t) => {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return t.skip("needs playwright");
  }
  const js = (await build({ entryPoints: ["src/coach.ts"], bundle: true, format: "iife", globalName: "coach", write: false, logLevel: "silent" })).outputFiles[0].text;
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<div id=host class=bui style="position:relative;width:600px;height:400px"><button id=fire data-k=fire>FIRE</button></div>');
    await page.addStyleTag({ path: "src/ui/board-ui.css" });
    await page.addScriptTag({ content: js });
    const r = await page.evaluate(async () => {
      const host = document.getElementById("host"), fire = document.getElementById("fire");
      let ended = 0, muts = 0;
      const c = coach.card(host, { onEnd: () => ended++ });
      const hidden0 = c.el.hidden;
      c.show("2/10", "FIRE", "Click, Space, or hold FIRE.", fire);
      const shown = [c.el.hidden, c.el.textContent, fire.style.outline, getComputedStyle(c.el).borderStyle];
      const obs = new MutationObserver((l) => (muts += l.length));
      obs.observe(host, { subtree: true, childList: true, characterData: true, attributes: true });
      c.show("2/10", "FIRE", "Click, Space, or hold FIRE.", fire);
      await new Promise((r) => setTimeout(r));
      const same = muts;
      c.el.querySelector("button").click();
      c.hide();
      await new Promise((r) => setTimeout(r));
      return { hidden0, shown, same, ended, after: [c.el.hidden, fire.style.outline] };
    });
    assert.equal(r.hidden0, true, "hidden until shown");
    assert.deepEqual(r.shown.slice(0, 2), [false, "2/10FIRETEXT".replace("TEXT", "Click, Space, or hold FIRE.") + "END PRACTICE"]);
    assert.match(r.shown[2], /dashed/, "the control it is about gets the dashed ring");
    assert.equal(r.shown[3], "dashed", "Battlefield's dashed card border");
    assert.equal(r.same, 0, "showing the same card again writes nothing");
    assert.equal(r.ended, 1);
    assert.deepEqual(r.after, [true, ""], "hide clears the ring");
  } finally {
    await browser.close();
  }
});

test("tour: zero allocation across 1M frames (against a bare engine)", async (t) => {
  const minors = async (on) => {
    const e = createEngine({ events: 32 });
    const c = tour(e);
    let f = 0;
    e.add({
      step(_, dt) {
        if (!on) return;
        c.tick(dt);
        if (++f % 600 === 0 && !c.pass()) c.reset();
        c.show();
      },
    });
    const frames = (k) => { for (let i = 0; i < k; i++) e.advance(1 / 60); };
    frames(100000);
    const minor = await minorGCs(() => frames(1000000));
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withTour = await minors(true);
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): bare ${bare}, with ${withTour}`);
  assert.ok(withTour <= bare + 1, `young-generation GCs over 1M frames: ${withTour} with tour, ${bare} bare`);
});
