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

// ---------- The home page's sections (W2-home): each one's content as data, rendered by its own
// component in src/components/home/. A section not listed here stays as built (Html).
/** The section shell: its id, class, heading id, and the rule and ghost number of a numbered one. */
const secOf = (sec) => ({
  id: sec.getAttribute("id") ?? "", cls: sec.getAttribute("class"), labelledby: sec.getAttribute("aria-labelledby"),
  num: text(sec.querySelector(":scope > .sec-num")), rule: !!sec.querySelector(":scope > .sec-rule"),
  attrs: Object.fromEntries(Object.entries(sec.attributes).filter(([k]) => !["id", "class", "aria-labelledby", "data-reveal"].includes(k))),
});
/** A section's copy: eyebrow (and its index), the two-line title, lead, body paragraphs, keys. */
const headOf = (el, path) => {
  const eb = el.querySelector(":scope > .eyebrow"), h = el.querySelector(":scope > h2"), index = text(eb?.querySelector(".index"));
  return {
    index, eyebrow: index ? text(eb).slice(index.length).trim() : text(eb),
    line: h.childNodes[0].text, accent: text(h.querySelector("em")),
    lead: inner(el.querySelector(":scope > .lead"), path),
    body: el.querySelectorAll(":scope > p.body").map((p) => inner(p, path)),
    keys: (el.querySelector(":scope > .split-keys")?.querySelectorAll("a.bui-key") ?? []).map((a) => keyOf(a, path)),
  };
};
/** A demo's measured-size badge (site.js swaps in the live number once the scene loads). */
const badgeOf = (el) => ({ label: el.getAttribute("aria-label"), bytes: el.getAttribute("data-bytes"), live: el.getAttribute("data-live"), title: el.getAttribute("title"), size: text(el.querySelector("b")), unit: el.querySelector("b").nextSibling.text });
const toneOf = (el) => el?.getAttribute("style")?.match(/--tone:\s*var\(--k-([\w-]+)\)/)?.[1] ?? "";
const rulesOf = (ul, path) => (ul?.querySelectorAll(":scope > li") ?? []).map((li) => inner(li, path));
const HOME = {
  "page-toc": (n, path) => ({
    label: inner(n.querySelector(".bui-label"), path),
    items: n.querySelectorAll("ol > li > a").map((a) => ({ href: absolute(`href="${a.getAttribute("href")}"`, path).slice(6, -1), n: text(a.querySelector("b")), label: text(a).slice(text(a.querySelector("b")).length) })),
  }),
  profile: (n, path) => {
    const card = n.querySelector(".profile-card"), size = card.querySelector(".profile-size");
    return {
      sec: secOf(n), head: headOf(n.querySelector(".split > div:first-child"), path),
      card: {
        tone: toneOf(card), label: inner(card.querySelector(":scope > .bui-label"), path), size: text(size), sizeKey: size.getAttribute("data-size"),
        note: text(card.querySelector(":scope > small")), meter: card.querySelector(".meter i").getAttribute("style").match(/--v:\s*([\d.]+)/)[1],
        rules: rulesOf(card.querySelector(".ledger-rules"), path),
      },
    };
  },
  contract: (n, path) => ({
    sec: secOf(n), head: headOf(n.querySelector(".section-head"), path),
    rules: n.querySelectorAll("ol.rules > li").map((li) => ({ n: text(li.querySelector("b")), title: text(li.querySelector("h3")), text: inner(li.querySelector("p"), path) })),
  }),
  board: (n, path) => {
    const ol = n.querySelector("ol.phases");
    return {
      sec: secOf(n), head: headOf(n.querySelector(".split > div:first-child"), path), label: ol.getAttribute("aria-label"),
      phases: ol.querySelectorAll(":scope > li").map((li) => ({ tone: toneOf(li), sticker: text(li.querySelector(".phase-sticker")), title: inner(li.querySelector(":scope > b"), path), sub: text(li.querySelector(":scope > span")), text: inner(li.querySelector(":scope > p"), path) })),
    };
  },
  loop: (n, path) => {
    const fig = n.querySelector(".loop"), row = (cls) => fig.querySelector(`.${cls}`), label = (cls) => inner(row(cls).parentNode.querySelector(".bui-label"), path);
    return {
      sec: secOf(n), flip: n.querySelector(".split").classList.contains("flip"), head: headOf(n.querySelector(".split > div:first-child"), path), label: fig.getAttribute("aria-label"),
      raf: { label: label("raf"), ticks: row("raf").querySelectorAll(":scope > i").map((i) => i.getAttribute("class") ?? "") },
      engines: { label: label("engines"), names: row("engines").querySelectorAll(":scope > span").map(text) },
      steps: { label: label("steps"), frames: row("steps").querySelectorAll(":scope > span").map((s) => s.querySelectorAll(":scope > i").map((i) => i.getAttribute("class") ?? "")) },
      pool: { label: label("slots"), slots: row("slots").querySelectorAll(":scope > i").map((i) => i.classList.contains("on")) },
      note: inner(fig.querySelector(".loop-note"), path),
    };
  },
  recall: (n, path) => {
    const led = n.querySelector(".ledger"), table = led.querySelector("table");
    return {
      sec: secOf(n), head: headOf(n.querySelector(".split > div:first-child"), path),
      ledger: {
        label: inner(led.querySelector(".ledger-head .bui-label"), path), led: text(led.querySelector(".ledger-led")),
        cols: table.querySelectorAll("thead th").map(text),
        rows: table.querySelectorAll("tbody tr").map((tr) => tr.querySelectorAll("td").map((td) => inner(td, path))),
        rules: rulesOf(led.querySelector(".ledger-rules"), path),
      },
    };
  },
  ship: (n, path) => ({
    sec: secOf(n), head: headOf(n.querySelector(".section-head"), path),
    steps: n.querySelectorAll("ol.pipeline > li").map((li) => ({ n: text(li.querySelector("em")), title: text(li.querySelector("b")), sub: text(li.querySelector("span")) })),
  }),
  specs: (n, path) => ({
    sec: secOf(n), head: headOf(n.querySelector(".section-head"), path),
    cards: n.querySelectorAll("ul.spec-grid > li").map((li) => ({ value: text(li.querySelector("b")), label: text(li.querySelector("span")), note: inner(li.querySelector("small"), path) })),
    groups: n.querySelectorAll(".size-group").map((g) => {
      const ul = g.querySelector("ul.size-chips");
      return {
        label: inner(g.querySelector(".size-head"), path), aria: ul.getAttribute("aria-label"),
        chips: ul.querySelectorAll(":scope > li").map((li) => {
          const el = li.querySelector(".el"), b = li.querySelector(".size-chip-text > b");
          return {
            size: li.getAttribute("data-size"), sym: li.getAttribute("data-sym") ?? "", title: li.getAttribute("title"), build: li.classList.contains("size-build"),
            tone: toneOf(el), v: el.getAttribute("style").match(/--v:\s*([\d.]+)/)[1], name: inner(li.querySelector(".size-chip-name"), path),
            value: b.childNodes[0].text, unit: b.querySelector("small").text, sr: text(li.querySelector(".sr")),
          };
        }),
      };
    }),
    note: inner(n.querySelector(".spec-note"), path),
  }),
  games: (n, path) => ({
    sec: secOf(n), head: headOf(n.querySelector(".section-head"), path),
    games: n.querySelectorAll(".games > article").map((a) => ({
      cls: a.getAttribute("class"), eyebrow: inner(a.querySelector(":scope > .eyebrow"), path), title: text(a.querySelector("h3")),
      text: inner(a.querySelector(":scope > p:not(.eyebrow):not(.game-uses)"), path),
      drop: a.querySelector(":scope > pre") ? { label: inner(a.querySelector(":scope > .bui-label"), path), code: a.querySelector(":scope > pre code").text } : null,
      facts: a.querySelectorAll(".game-facts > li").map((li) => ({ value: text(li.querySelector("b")), label: text(li.querySelector("span")) })),
      uses: inner(a.querySelector(".game-uses"), path),
      keys: a.querySelectorAll(".game-keys a.bui-key").map((k) => keyOf(k, path)),
    })),
  }),
  roadmap: (n, path) => ({
    sec: secOf(n), head: headOf(n.querySelector(".section-head"), path),
    phases: n.querySelectorAll("ol.roadmap > li").map((li) => ({
      phase: li.getAttribute("data-phase"), id: text(li.querySelector(".phase-id")), pill: text(li.querySelector(".phase-pill")),
      title: text(li.querySelector("h3")), text: inner(li.querySelector(":scope > p"), path),
      checks: li.querySelectorAll(".checks > li").map((c) => ({ done: c.classList.contains("done"), text: inner(c.querySelector(":scope > span:not(.sr)"), path), sr: text(c.querySelector(".sr")) })),
    })),
  }),
  start: (n, path) => {
    const head = n.querySelector(".start-head");
    return {
      sec: secOf(n), head: headOf(head, path),
      steps: head.querySelectorAll("ol.start-steps > li").map((li) => inner(li, path)),
      code: n.querySelectorAll(".start-code > .code-card").map(codeOf),
    };
  },
  origin: (n, path) => {
    const head = n.querySelector(".ogs-head"), h = head.querySelector("h2"), word = h.querySelector(".ogs-word"), mode = head.querySelector(".ogs-mode");
    const stage = n.querySelector(".ogs-stage"), quote = (f) => ({ chip: text(f.querySelector(".ogs-chip")), quote: text(f.querySelector("blockquote")), cite: inner(f.querySelector("figcaption"), path) });
    const index = text(head.querySelector(".eyebrow .index"));
    return {
      sec: secOf(n),
      head: {
        index, eyebrow: text(head.querySelector(".eyebrow")).slice(index.length).trim(),
        title: { cls: h.getAttribute("class"), word: text(word), rest: word.nextSibling.text, accent: text(h.querySelector("em")), loop: text(h.querySelector(".ogs-loop")) },
        mode: { label: mode.getAttribute("aria-label"), opts: mode.querySelectorAll(".ogs-opt").map(text) },
        meta: inner(head.querySelector(".ogs-meta"), path), lead: inner(head.querySelector(".lead"), path),
      },
      stage: {
        chips: stage.querySelectorAll(".ogs-chrome > .ogs-chip").map((c) => ({ cls: c.getAttribute("class"), data: c.hasAttribute("data-origin-chip"), html: inner(c, path) })),
        css: stage.querySelector(":scope > style").text,
        // The origin scene's poster in its slot: the engine's own markup (the scene replaces it).
        posterHtml: outer(stage.querySelector(":scope > figure.ae-slot"), path),
        badge: badgeOf(stage.querySelector(".size-badge")), caption: inner(stage.querySelector(".hero-cap"), path),
      },
      cards: n.querySelectorAll(".ogs-below > article").map((a) => ({
        cls: a.getAttribute("class"), id: a.getAttribute("aria-labelledby"), chip: { cls: a.querySelector(".ogs-chip").getAttribute("class"), text: text(a.querySelector(".ogs-chip")) },
        title: text(a.querySelector("h3")), items: a.querySelectorAll(".ogs-list > li").map((li) => ({ term: inner(li.querySelector("b"), path), text: inner(li.querySelector("span"), path) })),
        stat: { value: text(a.querySelector(".ogs-stat b")), note: text(a.querySelector(".ogs-stat small")) },
      })),
      vs: text(n.querySelector(".ogs-vs")),
      nums: { label: n.querySelector(".ogs-nums").getAttribute("aria-label"), items: n.querySelectorAll(".ogs-nums > li").map((li) => ({ value: text(li.querySelector("b")), note: text(li.querySelector("small")) })) },
      why: quote(n.querySelector(".ogs-why")), quote: quote(n.querySelector(".ogs-quote")),
      keys: n.querySelectorAll(".ogs-links a.bui-key").map((a) => keyOf(a, path)), wayback: link(n.querySelector(".ogs-links .ogs-wayback"), path),
    };
  },
  play: (n, path) => {
    const fig = n.querySelector("figure.demo"), page = fig.querySelector(".demo-page"), slam = fig.querySelector(".demo-slam .bui-sticker");
    const key = (b) => ({ tone: ["attack", "cmd"].find((t) => b.classList.contains(`bui-${t}`)), icon: iconName(b.querySelector("svg path").getAttribute("d")), label: b.childNodes.find((c) => c.nodeType === 3 && c.text.trim()).text, kbd: text(b.querySelector("kbd")), attr: Object.keys(b.attributes).find((k) => k.startsWith("data-")) });
    return {
      sec: secOf(n), head: headOf(n.querySelector(".split > div:first-child"), path),
      demo: {
        label: fig.getAttribute("aria-label"), url: text(fig.querySelector(".demo-url")), state: text(fig.querySelector(".demo-state")), badge: badgeOf(fig.querySelector(".size-badge")),
        // The little page the engine blasts: every letter and word its own element (data-body).
        page: { title: page.querySelector(".demo-title").getAttribute("aria-label"), copy: text(page.querySelector(".demo-copy")), row: page.querySelectorAll(".demo-row > span").map((x) => ({ cls: x.getAttribute("class"), text: text(x) })) },
        slam: { label: text(slam.querySelector("span")), value: text(slam.querySelector("b")) }, hint: text(fig.querySelector(".demo-hint")),
        keys: fig.querySelectorAll(".demo-keys > .bui-arcade").map(key),
        stats: { label: fig.querySelector(".demo-stats").getAttribute("aria-label"), items: fig.querySelectorAll(".demo-stats > div").map((d) => ({ label: text(d.querySelector("dt")), key: d.querySelector("dd").getAttribute("data-stat"), value: text(d.querySelector("dd")) })) },
        caption: inner(fig.querySelector("figcaption"), path),
      },
    };
  },
  story: (n, path) => {
    const slot = n.querySelector(".fizz-slot");
    return {
      sec: secOf(n), head: headOf(n.querySelector(".split > div:first-child"), path),
      // The fizz scene's poster in its slot: the engine's own markup (the scene replaces it).
      slot: { posterHtml: outer(slot.querySelector(":scope > figure.ae-slot"), path), badge: badgeOf(slot.querySelector(".size-badge")), caption: inner(slot.querySelector(".hero-cap"), path) },
    };
  },
  final: (n, path) => {
    const w = n.querySelector(".final-inner");
    return {
      sec: secOf(n), eyebrow: text(w.querySelector(".eyebrow")), title: text(w.querySelector("h2")),
      keys: w.querySelectorAll(".final-keys a.bui-key").map((a) => keyOf(a, path)),
      links: w.querySelectorAll(".final-links a").map((a) => link(a, path)),
    };
  },
};
const homeSection = (n, path) => {
  const id = n.getAttribute("id") ?? (n.classList.contains("final") ? "final" : n.getAttribute("class"));
  if (id === "bricks") return bricksSection(n, path);
  return HOME[id] ? { id, kind: id, ...HOME[id](n, path) } : { id, html: outer(n, path) };
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
    sections: main.childNodes.filter((n) => n.nodeType === 1 && !is(n, "section.hero, section.stats")).map((n) => homeSection(n, path)),
  });
}

// ---------- Runtime assets the ported pages load (the legacy engine bundles) ----------
// Scripts, stylesheets-free: every module script the four pages load, and every file those import.
const assets = new Set(["icon.svg", "og.png", "robots.txt", "llms.txt", "llms-full.txt", "fizlet.js"]);
const queue = [];
for (const f of ["index.html", "docs/getting-started/index.html", "bricks/kernel.html", "gallery/index.html"]) {
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
