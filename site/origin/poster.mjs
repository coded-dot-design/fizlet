// The Origin poster: the 2015 desk at night (headphones, coffee, laptop, phone), flat shapes in the
// Board UI tokens (classes, styled in site.css's ORIGIN block). It is the figure's first paint, the
// still frame for reduced motion, and what the placeholder scene clones and moves. The composition
// keeps every prop inside x 225..975 so the square phone crop (slice) keeps all four.
// The laptop screen holds both modes; [data-mode] on the figure shows one (CSS, no script needed).

const r = (x, y, w, h, c, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ""} class="${c}"/>`;

// The code mode: indented lines in the token colours (widths fixed, so the poster is deterministic).
const LINES = [[0, 120, "f-cmd"], [0, 70, "f-sys"], [22, 150, "f-go"], [22, 96, "f-aim"], [44, 128, "f-sys"], [22, 60, "f-cmd"], [0, 34, "f-sys"]];
const code = LINES.map(([dx, w, c], i) => r(488 + dx, 318 + i * 22, w, 10, `${c} og-ln`, 3)).join("");
// The design mode: a frame, a circle, a pen curve with its handles.
const design =
  `${r(488, 318, 120, 86, "og-wire", 4)}<circle cx="676" cy="360" r="40" class="f-attack"/>` +
  `<path d="M496 452 C540 404 600 486 652 430" class="og-pen"/><path d="M540 404 L496 452 M600 486 L652 430" class="og-handle"/>` +
  `${r(491, 449, 8, 8, "f-flag")}${r(648, 426, 8, 8, "f-flag")}`;
const stars = [[160, 110], [205, 150], [250, 96], [180, 200], [292, 180], [370, 230], [140, 260]].map(([x, y], i) => r(x, y, i % 3 ? 3 : 5, i % 3 ? 3 : 5, "f-flag og-star")).join("");
const steam = [800, 824, 848].map((x, i) => `<path d="M${x} ${436 - i * 6} c-14 -20 14 -36 0 -56 s14 -36 0 -56" class="og-steam" opacity=".55"/>`).join("");

/** The poster SVG (the slot's placeholder). */
export const poster = () =>
  `<svg class="ae-slot__placeholder og-poster" viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
  // window, moon, stars
  `<g class="og-win">${r(120, 70, 300, 250, "og-frame", 8)}<path d="M270 70 V320 M120 195 H420" class="og-mull"/>` +
  `<circle cx="346" cy="132" r="32" class="f-flag"/><circle cx="360" cy="122" r="28" class="og-night"/>${stars}</g>` +
  // the glow of the screen on the wall and the desk
  `<ellipse cx="600" cy="420" rx="330" ry="210" class="og-glow"/>` +
  // desk
  `${r(0, 560, 1200, 190, "og-desk")}${r(0, 556, 1200, 6, "f-cmd")}` +
  // headphones: band, cups, cable to the phone
  `<g class="og-phones"><path d="M262 520 C262 396 412 396 412 520" class="og-band"/>${r(240, 488, 44, 72, "f-attack", 14)}${r(390, 488, 44, 72, "f-attack", 14)}` +
  `${r(250, 500, 10, 48, "og-cup", 4)}${r(414, 500, 10, 48, "og-cup", 4)}<path d="M434 540 C520 610 820 620 930 552" class="og-cable"/></g>` +
  // notes the scene floats up from the cups (hidden on the poster)
  `<g class="og-notes"><text x="300" y="420" class="og-note" opacity="0">♪</text><text x="360" y="410" class="og-note" opacity="0">♫</text></g>` +
  // laptop: lid, screen, both modes, cursor, base
  `<g class="og-laptop">${r(456, 286, 312, 216, "og-lid", 12)}${r(472, 302, 280, 184, "og-screen", 4)}` +
  `<g class="og-code">${code}</g><g class="og-design">${design}</g>${r(528, 450, 10, 16, "f-go og-cursor")}` +
  `<path d="M420 502 H804 L838 552 H386 Z" class="og-base"/>${r(568, 526, 88, 10, "og-pad", 3)}</g>` +
  // coffee: steam, mug, coffee, handle
  `<g class="og-mug">${steam}<path d="M854 474 h16 a22 22 0 0 1 0 44 h-16" class="og-handle-mug"/>${r(780, 452, 76, 104, "f-advance", 10)}${r(788, 460, 60, 10, "og-coffee", 3)}${r(780, 520, 76, 8, "og-stripe")}</g>` +
  // phone, propped, with its play key
  `<g class="og-phone">${r(902, 424, 60, 128, "og-lid", 10)}${r(908, 436, 48, 100, "og-screen", 4)}<path d="M923 472 l20 14 -20 14z" class="f-go"/></g>` +
  `</svg>`;
