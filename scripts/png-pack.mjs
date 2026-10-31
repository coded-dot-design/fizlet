// Lossless PNG packing for the inline posters (data:image/png in site/gallery/stages/<id>.html).
// Chromium's canvas.toDataURL writes 8-bit RGBA; a pixel-art poster has a few dozen colours, so
// the same pixels as an indexed PNG (palette + tRNS, the smallest bit depth that fits, filter 0)
// are about a third of the bytes. Pixels are compared after packing; the original is kept when
// it has more than 256 colours or packing would not make it smaller. node:zlib only.
//   node scripts/png-pack.mjs           pack every stage's inline PNGs
//   node scripts/png-pack.mjs --check   fail if one would still shrink (tests run this)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { constants, crc32, deflateSync, inflateSync } from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Decode an 8-bit (or indexed 1/2/4-bit), non-interlaced PNG: { w, h, rgba } (Uint32 per pixel). */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("png-pack: not a PNG");
  let ihdr, plte, trns;
  const idat = [];
  for (let i = 8; i < buf.length; ) {
    const n = buf.readUInt32BE(i), type = buf.toString("latin1", i + 4, i + 8), d = buf.subarray(i + 8, i + 8 + n);
    if (type === "IHDR") ihdr = d;
    else if (type === "PLTE") plte = d;
    else if (type === "tRNS") trns = d;
    else if (type === "IDAT") idat.push(d);
    i += 12 + n;
  }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), bd = ihdr[8], ct = ihdr[9];
  if (ihdr[12] !== 0 || !(bd === 8 || (ct === 3 && bd < 8))) throw new Error(`png-pack: unsupported PNG (bit depth ${bd}, colour type ${ct}, interlace ${ihdr[12]})`);
  const bpp = CHANNELS[ct], stride = bd === 8 ? w * bpp : (w * bd + 7) >> 3, raw = inflateSync(Buffer.concat(idat));
  const step = bd === 8 ? bpp : 1;
  const rgba = new Uint32Array(w * h);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= step ? line[x - step] : 0, b = prev[x], c = x >= step ? prev[x - step] : 0;
      if (f === 1) line[x] += a;
      else if (f === 2) line[x] += b;
      else if (f === 3) line[x] += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[x] += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
    }
    for (let x = 0; x < w; x++) {
      let r, g, bl, al = 255;
      if (ct === 3) {
        const i = bd === 8 ? line[x] : (line[(x * bd) >> 3] >> (8 - bd - ((x * bd) & 7))) & ((1 << bd) - 1);
        (r = plte[i * 3]), (g = plte[i * 3 + 1]), (bl = plte[i * 3 + 2]), (al = trns && i < trns.length ? trns[i] : 255);
      } else if (ct === 6 || ct === 2) {
        const o = x * bpp;
        (r = line[o]), (g = line[o + 1]), (bl = line[o + 2]);
        if (ct === 6) al = line[o + 3];
      } else {
        const o = x * bpp;
        r = g = bl = line[o];
        if (ct === 4) al = line[o + 1];
      }
      rgba[y * w + x] = ((r << 24) | (g << 16) | (bl << 8) | al) >>> 0;
    }
    prev = line;
  }
  return { w, h, rgba };
}

const chunk = (type, data) => {
  const head = Buffer.alloc(8), body = Buffer.concat([Buffer.from(type, "latin1"), data]), crc = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([head.subarray(0, 4), body, crc]);
};

/** The same pixels as an indexed PNG, or null when there are more than 256 colours. */
export function indexedPng({ w, h, rgba }) {
  const seen = new Map();
  for (const p of rgba) if (!seen.has(p) && seen.set(p, 0).size > 256) return null;
  // Translucent colours first, so tRNS stops at the last one (opaque entries need none).
  const pal = [...seen.keys()].sort((a, b) => ((a & 255) === 255) - ((b & 255) === 255));
  pal.forEach((p, i) => seen.set(p, i));
  const n = pal.length, bd = n <= 2 ? 1 : n <= 4 ? 2 : n <= 16 ? 4 : 8, stride = (w * bd + 7) >> 3;
  const raw = Buffer.alloc(h * (stride + 1)); // filter byte 0 on every row: the best choice for indexed images
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (stride + 1) + 1 + ((x * bd) >> 3);
    raw[o] |= seen.get(rgba[y * w + x]) << (8 - bd - ((x * bd) & 7));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  (ihdr[8] = bd), (ihdr[9] = 3);
  const plte = Buffer.from(pal.flatMap((p) => [p >>> 24, (p >>> 16) & 255, (p >>> 8) & 255]));
  const alpha = pal.filter((p) => (p & 255) !== 255).map((p) => p & 255);
  const idat = [constants.Z_DEFAULT_STRATEGY, constants.Z_FILTERED, constants.Z_RLE]
    .map((strategy) => deflateSync(raw, { level: 9, memLevel: 9, strategy }))
    .reduce((a, b) => (b.length < a.length ? b : a));
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("PLTE", plte), ...(alpha.length ? [chunk("tRNS", Buffer.from(alpha))] : []), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const same = (a, b) => a.w === b.w && a.h === b.h && a.rgba.every((p, i) => p === b.rgba[i]);

/** `buf` packed losslessly (pixels checked), or `buf` itself when packing does not help. */
export function packPng(buf) {
  const img = decodePng(buf), out = indexedPng(img);
  if (!out || out.length >= buf.length) return buf;
  if (!same(img, decodePng(out))) throw new Error("png-pack: packed pixels differ");
  return out;
}

const URI = /data:image\/png;base64,([A-Za-z0-9+/=]+)/g;

/** `html` with every inline PNG packed. */
export const packHtml = (html) => html.replace(URI, (all, b64) => {
  const src = Buffer.from(b64, "base64"), out = packPng(src);
  return out === src ? all : `data:image/png;base64,${out.toString("base64")}`;
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const DIR = "site/gallery/stages", check = process.argv.includes("--check");
  let loose = 0;
  for (const f of readdirSync(DIR).filter((f) => f.endsWith(".html")).sort()) {
    const html = readFileSync(`${DIR}/${f}`, "utf8"), next = packHtml(html);
    if (next === html) continue;
    if (check) (loose++, console.error(`${DIR}/${f}: inline PNG not packed (node scripts/png-pack.mjs)`));
    else (writeFileSync(`${DIR}/${f}`, next), console.log(`${DIR}/${f}: ${html.length} → ${next.length} B`));
  }
  if (loose) process.exit(1);
}
