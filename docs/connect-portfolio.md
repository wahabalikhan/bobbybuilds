# Connecting the portfolio (wahabalikhan.com)

The changes are ready on the branch **`connect-bobby-builds`** in a fresh clone at **`~/Desktop/portfolio-bobby-builds`** (commit `cada9b5`). It's built from `origin/main`. Your own working copy at `~/Desktop/portfolio` has uncommitted changes and wasn't touched.

Already done in BobbyBuilds (live):

- Portfolio keys exist. Public key: `pk_ofc9Edalhytt9Qvmshz3Wan3`.
- Origins `https://wahabalikhan.com` and `https://www.wahabalikhan.com` are registered.
- These browser events are allowed: `case_study_read`, `contact_click`, `comments_opened` and `comment_posted`.
- The funnel is Home (`/`), then "Read a case study" (`case_study_read`), then Contact (`contact_click`).
- "Case studies read" stays private.

## What the branch changes (9 files)

| File | Change |
|---|---|
| `app/layout.js` | The `t.js` snippet in `<head>`. |
| `components/CaseStudyReadTracker.jsx` (new) | Sends one `case_study_read` `{ study }` when the visitor has reached 75% of the page **and** it's been on screen for 20 seconds or more. It sends once per page load. |
| `app/ai-workflow`, `git-diff`, `design-system`, `schemas` `/page.js` | `<CaseStudyReadTracker study="…" />` inside each page's main container. |
| `components/PageNav.js` | `contact_click` `{ via: "email", place: "nav" \| "menu" }` on both `mailto:` links. |
| `components/Footer.js` | A privacy note under the footer row, linking to the Portfolio's public BobbyBuilds page. |
| `public/_headers` | A **report-only** Content Security Policy (it logs problems but blocks nothing yet). |

Recorded automatically by `t.js`, with no code:

- page views, including client-side navigation;
- engaged time and scroll depth;
- Core Web Vitals;
- `file_download` for the CV PDF;
- `outbound_click` for LinkedIn and other external links;
- `not_found` (not used yet: the portfolio's 404 page has no `data-bobby-not-found`).

Every call is `window.bobby?.track(…)`, so nothing breaks if `t.js` is blocked or hasn't loaded. With Global Privacy Control or Do Not Track on, `t.js` sends nothing and `bobby.track` does nothing. No comment text, names or emails are ever sent.

**Checked before handing over:**

- `npm run build` succeeds and `_headers` is in `out/`.
- In Chrome, the built site sent:
  - the page view (path only);
  - `case_study_read` `{study: "git-diff"}` after scrolling and 20 seconds;
  - `contact_click` `{via: "email", place: "nav"}` on the mailto link.

  The collector refused them, because `localhost` isn't a registered origin, so no data was stored.
- The footer note was checked on desktop and mobile.

## Steps

### 1. Review and push the branch

```bash
cd ~/Desktop/portfolio-bobby-builds
git show --stat HEAD          # the 9 files above
git diff origin/main          # the full change
git push -u origin connect-bobby-builds
```

Cloudflare Pages builds a **preview deployment** for the branch. Its address is in the Pages dashboard, under Deployments. It looks like `https://connect-bobby-builds.<your-pages-project>.pages.dev`.

### 2. Let the preview send data (temporarily)

Run `npm run admin:live` in BobbyBuilds. Then go to **Settings**, **Portfolio**, **Origins**, add the preview's exact origin (for example `https://connect-bobby-builds.<your-pages-project>.pages.dev`), and save. Without this, the collector refuses the preview, which is correct: it only accepts registered origins.

### 3. Check the preview

With the browser's developer tools open (Console and Network):

1. **Every page:** the home page, each of the four case studies, Experience, the CV page and the blog-style pages.
   - **Console:** look for messages starting `[Report Only] Refused to …`. Each one names a source the CSP doesn't allow yet.
   - **Network:** `t.js` loads, and `POST …/v1/pv` returns **200**.
2. **Comments:** switch to Comment mode, then check that live cursors appear, comments load, and posting and liking work, with no CSP reports.
3. **GitHub cards and stack icons:** these load images from `cdn.jsdelivr.net` and `cdn.simpleicons.org`.
4. **A case study:** read one to 75% and wait 20 seconds. You should see `POST …/v1/events` with `case_study_read`.
5. **Contact:** click it (nav and the mobile menu). You should see `contact_click`.
6. **In `admin:live`:** open Portfolio, then the **Events** tab. The events appear within seconds. Page views appear on the Traffic tab after the next roll-up (within 10 minutes).
7. **Privacy:** turn on Global Privacy Control (Brave has it on already; in Firefox it's Settings, Privacy, "Tell websites not to sell or share my data"). Reload: **nothing** should be sent to `/v1`.

If the console shows `[Report Only]` messages, add the named source to the matching directive in `public/_headers`. The most likely one is a Supabase storage or avatar host under `img-src`. Commit, push, and check again.

### 4. Enforce the CSP

When the console is clear on every page, edit `public/_headers`. Rename the header from **`Content-Security-Policy-Report-Only`** to **`Content-Security-Policy`**, update the comment above it, commit and push. Check the preview once more: everything should still work, with no `Refused to …` errors.

### 5. Go live

Merge `connect-bobby-builds` into `main`. Your `~/Desktop/portfolio` working copy has uncommitted changes, so commit or stash them first, then `git pull` after the merge. Once production deploys:

- In `admin:live`, go to **Settings**, **Portfolio**, **Origins** and **remove the preview origin**.
- Visit `https://wahabalikhan.com` once with GPC off. Within 10 minutes, the Overview's "Portfolio has had no page views in 24 hours" warning clears, and the public page's numbers start moving.
- Uptime and GitHub commits were already being tracked. Nothing changes there.

## Later

- **Comment events** (`comments_opened`, `comment_posted`) are in the CLAUDE.md Backlog, with the exact places to add them once the comment system moves to Supabase anonymous sign-in.
- **Custom domain:** BobbyBuilds moved to `https://bobbybuilds.app`. The three portfolio changes are in `docs/access-setup.md`, Step 4. The key and origins stay the same.
- **A 404 page for the portfolio:** adding `data-bobby-not-found` to its 404 page would record broken links automatically.
