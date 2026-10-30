// Installed before any page script (addInitScript): a frame recorder that allocates nothing per
// frame. window.__perf.start() / count() / stop() → rAF timestamps.
(() => {
  const cap = 1 << 15, t = new Float64Array(cap), s = new Float64Array(2); // s[0] count, s[1] on
  const tick = (now) => { if (s[1] === 1 && s[0] < cap) { t[s[0]] = now; s[0] = s[0] + 1; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  Object.defineProperty(window, "__perf", { value: { start() { s[0] = 0; s[1] = 1; }, count() { return s[0]; }, stop() { s[1] = 0; return Array.from(t.subarray(0, s[0])); } } });
})();
