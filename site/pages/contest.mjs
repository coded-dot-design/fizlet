// The contest (/contest/), the other half of Daily (/gallery/): the rules, this week's theme and its
// pieces, how to enter (no backend: a prefilled GitHub issue or a PR), and the past winners, all from data (site/contest/weeks/*.json,
// scripts/people.mjs). Winners wear the same sticker here, on /gallery/ and on their maker's page
// (people.mjs winnerBadge). Two lanes: in the micro contest size decides: the week's micros are
// listed smallest first with their measured size and the smallest that can win says so; the Hi-Fi
// pieces (`"lane": "hifi"`, every piece over the cap CONTEST.maxLive) are listed apart, wear a
// HI-FI sticker and have their own weekly winner (`hifiWinner`).
import { REPO, esc, icon } from "../layout.mjs";
import { CONTEST, authorOf } from "../../scripts/people.mjs";
import { winnerBadge } from "./people.mjs";
import { HIFI_PATH, personPath } from "../../scripts/gallery.mjs";
import { sizeBadge } from "../size-badge.mjs";

const DATE = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const YEAR = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });
const at = (d) => new Date(`${d}T00:00:00Z`);
const span = (dates) => `${DATE.format(at(dates[0]))} to ${DATE.format(at(dates[6]))}, ${YEAR.format(at(dates[6]))}`;

const CAP_KB = `${CONTEST.maxLive / 1024} KB`, CAP_B = CONTEST.maxLive.toLocaleString("en-US");
/** The size sticker (the week's smallest micro that can win) and the Hi-Fi lane's. */
export const smallestBadge = () => `<span class="win-badge ct-small">${icon("check", 14)}SMALLEST</span>`;
export const hifiBadge = () => `<span class="win-badge ct-hifi">HI-FI</span>`;

const STATUS = { upcoming: "Opens soon", open: "Open", judging: "Being judged", closed: "Closed" };

const bold = (r) => r.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
/** The voters, by name and linked to their profiles (CONTEST.voters), as one sentence part. */
const votersLine = (people, base) => {
  const names = CONTEST.voters.map((id) => people.find((p) => p.id === id)).filter(Boolean).map((p) => `<a href="${base}${personPath(p.id)}">${esc(p.name)}</a>`);
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};
/** A prefilled GitHub issue for an entry (no backend yet): the week in the title, the prompt and size asked for in the body. */
export const entryUrl = (week) => `${REPO}/issues/new?title=${encodeURIComponent(`Contest ${week ?? "YYYY-Www"}: `)}&body=${encodeURIComponent("Prompt (what it does, one line):\n\nLink to the code or a pull request (optional):\n\nLive size in bytes gzip, if you measured it:\n")}`;
/** The enter key: a prefilled issue on GitHub. */
export const enterKey = (week) => `<a class="bui-key bui-arcade bui-go" href="${esc(entryUrl(week))}">${icon("out", 16)}Enter on GitHub ↗</a>`;
/** The contest in plain sentences: Daily (the gallery) and the contest page both say it. */
export const contestStory = (people, base) =>
  `Up to <b>${CONTEST.perDay} entries a day</b>. The <b>top ${CONTEST.picks[0]} to ${CONTEST.picks[1]}</b> of each day are picked, and all of them are <b>posted at the end of the week</b>. Then a <b>weekly winner</b>, and a <b>monthly winner</b>. The voters: the studio crew, ${votersLine(people, base)}. When a day has too few entries, the team backfills it with its own pieces. Over ${CAP_B} B live, a piece goes in the <b>Hi-Fi</b> lane, with a weekly winner of its own.`;

/** `now`: the week the page leads with (scripts/people.mjs contestNow); `urlOf(id)`: a gallery entry's site path (its page + #id). */
export function contestPage({ now, weeks, people, base, urlOf }) {
  const who = (id) => people.find((p) => p.id === id);
  const past = weeks.filter((w) => w.winner || w.hifiWinner).reverse();
  const rules = [
    `**Up to ${CONTEST.perDay} entries a day.** Anyone can enter: a prompt, or a piece of your own. A week runs Monday to Sunday, UTC.`,
    `**The top ${CONTEST.picks[0]} to ${CONTEST.picks[1]} of each day are picked** by the voters: the studio crew, ${votersLine(people, base)}.`,
    "**All the picks are posted at the end of the week** on Daily, each approved by the owner before it goes live. Archived pieces don't enter.",
    "**One weekly winner**, from that week's picks, then **one monthly winner** from the month's weekly winners. Winners wear a Winner badge on Daily and on their maker's page.",
    "**Not enough entries?** The team backfills the day with its own pieces, credited to whoever made them.",
    `**Small wins.** Size decides, not the prompt: to win, a piece's live code is **${CAP_KB} gzip or less** (${CAP_B} B, measured at build). The week's smallest piece that can win is marked **Smallest**.`,
    "**Hi-Fi has its own lane.** Bigger, high-fidelity pieces (dioramas, 2.5D, full mini-games, heroes over the cap) are marked **Hi-Fi** and compete only with each other, for their own weekly winner. Every piece over the cap is Hi-Fi; a Hi-Fi piece can't win the micro week, and a micro can't win Hi-Fi.",
    "Every piece keeps the contract: still once it settles, asleep off screen, and the page comes back.",
  ].map((r) => `<li>${bold(r)}</li>`).join("");
  const n = now?.entries.length ?? 0;
  const theme = now
    ? `<div class="panel ct-today" aria-labelledby="ct-theme">
        <p class="eyebrow"><span class="index">${esc(now.week)}</span> ${esc(STATUS[now.status])} · ${n} ${n === 1 ? "PIECE" : "PIECES"}</p>
        <h2 id="ct-theme"><span class="bui-label">THEME</span> ${esc(now.theme)}</h2>
        <p class="body">${esc(now.brief)}</p>
        <p class="ct-date">${span(now.dates)}</p>
      </div>`
    : `<div class="panel ct-today"><h2 id="ct-theme">No theme set yet</h2><p class="body">The next theme is posted here.</p></div>`;
  // One list per lane: the micros smallest first (size decides), the Hi-Fi pieces apart.
  const item = (e, tags) => {
    const p = who(authorOf(e));
    return `<li class="panel"><p class="eyebrow"><span class="index">${esc(e.date)}</span></p><h3><a href="${base}${esc(urlOf(e.id))}">${esc(e.title)}</a>${tags ? ` ${tags}` : ""}</h3><p class="gal-prompt">“${esc(e.prompt)}”</p><p class="ppl-size">${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)}${p ? `<span class="ct-by">By <a href="${base}${personPath(p.id)}">${esc(p.name)}</a></span>` : ""}</p></li>`;
  };
  const micro = now?.micro ?? [], hifi = now?.hifi ?? [];
  const entries = (micro.length ? `<section class="ct-entries" aria-labelledby="ct-entries"><h2 id="ct-entries">This week's pieces so far, smallest first</h2><ol class="ct-winners">${micro.map((e) =>
    item(e, [e.id === now.winner && winnerBadge(), e.id === now.smallest && smallestBadge()].filter(Boolean).join(" "))).join("")}</ol></section>` : "") +
    (hifi.length ? `<section class="ct-entries" aria-labelledby="ct-hifi"><h2 id="ct-hifi">This week's Hi-Fi pieces, their own lane</h2><ol class="ct-winners">${hifi.map((e) =>
      item(e, [e.id === now.hifiWinner && winnerBadge(), hifiBadge()].filter(Boolean).join(" "))).join("")}</ol><p class="ct-note"><a href="${base}${HIFI_PATH}">Every Hi-Fi piece on Daily</a></p></section>` : "");
  const winners = past.length
    ? `<ol class="ct-winners">${past.flatMap((w) => [[w.winner, w.micro, ""], [w.hifiWinner, w.hifi, ` ${hifiBadge()}`]].filter(([id]) => id).map(([id, lane, tag]) => {
      const e = lane.find((x) => x.id === id), p = who(authorOf(e));
      return `<li class="panel"><p class="eyebrow"><span class="index">${esc(w.week)}</span> ${esc(w.theme)} · ${lane.length} ${tag ? "Hi-Fi " : ""}${lane.length === 1 ? "piece" : "pieces"}</p><h3><a href="${base}${esc(urlOf(e.id))}">${esc(e.title)}</a> ${winnerBadge()}${tag}</h3><p class="gal-prompt">“${esc(e.prompt)}”</p>${p ? `<p class="ct-by">By <a href="${base}${personPath(p.id)}">${esc(p.name)}</a></p>` : ""}</li>`;
    })).join("")}</ol>`
    : `<p class="body">No winners yet: the first week is judged after it closes. Winners are listed here, newest first.</p>`;
  return `
<section class="section ct" aria-labelledby="ct-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">DAILY</span> PICKED EACH DAY · WON EACH WEEK AND MONTH</p>
      <h1 id="ct-title">The Daily contest.<br><em>Small wins.</em></h1>
      <p class="lead">Tiny examples, made every day. It's how we test the engine. We turned it into a contest. ${contestStory(people, base)} See the pieces on <a href="${base}gallery/">Daily</a>.</p>
    </div>
    ${theme}
    ${entries}
    <div class="ct-grid">
      <section class="panel ct-card" aria-labelledby="ct-rules"><h2 id="ct-rules">Rules</h2><ol class="ledger-rules note-list">${rules}</ol></section>
      <section class="panel ct-card" aria-labelledby="ct-enter"><h2 id="ct-enter">How to enter</h2>
        <p>Entries come in on GitHub for now.</p>
        <ol class="ledger-rules note-list">
          <li><b>Open an issue</b> from the prefilled form below: the week is in the title; add your prompt and, if you have them, a link to your code and its size. If the voters pick it, you are credited.</li>
          <li>Or <b>open a pull request</b> that adds your piece to <code>site/gallery/</code>. The build measures it; over ${CAP_KB} it goes in the Hi-Fi lane (<code>"lane": "hifi"</code> on its entry).</li>
        </ol>
        <p class="ct-note"><span class="bui-label"><b>PLANNED</b></span> An entry form on this page. Not live yet; until then, GitHub.</p>
        <div class="split-keys">${enterKey(now?.week)}<a class="bui-key bui-arcade bui-sys" href="${base}gallery/">${icon("grid", 16)}See Daily</a></div>
      </section>
    </div>
    <section class="ct-past" aria-labelledby="ct-past"><h2 id="ct-past">Past winners</h2>${winners}</section>
  </div>
</section>`;
}
