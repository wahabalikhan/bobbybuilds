import { addDays, isDay, utcDay } from "@/lib/days";
import { authenticateServer } from "./auth";
import { type CollectorDeps, error, readJsonBody, reply } from "./http";

/**
 * POST /v1/metrics, server only (Authorization: Bearer sk_…).
 * Body: { "metrics": [{ "key": "returning_users", "value": 31, "day": "2026-11-02" }] }
 * Keys must be one of the project's product metrics. `day` defaults to today (UTC) and can
 * only be today or yesterday. A new value replaces that day's value.
 */
export async function handleMetrics(request: Request, deps: CollectorDeps): Promise<Response> {
	if (request.method !== "POST") return error(405, "Use POST.");

	const auth = await authenticateServer(deps.db, request);
	if (!auth.ok) return auth.response;
	const { project } = auth;

	const { success } = await deps.limiter.limit({ key: `${project.id}:metrics` });
	if (!success) return error(429, "Too many requests. Try again in a minute.");

	const parsed = await readJsonBody(request);
	if (!parsed.ok) return parsed.response;
	const items = parsed.body.metrics;
	if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
		return error(400, "metrics must be a list of 1 to 20 items.");
	}

	const today = utcDay(deps.now?.() ?? Date.now());
	const allowedDays = new Set([today, addDays(today, -1)]);

	const { results } = await deps.db
		.prepare("SELECT id, key FROM metrics WHERE project_id = ?1 AND source = 'product'")
		.bind(project.id)
		.all<{ id: number; key: string }>();
	const metricIds = new Map(results.map((row) => [row.key, row.id]));

	const rows: { metricId: number; day: string; value: number }[] = [];
	for (const [index, item] of items.entries()) {
		if (typeof item !== "object" || item === null || Array.isArray(item)) return error(400, `metrics[${index}] must be an object.`);
		const { key, value, day = today } = item as Record<string, unknown>;

		if (typeof key !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(key)) return error(400, `metrics[${index}].key isn't a valid key.`);
		const metricId = metricIds.get(key);
		if (metricId === undefined) {
			return error(400, `"${key}" isn't one of this project's product numbers. Add it in settings first.`);
		}
		if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e15) {
			return error(400, `metrics[${index}].value must be a number.`);
		}
		if (typeof day !== "string" || !isDay(day) || !allowedDays.has(day)) {
			return error(400, `metrics[${index}].day can only be today or yesterday (UTC).`);
		}
		rows.push({ metricId, day, value });
	}

	const now = Date.now();
	await deps.db.batch(
		rows.map((row) =>
			deps.db
				.prepare(
					`INSERT INTO metric_values (metric_id, day, value, updated_at) VALUES (?1, ?2, ?3, ?4)
					 ON CONFLICT (metric_id, day) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
				)
				.bind(row.metricId, row.day, row.value, now),
		),
	);
	return reply(200, { saved: rows.length });
}
