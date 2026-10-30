// fizlet/sound (Node): which events and cues make a sound. The browser suite plays the real synth.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.requestAnimationFrame ??= () => 0; // started engines are advanced by hand here
globalThis.cancelAnimationFrame ??= () => {};
const { createEngine } = await import("../src/index.ts");
const { sound } = await import("../src/sound.ts");

// Event types (a timeline label can be anything) and JS-called cues named like Object.prototype keys.
const PROTO = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "isPrototypeOf"];

function engineWith(types) {
  const e = createEngine();
  e.add({ step: (e) => types.forEach((t) => e.events.emit(t)) });
  e.start(); // sound plays only while the engine runs
  return e;
}

test("sound: only own cue keys play; Object.prototype names are ignored, not thrown on", () => {
  const e = engineWith(["shot", ...PROTO, "wreck"]), heard = [];
  const s = sound(e, { cues: { shot: "fire", wreck: "boom" }, play: (cue) => heard.push(cue) });
  assert.equal(e.running, true);
  e.advance(1 / 60);
  assert.deepEqual(heard, ["fire", "boom"]);
  for (const k of PROTO) s.play(k);
  assert.deepEqual(heard, ["fire", "boom"], "a JS caller's unknown cue plays nothing");
  e.destroy();
});

test("sound: the synth skips a prototype-named event or cue instead of crashing render", () => {
  const listeners = [], oscs = [];
  const node = () => ({ connect: (n) => n ?? node(), disconnect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  const keep = { addEventListener: globalThis.addEventListener, AudioContext: globalThis.AudioContext };
  globalThis.addEventListener = (type, fn) => listeners.push(fn);
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 1;
    destination = node();
    resume = async () => {};
    close = async () => {};
    createGain = node;
    createOscillator() {
      const o = { ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {} };
      oscs.push(o);
      return o;
    }
  };
  try {
    // An own "constructor" key is a real mapping and plays; "toString" is not mapped and is skipped.
    const e = engineWith(["toString", "constructor", "valueOf"]);
    const s = sound(e, { cues: { constructor: "boom" } });
    listeners[0]({ isTrusted: true }); // a trusted gesture unlocks the synth
    e.advance(1 / 60);
    assert.equal(oscs.length, 2, "boom's two notes, nothing else");
    for (const k of PROTO) s.play(k);
    assert.equal(oscs.length, 2);
    assert.equal(e.running, true);
    e.destroy();
  } finally {
    Object.assign(globalThis, keep);
  }
});
