// fzlt.dev landing page (site/fzlt-dev/build.mjs, `npm run site:fzlt`): it builds; it requests nothing
// outside its own folder (every other URL is a link); it logs no console errors and runs no script;
// it passes the site's SEO and accessibility gates (scripts/check-html.mjs, canonical https://fzlt.dev/);
// it carries the marks, the trademark note, the byline and the install line; light and dark follow
// the system with no script, on the kit's tokens; nothing overflows sideways at 360 or 390px.
// FZLT_SHOTS=<dir> also saves fzlt-dev-<width>-<theme>.png at 1440 and 390.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const OUT = mkdtempSync(join(tmpdir(), "fzlt-dev-"));
const SHOTS = process.env.FZLT_SHOTS;
try {
  execFileSync(process.execPath, ["site/fzlt-dev/build.mjs", OUT], { stdio: ["ignore", "ignore", "inherit"] });
  for (const f of ["index.html", "fzlt.css", "icon.svg"]) assert.ok(existsSync(join(OUT, f)), `built ${f}`);
  const html = readFileSync(join(OUT, "index.html"), "utf8");
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));

  // The SEO and accessibility gates, on the page's own host.
  process.env.FIZLET_SITE = "https://fzlt.dev/";
  const { checkHtml } = await import("../scripts/check-html.mjs");
  assert.deepEqual(checkHtml(html, ""), []);

  // Copy: both marks with ™ on first use, the trademark note, the byline, the install line.
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const body = text.slice(text.indexOf("Skip to content"));
  assert.ok(body.indexOf("Fizlet™") >= 0 && body.indexOf("Fizlet™") <= body.indexOf("Fizlet "), "Fizlet™ on first use in prose");
  assert.ok(body.includes("fzlt™"));
  assert.ok(text.includes("Fizlet and fzlt are trademarks of Chris Cooley."));
  assert.match(text, /\b[Bb]y Chris Cooley/);
  assert.ok(text.includes("npm i @fzlt/core"));
  assert.ok(html.includes("<b>FIZLET</b>") && />fzlt</.test(html), "the FIZLET wordmark and the fzlt mark");
  assert.ok(!/®/.test(html), "nothing is registered");
  assert.ok(!/<script\b/i.test(html), "no script");
  const links = [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
  for (const href of ["https://fizlet.com/", "https://fizlet.com/docs/", "https://github.com/coded-dot-design/fizlet", "https://github.com/fizlet", "https://www.npmjs.com/package/@fzlt/core", "https://coded.design/"])
    assert.ok(links.includes(href), `links ${href}`);
  for (const href of links) assert.ok(href === "#main" || href.startsWith("https://"), `an absolute link: ${href}`);

  // A static server for the folder.
  const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml" };
  const server = createServer((req, res) => {
    let f = join(OUT, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, ""));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const ORIGIN = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(launchOptions());
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [360, 740]]) {
      for (const scheme of ["dark", "light"]) {
        const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
        const page = await ctx.newPage();
        const errors = [], requests = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("request", (r) => requests.push(r.url()));
        const res = await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
        assert.equal(res.status(), 200);
        assert.deepEqual(errors, [], `${width} ${scheme}: console errors`);
        const outside = requests.filter((u) => !u.startsWith(ORIGIN + "/"));
        assert.deepEqual(outside, [], `${width} ${scheme}: requests outside the page's folder`);
        const got = await page.evaluate(() => {
          const cs = (sel) => getComputedStyle(document.querySelector(sel));
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            bg: cs("body").backgroundColor,
            ink: cs("body").color,
            sys: getComputedStyle(document.documentElement).getPropertyValue("--k-sys").trim(),
            animations: document.getAnimations().length,
            wordmark: cs(".brand-text b").fontFamily,
          };
        });
        assert.ok(got.overflow <= 0, `${width} ${scheme}: horizontal overflow ${got.overflow}px`);
        // The kit's tokens, by theme: --bg #07060f / #eef0fb, --ink #f6f3ff / #1b1636.
        assert.equal(got.bg, scheme === "dark" ? "rgb(7, 6, 15)" : "rgb(238, 240, 251)", `${width} ${scheme}: background`);
        assert.equal(got.ink, scheme === "dark" ? "rgb(246, 243, 255)" : "rgb(27, 22, 54)", `${width} ${scheme}: ink`);
        assert.equal(got.sys, "#19f0ff");
        assert.equal(got.animations, 0, "settled: nothing animates");
        assert.match(got.wordmark, /monospace/);
        if (SHOTS && width !== 360) await page.screenshot({ path: join(SHOTS, `fzlt-dev-${width}-${scheme}.png`), fullPage: true });
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`fzlt.dev: builds, checkHtml clean, no requests outside its folder, no console errors, light and dark on the kit tokens, no overflow at 1440/390/360 (v${version}).`);
} finally {
  rmSync(OUT, { recursive: true, force: true });
}
