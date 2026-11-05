/**
 * Queries for the private dashboard. Charts read the daily roll-ups (kept forever); a few
 * sections read raw page views and events, which only exist for the last 90 days.
 * Every query uses bound parameters; table and column names only ever come from the
 * fixed lists in this file.
 */
import { daysBetween } from "@/lib/admin/range";
import { sourceName } from "@/lib/admin/sources";
import { addDays, weekStart } from "@/lib/days";
import { chartStart, trendFrom, type Trend } from "@/lib/trend";
import { firstTrackedDays, listRealProjects, type Project } from "./projects";

export type DayValue = { day: string; value: number };
export type Ranked = { key: string; pageviews: number; visitors: number };

function fill(rows: { day: string; value: number | null }[], from: string, to: string): DayValue[] {
	const byDay = new Map(rows.map((row) => [row.day, row.value ?? 0]));
	return daysBetween(from, to).map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

const sum = (values: DayValue[]) => values.reduce((total, v) => total + v.value, 0);

// ---------------------------------------------------------------------------------------
// Metrics (shared with the public pages in Phase 6)
// ---------------------------------------------------------------------------------------

export type Metric = {
	id: number;
	projectId: number;
	key: string;
	label: string;
	unit: string;
	source: "collector" | "event" | "product";
	eventName: string | null;
	isPublic: boolean;
	isHeadline: boolean;
};

type MetricRow = {
	id: number;
	project_id: number;
	key: string;
	label: string;
	unit: string;
	source: Metric["source"];
	event_name: string | null;
	is_public: number;
	is_headline: number;
};

const toMetric = (row: MetricRow): Metric => ({
	id: row.id,
	projectId: row.project_id,
	key: row.key,
	label: row.label,
	unit: row.unit,
	source: row.source,
	eventName: row.event_name,
	isPublic: row.is_public === 1,
	isHeadline: row.is_headline === 1,
});

export async function listMetrics(db: D1Database, projectId?: number): Promise<Metric[]> {
	const statement = projectId
		? db.prepare("SELECT * FROM metrics WHERE project_id = ?1 ORDER BY sort_order, id").bind(projectId)
		: db.prepare("SELECT * FROM metrics ORDER BY project_id, sort_order, id");
	return (await statement.all<MetricRow>()).results.map(toMetric);
}

const COLLECTOR_COLUMNS = { visitors: "visitors", pageviews: "pageviews", repeat_visitors: "repeat_visitors" } as const;

/** Daily values of one metric between two days (zeros where there's no data). */
export async function metricSeries(db: D1Database, metric: Metric, from: string, to: string): Promise<DayValue[]> {
	let rows: { day: string; value: number }[];
	if (metric.source === "collector") {
		const column = COLLECTOR_COLUMNS[metric.key as keyof typeof COLLECTOR_COLUMNS];
		rows = (
			await db
				.prepare(`SELECT day, ${column} AS value FROM daily_totals WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3`)
				.bind(metric.projectId, from, to)
				.all<{ day: string; value: number }>()
		).results;
	} else if (metric.source === "event") {
		rows = (
			await db
				.prepare("SELECT day, count AS value FROM daily_events WHERE project_id = ?1 AND name = ?2 AND day BETWEEN ?3 AND ?4")
				.bind(metric.projectId, metric.eventName, from, to)
				.all<{ day: string; value: number }>()
		).results;
	} else {
		rows = (
			await db
				.prepare("SELECT day, value FROM metric_values WHERE metric_id = ?1 AND day BETWEEN ?2 AND ?3")
				.bind(metric.id, from, to)
				.all<{ day: string; value: number }>()
		).results;
	}
	return fill(rows, from, to);
}

export type MetricFigure = { value: number | null; period: string };

/** The single figure for a metric: a 30-day total for counts, the latest value for product numbers. */
export async function metricFigure(db: D1Database, metric: Metric, today: string): Promise<MetricFigure> {
	if (metric.source === "product") {
		const row = await db
			.prepare("SELECT value FROM metric_values WHERE metric_id = ?1 AND day <= ?2 ORDER BY day DESC LIMIT 1")
			.bind(metric.id, today)
			.first<{ value: number }>();
		return { value: row?.value ?? null, period: "latest" };
	}
	return { value: sum(await metricSeries(db, metric, addDays(today, -29), today)), period: "last 30 days" };
}

// ---------------------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------------------

export type ProjectSummary = {
	project: Project;
	visitorsToday: number;
	visitors7: number;
	visitors7Previous: number;
	visitors30: number;
	visitors30Previous: number;
	sparkline: DayValue[];
	/** Visitors per Monday-start week for the last 12 weeks; the last one is this week so far. */
	weekly: DayValue[];
	/** The card's chart: from the project's start (per day for its first four weeks, then per week). */
	trend: Trend;
	headline: (MetricFigure & { label: string; unit: string }) | null;
	uptime: { lastUp: boolean | null; lastCheckedAt: number | null; uptime7: number | null };
};

export async function projectSummaries(db: D1Database, today: string): Promise<ProjectSummary[]> {
	const projects = await listRealProjects(db);
	const thisWeek = weekStart(today);
	const firstWeek = addDays(thisWeek, -7 * 11);
	const since = firstWeek < addDays(today, -59) ? firstWeek : addDays(today, -59);

	const [totals, metrics, lastChecks, uptimeDays, firstTracked] = await Promise.all([
		db
			.prepare("SELECT project_id, day, visitors FROM daily_totals WHERE day BETWEEN ?1 AND ?2")
			.bind(since, today)
			.all<{ project_id: number; day: string; visitors: number }>(),
		listMetrics(db),
		db
			.prepare(
				`SELECT project_id, up, checked_at FROM (
				   SELECT project_id, up, checked_at, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY checked_at DESC) AS n
				   FROM uptime_checks WHERE checked_at >= ?1)
				 WHERE n = 1`,
			)
			.bind(Date.parse(`${addDays(today, -1)}T00:00:00Z`))
			.all<{ project_id: number; up: number; checked_at: number }>(),
		db
			.prepare("SELECT project_id, sum(checks) AS checks, sum(up_checks) AS up FROM daily_uptime WHERE day BETWEEN ?1 AND ?2 GROUP BY project_id")
			.bind(addDays(today, -6), today)
			.all<{ project_id: number; checks: number; up: number }>(),
		firstTrackedDays(db),
	]);

	return Promise.all(
		projects.map(async (project) => {
			const rows = totals.results.filter((r) => r.project_id === project.id).map((r) => ({ day: r.day, value: r.visitors }));
			const series = fill(rows, since, today);
			const window = (end: number, length: number) => sum(series.slice(series.length - end - length, series.length - end));
			const headlineMetric = metrics.find((m) => m.projectId === project.id && m.isHeadline);
			const lastCheck = lastChecks.results.find((r) => r.project_id === project.id);
			const uptime = uptimeDays.results.find((r) => r.project_id === project.id);

			return {
				project,
				visitorsToday: series.at(-1)?.value ?? 0,
				visitors7: window(0, 7),
				visitors7Previous: window(7, 7),
				visitors30: window(0, 30),
				visitors30Previous: window(30, 30),
				sparkline: series.slice(-30),
				weekly: Array.from({ length: 12 }, (_, i) => {
					const week = addDays(firstWeek, 7 * i);
					const end = addDays(week, 6);
					return { day: week, value: series.filter((d) => d.day >= week && d.day <= end).reduce((t, d) => t + d.value, 0) };
				}),
				trend: trendFrom(series, today, chartStart(project.startedOn, firstTracked.get(project.id) ?? null)),
				headline: headlineMetric
					? { ...(await metricFigure(db, headlineMetric, today)), label: headlineMetric.label, unit: headlineMetric.unit }
					: null,
				uptime: {
					lastUp: lastCheck ? lastCheck.up === 1 : null,
					lastCheckedAt: lastCheck?.checked_at ?? null,
					uptime7: uptime && uptime.checks > 0 ? uptime.up / uptime.checks : null,
				},
			};
		}),
	);
}

/** Visitors per month across all projects, for the last 12 months (oldest first). */
export async function monthlyVisitors(db: D1Database, today: string, projectId?: number): Promise<{ month: string; value: number }[]> {
	const [year, month] = today.split("-").map(Number);
	const months = Array.from({ length: 12 }, (_, i) => {
		const d = new Date(Date.UTC(year, month - 1 - (11 - i), 1));
		return d.toISOString().slice(0, 7);
	});
	const statement = projectId
		? db
				.prepare("SELECT substr(day, 1, 7) AS month, sum(visitors) AS value FROM daily_totals WHERE day >= ?1 AND project_id = ?2 GROUP BY month")
				.bind(`${months[0]}-01`, projectId)
		: db.prepare("SELECT substr(day, 1, 7) AS month, sum(visitors) AS value FROM daily_totals WHERE day >= ?1 GROUP BY month").bind(`${months[0]}-01`);
	const byMonth = new Map((await statement.all<{ month: string; value: number }>()).results.map((r) => [r.month, r.value]));
	return months.map((m) => ({ month: m, value: byMonth.get(m) ?? 0 }));
}

export type Attention = { level: "critical" | "serious" | "warning"; message: string; projectSlug?: string };

/** Things worth looking at now, most serious first. */
export async function attentionItems(db: D1Database, now: number): Promise<Attention[]> {
	const items: Attention[] = [];
	const projects = await listRealProjects(db);

	const recentChecks = await db
		.prepare(
			`SELECT project_id, up FROM (
			   SELECT project_id, up, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY checked_at DESC) AS n
			   FROM uptime_checks WHERE checked_at >= ?1)
			 WHERE n <= 2`,
		)
		.bind(now - 60 * 60_000)
		.all<{ project_id: number; up: number }>();

	const views = await db
		.prepare("SELECT project_id, max(ts) AS last FROM page_views WHERE ts >= ?1 GROUP BY project_id")
		.bind(now - 24 * 3_600_000)
		.all<{ project_id: number; last: number }>();

	for (const project of projects) {
		const checks = recentChecks.results.filter((r) => r.project_id === project.id);
		if (checks.length === 2 && checks.every((c) => c.up === 0)) {
			items.push({ level: "critical", message: `${project.name} is down (its last two checks failed).`, projectSlug: project.slug });
		}
		if (project.status === "live" && !views.results.some((r) => r.project_id === project.id)) {
			items.push({
				level: "warning",
				message: `${project.name} has had no page views in 24 hours. Check the t.js snippet is still on the site.`,
				projectSlug: project.slug,
			});
		}
		if (!project.publicKey && project.status !== "idea" && project.status !== "retired") {
			items.push({ level: "warning", message: `${project.name} has no keys yet.`, projectSlug: project.slug });
		}
	}

	const jobs = await jobHealth(db);
	if (!jobs.lastFrequent || now - jobs.lastFrequent.startedAt > 15 * 60_000) {
		items.push({ level: "serious", message: "The 5-minute job hasn't run for over 15 minutes. Check bobbybuilds-cron." });
	}
	if (!jobs.lastDaily || now - jobs.lastDaily.startedAt > 26 * 3_600_000) {
		items.push({ level: "serious", message: "The daily job hasn't run in the last 26 hours." });
	}
	// Failed runs in the last 24 hours, newest first, with the start of the error.
	for (const run of jobs.failures.filter((r) => r.startedAt >= now - 24 * 3_600_000).slice(0, 3)) {
		const when = new Date(run.startedAt).toISOString().slice(11, 16);
		const detail = failureDetail(run.summary);
		items.push({ level: "serious", message: `The ${run.task === "daily" ? "daily" : "5-minute"} job failed at ${when} UTC${detail ? `: ${detail}` : "."}` });
	}

	const order = { critical: 0, serious: 1, warning: 2 };
	return items.sort((a, b) => order[a.level] - order[b.level]);
}

/** The error from a failed run's summary, shortened for one line. */
export function failureDetail(summary: string): string {
	let text = summary;
	try {
		const parsed = JSON.parse(summary) as { error?: unknown };
		if (typeof parsed.error === "string") text = parsed.error;
	} catch {
		// Not JSON: use it as it is.
	}
	text = text.replace(/\s+/g, " ").trim();
	if (!text || text === "{}") return "";
	return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}

export type JobRun = { id: number; task: string; startedAt: number; finishedAt: number | null; ok: boolean | null; summary: string };

export async function jobHealth(db: D1Database): Promise<{ lastFrequent: JobRun | null; lastDaily: JobRun | null; failures: JobRun[] }> {
	type Row = { id: number; task: string; started_at: number; finished_at: number | null; ok: number | null; summary: string };
	const toRun = (r: Row): JobRun => ({ id: r.id, task: r.task, startedAt: r.started_at, finishedAt: r.finished_at, ok: r.ok === null ? null : r.ok === 1, summary: r.summary });
	const last = (task: string) => db.prepare("SELECT * FROM job_runs WHERE task = ?1 ORDER BY started_at DESC LIMIT 1").bind(task).first<Row>();
	const [frequent, daily, failures] = await Promise.all([
		last("frequent"),
		last("daily"),
		db.prepare("SELECT * FROM job_runs WHERE ok = 0 ORDER BY started_at DESC LIMIT 5").all<Row>(),
	]);
	return { lastFrequent: frequent ? toRun(frequent) : null, lastDaily: daily ? toRun(daily) : null, failures: failures.results.map(toRun) };
}

// ---------------------------------------------------------------------------------------
// Project dashboard
// ---------------------------------------------------------------------------------------

export type Totals = {
	pageviews: number;
	visitors: number;
	repeatVisitors: number;
	events: number;
	avgEngagedMs: number | null;
	avgScrollPct: number | null;
	devices: { desktop: number; mobile: number; tablet: number; other: number };
};

export async function rangeTotals(db: D1Database, projectId: number, from: string, to: string): Promise<Totals> {
	const row = await db
		.prepare(
			`SELECT COALESCE(sum(pageviews), 0) AS pageviews, COALESCE(sum(visitors), 0) AS visitors,
			   COALESCE(sum(repeat_visitors), 0) AS repeat_visitors, COALESCE(sum(events), 0) AS events,
			   COALESCE(sum(engaged_ms_sum), 0) AS engaged_sum, COALESCE(sum(engaged_count), 0) AS engaged_count,
			   COALESCE(sum(scroll_pct_sum), 0) AS scroll_sum, COALESCE(sum(scroll_count), 0) AS scroll_count,
			   COALESCE(sum(desktop_visitors), 0) AS desktop, COALESCE(sum(mobile_visitors), 0) AS mobile,
			   COALESCE(sum(tablet_visitors), 0) AS tablet, COALESCE(sum(other_visitors), 0) AS other
			 FROM daily_totals WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3`,
		)
		.bind(projectId, from, to)
		.first<Record<string, number>>();
	const r = row ?? {};
	return {
		pageviews: r.pageviews ?? 0,
		visitors: r.visitors ?? 0,
		repeatVisitors: r.repeat_visitors ?? 0,
		events: r.events ?? 0,
		avgEngagedMs: r.engaged_count ? r.engaged_sum / r.engaged_count : null,
		avgScrollPct: r.scroll_count ? r.scroll_sum / r.scroll_count : null,
		devices: { desktop: r.desktop ?? 0, mobile: r.mobile ?? 0, tablet: r.tablet ?? 0, other: r.other ?? 0 },
	};
}

const TOTAL_COLUMNS = ["visitors", "pageviews", "repeat_visitors", "events"] as const;
export type TotalColumn = (typeof TOTAL_COLUMNS)[number];

export async function dailySeries(db: D1Database, projectId: number, column: TotalColumn, from: string, to: string): Promise<DayValue[]> {
	if (!TOTAL_COLUMNS.includes(column)) throw new Error("Unknown column");
	const { results } = await db
		.prepare(`SELECT day, ${column} AS value FROM daily_totals WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3`)
		.bind(projectId, from, to)
		.all<{ day: string; value: number }>();
	return fill(results, from, to);
}

/** Roll-up tables that rank one key column by visitors. */
const RANKED = {
	pages: { table: "daily_pages", column: "path" },
	referrers: { table: "daily_referrers", column: "referrer_domain" },
	refs: { table: "daily_refs", column: "ref" },
	countries: { table: "daily_countries", column: "country" },
} as const;

export async function ranked(db: D1Database, kind: keyof typeof RANKED, projectId: number, from: string, to: string, limit = 10): Promise<Ranked[]> {
	const { table, column } = RANKED[kind];
	const { results } = await db
		.prepare(
			`SELECT ${column} AS key, sum(pageviews) AS pageviews, sum(visitors) AS visitors FROM ${table}
			 WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3 GROUP BY ${column} ORDER BY visitors DESC, pageviews DESC, key LIMIT ?4`,
		)
		.bind(projectId, from, to, limit)
		.all<Ranked>();
	return results;
}

export type Campaign = { source: string; medium: string; campaign: string; pageviews: number; visitors: number };

export async function campaigns(db: D1Database, projectId: number, from: string, to: string, limit = 20): Promise<Campaign[]> {
	const { results } = await db
		.prepare(
			`SELECT utm_source AS source, utm_medium AS medium, utm_campaign AS campaign, sum(pageviews) AS pageviews, sum(visitors) AS visitors
			 FROM daily_campaigns WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3
			 GROUP BY utm_source, utm_medium, utm_campaign ORDER BY visitors DESC, pageviews DESC LIMIT ?4`,
		)
		.bind(projectId, from, to, limit)
		.all<Campaign>();
	return results;
}

/** Built-in events ranked by one prop or the path (raw, last 90 days). */
const EVENT_KEYS = {
	not_found: "path",
	outbound_click: "json_extract(props, '$.domain')",
	file_download: "json_extract(props, '$.file')",
} as const;

export async function eventBreakdown(db: D1Database, projectId: number, name: keyof typeof EVENT_KEYS, from: string, to: string, limit = 10) {
	const key = EVENT_KEYS[name];
	const { results } = await db
		.prepare(
			`SELECT COALESCE(${key}, '') AS key, count(*) AS count, count(DISTINCT visitor_id) AS visitors FROM events
			 WHERE project_id = ?1 AND name = ?2 AND day BETWEEN ?3 AND ?4 GROUP BY key ORDER BY count DESC, key LIMIT ?5`,
		)
		.bind(projectId, name, from, to, limit)
		.all<{ key: string; count: number; visitors: number }>();
	return results;
}

export type UptimeDay = { day: string; checks: number; up: number; avgResponseMs: number | null };

export async function uptimeDays(db: D1Database, projectId: number, from: string, to: string): Promise<UptimeDay[]> {
	const { results } = await db
		.prepare("SELECT day, checks, up_checks AS up, avg_response_ms AS avgResponseMs FROM daily_uptime WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3")
		.bind(projectId, from, to)
		.all<UptimeDay>();
	const byDay = new Map(results.map((r) => [r.day, r]));
	return daysBetween(from, to).map((day) => byDay.get(day) ?? { day, checks: 0, up: 0, avgResponseMs: null });
}

export type Check = { checkedAt: number; up: boolean; responseMs: number | null; statusCode: number | null };
export type Outage = { start: number; end: number | null; checks: number };

export async function uptimeChecks(db: D1Database, projectId: number, since: number): Promise<Check[]> {
	const { results } = await db
		.prepare("SELECT checked_at, up, response_ms, status_code FROM uptime_checks WHERE project_id = ?1 AND checked_at >= ?2 ORDER BY checked_at")
		.bind(projectId, since)
		.all<{ checked_at: number; up: number; response_ms: number | null; status_code: number | null }>();
	return results.map((r) => ({ checkedAt: r.checked_at, up: r.up === 1, responseMs: r.response_ms, statusCode: r.status_code }));
}

/** Each project's latest uptime check in the last day: true up, false down (absent when there's none). */
export async function latestUptime(db: D1Database, now: number): Promise<Map<number, boolean>> {
	const { results } = await db
		.prepare(
			`SELECT project_id, up FROM (
			   SELECT project_id, up, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY checked_at DESC) AS n
			   FROM uptime_checks WHERE checked_at >= ?1)
			 WHERE n = 1`,
		)
		.bind(now - 86_400_000)
		.all<{ project_id: number; up: number }>();
	return new Map(results.map((r) => [r.project_id, r.up === 1]));
}

/** Runs of failed checks. `end` is the first good check after, or null if still down. Newest first. */
export function outages(checks: Check[]): Outage[] {
	const found: Outage[] = [];
	let current: Outage | null = null;
	for (const check of checks) {
		if (!check.up) {
			if (!current) current = { start: check.checkedAt, end: null, checks: 0 };
			current.checks += 1;
		} else if (current) {
			current.end = check.checkedAt;
			found.push(current);
			current = null;
		}
	}
	if (current) found.push(current);
	return found.reverse();
}


// ---------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------

export type EventRow = { id: number; ts: number; source: "browser" | "server"; name: string; path: string | null; props: string };
export type EventFilter = { projectId: number; from: string; to: string; name?: string | null; source?: "browser" | "server" | null };

function eventWhere(filter: EventFilter): { sql: string; params: unknown[] } {
	const clauses = ["project_id = ?1", "day BETWEEN ?2 AND ?3"];
	const params: unknown[] = [filter.projectId, filter.from, filter.to];
	if (filter.name) {
		params.push(filter.name);
		clauses.push(`name = ?${params.length}`);
	}
	if (filter.source) {
		params.push(filter.source);
		clauses.push(`source = ?${params.length}`);
	}
	return { sql: clauses.join(" AND "), params };
}

export const EVENTS_PAGE_SIZE = 50;

export async function listEvents(db: D1Database, filter: EventFilter, page = 1): Promise<{ rows: EventRow[]; total: number }> {
	const { sql, params } = eventWhere(filter);
	const offset = ((Number.isInteger(page) && page > 0 ? page : 1) - 1) * EVENTS_PAGE_SIZE;
	const n = params.length;
	const [rows, total] = await Promise.all([
		db
			.prepare(`SELECT id, ts, source, name, path, props FROM events WHERE ${sql} ORDER BY ts DESC, id DESC LIMIT ?${n + 1} OFFSET ?${n + 2}`)
			.bind(...params, EVENTS_PAGE_SIZE, offset)
			.all<EventRow>(),
		db.prepare(`SELECT count(*) AS n FROM events WHERE ${sql}`).bind(...params).first<{ n: number }>(),
	]);
	return { rows: rows.results, total: total?.n ?? 0 };
}

/** Pages through matching events newest first, `batch` rows at a time (for the CSV export). */
export async function* eachEvent(db: D1Database, filter: EventFilter, batch = 1000): AsyncGenerator<EventRow> {
	const { sql, params } = eventWhere(filter);
	let before: { ts: number; id: number } | null = null;
	for (;;) {
		const n = params.length;
		const cursor: string = before ? ` AND (ts < ?${n + 1} OR (ts = ?${n + 1} AND id < ?${n + 2}))` : "";
		const bound: unknown[] = before ? [...params, before.ts, before.id] : [...params];
		bound.push(batch);
		const { results } = await db
			.prepare(`SELECT id, ts, source, name, path, props FROM events WHERE ${sql}${cursor} ORDER BY ts DESC, id DESC LIMIT ?${bound.length}`)
			.bind(...bound)
			.all<EventRow>();
		for (const row of results) yield row;
		if (results.length < batch) return;
		const last: EventRow = results[results.length - 1];
		before = { ts: last.ts, id: last.id };
	}
}

export async function eventNames(db: D1Database, projectId: number, from: string): Promise<string[]> {
	const { results } = await db
		.prepare("SELECT DISTINCT name FROM events WHERE project_id = ?1 AND day >= ?2 ORDER BY name")
		.bind(projectId, from)
		.all<{ name: string }>();
	return results.map((r) => r.name);
}

// ---------------------------------------------------------------------------------------
// Tracked links, searches and product numbers
// ---------------------------------------------------------------------------------------

/** The pages visitors who arrived with ?ref=<ref> viewed (raw page views, so the last 90 days). */
export async function refPages(db: D1Database, projectId: number, ref: string, from: string, to: string, limit = 10): Promise<Ranked[]> {
	const { results } = await db
		.prepare(
			`SELECT path AS key, count(*) AS pageviews, count(DISTINCT visitor_id) AS visitors FROM page_views
			 WHERE project_id = ?1 AND ref = ?2 AND day BETWEEN ?3 AND ?4 GROUP BY path ORDER BY visitors DESC, pageviews DESC, path LIMIT ?5`,
		)
		.bind(projectId, ref, from, to, limit)
		.all<Ranked>();
	return results;
}

export type SearchTerm = { words: string; count: number };

/** The most common search words from `search` or `search_no_results` events (raw, last 90 days). "" means filters only. */
export async function searchTerms(db: D1Database, projectId: number, name: "search" | "search_no_results", from: string, to: string, limit = 20): Promise<SearchTerm[]> {
	const { results } = await db
		.prepare(
			`SELECT lower(trim(COALESCE(json_extract(props, '$.words'), ''))) AS words, count(*) AS count FROM events
			 WHERE project_id = ?1 AND name = ?2 AND day BETWEEN ?3 AND ?4 GROUP BY words ORDER BY count DESC, words LIMIT ?5`,
		)
		.bind(projectId, name, from, to, limit)
		.all<SearchTerm>();
	return results;
}

/** True when the project sent this event in the date range. */
export async function hasEvent(db: D1Database, projectId: number, name: string, from: string, to: string): Promise<boolean> {
	const row = await db
		.prepare("SELECT 1 AS found FROM events WHERE project_id = ?1 AND name = ?2 AND day BETWEEN ?3 AND ?4 LIMIT 1")
		.bind(projectId, name, from, to)
		.first<{ found: number }>();
	return Boolean(row);
}

/** How many searches, and how many found nothing, in the range. */
export async function searchCounts(db: D1Database, projectId: number, from: string, to: string): Promise<{ searches: number; noResults: number }> {
	const row = await db
		.prepare(
			`SELECT sum(CASE WHEN name = 'search' THEN 1 ELSE 0 END) AS searches, sum(CASE WHEN name = 'search_no_results' THEN 1 ELSE 0 END) AS no_results
			 FROM events WHERE project_id = ?1 AND name IN ('search', 'search_no_results') AND day BETWEEN ?2 AND ?3`,
		)
		.bind(projectId, from, to)
		.first<{ searches: number | null; no_results: number | null }>();
	return { searches: row?.searches ?? 0, noResults: row?.no_results ?? 0 };
}

/** Each public product number's latest daily value, for the "1,240 open jobs · 300 companies" line. */
export async function publicProductNumbers(db: D1Database, projectId: number, today: string): Promise<{ kind: "latest"; label: string; figure: number | null; latestDay: string | null }[]> {
	const { results } = await db
		.prepare(
			`SELECT m.label, v.value, v.day FROM metrics m
			 LEFT JOIN metric_values v ON v.metric_id = m.id AND v.day = (SELECT max(day) FROM metric_values WHERE metric_id = m.id AND day <= ?2)
			 WHERE m.project_id = ?1 AND m.source = 'product' AND m.is_public = 1 ORDER BY m.sort_order, m.id`,
		)
		.bind(projectId, today)
		.all<{ label: string; value: number | null; day: string | null }>();
	return results.map((r) => ({ kind: "latest", label: r.label, figure: r.value, latestDay: r.day }));
}

export type TrackedLink = {
	/** "linkedin-post-12" for a ?ref= link, or "LinkedIn · launch-post" for a UTM-tagged one. */
	label: string;
	kind: "ref" | "utm";
	visitors: number;
	/** The pages its visitors read most (raw page views, so from the last 90 days). */
	read: string[];
};

/**
 * One list of tracked links: ?ref= links and UTM-tagged links together, most visitors first.
 * Visitors come from the roll-ups (the whole range); what they read from raw page views
 * (`readFrom`/`readTo`, at most the last 90 days).
 */
export async function trackedLinks(db: D1Database, projectId: number, from: string, to: string, readFrom: string, readTo: string, limit = 20): Promise<TrackedLink[]> {
	const [refs, utm, refReads, utmReads] = await Promise.all([
		ranked(db, "refs", projectId, from, to, limit),
		db
			.prepare(
				`SELECT utm_source AS source, utm_campaign AS campaign, sum(visitors) AS visitors FROM daily_campaigns
				 WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3 GROUP BY utm_source, utm_campaign ORDER BY visitors DESC LIMIT ?4`,
			)
			.bind(projectId, from, to, limit)
			.all<{ source: string; campaign: string; visitors: number }>(),
		db
			.prepare(
				`SELECT ref AS key, path, count(DISTINCT visitor_id) AS visitors FROM page_views
				 WHERE project_id = ?1 AND ref IS NOT NULL AND day BETWEEN ?2 AND ?3 GROUP BY ref, path ORDER BY visitors DESC, path`,
			)
			.bind(projectId, readFrom, readTo)
			.all<{ key: string; path: string; visitors: number }>(),
		db
			.prepare(
				`SELECT COALESCE(utm_source, '') || '|' || COALESCE(utm_campaign, '') AS key, path, count(DISTINCT visitor_id) AS visitors FROM page_views
				 WHERE project_id = ?1 AND (utm_source IS NOT NULL OR utm_campaign IS NOT NULL) AND day BETWEEN ?2 AND ?3
				 GROUP BY key, path ORDER BY visitors DESC, path`,
			)
			.bind(projectId, readFrom, readTo)
			.all<{ key: string; path: string; visitors: number }>(),
	]);
	const topPages = (rows: { key: string; path: string }[], key: string) => rows.filter((r) => r.key === key).slice(0, 3).map((r) => r.path);
	const links: TrackedLink[] = [
		...refs.map((r) => ({ label: r.key, kind: "ref" as const, visitors: r.visitors, read: topPages(refReads.results, r.key) })),
		...utm.results.map((u) => ({
			label: [u.source ? sourceName(u.source) : "", u.campaign].filter(Boolean).join(" · ") || "Tagged link",
			kind: "utm" as const,
			visitors: u.visitors,
			read: topPages(utmReads.results, `${u.source}|${u.campaign}`),
		})),
	];
	return links.sort((a, b) => b.visitors - a.visitors || a.label.localeCompare(b.label)).slice(0, limit);
}

/** How many different paths visitors hit a 404 on (raw events, so at most the last 90 days). */
export async function brokenLinks(db: D1Database, projectId: number, from: string, to: string): Promise<number> {
	const row = await db
		.prepare("SELECT count(DISTINCT path) AS n FROM events WHERE project_id = ?1 AND name = 'not_found' AND day BETWEEN ?2 AND ?3")
		.bind(projectId, from, to)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

/**
 * The numbers a project's outcomes can use, with their current values, for the settings form:
 * each product number's latest value and visitors over the last 30 days.
 */
export async function outcomeNumbers(db: D1Database, projectId: number, today: string): Promise<{ key: string; label: string; value: number | null; isPublic: boolean; period: string }[]> {
	const [{ results }, visitors] = await Promise.all([
		db
			.prepare(
				`SELECT m.key, m.label, m.is_public, m.source, v.value FROM metrics m
				 LEFT JOIN metric_values v ON v.metric_id = m.id AND v.day = (SELECT max(day) FROM metric_values WHERE metric_id = m.id AND day <= ?2)
				 WHERE m.project_id = ?1 AND (m.source = 'product' OR (m.source = 'collector' AND m.key = 'visitors')) ORDER BY m.sort_order, m.id`,
			)
			.bind(projectId, today)
			.all<{ key: string; label: string; is_public: number; source: string; value: number | null }>(),
		db
			.prepare("SELECT COALESCE(sum(visitors), 0) AS total FROM daily_totals WHERE project_id = ?1 AND day >= ?2 AND day <= ?3")
			.bind(projectId, addDays(today, -29), today)
			.first<{ total: number }>(),
	]);
	return results.map((r) => ({
		key: r.key,
		label: r.label,
		value: r.source === "collector" ? (visitors?.total ?? 0) : r.value,
		isPublic: r.is_public === 1,
		period: r.source === "collector" ? "in 30 days" : "latest",
	}));
}
