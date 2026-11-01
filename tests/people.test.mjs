// People and the weekly contest, as data (scripts/people.mjs): the contributor files, the avatar
// frames (2–3 each, under 2 KB gzip a frame, avatar tokens only), who reports to whom, the sticker
// on every avatar (and its honest accessible name), the reduced-motion and settle rules of the
// rotation, and the contest
// rules the build enforces (prompt length, one entry per person per day, a winner needs 12 entries).
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { AVATAR_PALETTE, CONTEST, KIND_LABEL, STICKER, avatarSvg, contestNow, contestWeeks, contributors, isoWeek, statsOf, weekDates } from "../scripts/people.mjs";
import { peopleIndex, personPage } from "../site/pages/people.mjs";
import { contestPage } from "../site/pages/contest.mjs";

const PEOPLE = contributors();
/** The shipped contributors, with `quill.json` swapped for `p`, in a temp dir. */
const fakeDir = (p) => {
  const d = mkdtempSync(`${tmpdir()}/people-`);
  for (const f of readdirSync("site/contributors")) copyFileSync(`site/contributors/${f}`, `${d}/${f}`);
  writeFileSync(`${d}/quill.json`, JSON.stringify(p));
  return d;
};

test("contributors: one owner first, then the AI agents, then the three studio crew", () => {
  assert.deepEqual(PEOPLE.map((p) => p.id), ["chris-cooley", "pip", "quill", "dj-mempool", "frame-zero", "hex-hazel"]);
  assert.deepEqual(PEOPLE.map((p) => p.kind), ["owner", "agent", "agent", "persona", "persona", "persona"]);
  for (const p of PEOPLE.slice(1)) assert.ok(p.handle && !p.url, `${p.id}: a handle, no links`);
  assert.equal(PEOPLE.find((p) => p.id === "quill").pronouns, "she/her");
  assert.equal(PEOPLE.find((p) => p.id === "pip").pronouns, "they/them");
  // The owner's favorite games are his to fill: a KIT: placeholder, never invented.
  assert.ok(PEOPLE[0].favoriteGames.every((g) => g.startsWith("KIT:")), "owner favorites stay a KIT: placeholder until he fills them");
});

test("avatars: 2–3 frames of 32 × 32, avatar tokens only (Board UI colors or a mix of two), under 2 KB gzip a frame", () => {
  const kit = readFileSync("src/ui/board-ui.css", "utf8"), css = readFileSync("site/site.css", "utf8");
  const board = (v) => new RegExp(`\\s${v}:`).test(kit);
  for (const v of [...Object.values(AVATAR_PALETTE), "--av-bg"]) {
    const def = css.match(new RegExp(`${v}: ([^;]+);`))?.[1];
    assert.ok(def, `${v} is defined in site.css`);
    const refs = [...def.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]);
    assert.ok(refs.length >= 1 && refs.length <= 2 && refs.every(board), `${v}: ${def} uses Board UI tokens only`);
    assert.doesNotMatch(def, /#|rgba?\(|hsla?\(/, `${v}: no literal colors`);
    assert.ok(["--rim", "--k-flag", "--k-sys", "--k-cmd", "--k-fire", "--k-aim", "--k-attack", "--k-advance", "--k-fallin", "--k-go", "--hurt"].includes(refs[0]) && refs.every((r) => !/ink|line|raised|surface|muted|bg$/.test(r)), `${v}: fixed in both themes`);
  }
  for (const p of PEOPLE) {
    assert.ok(p.avatars.length >= 2 && p.avatars.length <= 3, `${p.id}: 2–3 frames`);
    assert.equal(p.avatar, undefined, `${p.id}: the single avatar moved into avatars`);
    for (const rows of p.avatars) {
      const svg = avatarSvg(rows, { label: p.name });
      const gz = gzipSync(svg).length;
      assert.ok(gz < 2048, `${p.id}: ${gz} B gzip`);
      assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b/i, `${p.id}: no literal colors`);
      assert.match(svg, /shape-rendering="crispEdges"/);
      assert.match(svg, /fill="var\(--av-bg\)"/, "a dark ground");
      assert.match(svg, /role="img" aria-label="/);
    }
    assert.notDeepEqual(p.avatars[0], p.avatars[1], `${p.id}: the frames differ`);
  }
  assert.match(avatarSvg(PEOPLE[0].avatars[0]), /aria-hidden="true"/, "a decorative copy is hidden");
  assert.throws(() => contributors(fakeDir({ ...PEOPLE.find((p) => p.id === "quill"), avatars: [PEOPLE[0].avatars[0]] })), /avatars is 2 or 3 frames/);
});

test("rotation: every frame on the card and the profile, the first shown; settles off screen, hidden and under reduced motion", () => {
  const rows = PEOPLE.map((p) => ({ person: p, stats: { entries: [], count: 0, bytes: 0 } }));
  for (const html of [peopleIndex({ rows, base: "../" }), ...rows.map((r) => personPage({ ...r, people: PEOPLE, base: "../../" }))]) {
    for (const p of PEOPLE.filter((x) => html.includes(`data-person="${x.id}"`))) {
      const frame = html.split(`aria-label="${p.name}: pixel-art avatar`)[1].split("</span>")[0];
      assert.equal(frame.split("<svg").length - 1, p.avatars.length, `${p.id}: all frames`);
      assert.match(frame, /^[^>]*data-rotate><svg class="ppl-av on"/, `${p.id}: the first frame is the one shown`);
      assert.equal(frame.split(" on\"").length - 1, 1, `${p.id}: one frame shown`);
      assert.equal(frame.split('aria-hidden="true"').length - 1, p.avatars.length, `${p.id}: one name for the avatar, frames hidden`);
    }
  }
  const css = readFileSync("site/site.css", "utf8"), js = readFileSync("site/site.ts", "utf8");
  assert.match(css, /\.ppl-frame > \.ppl-av:not\(\.on\) \{\s*opacity: 0;/, "without script, the first frame shows");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.ppl-av \{\s*transition: none;/);
  assert.match(js, /!matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/, "no rotation under reduced motion");
  assert.match(js, /new IntersectionObserver/, "only frames on screen turn");
  assert.match(js, /visibilitychange/, "the timer stops while the tab is hidden");
  assert.match(js, /setInterval\(turn, 4000\)/, "every 4 s");
});

test("stickers: AI AGENT, CHARACTER or MAKER on every avatar, and its accessible name says who is not a real person", () => {
  assert.deepEqual(KIND_LABEL, { owner: "Maker", agent: "AI agent", persona: "Studio crew" });
  assert.deepEqual(Object.fromEntries(Object.entries(STICKER).map(([k, s]) => [k, s.text])), { owner: "MAKER", agent: "AI AGENT", persona: "CHARACTER" });
  for (const k of ["agent", "persona"]) assert.match(STICKER[k].label, /not a real person$/, `${k}: the sticker keeps the honesty`);
  assert.match(STICKER.agent.label, /an AI agent persona/);
  const rows = PEOPLE.map((p) => ({ person: p, stats: { entries: [], count: 0, bytes: 0 } }));
  const index = peopleIndex({ rows, base: "../" });
  const sticker = (k) => `<span class="ppl-sticker ppl-sticker-${k}" role="img" aria-label="${STICKER[k].label}" title="${STICKER[k].label}">${STICKER[k].text}</span>`;
  for (const k of ["owner", "agent", "persona"]) assert.equal(index.split(sticker(k)).length - 1, PEOPLE.filter((p) => p.kind === k).length, `one ${k} sticker per card`);
  for (const r of rows) {
    const html = personPage({ ...r, people: PEOPLE, base: "../../" });
    for (const k of ["owner", "agent", "persona"]) assert.equal(html.includes(sticker(k)), r.person.kind === k, `${r.person.id}: ${k} sticker`);
  }
  for (const html of [index, ...rows.map((r) => personPage({ ...r, people: PEOPLE, base: "../../" }))]) {
    assert.doesNotMatch(html, /ppl-persona|ppl-owner|House persona|house persona/i, "the long bordered line and the old term are gone");
  }
  assert.match(index, /STUDIO CREW<\/p>|3 STUDIO CREW/);
  assert.match(personPage({ ...rows[0], people: PEOPLE, base: "../../" }), /Not picked yet/, "the owner's KIT: favorites render as not picked yet");
});

test("titles: the role in its own line, a tagline, and who each one reports to (linked)", () => {
  const by = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
  for (const id of ["frame-zero", "dj-mempool", "hex-hazel"]) {
    assert.equal(by[id].reportsTo, "quill", `${id} reports to Quill`);
    assert.match(by[id].role, /^Studio crew · /);
    assert.match(by[id].bio, /pitches animation ideas and prompts for the gallery, and votes in the weekly contest with Quill, Pip and Chris\.$/);
  }
  for (const id of ["quill", "pip"]) assert.equal(by[id].reportsTo, "chris-cooley", `${id} reports to Chris`);
  assert.equal(by["chris-cooley"].reportsTo, undefined, "the maker reports to no one");
  assert.equal(by.pip.role, "Keeper of Fizlet · Lead Narwhal");
  assert.equal(by.pip.tagline, "the herd's sea unicorn");
  for (const p of PEOPLE) assert.doesNotMatch(p.role, /reports to|\(/, `${p.id}: the title is the title only`);
  const rows = PEOPLE.map((p) => ({ person: p, stats: { entries: [], count: 0, bytes: 0 } }));
  const index = peopleIndex({ rows, base: "../" });
  assert.match(index, /<p class="ppl-role">Keeper of Fizlet · Lead Narwhal<\/p>\s*<p class="ppl-tagline">the herd&#39;s sea unicorn<\/p>|<p class="ppl-role">Keeper of Fizlet · Lead Narwhal<\/p>\s*<p class="ppl-tagline">the herd's sea unicorn<\/p>/);
  assert.match(index, /reports to <a href="\.\.\/people\/chris-cooley\/">Chris Cooley<\/a>, the Chef Unicorn/);
  assert.match(personPage({ ...rows.find((r) => r.person.id === "hex-hazel"), people: PEOPLE, base: "../../" }), /reports to <a href="\.\.\/\.\.\/people\/quill\/">Quill<\/a>, the Keeper-in-Chief/);
  const bad = (over) => () => contributors(fakeDir({ ...by.quill, ...over }));
  assert.throws(bad({ reportsTo: "nobody" }), /reportsTo nobody/);
  assert.throws(bad({ reportsTo: undefined }), /reportsTo is missing/);
  assert.throws(bad({ reportsTo: "quill" }), /reportsTo quill/);
});

test("AI agents: the eyebrow says AI AGENT; pronouns show on the profile; agents keep a handle and no links", () => {
  const rows = PEOPLE.map((p) => ({ person: p, stats: { entries: [], count: 0, bytes: 0 } }));
  for (const r of rows) {
    const html = personPage({ ...r, people: PEOPLE, base: "../../" });
    assert.equal(html.includes('class="index">AI AGENT</span>'), r.person.kind === "agent", `${r.person.id}: eyebrow`);
    assert.equal(html.includes(`<span class="ppl-pronouns">${r.person.pronouns}</span>`), !!r.person.pronouns, `${r.person.id}: pronouns`);
  }
  const bad = (over) => () => contributors(fakeDir({ ...PEOPLE.find((p) => p.id === "quill"), ...over }));
  assert.throws(bad({ kind: "robot" }), /kind robot/);
  assert.throws(bad({ url: "https://fizlet.com/" }), /an agent has a handle and no url/);
  assert.throws(bad({ pronouns: 3 }), /pronouns is a string/);
});

const entry = (id, author, extra = {}) => ({ id, author, date: "2026-11-03", prompt: "bats swoop", title: id, size: 100, ...extra });
// 2026-W45 runs Monday 2026-11-02 to Sunday 2026-11-08.
const week = (v = {}) => [{ f: `${v.week ?? "2026-W45"}.json`, v: { week: "2026-W45", theme: "Fall", brief: "b", status: "open", ...v } }];

test("ISO weeks: dates to weeks and back, across a year end", () => {
  assert.equal(isoWeek("2026-10-31"), "2026-W44");
  assert.equal(isoWeek("2026-10-26"), "2026-W44", "Monday");
  assert.equal(isoWeek("2026-11-01"), "2026-W44", "Sunday");
  assert.equal(isoWeek("2026-11-02"), "2026-W45");
  assert.equal(isoWeek("2027-01-01"), "2026-W53");
  assert.equal(isoWeek("2025-12-29"), "2026-W01");
  assert.deepEqual(weekDates("2026-W45"), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
});

test("contest: a week's entries are its dailies (live, measured, dated inside it); any prompt length; no contest stamps", () => {
  const gallery = [entry("mon", "hex-hazel", { date: "2026-11-02", size: 300 }), entry("sun", "frame-zero", { date: "2026-11-08", size: 200 }),
    entry("before", "hex-hazel", { date: "2026-11-01" }), entry("after", "hex-hazel", { date: "2026-11-09" }), entry("old", "hex-hazel", { archived: true })];
  const [w] = contestWeeks(gallery, PEOPLE, week());
  assert.deepEqual(w.entries.map((e) => e.id), ["sun", "mon"], "smallest first; outside the week and archived pieces never enter");
  assert.deepEqual([w.dates[0], w.dates[6]], ["2026-11-02", "2026-11-08"]);
  const [long] = contestWeeks([entry("a", "hex-hazel", { prompt: "x".repeat(200) })], PEOPLE, week());
  assert.equal(long.entries.length, 1, "the prompt is not the judge: a long one enters");
  assert.throws(() => contestWeeks([entry("a", "hex-hazel", { size: undefined })], PEOPLE, week()), /measured first/);
  assert.throws(() => contestWeeks([entry("a", "hex-hazel", { contest: "2026-11-03" })], PEOPLE, week()), /"contest" is gone/);
  assert.throws(() => contestWeeks([entry("a", "hex-hazel", { archived: true, contest: "2026-11-03" })], PEOPLE, week()), /"contest" is gone/, "archived stamps fail too");
  assert.throws(() => contestWeeks([entry("a", "nobody")], PEOPLE, week()), /no site\/contributors/);
  assert.throws(() => contestWeeks([], PEOPLE, [{ f: "2026-W45.json", v: { week: "2026-W99", theme: "t", brief: "b", status: "open" } }]), /week 2026-W99/);
  assert.throws(() => contestWeeks([], PEOPLE, week({ status: "done" })), /status done/);
});

test("contest: one winner a week, from its dailies, on a closed week, never over the size cap; no entry minimum", () => {
  assert.deepEqual(CONTEST, { maxLive: 10240, perDay: 40, picks: [1, 5], voters: ["frame-zero", "dj-mempool", "hex-hazel", "quill", "pip", "chris-cooley"] });
  for (const id of CONTEST.voters) assert.ok(PEOPLE.some((p) => p.id === id), `voter ${id} is a contributor`);
  const three = [entry("e0", PEOPLE[0].id, { size: 9000, date: "2026-11-02" }), entry("e1", PEOPLE[1].id, { size: 4000, date: "2026-11-04" }), entry("e2", PEOPLE[2].id, { size: CONTEST.maxLive + 1, date: "2026-11-06" })];
  assert.throws(() => contestWeeks(three, PEOPLE, week({ winner: "nope", status: "closed" })), /not one of its dailies/);
  assert.throws(() => contestWeeks(three, PEOPLE, week({ winner: "e0" })), /only once the week is closed/);
  assert.throws(() => contestWeeks(three, PEOPLE, week({ winner: "e2", status: "closed" })), /too big to win \(10,?241 B live, the cap is 10,?240 B\)/);
  assert.throws(() => contestWeeks([...three, entry("x", PEOPLE[0].id, { date: "2026-11-09" })], PEOPLE, week({ winner: "x", status: "closed" })), /not one of its dailies/, "next week's piece");
  const [one] = contestWeeks([entry("a", PEOPLE[0].id, { size: CONTEST.maxLive })], PEOPLE, week({ winner: "a", status: "closed" }));
  assert.equal(one.winner, "a", "one daily is enough, and at the cap exactly is small enough");
  const [w] = contestWeeks(three, PEOPLE, week({ winner: "e0", status: "closed" }));
  assert.equal(w.smallest, "e1", "the smallest entry that can win");
  const html = contestPage({ now: w, weeks: [w], people: PEOPLE, base: "../", urlOf: (id) => `gallery/#${id}` });
  const li = (id) => html.split("<li").find((x) => x.includes(`#${id}"`) && x.includes("gal-prompt") && !x.includes("2026-W45</span> Fall"));
  assert.match(li("e0"), /WINNER/);
  assert.match(li("e1"), /SMALLEST/);
  assert.match(li("e2"), /TOO BIG TO WIN/);
  assert.doesNotMatch(li("e0") + li("e1"), /TOO BIG TO WIN/);
  assert.ok(html.indexOf("#e1\"") < html.indexOf("#e0\"") && html.indexOf("#e0\"") < html.indexOf("#e2\""), "dailies listed smallest first");
  assert.match(html, /2026-W45<\/span> Fall · 3 pieces/, "past winners by week");
  const [none] = contestWeeks([entry("x", PEOPLE[0].id, { size: CONTEST.maxLive + 5 })], PEOPLE, week());
  assert.equal(none.smallest, null, "no smallest when nothing can win");
});

test("contest: the page leads with this week, else the next one, else the latest; the shipped data checks", () => {
  const weeks = [{ week: "2026-W44" }, { week: "2026-W46" }];
  assert.equal(contestNow(weeks, "2026-10-31").week, "2026-W44");
  assert.equal(contestNow(weeks, "2026-10-20").week, "2026-W44");
  assert.equal(contestNow(weeks, "2026-11-03").week, "2026-W46");
  assert.equal(contestNow(weeks, "2026-12-01").week, "2026-W46");
  assert.equal(contestNow([], "2026-12-01"), null);
  const shipped = contestWeeks([], PEOPLE);
  assert.ok(shipped.some((w) => w.week === "2026-W44" && w.theme === "Halloween"), "launch week: Halloween");
  const html = contestPage({ now: contestNow(shipped, "2026-10-31"), weeks: shipped, people: PEOPLE, base: "../", urlOf: (id) => `gallery/#${id}` });
  for (const rule of ["Tiny examples, made every day. It's how we test the engine. We turned it into a contest.", "Small wins", "10 KB gzip or less", "10,240 B", "Too big to win", "Smallest",
    "Up to 40 entries a day", "top 1 to 5", "posted at the end of the week", "weekly winner", "monthly winner", "backfills", "approved by the owner",
    "Monday, October 26 to Sunday, November 1, 2026", "Winner badge", "Not live yet", "No winners yet", "issues/new?title=Contest%202026-W44%3A%20&amp;body="]) assert.ok(html.includes(rule), `the page says: ${rule}`);
  for (const name of ["Frame Zero", "DJ Mempool", "Hex Hazel", "Quill", "Pip", "Chris Cooley"]) assert.ok(html.includes(`>${name}</a>`), `voter ${name} is named`);
});

test("stats: a contributor's entries and their measured bytes", () => {
  const s = statsOf(PEOPLE[0], [entry("a", "chris-cooley", { size: 10 }), entry("b", "chris-cooley", { size: 5 }), entry("c", "hex-hazel")]);
  assert.deepEqual([s.count, s.bytes], [2, 15]);
});
