import {
  atan2,
  cos,
  hypot,
  sin
} from "./chunk-3IN3G3AQ.js";
import {
  need
} from "./chunk-RA74YNEB.js";

// src/steer.ts
var turn = (from, to, max) => {
  const d = atan2(sin(to - from), cos(to - from));
  return from + Math.sign(d) * Math.min(Math.abs(d), max);
};
function steer(o) {
  const num = (k, d) => need(o[k] ?? d, k);
  const n = need(o.cap, "cap", 2), speed = num("speed", 150), scale = num("scale", 1), rate = num("turn", 7), stop = num("stop", 16);
  const near = num("near", 14), slow = num("slow", 140), fast = num("fast", 1.05), calm = num("calm", 0.8), far = num("far", 240);
  const every = num("every", 2), jitter = num("jitter", 2), area = o.area ?? [0, 0, 640, 480];
  for (let i = 0; i < 4; i++) need(area[i], "area[" + i + "]");
  const blocked = o.blocked, random = o.random ?? Math.random;
  const x = new Float64Array(n), y = new Float64Array(n), a = new Float64Array(n);
  const gx = new Float64Array(n), gy = new Float64Array(n), think = new Float64Array(n), leg = new Uint32Array(n);
  const v = new Float64Array(3), at = new Float64Array(2), moved = new Float64Array(n);
  function go(i) {
    const m = Math.min(1, hypot(v[0], v[1]));
    if (m < 0.05) return void (moved[i] = 0);
    const to = atan2(v[1], v[0]), d = atan2(sin(to - a[i]), cos(to - a[i])), dt = v[2];
    a[i] = a[i] + Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    const sp = speed * m * scale * dt, nx = x[i] + cos(a[i]) * sp, ny = y[i] + sin(a[i]) * sp;
    at[0] = nx;
    at[1] = y[i];
    if (!blocked?.(i, at)) x[i] = nx;
    at[0] = x[i];
    at[1] = ny;
    if (!blocked?.(i, at)) y[i] = ny;
    moved[i] = sp;
  }
  function toward(i, pace, within) {
    const dx = v[0] - x[i], dy = v[1] - y[i], d = hypot(dx, dy);
    if (d <= within) return void (moved[i] = 0);
    v[0] = dx / d;
    v[1] = dy / d;
    v[2] = v[2] * (pace < 0 ? d > slow ? fast : calm : pace);
    go(i);
  }
  return {
    x,
    y,
    a,
    /** The goal: wander's current one (and seconds until it picks the next), or one the game writes for `arriveGoal`. */
    gx,
    gy,
    think,
    /** Patrol: the waypoint each mover is heading for. */
    leg,
    cap: n,
    /** Put mover i at (px, py) facing `heading`; wander picks a goal at once, patrol starts at 0. */
    place(i, px, py, heading = 0) {
      x[i] = gx[i] = px;
      y[i] = gy[i] = py;
      a[i] = heading;
      think[i] = 0;
      leg[i] = 0;
    },
    /** Pixels each mover went on its last call (0 when it stood). */
    moved,
    /** Drive mover i along (ax, ay) (a stick, length ≤ 1) for dt seconds. */
    drive(i, ax, ay, dt) {
      v[0] = ax;
      v[1] = ay;
      v[2] = dt;
      go(i);
    },
    /** Toward (tx, ty) at `pace` (dt is scaled by it, so the turn slows too), until inside `stop`. */
    seek(i, tx, ty, dt, pace = 1) {
      v[0] = tx;
      v[1] = ty;
      v[2] = dt;
      toward(i, pace, stop);
    },
    flee(i, fx, fy, dt, pace = 1) {
      const dx = x[i] - fx, dy = y[i] - fy, d = hypot(dx, dy);
      if (d >= far || d === 0) return void (moved[i] = 0);
      v[0] = dx / d;
      v[1] = dy / d;
      v[2] = dt * pace;
      go(i);
    },
    arrive(i, tx, ty, dt) {
      v[0] = tx;
      v[1] = ty;
      v[2] = dt;
      toward(i, -1, near);
    },
    /**
     * `arrive` toward (gx[i], gy[i]): write the goal there, then call it. For a goal computed every
     * frame (a slot behind a leader): passed as two numbers, V8 boxes each one whenever it doesn't
     * inline the call (3 young GCs per 20k steps in Blitz's platoons); a typed array never boxes.
     */
    arriveGoal(i, dt) {
      v[0] = gx[i];
      v[1] = gy[i];
      v[2] = dt;
      toward(i, -1, near);
    },
    wander(i, dt, pace = 1) {
      if ((think[i] -= dt) <= 0) {
        think[i] = every + random() * jitter;
        gx[i] = area[0] + random() * area[2];
        gy[i] = area[1] + random() * area[3];
      }
      v[0] = gx[i];
      v[1] = gy[i];
      v[2] = dt;
      toward(i, pace, stop);
    },
    /** Waypoints as [x0, y0, x1, y1, …] (a typed array is best); the next one once inside `stop`.
     *  No waypoint (fewer than two numbers): it stands still. */
    patrol(i, points, dt, pace = 1) {
      if (points.length < 2) return void (moved[i] = 0);
      const k = leg[i] % (points.length >> 1) << 1, px = points[k], py = points[k + 1];
      if (hypot(px - x[i], py - y[i]) <= stop) leg[i] = (leg[i] + 1) % (points.length >> 1);
      const j = leg[i] << 1;
      v[0] = points[j];
      v[1] = points[j + 1];
      v[2] = dt;
      toward(i, pace, stop);
    }
  };
}

export {
  turn,
  steer
};
