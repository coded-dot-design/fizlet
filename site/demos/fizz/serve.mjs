// A tiny static server for site-dist/ at /fizlet/ (as GitHub Pages serves it), for the fizz
// measurement and browser test.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json" };
export async function serve(root = "site-dist", base = "/fizlet/") {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let f = url.pathname.startsWith(base) ? join(root, normalize(decodeURIComponent(url.pathname.slice(base.length))).replace(/^(\.\.[/\\])+/, "")) : "";
    if (f && existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!f || !existsSync(f) || !statSync(f).isFile()) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${server.address().port}`, base, close: () => server.close() };
}
