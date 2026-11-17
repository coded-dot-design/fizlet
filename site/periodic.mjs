// The Fizlet periodic table: the full-screen hero at the top of /bricks/. Every brick, shipped and
// planned, as a Board UI key in a grid by family (site/bricks.mjs FAMILIES), in two blocks side by
// side: 2D and 3D (site/bricks.mjs DIMS), each with its own family columns, so no column runs long
// (the copy sits above the table, which gets the page's full width). Each key has its symbol,
// number and family from site/bricks.mjs and its size measured on this build (scripts/sizes.mjs),
// never typed. Press one: the key goes down, lights in its colour and says PRESSED, and a quick view
// flies in (site/periodic.ts; CSS only, @starting-style; under reduced motion it simply appears).
// The quick view is short on purpose: the brick's own page is the real detail.
//
// Static HTML and CSS: the table reads and links without the script; the script adds the quick
// view, arrow keys and Esc. Nothing here runs a frame loop: the page settles at 0 frames.
import { esc, headline, icon } from "./layout.mjs";
import { DIMS, FAMILIES, STATUS, dimOf } from "./bricks.mjs";
import { brickSticker, elSquare, nameParts, prose, toneOf } from "./brick-ui.mjs";
import { sizeBadge } from "./size-badge.mjs";

const kb = (n) => (n / 1024).toFixed(1);
const num = (n) => n.toLocaleString("en-US");

/**
 * Every element of the table, by number: shipped bricks (BRICKS rows with `summary` and `mods`, as
 * scripts/site.mjs makes them; a module with its own `sym` is a tile too) then planned (PLANNED rows).
 * { id, no, at, sym, family, name, status, tone, planned, part, gzip, budget, href, purpose, phase }.
 */
export function elements({ bricks, planned, sizes }) {
  const size = (name) => {
    const s = sizes.find((x) => x.name === name);
    if (!s) throw new Error(`periodic: no measured size for ${name}`);
    return s;
  };
  const first = (text = "") => text.match(/^.*?\.(?=\s|$)/)?.[0] ?? text;
  const shipped = bricks.flatMap((b) => {
    const s = size(b.sizes[0]);
    const own = { ...b, at: b.no, tone: toneOf(b), planned: false, gzip: s.gzip, budget: s.budget, href: `${b.id}.html`, purpose: b.summary };
    // A module with its own symbol (bricks.mjs: presence/check) is its own tile, numbered after its brick.
    const parts = b.modules.slice(1).filter((m) => m.sym).map((m) => {
      const ms = size(m.size), id = m.name.split("/").slice(-2).join("-");
      const sum = b.mods?.find((x) => x.name === m.name)?.summary;
      return { ...b, id, name: m.name, sym: m.sym, no: `${b.no}b`, at: b.no + 0.5, part: true, tone: toneOf(b), planned: false, gzip: ms.gzip, budget: ms.budget, href: `${b.id}.html#mod-${m.name.replace(/\W+/g, "-")}`, purpose: first(sum) || b.summary };
    });
    return [own, ...parts];
  });
  const later = planned.map((p) => ({ ...p, id: p.name.split("/").pop(), at: p.no, status: "roadmap", tone: toneOf(p), planned: true, href: "#planned" }));
  return [...shipped, ...later].sort((a, b) => a.at - b.at);
}

/**
 * The table's columns, left to right: each block (DIMS) its families in FAMILIES order, only those
 * with a brick in it, and one narrow split track between the blocks. [{ dim, fam, col, els }].
 */
export function columns(els) {
  const cols = [];
  let c = 0;
  for (const [i, dim] of DIMS.entries()) {
    if (i) c++; // the split
    for (const fam of FAMILIES) {
      const own = els.filter((e) => e.family === fam.id && dimOf(e) === dim.id);
      if (own.length) cols.push({ dim, fam, col: ++c, els: own });
    }
  }
  return cols;
}

/** The first tile row: row 1 is the blocks' labels, row 2 the family heads. */
export const ROW0 = 3;

/** Grid places [col, row]: each family's bricks down its column in its block, by number. */
export function places(els) {
  const at = new Map();
  for (const { col, els: own } of columns(els)) own.forEach((e, r) => at.set(e.id, [col, r + ROW0]));
  return at;
}

/**
 * A tile's face, like a brick card at tile scale: its one sticker on the top edge (it may hang off a
 * tile this small; the kernel's is KERNEL alone), the measured size with the colour dot in the
 * top-right corner (a planned brick has no size), the symbol big in the middle, the number and the
 * name along the bottom, PRESSED when down.
 */
const face = (e) => `<span class="el-flags" aria-hidden="true">${brickSticker(e)}</span>` +
  (e.planned ? "" : `<i class="el-sz" aria-hidden="true"><i class="el-dot"></i>${kb(e.gzip)}K</i>`) +
  `<b class="el-sym" aria-hidden="true">${esc(e.sym)}</b><i class="el-no" aria-hidden="true">${e.no}</i><span class="el-name" aria-hidden="true">${esc(e.id)}</span><span class="el-on" aria-hidden="true">PRESSED</span>`;

/** The hero key for one element (a Board UI key), named in full for screen readers. */
function tile(e, [col, row]) {
  const fam = FAMILIES.find((f) => f.id === e.family).label;
  const size = e.planned ? "planned" : `${kb(e.gzip)} KB gzip`;
  const label = `${e.name}, ${e.sym}, number ${e.no}, ${fam}, ${size}, ${STATUS[e.status].label.toLowerCase()}`;
  return `<button type="button" class="bui-key el-key el-face${e.planned ? " el-planned" : ""}${e.part ? " el-part" : ""}${e.id === "kernel" ? " el-kernel" : ""}" data-el="${esc(e.id)}" data-flag="${e.status}" style="--tone:${e.tone};grid-area:${row}/${col}" aria-expanded="false" aria-controls="pt-card" aria-label="${esc(label)}">${face(e)}</button>`;
}

/** One quick view, as a template the script copies into the card. Short: the brick page has the rest. */
function quick(e) {
  const meter = e.planned ? "" : `<p class="pt-q-size"><b>${num(e.gzip)} B</b> gzip <span>of a ${num(e.budget)} B budget</span></p><span class="meter" role="img" aria-label="${kb(e.gzip)} KB of a ${kb(e.budget)} KB budget"><i style="--v:${(e.gzip / e.budget).toFixed(3)}"></i></span>`;
  const link = e.planned
    ? `<a class="bui-key bui-arcade bui-cmd pt-q-go" href="#planned">${icon("down", 16)}On the roadmap</a>`
    : `<a class="bui-key bui-arcade bui-go pt-q-go" href="${esc(e.href)}">${icon("right", 16)}The full page</a>`;
  return `<template id="pt-t-${esc(e.id)}"><div class="pt-q-head" style="--tone:${e.tone}">${elSquare(e)}<p class="pt-q-meta">${brickSticker(e)}<span>No. ${e.no} · ${esc(FAMILIES.find((f) => f.id === e.family).label)}${e.planned ? ` · ${esc(e.phase)}` : ""}</span></p></div><h2 class="pt-q-name"><code>${nameParts(e.name)}</code></h2>
      ${e.planned ? `<p class="pt-q-size pt-q-planned"><b>Planned</b> <span>not in the package yet: no size until it ships</span></p>` : meter}
      <p class="pt-q-what">${prose(e.purpose)}</p>
      <p class="pt-q-import"><span class="bui-label"><b>IMPORT</b></span><code>${e.planned ? "not yet: " : ""}${esc(e.name)}</code></p>
      ${link}</template>`;
}

/**
 * The hero: `{ html, css }`. `els` from elements(); `version` the package version; `js` the table's
 * script, { live, bytes } (its gzip size measured on this build, shown in the hero's size badge).
 */
export function periodicHero({ els, version, js }) {
  const at = places(els), cols = columns(els);
  const shipped = els.filter((e) => !e.planned && !e.part).length, later = els.filter((e) => e.planned).length;
  const rows = Math.max(...cols.map((c) => c.els.length)), last = ROW0 + rows; // grid lines: tiles end at `last`
  const span = (dim) => cols.filter((c) => c.dim === dim).map((c) => c.col);
  const tracks = Array.from({ length: Math.max(...cols.map((c) => c.col)) }, (_, i) => (cols.some((c) => c.col === i + 1) ? "var(--ts)" : "var(--sg)")).join(" ");
  // The block labels (row 1) and the split between the blocks.
  const dims = DIMS.map((d) => {
    const c = span(d), own = els.filter((e) => dimOf(e) === d.id && !e.part), n = own.filter((e) => !e.planned).length, p = own.length - n;
    return `<p class="pt-dim" style="grid-area:1/${c[0]}/2/${c.at(-1) + 1}"><b>${esc(d.label)}</b><span>${esc(d.sub)}</span><i>${n} shipped${p ? ` · ${p} planned` : ""}</i></p>`;
  }).join("");
  const split = span(DIMS[1])[0] - 1;
  const heads = cols.map((c) => `<p class="pt-fam" style="--tone:var(--k-${c.fam.tone},var(--${c.fam.tone}));grid-area:2/${c.col}" aria-hidden="true">${esc(c.fam.label)}</p>`).join("");
  // A family's note (In-house) sits under its bricks; the 3D block's line under the block.
  const notes = cols.map((c) => c.fam.note ? `<p class="pt-fam-note" style="--tone:var(--k-${c.fam.tone},var(--${c.fam.tone}));grid-area:${ROW0 + c.els.length}/${c.col}" >${esc(c.fam.note)}</p>` : "").join("");
  const d3 = cols.filter((c) => c.dim === DIMS[1]), d3rows = Math.max(...d3.map((c) => c.els.length));
  const d3note = DIMS[1].line ? `<p class="pt-dim-note" style="grid-area:${ROW0 + d3rows}/${d3[0].col}/${last}/${d3.at(-1).col + 1}">${esc(DIMS[1].line)}</p>` : "";
  // The bay: the first four columns' free rows at the bottom left (under Kernel, Input, Network and
  // In-house, its note included), where the legend rests and the quick view flies in over it.
  const bay = ROW0 + Math.max(...cols.slice(0, 4).map((c) => c.els.length + (c.fam.note ? 1 : 0)));
  const kernel = els.find((e) => e.id === "kernel");
  // The legend: how to read a tile, drawn as one, like the key on a periodic table.
  const legend = `<div class="pt-legend" style="grid-area:${bay}/1/${last}/5" aria-hidden="true">
          <span class="bui-label"><b>HOW TO READ A BRICK</b></span>
          <span class="el-face pt-leg-key" style="--tone:${kernel.tone}">${face(kernel)}</span>
          <span class="pt-leg-notes"><span><b>STICKER</b> status</span><span><b>● ${kb(kernel.gzip)}K</b> gzip, measured</span><span><b>${esc(kernel.sym)}</b> symbol</span><span><b>1</b> number</span></span>
          <span class="pt-leg-flags"><span class="pt-leg-solid"></span>${shipped} shipped <span class="pt-leg-dash"></span>${later} planned</span>
        </div>`;
  const html = `
<section class="pt-hero has-grid" id="table" aria-labelledby="pt-title" data-periodic>
  <div class="wrap pt-grid">
    <div class="pt-copy">
      <div class="pt-top">
        <p class="eyebrow"><span class="dot"></span>THE FIZLET™ PERIODIC TABLE <span>/</span> <b>BRICKS</b></p>
        <p class="pt-meta bui-label">V${esc(version)} · ${shipped} SHIPPED · ${later} PLANNED · THIS TABLE ${sizeBadge(js.bytes, js.live, "this periodic table's script")}</p>
      </div>
      <h1 id="pt-title">${headline()}</h1>
      <div class="pt-side">
        <p class="lead pt-lead">Every brick is a job we wrote again and again over two decades of animation and game work, solved once and kept small. Bring the logic and the style; take only the bricks you need.<span class="pt-more"> ${shipped} shipped, each with its size measured on this build; ${later} on the roadmap, dashed.</span></p>
        <div class="pt-keys">
          <a class="bui-key bui-arcade bui-sys" href="#bricks">${icon("grid", 16)}Every brick, every export</a>
          <a class="bui-key bui-arcade bui-cmd" href="#stickers">${icon("down", 16)}Brick stickers</a>
          <a class="hero-link" href="#factory">${icon("play", 16)}The FILET factory ↓</a>
        </div>
        <p class="pt-hint bui-label" aria-hidden="true">PRESS A BRICK · ARROWS MOVE · ESC CLOSES</p>
      </div>
    </div>
    <div class="pt-board" style="--rows:${rows};--bay:${bay - ROW0}">
      <div class="pt-scroll">
        <div class="pt-table" style="grid-template-columns:${tracks};grid-template-rows:var(--gh) var(--fh) repeat(${rows},var(--ts))" role="group" aria-label="The Fizlet periodic table: ${shipped + later} bricks in two blocks, ${DIMS.map((d) => `${d.label} (${[...new Set(cols.filter((c) => c.dim === d).map((c) => c.fam.label))].join(", ")})`).join(" and ")}. Arrow keys move between bricks; Enter opens a quick view.">
          ${dims}
          <span class="pt-split" style="grid-area:1/${split}/${last}/${split + 1}" aria-hidden="true"></span>
          ${heads}
          ${notes}
          ${d3note}
          ${els.map((e) => tile(e, at.get(e.id))).join("\n          ")}
          ${legend}
        </div>
      </div>
      <p class="pt-swipe bui-label" aria-hidden="true">SWIPE THE TABLE <span>→</span></p>
      <section class="pt-card" id="pt-card" aria-label="Quick view" hidden>
        <button type="button" class="bui-key pt-x" aria-label="Close the quick view">${icon("close", 16)}</button>
        <div class="pt-q"></div>
      </section>
      <p class="sr" role="status" aria-live="polite" data-pt-say></p>
    </div>
  </div>
  ${els.map(quick).join("\n  ")}
</section>`;
  return { html, css: CSS };
}

// Tokens only (Board UI kit + site.css). --ts: a tile's side; --tg: the gap between tiles; --rg: between
// rows; --sg: the split track between the 2D and 3D blocks; --gh, --fh: the block and family heads.
const CSS = `
.pt-hero{position:relative;isolation:isolate;display:grid;align-items:center;min-height:100svh;padding:clamp(28px,5vh,56px) 0 clamp(36px,6vh,64px);border-bottom:2px solid var(--line);--grid-band:100%;--grid-fade:radial-gradient(ellipse 100% 90% at 50% 60%,#000 45%,transparent 100%)}
.pt-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(28px,4.5vh,48px);width:100%}
/* The copy: the headline on the left, the lead and the keys on the right, over the table. */
.pt-copy{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);grid-template-areas:"top top" "h1 side";gap:0 clamp(28px,4vw,64px);align-items:end}
.pt-top{grid-area:top;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center}
.pt-side{grid-area:side;padding-bottom:6px}
.bui .pt-meta{margin:0;color:var(--muted);white-space:normal}
.pt-hero h1{grid-area:h1;margin:18px 0 0;font-size:clamp(44px,5.4vw,84px);line-height:.94;letter-spacing:-.05em}
.pt-hero h1 em{display:block;text-wrap:balance;color:var(--k-go);text-shadow:0 0 40px color-mix(in srgb,var(--k-go) 30%,transparent)}
html.bui[data-theme="light"] .pt-hero h1 em{color:var(--hl);text-shadow:none}
.pt-lead{max-width:34em;margin:0 0 22px}
.pt-keys{display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px}
.pt-keys .hero-link{min-height:44px}
.pt-hint{margin:16px 0 0;color:var(--k-go)}
html.bui[data-theme="light"] .pt-hint{color:var(--hl)}
/* The board: the table, its scroller (when it is wider than the screen), the quick view. Centred,
   as wide as the table. */
.pt-board{--ts:clamp(60px,6.6vw,80px);--tg:8px;--rg:12px;--sg:28px;--gh:26px;--fh:20px;position:relative;justify-self:center;width:max-content;max-width:100%;min-width:0}
.pt-scroll{overflow-x:auto;overscroll-behavior-x:contain;padding:10px 10px 12px 4px;margin:-10px -10px -12px -4px}
.pt-table{position:relative;display:grid;gap:var(--rg) var(--tg);width:max-content}
/* The blocks' labels: 2D and 3D, big, with what each holds and its count. */
.pt-dim{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:end;align-self:end;margin:0;font:700 9.5px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.pt-dim b{grid-row:1/3;font:900 30px/.8 var(--sans);letter-spacing:-.03em;color:var(--ink)}
.pt-dim i{font-style:normal;color:var(--ink)}
.pt-split{justify-self:center;width:0;border-left:2px dashed var(--line)}
.pt-fam-note{margin:0;padding:4px 2px 0;font:9.5px/1.3 var(--mono);color:var(--muted);border-top:2px dashed var(--tone)}
.pt-dim-note{margin:0;padding:8px 2px 0;max-width:30ch;font:11px/1.45 var(--mono);color:var(--muted);border-top:2px dashed var(--line)}
.pt-fam{margin:0;align-self:end;padding:0 0 3px;font:800 9px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border-bottom:2px solid var(--tone)}
/* A tile: a Board UI key. Neutral at rest; the brick's colour on hover (border and base) and when
   pressed (the kit's press: down onto its base), lit in its colour, PRESSED. */
.bui .el-key{--py:4px;--edge:var(--line);--border-hover:var(--tone);--edge-hover:color-mix(in srgb,var(--tone) 55%,var(--rim));--glow-press:0 0 22px color-mix(in srgb,var(--tone) 55%,transparent);position:relative;display:grid;place-items:center;width:var(--ts);height:var(--ts);min-height:0;padding:0;font-family:var(--mono);background:var(--surface);border-color:var(--line);border-radius:8px;overflow:visible}
.el-face .el-flags{position:absolute;top:-8px;left:3px;right:3px;display:flex;gap:2px;pointer-events:none}
.el-face .brick-sticker{--bw:1.5px;--fold:4px;padding:2px 3px 1px;font-size:6.5px;letter-spacing:.06em;border-radius:3px;box-shadow:calc(1.5px * var(--shadow-x, 0)) calc(1.5px * var(--shadow-y, 1)) 0 var(--sticker-shadow);rotate:calc(var(--tilt, -4deg) * .7);translate:none}
.el-face .brick-sticker-peel{padding-right:5px}
.el-face .brick-sticker-kernel{rotate:-5deg;border-radius:3px;letter-spacing:.14em}
.el-face .el-sz{position:absolute;top:7px;right:5px;display:flex;align-items:center;gap:3px;font:700 8.5px/1 var(--mono);font-style:normal;color:var(--ink)}
.el-face .el-dot{width:6px;height:6px;background:var(--tone);border:1.5px solid var(--rim);border-radius:50%}
.el-face .el-sym{margin-top:2px;font:900 calc(var(--ts) * .38)/1 var(--mono);letter-spacing:-.04em;color:var(--ink)}
.el-face .el-no{position:absolute;left:5px;bottom:5px;font:700 8px/1 var(--mono);font-style:normal;color:var(--muted)}
.el-face .el-name,.el-face .el-on{position:absolute;left:22px;right:4px;bottom:5px;overflow:hidden;font:700 8px/1 var(--mono);text-align:right;white-space:nowrap;text-overflow:ellipsis;color:var(--muted)}
.el-face .el-on{display:none;left:3px;right:3px;text-align:center;font-weight:900;letter-spacing:.06em;text-overflow:clip}
.bui .el-key.el-kernel{border-width:3px}
.bui .el-planned{background:transparent;border-style:dashed;--edge:transparent}
.bui .el-planned .el-sym{color:var(--muted)}
.bui .el-key[aria-expanded="true"]{background:var(--tone);border-color:var(--rim);border-style:solid}
.el-key[aria-expanded="true"] :is(.el-no,.el-sz,.el-sym){color:var(--rim)}
.el-key[aria-expanded="true"] .el-dot{background:var(--rim)}
.el-key[aria-expanded="true"] :is(.el-name,.el-no){display:none}
.el-key[aria-expanded="true"] .el-on{display:block;color:var(--rim)}
html.bui[data-theme="light"] .el-key[aria-expanded="true"]{--glow-press:0 0 0 transparent}
/* The legend: in the bay (the free rows under the first four columns), the key of a periodic table. */
.pt-legend{display:grid;grid-template-columns:auto minmax(0,1fr);align-content:start;gap:10px 14px;padding:14px 4px 0 2px;font:11px/1.35 var(--mono);color:var(--muted)}
.pt-legend > .bui-label{grid-column:1/-1}
.pt-leg-key{--ts:60px;position:relative;display:grid;place-items:center;grid-row:2/4;align-self:start;width:var(--ts);height:var(--ts);margin-top:8px;background:var(--surface);border:2px solid var(--line);border-radius:8px;box-shadow:calc(4px * var(--shadow-x, 0)) calc(4px * var(--shadow-y, 1)) 0 var(--line)}
.pt-leg-key .el-on{display:none}
.pt-leg-notes{display:grid;gap:4px;align-content:start;padding-top:6px;font-size:10px}
.pt-leg-notes b{color:var(--ink)}
.pt-leg-flags{grid-column:2;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:10px}
.pt-leg-solid,.pt-leg-dash{width:14px;height:14px;border:2px solid var(--muted);border-radius:3px}
.pt-leg-dash{margin-left:6px;border-style:dashed}
/* Wider than the screen: a fade on the edge still to scroll and a SWIPE label (periodic.ts sets
   data-scrolls and data-end from the scroller's own measures). */
.pt-swipe{display:none;margin:12px 0 0;justify-content:flex-end;gap:6px;color:var(--k-go)}
html.bui[data-theme="light"] .pt-swipe{color:var(--hl)}
.pt-board[data-scrolls] .pt-swipe{display:flex}
.pt-board[data-end] .pt-swipe span{visibility:hidden}
.pt-board::after{content:"";position:absolute;top:0;right:-10px;height:calc(var(--gh) + var(--fh) + var(--rg) * 2 + (var(--ts) + var(--rg)) * var(--rows));width:56px;background:linear-gradient(90deg,transparent,var(--bg) 85%);pointer-events:none;opacity:0;transition:opacity 160ms ease-out}
.pt-board[data-scrolls]:not([data-end])::after{opacity:1}
/* The quick view: flies into the bay over the legend (desktop) or up as a bottom sheet (narrow). */
.pt-card{--tone:var(--k-cmd);position:absolute;z-index:5;left:0;top:calc(var(--gh) + var(--fh) + var(--rg) * 2 + (var(--ts) + var(--rg)) * var(--bay));width:calc(var(--ts) * 4 + var(--tg) * 3);min-height:calc((var(--ts) + var(--rg)) * (var(--rows) - var(--bay)) - var(--rg));box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:8px;padding:14px 14px 16px;background:var(--card);border:2.5px solid var(--tone);border-radius:10px;box-shadow:calc(5px * var(--shadow-x, 0)) calc(5px * var(--shadow-y, 1)) 0 color-mix(in srgb,var(--tone) 50%,var(--rim));transition:translate 260ms var(--bui-out),opacity 200ms ease-out,rotate 260ms var(--bui-spring)}
.pt-card[hidden]{display:none}
@starting-style{.pt-card{translate:-36px 18px;opacity:0;rotate:-3deg}}
.pt-q{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;min-width:0}
.pt-q-head{display:flex;align-items:center;gap:12px;min-width:0;padding-right:52px}
.pt-q-head .el-card{flex:none;width:44px;height:44px;margin:0;font-size:19px}
.pt-q-name{margin:2px 0 0;font:800 13px/1.25 var(--mono);letter-spacing:0;overflow-wrap:anywhere}
.pt-q-name .nw{white-space:nowrap}
.pt-q-name code{font:inherit;color:var(--ink);background:none;padding:0}
.pt-q-meta{display:grid;justify-items:start;gap:7px;min-width:0;margin:0;font:10px/1.3 var(--mono);color:var(--muted)}
.pt-q-meta > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pt-q-meta .brick-sticker{--bw:2px;--fold:7px;font-size:9px;padding:3px 6px 2px;translate:none;rotate:-3deg}
.pt-q-meta .brick-sticker-peel{padding-right:8px}
.pt-q-size{margin:0;font:12px/1.3 var(--mono);color:var(--muted)}
.pt-q-size b{font:900 20px/1 var(--sans);letter-spacing:-.03em;color:var(--ink)}
.pt-q-size span{display:block;margin-top:3px}
.pt-q .meter{width:100%}
.pt-q-what{margin:0;font-size:13px;line-height:1.4;color:var(--ink);overflow-wrap:anywhere}
.pt-q-import{display:grid;gap:4px;margin:0;min-width:0}
.pt-q-import code{font:12px/1.4 var(--mono);color:var(--k-sys-ink);overflow-wrap:anywhere}
.bui .pt-q-go{justify-self:start;min-height:44px;margin-top:2px}
.bui .pt-x{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:44px;height:44px;min-height:0;padding:0}
@media (max-width:1100px){
  .pt-copy{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "h1" "side";align-items:start}
  .pt-hero h1{margin-bottom:20px}
  .pt-hero{align-items:start}
}
/* Narrow: the table scrolls sideways in its own box (never the page); the quick view is a sheet. */
@media (max-width:840px){
  .pt-board{justify-self:stretch;width:auto}
  .pt-card{position:fixed;z-index:60;left:0;right:0;top:auto;bottom:0;width:auto;max-width:560px;margin:0 auto;min-height:0;max-height:78svh;overflow:auto;padding:16px var(--gutter) calc(18px + env(safe-area-inset-bottom));border-width:2.5px 0 0;border-radius:14px 14px 0 0;box-shadow:none}
  @starting-style{.pt-card{translate:0 100%;opacity:1;rotate:0deg}}
}
@media (max-width:560px){.pt-card{border-width:2.5px 0 0}}
@media (min-width:561px) and (max-width:840px){.pt-card{border-width:2.5px 2.5px 0}}
/* Phones: the table under the headline, the lead and keys after it. */
@media (max-width:700px){
  .pt-hero{padding:16px 0 28px}
  .pt-hero h1{font-size:clamp(38px,11vw,54px);margin:12px 0 0}
  .pt-more{display:none}
  .pt-lead{font-size:16px;margin-bottom:18px}
  .pt-board{--ts:60px;--tg:6px;--sg:22px;order:-1}
  .pt-copy,.pt-side{display:contents}
  .pt-grid{gap:16px}
  .pt-top,.pt-hero h1{grid-area:auto}
  .pt-top{order:-3}.pt-hero h1{order:-2}
}
@media (prefers-reduced-motion:reduce){.pt-card,.pt-board::after{transition:none}}
`;
