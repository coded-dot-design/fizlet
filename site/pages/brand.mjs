// Brand (/brand/): the Fizlet marks and how to use them. The two logos (FIZLET and fzlt) and the
// lockups are drawn from one source (scripts/brand-marks.mjs), inline here and as the SVG
// downloads beside them; the colour swatches read the Board UI tokens (src/ui/tokens.json); the
// board section is the kit itself (src/ui/board-ui.css), live. Motion: the sticker slam only, the
// kit's own CSS restarted by its slam() (site/brand.ts); it settles, and reduced motion stills it.
import { REPO, AUTHOR, esc, icon, mark, lockup } from "../layout.mjs";
import { brandMarks, brandStickers, GEOMETRY, fizletLogo, fzltLogo, logoSvg } from "../../scripts/brand-marks.mjs";
import { readFileSync } from "node:fs";

const TOKENS = JSON.parse(readFileSync(new URL("../../src/ui/tokens.json", import.meta.url), "utf8")).palette;

/** A numbered section head: the tilted index sticker, a mono kicker, a two-line h2, a lead. */
const head = (n, id, kicker, title, accent, lead) => `<div class="section-head">
      <p class="eyebrow"><span class="index">${n}</span> ${kicker}</p>
      <h2 id="${id}-title">${title}<br><em>${accent}</em></h2>
      ${lead ? `<p class="lead">${lead}</p>` : ""}
    </div>`;
const section = (id, body) => `<section id="${id}" class="section brand-sec" aria-labelledby="${id}-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <div class="wrap">
    ${body}
  </div>
</section>`;

/** A mark drawn inline: the download's SVG, named by its aria-label (the page has one <title>). */
export const inline = (m) => m.svg.replace(/<title>[^<]*<\/title>/, "");

/** One mark on both grounds, each with its download key. */
function markCard(list, id, caption, min = "") {
  const both = list.filter((m) => m.id === id);
  return `<li class="panel brand-card">
        <h3>${esc(both[0].name)}</h3>
        <p class="brand-cap">${caption}</p>
        <div class="brand-pair">${both.map((m) => `
          <figure class="brand-fig brand-on-${m.theme}">
            <div class="brand-art">${inline(m)}</div>${min ? `
            <div class="bui brand-at-min" data-theme="${m.theme}">${min}</div>` : ""}
            <figcaption><span class="bui-label"><b>ON ${m.theme.toUpperCase()}</b> · ${m.w} × ${m.h}</span>
              <a class="bui-key bui-arcade bui-sys brand-dl" href="${m.file}" download="${m.file}" data-mark="${m.file}">${icon("down", 16)}${m.theme === "dark" ? "Dark" : "Light"} SVG<span class="sr"> of the ${esc(m.name)}</span></a></figcaption>
          </figure>`).join("")}
        </div>
      </li>`;
}

/** The colour swatches: every token the kit takes, with its job, its variable and both hexes. */
function swatches() {
  const role = (v) => (v.startsWith("= ") ? TOKENS.roles[v.slice(2)].dark : v);
  const group = (title, rows) => `<h3 class="brand-sub">${title}</h3>
    <ul class="brand-swatches">${rows.map(([name, t]) => {
      const d = role(t.dark), l = t.light ? role(t.light) : d;
      return `<li class="panel brand-sw"><i style="background:var(${t.var})" aria-hidden="true"></i><div><b>${esc(name)}</b> <code>${esc(t.var)}</code>
        <span class="brand-hex"><span>dark <code>${d}</code></span>${l !== d ? `<span>light <code>${l}</code></span>` : ""}</span>${t.job ? `<small>${esc(t.job)}</small>` : t.note ? `<small>${esc(t.note)}</small>` : ""}</div></li>`;
    }).join("")}</ul>`;
  return group("Roles: one colour per job", Object.entries(TOKENS.roles)) +
    group("Surfaces and ink", Object.entries(TOKENS.surfaces)) +
    group("Ink twins: thin text on light", Object.entries(TOKENS.inks));
}

/** Clear space and minimum size: the FIZLET logo with its X margin drawn on it. */
function clearSpace(list) {
  const m = list.find((x) => x.id === "wordmark" && x.theme === "dark");
  const { LX: X } = GEOMETRY, pad = 28, w = m.w + 2 * pad, h = m.h + 2 * pad;
  const label = (x, y) => `<text x="${x}" y="${y}" class="cs-x" text-anchor="middle">X</text>`;
  const inner = m.svg.replace(/^<svg [^>]*>/, `<svg x="${pad}" y="${pad}" width="${m.w}" height="${m.h}" viewBox="0 0 ${m.w} ${m.h}" aria-hidden="true">`).replace(/<title>[^<]*<\/title>/, "");
  return `<figure class="panel brand-cs">
        <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Clear space: X, the width of the mark's outlined square, on every side of the FIZLET logo">${inner}
          <rect class="cs-out" x="${pad}" y="${pad}" width="${m.w}" height="${m.h}"/>
          <rect class="cs-in" x="${pad + X}" y="${pad + X}" width="${m.w - 2 * X}" height="${m.h - 2 * X}"/>
          ${label(pad + X / 2, pad + m.h / 2 + 5)}${label(pad + m.w - X / 2, pad + m.h / 2 + 5)}${label(pad + m.w / 2, pad + X / 2 + 5)}${label(pad + m.w / 2, pad + m.h - X / 2 + 5)}
        </svg>
        <figcaption class="brand-cap"><b>X</b> is the width of the mark's outlined square: 26 of the mark's 64 units, about 0.4 × the logo's cap height. The same X goes round the fzlt logo. Nothing enters it: no text, key edge or grid line. The downloads carry it.</figcaption>
      </figure>`;
}

const DONTS = [
  ["brand-dont-stretch", "FIZLET", "Stretched", "Never stretch, squash, slant or rotate a mark."],
  ["brand-dont-hue", "FIZLET", "Off-palette", "The tokens only: --ink, --muted, the tile's own colours."],
  ["", "FizLet", "FizLet", "Fizlet in prose, FIZLET as the mark. Never FizLet or FIZlet."],
  ["", "Fizlet®", "®", "Nothing is registered. ™ only, never “registered”."],
  ["", "FZLT", "FZLT", "fzlt is always lowercase."],
  ["", "@fzlt™/core", "™ in code", "No ™ in package names, imports or URLs."],
];

/** The header lockup as the site renders it: the one source, site/layout.mjs lockup(). */
const headerLockup = (version) => lockup({ version });
/** A kit sticker (.bui-sticker): a kicker and one or two words. */
const sticker = (kicker, word, cls = "") => `<div class="bui-sticker${cls}"><span>${esc(kicker)}</span><b>${esc(word)}</b></div>`;

/** The sticker set: each entry live in the kit's own classes, beside its SVG download(s). */
function stickerCards() {
  const all = brandStickers(mark);
  return [...new Set(all.map((x) => x.id))].map((id) => {
    const files = all.filter((x) => x.id === id), s = files[0].entry;
    const live = s.kind === "sticker"
      ? `<div class="brand-still">${sticker(s.kicker, s.word + (s.tm ? "™" : ""), s.small ? " brand-sticker-small" : "")}</div>`
      : `<div class="brand-keys"><button class="bui-key bui-sticker-key" type="button" aria-label="Sticker key: ${esc(s.word)}">${mark(42)}<b>${esc(s.word)}</b></button></div>`;
    return `<li class="panel brand-sticker">
        ${live}
        <div class="brand-sticker-dl">${files.map((f) => `<a class="bui-key bui-arcade bui-sys brand-dl" href="${f.file}" download="${f.file}" data-mark="${f.file}">${icon("down", 16)}${f.theme === "any" ? "SVG" : f.theme === "dark" ? "Dark SVG" : "Light SVG"}<span class="sr"> of the sticker ${esc(f.name)}</span></a>`).join("")}</div>
      </li>`;
  }).join("");
}

export function brandPage({ version, kernel }) {
  const list = brandMarks();
  const dont = DONTS.map(([cls, text, name, why]) => `<li class="panel brand-dont">
        <div class="brand-dont-art" aria-hidden="true"><span class="brand-dont-word ${cls}">${esc(text)}</span></div>
        <p><span class="brand-no">${icon("close", 14)}DON'T</span> <b>${esc(name)}</b></p>
        <p class="brand-cap">${esc(why)}</p>
      </li>`).join("");
  const ROLES = [["go", "play", "Go"], ["sys", "book", "Sys"], ["cmd", "recall", "Cmd"], ["attack", "fire", "Attack"], ["advance", "right", "Advance"], ["fallin", "check", "Fall in"], ["fire", "bolt", "Fire"], ["flag", "close", "Flag"]];
  return `
<section class="section brand-hero" aria-labelledby="brand-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><b>BRAND</b> · MARKS · COLOUR · THE BOARD</p>
      <h1 id="brand-title">Fizlet™ marks.<br><em>Used one way.</em></h1>
      <p class="lead">Fizlet™ is the micro animation and game engine for the DOM, by <a href="${AUTHOR}">Chris Cooley ↗</a>. Its short mark is fzlt™, also its npm scope. Every mark on this page is drawn live from the site's own tokens, and every one downloads as an SVG made from the same source.</p>
      <p class="brand-tm">Fizlet and fzlt are trademarks of Chris Cooley.</p>
    </div>
  </div>
</section>

${section("marks", `${head("01", "marks", "THE MARKS", "One name.", "Two marks.", "Six letters and four, owned equally, each with the mark. <b>FIZLET</b> is the large logo: heavy caps, the mark's frame closed by the F. <b>fzlt</b> is the small logo: the mark's pixels and fzlt, always lowercase; the developer and npm mark, never a name in prose. Both in <code>--ink</code>, the pop in <code>--k-attack</code> on either ground.")}
    <ul class="brand-cards">
      ${markCard(list, "wordmark", "The mark in its square frame; the frame's right side is the F's stem. Six heavy caps, drawn as outlines so they hold in any font. Titles, the hero, covers.", `<span class="bui-label"><b>AT MINIMUM</b> · 24PX CAP HEIGHT</span><span class="brand-min-logo">${logoSvg(fizletLogo(), 24)}</span>`)}
      ${markCard(list, "short-mark", "The mark's pixels without the frame, the pop above, then fzlt in bold lowercase. npm, code, badges, stickers and tight spaces.", `<span class="bui-label"><b>AT MINIMUM</b> · 24PX TALL</span><span class="brand-min-logo">${logoSvg(fzltLogo(), 24)}</span>`)}
    </ul>
    <div class="panel brand-card brand-header-lockup">
      <h3>The mark and the header lockup</h3>
      <p class="brand-cap">The mark: pixel squares fizzing up a square frame, one popping. Frame and squares in <code>--ink</code>, the pop in <code>--k-attack</code>, on no tile: the logos' mark, 40px in the header, 34px at 380px and under. The version is a sticker, the site's sticker recipe in <code>--k-sys</code>. The header, the footer and fzlt.dev draw this one lockup. The favicon is the same mark: <a href="../icon.svg" download="fizlet-icon.svg">icon.svg</a>.</p>
      <div class="brand-pair">
        <div class="bui brand-hl" data-theme="dark"><span class="brand">${headerLockup(version)}</span></div>
        <div class="bui brand-hl" data-theme="light"><span class="brand">${headerLockup(version)}</span></div>
      </div>
    </div>`)}

${section("why", `${head("02", "why", "WHY FZLT", "Four letters.", "No vowels.", "")}
    <div class="panel brand-why">
      <p><b>Why fzlt.</b> We picked fzlt on purpose, as Fizlet's developer and npm mark, so nobody mixes it up with anything else. It reads well as <code>npm i fzlt</code>. It has no vowels, so it is not a real word and not a misspelling of one. It has a “z”, one of the least-used letters in English. It won't autocorrect into anything, and nobody types it by accident. It is unique by design and it matches the brand: the <code>@fzlt</code> npm scope, <a href="https://github.com/fizlet">github.com/fizlet ↗</a>, Fizlet™ / fzlt™, and fzlt.dev and fzlt.app (planned redirects to fizlet.com). Today the install line is <code>npm i @fzlt/core</code>; plain <code>fzlt</code> is requested from npm, not ours yet, and the alias <code>npm i fzlt@npm:@fzlt/core</code> works now.</p>
    </div>`)}

${section("voices", `${head("03", "voices", "TWO VOICES", "Fizlet tells it.", "fzlt runs it.", "")}
    <div class="brand-split">
      <div class="panel brand-voice">
        <h3>Fizlet</h3>
        <p class="brand-cap">The brand: the name people remember. Confident, plain, arcade swagger. Headlines, pages, posts, the README title. It says the why, the mechanism, the proof.</p>
        <ul class="brand-ex">
          <li><span class="bui-label"><b>README TITLE</b></span><p class="brand-say">Fizlet™</p></li>
          <li><span class="bui-label"><b>HEADLINE</b></span><p class="brand-say">Tiny physics for your page.</p></li>
          <li><span class="bui-label"><b>HEADLINE</b></span><p class="brand-say">Recall gives <em>the page back.</em></p></li>
          <li><span class="bui-label"><b>STICKER</b></span><div class="brand-still">${sticker("RECALL", "RESTORED")}</div></li>
        </ul>
      </div>
      <div class="panel brand-voice">
        <h3><code>fzlt</code></h3>
        <p class="brand-cap">The developer and npm mark. Short, dev-first, lowercase, code-shaped. npm, badges, CLI output, code comments, stickers. It says the what: the command, the brick, the number.</p>
        <ul class="brand-ex">
          <li><span class="bui-label"><b>NPM DESCRIPTION</b></span><pre class="brand-code"><code>fzlt™: Fizlet's micro animation and game engine for the DOM, by Chris Cooley. One loop, bounded everything, the page always comes back.</code></pre></li>
          <li><span class="bui-label"><b>README BADGE LINE</b></span><pre class="brand-code"><code>npm i @fzlt/core · kernel ${kernel.toLocaleString("en-US")} B gzip · 0 runtime deps · MIT</code></pre></li>
          <li><span class="bui-label"><b>SNIPPET COMMENT</b></span><pre class="brand-code"><code>// fzlt/fx: sparks from the event ring. destroy() gives the page back.</code></pre></li>
          <li><span class="bui-label"><b>STICKERS</b></span><div class="brand-still">${sticker("fzlt", "RESTORED")}${sticker("@fzlt/core", "READY")}</div></li>
        </ul>
        <p class="brand-cap">fzlt stays lowercase, even on a sticker; keep it out of kit labels that force capitals. The kernel size is measured on this build.</p>
      </div>
    </div>`)}

${section("stickers", `${head("04", "stickers", "STICKER SET", "Stick it on.", "Both marks.", "Fizlet™ and fzlt™ in the kit's two sticker styles: the overlay sticker and the sticker key. Each is live below and downloads as an SVG made from the same list.")}
    <ul class="brand-stickers">
      ${stickerCards()}
    </ul>`)}

${section("lockups", `${head("05", "lockups", "LOCKUPS", "Side by side.", "Never squeezed.", "The header lockup above, and three more. Only these; ™ never goes on code or a domain.")}
    <ul class="brand-cards">
      ${markCard(list, "lockup", "Fizlet™ · fzlt™: the name, a middle dot, the short mark in mono and <code>--muted</code>.")}
      ${markCard(list, "npm", "The package, in code style only, never with ™. Fizlet on npm is <code>@fzlt/core</code>: <code>npm i @fzlt/core</code>, bricks at <code>@fzlt/core/&lt;brick&gt;</code>.")}
      ${markCard(list, "dev", "fizlet.com is the home. fzlt.dev (and fizlet.dev, fzlt.app) are planned redirects to it: lowercase, no ™, no link until live.")}
    </ul>`)}

${section("name", `${head("06", "name", "™ AND CASING", "Say it right.", "Spell it right.", "")}
    <div class="brand-split">
      <ul class="brand-rules" aria-label="Trademark">
        <li><b>Fizlet™</b> and <b>fzlt™</b> carry ™ on the first prominent use on a surface: the hero, the footer, the README title, the npm description. Plain after that.</li>
        <li><b>No ®.</b> Nothing is registered.</li>
        <li><b>The note:</b> “Fizlet and fzlt are trademarks of Chris Cooley.”</li>
      </ul>
      <ul class="brand-rules brand-case" aria-label="Casing">
        <li><b>Fizlet</b> in prose and titles.</li>
        <li><b>FIZLET</b> as the wordmark only.</li>
        <li><code>fizlet</code> in URLs and code: fizlet.com.</li>
        <li><code>fzlt</code> always lowercase: the short mark and <code>@fzlt/core</code>.</li>
        <li><b>Never</b> FizLet.</li>
      </ul>
    </div>`)}

${section("space", `${head("07", "space", "CLEAR SPACE · MINIMUM SIZE", "Give it room.", "Keep it legible.", "")}
    <div class="brand-split">
      ${clearSpace(list)}
      <ul class="panel brand-min" aria-label="Minimum sizes">
        <li><span class="brand-min-logo">${logoSvg(fizletLogo(), 24)}</span><p><b>Logos:</b> FIZLET at a 24px cap height, fzlt at 24px tall: the pop's smallest pixel stays about 1px.</p></li>
        <li><span class="brand-text brand-min-16"><b>FIZLET</b></span><p><b>Header wordmark:</b> 16px, the smallest it ships (the header at 380px wide and under).</p></li>
        <li><span class="brand-mark brand-min-38">${mark(34)}</span><p><b>Mark:</b> 34px in page chrome; the favicon at the browser's size.</p></li>
        <li><code class="brand-min-12">fzlt</code><p><b>fzlt:</b> 12px, the arcade key label size.</p></li>
      </ul>
    </div>`)}

${section("donts", `${head("08", "donts", "DON'TS", "Not like this.", "Not ever.", "")}
    <ul class="brand-donts">
      ${dont}
    </ul>`)}

${section("colour", `${head("09", "colour", "COLOUR · FROM src/ui/tokens.json", "Colour is a job.", "Not decoration.", `Flat faces, solid hex, no gradients. Every swatch here is the kit's own variable, so it follows the theme switch in the header. The source is <a href="${REPO}/blob/main/src/ui/tokens.json">tokens.json ↗</a>; the build fails if <code>board-ui.css</code> drifts from it.`)}
    ${swatches()}`)}

${section("board", `${head("10", "board", "THE BOARD · BOARD UI KIT", "Fizlet wears", "the board.", `Neon faces on an ink rim, hard bases straight below, a gridded field, mono caps labels. Everything below is the live kit (<code>@fzlt/core/ui</code>), lifted from DOM Battlefield. The <a href="${REPO}/blob/main/src/ui/BOARD-UI.md">Board UI spec ↗</a> has every rule.`)}
    <div class="brand-board">
      <div class="panel brand-block">
        <h3>The arcade key</h3>
        <p class="brand-cap">One key family, one role each. Press one: the face drops onto its base. These only press.</p>
        <div class="brand-keys" role="group" aria-label="Arcade keys, one per role">${ROLES.map(([r, i, l]) => `<button class="bui-key bui-arcade bui-${r}" type="button">${icon(i, 18)}${l}</button>`).join("")}</div>
        <div class="brand-keys" role="group" aria-label="Icon keys"><button class="bui-key bui-icon-key" type="button" aria-label="Sound">${icon("sound")}</button><button class="bui-key bui-icon-key" type="button" aria-label="Menu">${icon("menu")}</button><button class="bui-key bui-icon-key" type="button" aria-label="Grid">${icon("grid")}</button></div>
      </div>
      <div class="panel brand-block">
        <h3>Sticker keys</h3>
        <p class="brand-cap">The big launch keys: a dark face, a white rim and base, a pixel icon tile.</p>
        <div class="brand-keys" role="group" aria-label="Sticker keys">
          <button class="bui-key bui-sticker-key" type="button"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h3v14H5ZM8 6h3v8H8ZM11 8h3v4h-3Z"/></svg><b>START</b></button>
          <button class="bui-key bui-sticker-key bui-plan" type="button"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3h6v6H3ZM11 3h6v6h-6ZM3 11h6v6H3ZM11 11h6v6h-6Z"/></svg><b>PLAN</b></button>
          <button class="bui-key bui-sticker-key bui-second" type="button"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h3v14H4ZM7 3h9v7H7Z"/></svg><b>FLAG</b></button>
        </div>
      </div>
      <div class="panel brand-block">
        <h3>Stickers</h3>
        <p class="brand-cap">A kicker and one or two words, tilted −4°, on the rim: RECALL / RESTORED on the home demo, ERROR 404 / NO PAGE on the 404. Slam one: the kit's own drop, hit and press, then it settles.</p>
        <div class="brand-stage">
          <div class="brand-slam" data-slam hidden>${sticker("RECALL", "RESTORED")}</div>
          <div class="brand-still">${sticker("ERROR 404", "NO PAGE")}</div>
        </div>
        <p class="brand-row"><span class="eyebrow"><span class="index">10</span> SECTION STICKER</span> <span class="soon-tag">COMING SOON</span></p>
        <div class="brand-keys"><button class="bui-key bui-arcade bui-attack" type="button" data-slam-key>${icon("fire", 18)}Slam</button></div>
      </div>
      <div class="panel brand-block">
        <h3>The grid</h3>
        <p class="brand-cap">1px lines, the board under every hero. Four sizes only.</p>
        <ul class="brand-grids">${[44, 30, 22, 20].map((s) => `<li><span class="brand-grid" style="background-size:${s}px ${s}px" aria-hidden="true"></span><span class="bui-label"><b>${s}PX</b>${s === 44 ? " · HERO" : ""}</span></li>`).join("")}</ul>
      </div>
      <div class="panel brand-block brand-arcade">
        <h3>The arcade brick</h3>
        <p class="brand-cap"><code>@fzlt/core/arcade</code>: the shell every page arcade game reuses, the overlay, scoreboard, keys and icons in this kit. It takes over the page, so it plays on its own pages, not this one.</p>
        <div class="brand-keys"><a class="bui-key bui-arcade bui-go" href="../demos/before-ai-2015/">${icon("play", 16)}Play it live</a><a class="bui-key bui-arcade bui-sys" href="../bricks/arcade.html">${icon("book", 16)}The arcade brick</a></div>
      </div>
      <div class="panel brand-block brand-props">
        <h3>Game props</h3>
        <p class="brand-cap">From DOM Battlefield's board: platoon keys with size pips, a round step key with its badge, the pager, a readout, a label and the comms toast.</p>
        <div class="brand-prop-row" inert>
          <button class="bui-key bui-arcade bui-unit" type="button"><b>1</b><span class="bui-pips"><s></s><s></s><s></s></span></button>
          <button class="bui-key bui-arcade bui-unit" type="button" data-hp="hurt"><b>2</b><span class="bui-pips"><s></s><s></s></span></button>
          <button class="bui-key bui-arcade bui-unit" type="button" data-hp="critical"><b>3</b><span class="bui-pips"><s></s></span></button>
          <button class="bui-key bui-orb" type="button">${icon("grid")}<span class="bui-badge">1</span></button>
          <span class="bui-pager"><button class="bui-key bui-arcade bui-sys" type="button" aria-label="Previous unit">${icon("left", 16)}</button><button class="bui-key bui-arcade bui-sys" type="button" aria-label="Your unit">★</button><button class="bui-key bui-arcade bui-sys" type="button" aria-label="Next unit">${icon("right", 16)}</button></span>
        </div>
        <div class="brand-prop-row">
          <div class="bui-readouts"><div class="bui-readout">ELAPSED<b>00:00</b></div><div class="bui-readout" data-tone="team">SIDE<b>A</b></div><div class="bui-readout" data-tone="enemy">SIDE<b>B</b></div></div>
          <span class="bui-label"><b>RADIO</b> · GROUP LABEL</span>
        </div>
        <div class="bui-toast">ROGER · GRID 0412</div>
      </div>
    </div>`)}

<section class="section final" aria-labelledby="final-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <div class="wrap final-inner">
    <p class="eyebrow">FIZLET · V${esc(version)} · MIT</p>
    <h2 id="final-title">By Chris Cooley.</h2>
    <p class="lead">Fizlet is its own brand, made by <a href="${AUTHOR}">Chris Cooley ↗</a>. Fizlet and fzlt are trademarks of Chris Cooley; the code is MIT.</p>
    <div class="final-keys">
      <a class="bui-key bui-arcade bui-go" href="#marks">${icon("down", 16)}The marks</a>
      <a class="bui-key bui-arcade bui-sys" href="${REPO}">${icon("github", 16)}Source on GitHub ↗</a>
    </div>
  </div>
</section>
`;
}
