// The social card (og.png, 1200 × 630): the Fizlet mark's pixel rects on the board grid, encoded as
// a PNG with node:zlib only (the mark is all axis-aligned rects, so no rasterizer is needed).
import { deflateSync } from "node:zlib";

const W = 1200, H = 630;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

/** → a PNG Buffer. */
export function ogImage() {
  const px = new Uint8Array(W * H * 3);
  const rect = (x, y, w, h, [r, g, b], a = 1) => {
    for (let j = Math.max(0, y); j < Math.min(H, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) {
        const k = (j * W + i) * 3;
        px[k] += (r - px[k]) * a;
        px[k + 1] += (g - px[k + 1]) * a;
        px[k + 2] += (b - px[k + 2]) * a;
      }
  };
  const BG = hex("#07060f"), CYAN = hex("#19f0ff"), MINT = hex("#39ffb0"), PINK = hex("#ff2e88");
  rect(0, 0, W, H, BG);
  for (let x = 0; x < W; x += 45) rect(x, 0, 1, H, CYAN, 0.12);
  for (let y = 0; y < H; y += 45) rect(0, y, W, 1, CYAN, 0.12);
  // The mark (site/layout.mjs mark(), a 64-unit tile) at 6 px a unit, centred.
  const S = 6, ox = (W - 64 * S) >> 1, oy = (H - 64 * S) >> 1;
  const m = (x, y, w, h, c, a) => rect(ox + x * S, oy + y * S, w * S, h * S, c, a);
  for (const v of [16, 32, 48]) (m(0, v, 64, 0.34, CYAN, 0.35), m(v, 0, 0.34, 64, CYAN, 0.35));
  m(0, 0, 64, 2, CYAN), m(0, 62, 64, 2, CYAN), m(0, 0, 2, 64, CYAN), m(62, 0, 2, 64, CYAN);
  m(8, 30, 26, 7, MINT), m(8, 49, 26, 7, MINT), m(8, 37, 7, 12, MINT), m(27, 37, 7, 12, MINT);
  m(36, 18, 14, 14, MINT), m(40, 40, 8, 8, MINT);
  m(52, 6, 6, 6, PINK), m(46, 6, 3, 3, PINK), m(58, 14, 3, 3, PINK);
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
