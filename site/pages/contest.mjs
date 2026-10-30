// The weekly contest (/contest/): the rules, this week's theme and its dailies, how to enter (no
// backend: a PR or an issue), and the past winners, all from data (site/contest/weeks/*.json,
// scripts/people.mjs). Winners wear the same sticker here, on /gallery/ and on their maker's page
// (people.mjs winnerBadge). Size decides: the week's dailies are listed smallest first with their
// measured size; the smallest that can win says so, and one over the cap (CONTEST.maxLive) is
// posted with a "too big to win" sticker.
import { REPO, esc, icon } from "../layout.mjs";
import { CONTEST, authorOf, canWin } from "../../scripts/people.mjs";
import { winnerBadge } from "./people.mjs";
import { personPath } from "../../scripts/gallery.mjs";
import { sizeBadge } from "../size-badge.mjs";

const DATE = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const YEAR = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });
const at = (d) => new Date(`${d}T00:00:00Z`);
const span = (dates) => `${DATE.format(at(dates[0]))} to ${DATE.format(at(dates[6]))}, ${YEAR.format(at(dates[6]))}`;

const CAP_KB = `${CONTEST.maxLive / 1024} KB`, CAP_B = CONTEST.maxLive.toLocaleString("en-US");
/** The two size stickers: the week's smallest entry that can win, and one over the cap. */
export const smallestBadge = () => `<span class="win-badge ct-small">${icon("check", 14)}SMALLEST</span>`;
export const tooBigBadge = () => `<span class="win-badge ct-big">TOO BIG TO WIN</span>`;

const STATUS = { upcoming: "Opens soon", open: "Open", judging: "Being judged", closed: "Closed" };

/** `now`: the week the page leads with (scripts/people.mjs contestNow); `urlOf(id)`: a gallery entry's site path (its page + #id). */
export function contestPage({ now, weeks, people, base, urlOf }) {
  const who = (id) => people.find((p) => p.id === id);
  const past = weeks.filter((w) => w.winner).reverse();
  const rules = [
    `**Small wins.** Any prompt, any length: size decides. To win, a piece's live code is **${CAP_KB} gzip or less** (${CAP_B} B, measured at build).`,
    `**Bigger than ${CAP_KB}?** It is still posted, marked **Too big to win**. The week's smallest piece that can win is marked **Smallest**.`,
    "**One or two new pieces a day, at most**, each approved by the owner before it goes live. Those are the week's dailies, and its entries. A week runs Monday to Sunday, UTC. Archived gallery pieces don't enter.",
    "**One winner a week**, picked by the team from that week's dailies, never one that is too big. No daily winner.",
    "**Winners are featured on the gallery** with a Winner badge, and on their maker's page.",
    "Every piece keeps the contract: still once it settles, asleep off screen, and the page comes back.",
  ].map((r) => `<li>${r.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")}</li>`).join("");
  const n = now?.entries.length ?? 0;
  const theme = now
    ? `<div class="panel ct-today" aria-labelledby="ct-theme">
        <p class="eyebrow"><span class="index">${esc(now.week)}</span> ${esc(STATUS[now.status])} · ${n} ${n === 1 ? "DAILY" : "DAILIES"}</p>
        <h2 id="ct-theme"><span class="bui-label">THEME</span> ${esc(now.theme)}</h2>
        <p class="body">${esc(now.brief)}</p>
        <p class="ct-date">${span(now.dates)}</p>
      </div>`
    : `<div class="panel ct-today"><h2 id="ct-theme">No theme set yet</h2><p class="body">The next theme is posted here.</p></div>`;
  const entries = n
    ? `<section class="ct-entries" aria-labelledby="ct-entries"><h2 id="ct-entries">This week's dailies, smallest first</h2><ol class="ct-winners">${now.entries.map((e) => {
      const p = who(authorOf(e));
      const tags = [e.id === now.winner && winnerBadge(), e.id === now.smallest && smallestBadge(), !canWin(e) && tooBigBadge()].filter(Boolean).join(" ");
      return `<li class="panel"><p class="eyebrow"><span class="index">${esc(e.date)}</span></p><h3><a href="${base}${esc(urlOf(e.id))}">${esc(e.title)}</a>${tags ? ` ${tags}` : ""}</h3><p class="gal-prompt">“${esc(e.prompt)}”</p><p class="ppl-size">${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)}${p ? `<span class="ct-by">By <a href="${base}${personPath(p.id)}">${esc(p.name)}</a></span>` : ""}</p></li>`;
    }).join("")}</ol></section>`
    : "";
  const winners = past.length
    ? `<ol class="ct-winners">${past.map((w) => {
      const e = w.entries.find((x) => x.id === w.winner), p = who(authorOf(e));
      return `<li class="panel"><p class="eyebrow"><span class="index">${esc(w.week)}</span> ${esc(w.theme)} · ${w.entries.length} ${w.entries.length === 1 ? "daily" : "dailies"}</p><h3><a href="${base}${esc(urlOf(e.id))}">${esc(e.title)}</a> ${winnerBadge()}</h3><p class="gal-prompt">“${esc(e.prompt)}”</p>${p ? `<p class="ct-by">By <a href="${base}${personPath(p.id)}">${esc(p.name)}</a></p>` : ""}</li>`;
    }).join("")}</ol>`
    : `<p class="body">No winners yet: the first week is judged after it closes. Winners are listed here, newest first.</p>`;
  return `
<section class="section ct" aria-labelledby="ct-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">WEEKLY</span> ONE THEME · ONE WINNER</p>
      <h1 id="ct-title">The weekly contest.<br><em>Small wins.</em></h1>
      <p class="lead">Every week has a theme. Each day brings one or two new pieces, at most, to the <a href="${base}gallery/">gallery</a>, and once a week the team picks one winner from them. Write any prompt; the size decides. At ${CAP_KB} gzip or less a piece can win; bigger, it is posted but too big to win. The <a href="${base}people/">house personas</a> make pieces too.</p>
    </div>
    ${theme}
    ${entries}
    <div class="ct-grid">
      <section class="panel ct-card" aria-labelledby="ct-rules"><h2 id="ct-rules">Rules</h2><ol class="ledger-rules note-list">${rules}</ol></section>
      <section class="panel ct-card" aria-labelledby="ct-enter"><h2 id="ct-enter">How to enter</h2>
        <p>There is no entry form yet: entries come in on GitHub.</p>
        <ol class="ledger-rules note-list">
          <li><b>Open an issue</b> titled <code>Contest &lt;week&gt;: &lt;your prompt&gt;</code>, with the week's theme in the body. If the team makes it one of the week's dailies, you are credited.</li>
          <li>Or <b>open a pull request</b> that adds your animation to <code>site/gallery/</code>, dated on a day of the week. The build measures it and marks it too big to win when it is over ${CAP_KB}.</li>
        </ol>
        <p class="ct-note"><span class="bui-label"><b>PLANNED</b></span> Open prompts from visitors, typed right on this page. Not live yet.</p>
        <div class="split-keys"><a class="bui-key bui-arcade bui-go" href="${REPO}/issues/new?title=${encodeURIComponent("Contest " + (now?.week ?? "YYYY-Www") + ": ")}">${icon("out", 16)}Enter on GitHub ↗</a><a class="bui-key bui-arcade bui-sys" href="${base}gallery/">${icon("grid", 16)}See the gallery</a></div>
      </section>
    </div>
    <section class="ct-past" aria-labelledby="ct-past"><h2 id="ct-past">Past winners</h2>${winners}</section>
  </div>
</section>`;
}
