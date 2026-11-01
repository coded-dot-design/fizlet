// The brick stickers: one per brick, shipped and planned, its symbol and its name in the kit's overlay
// sticker style (src/ui/board-ui.css .bui-sticker: the face in the brick's colour, the ink rim, a hard
// base, tilted −4°), as standalone SVG. scripts/site.mjs writes them to bricks/stickers/ (the
// downloads) and the sticker sheet on bricks/ shows the same files, so the two never drift.
//
// The same approach as the /brand/ marks (scripts/brand-marks.mjs, in its own change): colours from the
// Board UI tokens (src/ui/tokens.json), type from the site's stacks (site/site.css --mono), each text
// run's length pinned (textLength, lengthAdjust="spacing") so a sticker keeps its geometry whatever font
// the viewer has. Self-contained on purpose: it shares no code with that change.
// A planned brick's sticker has a dashed rim and says PLANNED in its corner: it has no role colour yet, so it
// wears its family's (site/bricks.mjs FAMILIES).
import { readFileSync } from "node:fs";
import { FAMILIES } from "../site/bricks.mjs";

const TOKENS = JSON.parse(readFileSync(new URL("../src/ui/tokens.json", import.meta.url), "utf8"));
const CSS = readFileSync(new URL("../site/site.css", import.meta.url), "utf8");
const P = TOKENS.palette;
const MONO = CSS.match(/--mono:\s*([^;]+);/)[1].replace(/"/g, "'");
const RIM = P.surfaces.rim.dark;
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A role's dark face (the sticker face is the same in both themes, like the kit's). */
const face = (role) => {
  const r = P.roles[role];
  if (!r) throw new Error(`brick stickers: no token for role ${role}`);
  return r.dark;
};
// A monospace advance is 0.6em in the stack's fonts.
const run = (n, size, track) => Math.round(n * 0.6 * size + (n - 1) * track * size);
const text = (s, { x, y, size, weight, track, len }) =>
  `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" letter-spacing="${Math.round(size * track * 10) / 10}" fill="${RIM}" textLength="${len}" lengthAdjust="spacing">${xml(s)}</text>`;

/**
 * Every sticker: [{ id, file, title, svg, w, h }]. `els` are the table's elements (site/periodic.mjs
 * elements()): { id, no, sym, name, role?, family, planned }.
 */
export function brickStickers(els) {
  // One size for the whole set: the longest name sets every sticker's width.
  const ks = 9, longest = Math.max(...els.map((e) => run(e.name.length, ks, 0.12)));
  return els.map((e) => {
    const fill = face(e.role ?? FAMILIES.find((f) => f.id === e.family).tone);
    // .bui-sticker: padding 8 18 10, gap 4, kicker 800 8px, word 900 34px, border 2.5, radius 10, base 5.
    const kicker = e.name, no = String(e.no);
    const sym = 46, symLen = run(2, sym, -0.03), kLen = run(kicker.length, ks, 0.12);
    const w = Math.max(symLen + 60, longest + 36), h = 10 + ks + 6 + Math.round(sym * 0.78) + 14, m = 14;
    const W = w + 2 * m, H = h + 2 * m + 5, cx = W / 2, cy = H / 2;
    const title = `Sticker: ${e.sym}, ${e.name}${e.planned ? " (planned)" : ""}`;
    const body = `<g transform="rotate(-4 ${cx} ${cy})">` +
      `<rect x="${m}" y="${m + 5}" width="${w}" height="${h}" rx="10" fill="${RIM}"/>` +
      `<rect x="${m + 1.25}" y="${m + 1.25}" width="${w - 2.5}" height="${h - 2.5}" rx="9" fill="${fill}" stroke="${RIM}" stroke-width="2.5"${e.planned ? ' stroke-dasharray="7 5"' : ""}/>` +
      text(kicker, { x: m + Math.round((w - kLen) / 2), y: m + 10 + ks - 2, size: ks, weight: 800, track: 0.12, len: kLen }) +
      text(e.sym, { x: m + Math.round((w - symLen) / 2), y: m + 10 + ks + 6 + Math.round(sym * 0.74), size: sym, weight: 900, track: -0.03, len: symLen }) +
      text(no, { x: m + 9, y: m + h - 9, size: 9, weight: 700, track: 0, len: run(no.length, 9, 0) }) +
      (e.planned ? text("PLANNED", { x: m + w - 9 - run(7, 8, 0.12), y: m + h - 9, size: 8, weight: 800, track: 0.12, len: run(7, 8, 0.12) }) : "") +
      `</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" role="img" aria-label="${xml(title)}"><title>${xml(title)}</title>${body}</svg>`;
    return { id: e.id, file: `fizlet-brick-${e.id}.svg`, title, svg, w: W, h: H, planned: e.planned };
  });
}

/** The sticker sheet on bricks/: every sticker, each a download of its SVG (in bricks/stickers/). */
export function stickerSheet(stickers, { esc }) {
  return `
<section class="section stk-sheet" id="stickers" aria-labelledby="stk-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${stickers.length}</span> STICKERS · SVG</p>
      <h2 id="stk-title">One sticker<br><em>per brick.</em></h2>
      <p class="lead">Every brick's symbol and name in the Board UI sticker style, in its own colour; planned bricks wear a dashed rim. Each one downloads as an SVG, drawn at build time from the same data as the table.</p>
    </div>
    <ul class="stk-grid">
      ${stickers.map((s) => `<li><a class="stk" href="stickers/${esc(s.file)}" download="${esc(s.file)}"><img src="stickers/${esc(s.file)}" alt="${esc(s.title)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async"><span class="stk-cap">${esc(s.id)} <b>SVG ↓</b></span></a></li>`).join("\n      ")}
    </ul>
  </div>
</section>`;
}

export const STICKER_CSS = `
.stk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:18px;margin:28px 0 0;padding:0;list-style:none}
.stk{display:grid;justify-items:center;gap:6px;padding:10px 6px 8px;color:var(--muted);text-decoration:none;border:2px solid transparent;border-radius:10px}
.stk img{display:block;width:100%;max-width:150px;height:auto}
.stk-cap{font:700 11px/1.2 var(--mono)}
.stk-cap b{color:var(--k-sys-ink)}
.stk:hover,.stk:focus-visible{border-color:var(--line);color:var(--ink)}
@media (max-width:600px){.stk-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
`;
