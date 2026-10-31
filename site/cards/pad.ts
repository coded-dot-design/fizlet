// pad card: shove the crates home. A top-down yard with three crates and three docks along the top
// wall; your brick is driven by the Board UI kit's real on-screen pad (the stick under the left
// thumb, SHOVE and SWAP under the right), the arrow keys, or a tap on the yard (it drives there).
// The brick pushes whatever it touches; SHOVE dashes, and a crate it hits mid-dash slides on its
// own until friction or a wall stops it. A crate that comes to rest on a dock locks in. SWAP turns
// the stick into a d-pad and back: the step reads the same intents either way.
import type { SlotMount } from "../../src/slot";
import type { Controls } from "../../src/input";
import { controls } from "../../src/input";
import { pad } from "../../src/pad";
import { mountCard, kit, brick, ink, faint, W, H } from "./frame";

// The yard (drawing units), between the move control (left) and the keys (right).
const X0 = 88, X1 = 252, Y0 = 26, Y1 = 192, R = 18, C = 18, N = 3, SPEED = 95, DASH = 260, DOCK_Y = Y0 + 12;
const DX = [118, 170, 222], SX = [128, 172, 212], SY = [120, 92, 146];
const SHOVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h11M11 6l6 6-6 6M20 5v14"/></svg>';
const SWAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h13l-4-4M19 15H6l4 4"/></svg>';

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const e = card.e;
  // Rover: x, y, vx, vy, facing x, facing y, dash time, target x, target y, swaps, drew a moving
  // frame, docked count, clear timer, has target, shoves, bump flash
  const s = new Float64Array([170, 172, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  // Crates: x, y, vx, vy, docked at (dock + 1, 0 none), lock flash.
  const cx = new Float64Array(N), cy = new Float64Array(N), cvx = new Float64Array(N), cvy = new Float64Array(N), cf = new Float64Array(N);
  const cd = new Uint8Array(N), dockUsed = new Uint8Array(N);
  const reset = () => {
    for (let i = 0; i < N; i++) (cx[i] = SX[i]!), (cy[i] = SY[i]!), (cvx[i] = cvy[i] = 0), (cd[i] = 0), (dockUsed[i] = 0), (cf[i] = 0);
    s[11] = 0;
  };
  reset();
  const ctl = controls(e, { keys: { up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS"], left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"], shove: ["Space"] }, target: card.c, stick: false });
  // The stick's vector, kept here as the pad drives it (the step reads a typed array, never a
  // getter or a call that returns a fractional double: those box).
  const st = new Float64Array(2);
  // A swap is a DOM change (new control markup): made in the key's own handler, never in a step.
  const swap = () => (p.setScheme(p.scheme === "stick" ? "dpad" : "stick"), (s[9] = s[9]! + 1));
  const via = {
    press(intent: string, down = true) {
      if (intent === "swap") return void (down && swap());
      ctl.press(intent, down);
    },
    down: ctl.down,
    steer(x: number, y: number, on = true) {
      st[0] = on ? x : 0;
      st[1] = on ? y : 0;
      ctl.steer(x, y, on);
    },
  } as unknown as Controls;
  const root = kit(card);
  const p = pad(e, via, {
    host: root,
    scheme: "stick",
    actions: [
      { intent: "shove", label: "SHOVE", name: "Shove (Space)", icon: SHOVE, key: "SPACE", role: "advance" },
      { intent: "swap", label: "SWAP", name: "Swap the stick and the d-pad (Q)", icon: SWAP, key: "Q", role: "sys" },
    ],
  });
  // The keys stack in one column (SWAP above SHOVE), so the yard keeps the middle of the card.
  (p.el.lastChild as HTMLElement).style.maxWidth = "calc(100 * var(--u))";
  addEventListener("keydown", (ev) => ev.code === "KeyQ" && !ev.repeat && !(ev.target as Element).closest?.("input,textarea,select,[contenteditable]") && swap(), { signal: e.signal });

  const label = `${card.tag} ${card.kb}`;
  const h = (R + C) / 2;

  e.add({
    step(e, dt) {
      let busy = 0;
      // Intents: keys, the d-pad (press) or the stick (st); a tap's target when nothing is held.
      let ax = st[0]! + (ctl.down("right") ? 1 : 0) - (ctl.down("left") ? 1 : 0);
      let ay = st[1]! + (ctl.down("down") ? 1 : 0) - (ctl.down("up") ? 1 : 0);
      if (ax !== 0 || ay !== 0) s[13] = 0;
      else if (s[13]) {
        const tx = s[7]! - s[0]!, ty = s[8]! - s[1]!, d = Math.sqrt(tx * tx + ty * ty);
        if (d < 2) s[13] = 0;
        else (ax = tx / d), (ay = ty / d), d < 14 && ((ax *= d / 14), (ay *= d / 14));
      }
      const m = Math.sqrt(ax * ax + ay * ay);
      if (m > 1) (ax /= m), (ay /= m);
      if (m > 0.2) (s[4] = ax / (m > 1 ? 1 : m)), (s[5] = ay / (m > 1 ? 1 : m));
      if (ctl.hit("shove") && s[6]! <= 0) {
        s[6] = 0.22;
        s[14] = s[14]! + 1;
        s[2] = s[4]! * DASH;
        s[3] = s[5]! * DASH;
      }
      if (s[6]! > 0) (s[6] = s[6]! - dt), (busy = 1);
      else {
        const k = Math.min(1, 12 * dt);
        s[2] = s[2]! + (ax * SPEED - s[2]!) * k;
        s[3] = s[3]! + (ay * SPEED - s[3]!) * k;
      }
      if (s[2]! * s[2]! + s[3]! * s[3]! < 0.5 && m === 0) s[2] = s[3] = 0;
      s[0] = Math.max(X0 + R / 2, Math.min(X1 - R / 2, s[0]! + s[2]! * dt));
      s[1] = Math.max(Y0 + R / 2, Math.min(Y1 - R / 2, s[1]! + s[3]! * dt));
      if (s[2] !== 0 || s[3] !== 0 || s[13]) busy = 1;

      for (let i = 0; i < N; i++) {
        if (cf[i]! > 0) (cf[i] = cf[i]! - dt), (busy = 1);
        if (s[15]! > 0) s[15] = s[15]! - dt;
        const ox: number = h - Math.abs(cx[i]! - s[0]!), oy: number = h - Math.abs(cy[i]! - s[1]!);
        if (ox > 0 && oy > 0) {
          // The push: out along the shallow axis. A docked crate is a wall: the brick moves instead.
          const sx: number = cx[i]! > s[0]! ? 1 : -1, sy: number = cy[i]! > s[1]! ? 1 : -1;
          if (cd[i]) {
            if (ox < oy) s[0] = s[0]! - sx * ox;
            else s[1] = s[1]! - sy * oy;
          } else if (ox < oy) {
            cx[i] = cx[i]! + sx * ox;
            // Mid-dash, the crate takes the brick's speed and slides on its own; a push just carries it.
            if (s[6]! > 0) (cvx[i] = s[2]! * 1.1), (s[2] = s[2]! * 0.25), (s[6] = 0);
          } else {
            cy[i] = cy[i]! + sy * oy;
            if (s[6]! > 0) (cvy[i] = s[3]! * 1.1), (s[3] = s[3]! * 0.25), (s[6] = 0);
          }
        }
        if (cd[i]) continue;
        cx[i] = cx[i]! + cvx[i]! * dt;
        cy[i] = cy[i]! + cvy[i]! * dt;
        const f = Math.max(0, 1 - 4.5 * dt);
        cvx[i] = cvx[i]! * f;
        cvy[i] = cvy[i]! * f;
        if (cvx[i]! * cvx[i]! + cvy[i]! * cvy[i]! < 4) cvx[i] = cvy[i] = 0;
        else busy = 1;
        // Walls stop a crate dead; a crate pinned by a wall pushes the brick back out.
        const lo = X0 + C / 2, hi = X1 - C / 2, top = Y0 + C / 2, bot = Y1 - C / 2;
        if (cx[i]! < lo || cx[i]! > hi) (cvx[i] = 0), (s[15] = 0.15), (cx[i] = cx[i]! < lo ? lo : hi);
        if (cy[i]! < top || cy[i]! > bot) (cvy[i] = 0), (s[15] = 0.15), (cy[i] = cy[i]! < top ? top : bot);
      }
      // Crate on crate: separate along the shallow axis, trade speed along it.
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          const ox = C - Math.abs(cx[i]! - cx[j]!), oy = C - Math.abs(cy[i]! - cy[j]!);
          if (ox <= 0 || oy <= 0) continue;
          const a = cd[i] ? 0 : cd[j] ? 1 : 0.5, b = 1 - a;
          if (ox < oy) {
            const sx = cx[j]! > cx[i]! ? 1 : -1;
            cx[i] = cx[i]! - sx * ox * a;
            cx[j] = cx[j]! + sx * ox * b;
            const v = cvx[i]!;
            cvx[i] = cd[j] ? 0 : cvx[j]!;
            cvx[j] = cd[j] ? 0 : v;
          } else {
            const sy = cy[j]! > cy[i]! ? 1 : -1;
            cy[i] = cy[i]! - sy * oy * a;
            cy[j] = cy[j]! + sy * oy * b;
            const v = cvy[i]!;
            cvy[i] = cd[j] ? 0 : cvy[j]!;
            cvy[j] = cd[j] ? 0 : v;
          }
        }
      // The brick never ends inside a crate (a crate pinned at a wall, or a docked one).
      for (let i = 0; i < N; i++) {
        const ox: number = h - Math.abs(cx[i]! - s[0]!), oy: number = h - Math.abs(cy[i]! - s[1]!);
        if (ox > 0 && oy > 0) {
          if (ox < oy) s[0] = s[0]! - (cx[i]! > s[0]! ? ox : -ox);
          else s[1] = s[1]! - (cy[i]! > s[1]! ? oy : -oy);
        }
      }
      // Docking: a crate at rest within 7 units of a free dock locks onto it.
      for (let i = 0; i < N; i++) {
        if (cd[i] || cvx[i] !== 0 || cvy[i] !== 0) continue;
        for (let d = 0; d < N; d++)
          if (!dockUsed[d] && Math.abs(cx[i]! - DX[d]!) < 7 && Math.abs(cy[i]! - DOCK_Y) < 7) {
            cd[i] = d + 1;
            dockUsed[d] = 1;
            cx[i] = DX[d]!;
            cy[i] = DOCK_Y;
            cf[i] = 0.5;
            s[11] = s[11]! + 1;
            if (s[11] === N) s[12] = 1.4;
            busy = 1;
            break;
          }
      }
      if (s[12]! > 0) {
        busy = 1;
        s[12] = s[12]! - dt;
        if (s[12]! <= 0) (s[12] = 0), reset();
      }
      if (busy) e.busy();
    },
    render() {
      let moving = card.dirty[0]! || s[2] !== 0 || s[3] !== 0 || s[12]! > 0 ? 1 : 0;
      for (let i = 0; i < N; i++) if (cvx[i] !== 0 || cvy[i] !== 0 || cf[i]! > 0) moving = 1;
      if (!moving && !s[10]) return;
      s[10] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ctx.clearRect(0, 0, W, H);
      // The yard: a faint floor grid inside a rim.
      ctx.fillStyle = faint(theme);
      for (let x = X0 + 20; x < X1; x += 20) ctx.fillRect(x, Y0, 1, Y1 - Y0);
      for (let y = Y0 + 20; y < Y1; y += 20) ctx.fillRect(X0, y, X1 - X0, 1);
      ctx.strokeStyle = s[15]! > 0 ? card.tone : ink(theme);
      ctx.lineWidth = 2;
      ctx.strokeRect(X0 - 1, Y0 - 1, X1 - X0 + 2, Y1 - Y0 + 2);
      // Docks: dashed squares on the top wall, filled once a crate locks in.
      ctx.setLineDash(DASHES);
      for (let d = 0; d < N; d++) {
        ctx.strokeStyle = dockUsed[d] ? card.tone : ink(theme);
        ctx.strokeRect(DX[d]! - C / 2 - 3, DOCK_Y - C / 2 - 3, C + 6, C + 6);
      }
      ctx.setLineDash(NONE);
      for (let i = 0; i < N; i++) {
        const lit = cf[i]! > 0 && ((cf[i]! * 12) | 0) % 2 === 0;
        brick(card, cx[i]! - C / 2, cy[i]! - C / 2, C, C, cd[i] ? (lit ? "#ffffff" : "#39ffb0") : ink(theme), "", 0, 2);
      }
      // The brick, with a nose on the side it faces.
      brick(card, s[0]! - R / 2, s[1]! - R / 2, R, R, card.tone, "", s[6]! > 0 ? 0.4 : 0, 3);
      ctx.fillStyle = "#07060f";
      ctx.fillRect(s[0]! + s[4]! * 5 - 2, s[1]! + s[5]! * 5 - 2, 4, 4);
      if (s[12]! > 0) {
        ctx.fillStyle = card.tone;
        ctx.font = "800 14px ui-monospace, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ALL HOME", (X0 + X1) / 2, (Y0 + Y1) / 2);
      }
      // The name brick sits over the move control, where nothing in the yard reaches.
      brick(card, 8, 100, 72, 14, card.tone, label, 0, 2);
    },
  });
  return {
    tap(x, y) {
      // On the brick: a shove. Anywhere else: drive there.
      if (Math.abs(x - s[0]!) < R && Math.abs(y - s[1]!) < R) ctl.press("shove"), ctl.press("shove", false);
      else (s[7] = Math.max(X0 + R / 2, Math.min(X1 - R / 2, x))), (s[8] = Math.max(Y0 + R / 2, Math.min(Y1 - R / 2, y))), (s[13] = 1);
    },
    // The stick while it is held, the score otherwise (a card's readout fits one line at 390 px).
    read: () => (st[0] || st[1] ? `STICK ${st[0]!.toFixed(1)},${st[1]!.toFixed(1)}` : `${p.scheme === "dpad" ? "D-PAD" : "HOME"} ${s[11]}/${N}`),
  };
});
const DASHES = [4, 3], NONE: number[] = [];
export default mount;
