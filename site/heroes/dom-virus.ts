// domvirus.com's home hero on fizlet.com: "Your page. Their playground." The look and the loop are
// the site's own (its markup and CSS, vendored): the CSS owns the motion and plays while the art's
// data-motion is "true". Fizlet owns the time: one engine holds the loop on for the intro and three
// 8 s loops, then sets it to "false" (the CSS pauses on that frame) and settles to no frames; any
// input over the stage plays it again. A tap on the card starts the site's own mini game
// (hero-game.ts, vendored), as on domvirus.com. BUTTON_01 nukes the round once the game is on.
// The pause key in the card is the site's own: it pauses and plays the scene.
// Recall: the engine's ledger gives data-motion back; once the mini game has run (it builds its own
// layers), Recall also puts the card back as it was served.
import { expose, rest, REST } from "./stage";
import { createEngine } from "../../src/kernel/engine";

const INTRO = 3.4, LOOP = 8, PLAYS = 3;
const art = document.querySelector<HTMLElement>(".hero-crossover")!;
const served = art.cloneNode(true) as HTMLElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const engine = createEngine({ root: art, settle: 0.5 });
const L = engine.ledger;
type Game = { stop(): void; nuke(): void };
let t = 0, held = false, game: Game | null = null, loading = false, paused = false;
// The loop plays the intro and PLAYS loops (a test sets ?rest=<s> to rest sooner).
const span = new URLSearchParams(location.search).has("rest") ? REST : INTRO + LOOP * PLAYS;

engine.add({
  step(e, dt) {
    if (paused) return;
    if (t < span || held) e.busy();
    t += dt;
  },
  render() {
    L.attr(art, "data-motion", String(!paused && !reduce.matches && (t < span || held)));
  },
});
engine.start();

// Input plays it on: a loop already played rests on its frame, so it carries on from there.
const wake = () => {
  if (t >= span) t = INTRO;
  engine.wake();
};
const stopRest = rest(() => ((held = false), game?.stop()), wake);
art.addEventListener("pointermove", wake, { passive: true });

// The site's mini game, on the first tap on the card (domvirus.com loads it the same way).
art.querySelector(".promo-stage")?.addEventListener("pointerdown", (ev) => {
  if (reduce.matches || game || loading) return;
  loading = true;
  held = true;
  void import("./vendor/dom-virus/hero-game").then(({ startHeroGame }) => {
    startHeroGame(art, ev as PointerEvent);
    game = (art as HTMLElement & { heroGame?: Game }).heroGame ?? null;
    loading = false;
    wake();
  });
});
art.querySelector(".promo-button")?.addEventListener("click", () => game?.nuke());
const toggle = art.querySelector<HTMLButtonElement>("[data-motion-toggle]");
toggle?.addEventListener("click", () => {
  paused = !paused;
  L.attr(toggle, "aria-pressed", String(paused));
  L.attr(toggle, "aria-label", `${paused ? "Resume" : "Pause"} scene animation`);
  wake();
});

expose({
  recall() {
    stopRest();
    game?.stop();
    engine.destroy();
    if (game) art.replaceWith(served);
  },
  get resting() {
    return engine.stats().paused.includes("settled") && art.dataset.motion === "false";
  },
});
