// People and the weekly contest, as data (scripts/people.mjs): the contributor files, the avatar
// budget (each under 2 KB gzip, tokens only), the persona line on every persona, and the contest
// rules the build enforces (prompt length, one entry per person per day, a winner needs 12 entries).
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { AGENT_NOTE, AVATAR_PALETTE, CONTEST, PERSONA_NOTE, avatarSvg, contestNow, contestWeeks, contributors, isoWeek, statsOf, weekDates } from "../scripts/people.mjs";
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

test("contributors: one owner first, then the AI agent, then the three house personas", () => {
  assert.deepEqual(PEOPLE.map((p) => p.id), ["chris-cooley", "quill", "dj-mempool", "frame-zero", "hex-hazel"]);
  assert.deepEqual(PEOPLE.map((p) => p.kind), ["owner", "agent", "persona", "persona", "persona"]);
  for (const p of PEOPLE.slice(1)) assert.ok(p.handle && !p.url, `${p.id}: a handle, no links`);
  assert.equal(PEOPLE[1].pronouns, "she/her");
  // The owner's favorite games are his to fill: a KIT: placeholder, never invented.
  assert.ok(PEOPLE[0].favoriteGames.every((g) => g.startsWith("KIT:")), "owner favorites stay a KIT: placeholder until he fills them");
});

test("avatars: 32 × 32, Board UI tokens only, under 2 KB gzip each", () => {
  const tokens = readFileSync("src/ui/board-ui.css", "utf8");
  for (const v of Object.values(AVATAR_PALETTE)) assert.match(tokens, new RegExp(`${v}:`), `${v} is a Board UI token`);
  for (const p of PEOPLE) {
    const svg = avatarSvg(p.avatar, { label: p.name });
    const gz = gzipSync(svg).length;
    assert.ok(gz < 2048, `${p.id}: ${gz} B gzip`);
    assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b/i, `${p.id}: no literal colors`);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.match(svg, /role="img" aria-label="/);
  }
  assert.match(avatarSvg(PEOPLE[0].avatar), /aria-hidden="true"/, "a decorative copy is hidden");
});

test("every persona card and page says it is a character, not a real person", () => {
  const rows = PEOPLE.map((p) => ({ person: p, stats: { entries: [], count: 0, bytes: 0 } }));
  const index = peopleIndex({ rows, base: "../" });
  const line = PERSONA_NOTE.replace(/ — /, "</b> — ");
  assert.equal(index.split(line).length - 1, 3, "three persona cards");
  for (const r of rows) {
    const html = personPage({ ...r, base: "../../" });
    assert.equal(html.includes(line), r.person.kind === "persona", r.person.id);
  }
  assert.match(personPage({ ...rows[0], base: "../../" }), /Not picked yet/, "the owner's KIT: favorites render as not picked yet");
});

test("every AI agent card and page says it is an AI agent, not a real person; pronouns show on the profile", () => {
  const rows = PEOPLE.map((p) => ({ person: p, stats: { entries: [], count: 0, bytes: 0 } }));
  const line = AGENT_NOTE.replace(/ — /, "</b> — ");
  assert.equal(peopleIndex({ rows, base: "../" }).split(line).length - 1, 1, "one agent card");
  for (const r of rows) {
    const html = personPage({ ...r, base: "../../" });
    assert.equal(html.includes(line), r.person.kind === "agent", r.person.id);
    assert.equal(html.includes('class="index">AI AGENT</span>'), r.person.kind === "agent", `${r.person.id}: eyebrow`);
    assert.equal(html.includes(`<span class="ppl-pronouns">${r.person.pronouns}</span>`), !!r.person.pronouns, `${r.person.id}: pronouns`);
  }
  const bad = (over) => () => contributors(fakeDir({ ...PEOPLE[1], ...over }));
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
  assert.deepEqual(CONTEST, { maxLive: 10240 });
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
  assert.match(html, /2026-W45<\/span> Fall · 3 dailies/, "past winners by week");
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
  for (const rule of ["weekly contest", "Small wins", "10 KB gzip or less", "10,240 B", "Too big to win", "Smallest", "One or two new pieces a day, at most", "approved by the owner", "One winner a week", "No daily winner", "Monday, October 26 to Sunday, November 1, 2026", "Winner badge", "Not live yet", "No winners yet"]) assert.ok(html.includes(rule), `the page says: ${rule}`);
});

test("stats: a contributor's entries and their measured bytes", () => {
  const s = statsOf(PEOPLE[0], [entry("a", "chris-cooley", { size: 10 }), entry("b", "chris-cooley", { size: 5 }), entry("c", "hex-hazel")]);
  assert.deepEqual([s.count, s.bytes], [2, 15]);
});
