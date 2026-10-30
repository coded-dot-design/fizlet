// Docs code (shown on /docs/getting-started/ from the "// ---" line on): typechecked against the
// source by `npm run typecheck`, so a listing on the site can't drift from the API.
// ---
import { createEngine } from "fizlet";

const root = document.querySelector("#game")!;
const engine = createEngine({ root, seed: 7 });
const sparks = engine.pool("sparks", 64, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));

engine.add({
  read(e) { /* measure the page here, once a frame */ },
  step(e, dt) { /* the simulation: fixed 60 Hz, no DOM, no allocation */ },
  render(e, alpha) { /* change-only DOM writes through e.ledger */ },
});
engine.start();

// Later: Recall. Every listener goes, every page change is undone.
engine.destroy();
