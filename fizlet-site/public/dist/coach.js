// src/coach.ts
function flag(key, value = "1") {
  return {
    get on() {
      try {
        return localStorage.getItem(key) === value;
      } catch {
        return false;
      }
    },
    /** Set it (the player turned tips off, finished the tour…). */
    mark() {
      try {
        localStorage.setItem(key, value);
      } catch {
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
      }
    }
  };
}
function tour(e, o = {}) {
  const steps = Math.max(0, (o.steps ?? 10) | 0), tips = Math.max(1, (o.tips ?? 7) | 0), every = o.every ?? 6;
  const n = new Int32Array([0, -1]), t = new Float64Array(1);
  return {
    /** Seconds on this step (after the last: since it ended). A typed array: read time[0]. */
    time: t,
    /** The step the player is on; `steps` once the tutorial is over. */
    get step() {
      return n[0];
    },
    get done() {
      return n[0] >= steps;
    },
    steps,
    /** Count dt on this step. Call once a step, before you test whether it is done. */
    tick(dt) {
      t[0] += dt;
    },
    /** The current step is done: on to the next (time back to 0, `coach:step` on the ring). False after the last. */
    pass() {
      if (n[0] >= steps) return false;
      n[0]++;
      t[0] = 0;
      e.events.emit("coach:step", n[0], steps);
      return true;
    },
    /** The card to draw, only when it changed since the last call: a step (0…steps − 1), a tip
     *  (steps + 0…tips − 1), or -1 for no change. */
    show() {
      const k = n[0] < steps ? n[0] : steps + (t[0] / every | 0) % tips;
      if (k === n[1]) return -1;
      n[1] = k;
      return k;
    },
    /** Back to step 0 (a new practice run). */
    reset() {
      n[0] = 0;
      n[1] = -1;
      t[0] = 0;
    }
  };
}
var LOOK = "position:absolute;left:50%;top:max(76px,calc(env(safe-area-inset-top) + 66px));transform:translateX(-50%);z-index:40;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:2px 12px;width:min(520px,calc(100% - 24px));box-sizing:border-box;padding:8px 12px;background:var(--surface);border:2px dashed var(--k-sys);border-radius:8px;color:var(--muted);font:700 11px/1.35 ui-monospace,monospace";
var RING = "3px dashed var(--k-sys-ink)";
function card(host, o = {}) {
  const doc = host.ownerDocument, el = doc.createElement("div");
  el.className = "fizlet-coach";
  el.setAttribute("role", "status");
  el.style.cssText = LOOK;
  el.hidden = true;
  el.innerHTML = '<span style="grid-row:span 2;color:var(--k-sys-ink)"></span><b style="color:var(--k-sys-ink);letter-spacing:2px;font-size:13px"></b><small style="grid-column:2;font-size:11px"></small>' + (o.onEnd ? '<button class="bui-arcade bui-attack" type="button" style="grid-row:1/span 2;grid-column:3;min-height:36px;font-size:10px"></button>' : "");
  const [count, title, text] = [el.children[0], el.children[1], el.children[2]];
  const end = el.children[3];
  if (end) {
    end.textContent = o.end ?? "END PRACTICE";
    end.addEventListener("click", () => o.onEnd(), { signal: o.signal });
  }
  host.append(el);
  let ringed = null, was = ["", ""];
  const set = (n, v) => {
    if (n.textContent !== v) n.textContent = v;
  };
  const unring = () => {
    if (ringed) ringed.style.outline = was[0], ringed.style.outlineOffset = was[1];
    ringed = null;
  };
  const api = {
    el,
    /** Show a card (writes only what changed); `target` gets the dashed ring. */
    show(c, t, body, target) {
      set(count, c);
      set(title, t);
      set(text, body);
      if (target !== ringed) {
        unring();
        if (target) was = [target.style.outline, target.style.outlineOffset], target.style.outline = RING, target.style.outlineOffset = "6px", ringed = target;
      }
      el.hidden = false;
    },
    hide() {
      unring();
      el.hidden = true;
    },
    remove() {
      api.hide();
      el.remove();
    }
  };
  o.signal?.aborted ? api.remove() : o.signal?.addEventListener("abort", api.remove, { once: true });
  return api;
}
export {
  card,
  flag,
  tour
};
