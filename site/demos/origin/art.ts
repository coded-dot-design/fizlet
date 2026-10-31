/**
 * The origin scene's art: one SVG, seen from above, in the 2015 palette (teal desk, ink, cream, the
 * red accents). A desk under a window: the lamp, a sketchbook, the coffee (Chris's 2015 cup sheet,
 * coffee.png), the laptop, the phone, the headphones, and him. Pure strings and numbers: the scene
 * builds it once at mount; the build renders the same markup as the poster (a still of the day).
 * Pose numbers (0..1): aw awake (head up), ph headphones on, lid laptop open, hd hands on the keys,
 * sip the cup at his mouth. Every moving part is placed by the functions below, so the poster and the
 * scene put it in the same spot.
 */
export const C = { teal: "#65b9ad", tealD: "#4f9e93", tealL: "#8fd0c5", ink: "#43353d", inkL: "#5d4c56", cream: "#f3eed5", creamD: "#e2dbbf", red: "#e15e49", redD: "#b9432f", skin: "#e8b48f", skinD: "#d39a74", sun: "#f8d78b", code: "#2e2a3a" };

/** The scene's styles (the poster carries them too). Lighting is custom properties on .og. */
export const CSS = `.og{position:absolute;inset:0;overflow:hidden;background:${C.teal};--sky:rgb(29,27,52);--night:.62;--lamp:0;--sun:0;--beam:0;--glow:0;font:600 10.5px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;-webkit-tap-highlight-color:transparent;user-select:none}
.og-l{position:absolute;inset:0}.og-svg,.og canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.og canvas{pointer-events:none;filter:brightness(calc(1 - var(--night) * .8))}
.og-night{opacity:var(--night);mix-blend-mode:multiply;pointer-events:none}
.og-lampg{opacity:var(--lamp);mix-blend-mode:screen;pointer-events:none}
.og-scrg{opacity:calc(var(--night) * var(--glow) * 1.3);mix-blend-mode:screen;pointer-events:none}
.og-scrl{opacity:calc(var(--night) * var(--glow) * .3);mix-blend-mode:screen;pointer-events:none}
.og-beam{opacity:calc(var(--beam) * .2);transform:translateX(calc((.5 - var(--sun)) * 240px));pointer-events:none}
.og-sun{transform:translate(calc(40px + var(--sun) * 720px),calc(74px - sin(var(--sun) * 180deg) * 54px))}
.og-stars,.og-lit,.og-moon{opacity:calc(var(--night) * 1.6)}.og-sun{opacity:calc(1 - var(--night) * 1.6)}
.og-bulb{opacity:calc(.35 + var(--lamp) * .65)}
.og-tag{opacity:0;transition:opacity .2s;pointer-events:none}.og-tag text{font:inherit}
.og--tags .og-tag${["laptop", "phone", "cup", "phones", "lamp", "sky", "person"].map((p) => `,.og:has([data-p=${p}]:hover) [data-t=${p}]`).join("")}{opacity:1}
[data-p=laptop],[data-p=phone],[data-p=cup],[data-p=phones],[data-p=person]{cursor:pointer}.og-body{outline:none}.og-body:focus-visible .og-head>circle:nth-child(3){stroke:#2f80ed;stroke-width:4}
.og-laptop{outline:none}.og-laptop:focus-visible>rect:nth-child(2){stroke:#2f80ed;stroke-width:4}
.og--reduce .og-night,.og--reduce .og-lampg,.og--reduce .og-scrg{transition:opacity 1.6s}
.og-bar{position:absolute;right:10px;bottom:10px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;z-index:2}
.og-bar button{all:unset;box-sizing:border-box;font:inherit;font-size:11px;letter-spacing:.03em;padding:7px 11px;border-radius:999px;border:1.5px solid ${C.ink};background:${C.cream};color:${C.ink};cursor:pointer}
.og-bar button[aria-pressed=true]{background:${C.ink};color:${C.cream}}
.og-bar button:focus-visible{outline:2px solid #2f80ed;outline-offset:2px}.og-bar button:hover{border-color:${C.red}}
.og-why{position:absolute;left:12px;top:10px;z-index:2;margin:0;max-width:min(64%,460px);padding:7px 11px;border-radius:8px;background:rgba(29,27,52,.72);color:${C.cream};font:500 12px/1.45 ui-sans-serif,system-ui,sans-serif;letter-spacing:.01em;transition:opacity .5s}
.og-why b{color:${C.sun};font-weight:700;margin-right:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.08em}
.og-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:520px){.og-bar button{font-size:10px;padding:6px 8px}.og-why{font-size:11px;max-width:calc(100% - 24px)}}`;

/** The "why" caption: real text. The whole line for screen readers (and as the still); `beat`
 *  (one sentence) is what shows while the day plays. */
export const why = (full: string, beat: string, step: string) =>
  `<p class="og-why"><span class="og-vh">${full}</span><span aria-hidden="true"><b>${step}</b><span class="og-beat">${beat}</span></span></p>`;


/** The viewBox the art is drawn in; the scene crops it to the stage's shape around the middle. */
export const VB = { w: 800, h: 500 };
/** The parts a tap or a label points at: x, y, w, h in art units. */
export const BOX = {
  laptop: [286, 124, 228, 262],
  phone: [566, 236, 82, 140],
  cup: [196, 268, 78, 78],
  phones: [540, 120, 130, 90],
  lamp: [50, 120, 110, 110],
  sky: [0, -200, 800, 296],
  person: [300, 340, 200, 260],
} as const;

const SH = { lx: 322, rx: 478, y: 492 };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Head centre and tilt for a pose. Asleep, the head is forward on his folded arms, tipped. */
export function head(aw: number, sip: number) {
  return { x: 400, y: mix(416, 446, aw) - sip * 6, a: mix(-12, 0, aw) };
}
export const headT = (aw: number, sip: number, bob = 0) => {
  const h = head(aw, sip);
  return `translate(${r1(h.x)} ${r1(h.y + bob)}) rotate(${r1(h.a)})`;
};
/** The upper back and neck: the shirt from the shoulders up under the head, so head and body read
 *  as one at every pose (asleep the head leans forward onto the arms; the back follows it). */
export function neck(aw: number, sip: number) {
  const h = head(aw, sip), top = h.y + 8;
  return { cx: 400, cy: r1((top + 500) / 2), ry: r1((500 - top) / 2 + 14) };
}
/** Hand positions: asleep folded under the head; awake on the keys (hd) or resting by the laptop. */
export function hands(aw: number, hd: number, sip: number, tl: number, tr: number) {
  const lx = mix(mix(434, 352, aw), 350, hd), ly = mix(mix(412, 410, aw), 336, hd) + tl;
  const rx = mix(mix(368, 452, aw), 448, hd), ry = mix(mix(418, 410, aw), 336, hd) + tr;
  // The sip: the left hand brings the cup to his mouth.
  return { lx: mix(lx, 360, sip), ly: mix(ly, 404, sip), rx, ry };
}
/** The cup: on its saucer by the laptop, or in his hand at his mouth. */
export const cupT = (sip: number) => `translate(${r1(mix(196, 324, sip))} ${r1(mix(268, 366, sip))}) rotate(${r1(sip * -18)} 39 39) translate(39 39) scale(${r1(100 + sip * 9) / 100}) translate(-39 -39)`;
/** The coffee's surface in each frame of the 2015 sheet (cx, cy, rx, ry in its 84 px frame), measured
 *  from coffee.png: the scene paints its own liquid over it, so the colour can cool. */
export const LIQUID = [[0, 0, 0, 0], [42, 48.5, 2.6, 2.1], [42, 49, 3.6, 3.6], [42, 49, 5.6, 4.6], [42, 48.5, 6.6, 6.1], [42, 48.5, 7.6, 7.1], [42, 49, 11.6, 10.6], [42, 49, 12.6, 11.6], [42, 48.5, 16.6, 15.1], [42, 47, 18.6, 16.6], [42, 45, 20.6, 18.6], [42, 43.5, 22.6, 20.1]];
/** Coffee (code) or matcha (design), hot (h = 1) to cooled (h = 0). */
export function brew(design: boolean, h: number) {
  const a = design ? [47, 125, 109] : [70, 40, 30], b = design ? [150, 205, 185] : [182, 134, 100];
  return `rgb(${Math.round(mix(b[0]!, a[0]!, h))},${Math.round(mix(b[1]!, a[1]!, h))},${Math.round(mix(b[2]!, a[2]!, h))})`;
}
const SAUCER = `<circle cx="43" cy="44.5" r="40" fill="${"#d9d1b3"}"/><circle cx="42" cy="42.5" r="40" fill="#f3eed5"/><circle cx="42" cy="43" r="30" fill="none" stroke="#e6dfc4" stroke-width="2"/>`;
/** The headphones: on the desk by the phone, or on his head (they ride the head's tilt). */
export function phonesT(ph: number, aw: number, sip: number, bob = 0) {
  const h = head(aw, sip), e = ph * ph * (3 - 2 * ph), lift = Math.sin(e * Math.PI) * 26;
  return `translate(${r1(mix(604, h.x, e))} ${r1(mix(170, h.y + 2 + bob, e) - lift)}) rotate(${r1(mix(-14, h.a, e))}) scale(${r1(mix(0.92, 1.04, e) * 100) / 100})`;
}
/** The cord from the right earcup to the phone's jack (a soft curve). */
export function cord(ph: number, aw: number, sip: number) {
  const h = head(aw, sip), e = ph * ph * (3 - 2 * ph);
  const x = mix(604 + 46, h.x + 52, e), y = mix(170 + 4, h.y + 8, e);
  return `M${r1(x)} ${r1(y)}C${r1(x + 40)} ${r1(y + 40)} ${r1(616)} ${r1(390)} 607 372`;
}
/** The laptop lid: above 0.5 the screen unfolds up from the hinge; below, the lid covers the keys. */
export const screenT = (lid: number) => `translate(0 250) scale(1 ${r1(Math.max(0, lid * 2 - 1) * 100) / 100}) translate(0 -250)`;
export const coverT = (lid: number) => `translate(0 250) scale(1 ${r1(Math.max(0, 1 - lid * 2) * 100) / 100}) translate(0 -250)`;

// ---------- static parts ----------
const keys = () => {
  let s = "";
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 12; c++) {
      const wide = r === 4 && c > 3 && c < 8;
      if (r === 4 && c > 4 && c < 8) continue;
      s += `<rect x="${302 + c * 16.4}" y="${262 + r * 15}" width="${wide ? 16.4 * 4 - 3 : 13}" height="11" rx="2"/>`;
    }
  return s;
};
// Code: two identical pages of lines (scrolled as one strip, wrapping), in 2015's syntax colours.
const CODE = [[0, 40, 1], [12, 60, 2], [12, 30, 0], [24, 52, 3], [24, 70, 1], [12, 22, 0], [0, 14, 2], [0, 0, 0], [0, 48, 1], [12, 34, 3], [24, 64, 2], [24, 40, 0], [36, 30, 1], [24, 18, 0], [12, 26, 3], [0, 14, 2]];
const INK = [C.tealL, C.red, C.cream, C.sun];
const codePage = (y0: number) => CODE.map(([x, w, c], i) => (w ? `<rect x="${316 + x!}" y="${y0 + i * 7}" width="${w! * 1.7}" height="3.4" rx="1.7" fill="${INK[c!]}"/>` : "")).join("");
// The phone's code: a short terminal.
const PHONE_CODE = [[0, 30, 2], [6, 22, 0], [6, 34, 1], [0, 16, 3], [0, 28, 0], [6, 20, 2]].map(([x, w, c], i) => `<rect x="${-23 + x!}" y="${4 + i * 7}" width="${w}" height="3" rx="1.5" fill="${INK[c!]}"/>`).join("");

/** The whole scene as SVG markup. `p`: the pose to draw (the scene then moves it); `mode`: what
 *  the screens show first; `cup`: the coffee sheet's URL. */
export function art(p: { aw: number; ph: number; lid: number; hd: number }, mode: "code" | "design", cup: string, sizes: Record<string, number> = {}, id = "og-") {
  const tag = (id: string, x: number, y: number, bricks: string[], what: string) => {
    const a = bricks.map((b) => `${b === "kernel" ? "kernel" : "@fzlt/core/" + b}${sizes[b] ? ` ${sizes[b]!.toLocaleString("en-US")} B` : ""}`).join(" + "), w = Math.max(a.length, what.length) * 6.3 + 16;
    return `<g class="og-tag" data-t="${id}" transform="translate(${x} ${y})"><rect width="${r1(w)}" height="34" rx="5" fill="${C.ink}" stroke="${C.cream}" stroke-width="1"/><text x="8" y="14" fill="${C.cream}">${a}</text><text x="8" y="27" fill="${C.tealL}">${what}</text></g>`;
  };
  const hnd = hands(p.aw, p.hd, 0, 0, 0), hp = head(p.aw, 0);
  const design = mode === "design";
  return `<svg class="og-svg" viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid slice" role="group" aria-label="A desk seen from above: he sleeps at night, wakes with the sun, puts the headphones on, drinks his coffee and codes all day">
<defs>
<radialGradient id="${id}lampg"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".9"/><stop offset=".55" stop-color="#ffcf7a" stop-opacity=".35"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}scrg"><stop offset="0" stop-color="#bff3ea" stop-opacity=".75"/><stop offset="1" stop-color="#8fd0c5" stop-opacity="0"/></radialGradient>
<clipPath id="${id}dsp"><rect x="304" y="140" width="192" height="100"/></clipPath>
<clipPath id="${id}psc"><rect x="-26" y="-44" width="52" height="86" rx="3"/></clipPath>
</defs>
<g class="og-sky" data-p="sky">
<rect x="-300" y="-300" width="1400" height="396" fill="var(--sky)"/>
<g class="og-stars" fill="${C.cream}"><circle cx="90" cy="26" r="1.6"/><circle cx="180" cy="58" r="1.2"/><circle cx="330" cy="20" r="1.4"/><circle cx="470" cy="46" r="1.2"/><circle cx="560" cy="16" r="1.6"/><circle cx="720" cy="40" r="1.3"/><circle cx="30" cy="66" r="1.1"/><circle cx="770" cy="70" r="1.2"/></g>
<circle class="og-moon" cx="660" cy="36" r="15" fill="${C.cream}"/><circle class="og-moon" cx="667" cy="31" r="13" fill="var(--sky)"/>
<circle class="og-sun" cx="0" cy="0" r="18" fill="${C.sun}"/>
<path fill="${C.ink}" opacity=".55" d="M-300 96V64h330v-22h44v30h60V50h36v46h90V58h52v38h70V40h30v-8h20v64h90V60h56v36h54V48h40v48h90V66h54V96Z"/>
<g class="og-lit" fill="${C.sun}"><rect x="40" y="52" width="4" height="5"/><rect x="230" y="64" width="4" height="5"/><rect x="138" y="58" width="4" height="5"/><rect x="404" y="70" width="4" height="5"/><rect x="560" y="48" width="4" height="5"/><rect x="700" y="74" width="4" height="5"/><rect x="608" y="62" width="4" height="5"/></g>
<rect x="-300" y="88" width="1400" height="14" fill="${C.cream}"/><rect x="263" y="-300" width="10" height="390" fill="${C.cream}"/><rect x="527" y="-300" width="10" height="390" fill="${C.cream}"/>
</g>
<rect x="-300" y="102" width="1400" height="700" fill="${C.teal}"/>
<rect x="-300" y="102" width="1400" height="10" fill="${C.tealD}" opacity=".6"/>
<path class="og-beam" fill="${C.cream}" d="M150 102h230l120 400H270Z"/>
<g data-p="lamp"><circle cx="104" cy="176" r="34" fill="${C.ink}" opacity=".18"/><circle cx="100" cy="172" r="32" fill="${C.cream}"/><path d="M100 172L132 214" stroke="${C.inkL}" stroke-width="6" stroke-linecap="round"/><circle cx="136" cy="218" r="22" fill="${C.red}"/><circle cx="136" cy="218" r="12" class="og-bulb" fill="${C.cream}"/></g>
<g transform="rotate(-9 128 380)"><rect x="70" y="320" width="118" height="132" rx="4" fill="${C.cream}"/><rect x="70" y="320" width="12" height="132" fill="${C.creamD}"/><path d="M96 354h70M96 372h56M96 390h64" stroke="${C.creamD}" stroke-width="3" stroke-linecap="round"/><circle cx="148" cy="420" r="16" fill="none" stroke="${C.red}" stroke-width="3"/><rect x="176" y="340" width="7" height="92" rx="2" fill="${C.red}" transform="rotate(12 180 386)"/></g>
<g transform="translate(724 210)"><circle r="30" fill="${C.cream}"/><ellipse rx="34" ry="13" fill="#3f8f6f" transform="rotate(30)"/><ellipse rx="34" ry="13" fill="#4ea27d" transform="rotate(-40)"/><ellipse rx="30" ry="11" fill="#5fb48c" transform="rotate(95)"/><circle r="6" fill="#3f8f6f"/></g>
<svg class="og-saucer" x="196" y="268" width="78" height="78" viewBox="0 0 84 84" overflow="visible">${SAUCER}</svg>
<g data-p="laptop" class="og-laptop" tabindex="0" role="button" aria-label="Close the laptop">
<rect x="290" y="252" width="224" height="134" rx="10" fill="${C.ink}" opacity=".16"/>
<rect x="286" y="248" width="228" height="134" rx="10" fill="${C.cream}"/>
<g fill="${C.creamD}">${keys()}</g><rect x="366" y="344" width="68" height="30" rx="5" fill="${C.creamD}"/>
<g class="og-cover" transform="${coverT(p.lid)}"><rect x="286" y="248" width="228" height="134" rx="10" fill="#cfc8b2"/><circle cx="400" cy="315" r="9" fill="${C.cream}"/></g>
<g class="og-screen" transform="${screenT(p.lid)}">
<rect x="292" y="128" width="216" height="122" rx="9" fill="${C.ink}"/>
<rect x="304" y="140" width="192" height="100" fill="${C.code}"/>
<g clip-path="url(#${id}dsp)">
<g class="og-code" ${design ? 'style="display:none"' : ""}><rect x="304" y="140" width="192" height="12" fill="${C.ink}"/><circle cx="312" cy="146" r="2.4" fill="${C.red}"/><circle cx="320" cy="146" r="2.4" fill="${C.sun}"/><circle cx="328" cy="146" r="2.4" fill="${C.tealL}"/><g class="og-scroll">${codePage(158)}${codePage(158 + CODE.length * 7)}</g><rect class="og-caret" x="316" y="230" width="5" height="6" fill="${C.cream}"/></g>
<g class="og-des" ${design ? "" : 'style="display:none"'}><rect x="304" y="140" width="192" height="100" fill="#efe9d6"/><g fill="${C.red}" opacity=".12">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${330 + i * 24}" y="146" width="18" height="88"/>`).join("")}</g><rect x="330" y="150" width="138" height="34" rx="3" fill="${C.teal}"/><rect x="338" y="160" width="60" height="5" rx="2.5" fill="${C.cream}"/><rect x="338" y="170" width="38" height="4" rx="2" fill="${C.cream}" opacity=".7"/><circle class="og-shape" cx="444" cy="167" r="10" fill="${C.sun}"/><rect x="330" y="192" width="42" height="34" rx="3" fill="${C.red}"/><rect x="378" y="192" width="42" height="34" rx="3" fill="${C.ink}"/><rect x="426" y="192" width="42" height="34" rx="3" fill="${C.tealD}"/><rect class="og-sel" x="374" y="188" width="50" height="42" fill="none" stroke="#2f80ed" stroke-width="1.4"/><path class="og-arrow" d="M0 0v12l3.4-3 2.4 5.4 2-1-2.4-5.2h4.6Z" fill="${C.ink}" stroke="${C.cream}" stroke-width=".8"/></g>
</g>
<circle cx="400" cy="134" r="1.8" fill="${C.inkL}"/>
</g>
</g>
<path class="og-cord" d="${cord(p.ph, p.aw, 0)}" fill="none" stroke="${C.red}" stroke-width="3" stroke-linecap="round"/>
<g data-p="phone" transform="translate(607 306) rotate(8)">
<rect x="-31" y="-58" width="66" height="122" rx="10" fill="${C.ink}" opacity=".18"/>
<rect x="-34" y="-62" width="68" height="124" rx="10" fill="${C.cream}"/>
<rect x="-26" y="-44" width="52" height="86" rx="3" class="og-pscr" fill="${C.code}"/>
<g clip-path="url(#${id}psc)">
<image class="og-pix" x="-15" y="-42" width="30" height="30" style="image-rendering:pixelated"/>
<g class="og-code" transform="translate(0 -8)" ${design ? 'style="display:none"' : ""}>${PHONE_CODE}</g>
<g class="og-des" transform="translate(0 -8)" ${design ? "" : 'style="display:none"'}>${[C.teal, C.red, C.sun, C.ink, C.cream].map((c, i) => `<rect x="${-22 + (i % 3) * 15}" y="${6 + (i / 3 | 0) * 15}" width="12" height="12" rx="2" fill="${c}"/>`).join("")}<circle cx="16" cy="27" r="6" fill="none" stroke="${C.cream}" stroke-width="1.4"/></g>
</g>
<rect x="-8" y="-54" width="16" height="3" rx="1.5" fill="${C.creamD}"/><circle cy="52" r="5" fill="${C.creamD}"/>
</g>
<g data-p="cup" class="og-cup" transform="${cupT(0)}"><svg width="78" height="78" viewBox="0 0 84 84" overflow="visible"><clipPath id="${id}cupc"><circle cx="42" cy="43.5" r="27.6"/><rect x="3.5" y="35.5" width="20" height="13" rx="6.5"/></clipPath><g clip-path="url(#${id}cupc)"><image class="og-cupimg" href="${cup}" x="${-11 * 84}" y="${design ? -84 : 0}" width="1008" height="168"/></g><ellipse class="og-liquid" cx="42" cy="43.5" rx="22.6" ry="20.1" fill="${brew(design, 0.8)}"/></svg></g>
<g class="og-body" data-p="person" tabindex="0" role="button" aria-label="Nudge him">
<ellipse cx="400" cy="560" rx="132" ry="78" fill="${C.ink}" opacity=".16"/>
<ellipse cx="400" cy="548" rx="128" ry="72" fill="${C.red}"/>
<ellipse class="og-neck" cx="400" cy="${neck(p.aw, 0).cy}" rx="62" ry="${neck(p.aw, 0).ry}" fill="${C.red}"/><ellipse class="og-nape" cx="400" cy="${neck(p.aw, 0).cy - neck(p.aw, 0).ry + 30}" rx="20" ry="16" fill="${C.skinD}"/>
<path d="M366 486q34 22 68 0" fill="none" stroke="${C.redD}" stroke-width="5" stroke-linecap="round"/>
<line class="og-arm-l" x1="${SH.lx}" y1="${SH.y}" x2="${hnd.lx}" y2="${hnd.ly}" stroke="${C.red}" stroke-width="34" stroke-linecap="round"/>
<line class="og-arm-r" x1="${SH.rx}" y1="${SH.y}" x2="${hnd.rx}" y2="${hnd.ry}" stroke="${C.red}" stroke-width="34" stroke-linecap="round"/>
<circle class="og-hand-l" cx="${hnd.lx}" cy="${hnd.ly}" r="14" fill="${C.skin}"/>
<circle class="og-hand-r" cx="${hnd.rx}" cy="${hnd.ry}" r="14" fill="${C.skin}"/>
<g class="og-head" transform="${headT(p.aw, 0)}"><circle cx="-41" cy="4" r="10" fill="${C.skinD}"/><circle cx="41" cy="4" r="10" fill="${C.skinD}"/><circle r="44" fill="${C.ink}"/><path d="M-30-22q22-20 52-6" fill="none" stroke="${C.inkL}" stroke-width="7" stroke-linecap="round"/><path d="M-8-40q4 26-2 50" fill="none" stroke="#382c33" stroke-width="3" stroke-linecap="round"/></g>
</g>
<g data-p="phones" class="og-phones" transform="${phonesT(p.ph, p.aw, 0)}"><path d="M-50 4a50 50 0 0 1 100 0" fill="none" stroke="#c9bf9f" stroke-width="14" stroke-linecap="round"/><path d="M-50 4a50 50 0 0 1 100 0" fill="none" stroke="${C.cream}" stroke-width="7" stroke-linecap="round"/><rect x="-62" y="-18" width="22" height="44" rx="9" fill="${C.red}"/><rect x="40" y="-18" width="22" height="44" rx="9" fill="${C.red}"/><rect x="-58" y="-12" width="8" height="32" rx="4" fill="${C.cream}"/><rect x="50" y="-12" width="8" height="32" rx="4" fill="${C.cream}"/></g>
<rect class="og-night" x="-300" y="-300" width="1400" height="1100" fill="#1d1a3c"/>
<circle class="og-lampg" cx="150" cy="250" r="230" fill="url(#${id}lampg)"/>
<ellipse class="og-scrg" cx="400" cy="250" rx="170" ry="140" fill="url(#${id}scrg)"/>
<rect class="og-scrl" x="304" y="140" width="192" height="100" fill="#bff3ea" transform="${screenT(p.lid)}"/>
<g class="og-tags" aria-hidden="true">${tag("sky", 290, 108, ["timeline"], "the day and night cycle")}${tag("person", 300, 452, ["timeline"], "wake, sip, sleep")}${tag("phones", 476, 100, ["fx", "sound"], "notes and the beat")}${tag("cup", 120, 352, ["fx", "sound"], "steam and the sip")}${tag("laptop", 304, 196, ["input", "fx"], "the lid, keys, code sparks")}${tag("phone", 520, 384, ["sprite"], "the pixel coder")}${tag("lamp", 40, 250, ["kernel"], "one loop, settle, Recall")}</g>
</svg>`;
}

