# fizlet-site

fizlet.com on [Astro](https://astro.build): the Fizlet website, rebuilt from the custom build in
coded-dot-design/fizlet `site/`. Private. Self-contained: this folder becomes the root of
`fizlet/fizlet-site` as is.

```sh
npm ci
npm run dev            # http://localhost:4321/
npm run gates          # validate:content, test, typecheck, build, audit, browse
```

| Script | What it does |
|---|---|
| `validate:content` | tokens.css current with tokens.json, every legacy route planned, MIGRATION.md current, page data and vendored runtime files whole |
| `test` | unit tests (node:test) |
| `typecheck` | `astro check` |
| `build` | the static site into `dist/`; `PUBLIC_ROBOTS=noindex` makes a staging build |
| `audit` | the built pages against the site rules (title, description, canonical, one h1, JSON-LD, noindex on staging only) and the source (no `<style>` blocks, no colour literals) |
| `browse` | every built page in Chromium at 1440 and 390, dark and light: no console errors, no failed requests, no overflow, no dead internal links |
| `tokens` | writes `src/styles/tokens.css` from `src/design/tokens.json` |
| `migration` | writes MIGRATION.md's route inventory |
| `export:legacy` | re-exports page data from a legacy build (`-- ../site-dist`) |
| `compare` | pixel diff against the legacy site (`-- <legacyUrl> <newUrl> <outDir> [--full]`) |

Hosting (Cloudflare Pages, project `fizlet-site`, production branch `production`):
PR → preview (staging build, noindex) · main → staging.fizlet.com · `Deploy` workflow_dispatch
(promote) → fast-forwards `production` to a green main SHA and deploys fizlet.com. The deploy jobs
skip with a notice until the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
are set. staging.fizlet.com: a CNAME to `main.fizlet-site.pages.dev` (the `main` branch alias).

The migration plan and the route inventory: [MIGRATION.md](MIGRATION.md).
