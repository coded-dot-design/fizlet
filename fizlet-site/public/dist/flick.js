import "./chunks/chunk-62P4PJ5K.js";
import {
  hypot
} from "./chunks/chunk-3IN3G3AQ.js";
import {
  need
} from "./chunks/chunk-RA74YNEB.js";

// src/flick.ts
var STATE = { rest: 0, slide: 1, air: 2, tip: 3 };
var REST = 0;
var SLIDE = 1;
var AIR = 2;
var TIP = 3;
var HP = 1.5707963267948966;
var TAU = 6.283185307179586;
var HY = new Float64Array(3);
function len() {
  HY[2] = hypot(HY[0], HY[1]);
}
var SC = new Float64Array(2);
function sc() {
  const a = SC[0];
  let q = Math.round(a / HP);
  const r = a - q * HP, r2 = r * r;
  const s = r * (1 - r2 / 6 * (1 - r2 / 20 * (1 - r2 / 42 * (1 - r2 / 72 * (1 - r2 / 110 * (1 - r2 / 156 * (1 - r2 / 210)))))));
  const c = 1 - r2 / 2 * (1 - r2 / 12 * (1 - r2 / 30 * (1 - r2 / 56 * (1 - r2 / 90 * (1 - r2 / 132 * (1 - r2 / 182))))));
  q &= 3;
  SC[0] = q === 0 ? s : q === 1 ? c : q === 2 ? -s : -c;
  SC[1] = q === 0 ? c : q === 1 ? -s : q === 2 ? -c : s;
}
function flick(o = {}) {
  const cap = need(o.cap ?? 32, "cap", 2), g = need(o.gravity ?? 9.8, "gravity", 1), sub = need(o.sub ?? 4, "sub", 2);
  const floor = need(o.floor ?? -2, "floor"), ffl = need(o.floorFriction ?? 0.8, "floorFriction"), vtip = need(o.tip ?? 0.6, "tip"), lip = need(o.lip ?? 0.08, "lip");
  const tw = need(o.table?.[0] ?? 10, "table width", 1) / 2, td = need(o.table?.[1] ?? 6, "table depth", 1) / 2, ev = o.events;
  const f = () => new Float64Array(cap), u8 = () => new Uint8Array(cap), i32 = () => new Int32Array(cap);
  const K = u8(), FX = u8(), ST = u8(), OFF = u8(), SUP = i32(), TB = i32();
  const X = f(), Y = f(), Z = f(), VX = f(), VY = f(), VZ = f(), UX = f(), UZ = f(), W = f();
  const HX = f(), HH = f(), HZ = f(), FU = f(), FV = f(), FH = f(), M = f(), IM = f(), II = f(), MU = f(), E = f();
  const Q = new Float64Array(cap * 9), KX = f(), KZ = f(), TW = f();
  const DH = f(), DV = f(), PX = f(), PY = f(), PZ = f(), PDX = f(), PDZ = f(), GH = f(), GV = f(), OM = f(), K2 = f(), TH = f();
  const MM = f(), MX = f(), MZ = f();
  const CT = new Float64Array(5), IV = new Float64Array(5);
  const S = new Int32Array(1), UY = new Float64Array(1), TOP = new Float64Array(1), H = new Float64Array(1), TA = new Float64Array(3);
  let n = 0, wasBusy = false, nb = 0;
  function dims(i) {
    const q = i * 9, a = HX[i], b = HH[i], c = HZ[i];
    FU[i] = Math.abs(Q[q]) * a + Math.abs(Q[q + 1]) * b + Math.abs(Q[q + 2]) * c;
    FH[i] = 2 * (Math.abs(Q[q + 3]) * a + Math.abs(Q[q + 4]) * b + Math.abs(Q[q + 5]) * c);
    FV[i] = Math.abs(Q[q + 6]) * a + Math.abs(Q[q + 7]) * b + Math.abs(Q[q + 8]) * c;
    II[i] = K[i] === 1 && !FX[i] ? 3 / (M[i] * (FU[i] * FU[i] + FV[i] * FV[i])) : 0;
  }
  function turn(i) {
    const kx = TA[0], kz = TA[1];
    SC[0] = TA[2];
    sc();
    const s = SC[0], c = SC[1], d = 1 - c, ux = UX[i], uz = UZ[i], ax = kx * ux + kz * uz, az = kz * ux - kx * uz, q = i * 9;
    const r00 = c + d * ax * ax, r01 = -s * az, r02 = d * ax * az, r10 = s * az, r12 = -s * ax, r22 = c + d * az * az, r21 = s * ax;
    for (let k = 0; k < 3; k++) {
      const a = Q[q + k], b = Q[q + 3 + k], e = Q[q + 6 + k];
      Q[q + k] = r00 * a + r01 * b + r02 * e;
      Q[q + 3 + k] = r10 * a + c * b + r12 * e;
      Q[q + 6 + k] = r02 * a + r21 * b + r22 * e;
    }
  }
  function snap(i) {
    const q = i * 9;
    let ay = 1, sy = Q[q + 4] < 0 ? -1 : 1, ax = 0, sx = 1;
    if (K[i]) {
      for (let r = 0; r < 3; r++) if (Math.abs(Q[q + r * 3 + 1]) > Math.abs(Q[q + ay * 3 + 1])) ay = r;
      sy = Q[q + ay * 3 + 1] < 0 ? -1 : 1;
      ax = ay ? 0 : 1;
      for (let r = 0; r < 3; r++) if (r !== ay && Math.abs(Q[q + r * 3]) > Math.abs(Q[q + ax * 3])) ax = r;
      sx = Q[q + ax * 3] < 0 ? -1 : 1;
    }
    Q.fill(0, q, q + 9);
    Q[q + ax * 3] = sx;
    Q[q + ay * 3 + 1] = sy;
    for (let r = 0; r < 3; r++) {
      const r1 = (r + 1) % 3, r2 = (r + 2) % 3;
      Q[q + r * 3 + 2] = Q[q + r1 * 3] * Q[q + r2 * 3 + 1] - Q[q + r2 * 3] * Q[q + r1 * 3 + 1];
    }
    dims(i);
  }
  function over(j, i) {
    const dx = X[i] - X[j], dz = Z[i] - Z[j];
    if (!K[j]) return HY[0] = dx, HY[1] = dz, len(), HY[2] <= FU[j];
    const lu = dx * UX[j] + dz * UZ[j], lv = dz * UX[j] - dx * UZ[j];
    return Math.abs(lu) <= FU[j] && Math.abs(lv) <= FV[j];
  }
  function top(j, i) {
    const lu = (X[i] - X[j]) * UX[j] + (Z[i] - Z[j]) * UZ[j], u = FU[j];
    TOP[0] = K[j] !== 2 ? Y[j] + FH[j] : Y[j] + FH[j] * (u - (lu < -u ? -u : lu > u ? u : lu)) / (2 * u);
  }
  function under(i, foot) {
    const x = X[i], z = Z[i], y = UY[0];
    let best = -Infinity;
    S[0] = -3;
    if (Math.abs(x) <= tw && Math.abs(z) <= td && y >= -1e-9) best = 0, S[0] = -1;
    for (let j = 0; j < n; j++) {
      if (j === i || ST[j] >= AIR || SUP[j] === i || !(over(j, i) || foot && K[j] !== 2 && contact(i, j))) continue;
      const lu = (x - X[j]) * UX[j] + (z - Z[j]) * UZ[j], u = FU[j];
      const t = K[j] !== 2 ? Y[j] + FH[j] : Y[j] + FH[j] * (u - (lu < -u ? -u : lu > u ? u : lu)) / (2 * u);
      if (t <= y + 1e-9 && t > best) best = t, S[0] = j;
    }
    UY[0] = best;
  }
  function onTop(m, i) {
    for (let j = SUP[m], k = 0; j >= 0 && k < n; j = SUP[j], k++) if (j === i) return true;
    return false;
  }
  function interval(i, j) {
    const ax = IV[2], az = IV[3], e = IV[4];
    let d, r;
    if (j === -1) d = -X[i] * ax - Z[i] * az, r = tw * Math.abs(ax) + td * Math.abs(az);
    else {
      d = (X[j] - X[i]) * ax + (Z[j] - Z[i]) * az;
      r = K[j] ? FU[j] * Math.abs(UX[j] * ax + UZ[j] * az) + FV[j] * Math.abs(UX[j] * az - UZ[j] * ax) : FU[j];
    }
    IV[0] = d - r > -e ? d - r : -e;
    IV[1] = d + r < e ? d + r : e;
  }
  function toAir(i, keep = false) {
    ST[i] = AIR;
    SUP[i] = -3;
    if (!keep) VY[i] = 0;
    TW[i] = 0;
  }
  function startTip(i) {
    const dx = TA[0], dz = TA[1], pd = TA[2], px = X[i] + dx * pd, py = Y[i], pz = Z[i] + dz * pd;
    let m = 0, sh = 0, sv = 0;
    for (let k = 0; k < n; k++) {
      if (k !== i && !onTop(k, i)) continue;
      DH[k] = (X[k] - px) * dx + (Z[k] - pz) * dz;
      DV[k] = Y[k] + FH[k] / 2 - py;
      m += M[k];
      sh += M[k] * DH[k];
      sv += M[k] * DV[k];
    }
    sh /= m;
    sv /= m;
    if (sv <= 0) return toAir(i);
    const w = 2 * (Math.abs(dx * UX[i] + dz * UZ[i]) * FU[i] + Math.abs(dz * UX[i] - dx * UZ[i]) * FV[i]);
    PX[i] = px;
    PY[i] = py;
    PZ[i] = pz;
    PDX[i] = dx;
    PDZ[i] = dz;
    GH[i] = sh;
    GV[i] = sv;
    OM[i] = 0;
    TH[i] = 0;
    K2[i] = (w * w + FH[i] * FH[i]) / 12 + sh * sh + sv * sv;
    for (let k = 0; k < n; k++) if (k === i || onTop(k, i)) ST[k] = TIP, TB[k] = i, VX[k] = VZ[k] = VY[k] = W[k] = 0;
    ev && ev.emit("flick:topple", i);
  }
  function tipStep(i) {
    const h = H[0];
    OM[i] = OM[i] + g * GH[i] / K2[i] * h;
    const t = OM[i] * h, dx = PDX[i], dz = PDZ[i];
    SC[0] = t;
    sc();
    const s = SC[0], c = SC[1], gh = GH[i];
    GH[i] = gh * c + GV[i] * s;
    GV[i] = GV[i] * c - gh * s;
    TH[i] = TH[i] + t;
    const free = GV[i] <= 0 || TH[i] > 1.2;
    for (let k = 0; k < n; k++) {
      if (TB[k] !== i) continue;
      const a = DH[k], b = DV[k], a2 = a * c + b * s, b2 = b * c - a * s;
      X[k] = X[k] + dx * (a2 - a);
      Z[k] = Z[k] + dz * (a2 - a);
      Y[k] = PY[i] + b2 - FH[k] / 2;
      DH[k] = a2;
      DV[k] = b2;
      TA[0] = dz;
      TA[1] = -dx;
      TA[2] = t;
      turn(k);
      if (free) {
        const om = OM[i];
        toAir(k);
        VY[k] = -om * a2;
        VX[k] = dx * om * b2;
        VZ[k] = dz * om * b2;
        KX[k] = dz;
        KZ[k] = -dx;
        TW[k] = om;
        TB[k] = -1;
      }
    }
  }
  function airStep(i) {
    const h = H[0], y0 = Y[i];
    VY[i] = VY[i] - g * h;
    X[i] = X[i] + VX[i] * h;
    Z[i] = Z[i] + VZ[i] * h;
    Y[i] = y0 + VY[i] * h;
    if (TW[i]) TA[0] = KX[i], TA[1] = KZ[i], TA[2] = TW[i] * h, turn(i);
    UY[0] = y0;
    under(i, false);
    let t = UY[0], j = S[0];
    if (j === -3) t = floor, j = -2;
    if (Y[i] > t) return;
    Y[i] = t;
    if (TW[i] || Q[i * 9 + 4] !== 1) snap(i);
    TW[i] = 0;
    if (j === -2 && !OFF[i]) OFF[i] = 1, ev && ev.emit("flick:fall", i);
    if (VY[i] < -2.5) VY[i] = -VY[i] * E[i] * 0.3;
    else VY[i] = 0, ST[i] = SLIDE, SUP[i] = j;
  }
  function slideStep(i) {
    const h = H[0], j = SUP[i];
    if (j >= 0 && ST[j] >= AIR) return toAir(i);
    if (ST[i] === REST) {
      if (j < 0 || ST[j] === REST) return;
      ST[i] = SLIDE;
    }
    const ramp = j >= 0 && K[j] === 2;
    if (ramp) {
      if (!over(j, i)) return toAir(i, true);
    } else if (j !== -2) {
      const ux = K[i] ? UX[i] : 1, uz = K[i] ? UZ[i] : 0, cx = MX[i] / MM[i] - X[i], cz = MZ[i] / MM[i] - Z[i];
      let best = 0, bx = 0, bz = 0, bp = 0;
      for (let a = 0; a < 2; a++) {
        const ax = a ? -uz : ux, az = a ? ux : uz, e = a ? FV[i] : FU[i], cu = cx * ax + cz * az;
        IV[2] = ax;
        IV[3] = az;
        IV[4] = e;
        interval(i, j);
        if (IV[0] > IV[1]) return toAir(i);
        if (cu - IV[1] > best) best = cu - IV[1], bx = ax, bz = az, bp = IV[1];
        if (IV[0] - cu > best) best = IV[0] - cu, bx = -ax, bz = -az, bp = -IV[0];
      }
      if (best > 0) {
        const sx = VX[i] - (j >= 0 ? VX[j] : 0), sz = VZ[i] - (j >= 0 ? VZ[j] : 0);
        HY[0] = sx;
        HY[1] = sz;
        len();
        if (HY[2] > vtip) return toAir(i);
        TA[0] = bx;
        TA[1] = bz;
        TA[2] = bp;
        return startTip(i);
      }
    }
    if (j === -1 && nb) {
      for (let r = 0; r < n; r++)
        if (K[r] === 2 && over(r, i) && (top(r, i), TOP[0] <= Y[i] + lip)) {
          SUP[i] = r;
          return;
        }
    }
    const vsx = j >= 0 ? VX[j] : 0, vsz = j >= 0 ? VZ[j] : 0, dec = (j === -2 ? ffl : MU[i]) * g * h;
    let slope = 0;
    if (ramp) {
      const k = FH[j] / (2 * FU[j]);
      slope = g * k / (1 + k * k);
    }
    let rx = VX[i] - vsx, rz = VZ[i] - vsz;
    HY[0] = rx;
    HY[1] = rz;
    len();
    let s = HY[2];
    if (s <= dec && slope <= MU[i] * g && Math.abs(W[i]) < 0.02 && (j < 0 || ST[j] === REST)) {
      VX[i] = vsx;
      VZ[i] = vsz;
      VY[i] = 0;
      W[i] = 0;
      ST[i] = REST;
      return;
    }
    if (slope) rx += UX[j] * slope * h, rz += UZ[j] * slope * h, HY[0] = rx, HY[1] = rz, len(), s = HY[2];
    if (s <= dec) rx = 0, rz = 0;
    else rx -= rx / s * dec, rz -= rz / s * dec;
    VX[i] = vsx + rx;
    VZ[i] = vsz + rz;
    X[i] = X[i] + VX[i] * h;
    Z[i] = Z[i] + VZ[i] * h;
    if (W[i]) {
      const sd = 3 * MU[i] * g * h / (FU[i] + FV[i]), w = W[i];
      W[i] = w > sd ? w - sd : w < -sd ? w + sd : 0;
      SC[0] = W[i] * h;
      sc();
      const ux = UX[i], uz = UZ[i], a = ux * SC[1] + uz * SC[0], b = uz * SC[1] - ux * SC[0];
      HY[0] = a;
      HY[1] = b;
      len();
      const l = HY[2];
      UX[i] = a / l;
      UZ[i] = b / l;
    }
    if (ramp) {
      top(j, i);
      const y = TOP[0];
      VY[i] = (y - Y[i]) / h;
      Y[i] = y;
    } else Y[i] = j === -1 ? 0 : j === -2 ? floor : Y[j] + FH[j];
  }
  function contact(i, j) {
    const ci = !K[i], cj = !K[j];
    if (ci && cj) {
      const dx2 = X[j] - X[i], dz2 = Z[j] - Z[i];
      HY[0] = dx2;
      HY[1] = dz2;
      len();
      const d = HY[2], p2 = FU[i] + FU[j] - d;
      if (p2 <= 0) return false;
      CT[0] = d ? dx2 / d : 1;
      CT[1] = d ? dz2 / d : 0;
      CT[2] = p2;
      CT[3] = X[i] + CT[0] * FU[i];
      CT[4] = Z[i] + CT[1] * FU[i];
      return true;
    }
    if (ci || cj) {
      const c = ci ? i : j, b = ci ? j : i, sg = ci ? 1 : -1, ux = UX[b], uz = UZ[b], r = FU[c];
      const dx2 = X[c] - X[b], dz2 = Z[c] - Z[b], lu = dx2 * ux + dz2 * uz, lv = dz2 * ux - dx2 * uz, fu = FU[b], fv = FV[b];
      const qu = lu < -fu ? -fu : lu > fu ? fu : lu, qv = lv < -fv ? -fv : lv > fv ? fv : lv;
      const qx = X[b] + qu * ux - qv * uz, qz = Z[b] + qu * uz + qv * ux, ex = qx - X[c], ez = qz - Z[c];
      HY[0] = ex;
      HY[1] = ez;
      len();
      const d = HY[2];
      if (qu !== lu || qv !== lv) {
        if (d >= r) return false;
        CT[0] = sg * ex / d;
        CT[1] = sg * ez / d;
        CT[2] = r - d;
      } else {
        const ou = fu - Math.abs(lu), ov = fv - Math.abs(lv), su = lu < 0 ? 1 : -1, sv = lv < 0 ? 1 : -1;
        if (ou < ov) CT[0] = sg * su * ux, CT[1] = sg * su * uz, CT[2] = r + ou;
        else CT[0] = -sg * sv * uz, CT[1] = sg * sv * ux, CT[2] = r + ov;
      }
      CT[3] = qx;
      CT[4] = qz;
      return true;
    }
    const dx = X[j] - X[i], dz = Z[j] - Z[i];
    let p = Infinity, nx = 0, nz = 0;
    for (let a = 0; a < 4; a++) {
      const b = a < 2 ? i : j, ax = a & 1 ? -UZ[b] : UX[b], az = a & 1 ? UX[b] : UZ[b];
      const ri = FU[i] * Math.abs(UX[i] * ax + UZ[i] * az) + FV[i] * Math.abs(UX[i] * az - UZ[i] * ax);
      const rj = FU[j] * Math.abs(UX[j] * ax + UZ[j] * az) + FV[j] * Math.abs(UX[j] * az - UZ[j] * ax);
      const dd = dx * ax + dz * az, o2 = ri + rj - Math.abs(dd);
      if (o2 <= 0) return false;
      if (o2 < p) p = o2, nx = dd < 0 ? -ax : ax, nz = dd < 0 ? -az : az;
    }
    const si = (UX[i] * nx + UZ[i] * nz < 0 ? -1 : 1) * FU[i], ti = (UX[i] * nz - UZ[i] * nx < 0 ? -1 : 1) * FV[i];
    const sj = (UX[j] * nx + UZ[j] * nz < 0 ? 1 : -1) * FU[j], tj = (UX[j] * nz - UZ[j] * nx < 0 ? 1 : -1) * FV[j];
    CT[0] = nx;
    CT[1] = nz;
    CT[2] = p;
    CT[3] = (X[i] + si * UX[i] - ti * UZ[i] + X[j] + sj * UX[j] - tj * UZ[j]) / 2;
    CT[4] = (Z[i] + si * UZ[i] + ti * UX[i] + Z[j] + sj * UZ[j] + tj * UX[j]) / 2;
    return true;
  }
  function resolve(i, j) {
    const nx = CT[0], nz = CT[1], p = CT[2], mi = IM[i], mj = IM[j], tot = mi + mj;
    if (!tot) return;
    X[i] = X[i] - nx * p * mi / tot;
    Z[i] = Z[i] - nz * p * mi / tot;
    X[j] = X[j] + nx * p * mj / tot;
    Z[j] = Z[j] + nz * p * mj / tot;
    const ax = CT[3] - X[i], az = CT[4] - Z[i], bx = CT[3] - X[j], bz = CT[4] - Z[j];
    const vn = (VX[j] + W[j] * bz - VX[i] - W[i] * az) * nx + (VZ[j] - W[j] * bx - VZ[i] + W[i] * ax) * nz;
    if (ST[i] === REST && !FX[i]) ST[i] = SLIDE;
    if (ST[j] === REST && !FX[j]) ST[j] = SLIDE;
    if (vn >= 0) return;
    const ca = az * nx - ax * nz, cb = bz * nx - bx * nz, jn = -(1 + (E[i] + E[j]) / 2) * vn / (tot + II[i] * ca * ca + II[j] * cb * cb);
    VX[i] = VX[i] - nx * jn * mi;
    VZ[i] = VZ[i] - nz * jn * mi;
    W[i] = W[i] - II[i] * ca * jn;
    VX[j] = VX[j] + nx * jn * mj;
    VZ[j] = VZ[j] + nz * jn * mj;
    W[j] = W[j] + II[j] * cb * jn;
    if (vn < -0.3) ev && ev.emit("flick:hit", i, j, CT[3], CT[4], -vn);
  }
  function collide() {
    for (let i = 0; i < n; i++) {
      if (ST[i] === TIP) continue;
      for (let j = i + 1; j < n; j++) {
        if (ST[j] === TIP || (FX[i] || ST[i] === REST) && (FX[j] || ST[j] === REST)) continue;
        if (Y[i] >= Y[j] + FH[j] - 1e-9 || Y[j] >= Y[i] + FH[i] - 1e-9) continue;
        const r = K[i] === 2 ? i : K[j] === 2 ? j : -1, b = r === i ? j : i;
        if (r >= 0) {
          if (SUP[b] === r) continue;
          top(r, b);
          if (TOP[0] <= Y[b] + lip) continue;
        }
        if (contact(i, j)) resolve(i, j);
      }
    }
  }
  function substep() {
    for (let i = 0; i < n; i++) MM[i] = M[i], MX[i] = M[i] * X[i], MZ[i] = M[i] * Z[i];
    for (let i = 0; i < n; i++)
      if (!FX[i] && ST[i] < AIR)
        for (let j = SUP[i], k = 0; j >= 0 && k < n; j = SUP[j], k++) MM[j] = MM[j] + M[i], MX[j] = MX[j] + M[i] * X[i], MZ[j] = MZ[j] + M[i] * Z[i];
    for (let i = 0; i < n; i++) if (ST[i] === TIP && TB[i] === i) tipStep(i);
    for (let i = 0; i < n; i++) {
      if (FX[i] || ST[i] === TIP) continue;
      if (ST[i] === AIR) airStep(i);
      else slideStep(i);
    }
    collide();
  }
  const api = {
    /** Pieces added. */
    get n() {
      return n;
    },
    /** Anything moving, falling or tipping (false: everything rests). */
    get busy() {
      return wasBusy;
    },
    /** Bottom centre x, y, z (the table top's frame) and velocity, per piece. */
    x: X,
    y: Y,
    z: Z,
    vx: VX,
    vy: VY,
    vz: VZ,
    /** Spin about y (rad/s), mass and inverse spin inertia (0: a disc, a fixed piece). */
    spin: W,
    mass: M,
    ii: II,
    /** `STATE` per piece; `off`: 1 once it fell off the table; `on`: what it rests on (−1 the
     *  table, −2 the floor, −3 nothing: in the air) or another piece's index. */
    state: ST,
    off: OFF,
    on: SUP,
    /** Add a piece, ramp or wall (`FlickBodyDef`); returns its index. Add what holds a piece first. */
    add(d = {}) {
      if (n === cap) throw new RangeError(`fizlet: flick holds ${cap} pieces (cap)`);
      const i = n++, s = d.size || [1, 0.3, 1], k = d.shape === "ramp" ? 2 : d.shape === "box" ? 1 : 0;
      K[i] = k;
      FX[i] = k === 2 || d.fixed ? 1 : 0;
      HX[i] = need(s[0], "size", 1) / 2;
      HH[i] = need(s[1], "size", 1) / 2;
      HZ[i] = k ? need(s[2] ?? s[0], "size", 1) / 2 : HX[i];
      M[i] = need(d.mass ?? 1, "mass", 1);
      IM[i] = FX[i] ? 0 : 1 / M[i];
      MU[i] = need(d.friction ?? 0.25, "friction");
      E[i] = need(d.bounce ?? 0.8, "bounce");
      SC[0] = k ? need(d.yaw ?? 0, "yaw") : 0;
      sc();
      UX[i] = SC[1];
      UZ[i] = -SC[0];
      Q.fill(0, i * 9, i * 9 + 9);
      Q[i * 9] = Q[i * 9 + 4] = Q[i * 9 + 8] = 1;
      dims(i);
      if (k === 2) nb++;
      api.place(i, d.pos?.[0] ?? 0, d.pos && d.pos.length > 2 ? d.pos[2] : d.pos?.[1] ?? 0, d.pos && d.pos.length > 2 ? d.pos[1] : void 0);
      return i;
    },
    /** Put piece i at (x, z) upright and still: on the highest surface under it, or from height y. */
    place(i, x, z, y) {
      X[i] = x;
      Z[i] = z;
      VX[i] = VY[i] = VZ[i] = W[i] = TW[i] = 0;
      OFF[i] = 0;
      TB[i] = -1;
      if (FX[i]) return Y[i] = y ?? 0, ST[i] = REST, SUP[i] = -3;
      UY[0] = y ?? Infinity;
      under(i, true);
      const t = UY[0], j = S[0];
      wasBusy = true;
      if (y != null && y > t + 1e-9) return Y[i] = y, toAir(i);
      Y[i] = j === -3 ? floor : t;
      SUP[i] = j === -3 ? -2 : j;
      ST[i] = SLIDE;
    },
    /** Flick piece i with impulse (jx, jz) (velocity change: impulse ÷ mass). */
    flick(i, jx, jz) {
      if (FX[i]) return;
      VX[i] = VX[i] + jx * IM[i];
      VZ[i] = VZ[i] + jz * IM[i];
      if (ST[i] === REST) ST[i] = SLIDE;
      wasBusy = true;
    },
    /** Advance dt seconds (`sub` fixed sub-steps); returns `busy`. Call it from the engine's step. */
    step(dt) {
      if (!wasBusy) return false;
      H[0] = dt / sub;
      for (let s = 0; s < sub; s++) substep();
      let b = false;
      for (let i = 0; i < n; i++) if (ST[i] !== REST) b = true;
      if (wasBusy && !b) ev && ev.emit("flick:rest");
      wasBusy = b;
      return b;
    },
    /** Step at `dt` until everything rests or `max` steps pass; returns the steps taken. */
    run(dt = 1 / 60, max = 3600) {
      let k = 0;
      for (; k < max && wasBusy; k++) api.step(dt);
      return k;
    },
    /** How far a piece sliding at `speed` on a flat goes before friction stops it: v² ÷ 2μg. */
    reach: (i, speed) => speed * speed / (2 * MU[i] * g),
    /** Piece i's pose for a diorama object: out = [x, y, z, rx, ry, rz] (its bottom-centre origin and
     *  `rot`, through a topple too). */
    pose(i, out) {
      const q = i * 9, ux = UX[i], uz = UZ[i], hh = HH[i];
      const m01 = ux * Q[q + 1] - uz * Q[q + 7], m21 = uz * Q[q + 1] + ux * Q[q + 7], m02 = ux * Q[q + 2] - uz * Q[q + 8], m22 = uz * Q[q + 2] + ux * Q[q + 8];
      const m12 = Q[q + 5], m10 = Q[q + 3], m11 = Q[q + 4];
      out[0] = X[i] - hh * m01;
      out[1] = Y[i] + FH[i] / 2 - hh * m11;
      out[2] = Z[i] - hh * m21;
      out[3] = Math.asin(m12 > 1 ? -1 : m12 < -1 ? 1 : -m12);
      if (Math.abs(m12) < 0.999999) out[4] = Math.atan2(m02, m22), out[5] = Math.atan2(m10, m11);
      else out[4] = Math.atan2(-(uz * Q[q] + ux * Q[q + 6]), ux * Q[q] - uz * Q[q + 6]), out[5] = 0;
      return out;
    },
    /** Write piece i's pose into a diorama object (`pos`, `rot`) resting on the table (or on a parent
     *  whose top is at height `y0` in the table's frame: −2 for a floor at `floor` −2, so its shadow
     *  falls on the floor). */
    apply(i, ob, y0 = 0) {
      api.pose(i, P6);
      ob.pos[0] = P6[0];
      ob.pos[1] = P6[1] - y0;
      ob.pos[2] = P6[2];
      ob.rot[0] = P6[3];
      ob.rot[1] = P6[4];
      ob.rot[2] = P6[5];
    }
  };
  const P6 = new Float64Array(6);
  return api;
}
function sling(o = {}) {
  const pull = need(o.pull ?? 3, "pull", 1), max = need(o.max ?? 12, "max"), min = need(o.min ?? 0.05, "min");
  const steps = need(o.steps ?? 100, "steps", 2), turns = need(o.turns ?? 4096, "turns", 2);
  const a = {
    /** A drag is on. */
    active: false,
    /** The piece's centre the drag pulls from. */
    ax: 0,
    az: 0,
    /** The shot: direction index (0..turns − 1, from +x toward +z) and power level (0..steps). */
    angle: 0,
    level: 0,
    /** level ÷ steps. */
    power: 0,
    /** The unit direction and the impulse for `flick`. */
    dx: 1,
    dz: 0,
    jx: 0,
    jz: 0,
    /** Start a drag on the piece at (x, z), the pointer at (px, pz). */
    begin(x, z, px, pz) {
      a.active = true;
      a.ax = x;
      a.az = z;
      a.move(px, pz);
    },
    /** The pointer moved to (px, pz): the shot points from it to the piece. */
    move(px, pz) {
      if (!a.active) return;
      const lx = a.ax - px, lz = a.az - pz, l = hypot(lx, lz), p = l / pull;
      a.set(l ? Math.round(Math.atan2(lz, lx) / TAU * turns) : a.angle, Math.round((p > 1 ? 1 : p) * steps));
    },
    /** Set the shot from its two integers (a remote player's): the same impulse everywhere. */
    set(angle, level) {
      a.angle = (angle % turns + turns) % turns;
      a.level = level < 0 ? 0 : level > steps ? steps : level;
      a.power = a.level / steps;
      SC[0] = a.angle / turns * TAU;
      sc();
      a.dx = SC[1];
      a.dz = SC[0];
      a.jx = a.dx * a.power * max;
      a.jz = a.dz * a.power * max;
    },
    /** Let go: true if it is a shot (power ≥ `min`); then `jx`, `jz`, `angle`, `level` hold it. */
    end() {
      const was = a.active;
      a.active = false;
      return was && a.power >= min;
    },
    /** Drop the drag without a shot. */
    cancel() {
      a.active = false;
      a.level = 0;
      a.power = a.jx = a.jz = 0;
    }
  };
  return a;
}
export {
  STATE,
  flick,
  sling
};
