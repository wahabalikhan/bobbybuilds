/**
 * Local test kit for the collector. LOCAL DATABASE ONLY.
 *
 *   Terminal 1: npm run preview          (BobbyBuilds on http://localhost:8787)
 *   Terminal 2: npm run playground       (a test site on http://localhost:5555)
 *
 * Adds (or refreshes) a "playground" project in the local D1 with origin http://localhost:5555,
 * gives it a new secret key each run, and serves a page with the t.js snippet and buttons for
 * every kind of event.
 */
import { createServer } from "node:http";
import { getPlatformProxy } from "wrangler";
import { getProjectBySlug, setProjectKeys } from "../src/lib/db/projects.ts";
import { createPublicKey, createSecretKey, hashSecretKey, secretKeyHint } from "../src/lib/keys.ts";

const PORT = 5555;
const ORIGIN = `http://localhost:${PORT}`;
const COLLECTOR = "http://localhost:8787";

const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", remoteBindings: false, envFiles: [] });
const db = proxy.env.DB;

await db
	.prepare(
		`INSERT INTO projects (slug, name, tagline, status, allowed_origins, browser_events, sort_order)
		 VALUES ('playground', 'Playground', 'Local test site for the collector.', 'idea', ?1, ?2, 99)
		 ON CONFLICT (slug) DO UPDATE SET allowed_origins = excluded.allowed_origins, browser_events = excluded.browser_events`,
	)
	.bind(JSON.stringify([ORIGIN]), JSON.stringify(["demo_click"]))
	.run();
await db
	.prepare(
		`INSERT OR IGNORE INTO metrics (project_id, key, label, source)
		 SELECT id, 'demo_signups', 'Demo sign-ups', 'product' FROM projects WHERE slug = 'playground'`,
	)
	.run();

const existing = await getProjectBySlug(db, "playground");
const publicKey = existing?.publicKey ?? createPublicKey();
const secretKey = createSecretKey();
await setProjectKeys(db, "playground", {
	publicKey: existing?.publicKey ? undefined : publicKey,
	secretKeyHash: await hashSecretKey(secretKey),
	secretKeyHint: secretKeyHint(secretKey),
});
await proxy.dispose();

const page = (title: string, body: string, notFound = false) => `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Playground</title>
<script defer src="${COLLECTOR}/t.js" data-key="${publicKey}"></script>
<style>
	body { font: 16px/1.5 system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; }
	section { border: 1px solid #ddd; border-radius: 12px; padding: 1rem 1.25rem; margin: 1rem 0; }
	button, input { font: inherit; } .tall { height: 120vh; }
</style>
</head>
<body${notFound ? " data-bobby-not-found" : ""}>
${body}
</body>
</html>`;

const home = page(
	"Home",
	`<h1>Collector playground</h1>
<p>Every action below sends something to your local BobbyBuilds. Watch it land with the commands in your terminal.</p>
<p><small>If nothing arrives, check your browser hasn't got Global Privacy Control or Do Not Track switched on. The tracker respects both.</small></p>

<section><h2>Links</h2>
<p><a href="https://github.com/wahabalikhan">Outbound link (github.com)</a></p>
<p><a href="/files/Example%20Case%20Study.pdf">Download a PDF</a> · <a href="/files/brief.docx">Download a .docx</a> · <a href="/files/assets.zip">Download a .zip</a></p>
<p><a href="/missing-page">A page that doesn't exist (404)</a></p>
</section>

<section><h2>Single-page navigation</h2>
<button id="spa">Go to /pretend-page without reloading</button>
</section>

<section><h2>Custom event</h2>
<button onclick="bobby.track('demo_click', { button: 'hello' })">bobby.track('demo_click')</button>
<button onclick="bobby.track('not_on_the_list')">An event that isn't allowed (refused)</button>
</section>

<section><h2>Form drop-off</h2>
<form id="contact">
	<p><label>Message <input name="message"></label></p>
	<p><button>Send</button></p>
</form>
<p id="sent" hidden>Sent (nothing actually leaves this page).</p>
</section>

<div class="tall"><p>Scroll down for scroll depth…</p></div>
<p>Bottom of the page.</p>

<script>
	document.getElementById("spa").onclick = () => history.pushState({}, "", "/pretend-page");
	const form = document.getElementById("contact");
	let started = false;
	form.addEventListener("input", () => { if (!started) { started = true; bobby.track("form_started", { form: "contact" }); } });
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		bobby.track("form_submitted", { form: "contact" });
		document.getElementById("sent").hidden = false;
	});
</script>`,
);

const notFoundPage = page("Not found", `<h1>Page not found</h1><p>This page has <code>data-bobby-not-found</code>, so its path is recorded.</p><p><a href="/">Back home</a></p>`, true);

createServer((request, response) => {
	const path = new URL(request.url ?? "/", ORIGIN).pathname;
	if (path.startsWith("/files/")) {
		response.writeHead(200, { "Content-Type": "application/octet-stream" });
		return response.end("example file");
	}
	const isHome = path === "/" || path === "/pretend-page";
	response.writeHead(isHome ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
	response.end(isHome ? home : notFoundPage);
}).listen(PORT, () => {
	console.log(`
Playground running at ${ORIGIN}  (needs \`npm run preview\` running on ${COLLECTOR})

  Public key:  ${publicKey}
  Secret key:  ${secretKey}   (local database only; new one each run)

Watch what lands (in another terminal):
  npx wrangler d1 execute bobbybuilds-db --local --command "SELECT id, path, referrer_domain, ref, utm_source, device, browser, os, screen, language, engaged_ms, scroll_pct, lcp_ms, cls_milli, inp_ms FROM page_views ORDER BY id DESC LIMIT 10"
  npx wrangler d1 execute bobbybuilds-db --local --command "SELECT id, source, name, path, props FROM events ORDER BY id DESC LIMIT 10"

Try ?ref=linkedin-post&utm_source=LinkedIn&utm_campaign=Launch on the playground URL.

Server-side calls:
  curl -i -X POST ${COLLECTOR}/v1/events -H "Authorization: Bearer ${secretKey}" -H "Content-Type: application/json" -d '{"name":"demo_signup","props":{"plan":"free"}}'
  curl -i -X POST ${COLLECTOR}/v1/metrics -H "Authorization: Bearer ${secretKey}" -H "Content-Type: application/json" -d '{"metrics":[{"key":"demo_signups","value":3}]}'

Press Ctrl+C to stop.`);
});
