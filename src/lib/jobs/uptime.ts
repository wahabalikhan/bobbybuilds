import type { Fetch } from "./github";

export const UPTIME_TIMEOUT_MS = 10_000;

export type UptimeResult = { projectId: number; up: boolean; responseMs: number | null; statusCode: number | null };

/** One GET to the health URL. Up = status 200–399. Timeouts and network errors are down. */
export async function checkOnce(fetchFn: Fetch, url: string, now: () => number = Date.now): Promise<Omit<UptimeResult, "projectId">> {
	const started = now();
	try {
		const response = await fetchFn(url, {
			method: "GET",
			redirect: "manual",
			signal: AbortSignal.timeout(UPTIME_TIMEOUT_MS),
			headers: { "User-Agent": "BobbyBuilds-Uptime/1.0" },
		});
		const responseMs = Math.min(60_000, Math.max(0, Math.round(now() - started)));
		return { up: response.status >= 200 && response.status < 400, responseMs, statusCode: response.status };
	} catch {
		return { up: false, responseMs: null, statusCode: null };
	}
}

/** Pings every project's site address and records the results. (The old health_url column isn't used.) */
export async function pingAll(db: D1Database, fetchFn: Fetch, checkedAt: number = Date.now()): Promise<UptimeResult[]> {
	const { results } = await db
		.prepare("SELECT id, site_url FROM projects WHERE site_url IS NOT NULL")
		.all<{ id: number; site_url: string }>();

	const checks = await Promise.all(
		results.map(async (project) => ({ projectId: project.id, ...(await checkOnce(fetchFn, project.site_url)) })),
	);
	if (checks.length) {
		await db.batch(
			checks.map((check) =>
				db
					.prepare("INSERT INTO uptime_checks (project_id, checked_at, up, response_ms, status_code) VALUES (?1, ?2, ?3, ?4, ?5)")
					.bind(check.projectId, checkedAt, check.up ? 1 : 0, check.responseMs, check.statusCode),
			),
		);
	}
	return checks;
}
