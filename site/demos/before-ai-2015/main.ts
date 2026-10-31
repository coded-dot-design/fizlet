// The page's script: the two Fizlet columns (the 2015 column is CSS and the page's 4-line toggle,
// untouched) and the scroll-driven reveals. The remake copies 2015, so under reduced motion it stays
// on its first frame like the 2015 column (the page's wrapper rule); the arcade handles reduced
// motion itself; the reveals never run under it. The Recall key destroys every engine: each one's
// ledger gives back every style, class and attribute it wrote.
import { same } from "./same";
import { arcade } from "./arcade";
import { reveal } from "./reveal";

const root = (s: string) => document.querySelector<HTMLElement>(s);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const s = root(".bt-same"), a = root(".bt-arcade"), page = root(".bt");
const live: { destroy(): void }[] = [];
if (s && !still) live.push(...same(s));
if (a) {
  const { kit, strips } = arcade(a);
  live.push(kit, ...strips);
}
if (page && !still) live.push(reveal(page));
root("[data-recall]")?.addEventListener("click", () => {
  for (const x of live.splice(0)) x.destroy();
}, { once: true });
