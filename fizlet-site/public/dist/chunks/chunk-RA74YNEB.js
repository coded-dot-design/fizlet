// src/kernel/need.ts
var KIND = ["finite number", "number > 0", "positive integer"];
function need(v, name, kind = 0) {
  if (!Number.isFinite(v) || kind && v <= 0 || kind > 1 && v % 1)
    throw new RangeError(`fizlet: ${name} must be a ${KIND[kind]} (got ${String(v)})`);
  return v;
}

export {
  need
};
