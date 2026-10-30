// The test game for the arcade HUD tests (tests/arcade-hud.mjs): a ship that fires up the page,
// with readouts, a meter, two actions (one counted) and an aim toggle it reads. `hudSrc` is the `hud` field's source text
// ("" leaves it out: today's card); `imports` names presets to import from src/arcade.ts.
import { build, transform } from "esbuild";
import { readFileSync } from "node:fs";

export const kit = (await transform(readFileSync("src/ui/board-ui.css", "utf8"), { loader: "css", minify: true })).code;

export async function bundle(hudSrc = "", imports = []) {
  const GAME = `
import { arcade, MODE, PX, PON, KX, FIRE, VW, VH, TARGET_HP${imports.map((i) => ", " + i).join("")} } from "./src/arcade.ts";
export const state = new Float64Array(13); // x, y, score, shots, over, cooldown, kills, clock, rank, armor, streak, strikes, aim lock
const NAMES = ["YOU", "RAVEN", "BISON", "VIPER"];
// A preset seen from the test: its mounted view and the run (the public ArcadeHud contract).
const spy = (h) => ({ ...h, mount(r) { const v = h.mount(r); window.__hud = { v, r }; return v; } });
export function launch(options = {}, set = {}) {
  return arcade({
    id: "test-game", title: "Test Game", color: "#06c4ff", css: ${JSON.stringify(kit)}, fire: true,
    hint: "Fire up the page", actions: [{ id: "end", key: "KeyK", label: "K · End" }, { id: "strike", key: "KeyB", label: "B · Strike" }],
    readouts: [["Score", "team", (v) => String(v).padStart(6, "0")], ["Shots", undefined, undefined, true]],
    meter: { label: "Progress" }, colors: ["#06c4ff"], cues: { fire: "fire" },${hudSrc ? `\n    hud: ${hudSrc},` : ""}
    create(ctx) {
      const e = ctx.engine, c = ctx.ctl, s = state;
      e.add({ step(_, dt) {
        if (s[4]) return;
        if (e.steps === 1) (s[0] = c[VW] / 2), (s[1] = c[VH] * 0.8);
        s[0] = Math.min(Math.max(s[0] + c[KX] * 300 * dt, 10), c[VW] - 10);
        if (c[MODE] === 1 && c[PON]) s[0] += Math.sign(c[PX] - s[0]) * Math.min(Math.abs(c[PX] - s[0]), 300 * dt);
        if (set.clock) s[7] -= dt;
        if ((s[5] -= dt) <= 0 && c[FIRE]) {
          s[5] = 0.1; s[3]++;
          const i = ctx.board.hit(s[0], s[1], s[0], 0);
          if (i >= 0 && ctx.board.consume(i, "binary")) (s[2] += 2), s[6]++, e.events.emit("kill", 0, (s[6] % 3) + 1);
          e.events.emit("fire");
        }
        if (ctx.input.hit("strike") && s[11] > 0) s[11]--, e.events.emit("streak", 3);
        if (ctx.input.hit("end")) s[4] = 1;
        s[12] = ctx.input.down("aim-lock") ? 1 : 0;
      } });
      c[TARGET_HP] = 100;
      return {
        reset() { s.fill(0); s[7] = 180; s[8] = 1; s[9] = 1; s[11] = 2; },
        over: () => s[4],
        draw(g) { g.fillStyle = "#06c4ff"; g.fillRect(s[0] - 6, s[1] - 6, 12, 12); },
        // The card: score, shots, then the meter's change key. Skirmish: kills, clock, rank, armor, streak, strikes.
        hud(out) { if (set.sk) for (let i = 0; i < 6; i++) out[i] = s[i + 6]; else (out[0] = s[2]), (out[1] = s[3]), (out[2] = s[2]); },
        meter: () => ["BITS", s[2] + " / 40", s[2] / 40],
        stats: () => ({ score: s[2], shots: s[3], kills: s[6] }),
      };
    },
  }, options);
}
export const names = NAMES;`;
  return (await build({ stdin: { contents: GAME, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "iife", globalName: "T", write: false, logLevel: "silent" })).outputFiles[0].text;
}

export const page = (js) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font:18px/1.6 system-ui;background:#101514;color:#e1ebdb">
<main id="board" style="max-width:900px;margin:auto;padding:30px">
<h1 style="font-size:56px">The page is the board.</h1>
<p>Real words and <a href="#away" id="link">a link</a>. Every letter here is terrain for the test ship to shoot at.</p>
<p>More words, more letters, more terrain all the way across the line so the ship always hits something.</p>
<button id="factory">A factory</button>
</main><script>${js}</script></body></html>`;

/** The scoreboard's markup (the shadow root), timer ids left out (they count setTimeout calls). */
export const shadowHtml = (p) => p.evaluate(() => document.querySelector("[data-fizlet-host=test-game]").shadowRoot.innerHTML.replace(/ data-timer="\d+"/g, ""));
