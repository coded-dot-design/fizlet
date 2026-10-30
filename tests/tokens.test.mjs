// tokens.json is the authoritative token source: the build exports it (fizlet/ui/tokens.json) and
// refuses to build when board-ui.css or applyPalette's variable map disagrees with it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { checkTokens, readTokenSources } = await import("../scripts/tokens.mjs");
const src = readTokenSources();

test("tokens: board-ui.css and board-ui.ts agree with tokens.json today", () => {
  assert.deepEqual(checkTokens(src), []);
});

test("tokens: a drifted CSS default, an unknown --k-* variable or a drifted palette map fails", () => {
  const css = src.css.replace("--k-fire: #ff2b4e;", "--k-fire: #ff0000;");
  assert.match(checkTokens({ ...src, css }).join("\n"), /--k-fire/);
  const extra = src.css.replace("--k-go: #39ffb0;", "--k-go: #39ffb0;\n  --k-new: #123456;");
  assert.match(checkTokens({ ...src, css: extra }).join("\n"), /--k-new/);
  const light = src.css.replace("--k-cmd-ink: #6a3ae6;", "--k-cmd-ink: #000000;");
  assert.match(checkTokens({ ...src, css: light }).join("\n"), /--k-cmd-ink.*light/);
  const tokens = structuredClone(src.tokens);
  tokens.palette.surfaces.bg.dark = "#000001";
  assert.match(checkTokens({ ...src, tokens }).join("\n"), /--bg/);
  const shadow = src.css.replace("--bui-sy: var(--shadow-y, 1);", "--bui-sy: 1;");
  assert.match(checkTokens({ ...src, css: shadow }).join("\n"), /--bui-sy/);
  const ts = src.ts.replace('sys: "--k-sys"', 'sys: "--k-sis"');
  assert.match(checkTokens({ ...src, ts }).join("\n"), /sys/);
});

test("tokens: exported from the package as fizlet/ui/tokens.json", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.exports["./ui/tokens.json"], "./dist/ui/tokens.json");
  assert.match(readFileSync("scripts/build.mjs", "utf8"), /tokens\.json/);
});
