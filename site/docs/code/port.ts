// Docs code (shown on /guides/port-a-game/): an existing loop handed to the kernel.
import { createEngine } from "fizlet";
declare const host: HTMLElement, seed: number;
declare const game: { measure(): void; update(dt: number, rand: () => number): void; draw(write: (el: HTMLElement, prop: string, v: string) => void): void };
// ---
// Before: game.loop() called requestAnimationFrame, Math.random and el.style itself.
const e = createEngine({ root: host, seed });
e.add({
  read: () => game.measure(),                        // layout reads move here
  step: (e, dt) => game.update(dt, e.random),         // fixed dt, the seeded random
  render: (e) => game.draw((el, prop, v) => e.ledger.style(el, prop, v)), // writes through the ledger
});
e.start(); // one shared rAF; e.destroy() gives the page back
