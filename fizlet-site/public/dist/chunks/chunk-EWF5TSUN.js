// src/match.ts
var PH = ["intro", "count", "play", "paused", "end"];
var EV = [...PH.slice(0, 4), "won", "lost", "flag"].map((t) => "match:" + t);
var KEYS = ["start", "resume", "surrender", "again", "next"];
var MASK = [1, 0, 0, 6, 24];
var EDIT = "input,textarea,select,[contenteditable],[data-fizlet-ignore]";
var WORDS = {
  intro: ["PLAYER 1", "READY?"],
  count: "GET READY",
  paused: ["BATTLE PAUSED", "GIVE UP?"],
  won: ["STAGE CLEAR", "MISSION COMPLETE"],
  lost: ["INSERT COIN", "GAME OVER"],
  flag: ["WHITE FLAG", "GAME OVER"],
  start: "PRESS START",
  resume: "KEEP FIGHTING",
  surrender: "SURRENDER",
  again: "REMATCH",
  next: "NEW GAME"
};
var svg = (d) => `<svg viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges">${d}</svg>`;
function match(e, root, o = {}) {
  const lab = { ...WORDS, ...o.labels }, L = e.ledger, total = o.seconds ?? 0, beats = o.count ?? 3;
  const codes = o.keys ?? ["Escape", "KeyP"];
  const n = new Float64Array(3);
  n[0] = total;
  const q = new Uint8Array(8), qa = new Float64Array(8);
  let phase = 0, painted = -1, qn = 0, dirty = 0, won = false, going = false, why = "";
  let prev = null, flagT;
  const inert = [];
  const inFrame = () => e.phase === 1 || e.phase === 2;
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ov = null, kick, word, sticker, keys = [];
  if (root) {
    const icon = { ...o.icons }, play = svg('<path d="M22 16v32l26-16Z"/>');
    const cells = [0, 1, 4, 2, 5, 8, 3, 6, 9, 12, 7, 10, 13, 11, 14, 15].map((i, k) => `<rect x="${i % 4 * 16}" y="${(i >> 2) * 16}" width="16" height="16" style="--i:${k}"/>`).join("");
    const art = {
      start: play,
      resume: play,
      again: play,
      surrender: svg(`<g class="bui-cells">${cells}</g><path class="bui-grid" d="M0 16h64M0 32h64M0 48h64M16 0v64M32 0v64M48 0v64"/><rect class="bui-frame" x="1" y="1" width="62" height="62"/><path class="bui-pole" d="M17 9h4v46h-4Z"/><path class="bui-cloth" d="M21 12h24l-6 9 6 9H21Z"/>`),
      next: svg('<path d="M12 18l4-4 18 18-18 18-4-4 14-14Zm18 0 4-4 18 18-18 18-4-4 14-14Z"/>')
    };
    const t = document.createElement("div");
    t.innerHTML = `<div class="bui-overlay" role="dialog" aria-modal="true" tabindex="-1"><div class="bui-sticker"><span> </span><b> </b></div><div class="bui-overlay-keys">${KEYS.map((k, i) => `<button class="bui-sticker-key ${["bui-call", "", "bui-second bui-surrender", "", "bui-second"][i]}" type="button" data-k="${k}">${icon[k] ?? art[k]}<b>${lab[k]}</b></button>`).join("")}</div></div>`;
    ov = L.add(t.firstChild);
    sticker = ov.firstElementChild;
    kick = sticker.firstChild.firstChild;
    word = sticker.lastChild.firstChild;
    keys = [...ov.querySelectorAll("[data-k]")];
    root.append(ov);
    const on = { signal: e.signal };
    const boom = (k, f, r = reduced()) => o.launch ? o.launch(k, f, { reduced: r }) : f();
    const act = [
      (k) => boom(k, m.start),
      () => m.pause(false),
      (k) => {
        if (going) return;
        going = true;
        L.cls(k, "go", true);
        e.start();
        emit(6);
        const r = reduced();
        flagT = setTimeout(() => boom(k, () => !e.signal.aborted && going && m.finish(false, "flag"), r), r ? 0 : 480);
      },
      () => m.restart(),
      () => m.intro()
    ];
    keys.forEach((k, i) => k.addEventListener("click", () => act[i](k), on));
    e.signal.addEventListener("abort", () => clearTimeout(flagT), { once: true });
    addEventListener("keydown", (ev) => {
      if (!codes.includes(ev.code) || ev.metaKey || ev.ctrlKey || ev.altKey || ev.composedPath()[0].closest?.(EDIT)) return;
      if ((phase === 2 || phase === 3) && !going) {
        ev.preventDefault();
        if (!ev.repeat) m.pause();
      }
    }, on);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") phase === 2 && hold(true, 1);
      else if (!ov.hidden) slam();
    }, on);
  }
  function slam() {
    ov.insertBefore(sticker, ov.firstChild);
  }
  function emit(code, a = 0) {
    if (inFrame()) e.events.emit(EV[code], a);
    else if (qn < 8) q[qn] = code, qa[qn++] = a;
  }
  function go(p, a = 0) {
    if (e.signal.aborted) return;
    phase = p;
    emit(p === 4 ? won ? 4 : 5 : p, a);
    if (inFrame()) dirty = 1;
    else paint();
  }
  function hold(on, a = 0) {
    if (on && phase === 2) go(3, a), e.stop();
    else if (!on && phase === 3 && !going) e.start(), go(2, 1);
  }
  function paint() {
    dirty = 0;
    const p = phase, was = painted, fresh = p !== was;
    let w = p === 1 ? [lab.count, "" + n[2]] : p === 4 ? won ? lab.won : why === "flag" ? lab.flag : lab.lost : p === 2 ? lab.paused : lab[PH[p]];
    painted = p;
    if (fresh && p === 4) w = o.end?.({ won, why, clock: n[0] }) || w;
    if (ov) {
      const show = p !== 2 && !o.hide?.includes(PH[p]), doc = ov.getRootNode(), act = doc.activeElement;
      L.attr(ov, "hidden", show ? null : "");
      L.attr(ov, "data-phase", PH[p]);
      keys.forEach((k, i) => (L.style(k, "display", MASK[p] >> i & 1 ? "" : "none"), L.cls(k, "go", false)));
      if (show) {
        L.text(kick, w[0]);
        L.text(word, w[1]);
        L.attr(ov, "aria-label", `${w[0]} ${w[1]}`);
        slam();
        for (const c of root.children) if (c !== ov && !c.hasAttribute("inert")) inert.push(c), L.attr(c, "inert", "");
        const k = keys[Math.log2(MASK[p] & -MASK[p])];
        if (fresh && (!act || act === doc.body || root.contains(act))) {
          if (!ov.contains(act)) prev = act;
          (k ?? ov).focus({ preventScroll: true });
        }
      } else {
        for (const c of inert) L.attr(c, "inert", null);
        inert.length = 0;
        if (prev?.isConnected && (!act || act === doc.body || ov.contains(act))) prev.focus({ preventScroll: true });
        prev = null;
      }
    }
    if (fresh && was >= 0) o.on?.(PH[p]);
  }
  const system = {
    read(x) {
      for (let i = 0; i < qn; i++) x.events.emit(EV[q[i]], qa[i]);
      qn = 0;
    },
    step(_, dt) {
      if (phase === 1 || phase === 2) e.busy();
      if (phase === 1) {
        const c = Math.ceil((n[1] -= dt) - 1e-9);
        if (c <= 0) go(
          2
          /* PLAY */
        );
        else if (c !== n[2]) n[2] = c, emit(1, c), dirty = 1;
      } else if (phase === 2) {
        if (!total) n[0] += dt;
        else if ((n[0] -= dt) <= 0) n[0] = 0, m.finish(o.timeUp?.() ?? false, "time");
      }
    },
    render() {
      if (dirty) paint();
    }
  };
  e.add(system);
  const m = {
    get phase() {
      return PH[phase];
    },
    /** Seconds left (timed match) or played so far (no limit). Counts only in play. */
    get clock() {
      return n[0];
    },
    /** The overlay element (null headless): add your own content, style it by `[data-phase]`. */
    el: ov,
    /** PRESS START: from the intro (or the result), begin a round. */
    start() {
      if (phase === 0 || phase === 4) m.restart();
    },
    /** Pause (true), resume (false) or toggle (no argument). Only during play. */
    pause(on) {
      hold(
        on ?? phase === 2
        /* PLAY */
      );
    },
    /** End the match now (a win, a loss, "flag" for surrender). */
    finish(w, y = "game") {
      if (phase === 0 || phase === 4) return;
      won = w;
      why = y;
      going = false;
      e.start();
      go(4, n[0]);
    },
    /** A new round from any phase: begin(), the clock reset, then the countdown. */
    restart() {
      n[0] = total;
      n[1] = n[2] = beats;
      going = false;
      o.begin?.();
      e.start();
      beats > 0 ? go(1, beats) : go(
        2
        /* PLAY */
      );
    },
    /** Back to the start screen (NEW GAME). */
    intro() {
      going = false;
      e.start();
      go(
        0
        /* INTRO */
      );
    },
    system
  };
  paint();
  return m;
}

export {
  match
};
