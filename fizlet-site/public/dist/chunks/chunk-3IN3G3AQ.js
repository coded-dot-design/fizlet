// src/math.ts
var AB = /* @__PURE__ */ new ArrayBuffer(8);
var F = /* @__PURE__ */ new Float64Array(AB);
var I = /* @__PURE__ */ new Int32Array(AB);
var hi = (x) => (F[0] = x, I[1]);
var lo = (x) => (F[0] = x, I[0]);
var A = /* @__PURE__ */ new Float64Array(2);
var O = /* @__PURE__ */ new Float64Array(1);
var Y = /* @__PURE__ */ new Float64Array(2);
function ksin(iy) {
  const x = Y[0], y = Y[1];
  if ((hi(x) & 2147483647) < 1044381696 && (x | 0) === 0) return void (O[0] = x);
  const z = x * x, v = z * x;
  const r = 0.00833333333332249 + z * (-1984126982985795e-19 + z * (27557313707070068e-22 + z * (-25050760253406863e-24 + z * 158969099521155e-24)));
  if (iy === 0) O[0] = x + v * (-0.16666666666666632 + z * r);
  else O[0] = x - (z * (0.5 * y - v * r) - y - v * -0.16666666666666632);
}
function kcos() {
  const x = Y[0], y = Y[1], ix = hi(x) & 2147483647;
  const z = x * x;
  const r = z * (0.0416666666666666 + z * (-0.001388888888887411 + z * (2480158728947673e-20 + z * (-27557314351390663e-23 + z * (2087572321298175e-24 + z * -11359647557788195e-27)))));
  if (ix < 1070805811) return void (O[0] = 1 - (0.5 * z - (z * r - x * y)));
  if (ix > 1072234496) return void (O[0] = 1 - 0.28125 - (0.5 * z - 0.28125 - (z * r - x * y)));
  I[1] = ix - 2097152, I[0] = 0;
  const qx = F[0];
  O[0] = 1 - qx - (0.5 * z - qx - (z * r - x * y));
}
var P1 = 1.5707963267341256;
var P1T = 6077100506506192e-26;
var P2 = 6077100506303966e-26;
var P2T = 20222662487959506e-37;
var P3 = 20222662487111665e-37;
var P3T = 84784276603689e-45;
function rem() {
  let x = A[0];
  if ((hi(x) & 2147483647) > 1094263291) x %= 6.283185307179586;
  const hx = hi(x), ix = hx & 2147483647;
  if (ix < 1073928572) {
    const s = hx > 0 ? 1 : -1, near = ix === 1073291771, z = x - s * P1 - (near ? s * P2 : 0), tail = s * (near ? P2T : P1T);
    return Y[0] = z - tail, Y[1] = z - Y[0] - tail, s;
  }
  const n = Math.trunc(Math.abs(x) * 0.6366197723675814 + 0.5), j = ix >> 20;
  let r = Math.abs(x) - n * P1, w = n * P1T, t = 0;
  Y[0] = r - w;
  for (let k = 0; k < 2 && j - (hi(Y[0]) >> 20 & 2047) > (k ? 49 : 16); k++) {
    t = r;
    w = n * (k ? P3 : P2);
    r = t - w;
    w = n * (k ? P3T : P2T) - (t - r - w);
    Y[0] = r - w;
  }
  Y[1] = r - Y[0] - w;
  if (hx < 0) return Y[0] = -Y[0], Y[1] = -Y[1], -n | 0;
  return n | 0;
}
function sc(c) {
  const x = A[0], ix = hi(x) & 2147483647;
  if (ix <= 1072243195) return Y[0] = x, Y[1] = 0, void (c ? kcos() : ksin(0));
  if (ix >= 2146435072) return void (O[0] = NaN);
  const n = rem() + c & 3;
  n & 1 ? kcos() : ksin(1);
  if (n & 2) O[0] = -O[0];
}
var sin = (x) => (A[0] = x, sc(0), O[0]);
var cos = (x) => (A[0] = x, sc(1), O[0]);
var AHI = [0.4636476090008061, 0.7853981633974483, 0.982793723247329, 1.5707963267948966];
var ALO = [22698777452961687e-33, 3061616997868383e-32, 13903311031230998e-33, 6123233995736766e-32];
var AT = [0.3333333333333293, -0.19999999999876483, 0.14285714272503466, -0.11111110405462356, 0.09090887133436507, -0.0769187620504483, 0.06661073137387531, -0.058335701337905735, 0.049768779946159324, -0.036531572744216916, 0.016285820115365782];
function at() {
  let x = A[0];
  const hx = hi(x), ix = hx & 2147483647;
  let id = -1;
  if (ix >= 1141899264) {
    return void (O[0] = x !== x ? x : hx > 0 ? AHI[3] + ALO[3] : -AHI[3] - ALO[3]);
  }
  if (ix < 1071382528) {
    if (ix < 1042284544) return void (O[0] = x);
  } else {
    x = Math.abs(x);
    if (ix < 1072889856) {
      if (ix < 1072037888) id = 0, x = (2 * x - 1) / (2 + x);
      else id = 1, x = (x - 1) / (x + 1);
    } else if (ix < 1073971200) id = 2, x = (x - 1.5) / (1 + 1.5 * x);
    else id = 3, x = -1 / x;
  }
  const z = x * x, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return void (O[0] = x - x * (s1 + s2));
  const r = AHI[id] - (x * (s1 + s2) - ALO[id] - x);
  O[0] = r;
  if (hx < 0) O[0] = -r;
}
var PI = 3.141592653589793;
var PI_LO = 12246467991473532e-32;
var PI_2 = 1.5707963267948966;
var PI_4 = 0.7853981633974483;
function at2() {
  const y = A[0], x = A[1];
  if (x !== x || y !== y) return void (O[0] = NaN);
  const hx = hi(x), lx = lo(x), ix = hx & 2147483647, hy = hi(y), iy = hy & 2147483647;
  if (hx === 1072693248 && lx === 0) return at();
  const m = hy >> 31 & 1 | hx >> 30 & 2, k = iy - ix >> 20;
  if ((iy | lo(y)) === 0) return void (O[0] = m < 2 ? y : m === 2 ? PI : -PI);
  if ((ix | lx) === 0 || iy === 2146435072 && ix !== 2146435072) return void (O[0] = hy < 0 ? -PI_2 : PI_2);
  if (ix === 2146435072) return void (O[0] = (iy === 2146435072 ? m & 2 ? 3 * PI_4 : PI_4 : m & 2 ? PI : 0) * (m & 1 ? -1 : 1));
  if (k > 60) return void (O[0] = hy < 0 ? -PI_2 - 0.5 * PI_LO : PI_2 + 0.5 * PI_LO);
  if (hx < 0 && k < -60) return void (O[0] = m & 1 ? -PI : PI);
  A[0] = Math.abs(y / x), at();
  const z = O[0];
  if (m === 1) O[0] = -z;
  else if (m === 2) O[0] = PI - (z - PI_LO);
  else if (m === 3) O[0] = z - PI_LO - PI;
}
var atan = (x) => (A[0] = x, at(), O[0]);
var atan2 = (y, x) => (A[0] = y, A[1] = x, at2(), O[0]);
var hypot = (dx, dy) => {
  const ax = Math.abs(dx), ay = Math.abs(dy), max = ax > ay ? ax : ay, z = max === 0 ? 1 : max, p = ax / z, q = ay / z;
  return ax === Infinity || ay === Infinity ? Infinity : Math.sqrt(p * p + q * q) * max;
};

export {
  sin,
  cos,
  atan,
  atan2,
  hypot
};
