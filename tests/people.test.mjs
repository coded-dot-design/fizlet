// People and the daily contest, as data (scripts/people.mjs): the contributor files, the avatar
// budget (each under 2 KB gzip, tokens only), the persona line on every persona, and the contest
// rules the build enforces (prompt length, one entry per person per day, a winner needs 12 entries).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { AVATAR_PALETTE, CONTEST, PERSONA_NOTE, avatarSvg, contestDays, contestToday, contributors, statsOf } from "../scripts/people.mjs";
import { peopleIndex, personPage } from "../site/pages/people.mjs";
import { contestPage } from "../site/pages/contest.mjs";

const PEOPLE = contributors();

test("contributors: one owner first, then the three house personas", () => {
  assert.deepEqual(PEOPLE.map((p) => p.id), ["chris-cooley", "dj-mempool", "frame-zero", "hex-hazel"]);
  assert.equal(PEOPLE[0].kind, "owner");
  for (const p of PEOPLE.slice(1)) {
    assert.equal(p.kind, "persona");
    assert.ok(p.handle && !p.url, `${p.id}: a handle, no links`);
  }
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

const entry = (id, author, extra = {}) => ({ id, author, date: "2026-10-31", prompt: "bats swoop", title: id, size: 100, contest: "2026-10-31", ...extra });
const day = (v) => [{ f: `${v.date}.json`, v: { theme: "Halloween", brief: "b", status: "open", ...v } }];

test("contest: entries come from the gallery; prompt length and one entry per person per day", () => {
  const [d] = contestDays([entry("a", "hex-hazel"), entry("b", "frame-zero")], PEOPLE, day({ date: "2026-10-31" }));
  assert.deepEqual(d.entries.map((e) => e.id), ["a", "b"]);
  assert.throws(() => contestDays([entry("a", "hex-hazel", { prompt: "x".repeat(CONTEST.maxPrompt + 1) })], PEOPLE, day({ date: "2026-10-31" })), /60 characters/);
  assert.throws(() => contestDays([entry("a", "hex-hazel"), entry("b", "hex-hazel")], PEOPLE, day({ date: "2026-10-31" })), /one entry per person per day/);
  assert.throws(() => contestDays([entry("a", "nobody")], PEOPLE, day({ date: "2026-10-31" })), /no site\/contributors/);
  assert.throws(() => contestDays([entry("a", "hex-hazel", { contest: "2026-11-01" })], PEOPLE, day({ date: "2026-10-31" })), /no site\/contest\/days/);
});

test("contest: a winner is one of the day's entries, and only once it has 12", () => {
  const many = Array.from({ length: 12 }, (_, i) => entry(`e${i}`, i < 4 ? PEOPLE[i].id : `guest-${i}`));
  const people = [...PEOPLE, ...many.slice(4).map((e) => ({ id: e.author }))];
  assert.throws(() => contestDays(many.slice(0, 11), people, day({ date: "2026-10-31", winner: "e0" })), /at least 12 entries/);
  assert.throws(() => contestDays(many, people, day({ date: "2026-10-31", winner: "nope" })), /not one of its entries/);
  const [d] = contestDays(many, people, day({ date: "2026-10-31", winner: "e3", status: "closed" }));
  const html = contestPage({ today: d, days: [d], people, base: "../", urlOf: (id) => `gallery/#${id}` });
  assert.match(html, /WINNER/);
  assert.match(html, /e3/);
});

test("contest: today is today's day, else the next one, else the latest; the shipped data checks", () => {
  const days = [{ date: "2026-10-31" }, { date: "2026-11-02" }];
  assert.equal(contestToday(days, "2026-10-31").date, "2026-10-31");
  assert.equal(contestToday(days, "2026-10-30").date, "2026-10-31");
  assert.equal(contestToday(days, "2026-11-01").date, "2026-11-02");
  assert.equal(contestToday(days, "2026-12-01").date, "2026-11-02");
  assert.equal(contestToday([], "2026-12-01"), null);
  const shipped = contestDays([], PEOPLE);
  assert.ok(shipped.some((d) => d.date === "2026-10-31" && d.theme === "Halloween"), "launch day: Halloween");
  const html = contestPage({ today: contestToday(shipped, "2026-10-31"), days: shipped, people: PEOPLE, base: "../", urlOf: (id) => `gallery/#${id}` });
  for (const rule of ["60 characters or fewer", "One entry per person per day", "at least 12 entries", "one winner", "Winner badge", "Not live yet", "No winners yet"]) assert.ok(html.includes(rule), `the page says: ${rule}`);
});

test("stats: a contributor's entries and their measured bytes", () => {
  const s = statsOf(PEOPLE[0], [entry("a", "chris-cooley", { size: 10 }), entry("b", "chris-cooley", { size: 5 }), entry("c", "hex-hazel")]);
  assert.deepEqual([s.count, s.bytes], [2, 15]);
});
