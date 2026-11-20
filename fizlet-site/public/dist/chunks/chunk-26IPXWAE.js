// src/kernel/random.ts
function seeded(seed = 1) {
  const s = new Uint32Array(1);
  s[0] = seed;
  const r = (() => (s[0] = Math.imul(s[0], 1664525) + 1013904223, s[0] / 4294967296));
  Object.defineProperty(r, "state", { get: () => s[0], set: (v) => s[0] = v });
  return r;
}

export {
  seeded
};
