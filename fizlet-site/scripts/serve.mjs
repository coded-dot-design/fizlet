// A tiny static server for a built folder (the gates and the compare): node scripts/serve.mjs dist 4802
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".webp": "image/webp", ".woff2": "font/woff2" };
export function serve(root, port = 0) {
  const server = createServer((req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    let f = join(root, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
    res.end(readFileSync(f));
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await serve(process.argv[2] ?? "dist", +(process.argv[3] ?? 4802));
  console.log(`Serving ${process.argv[2] ?? "dist"} on http://127.0.0.1:${s.address().port}/`);
}
