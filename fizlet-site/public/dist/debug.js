// src/debug.ts
var guarded = /* @__PURE__ */ new Set();
var patched = false;
function hit() {
  for (const e of guarded) if (e.phase === 2) e.violations = (e.violations ?? 0) + 1;
}
function patch() {
  if (patched || typeof Element !== "function") return;
  patched = true;
  const P = Element.prototype, H = HTMLElement.prototype;
  for (const name of ["getBoundingClientRect", "getClientRects"]) {
    const f = P[name];
    P[name] = function(...a) {
      hit();
      return f.apply(this, a);
    };
  }
  for (const [proto, props] of [
    [P, ["clientWidth", "clientHeight", "clientTop", "clientLeft", "scrollWidth", "scrollHeight", "scrollTop", "scrollLeft"]],
    [H, ["offsetWidth", "offsetHeight", "offsetTop", "offsetLeft"]]
  ])
    for (const prop of props) {
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (d?.get) Object.defineProperty(proto, prop, { ...d, get() {
        hit();
        return d.get.call(this);
      } });
    }
  const gcs = getComputedStyle;
  globalThis.getComputedStyle = (el, pseudo) => (hit(), gcs(el, pseudo));
}
function guardLayout(engine) {
  patch();
  const e = engine;
  e.violations = 0;
  guarded.add(e);
  engine.signal.addEventListener("abort", () => guarded.delete(e));
  return () => guarded.delete(e);
}
var TOUCH = "pointerdown pointerup pointercancel gotpointercapture lostpointercapture touchstart touchend touchcancel click";
var named = (t) => {
  if (!(t instanceof Element)) return String(t);
  const id = t.getAttribute("id"), cls = t.getAttribute("class")?.trim().replace(/\s+/g, ".");
  const host = t.getRootNode?.()?.host;
  return t.tagName.toLowerCase() + (id ? "#" + id : "") + (cls ? "." + cls : "") + (host ? " in " + named(host) : "");
};
function touchLog(o = {}) {
  const N = o.lines ?? 14, ctl = new AbortController(), lines = [], t0 = performance.now();
  const el = document.createElement("pre");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:fixed;left:0;bottom:0;z-index:99999;margin:0;padding:4px;pointer-events:none;font:11px monospace;white-space:pre;background:#000c;color:#9f9";
  (o.host ?? document.body).append(el);
  const log = (ev) => {
    const p = ev, at = p.changedTouches?.[0] ?? p;
    const who = p.pointerType ? p.pointerType + " " + p.pointerId : p.touches ? "touches " + p.touches.length : "";
    lines.push(Math.round(performance.now() - t0) + " " + ev.type + " " + who + " " + Math.round(at.clientX) + "," + Math.round(at.clientY) + " " + named(ev.composedPath?.()[0] ?? ev.target));
    if (lines.length > N) lines.shift();
    el.textContent = lines.join("\n");
  };
  for (const t of (TOUCH + (o.moves ? " pointermove touchmove" : "")).split(" ")) addEventListener(t, log, { capture: true, passive: true, signal: ctl.signal });
  return {
    /** The overlay (a fixed `<pre>`). */
    el,
    /** The lines on screen, oldest first. */
    lines,
    /** Remove the box and every listener. */
    stop() {
      ctl.abort();
      el.remove();
    }
  };
}
export {
  guardLayout,
  touchLog
};
