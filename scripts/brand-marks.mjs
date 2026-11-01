// The Fizlet marks, one source: the FIZLET wordmark, the fzlt short mark and the lockups, each on
// dark and on light, as standalone SVG. scripts/site.mjs writes them to /brand/ (the downloads) and
// site/pages/brand.mjs draws the same strings inline, so the page and the files never drift.
//
// Colours come from the Board UI tokens (src/ui/tokens.json, the authoritative source) and the
// site's own --code-bg (site/site.css), never typed here. Type is the site's stacks (site/site.css
// --mono, --sans); the wordmark is set like the header's (.brand-text b: bold, tracked 0.1em). The
// site ships system fonts only, so there is no font file to outline or embed: each SVG names the
// same stack and pins the text's length (textLength, lengthAdjust="spacing": letters keep their
// shape, only the spacing gives), so a mark keeps its geometry whichever font the viewer has.
// ™ is the plain character in the word's own colour, never on code (@fzlt/core) or a domain.
import { readFileSync } from "node:fs";

const TOKENS = JSON.parse(readFileSync(new URL("../src/ui/tokens.json", import.meta.url), "utf8"));
const CSS = readFileSync(new URL("../site/site.css", import.meta.url), "utf8");
const P = TOKENS.palette;
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

// Geometry, in SVG units. W = the wordmark's type size. X, the clear space, is its cap height.
const W = 48, CAP = Math.round(W * 0.7), X = CAP;

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
    {
      const m = marked("FIZLET", { x: X, y, size: W, fill: t.ink, len: run(6, W) });
      add("wordmark", "Wordmark", "FIZLET wordmark", m.w + 2 * X, h, m.svg);
    }
    {
      const m = marked("fzlt", { x: X, y, size: W, fill: t.ink, len: run(4, W, 0.02), track: 0.02 });
      add("short-mark", "Short mark", "fzlt short mark", m.w + 2 * X, h, m.svg);
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

/** The clear-space unit and the geometry the page's diagram draws. */
export const GEOMETRY = { W, CAP, X };

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
