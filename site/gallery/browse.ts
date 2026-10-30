// The gallery pages' browse script: the theme filter (the chips are plain links to each theme's
// section without it) and the search box over the generated index (gallery/index.json, fetched on
// the first keystroke). No dependencies; the demos' own loader is gallery.ts.
import { search, type IndexRow } from "./search";

const MAX = 24;
const root = document.documentElement;

// ---------- Theme filter: a chip whose section is on this page shows only that section ----------
const chips = [...document.querySelectorAll<HTMLAnchorElement>("a[data-theme-chip]")];
const secs = [...document.querySelectorAll<HTMLElement>("section[data-theme-section]")];
function filter(id: string) {
  const here = id === "all" || secs.some((s) => s.dataset.themeSection === id);
  if (!here) return false;
  for (const s of secs) s.hidden = id !== "all" && s.dataset.themeSection !== id;
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
      history.replaceState(null, "", next === "all" ? location.pathname : `#theme-${next}`);
    }
  });
const fromHash = location.hash.match(/^#theme-([a-z0-9-]+)$/)?.[1];
if (fromHash) filter(fromHash);

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
      small.textContent = ` ${r.themeTitle} · by ${r.authorName} · ${r.kind} · ${(r.sizes.total / 1024).toFixed(1)} KB gz`;
      li.append(a, small);
      return li;
    }));
    found.textContent = q.trim() ? `${hits.length} ${hits.length === 1 ? "match" : "matches"}${hits.length > MAX ? `, the newest ${MAX} shown` : ""}` : "";
  };
  input.addEventListener("input", () => void run());
}
