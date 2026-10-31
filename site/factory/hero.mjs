// The FILET game factory: the full-screen hero at the top of /bricks/. Static HTML and CSS (the
// poster: it plays as is, and under reduced motion it is the whole thing), the inline controller
// (controller.js) and the loader for the live scene (scene.ts, through fizlet/slot).
//
// The bricks are the real ones, each tile in its brick's token with its size measured on this build
// (scripts/sizes.mjs, passed in by scripts/site.mjs). Cartridge names: names.json.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import { esc, icon, HUB } from "../layout.mjs";

/** The bricks on the factory floor, in the order they stand in the stack (bottom row first). */
export const FLOOR = ["kernel", "collide", "grid", "input", "sound", "sprite", "steer", "timeline", "hud", "fx", "slot"];
/** Floor spots (x, y in % of the floor; r in degrees): a loose 4 × 3 scatter. */
export const SPOTS = [
  [10, 16, -12], [36, 10, 8], [62, 18, -6], [88, 12, 14],
  [14, 50, 9], [40, 44, -15], [66, 54, 5], [90, 46, -9],
  [8, 86, 6], [34, 82, 12], [60, 88, -10], [86, 84, 7],
];
/** Where each tile lands first (a spot per tile, so the kernel and the Z start apart). */
const FIRST = [5, 0, 11, 3, 8, 2, 9, 6, 1, 10, 7, 4]; // the Z is the twelfth tile
const kb = (b) => (b / 1024).toFixed(1);

/** The cartridge names (names.json), checked: [name, soon (1|0), tagline]. */
export function names(file = new URL("./names.json", import.meta.url)) {
  const d = JSON.parse(readFileSync(file, "utf8"));
  const ok = (s, max) => typeof s === "string" && s.trim() === s && s.length > 0 && s.length <= max;
  for (const g of d.soon) {
    if (!ok(g.name, 22) || !ok(g.tagline, 60) || !["idea", "in-progress"].includes(g.status) || !/^fizlet-engine games\/[a-z0-9-]+\/spec\.json$/.test(g.source))
      throw new Error(`site/factory/names.json: soon entry ${JSON.stringify(g)} needs a name (≤ 22), a tagline (≤ 60), status idea|in-progress and its spec as source`);
  }
  for (const r of d.rolls) if (!ok(r, 22)) throw new Error(`site/factory/names.json: roll ${JSON.stringify(r)} must be a name of 1–22 characters`);
  const soon = d.soon.map((g) => [g.name, 1, g.tagline]), rolls = d.rolls.map((r) => [r, 0]);
  if (!soon.length && !rolls.length) throw new Error("site/factory/names.json: no names");
  // Interleave: a real coming-soon game every few rolls.
  const out = [], every = Math.max(1, Math.ceil(rolls.length / Math.max(1, soon.length)));
  for (let i = 0; i < rolls.length; i++) {
    if (i % every === 0 && soon[i / every]) out.push(soon[i / every]);
    out.push(rolls[i]);
  }
  for (const s of soon) if (!out.includes(s)) out.push(s);
  return out;
}

const SKULL = `<svg viewBox="0 0 64 64" shape-rendering="crispEdges" aria-hidden="true"><path fill-rule="evenodd" d="M19 6h26v6h7v6h6v6h5v22h-5v6h-8v12h-9v-8h-6v8h-8v-8h-6v8h-8V52H5v-6H0V24h5v-6h6v-6h8ZM11 29v14h15V29Zm26 0v14h15V29Z"/></svg>`;

/** The cartridge (hidden until the machine makes one): shell, grip, label, sticker, gold pins. */
const cartridge = () => `<button type="button" class="fac-cart" hidden data-tone="0" aria-label="Cartridge">
          <span class="fac-shell" aria-hidden="true"></span>
          <span class="fac-grip" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="fac-label"><span class="fac-brand" aria-hidden="true">FIZLET</span><small></small><strong></strong><em></em></span>
          <span class="fac-band" aria-hidden="true">COMING SOON</span>
          <span class="fac-sticker" aria-hidden="true">${SKULL}</span>
          <span class="fac-pins" aria-hidden="true">${"<i></i>".repeat(9)}</span>
        </button>`;

/**
 * The hero: `{ html, css, script }`. `bricks` are site/bricks.mjs BRICKS, `sizes` scripts/sizes.mjs
 * measure(), `live` the live chunk's URL (relative to the page).
 */
export async function factoryHero({ bricks, sizes, version, live, liveBytes, names: list = names() }) {
  const tiles = FLOOR.map((id, i) => {
    const b = bricks.find((x) => x.id === id);
    if (!b) throw new Error(`site/factory: no brick "${id}" in site/bricks.mjs`);
    const s = sizes.find((x) => x.name === b.sizes[0]);
    if (!s) throw new Error(`site/factory: no measured size for ${b.sizes[0]}`);
    return { id, name: id, role: b.role, gzip: s.gzip, i };
  });
  // The stack: four rows of three, brick bond, the Z on top (x in tile widths from the middle,
  // y in tile heights up from the floor's bottom).
  const wall = (i) => i === 11 ? [0, 4.5] : [((i % 3) - 1) * 1.04 + ((i / 3 | 0) % 2 ? 0.18 : -0.18), (i / 3 | 0) + 0.5];
  const tile = (t) => {
    const [wx, wy] = wall(t.i);
    const vars = `--wx:calc(var(--tw) * ${wx.toFixed(2)});--wy:calc(var(--th) * ${wy.toFixed(2)} + ${wy * 3 | 0}px)`;
    const label = `${esc(t.name)}, ${kb(t.gzip)} KB gzip`;
    return `<button type="button" class="fac-b" data-id="${t.id}" data-name="${esc(t.name)}" data-at="floor" data-s="${FIRST[t.i]}" style="--t:var(--k-${t.role});${vars}" aria-label="Send ${label} to the belt"><b>${esc(t.name)}</b><small>${kb(t.gzip)} KB</small></button>`;
  };
  const z = `<button type="button" class="fac-b fac-z" data-id="z" data-name="The Z" data-at="floor" data-s="${FIRST[11]}" style="--wx:0px;--wy:calc(var(--th) * 4.5 + 13px)" aria-label="Send the Z, which fell off the sign, to the belt"><b>Z</b><small>THE Z</small></button>`;
  const spots = SPOTS.map(([x, y, r], i) => `.fac-b[data-s="${i}"]{--x:${x};--y:${y};--r:${r}deg}`).join("");
  const bytes = { live: liveBytes };
  const script = (await transform(readFileSync(new URL("./controller.js", import.meta.url), "utf8"), { minify: true, loader: "js", target: "es2022" })).code.trim();
  // The loader: import the live chunk once the hero nears the screen (fizlet/slot then waits for
  // an idle main thread) or on the first tap; never under reduced motion.
  const loader = `{const h=document.querySelector(".fac-hero"),m=matchMedia("(prefers-reduced-motion: reduce)");let d=0;const go=()=>{d++||(o.disconnect(),import(${JSON.stringify(live)}))},o=new IntersectionObserver(e=>e.some(x=>x.isIntersecting)&&go(),{rootMargin:"200px"}),arm=()=>{o.observe(h);h.addEventListener("pointerdown",go,{once:true})};h&&(m.matches?m.addEventListener("change",arm,{once:true}):arm())}`;
  const html = `
<section class="ae-slot fac-hero has-grid" data-slot-target="bricks#factory" aria-labelledby="fac-title" data-names="${esc(JSON.stringify(list))}">
  <div class="wrap fac-grid">
    <div class="fac-copy">
      <div class="fac-top">
        <p class="eyebrow"><span class="dot"></span>FILET GAME FACTORY <span>/</span> <b>BRICKS</b></p>
        <p class="fac-meta bui-label">V${esc(version)} · ${FLOOR.length} BRICKS · SIZES MEASURED</p>
      </div>
      <h2 id="fac-title">Bricks in.<br><em>Games out.</em></h2>
      <p class="lead fac-lead">The factory knocked its bricks over and lost a letter: the sign says FILET. Feed the belt the kernel, any two bricks and the Z, and a cartridge comes out.<span class="fac-more"> Every brick here is a real Fizlet brick, its size measured on this build.</span></p>
      <div class="fac-keys">
        <button type="button" class="bui-key bui-sticker-key fac-go">${SKULL}<b>BUILD A GAME</b></button>
        <div class="fac-side">
          <a class="bui-key bui-arcade bui-sys" href="#bricks">${icon("down", 16)}See the bricks</a>
          <a class="hero-link" href="${HUB}">${icon("cart", 16)}Pick a cartridge on DOM VIRUS ↗</a>
        </div>
      </div>
      <p class="fac-hint bui-label" aria-hidden="true">TAP OR DRAG A BRICK · FEED THE BELT · FIND THE Z</p>
    </div>
    <div class="fac-yard"><div class="fac-y">
      <div class="fac-floor" role="group" aria-label="The factory floor: press a brick to send it to the belt">
        ${tiles.map(tile).join("\n        ")}
        ${z}
      </div>
      <div class="fac-lane" aria-hidden="true"><i></i></div>
      <div class="fac-machine" aria-hidden="true">
        <span class="fac-sign"><i>F</i><i>I</i><i class="fac-zs">Z</i><i>L</i><i>E</i><i>T</i></span>
        <span class="fac-lamps"><i title="kernel"></i><i></i><i></i><i class="fac-zl"></i></span>
        <span class="fac-mouth"></span><span class="fac-chute"></span>
      </div>
      <div class="fac-out">${cartridge()}</div>
      <div class="fac-hud panel">
        <span class="fac-c"><small>BRICKS LOADED</small><b class="fac-n">0/4</b></span>
        <span class="fac-c"><small>CARTRIDGES</small><b class="fac-m">000</b></span>
        <button type="button" class="bui-key bui-arcade fac-shake">${icon("bolt", 16)}Shake it</button>
        <button type="button" class="bui-key fac-mute" aria-pressed="false" aria-label="Sound on: mute">${icon("sound", 18).replace("<svg", '<svg class="fac-on"')}${icon("mute", 18).replace("<svg", '<svg class="fac-off"')}</button>
      </div>
    </div></div>
  </div>
  <p class="fac-say" role="status" aria-live="polite"></p>
  <script type="module">${script}${loader}</script>
</section>
<div id="bricks"></div>`;
  return { html, css: CSS + spots, bytes };
}

// Tokens only (Board UI kit + site.css). The grid is the shared hero grid (site/origin-section's
// .has-grid and --grid-bg, once it lands); until then the same pattern from site.css's tokens.
const CSS = `
.fac-hero{position:relative;isolation:isolate;display:grid;align-items:center;min-height:100svh;padding:clamp(28px,6vh,72px) 0 clamp(28px,5vh,56px);overflow:hidden;border-bottom:2px solid var(--line)}
.fac-hero::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--grid-bg,linear-gradient(var(--grid) 1px,transparent 1px) 0 0/44px 44px,linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/44px 44px);-webkit-mask-image:radial-gradient(ellipse 110% 95% at 60% 45%,#000 45%,transparent 100%);mask-image:radial-gradient(ellipse 110% 95% at 60% 45%,#000 45%,transparent 100%)}
.fac-hero>[data-fizlet-slot]{pointer-events:none;z-index:3}
.fac-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:clamp(24px,4vw,56px);align-items:center;width:100%}
.fac-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 18px;align-items:center}
.fac-top .eyebrow{margin:0}
.fac-meta{margin:0;color:var(--muted)}
.fac-hero h2{margin:18px 0 18px;font-size:clamp(46px,6.6vw,100px);line-height:.92;letter-spacing:-.05em}
.fac-hero h2 em{font-style:normal;color:var(--k-attack);text-shadow:0 0 40px color-mix(in srgb,var(--k-attack) 30%,transparent)}
html.bui[data-theme="light"] .fac-hero h2 em{color:color-mix(in srgb,var(--k-attack) 78%,var(--ink));text-shadow:none}
.fac-lead{max-width:34em;margin:0 0 22px}
.fac-keys{display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px}
.fac-side{display:grid;gap:12px;justify-items:start}
.bui .fac-go{width:auto;min-width:150px;padding:0 18px}
.bui .fac-go b{font-size:12px}
.fac-hint{margin:14px 0 0;color:var(--k-attack)}
html.bui[data-theme="light"] .fac-hint{color:var(--k-fire-ink)}
.fac-say{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;margin:0}
/* The yard: floor, belt, machine, cartridge, HUD. Sizes by the yard's own width. */
.fac-yard{position:relative;height:590px;container-type:inline-size}
.fac-y{--tw:92px;--th:46px;--fh:330px;--ly:388px;--lw:56%;--ls:calc(var(--tw) * .66);--mx:48%;--mw:150px;--my:350px;--mh:150px;position:absolute;inset:0}
.fac-floor{position:absolute;inset:0 0 auto;height:var(--fh)}
@media (min-width:900px){.fac-floor{left:-7%;right:-3%;top:-24px}}
.fac-hero .fac-b{position:absolute;z-index:2;left:calc(var(--x) * 1%);top:calc(var(--y) * var(--fh) / 100);width:var(--tw);height:var(--th);margin:calc(var(--th) / -2) 0 0 calc(var(--tw) / -2);rotate:var(--r);display:grid;place-content:center;gap:2px;padding:0;font:800 13px/1 var(--mono);color:var(--ink);text-align:center;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;background:color-mix(in srgb,var(--t) 20%,var(--surface));border:2px solid var(--t);border-radius:8px;box-shadow:0 4px 0 color-mix(in srgb,var(--t) 50%,var(--rim))}
.fac-hero .fac-b small{font:700 10px/1 var(--mono);color:var(--muted);letter-spacing:.04em}
.fac-hero .fac-b:focus-visible{outline:3px solid var(--k-sys-ink);outline-offset:3px;z-index:4}
.fac-hero .fac-b.fac-drag{z-index:5;rotate:0deg;cursor:grabbing;box-shadow:0 10px 0 color-mix(in srgb,var(--t) 40%,var(--rim))}
@media (hover:hover) and (pointer:fine){.fac-b[data-at=floor]:hover{border-color:var(--ink)}}
.fac-hero .fac-z{--t:var(--hurt);background:var(--hurt);color:var(--rim)}
.fac-hero .fac-z b{font-size:22px;line-height:.9}.fac-hero .fac-z small{color:var(--rim);font-size:9px}
@media (prefers-reduced-motion:no-preference){.fac-hero:not(.fac-down) .fac-b[data-at=floor]{left:calc(50% + var(--wx));top:calc(var(--fh) - var(--wy));rotate:0deg}}
.fac-hero .fac-b[data-at=belt]{left:calc(var(--k) * var(--ls) + var(--tw) * .4);top:calc(var(--ly) + 3px);rotate:0deg;scale:.62;cursor:default}
.fac-hero .fac-b[data-at=in]{left:calc(var(--mx) + var(--mw) / 2);top:calc(var(--my) + var(--mh) / 2);visibility:hidden}
.fac-lane{position:absolute;left:0;width:calc(var(--lw) + 12px);top:calc(var(--ly) + 8px);height:22px;border:2px solid var(--line);border-radius:12px;background:var(--rim);overflow:hidden}
.fac-lane i{position:absolute;inset:4px;background:repeating-linear-gradient(90deg,var(--line) 0 10px,transparent 10px 22px);background-position-x:var(--belt,0px)}
.fac-machine{position:absolute;z-index:1;left:var(--mx);top:var(--my);width:var(--mw);height:var(--mh);display:grid;grid-template-rows:auto 1fr;gap:10px;padding:10px;background:var(--surface);border:2px solid var(--line);border-radius:12px;box-shadow:0 6px 0 var(--raised)}
.fac-sign{display:flex;justify-content:center;gap:2px;padding:6px 4px;font:900 20px/1 var(--mono);background:var(--rim);border:2px solid var(--line);border-radius:6px;color:var(--k-go)}
.fac-sign i{font-style:normal;min-width:.7em;text-align:center;text-shadow:0 0 12px color-mix(in srgb,var(--k-go) 60%,transparent)}
.fac-sign .fac-zs{color:transparent;text-shadow:none;outline:2px dashed color-mix(in srgb,var(--ink) 30%,transparent);outline-offset:-1px;border-radius:3px}
.fac-made .fac-sign .fac-zs{color:var(--hurt);outline:0;text-shadow:0 0 12px color-mix(in srgb,var(--hurt) 70%,transparent)}
html.bui[data-theme="light"] .fac-sign{color:var(--k-go)}
.fac-lamps{display:flex;justify-content:center;gap:8px;align-self:start}
.fac-lamps i{width:16px;height:16px;border:2px solid var(--line);border-radius:4px;background:var(--rim)}
.fac-hero[data-n="1"] .fac-lamps i:nth-child(-n+1),.fac-hero[data-n="2"] .fac-lamps i:nth-child(-n+2),.fac-hero[data-n="3"] .fac-lamps i:nth-child(-n+3){background:var(--hurt);border-color:var(--hurt)}
.fac-mouth{position:absolute;left:-2px;top:calc(var(--ly) - var(--my) - 12px);width:16px;height:48px;background:var(--rim);border:2px solid var(--line);border-left:0;border-radius:0 6px 6px 0}
.fac-machine::after{content:"";position:absolute;left:10px;right:10px;bottom:10px;height:14px;border-radius:3px;background:repeating-linear-gradient(135deg,var(--hurt) 0 8px,var(--rim) 8px 16px);opacity:.85}
.fac-chute{position:absolute;right:-12px;bottom:18px;width:12px;height:56px;background:var(--raised);border:2px solid var(--line);border-left:0;border-radius:0 6px 6px 0}
.fac-run .fac-machine{border-color:var(--k-attack);box-shadow:0 6px 0 var(--raised),0 0 32px color-mix(in srgb,var(--k-attack) 45%,transparent)}
.fac-run .fac-lamps i,.fac-made .fac-lamps i{background:var(--k-go);border-color:var(--k-go)}
.fac-out{position:absolute;z-index:4;left:calc(var(--mx) + var(--mw) + 16px);top:calc(var(--my) - 40px);width:128px}
/* The HUD: counters, Shake it, mute. */
.fac-hud{position:absolute;right:0;bottom:0;display:flex;align-items:center;gap:14px;padding:8px 10px 8px 14px;margin:0}
.fac-c{display:grid;gap:3px}.fac-c small{font:700 9px/1 var(--mono);letter-spacing:.12em;color:var(--muted)}.fac-c b{font:900 18px/1 var(--mono);color:var(--k-attack)}
.fac-c+.fac-c b{color:var(--hurt)}
html.bui[data-theme="light"] .fac-c b{color:var(--k-fire-ink)}
.bui .fac-shake{--c:var(--k-attack)}
.bui .fac-mute{flex:none;width:44px;height:44px;padding:0;justify-content:center}
.fac-side .hero-link{min-height:44px;display:inline-flex;align-items:center}
.bui .fac-hud .fac-shake{min-height:44px}
.fac-mute .fac-off,.fac-mute[aria-pressed=true] .fac-on{display:none}.fac-mute[aria-pressed=true] .fac-off{display:block}
/* The cartridge (after DOM VIRUS's, redrawn on the kit's tokens). */
.fac-hero .fac-cart{--a:var(--k-go);position:relative;isolation:isolate;display:grid;grid-template-rows:22px 1fr 28px;width:128px;min-height:164px;padding:0 12px 0 10px;border:0;background:none;color:var(--ink);text-align:left;cursor:pointer;font:inherit}
.fac-cart[hidden]{display:none}
.fac-cart[data-tone="1"]{--a:var(--k-sys)}.fac-cart[data-tone="2"]{--a:var(--k-cmd)}.fac-cart[data-tone="3"]{--a:var(--k-advance)}.fac-cart[data-tone="4"]{--a:var(--k-attack)}
.fac-hero .fac-cart:focus-visible{outline:3px solid var(--k-sys-ink);outline-offset:5px}
.fac-shell{position:absolute;inset:0;z-index:-1;background:var(--ink);border-radius:10px 10px 0 0;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,6px 100%,0 calc(100% - 6px))}
.fac-shell::before{content:"";position:absolute;inset:2px;background:var(--a);border-radius:8px 8px 0 0;box-shadow:inset 0 -5px 0 color-mix(in srgb,var(--a) 60%,var(--rim));clip-path:polygon(0 0,calc(100% - 17px) 0,100% 17px,100% 100%,5px 100%,0 calc(100% - 5px))}
.fac-grip{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 22px 0 2px}
.fac-grip i{height:2px;background:color-mix(in srgb,var(--rim) 40%,transparent)}
.fac-label{display:grid;align-content:start;gap:3px;padding:8px;background:var(--surface);border:2px solid var(--rim);border-radius:5px}
.fac-brand{justify-self:start;padding:2px 5px;font:900 10px/1 var(--mono);letter-spacing:.14em;color:var(--rim);background:var(--a);border-radius:3px}
.fac-label small{font:700 8px/1.3 var(--mono);letter-spacing:.06em;color:var(--muted)}
.fac-label strong{font-size:15px;line-height:1.1}
.fac-label em{font-style:normal;font-size:10px;line-height:1.25;color:var(--muted)}
.fac-band{position:absolute;top:26px;bottom:44px;right:-2px;display:none;place-items:center;width:16px;writing-mode:vertical-rl;font:800 8px/1 var(--mono);letter-spacing:2px;color:var(--rim);background:repeating-linear-gradient(135deg,var(--hurt) 0 7px,color-mix(in srgb,var(--hurt) 80%,var(--rim)) 7px 14px);border:2px solid var(--rim);border-radius:3px 0 0 3px}
.fac-cart[data-soon="1"] .fac-band{display:grid}
.fac-sticker{position:absolute;z-index:2;top:5px;left:8px;display:grid;place-items:center;width:18px;height:18px;background:var(--rim);border:2px solid var(--ink);border-radius:3px;rotate:-9deg;clip-path:polygon(-2px -2px,calc(100% + 2px) -2px,calc(100% + 2px) 72%,72% calc(100% + 2px),-2px calc(100% + 2px))}
.fac-sticker svg{width:11px;height:11px;fill:var(--team-b)}
.fac-pins{display:flex;align-items:flex-end;gap:3px;margin:6px 3px 6px;padding:0 4px;background:var(--rim);border-radius:3px 3px 0 0}
.fac-pins i{flex:1;height:calc(100% - 3px);background:linear-gradient(color-mix(in srgb,var(--hurt) 45%,var(--ink)) 0 3px,var(--hurt) 3px);border-radius:2px 2px 0 0}
.fac-pins i:nth-child(4){height:45%}.fac-pins i:nth-child(7){background:color-mix(in srgb,var(--hurt) 60%,var(--rim))}
/* Narrow yards (phones, short landscape): the cartridge rises over the belt, the HUD wraps. */
@container (max-width:539px){
  .fac-y{--tw:80px;--th:44px;--fh:236px;--ly:286px;--lw:52%;--ls:calc(var(--tw) * .56);--mx:auto;--mw:44%;--my:258px;--mh:118px}
  .fac-machine{left:auto;right:0}
  .fac-hero .fac-b[data-at=belt]{scale:.54}
  .fac-hero .fac-b[data-at=in]{left:78%;top:calc(var(--my) + var(--mh) / 2)}
  .fac-out{left:2%;top:126px}
  .fac-sign{font-size:16px}
}
@media (max-width:899px){
  .fac-grid{grid-template-columns:minmax(0,1fr)}
  .fac-yard{height:460px}
}
@media (max-width:600px){
  .fac-hero{padding-top:20px}
  .fac-more{display:none}
  .fac-hero h2{font-size:44px;margin:12px 0}
  .fac-lead{font-size:15px;margin-bottom:14px}
  .fac-keys{flex-wrap:nowrap;gap:12px}
  .fac-hint{margin-top:10px}
}
@media (max-width:899px) and (orientation:landscape){
  .fac-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .fac-hero h2{font-size:clamp(34px,5.6vw,60px);margin:10px 0}
  .fac-lead{font-size:14px;margin-bottom:12px}
}
@container (max-width:539px){.fac-hud{left:0;justify-content:space-between}}
`;
