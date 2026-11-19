// The browser engines a cross-engine test runs in: BROWSERS=chromium,webkit (the default) or one of
// them. Chromium resolves through tests/chromium.mjs; WebKit is Playwright's own build
// (`npx playwright install --with-deps webkit`, as CI's webkit job does). Playwright's WebKit on
// Linux is WebKit, not iOS Safari: it catches engine differences (pointer capture, layout, gesture
// events), not iOS's touch delivery. Real-device checks stay manual.
import { chromium, webkit } from "playwright";
import { launchOptions } from "./chromium.mjs";

const TYPES = { chromium, webkit };

/** The engine names to run, from BROWSERS (comma list); unknown names throw. */
export function engines(env = process.env) {
  const names = (env.BROWSERS || "chromium,webkit").split(",").map((s) => s.trim()).filter(Boolean);
  for (const n of names) if (!TYPES[n]) throw new Error(`BROWSERS: no engine ${n} (chromium, webkit)`);
  return names;
}

/** Runs `fn(browser, name)` once per engine, closing each browser after; exit 1 if any failed. */
export async function eachEngine(label, fn) {
  let failed = 0;
  for (const name of engines()) {
    const browser = await TYPES[name].launch(name === "chromium" ? launchOptions() : {});
    try {
      await fn(browser, name);
      console.log(`ok   ${label} (${name} ${browser.version()})`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${label} (${name}):`, err?.stack ?? err);
    } finally {
      await browser.close();
    }
  }
  if (failed) process.exit(1);
}

/** A phone context: 390 x 844, touch, mobile (WebKit takes isMobile too). */
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
