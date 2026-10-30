// The daily contest (/contest/): the rules, today's theme, how to enter (no backend: a PR or an
// issue), and the past winners, all from data (site/contest/days/*.json, scripts/people.mjs).
// Winners wear the same sticker here, on /gallery/ and on their maker's page (people.mjs winnerBadge).
import { REPO, esc, icon } from "../layout.mjs";
import { CONTEST, authorOf } from "../../scripts/people.mjs";
import { winnerBadge } from "./people.mjs";
import { personPath } from "../../scripts/gallery.mjs";

const DATE = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const longDate = (d) => DATE.format(new Date(`${d}T00:00:00Z`));

const STATUS = { upcoming: "Opens soon", open: "Open for entries", judging: "Being judged", closed: "Closed" };

/** `urlOf(id)`: a gallery entry's site path (its page + #id). */
export function contestPage({ today, days, people, base, urlOf }) {
  const who = (id) => people.find((p) => p.id === id);
  const past = days.filter((d) => d.winner).reverse();
  const rules = [
    `One prompt, **${CONTEST.maxPrompt} characters or fewer**. It becomes one animation, made from Fizlet bricks.`,
    "**One entry per person per day.** A day runs midnight to midnight UTC.",
    `**Judged by the team.** A day needs **at least ${CONTEST.minEntries} entries**; it has **one winner**.`,
    "**Winners are featured on the gallery** with a Winner badge, and on their maker's page.",
    "Every entry keeps the contract: still once it settles, asleep off screen, and the page comes back.",
  ].map((r) => `<li>${r.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")}</li>`).join("");
  const theme = today
    ? `<div class="panel ct-today" aria-labelledby="ct-theme">
        <p class="eyebrow"><span class="index">${esc(today.date)}</span> ${esc(STATUS[today.status])} · ${today.entries.length} ${today.entries.length === 1 ? "ENTRY" : "ENTRIES"}</p>
        <h2 id="ct-theme"><span class="bui-label">THEME</span> ${esc(today.theme)}</h2>
        <p class="body">${esc(today.brief)}</p>
        <p class="ct-date">${longDate(today.date)}</p>
      </div>`
    : `<div class="panel ct-today"><h2 id="ct-theme">No theme set yet</h2><p class="body">The next theme is posted here.</p></div>`;
  const winners = past.length
    ? `<ol class="ct-winners">${past.map((d) => {
      const e = d.entries.find((x) => x.id === d.winner), p = who(authorOf(e));
      return `<li class="panel"><p class="eyebrow"><span class="index">${esc(d.date)}</span> ${esc(d.theme)} · ${d.entries.length} entries</p><h3><a href="${base}${esc(urlOf(e.id))}">${esc(e.title)}</a> ${winnerBadge()}</h3><p class="gal-prompt">“${esc(e.prompt)}”</p>${p ? `<p class="ct-by">By <a href="${base}${personPath(p.id)}">${esc(p.name)}</a></p>` : ""}</li>`;
    }).join("")}</ol>`
    : `<p class="body">No winners yet: the first day is judged after it closes. Winners are listed here, newest first.</p>`;
  return `
<section class="section ct" aria-labelledby="ct-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">DAILY</span> ONE THEME · ONE WINNER</p>
      <h1 id="ct-title">The daily contest.<br><em>${CONTEST.maxPrompt} characters. One animation.</em></h1>
      <p class="lead">Every day has a theme. Write a prompt of ${CONTEST.maxPrompt} characters or fewer, and it becomes a Fizlet animation in the <a href="${base}gallery/">gallery</a>. The team picks one winner a day. The <a href="${base}people/">house personas</a> enter too.</p>
    </div>
    ${theme}
    <div class="ct-grid">
      <section class="panel ct-card" aria-labelledby="ct-rules"><h2 id="ct-rules">Rules</h2><ol class="ledger-rules note-list">${rules}</ol></section>
      <section class="panel ct-card" aria-labelledby="ct-enter"><h2 id="ct-enter">How to enter</h2>
        <p>There is no entry form yet: entries come in on GitHub.</p>
        <ol class="ledger-rules note-list">
          <li><b>Open an issue</b> titled <code>Contest &lt;date&gt;: &lt;your prompt&gt;</code>, with the day's theme in the body. The team makes the animation from it and credits you.</li>
          <li>Or <b>open a pull request</b> that adds your animation to <code>site/gallery/</code> with <code>"contest": "&lt;date&gt;"</code> on its entry. The build checks the prompt length and one entry per person per day.</li>
        </ol>
        <p class="ct-note"><span class="bui-label"><b>PLANNED</b></span> Open prompts from visitors, a few a day, typed right on this page. Not live yet.</p>
        <div class="split-keys"><a class="bui-key bui-arcade bui-go" href="${REPO}/issues/new?title=${encodeURIComponent("Contest " + (today?.date ?? "YYYY-MM-DD") + ": ")}">${icon("out", 16)}Enter on GitHub ↗</a><a class="bui-key bui-arcade bui-sys" href="${base}gallery/">${icon("grid", 16)}See the gallery</a></div>
      </section>
    </div>
    <section class="ct-past" aria-labelledby="ct-past"><h2 id="ct-past">Past winners</h2>${winners}</section>
  </div>
</section>`;
}
