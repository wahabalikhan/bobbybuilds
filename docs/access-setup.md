# Protecting /admin with Cloudflare Access

Live address: `https://bobbybuilds.wahab-ali-khan.workers.dev`

Two locks guard /admin:

1. **Cloudflare Access** (at Cloudflare's edge) asks you to log in before the request reaches the Worker.
2. **The app's own check** (`src/middleware.ts`) verifies the signed JWT that Access attaches. Until `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set, /admin refuses everyone with a 403. That's what you see now.

Only /admin should be behind Access. The public pages must stay open.

---

## Step 1: Turn on Access for the workers.dev address

1. Go to **dash.cloudflare.com**, then **Workers & Pages**, then select **bobbybuilds**.
2. Open **Settings**, then **Domains & Routes**.
3. Find the **workers.dev** row (`bobbybuilds.wahab-ali-khan.workers.dev`). Open its **⋯** menu, or the toggle beside it, and choose **Enable Cloudflare Access**.
   - If you've never used Zero Trust, Cloudflare asks you to pick a **team name** first, for example `wahab`. Your team domain is then `https://wahab.cloudflareaccess.com`. The Free plan is fine (up to 50 users).
4. A box appears showing two values. **Copy both now**:
   - `POLICY_AUD`: a long hex string. This is your `ACCESS_AUD`.
   - `TEAM_DOMAIN`: `https://<team>.cloudflareaccess.com`. This is your `ACCESS_TEAM_DOMAIN`.

Leave **Preview URLs** alone. They're switched off in `wrangler.jsonc` (`preview_urls: false`), so there's nothing to protect there.

## Step 2: Limit Access to /admin only (important)

The one-click option protects the **whole** workers.dev address, public pages included. Narrow it:

1. In the same box (or the workers.dev row), click **Manage Cloudflare Access**. This opens the application in the Zero Trust dashboard (**one.dash.cloudflare.com**, then **Access controls**, then **Applications**).
2. Open the application for `bobbybuilds.wahab-ali-khan.workers.dev` and click **Edit** (or **Configure**).
3. Under **Application destinations** (called **Public hostnames** in some versions), find the `bobbybuilds.wahab-ali-khan.workers.dev` entry and set **Path** to `admin`.
4. Click **+ Add public hostname** (or **Add destination**) and add the same hostname again with **Path** `admin/*`, so every page under /admin is covered too.
5. **Save**.

> **If you can't set a path there:** delete that application and create one by hand. Go to **Access controls**, **Applications**, **Add an application**, then **Self-hosted**. Fill in:
> - Name: `Bobby Builds admin`
> - Destinations: subdomain `bobbybuilds`, domain `wahab-ali-khan.workers.dev`, path `admin`, and a second destination with path `admin/*`
> - Session duration: `24 hours`
>
> Use the policy from Step 3. The AUD is under **Overview** (or **Basic information**) as **Application Audience (AUD) Tag**.

## Step 3: Check the policy lets only you in

1. In the application, open **Policies** (or **Access policies**).
2. There should be one **Allow** policy. Make sure its rule is **Include → Emails →** your email address only. Remove anything broader, such as "Everyone" or a whole email domain.
3. Under **Login methods**, keep **One-time PIN** on (Cloudflare emails you a code). You can add GitHub or Google later if you prefer.
4. **Save**.

## Step 4: Give the app the two values

Edit `wrangler.jsonc`:

```jsonc
"vars": {
	"ACCESS_TEAM_DOMAIN": "https://<team>.cloudflareaccess.com",
	"ACCESS_AUD": "<the long POLICY_AUD value>"
}
```

Then deploy:

```bash
npm run deploy
```

Neither value is a secret (the AUD travels inside every JWT), so it's fine to commit them.

## Step 5: Test it

| Check | Expected |
| --- | --- |
| Private window, open `https://bobbybuilds.wahab-ali-khan.workers.dev/` | Public page loads, no login |
| Private window, open `/admin` | Cloudflare Access login, then a one-time PIN to your email, then "You're in" |
| Same in a different browser, entering a different email | No PIN arrives and you're not let in |
| `curl -i https://bobbybuilds.wahab-ali-khan.workers.dev/admin` | Redirect to `*.cloudflareaccess.com` (Access is working) |
| `curl -i -H "Cf-Access-Jwt-Assertion: fake" .../admin` | Still the Access redirect. If Access were ever off, the app would answer 403. |
| `/api/health` | `{"ok":true,"db":"connected"}`, no login |

## Later: moving to a real domain

When the site moves (for example to `build.wahabalikhan.com`):

1. Change `url` in `src/lib/site.ts`.
2. Add the custom domain in `wrangler.jsonc`.
3. Point the Access application's destination at the new hostname, keeping the `admin` and `admin/*` paths.
4. Consider `workers_dev: false`.

The AUD stays the same if you edit the existing application.

If you change `adminPath` in `src/lib/site.ts`, update the Access paths to match **before** deploying.
