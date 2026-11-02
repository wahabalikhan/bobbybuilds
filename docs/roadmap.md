# Roadmap

Bobby Builds is built in phases. Each phase starts with a plan and ends with a test list. This file is updated at the end of every phase.

| # | Phase | Status |
| --- | --- | --- |
| 1 | Setup | ✅ Done (`df8e5f2`, `609e211`) |
| 2 | Database | ✅ Done (`a4dcb67`, `62f3258`) |
| 3 | Collector | ✅ Done (`47b8997`, `086c708`) |
| 4 | Daily job | ✅ Done (`27c3128`) |
| 5 | Private dashboard | 🚧 5a done (`fcffc1c`); 5b (settings) next |
| 6 | Public indie page | Not started |
| 7 | Connect my portfolio | Not started |
| 8 | Connect the job board | Not started |
| 9 | Launch | Not started |

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

## 5. Private dashboard 🚧

- **Overview.**
- **Project dashboards:** tracked links, campaigns, countries, Core Web Vitals, uptime, shipping streak, and an Events tab with CSV export.
- **Settings:** projects, keys, origins, allowlists, public number switches, journey entries and milestones.

- `fcffc1c` (5a):
  - Overview and project dashboards: all tabs, including Events with CSV.
  - `seed:demo` and `admin:live`.
  - GitHub history backfill.
  - 334 tests.
- 5b (next): settings for projects, keys, origins, allowlists, funnel steps, public numbers, journey entries, milestones and system.

## 6. Public indie page

- **Home:** a two-column layout. On the left, a profile panel with the bio. On the right, the headline chart, project cards with a pill number and trend, and a compact list for ideas and retired projects.
- Project pages and the journey page.
- 10-minute caching.
- A build-updates form that posts straight to a newsletter tool.

## 7. Connect my portfolio

Instructions only (t.js, `bobby.track` browser events, CSP changes, privacy note), applied in the portfolio repo.

## 8. Connect the job board

Done in the job board repo during its Phase 10.

## 9. Launch

- README and MIT licence.
- A check of the Git history for secrets.
- Go public.
- Custom domain and path-based Access for `/admin`.
