import {
  boardPage
} from "./chunks/chunk-BO3IEMNB.js";
import {
  lockTouch
} from "./chunks/chunk-I6LJSJ5E.js";
import {
  hud
} from "./chunks/chunk-67RWNCL4.js";
import {
  match
} from "./chunks/chunk-EWF5TSUN.js";
import {
  sound
} from "./chunks/chunk-DGJ6IBZ4.js";
import {
  mount,
  readouts,
  toast
} from "./chunks/chunk-MA7XMWAR.js";
import {
  pad
} from "./chunks/chunk-W7T4FLNC.js";
import "./chunks/chunk-62P4PJ5K.js";
import "./chunks/chunk-3IN3G3AQ.js";
import {
  createEngine
} from "./chunks/chunk-5VOOXBKR.js";
import "./chunks/chunk-RXTVZ32U.js";
import "./chunks/chunk-26IPXWAE.js";
import {
  controls
} from "./chunks/chunk-6PHVSNYY.js";
import "./chunks/chunk-5M26CMEK.js";
import "./chunks/chunk-RA74YNEB.js";

// src/arcade-parts.ts
var svg = (d) => `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
var ICON = {
  sound: svg('<path d="M3 8h3l4-4v12l-4-4H3ZM14 6q4 4 0 8"/>'),
  mute: svg('<path d="M3 8h3l4-4v12l-4-4H3ZM14 8l4 4m0-4-4 4"/>'),
  pause: svg('<path d="M7 5v10M13 5v10"/>'),
  play: svg('<path d="m7 4 9 6-9 6Z"/>'),
  fold: svg('<path d="M4 10h12"/>'),
  open: svg('<path d="M4 10h12M10 4v12"/>'),
  exit: svg('<path d="m5 5 10 10M15 5 5 15"/>'),
  fire: svg('<path d="M10 1v5M10 14v5M1 10h5M14 10h5"/><circle cx="10" cy="10" r="5"/>')
};
var esc = (t) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
var BASE = `
:host{all:initial!important;position:fixed!important;inset:0!important;display:block!important;z-index:2147483000!important;pointer-events:none!important}
.bui{position:absolute;inset:0;background:none;font:500 12px/1.4 ui-monospace,monospace}
canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.bui .msg{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));translate:-50% 0;max-width:calc(100% - 24px);pointer-events:none}
.bui .msg[hidden]{display:none}
.bui .bui-pad{pointer-events:auto}
.bui>section{cursor:grab;touch-action:none}.bui>section button{cursor:pointer}.bui>section.drag{cursor:grabbing}
@media (prefers-reduced-motion:reduce){.bui *{transition:none!important;animation:none!important}}`;
function drag(card, signal) {
  const g = new Float64Array(2);
  const on = (ev) => {
    const k = ev.type[7], s = card.style;
    if (k === "d") {
      if (ev.button || ev.target.closest("button,input,select")) return;
      const o = card.offsetParent ?? card.parentElement, q = o.getBoundingClientRect(), b = card.getBoundingClientRect();
      g[0] = ev.clientX - b.left + q.left + o.clientLeft, g[1] = ev.clientY - b.top + q.top + o.clientTop;
      card.setPointerCapture(ev.pointerId);
      card.classList.add("drag");
    } else if (k !== "m") card.classList.remove("drag");
    else if (card.classList.contains("drag")) {
      const b = card.getBoundingClientRect();
      s.left = `max(0px,min(${ev.clientX - g[0]}px,calc(100% - ${b.width}px)))`, s.top = `max(0px,min(${ev.clientY - g[1]}px,calc(100% - ${b.height}px)))`, s.right = s.bottom = "auto", s.translate = "none";
    }
  };
  for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) card.addEventListener(t, on, { signal });
}

// src/arcade-skirmish.ts
var CSS = `
.sk{position:absolute;left:50%;top:max(10px,env(safe-area-inset-top));translate:-50% 0;max-width:calc(100% - 20px);display:flex;align-items:center;gap:14px;padding:8px 10px 8px 14px;pointer-events:auto;color:var(--ink);background:color-mix(in srgb,var(--card) 94%,transparent);border:2.5px solid var(--line);border-radius:10px;box-shadow:calc(5px*var(--bui-sx)) calc(5px*var(--bui-sy)) 0 var(--bui-shadow)}
.sk>b{font:900 11px/1 ui-monospace,monospace;letter-spacing:.14em;color:var(--team-a);white-space:nowrap}
.sk .bui-readouts{gap:16px}.sk .bui-readout b{font-size:16px;margin-top:3px}
.sk .bui-readout i{display:block;width:72px;height:8px;margin-top:7px;border-radius:3px;background:var(--surface);border:1.5px solid var(--line);overflow:hidden}
.sk .bui-readout u{display:block;height:100%;width:0;background:var(--team-a)}.sk u.low{background:var(--hurt)}
.sk nav{display:flex;gap:6px;margin-left:auto}.sk nav button{position:relative;min-width:34px;height:34px;min-height:0;padding:0 8px;display:grid;place-items:center;font:800 10px/1 ui-monospace,monospace;letter-spacing:.08em;white-space:nowrap}.sk nav svg{width:18px;height:18px}
.bui .bui-badge:empty{display:none}.sk .bui-badge{top:-8px;right:-8px;min-width:18px;height:18px;font-size:10px;line-height:15px}
.sk-feed{position:absolute;left:max(12px,env(safe-area-inset-left));top:80px;margin:0;padding:0;list-style:none;display:grid;gap:4px;font:700 11px/1.3 ui-monospace,monospace;color:var(--ink)}
.sk-feed li{padding:3px 8px;background:color-mix(in srgb,var(--surface) 85%,transparent);border-left:3px solid var(--team-a);border-radius:4px}.sk-feed li:empty{display:none}
.sk-ban{position:absolute;left:50%;top:24%;translate:-50% 0;display:grid;justify-items:center;gap:6px;padding:10px 18px;color:var(--ink);background:color-mix(in srgb,var(--surface) 94%,transparent);border:2px solid var(--line);border-radius:8px;box-shadow:calc(4px*var(--bui-sx)) calc(4px*var(--bui-sy)) 0 var(--bui-shadow);opacity:0}
.sk-ban b{font:900 28px/1 ui-monospace,monospace;letter-spacing:.1em}.sk-ban span{font:800 11px/1 ui-monospace,monospace;letter-spacing:.2em;color:var(--team-a)}
.sk-ban.a{animation:ska 1.8s both}.sk-ban.b{animation:skb 1.8s both}
@keyframes ska{0%{opacity:0;scale:1.4}12%,75%{opacity:1;scale:1}100%{opacity:0}}@keyframes skb{0%{opacity:0;scale:1.4}12%,75%{opacity:1;scale:1}100%{opacity:0}}
.bui .bui-overlay{pointer-events:auto}.bui .msg{z-index:31;bottom:auto;top:max(84px,calc(env(safe-area-inset-top) + 74px))}.sk.compact>b,.sk.compact nav>:not([aria-label]){display:none}
.sk-res{position:absolute;left:50%;top:58%;translate:-50% 0;display:grid;grid-template-columns:auto auto;gap:6px 18px;margin:0;font:800 12px/1 ui-monospace,monospace;letter-spacing:.12em;color:#f6f3ff}.sk-res dd{margin:0;text-align:right}
@media (pointer:coarse),(max-width:600px){.sk{width:calc(100% - 20px);flex-wrap:wrap;justify-content:space-between;gap:6px 8px;padding:6px 8px}.sk>b,.sk [data-act],.sk [data-aim]{display:none}.sk nav{flex-wrap:wrap;justify-content:flex-end}.sk .bui-readouts{gap:12px}.sk .bui-readout i{width:48px}.sk-feed{top:max(112px,calc(env(safe-area-inset-top) + 102px))}.bui .msg{top:max(160px,calc(env(safe-area-inset-top) + 150px))}}
@media (prefers-reduced-motion:reduce){.sk-ban.a,.sk-ban.b{opacity:1}}`;
var CROSS = '<svg viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges"><path d="m10 16 6-6 16 16 16-16 6 6-16 16 16 16-6 6-16-16-16 16-6-6 16-16Z"/></svg>';
var FULL = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg>';
var NAME = { fullscreen: "Full screen", sound: "Mute game sound", pause: "Pause game (P)", fold: "Minimize scoreboard", exit: "Close game and restore page (Esc)" };
var NAV = { next: '<button type="button" data-a="gate">Next gate</button>', restart: '<button type="button" data-a="restart">Restart</button>', auto: '<button type="button" data-a="auto" aria-pressed="false">Auto fire</button>' };
var FMT = { num: "int", clock: "clock", rank: "rank", pct: "pct" };
function skirmishHud(o) {
  const R = o.readouts, ov = o.overlays ?? ["pause", "surrender", "countdown", "result"], aims = (o.aim ?? []).map((a) => "aim-" + a);
  const counts = o.counts ?? {}, keys = {}, give = ov.includes("surrender");
  for (const a of aims) keys[a] = [];
  return {
    css: CSS + (give ? "" : ".bui-overlay [data-k=surrender]{display:none!important}"),
    keys,
    mount(r) {
      const { ui, def, engine: e, input } = r, actions = def.actions ?? [], doc = ui.ownerDocument;
      const head = (o.header ?? ["fullscreen", "sound", "pause", "exit"]).filter((k2) => k2 !== "fullscreen" || doc.fullscreenEnabled);
      const badge = (id) => id in counts ? '<b class="bui-badge"></b>' : "";
      const aimLabel = (a) => a === "aim-auto" ? "Auto aim" : "Lock";
      ui.insertAdjacentHTML("beforeend", `<section class="sk" aria-label="${esc(def.title)} controls"><b>${esc(def.title.toUpperCase())}</b><div class="bui-readouts">${R.map((x) => `<span class="bui-readout"${x.tone ? ` data-tone="${x.tone}"` : ""}>${esc(x.label)}${x.kind === "bar" ? `<i><u role="progressbar" aria-label="${esc(x.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></u></i>` : "<b></b>"}</span>`).join("")}</div><nav>${aims.map((a) => `<button type="button" data-a="aim" data-aim="${a}" aria-pressed="false">${aimLabel(a)}</button>`).join("")}${actions.map((a) => `<button type="button" data-act="${esc(a.id)}">${esc(a.label)}${badge(a.id)}</button>`).join("")}${(o.nav ?? []).filter((k2) => k2 !== "auto" || def.fire).map((k2) => NAV[k2]).join("")}${head.map((k2) => `<button type="button" data-a="${k2 === "fullscreen" ? "full" : k2}"${k2 === "fold" ? ' aria-expanded="true"' : ""} aria-label="${NAME[k2]}">${k2 === "fullscreen" ? FULL : ICON[k2]}</button>`).join("")}</nav></section>
${o.feed ? '<ol class="sk-feed" aria-label="Feed"></ol>' : ""}${o.banner ? '<div class="sk-ban" role="status"><b></b><span></span></div>' : ""}
<div class="bui-toast msg" role="status" hidden></div><dl class="sk-res"></dl>`);
      const $ = (s) => ui.querySelector(s);
      const bar = $(".sk"), group = bar.children[1], msg = $(".msg"), res = $(".sk-res");
      const k = { sound: $("[data-a=sound]"), pause: $("[data-a=pause]"), fold: $("[data-a=fold]") };
      const aimKeys = bar.querySelectorAll("[data-aim]"), lit = new Uint8Array(aims.length);
      let n = R.length;
      for (const id in counts) n = Math.max(n, counts[id] + 1);
      const out = new Float64Array(n), h = hud(e, ui);
      e.remove(h.system);
      group.querySelectorAll(".bui-readout > b,.bui-readout u").forEach((el, i) => {
        const x = R[i];
        x.kind === "bar" ? h.meter(el, [out, i], x.low) : h.num(el, [out, i], FMT[x.kind ?? "num"]);
      });
      if (o.feed) h.feed($(".sk-feed"), o.feed.rows ?? 4, o.feed.on, o.feed.line);
      if (o.banner) h.banner($(".sk-ban"), o.banner.on, o.banner.text, (el) => el.className = el.className === "sk-ban a" ? "sk-ban b" : "sk-ban a");
      const counted = [];
      for (const id in counts) bar.querySelectorAll(`[data-act="${esc(id)}"] .bui-badge`).forEach((b) => counted.push([b, counts[id]]));
      if (r.coarse) {
        const pads = actions.map((a, i) => ({ intent: a.id, label: a.label.replace(/^[^·]*· /, ""), role: !def.fire && !i ? "go" : "sys" }));
        if (def.fire) pads.unshift({ intent: "fire", label: "", name: "Hold to fire (Space)", icon: ICON.fire, hold: true, role: "fire" });
        for (const a of aims) pads.push({ intent: a, label: a === "aim-auto" ? "AUTO" : "LOCK", name: aimLabel(a), role: "aim", toggle: true });
        const p = pad(e, input, { scheme: def.pad ?? "stick", host: ui, actions: pads });
        pads.forEach((a, i) => {
          if (!(a.intent in counts)) return;
          const b = p.el.querySelector(`[data-i="${i}"]`).appendChild(doc.createElement("b"));
          b.className = "bui-badge";
          counted.push([b, counts[a.intent]]);
        });
      }
      for (const [b, slot] of counted) h.num(b, [out, slot]);
      let won = false, kept = "", play = () => {
      };
      const over = () => r.status() === "won" || r.status() === "gameover";
      const m = match(createEngine({ signal: r.signal }), ui, {
        count: ov.includes("countdown") ? 3 : 0,
        keys: [],
        hide: ["pause", "result"].filter((x) => !ov.includes(x)).map((x) => x === "pause" ? "paused" : "end"),
        labels: { paused: ["BATTLE PAUSED", give ? "GIVE UP?" : "PAUSED"], next: "EXIT" },
        icons: { next: CROSS },
        end: (x) => void (won = x.won),
        on(p) {
          if (p === "play") r.status() === "paused" ? r.go("resume") : play();
          else if (p === "paused") r.go("pause");
          else if (p === "end") r.go(won ? "won" : "lost");
          else if (p === "count" ? over() : p === "intro") r.go(p === "count" ? "restart" : "exit");
        }
      });
      m.el.insertBefore(res, m.el.lastChild);
      const sync = () => {
        const st = r.status();
        if (k.pause) {
          k.pause.innerHTML = st === "paused" ? ICON.play : ICON.pause;
          k.pause.setAttribute("aria-label", st === "paused" ? "Resume game (P)" : "Pause game (P)");
          k.pause.disabled = st !== "running" && st !== "paused";
        }
      };
      const syncSound = () => {
        if (!k.sound) return;
        k.sound.innerHTML = r.sfx.on ? ICON.sound : ICON.mute;
        k.sound.setAttribute("aria-pressed", String(r.sfx.on));
        k.sound.setAttribute("aria-label", r.sfx.on ? "Mute game sound" : "Turn game sound on");
      };
      syncSound();
      r.signal.addEventListener("abort", () => doc.fullscreenElement && doc.exitFullscreen().catch(() => {
      }));
      const write = () => {
        r.game.hud(out);
        h.system.render(e, 0);
        for (let i = 0; i < aims.length; i++) {
          const on = input.down(aims[i]) ? 1 : 0;
          if (on !== lit[i]) lit[i] = on, aimKeys[i]?.setAttribute("aria-pressed", on ? "true" : "false");
        }
      };
      return {
        msg,
        sync,
        write,
        ask: (to) => to === "pause" || to === "resume" ? m.pause(to === "pause") : m.finish(to === "won"),
        key(a, b, auto) {
          if (a === "sound") syncSound();
          else if (a === "auto") b.setAttribute("aria-pressed", String(auto)), b.textContent = auto ? "Fire: on" : "Auto fire";
          else if (a === "fold") {
            const c = bar.classList.toggle("compact");
            b.innerHTML = c ? ICON.open : ICON.fold;
            b.setAttribute("aria-expanded", String(!c));
            b.setAttribute("aria-label", c ? "Expand scoreboard" : "Minimize scoreboard");
          } else if (a === "full") (doc.fullscreenElement ? doc.exitFullscreen() : doc.documentElement.requestFullscreen()).catch(() => {
          });
          else if (a === "aim") input.press(b.dataset.aim, !input.down(b.dataset.aim)), write();
        },
        // The countdown runs on the flow's clock; the game's engine starts when play does.
        begin(go) {
          play = go;
          m.restart();
        },
        // The engine's ledger takes back what @fzlt/core/hud wrote: the bar keeps the final numbers.
        hold: () => void (kept = group.innerHTML),
        end(_, notice, stats) {
          group.innerHTML = kept;
          sync();
          toast(msg, notice, 1e9);
          if (!ov.includes("result")) return;
          const rows = (o.result?.stats ?? []).map((s) => [s, stats[s]]), best = o.result?.best;
          if (best) {
            const id = `fizlet:${def.id}:best`;
            let v = Number(stats[best]) || 0;
            try {
              v = Math.max(v, Number(localStorage.getItem(id)) || 0);
              localStorage.setItem(id, "" + v);
            } catch {
            }
            rows.push(["best " + best, v]);
          }
          res.innerHTML = rows.map(([l, v]) => `<dt>${esc(l.toUpperCase())}</dt><dd>${esc(String(v ?? 0))}</dd>`).join("");
        }
      };
    }
  };
}

// src/arcade.ts
var MODE = 0;
var PX = 1;
var PY = 2;
var PON = 3;
var KX = 4;
var KY = 5;
var FIRE = 6;
var VW = 7;
var VH = 8;
var CALM = 9;
var TARGET_HP = 10;
var EDIT = 'input,textarea,select,[contenteditable],form,dialog,[role="dialog"]';
var PROTECTED = "[data-virus-ignore],[data-fizlet-ignore]";
var CARD = `
.ar{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:min(300px,calc(100% - 24px));display:grid;gap:10px;padding:10px 12px 12px;pointer-events:auto;color:var(--ink);background:color-mix(in srgb,var(--card) 94%,transparent);border:2.5px solid var(--line);border-radius:10px;box-shadow:calc(5px*var(--bui-sx)) calc(5px*var(--bui-sy)) 0 var(--bui-shadow)}
.ar header{display:flex;align-items:center;gap:6px}.ar header b{flex:1;font:900 11px/1 ui-monospace,monospace;letter-spacing:.14em;color:var(--team-a)}
.ar header button{width:34px;height:34px;min-height:0;padding:0;display:grid;place-items:center}.ar header svg{width:18px;height:18px}
.ar .bui-readouts{justify-content:space-between;gap:12px}
.mt{display:grid;grid-template-columns:1fr auto;gap:4px 8px;font-size:10px;letter-spacing:.08em;color:var(--muted)}.mt b{color:var(--ink)}
.mt i{grid-column:1/-1;height:6px;border-radius:3px;background:var(--surface);border:1.5px solid var(--line);overflow:hidden}.mt u{display:block;height:100%;width:0;background:var(--team-a)}
.ar nav{display:flex;flex-wrap:wrap;gap:6px}.ar nav button{flex:1 1 auto;white-space:nowrap;min-height:0;padding:7px 6px;font:800 10px/1 ui-monospace,monospace;letter-spacing:.08em}.ar nav:empty{display:none}
.ar.compact .mt,.ar.compact nav,.ar.compact [data-fold]{display:none}
@media (pointer:coarse),(max-width:600px){.ar{top:max(10px,env(safe-area-inset-top));bottom:auto;width:min(260px,calc(100% - 20px))}.bui .msg{bottom:auto;top:max(150px,calc(env(safe-area-inset-top) + 140px))}}`;
var HEAD = {
  sound: `<button type="button" data-a="sound" aria-pressed="true" aria-label="Mute game sound">${ICON.sound}</button>`,
  pause: `<button type="button" data-a="pause" aria-label="Pause game (P)">${ICON.pause}</button>`,
  fold: `<button type="button" data-a="fold" aria-expanded="true" aria-label="Minimize scoreboard">${ICON.fold}</button>`,
  exit: `<button type="button" data-a="exit" aria-label="Close game and restore page (Esc)">${ICON.exit}</button>`
};
function arcadeHud(o = {}) {
  return {
    css: CARD,
    mount(r) {
      const { ui, def, coarse } = r, R = def.readouts ?? [], actions = def.actions ?? [];
      const nav = o.nav ?? ["next", "restart", "auto"];
      ui.insertAdjacentHTML("beforeend", `<section class="ar" aria-label="${esc(def.title)} controls"><header><b>${esc(def.title.toUpperCase())}</b>${(o.header ?? ["sound", "pause", "fold", "exit"]).map((k2) => "\n" + HEAD[k2]).join("")}</header>
${def.meter ? `<div class="mt"><b></b><span></span><i role="progressbar" aria-label="${esc(def.meter.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><u></u></i></div>` : ""}
<nav>${actions.map((a) => `<button type="button" data-act="${esc(a.id)}">${esc(a.label)}</button>`).join("")}${nav.includes("next") ? '<button type="button" data-a="gate">Next gate</button>' : ""}${nav.includes("restart") ? '<button type="button" data-a="restart">Restart</button>' : ""}${def.fire && nav.includes("auto") ? '<button type="button" data-a="auto" aria-pressed="false">Auto fire</button>' : ""}</nav></section>
<div class="bui-toast msg" role="status" hidden></div>`);
      const $ = (s) => ui.querySelector(s);
      const panel = $(".ar"), msg = $(".msg"), meter = $(".mt");
      const { group, values } = readouts(panel, R.map(([l, t]) => t ? [l, t] : [l]));
      panel.insertBefore(group, meter ?? $("nav"));
      R.forEach(([, , , fold2], i) => fold2 && group.children[i].setAttribute("data-fold", ""));
      if (coarse) {
        const pads = actions.map((a, i) => ({ intent: a.id, label: a.label.replace(/^[^·]*· /, ""), role: !def.fire && !i ? "go" : "sys" }));
        if (def.fire) pads.unshift({ intent: "fire", label: "", name: "Hold to fire (Space)", icon: ICON.fire, hold: true, role: "fire" });
        pad(r.engine, r.input, { scheme: def.pad ?? "stick", host: ui, actions: pads });
      }
      const k = { sound: $("[data-a=sound]"), pause: $("[data-a=pause]"), fold: $("[data-a=fold]") };
      const fold = (compact) => {
        panel.classList.toggle("compact", compact);
        k.fold.innerHTML = compact ? ICON.open : ICON.fold;
        k.fold.setAttribute("aria-expanded", String(!compact));
        k.fold.setAttribute("aria-label", compact ? "Expand scoreboard" : "Minimize scoreboard");
      };
      if (k.fold) fold(coarse || innerWidth <= 600);
      const syncSound = () => {
        if (!k.sound) return;
        k.sound.innerHTML = r.sfx.on ? ICON.sound : ICON.mute;
        k.sound.setAttribute("aria-pressed", String(r.sfx.on));
        k.sound.setAttribute("aria-label", r.sfx.on ? "Mute game sound" : "Turn game sound on");
      };
      const sync = () => {
        const s = r.status();
        if (!k.pause) return;
        k.pause.innerHTML = s === "paused" ? ICON.play : ICON.pause;
        k.pause.setAttribute("aria-label", s === "paused" ? "Resume game (P)" : "Pause game (P)");
        k.pause.disabled = s !== "running" && s !== "paused";
      };
      syncSound();
      const N = R.length, hv = new Float64Array(N + 1), shown = new Float64Array(N + 1).fill(NaN);
      return {
        msg,
        sync,
        write() {
          const game = r.game;
          game.hud(hv);
          for (let i = 0; i < N; i++)
            if (hv[i] !== shown[i]) {
              const fmt = R[i][2];
              values[i].textContent = fmt ? fmt(hv[i]) : String(hv[i]);
              shown[i] = hv[i];
            }
          if (meter && game.meter && hv[N] !== shown[N]) {
            shown[N] = hv[N];
            const [l, rt, f] = game.meter(), pct = Math.round(Math.min(1, Math.max(0, f)) * 100);
            meter.children[0].textContent = l;
            meter.children[1].textContent = rt;
            meter.querySelector("u").style.width = `${pct}%`;
            meter.children[2].setAttribute("aria-valuenow", String(pct));
          }
        },
        key(a, b, auto) {
          if (a === "sound") syncSound();
          else if (a === "fold") fold(!panel.classList.contains("compact"));
          else if (a === "auto") b.setAttribute("aria-pressed", String(auto)), b.textContent = auto ? "Fire: on" : "Auto fire";
        },
        end(won, notice) {
          panel.classList.remove("compact");
          sync();
          toast(msg, `${won ? "STAGE CLEAR" : "GAME OVER"} \xB7 ${notice}`, 1e9);
        }
      };
    }
  };
}
function arcade(def, options = {}) {
  let status = "idle", destroyed = false, notice = "";
  let run = null;
  let last = {};
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => options.reducedMotion ?? !!motion?.matches;
  const emit = (type, data = {}) => options.onEvent?.({ ...data, type, game: def.id });
  const keyboard = def.keyboard || options.controls === "keyboard";
  const actions = def.actions ?? [];
  function getSnapshot() {
    const e = run?.engine, ms = e?.stats().frameMs;
    return { id: def.id, status, elapsed: e?.time ?? 0, ...run?.stats() ?? last, frameMs: ms?.avg ?? 0, maxFrameMs: ms?.max ?? 0, notice };
  }
  const notify = () => options.onState?.(getSnapshot());
  function begin() {
    const doc = document;
    const host = doc.createElement("div");
    host.dataset.domVirusRoot = def.id;
    host.dataset.virusIgnore = "";
    host.setAttribute("data-fizlet-host", def.id);
    const theme = options.theme === "dark" || options.theme === "light" ? options.theme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const preset = def.hud ?? arcadeHud();
    const ui = mount(host, def.css + BASE + preset.css, { theme, palette: { teamA: def.color } });
    ui.innerHTML = `<canvas aria-hidden="true"></canvas>
`;
    const canvas = ui.firstChild, c2d = canvas.getContext("2d");
    doc.documentElement.append(host);
    const life = new AbortController();
    let built;
    try {
      let gate2 = function() {
        let pick;
        for (const t of board.targets) if (t.hp > 0 && (!pick || pick.w > 0 && !(t.w > 0))) pick = t;
        pick?.el.scrollIntoView({ behavior: "instant", block: "center" });
        emit("jump");
      }, paint2 = function() {
        const max = ctl[
          10
          /* TARGET_HP */
        ] || 100;
        for (const t of board.targets) {
          const fill = Math.round(Math.min(t.hp, max) / max * 100);
          if (painted.get(t.el) === fill) continue;
          painted.set(t.el, fill);
          const c = signal(fill);
          e.ledger.style(t.el, "background", `linear-gradient(to top,${c} 0%,${c} ${fill}%,transparent ${fill}%,transparent 100%)`, "important");
        }
      }, stats2 = function() {
        let visible = 0, spent = 0, sparks = 0;
        const g = board.glyphs;
        for (let i = 0; i < g.count; i++) spent += g.spent[i], visible += g.w[i] > 0 ? 1 : 0;
        for (let i = 0; i < SN; i++) if (kl[i] > 0) sparks++;
        return { ...game.stats(), board: { indexed: g.count, visible, spent, measurements: board.reads }, particles: sparks };
      };
      var gate = gate2, paint = paint2, stats = stats2;
      const e = built = createEngine({
        root: host,
        seed: options.seed ?? Math.random() * 2 ** 31 | 0,
        events: 256,
        pause: { offscreen: false },
        onError(err) {
          stop();
          notice = "The game stopped safely after an error.";
          notify();
          options.onError?.(err);
        }
      });
      const board = boardPage(e, {
        root: (typeof options.root === "string" ? doc.querySelector(options.root) : options.root) ?? doc.body,
        // Fizlet's defaults plus the DOM VIRUS hooks pages already carry.
        text: options.textSelector ?? "h1,h2,h3,h4,h5,h6,p,li,blockquote,[data-fizlet-text],[data-virus-text]",
        targets: options.targetSelector ?? "button,[role=button],a.button,a.btn,[data-fizlet-target],[data-virus-target]",
        exclude: [PROTECTED, options.excludeSelector].filter(Boolean).join(","),
        color: def.color
      });
      const keys = { up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"] };
      if (def.fire) keys.fire = ["Space"];
      for (const a of actions) keys[a.id] = [a.key];
      Object.assign(keys, preset.keys);
      const input = controls(e, { keys, target: host });
      const sfx = sound(e, { on: options.sound !== false, cues: def.cues });
      const r = { ui, def, engine: e, input, coarse: matchMedia("(pointer: coarse)").matches, game: null, sfx, signal: life.signal, status: () => status, go };
      const hud2 = preset.mount(r);
      drag(ui.querySelector(":scope>section"), life.signal);
      const ctl = new Float64Array(11);
      const SN = 100, kx = new Float64Array(SN), ky = new Float64Array(SN), kvx = new Float64Array(SN), kvy = new Float64Array(SN), kl = new Float64Array(SN), kc = new Uint8Array(SN);
      const PN = 24, px = new Float64Array(PN), py = new Float64Array(PN), pl = new Float64Array(PN), pv = new Float64Array(PN), pc = new Uint8Array(PN), pt = new Array(PN).fill(null);
      const plus = [], label = (v) => plus[v] ?? (plus[v] = `+${v}`);
      const TONE = ["#4bce82", def.color, "#f4457a"];
      const context = {
        engine: e,
        board,
        input,
        ctl,
        reduced,
        popup(x, y, value, text, tone = 0) {
          if (text === null) {
            for (let i = 0; i < PN; i++)
              if (pl[i] > 0.65 && pt[i] === null && pc[i] === tone && Math.abs(px[i] - x) < 28 && Math.abs(py[i] - (y - 12)) < 28) return void (pv[i] += value, pl[i] = 1.1);
          }
          let k = 0;
          for (let i = 1; i < PN; i++) if (pl[i] < pl[k]) k = i;
          px[k] = x;
          py[k] = y - 12;
          pl[k] = 1.1;
          pv[k] = value;
          pt[k] = text;
          pc[k] = tone;
        },
        spark(x, y, n, c) {
          if (reduced()) return;
          for (let i = 0; i < SN && n > 0; i++) {
            if (kl[i] > 0) continue;
            const a = Math.random() * 6.2832, v = 30 + Math.random() * 100;
            kx[i] = x;
            ky[i] = y;
            kvx[i] = Math.cos(a) * v;
            kvy[i] = Math.sin(a) * v;
            kl[i] = 0.3 + Math.random() * 0.3;
            kc[i] = c;
            n--;
          }
        },
        say: (text, ms) => toast(hud2.msg, text, ms),
        emit,
        attach(el) {
          if (!(el instanceof HTMLElement) || /^(IMG|INPUT|BR|HR|CANVAS|VIDEO|IFRAME|TEXTAREA|SELECT)$/.test(el.tagName)) return null;
          if (getComputedStyle(el).position === "static") e.ledger.style(el, "position", "relative", "important");
          const art = e.ledger.add(doc.createElement("div"));
          art.setAttribute("data-fizlet-host", `${def.id}-art`);
          art.setAttribute("aria-hidden", "true");
          art.style.cssText = "all:initial!important;position:absolute!important;inset:0!important;display:block!important;border-radius:inherit!important;pointer-events:none!important;user-select:none!important";
          el.append(art);
          return art.attachShadow({ mode: "open" });
        }
      };
      const game = r.game = def.create(context);
      const p = new Float64Array(6);
      let mode = keyboard ? 0 : 1, auto = false, jump = 0, ending = 0;
      const live = () => status === "running";
      const guarded = (ev) => ev.composedPath().some((n) => n === host || n instanceof Element && n.matches(`${EDIT},${PROTECTED}`));
      const on = { signal: e.signal, capture: true };
      e.signal.addEventListener("abort", lockTouch(doc, null));
      e.ledger.style(doc.documentElement, "touch-action", "manipulation");
      doc.addEventListener("pointermove", (ev) => {
        if (!live() || ev.pointerType === "touch" || keyboard || guarded(ev)) return;
        p[
          0
          /* P_X */
        ] = ev.clientX;
        p[
          1
          /* P_Y */
        ] = ev.clientY;
        p[
          2
          /* P_ON */
        ] = 1;
        mode = 1;
      }, { ...on, passive: true });
      doc.addEventListener("pointerdown", (ev) => {
        if (!live() || ev.button !== 0 || guarded(ev) || !def.fire) return;
        p[
          3
          /* P_DOWN */
        ] = 1;
        ev.preventDefault();
      }, on);
      const up = () => p[
        3
        /* P_DOWN */
      ] = 0;
      doc.addEventListener("pointerup", up, on);
      doc.addEventListener("pointercancel", up, on);
      addEventListener("blur", up, { signal: e.signal });
      doc.addEventListener("click", (ev) => {
        if (live() && ev.detail > 0 && !guarded(ev)) ev.preventDefault(), ev.stopPropagation();
      }, on);
      doc.addEventListener("keydown", (ev) => {
        if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
        const t = ev.target;
        if (t instanceof Element && t.closest(EDIT)) return;
        if (ev.code === "Escape") return ev.preventDefault(), stop();
        if (/^(Arrow(Up|Down|Left|Right)|Key[WASD])$/.test(ev.code)) mode = 0;
        if (ev.repeat || t instanceof Element && t.closest(PROTECTED) && !host.contains(t)) return;
        if (ev.code === "KeyP") ev.preventDefault(), status === "paused" ? resume() : pause();
        else if (ev.code === "KeyG" && live()) ev.preventDefault(), jump = 1;
      }, { signal: life.signal, capture: true });
      ui.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-a],button[data-act]");
        if (!b) return;
        const a = b.dataset.a;
        if (b.dataset.act) live() && input.press(b.dataset.act), live() && input.press(b.dataset.act, false);
        else if (a === "sound") sfx.on = !sfx.on;
        else if (a === "pause") status === "paused" ? resume() : pause();
        else if (a === "exit") stop();
        else if (a === "restart") start();
        else if (a === "gate") live() && (jump = 1);
        else if (a === "auto") auto = !auto;
        hud2.key(a, b, auto);
        if (live()) b.blur();
      });
      const signal = (fill) => fill > 60 ? def.color : fill > 25 ? "#cdde00" : "#ee6875";
      const painted = /* @__PURE__ */ new Map();
      const view = new Float64Array(3), DPR = 0, NOTE = 1;
      const shell = {
        read() {
          if (ctl[
            7
            /* VW */
          ] !== innerWidth || ctl[
            8
            /* VH */
          ] !== innerHeight) {
            ctl[
              7
              /* VW */
            ] = innerWidth;
            ctl[
              8
              /* VH */
            ] = innerHeight;
            view[DPR] = Math.min(devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(innerWidth * view[DPR]);
            canvas.height = Math.round(innerHeight * view[DPR]);
          }
          const dx = scrollX - p[
            4
            /* SX */
          ], dy = scrollY - p[
            5
            /* SY */
          ];
          if (dx || dy) p[
            4
            /* SX */
          ] = scrollX, p[
            5
            /* SY */
          ] = scrollY, game.scroll?.(dx, dy);
          ctl[
            9
            /* CALM */
          ] = reduced() ? 1 : 0;
          ctl[
            4
            /* KX */
          ] = input.axis("left", "right", 0);
          ctl[
            5
            /* KY */
          ] = input.axis("up", "down", 1);
          if (ctl[
            4
            /* KX */
          ] || ctl[
            5
            /* KY */
          ]) mode = 0;
          ctl[
            0
            /* MODE */
          ] = mode;
          ctl[
            1
            /* PX */
          ] = p[
            0
            /* P_X */
          ];
          ctl[
            2
            /* PY */
          ] = p[
            1
            /* P_Y */
          ];
          ctl[
            3
            /* PON */
          ] = p[
            2
            /* P_ON */
          ];
          ctl[
            6
            /* FIRE */
          ] = def.fire && (input.down("fire") || p[
            3
            /* P_DOWN */
          ] || auto) ? 1 : 0;
        },
        render(eng) {
          const dt = eng.timing[0], r2 = reduced();
          for (let i = 0; i < eng.events.size; i++) game.react?.(eng.events.at(i));
          const o = game.over();
          if (o && !ending) ending = 1, queueMicrotask(() => flow(o === 2 ? "won" : "lost"));
          if (jump) jump = 0, gate2();
          if (def.paint !== false) paint2();
          const d = view[DPR], W = ctl[
            7
            /* VW */
          ], H = ctl[
            8
            /* VH */
          ];
          c2d.setTransform(d, 0, 0, d, 0, 0);
          c2d.clearRect(0, 0, W, H);
          const max = ctl[
            10
            /* TARGET_HP */
          ] || 100;
          c2d.lineWidth = 2;
          for (const g of board.targets) {
            if (!(g.w > 0 && g.hp > 0)) continue;
            const fill = g.hp / max * 100;
            c2d.globalAlpha = r2 ? 0.7 : 0.45 + 0.35 * Math.sin(eng.time * 6.2832 / (0.7 + 2.1 * (1 - fill / 100)));
            c2d.strokeStyle = signal(fill);
            c2d.strokeRect(g.x - 5, g.y - 5, g.w + 10, g.h + 10);
          }
          c2d.globalAlpha = 1;
          game.draw(c2d, dt);
          for (let i = 0; i < SN; i++) {
            if (kl[i] <= 0) continue;
            kl[i] -= dt;
            kx[i] += kvx[i] * dt;
            ky[i] += kvy[i] * dt;
            c2d.globalAlpha = Math.min(1, Math.max(0, kl[i] * 3));
            c2d.fillStyle = def.colors[kc[i]];
            c2d.fillRect(kx[i], ky[i], 3, 3);
          }
          c2d.globalAlpha = 1;
          c2d.font = "700 16px ui-monospace, monospace";
          c2d.textAlign = "center";
          c2d.lineJoin = "round";
          for (let i = 0; i < PN; i++) {
            if (pl[i] <= 0) continue;
            pl[i] -= dt;
            if (!r2) py[i] -= 18 * dt;
            const text = pt[i] ?? label(pv[i]);
            c2d.globalAlpha = Math.min(1, Math.max(0, pl[i] / 0.4));
            c2d.strokeStyle = theme === "dark" ? "#101010" : "#ffffff";
            c2d.lineWidth = 6;
            c2d.strokeText(text, px[i], py[i]);
            c2d.strokeStyle = "#101010";
            c2d.lineWidth = 3;
            c2d.strokeText(text, px[i], py[i]);
            c2d.fillStyle = TONE[pc[i]];
            c2d.fillText(text, px[i], py[i]);
          }
          c2d.globalAlpha = 1;
          hud2.write();
          if ((view[NOTE] += dt) >= 0.1) view[NOTE] = 0, notify();
        }
      };
      e.add(shell);
      shell.read(e);
      p[
        4
        /* SX */
      ] = scrollX;
      p[
        5
        /* SY */
      ] = scrollY;
      p[
        0
        /* P_X */
      ] = innerWidth / 2;
      p[
        1
        /* P_Y */
      ] = innerHeight * 0.65;
      board.refresh();
      game.reset();
      return { engine: e, life, host, ui, view: hud2, stats: stats2 };
    } catch (err) {
      built?.destroy();
      life.abort();
      host.remove();
      throw err;
    }
  }
  function teardown() {
    run?.life.abort();
    run?.engine.destroy();
    run?.host.remove();
    run = null;
  }
  function start() {
    if (destroyed) throw new Error("This game instance was destroyed. Create another instance.");
    teardown();
    notice = "";
    try {
      run = begin();
      status = "running";
      const go2 = () => status === "running" && run?.engine.start();
      run.view.begin ? run.view.begin(go2) : go2();
      run.view.sync();
      run.view.write();
      toast(run.view.msg, matchMedia("(pointer: coarse)").matches ? def.touchHint ?? def.hint : def.hint, 4200);
      emit("start");
    } catch (err) {
      teardown();
      status = "idle";
      options.onError?.(err);
      throw err;
    }
    notify();
    return getSnapshot();
  }
  function pause() {
    if (status === "running") flow("pause");
  }
  function resume() {
    if (status === "paused" && !document.hidden) flow("resume");
  }
  const flow = (to) => run && (run.view.ask ? run.view.ask(to) : go(to));
  function go(to) {
    if (to === "restart") return void start();
    if (to === "exit") return stop();
    if (!run || status !== "running" && status !== "paused") return;
    const p = to === "pause";
    if (p || to === "resume") {
      status = p ? "paused" : "running";
      run.engine[p ? "stop" : "start"]();
      run.view.sync();
      notify();
      return emit(to);
    }
    const won = to === "won";
    last = run.stats();
    status = won ? "won" : "gameover";
    notice = won ? "Page cleared and restored. Restart for another run." : "Run ended. Page restored. Restart for another run.";
    const { host, ui, view } = run;
    view.hold?.();
    run.engine.destroy();
    const ended = last;
    run = { ...run, stats: () => ended };
    ui.querySelector("canvas")?.remove();
    view.end(won, notice, ended);
    emit(status, { score: last.score });
    notify();
    host.dataset.over = status;
  }
  function stop() {
    if (destroyed) return;
    if (run && (status === "running" || status === "paused")) last = run.stats();
    teardown();
    status = "idle";
    notice = "";
    notify();
    emit("recall");
  }
  function destroy() {
    if (destroyed) return;
    stop();
    destroyed = true;
    status = "destroyed";
    notify();
  }
  return { start, pause, resume, stop, destroy, getSnapshot };
}
export {
  CALM,
  FIRE,
  KX,
  KY,
  MODE,
  PON,
  PX,
  PY,
  TARGET_HP,
  VH,
  VW,
  arcade,
  arcadeHud,
  skirmishHud
};
