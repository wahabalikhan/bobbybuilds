# BobbyBuilds

Wahab's indie page and private analytics HQ. Next.js on Cloudflare Workers (OpenNext) with D1.

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in locally; never commit
npm run dev                      # Next.js dev server (Access check skipped in dev only)
npm run preview                  # build and run on the local Workers runtime
npm run verify                   # check-env, typecheck, lint, tests (run before committing)
npm run db:migrate:local         # apply migrations to the local D1
npm run keys:create -- portfolio # create a project's keys (add --remote for the live database)
npm run test:collector           # collector and tracker tests only
npm run playground               # local test site on :5555 (run alongside npm run preview)
npm run test:rollup              # daily job and cron Worker tests only
npm run seed:demo                # 120 days of made-up data in the LOCAL database (for the dashboard)
npm run admin:live               # the dashboard and settings on 127.0.0.1:8788 against the LIVE database (red banner)
npm run test:admin-live          # end-to-end check that admin:live always shows the LIVE DATA banner
npm run deploy                   # build and deploy to bobbybuilds.app (needs ROLLUP_SECRET set)
npm run deploy:cron              # deploy the cron Worker (cron/)
```

Rules and conventions: [CLAUDE.md](CLAUDE.md). Protecting /admin: [docs/access-setup.md](docs/access-setup.md).
