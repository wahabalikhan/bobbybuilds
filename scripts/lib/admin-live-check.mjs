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
	const projectLinks = [...new Set([...home.text.matchAll(/href="(\/admin\/projects\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
	// Every project's dashboard on every tab (tabs a project doesn't have fall back to Traffic), and its settings.
	const tabs = ["traffic", "links", "searches", "funnel", "numbers", "health", "events"];
	const paths = [
		"/admin",
		...projectLinks.flatMap((link) => [link, ...tabs.map((tab) => `${link}?tab=${tab}`), link.replace("/admin/projects/", "/admin/settings/projects/")]),
		"/admin/projects/no-such-project",
		"/admin/does-not-exist",
		"/admin/settings",
		"/admin/settings/projects/new",
		"/admin/settings/journey",
		...extraPaths,
	];

	for (const path of [...new Set(paths)]) {
		const page = path === "/admin" ? home : await get(`${origin}${path}`);
		if (!page.text.includes(MARKER)) problems.push(`${path} (${page.status}) has no LIVE DATA banner.`);
		else if (!/data-live-data-banner="on"style="[^"]*position:sticky[^"]*background:#b42318/.test(page.text.replace(/\s/g, ""))) {
			problems.push(`${path} has the banner but not its pinned, inline red style.`);
		}
		if (/something went wrong/i.test(page.text)) problems.push(`${path} shows "Something went wrong".`);
		const csp = page.headers.get("content-security-policy") ?? "";
		if (csp.includes("upgrade-insecure-requests")) problems.push(`${path} sends upgrade-insecure-requests on loopback, so its CSS wouldn't load.`);
	}

	// The public pages must work too (they need the KV binding). /journey is either shown (200) or,
	// while site.showJourney is false, redirected to the home page.
	const homePage = await get(`${origin}/`);
	if (homePage.status !== 200) problems.push(`The public page / returned ${homePage.status}.`);
	const journey = await fetch(`${origin}/journey`, { redirect: "manual" });
	const journeyHidden = [307, 308].includes(journey.status) && new URL(journey.headers.get("location") ?? "", origin).pathname === "/";
	if (journey.status !== 200 && !journeyHidden) problems.push(`The public page /journey returned ${journey.status}.`);

	const css = home.text.match(/href="(\/_next\/static\/[^"]+\.css)"/)?.[1];
	if (!css) problems.push("/admin links no stylesheet.");
	else if ((await get(`${origin}${css}`)).status !== 200) problems.push(`The stylesheet ${css} didn't load.`);
	return problems;
}
