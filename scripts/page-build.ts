// The page build: what a hero or an interactive diagram ships (fizlet-engine docs/LAYERS.md, "Page
// interactions"). Kernel + slot + input + fx, and nothing a game-only brick brings (sound, debug,
// pad, hud, match, board-page, ui). scripts/sizes.mjs budgets it; tests/page.test.mjs checks its inputs.
export { createEngine } from "../src/kernel/index";
export { slot } from "../src/slot";
export { controls } from "../src/input";
export { effects } from "../src/fx";
