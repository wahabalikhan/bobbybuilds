export type Fetch = typeof fetch;

const CONTRIBUTIONS_QUERY = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;

export type ContributionsSummary = { days: number; total: number; source: "profile" | "api" } | { error: string };

type Day = { date: string; contributionCount: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const valid = (d: { date?: unknown; contributionCount?: unknown }): d is Day =>
	typeof d.date === "string" && DAY.test(d.date) && Number.isInteger(d.contributionCount) && (d.contributionCount as number) >= 0 && (d.contributionCount as number) <= 100000;

/**
 * GitHub's own public contribution calendar, as the profile shows it
 * (https://github.com/users/<login>/contributions): one cell per day, each with a tooltip such as
 * "3 contributions on May 11th." and a heading "501 contributions in the last year". Returns the days
 * only when every cell has a count and they add up exactly to that heading, else null (so a change
 * to GitHub's page can never slip wrong numbers in).
 */
export function parseProfileCalendar(html: string): { days: Day[]; total: number } | null {
	const heading = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
	if (!heading) return null;
	const total = Number(heading[1].replace(/,/g, ""));
	const counts = new Map<string, number>();
	for (const tip of html.matchAll(/<tool-tip\b[^>]*\bfor="(contribution-day-component-[\d-]+)"[^>]*>\s*(No|[\d,]+)\s+contributions?\s+on\b/g)) {
		counts.set(tip[1], tip[2] === "No" ? 0 : Number(tip[2].replace(/,/g, "")));
	}
	const days: Day[] = [];
	for (const cell of html.matchAll(/<td\b[^>]*>/g)) {
		const date = cell[0].match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
		const id = cell[0].match(/\bid="(contribution-day-component-[\d-]+)"/)?.[1];
		if (!date || !id) continue;
		const count = counts.get(id);
		if (count === undefined) return null;
		days.push({ date, contributionCount: count });
	}
	if (days.length < 300 || days.length > 380) return null;
	if (days.reduce((t, d) => t + d.contributionCount, 0) !== total) return null;
	return { days: days.sort((a, b) => (a.date < b.date ? -1 : 1)), total };
}

/** The same calendar from GitHub's GraphQL API (needs the token). Its counts can lag the profile by a contribution or two. */
async function fromApi(fetchFn: Fetch, login: string, token: string): Promise<Day[] | { error: string }> {
	const response = await fetchFn("https://api.github.com/graphql", {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "BobbyBuilds" },
		body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { login } }),
	});
	if (!response.ok) return { error: `GitHub ${response.status}` };
	const body = (await response.json()) as {
		data?: { user?: { contributionsCollection?: { contributionCalendar?: { weeks?: { contributionDays?: { date?: unknown; contributionCount?: unknown }[] }[] } } } };
	};
	const days = (body.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? []).flatMap((week) => week.contributionDays ?? []).filter(valid);
	if (days.length < 300 || days.length > 380) return { error: `Unexpected calendar (${days.length} days)` };
	return days;
}

/**
 * The last year of GitHub contributions for the public Activity section, matching the profile:
 * GitHub's own public calendar first (no token needed), and GitHub's GraphQL API with GITHUB_TOKEN
 * only if that page can't be read or doesn't add up. Replaces github_contributions in one batch and
 * deletes days outside the window. A failed or odd reply changes nothing, so the page keeps showing
 * the last good year. Run hourly by the frequent job.
 */
export async function syncGithubContributions(db: D1Database, fetchFn: Fetch, login: string, token: string | undefined, now: number = Date.now()): Promise<ContributionsSummary> {
	try {
		let days: Day[] | null = null;
		let source: "profile" | "api" = "profile";
		try {
			const page = await fetchFn(`https://github.com/users/${encodeURIComponent(login)}/contributions`, { headers: { "User-Agent": "BobbyBuilds (https://bobbybuilds.app)", Accept: "text/html" } });
			if (page.ok) days = parseProfileCalendar(await page.text())?.days ?? null;
		} catch {
			days = null;
		}
		if (!days) {
			if (!token) return { error: "No GITHUB_TOKEN" };
			const api = await fromApi(fetchFn, login, token);
			if ("error" in api) return api;
			days = api;
			source = "api";
		}

		const first = days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date);
		const upsert = `INSERT INTO github_contributions (day, count, updated_at) VALUES (?1, ?2, ?3)
			ON CONFLICT (day) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`;
		await db.batch([...days.map((d) => db.prepare(upsert).bind(d.date, d.contributionCount, now)), db.prepare("DELETE FROM github_contributions WHERE day < ?1").bind(first)]);
		return { days: days.length, total: days.reduce((t, d) => t + d.contributionCount, 0), source };
	} catch (error) {
		return { error: error instanceof Error ? error.message.slice(0, 200) : "Failed" };
	}
}
