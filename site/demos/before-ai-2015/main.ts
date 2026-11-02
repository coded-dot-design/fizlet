// The page's script: the two Fizlet columns (the 2015 column is CSS and the page's 4-line toggle,
// untouched) and the scroll-driven reveals. The remake copies 2015, so under reduced motion it stays
// on its first frame like the 2015 column (the page's wrapper rule); the arcade handles reduced
// motion itself; the reveals never run under it.
// The Recall key destroys every engine: each one's ledger gives back every style, class and
// attribute it wrote, and its listeners go with it. The page is then as it was before Fizlet, and
// each column waits: the next press on its screen starts it fresh (no load intro: every sprite already
// shows its first frame) and that same press acts. Recall works any number of times.
import { same } from "./same";
import { arcade } from "./arcade";
import { reveal } from "./reveal";

type Live = { destroy(): void };
const root = (s: string) => document.querySelector<HTMLElement>(s);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const s = root(".bt-same"), a = root(".bt-arcade"), page = root(".bt");
const live: Live[] = [];
const cols: [HTMLElement, (intro: boolean) => Live[]][] = [];
if (s && !still) cols.push([s, (intro) => same(s, intro)]);
if (a) cols.push([a, (intro) => {
  const { kit, strips } = arcade(a, intro);
  return [kit, ...strips];
}]);
for (const [, start] of cols) live.push(...start(true));
if (page && !still) live.push(reveal(page));
// After Recall: start a column on the next press on its screen (the stage or the HUD). Capture, so
// its listeners are on the pressed control before the click reaches it (a target's listeners are
// read when the event gets there).
let armed: AbortController | null = null;
root("[data-recall]")?.addEventListener("click", () => {
  for (const x of live.splice(0)) x.destroy();
  armed?.abort();
  armed = new AbortController();
  for (const [col, start] of cols) {
    col.querySelector(".bt-screen")!.addEventListener("click", () => live.push(...start(false)), { capture: true, once: true, signal: armed.signal });
  }
});
