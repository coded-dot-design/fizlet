// 404: served by Pages at any depth, so every link is absolute (base "/fizlet/").
import { icon } from "../layout.mjs";

export const notFound = (base) => `
<section class="section lost" aria-labelledby="lost-title">
  <div class="wrap lost-inner">
    <div class="lost-board" aria-hidden="true"><div class="bui-sticker"><span>ERROR 404</span><b>NO PAGE</b></div></div>
    <h1 id="lost-title">This square is off the board.</h1>
    <p class="lead">Nothing lives at this address. The engine, the bricks and the quick start are all on the home page.</p>
    <div class="final-keys"><a class="bui-key bui-arcade bui-go" href="${base}">${icon("play", 16)}Fizlet home</a><a class="bui-key bui-arcade bui-sys" href="${base}#start">${icon("down", 16)}Quick start</a></div>
  </div>
</section>`;
