# BobbyBuilds

The home of the small, honest tools I'm building in public, at **[bobbybuilds.app](https://bobbybuilds.app)**.

It's two things in one app:

- **A public indie page** that shows each project, how many people visit it, and what I've shipped.
- **A private analytics dashboard** ("BobbyBuilds HQ") that every project reports to. It's cookie-free and stores no personal data, and the numbers on the public page come from it.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) on [Cloudflare Workers](https://workers.cloudflare.com), deployed with [OpenNext](https://opennext.js.org/cloudflare).
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) for page views, events and daily roll-ups, and Workers KV for the public page's snapshot.
- A tiny cron Worker (`cron/`) that triggers the scheduled jobs through a service binding.
- Tailwind CSS, Geist, and server-rendered SVG charts (no chart library).
- Vitest, running inside the Workers runtime against a fresh D1 with every migration applied.

## How it works

### The tracker (`t.js`)

Each site adds one script tag (BobbyBuilds' own public pages included: it tracks itself, shown in the dashboard only):

```html
<script defer src="https://bobbybuilds.app/t.js" data-key="pk_…"></script>
```

`t.js` (source in `src/tracker/`, kept under 6 KB) sends:

- **Page views**, including client-side navigation, with how long the page was visible and how far it was scrolled.
- **Built-in events**: outbound link clicks (domain only), file downloads, 404 pages and form starts and submits.
- **Custom events**, via `bobby.track("event_name", { … })`.
- **Core Web Vitals**, loaded separately after the page has loaded (`t-vitals.js`).

It never sets cookies, and it never sends the query string, apart from `ref` and `utm_*` for tracked links. Its only use of local storage is reading a "don't count my visits" flag that the site owner sets on their own browser, by opening a page with `#bobby-ignore` at the end of the address (`#bobby-count` clears it).

### The collector (`/v1/pv`, `/v1/events`, `/v1/metrics`)

- **From the browser:** requests need the project's **public key** and an `Origin` that exactly matches one of the project's allowed websites.
- **From a product's server:** requests use `Authorization: Bearer sk_…`. Secret keys are stored only as hashes, and one that arrives from a browser is refused.
- **Validation:** every field is checked for type and length, and requests are rate limited.
- **Referrers:** only the referrer's **domain** is kept.
- **Visitors:** a visitor is counted with a **daily ID**: a hash of a secret that changes every day, the IP address, the user agent and the project. The IP address itself is never stored, and yesterday's secret is deleted, so visitors can't be followed from one day to the next.

Logic lives in `src/lib/collector/`, as handlers that tests call directly.

### Scheduled jobs and the public page

- **Every 5 minutes:** the cron Worker runs uptime checks.
- **Every 10 minutes:** it rebuilds today's daily roll-up and the public snapshot.
- **Hourly:** it fetches the GitHub contribution calendar.
- **Every night:** it finalises yesterday, rotates the daily secret, and deletes raw page views and events older than 90 days. The daily roll-ups are kept.
- **The public page** reads only the public snapshot (built from the roll-ups and the numbers each project chooses to make public), so a visit never touches raw data.

### The dashboard

The dashboard is protected by **Cloudflare Access**, and the app also checks Access's signed token itself, so it stays shut even if Access were misconfigured. Every admin page and server action re-checks access.

## Privacy

- **No cookies** and no fingerprinting beyond the daily ID above. Visitors' browsers store nothing (the one local-storage flag is only ever set by the owner, to leave out their own visits).
- **No personal data:** no IP addresses, names or email addresses are stored.
- **Global Privacy Control and Do Not Track are respected:** with either on, `t.js` sends nothing, and the collector stores nothing even if a request arrives.
- **Retention:** raw page views and events are deleted after 90 days.
- **Security headers:** strict headers and a Content Security Policy on every page, with no third-party scripts.

## Running it locally

You’ll need Node.js 20.9 or later (it’s developed on Node 24), and a free Cloudflare account if you want to deploy.

```bash
npm install
cp .dev.vars.example .dev.vars   # local secrets: fill in, never commit
npm run db:migrate:local         # create the local D1 database
npm run seed:demo                # optional: made-up data for the dashboard
npm run preview                  # build and run on the local Workers runtime, http://localhost:8787
```

To open the dashboard locally, add `LOCAL_ADMIN_PREVIEW=on` to `.dev.vars`. It only works on `localhost`, so it can never open the live site. Then go to `http://localhost:8787/admin`.

To try the tracker against your local copy, run `npm run playground` alongside `npm run preview`. It starts a test site on `http://localhost:5555` that sends page views to it.

### Useful commands

```bash
npm run verify           # check-env, typecheck, lint and every test (run before committing)
npm test                 # the test suite only
npm run test:collector   # collector and tracker tests
npm run keys:create -- <slug>   # make a project's keys (the secret is shown once)
npm run deploy           # build and deploy the app
npm run deploy:cron      # deploy the cron Worker
```

### Secrets

Secrets live only in `.dev.vars` (ignored by Git) locally, and as Worker secrets (`npx wrangler secret put NAME`) in production. `.dev.vars.example` lists the names. `npm run check-env` runs before every build and deploy, and refuses if a secret ends up anywhere it shouldn't.

## Licence

[MIT](LICENSE) © 2026 Wahab Ali Khan
