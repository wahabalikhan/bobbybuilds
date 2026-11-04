import { describe, expect, it } from "vitest";
import * as core from "@/lib/admin/settings-core";
import type { FormState } from "@/lib/admin/form-state";
import { getProjectBySlug } from "@/lib/db/projects";
import { buildSnapshot } from "@/lib/public/snapshot";
import { createProject, db, insert } from "../helpers";

const TODAY = "2026-11-04";
const NOW = Date.UTC(2026, 10, 4, 12);
const idle: FormState = { status: "idle", version: 0 };
const TEMPLATE = "{open_jobs} real tech jobs, straight from {active_companies} companies";
const FALLBACK = "Only real tech jobs, straight from the company";

async function boardWithNumbers(slug: string, { companiesDay = TODAY, companiesPublic = 1 } = {}) {
	const id = await createProject({ slug, name: "Board", tagline: TEMPLATE, tagline_fallback: FALLBACK });
	const metric = async (key: string, label: string, isPublic: number) =>
		(await db.prepare("INSERT INTO metrics (project_id, key, label, source, is_public) VALUES (?1, ?2, ?3, 'product', ?4) RETURNING id").bind(id, key, label, isPublic).first<{ id: number }>())!.id;
	await insert("metric_values", { metric_id: await metric("open_jobs", "Open jobs", 1), day: TODAY, value: 4868, updated_at: NOW });
	await insert("metric_values", { metric_id: await metric("active_companies", "Companies", companiesPublic), day: companiesDay, value: 838, updated_at: NOW });
	return id;
}

const publicTagline = async (slug: string) => (await buildSnapshot(db, TODAY, NOW)).projects.find((p) => p.slug === slug)?.tagline;

describe("Tech Jobs' tagline", () => {
	it("is set by the migration, with its fallback", async () => {
		expect(await getProjectBySlug(db, "job-board")).toMatchObject({ tagline: TEMPLATE, taglineFallback: FALLBACK });
	});
});

describe("taglines with numbers on the public page", () => {
	it("are filled in with the latest values, and the {placeholders} never reach the public page", async () => {
		await boardWithNumbers("fills-in");
		expect(await publicTagline("fills-in")).toBe("4,868 real tech jobs, straight from 838 companies");
		expect(JSON.stringify(await buildSnapshot(db, TODAY, NOW))).not.toContain("{open_jobs}");
	});

	it("fall back when a value is over a week old", async () => {
		await boardWithNumbers("stale-one", { companiesDay: "2026-10-27" });
		expect(await publicTagline("stale-one")).toBe(FALLBACK);
	});

	it("fall back when a number is private, so it never shows", async () => {
		await boardWithNumbers("private-one", { companiesPublic: 0 });
		expect(await publicTagline("private-one")).toBe(FALLBACK);
		const card = (await buildSnapshot(db, TODAY, NOW)).projects.find((p) => p.slug === "private-one");
		expect(JSON.stringify(card)).not.toContain("838");
	});
});

describe("saving a tagline with numbers", () => {
	const save = (id: number, values: Record<string, string>) => core.saveDetailsCore(db, idle, { project_id: String(id), name: "Board", status: "live", ...values }, { logos: [], now: NOW });

	it("saves placeholders for the project's own product numbers, with a fallback", async () => {
		const id = await boardWithNumbers("saves-ok");
		const result = await save(id, { tagline: TEMPLATE, tagline_fallback: FALLBACK });
		expect(result.state.status).toBe("ok");
		expect(await getProjectBySlug(db, "saves-ok")).toMatchObject({ tagline: TEMPLATE, taglineFallback: FALLBACK });
	});

	it("refuses a placeholder that isn't one of its product numbers, naming the ones it has", async () => {
		const id = await boardWithNumbers("saves-typo");
		const result = await save(id, { tagline: "{open_job} jobs", tagline_fallback: FALLBACK });
		expect(result.state.errors?.tagline).toBe("{open_job} isn't one of Board's product numbers (it has {open_jobs}, {active_companies}).");
	});

	it("needs a fallback when there are placeholders", async () => {
		const id = await boardWithNumbers("saves-no-fallback");
		const result = await save(id, { tagline: TEMPLATE, tagline_fallback: "" });
		expect(result.state.errors?.tagline_fallback).toBe("Add a fallback tagline, shown when the numbers can't be filled in.");
	});

	it("warns that a private number means the fallback shows", async () => {
		const id = await boardWithNumbers("saves-private", { companiesPublic: 0 });
		const result = await save(id, { tagline: TEMPLATE, tagline_fallback: FALLBACK });
		expect(result.state.status).toBe("ok");
		expect(result.state.notes).toContain("{active_companies} isn't public, so your public page shows the fallback tagline until it is (under On your public page).");
	});

	it("keeps a plain tagline as it is, with no fallback needed", async () => {
		const id = await createProject({ slug: "saves-plain", name: "Plain" });
		const result = await core.saveDetailsCore(db, idle, { project_id: String(id), name: "Plain", status: "live", tagline: "Just words." }, { logos: [], now: NOW });
		expect(result.state.status).toBe("ok");
	});
});
