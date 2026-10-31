// @fzlt/core/arcade composes a run's stylesheet as the game's kit CSS + the shared BASE + the HUD
// preset's own CSS. Every preset must leave BASE out of its own CSS, or the overlay rules ship and
// parse twice (the skirmish preset carried a second copy until the brick audit, 2026-10-30).
import assert from "node:assert/strict";
import { test } from "node:test";
import { BASE } from "../src/arcade-parts.ts";
import { arcadeHud, skirmishHud } from "../src/arcade.ts";

test("arcade: each HUD preset's CSS leaves BASE to the shell (one copy per run)", () => {
  for (const [name, hud] of [["arcade", arcadeHud()], ["skirmish", skirmishHud({ readouts: [] })]]) {
    const run = "/* kit */" + BASE + hud.css; // what arcade() mounts
    assert.equal(run.split(":host{all:initial").length - 1, 1, `${name}: the overlay host rule once`);
    assert.ok(!hud.css.includes(BASE.trim().slice(0, 40)), `${name}: no BASE in the preset`);
  }
});
