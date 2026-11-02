import { describe, expect, it } from "vitest";
import { handlePageView } from "@/lib/collector/pv";
import { db } from "../helpers";
import {
	browserRequest,
	count,
	fakeLimiter,
	IP,
	keyedProject,
	NOW,
	ORIGIN,
	rows,
	testDeps,
	UA,
	UA_IPHONE,
} from "./helpers";

const view = (key: string, extra: Record<string, unknown> = {}) => ({
	type: "view",
	key,
	path: "/case-studies/hiring",
	referrer: "www.linkedin.com",
	ref: "linkedin-post-3",
	utm_source: "LinkedIn",
	utm_medium: "social",
	utm_campaign: "Launch Week",
	width: 1280,
	language: "en-GB",
	...extra,
});

async function sendView(key: string, extra: Record<string, unknown> = {}, options = {}, deps = testDeps()) {
	return handlePageView(browserRequest("/v1/pv", view(key, extra), options), deps);
}

describe("/v1/pv refuses a wrong key or origin", () => {
	it("refuses an unknown public key", async () => {
		const project = await keyedProject();
		const response = await sendView("pk_" + "x".repeat(24));
		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		expect(await count("page_views", project.id)).toBe(0);
	});

	it("refuses a malformed key", async () => {
		expect((await sendView("not-a-key")).status).toBe(403);
	});

	it("refuses a valid key from an unregistered origin, with no CORS header", async () => {
		const project = await keyedProject();
		const response = await sendView(project.publicKey, {}, { origin: "https://evil.example" });
		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		expect(await count("page_views", project.id)).toBe(0);
	});

	it.each([
		["http instead of https", "http://example.com"],
		["a different port", "https://example.com:8443"],
		["an extra subdomain", "https://shop.example.com"],
		["a lookalike domain", "https://example.com.evil.io"],
		["a trailing slash", "https://example.com/"],
		["the literal null origin", "null"],
	])("refuses %s", async (_label, origin) => {
		const project = await keyedProject();
		expect((await sendView(project.publicKey, {}, { origin })).status).toBe(403);
		expect(await count("page_views", project.id)).toBe(0);
	});

	it("refuses a request with no Origin header", async () => {
		const project = await keyedProject();
		expect((await sendView(project.publicKey, {}, { origin: null })).status).toBe(403);
	});

	it("gives the same reply for a wrong key and a wrong origin", async () => {
		const project = await keyedProject();
		const wrongKey = await (await sendView("pk_" + "y".repeat(24))).json();
		const wrongOrigin = await (await sendView(project.publicKey, {}, { origin: "https://evil.example" })).json();
		expect(wrongKey).toEqual(wrongOrigin);
	});

	it("accepts both registered origins and echoes only that origin", async () => {
		const project = await keyedProject();
		for (const origin of [ORIGIN, "https://www.example.com"]) {
			const response = await sendView(project.publicKey, {}, { origin });
			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
			expect(response.headers.get("Vary")).toBe("Origin");
		}
		expect(await count("page_views", project.id)).toBe(2);
	});
});

describe("/v1/pv privacy", () => {
	it.each([
		["Global Privacy Control", { "Sec-GPC": "1" }],
		["Do Not Track", { DNT: "1" }],
	])("stores nothing when %s is on", async (_label, headers) => {
		const project = await keyedProject();
		const response = await sendView(project.publicKey, {}, { headers });
		expect(response.status).toBe(204);
		expect(await count("page_views", project.id)).toBe(0);
	});

	it("stores no IP, user agent or full referrer, only the referrer's domain", async () => {
		const project = await keyedProject();
		await sendView(project.publicKey, { referrer: "www.linkedin.com" });
		const [row] = await rows("page_views", project.id);
		const stored = JSON.stringify(row);
		expect(stored).not.toContain(IP);
		expect(stored).not.toContain("Macintosh");
		expect(stored).not.toContain("Chrome/130");
		expect(row.referrer_domain).toBe("linkedin.com");
	});

	it("records the cleaned fields and broad groups", async () => {
		const project = await keyedProject();
		await sendView(project.publicKey);
		const [row] = await rows("page_views", project.id);
		expect(row).toMatchObject({
			day: "2026-11-02",
			ts: NOW,
			path: "/case-studies/hiring",
			ref: "linkedin-post-3",
			utm_source: "linkedin",
			utm_medium: "social",
			utm_campaign: "launch-week",
			country: "GB",
			device: "desktop",
			browser: "chrome",
			os: "macos",
			screen: "large",
			language: "en",
			engaged_ms: null,
			scroll_pct: null,
		});
		expect(row.visitor_id).toMatch(/^[0-9a-f]{64}$/);
	});

	it("drops junk marketing fields but keeps the page view", async () => {
		const project = await keyedProject();
		const response = await sendView(project.publicKey, {
			ref: "<script>alert(1)</script>",
			utm_source: "x".repeat(80),
			utm_campaign: "jo@example.com",
			referrer: "not a domain!",
			language: "klingon-dialect",
		});
		expect(response.status).toBe(200);
		const [row] = await rows("page_views", project.id);
		expect(row).toMatchObject({ ref: null, utm_source: null, utm_campaign: null, referrer_domain: null, language: null });
	});

	it("drops a referral from the site itself", async () => {
		const project = await keyedProject();
		await sendView(project.publicKey, { referrer: "example.com" });
		expect((await rows("page_views", project.id))[0].referrer_domain).toBeNull();
	});

	it("ignores known bots", async () => {
		const project = await keyedProject();
		const response = await sendView(project.publicKey, {}, { headers: { "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" } });
		expect(response.status).toBe(204);
		expect(await count("page_views", project.id)).toBe(0);
	});

	it("records Cloudflare's unknown country as no country", async () => {
		const project = await keyedProject();
		await sendView(project.publicKey, {}, {}, testDeps({ country: "XX" }));
		await sendView(project.publicKey, {}, {}, testDeps({ country: "T1" }));
		const stored = await rows<{ country: string | null }>("page_views", project.id);
		expect(stored.map((row) => row.country)).toEqual([null, null]);
	});
});

describe("daily visitor ID", () => {
	async function idFor(project: { id: number; publicKey: string }, options: { ua?: string; ip?: string; now?: number } = {}) {
		await sendView(
			project.publicKey,
			{},
			{ headers: { "User-Agent": options.ua ?? UA, "CF-Connecting-IP": options.ip ?? IP } },
			testDeps({ now: () => options.now ?? NOW }),
		);
		const stored = await rows<{ visitor_id: string }>("page_views", project.id);
		return stored[stored.length - 1].visitor_id;
	}

	it("is the same all day for the same visitor", async () => {
		const project = await keyedProject();
		expect(await idFor(project)).toBe(await idFor(project, { now: NOW + 3 * 3_600_000 }));
	});

	it("changes on a new day", async () => {
		const project = await keyedProject();
		expect(await idFor(project)).not.toBe(await idFor(project, { now: NOW + 86_400_000 }));
	});

	it("is different for each project", async () => {
		const a = await keyedProject();
		const b = await keyedProject();
		expect(await idFor(a)).not.toBe(await idFor(b));
	});

	it("is different for a different browser or network", async () => {
		const project = await keyedProject();
		const base = await idFor(project);
		expect(await idFor(project, { ua: UA_IPHONE })).not.toBe(base);
		expect(await idFor(project, { ip: "198.51.100.9" })).not.toBe(base);
	});

	it("creates today's secret if the daily job hasn't yet", async () => {
		const project = await keyedProject();
		const day = "2031-05-06";
		await idFor(project, { now: Date.UTC(2031, 4, 6, 9) });
		const row = await db.prepare("SELECT secret FROM daily_secret WHERE day = ?1").bind(day).first<{ secret: string }>();
		expect(row?.secret).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("/v1/pv validation and limits", () => {
	it("refuses more than the rate limit, and never gives the limiter a raw IP", async () => {
		const project = await keyedProject();
		const limiter = fakeLimiter(false);
		const response = await sendView(project.publicKey, {}, {}, testDeps({ limiter }));
		expect(response.status).toBe(429);
		expect(await count("page_views", project.id)).toBe(0);
		expect(limiter.keys[0]).not.toContain(IP);
	});

	it("refuses a body over 2 KB", async () => {
		const project = await keyedProject();
		expect((await sendView(project.publicKey, { padding: "x".repeat(2100) })).status).toBe(413);
	});

	it("refuses a body that isn't JSON", async () => {
		const response = await handlePageView(browserRequest("/v1/pv", null, { rawBody: "type=view" }), testDeps());
		expect(response.status).toBe(400);
	});

	it.each([
		["a path without a leading slash", { path: "about" }],
		["a path with a query string", { path: "/jobs?id=1" }],
		["a path over 200 characters", { path: `/${"a".repeat(200)}` }],
		["a path with an email address in it", { path: "/users/jo@example.com" }],
		["a path that isn't text", { path: 42 }],
		["a width that isn't a whole number", { width: "1280" }],
		["a negative width", { width: -1 }],
		["an unknown type", { type: "click" }],
	])("refuses %s", async (_label, extra) => {
		const project = await keyedProject();
		expect((await sendView(project.publicKey, extra)).status).toBe(400);
		expect(await count("page_views", project.id)).toBe(0);
	});

	it("only accepts POST", async () => {
		const response = await handlePageView(new Request("https://bobby.test/v1/pv"), testDeps());
		expect(response.status).toBe(405);
	});
});

describe("/v1/pv leave beacon", () => {
	async function viewId(project: { publicKey: string }, headers: Record<string, string> = {}) {
		const response = await sendView(project.publicKey, {}, { headers });
		return ((await response.json()) as { v: number }).v;
	}

	function leave(key: string, view: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
		return handlePageView(
			browserRequest("/v1/pv", { type: "leave", key, view, engaged_ms: 42_000, scroll_pct: 80, ...extra }, { headers }),
			testDeps(),
		);
	}

	it("adds engaged time, scroll depth and Core Web Vitals to the view", async () => {
		const project = await keyedProject();
		const id = await viewId(project);
		expect((await leave(project.publicKey, id, { lcp_ms: 1834.6, cls: 0.105, inp_ms: 96 })).status).toBe(204);
		const [row] = await rows("page_views", project.id);
		expect(row).toMatchObject({ engaged_ms: 42_000, scroll_pct: 80, lcp_ms: 1835, cls_milli: 105, inp_ms: 96 });
	});

	it("only lets values go up, and caps engaged time at 30 minutes", async () => {
		const project = await keyedProject();
		const id = await viewId(project);
		await leave(project.publicKey, id, { engaged_ms: 50_000, scroll_pct: 90, cls: 0.2, inp_ms: 200 });
		await leave(project.publicKey, id, { engaged_ms: 10_000, scroll_pct: 20, cls: 0.1, inp_ms: 50 });
		expect((await rows("page_views", project.id))[0]).toMatchObject({ engaged_ms: 50_000, scroll_pct: 90, cls_milli: 200, inp_ms: 200 });
		await leave(project.publicKey, id, { engaged_ms: 9_000_000, scroll_pct: 100 });
		expect((await rows("page_views", project.id))[0]).toMatchObject({ engaged_ms: 1_800_000, scroll_pct: 100, cls_milli: 200 });
	});

	it("can't update someone else's view", async () => {
		const project = await keyedProject();
		const id = await viewId(project);
		const response = await leave(project.publicKey, id, {}, { "User-Agent": UA_IPHONE, "CF-Connecting-IP": "198.51.100.9" });
		expect(response.status).toBe(204); // same reply, so views can't be probed
		expect((await rows("page_views", project.id))[0]).toMatchObject({ engaged_ms: null, scroll_pct: null });
	});

	it("can't update another project's view", async () => {
		const a = await keyedProject();
		const b = await keyedProject();
		const id = await viewId(a);
		await leave(b.publicKey, id);
		expect((await rows("page_views", a.id))[0].engaged_ms).toBeNull();
	});

	it("drops out-of-range vitals but keeps the rest", async () => {
		const project = await keyedProject();
		const id = await viewId(project);
		await leave(project.publicKey, id, { lcp_ms: 999_999, cls: -1, inp_ms: "fast" });
		expect((await rows("page_views", project.id))[0]).toMatchObject({ engaged_ms: 42_000, lcp_ms: null, cls_milli: null, inp_ms: null });
	});

	it.each([
		["a missing view id", { view: undefined }],
		["engaged time that isn't a whole number", { engaged_ms: 1.5 }],
		["scroll depth over 100", { scroll_pct: 120 }],
	])("refuses %s", async (_label, extra) => {
		const project = await keyedProject();
		const id = await viewId(project);
		expect((await leave(project.publicKey, id, extra)).status).toBe(400);
	});
});
