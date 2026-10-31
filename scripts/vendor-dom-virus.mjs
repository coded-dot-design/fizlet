// Vendors pieces of domvirus.com into site/vendor/dom-virus/: one source, pinned, never hand-copied.
//
// Each piece is built from the dom-virus repo at PIN: the scene's own TypeScript is copied as is
// (its Fizlet imports pointed at this repo's src/, so it runs on these bricks), and its markup and
// styles are taken from the page dom-virus builds (Astro), in Chromium: the element's HTML as
// served, every rule that matches an element inside it (state and pseudo-element rules too), the
// @keyframes they name and the custom properties they read (dark theme, the domain's own colours).
// Rules are wrapped in @scope (the piece's root), keyframes get a `dv-` prefix, links are made inert
// (an <a> becomes a <span>) and view-transition names are dropped, so a piece never leaks into or
// navigates away from the page that hosts it. Hard shadows keep their depth and take the host's
// direction (scripts/shadow-tokens.mjs). ORIGIN.json records the commit and a sha256 per file.
//
// Users: the gallery (site/gallery/pieces/dv-*.ts, stages read these files) and the heroes. Change a
// piece in dom-virus, then move PIN and run this again; never edit the vendored files.
//
//   node scripts/vendor-dom-virus.mjs --from <dom-virus checkout at PIN> [--build]
//     --build runs dom-virus's site build first (npm ci, site-kit prepare, astro build: minutes).
//   node scripts/vendor-dom-virus.mjs --check   (every vendored file matches ORIGIN.json; in npm test)
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenShadows } from "./shadow-tokens.mjs";

export const REPO = "https://github.com/coded-dot-design/dom-virus";
/** dom-virus#23's head: #20 (the home hero on Fizlet) + the Battlefield field on @fzlt/core/css-clock. */
export const PIN = "248d1e9ca5dce51395efd5029875b73215641ccd";
export const OUT = "site/vendor/dom-virus";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The pieces. `page`: the built page (artifacts/site/<page>) it is taken from; `root`: the element;
 * `ts`: scene sources copied as is, imports rewritten by `imports`.
 */
export const PIECES = [
  {
    id: "under-attack",
    title: "your.page / under attack (the domvirus.com home hero)",
    page: "index.html",
    root: ".hero-crossover",
    ts: { "site-kit/hero-scene.ts": "under-attack.ts", "site-kit/hero-data.ts": "hero-data.ts" },
  },
  {
    id: "squad-tactics",
    title: "SQUAD TACTICS · DOM / GRID BATTLE (the DOM Battlefield display, domvirus.com/games/battlefield/)",
    page: "games/battlefield/index.html",
    root: ".battlefield-display",
    ts: {},
  },
];
/** dom-virus's vendored Fizlet → this repo's own bricks. */
const imports = (src) =>
  src
    .replace(/(["'])\.\.\/vendor\/fizlet\/([\w/-]+)\1/g, (_, q, p) => `${q}../../../src/${p}${q}`)
    .replace(/(["'])\.\/hero-data\1/g, "$1./hero-data$1");

const sha = (s) => createHash("sha256").update(s).digest("hex");
const HEAD = (piece) => `/* Vendored from ${REPO} @ ${PIN.slice(0, 7)} by scripts/vendor-dom-virus.mjs: ${piece}. Do not edit; change it in dom-virus and vendor again. */\n`;

/**
 * In the page: the root's markup and the CSS it needs. Runs in Chromium. Rules come from the
 * stylesheets' own text (`sources`), not the CSSOM: Chromium serializes a shorthand that holds a
 * var() as empty longhands, which would lose it. The CSSOM's selector engine only decides which apply.
 */
function extract([rootSel, sources]) {
  const root = document.querySelector(rootSel);
  if (!root) throw new Error(`no ${rootSel}`);
  const els = [root, ...root.querySelectorAll("*")];
  // Match a rule on its element: state pseudo-classes and pseudo-elements stripped.
  const bare = (sel) => sel.replace(/::?(before|after|placeholder|selection|marker)\b/g, "").replace(/:(hover|active|focus-visible|focus-within|focus|visited)\b/g, "") || "*";
  const hits = (sel) => sel.split(/,(?![^(]*\))/).some((s) => {
    try { return els.some((el) => el.matches(bare(s.trim()))); } catch { return false; }
  });
  // A small CSS reader: top-level items as { head, body } (body null for `@x ...;`), comments out.
  const read = (text) => {
    const out = [];
    let i = 0, head = "";
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (c === "/" && text[i + 1] === "*") { i = text.indexOf("*/", i + 2) + 2 || n; continue; }
      if (c === '"' || c === "'") { const j = text.indexOf(c, i + 1); head += text.slice(i, j + 1); i = j + 1; continue; }
      if (c === ";") { if (head.trim()) out.push({ head: head.trim(), body: null }); head = ""; i++; continue; }
      if (c === "{") {
        let d = 1, j = i + 1;
        while (j < n && d) {
          const k = text[j];
          if (k === '"' || k === "'") { j = text.indexOf(k, j + 1) + 1; continue; }
          if (k === "{") d++;
          else if (k === "}") d--;
          j++;
        }
        out.push({ head: head.trim(), body: text.slice(i + 1, j - 1) });
        head = "";
        i = j;
        continue;
      }
      head += c;
      i++;
    }
    return out;
  };
  const rules = [], frames = new Map();
  const walk = (text, wrap) => {
    for (const { head, body } of read(text)) {
      if (body === null) continue;
      const kf = /^@(-webkit-)?keyframes\s+([\w-]+)/.exec(head);
      if (kf) frames.set(kf[2], `@keyframes ${kf[2]}{${body}}`);
      else if (/^@media/.test(head)) {
        // Dark only: a colour-scheme block counts when it matches now (the page is emulated dark).
        const cond = head.slice(6).trim();
        if (/prefers-color-scheme/.test(cond) && !matchMedia(cond).matches) continue;
        walk(body, (t) => wrap(`${head}{${t}}`));
      } else if (/^@supports/.test(head)) walk(body, (t) => wrap(`${head}{${t}}`));
      else if (head.startsWith("@")) continue;
      else if (!/^(:root|html|body)$/.test(head) && hits(head)) rules.push(wrap(`${head}{${body}}`));
    }
  };
  for (const t of sources) walk(t, (t) => t);
  // Keyframes the rules (or the scene's inline styles) name, and the custom properties they read.
  const css = rules.join("\n");
  const html = root.outerHTML;
  const used = [...frames.keys()].filter((n) => new RegExp(`(animation(-name)?:[^;}]*\\b${n}\\b)`).test(css + html));
  const cs = getComputedStyle(root), vars = {};
  const seen = new Set(), todo = [...(css + html).matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  while (todo.length) {
    const v = todo.pop();
    if (seen.has(v)) continue;
    seen.add(v);
    const val = cs.getPropertyValue(v).trim();
    if (val) vars[v] = val;
  }
  return { html, css, keyframes: used.map((n) => frames.get(n)), names: used, vars };
}

async function vendor(from, build) {
  const head = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (head !== PIN) throw new Error(`${from} is at ${head}; check out ${PIN} first (git -C ${from} checkout ${PIN})`);
  if (build) {
    const run = (cmd, args) => execFileSync(cmd, args, { cwd: from, stdio: "inherit", env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" } });
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
    run("node", ["site-kit/scripts/prepare.mjs"]);
    run("npx", ["astro", "build", "--config", "site/astro.config.mjs"]);
  }
  const site = join(from, "artifacts/site");
  if (!existsSync(join(site, "index.html"))) throw new Error(`${site} is missing: build dom-virus's site (or pass --build)`);
  const { chromium } = await import("playwright");
  const { launchOptions } = await import("../tests/chromium.mjs");
  const browser = await chromium.launch(launchOptions());
  const ctx = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  // Served from the build; nothing else is fetched.
  await ctx.route("http://dv.test/**", (r) => {
    let p = decodeURIComponent(new URL(r.request().url()).pathname.slice(1));
    if (p === "" || p.endsWith("/")) p += "index.html";
    // The build's base path (/dom-virus/ on staging builds): the files sit at the root.
    const f = existsSync(join(site, p)) ? join(site, p) : join(site, p.replace(/^[^/]+\//, ""));
    if (!existsSync(f)) return r.fulfill({ status: 404, body: "" });
    const type = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml" }[p.split(".").pop()] ?? "application/octet-stream";
    return r.fulfill({ body: readFileSync(f), contentType: type });
  });
  const files = {};
  mkdirSync(join(ROOT, OUT), { recursive: true });
  const put = (name, text) => {
    writeFileSync(join(ROOT, OUT, name), text);
    files[name] = sha(text);
  };
  for (const piece of PIECES) {
    const page = await ctx.newPage();
    await page.goto(`http://dv.test/${piece.page}`);
    await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
    const sources = await page.evaluate(async () => {
      const out = [];
      for (const el of document.querySelectorAll('link[rel="stylesheet"], style')) out.push(el.tagName === "STYLE" ? el.textContent : await (await fetch(el.href)).text());
      return out;
    });
    const x = await page.evaluate(extract, [piece.root, sources]);
    await page.close();
    const scope = `[data-dv="${piece.id}"]`;
    // Keyframes: `dv-` names, so they never meet the host's.
    let css = x.css, keyframes = x.keyframes.join("\n"), html = x.html;
    // Only inside animation declarations: a class may share a keyframes' name.
    const rename = (decl) => x.names.reduce((d, n) => d.replace(new RegExp(`(?<![\\w-])${n}(?![\\w-])`, "g"), `dv-${n}`), decl);
    css = css.replace(/animation(-name)?:[^;}]*/g, rename);
    html = html.replace(/animation(-name)?:[^;"]*/g, rename);
    for (const n of x.names) keyframes = keyframes.replace(new RegExp(`@keyframes ${n}(?![\\w-])`), `@keyframes dv-${n}`);
    // The @fzlt/core/slot stage lives on the host's figure, not inside the piece: drop dom-virus's own
    // "until the scene is up" rule (the poster shows until then).
    css = css.split("\n").filter((r) => !r.includes("data-fizlet-slot")).join("\n");
    // Shadows take the host domain's direction (--shadow-x/-y, BOARD-UI.md §4.1): dom-virus's 45°
    // slabs and press travel keep their depth and follow the page they are on.
    css = tokenShadows(css);
    keyframes = tokenShadows(keyframes);
    // Inert: links become spans, no view-transition names.
    html = html
      .replace(/<a\b([^>]*?)\shref="[^"]*"/g, "<span$1")
      .replace(/<\/a>/g, "</span>")
      .replace(/\s?view-transition-name:\s*[\w-]+;?/g, "")
      .replace(/\sstyle=""/g, "")
      .replace(/^/, `<div data-dv="${piece.id}" style="display:contents">`) + "</div>";
    const vars = Object.entries(x.vars).map(([k, v]) => `${k}:${v}`).join(";");
    const style = HEAD(piece.title) + `${scope}{${vars}}\n@scope (${scope}) {\n${css}\n}\n${keyframes}\n`;
    put(`${piece.id}.html`, html + "\n");
    put(`${piece.id}.css`, style);
    for (const [src, name] of Object.entries(piece.ts)) put(name, HEAD(src) + imports(readFileSync(join(from, src), "utf8")));
  }
  await browser.close();
  const origin = { repo: REPO, commit: PIN, by: "scripts/vendor-dom-virus.mjs", pieces: PIECES.map((p) => ({ id: p.id, page: p.page, root: p.root, ts: p.ts })), files };
  writeFileSync(join(ROOT, OUT, "ORIGIN.json"), JSON.stringify(origin, null, 2) + "\n");
  console.log(`vendored ${Object.keys(files).length} files from dom-virus @ ${PIN.slice(0, 7)} into ${OUT}/`);
}

/** Every vendored file matches ORIGIN.json, at PIN (no hand edits). [] when clean. */
export function check(dir = join(ROOT, OUT)) {
  const problems = [];
  const origin = JSON.parse(readFileSync(join(dir, "ORIGIN.json"), "utf8"));
  if (origin.commit !== PIN) problems.push(`ORIGIN.json is at ${origin.commit}, PIN is ${PIN}: vendor again`);
  for (const [name, hash] of Object.entries(origin.files)) {
    const f = join(dir, name);
    if (!existsSync(f)) problems.push(`${name}: missing`);
    else if (sha(readFileSync(f, "utf8")) !== hash) problems.push(`${name}: edited by hand (sha256 differs from ORIGIN.json); change it in dom-virus and vendor again`);
  }
  for (const p of PIECES) if (/<a\s[^>]*href=/.test(readFileSync(join(dir, `${p.id}.html`), "utf8"))) problems.push(`${p.id}.html: a link (pieces are inert)`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    const p = check();
    if (p.length) (console.error(p.join("\n")), process.exit(1));
    console.log(`${OUT}: every file matches ORIGIN.json (dom-virus @ ${PIN.slice(0, 7)})`);
  } else {
    const i = args.indexOf("--from");
    if (i < 0) (console.error("usage: node scripts/vendor-dom-virus.mjs --from <dom-virus checkout> [--build] | --check"), process.exit(2));
    await vendor(resolve(args[i + 1]), args.includes("--build"));
  }
}
