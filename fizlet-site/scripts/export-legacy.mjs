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

// ---------- The brick page ----------
for (const id of ["kernel"]) {
  const path = `bricks/${id}.html`;
  const html = read(path);
  const doc = parse(html);
  const wrap = doc.querySelector("main section.bp > .wrap");
  const top = wrap.querySelector(".bp-top");
  const lead = top.querySelector(":scope > div");
  write(`pages/bricks/${id}.json`, {
    meta: metaOf(doc, path),
    styles: doc.querySelectorAll("main style").map((s) => s.text),
    crumbs: crumbsOf(wrap.querySelector("nav.bp-crumbs"), path),
    tone: top.getAttribute("style")?.match(/--tone:\s*([^;]+)/)?.[1].trim() ?? "",
    // The brick's head column, its demo and card: their markup is the engine's own (demo hosts, slots).
    leadHtml: inner(lead, path),
    asideHtml: top.childNodes.filter((n) => n.nodeType === 1 && n !== lead).map((n) => outer(n, path)).join("\n"),
    rest: wrap.childNodes.filter((n) => n.nodeType === 1 && !is(n, "nav.bp-crumbs, .bp-top")).map((n) =>
      n.classList.contains("bp-use") ? { kind: "use", blocks: n.querySelectorAll(".code-card").map(codeOf) } : { kind: "html", html: outer(n, path) }),
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
    level: name.tagName.toLowerCase(), href: absolute(`href="${name.querySelector("a").getAttribute("href")}"`, path).slice(6, -1),
    name: name.querySelectorAll(".nw").map((x) => x.text),
    chips: inner(li.querySelector(".brick-chips"), path),
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

// ---------- W2-daily: Make one, the contest, the people pages ----------
/** A size badge, as its numbers: `bytes` (gzip), the file it was measured from, what it is. */
const badgeOf = (el) => el && ({
  bytes: +el.getAttribute("data-bytes"),
  live: el.getAttribute("data-live"),
  what: el.getAttribute("aria-label").replace(/^[\d.]+ KB gzipped: /, "").replace(/, [\d,]+ bytes, measured at build$/, ""),
});
/** A section head's parts (eyebrow sticker and text, the title's line and accent, the lead). */
const headOf = (head, path) => {
  const h1 = head.querySelector("h1");
  return {
    index: text(head.querySelector(".eyebrow .index")),
    eyebrow: text(head.querySelector(".eyebrow")).replace(/^\S+\s/, ""),
    title: { line: h1.childNodes[0].text, accent: text(h1.querySelector("em")) },
    lead: inner(head.querySelector(".lead"), path),
  };
};
/** The stickers next to a title: winner, smallest, hi-fi (in order). */
const tagsOf = (el) => el.querySelectorAll(":scope > .win-badge").map((b) => b.classList.contains("ct-small") ? "smallest" : b.classList.contains("ct-hifi") ? "hifi" : "winner");
const byOf = (el, path) => { const a = el?.querySelector("a"); return a ? link(a, path) : undefined; };

// Make one: the form, the default prompt's snippet made at build (the runtime remakes it).
{
  const path = "make/";
  const doc = parse(read(`${path}index.html`));
  const section = doc.querySelector("main > section");
  const form = section.querySelector("form.make-form");
  const out = section.querySelector(".make-out");
  const meta = out.querySelector(".make-meta");
  const dl = meta.querySelector("a[data-download]");
  write("pages/make.json", {
    meta: metaOf(doc, path),
    cls: section.getAttribute("class"),
    head: { ...headOf(section.querySelector(".section-head"), path), badge: badgeOf(section.querySelector(".make-badge .size-badge")) },
    form: {
      action: form.getAttribute("action"),
      label: form.querySelector("label").innerHTML.trim(),
      input: Object.fromEntries(Object.entries(form.querySelector("input").attributes).map(([k, v]) => [k, v === "" ? true : v])), // a bare attribute (required) as true
      submit: { label: text(form.querySelector("button[type=submit]")), icon: iconName(form.querySelector("button[type=submit] svg path").getAttribute("d")) },
      tryLabel: text(form.querySelector(".make-try .bui-label")),
      tries: form.querySelectorAll("[data-try]").map((b) => b.getAttribute("data-try")),
      private: { icon: iconName(form.querySelector(".make-private svg path").getAttribute("d")), text: text(form.querySelector(".make-private span")) },
    },
    out: {
      id: out.getAttribute("data-id"),
      still: text(out.querySelector(".make-still")),
      recipe: text(meta.querySelector("[data-recipe]")),
      recipeLabel: meta.querySelector(".eyebrow").childNodes[0].text.trim(),
      matchedTitle: text(meta.querySelector("h2")),
      // What matched and what did not: the make runtime's own render (site/make/render.mjs), which
      // it re-renders into the same nodes for every prompt.
      matchedHtml: meta.querySelector("[data-matched]").innerHTML,
      missHtml: meta.querySelector("[data-miss]").innerHTML,
      size: { value: text(meta.querySelector("[data-snippet-size] b")), label: text(meta.querySelector("[data-snippet-size] small")) },
      copy: { label: text(meta.querySelector("[data-copy-snippet]")), icon: iconName(meta.querySelector("[data-copy-snippet] svg path").getAttribute("d")) },
      download: { label: text(dl), icon: iconName(dl.querySelector("svg path").getAttribute("d")), href: absolute(`href="${dl.getAttribute("href")}"`, path).slice(6, -1), file: dl.getAttribute("download") },
      status: text(meta.querySelector("[data-status]")),
      code: { id: out.querySelector("textarea").getAttribute("id"), label: out.querySelector(".code-head label").innerHTML.trim(), rows: +out.querySelector("textarea").getAttribute("rows"), text: out.querySelector("textarea").rawText.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") },
    },
  });
}

// The contest: the head, this week's theme, its pieces by lane, the rules, how to enter, past winners.
{
  const path = "contest/";
  const doc = parse(read(`${path}index.html`));
  const section = doc.querySelector("main > section");
  const wrap = section.querySelector(".wrap");
  const today = wrap.querySelector(".ct-today");
  const piece = (li) => {
    const h3 = li.querySelector("h3"), eb = li.querySelector(".eyebrow");
    return {
      index: text(eb.querySelector(".index")),
      line: text(eb).replace(/^\S+\s?/, ""),
      ...link(h3.querySelector("a"), path),
      tags: tagsOf(h3),
      prompt: text(li.querySelector(".gal-prompt")),
      badge: badgeOf(li.querySelector(".size-badge")),
      by: byOf(li.querySelector(".ct-by"), path),
    };
  };
  const enter = wrap.querySelector("section[aria-labelledby=ct-enter]");
  write("pages/contest.json", {
    meta: metaOf(doc, path),
    cls: section.getAttribute("class"),
    head: headOf(wrap.querySelector(".section-head"), path),
    week: today && {
      index: text(today.querySelector(".eyebrow .index")),
      line: text(today.querySelector(".eyebrow")).replace(/^\S+\s/, ""),
      label: text(today.querySelector("h2 .bui-label")),
      theme: text(today.querySelector("h2")).replace(/^\S+\s/, ""),
      brief: text(today.querySelector(".body")),
      dates: text(today.querySelector(".ct-date")),
    },
    lanes: wrap.querySelectorAll(":scope > section.ct-entries").map((s) => ({
      id: s.querySelector("h2").getAttribute("id"),
      title: text(s.querySelector("h2")),
      pieces: s.querySelectorAll("ol > li").map(piece),
      note: s.querySelector(".ct-note a") ? link(s.querySelector(".ct-note a"), path) : undefined,
    })),
    rules: { title: text(wrap.querySelector("#ct-rules")), items: wrap.querySelectorAll("section[aria-labelledby=ct-rules] ol > li").map((li) => inner(li, path)) },
    enter: {
      title: text(enter.querySelector("h2")),
      intro: text(enter.querySelector(":scope > p")),
      steps: enter.querySelectorAll("ol > li").map((li) => inner(li, path)),
      planned: { label: text(enter.querySelector(".ct-note .bui-label")), text: text(enter.querySelector(".ct-note")).replace(/^\S+\s/, "") },
      keys: enter.querySelectorAll(".split-keys a").map((a) => keyOf(a, path)),
    },
    past: {
      title: text(wrap.querySelector("#ct-past")),
      winners: wrap.querySelectorAll(".ct-past ol > li").map(piece),
      empty: text(wrap.querySelector(".ct-past > p.body")),
    },
  });
}

// The people: one avatar (its frames' paths by colour), one tile per person, one page each.
const avatarOf = (wrap) => {
  const frame = wrap.querySelector(".ppl-frame"), sticker = wrap.querySelector(".ppl-sticker");
  return {
    label: frame.getAttribute("aria-label"),
    rotate: frame.hasAttribute("data-rotate"),
    size: +frame.querySelector("svg").getAttribute("width"),
    frames: frame.querySelectorAll("svg").map((svg) => svg.querySelectorAll("path").map((p) => ({ fill: p.getAttribute("fill").replace(/^var\((.*)\)$/, "$1"), d: p.getAttribute("d") }))),
    sticker: { kind: sticker.getAttribute("class").match(/ppl-sticker-(\w+)/)[1], text: text(sticker), label: sticker.getAttribute("aria-label") },
  };
};
/** Who they are: the role, the tagline, and who they report to. */
const rolesOf = (el, path) => {
  const rep = el.querySelector(".ppl-reports");
  return {
    role: text(el.querySelector(".ppl-role")),
    tagline: text(el.querySelector(".ppl-tagline")),
    reports: rep ? { ...link(rep.querySelector("a"), path), as: text(rep).replace(/^.*, the /, "") } : undefined,
  };
};
{
  const path = "people/";
  const doc = parse(read(`${path}index.html`));
  const section = doc.querySelector("main > section");
  write("pages/people/index.json", {
    meta: metaOf(doc, path),
    cls: section.getAttribute("class"),
    head: headOf(section.querySelector(".section-head"), path),
    people: section.querySelectorAll("li.ppl-tile").map((li) => ({
      id: li.getAttribute("data-person"),
      avatar: avatarOf(li.querySelector(".ppl-av-wrap")),
      ...link(li.querySelector("h2 a"), path),
      ...rolesOf(li.querySelector(".ppl-tile-body"), path),
      count: li.querySelectorAll(".ppl-count > span").map((s) => ({ value: text(s.querySelector("b")).replace(/ B$/, ""), label: text(s).replace(/^\S+( B)?\s/, ""), unit: /^\S+ B\s/.test(text(s)) ? "B" : "" })),
    })),
  });
}
for (const id of readdirSync(join(LEGACY, "people")).filter((f) => statSync(join(LEGACY, "people", f)).isDirectory()).sort()) {
  const path = `people/${id}/`;
  const doc = parse(read(`${path}index.html`));
  const art = doc.querySelector("main > article");
  const who = art.querySelector(".ppl-who");
  const card = (key) => art.querySelector(`section[aria-labelledby=${key}]`);
  const style = card("ppl-style");
  const list = (sec) => sec.querySelectorAll("ul > li").map((li) => ({ text: text(li), todo: li.classList.contains("ppl-todo") }));
  const gallery = card("ppl-entries");
  const url = who.querySelector(".ppl-url a");
  write(`pages/people/${id}.json`, {
    meta: metaOf(doc, path),
    cls: art.getAttribute("class"),
    id,
    crumbs: crumbsOf(art.querySelector("nav.bp-crumbs"), path),
    avatar: avatarOf(art.querySelector(".ppl-head .ppl-av-wrap")),
    index: text(who.querySelector(".eyebrow .index")),
    handle: text(who.querySelector(".eyebrow")).replace(/^.*\s(\S+)$/, "$1"),
    name: text(who.querySelector("h1")),
    ...rolesOf(who, path),
    lead: text(who.querySelector(".lead")),
    url: url && { href: url.getAttribute("href"), label: text(url), icon: iconName(url.querySelector("svg path").getAttribute("d")) },
    stats: art.querySelectorAll(".ppl-stats > li").map((li) => ({ stat: li.querySelector("b").getAttribute("data-stat"), value: text(li.querySelector("b")), label: text(li.querySelector("p")) })),
    cards: {
      style: { title: text(style.querySelector("h2")), text: text(style.querySelector(":scope > p:not(.gal-prompt)")), promptTitle: text(style.querySelector("h3")), promptStyle: text(style.querySelectorAll(":scope > p:not(.gal-prompt)")[1]), sample: text(style.querySelector(".gal-prompt")).replace(/^PROMPT\s/, "") },
      lists: ["ppl-games", "ppl-hobbies"].map((k) => ({ id: k, title: text(card(k).querySelector("h2")), label: card(k).querySelector("ul").getAttribute("aria-label"), items: list(card(k)) })),
    },
    games: card("ppl-games-made") && { title: text(card("ppl-games-made").querySelector("h2")), items: card("ppl-games-made").querySelectorAll("li").map((li) => ({ ...link(li.querySelector("a"), path), note: text(li.querySelector(".ppl-prompt")) })) },
    entries: {
      title: text(gallery.querySelector("h2")),
      items: gallery.querySelectorAll("ol > li").map((li) => ({ ...link(li.querySelector(":scope > a"), path), tags: tagsOf(li), note: text(li.querySelector(".ppl-prompt")), badge: badgeOf(li.querySelector(".size-badge")), date: text(li.querySelector(".ppl-size small")) })),
      emptyHtml: inner(gallery.querySelector("p.body"), path),
    },
    back: { ...link(art.querySelector(".note-back a"), path), icon: iconName(art.querySelector(".note-back svg path").getAttribute("d")) },
  });
}
// W2-daily's pages (their scripts and what those import are copied below), and the make runtime's
// templates, fetched by name at run time so no import names them.
const DAILY_PAGES = ["make/index.html", "contest/index.html", "people/index.html", ...readdirSync(join(LEGACY, "people")).filter((f) => statSync(join(LEGACY, "people", f)).isDirectory()).map((f) => `people/${f}/index.html`)];

// ---------- Runtime assets the ported pages load (the legacy engine bundles) ----------
// Scripts, stylesheets-free: every module script the four pages load, and every file those import.
const assets = new Set(["icon.svg", "og.png", "robots.txt", "llms.txt", "llms-full.txt", "fizlet.js"]);
const queue = [];
for (const f of ["index.html", "docs/getting-started/index.html", "bricks/kernel.html", "gallery/index.html", ...DAILY_PAGES]) {
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
for (const f of walk(join(LEGACY, "make")).filter((f) => !f.endsWith(".html"))) assets.add(relative(LEGACY, f).split("\\").join("/"));
// The hosted ESM build (dist/) the quick start and docs link to.
for (const f of walk(join(LEGACY, "dist"))) assets.add(relative(LEGACY, f).split("\\").join("/"));
const LIST = [...assets].sort();
for (const p of LIST) { mkdirSync(dirname(join(PUBLIC_LEGACY, p)), { recursive: true }); cpSync(join(LEGACY, p), join(PUBLIC_LEGACY, p)); }
write("assets.json", LIST);
console.log(`Exported ${routes.length} routes, 4 pages, ${LIST.length} runtime files (legacy v${version}).`);
