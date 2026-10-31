// Page keys check (Board UI kit, BOARD-UI.md "Page keys"): every visible in-page key is a
// `.bui-key`, and for each one a press shows (the face drops by its base: depth --py along the
// domain's shadow direction, --shadow-x/-y, BOARD-UI.md 4.1) and the click lands on the key whether
// the pointer is on the face's centre, just under its top edge (which the dropping face leaves) or
// on the base beside / below it. Keyboard Enter shows the press (.down) too.
// Clicks are caught at the window and cancelled, so nothing navigates and no handler runs.
// Shared by the site tests; `page` is a Playwright page already loaded.
import assert from "node:assert/strict";

/** Kit key families an in-page <a> or <button> may wear; each must also be a .bui-key. */
const FAMILIES = ".bui-arcade, .bui-icon-key, .bui-sticker-key";

/** The key's base offset in px, [x, y]: its depth (--py) along the shadow direction (--bx, --by in
 *  the kit; a kit without the tokens falls back to straight below). Read off a probe placed by it
 *  (custom properties compute as text). */
const baseOf = (key) => key.evaluate((e) => {
  const probe = e.appendChild(document.createElement("i"));
  probe.style.cssText = "position:absolute;left:var(--bx,0px);top:var(--by,var(--py));margin:0;padding:0;border:0";
  const s = getComputedStyle(probe), xy = [parseFloat(s.left), parseFloat(s.top)];
  probe.remove();
  return xy;
});
/** The face's resting offset (a locked key rests dropped), [x, y]. */
const restOf = (key) => key.evaluate((e) => { const m = new DOMMatrix(getComputedStyle(e).transform); return [m.m41, m.m42]; });
/** A point on the base that the resting face doesn't cover: past the face's edge, half the depth out. */
function onBase(box, [rx, ry], [bx, by]) {
  const l = box.x - rx, t = box.y - ry, cx = l + box.width / 2, cy = t + box.height / 2;
  return Math.abs(by) >= Math.abs(bx)
    ? [cx + bx, (by > 0 ? t + box.height : t) + by / 2]
    : [(bx > 0 ? l + box.width : l) + bx / 2, cy + by];
}
const near = ([ax, ay], [bx, by]) => Math.abs(ax - bx) < 0.5 && Math.abs(ay - by) < 0.5;

/** Wait for the key to come to rest: two frames (so a press or release has restyled and started its
 *  transitions), then until none of its transitions or animations is still running. On state, never
 *  wall time: a loaded CI runner can take longer than any fixed wait. */
const settle = (key) => key.evaluate(async (e) => {
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  await frame(); await frame();
  for (let running; (running = e.getAnimations({ subtree: true }).filter((a) => a.playState === "running")).length;) {
    await Promise.all(running.map((a) => a.finished.catch(() => {})));
    await frame();
  }
});

/** Number the page's enabled, visible, pressable keys (a decorative key with pointer-events: none
 *  inside a card link is the card's, not a key) and catch every click (recording which key it hit).
 *  Taps: keys that act on touchstart (the kit's press()) cancel the click, so their touchstart is
 *  held back here and the tap's native click shows where it landed. */
async function prepare(page, skip, taps = false) {
  await page.evaluate((taps) => {
    window.__hits = [];
    if (taps) addEventListener("touchstart", (e) => e.stopImmediatePropagation(), { capture: true, passive: true });
    addEventListener("click", (e) => {
      window.__hits.push(e.target.closest?.(".bui-key")?.dataset.keyId ?? null);
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }, taps);
  return page.evaluate((skip) => {
    let n = 0;
    return [...document.querySelectorAll(".bui-key")]
      .filter((e) => !(skip && e.closest(skip)) && e.getClientRects().length && !e.matches(":disabled, [aria-disabled='true']") && getComputedStyle(e).pointerEvents !== "none")
      .map((e) => (e.dataset.keyId = String(n++)));
  }, skip);
}

export async function checkKeys(page, label, { skip = "" } = {}) {
  const stray = await page.evaluate(([families, skip]) =>
    [...document.querySelectorAll(`:is(a, button):is(${families}):not(.bui-key)`)]
      .filter((e) => !(skip && e.closest(skip)) && e.getClientRects().length)
      .map((e) => e.outerHTML.slice(0, 90)), [FAMILIES, skip]);
  assert.deepEqual(stray, [], `${label}: in-page keys without .bui-key`);
  const ids = await prepare(page, skip);
  assert.ok(ids.length > 0, `${label}: no keys found`);
  for (const id of ids) {
    const key = page.locator(`[data-key-id="${id}"]`);
    await key.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    const box = await key.boundingBox();
    const base = await baseOf(key);
    const name = `${label}: key ${JSON.stringify((await key.textContent()).trim().slice(0, 30) || (await key.getAttribute("aria-label")))}`;
    assert.ok(Math.hypot(...base) > 0, `${name} has a base`);
    const x = box.x + box.width / 2;
    // A locked key (aria-pressed) rests dropped: its base is under the face, so measure from rest.
    await page.mouse.move(2, 2);
    await settle(key);
    const rest = await restOf(key);
    for (const [where, px, py] of [["centre", x, box.y + box.height / 2], ["top edge", x, box.y + 1], ["base", ...onBase(box, rest, base)]]) {
      await page.mouse.move(2, 2);
      await page.mouse.move(px, py);
      await page.mouse.down();
      await settle(key);
      const t = await restOf(key);
      assert.ok(near(t, base), `${name} at the ${where}: the face drops by its base (${t} vs ${base})`);
      await page.mouse.up();
      const hits = await page.evaluate(() => window.__hits.splice(0));
      assert.deepEqual(hits, [id], `${name} at the ${where}: the click lands on the key`);
    }
    await page.mouse.move(2, 2);
    await key.focus();
    await page.keyboard.down("Enter");
    assert.ok(await key.evaluate((e) => e.classList.contains("down")), `${name}: Enter shows the press`);
    await page.keyboard.up("Enter");
    assert.ok(!(await key.evaluate((e) => e.classList.contains("down"))), `${name}: release lifts it`);
    await page.evaluate(() => window.__hits.splice(0));
  }
  return ids.length;
}

/** Phones: a tap on the base (below the face) still clicks the key. */
export async function checkTaps(page, label, { skip = "" } = {}) {
  const ids = await prepare(page, skip, true);
  for (const id of ids) {
    const key = page.locator(`[data-key-id="${id}"]`);
    await key.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    const box = await key.boundingBox();
    const base = await baseOf(key);
    await settle(key);
    await page.touchscreen.tap(...onBase(box, await restOf(key), base));
    const hits = await page.evaluate(() => window.__hits.splice(0));
    assert.deepEqual(hits, [id], `${label}: a tap on the base of key ${id} clicks it`);
  }
  return ids.length;
}
