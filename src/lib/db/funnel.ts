/**
 * Funnels from raw page views and events (last 90 days only). Visitor IDs reset every day,
 * so a visitor's journey is counted within one day: step 2 counts only if it happened
 * after step 1, on the same day, and so on.
 */

export type FunnelStep = { label: string; path?: string; event?: string };
export type FunnelResult = { label: string; visitors: number; fromPrevious: number | null; fromFirst: number | null }[];

type Hit = { day: string; visitor_id: string; ts: number; kind: "path" | "event"; key: string };

/** Funnel steps from a project's JSON, ignoring anything malformed. */
export function parseFunnel(value: unknown): FunnelStep[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((step): step is FunnelStep => {
			if (typeof step !== "object" || step === null) return false;
			const s = step as Record<string, unknown>;
			return typeof s.label === "string" && (typeof s.path === "string" || typeof s.event === "string");
		})
		.slice(0, 8);
}

/** Counts visitors reaching each step, in order, within the same day. Pure, for testing. */
export function countFunnel(steps: FunnelStep[], hits: Hit[]): FunnelResult {
	const journeys = new Map<string, Hit[]>();
	for (const hit of hits) {
		const id = `${hit.day}|${hit.visitor_id}`;
		const list = journeys.get(id) ?? [];
		list.push(hit);
		journeys.set(id, list);
	}

	const reached = new Array(steps.length).fill(0);
	for (const journey of journeys.values()) {
		journey.sort((a, b) => a.ts - b.ts);
		let after = -Infinity;
		for (const [index, step] of steps.entries()) {
			const match = journey.find(
				(hit) => hit.ts >= after && (step.path ? hit.kind === "path" && hit.key === step.path : hit.kind === "event" && hit.key === step.event),
			);
			if (!match) break;
			reached[index] += 1;
			after = match.ts;
		}
	}

	return steps.map((step, index) => ({
		label: step.label,
		visitors: reached[index],
		fromPrevious: index === 0 ? null : reached[index - 1] ? reached[index] / reached[index - 1] : null,
		fromFirst: index === 0 ? null : reached[0] ? reached[index] / reached[0] : null,
	}));
}

export async function funnel(db: D1Database, projectId: number, steps: FunnelStep[], from: string, to: string): Promise<FunnelResult> {
	if (steps.length === 0) return [];
	const paths = [...new Set(steps.flatMap((s) => (s.path ? [s.path] : [])))];
	const events = [...new Set(steps.flatMap((s) => (s.event ? [s.event] : [])))];
	const placeholders = (values: string[], offset: number) => values.map((_, i) => `?${i + offset}`).join(", ");

	const hits: Hit[] = [];
	if (paths.length) {
		const { results } = await db
			.prepare(
				`SELECT day, visitor_id, ts, 'path' AS kind, path AS key FROM page_views
				 WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3 AND path IN (${placeholders(paths, 4)})`,
			)
			.bind(projectId, from, to, ...paths)
			.all<Hit>();
		hits.push(...results);
	}
	if (events.length) {
		const { results } = await db
			.prepare(
				`SELECT day, visitor_id, ts, 'event' AS kind, name AS key FROM events
				 WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3 AND visitor_id IS NOT NULL AND name IN (${placeholders(events, 4)})`,
			)
			.bind(projectId, from, to, ...events)
			.all<Hit>();
		hits.push(...results);
	}
	return countFunnel(steps, hits);
}

export type FormDropOff = { form: string; started: number; submitted: number; rate: number | null };

/** form_started → form_submitted per form, per visitor, within the same day. */
export async function formDropOff(db: D1Database, projectId: number, from: string, to: string): Promise<FormDropOff[]> {
	const { results } = await db
		.prepare(
			`WITH started AS (
			   SELECT day, visitor_id, json_extract(props, '$.form') AS form, min(ts) AS ts FROM events
			   WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3 AND name = 'form_started' AND visitor_id IS NOT NULL
			   GROUP BY day, visitor_id, form),
			 submitted AS (
			   SELECT day, visitor_id, json_extract(props, '$.form') AS form, max(ts) AS ts FROM events
			   WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3 AND name = 'form_submitted' AND visitor_id IS NOT NULL
			   GROUP BY day, visitor_id, form)
			 SELECT s.form AS form, count(*) AS started,
			   sum(CASE WHEN f.ts IS NOT NULL AND f.ts >= s.ts THEN 1 ELSE 0 END) AS submitted
			 FROM started s LEFT JOIN submitted f ON f.day = s.day AND f.visitor_id = s.visitor_id AND f.form = s.form
			 GROUP BY s.form ORDER BY started DESC`,
		)
		.bind(projectId, from, to)
		.all<{ form: string; started: number; submitted: number }>();
	return results.map((r) => ({ ...r, rate: r.started ? r.submitted / r.started : null }));
}
