import {
  applyPalette
} from "./chunks/chunk-MA7XMWAR.js";

// src/embed.ts
var KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a", "enter"];
var TOGGLE_CSS = ":host{all:initial;position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:2147483600}button{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;font:800 12px/1 ui-monospace,monospace;letter-spacing:.08em;color:#07060f;background:#39ffb0;border:2px solid #07060f;border-radius:10px;box-shadow:calc(4px*var(--shadow-x,0)) calc(4px*var(--shadow-y,1)) 0 #1d6a40;cursor:pointer}button:active{transform:translate(calc(4px*var(--shadow-x,0)),calc(4px*var(--shadow-y,1)));box-shadow:none}button.open{background:#f6f3ff;box-shadow:calc(4px*var(--shadow-x,0)) calc(4px*var(--shadow-y,1)) 0 #8f88b8}";
function embed(load, cfg) {
  const ctl = new AbortController(), on = { signal: ctl.signal };
  const egg = cfg.easterEgg === true ? {} : cfg.easterEgg || null;
  const coarse = matchMedia("(pointer: coarse)");
  const allowed = (s, d) => (s = s ?? d, s === "all" || s === "mobile" === coarse.matches);
  const ignore = `input,textarea,select,[contenteditable],[data-${cfg.name}-ignore]`;
  let host = null, game = null, pending = null;
  let toggle = null, unlocked = !egg;
  let gen = 0;
  async function open() {
    if (game || pending || ctl.signal.aborted) return pending;
    const my = ++gen;
    const p = (async () => {
      const mount = await load();
      if (my !== gen || ctl.signal.aborted) return;
      host = document.createElement("div");
      host.setAttribute(`data-${cfg.name}-ignore`, "");
      host.setAttribute("data-fizlet-host", cfg.name);
      document.body.append(host);
      if (cfg.palette) applyPalette(host, cfg.palette);
      game = mount(host, cfg);
      paint();
    })().finally(() => pending === p && (pending = null));
    return pending = p;
  }
  function close() {
    gen++;
    pending = null;
    game?.destroy();
    host?.remove();
    game = host = null;
    paint();
  }
  function unlock() {
    unlocked = true;
    void open();
  }
  function paint() {
    if (!toggle && unlocked && egg?.toggle !== false) {
      const h = document.createElement("div");
      h.setAttribute(`data-${cfg.name}-ignore`, "");
      const root = h.attachShadow({ mode: "open" }), style = document.createElement("style");
      style.textContent = TOGGLE_CSS;
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.addEventListener("click", () => game ? close() : void open(), on);
      root.append(style, toggle);
      document.body.append(h);
      ctl.signal.addEventListener("abort", () => h.remove());
    }
    if (toggle) {
      toggle.className = game ? "open" : "";
      toggle.textContent = game ? "\u2715 CLOSE" : `\u25B6 ${(cfg.label ?? cfg.name).toUpperCase()}`;
      toggle.setAttribute("aria-label", game ? `Close ${cfg.label ?? cfg.name}` : `Play ${cfg.label ?? cfg.name}`);
    }
  }
  addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && (game || pending)) return close();
  }, on);
  if (egg) {
    const seq = egg.sequence === false ? null : egg.sequence === void 0 || egg.sequence === "konami" ? KONAMI : egg.sequence.map((k) => k.toLowerCase());
    let at = 0, t = 0;
    if (seq)
      addEventListener("keydown", (ev) => {
        if (!allowed(egg.scope?.sequence, "desktop") || ev.target?.closest?.(ignore)) return;
        const now = performance.now();
        if (now - t > 1500) at = 0;
        t = now;
        const k = ev.key.toLowerCase();
        at = k === seq[at] ? at + 1 : k === seq[0] ? 1 : 0;
        if (at === seq.length) at = 0, unlock();
      }, on);
    const g = egg.gesture === false ? null : egg.gesture ?? { on: `[data-${cfg.name}-trigger]`, type: "hold-tap" };
    if (g) {
      let target = null, x = 0, y = 0, timer = 0, armedUntil = 0, lastTap = 0;
      const clear = () => (clearTimeout(timer), timer = 0, target = null);
      addEventListener("pointerdown", (ev) => {
        if (!allowed(egg.scope?.gesture, "mobile")) return;
        const el = ev.target?.closest?.(g.on);
        if (!el || ev.target.closest(ignore)) return clear();
        target = el;
        x = ev.clientX;
        y = ev.clientY;
        const now = performance.now();
        if (g.type === "hold-tap" && now < armedUntil) return void (armedUntil = 0, unlock());
        if (g.type === "double-tap" && now - lastTap < 350) return void (lastTap = 0, unlock());
        lastTap = now;
        if (g.type !== "double-tap")
          timer = window.setTimeout(() => {
            timer = 0;
            if (g.type === "long-press") unlock();
            else armedUntil = performance.now() + 5e3;
          }, g.type === "long-press" ? 700 : 900);
      }, on);
      addEventListener("pointermove", (ev) => target && (ev.clientX - x) ** 2 + (ev.clientY - y) ** 2 > 144 && clear(), on);
      addEventListener("pointerup", () => timer && clear(), on);
      addEventListener("pointercancel", clear, on);
      ctl.signal.addEventListener("abort", clear);
    }
    if (egg.click)
      addEventListener("click", (ev) => {
        if (allowed(egg.scope?.click, "all") && ev.target?.closest?.(egg.click)) ev.preventDefault(), unlock();
      }, on);
  } else if (cfg.open === false) paint();
  else void open();
  return {
    open,
    close,
    unlock,
    get opened() {
      return !!game;
    },
    get unlocked() {
      return unlocked;
    },
    /** Remove every listener, the toggle and the game (the game restores the page). */
    destroy() {
      close();
      ctl.abort();
    }
  };
}
export {
  embed
};
