// scripts/png-pack.mjs: the inline posters' PNGs are packed losslessly, and every stage is packed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { decodePng, packHtml, packPng } from "../scripts/png-pack.mjs";

// An 8-bit RGBA PNG (filter 0), as a canvas would write it.
function rgbaPng(w, h, px) {
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0);
    b.write(type, 4, "latin1");
    data.copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  (ihdr[8] = 8), (ihdr[9] = 6);
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.writeUInt32BE(px(x, y) >>> 0, y * (w * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

for (const [name, colours] of [["2 colours (1-bit)", 2], ["4 colours (2-bit)", 4], ["13 colours (4-bit)", 13], ["60 colours (8-bit)", 60]]) {
  test(`packPng keeps every pixel: ${name}, translucent ones too`, () => {
    const pal = Array.from({ length: colours }, (_, i) => ((i * 0x9e3779b1) & 0xffffff00) | (i % 3 ? 255 : i * 7 & 255));
    // A pixel-art frame: 4 × 4 blocks, each one colour of the palette.
    const src = rgbaPng(160, 90, (x, y) => pal[(Math.imul((x >> 2) * 41 + (y >> 2), 2654435761) >>> 9) % colours]);
    const out = packPng(src);
    assert.ok(out.length < src.length, `${out.length} < ${src.length}`);
    assert.deepEqual(decodePng(out), decodePng(src));
    assert.equal(packPng(out), out, "packing twice changes nothing");
  });
}

test("packPng leaves a PNG with more than 256 colours alone", () => {
  const src = rgbaPng(20, 20, (x, y) => ((x * 20 + y) << 8) | 255);
  assert.equal(packPng(src), src);
});

test("every stage's inline PNG is packed (node scripts/png-pack.mjs)", () => {
  const dir = "site/gallery/stages";
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(`${dir}/${f}`, "utf8");
    assert.equal(packHtml(html), html, `${dir}/${f}`);
  }
});
