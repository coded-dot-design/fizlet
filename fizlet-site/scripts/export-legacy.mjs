// One-time migration export: reads the legacy fizlet.com build (coded-dot-design/fizlet `npm run site`
// → site-dist/) and writes the content this Astro site renders, as data under src/data/legacy/.
// The output is committed, so this repo builds on its own; re-run it only to refresh a snapshot:
//   node scripts/export-legacy.mjs ../site-dist
// Every number in the output was measured by the legacy build that produced it (its version is
// recorded in site.json); nothing here is typed by hand.
import { parse as parseHtml } from "node-html-parser";
// <pre> parsed as elements (its <code> child is what a code block holds), not as raw text.
const parse = (html) => parseHtml(html, { blockTextElements: { script: true, noscript: true, style: true } });
/** Does element `n` match one of the simple selectors `tag.class` in `list`? */
const is = (n, list) => list.split(/,\s*/).some((sel) => { const [tag, ...cls] = sel.split("."); return (!tag || n.tagName?.toLowerCase() === tag) && cls.every((c) => n.classList?.contains(c)); });
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, cpSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const LEGACY = process.argv[2] ?? "../site-dist";
const OUT = "src/data/legacy";
const PUBLIC_LEGACY = "public";
if (!existsSync(join(LEGACY, "index.html"))) throw new Error(`${LEGACY}: no legacy build (run \`npm run site\` in coded-dot-design/fizlet)`);

const read = (p) => readFileSync(join(LEGACY, p), "utf8");
const write = (p, data) => { mkdirSync(dirname(join(OUT, p)), { recursive: true }); writeFileSync(join(OUT, p), JSON.stringify(data, null, 1) + "\n"); };

/** Every built page, as its fizlet.com path ("" home, "docs/" a folder page, "bricks/kernel.html"). */
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pagePath = (file) => { const r = relative(LEGACY, file).split("\\").join("/"); return r.endsWith("index.html") ? r.slice(0, -"index.html".length) : r; };

/** Rewrite page-relative URLs in a fragment to root-absolute ones (fizlet.com is served at /). */
const absolute = (html, path) => html.replace(/\b(href|src|action|poster|data-base)="([^"]*)"/g, (all, attr, url) => {
  if (!url || /^(?:[a-z]+:|#|\/|\{)/i.test(url)) return all;
  const u = new URL(url, `https://fizlet.com/${path}`);
  return `${attr}="${u.pathname}${u.search}${u.hash}"`;
});
const text = (el) => el?.text.replace(/\s+/g, " ").trim() ?? "";
const inner = (el, path) => (el ? absolute(el.innerHTML.trim(), path) : "");
const outer = (el, path) => (el ? absolute(el.outerHTML.trim(), path) : "");

// ---------- Routes: every page of the legacy build ----------
const sitemap = new Set([...read("sitemap.xml").matchAll(/<loc>https:\/\/fizlet\.com\/([^<]*)<\/loc>/g)].map((m) => m[1]));
const typeOf = (p, doc) => {
  if (p === "") return "home";
  if (p === "404.html") return "not-found";
  if (doc.querySelector('meta[http-equiv="refresh"]')) return "redirect";
  if (/^docs\/$|^guides\/$/.test(p)) return "docs-index";
  if (/^(docs|guides)\/[^/]+\/$/.test(p)) return "doc";
  if (p === "bricks/") return "bricks-index";
  if (/^bricks\/[\w-]+\.html$/.test(p)) return "brick";
  if (/^gallery\/(page\/\d+\/)?$/.test(p)) return "gallery-index";
  if (p === "gallery/hifi/") return "gallery-lane";
  if (p === "gallery/archive/") return "gallery-archive";
  if (p === "people/") return "people-index";
  if (/^people\/[^/]+\/$/.test(p)) return "person";
  if (p === "notes/") return "notes-index";
  if (/^notes\/[^/]+\/$/.test(p)) return "note";
  if (p === "news/") return "news-index";
  if (/^news\/[^/]+\/$/.test(p)) return "release";
  if (/^(privacy|cookies)\/$/.test(p)) return "legal";
  if (/^demos\//.test(p) || /^examples\//.test(p) || /^origin\//.test(p)) return "demo";
  return p.replace(/\/$/, "");
};
const routes = walk(LEGACY).filter((f) => f.endsWith(".html")).map((f) => {
  const path = pagePath(f);
  const doc = parse(readFileSync(f, "utf8"));
  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
  return {
    path,
    title: doc.querySelector("title")?.text ?? "",
    description: doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    type: typeOf(path, doc),
    inSitemap: sitemap.has(path),
    noindex: robots.includes("noindex"),
    redirect: doc.querySelector('meta[http-equiv="refresh"]')?.getAttribute("content")?.match(/url=(.*)$/)?.[1] ?? "",
    shell: !!doc.querySelector("header.site-head"),
  };
}).sort((a, b) => a.path.localeCompare(b.path));
write("routes.json", routes);

// ---------- Site facts and the footer site map (from the home page) ----------
const homeHtml = read("index.html");
const home = parse(homeHtml);
const version = home.querySelector(".brand-ver")?.text.replace(/^V/, "") ?? "";
const chipOf = (a) => a.classList.contains("sym-chip")
  ? { sym: text(a.querySelector(".el-sym")), tone: a.getAttribute("style")?.match(/--tone:\s*([^;]+)/)?.[1].trim() ?? "" } : undefined;
const link = (a, path) => {
  const href = a.getAttribute("href");
  const abs = /^https?:/.test(href) ? href : absolute(`href="${href}"`, path).slice(6, -1);
  return { href: abs, label: a.classList.contains("sym-chip") ? text(a.querySelector(".sym-name")) : text(a), ...(chipOf(a) ? { chip: chipOf(a) } : {}) };
};
const footer = home.querySelectorAll(".foot-map > details.map-col").map((col) => ({
  name: text(col.querySelector("summary h2")),
  sections: col.querySelectorAll(":scope > ul > li.map-sec").map((sec) => {
    const head = sec.querySelector(":scope > a.map-head");
    const label = sec.querySelector(":scope > .map-label");
    const fold = sec.querySelector(":scope > details.map-fold");
    const list = fold ? fold.querySelector("ul") : sec.querySelector(":scope > ul");
    return {
      ...(head ? { head: link(head, "") } : { label: text(label) }),
      ...(list?.classList.contains("map-chips") ? { chips: true } : {}),
      ...(fold ? { fold: text(fold.querySelector("summary")).replace(/^All \d+ /, "") } : {}),
      external: !!(list && !head && list.querySelector("a[href^='http']")),
      items: (list?.querySelectorAll(":scope > li > a") ?? []).map((a) => link(a, "")),
    };
  }),
}));
write("footer.json", footer);
write("site.json", { version, legacyBuild: `coded-dot-design/fizlet v${version} (scripts/site.mjs)`, exported: new Date().toISOString().slice(0, 10) });

// ---------- Shared pieces ----------
const metaOf = (doc, path) => ({
  path,
  title: doc.querySelector("title")?.text ?? "",
  description: doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
  ld: JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.text ?? "{}")["@graph"]?.slice(3) ?? [],
  scripts: doc.querySelectorAll("body > script[type=module]").map((s) => absolute(`src="${s.getAttribute("src")}"`, path).slice(5, -1)),
});
const crumbsOf = (nav, path) => nav ? {
  trail: nav.querySelectorAll("a").slice(1).map((a) => link(a, path)),
  current: text(nav.querySelector('[aria-current="page"]')),
} : undefined;
const keyOf = (a, path) => ({
  href: absolute(`href="${a.getAttribute("href")}"`, path).slice(6, -1),
  label: text(a),
  tone: ["go", "sys", "cmd", "fire", "attack", "advance", "fallin", "flag"].find((t) => a.classList.contains(`bui-${t}`)) ?? "",
  arcade: a.classList.contains("bui-arcade"),
  icon: iconName(a.querySelector("svg path")?.getAttribute("d") ?? ""),
});
const ICONS = Object.fromEntries(Object.entries(JSON.parse(readFileSync("src/data/icons.json", "utf8"))).map(([k, d]) => [d, k]));
const iconName = (d) => ICONS[d] ?? "";
const codeOf = (card) => ({
  label: card.querySelector(".code-head .bui-label")?.innerHTML.trim() ?? "",
  code: card.querySelector("pre code")?.text ?? card.querySelector("pre")?.text ?? "",
  wrap: card.querySelector("pre")?.classList.contains("wrap") ?? false,
  copy: !!card.querySelector("[data-copy]"),
  cls: card.getAttribute("class"),
});

// ---------- The docs page ----------
for (const slug of ["getting-started"]) {
  const path = `docs/${slug}/`;
  const doc = parse(read(`${path}index.html`));
  const wrap = doc.querySelector("main article.doc > .wrap");
  const head = wrap.querySelector("header.note-head");
  const h1 = head.querySelector("h1");
  const body = wrap.childNodes.filter((n) => n.nodeType === 1 && !is(n, "nav.bp-crumbs, header.note-head, nav.bp-steps, nav.doc-map"));
  write(`pages/docs/${slug}.json`, {
    meta: metaOf(doc, path),
    crumbs: crumbsOf(wrap.querySelector("nav.bp-crumbs"), path),
    index: text(head.querySelector(".eyebrow .index")),
    eyebrow: text(head.querySelector(".eyebrow")).replace(/^\S+\s/, ""),
    title: { line: h1.childNodes[0].text, accent: text(h1.querySelector("em")) },
    lead: inner(head.querySelector(".lead"), path),
    body: body.map((n) =>
      n.classList.contains("code-card") ? { kind: "code", ...codeOf(n) }
      : n.classList.contains("split-keys") ? { kind: "keys", keys: n.querySelectorAll("a").map((a) => keyOf(a, path)) }
      : { kind: "html", html: outer(n, path) }),
    steps: wrap.querySelectorAll("nav.bp-steps a.bp-step").map((a) => ({ ...link(a, path), dir: a.classList.contains("next") ? "next" : "prev", label: text(a.querySelector(":scope > span")) })),
    map: wrap.querySelectorAll("nav.doc-map > div").map((col) => col.querySelectorAll("h2").map((h2) => {
      const list = h2.nextElementSibling;
      return { head: link(h2.querySelector("a"), path), ...(list?.tagName === "OL" ? { items: list.querySelectorAll("a").map((a) => link(a, path)) } : { note: text(list) }) };
    })),
  });
}

// ---------- Brick pieces: stickers, pills, size badges, toy cards, API entries ----------
const toneOf = (el) => el?.getAttribute("style")?.match(/--tone:\s*([^;]+)/)?.[1].trim() ?? "";
const sticker = (s) => ({ flag: s.getAttribute("data-flag") ?? "", title: s.getAttribute("title") ?? "", label: text(s), cls: s.getAttribute("class"), style: s.getAttribute("style") ?? "" });
const pillOf = (s) => ({ flag: s.getAttribute("data-flag"), title: s.getAttribute("title"), label: text(s) });
const badgeOf = (s) => s && ({ aria: s.getAttribute("aria-label"), bytes: s.getAttribute("data-bytes"), live: s.getAttribute("data-live"), title: s.getAttribute("title"), size: text(s.querySelector("b")), unit: text(s).replace(text(s.querySelector("b")), "").trim() });
// A brick's toy card (.bc): the engine fills the slot; the poster, caption and badge are ours.
const toyOf = (bc) => {
  const fig = bc.querySelector("figure"), block = fig.querySelector(".bc-block");
  return {
    tone: toneOf(bc), slot: fig.getAttribute("data-slot-target"), brick: fig.getAttribute("data-brick-card"), tag: fig.getAttribute("data-tag"),
    bytes: fig.getAttribute("data-bytes"), aria: fig.getAttribute("aria-label"),
    poster: { label: text(block.querySelector("b")), size: text(block).replace(text(block.querySelector("b")), "").trim() },
    cap: text(bc.querySelector(".bc-cap > span:not(.size-badge)")), badge: badgeOf(bc.querySelector(".bc-cap .size-badge")),
  };
};
/** One API entry (article.bp-decl): name, kind, flag, doc, @tags, each signature's parameters, the declaration. */
const declOf = (a, path) => {
  const h = a.querySelector("h3, h4");
  const els = a.childNodes.filter((n) => n.nodeType === 1);
  const row = (div) => {
    const dd = div.querySelector("dd").innerHTML;
    const m = dd.match(/^<code>([\s\S]*?)<\/code>( <small>optional<\/small>)?(?: ([\s\S]*))?$/);
    if (!m) throw new Error(`${path}: an API row I can't read: ${dd.slice(0, 80)}`);
    return { name: text(div.querySelector("dt")), type: absolute(m[1], path), optional: !!m[2], doc: absolute(m[3] ?? "", path) };
  };
  const sigs = [];
  for (const n of els) {
    if (is(n, "pre.bp-sig")) sigs.push({ text: n.querySelector("code").text, params: [], returns: "" });
    else if (is(n, "dl.bp-params") && sigs.length) for (const div of n.querySelectorAll(":scope > div")) {
      const r = row(div);
      if (r.name === "Returns") sigs.at(-1).returns = r.type; else sigs.at(-1).params.push(r);
    }
  }
  const typeRow = !sigs.length ? a.querySelector(":scope > dl.bp-params > div") : null;
  const full = a.querySelector(":scope > details.bp-full");
  return {
    kind: "decl", id: a.getAttribute("id"), level: h.tagName.toLowerCase(), names: text(h.querySelector("code")), what: text(h.querySelector("small")), pill: pillOf(h.querySelector(".status-pill")),
    doc: inner(els.find((n) => n.tagName === "P"), path),
    tags: a.querySelectorAll(":scope > p.bp-tag").map((t) => ({ name: text(t.querySelector("b")).replace(/^@/, ""), html: inner(t, path).replace(/^<b>[^<]*<\/b>\s*/, "") })),
    sigs, ...(typeRow ? { type: row(typeRow).type } : {}),
    code: (full ?? a).querySelector(full ? "pre code" : ":scope > pre.code:not(.bp-sig) code").text, folded: !!full,
  };
};
const apiOf = (api, path) => {
  const items = [];
  for (const n of api.childNodes.filter((n) => n.nodeType === 1)) {
    if (is(n, "h3.bp-mod")) items.push({ kind: "mod", id: n.getAttribute("id"), name: text(n), summary: "" });
    else if (n.tagName === "P" && items.at(-1)?.kind === "mod") items.at(-1).summary = inner(n, path);
    else if (is(n, "article.bp-decl")) items.push(declOf(n, path));
  }
  return {
    note: inner(api.querySelector(":scope > p.bp-note"), path),
    toc: api.querySelectorAll("nav.bp-toc li").map((li) => ({ href: li.querySelector("a").getAttribute("href"), names: text(li.querySelector("code")), what: text(li.querySelector("small")) })),
    items,
  };
};

/** A brick page's status panel: its flag, what it means, then since, shipped in, and its tests. */
const statusOf = (n, path) => {
  const ps = n.querySelectorAll(":scope > p"), dd = (label) => n.querySelectorAll("dl > div").find((d) => text(d.querySelector("dt")) === label).querySelector("dd");
  const shipped = dd("SHIPPED IN");
  return {
    flag: n.getAttribute("data-flag"), legend: absolute(`href="${n.querySelector(".code-head a").getAttribute("href")}"`, path).slice(6, -1),
    pill: pillOf(n.querySelector(".status-pill")), line: inner(ps[0], path), ...(ps[1] ? { note: inner(ps[1], path) } : {}),
    since: text(dd("SINCE")), shipped: shipped.querySelector("ul") ? shipped.querySelectorAll("li").map((li) => inner(li, path)) : [], none: shipped.querySelector("ul") ? "" : text(shipped),
    tests: dd("TESTS").querySelectorAll("li a").map((a) => ({ href: a.getAttribute("href"), name: text(a.querySelector("code")) })),
  };
};

// ---------- The brick pages (every bricks/<id>.html) ----------
const BRICK_IDS = readdirSync(join(LEGACY, "bricks")).filter((f) => f.endsWith(".html") && f !== "index.html").map((f) => f.slice(0, -5)).sort();
for (const id of BRICK_IDS) {
  const path = `bricks/${id}.html`;
  const html = read(path);
  const doc = parse(html);
  const wrap = doc.querySelector("main section.bp > .wrap");
  const top = wrap.querySelector(".bp-top");
  const lead = top.querySelector(":scope > div");
  const eyebrow = lead.querySelector(".bp-eyebrow");
  const sizes = top.querySelector(":scope > .bp-sizes");
  write(`pages/bricks/${id}.json`, {
    meta: metaOf(doc, path),
    styles: doc.querySelectorAll("main style").map((s) => s.text),
    crumbs: crumbsOf(wrap.querySelector("nav.bp-crumbs"), path),
    tone: toneOf(top),
    head: {
      tag: text(eyebrow.querySelector(".index")),
      version: text(eyebrow.childNodes.find((n) => n.nodeType === 3 && n.text.trim())).replace(/^V/, ""),
      sticker: sticker(eyebrow.querySelector(".brick-sticker")),
      name: text(lead.querySelector("h1 code")),
      lead: inner(lead.querySelector(".lead"), path),
      keys: lead.querySelectorAll(".split-keys a").map((a) => keyOf(a, path)),
    },
    sizes: sizes.querySelectorAll(".bp-size").map((c) => ({ name: text(c.querySelector(".bui-label b")), bytes: text(c.querySelector(".bp-bytes")), budget: text(c.querySelector("small")), v: c.querySelector(".meter i").getAttribute("style").match(/--v:\s*([^;]+)/)[1] })),
    sizesNote: inner(sizes.querySelector(".bp-note"), path),
    blocks: wrap.childNodes.filter((n) => n.nodeType === 1 && !is(n, "nav.bp-crumbs, .bp-top")).map((n) =>
      is(n, "figure.bp-demo") ? { kind: "demo", demo: n.getAttribute("data-brick-demo"), badge: badgeOf(n.querySelector(".size-badge")), status: text(n.querySelector("[data-status]")), note: text(n.querySelector("figcaption > span:last-child")) }
      : is(n, "div.bp-card") ? { kind: "toy", ...(n.querySelector(".bc") ? toyOf(n.querySelector(".bc")) : {}) }
      : is(n, "div.bp-status") ? { kind: "status", ...statusOf(n, path) }
      : is(n, "div.bp-use") ? { kind: "use", blocks: n.querySelectorAll(".code-card").map(codeOf) }
      : is(n, "div.code-card") ? { kind: "code", ...codeOf(n) }
      : is(n, "div.bp-api") ? { kind: "api", ...apiOf(n, path) }
      : is(n, "nav.bp-steps") ? { kind: "steps", steps: n.querySelectorAll("a.bp-step").map((a) => ({ ...link(a, path), dir: a.classList.contains("next") ? "next" : "prev", label: text(a.querySelector("code")) })) }
      : { kind: "html", html: outer(n, path) }),
  });
}

// ---------- The gallery index ----------
{
  const path = "gallery/";
  const doc = parse(read(`${path}index.html`));
  const main = doc.querySelector("main");
  const section = main.querySelector("section");
  const head = section.querySelector(".section-head");
  const h1 = head.querySelector("h1");
  const item = (li) => {
    const meta = li.querySelector(".gal-meta");
    const line = meta.querySelector(".gal-line");
    return {
      id: li.getAttribute("id"),
      attrs: Object.fromEntries(Object.entries(li.attributes).filter(([k]) => k.startsWith("data-"))),
      cls: li.getAttribute("class"),
      stage: inner(li.querySelector(".gal-stage"), path),
      index: text(line.querySelector(".index")),
      line: text(line).replace(/^\S+\s/, ""),
      title: text(meta.querySelector(".gal-title")),
      // The rest of the card's meta (stickers, author, brief, measured cost, bricks, keys), in order.
      metaHtml: meta.childNodes.filter((n) => n.nodeType === 1 && !is(n, ".gal-line, .gal-title")).map((n) => outer(n, path)).join("\n"),
    };
  };
  write("pages/gallery/index.json", {
    meta: metaOf(doc, path),
    styles: main.querySelectorAll(":scope > style").map((s) => s.text),
    head: {
      index: text(head.querySelector(".eyebrow .index")),
      eyebrow: text(head.querySelector(".eyebrow")).replace(/^\S+\s/, ""),
      title: { line: h1.childNodes[0].text, accent: text(h1.querySelector("em")) },
      lead: inner(head.querySelector(".lead"), path),
      contestHtml: outer(head.querySelector(".gal-contest"), path),
    },
    themesHtml: outer(section.querySelector("nav.gal-themes"), path),
    searchHtml: outer(section.querySelector("form.gal-search"), path),
    items: section.querySelectorAll("ol.gal > li.gal-item").map(item),
    pagesHtml: outer(section.querySelector("nav.gal-pages"), path),
  });
}

// The home page's bricks section: its shell, head and keys as built; every brick a BrickCard.
const brickItem = (li, path) => {
  const name = li.querySelector(".brick-name");
  return {
    id: li.getAttribute("data-brick"), flag: li.getAttribute("data-flag") ?? "", cls: li.getAttribute("class"),
    tone: li.getAttribute("style")?.match(/--tone:\s*([^;]+)/)?.[1].trim() ?? "",
    head: inner(li.querySelector(".brick-head"), path),
    level: name.tagName.toLowerCase(),
    ...(name.querySelector("a") ? { href: absolute(`href="${name.querySelector("a").getAttribute("href")}"`, path).slice(6, -1), name: name.querySelectorAll(".nw").map((x) => x.text) } : { name: [text(name)] }),
    chips: inner(li.querySelector(".brick-chips"), path),
    // The bricks index's fuller tile: what it does, its toy card (an engine demo slot, kept as built),
    // its budget line, its meter, and (a planned brick) what it needs.
    ...(li.querySelector(".brick-what") ? { what: inner(li.querySelector(".brick-what"), path) } : {}),
    ...(li.querySelector(":scope > .bc") ? { toy: toyOf(li.querySelector(":scope > .bc")) } : {}),
    ...(li.querySelector(".brick-budget") ? { budget: inner(li.querySelector(".brick-budget"), path) } : {}),
    ...(li.querySelector(".brick-chips")?.getAttribute("aria-label") !== "Measured on this build" ? { chipsLabel: li.querySelector(".brick-chips").getAttribute("aria-label") } : {}),
    ...(li.querySelector(".brick-meter") ? { meter: { label: li.querySelector(".brick-meter").getAttribute("aria-label"), v: li.querySelector(".brick-meter i").getAttribute("style").match(/--v:\s*([^;]+)/)[1] } } : {}),
    ...(li.querySelector(".brick-needs") ? { needs: inner(li.querySelector(".brick-needs"), path).replace(/^<small>NEEDS<\/small>\s*/, "") } : {}),
  };
};
const bricksSection = (sec, path) => {
  const wrap = sec.querySelector(".wrap");
  return {
    id: "bricks", kind: "bricks",
    attrs: sec.attributes,
    pre: sec.childNodes.filter((n) => n.nodeType === 1 && n !== wrap).map((n) => outer(n, path)).join("\n"),
    blocks: wrap.childNodes.filter((n) => n.nodeType === 1).map((n) => is(n, "ul.bricks")
      ? { kind: "bricks", cls: n.getAttribute("class"), items: n.querySelectorAll(":scope > li.brick").map((li) => brickItem(li, path)) }
      : { kind: "html", html: outer(n, path) }),
  };
};

// ---------- The bricks index (bricks/) ----------
{
  const path = "bricks/";
  const doc = parse(read(`${path}index.html`));
  const main = doc.querySelector("main");
  const sec = main.querySelector("section#bricks");
  const wrap = sec.querySelector(".wrap");
  const headOf = (h) => {
    const h2 = h.querySelector("h2"), em = h2.querySelector("em");
    return {
      anchor: h.getAttribute("id") ?? "",
      ...(h.querySelector(".eyebrow") ? { index: text(h.querySelector(".eyebrow .index")), eyebrow: text(h.querySelector(".eyebrow")).replace(/^\S+\s/, "") } : {}),
      id: h2.getAttribute("id") ?? "",
      line: em ? h2.childNodes[0].text : text(h2), accent: em ? text(em) : "",
      lead: inner(h.querySelector(".lead"), path),
    };
  };
  write("pages/bricks-index.json", {
    meta: metaOf(doc, path),
    styles: main.querySelectorAll(":scope > style").map((s) => s.text),
    // The periodic table, the sticker sheet and the factory: the engine's own figures, kept as built.
    preHtml: main.childNodes.filter((n) => n.nodeType === 1 && n.tagName !== "STYLE" && n !== sec).map((n) => outer(n, path)),
    attrs: sec.attributes,
    blocks: wrap.childNodes.filter((n) => n.nodeType === 1).map((n) =>
      is(n, "div.section-head") ? { kind: "head", ...headOf(n) }
      : is(n, "ul.bricks") ? { kind: "bricks", cls: n.getAttribute("class"), items: n.querySelectorAll(":scope > li.brick").map((li) => brickItem(li, path)) }
      : is(n, "ul.status-cards") ? { kind: "status", items: n.querySelectorAll(":scope > li.status-card").map((li) => ({
        flag: li.getAttribute("data-flag"), sticker: sticker(li.querySelector(".brick-sticker")), count: text(li.querySelector(".brick-top small")),
        line: text(li.querySelector(":scope > p")), criteria: li.querySelectorAll(":scope > ul > li").map((x) => inner(x, path)),
      })) }
      : { kind: "html", html: outer(n, path) }),
  });
}

// ---------- The home page ----------
{
  const path = "";
  const main = home.querySelector("main");
  const hero = main.querySelector("section.hero");
  const copy = hero.querySelector(".hero-copy");
  const h1 = copy.querySelector("h1");
  const eyebrow = copy.querySelector(".eyebrow");
  write("pages/home.json", {
    meta: metaOf(home, path),
    hero: {
      eyebrow: { text: text(eyebrow.childNodes.find((n) => n.nodeType === 3 && n.text.trim())), accent: text(eyebrow.querySelector("b")) },
      title: { line: h1.childNodes[0].text, accent: text(h1.querySelector("em")) },
      byline: link(copy.querySelector(".byline a"), path),
      beta: { pill: text(copy.querySelector(".status-pill")), html: inner(copy.querySelector(".beta-line"), path).replace(/^<span[^>]*>[^<]*<\/span>\s*/, "") },
      lead: inner(copy.querySelector(".lead"), path),
      keys: copy.querySelectorAll(".hero-keys a.bui-key").map((a) => keyOf(a, path)),
      repo: link(copy.querySelector(".hero-keys a.hero-link"), path),
      install: codeOf(copy.querySelector(".hero-install")),
      // The layers demo (poster, its CSS and loader): the engine's own markup, kept as built.
      figureHtml: outer(hero.querySelector(".hero-copy + .hero-layers, .hero-layers"), path),
    },
    stats: main.querySelectorAll("section.stats .stats-row > span").map((s) => ({ value: text(s.querySelector("b")), label: text(s.querySelector("small")), soon: s.classList.contains("soon") })),
    // The sections below the fold: the engine's demos and the long-form story, kept as built
    // (MIGRATION.md lists each one's component work).
    sections: main.childNodes.filter((n) => n.nodeType === 1 && !is(n, "section.hero, section.stats")).map((n) => n.getAttribute("id") === "bricks" ? bricksSection(n, path) : ({ id: n.getAttribute("id") ?? n.getAttribute("class"), html: outer(n, path) })),
  });
}

// ---------- Runtime assets the ported pages load (the legacy engine bundles) ----------
// Scripts, stylesheets-free: every module script the four pages load, and every file those import.
const assets = new Set(["icon.svg", "og.png", "robots.txt", "llms.txt", "llms-full.txt", "fizlet.js"]);
const queue = [];
for (const f of ["index.html", "docs/getting-started/index.html", "gallery/index.html", "bricks/index.html", ...BRICK_IDS.map((id) => `bricks/${id}.html`)]) {
  const h = read(f);
  for (const m of h.matchAll(/(?:src|href|data-live|data-src|data-module)="([^"#?]+\.(?:js|json|svg|png|webp|css|txt))"/g)) {
    if (/^https?:/.test(m[1])) continue;
    const p = new URL(m[1], `https://fizlet.com/${f.replace(/index\.html$/, "")}`).pathname.slice(1);
    if (p !== "board-ui.css" && p !== "site.css") queue.push(p);
  }
}
while (queue.length) {
  const p = queue.pop();
  if (assets.has(p) || !existsSync(join(LEGACY, p))) continue;
  assets.add(p);
  if (p.endsWith(".js")) for (const m of read(p).matchAll(/(?:from|import\(|import)\s*"(\.{1,2}\/[^"]+)"|"(\.\/[\w./-]+\.js)"/g)) queue.push(new URL(m[1] ?? m[2], `https://fizlet.com/${p}`).pathname.slice(1));
}
// The hosted ESM build (dist/) the quick start and docs link to.
for (const f of walk(join(LEGACY, "dist"))) assets.add(relative(LEGACY, f).split("\\").join("/"));
const LIST = [...assets].sort();
for (const p of LIST) { mkdirSync(dirname(join(PUBLIC_LEGACY, p)), { recursive: true }); cpSync(join(LEGACY, p), join(PUBLIC_LEGACY, p)); }
write("assets.json", LIST);
console.log(`Exported ${routes.length} routes, 4 pages, ${LIST.length} runtime files (legacy v${version}).`);
