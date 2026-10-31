/* Vendored from https://github.com/coded-dot-design/dom-virus @ 248d1e9 by scripts/vendor-dom-virus.mjs: site-kit/hero-data.ts. Do not edit; change it in dom-virus and vendor again. */
/**
 * The home hero's script, as data: one source for the poster markup (HeroScene.astro) and the
 * Fizlet scene that animates it (hero-scene.ts). Scene units are the stage's 500×360 viewBox.
 * Intro (one shot): the DOM Virus skull spawns into the browser card, more bad guys follow, the
 * interceptor flies in and the tank drives up. Then an 8 s loop: each shooter turns on its own
 * centre (plane body / tank turret) to face a target, fires, and the target explodes and respawns.
 */
export const INTRO = 3.4, LOOP = 8, TRAVEL = 0.24;
export const PLANE = { x: 404, y: 96, r: 44 };
export const TANK = { x: 196, y: 298, r: 58 };
export const SKULL = "M19 6h26v6h7v6h6v6h5v22h-5v6h-8v12h-9v-8h-6v8h-8v-8h-6v8h-8V52H5v-6H0V24h5v-6h6v-6h8ZM11 29v14h15V29Zm26 0v14h15V29Z";

export interface Foe {
  id: string;
  art: "skull" | "alien" | "bug" | "fly-chaser" | "fly-interceptor";
  x: number;
  y: number;
  size: number;
  color?: string;
  /** Intro time (s) it spawns. */
  spawn: number;
  idle?: "step" | "dodge" | "skitter";
  decor?: boolean;
}
/** Bad guys from every game; three are DOM Virus skulls. */
export const FOES: Foe[] = [
  { id: "skull", art: "skull", x: 262, y: 150, size: 58, color: "#f4457a", spawn: 0.2 },
  { id: "alien", art: "alien", x: 382, y: 228, size: 52, color: "#b1a1e8", spawn: 0.75, idle: "step" },
  { id: "fly", art: "fly-chaser", x: 300, y: 70, size: 44, spawn: 1.0, idle: "dodge" },
  { id: "skull2", art: "skull", x: 446, y: 304, size: 32, color: "#06c4ff", spawn: 1.2 },
  { id: "alien2", art: "alien", x: -18, y: 150, size: 44, color: "#f4457a", spawn: 1.4, idle: "step" },
  { id: "skull3", art: "skull", x: 170, y: -14, size: 28, color: "#ffd166", spawn: 1.6 },
  { id: "fly2", art: "fly-interceptor", x: 508, y: 168, size: 38, spawn: 1.8, idle: "dodge" },
  { id: "bug", art: "bug", x: -34, y: -26, size: 38, color: "#ff6b6b", spawn: 2.0, idle: "skitter", decor: true },
];
export const foeColor = (f: Foe) => f.color || "#06c4ff";

const shooter = (by: string) => (by === "plane" ? PLANE : TANK);
/** Loop schedule (seconds into the 8 s loop): plane and tank alternate. `hit` is when it lands. */
export const KILLS = [
  { by: "plane", t: 0.6, foe: "skull" },
  { by: "tank", t: 1.6, foe: "alien" },
  { by: "plane", t: 2.6, foe: "alien2" },
  { by: "tank", t: 3.6, foe: "skull2" },
  { by: "plane", t: 4.6, foe: "fly2" },
  { by: "tank", t: 5.6, foe: "fly" },
  { by: "plane", t: 6.6, foe: "skull3" },
].map((k, i) => {
  const s = shooter(k.by), f = FOES.find((g) => g.id === k.foe)!;
  const a = Math.atan2(f.y - s.y, f.x - s.x);
  const mx = s.x + Math.cos(a) * s.r, my = s.y + Math.sin(a) * s.r;
  return { ...k, i, f, a, mx, my, tx: f.x - mx, ty: f.y - my, hit: k.t + TRAVEL };
});
/** Near-misses: a spray shot just before most kills, a few degrees off, that streaks off screen. */
export const MISSES = KILLS.filter((k) => k.i !== 3).map((k) => {
  const s = shooter(k.by), a = k.a + (k.i % 2 ? -0.2 : 0.17), t = k.t - 0.18;
  const mx = s.x + Math.cos(a) * s.r, my = s.y + Math.sin(a) * s.r;
  return { by: k.by, t, a, mx, my, tx: Math.cos(a) * 650, ty: Math.sin(a) * 650 };
});
/** The angle (deg, sprite facing → 0°) each shooter rests at: facing its last loop target. */
export const aimStart = (by: string) => (KILLS.filter((k) => k.by === by).at(-1)!.a * 180) / Math.PI + (by === "plane" ? 90 : 0);
/** Ten pixel shards per blast. */
export const SHARDS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.3, d = 48 + (i % 3) * 16;
  return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d), r: (i % 2 ? 1 : -1) * (90 + i * 25), s: 4 + (i % 3) * 2 };
});
export const TONES = ["#ffe14d", "#f4457a", "#06c4ff", "#fff4ff"];
