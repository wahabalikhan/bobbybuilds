import { describe, expect, it } from "vitest";
import type { FormState } from "@/lib/admin/form-state";
import * as core from "@/lib/admin/settings-core";
import { parsePounds, validateMoney, validateProfile, validatePublicCard } from "@/lib/admin/validate";
import { listMonth } from "@/lib/db/money";
import { getProfile } from "@/lib/db/profile";
import { getProjectBySlug } from "@/lib/db/projects";
import { db } from "../helpers";

const idle: FormState = { status: "idle", version: 0 };
const ctx = { logos: [], screenshots: ["/screenshots/tech-jobs.webp"], now: Date.UTC(2026, 10, 5, 12) };

async function newProject() {
	const result = await core.startProjectCore(db, idle, { name: `Card test ${crypto.randomUUID().slice(0, 8)}`, site_url: "https://card.example" });
	return (await getProjectBySlug(db, result.state.setup!.slug))!;
}

describe("the public card", () => {
	const keys = ["open_jobs", "visitors"];

	it("takes an emoji, a listed screenshot with alt text, a case study link and outcomes with known numbers", () => {
		const result = validatePublicCard(
			{ emoji: "💼", screenshot_path: "/screenshots/tech-jobs.webp", screenshot_alt: "The job list", case_study_url: "https://wahabalikhan.com/tech-jobs", outcome_0: "{open_jobs} jobs made clear", outcome_2: "{visitors} visitors" },
			ctx.screenshots,
			keys,
		);
		expect(result).toMatchObject({ ok: true, value: { emoji: "💼", screenshotAlt: "The job list", outcomes: ["{open_jobs} jobs made clear", "{visitors} visitors"] } });
	});

	it("tidies the Now line: a typed \"Now:\" is dropped, spaces are squeezed, and it's one short line", () => {
		expect(validatePublicCard({ now_text: "Now:   building the   CV fit" }, [], keys)).toMatchObject({ ok: true, value: { nowText: "building the CV fit" } });
		expect(validatePublicCard({ now_text: "x".repeat(141) }, [], keys)).toMatchObject({ ok: false, errors: { now_text: expect.any(String) } });
	});

	it.each([
		["a word instead of an emoji", { emoji: "jobs" }, "emoji"],
		["a screenshot that isn't in public/screenshots/", { screenshot_path: "/screenshots/missing.png", screenshot_alt: "x" }, "screenshot_path"],
		["a screenshot without alt text", { screenshot_path: "/screenshots/tech-jobs.webp" }, "screenshot_alt"],
		["a case study link that isn't https", { case_study_url: "http://example.com" }, "case_study_url"],
		["an outcome without a number", { outcome_0: "Jobs made clear" }, "outcome_0"],
		["an outcome with someone else's number", { outcome_1: "{salaries_found} salaries found" }, "outcome_1"],
	])("refuses %s", (_label, values, field) => {
		expect(validatePublicCard(values, ctx.screenshots, keys)).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
	});

	it("saves the card, and notes when an outcome's number is private", async () => {
		const project = await newProject();
		const result = await core.publicCardCore(db, idle, { project_id: String(project.id), emoji: "🎨", outcome_0: "{visitors} people visited" }, ctx);
		expect(result.state.status).toBe("ok");
		expect(await getProjectBySlug(db, project.slug)).toMatchObject({ emoji: "🎨", outcomes: ["{visitors} people visited"], screenshotPath: null });
	});

	it("saves the extra lines with About this project, keeping the card fields that aren't in the form any more", async () => {
		const project = await newProject();
		await core.publicCardCore(db, idle, { project_id: String(project.id), emoji: "🎨", case_study_url: "https://wahabalikhan.com/x", now_text: "building" }, ctx);
		const values = { project_id: String(project.id), name: project.name, status: "building", site_url: project.siteUrl ?? "", outcome_0: "{visitors} people visited", outcome_1: "" };
		expect((await core.saveDetailsCore(db, idle, values, ctx)).state.status).toBe("ok");
		expect(await getProjectBySlug(db, project.slug)).toMatchObject({ emoji: "🎨", caseStudyUrl: "https://wahabalikhan.com/x", nowText: "building", outcomes: ["{visitors} people visited"] });

		const bad = await core.saveDetailsCore(db, idle, { ...values, outcome_0: "No number here" }, ctx);
		expect(bad.state).toMatchObject({ status: "error", errors: { outcome_0: expect.any(String) } });
		expect((await getProjectBySlug(db, project.slug))!.outcomes).toEqual(["{visitors} people visited"]);
	});
});

describe("on the public page", () => {
	it("saves the tagline, extra lines and switches together, and nothing when the tagline has a problem", async () => {
		const project = await newProject();
		const base = { project_id: String(project.id), show_public: "on" };

		// {visitors} in the tagline needs a fallback: refused, and the switch isn't saved either.
		const refused = await core.publicPageCore(db, idle, { ...base, tagline: "{visitors} people a month" }, ctx);
		expect(refused.state).toMatchObject({ status: "error", errors: { tagline: expect.any(String) } });
		expect(await getProjectBySlug(db, project.slug)).toMatchObject({ showPublic: false, tagline: "" });

		const saved = await core.publicPageCore(db, idle, { ...base, tagline: "Jobs for everyone", tagline_fallback: "", outcome_0: "{visitors} people visited" }, ctx);
		expect(saved.state.status).toBe("ok");
		expect(await getProjectBySlug(db, project.slug)).toMatchObject({ showPublic: true, showOnFirstVisit: false, tagline: "Jobs for everyone", outcomes: ["{visitors} people visited"] });
		// Visitors weren't switched on, so the note says the extra line is left out.
		expect(saved.state.notes?.join(" ")).toContain("{visitors} isn't public");
	});

	it("leaves the tagline alone when About is saved, and About's fields alone when the public page is saved", async () => {
		const project = await newProject();
		await core.publicPageCore(db, idle, { project_id: String(project.id), tagline: "Kept tagline" }, ctx);
		await core.saveDetailsCore(db, idle, { project_id: String(project.id), name: "Renamed", status: "live", site_url: project.siteUrl ?? "", sort_order: "5", started_on: "2026-11-01" }, ctx);
		expect(await getProjectBySlug(db, project.slug)).toMatchObject({ name: "Renamed", tagline: "Kept tagline", startedOn: "2026-11-01" });
		await core.publicPageCore(db, idle, { project_id: String(project.id), tagline: "New tagline" }, ctx);
		expect(await getProjectBySlug(db, project.slug)).toMatchObject({ name: "Renamed", status: "live", startedOn: "2026-11-01", tagline: "New tagline" });
	});
});

describe("paused", () => {
	it("is stored alongside the status and shown instead of it", async () => {
		const project = await newProject();
		const values = { project_id: String(project.id), name: project.name, status: "paused", site_url: project.siteUrl ?? "" };
		expect((await core.saveDetailsCore(db, idle, values, ctx)).state.status).toBe("ok");
		expect((await getProjectBySlug(db, project.slug))!.status).toBe("paused");
		await core.saveDetailsCore(db, idle, { ...values, status: "live" }, ctx);
		expect((await getProjectBySlug(db, project.slug))!.status).toBe("live");
	});
});

describe("profile", () => {
	it("saves the start date and the activity switch", async () => {
		expect(validateProfile({ building_since: "2026-02-30" })).toMatchObject({ ok: false, errors: { building_since: expect.any(String) } });
		await core.profileCore(db, idle, { building_since: "2026-06-30", show_activity: "on" });
		expect(await getProfile(db)).toEqual({ buildingSince: "2026-06-30", showActivity: true });
	});
});

describe("costs and revenue", () => {
	it("reads pounds and pence", () => {
		expect([parsePounds("12.40"), parsePounds("£1,200"), parsePounds("0"), parsePounds("12.5"), parsePounds("-3"), parsePounds("1.234"), parsePounds("ten")]).toEqual([1240, 120000, 0, 1250, null, null, null]);
	});

	it("skips blank rows and refuses duplicates and unknown projects", () => {
		expect(validateMoney({ service_0: "Cloudflare", amount_0: "5", service_2: "", amount_2: "" }, [])).toEqual({ ok: true, value: [{ kind: "cost", service: "Cloudflare", projectId: null, amountPence: 500 }] });
		expect(validateMoney({ service_0: "Cloudflare", amount_0: "5", service_1: "cloudflare", amount_1: "1" }, [])).toMatchObject({ ok: false, errors: { row_1: expect.any(String) } });
		expect(validateMoney({ service_0: "Anthropic", amount_0: "5", project_0: "999999" }, [])).toMatchObject({ ok: false, errors: { row_0: expect.any(String) } });
		expect(validateMoney({ service_0: "Anthropic", amount_0: "lots" }, [])).toMatchObject({ ok: false, errors: { row_0: expect.any(String) } });
	});

	it("replaces a month, and copies last month's costs into an empty month", async () => {
		await core.moneyCore(db, idle, { month: "2031-01", service_0: "Cloudflare", amount_0: "5", kind_1: "revenue", service_1: "Tech Jobs", amount_1: "0" });
		expect(await listMonth(db, "2031-01")).toHaveLength(2);
		const copied = await core.copyCostsCore(db, idle, { month: "2031-02" });
		expect(copied).toMatchObject({ state: { status: "ok" }, redirectTo: "/admin/settings/money?month=2031-02&copied=1" });
		expect(await listMonth(db, "2031-02")).toEqual([{ kind: "cost", service: "Cloudflare", projectId: null, amountPence: 500 }]);
		expect((await core.copyCostsCore(db, idle, { month: "2031-02" })).state.status).toBe("error");
		await core.moneyCore(db, idle, { month: "2031-02" });
		expect(await listMonth(db, "2031-02")).toEqual([]);
	});

	it("knows the month before", () => {
		expect([core.previousMonth("2026-01"), core.previousMonth("2026-11")]).toEqual(["2025-12", "2026-10"]);
	});
});
