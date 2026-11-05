# Roadmap

BobbyBuilds is built in phases. Each phase starts with a plan and ends with a test list. This file is updated at the end of every phase.

| # | Phase | Status |
| --- | --- | --- |
| 1 | Setup | ✅ Done (`eb64096`, `2b3d6b7`) |
| 2 | Database | ✅ Done (`cd5a07e`, `2ecde7e`) |
| 3 | Collector | ✅ Done (`6763daa`, `85e020e`) |
| 4 | Daily job | ✅ Done (`fcb36cc`) |
| 5 | Private dashboard | ✅ Done (`b02e7f7`, `78ffe8e`, `29fc16d`, `4454882`) |
| 6 | Public indie page | ✅ Done (`34744e6`) |
| 7 | Connect my portfolio | ✅ Done (portfolio `cada9b5`, `5428cdb`) |
| 8 | Connect the job board | Not started |
| 9 | Launch | In progress: custom domain and Access done (`b2cbb96`, `09c5b40`, `fc88135`) |
| 10 | Public page redesign | ✅ Done (10a `9d5b21e`; 10b "BobbyBuilds public page redesign") |

## 1. Setup ✅

Scaffold, CLAUDE.md, D1, `lib/site.ts`, secret safety, security headers, and the `/admin` JWT check. Cloudflare Access comes later via a custom domain; for now there's a local admin preview.

- `eb64096`: scaffold, D1, `src/lib/site.ts`, check-env, security headers and CSP, the Access JWT check, deploy to workers.dev
- `2b3d6b7`: local-only admin preview (`LOCAL_ADMIN_PREVIEW`, loopback only); custom-domain Access steps in `docs/access-setup.md`

## 2. Database ✅

`projects`, `page_views` (with ref, UTM, country, browser, OS, screen, language, engaged time, scroll depth), `events`, `daily_secret`, `uptime_checks`, `github_weekly`, roll-ups, `metrics`, `journey_entries`, `milestones`; keys script.

- `cd5a07e`: migrations 0001–0003, seed for Portfolio and Job Board, `keys:create`, 113 schema and helper tests
- `2ecde7e`: portfolio comment events allowed from the browser (0004); package made ESM

## 3. Collector ✅

`/v1/pv`, `/v1/events`, `/v1/metrics`, daily visitor ID, and `t.js` with all the tracking extras:

- outbound link clicks
- file downloads
- 404s
- Core Web Vitals
- form drop-off

Plus rate limiting and `test:collector`.

- `6763daa`: the three endpoints, the daily visitor ID, `t.js` (SPA views, engaged time, scroll depth, Core Web Vitals, outbound clicks, downloads, 404s, `bobby.track` for custom and form events), GPC and DNT, rate limits, migration 0005 for the vitals columns, the playground, and 251 tests.
- `85e020e`: web-vitals moved into `t-vitals.js`, which loads after the page. `t.js` went from 12.2 KB to 3.8 KB (1.9 KB gzipped).

## 4. Daily job ✅

- Roll-ups and daily secret rotation.
- 90-day clean-up, including uptime checks.
- GitHub weekly commits and 5-minute uptime pings.
- The cron Worker, plus `test:rollup`.

- `fcb36cc`:
  - `/internal/jobs`, protected by `ROLLUP_SECRET`.
  - Roll-ups, including same-day repeat visitors, Core Web Vitals p75 and daily uptime.
  - Secret rotation and the 90-day clean-up.
  - GitHub weekly commits and 5-minute uptime pings.
  - `bobbybuilds-cron`, which calls the app through a service binding.
  - Migrations 0006–0007 and 291 tests.
  - Live since 2 November 2026; the first scheduled run was at 03:30 UTC.

## 5. Private dashboard ✅

- **Overview.**
- **Project dashboards:** tracked links, campaigns, countries, Core Web Vitals, uptime, shipping streak, and an Events tab with CSV export.
- **Settings:** projects, keys, origins, allowlists, public number switches, journey entries and milestones.

- `b02e7f7` (5a):
  - Overview and project dashboards: all tabs, including Events with CSV.
  - `seed:demo` and `admin:live`.
  - GitHub history backfill.
  - 334 tests.
- `78ffe8e`: the LIVE DATA banner is always shown on `admin:live` (pinned, inline-styled), CSS loads on loopback, and `test:admin-live` checks it end to end.
- `29fc16d`: the restyle after the reference indie page (white cards, pills, monochrome charts, unfinished periods dashed).
- `4454882` (5b):
  - Settings for projects, keys, origins, events and funnel, public numbers, milestones, journey and system.
  - Safe Markdown.
  - A test that every server action checks admin access first.
  - 386 tests.
  - Deployed with the restyle.

## 6. Public indie page ✅

- **Home:** a two-column layout. On the left, a profile panel with the bio. On the right, the headline chart, project cards with a pill number and trend, and a compact list for ideas and retired projects.
- Project pages and the journey page.
- 10-minute caching.
- A build-updates form that posts straight to a newsletter tool.

- `34744e6`:
  - Home (profile panel with photo and bio, headline card, project cards, compact list, latest journey entries), `/p/[slug]`, `/journey` and `/journey/[slug]`.
  - The public snapshot in KV, written only when it changes (at most about 144 writes a day). It replaces Next.js page caching, which would have needed up to about 4,300 KV writes a day.
  - Share images, the sitemap, and noindex until launch.
  - Accent `#1D4ED8`.
  - 397 tests.
  - Deployed to workers.dev.
- The build-updates form moved to the Backlog in CLAUDE.md, at your request.

## 7. Connect my portfolio ✅

Instructions only (t.js, `bobby.track` browser events, CSP changes, privacy note), applied in the portfolio repo.

- **Instructions:** a step-by-step handover (since removed: the steps are done).
- **Prepared branch:** `connect-bobby-builds` (portfolio commit `cada9b5`), in a fresh clone of the portfolio repo. It has the snippet, `case_study_read` (75% scrolled and 20 seconds), `contact_click` on the mailto links, a footer privacy note and a report-only CSP.
- **Live settings:** the Portfolio keys and funnel (Home → read a case study → Contact) are set.
- **Tested on the Pages preview:** page views, `case_study_read` and `contact_click` arrived. A report-only CSP produced no reports.
- **Portfolio `5428cdb`:** the CSP is enforced. I re-checked all 10 pages: no violations, Supabase comments load, and live cursors connect over the websocket.
- **Merged to `main`:** `wahabalikhan.com` serves the enforced CSP and the snippet (2 November 2026).
- **Origins:** the preview origins were removed. Portfolio's origins are back to `wahabalikhan.com` and `www`.
- **Clean-up:** a preview test session was deleted from the live data before the roll-up.
- **Comment events:** deferred to the Backlog until the portfolio's comment fix.

## 8. Connect the job board

Done in the job board repo during its Phase 10.

## 9. Launch

- README and MIT licence.
- A check of the Git history for secrets.
- Go public (`site.indexable: true`). Until then, noindex stays on.
- ✅ Custom domain and path-based Access for `/admin` (2 November 2026):
  - `b2cbb96`:
    - `bobbybuilds.app` as a Workers custom domain (the bare domain only) and `site.url`.
    - `www` redirects to it with a 301.
    - `docs/access-setup.md` rewritten.
    - A "Domain plan" in CLAUDE.md keeps `techjobs.` and email (hello@ on the bare domain) clear.
  - `09c5b40`: a self-hosted Access app on `bobbybuilds.app` for the paths `admin` and `admin/*`. One email address, one-time PIN, team `bobbybuilds.cloudflareaccess.com`. The JWT check still runs behind it.
  - Portfolio `46acbe4`: the snippet, footer link and CSP moved to `bobbybuilds.app`.
  - The job board's `HQ_URL` was switched on its Worker and in Supabase. No code changes.
  - `fc88135`: workers.dev closed (error 1042). A test keeps `workers_dev` and `preview_urls` off.
  - Tested:
    - Public pages are open, with noindex.
    - `/admin` asks for the email, and only that one gets in.
    - The cron's uptime checks are up for both sites.
    - Both sites' data arrives at the new address.
- ✅ Home page refresh and a simpler admin (2–3 November 2026):
  - `e66656b`, `3f5c828`, `9b21461`, `3e42a93`: custom dropdown and chart popovers, the GitHub contributions section (hourly, migration 0008), footer, project cards linking to each project, light mode only, project pages removed (`/p/*` → `/`), journey hidden behind `site.showJourney`.
  - `8cebe38`: hidden way to `/admin` (Option/Alt + A, or five taps on the copyright).
  - `3143ded`:
    - Admin: Home (Needs attention, the public visitors card, project cards), dashboard tabs (Traffic, Tracked links, Searches, Funnel, Product numbers, Health, Events), one Settings page per project, a three-step New project setup, test projects hidden.
    - What's public: visitors and each product number. Tech Jobs' card shows "open jobs · companies" (migration 0009).
    - The "BobbyBuilds" wordmark, and Option/Alt + A from admin back to the public site.
  - Tested live: the Tech Jobs card line and logo, the wordmark, the redirects, every admin tab against live data, a public-number change round trip through the admin, and both shortcuts.
- ✅ The simplest admin, and icons in their own shape (3 November 2026):
  - `ea1bd07`:
    - Top bar: "BobbyBuilds HQ" and a status pill ("Everything's running normally", or "<n> things need attention", which opens the list). No Settings link, no Needs attention block.
    - Home: the chart, "My projects (<n>)" with a "+" for the New project setup, the cards, the retention line in small print.
    - A project: Overview (visitors, top pages and sources in plain words, tracked links merged with what they read, searches, the funnel and health in one line each, and "More detail" closed by default) and Settings (About this project, On your public page, Connection closed by default, Delete at the bottom). Old `/admin/settings` addresses redirect.
    - Removed: the logo picker, health address and GitHub repo fields (columns kept), commit counts and the per-repo GitHub weekly job. Uptime checks the site address.
    - Icons everywhere have no container and keep their own shape (Portfolio's circle photo; the square original is in `public/logos/originals/`).
  - Job board `e5cd2f5`: the daily `open_jobs` and `active_companies` come from `board_stats()`, the same as the Tech Jobs trust line (before: no location filter, and careers-page companies being checked). Ingest function redeployed.
  - Tested: verify with a 13-page Chrome click-through; live public page icons and admin sign-in.
- ✅ BobbyBuilds tracks itself (4 November 2026):
  - `f927380`: migration 0010: `show_public` on projects, the `bobbybuilds` project (live, `https://bobbybuilds.app`, its public key in `site.trackerKey`, hidden from the public page), and the order BobbyBuilds, Portfolio, Tech Jobs.
  - t.js on the public pages only (home, 404, journey), never on admin pages. The 404 page now sends `not_found`.
  - Settings: "Show on my public page" (off: in nothing public, still everywhere in the admin) and Order. New projects go last.
  - "Don't count my visits": a switch at the bottom of admin Home for bobbybuilds.app, and a `#bobby-ignore` link to open once on each other site (`#bobby-count` to undo). t.js then sends nothing from that browser.
  - Tested live: migration applied first, then deployed. The public page and snapshot have only Portfolio and Tech Jobs, and t.js is on the public pages. Admin Home lists BobbyBuilds (not on public page), Portfolio, Tech Jobs.
- ✅ Cards, taglines and the wordmark (4 November 2026):
  - `82b6d5c`: the hand cursor on everything clickable (base styles), checked on every page by the click-through.
  - `052a261`: `glob` 10.5.0 for `@node-minify/core` (Dependabot's high alert). The two moderate ones wait for OpenNext, ESLint and typescript-eslint (Backlog).
  - `7b18b94`: round logos drawn 1.1× in the same box.
  - `fe540d9`: migration 0011. Numbers in taglines (Tech Jobs: "**4,868** real tech jobs, straight from **838** companies", with a fallback), no separate numbers line on public cards, the admin card's numbers on the visitors line, every card the same height in each place (public 200px, admin 218px at 1440px), and a text-only wordmark ("Bobby" and "Builds" semibold, "Builds" in the accent blue; "HQ" in the admin).
  - Tested live: the migration first, then the deploy; the public tagline, bold numbers, wordmark and card heights, and the admin cards against live data.

## 10. Public page redesign

An original, single-column public page (no longer modelled on IndiePage): Me, Projects, The honest numbers, The journey, and an optional Shipping rhythm. Black, grey and white, with colour only from screenshots, project and journey emojis, status dots and social icons on hover. Light and dark mode.

- **10a: data and admin** (`9d5b21e`, 5 November 2026; migration 0012 applied live and deployed; the live public page was checked unchanged):
  - Migration 0012: `profile` (This week, building since, shipping rhythm switch), project emoji, screenshot and alt text, case study link, outcomes and `is_paused`, journey `type` and `link_url`, and `money` (monthly costs and revenue in pence).
  - Admin: My public page on Home (Profile, Journey, Costs and revenue), the card form under each project's On your public page, Paused as a status, and the journey editor un-hidden with types, a short body and a link.
  - Screenshots come from `public/screenshots/` (no uploads).
  - The project Overview and Settings tabs read the database themselves instead of taking it as a prop (they hung under `next dev`).
- **10b: the public page** (commit "BobbyBuilds public page redesign", 5 November 2026; migration 0013 applied live, then deployed):
  - Snapshot version 5: the profile, `visitors30`, the latest month's money, each project's emoji, screenshot, case study link and filled outcomes, journey types, dates and links, and the shipping rhythm (replacing the raw GitHub calendar; only when it's switched on).
  - The new single-column home page: Me, Projects, The honest numbers, The journey and Shipping rhythm. A small monochrome wordmark at the top. No visitors chart at the top, no profile panel, no green GitHub grid.
  - Light and dark mode on the public pages, with no blue (ink links and focus ring). Footer icons are grey until hovered.
  - `/journey` and `/journey/*` → `/#journey` (permanent). The journey pages, their share images and `site.showJourney` are gone. The share image's blue bar is ink.
  - The GitHub contribution calendar is fetched by the daily job instead of hourly.
  - The new bio, Leeds and the email link in `owner`.
  - Revised the same day: jump links under the profile (to `#projects`, `#numbers`, `#journey`, `#activity`, with smooth scrolling); the old project cards back in two columns (status dot, emoji, the outcomes line, the 12-week chart restyled in monochrome with a new hover card, Try it and case study links; no screenshot); Activity (Shipping rhythm, Shipped entries per month, and GitHub activity, the contribution grid in greys) behind "Show my activity", replacing the shipping rhythm strip; brand-coloured icons in the profile and footer.
  - Revised again: Activity as two cards like the project cards; the GitHub grid fills its card (it had a fixed 440px minimum width and month labels spilling into extra columns) and shows fewer recent weeks to keep squares at 8px or more; the order Projects → Honest numbers → Activity → Journey; a shorter intro ("BobbyBuilds" large, "Wahab (Bobby) Khan, Leeds" small beside it and the icons on one line, then the new one-sentence bio 8px below); no This week line, no jump links and no Open to work pill; a "Now:" line per project. Migration 0013 (`0013_project_now.sql`: `now_text`, with This week moved into Tech Jobs' Now).
  - Final touches before the commit: no emoji on the cards, the case study link hidden when it's the project's own site, the whole card clickable (the name as a stretched link, ↗ on hover and focus, an outline round the card) instead of "Try it", and the heading at 64px (44px on phones).
- **Refinements** (6 November 2026, after `768053a`): the container at 900px; one accent blue on the public page (#2747D6, #8199F8 in dark mode: "Builds" in the heading and header, links on hover, card titles and ↗ on hover and focus, focus outlines, the card charts' line, the Shipping rhythm bars, the GitHub grid's levels and text selection); the heading at 700; the icons under the bio; every card 240px tall from `md` up (`CARD_HEIGHT`) with a 40px card chart; the GitHub grid restored to fill its width at the bottom of its card; the home header fixed and fading in only once the top of Projects reaches it, and out the same way.
