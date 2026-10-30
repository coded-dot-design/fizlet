// Page cost: what a page's interactions (heroes, diagrams, the demo) cost the page they sit on.
// Each page is loaded twice, as built ("live") and with only its posters ("poster": every module
// script removed except the site chrome), at desktop and at mobile (4x CPU). The gate is the
// difference between the two, against the page budgets (budgets: page-budgets.json).
//
// Not flaky by design:
//   - every wait counts animation frames, never wall time (`frames(page, n)`);
//   - each measure is the median over its taps or window inside a run, then the best of N runs
//     (noise only ever adds cost, so the best run is the closest to the page's real cost);
//   - the tap latency is read in the page (input timestamp to the next frame) at sub-ms
//     resolution, because Event Timing reports nothing under 16 ms and rounds to 8 ms.

/** The poster-only page: drop every `<script type="module">` (inline or src) not listed in `keep`. */
export function posterOnly(html, keep = []) {
  return html.replace(/<script\b[^>]*\btype="module"[^>]*>[\s\S]*?<\/script>/g, (tag) => {
    const src = /\bsrc="([^"]*)"/.exec(tag)?.[1];
    return src != null && keep.includes(src) ? tag : "";
  });
}

export const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const best = (xs) => (xs.length ? Math.min(...xs) : NaN);

/** The exceptions for one page and profile from page-budgets.json: { [measure]: { task, ceiling } }. */
export const exceptionsFor = (cfg, page, profile) =>
  Object.fromEntries((cfg.exceptions ?? []).filter((x) => x.page === page && x.profile === profile).map((x) => [x.measure, x]));

/**
 * The verdict for one page and profile. runs: [{ variant: "live"|"poster", cls, tapMs, idlePct }].
 * budget: { cls, tapMs, idlePts } (each the most the live page may add over the poster page).
 * exceptions: { [measure]: { task, ceiling } } from page-budgets.json: a named, tracked exception
 * for one measure. Over its budget it is reported (in `excepted`), not failed, until it passes
 * its ceiling (the measured level when it was written, so it can never get worse unseen). The
 * budget itself never moves.
 * Returns { live, poster, delta, over: [messages], excepted: [messages] }.
 */
export function verdict(name, runs, budget, exceptions = {}) {
  const pick = (v, k) => best(runs.filter((r) => r.variant === v).map((r) => r[k]));
  const keys = { cls: "cls", tapMs: "tapMs", idlePts: "idlePct" };
  const live = {}, poster = {}, delta = {}, over = [], excepted = [];
  for (const [b, k] of Object.entries(keys)) {
    live[b] = pick("live", k);
    poster[b] = pick("poster", k);
    // CLS is gated at its reported precision (0.000), the others at 0.1.
    const digits = b === "cls" ? 3 : 1;
    delta[b] = +(live[b] - poster[b]).toFixed(digits);
    if (delta[b] <= budget[b]) continue;
    const msg = `${name}: ${b} +${delta[b]} over the poster page (budget +${budget[b]})`, x = exceptions[b];
    if (x && delta[b] <= x.ceiling) excepted.push(`${msg}: exception ${x.task} (ceiling +${x.ceiling})`);
    else over.push(x ? `${msg}, and over its exception ${x.task}'s ceiling +${x.ceiling}` : msg);
  }
  return { live, poster, delta, over, excepted };
}

/** Wait `n` animation frames (frames, not wall time). */
export const frames = (page, n) => page.evaluate((n) => new Promise((r) => {
  const raf = window.__pc?.raf ?? requestAnimationFrame;
  const tick = () => (--n <= 0 ? r() : raf(tick));
  raf(tick);
}), n);

// Injected before page scripts: layout shifts, and the raw rAF (pages may wrap theirs).
const INIT = () => {
  const pc = (window.__pc = { raf: window.requestAnimationFrame.bind(window), cls: 0, taps: [] });
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) pc.cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  } catch {}
  // Tap latency: from the input's own timestamp to the start of the next frame after its handlers.
  addEventListener("pointerdown", (e) => {
    const t0 = e.timeStamp;
    pc.raf(() => pc.taps.push(performance.now() - t0));
  }, { capture: true });
};

/** One load of one page: { variant, cls, tapMs, idlePct, taps, tapTarget, errors }. */
export async function measurePage(browser, origin, pg, variant, prof, opts = {}) {
  const { settleFrames = 120, idleFrames = 180, taps = 5, tapGapFrames = 20 } = opts;
  const context = await browser.newContext({ viewport: prof.viewport, deviceScaleFactor: prof.deviceScaleFactor, isMobile: prof.isMobile, hasTouch: prof.hasTouch });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(INIT);
  const url = origin + pg.path;
  if (variant === "poster") {
    await page.route((u) => u.href === url, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: posterOnly(await res.text(), pg.keep) });
    });
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (prof.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: prof.cpu });
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await frames(page, settleFrames);

    // Idle CPU while visible, nothing touched: main-thread busy over a window of frames.
    const task = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
    const a = await task(), t0 = await page.evaluate(() => performance.now());
    await frames(page, idleFrames);
    const b = await task(), t1 = await page.evaluate(() => performance.now());
    const idlePct = (100 * (b - a) * 1000) / (t1 - t0);

    // A tap on page text outside every interaction, in the first viewport.
    const target = await page.evaluate((ex) => {
      for (const e of document.querySelectorAll("main p, main h1, main h2")) {
        if (e.closest(ex)) continue;
        const r = e.getBoundingClientRect();
        if (r.top > 0 && r.bottom < innerHeight && r.width > 40) return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2, el: e.tagName };
      }
      return null;
    }, pg.exclude);
    if (!target) throw new Error(`${pg.name}: no page text to tap in the first viewport`);
    for (let i = 0; i < taps; i++) {
      if (prof.hasTouch) await page.touchscreen.tap(target.x, target.y);
      else await page.mouse.click(target.x, target.y);
      await frames(page, tapGapFrames);
    }
    const tapList = await page.evaluate(() => window.__pc.taps.slice());
    const cls = await page.evaluate(() => window.__pc.cls);
    return { variant, cls: +cls.toFixed(4), tapMs: +median(tapList).toFixed(1), idlePct: +idlePct.toFixed(1), taps: tapList.map((t) => +t.toFixed(1)), tapTarget: target.el, errors };
  } finally {
    await context.close();
  }
}

export const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpu: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, cpu: 4 },
};
