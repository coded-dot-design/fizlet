// fizlet.com on Astro. Every URL stays the legacy site's: folder pages (docs/getting-started/) and
// the brick pages' .html files (bricks/kernel.html), so the build keeps file names as authored.
// The engine is the pinned @fzlt/core npm dependency: the page scripts (src/scripts) import it and
// Vite bundles them; the hosted builds the docs link to (/dist/, the ESM build, and /fizlet.js, the
// one-file script-tag build) are written from the same package at build time, never copied in.
import { defineConfig } from "astro/config";
import { build } from "vite";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const CORE = fileURLToPath(new URL("node_modules/@fzlt/core/", import.meta.url));
const { version } = JSON.parse(readFileSync(CORE + "package.json", "utf8"));
// fizlet.js: the kernel and the bricks the quick start uses, on window.fizlet (as the legacy build).
const ALL = ["", "/input", "/collide", "/fx", "/sound", "/embed", "/ui"].map((s) => `export * from "@fzlt/core${s}";`).join("");

/** The hosted engine builds, from node_modules/@fzlt/core, into the site's output. */
const engineBuilds = () => ({
  name: "fizlet-engine-builds",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const out = fileURLToPath(dir);
      cpSync(CORE + "dist", out + "dist", { recursive: true });
      const entry = fileURLToPath(new URL(".astro/fizlet-all.js", import.meta.url));
      mkdirSync(dirname(entry), { recursive: true });
      writeFileSync(entry, ALL);
      const res = await build({
        configFile: false, logLevel: "warn", root: fileURLToPath(new URL(".", import.meta.url)),
        build: {
          write: false, minify: true, target: "es2022",
          lib: { entry, formats: ["iife"], name: "fizlet", fileName: () => "fizlet.js" },
        },
      });
      const chunk = (Array.isArray(res) ? res[0] : res).output[0];
      writeFileSync(out + "fizlet.js", `/*! Fizlet ${version} · MIT · https://github.com/coded-dot-design/fizlet */\n${chunk.code}`);
    },
  },
});

export default defineConfig({
  site: process.env.SITE_URL || "https://fizlet.com",
  trailingSlash: "ignore",
  build: { format: "preserve", inlineStylesheets: "never" },
  compressHTML: false,
  devToolbar: { enabled: false },
  integrations: [engineBuilds()],
});
