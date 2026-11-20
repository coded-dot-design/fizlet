// src/kernel/ledger.ts
var probe;
var withStyle = (text, el) => ((probe ??= el.ownerDocument.createElement("i")).setAttribute("style", text), probe.style.cssText);
var lost = (r, s, prop) => r.x || s.getPropertyValue(prop) !== r.l || s.getPropertyPriority(prop) !== r.lp;
var back = (r, s, prop) => r.o ? s.setProperty(prop, r.o, r.op) : s.removeProperty(prop);
var Ledger = class {
  // Private names are short on purpose: esbuild keeps property names, and every byte here ships in
  // every page build. t: text nodes, m: elements, a: nodes we added, e(): an element's entry.
  t = /* @__PURE__ */ new Map();
  m = /* @__PURE__ */ new Map();
  a = [];
  e(el) {
    let e = this.m.get(el);
    if (!e) this.m.set(el, e = { hs: el.hasAttribute("style"), os: el.getAttribute("style"), hc: el.hasAttribute("class") });
    return e;
  }
  /** Replace a text node's value. False if the host changed it since our last write. */
  text(node, value) {
    let r = this.t.get(node);
    if (!r) this.t.set(node, r = { o: node.nodeValue, l: node.nodeValue, x: this.z });
    if (r.x || node.nodeValue !== r.l) return !(r.x = true);
    if (r.l !== value) node.nodeValue = r.l = value;
    return true;
  }
  /** Set one inline style property (e.g. "transform", "--hp"). */
  style(el, prop, value, priority = "") {
    const e = this.e(el), map = e.style ??= /* @__PURE__ */ new Map(), s = el.style;
    let r = map.get(prop);
    if (!r) {
      const v = s.getPropertyValue(prop), p = s.getPropertyPriority(prop);
      map.set(prop, r = { o: v, l: v, op: p, lp: p, x: this.z });
    }
    if (lost(r, s, prop)) return !(r.x = true);
    if (r.l === value && r.lp === priority) return true;
    s.setProperty(prop, value, priority);
    r.l = s.getPropertyValue(prop);
    r.lp = s.getPropertyPriority(prop);
    return true;
  }
  /** Put one style property back now (as Recall would) and forget it: a later `style` records the
   *  value then in place as the new original. Hands off if the host changed it since our last write. */
  unstyle(el, prop) {
    const r = this.m.get(el)?.style?.get(prop), s = el.style;
    if (!r) return true;
    if (lost(r, s, prop)) return !(r.x = true);
    back(r, s, prop);
    this.m.get(el).style.delete(prop);
    return true;
  }
  /** Set (string) or remove (null) an attribute. */
  attr(el, name, value) {
    const map = this.e(el).attr ??= /* @__PURE__ */ new Map();
    let r = map.get(name);
    if (!r) {
      const v = el.getAttribute(name);
      map.set(name, r = { o: v, l: v, x: this.z });
    }
    if (r.x || el.getAttribute(name) !== r.l) return !(r.x = true);
    if (r.l === value) return true;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
    r.l = value;
    return true;
  }
  /** Add or remove one class. */
  cls(el, name, on) {
    const map = this.e(el).cls ??= /* @__PURE__ */ new Map();
    let r = map.get(name);
    if (!r) {
      const v = el.classList.contains(name);
      map.set(name, r = { o: v, l: v, x: this.z });
    }
    if (r.x || el.classList.contains(name) !== r.l) return !(r.x = true);
    if (r.l !== on) el.classList.toggle(name, r.l = on);
    return true;
  }
  /** A node the engine put on the page (canvas, overlay, debris): removed on restore. Once closed
   *  (after engine.destroy()) it is removed as soon as the caller's task ends: the caller inserts it
   *  after this returns, so it can't be refused here. */
  add(node) {
    this.z ? queueMicrotask(() => node.remove?.()) : this.a.push(node);
    return node;
  }
  /** Recall: put back everything we still own, newest first. Host edits win. With `close` (what
   *  `engine.destroy()` passes) every later text, style, attr or cls write is refused (returns false,
   *  touches nothing), so nothing written after Recall outlives it; without it the ledger is reused. */
  restore(close) {
    this.z ||= close;
    for (let i = this.a.length; i--; ) this.a[i].remove?.();
    for (const [node, r] of this.t) if (!r.x && node.nodeValue === r.l) node.nodeValue = r.o;
    for (const [el, e] of this.m) {
      e.cls?.forEach((r, name) => !r.x && el.classList.contains(name) === r.l && el.classList.toggle(name, r.o));
      e.attr?.forEach((r, name) => !r.x && el.getAttribute(name) === r.l && (r.o === null ? el.removeAttribute(name) : el.setAttribute(name, r.o)));
      let all = true;
      e.style?.forEach((r, prop) => {
        const s = el.style;
        if (lost(r, s, prop)) return void (all = false);
        back(r, s, prop);
      });
      if (e.style && all && e.os !== null && el.style.cssText === withStyle(e.os, el)) el.setAttribute("style", e.os);
      if (e.style && !e.hs && !el.getAttribute("style")) el.removeAttribute("style");
      if (e.cls && !e.hc && el.getAttribute("class") === "") el.removeAttribute("class");
    }
    this.a.length = 0;
    this.t.clear();
    this.m.clear();
  }
  /** How many things the ledger holds (for stats). */
  get size() {
    let n = this.t.size + this.a.length;
    this.m.forEach((e) => n += (e.style?.size ?? 0) + (e.attr?.size ?? 0) + (e.cls?.size ?? 0));
    return n;
  }
};

export {
  Ledger
};
