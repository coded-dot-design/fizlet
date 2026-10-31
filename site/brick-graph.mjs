// The bricks index's live diagram, its data: which brick imports which, read from the source at
// build time and followed through internal files that are no brick of their own (src/arcade-parts.ts
// and the like). Three kinds of link: 0 a runtime import (its code ships with the brick), 1 a
// type-only import (it takes, say, an engine but bundles none of it), 2 a planned brick's `needs`.
// Nothing here is hand-kept: a new import is a new edge on the next build.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const KERNEL = (f) => f === "src/index.ts" || f.startsWith("src/kernel/");

/** Imports of one source file, as [repo path, type-only]. */
function imports(file) {
  const out = [];
  for (const m of readFileSync(file, "utf8").matchAll(/^\s*(import|export)\s+(type\s+)?[^;]*?from\s+"(\.[^"]+)"/gm)) {
    const base = normalize(join(dirname(file), m[3]));
    const f = [`${base}.ts`, `${base}/index.ts`, base].find((p) => existsSync(p) && p.endsWith(".ts"));
    if (f) out.push([f, !!m[2]]);
  }
  return out;
}

/** { nodes: [{ id, name, status, tone, planned }], links: [[from, to, kind]] } (indices; from imports to). */
export function brickGraph(bricks, planned, status) {
  const nodes = [], owner = new Map();
  for (const b of bricks)
    for (const m of b.modules) {
      owner.set(m.src, nodes.length);
      nodes.push({ id: b.id, name: m.name, status: b.status, tone: status[b.status].tone });
    }
  const kernel = nodes.findIndex((n) => n.name === "@fzlt/core");
  const brickOf = (f) => (KERNEL(f) ? kernel : owner.get(f));
  const links = new Map(); // "from,to" → kind (a runtime import wins over a type-only one)
  for (const [src, i] of owner) {
    const seen = new Set(), todo = imports(src);
    while (todo.length) {
      const [f, type] = todo.pop();
      if (seen.has(f + type)) continue;
      seen.add(f + type);
      const j = brickOf(f);
      if (j === i) continue;
      if (j === undefined) todo.push(...imports(f).map(([g, t]) => [g, type || t])); // an internal file: look through it
      else if (!type || !links.has(`${i},${j}`)) links.set(`${i},${j}`, type ? 1 : 0);
    }
  }
  for (const p of planned) {
    const i = nodes.push({ id: p.name.slice("@fzlt/core/".length), name: p.name, status: "roadmap", tone: status.roadmap.tone, planned: true }) - 1;
    for (const n of p.needs) {
      const j = nodes.findIndex((x) => x.name === n);
      if (j >= 0) links.set(`${i},${j}`, 2);
    }
  }
  return { nodes, links: [...links].map(([l, kind]) => [...l.split(",").map(Number), kind]) };
}
