// The Origin section on the home page: the title loop (Code or Design), the Sound key, the hero stage
// (the 2015 desk at night; the scene mounts by the contract in README.md) and, below it, 2015 by hand
// against Fizlet, with the Before AI: 2015 note.
// Facts: only from the Before AI: 2015 note (fizlet#209, site/notes/before-ai-2015.json, its numbers
// measured there) and the fizlet-engine origin-story handoff; the title is Chris's own line.
// The note and the companion page are linked once they are on the site (checked at build time).
import { existsSync } from "node:fs";
import { icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { poster } from "./poster.mjs";

export const WAYBACK = "https://web.archive.org/web/20150423171151/http://chriscooley.me/projects/css-animations";

// Chris's words on why Fizlet exists (relayed by Quill). One wording, one source: ORIGIN_WHY in
// copy.ts on fizlet branch hero/origin-scene. Import that constant here once it lands.
export const WHY = "There were a lot of animations before Fizlet, and in between. We kept writing the same thing over and over, a little different each time for a slightly different use. So we built Fizlet to make it easier for us. Then we figured other people could get something out of it too, so we open-sourced it.";

const OLD = [
  ["Sprite sheets", "Every frame drawn in Illustrator, laid side by side on one sheet, exactly one frame-width apart. Shift a frame by a pixel and the animation jumps."],
  ["<code>steps(n)</code>", "The keyframes slide <code>background-position</code> and <code>steps(n)</code> cuts it frame to frame: the cup fills in <code>steps(11)</code>, 11 jumps of 84 px in 0.6 s."],
  ["Angular", "A click adds or removes one class (<code>paused</code>, <code>close</code>, <code>drinkMe</code>) and the class swaps the animation. Route transitions written by hand."],
];
const NEW = [
  ["Same art", "The same frames, timings and clicks, rebuilt on the kernel."],
  ["Bricks", "<code>fizlet/fx</code> for the notes, splash, steam and code; <code>fizlet/sound</code> for the thump, clack and slurp; <code>fizlet/hud</code> for the score."],
  ["Settles", "Real buttons, keyboard, still frames under reduced motion, and no frames at all once a round is over."],
];
const list = (rows) => `<ul class="og-list">${rows.map(([t, b]) => `<li><b>${t}</b><span>${b}</span></li>`).join("")}</ul>`;

/** The section. `sizes`: { loader, scene, poster } gzip bytes from site/origin/build.mjs. */
export function originSection({ sizes, base = "./" }) {
  const note = existsSync("site/notes/before-ai-2015.json"), demo = existsSync("site/demos/before-ai-2015");
  const links = [
    note && `<a class="bui-key bui-arcade bui-go" href="${base}notes/before-ai-2015/">${icon("book", 16)}Read: Before AI: 2015</a>`,
    demo && `<a class="bui-key bui-arcade bui-sys" href="${base}demos/before-ai-2015/">${icon("play", 16)}Play all three</a>`,
    `<a class="og-wayback" href="${WAYBACK}">THE 2015 CAPTURE · WAYBACK MACHINE ↗</a>`,
  ].filter(Boolean).join("");
  return `<!-- ORIGIN: 2015, the desk at night. The scene mounts by the contract in site/origin/README.md. -->
<section id="origin" class="section origin has-grid" data-reveal data-origin data-mode="code" aria-labelledby="origin-title">
  <div class="wrap">
    <div class="og-head">
      <p class="eyebrow"><span class="index">2015</span> THE ORIGIN · BEFORE AI</p>
      <h2 id="origin-title" class="og-title"><span class="og-word" data-origin-word>Code.</span> Sleep.<br><em>Drink. Repeat.</em><span class="og-loop" aria-hidden="true">↻</span></h2>
      <div class="og-keys">
        <button class="og-mode" type="button" role="switch" aria-checked="false" aria-label="Design mode" data-origin-mode><span class="og-opt">Code</span><i aria-hidden="true"></i><span class="og-opt">Design</span></button>
        <button class="bui-key bui-icon-key og-sound" type="button" data-origin-sound aria-pressed="false" aria-label="Sound"><span class="snd-off">${icon("mute")}</span><span class="snd-on">${icon("sound")}</span></button>
        <span class="og-meta bui-label"><b>SOUND</b> · OFF UNTIL YOU PRESS IT</span>
      </div>
      <p class="lead">Fizlet started long before Fizlet. In 2015, years before AI coding tools, Chris Cooley drew three clickable micro animations by hand: headphones that plug in and play, a cup of coffee that fills, a laptop that opens and types. The Wayback Machine captured them on 23 April 2015.</p>
    </div>
    <div class="og-stage panel lit" data-demo-host>
      <div class="og-chrome"><span class="og-chip">2015</span><span class="og-chip alt">THE DESK AT NIGHT</span><span class="og-chip ghost" data-origin-chip>MODE · <b class="og-m-code">CODE</b><b class="og-m-design">DESIGN</b></span></div>
      <figure class="ae-slot og-fig" data-slot-target="home#origin" data-mode="code" role="img" aria-label="A desk at night in 2015: headphones, a cup of coffee, an open laptop and a phone.">${poster()}</figure>
      ${sizeBadge(sizes.scene, "origin/scene.js", "the origin placeholder scene: the kernel and the desk")}
      <p class="hero-cap bui-label"><b>PLACEHOLDER</b> · the origin scene lands here · tap the desk · it loads only once it nears the screen</p>
    </div>
    <div class="og-below">
      <article class="panel og-card og-old" aria-labelledby="og-old">
        <span class="og-chip">2015 · BY HAND</span>
        <h3 id="og-old">The old-school headache</h3>
        ${list(OLD)}
        <p class="og-stat"><b>About a week</b><small>Chris's estimate, as an experiment; most of it drawing the frames</small></p>
      </article>
      <span class="og-vs" aria-hidden="true">VS</span>
      <article class="panel lit og-card og-new" aria-labelledby="og-new">
        <span class="og-chip alt">2026 · FIZLET</span>
        <h3 id="og-new">The new one, in minutes</h3>
        ${list(NEW)}
        <p class="og-stat"><b>About six minutes</b><small>of agent time for the remake, measured on the container clock</small></p>
      </article>
    </div>
    <ul class="og-nums" aria-label="2015 against Fizlet, measured in the Before AI: 2015 note">
      <li><b>1,870 B</b><small>2015, gzip: the original CSS plus a four-line script</small></li>
      <li><b>4,025 B</b><small>the remake's JS, gzip, the kernel included</small></li>
      <li><b>11,289 B</b><small>the arcade's JS, gzip: kernel, fx, sound, hud</small></li>
      <li><b>0</b><small>frames a second the arcade asks for once a round is over</small></li>
    </ul>
    <figure class="panel og-why"><span class="og-chip ghost">WHY FIZLET · IN CHRIS'S WORDS</span><blockquote>“${WHY}”</blockquote><figcaption class="bui-label">— <b>CHRIS COOLEY</b></figcaption></figure>
    <figure class="og-quote"><blockquote>“Fizlet makes creativity the only blocker, and I have a lot of that!”</blockquote><figcaption class="bui-label">— <b>CHRIS COOLEY</b></figcaption></figure>
    <div class="split-keys og-links">${links}</div>
  </div>
</section>`;
}
