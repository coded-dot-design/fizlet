// fizlet.com on Astro. Every URL stays the legacy site's: folder pages (docs/getting-started/) and
// the brick pages' .html files (bricks/kernel.html), so the build keeps file names as authored.
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL || "https://fizlet.com",
  trailingSlash: "ignore",
  build: { format: "preserve", inlineStylesheets: "never" },
  compressHTML: false,
  devToolbar: { enabled: false },
});
