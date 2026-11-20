// src/sound.ts
var NOTES = {
  fire: [[980, 220, 0.07, 0, "triangle", 0.16]],
  hit: [[190, 45, 0.15, 0, "square", 0.08]],
  boom: [[120, 30, 0.35, 0, "sawtooth", 0.14], [70, 25, 0.4, 0.02, "square", 0.08]],
  hurt: [[220, 80, 0.22, 0, "sawtooth", 0.09]],
  power: [[523, 523, 0.08, 0, "triangle", 0.2], [784, 1046, 0.14, 0.07, "triangle", 0.2]],
  ready: [[330, 440, 0.08, 0, "triangle", 0.2], [660, 660, 0.1, 0.08, "triangle", 0.2]],
  win: [[523, 523, 0.09, 0, "triangle", 0.2], [659, 659, 0.1, 0.08, "triangle", 0.2], [784, 900, 0.16, 0.16, "triangle", 0.2]],
  end: [[440, 330, 0.16, 0, "triangle", 0.2], [260, 80, 0.3, 0.16, "triangle", 0.2]],
  click: [[600, 360, 0.045, 0, "triangle", 0.12]]
};
function sound(e, o) {
  const ctl = new AbortController(), sig = { signal: ctl.signal };
  let ctx, master, on = o.on ?? true, voices = 0;
  const last = /* @__PURE__ */ new Map();
  const wake = () => void ctx?.resume().catch(() => {
  });
  const unlock = (ev) => {
    if (!on || !ev.isTrusted) return;
    if (ctx) return ctx.state === "running" || wake();
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = o.volume ?? 0.12;
      master.connect(ctx.destination);
      wake();
    } catch {
    }
  };
  if (!o.play) for (const t of ["pointerdown", "pointerup", "keydown"]) addEventListener(t, unlock, { signal: ctl.signal, capture: true });
  function play(cue, intensity = 1, at) {
    const notes = o.notes && Object.hasOwn(o.notes, cue) ? o.notes[cue] : Object.hasOwn(NOTES, cue) ? NOTES[cue] : null;
    if (!on || !e.running || ctl.signal.aborted || !notes) return;
    if (o.play) return o.play(cue, intensity);
    if (!ctx || !master || ctx.state !== "running") return;
    const now = at ?? ctx.currentTime;
    if (!at) {
      if (now - (last.get(cue) ?? -1) < (cue === "fire" ? 0.07 : 0.12)) return;
      last.set(cue, now);
    }
    for (const [from, to, sec, delay, wave, vol] of notes) {
      if (voices >= 8) return;
      const osc = ctx.createOscillator(), g = ctx.createGain(), t0 = now + delay, t1 = t0 + sec;
      osc.type = wave;
      osc.frequency.setValueAtTime(from, t0);
      osc.frequency.exponentialRampToValueAtTime(to, t1);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.linearRampToValueAtTime(vol * Math.min(1.5, intensity), t0 + 4e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t1);
      osc.connect(g).connect(master);
      voices++;
      osc.onended = () => (voices--, osc.disconnect(), g.disconnect());
      osc.start(t0);
      osc.stop(t1 + 0.01);
    }
  }
  const system = e.add({
    render(eng) {
      for (let i = 0; i < eng.events.size; i++) {
        const ev = eng.events.at(i);
        if (Object.hasOwn(o.cues, ev.type)) play(o.cues[ev.type], ev.v || 1);
      }
    }
  });
  function dispose() {
    ctl.abort();
    e.remove(system);
    void ctx?.close().catch(() => {
    });
    ctx = master = void 0;
  }
  e.signal.addEventListener("abort", dispose, sig);
  return {
    play,
    dispose,
    get on() {
      return on;
    },
    /** The audio clock in seconds (it stands still while suspended or muted), -1 before the first gesture. */
    get time() {
      return ctx ? ctx.currentTime : -1;
    },
    set on(v) {
      on = v;
      if (!v) void ctx?.suspend().catch(() => {
      });
      else wake();
    }
  };
}

export {
  sound
};
