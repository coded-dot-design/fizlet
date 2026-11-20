// Site constants and the navigation, one source (the legacy site/layout.mjs, ported).
import ICONS from "../data/icons.json";
import SITE_FACTS from "../data/legacy/site.json";

export type IconName = keyof typeof ICONS;
export const icons: Record<string, string> = ICONS;

export const SITE = "https://fizlet.com/";
export const REPO = "https://github.com/coded-dot-design/fizlet";
export const AUTHOR = "https://coded.design";
export const HUB = "https://domvirus.com/";
export const VERSION: string = SITE_FACTS.version;

/** Staging and preview builds (PUBLIC_ROBOTS=noindex) stay out of search. */
export const NOINDEX_BUILD = import.meta.env.PUBLIC_ROBOTS === "noindex";

/** The header nav: a top-level link, or a group behind a disclosure button. Paths from the root. */
export type NavEntry = { label: string; href: string } | { label: string; items: { href: string; label: string }[] };
export const NAV: NavEntry[] = [
  { label: "Daily", items: [{ href: "/gallery/", label: "Daily pieces" }, { href: "/contest/", label: "Contest rules" }] },
  { label: "Docs", items: [{ href: "/docs/", label: "All docs" }, { href: "/docs/getting-started/", label: "Getting started" }, { href: "/guides/", label: "Guides" }, { href: "/docs/authoring/", label: "Recipes" }, { href: "/bricks/", label: "API" }] },
  { label: "Bricks", href: "/bricks/" },
  { label: "Notes", items: [{ href: "/notes/", label: "Notes" }, { href: "/news/", label: "News" }] },
];

export { current } from "./current";

/** A key's colour family (Board UI): one colour per job. */
export type Tone = "go" | "sys" | "cmd" | "fire" | "attack" | "advance" | "fallin" | "flag" | "";

const ORG = { "@type": "Organization", "@id": `${SITE}#org`, name: "coded.design", url: AUTHOR + "/" };
const PERSON = { "@type": "Person", "@id": `${SITE}#author`, name: "Chris Cooley", url: AUTHOR + "/" };
const WEBSITE = { "@type": "WebSite", "@id": `${SITE}#website`, name: "Fizlet", url: SITE, inLanguage: "en", author: { "@id": PERSON["@id"] }, publisher: { "@id": ORG["@id"] } };
/** JSON-LD: one @graph per page, every page carrying the site and its publisher. `<` is escaped. */
export const jsonLd = (nodes: unknown[] = []) =>
  JSON.stringify({ "@context": "https://schema.org", "@graph": [WEBSITE, ORG, PERSON, ...nodes] }).replace(/</g, "\\u003c");

/** A page's head facts (from the legacy export, or written by hand for a new page). */
export interface PageMeta { path: string; title: string; description: string; ld?: unknown[]; scripts?: string[] }
