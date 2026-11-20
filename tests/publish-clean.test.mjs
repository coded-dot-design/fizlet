// The publish-clean gate fails on a comment in shipped code, a stray file and an agent word, and
// passes on clean input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPack, packedFiles } from "../scripts/publish-clean.mjs";
import { scanComments, stripDtsComments, stripJsComments } from "../scripts/comments.mjs";

const clean = [
  { path: "package.json", text: '{"name":"x"}' },
  { path: "README.md", text: "# x\n\nA brick.\n" },
  { path: "LICENSE", text: "MIT" },
  { path: "CHANGELOG.md", text: "## 1.0.0\n" },
  { path: "dist/index.js", text: 'const url = "https://a.b//c";\nconst re = /\\/\\/x/;\nexport const t = `a${"//"}//b`;\n' },
  { path: "dist/index.d.ts", text: "export declare const t: string;\n" },
  { path: "bin/fzlt.mjs", text: "#!/usr/bin/env node\nconsole.log(1);\n" },
];
const bad = (extra, re) => {
  const { problems } = checkPack([...clean, ...extra]);
  assert.ok(problems.some((p) => re.test(p)), `${re}: ${problems.join(" | ")}`);
};

test("clean input passes", () => assert.deepEqual(checkPack(clean), { problems: [], warnings: [] }));

test("a comment in a dist .js fails (// and /* */), in a .d.ts and in bin too", () => {
  bad([{ path: "dist/x.js", text: "let a = 1; // note\n" }], /dist\/x\.js:1: comment/);
  bad([{ path: "dist/y.js", text: "let a = 1;\n/* note */ f();\n" }], /dist\/y\.js:2: comment/);
  bad([{ path: "dist/z.d.ts", text: "// internal\nexport declare const z: 1;\n" }], /dist\/z\.d\.ts:1: comment/);
  bad([{ path: "dist/w.d.ts", text: "/* internal */\nexport declare const w: 1;\n" }], /dist\/w\.d\.ts:1: comment/);
  bad([{ path: "bin/other.mjs", text: "#!/usr/bin/env node\n// hi\n" }], /bin\/other\.mjs:2: comment/);
  bad([{ path: "bin/doc.mjs", text: "/** doc */\nconsole.log(1);\n" }], /bin\/doc\.mjs:1: comment/);
});

test("the public documentation stays: TSDoc blocks in .d.ts, bundler annotations in .js", () => {
  const docs = [
    { path: "dist/z.d.ts", text: "/** The board: cols × rows. */\nexport declare const z: 1;\n" },
    { path: "dist/p.js", text: "const a = /* @__PURE__ */ f();\nconst b = /* #__NO_SIDE_EFFECTS__ */ () => 1;\n" },
  ];
  assert.deepEqual(checkPack([...clean, ...docs]).problems, []);
  // A doc block in .js is not documentation anyone reads: it fails there.
  bad([{ path: "dist/q.js", text: "/** doc */\nexport const q = 1;\n" }], /dist\/q\.js:1: comment/);
});

test("a private repository name fails anywhere in the package, kept doc comments included", () => {
  const name = ["fizlet", "factory"].join("-");
  bad([{ path: "dist/n.d.ts", text: `/** Made in ${name}. */\nexport declare const n: 1;\n` }], /dist\/n\.d\.ts:1: names a private repository/);
  const { problems } = checkPack([...clean.filter((f) => f.path !== "CHANGELOG.md"), { path: "CHANGELOG.md", text: `## 1.0.0\n- from ${name}\n` }]);
  assert.ok(problems.some((p) => /CHANGELOG\.md:2: names a private repository/.test(p)), problems.join(" | "));
});

test("a stray file fails", () => {
  bad([{ path: "scripts/build.mjs", text: "" }], /scripts\/build\.mjs: not allowed/);
  bad([{ path: "dist/x.js.map", text: "{}" }, { path: "src/a.ts", text: "" }], /src\/a\.ts: not allowed/);
});

test("an agent word fails in dist, bin, package.json and README, in any case, whole words only", () => {
  for (const w of ["agent", "Claude", "Pip", "keeper", "Handoff", "AGENT"]) bad([{ path: "dist/w.js", text: `export const s = "the ${w} did it";\n` }], /dist\/w\.js:1.*banned word/);
  bad([{ path: "bin/w.mjs", text: 'console.log("Pip");\n' }], /bin\/w\.mjs:1.*banned word/);
  const pkg = { path: "package.json", text: '{"description":"for your agent"}' };
  assert.ok(checkPack([pkg, ...clean.slice(1)]).problems.some((p) => /package\.json/.test(p)));
  const readme = { path: "README.md", text: "ask Claude\n" };
  assert.ok(checkPack([clean[0], readme, ...clean.slice(2)]).problems.some((p) => /README\.md/.test(p)));
  assert.deepEqual(checkPack([...clean, { path: "dist/ok.js", text: 'export const a = "userAgent pipe keepers agents";\n' }]).problems, []);
  // A die's pips are not the name Pip, and a brick's import path is a name, not a word.
  assert.deepEqual(checkPack([...clean, { path: "dist/dice.js", text: 'const pip = "#fff";\n' }, { path: "README.md", text: "Planned: `@fzlt/core/agent` (AI players).\n" }].filter((f, i, a) => a.findLastIndex((g) => g.path === f.path) === i)).problems, []);
});

test("CHANGELOG.md and LICENSE are not failed on agent words (history); the changelog warns", () => {
  const r = checkPack([clean[0], clean[1], { path: "LICENSE", text: "Claude" }, { path: "CHANGELOG.md", text: "Pip made it\n" }, ...clean.slice(4)]);
  assert.deepEqual(r.problems, []);
  assert.equal(r.warnings.length, 1);
});

test("the comment scanner: strings, templates and regexes hide `//`; a shebang is not a comment", () => {
  assert.deepEqual(scanComments('#!/usr/bin/env node\nconst a = "//", b = \'/*\', c = `${1}//${`/*${2}*/`}`, d = /[/]\\//g, e = 4 / 2 / 1;\n'), []);
  assert.deepEqual(scanComments("a = b / c; // x\n/* y */").map((c) => c.text), ["// x", "/* y */"]);
  assert.equal(stripJsComments("// a\nlet x = 1; // b\n/* c */\nf(/* d */ 2);\n"), "let x = 1;\nf( 2);\n");
  // What stays: annotations in JS, TSDoc blocks in declarations.
  assert.equal(stripJsComments("// a\nconst x = /* @__PURE__ */ f(); // b\n"), "const x = /* @__PURE__ */ f();\n");
  assert.equal(stripDtsComments("// a\n/** Doc. */\nexport declare const x: 1; // b\n/* c */\n"), "/** Doc. */\nexport declare const x: 1;\n");
});

test("the real package: npm pack lists only the allowed files and passes the gate", () => {
  const files = packedFiles();
  const { problems } = checkPack(files);
  assert.deepEqual(problems, []);
  assert.ok(files.some((f) => f.path === "dist/index.js"), "the build is there (run npm run build)");
});
