// The numbers the launch-day gallery pieces show, measured on this checkout, never typed:
// - each brick's gzip size, and each "order" (a few bricks a kind of thing needs) bundled together
//   the way scripts/sizes.mjs measures an entry (esbuild bundle + minify, es2022, gzip);
// - the packed tarball: `npm pack --dry-run --json --ignore-scripts` (size, unpacked size, files);
// - runtime dependencies: the count of package.json `dependencies` (0).
// The site fills them into a stage's `{{…}}` slots at build (fillStage); the pieces' tests do too.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { measure } from "./sizes.mjs";

/** The bricks on the npm i fzlt belt (label → the sizes.mjs entry). */
export const BRICKS = [
  ["kernel", "fzlt (kernel)", "src/index.ts"], ["input", "fzlt/input", "src/input.ts"], ["fx", "fzlt/fx", "src/fx.ts"],
  ["sound", "fzlt/sound", "src/sound.ts"], ["slot", "fzlt/slot", "src/slot.ts"], ["pad", "fzlt/pad", "src/pad.ts"],
  ["collide", "fzlt/collide", "src/collide.ts"], ["sprite", "fzlt/sprite", "src/sprite.ts"], ["steer", "fzlt/steer", "src/steer.ts"],
  ["grid", "fzlt/grid", "src/grid.ts"], ["camera", "fzlt/camera", "src/camera.ts"], ["hud", "fzlt/hud", "src/hud.ts"],
];
/** What a thing needs (always the kernel first). */
export const ORDERS = [
  ["a blaster", ["kernel", "input", "fx", "sound"]],
  ["a page toy", ["kernel", "slot", "fx"]],
  ["a platformer", ["kernel", "pad", "collide", "sprite"]],
  ["a crowd", ["kernel", "steer", "grid"]],
];

const gz = async (contents) => {
  const res = await build({ stdin: { contents, resolveDir: process.cwd(), loader: "ts" }, bundle: true, minify: true, write: false, logLevel: "silent", format: "esm", target: "es2022" });
  return gzipSync(res.outputFiles[0].contents).length;
};

let cached;
/** { deps, pack: { size, unpacked, files }, kernel, bricks: [[label, gzip]], orders: [[name, labels, gzip]] }. */
export async function launchFacts() {
  if (cached) return cached;
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const sizes = await measure();
  const gzipOf = (name) => sizes.find((s) => s.name === name).gzip;
  const bricks = BRICKS.map(([label, name]) => [label, gzipOf(name)]);
  const file = Object.fromEntries(BRICKS.map(([label, , f]) => [label, f]));
  const orders = [];
  for (const [name, labels] of ORDERS) orders.push([name, labels, await gz(labels.map((l) => `export * from ${JSON.stringify("./" + file[l])};`).join("\n"))]);
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const p = JSON.parse(out)[0];
  cached = {
    deps: Object.keys(pkg.dependencies ?? {}).length,
    pack: { size: p.size, unpacked: p.unpackedSize, files: p.entryCount },
    kernel: gzipOf("fzlt (kernel)"),
    bricks,
    orders,
  };
  return cached;
}

const comma = (n) => n.toLocaleString("en-US");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
/** A stage's `{{key}}` slots filled from `f`: facts (the JSON, for a data attribute), deps, kernel,
 *  pack.size, pack.unpacked, pack.files (numbers with commas). An unknown slot fails the build. */
export function fillStage(html, f) {
  const v = { facts: esc(JSON.stringify(f)), deps: String(f.deps), kernel: comma(f.kernel), "pack.size": comma(f.pack.size), "pack.unpacked": comma(f.pack.unpacked), "pack.files": comma(f.pack.files) };
  return html.replace(/\{\{([\w.]+)\}\}/g, (_, k) => {
    if (!(k in v)) throw new Error(`launch-facts: unknown stage slot {{${k}}}`);
    return v[k];
  });
}
