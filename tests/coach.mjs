// fizlet/coach card in Chromium: hidden until shown, shows the step with DOM Battlefield's dashed
// look on the kit tokens, writes nothing when the same card is shown again, rings the control it is
// about, ends, and hide clears the ring.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const js = (await build({ entryPoints: ["src/coach.ts"], bundle: true, format: "iife", globalName: "coach", write: false, logLevel: "silent" })).outputFiles[0].text;

const browser = await chromium.launch(launchOptions());
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent('<div id=host class=bui style="position:relative;width:600px;height:400px"><button id=fire data-k=fire>FIRE</button></div>');
  await page.addStyleTag({ path: "src/ui/board-ui.css" });
  await page.addScriptTag({ content: js });
  const r = await page.evaluate(async () => {
    // Wait on frames, not milliseconds: MutationObserver records are delivered well before a frame.
    const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const host = document.getElementById("host"), fire = document.getElementById("fire");
    let ended = 0, muts = 0;
    const c = coach.card(host, { onEnd: () => ended++ });
    const hidden0 = c.el.hidden;
    c.show("2/10", "FIRE", "Click, Space, or hold FIRE.", fire);
    await frame();
    const shown = [c.el.hidden, c.el.textContent, fire.style.outline, getComputedStyle(c.el).borderStyle];
    const obs = new MutationObserver((l) => (muts += l.length));
    obs.observe(host, { subtree: true, childList: true, characterData: true, attributes: true });
    c.show("2/10", "FIRE", "Click, Space, or hold FIRE.", fire);
    await frame();
    const same = muts;
    obs.disconnect();
    c.el.querySelector("button").click();
    c.hide();
    // Recall is exact: a control with its own inline outline gets it back when the ring moves on.
    const own = host.appendChild(document.createElement("button"));
    own.style.cssText = "outline: 2px solid red; outline-offset: 1px";
    const css0 = own.style.cssText;
    c.show("3/10", "AIM", "Drag to aim.", own);
    const ringedOwn = own.style.outline;
    c.show("4/10", "MOVE", "WASD.", fire);
    const ownBack = own.style.cssText === css0;
    c.remove();
    // A card made with a signal that already aborted is never left on the page.
    const gone = new AbortController();
    gone.abort();
    const late = coach.card(host, { signal: gone.signal });
    return { hidden0, shown, same, ended, after: [c.el.hidden, fire.style.outline], ringedOwn, ownBack, lateOn: late.el.isConnected };
  });
  assert.match(r.ringedOwn, /dashed/, "a control with its own outline is ringed too");
  assert.equal(r.ownBack, true, "its own inline outline comes back exactly");
  assert.equal(r.lateOn, false, "an already-aborted signal leaves no card");
  assert.deepEqual(errs, []);
  assert.equal(r.hidden0, true, "hidden until shown");
  assert.deepEqual(r.shown.slice(0, 2), [false, "2/10FIREClick, Space, or hold FIRE.END PRACTICE"]);
  assert.match(r.shown[2], /dashed/, "the control it is about gets the dashed ring");
  assert.equal(r.shown[3], "dashed", "DOM Battlefield's dashed card border");
  assert.equal(r.same, 0, "showing the same card again writes nothing");
  assert.equal(r.ended, 1, "End runs onEnd");
  assert.deepEqual(r.after, [true, ""], "hide clears the ring");
  console.log("coach card: shows, change-only, rings, ends, hides (Chromium) ok");
} finally {
  await browser.close();
}
