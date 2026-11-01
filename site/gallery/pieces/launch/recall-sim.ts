// Recall Party, the game on plain numbers (no DOM: the GC test steps it in Node). The page's own
// letters are the guests. Tap anywhere and a party popper in the nearest bottom corner fires
// confetti at it: every letter the confetti reaches is knocked loose, tumbles and lands in a heap on
// the floor. Press Recall (R) and every letter flies home to its exact spot, last one in first.
// Every step writes typed arrays only: no objects, no strings, no closures (tests/launch-day.test.mjs).

export const FLOOR = 88, PN = 260;
/** Modes. */
export const INTRO = 0, IDLE = 1, PARTY = 2, RECALL = 3;
/** State slots. */
export const T = 0, MODE = 1, POPS = 2, LOOSE = 3, RT = 4, HOME = 5, SIDE = 6, DEMO = 7, RECALLS = 8, HITS = 9, AIMX = 10, AIMY = 11, FLASH = 12, CHECK = 13;
/** The Recall button (art units): x, y, w, h. */
export const BTN_X = 121, BTN_Y = 56, BTN_W = 35, BTN_H = 20;

export type RecallSim = ReturnType<typeof recallSim>;

/** The party for `n` letters. `rnd`: the engine's seeded random; `emit(type)`: "pop", "hit", "land", "recall", "home". */
export function recallSim(n: number, rnd: () => number, emit: (type: string) => void) {
  const S = new Float64Array(16);
  // Letters: home centre and size (art units, read from the page), offset, velocity, turn, spin,
  // loose (0 home, 1 flying, 2 resting), the offset and turn when Recall began, its delay.
  const HX = new Float32Array(n), HY = new Float32Array(n), LW = new Float32Array(n), LH = new Float32Array(n);
  const DX = new Float32Array(n), DY = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n), R = new Float32Array(n), VR = new Float32Array(n);
  const LS = new Uint8Array(n), SX = new Float32Array(n), SY = new Float32Array(n), SR = new Float32Array(n), DL = new Float32Array(n);
  // Confetti: position, velocity, life left, colour slot, flutter phase.
  const PX = new Float32Array(PN), PY = new Float32Array(PN), PVX = new Float32Array(PN), PVY = new Float32Array(PN), PL = new Float32Array(PN), PC = new Uint8Array(PN), PF = new Float32Array(PN);
  const cur = new Int32Array(1);
  S[DEMO] = 0.45;

  /** Fire a popper from the nearest bottom corner at (x, y). */
  function pop(x: number, y: number) {
    const side = x < 80 ? 0 : 1, ox = side ? 156 : 4, oy = 86, a = Math.atan2(y - oy, x - ox);
    (S[SIDE] = side), (S[AIMX] = x), (S[AIMY] = y), (S[FLASH] = 0.18), (S[POPS] = S[POPS]! + 1);
    const reach = Math.min(150, Math.sqrt((x - ox) * (x - ox) + (y - oy) * (y - oy)));
    for (let k = 0; k < 56; k++) {
      const i = cur[0]!;
      cur[0] = (i + 1) % PN;
      const aa = a + (rnd() - 0.5) * 0.5, s = (1 + reach / 60) * (60 + rnd() * 70);
      (PX[i] = ox), (PY[i] = oy), (PVX[i] = Math.cos(aa) * s), (PVY[i] = Math.sin(aa) * s), (PL[i] = 1.6 + rnd() * 1.2), (PC[i] = (rnd() * 6) | 0), (PF[i] = rnd() * 6.28);
    }
    emit("pop");
  }
  function party() {
    if (S[MODE] === RECALL) return false;
    S[MODE] = PARTY;
    S[DEMO] = -1;
    return true;
  }

  return {
    S, HX, HY, LW, LH, DX, DY, R, LS, PX, PY, PL, PC, PF,
    n,
    /** Set letter i's home (centre, size) in art units (after a layout read). */
    place(i: number, x: number, y: number, w: number, h: number) {
      (HX[i] = x), (HY[i] = y), (LW[i] = w), (LH[i] = h);
    },
    /** A tap at (x, y): the Recall button, or a popper aimed there. */
    tap(x: number, y: number) {
      if (x >= BTN_X && x <= BTN_X + BTN_W && y >= BTN_Y && y <= BTN_Y + BTN_H) return this.recall();
      if (!party()) return false;
      pop(x, y);
      return true;
    },
    /** Space: a popper at the middle of the headline, from alternating corners. */
    key() {
      if (!party()) return false;
      let x = 0, y = 0;
      for (let i = 0; i < n; i++) (x += HX[i]!), (y += HY[i]!);
      pop(n ? x / n + (S[POPS]! % 2 ? 20 : -20) : 80, n ? y / n : 30);
      return true;
    },
    /** Recall: every loose letter flies home (the last one knocked goes first). */
    recall() {
      if (S[MODE] === RECALL || S[LOOSE] === 0) return false;
      (S[MODE] = RECALL), (S[RT] = 0), (S[DEMO] = -1), (S[RECALLS] = S[RECALLS]! + 1), (S[CHECK] = 0);
      let k = 0;
      for (let i = 0; i < n; i++) if (LS[i]) (SX[i] = DX[i]!), (SY[i] = DY[i]!), (SR[i] = R[i]!), (DL[i] = 0.04 * k++), (LS[i] = 1);
      for (let i = 0; i < PN; i++) if (PL[i]! > 0.4) PL[i] = 0.4;
      emit("recall");
      return true;
    },
    /** One step; true while anything moves. */
    step(dt: number) {
      S[T] = S[T]! + dt;
      S[FLASH] = Math.max(0, S[FLASH]! - dt);
      if (S[MODE] === INTRO) {
        if (S[DEMO]! > 0 && S[DEMO]! < 1 && S[T]! >= S[DEMO]!) {
          S[DEMO] = 2.9;
          let x = 0, y = 0;
          for (let i = 0; i < n; i++) (x += HX[i]!), (y += HY[i]!);
          pop(n ? x / n - 14 : 60, n ? y / n - 12 : 20);
          S[MODE] = INTRO;
        } else if (S[DEMO]! > 2 && S[T]! >= S[DEMO]!) {
          S[DEMO] = -1;
          if (!this.recall()) S[MODE] = IDLE;
        }
      }
      let moving = S[FLASH]! > 0 ? 1 : 0, loose = 0;
      // Confetti: drag, a slow fall, a flutter; it knocks every letter it reaches loose.
      for (let i = 0; i < PN; i++) {
        if (PL[i]! <= 0) continue;
        moving = 1;
        PL[i] = PL[i]! - dt;
        const drag = Math.max(0, 1 - dt * 1.7);
        PVX[i] = PVX[i]! * drag + Math.sin(PF[i]! + S[T]! * 7) * 6 * dt;
        PVY[i] = PVY[i]! * drag + 40 * dt;
        PX[i] = PX[i]! + PVX[i]! * dt;
        PY[i] = PY[i]! + PVY[i]! * dt;
        if (PY[i]! > FLOOR) (PY[i] = FLOOR), (PVY[i] = 0), (PVX[i] = PVX[i]! * 0.5);
        const sp = PVX[i]! * PVX[i]! + PVY[i]! * PVY[i]!;
        if (S[MODE] === RECALL || sp < 900) continue;
        for (let j = 0; j < n; j++) {
          if (Math.abs(PX[i]! - HX[j]! - DX[j]!) > LW[j]! / 2 || Math.abs(PY[i]! - HY[j]! - DY[j]!) > LH[j]! / 2) continue;
          if (!LS[j]) (S[HITS] = S[HITS]! + 1), emit("hit");
          LS[j] = 1;
          VX[j] = VX[j]! + PVX[i]! * 0.12;
          VY[j] = VY[j]! + PVY[i]! * 0.12 - 14;
          VR[j] = VR[j]! + (rnd() - 0.5) * 900;
          PVX[i] = PVX[i]! * 0.6;
          PVY[i] = PVY[i]! * 0.6;
          break;
        }
      }
      if (S[MODE] === RECALL) {
        // Home: eased back along a straight line, the spin unwound.
        S[RT] = S[RT]! + dt;
        let left = 0;
        for (let i = 0; i < n; i++) {
          if (!LS[i]) continue;
          const u = Math.min(1, Math.max(0, (S[RT]! - DL[i]!) / 0.55)), e = 1 - (1 - u) * (1 - u) * (1 - u);
          DX[i] = SX[i]! * (1 - e);
          DY[i] = SY[i]! * (1 - e) - Math.sin(u * 3.1416) * 8;
          R[i] = SR[i]! * (1 - e);
          if (u >= 1) (LS[i] = 0), (DX[i] = DY[i] = R[i] = VX[i] = VY[i] = VR[i] = 0);
          else left++;
        }
        moving = 1;
        if (!left) (S[MODE] = IDLE), (S[HOME] = 1.8), (S[CHECK] = 1), emit("home");
      } else {
        for (let i = 0; i < n; i++) {
          if (LS[i] !== 1) {
            if (LS[i] === 2) loose++;
            continue;
          }
          loose++;
          moving = 1;
          VY[i] = VY[i]! + 170 * dt;
          DX[i] = DX[i]! + VX[i]! * dt;
          DY[i] = DY[i]! + VY[i]! * dt;
          R[i] = R[i]! + VR[i]! * dt;
          if (R[i]! > 180) R[i] = R[i]! - 360;
          else if (R[i]! < -180) R[i] = R[i]! + 360;
          const x = HX[i]! + DX[i]!, half = LW[i]! / 2;
          if (x < half) (DX[i] = half - HX[i]!), (VX[i] = Math.abs(VX[i]!) * 0.5);
          else if (x > 160 - half) (DX[i] = 160 - half - HX[i]!), (VX[i] = -Math.abs(VX[i]!) * 0.5);
          const bottom = HY[i]! + DY[i]! + LH[i]! / 2;
          if (bottom > FLOOR) {
            DY[i] = FLOOR - LH[i]! / 2 - HY[i]!;
            if (VY[i]! > 30) emit("land");
            VY[i] = -VY[i]! * 0.3;
            VX[i] = VX[i]! * 0.7;
            VR[i] = VR[i]! * 0.5;
            if (Math.abs(VY[i]!) < 8 && Math.abs(VX[i]!) < 3) (VY[i] = VX[i] = VR[i] = 0), (LS[i] = 2);
          }
        }
      }
      if (S[HOME]! > 0) (S[HOME] = S[HOME]! - dt), (moving = 1);
      if (S[MODE] !== RECALL) S[LOOSE] = loose;
      if (S[MODE] === PARTY && !moving) S[MODE] = IDLE;
      return moving === 1 || (S[MODE] === INTRO && S[DEMO]! > 0);
    },
  };
}
