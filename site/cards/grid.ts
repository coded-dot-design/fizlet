// grid card: a seeded board of rocks and one brick. Tap a cell and A* finds the way, the path draws
// itself and the brick walks it; tap a rock and it crumbles, and a walk that was blocked takes the
// new short cut. Tap a cell walled in and the brick shakes: no path. Nothing is allocated a frame:
// the path goes into a fixed Int32Array, the crumbs come from a fixed pool.
import type { SlotMount } from "../../src/slot";
import { board, BLOCKED } from "../../src/grid";
import { mountCard, ground, brick, ink, faint, W, FLOOR } from "./frame";

const C = 20, COLS = 16, ROWS = 7, Y0 = 22, ROCK = 1, CRUMBS = 48, PACE = 9;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const b = board(COLS, ROWS, { cell: C });
  b.scatter(card.e.random, 0.24, ROCK, 1, BLOCKED);
  b.set(0, 0, 1, 0);
  b.set(1, 0, 1, 0);
  b.set(COLS, 0, 1, 0);
  const path = new Int32Array(COLS * ROWS), xy = new Float64Array(2);
  // unit x, y, step index, steps, goal cell, no-path shake, last path length, expanded, drew a moving frame
  const u = new Float64Array([C / 2, Y0 + C / 2, 0, 0, -1, 0, 0, 0, 0]);
  // Crumbs: x, y, vx, vy, life.
  const cx = new Float64Array(CRUMBS), cy = new Float64Array(CRUMBS), cvx = new Float64Array(CRUMBS), cvy = new Float64Array(CRUMBS), cl = new Float64Array(CRUMBS);
  const label = `${card.tag} ${card.kb}`;
  const here = () => b.at(u[0]!, u[1]! - Y0);
  const plan = (to: number) => {
    u[4] = to;
    const n = b.path(here(), to, path);
    u[7] = b.expanded;
    if (n < 0) return (u[3] = 0), (u[5] = 0.5), (u[6] = -1);
    u[2] = 0;
    u[3] = n;
    u[6] = n;
  };
  card.e.add({
    step(e, dt) {
      let busy = 0;
      if (u[2]! < u[3]!) {
        busy = 1;
        b.center(path[u[2]!]!, xy);
        const dx = xy[0]! - u[0]!, dy = xy[1]! + Y0 - u[1]!, step = PACE * C * dt;
        if (dx * dx + dy * dy <= step * step) (u[0] = xy[0]!), (u[1] = xy[1]! + Y0), (u[2] = u[2]! + 1);
        else (u[0] = u[0]! + Math.sign(dx) * Math.min(step, Math.abs(dx))), (u[1] = u[1]! + Math.sign(dy) * Math.min(step, Math.abs(dy)));
      }
      if (u[5]! > 0) (u[5] = Math.max(0, u[5]! - dt)), (busy = 1);
      for (let i = 0; i < CRUMBS; i++) {
        if (cl[i]! <= 0) continue;
        busy = 1;
        cl[i] = cl[i]! - dt;
        cvy[i] = cvy[i]! + 700 * dt;
        cx[i] = cx[i]! + cvx[i]! * dt;
        cy[i] = cy[i]! + cvy[i]! * dt;
        if (cy[i]! > FLOOR - 3) (cy[i] = FLOOR - 3), (cvy[i] = -cvy[i]! * 0.3), (cvx[i] = cvx[i]! * 0.6);
      }
      if (busy) e.busy();
    },
    render() {
      let moving = card.dirty[0]! || (u[2]! < u[3]! || u[5]! > 0 ? 1 : 0);
      for (let i = 0; i < CRUMBS && !moving; i++) if (cl[i]! > 0) moving = 1;
      if (!moving && !u[8]) return;
      u[8] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      ctx.fillStyle = faint(theme);
      for (let i = 0; i < COLS * ROWS; i++) {
        const x = (i % COLS) * C, y = Y0 + ((i / COLS) | 0) * C;
        if (b.flags[i]! & BLOCKED) (ctx.fillStyle = ink(theme)), ctx.fillRect(x + 2, y + 2, C - 4, C - 4), (ctx.fillStyle = faint(theme));
        else ctx.fillRect(x + C / 2 - 1, y + C / 2 - 1, 2, 2);
      }
      // What is left of the path, from the brick to the goal.
      if (u[2]! < u[3]!) {
        ctx.strokeStyle = card.tone;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(u[0]!, u[1]!);
        for (let k = u[2]!; k < u[3]!; k++) b.center(path[k]!, xy), ctx.lineTo(xy[0]!, xy[1]! + Y0);
        ctx.stroke();
        ctx.fillStyle = card.tone;
        ctx.fillRect(xy[0]! - 4, xy[1]! + Y0 - 4, 8, 8);
      }
      if (u[5]! > 0 && u[4]! >= 0) {
        b.center(u[4]!, xy);
        ctx.strokeStyle = "#ff2b4e";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xy[0]! - 6, xy[1]! + Y0 - 6), ctx.lineTo(xy[0]! + 6, xy[1]! + Y0 + 6);
        ctx.moveTo(xy[0]! + 6, xy[1]! + Y0 - 6), ctx.lineTo(xy[0]! - 6, xy[1]! + Y0 + 6);
        ctx.stroke();
      }
      ctx.fillStyle = ink(theme);
      for (let i = 0; i < CRUMBS; i++) if (cl[i]! > 0) ctx.fillRect(cx[i]! - 2, cy[i]! - 2, 4, 4);
      const shake = u[5]! > 0 ? Math.sin(u[5]! * 60) * 3 : 0;
      brick(card, u[0]! - 8 + shake, u[1]! - 7, 16, 12, card.tone, "", 0, 2);
      brick(card, W - 82, FLOOR - 16, 76, 14, card.tone, label, 0, 2);
    },
  });
  return {
    tap(px, py) {
      const i = b.at(px, py - Y0);
      if (i < 0 || py < Y0 || py > Y0 + ROWS * C) return;
      if (b.flags[i]! & BLOCKED) {
        b.set(i, 0, 1, 0);
        b.center(i, xy);
        for (let k = 0, n = 0; k < CRUMBS && n < 10; k++)
          if (cl[k]! <= 0) (cx[k] = xy[0]!), (cy[k] = xy[1]! + Y0), (cvx[k] = (card.e.random() - 0.5) * 220), (cvy[k] = -80 - card.e.random() * 160), (cl[k] = 1.2), n++;
        if (u[4]! >= 0) plan(u[4]!); // a walk in progress (or a blocked one) takes the short cut
        return;
      }
      plan(i);
    },
    read: () => (u[6]! < 0 ? `NO PATH · ${u[7]} CELLS TRIED` : u[6] ? `A* ${u[6]} STEPS · ${u[7]} CELLS TRIED` : "TAP A CELL · TAP A ROCK"),
  };
});
export default mount;
