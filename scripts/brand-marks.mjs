// The Fizlet marks, one source: the FIZLET logo, the fzlt logo and the text lockups, each on dark
// and on light, as standalone SVG. scripts/site.mjs writes them to /brand/ (the downloads) and
// site/pages/brand.mjs draws the same strings inline, so the page and the files never drift.
//
// Colours come from the Board UI tokens (src/ui/tokens.json, the authoritative source) and the
// site's own --code-bg (site/site.css), never typed here. The two logos are outlines (below). The
// text lockups use the site's stacks (site/site.css --mono, --sans). The
// site ships system fonts only, so there is no font file to outline or embed: each SVG names the
// same stack and pins the text's length (textLength, lengthAdjust="spacing": letters keep their
// shape, only the spacing gives), so a mark keeps its geometry whichever font the viewer has.
// ™ is the plain character in the word's own colour, never on code (@fzlt/core) or a domain.
import { readFileSync } from "node:fs";
import { MARK, rectPath } from "../site/layout.mjs";

const TOKENS = JSON.parse(readFileSync(new URL("../src/ui/tokens.json", import.meta.url), "utf8"));
const CSS = readFileSync(new URL("../site/site.css", import.meta.url), "utf8");
const P = TOKENS.palette, PINK = P.roles.attack.dark;
if (PINK.toLowerCase() !== MARK.pink) throw new Error("site/layout.mjs MARK.pink drifted from --k-attack");
const roleOf = (v) => (v.startsWith("= ") ? P.roles[v.slice(2)].dark : v);
const codeBg = [...CSS.matchAll(/--code-bg:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
const font = (name) => CSS.match(new RegExp(`--${name}:\\s*([^;]+);`))[1].replace(/"/g, "'");
if (codeBg.length < 2) throw new Error("site/site.css: --code-bg for dark and light not found");

const ground = (theme) => {
  const s = (id) => (theme === "dark" ? P.surfaces[id].dark : P.surfaces[id].light ?? P.surfaces[id].dark);
  return { bg: s("bg"), ink: s("ink"), muted: s("muted"), line: s("line"), code: theme === "dark" ? codeBg[0] : codeBg[1], codeInk: theme === "dark" ? roleOf(P.inks.sysInk.dark) : P.inks.sysInk.light };
};
/** The two grounds a mark sits on: the site's own dark and light page colours. */
export const THEMES = { dark: ground("dark"), light: ground("light") };

export const MONO = font("mono"), SANS = font("sans");
// A monospace advance is 0.6em in the stack's fonts; the header tracks the wordmark at 0.1em.
const ADV = 0.6, TRACK = 0.1;
/** Length of `n` mono characters at `size`, tracked: what textLength pins. */
const run = (n, size, track = TRACK) => Math.round(n * ADV * size + (n - 1) * track * size);

// ---------- The two logos ----------
// FIZLET (the large logo: the framed mark, its right side the F's stem) and fzlt (the small logo:
// the mark's pixels, no frame). Drawn from the owner's art as outlines, so they hold their shape in
// any font: units are the mark's own 64-unit grid (site/layout.mjs MARK), FIZLET's cap height is the
// frame. One function per logo: if the owner's SVG source arrives, it replaces that function's paths.
// Each returns { w, h, ink, pop }: the box and two paths' data, ink (--ink) and the pop (--k-attack).

/** ™ as outlines: a T and an M, `h` tall, strokes `s`, top-left at (x, y). */
function tmPath(x, y, h, s) {
  const r = (n) => Math.round(n * 100) / 100;
  const tw = r(h * 0.72), mx = r(x + tw + h * 0.2), mw = r(h * 1.05), cx = r(mx + mw / 2), v = r(y + h * 0.66);
  return `M${x} ${y}h${tw}v${s}h${r(-(tw - s) / 2)}v${r(h - s)}h${-s}v${r(-(h - s))}h${r(-(tw - s) / 2)}Z` +
    `M${mx} ${y}h${r(s * 1.3)}L${cx} ${r(v - s * 1.4)}L${r(mx + mw - s * 1.3)} ${y}h${r(s * 1.3)}v${h}h${-s}V${r(y + h * 0.3)}L${r(cx + s * 0.4)} ${v}h${r(-s * 0.8)}L${r(mx + s)} ${r(y + h * 0.3)}V${y + h}h${-s}Z`;
}

/** The large logo: the framed mark, then FIZLET in heavy caps, ™. Cap height 64. */
export function fizletLogo() {
  return {
    w: 375, h: 64,
    ink: rectPath([...MARK.frame, ...MARK.ink]) +
      "M62 0h43v11H76.5v15.5H102v11H76.5V64H62Z" + // F: its stem is the frame's right side
      "M114.25 0h14v64h-14Z" + // I
      "M138 0h49.4v7.2L154.6 53h32.8v11H138v-8l32.2-45H138Z" + // Z
      "M198 0h14v53h26.5v11H198Z" + // L
      "M247.6 0h43.9v11h-29.9v15.5h27.8v11h-27.8V53h30.1v11h-44.1Z" + // E
      "M299 0h53v11h-19.5v53h-14V11H299Z" + // T
      tmPath(358.6, 0, 8, 1.2),
    pop: rectPath(MARK.pop),
  };
}

/** The small logo: the mark's pixels (no frame, the pop a pixel and a half further right), then fzlt, ™. */
export function fzltLogo() {
  const ink = rectPath(MARK.ink) +
    "M62.6 78.5V35A10.4 10.4 0 0 1 73 24.6h8.4Q83 24.6 82.8 26.2L81.9 32.5Q81.7 34.1 80.1 34.1H73.3v44.4Z" + // f
    "M57.2 40H81v8.5H57.2Z" + // f's bar
    "M88 40h31.2v6.9L101 70h18.7v8.5H87.3v-6.7L106.5 48.5H88Z" + // z
    "M128 26.9h10.7v51.6H128Z" + // l
    "M149.8 30.6h10.7V40h7.4v8.5h-7.4V70h6.4l1.3 7.6Q168.4 79.1 166.8 79.1H158A8.2 8.2 0 0 1 149.8 70.9V48.5h-5.2V40h5.2Z" + // t
    tmPath(176.5, 30.4, 6, 1.1);
  return { x0: 8, y0: 6, w: 181, h: 74, ink, pop: rectPath(MARK.pop, 1.5) }; // the box: the outlined square's left, the pop's top
}

/** A logo inline at `height` px, in the page's colours: ink is currentColor, the pop --k-attack. */
export function logoSvg(logo, height) {
  const vb = `${logo.x0 ?? 0} ${logo.y0 ?? 0} ${logo.w} ${logo.h}`, width = Math.round((logo.w / logo.h) * height * 10) / 10;
  return `<svg viewBox="${vb}" width="${width}" height="${height}" aria-hidden="true"><path fill="currentColor" d="${logo.ink}"/><path style="fill:var(--k-attack)" d="${logo.pop}"/></svg>`;
}

// Geometry, in SVG units. W = the type size of the text lockups; their clear space X is its cap
// height. The logos are drawn at LOGO a unit (FIZLET's cap height 48); their clear space LX is the
// width of the mark's outlined square (26 of its 64 units).
const W = 48, CAP = Math.round(W * 0.7), X = CAP, LOGO = 0.75, LX = Math.round(26 * LOGO);

const text = (s, { x, y, size, fill, len, family = MONO, weight = 700, track = TRACK }) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${Math.round(size * track * 10) / 10}" fill="${fill}" textLength="${len}" lengthAdjust="spacing">${s}</text>`;
/** A word and its ™ (the word's own colour), baseline at y: { w, svg }. */
function marked(word, { x, y, size, fill, len, family, weight, track }) {
  const tm = Math.round(size / 3);
  return { w: len + 4 + tm, svg: text(word, { x, y, size, fill, len, family, weight, track }) + text("™", { x: x + len + 4, y: y - Math.round(size * 0.42), size: tm, fill, len: tm, weight: 400, track: 0 }) };
}

const svg = (w, h, title, t, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}"><title>${title}</title><rect width="${w}" height="${h}" fill="${t.bg}"/>${body}</svg>`;

/** Every mark, on both grounds: [{ id, theme, file, name, title, svg, w, h }]. X clear space all round. */
export function brandMarks() {
  const out = [];
  for (const [theme, t] of Object.entries(THEMES)) {
    const add = (id, name, title, w, h, body) => out.push({ id, theme, file: `fizlet-${id}-${theme}.svg`, name, title: `${title}, on ${theme}`, w, h, svg: svg(w, h, `${title}, on ${theme}`, t, body) });
    const y = X + CAP, h = CAP + 2 * X;
    // The logos: ink in the ground's --ink, the pop in --k-attack (pink on both grounds), LX all round.
    for (const [id, name, title, logo] of [["wordmark", "FIZLET logo", "FIZLET logo", fizletLogo()], ["short-mark", "fzlt logo", "fzlt logo", fzltLogo()]]) {
      const w = Math.ceil(logo.w * LOGO + 2 * LX), hh = Math.ceil(logo.h * LOGO + 2 * LX);
      const at = `translate(${LX - (logo.x0 ?? 0) * LOGO} ${LX - (logo.y0 ?? 0) * LOGO}) scale(${LOGO})`;
      add(id, name, title, w, hh, `<g transform="${at}"><path fill="${t.ink}" d="${logo.ink}"/><path fill="${PINK}" d="${logo.pop}"/></g>`);
    }
    {
      // Fizlet™ · fzlt™: the name in the site's sans, then a middle dot and the short mark in mono, muted.
      const a = marked("Fizlet", { x: X, y, size: W, fill: t.ink, len: Math.round(W * 2.4), family: SANS, weight: 800, track: -0.035 });
      const dotX = X + a.w + Math.round(X / 2), dot = text("·", { x: dotX, y, size: W, fill: t.muted, len: Math.round(W * ADV), track: 0 });
      const b = marked("fzlt", { x: dotX + Math.round(W * ADV) + Math.round(X / 2), y, size: W, fill: t.muted, len: run(4, W, 0.02), track: 0.02 });
      const end = dotX + Math.round(W * ADV) + Math.round(X / 2) + b.w;
      add("lockup", "Fizlet + fzlt", "Fizlet and fzlt lockup", end + X, h, a.svg + dot + b.svg);
    }
    {
      // The package in code style only (the site's code chip: --code-bg, sys ink), never with ™.
      const size = 32, pad = 18, cmd = run(5, size, 0), sp = run(6, size, 0), pkg = run(10, size, 0), cw = sp + pkg + 2 * pad, ch = Math.round(size * 1.9);
      const cy = X + Math.round((CAP - ch) / 2), base = cy + Math.round(ch / 2 + size * 0.35);
      add("npm", "@fzlt/core", "npm i @fzlt/core", cw + 2 * X, h,
        `<rect x="${X}" y="${cy}" width="${cw}" height="${ch}" rx="10" fill="${t.code}" stroke="${t.line}" stroke-width="2"/>` +
        text("npm i", { x: X + pad, y: base, size, fill: t.muted, len: cmd, weight: 400, track: 0 }) + text("@fzlt/core", { x: X + pad + sp, y: base, size, fill: t.codeInk, len: pkg, track: 0 }));
    }
    {
      const len = run(8, W, 0.02);
      add("dev", "fzlt.dev", "fzlt.dev", len + 2 * X, h, text("fzlt.dev", { x: X, y, size: W, fill: t.ink, len, track: 0.02 }));
    }
  }
  return out;
}

/** The clear-space unit and the geometry the page's diagram draws (LX: the logos'). */
export const GEOMETRY = { W, CAP, X, LOGO, LX };

// ---------- The sticker set ----------
// Fizlet™ and fzlt™ stickers, in the kit's two sticker styles (src/ui/board-ui.css): the overlay
// sticker (.bui-sticker: a kicker and a word on the flag face, the ink rim, a hard base, tilted −4°)
// and the sticker key (.bui-sticker-key: a navy face, a white rim and base, a pixel icon tile and a
// mono label; white face and ink rim on light). One list: the page renders each with the kit's own
// classes, and the SVG downloads are drawn here from the same entries and the kit's own values.
const KIT = readFileSync(new URL("../src/ui/board-ui.css", import.meta.url), "utf8");
/** A declaration's value in the first rule whose selector is exactly `sel`. */
const decl = (sel, prop) => {
  const at = KIT.indexOf(`${sel} {`);
  if (at < 0) throw new Error(`board-ui.css: no rule ${sel}`);
  const body = KIT.slice(at, KIT.indexOf("}", at));
  const v = body.match(new RegExp(`\\n\\s*${prop}:\\s*([^;]+);`))?.[1];
  if (!v) throw new Error(`board-ui.css: ${sel} has no ${prop}`);
  return v.trim();
};
const KEY = {
  dark: { face: decl(".bui .bui-sticker-key", "background"), rim: decl(".bui .bui-sticker-key", "--edge"), icon: decl(".bui .bui-sticker-key", "color"), label: decl(".bui .bui-sticker-key b", "color") },
  light: { face: decl('.bui[data-theme="light"] .bui-sticker-key', "background"), rim: P.surfaces.rim.dark, icon: decl('.bui[data-theme="light"] .bui-sticker-key', "color"), label: P.surfaces.rim.dark },
};

/** The set. kind "sticker": kicker + word; kind "key": icon + label. `tm`: the word carries ™. */
export const STICKERS = [
  { id: "fizlet", kind: "sticker", kicker: "BY CHRIS COOLEY", word: "FIZLET", tm: true },
  { id: "fzlt", kind: "sticker", kicker: "@fzlt/core", word: "fzlt", tm: true },
  { id: "npm", kind: "sticker", kicker: "INSTALL", word: "npm i @fzlt/core", small: true },
  { id: "key-fizlet", kind: "key", word: "FIZLET" },
  { id: "key-fzlt", kind: "key", word: "fzlt" },
];

/** The kit mark's art (site/layout.mjs mark()), as SVG children, in `color`. */
const markArt = (mark, x, y, s, color) => mark(s).replace(/^<svg /, `<svg x="${x}" y="${y}" color="${color}" `).replace(' aria-hidden="true"', "");

/** Every sticker as SVG: [{ id, theme, file, name, title, svg, w, h, entry }]. Stickers sit on a clear ground. */
export function brandStickers(mark) {
  const out = [], flag = P.roles.flag.dark, rim = P.surfaces.rim.dark;
  const wrap = (w, h, title, body, scale = 2) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
  for (const s of STICKERS) {
    if (s.kind === "sticker") {
      // .bui-sticker: padding 8 18 10, gap 4, kicker 800 8px tracked 4, word 900 34px tracked 2, border 2.5, radius 10, base 5.
      const size = s.small ? 22 : 34, track = s.small ? 0 : 2 / 34;
      const word = run(s.word.length, size, track), kick = run(s.kicker.length, 8, 0.5), tmw = s.tm ? Math.round(size / 3) + 3 : 0;
      const w = Math.max(word + tmw, kick) + 36, h = 8 + 8 + 4 + size + 10, m = 18, W2 = w + 2 * m, H2 = h + 2 * m + 5;
      const wx = m + Math.round((w - word - tmw) / 2), base = m + 8 + 8 + 4 + Math.round(size * 0.8);
      const words = s.tm
        ? marked(s.word, { x: wx, y: base, size, fill: rim, len: word, weight: 900, track }).svg
        : text(s.word, { x: wx, y: base, size, fill: rim, len: word, weight: 900, track });
      const body = `<g transform="rotate(-4 ${W2 / 2} ${H2 / 2})"><rect x="${m}" y="${m + 5}" width="${w}" height="${h}" rx="10" fill="${rim}"/><rect x="${m + 1.25}" y="${m + 1.25}" width="${w - 2.5}" height="${h - 2.5}" rx="9" fill="${flag}" stroke="${rim}" stroke-width="2.5"/>` +
        text(s.kicker, { x: m + Math.round((w - kick) / 2), y: m + 8 + 7, size: 8, fill: rim, len: kick, weight: 800, track: 0.5 }) + words + `</g>`;
      out.push({ id: s.id, theme: "any", file: `fizlet-sticker-${s.id}.svg`, name: `${s.kicker} / ${s.word}`, title: `Sticker: ${s.kicker} / ${s.word}${s.tm ? "™" : ""}`, w: W2, h: H2, entry: s, svg: wrap(W2, H2, `Sticker: ${s.kicker} / ${s.word}${s.tm ? "™" : ""}`, body) });
    } else {
      // .bui-sticker-key: 132 × 84, border 3, radius 12, base 5, icon 42, label 900 10px tracked 1.6.
      for (const theme of ["dark", "light"]) {
        const k = KEY[theme], w = 132, h = 84, m = 8, W2 = w + 2 * m, H2 = h + 2 * m + 5, len = run(s.word.length, 10, 0.16);
        const body = `<rect x="${m}" y="${m + 5}" width="${w}" height="${h}" rx="12" fill="${k.rim}"/><rect x="${m + 1.5}" y="${m + 1.5}" width="${w - 3}" height="${h - 3}" rx="10.5" fill="${k.face}" stroke="${k.rim}" stroke-width="3"/>` +
          markArt(mark, m + 45, m + 11, 42, k.icon) + text(s.word, { x: m + Math.round((w - len) / 2), y: m + 72, size: 10, fill: k.label, len, weight: 900, track: 0.16 });
        out.push({ id: s.id, theme, file: `fizlet-sticker-${s.id}-${theme}.svg`, name: s.word, title: `Sticker key: ${s.word}, on ${theme}`, w: W2, h: H2, entry: s, svg: wrap(W2, H2, `Sticker key: ${s.word}, on ${theme}`, body) });
      }
    }
  }
  return out;
}
