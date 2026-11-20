// sitemap.xml: the legacy rule, one source. Every page built here that is indexable (the legacy
// sitemap listed it: not the 404, not noindex), at its canonical URL, sorted by URL, in the legacy
// file's format. Until the cutover that is the ported routes; staging and preview builds list nothing.
// scripts/links.mjs checks the built file against the legacy list.
import type { APIRoute } from "astro";
import ROUTES from "../data/legacy/routes.json";
import PLAN from "../data/migration.json";
import { SITE, NOINDEX_BUILD } from "../lib/site";

export const GET: APIRoute = () => {
  const done = new Set(PLAN.done);
  const urls = NOINDEX_BUILD ? [] : ROUTES.filter((r) => r.inSitemap && done.has(r.path)).map((r) => SITE + r.path).sort((a, b) => (a < b ? -1 : 1));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`, { headers: { "content-type": "application/xml" } });
};
