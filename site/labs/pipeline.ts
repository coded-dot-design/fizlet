// Lab: "Build once. Ship each." A release hops through the five stages from engine source to the
// live site; each stage lights as it lands. It ships itself once the first time it comes on
// screen; SHIP IT sends another. Stage positions are read once per ship (and on resize).
import { $, kf, key, labEngine, reduced, textOf, type Lab, type LabOptions } from "./lab";

const SKULL = "M19 6h26v6h7v6h6v6h5v22h-5v6h-8v12h-9v-8h-6v8h-8v-8h-6v8h-8V52H5v-6H0V24h5v-6h6v-6h8ZM11 29v14h15V29Zm26 0v14h15V29Z";
/** The default stages (the DOM VIRUS release path): [title, what happens]. */
export const STAGES: [string, string][] = [
  ["src/", "engine"],
  ["sync:games", "snapshot + ORIGIN.json"],
  ["game repo", "test · tag vX"],
  ["games.json", "hub pin"],
  ["Pages", "static, no server"],
];
const SAY = ["BUILD ENGINE", "SNAPSHOT + FINGERPRINT", "TEST · TAG", "PIN EXACT VERSION", "DEPLOY TO PAGES"];
const LIVE = "LIVE · 0 SERVERS";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export const pipelineFigure = (poster = false, stages = STAGES) =>
  `<figure class="lab-stage ship-line fzl" data-fzl="pipeline" aria-label="Release pipeline from engine source to the live site. Ship it sends a release through each stage.">` +
  `<ol class="stages">${stages.map(([t, s]) => `<li><b>${esc(t)}</b><span>${esc(s)}</span></li>`).join("")}</ol>` +
  `<i class="parcel" aria-hidden="true"><svg viewBox="0 0 64 64" shape-rendering="crispEdges" aria-hidden="true"><path fill-rule="evenodd" d="${SKULL}"/></svg></i>` +
  `<div class="lab-keys">${key("data-ship", "SHIP IT", poster)}<span class="lab-readout" data-ship-readout>READY</span></div></figure>`;

const PAUSE = 0.26, PULSE = 0.3, PULSE_KF = [1, 1.5, 1];

export function pipeline(figure: HTMLElement, o: LabOptions = {}): Lab {
  const reduce = reduced();
  const stages = [...figure.querySelectorAll<HTMLElement>(".stages li")], N = stages.length;
  const parcel = $(figure, ".parcel"), button = $(figure, "[data-ship]"), readout = textOf($(figure, "[data-ship-readout]"));
  // Stage spots (read phase): x, y per stage.
  const spot = new Float64Array(N * 2);
  // measure needed, shipped once, queued ship, stage (-1 idle), hop t (s), hop length, pause left,
  // pulse left, lit count, shown-and-due (auto ship in s, -1 none), parcel visible
  const s = new Float64Array([1, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0]);
  const lab = labEngine(figure, 5, o, () => {
    if (!s[1] && !reduce && s[9]! < 0) s[9] = 0.5;
  });
  const { engine } = lab, L = engine.ledger;
  const ro = new ResizeObserver(() => ((s[0] = 1), engine.wake()));
  ro.observe(figure);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  button.addEventListener("click", () => ((s[2] = 1), (s[0] = 1), lab.input()), { signal: engine.signal });

  const ship = () => {
    s[1] = 1;
    s[9] = -1;
    if (reduce) return void ((s[8] = N), (s[3] = -1));
    (s[3] = 0), (s[4] = 0), (s[5] = 0.2), (s[6] = 0), (s[8] = 0), (s[10] = 1);
  };
  // Where the parcel is: hopping from the last stage (or sitting on the first) to the current one.
  const xy = new Float64Array(2);
  const at = () => {
    const i = s[3]!, from = Math.max(0, i - 1), p = s[6]! > 0 || s[5]! === 0 ? 1 : Math.floor(Math.min(1, s[4]! / s[5]!) * 6) / 6;
    const x0 = spot[from * 2]!, y0 = spot[from * 2 + 1]!, x1 = spot[i * 2]!, y1 = spot[i * 2 + 1]!;
    // Keyframes: from → (to, 10 px up) at 60% → to, on steps(6).
    if (p < 0.6) (xy[0] = x0 + (x1 - x0) * (p / 0.6)), (xy[1] = y0 + (y1 - 10 - y0) * (p / 0.6));
    else (xy[0] = x1), (xy[1] = y1 - 10 + 10 * ((p - 0.6) / 0.4));
  };

  engine.add({
    read() {
      if (!s[0]) return;
      s[0] = 0;
      const f = figure.getBoundingClientRect();
      for (let i = 0; i < N; i++) {
        const r = stages[i]!.getBoundingClientRect();
        (spot[i * 2] = r.left + r.width / 2 - f.left - 11), (spot[i * 2 + 1] = r.top - f.top - 22);
      }
    },
    step(e, dt) {
      if (s[2]) {
        s[2] = 0;
        if (s[3]! < 0) ship();
      }
      if (s[9]! >= 0 && (s[9]! -= dt) <= 0) (s[9] = -1), s[1] || ship();
      if (s[9]! >= 0) e.busy();
      if (s[7]! > 0) (s[7]! -= dt), e.busy();
      if (s[3]! < 0) return;
      e.busy();
      if (s[6]! > 0) {
        if ((s[6]! -= dt) > 0) return;
        // The pause after a landing is over: on to the next stage, or live.
        if (++s[3]! >= N) return void ((s[3] = -1), (s[7] = PULSE));
        (s[4] = 0), (s[5] = 0.42);
        return;
      }
      if ((s[4]! += dt) >= s[5]!) (s[8] = s[3]! + 1), (s[6] = PAUSE);
    },
    render() {
      const i = s[3]!;
      for (let k = 0; k < N; k++) L.cls(stages[k]!, "lit", k < s[8]!);
      L.attr(button, "disabled", i >= 0 ? "" : null);
      L.text(readout, i >= 0 ? `${SAY[i] ?? "SHIP"}…` : s[8] === N ? LIVE : "READY");
      if (i >= 0) at();
      else (xy[0] = spot[(N - 1) * 2]!), (xy[1] = spot[(N - 1) * 2 + 1]!);
      if (s[10]) {
        L.style(parcel, "transform", `translate(${xy[0]!.toFixed(1)}px,${xy[1]!.toFixed(1)}px)`);
        L.style(parcel, "opacity", "1");
        L.style(parcel, "scale", s[7]! > 0 ? String(kf(PULSE_KF, 1 - s[7]! / PULSE, 3)) : "1");
      }
    },
  });
  return { engine, entities: () => (s[3]! >= 0 ? 1 : 0), destroy: () => engine.destroy() };
}
