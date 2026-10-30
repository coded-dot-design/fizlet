// The roadmap (site/roadmap.mjs) is the one source for the home page's #roadmap: phases in order,
// statuses the engine's ROADMAP.md uses, ticks that agree with the status, planned bricks in their
// phase, and the page shows exactly what the source says.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANNED } from "../site/bricks.mjs";
import { LAUNCH_LAST, PHASE_STATUS, ROADMAP, phases } from "../site/roadmap.mjs";
import { roadmapSection } from "../site/pages/index.mjs";
import { readFileSync } from "node:fs";

test("phases run E0, E1, … in order, each with a known status", () => {
  ROADMAP.forEach((p, i) => {
    assert.equal(p.id, `E${i}`, `phase ${i} is ${p.id}`);
    assert.ok(PHASE_STATUS[p.status], `${p.id}: unknown status "${p.status}" (one of ${Object.keys(PHASE_STATUS).join(", ")})`);
    assert.ok(p.name && p.goal, `${p.id}: name and goal`);
  });
});

test("the launch scope is not planned and everything after it is", () => {
  const cut = ROADMAP.findIndex((p) => p.id === LAUNCH_LAST);
  assert.ok(cut >= 0, `LAUNCH_LAST ${LAUNCH_LAST} is a phase`);
  ROADMAP.forEach((p, i) => assert.equal(p.status === "planned", i > cut, `${p.id}: ${p.status}`));
});

test("ticks agree with the status", () => {
  for (const p of phases()) {
    const ticked = p.items.filter(([d]) => d).length;
    assert.ok(p.items.length, `${p.id}: no items`);
    if (p.status === "done") assert.equal(ticked, p.items.length, `${p.id} is done with an open box`);
    else if (p.status === "planned") assert.equal(ticked, 0, `${p.id} is planned with a ticked box`);
    else assert.ok(ticked < p.items.length, `${p.id} is ${p.status} with every box ticked`);
    if (p.status === "partly" || p.status === "nearly") assert.ok(ticked > 0, `${p.id} is ${p.status} with nothing ticked`);
  }
});

test("every PLANNED brick sits under a planned phase, and shows there", () => {
  for (const b of PLANNED) {
    const p = phases().find((x) => x.id === b.phase);
    assert.equal(p?.status, "planned", `${b.name}: ${b.phase} is not a planned phase`);
    assert.ok(p.items.some(([, t]) => t.startsWith(`${b.name} `)), `${b.name} missing from ${b.phase}`);
  }
});

test("the home page renders the source: every phase, its pill, its boxes, nothing else", () => {
  const src = readFileSync("site/pages/index.mjs", "utf8");
  assert.doesNotMatch(src, /\[\s*"E\d+",/, "phase data written in index.mjs: it belongs in site/roadmap.mjs");
  assert.match(src, /\$\{roadmapSection\(\)\}/, "home() renders roadmapSection()");
  const all = phases();
  const html = roadmapSection();
  assert.ok(html.includes(`ROADMAP · ${all[0].id} TO ${all.at(-1).id}`), "eyebrow range");
  const shown = [...html.matchAll(/<span class="phase-id">(E\d+)<\/span><span class="phase-pill">([^<]*)<\/span><\/div>\s*<h3>([^<]*)<\/h3>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(shown, all.map((p) => [p.id, p.label, p.name]));
  const boxes = all.flatMap((p) => p.items);
  assert.equal((html.match(/<li class="done">/g) ?? []).length, boxes.filter(([d]) => d).length, "ticked boxes");
  assert.equal((html.match(/\(to do\)/g) ?? []).length, boxes.filter(([d]) => !d).length, "open boxes");
});
