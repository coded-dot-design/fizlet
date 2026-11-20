// Make one's runtime, in a browser: the snippet make/make.js makes must be the legacy one, byte for
// byte. On the built site it remakes the default prompt on load: that must equal the snippet the
// legacy build made (src/data/legacy/pages/make.json, served as make/default.snippet.txt). Given the
// legacy site's URL too, every prompt below is made on both sites and the snippets, sizes, recipe
// lines and download names must match exactly.
//   node scripts/make-check.mjs dist [legacyUrl]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { serve } from "./serve.mjs";

const [root = "dist", legacy] = process.argv.slice(2);
const DATA = JSON.parse(readFileSync("src/data/legacy/pages/make.json", "utf8"));
const PROMPTS = [DATA.form.input.value, ...DATA.form.tries, "purple drip trail where the mouse goes", "slow gold snow settles on every heading", "zzz qqq"];
const server = await serve(root);
const here = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const fail = [];

/** Open /make/ (optionally with ?p=), wait for the runtime to finish, and read what it made. */
async function made(base, prompt) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => fail.push(`${base}: ${e.message}`));
  await page.goto(`${base}make/${prompt ? `?p=${encodeURIComponent(prompt)}` : ""}`, { waitUntil: "load" });
  await page.waitForFunction(() => /^Made /.test(document.querySelector("[data-status]").textContent) && !!document.querySelector("[data-stage] iframe"), null, { timeout: 15000 });
  const out = await page.evaluate(async () => {
    const dl = document.querySelector("[data-download]");
    return {
      snippet: document.querySelector("[data-code]").value,
      download: await (await fetch(dl.href)).text(),
      file: dl.download,
      size: document.querySelector("[data-snippet-size]").textContent,
      recipe: document.querySelector("[data-recipe]").textContent,
      matched: document.querySelector("[data-matched]").innerHTML,
      miss: document.querySelector("[data-miss]").innerHTML,
      status: document.querySelector("[data-status]").textContent,
    };
  });
  await page.close();
  return out;
}

const first = await made(here);
const built = DATA.out.code.text;
if (first.snippet !== built) fail.push("the default prompt, remade in the browser, is not the snippet the legacy build made");
if (first.download !== first.snippet) fail.push("the download is not the snippet shown");
const served = await (await fetch(`${here}make/default.snippet.txt`)).text();
if (served !== built) fail.push("make/default.snippet.txt is not the legacy build's snippet");
let compared = 0;
if (legacy) for (const p of PROMPTS) {
  const [a, b] = [await made(legacy, p), await made(here, p)];
  for (const k of Object.keys(a)) if (a[k] !== b[k]) fail.push(`"${p}": ${k} differs (${a[k].length} vs ${b[k].length} chars)`);
  compared++;
}
await browser.close(); server.close();
if (fail.length) { console.error(fail.map((f) => "  " + f).join("\n")); console.error(`make:check: ${fail.length} problem(s)`); process.exit(1); }
console.log(`make:check: ok (default snippet ${built.length} chars, byte for byte${legacy ? `; ${compared} prompts identical to the legacy site` : ""})`);
