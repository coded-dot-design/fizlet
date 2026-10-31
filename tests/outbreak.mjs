// The Outbreak series, act 1 (ILOVEYOU, Slammer, WannaCry) and act 2 (the white hats: the edge
// filter), each on its own stage markup
// (site/gallery/stages/<id>.html) in Chromium: it mounts through fzlt/slot (the poster steps
// aside), plays its real spread by itself, every tap has its consequence (a letter deleted; a port
// closed and a server rebooted; a file unplugged and the kill switch registered; a router filtered so
// the flood bounces, then hosts patched into shields), the end card tells
// the lesson, it settles to no frames once still, a tap plays it again, destroy() mid-play gives the
// page back byte for byte, and under reduced motion nothing loads.
// Load-proof: the scenes draw from the engine's seeded random, every wait counts the scene's own
// frames (never wall time), and a tap on something that moves (a letter, a log line, a server) is read
// and sent in the same task, so the very next step sees it exactly where it was read.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const PIECES = ["iloveyou", "slammer", "wannacry", "edge-filter"];
const browser = await chromium.launch(launchOptions());
// In the page, once per piece: waits that count the scene's frames, and taps sent as real pointer
// events to whatever element is at that point (it must be in the figure), from the stage's live rect.
const HELPERS = () => {
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  /** Resolves once `ok()` holds; fails only after the scene has drawn `n` frames without it (or, if it
   *  stops drawing, after 15 s with no new frame). A loaded machine just takes longer. */
  const loop = async (n, what, each) => {
    const start = scene.engine.stats().frames;
    let last = start, lastAt = performance.now();
    for (;;) {
      const r = each();
      if (r) return r;
      const f = scene.engine.stats().frames;
      if (f - start > n) throw new Error(`${what}: not after ${n} frames (${JSON.stringify(scene.state)})`);
      if (f !== last) (last = f), (lastAt = performance.now());
      else if (performance.now() - lastAt > 15000) throw new Error(`${what}: the scene stopped first (${JSON.stringify(scene.state)})`);
      await raf();
    }
  };
  const tap = (at) => {
    const r = document.querySelector("[data-fizlet-slot]").getBoundingClientRect(), x = r.left + at.x, y = r.top + at.y;
    const el = document.elementFromPoint(x, y);
    if (!el?.closest("figure.ae-slot")) throw new Error(`tap at ${x},${y} is not on the piece`);
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true, isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: x, clientY: y }));
    return at;
  };
  window.t = {
    until: (ok, n, what) => loop(n, what, () => ok()),
    /** Taps the target `get()` names as soon as there is one, in the same task as reading it. */
    tapWhen: (get, n, what) => loop(n, what, () => { const at = get(); return at && tap(at); }),
    /** While `go()` holds, taps the target `get()` names once a frame (read and sent in one task). */
    tapWhile: (go, get, n, what) => loop(n, what, () => { if (!go()) return true; const at = get(); if (at) tap(at); }),
  };
};
// Frame budgets: a 60 Hz frame runs one fixed step (a slow one up to four), so N game seconds is
// at most about N * 60 frames, however loaded the machine is.
const until = (p, ok, sec, what) => p.evaluate(({ ok, n, what }) => t.until(new Function(`return (${ok})()`), n, what), { ok: ok.toString(), n: Math.ceil(sec * 60), what });
try {
  for (const id of PIECES) {
    const js = (await build({
      stdin: { contents: `export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/${id}.ts";`, resolveDir: process.cwd(), loader: "ts" },
      bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
    })).outputFiles[0].text;
    const stageHtml = readFileSync(`site/gallery/stages/${id}.html`, "utf8").trim();
    const PAGE = `<!doctype html><html data-theme="dark"><meta charset="utf-8"><body style="margin:0">
<main id="page"><div style="width:800px;padding:40px"><figure class="ae-slot gal-fig gal-own" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;margin:0;aspect-ratio:16 / 9;overflow:hidden">${stageHtml}</figure></div>
<p>Copy after the piece.</p></main><script>${js}</script></body></html>`;
    const open = async (opts = {}) => {
      const p = await browser.newPage({ viewport: { width: 900, height: 700 }, ...opts });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(PAGE);
      await p.evaluate(`(${HELPERS})()`);
      await p.evaluate(() => {
        window.before = document.getElementById("page").innerHTML;
        const fig = document.querySelector("figure.ae-slot");
        window.host = fz.slot(fig, () => (stage, el, first) => (window.scene = fz.mount(stage, el, first)), { idle: 0 });
      });
      return { p, errs };
    };
    // A real mouse click, for page elements that never move (ports, routers).
    const tapEl = async (p, sel) => {
      const b = await p.locator(sel).boundingBox();
      await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    };
    const attr = (p, sel, name, want, sec, what) => until(p, `() => document.querySelector(${JSON.stringify(sel)}).getAttribute(${JSON.stringify(name)}) === ${JSON.stringify(want)}`, sec, what);
    const endText = (p) => p.locator("[data-ob-end]").textContent();

    const { p, errs } = await open();
    await p.waitForFunction(() => window.scene);
    const up = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(up, { canvas: true, poster: "none" }, `${id}: mounts its canvas, the poster steps aside`);

    if (id === "iloveyou") {
      // The letter opens itself (its .vbs shows) and mails the whole address book.
      await until(p, () => scene.state.sent >= 4, 6, "it mails the address book");
      assert.equal(await p.locator("[data-ob]").getAttribute("data-ob-state"), "spread", "the attachment opened");
      // A tap on a letter in flight deletes it: one tap, where the letter is.
      await p.evaluate(() => t.tapWhen(() => scene.thing(0), 300, "a letter in flight"));
      await until(p, () => scene.state.deleted >= 1, 0.5, "a tap deletes a letter");
      // Contacts that open it mail it on: the count of letters sent outgrows the address book.
      await until(p, () => scene.state.phase === 2, 30, "the spread ends");
      const st = await p.evaluate(() => scene.state);
      assert.ok(st.opened >= 1 && st.sent > st.contacts, `it spread contact to contact (${JSON.stringify(st)})`);
      assert.equal(await p.locator('[data-ly-c][data-ly="open"]').count(), st.opened, "every contact that opened it shows it");
      assert.match(await endText(p), /\.vbs/, "the end card says why it worked");
    } else if (id === "slammer") {
      await until(p, () => scene.state.flying > 3, 6, "the flood comes in");
      // The wrong port: your own service goes down, then comes back.
      await tapEl(p, '[data-sl-port="80"]');
      await attr(p, '[data-sl-port="80"]', "data-sl", "down", 1, "closing port 80 takes a service down");
      await attr(p, '[data-sl-port="80"]', "data-sl", null, 4, "port 80 comes back");
      await until(p, () => scene.state.hot >= 1, 20, "a server in the rack is hit");
      // Close UDP 1434: the flood bounces. Then reboot every infected server (it lived in memory),
      // one tap a frame on whichever is hot right then.
      await tapEl(p, '[data-sl-port="1434"]');
      await attr(p, '[data-sl-port="1434"]', "data-sl", "closed", 1, "1434 closes");
      await p.evaluate(() => t.tapWhile(() => scene.state.phase === 1, () => scene.thing(0), 1200, "reboot the rack"));
      const st = await p.evaluate(() => scene.state);
      assert.ok(st.phase === 2 && st.closed && st.hot === 0 && st.reboots >= 1, `closed and rebooted clean (${JSON.stringify(st)})`);
      assert.match(await endText(p), /^Clean at \d+:\d\d/, "the end card gives the time it took");
    } else if (id === "edge-filter") {
      // The flood comes in from the internet and infects a host.
      await until(p, () => scene.state.hot >= 1, 10, "the flood infects a host");
      // Filter 1434 at both edges: the flood bounces off the routers.
      for (const r of ["ia", "ic"]) {
        await tapEl(p, `[data-wh-r="${r}"]`);
        await attr(p, `[data-wh-r="${r}"]`, "data-wh", "filtered", 1, `edge router ${r} filters 1434`);
      }
      await until(p, () => scene.state.bounced >= 3, 6, "the flood bounces");
      // Segment the inside too, then patch every host that isn't a shield yet, one tap a frame.
      for (const r of ["ab", "ac", "bd", "cd"]) {
        await tapEl(p, `[data-wh-r="${r}"]`);
        await attr(p, `[data-wh-r="${r}"]`, "data-wh", "filtered", 1, `router ${r} filters 1434`);
      }
      assert.equal(await p.evaluate(() => scene.state.filtered), 6, "every link filtered");
      await p.evaluate(() => t.tapWhile(() => scene.state.phase === 1, () => scene.thing(0), 1800, "patch every host"));
      const st = await p.evaluate(() => scene.state);
      assert.ok(st.phase === 2 && st.hot === 0 && st.fix === 0 && st.safe >= 1, `every segment clean (${JSON.stringify(st)})`);
      assert.equal(await p.locator('[data-wh-h][data-wh="safe"]').count(), st.safe, "every patched host shows its shield");
      assert.match(await endText(p), /^Clean at \d+:\d\d/, "the end card gives the time it took");
      assert.match(await endText(p), /UDP 1434 within minutes · Fix: filter 1434 at network edges, then patch \(MS02-039, out six months earlier\)/, "and the facts");
    } else {
      // A file is hit and locked; the lookup log shows the kill-switch domain going unanswered.
      await until(p, () => scene.state.locked >= 1, 10, "a file locks");
      assert.match(await p.locator("[data-wc-f][data-wc=locked]").first().textContent(), /\./, "a file is locked");
      assert.match(await p.locator(".wc-log").textContent(), /iuqerfsodp9ifjaposdfjhgosurijfaewrwergwea\.com/, "the lookup is in the log");
      // Unplug a clean file (read and tapped in one task: a hop can't lock it in between).
      await p.evaluate(() => t.tapWhen(() => scene.clean(4), 60, "a clean file"));
      await until(p, () => scene.state.cut === 1, 0.5, "a tap unplugs a clean file");
      await attr(p, "[data-wc-f][data-wc=cut]", "data-wc", "cut", 0.5, "it shows unplugged");
      assert.equal(await p.locator("[data-wc-f][data-wc=cut]").count(), 1, "one file shows unplugged");
      // Register the domain: one tap on its line in the log, read where it is now (the log scrolls).
      await p.evaluate(() => t.tapWhen(() => scene.thing(), 600, "the kill-switch line"));
      await until(p, () => scene.state.registered, 0.5, "a tap on the domain registers it");
      await until(p, () => scene.state.phase === 2, 12, "the kill switch ends it");
      assert.match(await endText(p), /^Kill switch on/, "the end card says the switch stopped it");
      assert.match(await endText(p), /decrypted nothing/, "and that it decrypted nothing");
    }
    // Then it settles: no frames at all.
    await until(p, () => scene.engine.paused.includes("settled"), 15, `${id}: settles`);
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      for (let f = 0; f < 30; f++) await new Promise(requestAnimationFrame);
      return scene.engine.stats().frames - a;
    });
    assert.equal(still, 0, `${id}: settled, no frames`);
    // A tap plays it again (a real click), and destroy() mid-play gives the page back.
    const bb = await p.locator("figure").boundingBox();
    await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5);
    await until(p, () => scene.engine.running && scene.state.phase === 1, 3, `${id}: a tap plays it again, a new round under way`);
    const back = await p.evaluate(() => (host.destroy(), document.getElementById("page").innerHTML === window.before));
    assert.ok(back, `${id}: destroy() mid-play gives the page back byte for byte`);
    assert.deepEqual(errs, [], `${id}: no page errors`);
    await p.close();

    // Reduced motion: the poster stays, the scene never loads.
    const rm = await open({ reducedMotion: "reduce" });
    await rm.p.waitForTimeout(600);
    assert.equal(await rm.p.evaluate(() => !!window.scene), false, `${id}: reduced motion loads nothing`);
    assert.notEqual(await rm.p.evaluate(() => getComputedStyle(document.querySelector(".ae-slot__placeholder")).display), "none", `${id}: the poster stays`);
    await rm.p.close();
    console.log(`ok ${id}`);
  }
} finally {
  await browser.close();
}
