/**
 * Stack it: the bricks on the table and how a stack becomes an app. Pure data and maths (no DOM),
 * shared by the scene (./scene.ts), its poster (site/gallery/stages/stack-it.html) and the tests.
 *
 * BRICKS: "id role bytes", comma separated. `role` is the brick's Board UI colour in the brick
 * catalog (site/bricks.mjs); `bytes` its gzip size measured by scripts/sizes.mjs on this
 * build (fizlet/ui: its js). tests/stack.test.mjs fails when either drifts from the build. The order is
 * the order they come onto a small stage: the intro's five first, then one of every app.
 */
export const BRICKS =
  "kernel go 3443,input sys 1335,sprite fallin 1437,fx attack 2797,hud aim 1325,timeline fire 2060,camera go 1385," +
  "grid flag 1533,rules advance 1318,steer advance 950,presence cmd 1834,sound advance 1015,match go 2652," +
  "collide cmd 1293,pad advance 2073,coach sys 1220,perf sys 1958,slot sys 1855,board-page attack 4162,ui fire 2893";

/** The intro stacks these (indices into BRICKS): kernel, input, sprite, fx, hud: a shooter. */
export const DEMO = [0, 1, 2, 3, 4];

/** The apps a stack can become, by the bricks that make each one (most matches wins; ties go first). */
export const APPS: [string, string][] = [
  ["SHOOTER", "input pad steer"],
  ["MOVIE", "timeline camera"],
  ["BOARD", "grid rules match board-page presence"],
];
/** The kernel alone (or with only the bricks every app uses): a bouncing "Hello, page". */
export const HELLO = 3;
/** Bricks every app uses: the loop, the art, the juice, the chrome. */
const ANY = " kernel sprite fx collide hud perf coach sound slot ui ";
/** Bricks that show on top of any app (fx: blasts instead of blinks). */
const SHOWS = " fx hud perf coach sound ";
const has = (list: string, id: string) => list.includes(` ${id} `);

/** One word a rating, by stars (0: no kernel). */
export const VERDICT = ["NO KERNEL, NO LOOP", "HEAVY", "IT RUNS", "SOLID", "TIGHT", "SHIP IT"];
/** Under this many bytes of bricks, an app earns its size star (12 KB). */
export const LIGHT = 12288;

export interface Built {
  /** Index into APPS, HELLO, or -1: no kernel, no app. */
  app: number;
  /** 0 to 5. */
  stars: number;
  /** The stack's bricks, summed (gzip B, as measured one by one). */
  bytes: number;
  /** Bricks the app never used. */
  dead: number;
}

/**
 * What a stack makes: its app, its bytes and its stars. A star each for: it runs (a kernel), it is
 * a real app (not just hello), something shows on it (fx, hud, perf, coach, sound), no dead weight
 * (every brick used), and it is light (≤ 12 KB of bricks).
 */
export function build(ids: string[], bytes: number[]): Built {
  const n = APPS.map(([, s]) => ids.filter((id) => has(` ${s} `, id)).length), best = Math.max(...n), app = best ? n.indexOf(best) : HELLO;
  const use = ANY + APPS[app]?.[1] + " ", dead = ids.filter((id) => !has(use, id)).length, sum = bytes.reduce((a, b) => a + b, 0);
  const stars = ids.includes("kernel") ? 1 + +(app < HELLO) + +ids.some((id) => has(SHOWS, id)) + +!dead + +(sum <= LIGHT) : 0;
  return { app: stars ? app : -1, stars, bytes: sum, dead };
}

/** "10.0 KB" (1 KB = 1,024 B, as the size budgets count). */
export const kb = (b: number) => (b / 1024).toFixed(1) + " KB";
/** "3,439 B". */
export const bytesLabel = (b: number) => b.toLocaleString("en-US") + " B";
