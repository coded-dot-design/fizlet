// The page shell for every page on the Fizlet site: a Board UI root (<html class="bui">), so the
// page wears the Battlefield design system's own tokens, keys and cards. Header, footer and theme
// match the DOM Battlefield site, so the two read as siblings. Dark by default; the theme is shared
// with DOM VIRUS and Battlefield (localStorage "dom-virus:theme").

export const REPO = "https://github.com/coded-dot-design/fizlet";
export const SITE = "https://coded-dot-design.github.io/fizlet/";
export const HUB = "https://coded-dot-design.github.io/dom-virus/";
export const BATTLEFIELD = "https://coded-dot-design.github.io/dom-battlefield/";
export const BLITZ = `${BATTLEFIELD}blitz/`;
export const ENGINE_PLAN = "https://github.com/coded-dot-design/dom-virus/blob/main/ENGINE.md";

/** Escape text for HTML. */
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Line icons on a 20px grid (the Battlefield site's stroke style).
const PATHS = {
  sun: "M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4",
  moon: "M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z",
  github: "M7.5 17c-4 1.2-4-2-5.5-2.5m11 4.5v-3a2.6 2.6 0 0 0-.7-2c2.4-.3 4.9-1.2 4.9-5.3a4.1 4.1 0 0 0-1.1-2.8 3.8 3.8 0 0 0-.1-2.8s-.9-.3-2.9 1.1a10 10 0 0 0-5.2 0C5.9 2.8 5 3.1 5 3.1a3.8 3.8 0 0 0-.1 2.8 4.1 4.1 0 0 0-1.1 2.8c0 4.1 2.5 5 4.9 5.3a2.6 2.6 0 0 0-.7 2v3",
  play: "m6 4 10 6-10 6Z",
  down: "M10 3v13M5 11l5 5 5-5",
  out: "M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8",
  sound: "M3 8h3l4-3v10l-4-3H3ZM13 7.5a3.5 3.5 0 0 1 0 5M15 5a7 7 0 0 1 0 10",
  mute: "M3 8h3l4-3v10l-4-3H3ZM13 8l4 4M17 8l-4 4",
  book: "M4 3h9a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3ZM4 14a3 3 0 0 1 3-3h9",
  bolt: "M11 2 4 11h5l-1 7 7-9h-5Z",
  grid: "M3 3h14v14H3ZM3 8h14M3 13h14M8 3v14M13 3v14",
  code: "M7 5 2 10l5 5M13 5l5 5-5 5",
  copy: "M7 7h10v10H7ZM3 13V3h10",
  recall: "M4 10a6 6 0 1 0 2-4.5M4 3v3h3",
  fire: "M10 1v5M10 14v5M1 10h5M14 10h5",
  check: "M4 10.5 8 14.5 16 5.5",
  cart: "M4 2h9l3 3v13H4ZM7 2v5h6V2M7 13h6M7 16h6",
};
export const icon = (name, size = 20) =>
  `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

/** The Fizlet mark: three pixel bubbles fizzing up a grid tile, one popping (pink). */
export const mark = (size = 40) =>
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" shape-rendering="crispEdges"><path d="M0 16h64M0 32h64M0 48h64M16 0v64M32 0v64M48 0v64" stroke="#19f0ff" stroke-opacity=".35"/><rect x="1" y="1" width="62" height="62" fill="none" stroke="#19f0ff" stroke-width="2"/><g fill="currentColor"><path fill-rule="evenodd" d="M8 30h26v26H8Zm7 7v12h12V37Z"/><path d="M36 18h14v14H36ZM40 40h8v8h-8Z"/></g><path d="M52 6h6v6h-6ZM46 6h3v3h-3ZM58 14h3v3h-3Z" fill="#ff2e88"/></svg>`;

const NAV = [
  ["contract", "Contract"],
  ["bricks", "Bricks"],
  ["recall", "Recall"],
  ["games", "Games"],
  ["roadmap", "Roadmap"],
];

/**
 * A full page. `base` is the path back to the site root ("./" for top-level pages, "../" one
 * level down, "/fizlet/" for the 404 page, which can be served at any depth).
 */
export function page({ title, description, base, version, body, scripts = [], path = "" }) {
  const home = base;
  const nav = NAV.map(([id, label]) => `<a href="${home}#${id}">${label}</a>`).join("");
  return `<!doctype html>
<html lang="en" class="bui" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta name="theme-color" content="#07060f">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<link rel="icon" href="${base}icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}board-ui.css">
<link rel="stylesheet" href="${base}site.css">
<script>try{var t=localStorage.getItem("dom-virus:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="${home}" aria-label="Fizlet home">
      <span class="brand-mark">${mark(40)}</span>
      <span class="brand-text"><small>DOM ENGINE<i>V${esc(version)}</i></small><b>FIZLET</b></span>
    </a>
    <nav class="site-nav" aria-label="Site">${nav}</nav>
    <div class="head-keys">
      <a class="bui-key bui-icon-key gh" href="${REPO}" aria-label="Source on GitHub">${icon("github")}</a>
      <button class="bui-icon-key" type="button" data-theme-toggle aria-label="Switch light or dark"><span class="theme-dark">${icon("moon")}</span><span class="theme-light">${icon("sun")}</span></button>
      <a class="bui-key bui-arcade bui-go start-key-sm" href="${home}#start">${icon("play", 16)}Start</a>
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-brand">
      <a class="brand" href="${home}">
        <span class="brand-mark">${mark(40)}</span>
        <span class="brand-text"><small>DOM ENGINE</small><b>FIZLET</b></span>
      </a>
      <p>Tiny physics for your page. A micro game engine for the DOM by coded.design: the page is the board, and it always comes back.</p>
    </div>
    <div>
      <h4>ENGINE</h4>
      <ul>
        <li><a href="${home}#contract">The contract</a></li>
        <li><a href="${home}#bricks">Kernel and bricks</a></li>
        <li><a href="${home}#recall">Recall</a></li>
        <li><a href="${home}#roadmap">Roadmap</a></li>
        <li><a href="${home}examples/quick-start.html">Quick start example</a></li>
      </ul>
    </div>
    <div>
      <h4>PROJECT</h4>
      <ul>
        <li><a href="${REPO}">Source on GitHub ↗</a></li>
        <li><a href="${REPO}/blob/main/CHANGELOG.md">Changelog ↗</a></li>
        <li><a href="${REPO}/blob/main/src/ui/BOARD-UI.md">Board UI spec ↗</a></li>
        <li><a href="${ENGINE_PLAN}">Engine plan ↗</a></li>
      </ul>
    </div>
    <div>
      <h4>BUILT ON IT</h4>
      <ul>
        <li><a href="${BLITZ}">Battlefield Blitz ↗</a></li>
        <li><a href="${BATTLEFIELD}">DOM Battlefield ↗</a></li>
        <li><a href="${HUB}">DOM VIRUS arcade ↗</a></li>
      </ul>
    </div>
  </div>
  <div class="foot-base">
    <div class="wrap"><span>© 2026 coded.design · MIT licence · no runtime dependencies</span><span>Created by Chris Cooley</span></div>
  </div>
</footer>
${scripts.map((s) => `<script type="module" src="${base}${s}"></script>`).join("\n")}
</body>
</html>
`;
}
