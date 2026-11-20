// sitemap.xml: every page built here that the legacy sitemap listed (the ported routes; at the
// production cutover that is every indexable page). Staging and preview builds list nothing.
import type { APIRoute } from "astro";
import ROUTES from "../data/legacy/routes.json";
import PLAN from "../data/migration.json";
import { SITE, NOINDEX_BUILD } from "../lib/site";

export const GET: APIRoute = () => {
  const done = new Set(PLAN.done);
  const urls = NOINDEX_BUILD ? [] : ROUTES.filter((r) => r.inSitemap && done.has(r.path)).map((r) => `<url><loc>${SITE}${r.path}</loc></url>`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`, { headers: { "content-type": "application/xml" } });
};
