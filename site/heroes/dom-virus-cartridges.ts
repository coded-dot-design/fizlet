// domvirus.com's "Pick a cartridge." on fizlet.com: the site's own shelf and handheld (markup and
// CSS vendored). Pick a cartridge and it flies over and plugs into the console. Then the joke: this
// console has the DOM virus. The screen glitches and says the cartridge is corrupted; nothing boots
// and nothing navigates (the showcase never leaves the page). Tap the seated cartridge, the screen
// or Esc to pull it out; another cartridge swaps it. The pads answer, uselessly.
// One engine (kernel): reads happen on the tap (outside any frame), the flight steps on the engine's
// clock and every write goes through its ledger, so it settles to no frames once still and Recall
// (destroy) gives the shelf back exactly as served.
// When dom-virus#29 lands (site-kit/console: mount(root, { launch })), this becomes its `launch`.
import { expose } from "./stage";
import { createEngine } from "../../src/kernel/engine";

const shelf = document.querySelector<HTMLElement>(".cartridge-shelf")!;
const consoleEl = shelf.querySelector<HTMLElement>("[data-console]")!;
const screen = consoleEl.querySelector<HTMLElement>("[data-console-screen]")!;
const carts = [...shelf.querySelectorAll<HTMLAnchorElement>("a.cartridge")];
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const engine = createEngine({ root: shelf, settle: 0.4 });
const L = engine.ledger;

const FLY = 0.6, SINK = 0.28, GLITCH = 1.1;
/** What the screen says: the first line per press, then the second; the pads cycle the replies. */
const SAYS = ["CARTRIDGE CORRUPTED.", "THIS CONSOLE HAS THE DOM VIRUS."];
const REPLIES = ["STILL CORRUPTED.", "PRESSING HARDER WON'T HELP.", "TRY ANOTHER? IT WON'T HELP.", "THE VIRUS SAYS HI."];

type Flight = { cart: HTMLElement; x0: number; y0: number; x1: number; y1: number; sink: number; t: number; out: boolean };
let flight: Flight | null = null, seated: HTMLElement | null = null, next: HTMLElement | null = null;
let glitch = -1, reply = -1;
let msg: HTMLElement | null = null, line1: Text | null = null, line2: Text | null = null;

const ease = (k: number) => 1 - (1 - k) ** 3;
/** Where `cart` sits plugged in: centred over the screen, slid down past its pins behind the console's top edge. */
function seat(cart: HTMLElement): Flight {
  const c = cart.getBoundingClientRect(), k = consoleEl.getBoundingClientRect();
  const x1 = k.left + k.width / 2 - (c.left + c.width / 2), sink = c.height * 0.42;
  const y1 = k.top - c.bottom - 6;
  return { cart, x0: 0, y0: 0, x1, y1, sink, t: 0, out: false };
}

function say(a: string, b: string) {
  if (!msg) {
    msg = L.add(document.createElement("span"));
    msg.className = "fz-corrupt";
    msg.setAttribute("role", "status");
    const b1 = document.createElement("b"), b2 = document.createElement("small");
    line1 = b1.appendChild(document.createTextNode(""));
    line2 = b2.appendChild(document.createTextNode(""));
    msg.append(b1, b2);
    screen.append(msg);
  }
  L.text(line1!, a);
  L.text(line2!, b);
}

engine.add({
  step(e, dt) {
    if (flight) {
      e.busy();
      flight.t += dt;
      if (flight.t >= (flight.out ? FLY : FLY + SINK)) {
        const f = flight;
        flight = null;
        if (f.out) {
          seated = null;
          if (next) start(next), (next = null);
        } else (seated = f.cart), (glitch = 0), (reply = -1);
      }
    }
    if (glitch >= 0) {
      e.busy();
      glitch += dt;
      if (glitch >= GLITCH) glitch = -1;
    }
  },
  render() {
    for (const c of carts) {
      const f = flight?.cart === c ? flight : null;
      if (f) {
        // In: an arc over to the slot, then straight down in. Out: the reverse, straight up first.
        const k = f.out ? 1 - f.t / FLY : Math.min(1, f.t / FLY), s = f.out ? 1 : Math.max(0, Math.min(1, (f.t - FLY) / SINK));
        const e = ease(k), lift = Math.sin(Math.PI * k) * 60;
        const x = f.x1 * e, y = f.y1 * e - lift + f.sink * (f.out ? (k > 0.85 ? (k - 0.85) / 0.15 : 0) : ease(s));
        L.style(c, "transform", `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`);
        L.style(c, "z-index", f.out && k > 0.85 ? "0" : !f.out && s > 0 ? "0" : "5");
        L.style(c, "transition", "none");
      } else if (c === seated) {
        const f = seat0.get(c)!;
        L.style(c, "transform", `translate(${f.x1.toFixed(1)}px,${(f.y1 + f.sink).toFixed(1)}px)`);
        L.style(c, "z-index", "0");
      } else {
        L.style(c, "transform", "");
        L.style(c, "z-index", "");
        L.style(c, "transition", "");
      }
    }
    L.style(consoleEl, "position", seated || flight ? "relative" : "");
    L.style(consoleEl, "z-index", seated || flight ? "1" : "");
    const on = !!seated;
    L.attr(consoleEl, "data-corrupt", on ? (glitch >= 0 ? "glitch" : "on") : null);
    if (on) say(reply < 0 ? SAYS[0]! : REPLIES[reply % REPLIES.length]!, `${seated!.querySelector("strong")?.textContent?.trim().toUpperCase() ?? "THE GAME"} IS FINE. ${SAYS[1]}`);
    else if (msg) say("", "");
    if (msg) L.style(msg, "display", on ? "" : "none");
  },
});
engine.start();

const seat0 = new Map<HTMLElement, Flight>();
function start(cart: HTMLElement, out = false) {
  const f = out ? seat0.get(cart)! : seat(cart);
  if (!out) seat0.set(cart, f);
  flight = { ...f, t: reduce.matches ? FLY + SINK : 0, out };
  if (out) seated = null;
  engine.wake();
}
const eject = () => seated && !flight && start(seated, true);

for (const cart of carts)
  cart.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (flight) return;
    if (cart === seated) return eject();
    if (seated) (next = cart), eject();
    else start(cart);
  });
screen.addEventListener("click", eject);
document.addEventListener("keydown", (ev) => ev.key === "Escape" && eject());
consoleEl.querySelector("[data-console-pad]")?.addEventListener("click", (ev) => {
  if (!(ev.target as Element).closest("[data-pad]")) return;
  if (seated) (reply++, (glitch = 0), engine.wake());
});

expose({
  recall: () => engine.destroy(),
  get resting() {
    return engine.stats().paused.includes("settled");
  },
});
