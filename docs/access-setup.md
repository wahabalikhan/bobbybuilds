# Protecting /admin

Live address: `https://bobbybuilds.wahab-ali-khan.workers.dev`

## Where things stand now

Cloudflare's one-click Access for Workers covers the **whole** Worker, with no path option. You also can't add a `workers.dev` hostname with a path to a self-hosted Access app. So until there's a custom domain, nothing protects /admin at the edge, and the app keeps it shut:

- **Live:** `/admin` always returns **403**. `src/middleware.ts` needs a valid Cloudflare Access JWT, and `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are empty, so nothing can pass.
- **Public pages** stay open (no Access app on the Worker).

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

## Later: custom domain and a path-based Access app

Do this once `wahabalikhan.com` (or another domain) is on Cloudflare. These steps use `build.wahabalikhan.com`.

### Step 1: Put the domain on Cloudflare

1. Go to **dash.cloudflare.com**, then **Add a domain**, enter `wahabalikhan.com` and choose the **Free** plan.
2. Check the DNS records Cloudflare imports. Keep any your portfolio and email need.
3. At your registrar, change the nameservers to the two Cloudflare gives you. Wait until the domain shows **Active** (minutes to a day).

### Step 2: Point the subdomain at the Worker

1. In `wrangler.jsonc`, add:
   ```jsonc
   "routes": [{ "pattern": "build.wahabalikhan.com", "custom_domain": true }],
   ```
2. In `src/lib/site.ts`, set `url: "https://build.wahabalikhan.com"`.
3. Run `npm run deploy`. Wrangler creates the DNS record and certificate. Check that `https://build.wahabalikhan.com` loads.

### Step 3: Create the Access application (path-based)

1. Go to **one.dash.cloudflare.com** (Zero Trust).
   - The first time, pick a **team name**, for example `wahab`. Your team domain is `https://wahab.cloudflareaccess.com`. The Free plan is fine.
2. Go to **Access controls**, then **Applications**, then **Add an application**, then **Self-hosted**.
3. **Basic information:**
   - Application name: `Bobby Builds admin`
   - Session duration: `24 hours`
4. **Destinations / Public hostnames.** Add two:
   - Subdomain `build`, domain `wahabalikhan.com`, path `admin`
   - Subdomain `build`, domain `wahabalikhan.com`, path `admin/*`
5. **Access policy.** Create a new policy:
   - Name: `Only Wahab`, Action: **Allow**
   - Include: **Emails**, then your email address. Nothing broader.
6. **Login methods:** keep **One-time PIN** (Cloudflare emails you a code).
7. **Save.** Open the application's **Overview** (or **Basic information**) and copy the **Application Audience (AUD) Tag**.

### Step 4: Give the app the two values

In `wrangler.jsonc`:

```jsonc
"vars": {
	"ACCESS_TEAM_DOMAIN": "https://<team>.cloudflareaccess.com",
	"ACCESS_AUD": "<the AUD tag>"
}
```

Neither value is a secret (the AUD is inside every JWT), so it's fine to commit them. Then `npm run deploy`.

### Step 5: Close the workers.dev address

`workers.dev` has no Access in front of it. /admin there would still return 403, because the JWT check stays on, but it's cleaner to close it. In `wrangler.jsonc`, set `"workers_dev": false`, keep `"preview_urls": false`, and deploy.

### Step 6: Test it

| Check | Expected |
| --- | --- |
| Private window: `https://build.wahabalikhan.com/` | Public page, no login |
| Private window: `/admin` | Access login, then a one-time PIN to your email, then "You're in" (no amber banner) |
| A different email at the login | No code arrives and you're not let in |
| `curl -i https://build.wahabalikhan.com/admin` | Redirect to `*.cloudflareaccess.com` |
| `curl -i https://build.wahabalikhan.com/admin/anything` | Redirect too (covered by `admin/*`) |
| `/api/health` | `{"ok":true,"db":"connected"}`, no login |
| `https://bobbybuilds.wahab-ali-khan.workers.dev/` | Gone, after Step 5 |

If you ever change `adminPath` in `src/lib/site.ts`, update both Access paths to match **before** deploying.
