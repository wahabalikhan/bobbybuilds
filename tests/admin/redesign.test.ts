import { describe, expect, it } from "vitest";
import { attentionItems, failureDetail, hasEvent, projectSummaries, publicProductNumbers, refPages, searchCounts, searchTerms } from "@/lib/db/dashboard";
import { getProjectBySlug, isConnected, isTestProject, listRealProjects, projectsWithVisits } from "@/lib/db/projects";
import { productLine } from "@/lib/public/product-line";
import { buildSnapshot } from "@/lib/public/snapshot";
import { availableTabs } from "@/app/admin/projects/[slug]/tab-list";
import { createProject, db, insert, validPageView } from "../helpers";

const TODAY = "2026-11-02";
const NOW = Date.UTC(2026, 10, 2, 12);
const visitor = (n: number) => n.toString(16).padStart(64, "0");
const event = (projectId: number, name: string, props: Record<string, unknown>, n = 1) =>
	insert("events", { project_id: projectId, ts: NOW + n, day: TODAY, source: "server", visitor_id: null, name, path: "/search", props: JSON.stringify(props) });

describe("test projects", () => {
	it("are the ones that only accept loopback origins", () => {
		expect(isTestProject({ allowedOrigins: ["http://localhost:5555"] })).toBe(true);
		expect(isTestProject({ allowedOrigins: ["http://127.0.0.1:8787", "http://[::1]:3000"] })).toBe(true);
		expect(isTestProject({ allowedOrigins: ["https://wahabalikhan.com", "http://localhost:5555"] })).toBe(false);
		expect(isTestProject({ allowedOrigins: [] })).toBe(false);
	});

	it("are left out of the lists, the summaries and the public snapshot", async () => {
		const id = await createProject({ slug: "a-playground", name: "A Playground", status: "live", allowed_origins: '["http://localhost:5555"]' });
		expect((await listRealProjects(db)).some((p) => p.id === id)).toBe(false);
		expect((await projectSummaries(db, TODAY)).some((s) => s.project.id === id)).toBe(false);
		expect((await attentionItems(db, NOW)).some((a) => a.projectSlug === "a-playground")).toBe(false);
		expect((await buildSnapshot(db, TODAY, NOW)).projects.some((p) => p.slug === "a-playground")).toBe(false);
	});
});

describe("connected", () => {
	it("means keys made and at least one page view ever (raw or rolled up)", async () => {
		const id = await createProject({ public_key: `pk_${"c".repeat(24)}` });
		const project = (await getProjectBySlug(db, (await db.prepare("SELECT slug FROM projects WHERE id = ?1").bind(id).first<{ slug: string }>())!.slug))!;
		expect(isConnected(project, await projectsWithVisits(db))).toBe(false);
		await insert("page_views", validPageView(id));
		expect(isConnected(project, await projectsWithVisits(db))).toBe(true);
		expect(isConnected({ ...project, publicKey: null }, await projectsWithVisits(db))).toBe(false);
	});
});

describe("tracked links", () => {
	it("lists what visitors who arrived with a ref read", async () => {
		const id = await createProject();
		await insert("page_views", validPageView(id, { ref: "cv-download", path: "/", visitor_id: visitor(1) }));
		await insert("page_views", validPageView(id, { ref: "cv-download", path: "/case-studies/git-diff", visitor_id: visitor(1), ts: NOW + 1 }));
		await insert("page_views", validPageView(id, { ref: "cv-download", path: "/case-studies/git-diff", visitor_id: visitor(2), ts: NOW + 2 }));
		await insert("page_views", validPageView(id, { ref: "other", path: "/cv", visitor_id: visitor(3), ts: NOW + 3 }));
		expect(await refPages(db, id, "cv-download", TODAY, TODAY)).toEqual([
			{ key: "/case-studies/git-diff", pageviews: 2, visitors: 2 },
			{ key: "/", pageviews: 1, visitors: 1 },
		]);
	});
});

describe("searches", () => {
	it("counts the most common searches and the ones with no results, by their words", async () => {
		const id = await createProject();
		await event(id, "search", { words: "Designer", results: 10 }, 1);
		await event(id, "search", { words: "designer ", results: 8 }, 2);
		await event(id, "search", { words: "rust", results: 0 }, 3);
		await event(id, "search", { filters: ["remote"], results: 4 }, 4);
		await event(id, "search_no_results", { words: "rust" }, 5);
		expect(await searchTerms(db, id, "search", TODAY, TODAY)).toEqual([
			{ words: "designer", count: 2 },
			{ words: "", count: 1 },
			{ words: "rust", count: 1 },
		]);
		expect(await searchTerms(db, id, "search_no_results", TODAY, TODAY)).toEqual([{ words: "rust", count: 1 }]);
		expect(await searchCounts(db, id, TODAY, TODAY)).toEqual({ searches: 4, noResults: 1 });
		expect(await hasEvent(db, id, "search", TODAY, TODAY)).toBe(true);
		expect(await hasEvent(db, await createProject(), "search", TODAY, TODAY)).toBe(false);
	});
});

describe("dashboard tabs", () => {
	it("are in order, with Searches, Funnel and Product numbers only when there's something to show", () => {
		expect(availableTabs({ hasSearches: false, hasFunnel: false, hasProductNumbers: false }).map((t) => t.label)).toEqual(["Traffic", "Tracked links", "Health", "Events"]);
		expect(availableTabs({ hasSearches: true, hasFunnel: true, hasProductNumbers: true }).map((t) => t.label)).toEqual(["Traffic", "Tracked links", "Searches", "Funnel", "Product numbers", "Health", "Events"]);
	});
});

describe("needs attention", () => {
	it("lists failed job runs from the last day with their error, and not older ones", async () => {
		await insert("job_runs", { task: "daily", started_at: NOW - 3_600_000, finished_at: NOW - 3_500_000, ok: 0, summary: JSON.stringify({ error: "D1_ERROR: no such table: github_contributions" }) });
		await insert("job_runs", { task: "frequent", started_at: NOW - 3 * 86_400_000, finished_at: NOW - 3 * 86_400_000 + 1000, ok: 0, summary: JSON.stringify({ error: "an old failure" }) });
		const messages = (await attentionItems(db, NOW)).map((a) => a.message);
		expect(messages).toContain("The daily job failed at 11:00 UTC: D1_ERROR: no such table: github_contributions");
		expect(messages.some((m) => m.includes("an old failure"))).toBe(false);
		expect(messages.some((m) => m.includes("job health below"))).toBe(false);
	});

	it("shortens a failure's error to one line", () => {
		expect(failureDetail('{"error":"Boom\\n  at somewhere"}')).toBe("Boom at somewhere");
		expect(failureDetail("{}")).toBe("");
		expect(failureDetail("x".repeat(300))).toHaveLength(120);
	});
});

describe("public product numbers", () => {
	it("are each public product number's latest daily value, for the card's line", async () => {
		const id = await createProject();
		const metric = async (key: string, label: string, isPublic: number, sort: number) =>
			(await db.prepare("INSERT INTO metrics (project_id, key, label, source, is_public, sort_order) VALUES (?1, ?2, ?3, 'product', ?4, ?5) RETURNING id").bind(id, key, label, isPublic, sort).first<{ id: number }>())!.id;
		const jobs = await metric("open_jobs", "Open jobs", 1, 1);
		const companies = await metric("active_companies", "Companies", 1, 2);
		const hidden = await metric("returning_users", "Returning users", 0, 3);
		for (const [metricId, day, value] of [[jobs, "2026-11-01", 1200], [jobs, TODAY, 1240], [companies, "2026-10-30", 300], [hidden, TODAY, 9]] as const) {
			await insert("metric_values", { metric_id: metricId, day, value, updated_at: NOW });
		}
		const numbers = await publicProductNumbers(db, id, TODAY);
		expect(numbers).toEqual([
			{ kind: "latest", label: "Open jobs", figure: 1240, latestDay: TODAY },
			{ kind: "latest", label: "Companies", figure: 300, latestDay: "2026-10-30" },
		]);
		expect(productLine(numbers, TODAY)).toBe("1,240 open jobs · 300 companies");
	});
});
