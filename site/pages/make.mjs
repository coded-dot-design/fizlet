// "Make one" (/make/), v0: type a prompt, get a drop-in snippet built on the engine, made entirely
// in the browser from the recipe table (no server, no model, no tracking). The page is rendered with
// the default prompt's snippet already made (built in Node the way the page makes it), so the
// download works before any script runs; site/make/page.mjs takes over from there.
import { esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { matchedHtml, missHtml, recipeText } from "../make/render.mjs";

export const DEFAULT_PROMPT = "pink sparks burst where you tap";
const TRY = ["gentle cyan bubbles rise from the bottom", "rainbow confetti falls forever", "a scanline sweep that lights up every heading it passes", "neon rain that pools on the buttons you hover"];

/** `made`: the default prompt's snippet ({ spec, text, size }); `script`: make.js gzip bytes; `recipes`: the recipe names. */
export function makePage({ made, script, recipes, base }) {
  const { spec } = made;
  return `
<section class="section" aria-labelledby="make-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">V0</span> MAKE ONE · IN YOUR BROWSER</p>
      <h1 id="make-title">Type a prompt.<br><em>Get a snippet.</em></h1>
      <p class="lead">Say what should move. This page matches your words against the ${recipes.length} recipes the <a href="${base}gallery/">gallery</a> is made from (${recipes.map(esc).join(", ")}) and hands you one file to paste into any page: a mount and one module script with only the bricks it uses, its size measured into its own header. By <a href="https://coded.design/">Chris Cooley ↗</a>, MIT.</p>
      <p class="make-badge">${sizeBadge(script, "make/make.js", "this page's script")}</p>
    </div>
    <form class="panel make-form" data-make action="./" method="get">
      <label class="bui-label" for="make-prompt"><b>PROMPT</b> · what should move</label>
      <div class="make-row">
        <input id="make-prompt" name="p" type="text" maxlength="200" minlength="3" required autocomplete="off" spellcheck="false" value="${esc(DEFAULT_PROMPT)}">
        <button class="bui-key bui-arcade bui-go" type="submit">${icon("bolt", 16)}Make it</button>
      </div>
      <p class="make-try"><span class="bui-label">TRY</span> ${TRY.map((t) => `<button class="bui-key copy" type="button" data-try="${esc(t)}">${esc(t)}</button>`).join(" ")}</p>
      <p class="make-private">${icon("check", 16)}<span>Your prompt never leaves this page: it is matched here, in your browser. Words no recipe knows are shown to you and logged nowhere: no server, no analytics, no tracking.</span></p>
    </form>
    <div class="make-out" data-out data-id="${esc(spec.id)}">
      <div class="make-stage" data-stage><p class="make-still">The live preview plays here.</p></div>
      <div class="panel make-meta">
        <p class="eyebrow">RECIPE <b data-recipe>${esc(recipeText(spec))}</b></p>
        <h2>What matched</h2>
        <ul class="make-matched" data-matched aria-label="Words that matched">${matchedHtml(spec)}</ul>
        <p class="make-miss" data-miss>${missHtml(spec)}</p>
        <p><span class="size-badge" data-snippet-size><b>${made.size.toLocaleString("en-US")} B</b><small>gzip · the whole snippet</small></span></p>
        <div class="split-keys make-keys">
          <button class="bui-key bui-arcade bui-sys" type="button" data-copy-snippet>${icon("copy", 16)}Copy snippet</button>
          <a class="bui-key bui-arcade bui-go" data-download href="default.snippet.txt" download="fizlet-${esc(spec.id)}.html">${icon("down", 16)}Download</a>
        </div>
        <p class="make-status" data-status role="status">Made “${esc(spec.title)}”: ${made.size.toLocaleString("en-US")} B gzip.</p>
      </div>
      <div class="panel code-card make-code">
        <div class="code-head"><label class="bui-label" for="make-code"><b>SNIPPET</b> · paste it where it should play</label></div>
        <textarea id="make-code" class="code" data-code readonly rows="10" spellcheck="false">${esc(made.text)}</textarea>
      </div>
    </div>
  </div>
</section>`;
}
