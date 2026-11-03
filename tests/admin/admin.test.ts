import { afterEach, describe, expect, it } from "vitest";
import { hostnameFromHost, isAdminRequest } from "@/lib/admin/access";
import { csvCell } from "@/lib/admin/csv";
import { handleEventsCsv } from "@/lib/admin/events-csv";
import { clampToRaw, daysBetween, parseRange } from "@/lib/admin/range";
import { countFunnel, funnel, parseFunnel } from "@/lib/db/funnel";
import { createProject, db, insert } from "../helpers";

const TODAY = "2026-11-02";
const visitor = (n: number) => n.toString(16).padStart(64, "0");

describe("date ranges", () => {
	it("uses presets ending today, with the previous period right before", () => {
		expect(parseRange({ range: "7d" }, TODAY)).toMatchObject({ from: "2026-10-27", to: TODAY, days: 7, previousFrom: "2026-10-20", previousTo: "2026-10-26" });
		expect(parseRange({}, TODAY)).toMatchObject({ key: "30d", days: 30 });
		expect(parseRange({ range: "nonsense" }, TODAY).key).toBe("30d");
		expect(parseRange({ range: "12m" }, TODAY).days).toBe(365);
	});

	it("tidies custom ranges", () => {
		expect(parseRange({ range: "custom", from: "2026-10-10", to: "2026-10-01" }, TODAY)).toMatchObject({ from: "2026-10-01", to: "2026-10-10", days: 10 });
		expect(parseRange({ range: "custom", from: "2026-10-30", to: "2027-01-01" }, TODAY).to).toBe(TODAY);
		expect(parseRange({ range: "custom", from: "2020-01-01", to: TODAY }, TODAY).days).toBe(731);
		expect(parseRange({ range: "custom", from: "2026-02-30", to: TODAY }, TODAY).key).toBe("30d");
	});

	it("lists days and keeps raw sections to 90 days", () => {
		expect(daysBetween("2026-10-30", "2026-11-01")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
		expect(clampToRaw(parseRange({ range: "12m" }, TODAY), TODAY)).toEqual({ from: "2026-08-04", to: TODAY, clipped: true });
		expect(clampToRaw(parseRange({ range: "30d" }, TODAY), TODAY).clipped).toBe(false);
	});
});

describe("funnels", () => {
	const steps = [{ label: "Home", path: "/" }, { label: "Case study", path: "/work" }, { label: "Contact", event: "contact_click" }];
	const hit = (v: number, ts: number, kind: "path" | "event", key: string, day = TODAY) => ({ day, visitor_id: visitor(v), ts, kind, key });

	it("counts steps in order, within the same day", () => {
		const result = countFunnel(steps, [
			hit(1, 1, "path", "/"), hit(1, 2, "path", "/work"), hit(1, 3, "event", "contact_click"), // all three
			hit(2, 1, "path", "/"), hit(2, 2, "path", "/work"), // two
			hit(3, 5, "path", "/work"), hit(3, 6, "path", "/"), // case study before home: one
			hit(4, 1, "path", "/", "2026-11-01"), hit(4, 2, "path", "/work"), // home yesterday, work today: different daily IDs
			hit(5, 1, "event", "contact_click"), // contact without the steps before: nothing
		]);
		expect(result.map((r) => r.visitors)).toEqual([4, 2, 1]);
		expect(result[1].fromPrevious).toBe(0.5);
		expect(result[2].fromFirst).toBe(0.25);
		expect(result[0].fromPrevious).toBeNull();
	});

	it("reads steps from settings, ignoring anything malformed", () => {
		expect(parseFunnel([{ label: "A", path: "/" }, { label: "B" }, "x", { path: "/no-label" }, { label: "C", event: "go" }])).toEqual([
			{ label: "A", path: "/" },
			{ label: "C", event: "go" },
		]);
		expect(parseFunnel("nope")).toEqual([]);
	});

	it("queries page views and events for the funnel", async () => {
		const id = await createProject();
		const ts = Date.parse(`${TODAY}T10:00:00Z`);
		const pv = (v: number, path: string, offset: number) =>
			insert("page_views", { project_id: id, ts: ts + offset, day: TODAY, visitor_id: visitor(v), path });
		const ev = (v: number, name: string, offset: number, props = "{}") =>
			insert("events", { project_id: id, ts: ts + offset, day: TODAY, source: "browser", visitor_id: visitor(v), name, path: "/", props });
		await pv(1, "/", 0);
		await pv(1, "/work", 1000);
		await ev(1, "contact_click", 2000);
		await pv(2, "/", 0);

		expect((await funnel(db, id, steps, TODAY, TODAY)).map((r) => r.visitors)).toEqual([2, 1, 1]);
		expect(await funnel(db, id, [], TODAY, TODAY)).toEqual([]);
	});
});

describe("CSV", () => {
	it("quotes and escapes cells, and stops formulas", () => {
		expect(csvCell("plain")).toBe("plain");
		expect(csvCell('{"a":"b,c"}')).toBe('"{""a"":""b,c""}"');
		expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
		expect(csvCell("+1")).toBe("'+1");
		expect(csvCell("-2")).toBe("'-2");
		expect(csvCell("@sum")).toBe("'@sum");
		expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
		expect(csvCell(null)).toBe("");
		expect(csvCell(42)).toBe("42");
	});

	it("downloads a project's events without visitor IDs", async () => {
		const id = await createProject({ slug: "csv-test" });
		await insert("events", { project_id: id, ts: Date.parse(`${TODAY}T09:00:00Z`), day: TODAY, source: "browser", visitor_id: visitor(7), name: "case_study_read", path: "/work", props: '{"study":"=cmd"}' });
		await insert("events", { project_id: id, ts: Date.parse(`${TODAY}T08:00:00Z`), day: TODAY, source: "server", name: "job_posted", props: "{}" });

		const response = await handleEventsCsv(db, "csv-test", new URLSearchParams({ from: TODAY, to: TODAY }), TODAY);
		expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
		expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="csv-test-events-${TODAY}-to-${TODAY}.csv"`);
		const text = await response.text();
		expect(text).toBe(
			"time_utc,source,name,path,props\r\n" +
				`${TODAY}T09:00:00.000Z,browser,case_study_read,/work,"{""study"":""=cmd""}"\r\n` +
				`${TODAY}T08:00:00.000Z,server,job_posted,,{}\r\n`,
		);
		expect(text).not.toContain(visitor(7));

		const filtered = await (await handleEventsCsv(db, "csv-test", new URLSearchParams({ source: "server" }), TODAY)).text();
		expect(filtered.trim().split("\r\n")).toHaveLength(2);
	});

	it("refuses bad requests and unknown projects", async () => {
		await createProject({ slug: "csv-bad" });
		expect((await handleEventsCsv(db, "no-such-project", new URLSearchParams(), TODAY)).status).toBe(404);
		expect((await handleEventsCsv(db, "csv-bad", new URLSearchParams({ from: "yesterday" }), TODAY)).status).toBe(400);
		expect((await handleEventsCsv(db, "csv-bad", new URLSearchParams({ from: TODAY, to: "2026-11-01" }), TODAY)).status).toBe(400);
		expect((await handleEventsCsv(db, "csv-bad", new URLSearchParams({ name: "DROP TABLE" }), TODAY)).status).toBe(400);
		expect((await handleEventsCsv(db, "csv-bad", new URLSearchParams({ source: "both" }), TODAY)).status).toBe(400);
	});

	it("never goes back further than the 90 days of raw data", async () => {
		await createProject({ slug: "csv-old" });
		const response = await handleEventsCsv(db, "csv-old", new URLSearchParams({ from: "2025-01-01", to: TODAY }), TODAY);
		expect(response.headers.get("Content-Disposition")).toContain("csv-old-events-2026-08-04-to-2026-11-02");
	});
});

describe("admin access check", () => {
	afterEach(() => {
		Reflect.deleteProperty(process.env, "LOCAL_ADMIN_PREVIEW");
	});

	it("reads the hostname from a Host header", () => {
		expect(hostnameFromHost("localhost:8787")).toBe("localhost");
		expect(hostnameFromHost("[::1]:8787")).toBe("[::1]");
		expect(hostnameFromHost("bobbybuilds.wahab-ali-khan.workers.dev")).toBe("bobbybuilds.wahab-ali-khan.workers.dev");
		expect(hostnameFromHost(null)).toBe("");
	});

	it("allows the local preview only on loopback addresses with the flag on", async () => {
		expect(await isAdminRequest("localhost:8787", null)).toBe(false);
		process.env.LOCAL_ADMIN_PREVIEW = "on";
		expect(await isAdminRequest("localhost:8787", null)).toBe(true);
		expect(await isAdminRequest("127.0.0.1:8788", null)).toBe(true);
		expect(await isAdminRequest("bobbybuilds.wahab-ali-khan.workers.dev", null)).toBe(false);
		expect(await isAdminRequest("192.168.1.20:8787", null)).toBe(false);
		expect(await isAdminRequest("localhost.evil.example", null)).toBe(false);
	});

	it("refuses a made-up Access token when Access isn't configured", async () => {
		expect(await isAdminRequest("bobbybuilds.wahab-ali-khan.workers.dev", "eyJhbGciOiJSUzI1NiJ9.e30.fake")).toBe(false);
	});
});
