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

export type GithubSummary = Record<string, { thisWeek: number; lastWeek: number } | { error: string }>;

/** Updates github_weekly for this week (unfinished) and last week, for every project with a repo. */
export async function syncGithubWeekly(
	db: D1Database,
	fetchFn: Fetch,
	thisWeek: string,
	token?: string,
	now: number = Date.now(),
): Promise<GithubSummary> {
	const { results } = await db
		.prepare("SELECT id, github_repo FROM projects WHERE github_repo IS NOT NULL")
		.all<{ id: number; github_repo: string }>();
	const lastWeek = addDays(thisWeek, -7);
	const summary: GithubSummary = {};

	for (const project of results) {
		try {
			const counts = {
				thisWeek: await commitsInWeek(fetchFn, project.github_repo, thisWeek, token),
				lastWeek: await commitsInWeek(fetchFn, project.github_repo, lastWeek, token),
			};
			const upsert = `INSERT INTO github_weekly (project_id, week, commits, updated_at) VALUES (?1, ?2, ?3, ?4)
				ON CONFLICT (project_id, week) DO UPDATE SET commits = excluded.commits, updated_at = excluded.updated_at`;
			await db.batch([
				db.prepare(upsert).bind(project.id, thisWeek, counts.thisWeek, now),
				db.prepare(upsert).bind(project.id, lastWeek, counts.lastWeek, now),
			]);
			summary[project.github_repo] = counts;
		} catch (error) {
			summary[project.github_repo] = { error: error instanceof Error ? error.message : "Unknown error" };
		}
	}
	return summary;
}
