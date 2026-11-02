import { addDays } from "@/lib/days";

/**
 * Weekly commit counts from GitHub (default branch, Monday-start UTC weeks).
 * Asks for one commit per page and reads the total from the "last" page link, so each
 * week costs one API call. GITHUB_TOKEN (read-only Contents) is needed for private repos.
 */

export type Fetch = typeof fetch;

export async function commitsInWeek(fetchFn: Fetch, repo: string, weekStart: string, token?: string): Promise<number> {
	const params = new URLSearchParams({
		since: `${weekStart}T00:00:00Z`,
		until: `${addDays(weekStart, 7)}T00:00:00Z`,
		per_page: "1",
	});
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "BobbyBuilds",
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetchFn(`https://api.github.com/repos/${repo}/commits?${params}`, { headers });
	if (response.status === 409) return 0; // empty repository
	if (!response.ok) throw new Error(`GitHub ${response.status} for ${repo}`);

	const last = /[?&]page=(\d+)>;\s*rel="last"/.exec(response.headers.get("Link") ?? "");
	if (last) return Number(last[1]);
	const commits = (await response.json()) as unknown[];
	return Array.isArray(commits) ? commits.length : 0;
}

export type GithubSummary = Record<string, { thisWeek: number; lastWeek: number; backfilled: number } | { error: string }>;

/**
 * Updates github_weekly for this week (unfinished) and last week, for every project with a
 * repo. Weeks in the last `history` weeks that have never been fetched are filled in too,
 * at most `maxBackfill` per repo per run (Workers on the Free plan allow 50 outgoing requests
 * per run), so the shipping streak has its full history within a few days.
 */
export async function syncGithubWeekly(
	db: D1Database,
	fetchFn: Fetch,
	thisWeek: string,
	token?: string,
	now: number = Date.now(),
	history = 26,
	maxBackfill = 8,
): Promise<GithubSummary> {
	const { results } = await db
		.prepare("SELECT id, github_repo FROM projects WHERE github_repo IS NOT NULL")
		.all<{ id: number; github_repo: string }>();
	const lastWeek = addDays(thisWeek, -7);
	const summary: GithubSummary = {};
	const upsert = `INSERT INTO github_weekly (project_id, week, commits, updated_at) VALUES (?1, ?2, ?3, ?4)
		ON CONFLICT (project_id, week) DO UPDATE SET commits = excluded.commits, updated_at = excluded.updated_at`;

	for (const project of results) {
		try {
			const stored = await db
				.prepare("SELECT week FROM github_weekly WHERE project_id = ?1 AND week >= ?2")
				.bind(project.id, addDays(thisWeek, -7 * (history - 1)))
				.all<{ week: string }>();
			const have = new Set(stored.results.map((r) => r.week));
			const missing = Array.from({ length: Math.max(0, history - 2) }, (_, i) => addDays(thisWeek, -7 * (i + 2))).filter((w) => !have.has(w)).slice(0, maxBackfill);

			const counts = new Map<string, number>();
			for (const week of [thisWeek, lastWeek, ...missing]) counts.set(week, await commitsInWeek(fetchFn, project.github_repo, week, token));
			await db.batch([...counts].map(([week, commits]) => db.prepare(upsert).bind(project.id, week, commits, now)));
			summary[project.github_repo] = { thisWeek: counts.get(thisWeek)!, lastWeek: counts.get(lastWeek)!, backfilled: missing.length };
		} catch (error) {
			summary[project.github_repo] = { error: error instanceof Error ? error.message : "Unknown error" };
		}
	}
	return summary;
}

const CONTRIBUTIONS_QUERY = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;

export type ContributionsSummary = { days: number; total: number } | { error: string };

/**
 * GitHub's contribution calendar (the last year, one count per day) for the public GitHub
 * section. Replaces github_contributions in one batch and deletes days outside the window.
 * A failed or odd reply changes nothing, so the page keeps showing the last good year.
 */
export async function syncGithubContributions(db: D1Database, fetchFn: Fetch, login: string, token: string | undefined, now: number = Date.now()): Promise<ContributionsSummary> {
	if (!token) return { error: "No GITHUB_TOKEN" };
	try {
		const response = await fetchFn("https://api.github.com/graphql", {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "BobbyBuilds" },
			body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { login } }),
		});
		if (!response.ok) return { error: `GitHub ${response.status}` };
		const body = (await response.json()) as {
			data?: { user?: { contributionsCollection?: { contributionCalendar?: { weeks?: { contributionDays?: { date?: unknown; contributionCount?: unknown }[] }[] } } } };
		};
		const days = (body.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [])
			.flatMap((week) => week.contributionDays ?? [])
			.filter((d): d is { date: string; contributionCount: number } => typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isInteger(d.contributionCount) && (d.contributionCount as number) >= 0 && (d.contributionCount as number) <= 100000);
		if (days.length < 300 || days.length > 380) return { error: `Unexpected calendar (${days.length} days)` };

		const first = days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date);
		const upsert = `INSERT INTO github_contributions (day, count, updated_at) VALUES (?1, ?2, ?3)
			ON CONFLICT (day) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`;
		await db.batch([
			...days.map((d) => db.prepare(upsert).bind(d.date, d.contributionCount, now)),
			db.prepare("DELETE FROM github_contributions WHERE day < ?1").bind(first),
		]);
		return { days: days.length, total: days.reduce((t, d) => t + d.contributionCount, 0) };
	} catch (error) {
		return { error: error instanceof Error ? error.message.slice(0, 200) : "Failed" };
	}
}
