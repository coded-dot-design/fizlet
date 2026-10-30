// The size badge: what a live demo ships, gzipped, on a token-styled sticker ("9.4 KB GZ").
// Every number comes from the build, never typed: `bytes` is the gzip size of the built file
// `live` (site-relative) plus its static imports (scripts/live-bytes.mjs), or, for a module's own
// size, `live` is "size:<entry>" from scripts/sizes.mjs (e.g. "size:fizlet (kernel)").
// tests/site.mjs measures it again and fails if the badge disagrees, or if a live demo has none.
// Shared component: the website pages and the gallery both use it (owner: the website session).
import { esc } from "./layout.mjs";

/** `bytes`: gzip bytes; `live`: the built file (or "size:<entry>") they were measured from; `what`: what it is (screen readers, tooltip). */
export const sizeBadge = (bytes, live, what = "live code") =>
  `<span class="size-badge" data-size-badge data-bytes="${bytes}" data-live="${esc(live)}" title="${bytes.toLocaleString("en-US")} B gzip, measured at build"><b>${(bytes / 1024).toFixed(1)} KB</b> gz<span class="sr">: ${esc(what)}, ${bytes.toLocaleString("en-US")} bytes gzipped, measured at build</span></span>`;
