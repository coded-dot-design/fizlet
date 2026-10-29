// The browser tests' Chromium: CHROMIUM_PATH wins, then the cloud image's, then Playwright's default.
import test from "node:test";
import assert from "node:assert/strict";
import { chromiumPath, CLOUD_CHROMIUM } from "./chromium.mjs";

test("chromiumPath: env, then the cloud image, then Playwright's default", () => {
  assert.equal(chromiumPath({ CHROMIUM_PATH: "/x/chrome" }, () => true), "/x/chrome");
  assert.equal(chromiumPath({}, (p) => p === CLOUD_CHROMIUM), CLOUD_CHROMIUM);
  assert.equal(chromiumPath({}, () => false), undefined);
});
