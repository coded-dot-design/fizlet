// A tiny jsdom-free stub page for the stress tests: just enough of Element, CSSStyleDeclaration,
// classList and Text for the ledger (Recall), the camera and the timeline, plus `snapshot()`, which
// serialises a stub tree byte for byte so "the page came back exactly" is a string compare.
// The style attribute and el.style stay in sync the way a browser keeps them (a touched style
// leaves `style=""` behind; serialising is "prop: value;" joined by spaces, with " !important").

class StubStyle {
  constructor(el) {
    this.el = el;
    this.props = new Map(); // prop -> [value, priority]
  }
  getPropertyValue(p) {
    return this.props.get(p)?.[0] ?? "";
  }
  getPropertyPriority(p) {
    return this.props.get(p)?.[1] ?? "";
  }
  setProperty(p, v, prio = "") {
    v = String(v ?? "");
    if (v === "") return this.removeProperty(p);
    this.props.set(p, [v, prio === "important" ? "important" : ""]);
    this.el.attrs.set("style", this.cssText);
  }
  removeProperty(p) {
    const old = this.getPropertyValue(p);
    this.props.delete(p);
    if (this.el.attrs.has("style")) this.el.attrs.set("style", this.cssText);
    return old;
  }
  get cssText() {
    return [...this.props].map(([p, [v, i]]) => `${p}: ${v}${i ? " !important" : ""};`).join(" ");
  }
  parse(text) {
    this.props.clear();
    for (const decl of String(text).split(";")) {
      const c = decl.indexOf(":");
      if (c < 0) continue;
      const p = decl.slice(0, c).trim();
      let v = decl.slice(c + 1).trim(), prio = "";
      if (/!important$/.test(v)) (prio = "important"), (v = v.replace(/\s*!important$/, ""));
      if (p && v) this.props.set(p, [v, prio]);
    }
  }
}

class StubClassList {
  constructor(el) {
    this.el = el;
  }
  get list() {
    return (this.el.attrs.get("class") ?? "").split(/\s+/).filter(Boolean);
  }
  contains(n) {
    return this.list.includes(n);
  }
  toggle(n, force) {
    const l = this.list, has = l.includes(n), on = force === undefined ? !has : !!force;
    if (on && !has) l.push(n);
    if (!on && has) l.splice(l.indexOf(n), 1);
    this.el.attrs.set("class", l.join(" "));
    return on;
  }
  add(n) {
    this.toggle(n, true);
  }
  remove(n) {
    this.toggle(n, false);
  }
}

export class StubText {
  constructor(v, doc) {
    this.nodeValue = v;
    this.ownerDocument = doc;
    this.parentNode = null;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
}

export class StubEl {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.attrs = new Map();
    this.style = new StubStyle(this);
    this.classList = new StubClassList(this);
    this.childNodes = [];
    this.parentNode = null;
    this.rect = { left: 0, top: 0, width: 640, height: 480 };
  }
  get parentElement() {
    return this.parentNode instanceof StubEl ? this.parentNode : null;
  }
  get isContentEditable() {
    return false;
  }
  getAttribute(n) {
    return this.attrs.has(n) ? this.attrs.get(n) : null;
  }
  hasAttribute(n) {
    return this.attrs.has(n);
  }
  setAttribute(n, v) {
    v = String(v);
    this.attrs.set(n, v);
    if (n === "style") this.style.parse(v), this.attrs.set("style", v);
  }
  removeAttribute(n) {
    this.attrs.delete(n);
    if (n === "style") this.style.props.clear();
  }
  append(...nodes) {
    for (const n of nodes) this.appendChild(typeof n === "string" ? new StubText(n, this.ownerDocument) : n);
  }
  appendChild(n) {
    n.parentNode?.removeChild(n);
    n.parentNode = this;
    this.childNodes.push(n);
    return n;
  }
  removeChild(n) {
    const i = this.childNodes.indexOf(n);
    if (i >= 0) this.childNodes.splice(i, 1), (n.parentNode = null);
    return n;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  contains(n) {
    for (; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  getBoundingClientRect() {
    return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height, x: this.rect.left, y: this.rect.top };
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
}

/** A stub document with a body; `page()` builds the fixture page every stress test restores. */
export function stubDocument() {
  const doc = {
    createElement: (t) => new StubEl(t, doc),
    createTextNode: (v) => new StubText(v, doc),
  };
  doc.body = new StubEl("body", doc);
  return doc;
}

/** A small host page: a stage with pre-existing inline styles, classes and text the bricks write over. */
export function stubPage() {
  const doc = stubDocument(), body = doc.body;
  const wrap = doc.createElement("section");
  wrap.setAttribute("class", "hero dark");
  wrap.setAttribute("style", "overflow: hidden; color: red !important;");
  const stage = doc.createElement("div");
  stage.setAttribute("id", "stage");
  stage.setAttribute("style", "transform:rotate(1deg);opacity:0.9");
  stage.setAttribute("data-x", "1");
  const label = doc.createElement("p");
  label.append("Hello page");
  const bare = doc.createElement("span");
  wrap.append(stage, label, bare);
  body.append(wrap);
  return { doc, body, wrap, stage, label, bare, text: label.firstChild };
}

/** The page as one string: every element's tag, attributes in insertion order, and text, depth first. */
export function snapshot(node) {
  if (node instanceof StubText) return JSON.stringify(node.nodeValue);
  const attrs = [...node.attrs].map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
  return `<${node.tagName}${attrs ? " " + attrs : ""}>${node.childNodes.map(snapshot).join("")}</${node.tagName}>`;
}

/** The one layout global a brick reads at setup (camera's containment check): computed overflow. */
globalThis.getComputedStyle ??= (el) => ({ overflowX: el.style?.getPropertyValue("overflow") || "visible" });
