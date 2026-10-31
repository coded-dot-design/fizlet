// The Origin poster: the 2015 desk at night (headphones, coffee, laptop, phone), flat shapes in the
// Board UI tokens (classes, styled in site.css's ORIGIN block). It is the figure's first paint, the
// still frame for reduced motion, and what the placeholder scene clones and moves. The composition
// keeps every prop inside x 225..975 so the square phone crop (slice) keeps all four.
// The laptop screen holds both modes; [data-mode] on the figure shows one (CSS, no script needed).

const r = (x, y, w, h, c, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ""} class="${c}"/>`;

// The code mode: indented lines in the token colours (widths fixed, so the poster is deterministic).
const LINES = [[0, 120, "f-cmd"], [0, 70, "f-sys"], [22, 150, "f-go"], [22, 96, "f-aim"], [44, 128, "f-sys"], [22, 60, "f-cmd"], [0, 34, "f-sys"]];
const code = LINES.map(([dx, w, c], i) => r(488 + dx, 318 + i * 22, w, 10, `${c} ogs-ln`, 3)).join("");
// The design mode: a frame, a circle, a pen curve with its handles.
const design =
  `${r(488, 318, 120, 86, "ogs-wire", 4)}<circle cx="676" cy="360" r="40" class="f-attack"/>` +
  `<path d="M496 452 C540 404 600 486 652 430" class="ogs-pen"/><path d="M540 404 L496 452 M600 486 L652 430" class="ogs-handle"/>` +
  `${r(491, 449, 8, 8, "f-flag")}${r(648, 426, 8, 8, "f-flag")}`;
const stars = [[160, 110], [205, 150], [250, 96], [180, 200], [292, 180], [370, 230], [140, 260]].map(([x, y], i) => r(x, y, i % 3 ? 3 : 5, i % 3 ? 3 : 5, "f-flag ogs-star")).join("");
const steam = [800, 824, 848].map((x, i) => `<path d="M${x} ${436 - i * 6} c-14 -20 14 -36 0 -56 s14 -36 0 -56" class="ogs-steam" opacity=".55"/>`).join("");

/** The poster SVG (the slot's placeholder). */
export const poster = () =>
  `<svg class="ae-slot__placeholder ogs-poster" viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
  // window, moon, stars
  `<g class="ogs-win">${r(120, 70, 300, 250, "ogs-frame", 8)}<path d="M270 70 V320 M120 195 H420" class="ogs-mull"/>` +
  `<circle cx="346" cy="132" r="32" class="f-flag"/><circle cx="360" cy="122" r="28" class="ogs-night"/>${stars}</g>` +
  // the glow of the screen on the wall and the desk
  `<ellipse cx="600" cy="420" rx="330" ry="210" class="ogs-glow"/>` +
  // desk
  `${r(0, 560, 1200, 190, "ogs-desk")}${r(0, 556, 1200, 6, "f-cmd")}` +
  // headphones: band, cups, cable to the phone
  `<g class="ogs-phones"><path d="M262 520 C262 396 412 396 412 520" class="ogs-band"/>${r(240, 488, 44, 72, "f-attack", 14)}${r(390, 488, 44, 72, "f-attack", 14)}` +
  `${r(250, 500, 10, 48, "ogs-cup", 4)}${r(414, 500, 10, 48, "ogs-cup", 4)}<path d="M434 540 C520 610 820 620 930 552" class="ogs-cable"/></g>` +
  // notes the scene floats up from the cups (hidden on the poster)
  `<g class="ogs-notes"><text x="300" y="420" class="ogs-note" opacity="0">♪</text><text x="360" y="410" class="ogs-note" opacity="0">♫</text></g>` +
  // laptop: lid, screen, both modes, cursor, base
  `<g class="ogs-laptop">${r(456, 286, 312, 216, "ogs-lid", 12)}${r(472, 302, 280, 184, "ogs-screen", 4)}` +
  `<g class="ogs-code">${code}</g><g class="ogs-design">${design}</g>${r(528, 450, 10, 16, "f-go ogs-cursor")}` +
  `<path d="M420 502 H804 L838 552 H386 Z" class="ogs-base"/>${r(568, 526, 88, 10, "ogs-pad", 3)}</g>` +
  // coffee: steam, mug, coffee, handle
  `<g class="ogs-mug">${steam}<path d="M854 474 h16 a22 22 0 0 1 0 44 h-16" class="ogs-handle-mug"/>${r(780, 452, 76, 104, "f-advance", 10)}${r(788, 460, 60, 10, "ogs-coffee", 3)}${r(780, 520, 76, 8, "ogs-stripe")}</g>` +
  // phone, propped, with its play key
  `<g class="ogs-phone">${r(902, 424, 60, 128, "ogs-lid", 10)}${r(908, 436, 48, 100, "ogs-screen", 4)}<path d="M923 472 l20 14 -20 14z" class="f-go"/></g>` +
  `</svg>`;
