// robots.txt: production serves the legacy crawl policy (crawlers admitted, AI crawlers named, the
// sitemap); staging and preview builds (PUBLIC_ROBOTS=noindex) turn every crawler away.
import type { APIRoute } from "astro";
import LEGACY from "../data/legacy/robots.txt?raw";
import { NOINDEX_BUILD } from "../lib/site";

export const GET: APIRoute = () => new Response(
  NOINDEX_BUILD ? "# Staging build: not for search.\nUser-agent: *\nDisallow: /\n" : LEGACY,
  { headers: { "content-type": "text/plain; charset=utf-8" } });
