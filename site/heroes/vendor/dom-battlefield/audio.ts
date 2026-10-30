/** Small event-driven synthesizer: no assets, timers, animation loops or queued cues. */
export function createGameAudio(
  doc: Document,
  game: string,
  initial?: boolean,
) {
  const win = doc.defaultView!;
  const Context = (win as Window & typeof globalThis).AudioContext;
  const key = `dom-virus:${game}:sound`;
  let enabled = initial ?? true;
  try {
    if (initial === undefined)
      enabled = win.localStorage.getItem(key) !== "off";
  } catch {}
  let context: AudioContext | undefined, master: GainNode | undefined;
  let unlocked = false;
  const voices = new Set<{
    source: OscillatorNode;
    gain: GainNode;
    finish(): void;
  }>();
  const times = new Map<string, number>();
  // Fixed cue names keep the cooldown map bounded even with arbitrary public events.
  const cues: Record<string, string> = {
    start: "ready",
    preview: "ready",
    "level-start": "ready",
    "wave-start": "ready",
    wave: "ready",
    pellet: "eat",
    letter: "eat",
    fruit: "bonus",
    power: "bonus",
    "ghost-eaten": "bonus",
    "weapon-upgrade": "bonus",
    "cannon-upgrade": "bonus",
    "supply-collected": "bonus",
    "base-captured": "bonus",
    fire: "fire",
    kill: "hit",
    "tank-destroyed": "hit",
    "gate-destroyed": "hit",
    "mine-detonated": "hit",
    "structure-built": "build",
    "build-start": "build",
    hurt: "hurt",
    "level-clear": "clear",
    "wave-clear": "clear",
    won: "clear",
    gameover: "end",
  };
  function unlock(event?: Event) {
    if (
      !enabled ||
      !Context ||
      doc.hidden ||
      !(event?.isTrusted || win.navigator.userActivation?.isActive)
    )
      return;
    try {
      if (!context) {
        context = new Context();
        master = context.createGain();
        master.gain.value = 0.12;
        master.connect(context.destination);
      }
      unlocked = true;
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      unlocked = false;
    }
  }
  function silence() {
    unlocked = false;
    for (const voice of voices) {
      try {
        voice.gain.gain.cancelScheduledValues(0);
        voice.gain.gain.value = 0;
        voice.source.stop();
      } catch {}
      voice.finish();
    }
    times.clear();
  }
  function note(
    frequency: number,
    end: number,
    duration: number,
    delay = 0,
    type: OscillatorType = "triangle",
    volume = 0.22,
  ) {
    if (!context || !master || voices.size >= 6) return;
    let source: OscillatorNode | undefined, gain: GainNode | undefined;
    try {
      source = context.createOscillator();
      gain = context.createGain();
      const start = context.currentTime + delay,
        stop = start + duration;
      source.type = type;
      source.frequency.setValueAtTime(frequency, start);
      source.frequency.exponentialRampToValueAtTime(end, stop);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);
      source.connect(gain);
      gain.connect(master);
      const voice = {
        source,
        gain,
        finish() {
          source!.onended = null;
          source!.disconnect();
          gain!.disconnect();
          voices.delete(voice);
        },
      };
      source.onended = voice.finish;
      source.start(start);
      source.stop(stop + 0.01);
      voices.add(voice);
    } catch {
      try {
        source?.stop();
        source?.disconnect();
        gain?.disconnect();
      } catch {}
    }
  }

  function play(event: string) {
    const cue = cues[event];
    if (
      !cue ||
      !enabled ||
      !unlocked ||
      context?.state !== "running" ||
      doc.hidden
    )
      return;
    const now = context.currentTime;
    const cooldown = cue === "eat" ? 0.085 : cue === "fire" ? 0.09 : 0.16;
    if (now - (times.get(cue) ?? -Infinity) < cooldown) return;
    times.set(cue, now);
    if (cue === "eat") note(600, 360, 0.045, 0, "triangle", 0.12);
    if (cue === "fire")
      game === "sherman-bytes"
        ? note(120, 42, 0.12, 0, "triangle", 0.32)
        : note(980, 220, 0.07, 0, "triangle", 0.18);
    if (cue === "hit") note(190, 45, 0.15, 0, "square", 0.08);
    if (cue === "hurt") note(220, 80, 0.22, 0, "sawtooth", 0.09);
    if (cue === "build") note(290, 440, 0.09);
    if (cue === "ready") {
      note(330, 440, 0.08);
      note(660, 660, 0.1, 0.08);
    }
    if (cue === "bonus" || cue === "clear") {
      note(523, 523, 0.09);
      note(659, 659, 0.1, 0.08);
      note(784, 900, 0.16, 0.16);
    }
    if (cue === "end") {
      note(440, 330, 0.16);
      note(260, 80, 0.3, 0.16);
    }
  }
  function close() {
    silence();
    master?.disconnect();
    if (context) void context.close().catch(() => {});
    context = undefined;
    master = undefined;
  }
  return {
    get enabled() {
      return enabled && !!Context;
    },
    get available() {
      return !!Context;
    },
    unlock,
    play,
    silence,
    close,
    toggle() {
      enabled = !enabled;
      silence();
      try {
        win.localStorage.setItem(key, enabled ? "on" : "off");
      } catch {}
    },
  };
}
