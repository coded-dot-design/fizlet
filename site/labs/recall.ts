// Lab: "Recall gives the page back." The real Fizlet ledger, live. The sentence is the page: each
// letter is a Text node (no element wrappers; the engine's own ledger splits it on mount and joins
// it back on destroy). FIRE writes a 0 or 1 into one letter through a second Ledger, the game's
// ownership ledger; APP EDIT is "your app" writing a hit letter itself; RECALL is that ledger's
// restore(): it puts back only what is still the game's, and your app's edit wins. Recall with
// nothing owned reloads the sentence (the other way a page comes back).
import { Ledger } from "../../src/kernel/index";
import { $, kf, key, labEngine, pad2, textOf, type Lab, type LabOptions } from "./lab";

export const RECALL_CAP = 6;
const SENTENCE = "Hello, world. Same page, different rules.";

export const recallFigure = (poster = false) =>
  `<figure class="lab-stage recall fzl" data-fzl="recall" aria-label="A real sentence in a text node. Fire turns letters into digits and logs them; App edit changes one; Recall restores only the game's own edits.">` +
  `<p class="victim" data-victim>${SENTENCE}</p>` +
  `<ol class="lab-ledger" data-ledger aria-label="Ownership ledger"></ol>` +
  `<div class="lab-keys">${key("data-hit", "FIRE", poster)}${key("data-app-edit", "APP EDIT", poster)}${key("data-recall", "RECALL", poster, "lab-key primary-key")}<span class="lab-readout" data-owned>OWNED 0</span></div></figure>`;

// Commands from the keys, run in the next step.
const FIRE = 1, EDIT = 2, RECALL = 3;
// A ledger row: a game hit, one your app took over, or the reload line.
const GAME = 0, APP = 1, RELOAD = 2;
const SHAKE = [0, -3, 3, 0];
const isLetter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

type Highlights = { set(name: string, h: unknown): void; delete(name: string): void };

export function recall(figure: HTMLElement, o: LabOptions = {}): Lab {
  const victim = $(figure, "[data-victim]"), list = $(figure, "[data-ledger]");
  const fire = $(figure, "[data-hit]"), edit = $(figure, "[data-app-edit]"), back = $(figure, "[data-recall]");
  const owned = textOf($(figure, "[data-owned]"));
  const lab = labEngine(figure, 4, o, () => {});
  const { engine } = lab, L = engine.ledger, game = new Ledger();
  // The page: one Text node per letter, split through the engine's ledger (destroy joins them).
  victim.normalize();
  const first = victim.firstChild as Text, original = first.data, N = original.length;
  const letters: Text[] = [];
  L.text(first, "");
  for (const c of original) letters.push(victim.appendChild(L.add(document.createTextNode(c))));
  // Rows, one <li> each, made once (one per letter, plus the reload line); hidden until used.
  const rows: { li: HTMLLIElement; b: Text; t: Text }[] = [];
  for (let i = 0; i <= N; i++) {
    const li = L.add(document.createElement("li")), b = document.createElement("b");
    li.hidden = true;
    li.append(b, "");
    b.append("");
    list.append(li);
    rows.push({ li, b: b.firstChild as Text, t: li.lastChild as Text });
  }
  // State. Hits (the ownership ledger's entries, in order): letter index, what was there, what
  // the game wrote, game or app. Rows on show: kind, letter index, struck through, kept.
  const at = new Int16Array(N), was = new Uint16Array(N), wrote = new Uint16Array(N), app = new Uint8Array(N);
  const rk = new Uint8Array(N + 1), ri = new Int16Array(N + 1), rBack = new Uint8Array(N + 1), rKept = new Uint8Array(N + 1);
  const rWas = new Uint16Array(N + 1), rWrote = new Uint16Array(N + 1);
  const taken = new Uint8Array(N), free = new Int16Array(N), cur = new Uint16Array(N);
  for (let i = 0; i < N; i++) cur[i] = original.charCodeAt(i);
  const q = new Uint8Array(16);
  // hits, rows, queued commands, cap shake (s left), dirty, (unused), restore the ownership ledger
  const s = new Float64Array([0, 0, 0, 0, 1, 0, 0]);
  const push = (c: number) => {
    if (s[2]! < q.length) q[s[2]!++] = c;
    lab.input();
  };
  fire.addEventListener("click", () => push(FIRE), { signal: engine.signal });
  edit.addEventListener("click", () => push(EDIT), { signal: engine.signal });
  back.addEventListener("click", () => push(RECALL), { signal: engine.signal });

  const mine = () => {
    let n = 0;
    for (let i = 0; i < s[0]!; i++) n += app[i] ? 0 : 1;
    return n;
  };
  const row = (kind: number, i: number, a: number, b: number) => {
    const k = s[1]!++;
    (rk[k] = kind), (ri[k] = i), (rWas[k] = a), (rWrote[k] = b), (rBack[k] = 0), (rKept[k] = 0);
    return k;
  };
  // Drop the struck-through rows of the last Recall before the next action.
  const tidy = () => {
    let w = 0;
    for (let k = 0; k < s[1]!; k++) {
      if (rBack[k]) continue;
      (rk[w] = rk[k]!), (ri[w] = ri[k]!), (rWas[w] = rWas[k]!), (rWrote[w] = rWrote[k]!), (rBack[w] = 0), (rKept[w] = 0);
      w++;
    }
    s[1] = w;
  };
  const rowOf = (i: number) => {
    for (let k = s[1]!; k--; ) if (ri[k] === i && rk[k] !== RELOAD) return k;
    return -1;
  };
  // What the game and the app do happen here, in the step, as state; render writes them.
  const pending = new Int16Array(N).fill(-1); // letter → char code to write (game) or -2 (app's *)
  const run = (c: number) => {
    if (c === FIRE) {
      tidy();
      if (mine() >= RECALL_CAP) return void (s[3] = 0.24);
      let n = 0;
      for (let i = 0; i < N; i++) if (!taken[i] && isLetter(cur[i]!)) free[n++] = i;
      if (!n) return;
      const i = free[Math.floor(engine.random() * n)]!, h = s[0]!++;
      (at[h] = i), (was[h] = cur[i]!), (wrote[h] = engine.random() < 0.5 ? 48 : 49), (app[h] = 0), (taken[i] = 1);
      pending[i] = cur[i] = wrote[h]!;
      row(GAME, i, was[h]!, wrote[h]!);
    } else if (c === EDIT) {
      for (let h = s[0]!; h--; )
        if (!app[h]) {
          app[h] = 1;
          pending[at[h]!] = -2;
          cur[at[h]!] = 42;
          const k = rowOf(at[h]!);
          if (k >= 0) rk[k] = APP;
          return;
        }
    } else if (c === RECALL) {
      tidy();
      if (!s[0]) {
        // Nothing left to recall: the page reloads, which is the other way to get it back.
        for (let i = 0; i < N; i++) (pending[i] = -3), (cur[i] = original.charCodeAt(i));
        rBack[row(RELOAD, -1, 0, 0)] = 1;
        return;
      }
      for (let h = 0; h < s[0]!; h++) {
        const k = rowOf(at[h]!);
        if (k >= 0) (rBack[k] = 1), (rKept[k] = app[h]!);
        if (!app[h]) cur[at[h]!] = was[h]!;
        taken[at[h]!] = 0;
      }
      s[0] = 0;
      s[6] = 1; // render: the ownership ledger restores
    }
  };

  const highlights = typeof CSS === "object" && "highlights" in CSS ? (CSS as unknown as { highlights: Highlights }).highlights : null;
  const paint = () => {
    if (!highlights || typeof Highlight === "undefined") return;
    const mark = (isApp: number) => {
      const h = new Highlight();
      for (let i = 0; i < s[0]!; i++)
        if (app[i] === isApp) {
          const r = new Range();
          r.selectNodeContents(letters[at[i]!]!);
          h.add(r);
        }
      return h;
    };
    highlights.set("lab-owned", mark(0));
    highlights.set("lab-app", mark(1));
  };
  engine.signal.addEventListener("abort", () => (highlights?.delete("lab-owned"), highlights?.delete("lab-app")), { once: true });

  engine.add({
    step(e) {
      if (s[3]! > 0) (s[3]! -= e.dt), e.busy();
      for (let i = 0; i < s[2]!; i++) run(q[i]!), (s[4] = 1);
      s[2] = 0;
    },
    render() {
      L.style(owned.parentElement!, "translate", s[3]! > 0 ? `${kf(SHAKE, 1 - s[3]! / 0.24)}px 0` : "0px 0px");
      if (!s[4]) return;
      s[4] = 0;
      for (let i = 0; i < N; i++) {
        const p = pending[i]!;
        if (p === -1) continue;
        pending[i] = -1;
        if (p >= 0) game.text(letters[i]!, String.fromCharCode(p)); // the game: through its ledger
        else if (p === -2) letters[i]!.data = "*"; // your app: a plain write the game didn't make
        else letters[i]!.data = original[i]!; // the reload
      }
      if (s[6]) (s[6] = 0), game.restore();
      for (let k = 0; k <= N; k++) {
        const r = rows[k]!, used = k < s[1]!;
        L.attr(r.li, "hidden", used ? null : "");
        if (!used) continue;
        const kind = rk[k]!, cls = kind === RELOAD ? "back" : (kind === APP ? "app" : "") + (rBack[k] ? (kind === APP ? " back" : "back") : "");
        L.attr(r.li, "class", cls || null);
        L.text(r.b, kind === RELOAD ? "↻" : `#${pad2(ri[k]!)}`);
        L.text(r.t, kind === RELOAD ? " page reloaded"
          : kind === APP ? ` “${String.fromCharCode(rWrote[k]!)}” → * · YOUR APP${rKept[k] ? " · KEPT" : ""}`
          : ` “${String.fromCharCode(rWas[k]!)}” → ${String.fromCharCode(rWrote[k]!)} · GAME`);
      }
      const m = mine(), a = s[0]! - m;
      L.text(owned, `OWNED ${m}${a ? ` · APP ${a}` : ""}${m >= RECALL_CAP ? " · CAP" : ""}`);
      L.attr(edit, "disabled", m ? null : "");
      L.attr(back, "disabled", !s[0] && !edited() ? "" : null);
      paint();
    },
  });
  const edited = () => {
    for (let i = 0; i < N; i++) if (cur[i] !== original.charCodeAt(i)) return true;
    return false;
  };
  return { engine, entities: () => 0, destroy: () => engine.destroy() };
}
