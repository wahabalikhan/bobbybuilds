# Roadmap

Bobby Builds is built in phases. Each phase starts with a plan and ends with a test list. This file is updated at the end of every phase.

| # | Phase | Status |
| --- | --- | --- |
| 1 | Setup | ✅ Done (`df8e5f2`, `609e211`) |
| 2 | Database | ✅ Done (`a4dcb67`, `62f3258`) |
| 3 | Collector | ✅ Done (`47b8997`, `086c708`) |
| 4 | Daily job | ✅ Done (`27c3128`) |
| 5 | Private dashboard | ✅ Done (`fcffc1c`, `169459c`, `a76d7c6`, `daef9d1`) |
| 6 | Public indie page | ✅ Done (`e858e83`) |
| 7 | Connect my portfolio | ✅ Done (portfolio `cada9b5`, `5428cdb`) |
| 8 | Connect the job board | Not started |
| 9 | Launch | In progress: custom domain and Access done (`bae426a`, `3a4d5e1`, `ea1f04c`) |

## 1. Setup ✅

Scaffold, CLAUDE.md, D1, `lib/site.ts`, secret safety, security headers, and the `/admin` JWT check. Cloudflare Access comes later via a custom domain; for now there's a local admin preview.

- `df8e5f2`: scaffold, D1, `src/lib/site.ts`, check-env, security headers and CSP, the Access JWT check, deploy to workers.dev
- `609e211`: local-only admin preview (`LOCAL_ADMIN_PREVIEW`, loopback only); custom-domain Access steps in `docs/access-setup.md`

## 2. Database ✅

`projects`, `page_views` (with ref, UTM, country, browser, OS, screen, language, engaged time, scroll depth), `events`, `daily_secret`, `uptime_checks`, `github_weekly`, roll-ups, `metrics`, `journey_entries`, `milestones`; keys script.

- `a4dcb67`: migrations 0001–0003, seed for Portfolio and Job Board, `keys:create`, 113 schema and helper tests
- `62f3258`: portfolio comment events allowed from the browser (0004); package made ESM

## 3. Collector ✅

`/v1/pv`, `/v1/events`, `/v1/metrics`, daily visitor ID, and `t.js` with all the tracking extras:

- outbound link clicks
- file downloads
- 404s
- Core Web Vitals
- form drop-off

Plus rate limiting and `test:collector`.

- `47b8997`: the three endpoints, the daily visitor ID, `t.js` (SPA views, engaged time, scroll depth, Core Web Vitals, outbound clicks, downloads, 404s, `bobby.track` for custom and form events), GPC and DNT, rate limits, migration 0005 for the vitals columns, the playground, and 251 tests.
- `086c708`: web-vitals moved into `t-vitals.js`, which loads after the page. `t.js` went from 12.2 KB to 3.8 KB (1.9 KB gzipped).

## 4. Daily job ✅

- Roll-ups and daily secret rotation.
- 90-day clean-up, including uptime checks.
- GitHub weekly commits and 5-minute uptime pings.
- The cron Worker, plus `test:rollup`.

- `27c3128`:
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

- `fcffc1c` (5a):
  - Overview and project dashboards: all tabs, including Events with CSV.
  - `seed:demo` and `admin:live`.
  - GitHub history backfill.
  - 334 tests.
- `169459c`: the LIVE DATA banner is always shown on `admin:live` (pinned, inline-styled), CSS loads on loopback, and `test:admin-live` checks it end to end.
- `a76d7c6`: the restyle after the reference indie page (white cards, pills, monochrome charts, unfinished periods dashed).
- `daef9d1` (5b):
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

- `e858e83`:
  - Home (profile panel with photo and bio, headline card, project cards, compact list, latest journey entries), `/p/[slug]`, `/journey` and `/journey/[slug]`.
  - The public snapshot in KV, written only when it changes (at most about 144 writes a day). It replaces Next.js page caching, which would have needed up to about 4,300 KV writes a day.
  - Share images, the sitemap, and noindex until launch.
  - Accent `#1D4ED8`.
  - 397 tests.
  - Deployed to workers.dev.
- The build-updates form moved to the Backlog in CLAUDE.md, at your request.

## 7. Connect my portfolio ✅

Instructions only (t.js, `bobby.track` browser events, CSP changes, privacy note), applied in the portfolio repo.

- **Instructions:** `docs/connect-portfolio.md`.
- **Prepared branch:** `connect-bobby-builds` (commit `cada9b5`) in `~/Desktop/portfolio-bobby-builds`. It has the snippet, `case_study_read` (75% scrolled and 20 seconds), `contact_click` on the mailto links, a footer privacy note and a report-only CSP.
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
  - `bae426a`:
    - `bobbybuilds.app` as a Workers custom domain (the bare domain only) and `site.url`.
    - `www` redirects to it with a 301.
    - `docs/access-setup.md` rewritten.
    - A "Domain plan" in CLAUDE.md keeps `techjobs.`, `mail.` and Email Routing clear.
  - `3a4d5e1`: a self-hosted Access app on `bobbybuilds.app` for the paths `admin` and `admin/*`. One email address, one-time PIN, team `bobbybuilds.cloudflareaccess.com`. The JWT check still runs behind it.
  - Portfolio `46acbe4`: the snippet, footer link and CSP moved to `bobbybuilds.app`.
  - The job board's `HQ_URL` was switched on its Worker and in Supabase. No code changes.
  - `ea1f04c`: workers.dev closed (error 1042). A test keeps `workers_dev` and `preview_urls` off.
  - Tested:
    - Public pages are open, with noindex.
    - `/admin` asks for the email, and only that one gets in.
    - The cron's uptime checks are up for both sites.
    - Both sites' data arrives at the new address.
