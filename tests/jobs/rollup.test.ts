import { describe, expect, it } from "vitest";
import { percentile, rollupDay } from "@/lib/jobs/rollup";
import { createProject, db, insert, validPageView } from "../helpers";

const DAY = "2026-11-02";
const at = (hour: number, minute = 0) => Date.UTC(2026, 10, 2, hour, minute);
const visitor = (n: number) => n.toString(16).padStart(64, "0");

async function view(projectId: number, overrides: Record<string, unknown> = {}) {
	await insert(
		"page_views",
		validPageView(projectId, {
			ts: at(10),
			day: DAY,
			ref: null,
			utm_source: null,
			utm_medium: null,
			utm_campaign: null,
			referrer_domain: null,
			engaged_ms: null,
			scroll_pct: null,
			...overrides,
		}),
	);
}

async function event(projectId: number, name: string, visitorId: string | null = visitor(1)) {
	await insert("events", {
		project_id: projectId,
		ts: at(11),
		day: DAY,
		source: visitorId ? "browser" : "server",
		visitor_id: visitorId,
		name,
		path: "/",
		props: "{}",
	});
}

async function select<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
	return (await db.prepare(sql).bind(...params).all<T>()).results;
}

describe("percentile", () => {
	it("uses the nearest-rank method", () => {
		expect(percentile([], 0.75)).toBeNull();
		expect(percentile([5], 0.75)).toBe(5);
		expect(percentile([1, 2, 3, 4], 0.75)).toBe(3);
		expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.75)).toBe(8);
	});
});

describe("rollupDay", () => {
	it("builds daily_totals from page views and events", async () => {
		const projectId = await createProject();
		await view(projectId, { visitor_id: visitor(1), device: "desktop", engaged_ms: 30_000, scroll_pct: 50 });
		await view(projectId, { visitor_id: visitor(1), device: "desktop", ts: at(10, 5), engaged_ms: 10_000, scroll_pct: 100 });
		await view(projectId, { visitor_id: visitor(2), device: "mobile" });
		await view(projectId, { visitor_id: visitor(3), device: "tablet" });
		await event(projectId, "case_study_read");
		await event(projectId, "comment_posted", null);

		await rollupDay(db, DAY);
		const [totals] = await select("SELECT * FROM daily_totals WHERE project_id = ?1", projectId);
		expect(totals).toMatchObject({
			day: DAY,
			pageviews: 4,
			visitors: 3,
			events: 2,
			desktop_visitors: 1,
			mobile_visitors: 1,
			tablet_visitors: 1,
			other_visitors: 0,
			engaged_ms_sum: 40_000,
			engaged_count: 2,
			scroll_pct_sum: 150,
			scroll_count: 2,
		});
	});

	it("counts a repeat visitor only after a gap of 30 minutes or more", async () => {
		const projectId = await createProject();
		// visitor 1: back after 29 minutes (not a repeat)
		await view(projectId, { visitor_id: visitor(1), ts: at(9, 0) });
		await view(projectId, { visitor_id: visitor(1), ts: at(9, 29) });
		// visitor 2: back after exactly 30 minutes (a repeat)
		await view(projectId, { visitor_id: visitor(2), ts: at(9, 0) });
		await view(projectId, { visitor_id: visitor(2), ts: at(9, 30) });
		// visitor 3: three visits with two long gaps (still one repeat visitor)
		await view(projectId, { visitor_id: visitor(3), ts: at(8) });
		await view(projectId, { visitor_id: visitor(3), ts: at(12) });
		await view(projectId, { visitor_id: visitor(3), ts: at(18) });

		await rollupDay(db, DAY);
		const [totals] = await select<{ visitors: number; repeat_visitors: number }>(
			"SELECT visitors, repeat_visitors FROM daily_totals WHERE project_id = ?1",
			projectId,
		);
		expect(totals).toEqual({ visitors: 3, repeat_visitors: 2 });
	});

	it("works out the 75th percentile of Core Web Vitals", async () => {
		const projectId = await createProject();
		for (const [i, lcp] of [1000, 1500, 2000, 4000].entries()) {
			await view(projectId, { visitor_id: visitor(i + 1), lcp_ms: lcp, cls_milli: (i + 1) * 50, inp_ms: i === 0 ? null : 100 * i });
		}
		await view(projectId, { visitor_id: visitor(9) }); // no vitals

		await rollupDay(db, DAY);
		const [totals] = await select("SELECT lcp_p75_ms, cls_p75_milli, inp_p75_ms, vitals_samples FROM daily_totals WHERE project_id = ?1", projectId);
		// INP [100, 200, 300] → nearest rank ceil(0.75 × 3) = 3rd value.
		expect(totals).toEqual({ lcp_p75_ms: 2000, cls_p75_milli: 150, inp_p75_ms: 300, vitals_samples: 4 });
	});

	it("leaves vitals empty when none were reported", async () => {
		const projectId = await createProject();
		await view(projectId);
		await rollupDay(db, DAY);
		const [totals] = await select("SELECT lcp_p75_ms, vitals_samples FROM daily_totals WHERE project_id = ?1", projectId);
		expect(totals).toEqual({ lcp_p75_ms: null, vitals_samples: 0 });
	});

	it("builds pages, referrers, refs, campaigns, countries and events", async () => {
		const projectId = await createProject();
		await view(projectId, { visitor_id: visitor(1), path: "/", referrer_domain: "linkedin.com", ref: "post-1", utm_source: "linkedin", utm_campaign: "launch", country: "GB" });
		await view(projectId, { visitor_id: visitor(2), path: "/", referrer_domain: "linkedin.com", ref: "post-1", utm_source: "linkedin", utm_campaign: "launch", country: "GB" });
		await view(projectId, { visitor_id: visitor(2), path: "/work", country: "GB" });
		await view(projectId, { visitor_id: visitor(3), path: "/work", country: null });
		await event(projectId, "case_study_read", visitor(1));
		await event(projectId, "case_study_read", visitor(1));
		await event(projectId, "case_study_read", visitor(2));
		await event(projectId, "comment_posted", null);

		await rollupDay(db, DAY);
		const q = (table: string, columns: string) => select(`SELECT ${columns} FROM ${table} WHERE project_id = ?1 ORDER BY 1, 2`, projectId);

		expect(await q("daily_pages", "path, pageviews, visitors")).toEqual([
			{ path: "/", pageviews: 2, visitors: 2 },
			{ path: "/work", pageviews: 2, visitors: 2 },
		]);
		expect(await q("daily_referrers", "referrer_domain, pageviews, visitors")).toEqual([
			{ referrer_domain: "", pageviews: 2, visitors: 2 },
			{ referrer_domain: "linkedin.com", pageviews: 2, visitors: 2 },
		]);
		expect(await q("daily_refs", "ref, pageviews, visitors")).toEqual([{ ref: "post-1", pageviews: 2, visitors: 2 }]);
		expect(await q("daily_campaigns", "utm_source, utm_medium, utm_campaign, pageviews, visitors")).toEqual([
			{ utm_source: "linkedin", utm_medium: "", utm_campaign: "launch", pageviews: 2, visitors: 2 },
		]);
		expect(await q("daily_countries", "country, pageviews, visitors")).toEqual([
			{ country: "", pageviews: 1, visitors: 1 },
			{ country: "GB", pageviews: 3, visitors: 2 },
		]);
		expect(await q("daily_events", "name, count, visitors")).toEqual([
			{ name: "case_study_read", count: 3, visitors: 2 },
			{ name: "comment_posted", count: 1, visitors: 0 },
		]);
	});

	it("rolls up uptime for the day", async () => {
		const projectId = await createProject();
		const checks = [
			{ checked_at: at(0, 0), up: 1, response_ms: 100, status_code: 200 },
			{ checked_at: at(0, 5), up: 1, response_ms: 300, status_code: 200 },
			{ checked_at: at(0, 10), up: 0, response_ms: null, status_code: null },
			{ checked_at: Date.UTC(2026, 10, 3, 0, 0), up: 0, response_ms: null, status_code: 500 }, // next day
		];
		for (const check of checks) await insert("uptime_checks", { project_id: projectId, ...check });

		await rollupDay(db, DAY);
		expect(await select("SELECT checks, up_checks, avg_response_ms FROM daily_uptime WHERE project_id = ?1", projectId)).toEqual([
			{ checks: 3, up_checks: 2, avg_response_ms: 200 },
		]);
	});

	it("gives the same result when run twice, and picks up new data", async () => {
		const projectId = await createProject();
		await view(projectId, { visitor_id: visitor(1) });
		await rollupDay(db, DAY);
		await rollupDay(db, DAY);
		expect(await select("SELECT pageviews FROM daily_totals WHERE project_id = ?1", projectId)).toEqual([{ pageviews: 1 }]);
		expect(await select("SELECT count(*) AS n FROM daily_pages WHERE project_id = ?1", projectId)).toEqual([{ n: 1 }]);

		await view(projectId, { visitor_id: visitor(2) });
		await rollupDay(db, DAY);
		expect(await select("SELECT pageviews, visitors FROM daily_totals WHERE project_id = ?1", projectId)).toEqual([{ pageviews: 2, visitors: 2 }]);
	});

	it("keeps days and projects apart", async () => {
		const a = await createProject();
		const b = await createProject();
		await view(a, { visitor_id: visitor(1) });
		await view(b, { visitor_id: visitor(1) });
		await view(b, { visitor_id: visitor(2) });
		await view(a, { visitor_id: visitor(1), day: "2026-11-03", ts: Date.UTC(2026, 10, 3, 1) });

		await rollupDay(db, DAY);
		expect(await select("SELECT project_id, pageviews FROM daily_totals WHERE project_id IN (?1, ?2) ORDER BY project_id", a, b)).toEqual([
			{ project_id: a, pageviews: 1 },
			{ project_id: b, pageviews: 2 },
		]);
		expect(await select("SELECT count(*) AS n FROM daily_totals WHERE project_id = ?1 AND day = '2026-11-03'", a)).toEqual([{ n: 0 }]);
	});

	it("still records totals for a project with events but no page views", async () => {
		const projectId = await createProject();
		await event(projectId, "comment_posted", null);
		await rollupDay(db, DAY);
		expect(await select("SELECT pageviews, visitors, events FROM daily_totals WHERE project_id = ?1", projectId)).toEqual([
			{ pageviews: 0, visitors: 0, events: 1 },
		]);
	});
});
