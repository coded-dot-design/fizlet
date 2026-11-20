// src/view-dom.ts
var NUM = Array.from({ length: 256 }, (_, k) => `${k}`);
function viewDom(engine, A, host, o = {}) {
  const cap = A.cap, L = engine.ledger, px = (o.scale ?? 1) * 100, linger = o.linger ?? 0, turn = o.turn !== false, mid = o.center === false ? "" : " translate(-50%,-50%)";
  const nodes = Array(cap).fill(void 0);
  const last = new Float64Array(cap * 4), left = new Float64Array(cap), gen = new Uint32Array(cap);
  const state = new Uint8Array(cap), HIDDEN = 0, SHOWN = 1, DYING = 2, GONE = 3;
  const mq = o.motion == null && typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const still = () => mq ? mq.matches : o.motion === false;
  const hide = (el, i) => {
    L.attr(el, "hidden", "");
    state[i] = HIDDEN;
  };
  const sys = {
    step(_, dt) {
      for (let i = 0; i < cap; i++) if (state[i] === DYING && (left[i] = left[i] - dt) <= 0) state[i] = GONE;
    },
    render() {
      let wrote = false;
      for (let i = 0; i < cap; i++) {
        let el = nodes[i];
        if (A.alive[i]) {
          if (!el) {
            el = nodes[i] = o.make?.(i) ?? host.ownerDocument.createElement("i");
            el.setAttribute("hidden", "");
            host.appendChild(L.add(el));
          }
          if (state[i] !== SHOWN || gen[i] !== A.gen[i]) {
            L.attr(el, "hidden", null);
            L.attr(el, "data-dead", null);
            L.attr(el, "data-side", NUM[A.side[i]]);
            L.attr(el, "data-kind", NUM[A.kind[i]]);
            state[i] = SHOWN;
            gen[i] = A.gen[i];
            last[i * 4] = NaN;
            wrote = true;
          }
          const k = i * 4, x = Math.round(A.x[i] * px), y = Math.round(A.y[i] * px), a = turn ? Math.round(A.a[i] * 100) : 0;
          if (x !== last[k] || y !== last[k + 1] || a !== last[k + 2]) {
            last[k] = x;
            last[k + 1] = y;
            last[k + 2] = a;
            L.style(el, "transform", `translate(${x / 100}px,${y / 100}px)${mid}${turn ? ` rotate(${a / 100}rad)` : ""}`);
            wrote = true;
          }
          const m = A.max[i], hp = m > 0 ? Math.round(Math.max(0, A.hp[i]) / m * 100) : 100;
          if (hp !== last[k + 3]) {
            last[k + 3] = hp;
            L.style(el, "--hp", `${hp / 100}`);
            wrote = true;
          }
          o.paint?.(i, el);
        } else if (el && state[i] === SHOWN) {
          if (linger > 0 && !still()) {
            L.attr(el, "data-dead", "");
            state[i] = DYING;
            left[i] = linger;
            engine.busy(linger);
          } else hide(el, i);
          wrote = true;
        } else if (el && state[i] === GONE) hide(el, i), wrote = true;
      }
      if (wrote) engine.busy();
    }
  };
  engine.add(sys);
  return {
    /** Row i's node (undefined until it first shows). */
    node: (i) => nodes[i],
    /** Stop drawing (the nodes stay until Recall: engine.destroy()). */
    remove: () => engine.remove(sys)
  };
}
export {
  viewDom
};
