// Vendor the heroes (site/heroes/heroes.json) from their game repos, at their pinned commits.
// One source: nothing here is typed by hand. For each hero this script
//   1. checks out the game repo at its pinned commit (a shallow fetch into a cache dir),
//   2. installs it (npm ci) and builds its own site the way the game ships it (SITE_URL = the
//      game's domain, SITE_BASE = /), so the hero's markup and CSS are exactly what the game serves,
//   3. takes the hero's section out of the built page (links made absolute to the game's domain;
//      the showcase keeps them inert) and the page's CSS (offset shadows on the Board UI kit's
//      direction tokens, see `shadows`),
//   4. copies the scene's own files (`copy`; fizlet imports pointed at this repo's src/, so the
//      scene runs on this build of Fizlet),
//   5. shoots the still posters (the game's own page, light and dark; reduced motion where the
//      game has a designed still frame),
//   6. writes ORIGIN.json: repo, commit, and the sha256 of every vendored file. tests/heroes.test.mjs
//      fails when a vendored file no longer matches it (a hand edit).
// Output: site/heroes/vendor/<id>/. Run: node scripts/heroes-vendor.mjs [id …] (needs network,
// git, npm and Chromium). Bump a hero: change its commit in heroes.json and run this again.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, relative } from "node:path";

const ROOT = process.cwd();
const { heroes } = JSON.parse(readFileSync("site/heroes/heroes.json", "utf8"));
const only = process.argv.slice(2);
const CACHE = process.env.HEROES_CACHE ?? join(tmpdir(), "fizlet-heroes");
const sh = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, ...env } }).toString();
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** A balanced element starting at `start` (its tag name read from there). */
export function element(html, start) {
  const i = html.indexOf(start);
  if (i < 0) throw new Error(`no ${start} in the built page`);
  const tag = html.slice(i + 1).match(/^[a-z]+/)[0];
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = i;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (!depth) return html.slice(i, re.lastIndex);
  }
  throw new Error(`${start}: not closed`);
}

/** Links and sources made absolute to the game's domain; in-page anchors (#x, href="#bf-hull" on <use>) stay. */
export const absolute = (html, origin) =>
  html.replace(/(<(?!use\b)[a-z]+\b[^>]*?\s(?:href|src))="(\/[^"]*|\.\.?\/[^"]*)"/g, (_, a, u) => `${a}="${new URL(u, origin).href}"`)
    .replace(/(<a\b[^>]*?\shref)="(#[^"]+)"/g, (_, a, h) => `${a}="${origin}${h}"`);

/**
 * Offset shadows (a hard shadow: x y 0 colour, no inset) take their direction from the Board UI
 * kit's tokens (fizlet BOARD-UI.md §4.1): `--shadow-x` / `--shadow-y` are unitless directions per
 * unit of depth, so offset = depth × token. The depth is the game's own (the larger of its x and
 * y); the stage sets the tokens to the host page's (fizlet.com: 0 / 1), the fallback is the kit's.
 */
export function shadows(css) {
  const off = (d, ax) => `calc(${d}px * var(--shadow-${ax}, ${ax === "x" ? 0 : 1}))`;
  const layer = (l) => {
    const m = l.trim().match(/^(-?\d*\.?\d+)(?:px)?\s+(-?\d*\.?\d+)(?:px)?\s+0(?:px)?(\s+.+)$/);
    if (!m || /inset/.test(l) || (+m[1] === 0 && +m[2] === 0)) return l;
    const d = Math.max(Math.abs(+m[1]), Math.abs(+m[2]));
    return `${off(d, "x")} ${off(d, "y")} 0${m[3]}`;
  };
  // Split on commas outside parentheses.
  const layers = (v) => {
    const out = [];
    let depth = 0, s = "";
    for (const c of v) {
      if (c === "(") depth++;
      if (c === ")") depth--;
      if (c === "," && !depth) (out.push(s), (s = ""));
      else s += c;
    }
    return [...out, s];
  };
  return css.replace(/box-shadow:([^;}]+)/g, (_, v) => `box-shadow:${layers(v).map(layer).join(",")}`)
    .replace(/drop-shadow\((-?\d*\.?\d+)px\s+(-?\d*\.?\d+)px\s+0(?:px)?\s/g, (all, x, y) => {
      const d = Math.max(Math.abs(+x), Math.abs(+y));
      return d ? `drop-shadow(${off(d, "x")} ${off(d, "y")} 0 ` : all;
    });
}

/** fizlet imports in a vendored scene: the game's vendor/fizlet/<x> becomes this repo's src/<x>. */
const fizletImports = (src, to) => src.replace(/(["'])(?:\.\.\/)+vendor\/fizlet\/([^"']+)\1/g, (_, q, p) => `${q}${relative(dirname(to), join(ROOT, "src", p)).replace(/\\/g, "/")}${q}`)
  .replace(/(["'])(?:\.\.\/)+src\/audio\1/g, "$1./audio$1");

function checkout(h) {
  const dir = join(CACHE, `${h.repo.replace("/", "__")}@${h.commit}`);
  if (!existsSync(join(dir, ".done"))) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    sh("git", ["init", "-q"], dir);
    sh("git", ["fetch", "-q", "--depth", "1", `https://github.com/${h.repo}`, h.commit], dir);
    sh("git", ["checkout", "-q", "FETCH_HEAD"], dir);
    if (sh("git", ["rev-parse", "HEAD"], dir).trim() !== h.commit) throw new Error(`${h.id}: checkout is not ${h.commit}`);
    sh("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], dir);
    writeFileSync(join(dir, ".done"), "");
  }
  const built = join(dir, `.built-${h.out.replace(/\W/g, "_")}`);
  if (!existsSync(built)) {
    for (const [cmd, ...args] of h.build) sh(cmd, args, dir, { SITE_URL: h.origin.replace(/\/$/, ""), SITE_BASE: "/", ASTRO_TELEMETRY_DISABLED: "1" });
    writeFileSync(built, "");
  }
  return dir;
}

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2" };
async function posters(h, siteDir, out) {
  const { chromium } = await import("playwright");
  const { launchOptions } = await import("../tests/chromium.mjs");
  const server = createServer((req, res) => {
    let f = join(siteDir, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, ""));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch(launchOptions());
  try {
    for (const theme of ["dark", "light"]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: h.poster.reduced ? "reduce" : "no-preference", colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem("dom-virus:theme", t); } catch {} }, theme);
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      const sel = h.section.match(/<(\w+) class="([^"]+)"/);
      const target = page.locator(`${sel[1]}.${sel[2].split(" ")[0]}`).first();
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(h.poster.wait ?? 1200);
      writeFileSync(join(out, `poster-${theme}.jpg`), await target.screenshot({ type: "jpeg", quality: 72, animations: h.poster.reduced ? "disabled" : "allow" }));
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
for (const h of heroes) {
  if (only.length && !only.includes(h.id)) continue;
  console.log(`${h.id}: ${h.repo}@${h.commit.slice(0, 7)}`);
  const dir = checkout(h);
  const siteDir = join(dir, h.out);
  const html = readFileSync(join(siteDir, "index.html"), "utf8");
  const out = join(ROOT, "site/heroes/vendor", h.id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const files = {};
  const put = (name, data) => (writeFileSync(join(out, name), data), (files[name] = sha256(Buffer.from(data))));
  put("section.html", absolute(element(html, h.section), h.origin) + "\n");
  const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(([, href]) => readFileSync(join(siteDir, href.replace(/^\//, ""))).toString("utf8"));
  css.push(...[...html.slice(0, html.indexOf("</head>")).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]));
  put("section.css", shadows(css.join("\n")) + "\n");
  put("html.json", JSON.stringify({ class: html.match(/<html[^>]*\sclass="([^"]*)"/)?.[1] ?? "" }) + "\n");
  for (const [to, from] of Object.entries(h.copy)) {
    const src = readFileSync(join(dir, from), "utf8");
    put(to, /\.ts$/.test(to) ? fizletImports(src, join(out, to)) : src);
  }
  await posters(h, siteDir, out);
  for (const f of ["poster-dark.jpg", "poster-light.jpg"]) files[f] = sha256(readFileSync(join(out, f)));
  writeFileSync(join(out, "ORIGIN.json"), JSON.stringify({
    note: "Generated by scripts/heroes-vendor.mjs from the game repo at this commit. Never edit; change the pin in site/heroes/heroes.json and run it again.",
    repo: `https://github.com/${h.repo}`, commit: h.commit, origin: h.origin, files,
  }, null, 2) + "\n");
  console.log(`  ${Object.keys(files).length} files → ${relative(ROOT, out)}`);
}
}

// Run only as a script (tests import the helpers).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
