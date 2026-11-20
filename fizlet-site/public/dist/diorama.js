import "./chunks/chunk-62P4PJ5K.js";
import {
  hypot
} from "./chunks/chunk-3IN3G3AQ.js";
import "./chunks/chunk-RA74YNEB.js";

// src/diorama.ts
var TAU = 6.283185307179586;
function rgb(col, b) {
  const n = parseInt(col.slice(1), 16), f = (c) => (b <= 1 ? c * b : c + (255 - c) * (b - 1) * 0.9) | 0;
  return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`;
}
var len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function mk(V, F) {
  const nv = V.length, v = new Float64Array(nv * 3);
  let mx = 0, my = 0, mz = 0, tot = 0, k = 0;
  V.forEach((p, i) => {
    v[i * 3] = p[0];
    v[i * 3 + 1] = p[1];
    v[i * 3 + 2] = p[2];
    mx += p[0] / nv;
    my += p[1] / nv;
    mz += p[2] / nv;
  });
  F.forEach((f) => tot += f.length);
  const nf = F.length, fs = new Int32Array(nf), fc = new Int32Array(nf), fv = new Int32Array(tot), nrm = new Float64Array(nf * 3), cen = new Float64Array(nf * 3);
  F.forEach((f, i) => {
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    const c = f.length;
    for (let j = 0; j < c; j++) {
      const a = V[f[j]], b = V[f[(j + 1) % c]];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
      cx += a[0] / c;
      cy += a[1] / c;
      cz += a[2] / c;
    }
    if (nx * (cx - mx) + ny * (cy - my) + nz * (cz - mz) < 0) f = f.slice().reverse(), nx = -nx, ny = -ny, nz = -nz;
    const l = len3(nx, ny, nz) || 1;
    nrm[i * 3] = nx / l;
    nrm[i * 3 + 1] = ny / l;
    nrm[i * 3 + 2] = nz / l;
    cen[i * 3] = cx;
    cen[i * 3 + 1] = cy;
    cen[i * 3 + 2] = cz;
    fs[i] = k;
    fc[i] = c;
    for (const vi of f) fv[k++] = vi;
  });
  return { nv, v, nf, fs, fc, fv, nrm, cen };
}
function shapeMesh(d, s) {
  const w = s[0], h = s[1], dd = s[2], x = w / 2, z = dd / 2, V = [], F = [];
  switch (d.shape) {
    case "group":
      break;
    case "wedge":
      V.push([-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [-x, h, z]);
      F.push([0, 1, 2, 3], [0, 3, 5, 4], [1, 4, 5, 2], [0, 1, 4], [3, 2, 5]);
      break;
    case "cyl": {
      const n = d.sides || 10, t = d.top ?? 1, bot = [], top = [];
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * TAU;
        V.push([Math.cos(a) * x, 0, Math.sin(a) * z]);
        bot.push(i);
      }
      if (t < 0.02) {
        V.push([0, h, 0]);
        for (let i = 0; i < n; i++) F.push([i, (i + 1) % n, n]);
      } else {
        for (let i = 0; i < n; i++) {
          V.push([V[i][0] * t, h, V[i][2] * t]);
          top.push(n + i);
          F.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
        }
        F.push(top);
      }
      F.push(bot);
      break;
    }
    case "prism": {
      const p = d.outline, t = d.taper ?? 1, n = p.length, bot = [], top = [];
      for (let i = 0; i < n; i++) {
        V.push([p[i][0] * t, 0, p[i][1] * t]);
        bot.push(i);
      }
      for (let i = 0; i < n; i++) {
        V.push([p[i][0], h, p[i][1]]);
        top.push(n + i);
        F.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
      }
      F.push(top, bot);
      break;
    }
    default: {
      const m = d.mask ?? 63;
      V.push([-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [x, h, -z], [x, h, z], [-x, h, z]);
      [[4, 5, 6, 7], [0, 1, 2, 3], [1, 2, 6, 5], [0, 3, 7, 4], [3, 2, 6, 7], [0, 1, 5, 4]].forEach((f, i) => m & 1 << i && F.push(f));
    }
  }
  return mk(V, F);
}
function diorama(canvas, o = {}) {
  const bg = o.background, ctx = canvas.getContext("2d", { alpha: !bg });
  const MAXV = o.maxVerts ?? 16384, MAXF = o.maxFaces ?? 8192, MAXS = o.maxShadows ?? 512, SHN = 14, maxDpr = o.maxDpr ?? 2;
  const SV = new Float64Array(MAXV * 3), KA = new Float64Array(MAXF), KD = new Float64Array(MAXF);
  const KIND = new Uint8Array(MAXF), FOBJ = new Int32Array(MAXF), FIDX = new Int32Array(MAXF), FLVL = new Uint8Array(MAXF);
  const O1 = new Uint32Array(MAXF), O2 = new Uint32Array(MAXF), SHP = new Float64Array(MAXS * 2 * SHN), SHA = new Float64Array(MAXS);
  const B = new Float64Array(13), FB = new Float64Array(13), C = new Float64Array(10), T = new Float64Array(3), Q = new Float64Array(3), BOX = new Float64Array(4), L = new Float64Array(3);
  const objs = [], order = [], byId = /* @__PURE__ */ new Map(), clusters = /* @__PURE__ */ new Map(), clist = [];
  const decals = [], pools = [], meshes = /* @__PURE__ */ new Map(), SHADES = /* @__PURE__ */ new Map();
  let EA = new Float64Array(64), SH = new Float64Array(64), CD = new Float64Array(16), CR = new Int32Array(16), ORD = O1;
  let amb = 0.56, nf = 0, nv = 0, W = 1, H = 1, dpr = 1;
  const cam = { yaw: -0.5, pitch: 0.85, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.62 };
  const stats = { faces: 0, shadows: 0, points: 0, verts: 0, objects: 0, dropped: 0 };
  function setLight(v, a = amb) {
    const l = len3(v[0], v[1], v[2]) || 1;
    L[0] = v[0] / l;
    L[1] = v[1] / l;
    L[2] = v[2] / l;
    amb = a;
  }
  setLight(o.light || [0.5, 1, 0.4], o.ambient ?? 0.56);
  function add(d) {
    const shape = d.shape || "box", size = new Float64Array(d.size || [1, 1, 1]), on = d.on || null;
    const k = shape + size.join() + "|" + d.sides + "|" + d.top + "|" + d.mask + "|" + d.taper + (d.outline ? JSON.stringify(Array.from(d.outline, (p) => Array.from(p))) : "");
    let mesh = meshes.get(k);
    if (!mesh) meshes.set(k, mesh = shapeMesh({ ...d, shape }, size));
    if (nv + mesh.nv > MAXV) throw new RangeError("diorama: more vertices than maxVerts");
    const ob = {
      id: d.id ?? null,
      shape,
      size,
      pos: Float64Array.from(d.pos || [0, 0, 0]),
      rot: Float64Array.from(d.rot || [0, 0, 0]),
      color: d.color || "#cccccc",
      alpha: d.alpha ?? 1,
      tint: d.tint ?? null,
      hidden: !!d.hidden,
      off: !!d.off,
      shadow: d.shadow || 0,
      layer: d.layer ?? (on && byId.has(on) ? byId.get(on).layer + 1 : 4),
      below: d.below || null,
      behind: d.behind || 0,
      emissive: !!d.emissive,
      pick: d.pick !== false,
      tag: d.tag ?? null,
      on,
      parent: null,
      M: new Float64Array(12),
      mesh,
      vb: nv,
      top: shape === "group" ? 0 : size[1],
      i: objs.length,
      cl: null,
      clName: d.cluster || null,
      sq: shape === "box",
      et: null
    };
    nv += mesh.nv;
    if (objs.length >= EA.length) {
      const e = new Float64Array(EA.length * 2);
      e.set(EA);
      EA = e;
      SH = new Float64Array(EA.length);
    }
    if (ob.clName && !clusters.has(ob.clName)) cluster(ob.clName, {}, ob);
    objs.push(ob);
    if (ob.id) byId.set(ob.id, ob);
    relink();
    return ob;
  }
  function relink() {
    order.length = 0;
    const seen = /* @__PURE__ */ new Set();
    const visit = (ob) => {
      if (seen.has(ob)) return;
      seen.add(ob);
      if (ob.parent) visit(ob.parent);
      order.push(ob);
    };
    for (const ob of objs) ob.parent = ob.on && byId.get(ob.on) || null;
    objs.forEach(visit);
    for (const ob of order) {
      if (ob.clName) ob.cl = clusters.get(ob.clName);
      else if (ob.parent) ob.cl = ob.parent.cl;
      else {
        const n = "@" + (ob.id || ob.i);
        if (!clusters.has(n)) cluster(n, {}, ob);
        ob.cl = clusters.get(n);
      }
    }
  }
  function cluster(name, c, follow = null) {
    const old = clusters.get(name), cl = old || { name, fixed: null, at: null, follow, ci: clist.length };
    cl.fixed = c.fixed ?? null;
    cl.at = c.at || null;
    if (c.at || c.fixed != null) cl.follow = null;
    if (!old) {
      clusters.set(name, cl);
      clist.push(cl);
      if (clist.length > CD.length) {
        const d = new Float64Array(CD.length * 2), r = new Int32Array(CD.length * 2);
        d.set(CD);
        r.set(CR);
        CD = d;
        CR = r;
      }
    }
  }
  function clear() {
    objs.length = order.length = clist.length = decals.length = pools.length = 0;
    byId.clear();
    clusters.clear();
    nv = nf = 0;
  }
  function basisOf(c, b) {
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    b[0] = c.tx + c.dist * sy * cp;
    b[1] = c.ty + c.dist * sp;
    b[2] = c.tz + c.dist * cy * cp;
    const fx = -sy * cp, fy = -sp, fz = -cy * cp, rx = cy, rz = -sy;
    b[3] = rx;
    b[4] = 0;
    b[5] = rz;
    b[6] = -rz * fy;
    b[7] = rz * fx - rx * fz;
    b[8] = rx * fy;
    b[9] = fx;
    b[10] = fy;
    b[11] = fz;
    b[12] = H / 2 / Math.tan(c.fov / 2);
  }
  function sync() {
    if (C[0] !== cam.yaw || C[1] !== cam.pitch || C[2] !== cam.dist || C[3] !== cam.tx || C[4] !== cam.ty || C[5] !== cam.tz || C[6] !== cam.fov || C[7] !== H) {
      C[0] = cam.yaw;
      C[1] = cam.pitch;
      C[2] = cam.dist;
      C[3] = cam.tx;
      C[4] = cam.ty;
      C[5] = cam.tz;
      C[6] = cam.fov;
      C[7] = H;
      basisOf(cam, B);
    }
  }
  function proj(b, c, x, y, z, out) {
    const dx = x - b[0], dy = y - b[1], dz = z - b[2], zz = dx * b[9] + dy * b[10] + dz * b[11], k = b[12] / Math.max(zz, 0.05);
    out[0] = W / 2 + c.ox + (dx * b[3] + dy * b[4] + dz * b[5]) * k;
    out[1] = H / 2 + c.oy - (dx * b[6] + dy * b[7] + dz * b[8]) * k;
    out[2] = zz;
    return zz > 0.05;
  }
  function bbox(c, pts) {
    basisOf(c, FB);
    BOX[0] = BOX[1] = Infinity;
    BOX[2] = BOX[3] = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      if (!proj(FB, c, pts[i], pts[i + 1], pts[i + 2], T)) return false;
      BOX[0] = Math.min(BOX[0], T[0]);
      BOX[1] = Math.min(BOX[1], T[1]);
      BOX[2] = Math.max(BOX[2], T[0]);
      BOX[3] = Math.max(BOX[3], T[1]);
    }
    return true;
  }
  function fit(c, pts, s) {
    const sw = s.x1 - s.x0, sh = s.y1 - s.y0;
    const ok = (d) => (c.dist = d, bbox(c, pts) && BOX[2] - BOX[0] <= sw && BOX[3] - BOX[1] <= sh);
    let lo = 0, hi = Math.max(1, c.dist);
    while (!ok(hi) && hi < 1e7) lo = hi, hi *= 2;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      ok(m) ? hi = m : lo = m;
    }
    c.ox = c.oy = 0;
    ok(hi);
    c.ox = (s.x0 + s.x1 - BOX[0] - BOX[2]) / 2;
    c.oy = (s.y0 + s.y1 - BOX[1] - BOX[3]) / 2;
    return c;
  }
  const lim = (v, r) => r ? Math.min(r[1], Math.max(r[0], v)) : v;
  function clamp(l, c = cam) {
    c.yaw = lim(c.yaw, l.yaw);
    c.pitch = lim(c.pitch, l.pitch);
    c.dist = lim(c.dist, l.dist);
    return c;
  }
  function shade(col, lvl) {
    let a = SHADES.get(col);
    if (!a) SHADES.set(col, a = []);
    return a[lvl] || (a[lvl] = rgb(col, 0.5 + lvl / 40 * 0.62));
  }
  function resize(w, h, r) {
    w = w || canvas.clientWidth || 1;
    h = h || canvas.clientHeight || 1;
    r = Math.min(maxDpr, r || globalThis.devicePixelRatio || 1);
    if (w !== W || h !== H || r !== dpr) {
      W = w;
      H = h;
      dpr = r;
      canvas.width = Math.round(w * r);
      canvas.height = Math.round(h * r);
    }
  }
  const before = (a, b) => KA[a] < KA[b] || KA[a] === KA[b] && KD[a] > KD[b];
  function sortKeys(n) {
    let a = O1, b = O2;
    for (let i = 0; i < n; i++) a[i] = i;
    for (let s = 0; s < n; s += 8)
      for (let i = s + 1, e = Math.min(n, s + 8); i < e; i++) {
        const x = a[i];
        let j = i - 1;
        for (; j >= s && before(x, a[j]); j--) a[j + 1] = a[j];
        a[j + 1] = x;
      }
    for (let w = 8; w < n; w *= 2) {
      for (let lo = 0; lo < n; lo += 2 * w) {
        const mid = Math.min(n, lo + w), hi = Math.min(n, lo + 2 * w);
        let i = lo, j = mid, k = lo;
        while (i < mid && j < hi) b[k++] = before(a[j], a[i]) ? a[j++] : a[i++];
        while (i < mid) b[k++] = a[i++];
        while (j < hi) b[k++] = a[j++];
      }
      const t = a;
      a = b;
      b = t;
    }
    ORD = a;
  }
  const keyA = (rank, layer) => rank * 65536 + Math.max(0, Math.min(65535, Math.round(layer * 100))) | 0;
  function slot(kind, ka, ob, idx) {
    if (nf >= MAXF) return stats.dropped++, -1;
    KIND[nf] = kind;
    KA[nf] = ka;
    FOBJ[nf] = ob;
    FIDX[nf] = idx;
    return nf++;
  }
  function projQ() {
    const dx = Q[0] - B[0], dy = Q[1] - B[1], dz = Q[2] - B[2], zz = dx * B[9] + dy * B[10] + dz * B[11], k = B[12] / Math.max(zz, 0.05);
    T[0] = W / 2 + cam.ox + (dx * B[3] + dy * B[4] + dz * B[5]) * k;
    T[1] = H / 2 + cam.oy - (dx * B[6] + dy * B[7] + dz * B[8]) * k;
    T[2] = zz;
    return zz > 0.05;
  }
  const depthQ = () => (Q[0] - B[0]) * B[9] + (Q[1] - B[1]) * B[10] + (Q[2] - B[2]) * B[11];
  const rankOf = (name) => {
    const c = name ? clusters.get(name) : void 0;
    return c ? CR[c.ci] : clist.length * 2;
  };
  function rankT() {
    let lo = 0, hi = clist.length;
    while (lo < hi) {
      const m = lo + hi >> 1, c = clist[m];
      c.fixed != null || CD[c.ci] >= T[2] ? lo = m + 1 : hi = m;
    }
    return lo * 2 - 1;
  }
  const N = new Int32Array(5);
  function matrices() {
    for (let n = 0; n < order.length; n++) {
      const ob = order[n], r = ob.rot, m = ob.M, p = ob.parent;
      if (ob.off || p && EA[p.i] < 0) {
        EA[ob.i] = -1;
        continue;
      }
      N[4] = N[4] + 1;
      const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
      const a00 = cy, a01 = sy * sx, a02 = sy * cx, a11 = cx, a12 = -sx, a20 = -sy, a21 = cy * sx, a22 = cy * cx;
      const l00 = cz * a00 + sz * a01, l10 = sz * a11, l20 = cz * a20 + sz * a21;
      const l01 = -sz * a00 + cz * a01, l11 = cz * a11, l21 = -sz * a20 + cz * a21;
      const px = ob.pos[0], py = ob.pos[1] + (p ? p.top : 0), pz = ob.pos[2];
      if (p) {
        const q = p.M;
        m[0] = q[0] * l00 + q[1] * l10 + q[2] * l20;
        m[1] = q[0] * l01 + q[1] * l11 + q[2] * l21;
        m[2] = q[0] * a02 + q[1] * a12 + q[2] * a22;
        m[3] = q[3] * l00 + q[4] * l10 + q[5] * l20;
        m[4] = q[3] * l01 + q[4] * l11 + q[5] * l21;
        m[5] = q[3] * a02 + q[4] * a12 + q[5] * a22;
        m[6] = q[6] * l00 + q[7] * l10 + q[8] * l20;
        m[7] = q[6] * l01 + q[7] * l11 + q[8] * l21;
        m[8] = q[6] * a02 + q[7] * a12 + q[8] * a22;
        m[9] = q[9] + q[0] * px + q[1] * py + q[2] * pz;
        m[10] = q[10] + q[3] * px + q[4] * py + q[5] * pz;
        m[11] = q[11] + q[6] * px + q[7] * py + q[8] * pz;
        EA[ob.i] = EA[p.i] * ob.alpha;
        ob.et = ob.tint || p.et;
      } else {
        m[0] = l00;
        m[1] = l01;
        m[2] = a02;
        m[3] = l10;
        m[4] = l11;
        m[5] = a12;
        m[6] = l20;
        m[7] = l21;
        m[8] = a22;
        m[9] = px;
        m[10] = py;
        m[11] = pz;
        EA[ob.i] = ob.alpha;
        ob.et = ob.tint;
      }
    }
  }
  function ranks() {
    for (let i = 0; i < clist.length; i++) {
      const c = clist[i], f = c.follow, a = c.at;
      if (c.fixed != null) {
        CD[c.ci] = c.fixed;
        continue;
      }
      if (f) Q[0] = f.M[9], Q[1] = f.M[10], Q[2] = f.M[11];
      else if (a) Q[0] = a[0], Q[1] = a[1], Q[2] = a[2];
      else Q[0] = Q[1] = Q[2] = 0;
      CD[c.ci] = depthQ();
    }
    for (let i = 1; i < clist.length; i++) {
      const c = clist[i];
      let j = i - 1;
      for (; j >= 0 && clusterBefore(c, clist[j]); j--) clist[j + 1] = clist[j];
      clist[j + 1] = c;
    }
    for (let i = 0; i < clist.length; i++) CR[clist[i].ci] = i * 2;
  }
  function faces() {
    for (let n = 0; n < order.length; n++) {
      const ob = order[n], me = ob.mesh, p = ob.parent, px = ob.pos[0], pz = ob.pos[2];
      let sh = p ? SH[p.i] : 0;
      if (ob.behind && p) {
        const q = p.M;
        if ((q[0] * px + q[2] * pz) * (q[9] - B[0]) + (q[3] * px + q[5] * pz) * (q[10] - B[1]) + (q[6] * px + q[8] * pz) * (q[11] - B[2]) > 0) sh += ob.behind;
      }
      SH[ob.i] = sh;
      if (ob.hidden || !me.nf || EA[ob.i] <= 0.01) continue;
      const m = ob.M, v = me.v, base = ob.vb * 3, rank = ob.cl ? CR[ob.cl.ci] : 0, bl = ob.below;
      N[3] = N[3] + me.nv;
      for (let i = 0; i < me.nv; i++) {
        const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
        Q[0] = m[0] * x + m[1] * y + m[2] * z + m[9];
        Q[1] = m[3] * x + m[4] * y + m[5] * z + m[10];
        Q[2] = m[6] * x + m[7] * y + m[8] * z + m[11];
        projQ();
        SV[base + i * 3] = T[0];
        SV[base + i * 3 + 1] = T[1];
        SV[base + i * 3 + 2] = T[2];
      }
      for (let f = 0; f < me.nf; f++) {
        const nx0 = me.nrm[f * 3], ny0 = me.nrm[f * 3 + 1], nz0 = me.nrm[f * 3 + 2], cx0 = me.cen[f * 3], cy0 = me.cen[f * 3 + 1], cz0 = me.cen[f * 3 + 2];
        const nx = m[0] * nx0 + m[1] * ny0 + m[2] * nz0, ny = m[3] * nx0 + m[4] * ny0 + m[5] * nz0, nz = m[6] * nx0 + m[7] * ny0 + m[8] * nz0;
        const wy = m[3] * cx0 + m[4] * cy0 + m[5] * cz0 + m[10];
        const vx = m[0] * cx0 + m[1] * cy0 + m[2] * cz0 + m[9] - B[0], vy = wy - B[1], vz = m[6] * cx0 + m[7] * cy0 + m[8] * cz0 + m[11] - B[2];
        if (nx * vx + ny * vy + nz * vz >= 0) continue;
        const s0 = me.fs[f], c = me.fc[f];
        let k = 0;
        while (k < c && SV[base + me.fv[s0 + k] * 3 + 2] >= 0.1) k++;
        if (k < c) continue;
        const e = slot(0, keyA(rank, (bl && wy < bl.y ? bl.layer : ob.layer) - sh), ob.i, f);
        if (e < 0) continue;
        KD[e] = vx * B[9] + vy * B[10] + vz * B[11];
        FLVL[e] = Math.round((ob.emissive ? 1 : amb + (1 - amb) * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])) * 32);
        N[0] = N[0] + 1;
      }
    }
  }
  function shadows() {
    for (let n = 0; n < order.length; n++) {
      const ob = order[n], p = ob.parent, ea = EA[ob.i], s = N[1];
      if (!ob.shadow || ob.hidden || !p || ea <= 0.01 || s >= MAXS) continue;
      const m = ob.M, q = p.M, dx = m[9] - q[9], dy = m[10] - q[10], dz = m[11] - q[11];
      const lx = q[0] * dx + q[3] * dy + q[6] * dz, lift = Math.max(0, q[1] * dx + q[4] * dy + q[7] * dz - p.top), lz = q[2] * dx + q[5] * dy + q[8] * dz;
      const fade = 1 - lift / 2.5;
      if (fade <= 0) continue;
      let ax = q[0] * m[0] + q[3] * m[3] + q[6] * m[6], az = q[2] * m[0] + q[5] * m[3] + q[8] * m[6];
      const al = hypot(ax, az) || 1;
      ax /= al;
      az /= al;
      const rx = ob.size[0] / 2 + 0.06 + lift * 0.1, rz = ob.size[2] / 2 + 0.06 + lift * 0.1, ox = lx + lift * 0.18, oz = lz - lift * 0.1, gy = p.top + 4e-3;
      let ok = true;
      for (let k = 0; k < SHN; k++) {
        const a = k / SHN * TAU;
        let c = Math.cos(a), si = Math.sin(a);
        if (ob.sq) c = Math.sign(c) * Math.abs(c) ** 0.35, si = Math.sign(si) * Math.abs(si) ** 0.35;
        const px = ox + ax * rx * c - az * rz * si, pz = oz + az * rx * c + ax * rz * si;
        Q[0] = q[0] * px + q[1] * gy + q[2] * pz + q[9];
        Q[1] = q[3] * px + q[4] * gy + q[5] * pz + q[10];
        Q[2] = q[6] * px + q[7] * gy + q[8] * pz + q[11];
        if (!projQ()) ok = false;
        SHP[(s * SHN + k) * 2] = T[0];
        SHP[(s * SHN + k) * 2 + 1] = T[1];
      }
      if (!ok) continue;
      const e = slot(1, keyA(p.cl ? CR[p.cl.ci] : 0, p.layer + 0.5 - SH[p.i]), ob.i, s);
      if (e < 0) continue;
      Q[0] = q[9] + q[0] * ox + q[1] * gy + q[2] * oz;
      Q[1] = q[10] + q[3] * ox + q[4] * gy + q[5] * oz;
      Q[2] = q[11] + q[6] * ox + q[7] * gy + q[8] * oz;
      KD[e] = depthQ();
      SHA[s] = ob.shadow * ea * fade;
      N[1] = s + 1;
    }
  }
  function extras() {
    for (let g = 0; g < pools.length; g++) {
      const P = pools[g], ka = keyA(rankOf(P.cluster), P.layer);
      for (let i = 0; i < P.n; i++) {
        if (P.a[i] <= 0) continue;
        Q[0] = P.x[i];
        Q[1] = P.y[i];
        Q[2] = P.z[i];
        if (!projQ()) continue;
        const e = slot(2, P.rank ? keyA(rankT(), P.layer) : ka, g, i);
        if (e < 0) continue;
        P.sx[i] = T[0];
        P.sy[i] = T[1];
        P.sr[i] = P.r[i] * B[12] / T[2];
        KD[e] = T[2];
        N[2] = N[2] + 1;
      }
    }
    for (let i = 0; i < decals.length; i++) {
      const dc = decals[i], a = dc.at, e = slot(3, keyA(rankOf(dc.cl), dc.layer), 0, i);
      if (e < 0) continue;
      if (a) Q[0] = a[0], Q[1] = a[1], Q[2] = a[2], KD[e] = depthQ();
      else KD[e] = Infinity;
    }
  }
  function paint() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    if (bg) ctx.fillStyle = typeof bg === "function" ? bg() : bg, ctx.fillRect(0, 0, W, H);
    else ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = "round";
    for (let q = 0; q < nf; q++) {
      const e = ORD[q], kind = KIND[e];
      if (kind === 3) ctx.globalAlpha = 1, decals[FIDX[e]].fn(ctx);
      else if (kind === 2) {
        const P = pools[FOBJ[e]], i = FIDX[e];
        ctx.globalAlpha = P.a[i];
        if (P.paint) P.paint(ctx, i, P);
        else ctx.fillStyle = P.color[i] || P.colorAll, ctx.beginPath(), ctx.arc(P.sx[i], P.sy[i], P.sr[i], 0, TAU), ctx.fill();
      } else if (kind === 1) {
        const s = FIDX[e], j0 = s * SHN * 2;
        ctx.globalAlpha = SHA[s];
        ctx.beginPath();
        for (let k = 0; k < SHN; k++) k ? ctx.lineTo(SHP[j0 + k * 2], SHP[j0 + k * 2 + 1]) : ctx.moveTo(SHP[j0], SHP[j0 + 1]);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle = o.shadowColor || "#000000";
        ctx.fill();
        ctx.globalAlpha = SHA[s] * 0.45;
        ctx.lineWidth = 5;
        ctx.stroke();
      } else {
        const ob = objs[FOBJ[e]], me = ob.mesh, f = FIDX[e], s0 = me.fs[f], c = me.fc[f], base = ob.vb * 3, ea = EA[ob.i];
        ctx.globalAlpha = ea;
        ctx.beginPath();
        for (let k = 0; k < c; k++) {
          const j = base + me.fv[s0 + k] * 3;
          k ? ctx.lineTo(SV[j], SV[j + 1]) : ctx.moveTo(SV[j], SV[j + 1]);
        }
        ctx.closePath();
        const col = ob.et || ob.color, lv = FLVL[e];
        ctx.fillStyle = shade(col, lv);
        ctx.fill();
        if (o.edge !== false && ea > 0.95) ctx.strokeStyle = shade(col, lv > 5 ? lv - 5 : 0), ctx.lineWidth = 0.9, ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  function draw() {
    sync();
    nf = stats.dropped = N[0] = N[1] = N[2] = N[3] = N[4] = 0;
    matrices();
    ranks();
    faces();
    shadows();
    extras();
    sortKeys(nf);
    paint();
    if (o.overlay) o.overlay(ctx, api);
    stats.faces = N[0];
    stats.shadows = N[1];
    stats.points = N[2];
    stats.verts = N[3];
    stats.objects = N[4];
  }
  const clusterBefore = (a, b) => {
    const fa = a.fixed != null, fb = b.fixed != null;
    return fa !== fb ? fa : fa ? CD[a.ci] < CD[b.ci] : CD[a.ci] > CD[b.ci];
  };
  function inPoly(base, me, f, x, y) {
    const s0 = me.fs[f], c = me.fc[f];
    let ins = false;
    for (let i = 0, j = c - 1; i < c; j = i++) {
      const a = base + me.fv[s0 + i] * 3, b = base + me.fv[s0 + j] * 3, ay = SV[a + 1], by = SV[b + 1];
      if (ay > y !== by > y && x < (SV[b] - SV[a]) * (y - ay) / (by - ay) + SV[a]) ins = !ins;
    }
    return ins;
  }
  function pick(x, y) {
    for (let q = nf - 1; q >= 0; q--) {
      const e = ORD[q];
      if (KIND[e]) continue;
      const ob = objs[FOBJ[e]];
      if (ob.pick && EA[ob.i] > 0.2 && inPoly(ob.vb * 3, ob.mesh, FIDX[e], x, y)) return ob;
    }
    return null;
  }
  function ground(x, y, py, out) {
    sync();
    const k = B[12], sx = (x - W / 2 - cam.ox) / k, sy = -(y - H / 2 - cam.oy) / k;
    const dx = B[3] * sx + B[6] * sy + B[9], dy = B[4] * sx + B[7] * sy + B[10], dz = B[5] * sx + B[8] * sy + B[11];
    if (Math.abs(dy) < 1e-9) return false;
    const t = (py - B[1]) / dy;
    if (t <= 0) return false;
    out[0] = B[0] + dx * t;
    out[1] = py;
    out[2] = B[2] + dz * t;
    return true;
  }
  const api = {
    /** The canvas's 2D context. */
    ctx,
    /** The camera `draw`, `project`, `ground` and `pick` use: change it freely between draws. */
    cam,
    /** The last draw: faces, shadows, points, verts, objects on (matrices computed; `off` subtrees left out), and entries dropped (over maxFaces). */
    stats,
    /** Add an object (`DioramaObjectDef`); returns its live handle. Throws past `maxVerts`. */
    add,
    /** The object named `id`. */
    get: (id) => byId.get(id),
    /** Rest `ob` on `parentId` (null: on nothing); its `pos` is from then on from the new parent's top. */
    on(ob, parentId) {
      ob.on = parentId;
      relink();
    },
    /** Remove every object, cluster, decal and point pool (meshes stay cached). */
    clear,
    /** Name a cluster: `{ fixed: n }` draws before every unfixed one, in n order (a room, a table);
     *  `{ at: [x, y, z] }` ranks it far to near by that point. Redefining one keeps its objects. */
    cluster: (name, c) => cluster(name, c),
    /** Paint `fn(ctx)` in the sort: in `cluster` at `layer`, behind that layer's faces, or by the
     *  depth of `at` (read each draw) among them. */
    decal(cl, layer, fn, at = null) {
      decals.push({ cl, layer, fn, at });
    },
    /** A fixed pool of points (sparks, shells, smoke) drawn in the depth sort (`DioramaPoints`). */
    points(p) {
      const f = () => new Float64Array(p.cap), pool = {
        n: 0,
        x: f(),
        y: f(),
        z: f(),
        r: f(),
        a: f().fill(1),
        color: new Array(p.cap).fill(void 0),
        sx: f(),
        sy: f(),
        sr: f(),
        cluster: p.cluster ?? null,
        layer: p.layer ?? 5,
        rank: p.rank || null,
        colorAll: p.color || "#ffffff",
        paint: p.paint || null
      };
      pools.push(pool);
      return pool;
    },
    /** Set the light's direction (towards it) and the ambient level. */
    setLight,
    /** Size the backing store: CSS width and height and the density (no arguments: the canvas's
     *  client size and devicePixelRatio, capped at `maxDpr`; a layout read, so call it after a resize). */
    resize,
    /** Frame `points` ([x, y, z, …], world) inside the safe rect: sets c.dist, then c.ox and c.oy so
     *  the points' screen box is centred in it. Uses c's yaw, pitch, target and fov; returns c. */
    fit,
    /** Hold `c` (default `cam`) inside the limits; returns c. */
    clamp,
    /** Draw the frame: matrices, sort, paint, then `overlay`. */
    draw,
    /** The front-most pickable object under (x, y) (CSS px), as of the last draw, or null. */
    pick,
    /** Where the ray under (x, y) meets the plane y = planeY: out = [x, y, z]; false if it never does. */
    ground,
    /** World (x, y, z) to screen: out = [x, y, depth]; false when behind the camera. */
    project(x, y, z, out) {
      sync();
      return proj(B, cam, x, y, z, out);
    },
    /** The camera's world position (the eye): out = [x, y, z]; returns out. */
    eye(out) {
      sync();
      out[0] = B[0];
      out[1] = B[1];
      out[2] = B[2];
      return out;
    },
    /** Screen px per world unit at depth 1 (a size s at depth z is s × focal() / z px). */
    focal: () => (sync(), B[12]),
    /** Call fn on every object (recolour on a theme change, find parts). */
    recolor(fn) {
      for (let i = 0; i < objs.length; i++) fn(objs[i]);
    },
    /** The nearest ancestor with a `tag` (or the top of the chain): what a pick on a part belongs to. */
    root(ob) {
      while (ob && ob.tag == null && ob.parent) ob = ob.parent;
      return ob;
    },
    /** CSS width, as last sized. */
    get width() {
      return W;
    },
    /** CSS height, as last sized. */
    get height() {
      return H;
    },
    /** Device pixels per CSS px. */
    get dpr() {
      return dpr;
    }
  };
  resize();
  return api;
}
function occlude(d, o) {
  const obs = o.objects, A = new Float64Array(obs.length).fill(1), E = new Float64Array(3);
  const R = new Float64Array(9), Bd = new Float64Array(6);
  const ghost = o.ghost ?? 0.16, near = o.near ?? 0, t = o.t ?? 0.15;
  const oc = {
    reduced: !!o.reduced,
    tested: 0,
    step(dt, pts, n = pts.length / 3 | 0) {
      d.eye(E);
      let busy = false;
      for (let j = 0; j < 3; j++) {
        Bd[j] = Bd[j + 3] = E[j];
        for (let k = j; k < n * 3; k += 3) Bd[j] = Math.min(Bd[j], pts[k]), Bd[j + 3] = Math.max(Bd[j + 3], pts[k]);
      }
      const rate = oc.reduced || t <= 0 ? 2 : dt / t;
      oc.tested = 0;
      for (let i = 0; i < obs.length; i++) {
        const ob = obs[i], s = ob.size, p = ob.pos, hx = s[0] / 2, hz = s[2] / 2, r = hx + hz;
        let goal = 1, j = 0;
        while (j < 3 && p[j] + (j === 1 ? s[1] : r) >= Bd[j] && p[j] - (j === 1 ? 0 : r) <= Bd[j + 3]) j++;
        if (j > 2) {
          oc.tested++;
          const c = Math.cos(ob.rot[1]), sn = Math.sin(ob.rot[1]), ax = E[0] - p[0], az = E[2] - p[2];
          const lx = c * ax - sn * az, ly = E[1] - p[1], lz = sn * ax + c * az;
          R[0] = lx;
          R[1] = ly;
          R[2] = lz;
          R[6] = hx;
          R[7] = s[1];
          R[8] = hz;
          for (let k = 0; k < n * 3; k += 3) {
            const bx = pts[k] - p[0], bz = pts[k + 2] - p[2];
            R[3] = c * bx - sn * bz - lx;
            R[4] = pts[k + 1] - p[1] - ly;
            R[5] = sn * bx + c * bz - lz;
            let t0 = 0, t1 = 1, w = 0;
            for (j = 0; j < 3; j++) {
              const lo = j === 1 ? 0 : -R[6 + j], hi = R[6 + j], q = R[j], dd = R[3 + j];
              const u = (lo - q) / dd, v = (hi - q) / dd;
              if (q > lo && q < hi) w++;
              t0 = Math.max(t0, Math.min(u, v));
              t1 = Math.min(t1, Math.max(u, v));
            }
            if (w > 2) {
              goal = 0;
              break;
            }
            if (t0 <= t1 && (1 - t0) * Math.sqrt(R[3] * R[3] + R[4] * R[4] + R[5] * R[5]) > near) {
              goal = ghost;
              break;
            }
          }
        }
        let a = A[i];
        a = a < goal ? Math.min(goal, a + rate) : Math.max(goal, a - rate);
        A[i] = ob.alpha = a;
        if (a !== goal) busy = true;
      }
      return busy;
    }
  };
  return oc;
}
export {
  diorama,
  occlude
};
