/**
 * Queries for the private dashboard. Charts read the daily roll-ups (kept forever); a few
 * sections read raw page views and events, which only exist for the last 90 days.
 * Every query uses bound parameters; table and column names only ever come from the
 * fixed lists in this file.
 */
import { daysBetween } from "@/lib/admin/range";
import { addDays, weekStart } from "@/lib/days";
import { percentile } from "@/lib/jobs/rollup";
import { listProjects, type Project } from "./projects";
import { lastWeeks, shippingStreak, type WeekCommits } from "./streak";

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
	headline: (MetricFigure & { label: string; unit: string }) | null;
	uptime: { lastUp: boolean | null; lastCheckedAt: number | null; uptime7: number | null };
	commitsThisWeek: number;
	streak: { current: number; longest: number };
};

export async function projectSummaries(db: D1Database, today: string): Promise<ProjectSummary[]> {
	const projects = await listProjects(db);
	const thisWeek = weekStart(today);
	const firstWeek = addDays(thisWeek, -7 * 11);
	const since = firstWeek < addDays(today, -59) ? firstWeek : addDays(today, -59);

	const [totals, metrics, lastChecks, uptimeDays, commits] = await Promise.all([
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
		db.prepare("SELECT project_id, week, commits FROM github_weekly").all<{ project_id: number; week: string; commits: number }>(),
	]);

	return Promise.all(
		projects.map(async (project) => {
			const rows = totals.results.filter((r) => r.project_id === project.id).map((r) => ({ day: r.day, value: r.visitors }));
			const series = fill(rows, since, today);
			const window = (end: number, length: number) => sum(series.slice(series.length - end - length, series.length - end));
			const headlineMetric = metrics.find((m) => m.projectId === project.id && m.isHeadline);
			const lastCheck = lastChecks.results.find((r) => r.project_id === project.id);
			const uptime = uptimeDays.results.find((r) => r.project_id === project.id);
			const weeks: WeekCommits[] = commits.results.filter((r) => r.project_id === project.id);

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
				headline: headlineMetric
					? { ...(await metricFigure(db, headlineMetric, today)), label: headlineMetric.label, unit: headlineMetric.unit }
					: null,
				uptime: {
					lastUp: lastCheck ? lastCheck.up === 1 : null,
					lastCheckedAt: lastCheck?.checked_at ?? null,
					uptime7: uptime && uptime.checks > 0 ? uptime.up / uptime.checks : null,
				},
				commitsThisWeek: weeks.find((w) => w.week === thisWeek)?.commits ?? 0,
				streak: shippingStreak(weeks, thisWeek),
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
	const projects = await listProjects(db);

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
	if (jobs.lastFrequent?.ok === false || jobs.lastDaily?.ok === false) {
		items.push({ level: "serious", message: "The most recent job run failed. See job health below." });
	}

	const order = { critical: 0, serious: 1, warning: 2 };
	return items.sort((a, b) => order[a.level] - order[b.level]);
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

const RAW_COLUMNS = ["browser", "os", "screen", "language"] as const;
export type RawColumn = (typeof RAW_COLUMNS)[number];

/** Browser, OS, screen or language from raw page views (last 90 days only). */
export async function rawBreakdown(db: D1Database, projectId: number, column: RawColumn, from: string, to: string, limit = 10): Promise<Ranked[]> {
	if (!RAW_COLUMNS.includes(column)) throw new Error("Unknown column");
	const { results } = await db
		.prepare(
			`SELECT COALESCE(${column}, '') AS key, count(*) AS pageviews, count(DISTINCT visitor_id) AS visitors FROM page_views
			 WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3 GROUP BY key ORDER BY visitors DESC, key LIMIT ?4`,
		)
		.bind(projectId, from, to, limit)
		.all<Ranked>();
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

export type VitalsDay = { day: string; lcp: number | null; cls: number | null; inp: number | null; samples: number };

export async function vitalsSeries(db: D1Database, projectId: number, from: string, to: string): Promise<VitalsDay[]> {
	const { results } = await db
		.prepare(
			`SELECT day, lcp_p75_ms AS lcp, cls_p75_milli AS cls, inp_p75_ms AS inp, vitals_samples AS samples
			 FROM daily_totals WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3`,
		)
		.bind(projectId, from, to)
		.all<VitalsDay>();
	const byDay = new Map(results.map((r) => [r.day, r]));
	return daysBetween(from, to).map((day) => byDay.get(day) ?? { day, lcp: null, cls: null, inp: null, samples: 0 });
}

/** 75th percentile across the whole range, from raw page views (last 90 days only). */
export async function vitalsSummary(db: D1Database, projectId: number, from: string, to: string) {
	const { results } = await db
		.prepare(
			`SELECT lcp_ms, cls_milli, inp_ms FROM page_views WHERE project_id = ?1 AND day BETWEEN ?2 AND ?3
			 AND (lcp_ms IS NOT NULL OR cls_milli IS NOT NULL OR inp_ms IS NOT NULL)`,
		)
		.bind(projectId, from, to)
		.all<{ lcp_ms: number | null; cls_milli: number | null; inp_ms: number | null }>();
	const p75 = (values: (number | null)[]) => percentile(values.filter((v): v is number => v !== null).sort((a, b) => a - b), 0.75);
	return {
		lcp: p75(results.map((r) => r.lcp_ms)),
		cls: p75(results.map((r) => r.cls_milli)),
		inp: p75(results.map((r) => r.inp_ms)),
		samples: results.length,
	};
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

export async function shipping(db: D1Database, projectId: number, today: string) {
	const { results } = await db
		.prepare("SELECT week, commits FROM github_weekly WHERE project_id = ?1")
		.bind(projectId)
		.all<WeekCommits>();
	const thisWeek = weekStart(today);
	return { weeks: lastWeeks(results, thisWeek, 26), streak: shippingStreak(results, thisWeek), synced: results.length > 0 };
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
