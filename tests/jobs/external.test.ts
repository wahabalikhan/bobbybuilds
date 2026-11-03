import { beforeEach, describe, expect, it } from "vitest";
import { syncGithubContributions } from "@/lib/jobs/github";
import { checkOnce, pingAll } from "@/lib/jobs/uptime";
import { createProject, db } from "../helpers";

type Call = { url: string; init?: RequestInit };

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const calls: Call[] = [];
	const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		return handler(url, init);
	}) as typeof fetch;
	return { fn, calls };
}

describe("GitHub contribution calendar", () => {
	const calendar = (days: number, from = "2025-11-02", count = (i: number) => i % 5) => {
		const list = Array.from({ length: days }, (_, i) => ({ date: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), contributionCount: count(i) }));
		const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, w) => ({ contributionDays: list.slice(w * 7, w * 7 + 7) }));
		return Response.json({ data: { user: { contributionsCollection: { contributionCalendar: { weeks } } } } });
	};
	const stored = async () => (await db.prepare("SELECT day, count FROM github_contributions ORDER BY day").all<{ day: string; count: number }>()).results;
	beforeEach(async () => {
		await db.prepare("DELETE FROM github_contributions").run();
	});

	it("asks GitHub's GraphQL API for the login's calendar with the token, and stores every day", async () => {
		const { fn, calls } = fakeFetch(() => calendar(366));
		const summary = await syncGithubContributions(db, fn, "wahabalikhan", "tok", 5);
		expect(summary).toEqual({ days: 366, total: Array.from({ length: 366 }, (_, i) => i % 5).reduce((a, b) => a + b, 0) });
		expect(calls[0].url).toBe("https://api.github.com/graphql");
		expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
		expect(JSON.parse(String(calls[0].init?.body)).variables).toEqual({ login: "wahabalikhan" });
		const rows = await stored();
		expect(rows.length).toBe(366);
		expect(rows[0]).toEqual({ day: "2025-11-02", count: 0 });
	});

	it("replaces counts and deletes days older than the new window", async () => {
		await syncGithubContributions(db, fakeFetch(() => calendar(366)).fn, "x", "tok", 5);
		await syncGithubContributions(db, fakeFetch(() => calendar(366, "2025-11-09", () => 7)).fn, "x", "tok", 6);
		const rows = await stored();
		expect(rows.length).toBe(366);
		expect(rows[0].day).toBe("2025-11-09");
		expect(rows.every((r) => r.count === 7)).toBe(true);
	});

	it("keeps the last good year when GitHub fails or replies with something odd", async () => {
		await syncGithubContributions(db, fakeFetch(() => calendar(366)).fn, "x", "tok", 5);
		expect(await syncGithubContributions(db, fakeFetch(() => new Response("nope", { status: 502 })).fn, "x", "tok", 6)).toEqual({ error: "GitHub 502" });
		expect(await syncGithubContributions(db, fakeFetch(() => Response.json({ errors: [{ message: "bad" }] })).fn, "x", "tok", 6)).toEqual({ error: "Unexpected calendar (0 days)" });
		expect(await syncGithubContributions(db, fakeFetch(() => calendar(366, "2025-11-02", () => -3)).fn, "x", "tok", 6)).toEqual({ error: "Unexpected calendar (0 days)" });
		expect(await syncGithubContributions(db, fakeFetch(() => { throw new Error("network"); }).fn, "x", "tok", 6)).toEqual({ error: "network" });
		expect(await syncGithubContributions(db, fakeFetch(() => calendar(366)).fn, "x", undefined, 6)).toEqual({ error: "No GITHUB_TOKEN" });
		expect((await stored()).length).toBe(366);
	});
});

describe("uptime", () => {
	it("counts 2xx and 3xx as up and records the response time", async () => {
		let clock = 1000;
		const ok = fakeFetch(() => {
			clock += 120;
			return new Response("ok");
		});
		expect(await checkOnce(ok.fn, "https://a.example/", () => clock)).toEqual({ up: true, responseMs: 120, statusCode: 200 });
		expect(ok.calls[0].init).toMatchObject({ method: "GET", redirect: "manual" });

		const redirect = fakeFetch(() => new Response(null, { status: 301, headers: { Location: "https://b.example/" } }));
		expect((await checkOnce(redirect.fn, "https://a.example/")).up).toBe(true);
	});

	it("counts errors, timeouts and network failures as down", async () => {
		expect(await checkOnce(fakeFetch(() => new Response("oops", { status: 500 })).fn, "https://a.example/")).toMatchObject({ up: false, statusCode: 500 });
		const timeout = fakeFetch(() => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")));
		expect(await checkOnce(timeout.fn, "https://a.example/")).toEqual({ up: false, responseMs: null, statusCode: null });
		const offline = fakeFetch(() => Promise.reject(new TypeError("Network connection lost.")));
		expect(await checkOnce(offline.fn, "https://a.example/")).toEqual({ up: false, responseMs: null, statusCode: null });
	});

	it("pings each project's site address (the old health URL isn't used) and stores each check", async () => {
		const up = await createProject({ site_url: "https://up.example/" });
		const down = await createProject({ site_url: "https://down.example/", health_url: "https://ignored.example/" });
		const none = await createProject();
		const { fn, calls } = fakeFetch((url) => new Response("", { status: url.includes("down") ? 503 : 200 }));

		await pingAll(db, fn, Date.UTC(2026, 10, 2, 12));
		expect(calls.map((c) => c.url)).toEqual(expect.arrayContaining(["https://up.example/", "https://down.example/"]));
		expect(calls.map((c) => c.url)).not.toContain("https://ignored.example/");
		const stored = await db
			.prepare("SELECT project_id, up, status_code FROM uptime_checks WHERE project_id IN (?1, ?2, ?3) ORDER BY project_id")
			.bind(up, down, none)
			.all();
		expect(stored.results).toEqual([
			{ project_id: up, up: 1, status_code: 200 },
			{ project_id: down, up: 0, status_code: 503 },
		]);
	});
});
