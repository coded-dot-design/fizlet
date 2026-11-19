// @fzlt/core/debug's touchLog() (Node, on tests/fake-dom.mjs): lines appear for pointer and touch
// events with the element hit (inside a shadow root too), the log keeps the last N, moves only when
// asked, listeners are passive captures that cancel nothing, and stop() removes the box and every
// listener. tests/webkit-touchlog.mjs runs it in Chromium and WebKit.
import test from "node:test";
import assert from "node:assert/strict";
import { installPage, El } from "./fake-dom.mjs";

const { touchLog } = await import("../src/debug.ts");

test("debug touchLog: a line per event with the element hit; the last N; moves when asked; stop() gives the page back", () => {
  const page = installPage();
  try {
    const body = page.doc.body;
    const key = body.appendChild(page.doc.createElement("button"));
    key.setAttribute("id", "fire");
    key.setAttribute("class", "bui-key  bui-primary");
    const opts = [];
    const add = globalThis.addEventListener;
    globalThis.addEventListener = (t, fn, o) => (opts.push([t, o.capture, o.passive]), add(t, fn, o));
    const log = touchLog({ lines: 3 });
    globalThis.addEventListener = add;
    assert.equal(log.el.parentNode, body, "the box is on the page");
    assert.equal(log.el.tagName, "PRE");
    assert.equal(log.el.getAttribute("aria-hidden"), "true");
    assert.match(log.el.style.cssText, /position: fixed/);
    assert.match(log.el.style.cssText, /pointer-events: none/, "it never takes a touch itself");
    assert.ok(opts.length >= 9 && opts.every(([, c, p]) => c && p), "every listener captures and is passive");
    assert.ok(!opts.some(([t]) => t === "pointermove"), "no moves by default");
    const down = page.win.dispatch("pointerdown", { target: key, pointerType: "touch", pointerId: 7, clientX: 10.4, clientY: 20.6 });
    assert.equal(down.defaultPrevented, undefined, "nothing is cancelled");
    assert.match(log.lines[0], /^\d+ pointerdown touch 7 10,21 button#fire\.bui-key\.bui-primary$/);
    // A touch event: the touch count and the changed touch's place.
    page.win.dispatch("touchend", { target: key, touches: [], changedTouches: [{ clientX: 3, clientY: 4 }] });
    assert.match(log.lines[1], / touchend touches 0 3,4 button#fire/);
    // Inside a shadow root: the real target from composedPath, and its host.
    const host = body.appendChild(page.doc.createElement("div"));
    host.setAttribute("id", "game");
    const inner = new El("svg", page.doc);
    inner.getRootNode = () => ({ host });
    page.win.dispatch("lostpointercapture", { target: host, composedPath: () => [inner, host], pointerType: "touch", pointerId: 7, clientX: 0, clientY: 0 });
    assert.match(log.lines[2], / lostpointercapture touch 7 0,0 svg in div#game$/);
    page.win.dispatch("pointerup", { target: key, pointerType: "mouse", pointerId: 1, clientX: 1, clientY: 1 });
    assert.equal(log.lines.length, 3, "keeps the last 3");
    assert.match(log.lines[0], /touchend/, "the oldest dropped");
    assert.equal(log.el.textContent, log.lines.join("\n"), "the box shows the lines");
    page.win.dispatch("pointermove", { target: key, pointerType: "touch", pointerId: 7, clientX: 1, clientY: 1 });
    assert.doesNotMatch(log.el.textContent, /pointermove/, "moves are not logged by default");
    log.stop();
    assert.equal(log.el.parentNode, null, "stop() removes the box");
    assert.equal(page.win.listeners.length, 0, "and every listener");
    const moves = touchLog({ moves: true, host: key });
    assert.equal(moves.el.parentNode, key, "host");
    page.win.dispatch("pointermove", { target: key, pointerType: "pen", pointerId: 2, clientX: 5, clientY: 6 });
    assert.match(moves.lines[0], / pointermove pen 2 5,6 /, "moves when asked");
    moves.stop();
  } finally {
    page.restore();
  }
});
