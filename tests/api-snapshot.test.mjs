// API snapshots (scripts/api-snapshot.mjs): a COMPLETE brick's public types are committed under api/,
// and an export that changes fails CI unless the CHANGELOG's "## Unreleased" names the brick.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compare, mentions, normalize, readDir, readRef, snapshots, stripComments, surfaceFiles, unreleased } from "../scripts/api-snapshot.mjs";
import { BRICKS } from "../site/bricks.mjs";

/** A throwaway directory with the given files ({ "path": "text" }). */
function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "fizlet-api-"));
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(join(dir, p, ".."), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
}

const KERNEL = { id: "kernel", modules: [{ name: "fizlet", dts: "dist/index.d.ts" }] };
const FX = { id: "fx", modules: [{ name: "fizlet/fx", dts: "dist/fx.d.ts" }] };
const UI = { id: "ui", modules: [{ name: "fizlet/ui", dts: "dist/ui/board-ui.d.ts" }] };

test("comments go, strings stay: a doc edit is not an API change", () => {
  const src = `/** Docs. */\nexport declare const a: "x // y" | '/* z */'; // trailing\n/* block\n */\nexport type T = \`a\${string}//b\`;\n`;
  assert.equal(stripComments(src).includes("Docs"), false);
  assert.equal(normalize(src), `export declare const a: "x // y" | '/* z */';\nexport type T = \`a\${string}//b\`;`);
  assert.equal(normalize("/** One. */\nexport declare function f(): void;\n"), normalize("/** Two,\n * longer. */\n\nexport declare function f(): void;   \n"));
});

test("a snapshot follows re-exports, and type imports no other COMPLETE brick covers", () => {
  const dir = fixture({
    "dist/index.d.ts": `export * from "./kernel/index.js";\n`,
    "dist/kernel/index.d.ts": `export { createEngine } from "./engine.js";\nexport type { Engine } from "./engine.js";\n`,
    "dist/kernel/engine.d.ts": `export interface Engine { t: number }\nexport declare function createEngine(): Engine;\n`,
    "dist/board-page.d.ts": `import type { Engine } from "./kernel/engine.js";\nexport interface BoardPage { e: Engine }\n`,
    "dist/fx.d.ts": `import type { Engine } from "./kernel/engine.js";\nimport type { BoardPage } from "./board-page.js";\nexport declare function effects(e: Engine, p: BoardPage): void;\n`,
  });
  try {
    assert.deepEqual(surfaceFiles(join(dir, "dist/index.d.ts")).map((f) => f.slice(dir.length + 1)), ["dist/index.d.ts", "dist/kernel/index.d.ts", "dist/kernel/engine.d.ts"]);
    const snap = snapshots([KERNEL, FX], dir);
    assert.match(snap.get("kernel"), /### dist\/kernel\/engine\.d\.ts\nexport interface Engine/);
    const fx = snap.get("fx");
    assert.match(fx, /^# fx: public API of fizlet\/fx \(COMPLETE\)\./);
    assert.match(fx, /### dist\/board-page\.d\.ts\n/, "a BETA brick's types that fx names are fx's API too");
    assert.doesNotMatch(fx, /kernel\/engine\.d\.ts/, "the kernel's types are the kernel's snapshot");
    assert.throws(() => surfaceFiles(join(dir, "dist/x.d.ts")), /ENOENT/);
    writeFileSync(join(dir, "dist/bad.d.ts"), `export * from "./missing.js";\n`);
    assert.throws(() => surfaceFiles(join(dir, "dist/bad.d.ts")), /cannot resolve \.\/missing\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the Unreleased section is the text between its heading and the next release", () => {
  assert.equal(unreleased("# Changelog\n\n## Unreleased\n\n- a\n\n## 0.20.0\n\n- b\n"), "\n- a\n\n");
  assert.equal(unreleased("# Changelog\n\n## Unreleased\n- only\n"), "- only\n");
  assert.equal(unreleased("# Changelog\n\n## 0.20.0\n- b\n"), "");
});

test("a brick is named by a module name, not by a longer path or a bare word", () => {
  assert.ok(mentions(FX, "- **`fizlet/fx`**: blast takes a scale."));
  assert.ok(mentions(FX, "fizlet/fx."));
  assert.ok(!mentions(FX, "fizlet/fxlite and fx in general"));
  assert.ok(!mentions(UI, "`fizlet/ui/board-ui.css` gets a token"), "the stylesheet is not the JS API");
  assert.ok(mentions(UI, "Board UI: a new key style"));
  assert.ok(mentions(KERNEL, "- **Kernel: `engine.busy(seconds)`**"));
  assert.ok(mentions(KERNEL, "`fizlet`: createEngine takes a clock"));
  assert.ok(mentions(KERNEL, "fizlet/kernel"));
  assert.ok(!mentions(KERNEL, "fizlet.com and the fizlet/fx brick"));
});

const LOG = (lines) => `# Changelog\n\n## Unreleased\n\n${lines}\n\n## 0.20.0\n\n- \`fizlet/fx\`: old news\n`;
const bricks = [KERNEL, FX, UI];
const m = (o) => new Map(Object.entries(o));

test("local check: a changed export is stale, and unannounced until the CHANGELOG names it", () => {
  const committed = m({ kernel: "k1", fx: "f1" });
  const same = compare({ current: m({ kernel: "k1", fx: "f1" }), committed, changelog: LOG("- nothing"), bricks });
  assert.deepEqual(same, { stale: [], changed: [], unannounced: [] });
  const r = compare({ current: m({ kernel: "k1", fx: "f2" }), committed, changelog: LOG("- nothing"), bricks });
  assert.deepEqual(r, { stale: ["fx"], changed: ["fx"], unannounced: ["fx"] });
  assert.deepEqual(compare({ current: m({ kernel: "k1", fx: "f2" }), committed, changelog: LOG("- `fizlet/fx`: new option"), bricks }).unannounced, []);
  // A release's notes don't count: only Unreleased.
  assert.deepEqual(compare({ current: m({ kernel: "k1", fx: "f2" }), committed, changelog: LOG("- other"), bricks }).unannounced, ["fx"]);
});

test("CI check: snapshots changed since the base need a CHANGELOG line; new COMPLETE bricks don't", () => {
  const base = m({ kernel: "k1", fx: "f1" });
  const committed = m({ kernel: "k2", fx: "f1", ui: "u1" });
  const r = compare({ current: committed, committed, base, changelog: LOG("- nothing"), bricks });
  assert.deepEqual(r, { stale: [], changed: ["kernel"], unannounced: ["kernel"] });
  assert.deepEqual(compare({ current: committed, committed, base, changelog: LOG("- **Kernel: busy(sec)**"), bricks }).unannounced, []);
  // A brick that stops being COMPLETE (its snapshot goes) is a change too.
  const dropped = compare({ current: m({ kernel: "k1" }), committed: m({ kernel: "k1" }), base, changelog: LOG("- nothing"), bricks });
  assert.deepEqual(dropped.unannounced, ["fx"]);
  // Stale beats everything: the committed snapshot must match the build.
  assert.deepEqual(compare({ current: m({ kernel: "k3", fx: "f1", ui: "u1" }), committed, base, changelog: LOG("- kernel"), bricks }).stale, ["kernel"]);
});

test("snapshots read back from api/ and from a git ref", () => {
  const dir = fixture({ "api/fx.api.txt": "f1\n", "api/notes.md": "ignored\n" });
  const git = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir, stdio: "ignore" });
  try {
    assert.deepEqual(readDir(join(dir, "api")), m({ fx: "f1\n" }));
    assert.deepEqual(readDir(join(dir, "nope")), new Map());
    git("init", "-q");
    writeFileSync(join(dir, "README"), "x");
    git("add", "README");
    git("commit", "-qm", "first");
    assert.equal(readRef("HEAD", "api", dir), null, "no api/ at the base yet");
    git("add", ".");
    git("commit", "-qm", "second");
    assert.deepEqual(readRef("HEAD", "api", dir), m({ fx: "f1\n" }));
    assert.throws(() => readRef("no-such-ref", "api", dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("api/ holds one snapshot per COMPLETE brick, and nothing else", () => {
  const complete = BRICKS.filter((b) => b.status === "complete").map((b) => b.id).sort();
  assert.deepEqual([...readDir("api").keys()].sort(), complete, "run npm run api:write");
});
