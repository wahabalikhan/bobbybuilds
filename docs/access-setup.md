# Protecting /admin

Live address: `https://bobbybuilds.app` (Cloudflare Workers custom domain). The old workers.dev address was closed on 2 November 2026.

## How it works

- **Public pages** are open to everyone. There's no Access app in front of them, and they set no cookies.
- **`/admin` and everything under it** sits behind a self-hosted Cloudflare Access application with two paths, `admin` and `admin/*`. Only one email address is allowed in, and it signs in with a one-time PIN.
- **Behind Access**, `src/middleware.ts` also checks the Access JWT (`ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.jsonc`). If Access were ever switched off or misconfigured, `/admin` would return **403** rather than open. While either value is empty, `/admin` always returns 403.
- **Access cookie:** Access sets its own `CF_Authorization` cookie, only on `/admin` and only for you after you sign in. Public visitors never get it.

### Using /admin locally with `npm run preview`

1. Add this line to `.dev.vars`. It's ignored by Git and never uploaded by `wrangler deploy`:
   ```
   LOCAL_ADMIN_PREVIEW=on
   ```
2. Run `npm run preview` and open `http://localhost:8787/admin`.
   An amber banner reads "Local preview: Cloudflare Access is skipped on this machine only."
3. Remove the line (or set it empty) when you're done if you like. Leaving it is safe.

Why this can't open the live site:

- The skip only works when the request's hostname is `localhost`, `127.0.0.1` or `[::1]`. Cloudflare's edge only routes real hostnames to the Worker, so a live request never matches. Even locally, a request with the live hostname gets 403.
- `npm run check-env` (which runs before every build, preview and deploy) refuses if `LOCAL_ADMIN_PREVIEW` appears in:
  - any `.env*` file, because OpenNext bakes those into the bundle;
  - `wrangler.jsonc`;
  - the Worker's deployed secrets (checked on `npm run deploy`).

`npm run dev` (plain Next.js dev server) also opens /admin on localhost without the flag.

---

## Setting up bobbybuilds.app

The domain is registered at GoDaddy and its nameservers point to Cloudflare (`magali` and `tate`). In the Cloudflare dashboard, its status must show **Active** before you start.

### Step 0: Check DNS, and redirect www

1. Go to **dash.cloudflare.com**, click **bobbybuilds.app**, then **DNS**, then **Records**.
2. **Check what's there.** There must be no **A**, **AAAA** or **CNAME** record on `bobbybuilds.app` (`@`). Delete any you find: click **Edit**, then **Delete**.
   - **Don't delete the email records.** The MX records, the SPF TXT (`v=spf1 include:_spf.mx.cloudflare.net ~all`), `cf2024-1._domainkey`, `resend._domainkey`, the `send` and `rsend` CNAMEs and `_dmarc` belong to email (see "Email" below).
3. **Add a record for www**, so the redirect has something to catch:
   - Click **Add record**.
   - Type **AAAA**, Name `www`, IPv6 address `100::`, Proxy status **Proxied** (orange cloud).
   - Click **Save**.

   `100::` is a placeholder address. Cloudflare answers the request before it would ever go there.
4. **Add the redirect:**
   - In the left menu, click **Rules**, then **Overview**.
   - Click **Create rule**, then **Redirect Rule**.
   - Rule name: `www to bobbybuilds.app`.
   - Under **If incoming requests match**, choose **Wildcard pattern**. Request URL: `https://www.bobbybuilds.app/*`.
   - Under **Then**: Target URL `https://bobbybuilds.app/${1}`, Status code **301**, and tick **Preserve query string**.
   - Click **Deploy**.

Leave **Bot Fight Mode** off (**Security**, then **Bots**). On the Free plan it can't skip particular paths. It would challenge the job board's and Supabase's server requests to `/v1`.

### Email

One address, `hello@bobbybuilds.app`, for everything, with no `mail.` subdomain:

- **Receiving:** Cloudflare Email Routing forwards it to your personal inbox. It owns the MX records, the SPF TXT and DKIM `cf2024-1._domainkey` at the bare domain.
- **Sending:** Resend, verified on `bobbybuilds.app`. Its records are TXT `resend._domainkey`, plus CNAMEs `send` and `rsend` (DNS only). Its SPF sits behind those CNAMEs, so the bare domain keeps exactly **one** SPF record. Resend's Receiving and tracking stay off.
- **DMARC:** `_dmarc` is `v=DMARC1; p=none; rua=mailto:hello@bobbybuilds.app`. Move to `p=quarantine` after a couple of weeks of clean reports.

The full record list is in the "Domain plan" in CLAUDE.md.

### Step 1: Point the domain at the Worker (done in code)

- `wrangler.jsonc` has `"routes": [{ "pattern": "bobbybuilds.app", "custom_domain": true }]`. That's the bare domain only, never a wildcard.
- `site.url` in `src/lib/site.ts` is `https://bobbybuilds.app`.
- `npm run deploy` creates the DNS record (shown as type **Worker**) and the certificate.
- Check that `https://bobbybuilds.app` loads. It can take a minute or two the first time.
- Until Step 3, `/admin` there returns 403.

### Step 2: Create the Access application

1. Go to **one.dash.cloudflare.com** and pick your account.
2. **Check the team.** Go to **Settings**, then **Team name and domain**. It should say `bobbybuilds.cloudflareaccess.com`.
3. **Check the login method.** Go to **Settings**, then **Authentication**, and look under **Login methods**. **One-time PIN** should be listed. If it isn't, click **Add new**, then **One-time PIN**, then **Save**.
4. **Start the application.** Go to **Access controls**, then **Applications**, then **Add an application**, then **Self-hosted**.
5. **Basic information:**
   - Application name: `BobbyBuilds admin`
   - Session duration: `24 hours`
6. Click **Add public hostname**. Leave Subdomain blank, choose Domain **bobbybuilds.app**, and set Path `admin`.
7. Click **Add public hostname** again. Leave Subdomain blank, choose Domain **bobbybuilds.app**, and set Path `admin/*`.
8. **Access policies.** Click **Create new policy**. It may open in a new tab.
   - Policy name: `Only Wahab`
   - Action: **Allow**
   - Session duration: **Same as application session timeout**
   - **Add include**: Selector **Emails**, Value: your email address. Add nothing else.
   - Click **Save**. Back on the application tab, click **Select existing policies**, tick `Only Wahab`, then **Confirm**.
9. **Login methods:**
   - Turn off **Accept all available identity providers**.
   - Tick only **One-time PIN**.
   - Turn on **Instant Auth**, so it goes straight to the email prompt.
10. Click **Next**. Leave **Experience settings** and the cookie settings at their defaults, then click **Next** again and **Save**.
11. **Copy the AUD tag.** Go to **Applications**, click `BobbyBuilds admin`, then **Configure** (or **Overview**). Click the copy button next to **Application Audience (AUD) Tag**.

Never use a wildcard hostname (`*.bobbybuilds.app`) in this app. `techjobs.bobbybuilds.app` belongs to the job board (it redirects to `realtechjobs.co.uk`).

### Step 3: Give the app the two values

In `wrangler.jsonc`:

```jsonc
"vars": {
	"ACCESS_TEAM_DOMAIN": "https://bobbybuilds.cloudflareaccess.com",
	"ACCESS_AUD": "<the AUD tag>"
}
```

Neither value is a secret (the AUD is inside every JWT), so it's fine to commit them. Then run `npm run verify`, commit, and `npm run deploy`.

### Step 4: Move the portfolio to the new address

In the portfolio repo, change three places from `https://bobbybuilds.wahab-ali-khan.workers.dev` to `https://bobbybuilds.app`:

| File | Change |
| --- | --- |
| `app/layout.js` | `<script defer src="https://bobbybuilds.app/t.js" data-key="pk_ofc9Edalhytt9Qvmshz3Wan3"></script>` |
| `components/Footer.js` | The privacy link: `https://bobbybuilds.app/p/portfolio` |
| `public/_headers` | `script-src` and `connect-src` (and the comment above them) |

The key and origins in BobbyBuilds stay the same. The snippet and the CSP ship in the same Pages deploy, so they never disagree.

### Step 5: Move the job board to the new address (in its own repo)

The job board builds its CSP (`script-src` and `connect-src`) from `HQ_URL`, so no code changes are needed. Set it in both places it's used:

1. **The Worker.** In the job board's repo, run `npx wrangler secret list`.
   - If `HQ_URL` is listed, run `npx wrangler secret put HQ_URL` and enter `https://bobbybuilds.app`. This makes a new deployment by itself.
   - If it isn't listed, it's a `vars` entry in the job board's `wrangler.jsonc`. Change it there and deploy.
2. **Supabase.** The ingest function sends `/v1/metrics` from there:
   ```bash
   supabase secrets set HQ_URL=https://bobbybuilds.app
   ```
3. **The job board's CLAUDE.md:** update the address in the "BobbyBuilds HQ" section.

The job board now lives at `https://realtechjobs.co.uk` (`techjobs.bobbybuilds.app` redirects there), and both are its registered origins (migration 0023). Once the old address has had no visits for a while, remove it in Settings.

### Step 6: Close the workers.dev address

Do this only once Steps 4 and 5 are live and data is arriving from both.

- In `wrangler.jsonc`, set `"workers_dev": false` and keep `"preview_urls": false`. Then commit and deploy.
- The cron Worker reaches the app through a service binding, so it isn't affected.

### Step 7: Test it

| Check | Expected |
| --- | --- |
| Private window: `https://bobbybuilds.app/`, `/p/portfolio`, `/journey` | Public pages, no login |
| `curl -I https://bobbybuilds.app/` | `X-Robots-Tag: noindex, nofollow` (until launch) |
| `https://www.bobbybuilds.app/journey?x=1` | 301 to `https://bobbybuilds.app/journey?x=1` |
| Private window: `/admin` | Access login, then a one-time PIN to your email, then the dashboard (no amber banner) |
| A different email at the login | No code arrives and you're not let in |
| `curl -I https://bobbybuilds.app/admin` | 302 to `bobbybuilds.cloudflareaccess.com` |
| `curl -I https://bobbybuilds.app/admin/settings` | 302 too (covered by `admin/*`) |
| `/api/health` and `/t.js` | Open, no login |
| The portfolio, with developer tools open | `t.js` from bobbybuilds.app, `POST /v1/pv` 200, no CSP errors |
| The job board: run a search | It appears on the Job Board's Events tab |
| `https://bobbybuilds.wahab-ali-khan.workers.dev/` | Gone, after Step 6 |

If you ever change `adminPath` in `src/lib/site.ts`, update both Access paths to match **before** deploying.
