// grid demo: a seeded board; click a cell for the A* path from the top-left corner. No engine and
// no loop: a click draws one frame. The path buffer is made once and reused.
import { board, BLOCKED } from "../../src/grid";
import { seeded } from "../../src/index";
import { stage, ink, line } from "./common";

export default function gridDemo(host: HTMLElement) {
  const COLS = 24, ROWS = 10, CELL = 26, W = COLS * CELL, H = ROWS * CELL;
  const { ctx, at, c } = stage(host, W, H, "A seeded board. Click a cell for the shortest path from the top-left corner");
  const b = board(COLS, ROWS, { cell: CELL, diagonal: true });
  b.scatter(seeded(7), 0.22, 1, 1, BLOCKED);
  b.set(0, 0, 1, 0);
  const out = new Int32Array(COLS * ROWS), p = new Float64Array(2), mid = new Float64Array(2);
  const note = host.querySelector<HTMLElement>("[data-status]")!;
  const draw = (n: number) => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = line();
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = (i % COLS) * CELL, y = ((i / COLS) | 0) * CELL;
      if (b.flags[i]! & BLOCKED) {
        ctx.fillStyle = ink();
        ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      } else ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    }
    ctx.fillStyle = "#39ffb0";
    ctx.fillRect(4, 4, CELL - 8, CELL - 8);
    ctx.fillStyle = "#ff2e88";
    for (let k = 0; k < n; k++) {
      b.center(out[k]!, mid);
      ctx.fillRect(mid[0]! - 5, mid[1]! - 5, 10, 10);
    }
  };
  c.addEventListener("pointerdown", (ev) => {
    at(ev, p);
    const n = b.path(0, b.at(p[0]!, p[1]!), out);
    draw(Math.max(0, n));
    note.textContent = n < 0 ? "NO PATH · blocked" : `${n} steps · ${b.expanded} cells searched`;
  });
  draw(0);
}
