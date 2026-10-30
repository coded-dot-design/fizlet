/**
 * The roadmap, one source: the home page (#roadmap) renders it, tests/roadmap.test.mjs checks it,
 * and the engine's ROADMAP.md phase tables must agree with it on every phase's id, name and status
 * (checked from the engine side: `fe roadmap check`). Change a phase here and there in the same
 * sitting.
 *
 * E0–E8 are the launch scope, E9–E16 the next eight. A box is ticked only with evidence behind it
 * (a release, a merged PR, a test). The ROADMAP bricks of a planned phase come from site/bricks.mjs
 * PLANNED, so a planned brick can't be on one list and missing from the other.
 */
import { PLANNED } from "./bricks.mjs";

/** Phase status: the same words as the engine's ROADMAP.md "Status" column. `tone` is the page's
 * data-phase (done · part · now · next). */
export const PHASE_STATUS = {
  done: { label: "DONE", tone: "done" },
  partly: { label: "PARTLY DONE", tone: "part" },
  nearly: { label: "NEARLY DONE", tone: "now" },
  "in progress": { label: "IN PROGRESS", tone: "now" },
  started: { label: "STARTED", tone: "now" },
  planned: { label: "PLANNED", tone: "next" },
};

/** The launch scope ends here; later phases are planned. */
export const LAUNCH_LAST = "E8";

/**
 * [{ id, name, status, note?, goal, items: [[done, text]] }]. `note` follows the status on the
 * pill ("DONE · 0.1.0"). A planned phase's PLANNED bricks are added to its items by `phases()`.
 */
export const ROADMAP = [
  { id: "E0", name: "Baseline and archives", status: "nearly", goal: "Freeze the pre-engine games as the before picture, so every port has numbers to beat.", items: [
    [1, "Perf harness: every app under a 4× CPU throttle (Playwright)"],
    [1, "Baseline numbers and commits recorded for all six apps"],
    [0, "Tag engine-baseline in every repo"],
    [1, "Battlefield archive selector (versioned paths)"],
    [1, "Hub TEST A RELEASE selector for every game version, the 1.0 engine cuts included"],
  ] },
  { id: "E1", name: "Kernel", status: "done", note: "0.1.0", goal: "The scheduler, fixed step, auto-pause, pools, event ring, seeded random, the Recall ledger and stats.", items: [
    [1, "One rAF for N engines, fixed step with a catch-up cap"],
    [1, "Zero allocation over 1M steps, exact DOM restore"],
    [1, "Kernel under the 4 KB budget"],
  ] },
  { id: "E2", name: "The first box of bricks", status: "done", note: "0.19.0", goal: "Small, separately importable bricks lifted from the games, each with tests, a CI size budget and a generated page. layout, view and actor bricks moved to E10 and E11.", items: [
    [1, "input · pad · collide · fx · sound · embed · ui"],
    [1, "grid · sprite · hud · match · board-page"],
    [1, "slot and the page profile: settle, fps cap, idle load"],
    [1, "rules · steer · coach · camera · perf · arcade · timeline"],
    [1, "A status flag on every brick, with its evidence"],
  ] },
  { id: "E3", name: "Port the games", status: "nearly", goal: "Every game on the engine, each as a 1.0 engine cut.", items: [
    [1, "Null Invaders → Byte Runner → Sherman Bytes (1.0 each)"],
    [1, "DOM Battlefield 1.0 · Battlefield Blitz · Swarm Protocol 1.4"],
    [0, "No copied shared/ code left in the games"],
    [0, "Frame time equal or better than the E0 baseline, measured per game"],
  ] },
  { id: "E4", name: "Presence and multiplayer", status: "done", note: "TWO PLAYERS", goal: "A few-KB presence client and a room server: two people play Battlefield Blitz on the live site. Battlefield matches and AI players moved to E12.", items: [
    [1, "presence brick + determinism check"],
    [1, "Room server: invite gate and hard spend caps"],
    [1, "Battlefield Blitz two players against the deployed room server"],
  ] },
  { id: "E5", name: "Docs for humans and AI", status: "in progress", goal: "Build a game or micro-interaction in an afternoon, from docs a person or an agent can follow.", items: [
    [1, "One page per brick, generated from the source, with its status"],
    [1, "Gallery and notes, every number measured on the build"],
    [1, "llms.txt and a sitemap from the same build"],
    [1, "An API reference for every brick, generated at build time by the TypeScript compiler, and llms-full.txt"],
    [0, "Authoring guide and recipes by use case: an action on the page, a shooter, two players"],
    [0, "Live kernel stats on Under the Hood"],
  ] },
  { id: "E6", name: "Performance wins", status: "started", goal: "Smaller and faster every week: the perf harness in CI, the top cost fixed, the win logged.", items: [
    [1, "Perf harness and allocation test in CI on every push"],
    [0, "A weekly run against the baseline"],
    [1, "A public log of every win: PERF-LOG.md, generated from the measured wins"],
  ] },
  { id: "E7", name: "Page interactions", status: "nearly", goal: "Heroes, diagrams and micro animations on ordinary pages: lazy, contained, settled when still.", items: [
    [1, "slot, the page profile, camera and timeline"],
    [1, "Gallery: one prompt, one animation, its size on show"],
    [1, "fizlet.com and the DOM VIRUS home hero on Fizlet"],
    [0, "The DOM Battlefield landing hero on Fizlet"],
    [0, "The DOM VIRUS Under the Hood labs on Fizlet"],
    [0, "Page cost (CLS, tap delay, idle CPU) gated in CI"],
  ] },
  { id: "E8", name: "The game kit", status: "in progress", goal: "The shell every page game repeats, so a game is its rules and its art: HUD and control presets, match flow, coach.", items: [
    [1, "arcade: the shell under Null Invaders, Byte Runner and Sherman Bytes"],
    [1, "HUD presets (card, skirmish bar) and swappable touch pads"],
    [1, "match, coach and steer bricks"],
    [0, "Battlefield Blitz on the skirmish preset, steer and coach"],
    [0, "A released game on fizlet/match"],
  ] },
  { id: "E9", name: "On npm", status: "planned", goal: "npm install fizlet: one package, a subpath per brick, published from CI with provenance.", items: [
    [0, "fizlet@0.x on npm from the release workflow"],
    [0, "An API snapshot test for every COMPLETE brick"],
  ] },
  { id: "E10", name: "Diagrams", status: "planned", goal: "Interactive diagrams that settle: graphs laid out on the kernel clock.", items: [
    [0, "An interactive diagram on a marketing page, settled at 0 frames"],
  ] },
  { id: "E11", name: "Actors", status: "planned", goal: "Units, bots and turrets as data: the parts every board game still writes itself.", items: [
    [0, "One board game moves its units onto them, and shrinks"],
  ] },
  { id: "E12", name: "Multiplayer everywhere", status: "planned", goal: "Authoritative rooms, interpolation, and AI agents that join a room like any player.", items: [
    [0, "A DOM Battlefield match between two networks"],
    [0, "An AI agent joins a room"],
  ] },
  { id: "E13", name: "Animation library", status: "planned", goal: "A recipe used twice becomes data; a recipe used across games becomes a brick.", items: [] },
  { id: "E14", name: "Accessible play", status: "planned", goal: "Every game playable by keyboard and gamepad, and heard by screen readers.", items: [
    [0, "Gamepad in fizlet/input"],
  ] },
  { id: "E15", name: "Music", status: "planned", goal: "Background loops from the same tiny synth, on the kernel clock.", items: [] },
  { id: "E16", name: "1.0", status: "planned", goal: "Every shipped brick COMPLETE or DEPRECATED, the API frozen, the games on 1.0, and smaller and faster than 0.x by a measured margin.", items: [
    [0, "Every brick COMPLETE or DEPRECATED"],
    [0, "fizlet@1.0.0"],
  ] },
];

const kb = (bytes) => (bytes / 1024).toFixed(1);

/** The phases as the page shows them: tone and pill label resolved, PLANNED bricks first in their phase. */
export function phases(roadmap = ROADMAP, planned = PLANNED) {
  return roadmap.map((p) => {
    const s = PHASE_STATUS[p.status];
    const bricks = planned.filter((b) => b.phase === p.id).map((b) => [0, `${b.name} (target ≤ ${kb(b.target)} KB gzip)`]);
    return { ...p, tone: s.tone, label: p.note ? `${s.label} · ${p.note}` : s.label, items: [...bricks, ...p.items] };
  });
}
