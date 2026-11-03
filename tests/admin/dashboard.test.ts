import { describe, expect, it } from "vitest";
import {
	attentionItems,
	campaigns,
	dailySeries,
	eachEvent,
	eventBreakdown,
	eventNames,
	EVENTS_PAGE_SIZE,
	listEvents,
	listMetrics,
	metricFigure,
	metricSeries,
	monthlyVisitors,
	outages,
	projectSummaries,
	ranked,
	rangeTotals,
	uptimeDays,
	type Check,
} from "@/lib/db/dashboard";
import { rollupDay } from "@/lib/jobs/rollup";
import { createProject, db, insert, validPageView } from "../helpers";

const TODAY = "2026-11-02";
const visitor = (n: number) => n.toString(16).padStart(64, "0");
const tsOn = (day: string, hour = 12) => Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);

async function views(projectId: number, day: string, count: number, overrides: Record<string, unknown> = {}) {
	for (let i = 0; i < count; i += 1) {
		await insert("page_views", validPageView(projectId, { day, ts: tsOn(day) + i, visitor_id: visitor(i + 1), ...overrides }));
	}
}

async function event(projectId: number, day: string, name: string, extra: Record<string, unknown> = {}) {
	await insert("events", { project_id: projectId, ts: tsOn(day), day, source: "browser", visitor_id: visitor(1), name, path: "/", props: "{}", ...extra });
}

describe("project dashboard queries", () => {
	it("fills days with no data with zeros", async () => {
		const id = await createProject();
		await views(id, "2026-10-30", 3);
		await views(id, "2026-11-01", 2);
		for (const day of ["2026-10-30", "2026-11-01"]) await rollupDay(db, day);
		expect(await dailySeries(db, id, "visitors", "2026-10-30", "2026-11-02")).toEqual([
			{ day: "2026-10-30", value: 3 },
			{ day: "2026-10-31", value: 0 },
			{ day: "2026-11-01", value: 2 },
			{ day: "2026-11-02", value: 0 },
		]);
	});

	it("adds up totals and averages for a range", async () => {
		const id = await createProject();
		await views(id, "2026-11-01", 2, { engaged_ms: 30_000, scroll_pct: 40, device: "mobile" });
		await views(id, "2026-11-02", 1, { engaged_ms: 60_000, scroll_pct: 100, device: "desktop" });
		for (const day of ["2026-11-01", "2026-11-02"]) await rollupDay(db, day);
		const totals = await rangeTotals(db, id, "2026-11-01", "2026-11-02");
		expect(totals).toMatchObject({ pageviews: 3, visitors: 3, avgEngagedMs: 40_000, avgScrollPct: 60, devices: { desktop: 1, mobile: 2, tablet: 0, other: 0 } });
		expect((await rangeTotals(db, id, "2026-10-01", "2026-10-02")).avgEngagedMs).toBeNull();
	});

	it("ranks pages, referrers, refs, countries and campaigns across days", async () => {
		const id = await createProject();
		await views(id, "2026-11-01", 3, { path: "/work", referrer_domain: "linkedin.com", ref: "post-1", country: "GB", utm_source: "linkedin", utm_medium: null, utm_campaign: "launch" });
		await views(id, "2026-11-02", 2, { path: "/", referrer_domain: null, ref: null, country: "US", utm_source: null, utm_medium: null, utm_campaign: null });
		await views(id, "2026-11-02", 1, { path: "/work", referrer_domain: "linkedin.com", ref: "post-1", country: "GB", utm_source: "linkedin", utm_medium: null, utm_campaign: "launch", visitor_id: visitor(9) });
		for (const day of ["2026-11-01", "2026-11-02"]) await rollupDay(db, day);

		expect(await ranked(db, "pages", id, "2026-11-01", TODAY)).toEqual([
			{ key: "/work", pageviews: 4, visitors: 4 },
			{ key: "/", pageviews: 2, visitors: 2 },
		]);
		expect((await ranked(db, "referrers", id, "2026-11-01", TODAY)).map((r) => r.key)).toEqual(["linkedin.com", ""]);
		expect(await ranked(db, "refs", id, "2026-11-01", TODAY)).toEqual([{ key: "post-1", pageviews: 4, visitors: 4 }]);
		expect((await ranked(db, "countries", id, "2026-11-01", TODAY)).map((r) => [r.key, r.visitors])).toEqual([["GB", 4], ["US", 2]]);
		expect(await campaigns(db, id, "2026-11-01", TODAY)).toEqual([{ source: "linkedin", medium: "", campaign: "launch", pageviews: 4, visitors: 4 }]);
		expect(await ranked(db, "pages", id, "2026-11-01", TODAY, 1)).toHaveLength(1);
	});

	it("ranks 404s by path, outbound clicks by domain and downloads by file", async () => {
		const id = await createProject();
		await event(id, TODAY, "not_found", { path: "/old" });
		await event(id, TODAY, "not_found", { path: "/old" });
		await event(id, TODAY, "outbound_click", { props: '{"domain":"github.com"}' });
		await event(id, TODAY, "file_download", { props: '{"file":"cv.pdf","type":"pdf"}' });
		expect(await eventBreakdown(db, id, "not_found", TODAY, TODAY)).toEqual([{ key: "/old", count: 2, visitors: 1 }]);
		expect((await eventBreakdown(db, id, "outbound_click", TODAY, TODAY))[0].key).toBe("github.com");
		expect((await eventBreakdown(db, id, "file_download", TODAY, TODAY))[0].key).toBe("cv.pdf");
	});

	it("fills uptime days and finds outages", async () => {
		const id = await createProject();
		await insert("daily_uptime", { project_id: id, day: TODAY, checks: 10, up_checks: 9, avg_response_ms: 120 });
		expect(await uptimeDays(db, id, "2026-11-01", TODAY)).toEqual([
			{ day: "2026-11-01", checks: 0, up: 0, avgResponseMs: null },
			{ day: TODAY, checks: 10, up: 9, avgResponseMs: 120 },
		]);

		const check = (minute: number, up: boolean): Check => ({ checkedAt: minute * 60_000, up, responseMs: up ? 100 : null, statusCode: up ? 200 : 503 });
		const found = outages([check(0, true), check(5, false), check(10, false), check(15, true), check(20, true), check(25, false)]);
		expect(found).toEqual([
			{ start: 25 * 60_000, end: null, checks: 1 },
			{ start: 5 * 60_000, end: 15 * 60_000, checks: 2 },
		]);
	});
});

describe("metrics", () => {
	it("gives a 30-day figure for counts and the latest value for product numbers", async () => {
		const id = await createProject();
		await views(id, "2026-10-20", 4);
		await rollupDay(db, "2026-10-20");
		await event(id, "2026-10-25", "case_study_read");
		await rollupDay(db, "2026-10-25");
		await db.batch([
			db.prepare("INSERT INTO metrics (project_id, key, label, source) VALUES (?1, 'visitors', 'Visitors', 'collector')").bind(id),
			db.prepare("INSERT INTO metrics (project_id, key, label, source, event_name) VALUES (?1, 'reads', 'Reads', 'event', 'case_study_read')").bind(id),
			db.prepare("INSERT INTO metrics (project_id, key, label, source) VALUES (?1, 'jobs', 'Jobs', 'product')").bind(id),
		]);
		const [visitors, reads, jobs] = await listMetrics(db, id);
		await insert("metric_values", { metric_id: jobs.id, day: "2026-10-30", value: 12 });
		await insert("metric_values", { metric_id: jobs.id, day: "2026-11-01", value: 15 });

		expect(await metricFigure(db, visitors, TODAY)).toEqual({ value: 4, period: "last 30 days" });
		expect(await metricFigure(db, reads, TODAY)).toEqual({ value: 1, period: "last 30 days" });
		expect(await metricFigure(db, jobs, TODAY)).toEqual({ value: 15, period: "latest" });
		expect((await metricSeries(db, jobs, "2026-10-30", "2026-11-01")).map((d) => d.value)).toEqual([12, 0, 15]);
	});
});

describe("overview", () => {
	it("summarises each project", async () => {
		const id = await createProject({ slug: "summary-test", github_repo: "a/b" });
		await views(id, TODAY, 5);
		await views(id, "2026-10-20", 3);
		await views(id, "2026-09-25", 2); // in the 30 days before
		for (const day of [TODAY, "2026-10-20", "2026-09-25"]) await rollupDay(db, day);
		await insert("uptime_checks", { project_id: id, checked_at: tsOn(TODAY, 3), up: 1 });

		const summary = (await projectSummaries(db, TODAY)).find((s) => s.project.slug === "summary-test")!;
		expect(summary).toMatchObject({
			visitorsToday: 5,
			visitors7: 5,
			visitors30: 8,
			visitors30Previous: 2,
			uptime: { lastUp: true },
		});
		expect(summary.sparkline).toHaveLength(30);
	});

	it("totals visitors per month for 12 months", async () => {
		const id = await createProject();
		await views(id, "2026-11-01", 2);
		await views(id, "2025-12-15", 1);
		await views(id, "2025-11-30", 7); // 12 months ago: outside
		for (const day of ["2026-11-01", "2025-12-15", "2025-11-30"]) await rollupDay(db, day);
		const months = await monthlyVisitors(db, TODAY, id);
		expect(months).toHaveLength(12);
		expect(months[0]).toEqual({ month: "2025-12", value: 1 });
		expect(months[11]).toEqual({ month: "2026-11", value: 2 });
	});

	it("flags a site that's down, a quiet live site, missing keys and late jobs", async () => {
		const now = tsOn(TODAY, 12);
		const down = await createProject({ name: "Down site", slug: "down-site", status: "building" });
		await insert("uptime_checks", { project_id: down, checked_at: now - 600_000, up: 0 });
		await insert("uptime_checks", { project_id: down, checked_at: now - 300_000, up: 0 });
		await createProject({ name: "Quiet site", slug: "quiet-site", status: "live" });

		const items = await attentionItems(db, now);
		const messages = items.map((i) => i.message);
		expect(items[0]).toMatchObject({ level: "critical", projectSlug: "down-site" });
		expect(messages).toContain("Quiet site has had no page views in 24 hours. Check the t.js snippet is still on the site.");
		expect(messages).toContain("Down site has no keys yet.");
		expect(messages.some((m) => m.includes("5-minute job"))).toBe(true);
		expect(messages.some((m) => m.includes("daily job"))).toBe(true);
	});
});

describe("events", () => {
	it("filters by name and source, pages through 50 at a time, newest first", async () => {
		const id = await createProject();
		for (let i = 0; i < 60; i += 1) await event(id, TODAY, "case_study_read", { ts: tsOn(TODAY) + i });
		await event(id, TODAY, "job_posted", { source: "server", visitor_id: null, ts: tsOn(TODAY, 20) });

		const first = await listEvents(db, { projectId: id, from: TODAY, to: TODAY }, 1);
		expect(first.total).toBe(61);
		expect(first.rows).toHaveLength(EVENTS_PAGE_SIZE);
		expect(first.rows[0].name).toBe("job_posted");
		expect((await listEvents(db, { projectId: id, from: TODAY, to: TODAY }, 2)).rows).toHaveLength(11);
		expect((await listEvents(db, { projectId: id, from: TODAY, to: TODAY, source: "server" })).total).toBe(1);
		expect((await listEvents(db, { projectId: id, from: TODAY, to: TODAY, name: "case_study_read" })).total).toBe(60);
		expect((await listEvents(db, { projectId: id, from: TODAY, to: TODAY }, Number.NaN)).rows).toHaveLength(EVENTS_PAGE_SIZE);
		expect(await eventNames(db, id, "2026-10-01")).toEqual(["case_study_read", "job_posted"]);
	});

	it("streams every event across batch boundaries without repeats", async () => {
		const id = await createProject();
		for (let i = 0; i < 25; i += 1) await event(id, TODAY, "case_study_read", { ts: tsOn(TODAY) + Math.floor(i / 3) }); // shared timestamps
		const seen: number[] = [];
		for await (const row of eachEvent(db, { projectId: id, from: TODAY, to: TODAY }, 4)) seen.push(row.id);
		expect(seen).toHaveLength(25);
		expect(new Set(seen).size).toBe(25);
	});
});
