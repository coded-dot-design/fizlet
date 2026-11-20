// src/announce.ts
function announce(engine, o = {}) {
  const ms = (o.gap ?? 1) * 1e3, words = o.words, keys = [], said = [];
  const doc = o.doc ?? engine.root?.ownerDocument ?? document;
  let el = null, mine = false, flip = false, last = -1e9;
  let timer = 0;
  const region = () => {
    if (el?.isConnected) return el;
    el = doc.querySelector("[data-fz-announce]");
    if (!el) {
      el = doc.createElement("div");
      el.setAttribute("data-fz-announce", "");
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      el.style.cssText = "position:fixed;clip-path:inset(50%);white-space:nowrap";
      doc.body.append(el);
      mine = true;
    }
    return el;
  };
  const flush = () => {
    clearTimeout(timer);
    timer = 0;
    if (!keys.length) return;
    last = Date.now();
    region().textContent = said.join(". ") + ((flip = !flip) ? "\xA0" : "");
    keys.length = said.length = 0;
  };
  const say = (key, text) => {
    if (!text) return;
    const i = keys.indexOf(key);
    if (i < 0) keys.push(key), said.push(text);
    else said[i] = text;
    timer ||= setTimeout(flush, Math.max(0, last + ms - Date.now()));
  };
  const system = engine.add({
    render(e) {
      if (!words) return;
      for (let i = 0, ev; ev = e.events.at(i); i++) {
        const text = words(ev);
        if (text) say(ev.type, text);
      }
    }
  });
  const destroy = () => {
    clearTimeout(timer);
    timer = 0;
    keys.length = said.length = 0;
    engine.remove(system);
    if (mine) el?.remove();
  };
  engine.signal.addEventListener("abort", destroy, { once: true });
  return {
    /** Queue a sentence under a key (coalesced with what waits under that key). */
    say,
    /** Read what waits now, ignoring the gap (a result screen that must not wait). */
    flush,
    /** Remove the system, the timer and the region this one made. */
    destroy
  };
}
export {
  announce
};
