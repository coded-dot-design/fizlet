import {
  EASES
} from "./chunks/chunk-U366ZQ55.js";
import {
  sprites
} from "./chunks/chunk-7IOT3S6Q.js";
import "./chunks/chunk-LDZ6SJ5Z.js";
import {
  createEngine
} from "./chunks/chunk-5VOOXBKR.js";
import "./chunks/chunk-RXTVZ32U.js";
import "./chunks/chunk-26IPXWAE.js";
import {
  KINDS,
  effects,
  emitter
} from "./chunks/chunk-CL4NM7U6.js";
import "./chunks/chunk-RA74YNEB.js";

// src/scene.ts
function mountScene(stage, d, o = {}) {
  const st = d.stage, VW = st.w, VH = st.h, f = d.fx ?? {}, cast = d.cast ?? [], over = d.over ?? [], cues = d.cue ?? [], gags = d.gag ?? [];
  const motion = o.motion ?? !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const engine = createEngine({ root: stage, fps: st.fps ?? 30, settle: 0.5 });
  const fx = effects({ cap: 220, scorch: 0, ...f });
  const kinds = {};
  for (const k in f.kinds) kinds[k] = typeof f.kinds[k] === "string" ? KINDS[f.kinds[k]] : f.kinds[k];
  const { ids, emit } = emitter(fx, kinds);
  const art = {};
  for (const k in d.art) art[k] = { frames: d.art[k], ...d.ink && { colors: d.ink } };
  const spr = sprites(art, d.palettes && { palettes: d.palettes });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const ctx = canvas.getContext("2d");
  const s = new Float64Array(10);
  s[2] = s[3] = 1;
  const put = (v, i, d2 = 0) => {
    const t = s[4];
    s[i] = (typeof v !== "object" ? v : !(v[3] > 0) ? t > v[2] ? v[1] : v[0] : v[0] + (v[1] - v[0]) * EASES[v[4] ?? "linear"](Math.min(1, Math.max(0, (t - v[2]) / v[3])))) + d2;
  };
  const val = (v) => {
    const t = s[4], on = v?.on ?? [0];
    return typeof v !== "object" ? v : v.blink ? t < on[0] ? v.blink[0] : t < (on[1] ?? Infinity) ? v.blink[t * v.hz & 1] : v.then ?? v.blink[0] : !(v[3] > 0) ? t > v[2] ? v[1] : v[0] : (put(v, 9), s[9]);
  };
  const shown = (it) => !it.on || s[4] >= it.on[0] && s[4] < (it.on[1] ?? Infinity);
  const sky = new Float32Array(2 * (st.stars?.[0] ?? 0));
  for (let i = 0; i < sky.length; i += 2) sky[i] = engine.random() * VW, sky[i + 1] = engine.random() * VH * st.stars[2];
  const end = st.end, delay = st.delay ?? 0, loop = st.loop ?? 0, shake = st.shake ?? 0;
  const reset = () => {
    s[4] = motion ? -delay : st.poster ?? end;
    s[5] = motion ? 0 : cues.length;
    s[6] = 0;
    fx.clear();
    engine.busy(motion ? end - s[4] : 0);
  };
  const ro = new ResizeObserver(() => (s[3] = 1, engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = () => (reset(), engine.wake());
  if (motion) stage.addEventListener("pointerdown", play, { signal: engine.signal });
  function step(dt) {
    const t = s[4] = s[4] + dt;
    if (t < 0) return;
    for (let c; s[5] < cues.length && t >= (c = cues[s[5]])[0]; s[5] = s[5] + 1) {
      if (c[1] === "word") fx.word(c[3], c[4], c[2], c[5], c[6]);
      else if (c[1] === "kick") fx.kick(c[2]);
      else emit(ids[c[2]], c[3], c[4], c[5], c[6], c[7], c[8]);
    }
    for (const g of gags)
      if (t > g.on[0] && t < g.on[1]) put(g.x, 7, g.dx), put(g.y, 8, g.dy), emit(ids[g.emit], s[7], s[8], g.n, g.c, g.cn, g.scale);
  }
  function draw(items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!shown(it)) continue;
      if (it.sprite) spr.draw(ctx, it.sprite, 0, val(it.x), val(it.y), val(it.rot ?? 0), val(it.scale ?? 1), val(it.pal ?? 0));
      else if (it.rect) ctx.fillStyle = val(it.fill), ctx.fillRect(val(it.rect[0]), val(it.rect[1]), val(it.rect[2]), val(it.rect[3]));
      else if (it.line) {
        ctx.lineCap = it.cap ?? "butt";
        ctx.beginPath();
        ctx.moveTo(val(it.line[0]), val(it.line[1]));
        ctx.lineTo(val(it.line[2]), val(it.line[3]));
        ctx.strokeStyle = val(it.stroke);
        ctx.lineWidth = val(it.lw);
        ctx.stroke();
      } else {
        const x = val(it.x), y = val(it.y);
        ctx.font = it.font;
        ctx.textAlign = it.align ?? "start";
        if (it.stroke) ctx.lineWidth = val(it.lw ?? 1), ctx.strokeStyle = val(it.stroke), ctx.strokeText(it.text, x, y);
        ctx.fillStyle = val(it.fill);
        ctx.fillText(it.text, x, y);
      }
    }
  }
  function paint() {
    const w = s[0], h = s[1], dp = s[2], t = s[4];
    if (canvas.width !== Math.round(w * dp) || canvas.height !== Math.round(h * dp)) {
      canvas.width = Math.round(w * dp);
      canvas.height = Math.round(h * dp);
      const k = Math.min(canvas.width / VW, canvas.height / VH);
      ctx.setTransform(k, 0, 0, k, (canvas.width - VW * k) / 2, (canvas.height - VH * k) / 2);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = st.bg;
    ctx.fillRect(-VW, -VH, VW * 3, VH * 3);
    const sh = fx.shake * shake;
    if (sh) ctx.save(), ctx.translate(Math.round(Math.sin(t * 70) * sh), Math.round(Math.cos(t * 53) * sh));
    if (st.stars) ctx.fillStyle = st.stars[1];
    for (let i = 0; i < sky.length; i += 2) ctx.fillRect(sky[i] | 0, sky[i + 1] | 0, 1, 1);
    draw(cast);
    fx.draw(ctx);
    if (sh) ctx.restore();
    draw(over);
  }
  reset();
  const sys = {
    engine,
    play,
    destroy: () => engine.destroy(),
    read() {
      if (!s[3]) return;
      s[3] = 0;
      s[0] = stage.clientWidth;
      s[1] = stage.clientHeight;
      s[2] = Math.min(2, devicePixelRatio || 1);
    },
    step(e, dt) {
      if (!motion) return;
      step(dt);
      fx.step(dt);
      if (loop > 0 && s[4] > end && (s[6] = s[6] + dt) >= loop) reset();
      if (fx.live > 0 || loop > 0) e.busy();
    },
    render: paint
  };
  engine.add(sys);
  engine.start();
  return sys;
}
var scene = (d, o) => (stage) => mountScene(stage, d, o);
export {
  mountScene,
  scene
};
