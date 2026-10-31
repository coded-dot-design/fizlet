// GA4 + PostHog, consent first (site/analytics), against the built site (site-dist).
// 1. The build: with no PUBLIC_GA4_ID / PUBLIC_POSTHOG_KEY (CI and PR builds), no page or script
//    carries analytics code; with an id, every page carries the consent runtime exactly once.
// 2. In Chromium, on the real built home page with the runtime added (test ids, vendor hosts
//    intercepted, so nothing leaves the machine): before a choice no request to googletagmanager,
//    google-analytics or posthog and no _ga/ph_ cookie; Accept loads both (ad signals stay denied);
//    Reject loads neither and is remembered; the footer "Cookie settings" reopens the choice;
//    track() sends nothing before consent.
// 3. The legal pages and banner name only the configured tools: GA4 only (PUBLIC_GA4_ID alone) never
//    names or loads PostHog; neither id set names no analytics tool and ships no analytics code.
// Run after npm run site (it runs with npm run test:site).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { resolveAnalytics } from "../site/analytics/config.mjs";
import { analyticsSnippet } from "../site/analytics/snippet.mjs";
import { privacyPage, cookiesPage } from "../site/pages/legal.mjs";

const out = resolve("site-dist");
const VENDOR = /googletagmanager\.com|google-analytics\.com|posthog\.com/;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(html|js)$/.test(name)) files.push(path);
  }
})(out);

// 1. The build.
const built = resolveAnalytics(process.env);
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (!built.enabled) assert.doesNotMatch(text, /googletagmanager\.com\/gtag|static\/array\.js|\.siteAnalytics = \{/, `${file}: analytics code with no id set`);
  else if (file.endsWith(".html") && text.includes('class="site-foot"'))
    assert.equal(text.split(".siteAnalytics = {").length - 1, 1, `${file}: consent runtime once`);
}
// The built legal pages name exactly the tools this build configured.
for (const route of ["privacy", "cookies"]) {
  const html = readFileSync(resolve(out, route, "index.html"), "utf8");
  const text = html.replace(/<script>\(function analyticsRuntime[\s\S]*?<\/script>/, ""); // the copy, not the runtime's code
  if (!built.posthogKey && built.enabled) assert.match(html, /"posthogKey":""/, `${route}: runtime has no PostHog key, so it never loads`);
  if (built.ga4Id) assert.match(text, /Google Analytics/, `${route}: names GA4 (PUBLIC_GA4_ID set)`);
  else assert.doesNotMatch(text, /Google Analytics|_ga\b/, `${route}: names GA4 with no PUBLIC_GA4_ID`);
  if (!built.posthogKey) assert.doesNotMatch(text, /posthog/i, `${route}: names PostHog with no PUBLIC_POSTHOG_KEY`);
}
console.log(`analytics build: ${built.enabled ? "on" : "off"}, ${files.length} files checked`);

// 3. Each env shape, rendered: GA4 only names no PostHog; neither names no tool and ships no code.
const legal = (cfg) => privacyPage({ base: "../", analytics: cfg }) + cookiesPage({ base: "../", analytics: cfg });
const gaOnly = resolveAnalytics({ PUBLIC_GA4_ID: "G-XXXXXXXXXX" });
assert.match(legal(gaOnly), /Google Analytics 4/);
assert.match(legal(gaOnly), /14 months/, "GA retention text stays");
assert.doesNotMatch(legal(gaOnly), /posthog/i, "GA4 only: legal pages never name PostHog");
const none = resolveAnalytics({});
assert.equal(analyticsSnippet(none, {}), "", "neither id: no analytics code");
assert.doesNotMatch(legal(none), /Google Analytics|posthog|_ga\b|fizlet:consent|data-cookie-settings/i, "neither id: no analytics named");
const both = resolveAnalytics({ PUBLIC_GA4_ID: "G-XXXXXXXXXX", PUBLIC_POSTHOG_KEY: "phc_test1234567890" });
assert.match(legal(both), /Google Analytics 4 and PostHog/);
console.log("legal pages: GA4 only names no PostHog; no ids names no analytics");

// 2. The browser.
const test = resolveAnalytics({ PUBLIC_GA4_ID: "G-XXXXXXXXXX", PUBLIC_POSTHOG_KEY: "phc_test1234567890" });
const home = readFileSync(resolve(out, "index.html"), "utf8").replace(/<script>\(function analyticsRuntime[\s\S]*?<\/script>/, "");
const withSnippet = (cfg) => home.replace("</body>", `${analyticsSnippet(cfg, { privacyUrl: "/privacy/", cookiesUrl: "/cookies/", storageKey: "fizlet:consent" })}</body>`);
let page = withSnippet(test);
const base = new URL(home.match(/<link rel="canonical" href="([^"]+)"/)[1]).pathname; // "/" or "/dom-virus/"

const browser = await chromium.launch(launchOptions());
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const hits = [];
  await ctx.route(VENDOR, (r) => {
    hits.push(r.request().url());
    return r.fulfill({ contentType: "application/javascript", body: "" });
  });
  await ctx.route("https://site.test/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === base) return r.fulfill({ contentType: "text/html", body: page });
    const file = resolve(out, "." + path.slice(base.length - 1));
    if (!file.startsWith(out)) return r.fulfill({ status: 404, body: "" });
    try {
      const type = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[file.slice(file.lastIndexOf("."))];
      return r.fulfill({ contentType: type || "application/octet-stream", body: readFileSync(statSync(file).isDirectory() ? resolve(file, "index.html") : file) });
    } catch {
      return r.fulfill({ status: 404, body: "" });
    }
  });
  const p = await ctx.newPage();
  await p.goto(`https://site.test${base}`);
  return { ctx, p, hits };
}
const trackers = async (ctx) => (await ctx.cookies()).map((c) => c.name).filter((n) => /^_ga|^ph_/.test(n));

try {
  {
    const { ctx, p, hits } = await open();
    await p.waitForSelector("[data-consent-banner]:not([hidden])");
    assert.equal(await p.isVisible("footer [data-cookie-settings]"), true, "footer Cookie settings shows with analytics on");
    await p.evaluate(() => window.siteAnalytics.track("game_start", { game: "demo" }));
    await p.waitForTimeout(400);
    assert.deepEqual(hits, [], "no vendor request before consent");
    assert.deepEqual(await trackers(ctx), [], "no _ga / ph_ cookie before consent");
    const consent = await p.evaluate(() => JSON.stringify([...window.dataLayer].find((a) => a[0] === "consent")));
    assert.match(consent, /"analytics_storage":"denied","ad_storage":"denied","ad_user_data":"denied","ad_personalization":"denied"/);
    await ctx.close();
  }
  {
    const { ctx, p, hits } = await open();
    await p.click('[data-cc="accept"]');
    await p.waitForTimeout(300);
    assert.ok(hits.some((u) => u.includes("googletagmanager.com/gtag/js?id=G-XXXXXXXXXX")), "GA4 loads after Accept");
    assert.ok(hits.some((u) => u.includes("posthog.com/static/array.js")), "PostHog loads after Accept");
    const ph = await p.evaluate(() => window.posthog._i[0][1]);
    assert.equal(ph.enable_heatmaps, false, "PostHog heatmaps off, explicitly");
    assert.equal(ph.autocapture, false, "PostHog autocapture off");
    assert.equal(ph.disable_session_recording, true, "PostHog session recording off");
    const update = await p.evaluate(() => JSON.stringify([...window.dataLayer].filter((a) => a[0] === "consent" && a[1] === "update")));
    assert.doesNotMatch(update, /ad_(storage|user_data|personalization)":"granted/, "ad signals stay denied");
    await ctx.close();
  }
  {
    const { ctx, p, hits } = await open();
    await p.click('[data-cc="reject"]');
    await p.reload();
    await p.waitForTimeout(400);
    assert.deepEqual(hits, [], "nothing loads after Reject, and it is remembered");
    assert.deepEqual(await trackers(ctx), []);
    await p.click("footer [data-cookie-settings]");
    assert.equal(await p.isVisible("[data-cc-analytics]"), true, "Cookie settings reopens the choice");
    await ctx.close();
  }
  {
    page = withSnippet(gaOnly); // PUBLIC_GA4_ID alone: the banner names GA only and Accept loads no PostHog
    const { ctx, p, hits } = await open();
    await p.waitForSelector("[data-consent-banner]:not([hidden])");
    assert.doesNotMatch(await p.textContent("[data-consent-banner]"), /posthog/i, "GA4 only: banner never names PostHog");
    await p.click('[data-cc="accept"]');
    await p.waitForTimeout(300);
    assert.ok(hits.some((u) => u.includes("googletagmanager.com/gtag/js?id=G-XXXXXXXXXX")), "GA4 loads after Accept");
    assert.ok(!hits.some((u) => u.includes("posthog")), "GA4 only: PostHog never loads");
    assert.equal(await p.evaluate(() => typeof window.posthog), "undefined");
    await ctx.close();
  }
  console.log("analytics consent: before consent 0 vendor requests; Accept loads GA4 + PostHog; Reject loads none; GA4 only loads no PostHog");
} finally {
  await browser.close();
}
