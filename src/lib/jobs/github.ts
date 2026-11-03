export type Fetch = typeof fetch;

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
