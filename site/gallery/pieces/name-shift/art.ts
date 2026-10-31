/**
 * The name shift (Fizlet → fzlt): the markup and styles, shared by the poster and the live scene.
 * Plain HTML + CSS, rendered at build time (scripts/site.mjs runs this in Node through esbuild).
 *
 * The story: two Board UI keys, FIZ and LET, drop onto the floor and read FIZLET. They ride into the
 * press; the ram comes down twice and the E is punched out of the top. Out come fiz + lt; the i
 * pops out and falls, and the pair closes up as fzlt. The press then builds: bricks come out of its
 * top and stack into a wall, and fzlt lands on top as the capstone. The lockup ends it: Fizlet™ · fzlt™.
 *
 * Every pose is a pure function of a few unitless progress properties on the root (`--a` … `--m`,
 * 0 → 1; `--r` the ram, `--sb` the press's "stack" screen). Their defaults are the end of the story,
 * so the markup alone is the final frame: the poster, and the still under reduced motion (the scene
 * never loads). The live scene (scene.ts) clones this markup and moves only those properties, with
 * @fzlt/core/timeline, through the engine's ledger. Geometry is in kit px of one design box (`--u`
 * is a kit px, from the frame's size: container queries), so the kit's own keys scale with it.
 * Two layouts: wide (the lockup over the floor) and square or tall (a bigger lockup, same floor).
 * The lockup's size is capped by the frame's width (room for the widest fallback fonts, so the
 * poster fits without script); the live scene measures it once and scales the head to fit (`--fit`).
 * Colours are the Board UI kit's tokens only, so the page's theme picks light or dark.
 */

/** The one caption line, under the lockup. */
export const CAPTION = "Fizlet goes in. fzlt comes out. Same bricks.";
/** What the figure says to a screen reader (the poster is an image of the final frame). */
export const LABEL = "The name shift: two keys, FIZ and LET, read FIZLET. They go into a press; the E and then the I drop out, and they come out as fzlt. The press stacks fzlt on top of a wall of bricks. Fizlet™ · fzlt™.";

/** The bricks the press stacks (real brick names, lowercase mono), their kit colour, centre x, top. */
const BRICKS: [string, string, number, number][] = [
  ["input", "sys", 477.5, 246], ["collide", "cmd", 570.5, 246], ["sprite", "fallin", 669, 246],
  ["timeline", "fire", 552, 202], ["fx", "attack", 634, 202],
];
/** Where a brick leaves the press (centre x, centre y): behind its top, so it rises out of it. */
const FROM = [326, 170];

const u = (n: number) => `calc(${n} * var(--u))`;
/** An arc from an offset (sx, sy) to the element's own place, peaking `h` above the line, on progress `k`. */
const arc = (k: string, sx: number, sy: number, h: number) =>
  `translate:calc((1 - var(${k})) * ${sx} * var(--u)) calc(((1 - var(${k})) * ${sy} - 4 * var(${k}) * (1 - var(${k})) * ${h}) * var(--u))`;
const show = (k: string) => `opacity:clamp(0, var(${k}) * 40, 1)`;

export const CSS = `.ns{--a:1;--b:1;--r:0;--e:1;--o:1;--j:1;--i:1;--f:1;--g:1;--k1:1;--k2:1;--k3:1;--k4:1;--k5:1;--sb:0;--l:1;--m:1;position:absolute;inset:0;container-type:size;overflow:hidden}
.ns-w{--u:min(calc(100cqw / 780), calc(100cqh / 480));--hs:1;--cs:1;position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:${u(26)};
background:linear-gradient(color-mix(in srgb,var(--line) 40%,transparent) 1px,transparent 1px) 50% 0/${u(40)} ${u(40)},linear-gradient(90deg,color-mix(in srgb,var(--line) 40%,transparent) 1px,transparent 1px) 50% 0/${u(40)} ${u(40)},var(--bg);
color:var(--ink);user-select:none}
@container (max-aspect-ratio:6/5){.ns-w{--u:min(calc(100cqw / 750), calc(100cqh / 640));--hs:1.3;--cs:1.25}}
.ns *{box-sizing:border-box}
.ns-head{display:grid;justify-items:center;gap:${u(12)};text-align:center;scale:var(--fit,1)}
.ns-lock{margin:0;white-space:nowrap;line-height:1;font:800 min(calc(84 * var(--hs) * var(--u)), calc(100cqw / 7.4))/1 var(--sans,system-ui,sans-serif);letter-spacing:-.035em;opacity:clamp(0,var(--l) * 3,1);scale:calc(1.3 - .3 * var(--l))}
.ns-lock span{font:600 calc(2em / 3)/1 var(--mono,ui-monospace,monospace);letter-spacing:0;color:var(--muted)}
.ns-cap{margin:0;font:600 calc(20 * var(--cs) * var(--u))/1.3 var(--mono,ui-monospace,monospace);color:var(--muted);opacity:var(--m);translate:0 calc((1 - var(--m)) * 12 * var(--u))}
.ns-act{position:relative;width:${u(720)};height:${u(300)};pointer-events:none}
.ns-act>*{position:absolute}
.ns-floor{left:${u(-30)};right:${u(-30)};top:${u(290)};height:${u(3)};background:var(--line)}
.ns-ghost{top:${u(226)};width:${u(100)};height:${u(60)};border:${u(2)} dashed var(--line);border-radius:${u(10)}}
.ns-lane{top:0;height:${u(300)};overflow:clip}
.ns .ns-k.bui-key{display:inline-flex;align-items:center;justify-content:center;height:${u(60)};min-height:0;padding:0 ${u(13)};font:700 ${u(28)}/1 var(--mono,ui-monospace,monospace);letter-spacing:.1em;white-space:nowrap;gap:0;cursor:default;--c:var(--k-go)}
.ns-pair{position:absolute;top:${u(226)};display:flex;gap:${u(4)}}
.ns-in .ns-pair{left:${u(10)};translate:calc(var(--b) * 256 * var(--u)) calc((1 - var(--a)) * -220 * var(--u));opacity:clamp(0,var(--a) * 4,1)}
.ns-in .ns-k{width:${u(100)}}
.ns-out .ns-pair{left:${u(576 - 390)};transform:translateX(-50%);translate:calc((1 - var(--o)) * -300 * var(--u)) calc((var(--g) * 128 - var(--f) * 216) * var(--u))}
.ns-v{display:inline-block;overflow:hidden;width:calc((1 - var(--i)) * 1ch);margin-right:calc((1 - var(--i)) * .1em);opacity:calc(1 - var(--i))}
.ns-t{width:${u(26)};height:${u(26)};top:${u(262)};display:grid;place-items:center;font:700 ${u(19)}/1 var(--mono,ui-monospace,monospace);color:var(--muted);background:var(--surface);border:${u(2)} solid var(--line);border-radius:${u(5)}}
.ns-te{left:${u(220)};${arc("--e", 93, -117, 110)};rotate:calc(var(--e) * -18deg);${show("--e")}}
.ns-ti{left:${u(404)};${arc("--j", 121.6, -20, 70)};rotate:calc(var(--j) * 24deg);${show("--j")}}
.ns .ns-b.bui-key{height:${u(40)};min-height:0;padding:0;justify-content:center;font:700 ${u(16)}/1 var(--mono,ui-monospace,monospace);letter-spacing:.1em;border-radius:${u(8)};cursor:default}
${BRICKS.map(([, role, cx, top], i) => {
  const w = [78, 100, 89, 112, 44][i]!, k = `--k${i + 1}`;
  return `.ns .ns-b${i + 1}{--c:var(--k-${role});left:${u(cx - w / 2)};top:${u(top)};width:${u(w)};${arc(k, FROM[0]! - cx, FROM[1]! - (top + 20), 90)};${show(k)}}`;
}).join("\n")}
.ns-body{left:${u(252)};top:${u(120)};width:${u(148)};height:${u(166)};background:var(--raised);border:${u(3)} solid var(--rim);border-radius:${u(14)};box-shadow:calc(5 * var(--u) * var(--shadow-x, 0)) calc(5 * var(--u) * var(--shadow-y, 1)) 0 var(--k-cmd-base);transform-origin:50% 100%;scale:1 calc(1 - var(--r) * .035)}
.ns-mouth{top:${u(96)};width:${u(12)};height:${u(64)};background:var(--rim);border-radius:${u(3)}}
.ns-mouth+.ns-mouth{right:${u(-3)}}
.ns-body>.ns-mouth:first-child{left:${u(-3)}}
.ns-screen{left:${u(12)};right:${u(12)};top:${u(22)};height:${u(46)};background:var(--rim);border:${u(2)} solid var(--line);border-radius:${u(6)};font:700 ${u(17)}/1 var(--mono,ui-monospace,monospace);letter-spacing:.1em;color:var(--k-go)}
.ns-screen b{position:absolute;inset:0;display:grid;place-items:center;font-weight:700}
.ns-s1{opacity:clamp(0,1 - var(--o) * 2,1)}.ns-s2{opacity:clamp(0,var(--o) * 2 - 1 - var(--sb),1);text-transform:none}.ns-s3{opacity:var(--sb)}
.ns-led{right:${u(14)};top:${u(78)};width:${u(10)};height:${u(10)};border-radius:50%;border:${u(2)} solid var(--rim);background:color-mix(in srgb,var(--k-fire) calc(var(--r) * 100%),var(--k-go))}
.ns-body>*{position:absolute}
.ns-rod{left:${u(320)};top:${u(44)};width:${u(12)};height:${u(70)};background:var(--line);border:${u(2)} solid var(--rim)}
.ns-ram{left:${u(284)};top:${u(96)};width:${u(84)};height:${u(26)};background:var(--k-cmd);border:${u(3)} solid var(--rim);border-radius:${u(6)};box-shadow:calc(4 * var(--u) * var(--shadow-x, 0)) calc(4 * var(--u) * var(--shadow-y, 1)) 0 var(--k-cmd-base);translate:0 calc(var(--r) * 22 * var(--u))}
.ns-rod{translate:0 calc(var(--r) * 22 * var(--u))}
.ns-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ns .ns-re{position:absolute;right:12px;top:12px;min-height:44px;font:700 12px/1 var(--mono,ui-monospace,monospace);letter-spacing:.08em}`;

const keys = (words: string[]) => `<span class="ns-pair">${words.map((w) => `<span class="bui-key bui-arcade ns-k">${w}</span>`).join("")}</span>`;

/** The scene's markup (its final frame). `cls`: extra classes on the root (the poster's placeholder). */
export function art(cls = "") {
  return `<div class="ns${cls}" aria-hidden="true">` +
    `<p class="ns-sr">${LABEL}</p>` +
    `<div class="ns-w"><div class="ns-head"><p class="ns-lock">Fizlet™ <span>· fzlt™</span></p><p class="ns-cap">${CAPTION}</p></div>` +
    `<div class="ns-act">` +
      `<i class="ns-floor"></i><i class="ns-ghost" style="left:calc(10 * var(--u))"></i><i class="ns-ghost" style="left:calc(114 * var(--u))"></i>` +
      `<div class="ns-lane ns-in" style="left:0;width:calc(262 * var(--u))">${keys(["FIZ", "LET"])}</div>` +
      `<i class="ns-t ns-te">E</i><i class="ns-t ns-ti">i</i>` +
      BRICKS.map(([name], i) => `<span class="bui-key bui-arcade ns-b ns-b${i + 1}">${name}</span>`).join("") +
      `<div class="ns-lane ns-out" style="left:calc(390 * var(--u));right:calc(-30 * var(--u))">${keys(['f<span class="ns-v">i</span>z', "lt"])}</div>` +
      `<i class="ns-rod"></i>` +
      `<div class="ns-body"><i class="ns-mouth"></i><i class="ns-mouth"></i><div class="ns-screen"><b class="ns-s1">FIZLET</b><b class="ns-s2">fzlt</b><b class="ns-s3">stack</b></div><i class="ns-led"></i></div>` +
      `<i class="ns-ram"></i>` +
    `</div></div></div>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * The slot figure with its poster (the final frame) and styles. `target`: its data-slot-target;
 * `cls`: extra figure classes (the gallery's); `style`: the figure's inline style. role="img" is
 * the last attribute on purpose: the live scene is accessible (real text, a real Replay key), so
 * @fzlt/core/slot drops the role while it runs, and its ledger puts it back at the end of the
 * attribute list; last, the figure is byte for byte the same after Recall.
 */
export function figure(target: string, { cls = "", style = "" } = {}) {
  return `<figure class="ae-slot ns-fig${cls}" data-slot-target="${esc(target)}" aria-label="${esc(LABEL)}"${style ? ` style="${esc(style)}"` : ""} role="img">` +
    `<style>${CSS}</style>${art(" ae-slot__placeholder")}</figure>`;
}
