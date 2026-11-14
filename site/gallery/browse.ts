// The gallery pages' browse script: the theme filter (the chips are plain links to each theme's
// section without it) and the search box over the generated index (gallery/index.json, fetched on
// the first keystroke). No dependencies; the demos' own loader is gallery.ts.
import { search, type IndexRow } from "./search";

const MAX = 24;
const root = document.documentElement;

// ---------- Theme filter: under All a Daily page is one flat list, newest first; a chip whose theme
// is on this page groups it: that theme's head, over only its cards (the Hi-Fi page: only its section) ----------
const chips = [...document.querySelectorAll<HTMLAnchorElement>("a[data-theme-chip]")];
const secs = [...document.querySelectorAll<HTMLElement>("section[data-theme-section]")];
const heads = [...document.querySelectorAll<HTMLElement>("[data-gal-flat] [data-theme-head]")];
const cards = [...document.querySelectorAll<HTMLElement>("[data-gal-flat] li.gal-item")];
function filter(id: string) {
  const here = id === "all" || secs.some((s) => s.dataset.themeSection === id) || heads.some((h) => h.dataset.themeHead === id);
  if (!here) return false;
  for (const s of secs) s.hidden = id !== "all" && s.dataset.themeSection !== id;
  for (const h of heads) h.hidden = h.dataset.themeHead !== id;
  for (const c of cards) c.hidden = id !== "all" && c.dataset.theme !== id;
  for (const c of chips) c.dataset.themeChip === id ? c.setAttribute("aria-current", "true") : c.removeAttribute("aria-current");
  root.dataset.galFilter = id;
  return true;
}
for (const c of chips)
  c.addEventListener("click", (ev) => {
    const id = c.dataset.themeChip!;
    const next = id !== "all" && root.dataset.galFilter === id ? "all" : id; // a second press shows all again
    if (filter(next)) {
      ev.preventDefault();
      history.replaceState(null, "", next === "all" ? location.pathname + location.search : `#theme-${next}`);
    }
  });
// A #theme- address filters on arrival, and when the address changes on the same page (a link, back).
// Any other address while filtered is All again (a search hit's card may be in another theme). A head
// or card hidden when the address changed is gone to once it shows.
const fromHash = (arrival: boolean) => {
  const id = location.hash.match(/^#theme-([a-z0-9-]+)$/)?.[1];
  if (id) {
    if (!filter(id)) return;
  } else if (arrival || (root.dataset.galFilter ?? "all") === "all" || !filter("all")) return;
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
};
fromHash(true);
addEventListener("hashchange", () => fromHash(false));

// ---------- Search: the generated index, matched on the page ----------
const form = document.querySelector<HTMLFormElement>("form[data-gal-search]");
if (form) {
  const input = form.querySelector<HTMLInputElement>("input[type=search]")!;
  const found = form.querySelector<HTMLElement>("[data-gal-found]")!;
  const out = form.querySelector<HTMLUListElement>("[data-gal-results]")!;
  const base = new URL(form.dataset.base ?? "./", location.href);
  let rows: Promise<IndexRow[]> | null = null;
  form.hidden = false;
  form.addEventListener("submit", (ev) => ev.preventDefault());
  const run = async () => {
    rows ??= fetch(new URL("gallery/index.json", base)).then((r) => r.json() as Promise<IndexRow[]>);
    const q = input.value, hits = search(await rows, q);
    if (input.value !== q) return; // a newer keystroke is on its way
    out.replaceChildren(...hits.slice(0, MAX).map((r) => {
      const li = document.createElement("li"), a = document.createElement("a"), small = document.createElement("small");
      a.href = new URL(r.url, base).href;
      a.textContent = r.title;
      small.textContent = ` ${r.themeTitle} · by ${r.authorName} · ${r.kind}${r.lane === "hifi" ? " · Hi-Fi" : ""} · ${(r.sizes.total / 1024).toFixed(1)} KB gz`;
      li.append(a, small);
      return li;
    }));
    found.textContent = q.trim() ? `${hits.length} ${hits.length === 1 ? "match" : "matches"}${hits.length > MAX ? `, the newest ${MAX} shown` : ""}` : "";
  };
  input.addEventListener("input", () => void run());
}
