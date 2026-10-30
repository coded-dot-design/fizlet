// Lab: "Two Macs, one network." Two beige Macs, a pixel tank on each screen, THE NETWORK between
// them: FIRE on either side sends a packet across the cable into the other screen (a hit: the
// score ticks, the screen flashes, the tank shakes). Idle, the two machines duel on their own.
// The packets are a pool of two; the cable is lined up with the screens in read, never in a step.
import { $, kf, key, labEngine, pad2, reduced, textOf, type Lab, type LabOptions } from "./lab";

const TANK = '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M3 5h26v7H3zm0 16h26v7H3z" fill="currentColor"/><path d="M7 9h17v15H7z" fill="currentColor"/><path d="M12 12h10v9H12z" fill="var(--surface)"/><path d="M19 15h13v3H19z" fill="currentColor"/></svg>';
const machine = (side: number, poster: boolean) =>
  `<div class="machine" data-side="${side}"><span class="mac"><span class="crt${side ? " mirror" : ""}"><span class="tank-sprite${side ? " flip" : ""}">${TANK}</span><b class="hit-flash"></b></span><span class="chin"><b></b><i></i></span></span>` +
  `<span class="machine-label">${side ? 'MAC 02<span class="long"> · THEM</span>' : "MAC 01 · YOU"}</span><span class="duel-score" data-score="${side}">00</span>` +
  key(`data-fire="${side}" aria-label="Fire from Mac 0${side + 1}"`, "FIRE", poster) + `</div>`;

export const duelFigure = (poster = false) =>
  `<figure class="lab-stage duel fzl" data-fzl="duel" aria-label="Two computers joined by a network cable. Fire from either side: a packet crosses the cable and hits the other tank.">` +
  machine(0, poster) + `<div class="cable" aria-hidden="true"><i></i><span>THE NETWORK</span></div>` + machine(1, poster) + `</figure>`;

const FLIGHT = 0.56, RECOIL = 0.16, FLASH = 0.36, SHAKE = 0.24;
const FLASH_KF = [0.9, 0.2, 0.7, 0], SHAKE_X = [0, -3, 3, 0], SHAKE_Y = [0, 2, -1, 0], RECOIL_KF = [0, 1, 0];

interface Packet { k: number; from: number; t: number }

export function duel(figure: HTMLElement, o: LabOptions = {}): Lab {
  const reduce = reduced();
  const sides = [0, 1].map((n) => {
    const m = $(figure, `.machine[data-side="${n}"]`);
    return { crt: $(m, ".crt"), sprite: $(m, ".tank-sprite"), flash: $(m, ".hit-flash"), score: textOf($(m, ".duel-score")) };
  });
  const wire = $(figure, ".cable i");
  // Per side (0, 1): hits, recoil s left, flash s left, shake s left, flying (0/1), queued fire.
  const hits = new Uint8Array(2), flying = new Uint8Array(2), queued = new Uint8Array(2);
  const recoil = new Float64Array(2), flash = new Float64Array(2), shake = new Float64Array(2);
  // Geometry (read phase only): cable y, wire top, each screen's centre x; measure-needed flag.
  // Then attract: ms to the next shot, whose turn; drawn hits per side (change-only text).
  const g = new Float64Array([0, 0, 0, 0, 1, 1200, 0, -1, -1]);
  const lab = labEngine(figure, 1, o, () => {});
  const { engine } = lab, L = engine.ledger;
  const els: HTMLElement[] = [];
  let made = 0;
  const packets = engine.pool<Packet>("packets", 2, () => ({ k: made++, from: 0, t: 0 }));
  for (let k = 0; k < 2; k++) {
    const el = L.add(document.createElement("i"));
    el.className = "packet";
    el.style.opacity = "0";
    figure.append(el);
    els.push(el);
  }
  const ro = new ResizeObserver(() => ((g[4] = 1), engine.wake()));
  ro.observe(figure);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  for (const b of figure.querySelectorAll<HTMLElement>("[data-fire]"))
    b.addEventListener("click", () => {
      queued[Number(b.dataset.fire)] = 1;
      g[5] = 1200;
      lab.input();
    }, { signal: engine.signal });

  const land = (from: number) => {
    const them = 1 - from;
    hits[from] = (hits[from]! + 1) % 100;
    flash[them] = FLASH;
    if (!reduce) shake[them] = SHAKE;
  };
  const fire = (from: number) => {
    if (flying[from]) return;
    recoil[from] = RECOIL;
    if (reduce) return land(from);
    const p = packets.acquire();
    if (!p) return;
    (p.from = from), (p.t = 0), (flying[from] = 1);
  };

  engine.add({
    read() {
      if (!g[4]) return;
      g[4] = 0;
      // Line the cable up with the middle of the two screens, so packets leave one CRT and land in the other.
      const f = figure.getBoundingClientRect(), top = f.top + figure.clientTop, left = f.left + figure.clientLeft;
      const c0 = sides[0]!.crt.getBoundingClientRect(), c1 = sides[1]!.crt.getBoundingClientRect();
      g[0] = c0.top + c0.height / 2 - top;
      g[1] = g[0] - (wire.parentElement!.getBoundingClientRect().top - top) - 1.5;
      g[2] = c0.left + c0.width / 2 - left;
      g[3] = c1.left + c1.width / 2 - left;
    },
    step(e, dt) {
      for (let s = 0; s < 2; s++) if (queued[s]) (queued[s] = 0), fire(s);
      // Two players on two machines: a human on either key, or the attract-mode duel when idle.
      if (!reduce && lab.attract(5)) {
        e.busy();
        if ((g[5]! -= dt * 1000) <= 0) {
          g[5] = 900 + e.random() * 800;
          fire((g[6] = 1 - g[6]!));
        }
      }
      const items = packets.items;
      for (let i = items.length; i--; ) {
        const p = items[i]!;
        e.busy();
        if ((p.t += dt / FLIGHT) >= 1) {
          flying[p.from] = 0;
          land(p.from);
          packets.releaseAt(i);
        }
      }
      for (let s = 0; s < 2; s++) {
        if (recoil[s]! > 0 || flash[s]! > 0 || shake[s]! > 0) e.busy();
        recoil[s] = Math.max(0, recoil[s]! - dt);
        flash[s] = Math.max(0, flash[s]! - dt);
        shake[s] = Math.max(0, shake[s]! - dt);
      }
    },
    render() {
      L.style(wire, "top", `${g[1]!.toFixed(1)}px`);
      let lit = 0;
      for (const p of packets.items) {
        lit |= 1 << p.k;
        const el = els[p.k]!, t = p.t, x0 = g[2 + p.from]!, x1 = g[3 - p.from]!;
        L.style(el, "top", `${(g[0]! - 5).toFixed(1)}px`);
        L.style(el, "transform", `translateX(${(x0 + (x1 - x0) * t).toFixed(1)}px) scale(${t < 0.12 ? 0.4 + t * 5 : t > 0.9 ? 1 + (t - 0.9) * 6 : 1})`);
        L.style(el, "opacity", String(t < 0.12 ? t / 0.12 : t > 0.92 ? (1 - t) / 0.08 : 1));
      }
      for (let k = 0; k < 2; k++) if (!(lit & (1 << k))) L.style(els[k]!, "opacity", "0");
      for (let s = 0; s < 2; s++) {
        const side = sides[s]!, dir = s ? 4 : -4;
        const rx = recoil[s]! > 0 ? kf(RECOIL_KF, 1 - recoil[s]! / RECOIL) * dir : 0;
        const sp = 1 - shake[s]! / SHAKE, sx = shake[s]! > 0 ? kf(SHAKE_X, sp, 4) : 0, sy = shake[s]! > 0 ? kf(SHAKE_Y, sp, 4) : 0;
        L.style(side.sprite, "transform", rx || sx || sy ? `translate(${(rx + sx).toFixed(1)}px,${sy}px)` : "none");
        L.style(side.flash, "opacity", flash[s]! > 0 ? String(kf(FLASH_KF, 1 - flash[s]! / FLASH, 4)) : "0");
        if (hits[s] !== g[7 + s]) (g[7 + s] = hits[s]!), L.text(side.score, pad2(hits[s]!));
      }
    },
  });
  return { engine, entities: () => 2 + packets.size, destroy: () => engine.destroy() };
}
