import { describe, expect, it } from "vitest";
import { commitsInWeek, syncGithubWeekly } from "@/lib/jobs/github";
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

describe("GitHub weekly commits", () => {
	it("reads the total from the last page link, for a Monday-to-Monday UTC week", async () => {
		const { fn, calls } = fakeFetch(
			() =>
				new Response("[{}]", {
					headers: { Link: '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/commits?per_page=1&page=23>; rel="last"' },
				}),
		);
		expect(await commitsInWeek(fn, "wahabalikhan/job_board", "2026-11-02", "tok")).toBe(23);
		const url = new URL(calls[0].url);
		expect(url.pathname).toBe("/repos/wahabalikhan/job_board/commits");
		expect(url.searchParams.get("since")).toBe("2026-11-02T00:00:00Z");
		expect(url.searchParams.get("until")).toBe("2026-11-09T00:00:00Z");
		expect(url.searchParams.get("per_page")).toBe("1");
		expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
	});

	it("counts 0 or 1 commits when there's no page link", async () => {
		expect(await commitsInWeek(fakeFetch(() => new Response("[]")).fn, "a/b", "2026-11-02")).toBe(0);
		expect(await commitsInWeek(fakeFetch(() => new Response("[{}]")).fn, "a/b", "2026-11-02")).toBe(1);
	});

	it("treats an empty repository as 0 and sends no token when there isn't one", async () => {
		const { fn, calls } = fakeFetch(() => new Response("", { status: 409 }));
		expect(await commitsInWeek(fn, "a/b", "2026-11-02")).toBe(0);
		expect((calls[0].init?.headers as Record<string, string>).Authorization).toBeUndefined();
	});

	it("records this week and last week, and keeps going if one repo fails", async () => {
		const good = await createProject({ github_repo: "wahabalikhan/good-repo" });
		await createProject({ github_repo: "wahabalikhan/missing-repo" });
		const { fn } = fakeFetch((url) => {
			if (url.includes("missing-repo")) return new Response('{"message":"Not Found"}', { status: 404 });
			const since = new URL(url).searchParams.get("since");
			return new Response("[{}]", { headers: { Link: `<https://x/?page=${since?.startsWith("2026-11-02") ? 4 : 11}>; rel="last"` } });
		});

		const summary = await syncGithubWeekly(db, fn, "2026-11-02", "tok");
		expect(summary["wahabalikhan/good-repo"]).toEqual({ thisWeek: 4, lastWeek: 11 });
		expect(summary["wahabalikhan/missing-repo"]).toEqual({ error: "GitHub 404 for wahabalikhan/missing-repo" });

		const { results } = await db.prepare("SELECT week, commits FROM github_weekly WHERE project_id = ?1 ORDER BY week").bind(good).all();
		expect(results).toEqual([
			{ week: "2026-10-26", commits: 11 },
			{ week: "2026-11-02", commits: 4 },
		]);

		// Running again updates rather than duplicates.
		await syncGithubWeekly(db, fakeFetch(() => new Response("[]")).fn, "2026-11-02");
		const again = await db.prepare("SELECT week, commits FROM github_weekly WHERE project_id = ?1 ORDER BY week").bind(good).all();
		expect(again.results).toEqual([
			{ week: "2026-10-26", commits: 0 },
			{ week: "2026-11-02", commits: 0 },
		]);
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

	it("pings only projects with a health URL and stores each check", async () => {
		const up = await createProject({ health_url: "https://up.example/" });
		const down = await createProject({ health_url: "https://down.example/" });
		const none = await createProject();
		const { fn, calls } = fakeFetch((url) => new Response("", { status: url.includes("down") ? 503 : 200 }));

		await pingAll(db, fn, Date.UTC(2026, 10, 2, 12));
		expect(calls.map((c) => c.url)).toEqual(expect.arrayContaining(["https://up.example/", "https://down.example/"]));
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
