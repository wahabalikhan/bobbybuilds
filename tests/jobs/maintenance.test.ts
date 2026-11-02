import { describe, expect, it } from "vitest";
import { handlePageView } from "@/lib/collector/pv";
import { clearSecretCache } from "@/lib/collector/visitor";
import { cleanUp, rotateDailySecret } from "@/lib/jobs/maintenance";
import { browserRequest, keyedProject, rows, testDeps } from "../collector/helpers";
import { createProject, db, insert, validPageView } from "../helpers";

const TODAY = "2026-11-02";

describe("rotateDailySecret", () => {
	it("keeps only today's secret", async () => {
		await insert("daily_secret", { day: "2026-10-31", secret: "1".repeat(64) });
		await insert("daily_secret", { day: "2026-11-01", secret: "2".repeat(64) });
		await rotateDailySecret(db, TODAY);
		const { results } = await db.prepare("SELECT day FROM daily_secret").all<{ day: string }>();
		expect(results).toEqual([{ day: TODAY }]);
	});

	it("doesn't replace a secret already in use today", async () => {
		await db.prepare("DELETE FROM daily_secret").run();
		await insert("daily_secret", { day: TODAY, secret: "3".repeat(64) });
		await rotateDailySecret(db, TODAY);
		const row = await db.prepare("SELECT secret FROM daily_secret WHERE day = ?1").bind(TODAY).first<{ secret: string }>();
		expect(row?.secret).toBe("3".repeat(64));
	});

	it("gives the same visitor a new ID after midnight", async () => {
		const project = await keyedProject();
		const body = { type: "view", key: project.publicKey, path: "/" };
		const beforeMidnight = Date.UTC(2026, 10, 2, 23, 59);
		const afterMidnight = Date.UTC(2026, 10, 3, 0, 1);

		await handlePageView(browserRequest("/v1/pv", body), testDeps({ now: () => beforeMidnight }));
		await rotateDailySecret(db, "2026-11-03");
		clearSecretCache();
		await handlePageView(browserRequest("/v1/pv", body), testDeps({ now: () => afterMidnight }));

		const [first, second] = await rows<{ visitor_id: string }>("page_views", project.id);
		expect(first.visitor_id).not.toBe(second.visitor_id);
		const { results } = await db.prepare("SELECT day FROM daily_secret").all();
		expect(results).toEqual([{ day: "2026-11-03" }]);
	});
});

describe("cleanUp (90 days)", () => {
	it("keeps raw data from exactly 90 days ago and deletes anything older, but never roll-ups", async () => {
		const projectId = await createProject();
		const kept = "2026-08-04"; // 90 days before 2 November
		const gone = "2026-08-03"; // 91 days before
		const dayMs = (day: string, hour = 12) => Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);

		for (const day of [kept, gone]) {
			await insert("page_views", validPageView(projectId, { day, ts: dayMs(day) }));
			await insert("events", { project_id: projectId, ts: dayMs(day), day, source: "server", name: "job_posted", props: "{}" });
			await insert("uptime_checks", { project_id: projectId, checked_at: dayMs(day, 0), up: 1 });
			await insert("daily_totals", { project_id: projectId, day, pageviews: 1, visitors: 1 });
			await insert("job_runs", { task: "daily", started_at: dayMs(day, 0) });
		}

		const summary = await cleanUp(db, TODAY);
		expect(summary).toMatchObject({ before: kept, pageViews: 1, events: 1, uptimeChecks: 1 });

		const days = async (sql: string) => (await db.prepare(sql).bind(projectId).all<{ d: string }>()).results.map((r) => r.d);
		expect(await days("SELECT day AS d FROM page_views WHERE project_id = ?1")).toEqual([kept]);
		expect(await days("SELECT day AS d FROM events WHERE project_id = ?1")).toEqual([kept]);
		expect(await days("SELECT date(checked_at / 1000, 'unixepoch') AS d FROM uptime_checks WHERE project_id = ?1")).toEqual([kept]);
		expect(await days("SELECT day AS d FROM daily_totals WHERE project_id = ?1 ORDER BY day")).toEqual([gone, kept]);
		const runs = await db.prepare("SELECT date(started_at / 1000, 'unixepoch') AS d FROM job_runs").all<{ d: string }>();
		expect(runs.results.map((r) => r.d)).not.toContain(gone);
	});

	it("deletes a large backlog in chunks", async () => {
		const projectId = await createProject();
		const statements = Array.from({ length: 5200 }, (_, i) =>
			db
				.prepare("INSERT INTO uptime_checks (project_id, checked_at, up) VALUES (?1, ?2, 1)")
				.bind(projectId, Date.UTC(2026, 0, 1) + i * 1000),
		);
		await db.batch(statements);
		const summary = await cleanUp(db, TODAY);
		expect(summary.uptimeChecks).toBeGreaterThanOrEqual(5200);
		const row = await db.prepare("SELECT count(*) AS n FROM uptime_checks WHERE project_id = ?1").bind(projectId).first<{ n: number }>();
		expect(row?.n).toBe(0);
	});
});
