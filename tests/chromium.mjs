// Where every browser test finds Chromium, in one place: CHROMIUM_PATH, else the cloud image's
// /opt/pw-browsers/chromium, else Playwright's own download (`npx playwright install chromium`, as CI does).
import { existsSync } from "node:fs";

export const CLOUD_CHROMIUM = "/opt/pw-browsers/chromium";

/** The Chromium to launch, or undefined for Playwright's default. */
export function chromiumPath(env = process.env, exists = existsSync) {
  if (env.CHROMIUM_PATH) return env.CHROMIUM_PATH;
  if (exists(CLOUD_CHROMIUM)) return CLOUD_CHROMIUM;
  return undefined;
}

/** `chromium.launch(launchOptions())`: the options with the resolved executable, when there is one. */
export function launchOptions(opts = {}) {
  const exe = chromiumPath();
  return exe ? { ...opts, executablePath: exe } : opts;
}
