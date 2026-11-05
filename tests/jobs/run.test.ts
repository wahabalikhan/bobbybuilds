import { describe, expect, it } from "vitest";
import { handleJobRequest, runTask } from "@/lib/jobs/run";
import { SCHEDULES, trigger } from "../../cron/src/index";
import { createProject, db, insert, validPageView } from "../helpers";

const SECRET = "s".repeat(64);
const NOW = Date.UTC(2026, 11, 7, 0, 10); // Monday 7 December 2026, 00:10 UTC

const okFetch = (async () => new Response("[]")) as typeof fetch;
const deps = (overrides = {}) => ({ db, fetch: okFetch, secret: SECRET, now: () => NOW, ...overrides });

function jobRequest(body: unknown, auth: string | null = `Bearer ${SECRET}`, method = "POST") {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (auth) headers.Authorization = auth;
	return new Request("https://bobbybuilds.internal/internal/jobs", { method, headers, body: method === "POST" ? JSON.stringify(body) : undefined });
}

describe("/internal/jobs", () => {
	it.each([
		["no secret", null],
		["the wrong secret", `Bearer ${"x".repeat(64)}`],
		["a secret of a different length", "Bearer short"],
		["a non-Bearer header", `Basic ${SECRET}`],
	])("answers 404 with %s", async (_label, auth) => {
		const response = await handleJobRequest(jobRequest({ task: "daily" }, auth), deps());
		expect(response.status).toBe(404);
	});

	it("answers 404 when ROLLUP_SECRET isn't set at all", async () => {
		expect((await handleJobRequest(jobRequest({ task: "daily" }), deps({ secret: undefined }))).status).toBe(404);
		expect((await handleJobRequest(jobRequest({ task: "daily" }), deps({ secret: "" }))).status).toBe(404);
	});

	it("answers 404 to anything but POST", async () => {
		expect((await handleJobRequest(jobRequest(null, `Bearer ${SECRET}`, "GET"), deps())).status).toBe(404);
	});

	it("refuses an unknown task or a scheduled time far from now", async () => {
		expect((await handleJobRequest(jobRequest({ task: "everything" }), deps())).status).toBe(400);
		expect((await handleJobRequest(jobRequest({ task: "daily", scheduledTime: NOW - 3 * 86_400_000 }), deps())).status).toBe(400);
	});

	it("runs the daily task and records it in job_runs", async () => {
		const projectId = await createProject();
		await insert("page_views", validPageView(projectId, { day: "2026-12-06", ts: Date.UTC(2026, 11, 6, 15) }));
		await insert("daily_secret", { day: "2026-12-06", secret: "9".repeat(64) });

		const response = await handleJobRequest(jobRequest({ task: "daily", scheduledTime: NOW }), deps());
		expect(response.status).toBe(200);
		const result = (await response.json()) as { ok: boolean; summary: Record<string, unknown> };
		expect(result.ok).toBe(true);
		expect(result.summary).toHaveProperty("rollups");
		expect(result.summary).toHaveProperty("cleanup");
		expect(result.summary).not.toHaveProperty("github"); // the per-repo weekly commits job was removed

		const totals = await db.prepare("SELECT pageviews FROM daily_totals WHERE project_id = ?1 AND day = '2026-12-06'").bind(projectId).first();
		expect(totals).toEqual({ pageviews: 1 });
		const secrets = await db.prepare("SELECT day FROM daily_secret").all();
		expect(secrets.results).toEqual([{ day: "2026-12-07" }]);
		const run = await db.prepare("SELECT task, ok, finished_at FROM job_runs ORDER BY id DESC LIMIT 1").first();
		expect(run).toEqual({ task: "daily", ok: 1, finished_at: NOW });
	});

	it("rolls up today on the frequent task only every 10 minutes", async () => {
		const at = (minute: number) => Date.UTC(2026, 11, 7, 9, minute);
		const quarter = await runTask("frequent", deps(), at(20));
		const between = await runTask("frequent", deps(), at(25));
		expect(quarter.summary).toHaveProperty("rollup");
		expect(between.summary).not.toHaveProperty("rollup");
		expect(between.summary).toHaveProperty("uptime");
	});

	it("refreshes the GitHub contribution calendar on the daily task, never the frequent one", async () => {
		const at = (minute: number) => Date.UTC(2026, 11, 7, 9, minute);
		expect((await runTask("frequent", deps(), at(0))).summary).not.toHaveProperty("contributions");
		expect((await runTask("frequent", deps(), at(10))).summary).not.toHaveProperty("contributions");
		expect((await runTask("daily", deps(), NOW)).summary).toHaveProperty("contributions");
	});

	it("records a failure as ok: false instead of throwing", async () => {
		const brokenDb = new Proxy(db, {
			get(target, prop) {
				if (prop === "batch") return () => Promise.reject(new Error("D1 is having a moment"));
				const value = Reflect.get(target, prop);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		const result = await runTask("daily", deps({ db: brokenDb }), NOW);
		expect(result).toMatchObject({ ok: false, summary: { error: "D1 is having a moment" } });
		const run = await db.prepare("SELECT ok, summary FROM job_runs ORDER BY id DESC LIMIT 1").first<{ ok: number; summary: string }>();
		expect(run?.ok).toBe(0);
		expect(JSON.parse(run!.summary)).toEqual({ error: "D1 is having a moment" });
	});
});

describe("cron Worker", () => {
	function fakeHq(status = 200) {
		const requests: Request[] = [];
		return {
			requests,
			HQ: {
				fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
					requests.push(new Request(input, init));
					return new Response('{"ok":true}', { status });
				},
			} as unknown as Fetcher,
		};
	}

	it("maps each schedule to a task", () => {
		expect(SCHEDULES).toEqual({ "*/5 * * * *": "frequent", "10 0 * * *": "daily" });
	});

	it("sends the task, the scheduled time and the secret to HQ", async () => {
		const hq = fakeHq();
		await trigger("10 0 * * *", NOW, { HQ: hq.HQ, ROLLUP_SECRET: SECRET });
		const [request] = hq.requests;
		expect(new URL(request.url).pathname).toBe("/internal/jobs");
		expect(request.method).toBe("POST");
		expect(request.headers.get("Authorization")).toBe(`Bearer ${SECRET}`);
		expect(await request.json()).toEqual({ task: "daily", scheduledTime: NOW });
	});

	it("fails loudly when HQ refuses, the secret is missing or the schedule is unknown", async () => {
		await expect(trigger("*/5 * * * *", NOW, { HQ: fakeHq(404).HQ, ROLLUP_SECRET: SECRET })).rejects.toThrow(/failed \(404\)/);
		await expect(trigger("*/5 * * * *", NOW, { HQ: fakeHq().HQ, ROLLUP_SECRET: "" })).rejects.toThrow(/ROLLUP_SECRET/);
		await expect(trigger("0 * * * *", NOW, { HQ: fakeHq().HQ, ROLLUP_SECRET: SECRET })).rejects.toThrow(/No task/);
	});

	it("works end to end with the real HQ handler", async () => {
		const HQ = { fetch: (input: RequestInfo | URL, init?: RequestInit) => handleJobRequest(new Request(input, init), deps()) } as unknown as Fetcher;
		await expect(trigger("*/5 * * * *", Date.UTC(2026, 11, 7, 9, 30), { HQ, ROLLUP_SECRET: SECRET })).resolves.toBeUndefined();
	});
});
