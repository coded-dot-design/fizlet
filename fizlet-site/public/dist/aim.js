import "./chunks/chunk-62P4PJ5K.js";
import {
  hypot
} from "./chunks/chunk-3IN3G3AQ.js";
import "./chunks/chunk-RA74YNEB.js";

// src/aim.ts
function aim(o) {
  const { x, y, a, vx, vy, board, clear } = o, mask = o.mask ?? 1, foe = o.foe;
  const out = new Float64Array(5);
  const sees = (i, j) => clear ? clear(i, j) : !board || board.los(board.cellOf(x, y, i), board.cellOf(x, y, j), mask);
  const look = (i, j) => {
    const dx = x[j] - x[i], dy = y[j] - y[i], b = Math.atan2(dy, dx) - (a ? a[i] : 0);
    out[0] = x[j];
    out[1] = y[j];
    out[2] = a ? Math.atan2(Math.sin(b), Math.cos(b)) : 0;
    out[3] = hypot(dx, dy);
  };
  return {
    out,
    /** out = [aim x, aim y, seconds to impact, distance to the aim point]. False when the shot can
     *  never catch j (out is then j where it stands, t = -1). */
    lead(i, j, speed) {
      const px = x[j] - x[i], py = y[j] - y[i], ux = vx ? vx[j] : 0, uy = vy ? vy[j] : 0;
      const qa = ux * ux + uy * uy - speed * speed, qb = 2 * (px * ux + py * uy), qc = px * px + py * py;
      let t = -1;
      if (qc === 0) t = 0;
      else if (Math.abs(qa) < 1e-9 * (speed * speed + 1)) t = qb < 0 ? -qc / qb : -1;
      else {
        const disc = qb * qb - 4 * qa * qc;
        if (disc >= 0) {
          const q = -0.5 * (qb + (qb < 0 ? -1 : 1) * Math.sqrt(disc)), t1 = q / qa, t2 = q !== 0 ? qc / q : -1;
          t = t1 > 0 && (t2 <= 0 || t1 < t2) ? t1 : t2 > 0 ? t2 : -1;
        }
      }
      const k = t > 0 ? t : 0;
      out[0] = x[j] + ux * k;
      out[1] = y[j] + uy * k;
      out[2] = t;
      out[3] = hypot(out[0] - x[i], out[1] - y[i]);
      return t >= 0;
    },
    /** j within `range` px and inside i's heading ± `half` rad. out = [j's x, y, angle off heading
     *  (signed, -π..π: turn by it), distance]. */
    cone(i, j, half, range) {
      look(i, j);
      return out[3] <= range && Math.abs(out[2]) <= half;
    },
    sees,
    /** The nearest foe of i among rows list[0..n) inside its cone and range and in sight; -1 if none.
     *  Skip dead rows with `foe` (e.g. `A.alive[j] && …`). Sight is checked last, and only for a row
     *  closer than the best so far, so a long list costs a sight check per closer candidate, not per row. out is the pick's. */
    pick(i, list, n, half, range) {
      let best = -1;
      out[4] = range;
      for (let k = 0; k < n; k++) {
        const j = list[k];
        if (j === i || foe && !foe(i, j)) continue;
        look(i, j);
        if (out[3] > out[4] || best >= 0 && out[3] === out[4] || Math.abs(out[2]) > half || !sees(i, j)) continue;
        best = j;
        out[4] = out[3];
      }
      if (best >= 0) look(i, best);
      return best;
    }
  };
}
export {
  aim
};
