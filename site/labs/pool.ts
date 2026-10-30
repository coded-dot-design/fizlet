// Lab: "One loop. Bounded work." A real fixed pool (engine.pool, 32 sparks, made up front): SPAWN
// asks for 8, past the cap the pool says no (REJECTED), and nothing is ever created again. The
// frame meter is the shared clock's own frame time. Attract mode: a small fountain while idle.
import { $, kf, key, labEngine, pad2, reduced, textOf, type Lab, type LabOptions } from "./lab";

export const POOL_CAP = 32;
const SPARKS = ["#4bce82", "#06c4ff", "#f4457a", "#ffd166", "#8573ee"];
const SHAKE = [0, -3, 3, 0];

/** The figure (live, or a still poster for a gallery slot). */
export const poolFigure = (poster = false) =>
  `<figure class="lab-stage pool fzl" data-fzl="pool" aria-label="A pool of ${POOL_CAP} reusable slots. Spawn particles until the cap rejects new ones; the frame-time meter stays within budget.">` +
  `<div class="arena" data-arena></div>` +
  `<div class="pool-slots" data-slots>${"<i></i>".repeat(POOL_CAP)}</div>` +
  `<div class="lab-meter"><span>FRAME</span><b><i data-frame-bar></i><em></em></b><code data-frame-ms>16.7ms</code></div>` +
  `<div class="lab-keys">${key("data-spawn", "SPAWN ×8", poster)}<span class="lab-readout" data-pool-readout>ACTIVE 00 / ${POOL_CAP} · REJECTED 0 · ALLOCATIONS 0</span></div></figure>`;

interface Spark { k: number; x: number; y: number; vx: number; vy: number; life: number }

export function pool(figure: HTMLElement, o: LabOptions = {}): Lab {
  const reduce = reduced();
  const arena = $(figure, "[data-arena]");
  const slots = [...figure.querySelectorAll<HTMLElement>("[data-slots] i")];
  const bar = $(figure, "[data-frame-bar]"), ms = textOf($(figure, "[data-frame-ms]")), readout = textOf($(figure, "[data-pool-readout]"));
  const slotRow = $(figure, "[data-slots]");
  // State: half width, resized, pending spawns, rejected, shake s left, trickle ms, hud ms, frame ms,
  // shown (attract allowed), last drawn active, last drawn rejected.
  const s = new Float64Array([140, 1, 0, 0, 0, 0, 0, 16.7, 0, -1, -1]);
  const lab = labEngine(figure, 2, o, () => (s[8] = 1));
  const { engine } = lab, L = engine.ledger, rnd = engine.random;
  const r = (a: number, b: number) => a + rnd() * (b - a);
  // The nodes are made once, here, one per pool item; the pool hands out items, never makes them.
  // Items are made in reverse so the first one out lights the first slot.
  const els: HTMLElement[] = [];
  let made = POOL_CAP;
  const sparks = engine.pool<Spark>("sparks", POOL_CAP, () => ({ k: --made, x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
  for (let k = 0; k < POOL_CAP; k++) {
    const el = L.add(document.createElement("i"));
    el.style.setProperty("--c", SPARKS[k % SPARKS.length]!);
    arena.append(el);
    els.push(el);
  }
  const on = new Uint8Array(POOL_CAP);
  const ro = new ResizeObserver(() => ((s[1] = 1), engine.wake()));
  ro.observe(arena);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  $(figure, "[data-spawn]").addEventListener("click", () => ((s[2]! += 8), lab.input()), { signal: engine.signal });

  const spawn = (n: number) => {
    let capped = false;
    for (let i = 0; i < n; i++) {
      const p = sparks.acquire();
      if (!p) {
        s[3]!++;
        capped = true;
        continue;
      }
      // No motion preference: park the spark in the arena and let it expire where it is.
      if (reduce) (p.x = r(-s[0]! + 10, s[0]! - 10)), (p.y = r(20, 140)), (p.vx = 0), (p.vy = 0);
      else (p.x = r(-12, 12)), (p.y = 0), (p.vx = r(-90, 90)), (p.vy = r(170, 270));
      p.life = r(1.6, 2.6);
    }
    if (capped) s[4] = 0.3;
  };

  engine.add({
    read(e) {
      if (s[1]) (s[1] = 0), (s[0] = arena.clientWidth / 2);
      // The frame meter: the shared clock's frame time, eased (0 right after a pause or a settle).
      const d = e.timing[0]! * 1000;
      if (d > 0) s[7]! += (Math.min(d, 50) - s[7]!) * 0.1;
    },
    step(e, dt) {
      if (s[2]) spawn(s[2]!), (s[2] = 0);
      // Attract mode: a small fountain while nobody is pressing SPAWN.
      if (s[8] && !reduce && lab.attract(4)) {
        e.busy();
        if ((s[5]! -= dt * 1000) <= 0) {
          s[5] = 420;
          if (sparks.size < 10) spawn(2);
        }
      }
      if (s[4]! > 0) (s[4]! -= dt), e.busy();
      const half = s[0]!, items = sparks.items;
      for (let i = items.length; i--; ) {
        const p = items[i]!;
        if ((p.life -= dt) <= 0) {
          sparks.releaseAt(i);
          continue;
        }
        e.busy();
        p.vy -= 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < 0) (p.y = 0), (p.vy *= -0.45), (p.vx *= 0.8);
        if (Math.abs(p.x) > half - 4) (p.x = Math.sign(p.x) * (half - 4)), (p.vx = -p.vx);
      }
      if (s[3] !== s[10] || sparks.size !== s[9]) e.busy();
    },
    render(e) {
      on.fill(0);
      for (const p of sparks.items) {
        on[p.k] = 1;
        L.style(els[p.k]!, "transform", `translate(${p.x.toFixed(1)}px,${(-p.y).toFixed(1)}px)`);
        L.style(els[p.k]!, "opacity", String(Math.min(1, p.life * 2)));
      }
      for (let k = 0; k < POOL_CAP; k++) {
        L.cls(slots[k]!, "on", !!on[k]);
        if (!on[k]) L.style(els[k]!, "opacity", "0");
      }
      L.style(slotRow, "translate", s[4]! > 0 ? `${kf(SHAKE, 1 - s[4]! / 0.3)}px 0` : "0px 0px");
      // The readout and the meter at 10 Hz, apart from the simulation (the games' rule); counts at once.
      const counts = sparks.size !== s[9] || s[3] !== s[10];
      if ((s[6]! -= e.timing[0]! * 1000) <= 0 || counts) {
        if (s[6]! <= 0) {
          s[6] = 100;
          L.style(bar, "transform", `scaleX(${Math.min(1, s[7]! / 33.4)})`);
          L.text(ms, `${s[7]!.toFixed(1)}ms`);
        }
        s[9] = sparks.size;
        s[10] = s[3]!;
        L.text(readout, `ACTIVE ${pad2(sparks.size)} / ${POOL_CAP} · REJECTED ${s[3]} · ALLOCATIONS 0`);
      }
    },
  });
  return { engine, entities: () => sparks.size, destroy: () => engine.destroy() };
}
