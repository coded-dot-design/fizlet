// sound demo: every built-in synth cue on a key. No audio files: oscillators only. The engine wakes
// for a press and settles after it (the synth plays only while the engine runs).
import { createEngine } from "../../src/index";
import { sound, type Cue } from "../../src/sound";
import { press } from "../../src/ui/board-ui";
import { status } from "./common";

const CUES: Cue[] = ["fire", "hit", "boom", "hurt", "power", "ready", "win", "end", "click"];

export default function soundDemo(host: HTMLElement) {
  const keys = host.querySelector<HTMLElement>("[data-stage]")!;
  const e = createEngine({ root: keys, settle: 0.5 });
  const sfx = sound(e, { cues: {} });
  const put = status(host, e);
  for (const cue of CUES) {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "bui-key bui-arcade bui-sys bd-key";
    k.textContent = cue;
    keys.append(k);
    press(k, () => {
      e.wake();
      sfx.play(cue, 1);
      put();
    }, e.signal);
  }
  e.start();
}
