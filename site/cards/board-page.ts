// board-page card: the page is the board. A tiny page of real DOM text sits in the card; tap and the
// launcher fires a bite that flies through it, eating every letter it touches (the page's own Text
// nodes turn to 0s and 1s, found with a grid query, no layout read in the step) and bouncing off the
// page's real buttons, which take the hits. Eat most of it and the next tap brings a new paragraph;
// Recall gives every letter back.
import type { SlotMount } from "../../src/slot";
import { boardPage } from "../../src/board-page";
import { mountCard, brick, ink, faint, W, H, FLOOR } from "./frame";

const B = 4, R = 5, SPEED = 300, LX = W / 2, LY = FLOOR - 4, BOUNCES = 4, MAX_EAT = 24;
const PAGES = [
  "Fizlet reads the page you are on: every letter here is terrain, and every button is a target. Bite it.",
  "Nothing is cloned and nothing is wrapped: the bite writes a 0 or a 1 into this paragraph's own text.",
  "Recall gives every letter back exactly as it was, and a newer edit by the page always wins over the game.",
];
const CSS = `
.bc-bpw{position:absolute;inset:0;container-type:size;pointer-events:none}
.bc-bp{position:absolute;left:5%;right:5%;top:17%;display:grid;gap:.45em;color:var(--ink);font:500 clamp(8px,2.9cqw,11px)/1.45 var(--sans,system-ui,sans-serif)}
.bc-bp h3{margin:0;font:800 .9em/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;color:var(--muted)}
.bc-bp p{margin:0;text-wrap:pretty}
.bc-bp div{display:flex;gap:.7em}
.bc-bp button{font:800 .82em/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;padding:.5em .9em;color:#07060f;background:var(--tone);border:2px solid #07060f;border-radius:4px;box-shadow:0 3px 0 #07060f;transition:none}
.bc-bp button.hit{background:#fff;translate:0 2px;box-shadow:0 1px 0 #07060f}`;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const wrap = document.createElement("div"), page = document.createElement("div");
  wrap.className = "bc-bpw";
  page.className = "bc-bp";
  wrap.append(page);
  page.innerHTML = `<style>${CSS}</style><h3>A PAGE</h3><p>${PAGES[0]}</p><div><button type="button" tabindex="-1">SIGN UP</button><button type="button" tabindex="-1">BUY NOW</button></div>`;
  // Under the canvas: the bites are drawn over the text they eat.
  card.stage.insertBefore(wrap, card.c);
  const para = page.querySelector("p")!, buttons = [...page.querySelectorAll("button")];
  const board = boardPage(card.e, { root: page, text: "p", still: Infinity });
  // Bites: x, y, vx, vy (drawing units), bounces left; alive.
  const bx = new Float64Array(B), by = new Float64Array(B), bvx = new Float64Array(B), bvy = new Float64Array(B), bl = new Float64Array(B);
  const on = new Uint8Array(B);
  // The canvas's top left in viewport px (where board-page's glyphs live), kept outside the loop.
  const org = new Float64Array(2);
  const where = () => {
    const r = card.c.getBoundingClientRect();
    org[0] = r.left;
    org[1] = r.top;
  };
  where();
  addEventListener("scroll", where, { passive: true, capture: true, signal: card.e.signal });
  addEventListener("resize", where, { passive: true, signal: card.e.signal });
  const q = new Float64Array(3), found = new Int32Array(MAX_EAT);
  // eaten, hits, next page, button flash (2), button drawn state (2), drew a moving frame, recoil
  const s = new Float64Array([0, 0, 1, 0, 0, 0, 0, 0, 0]);

  card.e.add({
    step(e, dt) {
      let busy = 0;
      const k = card.px[1]!;
      for (let i = 0; i < B; i++) {
        if (!on[i]) continue;
        busy = 1;
        bx[i] = bx[i]! + bvx[i]! * dt;
        by[i] = by[i]! + bvy[i]! * dt;
        // Walls: the card's sides and top bounce; the floor takes a spent bite.
        if (bx[i]! < R || bx[i]! > W - R) (bvx[i] = -bvx[i]!), (bx[i] = bx[i]! < R ? R : W - R), (bl[i] = bl[i]! - 1);
        if (by[i]! < R) (bvy[i] = -bvy[i]!), (by[i] = R), (bl[i] = bl[i]! - 1);
        if (by[i]! > H + R || bl[i]! < 0) {
          on[i] = 0;
          continue;
        }
        // The bite: every unspent letter under it, from board-page's grid (viewport px).
        q[0] = org[0]! + bx[i]! * k;
        q[1] = org[1]! + by[i]! * k;
        q[2] = R * k;
        const n = board.nearAt(q, 0, found);
        for (let j = 0; j < n; j++) if (board.consume(found[j]!, "binary")) s[0] = s[0]! + 1;
        // The page's buttons: a target hit takes 25 hp and sends the bite back the way it came.
        for (let t = 0; t < board.targets.length; t++) {
          const g = board.targets[t]!;
          if (g.w === 0) continue;
          const tx = (g.x - org[0]!) / k, ty = (g.y - org[1]!) / k, tw = g.w / k, th = g.h / k;
          if (bx[i]! + R > tx && bx[i]! - R < tx + tw && by[i]! + R > ty && by[i]! - R < ty + th) {
            g.hp = g.hp > 25 ? g.hp - 25 : 100;
            s[1] = s[1]! + 1;
            if (t < 2) s[3 + t] = 0.18;
            // Out along the shallow side.
            const ox = Math.min(bx[i]! + R - tx, tx + tw - bx[i]! + R), oy = Math.min(by[i]! + R - ty, ty + th - by[i]! + R);
            if (ox < oy) (bvx[i] = -bvx[i]!), (bx[i] = bx[i]! < tx + tw / 2 ? tx - R : tx + tw + R);
            else (bvy[i] = -bvy[i]!), (by[i] = by[i]! < ty + th / 2 ? ty - R : ty + th + R);
            bl[i] = bl[i]! - 1;
          }
        }
      }
      for (let t = 3; t < 5; t++) if (s[t]! > 0) (s[t] = Math.max(0, s[t]! - dt)), (busy = 1);
      if (s[8]! > 0) (s[8] = Math.max(0, s[8]! - dt * 4)), (busy = 1);
      if (busy) e.busy();
    },
    render() {
      // The buttons' pressed face: a class flipped only when it changes.
      for (let t = 0; t < 2; t++) {
        const lit = s[3 + t]! > 0 ? 1 : 0;
        if (lit !== s[5 + t]) (s[5 + t] = lit), buttons[t]!.classList.toggle("hit", lit === 1);
      }
      let moving = card.dirty[0]! || s[8]! > 0 ? 1 : 0;
      for (let i = 0; i < B; i++) moving |= on[i]!;
      if (!moving && !s[7]) return;
      s[7] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = faint(theme);
      ctx.fillRect(0, FLOOR, W, 2);
      for (let i = 0; i < B; i++) {
        if (!on[i]) continue;
        ctx.fillStyle = "#07060f";
        ctx.fillRect(bx[i]! - R - 1, by[i]! - R - 1, R * 2 + 2, R * 2 + 4);
        ctx.fillStyle = card.tone;
        ctx.fillRect(bx[i]! - R, by[i]! - R, R * 2, R * 2);
      }
      // The launcher (it kicks back on a shot) and the name brick on the floor.
      brick(card, LX - 14, LY - 10 + s[8]! * 4, 28, 12, ink(theme), "", s[8]! * 0.5, 2);
      brick(card, 8, FLOOR + 4, 112, 12, card.tone, `${card.tag} ${card.kb}`, 0, 1);
    },
  });
  return {
    tap(x, y) {
      // Most of the page eaten and nothing in flight: the next paragraph (a page edit; board-page rescans).
      const count = board.glyphs.count;
      if (count && s[0]! >= count * 0.7 && !on.includes(1)) {
        para.textContent = PAGES[s[2]! % PAGES.length]!;
        s[2] = s[2]! + 1;
        s[0] = 0;
        board.refresh();
        return;
      }
      const i = on.indexOf(0);
      if (i < 0) return;
      const dx = x - LX, dy = Math.min(-8, y - (LY - 10)), d = Math.sqrt(dx * dx + dy * dy);
      on[i] = 1;
      bx[i] = LX;
      by[i] = LY - 12;
      bvx[i] = (dx / d) * SPEED;
      bvy[i] = (dy / d) * SPEED;
      bl[i] = BOUNCES;
      s[8] = 1;
    },
    read: () => `ATE ${s[0]} · HIT ${s[1]}`,
  };
});
export default mount;
