// The brick component: one brick, in three sizes, from this one module and one CSS block
// (site/site.css "Brick component"). Every size follows the same rules: no top bar; the neutral
// card border and hard shadow at rest, the brick's colour (--tone) on hover and focus; the status as
// a tilted sticker beside the symbol tile (a tiny dot in mini); a distinct kernel variant. Numbers come from the build
// (`size`: a scripts/sizes.mjs entry), never typed in.
//
//   full     brickTile({ brick, size, href, toy })   the bricks index: name, what it does, live toy,
//                                                    stat chips, budget bar
//   compact  brickCompact({ brick, size, href })     lists and grids (the home page): name, one size
//                                                    chip with the colour dot, a smaller sticker
//   mini     brickMini({ brick, size, href })        inline chip (≤ 28 px): colour dot, name, size,
//                                                    a status dot
//   brickOf(bricks, name) finds a site/bricks.mjs row by module name (for mini chips from imports).
//
// A brick's symbol (site/bricks.mjs `sym`, the periodic table on bricks/) in the table tile's small
// versions, one look at every scale: elSquare(brick, "card") number + symbol (brick cards, the quick
// view), elSquare(brick, "chip") the symbol alone (chips, where bricks are paired), symChip() a
// linked chip whose name shows on hover and focus. The sticker is the SVG one (scripts/brick-stickers.mjs).
import { esc } from "./layout.mjs";
import { STATUS, FAMILIES } from "./bricks.mjs";

/**
 * A module name that breaks only after a "/" (never inside a word): each part, its slash kept, can't
 * wrap ("@fzlt/" "core/" "board-page"), with a break opportunity between parts.
 */
export const nameParts = (name) => name.split("/").map((p, i, all) => `<span class="nw">${esc(p)}${i < all.length - 1 ? "/" : ""}</span>`).join("<wbr>");

/** A brick's colour: its role's token; a planned brick (no role yet) takes its family's. */
export const toneOf = (brick) => `var(--k-${brick.role ?? FAMILIES.find((f) => f.id === brick.family).tone})`;

/** The symbol as a small element square, decorative (the brick's name is always beside it, or its label). */
export const elSquare = (brick, size = "card") =>
  `<span class="el el-${size}" style="--tone: ${toneOf(brick)}" aria-hidden="true">${size === "card" ? `<i class="el-no">${brick.no}</i>` : ""}<b class="el-sym">${esc(brick.sym)}</b></span>`;

/**
 * A linked symbol chip, for bricks in a group (gallery "uses" lists, the footer): the symbol shows;
 * hover or focus opens the chip to its name. The link's accessible name is the name (`label`), always.
 */
export const symChip = (brick, href, label = brick.id, attrs = "") =>
  `<a class="sym-chip" href="${esc(href)}"${attrs} style="--tone: ${toneOf(brick)}">${elSquare(brick, "chip")}<span class="sym-name">${esc(label)}</span></a>`;

const kb = (bytes) => (bytes / 1024).toFixed(1);
const num = (n) => n.toLocaleString("en-US");

/** `code` spans in doc text, everything else escaped. */
export const prose = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

/**
 * A sticker's hand-slapped look, from its brick's id (FNV-1a), so it is the same on every build and
 * every render, never Math.random: a tilt of 2 to 6 degrees either way and a nudge of a few px.
 * `{ tilt, dx, dy }` in deg and px. No id: the default look (-4deg, no nudge).
 */
export function stickerLook(id) {
  if (!id) return { tilt: -4, dx: 0, dy: 0 };
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  const tilt = (2 + (h % 9) / 2) * ((h >>> 4) & 1 ? 1 : -1);
  return { tilt, dx: (h >>> 8) % 7, dy: ((h >>> 12) % 5) - 2 };
}

/**
 * A brick's status flag as a sticker, never in the title, so it never competes with the brick's
 * name. On a card it sits in the symbol tile's row, tilted and nudged by its brick's id (stickerLook).
 * BETA peels: a corner curls up (.brick-sticker-peel, CSS only: the DOM VIRUS game sticker's recipe).
 * The label is the only text; the peel and the wear are empty pseudo-elements.
 */
export const statusSticker = (status, id) => {
  const { tilt, dx, dy } = stickerLook(id);
  return `<span class="brick-sticker${status === "beta" ? " brick-sticker-peel" : ""}" data-flag="${status}"${id ? ` style="--tilt:${tilt}deg;--dx:${dx}px;--dy:${dy}px"` : ""} title="${esc(STATUS[status].line)}">${STATUS[status].label}</span>`;
};

/** The kernel's own sticker: a stamped slab on the card's top edge, not a status. */
export const KERNEL_STICKER = '<span class="brick-sticker brick-sticker-kernel">KERNEL</span>';

/** The card's head row: the symbol tile, then the status sticker in the open space beside it. */
const head = (brick) => `<div class="brick-head">${elSquare(brick)}<span class="brick-stickers">${statusSticker(brick.status, brick.id)}</span></div>${brick.id === "kernel" ? KERNEL_STICKER : ""}`;

/** A size budget's progress: the brick's colour fills the share of its budget it uses. */
const meter = (gzip, budget) => `<span class="meter brick-meter" role="img" aria-label="${kb(gzip)} KB of a ${kb(budget)} KB budget"><i style="--v:${(gzip / budget).toFixed(3)}"></i></span>`;

/** A brick's runtime exports (what you import), from its declarations. */
const exportCount = (brick) => (brick.mods ?? []).flatMap((m) => m.decls.filter((d) => !["type", "interface"].includes(d.kind)).flatMap((d) => d.names)).length;

const cls = (brick, size) => `${size === "mini" ? "" : "brick "}brick-${size}${brick.id === "kernel" ? " brick-kernel" : ""}`;
const tone = (brick) => `--tone: var(--k-${brick.role})`;

/**
 * Full: one brick card (the bricks index). In this order: the name in display type, what it does in
 * one line, its live toy when it has one, the measured sizes and exports as mono stat chips, and the
 * budget bar in the brick's colour (its cue at rest, and on touch). The kernel is the core, not one
 * brick among many: a wide card with a KERNEL sticker, a double hard shadow and its measured bytes
 * against its budget in display type. `extra`: more chips (as <li>).
 */
export function brickTile({ brick, size, href, h = "h2", toy = "", extra = "", what = brick.summary }) {
  const n = exportCount(brick), kernel = brick.id === "kernel";
  const budget = kernel ? `<p class="brick-budget"><b data-size="${esc(size.name)}">${num(size.gzip)} B</b> <span>of a ${num(size.budget)} B budget</span></p>` : "";
  return `<li class="panel ${cls(brick, "full")}" data-brick="${brick.id}" data-flag="${brick.status}" style="${tone(brick)}">
        ${head(brick)}
        <${h} class="brick-name"><a href="${esc(href)}">${nameParts(brick.name)}</a></${h}>
        <p class="brick-what">${prose(what)}</p>
        ${toy}${budget}<ul class="brick-chips" aria-label="Measured on this build">
          ${kernel ? "" : `<li><b>${kb(size.gzip)} KB</b> gzip</li><li>of <b>${kb(size.budget)} KB</b></li>`}${extra}${n ? `<li><b>${n}</b> ${n === 1 ? "export" : "exports"}</li>` : ""}
        </ul>
        ${meter(size.gzip, size.budget)}
      </li>`;
}

/**
 * Compact: a small card for lists and grids. The name, one measured size chip led by the brick's
 * colour dot (its cue at rest and on touch) and the status sticker, smaller. The kernel: wide, a
 * KERNEL sticker, a double hard shadow, its bytes against its budget in the chip.
 */
export function brickCompact({ brick, size, href, h = "h3", extra = "" }) {
  const kernel = brick.id === "kernel";
  const chip = kernel ? `<b data-size="${esc(size.name)}">${num(size.gzip)} B</b> of ${num(size.budget)} B gzip` : `<b>${kb(size.gzip)} KB</b> gzip`;
  return `<li class="panel ${cls(brick, "compact")}" data-brick="${brick.id}" data-flag="${brick.status}" style="${tone(brick)}">
        ${head(brick)}
        <${h} class="brick-name"><a href="${esc(href)}">${nameParts(brick.name)}</a></${h}>
        <ul class="brick-chips" aria-label="Measured on this build"><li><i class="brick-dot" aria-hidden="true"></i>${chip}</li>${extra}</ul>
      </li>`;
}

/**
 * Mini: an inline chip (at most 28 px tall) for prose, imports and "needs" lists: the brick's symbol
 * in its colour, its name (shown on hover and focus; always its accessible name), its measured size
 * and a status dot (its label for screen readers and on hover).
 * Without `size` (a planned brick's needs before it ships) it shows the name only.
 */
export function brickMini({ brick, size, href }) {
  const s = STATUS[brick.status];
  return `<a class="${cls(brick, "mini")}" data-flag="${brick.status}" style="${tone(brick)}" href="${esc(href)}" title="${esc(`${brick.name}: ${s.label}`)}">${elSquare(brick, "chip")}<code class="sym-name">${esc(brick.name)}</code>${size ? `<b>${kb(size.gzip)} KB</b>` : ""}<i class="brick-flag" data-flag="${brick.status}"><span class="sr">${s.label}</span></i></a>`;
}

/** A site/bricks.mjs row by its module name ("@fzlt/core/fx", "@fzlt/core" for the kernel), or undefined. */
export const brickOf = (bricks, name) => bricks.find((b) => b.modules.some((m) => m.name === name));
