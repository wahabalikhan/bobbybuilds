/**
 * Checks a running admin server that's connected to the live database: every admin page it
 * serves must carry the LIVE DATA banner (inline-styled, pinned), and its stylesheet must load
 * over plain http on loopback. Used by `npm run admin:live` (which shuts down if this fails)
 * and by `npm run test:admin-live`.
 */
const MARKER = 'data-live-data-banner="on"';

async function get(url) {
	const response = await fetch(url, { redirect: "manual" });
	return { status: response.status, headers: response.headers, text: await response.text() };
}

/** @returns {Promise<string[]>} problems found (empty means all good) */
export async function checkLiveBanner(origin, extraPaths = []) {
	const problems = [];
	const home = await get(`${origin}/admin`);
	const projectLinks = [...home.text.matchAll(/href="(\/admin\/projects\/[a-z0-9-]+)"/g)].map((m) => m[1]);
	const first = projectLinks[0];
	const paths = ["/admin", ...(first ? [first, ...["campaigns", "events", "uptime"].map((tab) => `${first}?tab=${tab}`)] : []), "/admin/projects/no-such-project", "/admin/does-not-exist", ...extraPaths];

	for (const path of [...new Set(paths)]) {
		const page = path === "/admin" ? home : await get(`${origin}${path}`);
		if (!page.text.includes(MARKER)) problems.push(`${path} (${page.status}) has no LIVE DATA banner.`);
		else if (!/data-live-data-banner="on"style="[^"]*position:sticky[^"]*background:#b42318/.test(page.text.replace(/\s/g, ""))) {
			problems.push(`${path} has the banner but not its pinned, inline red style.`);
		}
		const csp = page.headers.get("content-security-policy") ?? "";
		if (csp.includes("upgrade-insecure-requests")) problems.push(`${path} sends upgrade-insecure-requests on loopback, so its CSS wouldn't load.`);
	}

	const css = home.text.match(/href="(\/_next\/static\/[^"]+\.css)"/)?.[1];
	if (!css) problems.push("/admin links no stylesheet.");
	else if ((await get(`${origin}${css}`)).status !== 200) problems.push(`The stylesheet ${css} didn't load.`);
	return problems;
}
