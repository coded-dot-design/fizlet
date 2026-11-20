// src/ui/board-ui.ts
var VARS = {
  bg: "--bg",
  surface: "--surface",
  raised: "--raised",
  card: "--card",
  ink: "--ink",
  muted: "--muted",
  line: "--line",
  rim: "--rim",
  sys: "--k-sys",
  cmd: "--k-cmd",
  fire: "--k-fire",
  aim: "--k-aim",
  attack: "--k-attack",
  advance: "--k-advance",
  fallin: "--k-fallin",
  flag: "--k-flag",
  go: "--k-go",
  teamA: "--team-a",
  teamB: "--team-b",
  hurt: "--hurt",
  critical: "--critical",
  sysInk: "--k-sys-ink",
  cmdInk: "--k-cmd-ink",
  fireInk: "--k-fire-ink"
};
var HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
var sheets = /* @__PURE__ */ new Map();
function mount(host, css, opts = {}) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if ("adoptedStyleSheets" in shadow && typeof CSSStyleSheet === "function" && "replaceSync" in CSSStyleSheet.prototype) {
    let sheet = sheets.get(css);
    if (!sheet) (sheet = new CSSStyleSheet()).replaceSync(css), sheets.set(css, sheet);
    if (!shadow.adoptedStyleSheets.includes(sheet)) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
  } else {
    const style = document.createElement("style");
    style.textContent = css;
    shadow.append(style);
  }
  const root = document.createElement("div");
  root.className = "bui";
  root.style.contain = "style";
  root.dataset.theme = opts.theme ?? "dark";
  root.dataset.side = String(opts.side ?? 0);
  shadow.append(root);
  if (opts.palette) applyPalette(root, opts.palette);
  return root;
}
function applyPalette(root, palette) {
  const before = /* @__PURE__ */ new Map();
  for (const [key, value] of Object.entries(palette)) {
    const name = VARS[key];
    if (!name || typeof value !== "string" || !HEX.test(value)) continue;
    before.set(name, root.style.getPropertyValue(name));
    root.style.setProperty(name, value);
  }
  return () => before.forEach((v, name) => v ? root.style.setProperty(name, v) : root.style.removeProperty(name));
}
function readouts(parent, items, onMap = false) {
  const group = parent.ownerDocument.createElement("div");
  group.className = onMap ? "bui-readouts bui-on-map" : "bui-readouts";
  const values = items.map(([label, tone]) => {
    const item = group.appendChild(parent.ownerDocument.createElement("span"));
    item.className = "bui-readout";
    if (tone) item.dataset.tone = tone;
    item.append(label);
    return item.appendChild(parent.ownerDocument.createElement("b"));
  });
  parent.append(group);
  return { group, values };
}
function press(el, fn, signal) {
  let touched = 0;
  el.addEventListener("touchstart", (e) => {
    if (e.cancelable) e.preventDefault();
    else touched = performance.now();
    fn();
  }, { passive: false, signal });
  el.addEventListener("click", () => {
    if (!touched || performance.now() - touched > 800) fn();
    touched = 0;
  }, { signal });
}
function pressCue(root, signal) {
  const key = (e) => e.target?.closest?.(".bui-key");
  const on = { signal };
  root.addEventListener("touchstart", () => {
  }, { passive: true, signal });
  root.addEventListener("keydown", (e) => {
    const k = key(e), code = e.key;
    if (k && (code === "Enter" || code === " " && k.tagName === "BUTTON")) k.classList.add("down");
  }, on);
  const up = (e) => key(e)?.classList.remove("down");
  root.addEventListener("keyup", up, on);
  root.addEventListener("focusout", up, on);
}
var PERF_KEY = "dom-virus:perf";
function setting(button, key, change, signal, fallback = false) {
  let on = fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === "1" || v === "0") on = v === "1";
  } catch {
  }
  const set = (next, save = true) => {
    on = next;
    button.setAttribute("aria-pressed", "" + on);
    if (save)
      try {
        localStorage.setItem(key, on ? "1" : "0");
      } catch {
      }
    change(on);
  };
  button.addEventListener("click", () => set(!on), { signal });
  set(on, false);
  return {
    get on() {
      return on;
    },
    set
  };
}
function slam(sticker) {
  if (!sticker) return;
  sticker.style.animation = "none";
  void sticker.offsetWidth;
  sticker.style.animation = "";
}
function toast(el, text, ms = 3200) {
  el.textContent = text;
  el.hidden = false;
  clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(setTimeout(() => el.hidden = true, ms));
}
var INVERT = "invert(1) hue-rotate(180deg)";
function launch(button, action, opts = {}) {
  const LIFE = 760, PRESS = 90, ease = "cubic-bezier(.15,.8,.3,1)";
  const finish = () => {
    layer?.remove();
    button.classList.remove("bui-igniting");
    opts.done?.();
  };
  let layer = null;
  if (!opts.reduced) {
    const r = button.getBoundingClientRect(), style = getComputedStyle(button), ink = style.color, root = button.closest(".bui");
    layer = document.createElement("div");
    layer.className = "bui-burst";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "fixed", contain: "layout style", zIndex: "2147483000", pointerEvents: "none", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.append(layer);
    const base = style.boxShadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/), sx = base ? +base[1] : 0, sink = base ? +base[2] : 5;
    const look = [button, ...button.querySelectorAll("*")].map((n) => {
      const s = getComputedStyle(n);
      return ["color", "background-color", "border", "border-radius", "font", "letter-spacing", "fill", "stroke", "display", "gap", "align-items", "justify-items", "align-content", "padding", "width", "height"].map((p) => [p, s.getPropertyValue(p)]);
    });
    const copy = () => {
      const c = button.cloneNode(true);
      c.removeAttribute("id");
      c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      [c, ...c.querySelectorAll("*")].forEach((n, i) => look[i].forEach(([p, v]) => n.style.setProperty(p, v)));
      Object.assign(c.style, { position: "absolute", left: "0", top: "0", margin: "0", width: `${r.width}px`, height: `${r.height}px`, boxSizing: "border-box", transition: "none", animation: "none" });
      return c;
    };
    const cap = copy();
    layer.append(cap);
    cap.animate([
      { transform: "translateY(0)", boxShadow: style.boxShadow, filter: "invert(0) hue-rotate(0deg)" },
      { transform: `translate(${sx}px,${sink}px)`, boxShadow: "0 0 0 transparent", filter: INVERT, offset: 0.9 },
      { transform: `translate(${sx}px,${sink}px)`, boxShadow: "0 0 0 transparent", filter: INVERT, opacity: 0 }
    ], { duration: PRESS + 10, fill: "both" });
    const add = (el, frames, ms) => {
      layer.append(el);
      el.animate(frames, { duration: ms, delay: PRESS, easing: ease, fill: "both" });
    };
    const W = r.width, H = r.height, R = Math.min(W, H);
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3), chunk = copy();
      Object.assign(chunk.style, { filter: INVERT, boxShadow: "none", translate: `${sx}px ${sink}px` });
      chunk.style.clipPath = `inset(${row * 50}% ${100 - (col + 1) * 33.34}% ${100 - (row + 1) * 50}% ${col * 33.33}%)`;
      chunk.style.transformOrigin = `${(col + 0.5) * 33.33}% ${(row + 0.5) * 50}%`;
      const cx = (col + 0.5) / 3 - 0.5, cy = (row + 0.5) / 2 - 0.5, dx = cx * W * 1.1 + (i % 2 ? 8 : -8), dy = cy * H * 1.4 - 18, spin = (cx || 0.3) * (col === 1 ? 60 : 120);
      add(chunk, [
        { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${spin}deg) scale(.82)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px,${dy + 46}px) rotate(${spin * 1.4}deg) scale(.6)`, opacity: 0 }
      ], LIFE - PRESS - 60);
    }
    const dot = (cls, size, tone) => {
      const d = document.createElement("i");
      d.className = cls;
      Object.assign(d.style, {
        position: "absolute",
        width: `${size}px`,
        height: `${size}px`,
        left: `${W / 2 - size / 2 + sx}px`,
        top: `${H / 2 - size / 2 + sink}px`,
        borderRadius: cls === "bui-bit" ? "0" : "50%",
        background: cls === "bui-ring" ? "none" : tone,
        border: cls === "bui-ring" ? `3px solid ${tone}` : "0"
      });
      return d;
    };
    add(dot("bui-flash", R * 0.6, "#fff4ff"), [{ transform: "scale(.3)", opacity: 1 }, { transform: "scale(2.6)", opacity: 0.9, offset: 0.35 }, { transform: "scale(3.2)", opacity: 0 }], 320);
    add(dot("bui-flash", R * 0.45, ink), [{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(2.2)", opacity: 1, offset: 0.4 }, { transform: "scale(.2)", opacity: 0 }], 460);
    add(dot("bui-ring", R * 0.5, ink), [{ transform: "scale(.5)", opacity: 1 }, { transform: "scale(5)", opacity: 0 }], 480);
    const css = root ? getComputedStyle(root) : null, tones = opts.tones ?? [ink, ...["--k-attack", "--k-flag", "--k-cmd"].map((v) => css?.getPropertyValue(v).trim() || ink)];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + i % 2 * 0.3, d = R * 0.9 + i % 3 * 18, s = 5 + i % 3 * 2;
      const x = Math.cos(a) * d * (W / H > 1.5 ? 1.5 : 1), y = Math.sin(a) * d;
      add(dot("bui-bit", s, tones[i % tones.length]), [
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: `translate(${x}px,${y}px) rotate(${(i % 2 ? 1 : -1) * (90 + i * 25)}deg)`, opacity: 1, offset: 0.78 },
        { transform: `translate(${x}px,${y + 16}px)`, opacity: 0 }
      ], 640);
    }
    button.classList.add("bui-igniting");
  }
  setTimeout(finish, opts.reduced ? 90 : LIFE);
  action();
}

export {
  mount,
  applyPalette,
  readouts,
  press,
  pressCue,
  PERF_KEY,
  setting,
  slam,
  toast,
  launch
};
