// Content collections: the notes (site/notes/<slug>.json) and the releases (CHANGELOG.md), as the
// legacy build reads them, exported to src/data/legacy/ by scripts/export-legacy.mjs.
import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const text = z.string();
const heading = { heading: text.optional(), headingAccent: text.optional() };
const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), ...heading, body: z.array(z.union([
    z.object({ type: z.enum(["p", "h"]), text }),
    z.object({ type: z.enum(["ul", "ol"]), items: z.array(text) }),
  ])) }),
  z.object({ type: z.literal("stats"), ...heading, items: z.array(z.object({ value: text, label: text })) }),
  z.object({ type: z.literal("features"), ...heading, subhead: text.optional(), items: z.array(z.object({ title: text, body: text, link: z.object({ href: text, label: text }).optional() })) }),
  z.object({ type: z.literal("faq"), items: z.array(z.object({ q: text, a: text })) }),
  z.object({ type: z.literal("cta"), links: z.array(z.object({ href: text, label: text })) }),
]);

const notes = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/legacy/notes" }),
  schema: z.object({
    slug: text, type: text.optional(), title: text, subtitle: text.optional(), eyebrow: text.optional(), tags: z.array(text),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(["published", "scheduled"]),
    lead: z.array(text), blocks: z.array(block), seo: z.object({ title: text, description: text }),
  }),
});

const releases = defineCollection({
  loader: file("./src/data/legacy/releases.json"),
  schema: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), md: text, order: z.number().int() }),
});

export const collections = { notes, releases };
