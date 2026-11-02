// A small fake DOM for the Node tests of page bricks (embed, slot, ui, debug): elements with
// attributes, inline style, classes, children and listeners that honour an AbortSignal, plus the
// window pieces those bricks touch (matchMedia, IntersectionObserver, idle callbacks). It models
// only what the bricks call; the browser suite (tests/browser.mjs) runs them in Chromium.

const kebab = (p) => (p.startsWith("--") ? p : p.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));

/** Listeners keyed by type; `{ signal }` removes one on abort, as the DOM does. */
export class Target {
  listeners = [];
  addEventListener(type, fn, opts) {
    const signal = typeof opts === "object" ? opts?.signal : undefined;
    if (signal?.aborted) return;
    const l = { type, fn, once: typeof opts === "object" && !!opts?.once };
    this.listeners.push(l);
    signal?.addEventListener("abort", () => this.removeEventListener(type, fn), { once: true });
  }
  removeEventListener(type, fn) {
    const i = this.listeners.findIndex((l) => l.type === type && l.fn === fn);
    if (i >= 0) this.listeners.splice(i, 1);
  }
  /** Calls every listener of `type` with `ev` (an object; `target` defaults to this). */
  dispatch(type, ev = {}) {
    ev.target ??= this;
    ev.type = type;
    ev.preventDefault ??= () => (ev.defaultPrevented = true);
    for (const l of this.listeners.slice()) if (l.type === type) (l.once && this.removeEventListener(type, l.fn), l.fn(ev));
    return ev;
  }
  /** Live listeners, optionally of one type. */
  count(type) {
    return type ? this.listeners.filter((l) => l.type === type).length : this.listeners.length;
  }
}

class Style {
  #props = new Map(); // name → [value, priority]
  getPropertyValue(p) {
    return this.#props.get(p)?.[0] ?? "";
  }
  getPropertyPriority(p) {
    return this.#props.get(p)?.[1] ?? "";
  }
  setProperty(p, v, pr = "") {
    if (v === "" || v == null) this.#props.delete(p);
    else this.#props.set(p, [String(v), pr]);
  }
  removeProperty(p) {
    const v = this.getPropertyValue(p);
    this.#props.delete(p);
    return v;
  }
  get cssText() {
    return [...this.#props].map(([p, [v, pr]]) => `${p}: ${v}${pr ? " !" + pr : ""};`).join(" ");
  }
  set cssText(t) {
    this.#props.clear();
    for (const decl of String(t).split(";")) {
      const i = decl.indexOf(":");
      if (i > 0) this.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).replace(/!important/, "").trim(), /!important/.test(decl) ? "important" : "");
    }
  }
}
/** el.style: the CSSStyleDeclaration methods, and camelCase properties (`style.contain = …`). */
const styleOf = () =>
  new Proxy(new Style(), {
    get: (s, k) => (k in s ? (typeof s[k] === "function" ? s[k].bind(s) : s[k]) : typeof k === "string" ? s.getPropertyValue(kebab(k)) : undefined),
    set: (s, k, v) => (k in s ? (s[k] = v) : s.setProperty(kebab(k), v), true),
  });

/** One simple selector (`tag`, `.class`, `[attr]`, combined like `div.a[b]`) or a comma list of them. */
function matches(el, selector) {
  return selector.split(",").some((one) => {
    const s = one.trim().replace(/^:scope\s*>\s*/, "");
    const tag = s.match(/^[a-z][a-z0-9-]*/i)?.[0];
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    for (const [, c] of s.matchAll(/\.([\w-]+)/g)) if (!el.classList.contains(c)) return false;
    for (const [, a] of s.matchAll(/\[([\w-]+)\]/g)) if (!el.hasAttribute(a)) return false;
    return true;
  });
}

export class El extends Target {
  parentNode = null;
  children = [];
  shadowRoot = null;
  rect = { left: 0, top: 0, width: 300, height: 150 };
  #attrs = new Map();
  #style = null;
  #text = "";
  constructor(tag = "div", doc = null) {
    super();
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
  }
  get style() {
    return (this.#style ??= styleOf());
  }
  setAttribute(n, v) {
    if (n === "style") return void ((this.style.cssText = v), this.#attrs.set(n, ""));
    this.#attrs.set(n, String(v));
  }
  getAttribute(n) {
    if (n === "style") return this.#attrs.has(n) || this.#style?.cssText ? this.#style?.cssText ?? "" : null;
    return this.#attrs.has(n) ? this.#attrs.get(n) : null;
  }
  hasAttribute(n) {
    return this.getAttribute(n) !== null;
  }
  /** In document order, as the browser keeps them: a new attribute goes last, a changed one stays. */
  getAttributeNames() {
    return [...this.#attrs.keys()].filter((n) => this.hasAttribute(n));
  }
  removeAttribute(n) {
    if (n === "style") this.#style = null;
    this.#attrs.delete(n);
  }
  get className() {
    return this.getAttribute("class") ?? "";
  }
  set className(v) {
    this.setAttribute("class", v);
  }
  get classList() {
    const el = this, list = () => el.className.split(/\s+/).filter(Boolean);
    return {
      contains: (c) => list().includes(c),
      add: (...cs) => el.setAttribute("class", [...new Set([...list(), ...cs])].join(" ")),
      remove: (...cs) => el.hasAttribute("class") && el.setAttribute("class", list().filter((c) => !cs.includes(c)).join(" ")),
      toggle(c, on = !list().includes(c)) {
        on ? this.add(c) : this.remove(c);
        return on;
      },
    };
  }
  get dataset() {
    const el = this;
    const name = (k) => "data-" + kebab(k);
    return new Proxy({}, { get: (_, k) => el.getAttribute(name(k)) ?? undefined, set: (_, k, v) => (el.setAttribute(name(k), v), true) });
  }
  get textContent() {
    return this.#text + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this.children.length = 0;
    this.#text = String(v);
  }
  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n === this.ownerDocument?.documentElement;
  }
  append(...nodes) {
    for (const n of nodes) typeof n === "string" ? (this.#text += n) : this.appendChild(n);
  }
  appendChild(n) {
    n.remove?.();
    n.parentNode = this;
    this.children.push(n);
    return n;
  }
  remove() {
    const p = this.parentNode;
    if (!p) return;
    p.children.splice(p.children.indexOf(this), 1);
    this.parentNode = null;
  }
  attachShadow() {
    return (this.shadowRoot = new El("#shadow-root", this.ownerDocument));
  }
  closest(selector) {
    for (let n = this; n && n instanceof El; n = n.parentNode) if (matches(n, selector)) return n;
    return null;
  }
  querySelectorAll(selector) {
    const out = [], scoped = selector.trim().startsWith(":scope");
    const walk = (n) => {
      for (const c of n.children) {
        if (matches(c, selector)) out.push(c);
        if (!scoped) walk(c);
      }
    };
    walk(this);
    return out;
  }
  getBoundingClientRect() {
    return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height, x: this.rect.left, y: this.rect.top };
  }
}

export class Doc extends El {
  constructor() {
    super("#document");
    this.ownerDocument = this;
    this.documentElement = new El("html", this);
    this.body = this.documentElement.appendChild(new El("body", this));
  }
  createElement(tag) {
    return new El(tag, this);
  }
  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

/** A media query list whose `matches` the test flips with `set(on)` (fires "change"). */
export function mediaQuery(on = false) {
  const q = new Target();
  q.matches = on;
  q.set = (v) => ((q.matches = v), q.dispatch("change", { matches: v }));
  return q;
}

/**
 * Installs a fake page on globalThis (document, window listeners, matchMedia, IntersectionObserver,
 * requestIdleCallback, getComputedStyle, Element / HTMLElement) and returns its handles; `restore()`
 * puts the real globals back. `media` maps a query string to its mediaQuery() (created on demand).
 */
export function installPage() {
  const doc = new Doc(), win = new Target(), media = {}, observers = [], idle = [];
  const keys = ["document", "addEventListener", "removeEventListener", "matchMedia", "IntersectionObserver", "requestIdleCallback", "cancelIdleCallback", "getComputedStyle", "Element", "HTMLElement", "window"];
  const keep = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  class IO {
    constructor(cb, opts) {
      this.cb = cb;
      this.opts = opts;
      this.els = [];
      observers.push(this);
    }
    observe(el) {
      this.els.push(el);
    }
    disconnect() {
      this.els.length = 0;
      observers.splice(observers.indexOf(this), 1);
    }
    /** Test hook: report every observed element as (not) intersecting. */
    fire(isIntersecting = true) {
      this.cb(this.els.map((target) => ({ target, isIntersecting })), this);
    }
  }
  const set = {
    document: doc,
    addEventListener: win.addEventListener.bind(win),
    removeEventListener: win.removeEventListener.bind(win),
    matchMedia: (q) => (media[q] ??= mediaQuery(false)),
    IntersectionObserver: IO,
    requestIdleCallback: (cb) => idle.push(cb),
    cancelIdleCallback: (id) => (idle[id - 1] = null),
    getComputedStyle: (el) => ({ position: el.style.position || "static", getPropertyValue: (p) => el.style.getPropertyValue(p) }),
    Element: El,
    HTMLElement: El,
  };
  for (const [k, v] of Object.entries(set)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true, writable: true });
  return {
    doc,
    win,
    media,
    observers,
    /** Runs the idle callbacks queued so far. */
    idle: () => idle.splice(0).forEach((cb) => cb?.()),
    restore() {
      for (const k of keys) keep[k] ? Object.defineProperty(globalThis, k, keep[k]) : delete globalThis[k];
    },
  };
}

/** Lets pending promise callbacks run (a few microtask turns, then a macrotask). */
export const settle = () => new Promise((r) => setTimeout(r, 0));
