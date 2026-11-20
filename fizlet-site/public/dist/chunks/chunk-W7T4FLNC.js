import {
  hypot
} from "./chunk-3IN3G3AQ.js";

// src/pad.ts
var ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5l5-5 5 5"/></svg>';
var DIRS = ["Up", "Down", "Left", "Right"];
function stickAt(dx, dy, out) {
  const d = hypot(dx, dy), k = d < 0.15 ? 0 : (Math.min(1, d) - 0.15) / (1 - 0.15) / d;
  out[0] = dx * k;
  out[1] = dy * k;
}
function dpadAt(dx, dy) {
  const d = hypot(dx, dy), t = d * 0.3827;
  return d < 0.25 ? 0 : (dy < -t ? 1 : dy > t ? 2 : 0) | (dx < -t ? 4 : dx > t ? 8 : 0);
}
var STICK = '<div class="bui-stick" role="application" aria-label="Move: drag in any direction"><i class="bui-knob"></i></div>';
var arrows = (move) => move.map((m, d) => m ? `<button type="button" class="bui-arcade bui-sys" data-d="${d}" aria-label="${DIRS[d]}">${ARROW}</button>` : "").join("");
var esc = (t) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
function pad(e, c, o = {}) {
  const acts = o.actions ?? [], move = o.move ?? ["up", "down", "left", "right"];
  const ctl = new AbortController(), on = { signal: ctl.signal };
  e.signal.addEventListener("abort", () => ctl.abort(), on);
  const el = e.ledger.add(document.createElement("div"));
  el.className = "bui-pad";
  el.dataset.hand = o.side ?? "right";
  el.setAttribute("data-fizlet-ignore", "");
  el.innerHTML = `<div class="bui-pad-move"></div><div class="bui-pad-keys">${acts.map((a, i) => `<button type="button" class="bui-arcade bui-${(a.role ?? (i ? "sys" : "fire")).replace(/[^a-z-]/g, "")}${i ? "" : " bui-primary"}" data-i="${i}" aria-label="${esc(a.name ?? a.label)}"${a.toggle ? ' aria-pressed="false"' : ""}>${a.icon ?? ""}${a.label ? `<small>${esc(a.label)}</small>` : ""}${a.key ? `<kbd>${esc(a.key)}</kbd>` : ""}</button>`).join("")}</div>`;
  const moveEl = el.firstChild, kb = el.lastChild.children;
  const lit = new Uint8Array(acts.length);
  let dk = [], knob = null, mask = 0, scheme = "";
  const g = new Float64Array(9), v = new Float64Array(2);
  let pk = null;
  g[7] = -1;
  const paint = (i, now) => {
    lit[i] = now ? 1 : 0;
    kb[i].setAttribute("aria-pressed", String(now));
  };
  const tap = (i, hold) => {
    const a = acts[i];
    if (a.toggle) return paint(i, (c.press(a.intent, !c.down(a.intent)), c.down(a.intent)));
    c.press(a.intent);
    if (!(hold && a.hold)) c.press(a.intent, false);
  };
  const dir = (m) => {
    for (let d = 0, b = 1; d < 4; d++, b <<= 1)
      if ((m ^ mask) & b && move[d]) c.press(move[d], (m & b) > 0), dk[d]?.classList.toggle("down", (m & b) > 0);
    mask = m;
  };
  const drag = (ev) => {
    const dx = (ev.clientX - g[0]) / g[2], dy = (ev.clientY - g[1]) / g[2];
    if (!knob) return dir(dpadAt(dx, dy));
    stickAt(dx, dy, v);
    c.steer(v[0], v[1]);
    const k = g[2] / Math.max(1, hypot(dx, dy));
    g[3] = dx * k;
    g[4] = dy * k;
  };
  const letGo = (t) => {
    const i = t.dataset.i, d = t.dataset.d;
    t.classList.remove("down");
    if (i) acts[+i].hold && c.press(acts[+i].intent, false);
    else if (d) c.press(move[+d], false);
    else if (g[7] = -1, knob) c.steer(0, 0, false), g[3] = g[4] = 0;
    else dir(0);
  };
  const release = () => el.querySelectorAll(".down").forEach(letGo);
  const handle = (ev) => {
    const p = ev, at = p.target, key = at.closest("[data-i],[data-d]");
    const mv = at.closest(".bui-stick,.bui-dpad"), t = mv ?? key, i = key?.dataset.i, d = key?.dataset.d;
    if (!t) return;
    if (p.type === "click") {
      if (key && key === pk && p.timeStamp - g[8] < 1e3) return void (pk = null);
      if (!p.detail && key) i ? tap(+i, false) : (c.press(move[+d]), c.press(move[+d], false));
    } else if (p.type === "pointerdown") {
      if (p.button > 0) return;
      pk = key;
      g[8] = p.timeStamp;
      p.preventDefault();
      try {
        t.setPointerCapture(p.pointerId);
      } catch {
      }
      if (i && acts[+i].toggle) return tap(+i, true);
      t.classList.add("down");
      if (!mv) return i ? tap(+i, true) : c.press(move[+d]);
      g[7] = p.pointerId;
      const r = t.getBoundingClientRect();
      g[0] = r.left + r.width / 2;
      g[1] = r.top + r.height / 2;
      g[2] = Math.max(1, r.width * (knob ? 0.36 : 0.5));
      drag(p);
    } else if (p.type === "pointermove") {
      if (mv && p.pointerId === g[7]) drag(p);
    } else if (mv ? p.pointerId === g[7] : t.classList.contains("down")) letGo(t);
  };
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture", "click"]) el.addEventListener(type, handle, on);
  const system = e.add({
    render() {
      if (knob && (g[3] !== g[5] || g[4] !== g[6])) {
        g[5] = g[3];
        g[6] = g[4];
        knob.style.translate = g[3] || g[4] ? `${g[3].toFixed(1)}px ${g[4].toFixed(1)}px` : "";
      }
      for (let i = 0; i < acts.length; i++) if (acts[i].toggle && c.down(acts[i].intent) !== (lit[i] === 1)) paint(i, !lit[i]);
    }
  });
  const setScheme = (s) => {
    if (s === scheme) return;
    release();
    scheme = el.dataset.scheme = s;
    g[3] = g[4] = g[5] = g[6] = 0;
    moveEl.innerHTML = s === "stick" ? STICK : s === "dpad" ? `<div class="bui-dpad" role="group" aria-label="Move">${arrows(move)}</div>` : arrows(move);
    knob = moveEl.querySelector("i");
    dk = [];
    moveEl.querySelectorAll("[data-d]").forEach((b) => dk[+b.dataset.d] = b);
  };
  setScheme(o.scheme ?? "stick");
  (o.host ?? e.root).append(el);
  return {
    /** The pad's root element (`.bui-pad`). */
    el,
    get scheme() {
      return scheme;
    },
    setScheme,
    /** Let go of every finger, remove the listeners and the pad (engine.destroy() does this too). */
    destroy() {
      release();
      ctl.abort();
      e.remove(system);
      el.remove();
    }
  };
}

export {
  stickAt,
  dpadAt,
  pad
};
