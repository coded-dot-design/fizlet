// A tiny static server for the built story (measure.mjs and tests/layers.mjs).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function serve(root) {
  return new Promise((done) => {
    const srv = createServer(async (q, r) => {
      const p = new URL(q.url, "http://x").pathname;
      try {
        const body = await readFile(join(root, p === "/" ? "index.html" : p));
        r.setHeader("content-type", p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html; charset=utf-8");
        r.end(body);
      } catch {
        r.statusCode = 404;
        r.end();
      }
    }).listen(0, "127.0.0.1", () => done({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}
