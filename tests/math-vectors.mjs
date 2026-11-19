// The cross-engine vectors for @fzlt/core/math, shared by tests/math.test.mjs (Node) and
// tests/math-engines.mjs (Chromium and WebKit pages): the same seeded arguments, one digest of every
// result's bits, and a table of exact results. Plain JS with no imports, so a page can run it as is.

/** A 32-bit LCG: the same arguments everywhere (no engine's Math.random). */
export function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296);
}

/** Argument families: small angles, a few turns, game-sized and big headings, and anything at all. */
export const RANGES = [Math.PI / 4, Math.PI, 2 * Math.PI, 100, 1e4, 1.6e6];

/**
 * FNV-1a over the bits of every result: `n` arguments per range for sin and cos, and `n` (y, x) pairs
 * for atan2 (signs and magnitudes from 2^-30 to 2^30) and hypot. One number per function: equal
 * digests mean every one of the results was equal, bit for bit.
 */
export function digests(m, n) {
  const F = new Float64Array(1), U = new Uint32Array(F.buffer);
  const out = {};
  const mix = (h, x) => {
    F[0] = x;
    h = Math.imul(h ^ U[0], 16777619) >>> 0;
    return Math.imul(h ^ U[1], 16777619) >>> 0;
  };
  for (const name of ["sin", "cos"]) {
    const R = lcg(7), f = m[name];
    let h = 2166136261;
    for (const r of RANGES) for (let i = 0; i < n; i++) h = mix(h, f((R() * 2 - 1) * r));
    out[name] = h;
  }
  for (const name of ["atan2", "hypot"]) {
    const R = lcg(11), f = m[name];
    let h = 2166136261;
    for (let i = 0; i < n; i++) {
      const y = (R() - 0.5) * 2 ** ((R() * 60 - 30) | 0), x = (R() - 0.5) * 2 ** ((R() * 60 - 30) | 0);
      h = mix(h, f(y, x));
    }
    out[name] = h;
  }
  return out;
}

/** The digests @fzlt/core/math gives for `digests(m, 20000)`: the same in every engine. */
export const DIGESTS = { sin: 3231127293, cos: 2922925359, atan2: 2655857630, hypot: 1767105186 };

/** Exact results as bit patterns ("high low" words in hex): [function, args, bits]. */
export const TABLE = [
  ["sin", [0.5], "3fdeaee8 744b05f0"],
  ["sin", [1], "3feaed54 8f090cee"],
  ["sin", [Math.PI / 6], "3fdfffff ffffffff"],
  ["sin", [3], "3fc21038 6db6d55b"],
  ["sin", [-10], "3fe1689e f5f34f52"],
  ["sin", [100], "bfe03425 b78c4db8"],
  ["sin", [12345.678], "bfe687d5 890974a5"],
  ["sin", [1000000], "bfd6664b 2568d867"],
  ["cos", [0.5], "3fec1528 065b7d50"],
  ["cos", [1], "3fe14a28 0fb5068c"],
  ["cos", [Math.PI / 3], "3fe00000 00000001"],
  ["cos", [3], "bfefae04 be85e5d2"],
  ["cos", [-10], "bfead9ac 890c6b1f"],
  ["cos", [100], "3feb981d bf665fdf"],
  ["cos", [12345.678], "3fe6b94c 3bbe24b8"],
  ["cos", [1000000], "3fedf9df 9906d32c"],
  ["atan2", [1, 1], "3fe921fb 54442d18"],
  ["atan2", [-1, -1], "c002d97c 7f3321d2"],
  ["atan2", [3, -4], "4003fc17 6b7a8560"],
  ["atan2", [1e-10, 1], "3ddb7cdf d9d7bdbb"],
  ["atan2", [0.3, 0.7], "3fd9e9bf 3d20dc71"],
  ["atan2", [45446193.25, -4.1614281465207625e-12], "3ff921fb 54442d18"],
  ["hypot", [3, 4], "40140000 00000000"],
  ["hypot", [0.1, 0.2], "3fcc9f25 c5bfedda"],
];

/** The bits of x as "hhhhhhhh llllllll". */
export function bits(x) {
  const F = new Float64Array([x]), U = new Uint32Array(F.buffer);
  return U[1].toString(16).padStart(8, "0") + " " + U[0].toString(16).padStart(8, "0");
}
