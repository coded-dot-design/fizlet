// The FILET factory's controller: inline on the page (minified by build.mjs), so the hero plays
// from first paint and under reduced motion, where the live scene never loads. It owns the game's
// state (which bricks are on the belt, the sign, the cartridge, the counters, mute) and writes it
// as page state. When the live scene (scene.ts) is up it only tells it what changed, as `fac`
// events on the hero, and waits for the scene's `fac-done` before showing a cartridge; the scene's
// own writes (motion) go through its ledger, so its Recall leaves this state alone.
//
// The puzzle: the machine takes four things, the kernel (every game runs on it), any two other
// bricks and the Z that fell off the sign. Then FILET is FIZLET again and a cartridge comes out.
{
  const h = document.querySelector(".fac-hero");
  if (h) {
    const $ = (s) => h.querySelector(s), $$ = (s) => [...h.querySelectorAll(s)];
    const tiles = $$(".fac-b"), go = $(".fac-go"), cart = $(".fac-cart"), say = $(".fac-say"), mute = $(".fac-mute");
    const names = JSON.parse(h.dataset.names), N = names.length, KEY = "fizlet:factory:mute";
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let roll = Math.floor(Math.random() * N), made = 0, busy = 0, wait = 0;
    const live = () => !still.matches && h.querySelector("[data-fizlet-slot]");
    const tell = (d) => live() && h.dispatchEvent(new CustomEvent("fac", { detail: d }));
    const speak = (t) => { say.textContent = ""; say.textContent = t; };
    const belt = () => tiles.filter((t) => t.dataset.at === "belt");
    const count = () => { const n = belt().length; $(".fac-n").textContent = n + "/4"; h.dataset.n = String(n); };
    const mid = (t) => { const r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

    // Scatter: every brick on the floor takes a new spot (a shuffle of the floor's spots).
    const scatter = () => {
      const floor = tiles.filter((t) => t.dataset.at === "floor"), m = mid($(".fac-machine"));
      const was = floor.map((t) => (t.dataset.from ? (delete t.dataset.from, m) : mid(t)));
      const spots = floor.map((t) => +t.dataset.s);
      for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
      floor.forEach((t, i) => (t.dataset.s = spots[i]));
      h.classList.add("fac-down");
      tell({ t: "scatter", tiles: floor, from: was });
    };

    // Send one brick to the belt (from a tap, a key, a drop or BUILD A GAME).
    const send = (t) => {
      if (t.dataset.at !== "floor" || busy) return;
      const on = belt(), id = t.dataset.id, kernel = on.some((x) => x.dataset.id === "kernel"), z = on.some((x) => x.dataset.id === "z");
      const others = on.length - kernel - z;
      if (id !== "kernel" && id !== "z" && others >= 2) {
        speak(`The machine has its two bricks. It still needs ${kernel ? "" : "the kernel"}${!kernel && !z ? " and " : ""}${z ? "" : "the Z"}.`);
        return tell({ t: "nope", tile: t });
      }
      const from = mid(t);
      t.dataset.at = "belt";
      t.style.setProperty("--k", on.length);
      t.setAttribute("aria-disabled", "true");
      count();
      tell({ t: "load", tile: t, from });
      const left = 3 - on.length;
      speak(left ? `${t.dataset.name} on the belt. ${left} to go.` : `${t.dataset.name} on the belt. The machine runs.`);
      if (!left) build();
    };

    // The run: with the live scene, wait for its explosion (or 6 s, if it never answers).
    const build = () => {
      busy = 1;
      h.classList.add("fac-run");
      const name = names[roll++ % N];
      const done = () => {
        if (!busy) return;
        busy = 0;
        clearTimeout(wait);
        h.removeEventListener("fac-done", done);
        h.classList.remove("fac-run");
        h.classList.add("fac-made");
        for (const t of belt()) t.dataset.at = "in";
        cart.querySelector("strong").textContent = name[0];
        cart.querySelector("small").textContent = `${String(++made).padStart(2, "0")} / ${name[1] ? "COMING SOON" : "FACTORY ROLL"}`;
        cart.querySelector("em").textContent = name[2] || "A factory roll: not a real game (yet).";
        cart.dataset.soon = name[1] ? "1" : "0";
        cart.dataset.tone = String(made % 5);
        cart.hidden = false;
        cart.setAttribute("aria-label", `Cartridge: ${name[0]}${name[1] ? ", coming soon" : ", a factory roll"}. Press for another.`);
        $(".fac-m").textContent = String(made).padStart(3, "0");
        count();
        speak(`Cartridge made: ${name[0]}. ${name[1] ? "Coming soon." : "A factory roll, not a real game."}`);
      };
      if (live()) {
        h.addEventListener("fac-done", done);
        wait = setTimeout(done, 6000);
        tell({ t: "build", again: h.classList.contains("fac-made") });
      } else done();
    };

    // Shake it: a fresh floor. After a cartridge, every brick comes back out and the Z falls off again.
    const shake = () => {
      if (busy) return;
      if (h.classList.contains("fac-made")) {
        const back = tiles.filter((t) => t.dataset.at !== "floor");
        for (const t of back) { t.dataset.at = "floor"; t.dataset.from = "m"; t.removeAttribute("aria-disabled"); t.style.removeProperty("--k"); }
        h.classList.remove("fac-made");
        cart.hidden = true;
        count();
        speak("Shaken: every brick is back on the floor, and the Z fell off the sign again.");
      } else speak("Shaken: the bricks on the floor moved.");
      scatter();
    };

    // BUILD A GAME: one step of the recipe a press (kernel, a brick, a brick, the Z); a new roll once made.
    go.addEventListener("click", () => {
      if (busy) return;
      if (h.classList.contains("fac-made")) return build();
      const on = belt(), has = (id) => on.some((x) => x.dataset.id === id);
      const floor = tiles.filter((t) => t.dataset.at === "floor");
      const pick = !has("kernel") ? floor.find((t) => t.dataset.id === "kernel")
        : on.length - 1 - has("z") < 2 ? floor.find((t) => t.dataset.id !== "z") : floor.find((t) => t.dataset.id === "z");
      if (pick) send(pick);
    });
    cart.addEventListener("click", () => busy || build());
    $(".fac-shake").addEventListener("click", shake);

    // Tap or key (a button's click), or drag onto the belt or the machine.
    for (const t of tiles) {
      let p = null;
      t.addEventListener("click", () => { if (!p || !p.moved) send(t); p = null; });
      t.addEventListener("pointerdown", (e) => {
        if (t.dataset.at !== "floor" || !e.isPrimary) return;
        p = { x: e.clientX, y: e.clientY, moved: 0 };
        t.setPointerCapture(e.pointerId);
      });
      t.addEventListener("pointermove", (e) => {
        if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (!p.moved && dx * dx + dy * dy < 64) return;
        p.moved = 1;
        t.classList.add("fac-drag");
        t.style.translate = `${dx}px ${dy}px`;
      });
      const drop = (e) => {
        if (!p || !p.moved) return;
        t.classList.remove("fac-drag");
        t.style.translate = "";
        const r = $(".fac-lane").getBoundingClientRect(), m = $(".fac-machine").getBoundingClientRect();
        const inside = (b) => e.clientX >= b.left - 16 && e.clientX <= b.right + 16 && e.clientY >= b.top - 24 && e.clientY <= b.bottom + 16;
        if (e.type === "pointerup" && (inside(r) || inside(m))) send(t);
        setTimeout(() => (p = null));
      };
      t.addEventListener("pointerup", drop);
      t.addEventListener("pointercancel", drop);
    }

    // Mute: the choice is kept (localStorage, when the browser allows it).
    let off = false;
    try { off = localStorage.getItem(KEY) === "1"; } catch {}
    const setMute = (v) => {
      off = v;
      mute.setAttribute("aria-pressed", String(v));
      mute.setAttribute("aria-label", v ? "Sound off: turn it on" : "Sound on: mute");
      h.dataset.mute = v ? "1" : "0";
      try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
    };
    setMute(off);
    mute.addEventListener("click", () => { setMute(!off); tell({ t: "mute" }); });

    // The scene says it is up: the stack gets knocked over. Reduced motion: scattered from the start.
    h.addEventListener("fac-ready", () => h.classList.contains("fac-down") || scatter());
    if (still.matches) h.classList.add("fac-down");
    count();
  }
}
