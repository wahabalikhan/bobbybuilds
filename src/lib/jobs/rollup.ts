/**
 * Daily roll-ups: the only data public pages read, and the only page-view data kept after
 * 90 days. Rolling up a day deletes that day's roll-up rows and rebuilds them from the raw
 * tables in one D1 batch (a transaction), so it can run any number of times.
 */

const REPEAT_GAP_MS = 30 * 60 * 1000;

const ROLLUP_TABLES = [
	"daily_totals",
	"daily_pages",
	"daily_referrers",
	"daily_refs",
	"daily_campaigns",
	"daily_countries",
	"daily_events",
	"daily_uptime",
] as const;

/** Nearest-rank percentile of already-sorted values. */
export function percentile(sorted: number[], p: number): number | null {
	if (sorted.length === 0) return null;
	return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

type VitalsRow = { project_id: number; lcp_ms: number | null; cls_milli: number | null; inp_ms: number | null };

async function vitalsByProject(db: D1Database, day: string) {
	const { results } = await db
		.prepare(
			`SELECT project_id, lcp_ms, cls_milli, inp_ms FROM page_views
			 WHERE day = ?1 AND (lcp_ms IS NOT NULL OR cls_milli IS NOT NULL OR inp_ms IS NOT NULL)`,
		)
		.bind(day)
		.all<VitalsRow>();

	const byProject = new Map<number, { lcp: number[]; cls: number[]; inp: number[]; samples: number }>();
	for (const row of results) {
		const entry = byProject.get(row.project_id) ?? { lcp: [], cls: [], inp: [], samples: 0 };
		entry.samples += 1;
		if (row.lcp_ms !== null) entry.lcp.push(row.lcp_ms);
		if (row.cls_milli !== null) entry.cls.push(row.cls_milli);
		if (row.inp_ms !== null) entry.inp.push(row.inp_ms);
		byProject.set(row.project_id, entry);
	}

	const sort = (values: number[]) => values.sort((a, b) => a - b);
	return [...byProject].map(([projectId, v]) => ({
		projectId,
		lcp: percentile(sort(v.lcp), 0.75),
		cls: percentile(sort(v.cls), 0.75),
		inp: percentile(sort(v.inp), 0.75),
		samples: v.samples,
	}));
}

export type RollupSummary = { day: string; projects: number; pageviews: number };

export async function rollupDay(db: D1Database, day: string, now: number = Date.now()): Promise<RollupSummary> {
	const vitals = await vitalsByProject(db, day);
	const dayStart = Date.parse(`${day}T00:00:00Z`);
	const dayEnd = dayStart + 86_400_000;

	const statements: D1PreparedStatement[] = ROLLUP_TABLES.map((table) => db.prepare(`DELETE FROM ${table} WHERE day = ?1`).bind(day));

	statements.push(
		db
			.prepare(
				`INSERT INTO daily_totals (
				   project_id, day, pageviews, visitors, repeat_visitors, events,
				   desktop_visitors, mobile_visitors, tablet_visitors, other_visitors,
				   engaged_ms_sum, engaged_count, scroll_pct_sum, scroll_count, updated_at)
				 WITH
				   views AS (
				     SELECT project_id,
				       count(*) AS pageviews,
				       count(DISTINCT visitor_id) AS visitors,
				       count(DISTINCT CASE WHEN device = 'desktop' THEN visitor_id END) AS desktop,
				       count(DISTINCT CASE WHEN device = 'mobile' THEN visitor_id END) AS mobile,
				       count(DISTINCT CASE WHEN device = 'tablet' THEN visitor_id END) AS tablet,
				       count(DISTINCT CASE WHEN device = 'other' THEN visitor_id END) AS other,
				       COALESCE(sum(engaged_ms), 0) AS engaged_sum, count(engaged_ms) AS engaged_count,
				       COALESCE(sum(scroll_pct), 0) AS scroll_sum, count(scroll_pct) AS scroll_count
				     FROM page_views WHERE day = ?1 GROUP BY project_id),
				   gaps AS (
				     SELECT project_id, visitor_id,
				       ts - LAG(ts) OVER (PARTITION BY project_id, visitor_id ORDER BY ts) AS gap
				     FROM page_views WHERE day = ?1),
				   repeats AS (
				     SELECT project_id, count(DISTINCT visitor_id) AS n FROM gaps WHERE gap >= ?2 GROUP BY project_id),
				   ev AS (SELECT project_id, count(*) AS n FROM events WHERE day = ?1 GROUP BY project_id),
				   ids AS (SELECT project_id FROM views UNION SELECT project_id FROM ev)
				 SELECT ids.project_id, ?1,
				   COALESCE(views.pageviews, 0), COALESCE(views.visitors, 0), COALESCE(repeats.n, 0), COALESCE(ev.n, 0),
				   COALESCE(views.desktop, 0), COALESCE(views.mobile, 0), COALESCE(views.tablet, 0), COALESCE(views.other, 0),
				   COALESCE(views.engaged_sum, 0), COALESCE(views.engaged_count, 0),
				   COALESCE(views.scroll_sum, 0), COALESCE(views.scroll_count, 0), ?3
				 FROM ids
				 LEFT JOIN views ON views.project_id = ids.project_id
				 LEFT JOIN repeats ON repeats.project_id = ids.project_id
				 LEFT JOIN ev ON ev.project_id = ids.project_id`,
			)
			.bind(day, REPEAT_GAP_MS, now),
		db
			.prepare(
				`INSERT INTO daily_pages (project_id, day, path, pageviews, visitors)
				 SELECT project_id, ?1, path, count(*), count(DISTINCT visitor_id)
				 FROM page_views WHERE day = ?1 GROUP BY project_id, path`,
			)
			.bind(day),
		db
			.prepare(
				`INSERT INTO daily_referrers (project_id, day, referrer_domain, pageviews, visitors)
				 SELECT project_id, ?1, COALESCE(referrer_domain, ''), count(*), count(DISTINCT visitor_id)
				 FROM page_views WHERE day = ?1 GROUP BY project_id, COALESCE(referrer_domain, '')`,
			)
			.bind(day),
		db
			.prepare(
				`INSERT INTO daily_refs (project_id, day, ref, pageviews, visitors)
				 SELECT project_id, ?1, ref, count(*), count(DISTINCT visitor_id)
				 FROM page_views WHERE day = ?1 AND ref IS NOT NULL GROUP BY project_id, ref`,
			)
			.bind(day),
		db
			.prepare(
				`INSERT INTO daily_campaigns (project_id, day, utm_source, utm_medium, utm_campaign, pageviews, visitors)
				 SELECT project_id, ?1, COALESCE(utm_source, ''), COALESCE(utm_medium, ''), COALESCE(utm_campaign, ''),
				   count(*), count(DISTINCT visitor_id)
				 FROM page_views
				 WHERE day = ?1 AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
				 GROUP BY project_id, COALESCE(utm_source, ''), COALESCE(utm_medium, ''), COALESCE(utm_campaign, '')`,
			)
			.bind(day),
		db
			.prepare(
				`INSERT INTO daily_countries (project_id, day, country, pageviews, visitors)
				 SELECT project_id, ?1, COALESCE(country, ''), count(*), count(DISTINCT visitor_id)
				 FROM page_views WHERE day = ?1 GROUP BY project_id, COALESCE(country, '')`,
			)
			.bind(day),
		db
			.prepare(
				`INSERT INTO daily_events (project_id, day, name, count, visitors)
				 SELECT project_id, ?1, name, count(*), count(DISTINCT visitor_id)
				 FROM events WHERE day = ?1 GROUP BY project_id, name`,
			)
			.bind(day),
		db
			.prepare(
				`INSERT INTO daily_uptime (project_id, day, checks, up_checks, avg_response_ms)
				 SELECT project_id, ?1, count(*), sum(up), CAST(round(avg(CASE WHEN up = 1 THEN response_ms END)) AS INTEGER)
				 FROM uptime_checks WHERE checked_at >= ?2 AND checked_at < ?3 GROUP BY project_id`,
			)
			.bind(day, dayStart, dayEnd),
	);

	for (const v of vitals) {
		statements.push(
			db
				.prepare(
					`UPDATE daily_totals SET lcp_p75_ms = ?3, cls_p75_milli = ?4, inp_p75_ms = ?5, vitals_samples = ?6
					 WHERE project_id = ?1 AND day = ?2`,
				)
				.bind(v.projectId, day, v.lcp, v.cls, v.inp, v.samples),
		);
	}

	await db.batch(statements);

	const totals = await db
		.prepare("SELECT count(*) AS projects, COALESCE(sum(pageviews), 0) AS pageviews FROM daily_totals WHERE day = ?1")
		.bind(day)
		.first<{ projects: number; pageviews: number }>();
	return { day, projects: totals?.projects ?? 0, pageviews: totals?.pageviews ?? 0 };
}
