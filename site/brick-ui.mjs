// The brick component: one brick, in three sizes, from this one module and one CSS block
// (site/site.css "Brick component"). Every size follows the same rules: no top bar; the neutral
// card border and hard shadow at rest, the brick's colour (--tone) on hover and focus; the status as
// a tilted sticker (a tiny dot in mini); a distinct kernel variant. Numbers come from the build
// (`size`: a scripts/sizes.mjs entry), never typed in.
//
//   full     brickTile({ brick, size, href, toy })   the bricks index: name, what it does, live toy,
//                                                    stat chips, budget bar
//   compact  brickCompact({ brick, size, href })     lists and grids (the home page): name, one size
//                                                    chip with the colour dot, a smaller sticker
//   mini     brickMini({ brick, size, href })        inline chip (≤ 28 px): colour dot, name, size,
//                                                    a status dot
//   brickOf(bricks, name) finds a site/bricks.mjs row by module name (for mini chips from imports).
import { esc } from "./layout.mjs";
import { STATUS } from "./bricks.mjs";

const kb = (bytes) => (bytes / 1024).toFixed(1);
const num = (n) => n.toLocaleString("en-US");

/** `code` spans in doc text, everything else escaped. */
export const prose = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

/**
 * A brick's status flag as a tilted sticker (the people and gallery cards' sticker): it sits on the
 * card's corner, never in the title, so it never competes with the brick's name.
 */
export const statusSticker = (status) => `<span class="brick-sticker" data-flag="${status}" title="${esc(STATUS[status].line)}">${STATUS[status].label}</span>`;

const stickers = (brick) => `<span class="brick-stickers">${brick.id === "kernel" ? '<span class="brick-sticker brick-sticker-kernel">KERNEL</span>' : ""}${statusSticker(brick.status)}</span>`;

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
  return `<li class="panel ${cls(brick, "full")}" data-flag="${brick.status}" style="${tone(brick)}">
        ${stickers(brick)}
        <${h} class="brick-name"><a href="${esc(href)}">${esc(brick.name)}</a></${h}>
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
  return `<li class="panel ${cls(brick, "compact")}" data-flag="${brick.status}" style="${tone(brick)}">
        ${stickers(brick)}
        <${h} class="brick-name"><a href="${esc(href)}">${esc(brick.name)}</a></${h}>
        <ul class="brick-chips" aria-label="Measured on this build"><li><i class="brick-dot" aria-hidden="true"></i>${chip}</li>${extra}</ul>
      </li>`;
}

/**
 * Mini: an inline chip (at most 28 px tall) for prose, imports and "needs" lists: the brick's colour
 * dot, its name, its measured size and a status dot (its label for screen readers and on hover).
 * Without `size` (a planned brick's needs before it ships) it shows the name only.
 */
export function brickMini({ brick, size, href }) {
  const s = STATUS[brick.status];
  return `<a class="${cls(brick, "mini")}" data-flag="${brick.status}" style="${tone(brick)}" href="${esc(href)}" title="${esc(`${brick.name}: ${s.label}`)}"><i class="brick-dot" aria-hidden="true"></i><code>${esc(brick.name)}</code>${size ? `<b>${kb(size.gzip)} KB</b>` : ""}<i class="brick-flag" data-flag="${brick.status}"><span class="sr">${s.label}</span></i></a>`;
}

/** A site/bricks.mjs row by its module name ("@fzlt/core/fx", "@fzlt/core" for the kernel), or undefined. */
export const brickOf = (bricks, name) => bricks.find((b) => b.modules.some((m) => m.name === name));
