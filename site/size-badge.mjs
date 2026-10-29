// The size badge: one measured number, in bytes gzip, on a token-styled sticker. Every number it
// shows must come from the build (scripts/sizes.mjs or a bundle measured in the build script),
// never typed by hand. `name` ties the badge to its measurement, so tests can check the number.
// Shared component: the website pages and the gallery both use it (owner: the website session).
import { esc } from "./layout.mjs";

/** `<span class="size-badge">`: "<bytes> B gzip", with an optional note (what was measured). */
export const sizeBadge = (bytes, { name, note } = {}) =>
  `<span class="size-badge"${name ? ` data-size="${esc(name)}"` : ""}><b>${Number(bytes).toLocaleString("en-US")} B</b><small>gzip${note ? ` · ${esc(note)}` : ""}</small></span>`;
