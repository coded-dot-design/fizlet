// timeline demo: DOM choreography, no canvas. A cartridge flies into a console and seats; the
// screen opens (clip-path) and three lines stagger in; the console glows (a custom property). Every
// write goes through the ledger; when it ends the engine settles. Replay runs it again; with reduced
// motion it lands on the end state at once.
import { createEngine } from "../../src/index";
import { timeline } from "../../src/timeline";
import { status } from "./common";

export default function timelineDemo(host: HTMLElement) {
  const at = host.querySelector<HTMLElement>("[data-stage]")!;
  at.insertAdjacentHTML(
    "beforeend",
    `<div class="bd-tl" role="img" aria-label="A cartridge flies into a console, the screen opens and three lines appear">
  <div class="bd-tl-cart"></div>
  <div class="bd-tl-console"><div class="bd-tl-screen"><i>BOOT</i><i>LOAD 4 KB</i><i>READY</i></div></div>
</div><button type="button" class="bui-key" data-k="go">Replay</button>`,
  );
  const q = (s: string) => at.querySelector<HTMLElement>(s)!;
  const e = createEngine({ root: at, settle: 0.4 });
  const tl = timeline(e)
    .to(q(".bd-tl-cart"), { translate: ["0px -150px", "0px 0px"], rotate: ["-14deg", "0deg"] }, { dur: 0.7, ease: "back" })
    .label("seated")
    .to(q(".bd-tl-console"), { "--glow": ["0", "1", "0.35"] }, { dur: 0.6, ease: "linear" })
    .to(q(".bd-tl-screen"), { "clip-path": ["inset(48% 50% 48% 50%)", "inset(0% 0% 0% 0%)"] }, { at: "seated", dur: 0.5, ease: "inOut" })
    .to(at.querySelectorAll(".bd-tl-screen i"), { opacity: [0, 1], translate: ["-12px 0px", "0px 0px"] }, { delay: -0.1, dur: 0.3, stagger: 0.15 });
  const put = status(host, e);
  at.querySelector("button")!.addEventListener("click", () => (tl.seek(0).play(), put()), { signal: e.signal });
  e.start();
  tl.play();
}
