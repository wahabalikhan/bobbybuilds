# Bobby Builds (HQ)

A public indie page showcasing Wahab and his projects, plus a private analytics dashboard at the admin path that every product reports to. Next.js App Router (TypeScript) on Cloudflare Workers via OpenNext, with Cloudflare D1.

## Rules (non-negotiable)

- No cookies and no personal data. Never store IP addresses, names or emails.
- Daily visitor ID = hash of today's secret + IP + user agent + project. Replace the secret daily and delete the old one.
- Product secret keys are stored only as hashes. Secrets never go in browser code, Git or NEXT_PUBLIC_ variables.
- /v1/pv only accepts requests from each project's registered origins, is rate limited, validates every field's type and length, stores only the referrer's domain, and sends nothing when Global Privacy Control is on.
- Every D1 query uses bound parameters. Every schema change is a migration.
- Public pages read only daily roll-ups, cached for 10 minutes. Raw page views and events are deleted after 90 days.
- Journey entries are Markdown, sanitised before display. Strict security headers, including a CSP, on every page.
- Plain, friendly copy in UK English.

## How we work

- Work in phases. Show a plan before each phase and wait for the go-ahead.
- At the end of each phase, stop, list what to test, and wait.
- Run `npm run verify` (check-env, typecheck, lint) before every commit.

## Layout and conventions

- `src/lib/site.ts`: the only place for the site name, URL and admin path. Never hard-code them elsewhere; import `site` / `adminHref()`.
- `src/middleware.ts`: security headers on every page, and the Cloudflare Access JWT check for the admin path. It uses edge middleware rather than Next 16's `proxy.ts`, because OpenNext only officially supports edge middleware on Cloudflare. Ignore the deprecation warning.
- Admin pages live in `src/app/admin/`. If `site.adminPath` changes, the middleware rewrites the new path to it and hides `/admin`. Admin API routes also go under the admin path, so the same check covers them.
- `src/lib/security/`: CSP and headers (`headers.ts`) and the Access JWT check (`access.ts`).
- `migrations/`: D1 migrations (`npx wrangler d1 migrations create bobbybuilds-db <name>`). Apply with `npm run db:migrate:local` / `db:migrate:remote`.
- D1: always `env.DB.prepare(sql).bind(...)`. Never build SQL with string concatenation or template literals containing values.
- Bindings: get them with `getCloudflareContext()` from `@opennextjs/cloudflare`. Run `npm run cf-typegen` after changing `wrangler.jsonc`.

## Security headers and CSP

- Public pages are cached, so they get a fixed CSP with no nonce (`script-src 'self' 'unsafe-inline'`, plus `default-src 'self'`, `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `connect-src 'self'`). Never add third-party scripts to public pages. Never render unsanitised HTML.
- Admin pages render per request (`await connection()` in the admin layout) with a per-request nonce and `'strict-dynamic'`. Admin responses are `Cache-Control: private, no-store`.
- If a public page needs a third-party origin (for example Buttondown for the build updates form), add it to the specific directive only.

## Secrets

- Local: `.dev.vars` (ignored by Git). Production: `npx wrangler secret put NAME`. Names only in `.dev.vars.example`.
- Never in `.env*`, `NEXT_PUBLIC_*`, `wrangler.jsonc` vars, or Git. `npm run check-env` runs before build, deploy, upload and preview, and refuses if this is broken.
- `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are not secret and live in `wrangler.jsonc` vars. The admin path refuses every request while either is empty.
- Until there's a custom domain with a path-based Access app, live /admin is always 403. Locally, `LOCAL_ADMIN_PREVIEW=on` in `.dev.vars` opens it with `npm run preview`, on loopback hostnames only (`src/lib/security/local-admin.ts`). Never weaken the loopback check or move the flag anywhere else. check-env enforces this.

## Deploying

- Lives on workers.dev for now (`workers_dev: true`, `preview_urls: false`). Preview URLs stay off.
- `npm run deploy`. Access setup steps are in `docs/access-setup.md`.
- Build updates email form (Phase 6) posts straight to an external newsletter tool (such as Buttondown). HQ never sees or stores the address.
