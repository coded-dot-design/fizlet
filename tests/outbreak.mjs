// The Outbreak series, act 1 (ILOVEYOU, Slammer, WannaCry), each on its own stage markup
// (site/gallery/stages/<id>.html) in Chromium: it mounts through fizlet/slot (the poster steps
// aside), plays its real spread by itself, every tap has its consequence (a letter deleted; a port
// closed and a server rebooted; a file unplugged and the kill switch registered), the end card tells
// the lesson, it settles to no frames once still, a tap plays it again, destroy() mid-play gives the
// page back byte for byte, and under reduced motion nothing loads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const PIECES = ["iloveyou", "slammer", "wannacry"];
const browser = await chromium.launch(launchOptions());
const frames = (p, n = 4) => p.evaluate((n) => new Promise((ok) => { const f = () => (n-- ? requestAnimationFrame(f) : ok()); f(); }), n);
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
      await p.evaluate(() => {
        window.before = document.getElementById("page").innerHTML;
        const fig = document.querySelector("figure.ae-slot");
        window.host = fz.slot(fig, () => (stage, el, first) => (window.scene = fz.mount(stage, el, first)), { idle: 0 });
      });
      return { p, errs };
    };
    const tapAt = async (p, at) => {
      const b = await p.locator("figure").boundingBox();
      await p.mouse.click(b.x + at.x, b.y + at.y);
      await frames(p, 2);
    };
    const tapEl = async (p, sel) => {
      const b = await p.locator(sel).boundingBox();
      await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await frames(p, 2);
    };
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
      await p.waitForFunction(() => scene.state.sent >= 4, null, { timeout: 6000 });
      assert.equal(await p.locator("[data-ob]").getAttribute("data-ob-state"), "spread", "the attachment opened");
      // A tap on a letter in flight deletes it.
      for (let i = 0; i < 20 && !(await p.evaluate(() => scene.state.deleted)); i++) {
        const at = await p.evaluate(() => scene.thing(0));
        if (at) await tapAt(p, at);
        else await frames(p, 3);
      }
      assert.ok((await p.evaluate(() => scene.state.deleted)) >= 1, "a tap deletes a letter");
      // Contacts that open it mail it on: the count of letters sent outgrows the address book.
      await p.waitForFunction(() => scene.state.phase === 2, null, { timeout: 20000 });
      const st = await p.evaluate(() => scene.state);
      assert.ok(st.opened >= 1 && st.sent > st.contacts, `it spread contact to contact (${JSON.stringify(st)})`);
      assert.equal(await p.locator('[data-ly-c][data-ly="open"]').count(), st.opened, "every contact that opened it shows it");
      assert.match(await endText(p), /\.vbs/, "the end card says why it worked");
    } else if (id === "slammer") {
      await p.waitForFunction(() => scene.state.flying > 3, null, { timeout: 6000 });
      // The wrong port: your own service goes down, then comes back.
      await tapEl(p, '[data-sl-port="80"]');
      assert.equal(await p.locator('[data-sl-port="80"]').getAttribute("data-sl"), "down", "closing port 80 takes a service down");
      await p.waitForFunction(() => !document.querySelector('[data-sl-port="80"]').dataset.sl, null, { timeout: 5000 });
      await p.waitForFunction(() => scene.state.hot >= 1, null, { timeout: 15000 });
      // Close UDP 1434: the flood bounces. Then reboot every infected server (it lived in memory).
      await tapEl(p, '[data-sl-port="1434"]');
      assert.equal(await p.locator('[data-sl-port="1434"]').getAttribute("data-sl"), "closed", "1434 closes");
      for (let i = 0; i < 80 && (await p.evaluate(() => scene.state.phase)) === 1; i++) {
        const at = await p.evaluate(() => scene.thing(0));
        if (at) await tapAt(p, at);
        else await frames(p, 3);
      }
      await p.waitForFunction(() => scene.state.phase === 2, null, { timeout: 8000 });
      const st = await p.evaluate(() => scene.state);
      assert.ok(st.closed && st.hot === 0 && st.reboots >= 1, `closed and rebooted clean (${JSON.stringify(st)})`);
      assert.match(await endText(p), /^Clean at \d+:\d\d/, "the end card gives the time it took");
    } else {
      // A file is hit and locked; the lookup log shows the kill-switch domain going unanswered.
      await p.waitForFunction(() => scene.state.locked >= 1, null, { timeout: 8000 });
      assert.match(await p.locator("[data-wc-f][data-wc=locked]").first().textContent(), /\./, "a file is locked");
      assert.match(await p.locator(".wc-log").textContent(), /iuqerfsodp9ifjaposdfjhgosurijfaewrwergwea\.com/, "the lookup is in the log");
      // Unplug a clean file.
      await tapAt(p, await p.evaluate(() => scene.clean(4)));
      assert.equal(await p.evaluate(() => scene.state.cut), 1, "a tap unplugs a clean file");
      assert.equal(await p.locator("[data-wc-f][data-wc=cut]").count(), 1, "it shows unplugged");
      // Register the domain: copies that look it up from now on quit.
      await p.waitForFunction(() => scene.thing(), null, { timeout: 6000 });
      await tapAt(p, await p.evaluate(() => scene.thing()));
      assert.equal(await p.evaluate(() => scene.state.registered), true, "a tap on the domain registers it");
      await p.waitForFunction(() => scene.state.phase === 2, null, { timeout: 10000 });
      assert.match(await endText(p), /^Kill switch on/, "the end card says the switch stopped it");
      assert.match(await endText(p), /decrypted nothing/, "and that it decrypted nothing");
    }
    // Then it settles: no frames at all.
    await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 12000 });
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      for (let f = 0; f < 30; f++) await new Promise(requestAnimationFrame);
      return scene.engine.stats().frames - a;
    });
    assert.equal(still, 0, `${id}: settled, no frames`);
    // A tap plays it again, and destroy() mid-play gives the page back.
    const bb = await p.locator("figure").boundingBox();
    await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5);
    await p.waitForTimeout(1500);
    assert.ok(!(await p.evaluate(() => scene.engine.paused.includes("settled"))), `${id}: a tap plays it again`);
    assert.equal(await p.evaluate(() => scene.state.phase), 1, `${id}: a new round is under way`);
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
