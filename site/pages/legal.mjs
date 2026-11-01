// Privacy and Cookies for fizlet.com. Drafted from the DOM VIRUS legal pages (domvirus.com/legal/)
// for Fizlet (MIT, by Chris Cooley). For Chris: PENDING LEGAL REVIEW, not legal advice; have a lawyer
// read both pages before the analytics ids go live. Check before launch: GA4 data retention set to
// 14 months, PostHog project on the US cloud, and the PostHog plan's retention.
import { AUTHOR, HUB, REPO, cookieSettings, crumbs, esc } from "../layout.mjs";

export const LEGAL_UPDATED = "2026-10-31";

// Both pages name only the analytics tools this build configured (resolveAnalytics(env), the same
// config the consent runtime reads): GA4 with PUBLIC_GA4_ID, PostHog with PUBLIC_POSTHOG_KEY, and
// no analytics at all with neither. Turning a tool on later is setting its repository Variable.
const OFF = { enabled: false, ga4Id: "", posthogKey: "" };
const tools = (a = OFF) => ({ ga: Boolean(a.ga4Id), ph: Boolean(a.posthogKey), on: Boolean(a.ga4Id || a.posthogKey) });
/** "Google Analytics 4 and PostHog", one of them, or "" with neither. */
export const analyticsNames = (a) => {
  const t = tools(a);
  return [t.ga && "Google Analytics 4", t.ph && "PostHog"].filter(Boolean).join(" and ");
};

const block = (heading, paras) =>
  `<section class="note-block"><h2>${esc(heading)}</h2>${paras.map((p) => `<p class="body">${p}</p>`).join("")}</section>`;

const shell = ({ base, id, eyebrow, title, sub, lead, blocks }) => `
<!-- Pending legal review (for Chris). Last updated ${LEGAL_UPDATED}. -->
<article class="section note legal" aria-labelledby="${id}-title">
  <div class="wrap">
    ${crumbs(base, [], title)}
    <header class="section-head note-head">
      <p class="eyebrow"><span class="index">${LEGAL_UPDATED}</span> ${eyebrow}</p>
      <h1 id="${id}-title">${esc(title)}<br><em>${esc(sub)}</em></h1>
      <p class="lead">${lead}</p>
      <p class="note-by">By <a href="${AUTHOR}/">Chris Cooley ↗</a> · Last updated <time datetime="${LEGAL_UPDATED}">${LEGAL_UPDATED}</time></p>
    </header>
    ${blocks.filter(Boolean).join("\n    ")}
  </div>
</article>`;

const settings = cookieSettings;

export function privacyPage({ base, analytics = OFF }) {
  const t = tools(analytics);
  const names = analyticsNames(analytics);
  const both = t.ga && t.ph;
  return shell({
    base, id: "privacy", eyebrow: "LEGAL · PRIVACY", title: "Privacy policy", sub: "Analytics only if you say yes.",
    lead: t.on
      ? "Fizlet has no accounts and sells nothing. Analytics runs only if you accept it, and there are no ads. This page says what is collected, why, for how long, who processes it and how to opt out."
      : "Fizlet has no accounts, sells nothing, runs no analytics and shows no ads. This page says what is collected and who processes it.",
    blocks: [
      block("Who we are", [
        `Fizlet is an open-source (MIT) micro game and animation engine for the DOM, made by Chris Cooley under the <a href="${AUTHOR}/">coded.design ↗</a> name. "We" means the people behind that project. This policy covers fizlet.com. The games have their own site, <a href="${HUB}legal/privacy/">DOM VIRUS ↗</a>, with its own policy.`,
      ]),
      block("What we collect", [
        "Nothing that identifies you by name. There is no sign-up, no login and no form. The demos run in your browser and send nothing of their own.",
      ]),
      t.on ? block("Analytics, only if you say yes", [
        `On your first visit a banner asks. Choose Accept and the site loads ${names}. Choose Reject, or do nothing, and ${both ? "neither" : "it does not"} load${both ? "s" : ""}: no analytics script, no request and no analytics cookie.`,
        `What ${both ? "they collect" : "it collects"}: the pages you view, the site that sent you, your browser, device type, screen size and rough location (country or city, worked out from your IP address).`,
        "Why: to count visits and see which docs, bricks and demos people use, so we know what to fix and write next. We do not use it for advertising, remarketing or profiling, and we never sell it.",
        `How long: ${[t.ga && "we set Google Analytics to keep event data for 14 months.", t.ph && "PostHog keeps event data for the retention period of our PostHog plan."].filter(Boolean).join(" ")} The cookies ${both ? "they set are" : "it sets are"} listed, with their lifetimes, on the cookies page.`,
      ]) : block("Analytics", ["None. The site loads no analytics script, makes no analytics request and sets no analytics cookie."]),
      t.on ? block("Who processes analytics data", [
        t.ga && "Google LLC runs Google Analytics 4. Google signals and ad personalisation are off, and the consent signals for advertising (ad storage, ad user data and ad personalisation) stay denied, so the data is not used for Google ads.",
        t.ph && "PostHog Inc. runs PostHog on its US cloud. Session recording and automatic click capture are off.",
        both
          ? `Both act as our processors and may handle data in the United States, under their own policies: <a href="https://policies.google.com/privacy">Google ↗</a> and <a href="https://posthog.com/privacy">PostHog ↗</a>.`
          : t.ga
            ? `Google acts as our processor and may handle data in the United States, under its own policy: <a href="https://policies.google.com/privacy">Google ↗</a>.`
            : `PostHog acts as our processor and may handle data in the United States, under its own policy: <a href="https://posthog.com/privacy">PostHog ↗</a>.`,
      ].filter(Boolean)) : "",
      block("Hosting and request logs", [
        `The site is hosted on GitHub Pages. Like any web host, GitHub receives the details every browser sends with a request, such as your IP address, and may log them under <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">its own privacy statement ↗</a>.`,
      ]),
      t.on ? block("How to opt out", [
        `Choose Reject in the banner, or open Cookie settings at the foot of any page and untick Analytics. The site then stops ${both ? "both tools" : names} on the page and deletes ${both ? "their" : "its"} cookies. ${settings}`,
        "If your browser sends Global Privacy Control or Do Not Track, we treat it as a Reject until you choose otherwise. A content blocker also stops the analytics scripts; the site works the same without them.",
        `To ask us to delete analytics data about you, open an issue or use the private contact on <a href="${REPO}">GitHub ↗</a>.`,
      ]) : "",
      block("Children", ["The site is for a general audience and asks nobody for personal information, children included."]),
      block("Changes to this policy", [
        `If what we collect changes, we update this page and its date first. Every change is public in the site's <a href="${REPO}">GitHub history ↗</a>.`,
      ]),
    ],
  });
}

const rows = (items) =>
  `<div class="panel lit ledger"><div class="table-scroll"><table><thead><tr><th>Name</th><th>Set by</th><th>What it does</th><th>How long</th></tr></thead><tbody>${items
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div></div>`;

export function cookiesPage({ base, analytics = OFF }) {
  const t = tools(analytics);
  return shell({
    base, id: "cookies", eyebrow: "LEGAL · COOKIES", title: "Cookies and storage", sub: "No cookies until you say yes.",
    lead: t.on
      ? "Fizlet sets no cookies unless you accept analytics. This page lists every cookie and storage key the site may use, what each holds and how to clear it."
      : "Fizlet sets no cookies. This page lists every storage key the site may use, what each holds and how to clear it.",
    blocks: [
      t.on ? block("Your choice", [
        `The banner offers Accept, Reject and Settings. Reject is one click, just like Accept, and we remember either answer. Change your mind any time with Cookie settings at the foot of any page. ${settings}`,
      ]) : "",
      t.on ? `<section class="note-block"><h2>Analytics cookies: only after you accept</h2>${rows([
        t.ga && ["<code>_ga</code>", "Google Analytics 4 (Google)", "Tells visits apart so we can count usage.", "2 years"],
        t.ga && ["<code>_ga_&lt;id&gt;</code>", "Google Analytics 4 (Google)", "Keeps the state of your current visit.", "2 years"],
        t.ph && ["<code>ph_&lt;project key&gt;_posthog</code>", "PostHog", "An anonymous id and visit state, in a cookie and in local storage.", "1 year"],
      ].filter(Boolean))}</section>` : "",
      `<section class="note-block"><h2>Local storage: on your device only</h2>${rows([
        t.on && ["<code>fizlet:consent</code>", "fizlet.com", "Your cookie choice (analytics yes or no) and when you made it.", "Until you clear it"],
        ["<code>dom-virus:theme</code>", "fizlet.com", "Your light or dark theme, shared with the DOM VIRUS sites.", "Until you clear it"],
      ].filter(Boolean))}</section>`,
      block("How to clear them", [
        `Clear this site's data in your browser settings to remove every ${t.on ? "cookie and key" : "key"} at once.${t.on ? " To keep analytics off afterwards, choose Reject when the banner asks again." : ""}`,
      ]),
      block("What we never use", ["No advertising, remarketing or social media cookies, and no ad pixels."]),
    ],
  });
}
