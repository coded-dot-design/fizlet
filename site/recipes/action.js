// Recipe: an action on the page. A click on a real button bursts sparks out of it and counts; the
// engine sleeps half a second after the last spark. Kernel, fx and hud. Runs as is with action.html.
import { createEngine } from "@fzlt/core";
import { effects } from "@fzlt/core/fx";
import { hud } from "@fzlt/core/hud";

const root = document.getElementById("action");
const button = root.querySelector("button");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const e = createEngine({ root, settle: 0.5 });
const fx = effects({ cap: 160, colors: ["#ff5c8f", "#ffd166", "#39ffb0", "#19f0ff"] });
const canvas = e.ledger.add(document.createElement("canvas")); // Recall removes it
canvas.style.cssText = "position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none";
root.append(canvas);
const ctx = canvas.getContext("2d");

// [likes, width, height, button x, button y, bursts waiting]: numbers in a typed array.
const s = new Float64Array(6);
button.addEventListener("click", () => { s[0] += 1; s[5] += 1; e.wake(); }, { signal: e.signal });

e.add({
  read() { // measure here, once a frame
    s[1] = root.clientWidth;
    s[2] = root.clientHeight;
    s[3] = button.offsetLeft + button.offsetWidth / 2;
    s[4] = button.offsetTop + button.offsetHeight / 2;
  },
  step(e, dt) { // no DOM here
    for (; s[5] > 0; s[5]--) if (!calm) fx.blast(s[3], s[4], 0.45);
    fx.step(dt);
    if (fx.live) e.busy(); // keep awake while sparks fly
  },
  render() {
    if (canvas.width !== s[1] || canvas.height !== s[2]) { canvas.width = s[1]; canvas.height = s[2]; }
    ctx.clearRect(0, 0, s[1], s[2]);
    fx.draw(ctx);
    e.ledger.cls(button, "liked", s[0] > 0); // change-only, given back on destroy()
  },
});
hud(e, root).num("[data-likes]", [s, 0]);
e.start();
