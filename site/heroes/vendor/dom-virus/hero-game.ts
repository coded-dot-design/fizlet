/**
 * Hero mini-game. Loaded on the first tap/drag on the hero's browser card.
 * The CSS loop keeps running for visitors who never touch it; once someone plays,
 * the same tank and interceptor switch to a tiny contained game:
 * - bad guys keep spawning; each self-destructs after a few seconds
 * - both shooters auto-aim (turn on their own centre) and auto-fire; spread makes some miss
 * - tap a bad guy to squash it; drag the tank; tap the tank to spin its turret in a 360 spray;
 *   tap the plane to spin it and fire a burst (tap faster for more bullets)
 * - every two minutes an alarm counts down, the card blinks and a nuke resets the round
 * One rAF loop, bounded pools, paused whenever the scene is paused or offscreen.
 */
const NS = "http://www.w3.org/2000/svg";
const ROUND = 120,
  ALARM = 10,
  MAX_FOES = 26,
  MAX_SHOTS = 60,
  MAX_BOOMS = 14,
  SHOT_SPEED = 620;
const TONES = ["#ffe14d", "#f4457a", "#06c4ff", "#fff4ff"];

type Foe = { el: SVGGElement; x: number; y: number; r: number; dies: number; color: string; dead: boolean };
type Shot = { el: SVGLineElement; x: number; y: number; vx: number; vy: number; life: number };

export function startHeroGame(hero: HTMLElement, first?: PointerEvent) {
  if (hero.dataset.play === "true") return;
  hero.dataset.play = "true";
  const stage = hero.querySelector<HTMLElement>(".promo-stage")!,
    svg = hero.querySelector<SVGSVGElement>(".promo-action")!,
    status = hero.querySelector<HTMLElement>(".promo-status")!,
    planeAim = svg.querySelector<SVGGElement>(".plane-aim")!,
    planeKick = svg.querySelector<SVGGElement>(".plane-kick")!,
    tankRoot = svg.querySelector<SVGGElement>(".tank-in")!.parentNode as SVGGElement,
    turret = svg.querySelector<SVGGElement>(".turret-aim")!,
    treads = svg.querySelector<SVGPathElement>(".tank-hull path")!;
  // Bad guys sit under the shooters; shots and explosions draw on top.
  const foeLayer = document.createElementNS(NS, "g"),
    layer = document.createElementNS(NS, "g");
  foeLayer.setAttribute("class", "hx-foes");
  layer.setAttribute("class", "hx-layer");
  svg.insertBefore(foeLayer, planeAim.closest("svg > g"));
  svg.append(layer);
  // Bad-guy art comes from the scene itself, so the game always matches the poster.
  const templates = [...svg.querySelectorAll<SVGGElement>(".foe-css")].map((g) => ({
    art: g.querySelector<SVGGElement>(".foe-art")!,
    size: Number(g.dataset.size),
    color: g.dataset.color || "#06c4ff",
  }));
  const statusText = status.lastChild as Text,
    poster = statusText.textContent;

  const base = { plane: angleOf(planeAim), tank: angleOf(turret), tankRoot: tankRoot.getAttribute("transform") || "" };
  const plane = { x: 404, y: 96, a: angleOf(planeAim), spin: 0, burst: 0, cool: 0.6, kick: 0 };
  const tank = { x: 196, y: 298, a: angleOf(turret), spin: 0, cool: 0.9, kick: 0, tread: 0, minX: 70, maxX: 430 };
  const foes: Foe[] = [],
    shots: Shot[] = [],
    shotPool: SVGLineElement[] = [];
  let booms = 0,
    score = 0,
    round = 0,
    spawnIn = 0,
    last = 0,
    frame = 0,
    nuked = false,
    resets = 0,
    drag: { id: number; dx: number; moved: boolean } | null = null;

  function angleOf(g: SVGGElement) {
    const m = /rotate\((-?[\d.]+)deg\)/.exec(g.style.transform);
    return m ? (Number(m[1]) * Math.PI) / 180 : 0;
  }
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  function spawn() {
    if (foes.length >= MAX_FOES || !templates.length) return;
    const t = templates[Math.floor(Math.random() * templates.length)]!;
    const r = rand(13, 30),
      edge = Math.random() < 0.22;
    let x = 0,
      y = 0;
    // Keep clear of the shooters so every spawn is a fair target.
    for (let tries = 0; tries < 8; tries++) {
      x = edge ? (Math.random() < 0.5 ? rand(-20, 20) : rand(480, 520)) : rand(40, 460);
      y = edge ? rand(10, 340) : rand(30, 250);
      if ((x - plane.x) ** 2 + (y - plane.y) ** 2 > 75 ** 2 && (x - tank.x) ** 2 + (y - tank.y) ** 2 > 85 ** 2) break;
    }
    const el = document.createElementNS(NS, "g");
    el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${((r * 2) / t.size).toFixed(3)})`);
    const inner = document.createElementNS(NS, "g");
    inner.append(t.art.cloneNode(true));
    el.append(inner);
    foeLayer.append(el);
    inner.animate(
      [
        { transform: "scale(0) rotate(-40deg)", opacity: 0 },
        { transform: "scale(1.3) rotate(6deg)", opacity: 1, offset: 0.6 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 450, easing: "cubic-bezier(.3,1.6,.5,1)" },
    );
    inner.style.transformBox = "fill-box";
    inner.style.transformOrigin = "center";
    foes.push({ el, x, y, r, dies: rand(5, 9), color: t.color, dead: false });
  }

  function boom(x: number, y: number, color: string, big = 1) {
    if (booms >= MAX_BOOMS) return;
    booms++;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${big})`);
    const parts: [Element, Keyframe[], number][] = [];
    const circle = (r: number, attrs: Record<string, string>) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", String(r));
      for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, v);
      return c;
    };
    parts.push([circle(16, { fill: "#fff4ff" }), [{ transform: "scale(.3)", opacity: 1 }, { transform: "scale(3.2)", opacity: 1, offset: 0.35 }, { transform: "scale(4)", opacity: 0 }], 320]);
    parts.push([circle(12, { fill: "#ffe14d" }), [{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(2.6)", opacity: 1, offset: 0.4 }, { transform: "scale(.2)", opacity: 0 }], 480]);
    parts.push([circle(14, { fill: "none", stroke: color, "stroke-width": "4" }), [{ transform: "scale(.5)", opacity: 1 }, { transform: "scale(6)", opacity: 0 }], 480]);
    const sq = document.createElementNS(NS, "rect");
    for (const [k, v] of Object.entries({ x: "-14", y: "-14", width: "28", height: "28", fill: "none", stroke: "#f4457a", "stroke-width": "3" })) sq.setAttribute(k, v);
    parts.push([sq, [{ transform: "scale(.4) rotate(0)", opacity: 1 }, { transform: "scale(4.6) rotate(90deg)", opacity: 0 }], 640]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.3,
        d = 48 + (i % 3) * 16,
        s = 4 + (i % 3) * 2;
      const r = document.createElementNS(NS, "rect");
      for (const [k, v] of Object.entries({ x: String(-s / 2), y: String(-s / 2), width: String(s), height: String(s), fill: i % 3 === 0 ? color : TONES[i % 4]! })) r.setAttribute(k, v);
      const dx = Math.cos(a) * d,
        dy = Math.sin(a) * d;
      parts.push([r, [{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${(i % 2 ? 1 : -1) * (90 + i * 25)}deg)`, opacity: 1, offset: 0.78 }, { transform: `translate(${dx}px,${dy + 14}px)`, opacity: 0 }], 720]);
    }
    layer.append(g);
    let left = parts.length;
    for (const [el, frames, ms] of parts) {
      (el as SVGElement).style.transformBox = "fill-box";
      (el as SVGElement).style.transformOrigin = "center";
      g.append(el);
      el.animate(frames, { duration: ms, easing: "cubic-bezier(.15,.8,.3,1)", fill: "forwards" }).onfinish = () => {
        if (--left === 0) {
          g.remove();
          booms--;
        }
      };
    }
    stage.animate(
      [{ transform: "none" }, { transform: `translate(${-3 * big}px,${2 * big}px)` }, { transform: `translate(${3 * big}px,${-2 * big}px)` }, { transform: "none" }],
      { duration: 110 },
    );
  }

  function kill(f: Foe, scored: boolean) {
    if (f.dead) return;
    f.dead = true;
    boom(f.x, f.y, f.color, Math.max(0.7, f.r / 24));
    f.el.remove();
    if (scored) score++;
  }

  function fire(x: number, y: number, a: number) {
    if (shots.length >= MAX_SHOTS) return;
    const el = shotPool.pop() ?? document.createElementNS(NS, "line");
    el.setAttribute("class", "hx-shot");
    el.setAttribute("x1", "0");
    el.setAttribute("y1", "0");
    el.setAttribute("x2", (Math.cos(a) * 16).toFixed(1));
    el.setAttribute("y2", (Math.sin(a) * 16).toFixed(1));
    el.setAttribute("stroke", y < 200 ? "#06c4ff" : "#4bce82");
    layer.append(el);
    shots.push({ el, x, y, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, life: 1.4 });
  }

  // Nearest live foe the shooter is not already busy with.
  function target(x: number, y: number) {
    let best: Foe | undefined,
      d = Infinity;
    for (const f of foes) {
      if (f.dead) continue;
      const e = (f.x - x) ** 2 + (f.y - y) ** 2;
      if (e < d) (d = e), (best = f);
    }
    return best;
  }
  function aligned(a: number, want: number, tol: number) {
    return Math.abs(turn(a, want, 9) - a) < tol;
  }
  function turn(from: number, to: number, max: number) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + Math.max(-max, Math.min(max, d));
  }

  function step(dt: number) {
    round += dt;
    // Spawning speeds up a little as the round goes on.
    spawnIn -= dt;
    if (spawnIn <= 0 && !nuked) {
      spawn();
      // A crowd builds: fast spawns, faster as the round goes on.
      spawnIn = rand(0.22, 0.5) * (1 - Math.min(0.45, round / ROUND / 2));
    }
    for (const f of foes) if (!f.dead && (f.dies -= dt) <= 0) kill(f, false);

    // Interceptor: turns on its centre (sprite faces up, so +90deg), fires when lined up.
    plane.cool -= dt;
    if (plane.spin > 0) {
      plane.spin -= dt;
      plane.a += dt * 14;
      if (plane.burst > 0 && (plane.cool <= 0 || plane.burst > 12)) {
        fire(plane.x + Math.cos(plane.a - Math.PI / 2) * 44, plane.y + Math.sin(plane.a - Math.PI / 2) * 44, plane.a - Math.PI / 2);
        plane.burst--;
        plane.cool = 0.03;
      }
    } else {
      const t = target(plane.x, plane.y);
      if (t) {
        const want = Math.atan2(t.y - plane.y, t.x - plane.x) + Math.PI / 2;
        plane.a = turn(plane.a, want, dt * 6);
        if (plane.cool <= 0 && aligned(plane.a, want, 0.12)) {
          const spread = rand(-0.26, 0.26);
          fire(plane.x + Math.cos(plane.a - Math.PI / 2) * 44, plane.y + Math.sin(plane.a - Math.PI / 2) * 44, plane.a - Math.PI / 2 + spread);
          plane.cool = 0.75;
          plane.kick = 0.12;
        }
      }
    }
    // Tank turret: same idea; a tap spins it through a 360 spray.
    tank.cool -= dt;
    if (tank.spin > 0) {
      tank.spin -= dt;
      tank.a += dt * 10;
      if (tank.cool <= 0) {
        fire(tank.x + Math.cos(tank.a) * 58, tank.y + Math.sin(tank.a) * 58, tank.a);
        tank.cool = 0.05;
      }
    } else {
      const t = target(tank.x, tank.y);
      if (t) {
        const want = Math.atan2(t.y - tank.y, t.x - tank.x);
        tank.a = turn(tank.a, want, dt * 4.5);
        if (tank.cool <= 0 && aligned(tank.a, want, 0.1)) {
          fire(tank.x + Math.cos(tank.a) * 58, tank.y + Math.sin(tank.a) * 58, tank.a + rand(-0.22, 0.22));
          tank.cool = 0.95;
          tank.kick = 0.12;
        }
      }
    }
    // Projectiles: straight lines; any foe they touch explodes; misses fly off screen.
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]!;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let hit = false;
      for (const f of foes)
        if (!f.dead && (f.x - s.x) ** 2 + (f.y - s.y) ** 2 < (f.r + 4) ** 2) {
          kill(f, true);
          hit = true;
          break;
        }
      if (hit || s.life <= 0 || s.x < -300 || s.x > 800 || s.y < -300 || s.y > 660) {
        s.el.remove();
        shotPool.push(s.el);
        shots.splice(i, 1);
      } else s.el.setAttribute("transform", `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`);
    }
    for (let i = foes.length - 1; i >= 0; i--) if (foes[i]!.dead) foes.splice(i, 1);

    // Two-minute round: alarm, blink, nuke, reset.
    const leftS = ROUND - round;
    hero.classList.toggle("hx-alarm", leftS <= ALARM && !nuked);
    if (leftS <= 0 && !nuked) nuke();
    statusText.textContent = nuked
      ? ` NUKED · ${score} SQUASHED`
      : leftS <= ALARM
        ? ` NUKE IN ${Math.ceil(leftS)}…`
        : ` SQUASHED ${score} · NUKE ${Math.floor(leftS / 60)}:${String(Math.floor(leftS % 60)).padStart(2, "0")}`;
  }

  function nuke() {
    nuked = true;
    hero.classList.remove("hx-alarm");
    hero.classList.add("hx-nuke");
    foes.forEach((f, i) => setTimeout(() => kill(f, false), Math.min(700, i * 30)));
    setTimeout(() => {
      hero.classList.remove("hx-nuke");
      nuked = false;
      round = 0;
      score = 0;
      resets++;
    }, 2200);
  }

  function render(dt: number) {
    planeAim.style.transform = `rotate(${((plane.a * 180) / Math.PI).toFixed(1)}deg)`;
    plane.kick = Math.max(0, plane.kick - dt);
    planeKick.style.transform = plane.kick ? `translateY(${(plane.kick * 70).toFixed(1)}px)` : "";
    turret.style.transform = `rotate(${((tank.a * 180) / Math.PI).toFixed(1)}deg)`;
    tank.kick = Math.max(0, tank.kick - dt);
    (turret.firstElementChild as SVGGElement).style.transform = tank.kick ? `translateX(${(-tank.kick * 80).toFixed(1)}px)` : "";
    tankRoot.setAttribute("transform", `translate(${tank.x.toFixed(1)} ${tank.y})`);
    // Marks repeat every 14px; offsets in (-4, 10] keep them inside the tread.
    treads.style.transform = `translateX(${(10 - (((tank.tread % 14) + 14) % 14)).toFixed(1)}px)`;
  }

  function loop(now: number) {
    frame = 0;
    if (hero.dataset.motion !== "true") return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    step(dt);
    render(dt);
    frame = requestAnimationFrame(loop);
  }
  function wake() {
    if (hero.dataset.motion === "true" && !frame) {
      last = 0;
      frame = requestAnimationFrame(loop);
    }
  }
  const watcher = new MutationObserver(wake);
  watcher.observe(hero, { attributes: true, attributeFilter: ["data-motion"] });
  // Reduced motion (or leaving the page) ends the game and restores the poster exactly.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    watcher.disconnect();
    reduce.removeEventListener("change", onReduce);
    for (const [type, fn] of handlers) stage.removeEventListener(type, fn as EventListener);
    foeLayer.remove();
    layer.remove();
    stage.getAnimations().forEach((a) => a.cancel());
    hero.classList.remove("hx-alarm", "hx-nuke");
    for (const el of [planeAim, planeKick, turret, turret.firstElementChild as SVGGElement, treads]) el.style.transform = "";
    planeAim.style.transform = `rotate(${(base.plane * 180) / Math.PI}deg)`;
    turret.style.transform = `rotate(${(base.tank * 180) / Math.PI}deg)`;
    tankRoot.setAttribute("transform", base.tankRoot);
    statusText.textContent = poster;
    delete hero.dataset.play;
    delete (hero as HTMLElement & { heroGame?: object }).heroGame;
  }
  const onReduce = () => reduce.matches && stop();
  reduce.addEventListener("change", onReduce);

  // Pointer: map to scene coordinates through the card's own (rotated) transform.
  function local(e: PointerEvent) {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function down(e: PointerEvent) {
    if ((e.target as Element).closest("button,a")) return;
    const p = local(e);
    for (const f of foes)
      if (!f.dead && (f.x - p.x) ** 2 + (f.y - p.y) ** 2 < (f.r + 12) ** 2) return kill(f, true);
    if ((p.x - plane.x) ** 2 + (p.y - plane.y) ** 2 < 56 ** 2) {
      // Each tap adds bullets to the spin; tapping fast keeps it spinning and spraying.
      plane.spin = Math.max(plane.spin, 0.55);
      plane.burst = Math.min(40, plane.burst + 8);
      return;
    }
    if ((p.x - tank.x) ** 2 + (p.y - tank.y) ** 2 < 60 ** 2) {
      drag = { id: e.pointerId, dx: p.x - tank.x, moved: false };
      // The tap that loaded the game is replayed after its pointer may be gone: capture can throw.
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {}
    }
  }
  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const x = Math.max(tank.minX, Math.min(tank.maxX, local(e).x - drag.dx));
    if (Math.abs(x - tank.x) > 0.5) drag.moved = true;
    tank.tread += x - tank.x;
    tank.x = x;
  }
  function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) tank.spin = Math.max(tank.spin, 0.65);
    drag = null;
  }
  const handlers: [string, (e: PointerEvent) => void][] = [
    ["pointerdown", down],
    ["pointermove", move],
    ["pointerup", up],
    ["pointercancel", () => (drag = null)],
  ];
  for (const [type, fn] of handlers) stage.addEventListener(type, fn as EventListener);
  window.addEventListener("pagehide", stop, { once: true });

  // Small diagnostic handle for the site's browser test.
  (hero as HTMLElement & { heroGame?: object }).heroGame = {
    nuke: () => (round = ROUND),
    stop,
    get score() {
      return score;
    },
    get resets() {
      return resets;
    },
    get foes() {
      return foes.filter((f) => !f.dead).length;
    },
  };
  for (let i = 0; i < 6; i++) spawn();
  wake();
  render(0);
  if (first) down(first);
}
