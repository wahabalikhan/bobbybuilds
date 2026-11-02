# Bobby Builds

Wahab's indie page and private analytics HQ. Next.js on Cloudflare Workers (OpenNext) with D1.

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in locally; never commit
npm run dev                      # Next.js dev server (Access check skipped in dev only)
npm run preview                  # build and run on the local Workers runtime
npm run verify                   # check-env, typecheck, lint, tests (run before committing)
npm run db:migrate:local         # apply migrations to the local D1
npm run keys:create -- portfolio # create a project's keys (add --remote for the live database)
npm run deploy                   # build and deploy to workers.dev
```

Rules and conventions: [CLAUDE.md](CLAUDE.md). Protecting /admin: [docs/access-setup.md](docs/access-setup.md).
