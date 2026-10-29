// The brick pages' live demos: each page names its demo (data-brick-demo) and loads only that chunk.
const DEMOS: Record<string, () => Promise<{ default: (host: HTMLElement) => void }>> = {
  settle: () => import("./demos/settle"),
  fx: () => import("./demos/fx"),
  grid: () => import("./demos/grid"),
  sprite: () => import("./demos/sprite"),
  sound: () => import("./demos/sound"),
};

for (const host of document.querySelectorAll<HTMLElement>("[data-brick-demo]")) {
  const load = DEMOS[host.dataset.brickDemo!];
  if (load) void load().then((m) => (m.default(host), (host.dataset.ready = "1")));
}
