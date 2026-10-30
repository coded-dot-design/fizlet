// Site test (Playwright + Chromium): serves site-dist/ at its root path on the site host (ROOT, "/" on fizlet.com) and checks
// every page at desktop and phone widths: no console errors, every internal link (and #anchor)
// resolves, no horizontal overflow at 360px, the live demo runs (blast, ledger, Recall, pause
// offscreen, reduced motion still frame), the quick start example works, the hosted modules load,
// every page passes the SEO and accessibility gates (scripts/check-html.mjs), every brick page shows
// the size measured on this build, and the brick demos run (settle sleeps, fx, grid, sprite, sound).
// Run `npm run site` first. SITE_SHOTS=<dir> also saves screenshots.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { checkHtml } from "../scripts/check-html.mjs";
import { SITE, ROOT as SITE_ROOT } from "../site/layout.mjs";
import { measure } from "../scripts/sizes.mjs";
import { BRICKS } from "../site/bricks.mjs";
import { entries as galleryEntries, themes as galleryThemes, contributors, paginate, sections, galleryPath, personPath, PAGE_SIZE } from "../scripts/gallery.mjs";
import { notes as siteNotes, notePath } from "../scripts/notes.mjs";
import { PERSONA_NOTE, authorOf, contributors as profiles } from "../scripts/people.mjs";
import { gzipSync } from "node:zlib";
import { checkKeys, checkTaps } from "./keys.mjs";
import { liveBytes } from "../scripts/live-bytes.mjs";

const ROOT = "site-dist", BASE = SITE_ROOT;
if (!existsSync(`${ROOT}/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".ts": "text/plain", ".png": "image/png", ".xml": "application/xml" };

// A tiny static server shaped like Pages: <BASE><path>, dir → index.html, else 404.html with 404.
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = null;
  if (url.pathname.startsWith(BASE)) {
    let p = normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, "");
    let f = join(ROOT, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (existsSync(f) && statSync(f).isFile()) file = f;
  }
  if (!file) {
    res.writeHead(404, { "content-type": TYPES[".html"] });
    return res.end(readFileSync(`${ROOT}/404.html`));
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const status = async (path) => (await fetch(ORIGIN + path)).status;

// Every built page, at its URL path ("" is the home page, "bricks/" the bricks index).
const PAGES = readdirSync(ROOT, { recursive: true }).filter((f) => f.endsWith(".html") && !f.startsWith("dist")).map((f) => f.replace(/\\/g, "/").replace(/(^|\/)index\.html$/, "$1")).sort();
for (const b of BRICKS) assert.ok(PAGES.includes(`bricks/${b.id}.html`), `a page for ${b.name}`);
// What counts as a live demo: the home blast board, slot scenes (layers, fizz), brick demos and the
// quick start's canvas. The demos' own standalone pages (built by site/demos/*) have no badge yet.
const DEMOS = "[data-demo], figure.ae-slot, [data-brick-demo], canvas.qs-canvas";
const NO_BADGE = { "demos/fizz/": 1, "demos/layers/": 1, "examples/fizz/": 1 };
let badges = 0, sizeCache = null;
const measured = async () => (sizeCache ??= await measure());
const browser = await chromium.launch(launchOptions());
const shots = process.env.SITE_SHOTS;
let where = "start";

async function open(context, path) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404 (Not Found)") && errors.push(`console: ${m.text()}`));
  page.on("requestfailed", (r) => r.url().startsWith(ORIGIN) && errors.push(`requestfailed: ${r.url()}`));
  page.on("response", (r) => r.url().startsWith(ORIGIN) && r.status() >= 400 && !r.url().endsWith("/missing/page") && errors.push(`${r.status()}: ${r.url()}`));
  await page.goto(ORIGIN + BASE + path, { waitUntil: "load" });
  return { page, errors };
}

try {
  // ---------- SEO and accessibility gates, on the built HTML ----------
  where = "html gates";
  // Pages written by the demos' own build scripts (site/demos/fizz, site/demos/layers) are
  // standalone host pages; their open gaps are listed exactly, so a new gap or a fix both fail here
  // until this list is updated.
  const SEO = ["og:type", "og:title", "og:description", "og:url", "og:image", "og:site_name"].map((p) => `<meta property="${p}">`);
  const LANDMARKS = ["a <header> landmark", "a <nav> landmark", "a <footer> landmark"];
  const KNOWN = { "demos/layers/": LANDMARKS, "examples/fizz/": LANDMARKS };
  for (const path of PAGES) {
    const file = path === "" || path.endsWith("/") ? `${path}index.html` : path;
    const want = KNOWN[path] ?? [];
    assert.deepEqual(checkHtml(readFileSync(`${ROOT}/${file}`, "utf8"), path).sort(), [...want].sort(), `${path || "index"}: html gates`);
  }
  // Search snippets: every indexable page has its own title (30–60) and description (70–155), and
  // JSON-LD that parses; sitemap.xml and llms.txt list exactly those pages; robots.txt points at both.
  const sitemap = readFileSync(`${ROOT}/sitemap.xml`, "utf8"), llms = readFileSync(`${ROOT}/llms.txt`, "utf8"), robots = readFileSync(`${ROOT}/robots.txt`, "utf8");
  const fileOf = (path) => `${ROOT}/${path === "" || path.endsWith("/") ? `${path}index.html` : path}`;
  // Indexable: not the 404, not a noindex page (the gallery archive).
  const indexable = PAGES.filter((p) => p !== "404.html" && !/<meta name="robots" content="[^"]*noindex/i.test(readFileSync(fileOf(p), "utf8")));
  assert.ok(PAGES.includes("gallery/archive/") && !indexable.includes("gallery/archive/"), "the gallery archive is built and kept out of search");
  const heads = indexable.map((path) => {
    const html = readFileSync(`${ROOT}/${path === "" || path.endsWith("/") ? `${path}index.html` : path}`, "utf8");
    for (const [, ld] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(ld);
    return { path, title: html.match(/<title>([^<]*)<\/title>/)[1], desc: html.match(/<meta name="description" content="([^"]*)"/)[1] };
  });
  for (const { path, title, desc } of heads) {
    assert.ok(title.length >= 30 && title.length <= 60, `${path || "index"}: title 30–60 characters (${title.length})`);
    assert.ok(desc.length >= 70 && desc.length <= 155, `${path || "index"}: description 70–155 characters (${desc.length})`);
  }
  assert.equal(new Set(heads.map((h) => h.title)).size, heads.length, "titles are unique");
  assert.equal(new Set(heads.map((h) => h.desc)).size, heads.length, "descriptions are unique");
  assert.equal(sitemap.match(/<loc>/g).length, indexable.length, "the sitemap lists only indexable pages");
  assert.equal(llms.match(/^- \[/gm).length, indexable.length, "llms.txt lists only indexable pages");
  for (const path of indexable) {
    assert.ok(sitemap.includes(`<loc>${SITE}${path}</loc>`), `sitemap lists ${path || "index"}`);
    assert.ok(llms.includes(`](${SITE}${path}):`), `llms.txt lists ${path || "index"}`);
  }
  assert.ok(robots.includes(`Sitemap: ${SITE}sitemap.xml`) && /User-agent: \*\nAllow: \//.test(robots), "robots.txt admits crawlers and names the sitemap");
  assert.equal(await status(`${BASE}og.png`), 200, "the social card");

  // ---------- Brick pages: the sizes are the ones measured on this build ----------
  where = "brick sizes";
  {
    const sizes = await measure();
    for (const b of BRICKS) {
      const html = readFileSync(`${ROOT}/bricks/${b.id}.html`, "utf8");
      for (const name of b.sizes) {
        const s = sizes.find((x) => x.name === name);
        assert.ok(html.includes(`data-size="${name}">${s.gzip.toLocaleString("en-US")} B</b>`), `${b.id}: ${name} shows ${s.gzip} B`);
      }
    }
    const pb = sizes.find((x) => x.name.startsWith("page build"));
    assert.ok(readFileSync(`${ROOT}/index.html`, "utf8").includes(`${pb.gzip.toLocaleString("en-US")} B</b>`), "home: the page build size");
  }

  // ---------- Gallery: data, pages, theme sections, a size badge measured on this build on every entry ----------
  where = "gallery sizes";
  const GALLERY = galleryEntries(), THEMES = galleryThemes(), PEOPLE = contributors(), GPAGES = paginate(GALLERY);
  const INDEX = JSON.parse(readFileSync(`${ROOT}/gallery/index.json`, "utf8"));
  const pageFile = (path) => `${ROOT}/${path}index.html`;
  {
    const loader = gzipSync(readFileSync(`${ROOT}/gallery/gallery.js`)).length;
    for (let i = 1; i < GALLERY.length; i++) assert.ok(GALLERY[i - 1].date >= GALLERY[i].date, "newest first");
    // Pages: PAGE_SIZE entries each, at gallery/ then gallery/page/<n>/; nothing past the last.
    assert.deepEqual(GPAGES.map((p) => p.path), Array.from({ length: Math.max(1, Math.ceil(GALLERY.length / PAGE_SIZE)) }, (_, i) => galleryPath(i + 1)), "one gallery page per PAGE_SIZE entries");
    assert.ok(!PAGES.includes(galleryPath(GPAGES.length + 1)), "no empty gallery page");
    for (const gp of GPAGES) {
      assert.ok(PAGES.includes(gp.path), `${gp.path} is built`);
      const html = readFileSync(pageFile(gp.path), "utf8");
      // Theme sections in theme order (data: site/gallery/themes), newest first inside each.
      const secs = sections(gp.entries, THEMES);
      assert.deepEqual([...html.matchAll(/<section class="gal-theme" id="theme-([^"]+)"/g)].map((m) => m[1]), secs.map((x) => x.theme.id), `${gp.path}: theme sections in order`);
      assert.deepEqual([...html.matchAll(/<li class="panel gal-item" id="([^"]+)"/g)].map((m) => m[1]), secs.flatMap((x) => x.entries.map((e) => e.id)), `${gp.path}: entries by theme, newest first`);
      // The chips: All, then every theme that has entries (with its count), linking to its first section.
      const chips = [...html.matchAll(/data-theme-chip="([^"]+)"[^>]*>[^<]*<small>(\d+)<\/small>/g)].map((m) => [m[1], Number(m[2])]);
      assert.deepEqual(chips, [["all", GALLERY.length], ...THEMES.filter((t) => GALLERY.some((e) => e.theme === t.id)).map((t) => [t.id, GALLERY.filter((e) => e.theme === t.id).length])], `${gp.path}: theme chips and counts`);
      if (GPAGES.length > 1) assert.match(html, /<nav class="gal-pages" aria-label="Gallery pages">/, `${gp.path}: page links`);
      for (const e of gp.entries) {
        const bytes = gzipSync(readFileSync(`${ROOT}/gallery/${e.id}.js`)).length;
        assert.ok(html.includes(`data-bytes="${bytes}" data-live="gallery/${e.id}.js"`), `${e.id}: its badge shows ${bytes} B`);
        assert.ok(html.includes(`data-total="gallery:${e.id}">live ${bytes.toLocaleString("en-US")} B · total <b>${(bytes + loader).toLocaleString("en-US")} B</b>`), `${e.id}: live and total, one size`);
        assert.ok(html.includes(`“${e.prompt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}”`), `${e.id}: its prompt`);
        // Attribution: "by <name>", linked to the contributor's profile.
        const card = html.slice(html.indexOf(`<li class="panel gal-item" id="${e.id}"`)).split("</li>")[0];
        assert.ok(card.includes(`<p class="gal-by">by <a href="${"../".repeat(gp.path.split("/").length - 1)}${personPath(e.author)}">${PEOPLE[e.author].name}</a>${PEOPLE[e.author].kind === "persona" ? ' <small class="gal-persona">house persona</small>' : ""}</p>`), `${e.id}: by ${PEOPLE[e.author].name}, linked`);
      }
    }
    // The generated index: every entry once, newest first, on the page that holds it, its sizes measured on this build.
    assert.deepEqual(INDEX.map((r) => r.id), GALLERY.map((e) => e.id), "gallery/index.json: every entry, newest first");
    for (const r of INDEX) {
      const e = GALLERY.find((x) => x.id === r.id), bytes = gzipSync(readFileSync(`${ROOT}/gallery/${r.id}.js`)).length;
      assert.deepEqual({ kind: r.kind, theme: r.theme, author: r.author, title: r.title, prompt: r.prompt, date: r.date }, { kind: e.kind, theme: e.theme, author: e.author, title: e.title, prompt: e.prompt, date: e.date }, `${r.id}: index row`);
      assert.deepEqual(r.sizes, { live: bytes, total: bytes + loader }, `${r.id}: index sizes measured on this build`);
      assert.equal(r.authorName, PEOPLE[e.author].name);
      assert.equal(r.demo, `gallery/${r.id}.js`);
      const [path, hash] = r.url.split("#");
      assert.ok(hash === r.id && readFileSync(pageFile(path), "utf8").includes(`<li class="panel gal-item" id="${r.id}"`), `${r.id}: its index url ${r.url} is its card`);
    }
    for (const id of ["fizz", "layers", "howitworks"]) assert.ok(GALLERY.some((e) => e.id === id), `seeded with ${id}`);
  }

  // ---------- Heroes and people: every hero has a large card; every contributor a profile ----------
  where = "heroes and people";
  const HEROES = GALLERY.filter((e) => e.kind === "hero");
  {
    assert.ok(HEROES.length >= 2, "at least two heroes");
    const html = readFileSync(pageFile("heroes/"), "utf8");
    assert.deepEqual([...html.matchAll(/<li class="hero-card panel" id="hero-([^"]+)"/g)].map((m) => m[1]), HEROES.map((e) => e.id), "heroes: every hero, newest first");
    for (const e of HEROES) {
      const bytes = gzipSync(readFileSync(`${ROOT}/gallery/${e.id}.js`)).length;
      const card = html.slice(html.indexOf(`id="hero-${e.id}"`)).split("</li>")[0];
      assert.ok(card.includes(`data-bytes="${bytes}" data-live="gallery/${e.id}.js"`), `hero ${e.id}: its badge shows ${bytes} B`);
      assert.ok(card.includes(`<p class="hero-by">by <a href="../${personPath(e.author)}">${PEOPLE[e.author].name}</a>${PEOPLE[e.author].kind === "persona" ? ' <small class="gal-persona">house persona</small>' : ""}</p>`), `hero ${e.id}: by ${PEOPLE[e.author].name}, linked`);
      assert.ok(!/data-slot-target/.test(card), `hero ${e.id}: no gallery slot wiring on its poster`);
    }
    assert.ok(PEOPLE["chris-cooley"], "the owner's profile");
    for (const person of Object.values(PEOPLE)) {
      assert.ok(PAGES.includes(personPath(person.id)), `${person.id}: a profile page`);
      const p = readFileSync(pageFile(personPath(person.id)), "utf8");
      assert.ok(p.includes(`<h1 id="person-name" data-person="${person.id}">${person.name}</h1>`), `${person.id}: named`);
      for (const e of GALLERY.filter((x) => x.author === person.id)) assert.ok(p.includes(`>${e.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a>`), `${person.id}: lists ${e.id}`);
    }
  }

  // ---------- Notes: every note built, newest first on the index, by Chris Cooley, kernel badge measured on this build ----------
  where = "notes";
  {
    const NOTES = siteNotes(), kernel = (await measure())[0];
    assert.ok(NOTES.length > 0, "at least one note");
    const index = readFileSync(`${ROOT}/notes/index.html`, "utf8");
    assert.deepEqual([...index.matchAll(/<h2><a href="\.\.\/notes\/([^/]+)\/">/g)].map((m) => m[1]), NOTES.map((n) => n.slug), "the index lists every note, newest first");
    for (const n of NOTES) {
      assert.ok(PAGES.includes(notePath(n)), `${n.slug}: built at ${notePath(n)}`);
      const html = readFileSync(`${ROOT}/${notePath(n)}index.html`, "utf8");
      assert.ok(html.includes(`data-bytes="${kernel.gzip}" data-live="size:${kernel.name}"`), `${n.slug}: the kernel badge shows ${kernel.gzip} B, measured on this build`);
      assert.match(html, /<p class="note-by">By <a href="https:\/\/coded\.design\/">Chris Cooley<\/a>/, `${n.slug}: by Chris Cooley`);
      const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
      const post = graph.find((x) => x["@type"] === "BlogPosting");
      assert.equal(post.headline, n.title);
      assert.equal(post.datePublished, n.date);
      assert.equal(graph.find((x) => x["@id"] === post.author["@id"]).name, "Chris Cooley");
      const faq = n.blocks.filter((b) => b.type === "faq").flatMap((b) => b.items).length;
      assert.equal(graph.find((x) => x["@type"] === "FAQPage")?.mainEntity.length ?? 0, faq, `${n.slug}: its questions in JSON-LD`);
      assert.ok(llms.includes(`](${SITE}${notePath(n)}):`) && /## Notes\n/.test(llms), `${n.slug}: llms.txt lists it under Notes`);
    }
  }

  // ---------- People and the daily contest: stats measured on this build, personas say so ----------
  where = "people";
  {
    const people = profiles(), index = readFileSync(`${ROOT}/people/index.html`, "utf8");
    assert.deepEqual([...index.matchAll(/data-person="([^"]+)"/g)].map((m) => m[1]), people.map((p) => p.id), "the index lists everyone, the maker first");
    for (const p of people) {
      assert.ok(PAGES.includes(`people/${p.id}/`), `${p.id}: built`);
      const html = readFileSync(`${ROOT}/people/${p.id}/index.html`, "utf8");
      const mine = GALLERY.filter((e) => authorOf(e) === p.id);
      const bytes = mine.reduce((n, e) => n + gzipSync(readFileSync(`${ROOT}/gallery/${e.id}.js`)).length, 0);
      assert.ok(html.includes(`data-stat="entries">${mine.length}</b>`) && html.includes(`data-stat="bytes">${bytes.toLocaleString("en-US")} B</b>`), `${p.id}: ${mine.length} entries, ${bytes} B, measured`);
      assert.equal(html.includes(PERSONA_NOTE.replace(/ — /, "</b> — ")), p.kind === "persona", `${p.id}: the persona line`);
      const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
      const profile = graph.find((x) => x["@type"] === "ProfilePage");
      assert.ok(p.kind === "owner" ? profile.mainEntity["@id"].endsWith("#author") : !profile.mainEntity && profile.about["@type"] !== "Person", `${p.id}: only the maker is a Person`);
    }
    const contest = readFileSync(`${ROOT}/contest/index.html`, "utf8");
    assert.match(contest, /60 characters or fewer/);
    assert.match(contest, /Not live yet/, "open prompts are planned, not live");
  }

  // ---------- Every page, desktop and phone: errors, links, overflow ----------
  const checked = new Set();
  for (const [label, viewport] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 360, height: 740 }]]) {
    const context = await browser.newContext({ viewport });
    for (const path of PAGES) {
      where = `${label} ${path || "index"}`;
      const { page, errors } = await open(context, path);
      await page.waitForTimeout(300);
      // Overflow: let the body show it (the site hides stray overflow-x), then compare widths. Also
      // catch content cut off by a clipping section (overflow: hidden): only a real scroll
      // container (a code block, a table) may hold something wider than the screen.
      const over = await page.evaluate(() => {
        document.body.style.overflowX = "visible";
        const w = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= w + 1) return false;
          // A slot's scene (figure.ae-slot) clips its own stage: what it draws past its edge is cut, by design.
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowX) || p.matches("figure.ae-slot")) return false;
          return true;
        }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${el.className} → ${Math.round(el.getBoundingClientRect().right)}`);
        return { scroll: document.documentElement.scrollWidth, w, wide };
      });
      assert.ok(over.scroll <= over.w, `${where}: horizontal overflow ${over.scroll} > ${over.w}: ${over.wide.join(", ")}`);
      assert.deepEqual(over.wide, [], `${where}: content wider than the screen`);
      if (label === "desktop") {
        // Size badges: every live demo on the page sits in a host that shows what it ships, and the
        // number is the gzip size of the built file it names (measured again here).
        const demo = await page.evaluate((sel) => {
          const out = { missing: [], badges: [] };
          for (const el of document.querySelectorAll(sel)) {
            const host = el.closest("[data-demo-host]");
            const b = host?.querySelector("[data-size-badge]");
            if (!b) out.missing.push(el.outerHTML.slice(0, 80));
          }
          for (const b of document.querySelectorAll("[data-size-badge]")) {
            const r = b.getBoundingClientRect();
            out.badges.push({ bytes: Number(b.dataset.bytes), live: b.dataset.live, text: b.textContent, visible: r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== "hidden" });
          }
          return out;
        }, DEMOS);
        const knownMissing = NO_BADGE[path] ?? 0;
        assert.equal(demo.missing.length, knownMissing, `${where}: a live demo without a size badge: ${demo.missing.join(" | ")}`);
        for (const b of demo.badges) {
          const want = b.live.startsWith("size:") ? (await measured()).find((x) => x.name === b.live.slice(5))?.gzip : liveBytes(`${ROOT}/${b.live}`);
          assert.equal(b.bytes, want, `${where}: badge for ${b.live} shows the measured bytes`);
          assert.ok(b.text.startsWith(`${(b.bytes / 1024).toFixed(1)} KB gz`), `${where}: badge text "${b.text}"`);
          assert.ok(b.visible, `${where}: badge for ${b.live} is visible`);
        }
        badges += demo.badges.length;
        const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
        for (const href of links) {
          const u = new URL(href);
          if (u.origin !== new URL(ORIGIN).origin) {
            assert.match(u.protocol, /^https:$/, `${where}: external link should be https: ${href}`);
            continue;
          }
          const key = u.pathname + u.hash;
          if (checked.has(key)) continue;
          checked.add(key);
          assert.equal(await status(u.pathname), 200, `${where}: broken link ${href}`);
          if (u.hash) {
            const html = await (await fetch(ORIGIN + u.pathname)).text();
            assert.ok(html.includes(`id="${u.hash.slice(1)}"`), `${where}: missing anchor ${href}`);
          }
        }
      }
      if (shots && path !== "404.html") await page.screenshot({ path: `${shots}/fizlet-site-${label}${path ? "-" + path.replace(/\W+/g, "-").replace(/-html$|-$/, "") : ""}.png`, fullPage: true });
      assert.deepEqual(errors, [], `${where}: errors`);
      await page.close();
    }
    await context.close();
  }

  // ---------- Page keys: every in-page key presses (face drops) and clicks on face and base ----------
  let keyCount = 0;
  for (const path of ["", "bricks/", "bricks/kernel.html", "bricks/sound.html", "examples/quick-start.html", "gallery/", "heroes/", "contest/", ...siteNotes().map(notePath)]) {
    where = `page keys ${path || "index"}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors } = await open(context, path);
    if (path === "bricks/sound.html") await page.waitForSelector("[data-brick-demo][data-ready]");
    keyCount += await checkKeys(page, where);
    assert.deepEqual(errors, [], `${where}: errors`);
    await context.close();
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tap = await open(phone, path);
    // Heroes: on a phone the other cards sit off to the side, and a scroll to one of their keys snaps the
    // row to that card (the key moves under the tap); the centre card's keys are tapped.
    await checkTaps(tap.page, `${where} (phone)`, { skip: path === "heroes/" ? "[data-hero]:not([aria-current])" : "" });
    await phone.close();
  }

  // ---------- 404 at any depth ----------
  where = "404";
  assert.equal(await status(`${BASE}missing/page`), 404);
  {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const { page, errors } = await open(context, "missing/page");
    assert.equal(await page.locator("h1").textContent(), "This square is off the board.");
    assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector(".site-head")).position === "sticky"), "404 is styled from any depth");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- The live demo ----------
  where = "demo";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "");
    const stats = () => page.evaluate(() => window.fizletDemo.engine.stats());
    // The blast demo sits below the hero: it runs only once on screen.
    const toDemo = () => page.evaluate(() => document.querySelector("[data-demo]").scrollIntoView({ block: "center" }));
    await toDemo();
    await page.waitForFunction(() => window.fizletDemo?.engine.stats().frames > 20);
    // Untouched, it settles: no frames at all while nothing moves, and the HUD says so.
    await page.waitForFunction(() => window.fizletDemo.engine.paused.includes("settled"), null, { timeout: 4000 });
    const still = (await stats()).frames;
    await page.waitForTimeout(400);
    assert.equal((await stats()).frames, still, "settled: no frames while nothing moves");
    await page.waitForFunction(() => /SETTLED/.test(document.querySelector("[data-demo] [data-state]").textContent), null, { timeout: 2000 });
    const board = page.locator("[data-demo] [data-board]");
    const box = await board.boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.25);
    await page.waitForFunction(() => window.fizletDemo.fx.live > 0);
    await page.click("[data-demo] [data-blast]");
    await page.waitForTimeout(700);
    let s = await stats();
    assert.ok(s.steps > 30 && s.frames > 20, "the engine steps");
    assert.ok(s.ledger > 0, "blasts changed the page through the ledger");
    assert.equal(s.pools.waves.cap, 8);
    assert.equal(await page.evaluate(() => window.fizletDemo.engine.violations), 0, "no layout reads in a step");
    const moved = await page.evaluate(() => [...document.querySelectorAll("[data-body]")].filter((el) => el.style.transform).length);
    assert.ok(moved > 3, `letters were knocked (${moved})`);
    assert.equal(await page.locator("[data-demo] [data-state]").textContent(), "RUNNING");
    await page.waitForTimeout(150);
    assert.notEqual(await page.locator('[data-demo] [data-stat="frames"]').textContent(), "0", "the HUD shows live stats");
    // Recall: the page comes back exactly.
    await page.click("[data-demo] [data-recall]");
    const back = await page.evaluate(() => ({
      text: document.querySelector(".demo-title").textContent,
      styled: [...document.querySelectorAll("[data-page], [data-page] *")].filter((el) => el.hasAttribute("style")).length,
      hot: document.querySelectorAll(".hot").length,
      ledger: window.fizletDemo.engine.ledger.size,
    }));
    assert.deepEqual(back, { text: "Hello, page.", styled: 0, hot: 0, ledger: 0 }, "Recall restores the page");
    assert.equal(await page.locator("[data-demo] [data-slam]").isVisible(), true, "the RESTORED sticker slams in");
    // Scrolled away: the engine pauses (and costs nothing).
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => window.fizletDemo.engine.paused.includes("offscreen"));
    const frozen = (await stats()).frames;
    await page.waitForTimeout(300);
    assert.equal((await stats()).frames, frozen, "no frames while off screen");
    await toDemo();
    await page.waitForFunction(() => !window.fizletDemo.engine.paused.includes("offscreen"));
    // The home page also carries the two story demos: the layers hero and the fizz can.
    assert.equal(await page.locator("figure.lyr[data-slot-target]").count(), 1, "the layers hero");
    assert.equal(await page.locator(".fizz-slot figure.ae-slot[data-slot-target='fizz#hero']").count(), 1, "the fizz can in the story");
    // The theme toggle (shared key with DOM VIRUS and Battlefield).
    await page.click("[data-theme-toggle]");
    assert.equal(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("dom-virus:theme")].join()), "light,light");
    // The hosted ES modules from the quick start load.
    const mods = await page.evaluate(async (base) => {
      const k = await import(`${base}dist/index.js`), fx = await import(`${base}dist/fx.js`), input = await import(`${base}dist/input.js`);
      return [typeof k.createEngine, typeof fx.effects, typeof input.controls].join();
    }, BASE);
    assert.equal(mods, "function,function,function");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- Gallery: each live demo loads only near the screen, plays, and gives the page back ----------
  // ---------- Ambient slots: the fps cap holds on the page's own frame count ----------
  where = "slot fps cap";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const raw = requestAnimationFrame.bind(window);
      window.__raf = 0;
      window.requestAnimationFrame = (cb) => (window.__raf++, raw(cb));
    });
    await page.goto(`${ORIGIN}${BASE}demos/fizz/`);
    await page.locator("figure.ae-slot[data-slot-target='fizz#hero']").scrollIntoViewIfNeeded();
    await page.waitForSelector("[data-fizlet-slot='fizz#hero'] canvas", { timeout: 8000 });
    const n0 = await page.evaluate(() => window.__raf);
    await page.waitForTimeout(1000);
    const n = (await page.evaluate(() => window.__raf)) - n0;
    // fps: 30 means ~30 requestAnimationFrame calls a second, not one per vsync with frames skipped.
    assert.ok(n > 5 && n <= 33, `the fizz story asks for ${n} frames a second (cap 30)`);
    await context.close();
  }
  // ---------- Gallery at phone width: a slot's CSS animation stops once it is off screen ----------
  where = "gallery, offscreen";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const { page, errors } = await open(context, "gallery/");
    const fig = "figure[data-slot-target='gallery#howitworks']";
    await page.$eval(fig, (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForSelector(`${fig} [data-demo]`, { timeout: 8000 });
    await page.$eval(fig, (el) => scrollTo({ top: el.getBoundingClientRect().bottom + scrollY + 50, behavior: "instant" }));
    await page.waitForSelector(`${fig} [data-demo][data-offscreen]`, { state: "attached", timeout: 3000 });
    const running = await page.$eval(fig, (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").map((a) => a.animationName));
    assert.deepEqual(running, [], "no CSS animation runs in the slot off screen");
    assert.deepEqual(errors, []);
    await context.close();
  }

  where = "gallery";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "gallery/");
    const loaded = [];
    page.on("request", (r) => r.url().includes("/gallery/") && r.url().endsWith(".js") && loaded.push(r.url().split("/gallery/")[1]));
    await page.waitForTimeout(600);
    const G1 = GPAGES[0].entries;
    const last = sections(G1, THEMES).flatMap((x) => x.entries).at(-1).id;
    assert.ok(!loaded.includes(`${last}.js`), `${last} (far below) has not loaded yet`);
    for (const e of G1) {
      await page.$eval(`#${e.id}`, (el) => el.scrollIntoView({ block: "center" }));
      await page.waitForSelector(`figure[data-gallery="${e.id}"][data-live]`, { timeout: 8000 });
      await page.waitForFunction((id) => document.querySelector(`figure[data-gallery="${id}"] > :not(.ae-slot__placeholder):not(template)`), e.id, { timeout: 8000 });
    }
    assert.deepEqual(G1.map((e) => e.id).filter((id) => !loaded.includes(`${id}.js`)), [], "every entry mounted");
    // A generated spray draws on a tap.
    const spray = G1.find((e) => e.made === "fe anim" && e.stage !== "page");
    if (spray) {
      const fig = page.locator(`figure[data-gallery="${spray.id}"]`);
      await fig.scrollIntoViewIfNeeded();
      await fig.click({ position: { x: 120, y: 80 } });
      await page.waitForTimeout(120);
      const ink = await page.$eval(`figure[data-gallery="${spray.id}"] canvas`, (c) => {
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        return n;
      });
      assert.ok(ink > 30, `${spray.id}: a tap sprays (${ink} px)`);
    }
    // A page scene reads its figure's own elements: a tap starts the sweep there, headings light up
    // (through the ledger), and they go back to exactly what they were.
    for (const e of G1.filter((x) => x.stage === "page")) {
      const fig = page.locator(`figure[data-gallery="${e.id}"]`);
      await fig.scrollIntoViewIfNeeded();
      const unlit = () => page.waitForFunction((id) => !document.querySelector(`figure[data-gallery="${id}"] [data-fizlet-lit]`), e.id, { timeout: 8000 });
      // The play on mount has passed: unlit twice, longer apart than any gap between lit elements
      // (a scene paused off screen resumes mid-play when it is scrolled back in).
      await unlit();
      await page.waitForTimeout(1800);
      await unlit();
      const before = await fig.evaluate((f) => f.querySelector(".gal-mini").outerHTML);
      await fig.click({ position: { x: 40, y: 10 } });
      await page.waitForFunction((id) => document.querySelector(`figure[data-gallery="${id}"] [data-fizlet-lit]`), e.id, { timeout: 4000 });
      await unlit();
      assert.equal(await fig.evaluate((f) => f.querySelector(".gal-mini").outerHTML), before, `${e.id}: the page it lit is back as it was`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  where = "gallery, reduced motion";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const { page, errors } = await open(context, "gallery/");
    const loaded = [];
    page.on("request", (r) => r.url().includes("/gallery/") && r.url().endsWith(".js") && !r.url().endsWith("gallery.js") && loaded.push(r.url()));
    for (const e of GPAGES[0].entries) await page.$eval(`#${e.id}`, (el) => el.scrollIntoView({ block: "center" })), await page.waitForTimeout(250);
    assert.deepEqual(loaded, [], "reduced motion: no scene loads, the posters stay");
    assert.equal(await page.locator("figure[data-gallery] .ae-slot__placeholder").count(), GPAGES[0].entries.length);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- Gallery browse: the theme filter and the search over the generated index ----------
  where = "gallery browse";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "gallery/");
    const secs = sections(GPAGES[0].entries, THEMES).map((x) => x.theme.id);
    const shown = () => page.$$eval("section[data-theme-section]", (l) => l.filter((x) => !x.hidden).map((x) => x.dataset.themeSection));
    for (const id of secs) {
      await page.click(`a[data-theme-chip="${id}"]`);
      assert.deepEqual(await shown(), [id], `filter ${id}: only its section`);
      assert.equal(await page.getAttribute(`a[data-theme-chip="${id}"]`, "aria-current"), "true");
      assert.equal(new URL(page.url()).hash, `#theme-${id}`, `filter ${id}: in the address`);
    }
    await page.click('a[data-theme-chip="all"]');
    assert.deepEqual(await shown(), secs, "All: every section again");
    // A theme in the address filters on arrival (a fresh page: from this one it is only a hash change).
    {
      const fresh = await open(context, `gallery/#theme-${secs[0]}`);
      const there = await fresh.page.$$eval("section[data-theme-section]", (l) => l.filter((x) => !x.hidden).map((x) => x.dataset.themeSection));
      assert.deepEqual(there, [secs[0]], "a #theme- address filters");
      await fresh.page.close();
    }
    // Search: shown with script, every word must match title, prompt, theme or author.
    assert.equal(await page.isVisible("form[data-gal-search]"), true, "the search box");
    const q = (text) => page.fill("#gal-q", text).then(() => page.waitForFunction((t) => document.querySelector("#gal-q").value === t && document.querySelector("[data-gal-found]").textContent !== "", text));
    const hits = () => page.$$eval("[data-gal-results] a", (l) => l.map((a) => new URL(a.href).hash.slice(1)));
    const sample = GALLERY.find((e) => e.made === "fe anim") ?? GALLERY[0];
    await q(sample.prompt.split(" ").slice(0, 3).join(" ").toUpperCase());
    assert.ok((await hits()).includes(sample.id), `search finds ${sample.id} by its prompt`);
    await q(PEOPLE[sample.author].name.toLowerCase());
    assert.equal((await hits()).length, Math.min(24, GALLERY.filter((e) => e.author === sample.author).length), "search by author");
    await q("zzqx nothing");
    assert.match(await page.textContent("[data-gal-found]"), /^0 matches/);
    assert.equal((await hits()).length, 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- Heroes: the centre card plays, the rest are posters; keys move; full screen and back ----------
  where = "heroes";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "heroes/");
    const playing = () => page.$$eval("[data-hero]", (l) => l.filter((c) => c.dataset.playing && c.querySelector("[data-fizlet-slot]")).map((c) => c.dataset.hero));
    const centre = () => page.$eval("[data-hero-track]", (t) => t.querySelector("[aria-current]")?.dataset.hero ?? null);
    await page.$eval("[data-hero-track]", (t) => t.scrollIntoView({ block: "center" }));
    const box = await page.locator(".hero-stage figure").first().boundingBox();
    assert.ok(box.width >= 300 && box.height >= 300, `hero cards are large (${box.width}×${box.height})`);
    await page.waitForFunction((id) => document.querySelector(`[data-hero="${id}"][data-playing] [data-fizlet-slot]`), HEROES[0].id, { timeout: 8000 });
    assert.deepEqual(await playing(), [HEROES[0].id], "the first hero is in the centre and plays alone");
    assert.equal(await page.getAttribute(`[data-hero="${HEROES[0].id}"] [data-hero-play]`, "aria-pressed"), "true");
    assert.equal(await page.isDisabled("[data-hero-prev]"), true, "prev is off at the first card");
    // Next: the second card comes to the centre and plays; the first goes back to its poster.
    await page.click("[data-hero-next]");
    await page.waitForFunction((id) => document.querySelector(`[data-hero="${id}"][data-playing] [data-fizlet-slot]`), HEROES[1].id, { timeout: 8000 });
    await page.waitForFunction((id) => !document.querySelector(`[data-hero="${id}"] [data-fizlet-slot]`), HEROES[0].id);
    assert.equal(await centre(), HEROES[1].id);
    assert.equal(await page.isVisible(`[data-hero="${HEROES[0].id}"] .ae-slot__placeholder, [data-hero="${HEROES[0].id}"] .fz-poster`), true, "the first is its poster again");
    // Arrow keys on the row move a card.
    await page.focus("[data-hero-track]");
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction((id) => document.querySelector(`[data-hero-track] [aria-current]`)?.dataset.hero === id, HEROES[0].id, { timeout: 4000 });
    // Its Play key pauses it (and the centre does not restart it) and plays it again.
    const key = `[data-hero="${HEROES[0].id}"] [data-hero-play]`;
    await page.waitForFunction((k) => document.querySelector(k).getAttribute("aria-pressed") === "true", key);
    await page.click(key);
    assert.equal(await page.getAttribute(key, "aria-pressed"), "false");
    await page.waitForTimeout(300);
    assert.deepEqual(await playing(), [], "paused by hand: a poster");
    await page.click(key);
    await page.waitForFunction((id) => document.querySelector(`[data-hero="${id}"][data-playing] [data-fizlet-slot]`), HEROES[0].id, { timeout: 8000 });
    // Full screen (or the overlay), Esc closes, focus back on the key that opened it.
    const openKey = `[data-hero="${HEROES[0].id}"] [data-hero-open]`;
    await page.focus(openKey);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.fullscreenElement?.matches("[data-hero-stage]") || document.querySelector(".hero-stage.hero-full"), null, { timeout: 4000 });
    assert.equal(await page.evaluate(() => document.activeElement?.matches("[data-hero-close]")), true, "focus on Close in full screen");
    await page.waitForFunction((id) => document.querySelector(`[data-hero="${id}"][data-playing] [data-fizlet-slot]`), HEROES[0].id, { timeout: 8000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector(".hero-full"), null, { timeout: 4000 });
    await page.waitForFunction((k) => document.activeElement === document.querySelector(k), openKey, { timeout: 2000 }); // focus returns to the key that opened it
    assert.equal(await page.isHidden(`[data-hero="${HEROES[0].id}"] [data-hero-close]`), true);
    // The overlay, where the Fullscreen API is missing.
    await page.evaluate(() => Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false }));
    await page.click(openKey);
    await page.waitForSelector(".hero-stage.hero-full[role=dialog][aria-modal=true]");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.matches("[data-hero-close]")), true, "the overlay keeps focus");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".hero-full"));
    await page.waitForFunction((k) => document.activeElement === document.querySelector(k), openKey, { timeout: 2000 }); // focus returns after the overlay
    assert.deepEqual(errors, []);
    await context.close();
  }
  where = "heroes, reduced motion";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const { page, errors } = await open(context, "heroes/");
    const loaded = [];
    page.on("request", (r) => /\/gallery\/[^/]+\.js$/.test(r.url()) && !r.url().endsWith("heroes.js") && loaded.push(r.url()));
    await page.$eval("[data-hero-track]", (t) => t.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    assert.deepEqual(loaded, [], "reduced motion: posters, nothing loads");
    const box = await page.locator(".hero-stage figure").first().boundingBox();
    assert.ok(box.width >= 300 && box.height >= 300, `hero cards stay large on a phone (${box.width}×${box.height})`);
    await page.click(`[data-hero="${HEROES[0].id}"] [data-hero-play]`);
    await page.waitForFunction((id) => document.querySelector(`[data-hero="${id}"][data-playing] [data-fizlet-slot]`), HEROES[0].id, { timeout: 8000 });
    assert.equal(loaded.length, 1, "Play loads that hero, on request");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- Reduced motion: a still frame, never an animation ----------
  where = "reduced motion";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const { page, errors } = await open(context, "");
    await page.waitForFunction(() => window.fizletDemo);
    assert.equal(await page.evaluate(() => window.fizletDemo.engine.running), false, "paused under reduced motion");
    assert.match(await page.locator("[data-demo] [data-state]").textContent(), /STILL/);
    await page.locator("[data-demo] [data-board]").click({ position: { x: 60, y: 50 } });
    const r = await page.evaluate(() => ({ ledger: window.fizletDemo.engine.ledger.size, live: window.fizletDemo.fx.live, running: window.fizletDemo.engine.running }));
    assert.ok(r.ledger > 0, "the click still lands (straight to the end state)");
    assert.equal(r.live, 0, "no particles left in flight: a still frame");
    assert.equal(r.running, false);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- The quick start example runs ----------
  where = "quick start";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "examples/quick-start.html");
    await page.locator("#board").click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(120);
    const ink = await page.evaluate(() => {
      const c = document.getElementById("board"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    assert.ok(ink > 500, `the blast drew (${ink} px)`);
    assert.equal(await page.evaluate(() => typeof window.fizlet.createEngine), "function", "window.fizlet from the script tag");
    assert.deepEqual(errors, []);
    await context.close();
  }
  // ---------- Brick demos ----------
  where = "brick demos";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const ink = (page) => page.evaluate(() => {
      const c = document.querySelector(".bd-canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    // Kernel: settle. A click wakes the engine; once the puck stops it sleeps and frames stop.
    let { page, errors } = await open(context, "bricks/kernel.html");
    await page.waitForSelector("[data-brick-demo][data-ready]");
    const statusText = () => page.locator("[data-status]").textContent();
    await page.waitForFunction(() => /SETTLED/.test(document.querySelector("[data-status]").textContent), null, { timeout: 5000 });
    await page.locator(".bd-canvas").click({ position: { x: 60, y: 40 } });
    await page.waitForTimeout(100);
    assert.match(await statusText(), /RUNNING/, "a click wakes it");
    await page.waitForFunction(() => /SETTLED/.test(document.querySelector("[data-status]").textContent), null, { timeout: 5000 });
    const a = await statusText();
    await page.waitForTimeout(700);
    assert.equal(await statusText(), a, "no frames once settled");
    assert.deepEqual(errors, []);
    await page.close();
    // fx: a click blasts.
    ({ page, errors } = await open(context, "bricks/fx.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    await page.locator(".bd-canvas").click({ position: { x: 300, y: 120 } });
    await page.waitForTimeout(120);
    assert.ok((await ink(page)) > 500, "the blast drew");
    assert.deepEqual(errors, []);
    await page.close();
    // grid: a click finds a path (or says there is none).
    ({ page, errors } = await open(context, "bricks/grid.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    await page.locator(".bd-canvas").click({ position: { x: 300, y: 120 } });
    assert.match(await statusText(), /steps · \d+ cells searched|NO PATH/);
    assert.ok((await ink(page)) > 500, "the board drew");
    assert.deepEqual(errors, []);
    await page.close();
    // sprite: drawn on the canvas and as an <img> with alt text.
    ({ page, errors } = await open(context, "bricks/sprite.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    assert.ok((await ink(page)) > 200, "the sprites drew");
    assert.ok(await page.evaluate(() => { const i = document.querySelector(".bd-img"); return i.complete && i.naturalWidth > 0 && i.alt.length > 0; }), "the SVG sprite image loads");
    assert.deepEqual(errors, []);
    await page.close();
    // sound: a key per cue; a press wakes the engine.
    ({ page, errors } = await open(context, "bricks/sound.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    assert.equal(await page.locator(".bd-key").count(), 9);
    await page.locator(".bd-key").first().click();
    assert.match(await statusText(), /RUNNING/);
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Reduced motion: the demos show a still frame and never run.
  where = "brick demos, reduced motion";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const { page, errors } = await open(context, "bricks/fx.html");
    await page.waitForSelector("[data-brick-demo][data-ready]");
    await page.locator(".bd-canvas").click({ position: { x: 100, y: 40 } });
    assert.match(await page.locator("[data-status]").textContent(), /REDUCED-MOTION/);
    assert.deepEqual(errors, []);
    await context.close();
  }
  assert.ok(badges >= 9 + GALLERY.length, `size badges on the home page, the quick start, every brick demo and every gallery entry (${badges})`);
  console.log(`site: ${PAGES.length} pages × 2 widths, html gates, gallery (${GALLERY.length} entries), ${badges} size badges, ${checked.size} internal links, demo, brick demos, ${keyCount} page keys, reduced motion and quick start ok`);
} catch (err) {
  console.error(`site test failed at: ${where}`);
  throw err;
} finally {
  await browser.close();
  server.close();
}
