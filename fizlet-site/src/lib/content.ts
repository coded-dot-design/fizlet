// The notes and releases collections, in the legacy order (src/content.config.ts).
import { getCollection } from "astro:content";
import { byDate, type Note } from "./notes";
import type { Release } from "./releases";

/** Every published note, newest first. */
export const allNotes = async (): Promise<Note[]> => (await getCollection("notes")).map((e) => e.data as Note).sort(byDate);
/** Every release, newest first, as CHANGELOG.md lists them. */
export const allReleases = async (): Promise<Release[]> => (await getCollection("releases")).map((e) => e.data as Release).sort((a, b) => a.order - b.order);
