import { describe, expect, it } from "vitest";
import * as core from "@/lib/admin/settings-core";
import type { FormState } from "@/lib/admin/form-state";
import { projectSummaries } from "@/lib/db/dashboard";
import { getProjectBySlug, listPublicProjects, listRealProjects } from "@/lib/db/projects";
import { rollupDay } from "@/lib/jobs/rollup";
import { buildSnapshot } from "@/lib/public/snapshot";
import { site } from "@/lib/site";
import { showProjectsWithFirstVisit } from "@/lib/db/settings";
import { PUBLIC_KEY_PATTERN } from "@/lib/keys";
import { createProject, db, insert, validPageView } from "../helpers";

const TODAY = "2026-11-02";
const NOW = Date.UTC(2026, 10, 2, 12);
const idle: FormState = { status: "idle", version: 0 };
const visitor = (n: number) => n.toString(16).padStart(64, "0");

async function bobbyBuilds() {
	return (await getProjectBySlug(db, site.selfSlug))!;
}

/** Gives a project visitors today, a public product number, a public milestone and a journey entry. */
async function giveItData(projectId: number, tag: string) {
	for (let i = 0; i < 4; i += 1) await insert("page_views", validPageView(projectId, { visitor_id: visitor(i + 1), ts: NOW + i }));
	await rollupDay(db, TODAY);
	const metric = await db
		.prepare("INSERT INTO metrics (project_id, key, label, source, is_public, sort_order) VALUES (?1, 'signups', 'Signups', 'product', 1, 5) RETURNING id")
		.bind(projectId)
		.first<{ id: number }>();
	await insert("metric_values", { metric_id: metric!.id, day: TODAY, value: 4321, updated_at: NOW });
	await insert("milestones", { project_id: projectId, day: TODAY, title: `${tag} milestone`, is_public: 1 });
	await insert("journey_entries", { slug: `${tag}-entry`, title: `About ${tag}`, body_md: "Hello.", project_id: projectId, is_published: 1, published_at: NOW - 1000 });
}

describe("the BobbyBuilds project", () => {
	it("is set up for the public pages' t.js: live, its own origin, the key in site.ts, and hidden from the public page", async () => {
		const project = await bobbyBuilds();
		expect(project).toMatchObject({
			name: "BobbyBuilds",
			status: "live",
			siteUrl: site.url,
			healthUrl: site.url,
			allowedOrigins: [site.url],
			publicKey: site.trackerKey,
			secretKeyHint: null,
			showPublic: false,
		});
		expect(site.trackerKey).toMatch(PUBLIC_KEY_PATTERN);
	});

	it("comes first, then Portfolio, then Tech Jobs", async () => {
		const order = (await listRealProjects(db)).map((p) => p.slug).filter((s) => ["bobbybuilds", "portfolio", "job-board", "tech-jobs"].includes(s));
		expect(order).toEqual(["bobbybuilds", "portfolio", "job-board"]);
	});

	it("never appears in public output, even with visitors, public numbers, milestones and a journey entry", async () => {
		const project = await bobbyBuilds();
		await giveItData(project.id, "self");
		const other = await createProject({ slug: "shown-project", name: "Shown", tagline: "Shown tagline" });
		await insert("metrics", { project_id: other, key: "visitors", label: "Visitors", source: "collector", is_public: 1, is_headline: 1 });
		for (let i = 0; i < 2; i += 1) await insert("page_views", validPageView(other, { visitor_id: visitor(10 + i), ts: NOW + i }));
		await rollupDay(db, TODAY);

		const snapshot = await buildSnapshot(db, TODAY, NOW);
		expect(snapshot.projects.map((p) => p.slug)).not.toContain("bobbybuilds");
		expect(snapshot.projects.map((p) => p.slug)).toContain("shown-project");
		// The public totals (chart, dropdown, share image) are only the shown projects' visitors.
		const thisMonth = snapshot.monthly.find((m) => m.month === TODAY.slice(0, 7))!;
		expect(thisMonth.value).toBe(snapshot.projects.reduce((t, p) => t + (p.monthly?.find((m) => m.month === TODAY.slice(0, 7))?.value ?? 0), 0));
		expect(thisMonth.value).toBe(2);
		// The entry is still public, but without the project's name.
		expect(snapshot.journey.find((e) => e.slug === "self-entry")).toMatchObject({ projectSlug: null, projectName: null });
		const json = JSON.stringify(snapshot);
		for (const leak of ['"bobbybuilds"', '"BobbyBuilds"', project.tagline, site.trackerKey, "self milestone", "4321"]) expect(json).not.toContain(leak);
	});

	it("is still everywhere in the admin", async () => {
		const project = await bobbyBuilds();
		expect((await listRealProjects(db)).some((p) => p.id === project.id)).toBe(true);
		expect((await listPublicProjects(db)).some((p) => p.id === project.id)).toBe(false);
		expect((await projectSummaries(db, TODAY)).some((s) => s.project.id === project.id)).toBe(true);
	});

	it("keeps its public key when keys are made under Connection (the public pages' snippet uses it)", async () => {
		const project = await bobbyBuilds();
		const result = await core.keysCore(db, idle, { project_id: String(project.id) });
		expect(result.state.secret).toMatch(/^sk_/);
		expect((await bobbyBuilds()).publicKey).toBe(site.trackerKey);
	});
});

describe("Show on my public page", () => {
	it("hides a project from the public page when off, and brings it back when on", async () => {
		const id = await createProject({ slug: "switch-me", name: "Switch me" });
		await insert("metrics", { project_id: id, key: "visitors", label: "Visitors", source: "collector", is_public: 1, is_headline: 1 });
		await insert("page_views", validPageView(id, { visitor_id: visitor(20) }));
		await rollupDay(db, TODAY);
		const visitorsMetric = await db.prepare("SELECT id FROM metrics WHERE project_id = ?1 AND key = 'visitors'").bind(id).first<{ id: number }>();
		const shown = async () => (await buildSnapshot(db, TODAY, NOW)).projects.some((p) => p.slug === "switch-me");
		expect(await shown()).toBe(true);

		const off = await core.visibilityCore(db, idle, { project_id: String(id), [`public_${visitorsMetric!.id}`]: "on" });
		expect(off.state).toMatchObject({ status: "ok", message: "Saved. Switch me isn't on your public page." });
		expect(await shown()).toBe(false);
		// Its own switches are kept, so switching it back on shows it as before.
		expect(await db.prepare("SELECT is_public FROM metrics WHERE id = ?1").bind(visitorsMetric!.id).first("is_public")).toBe(1);

		await core.visibilityCore(db, idle, { project_id: String(id), show_public: "on", [`public_${visitorsMetric!.id}`]: "on" });
		expect(await shown()).toBe(true);
	});

	it("is off for new projects until their first visit, then the 5-minute job turns it on", async () => {
		const result = await core.startProjectCore(db, idle, { name: "Fresh one", site_url: "https://fresh.example" });
		const fresh = async () => (await getProjectBySlug(db, result.state.setup!.slug))!;
		expect(await fresh()).toMatchObject({ showPublic: false, showOnFirstVisit: true });

		// No visit yet: still hidden.
		await showProjectsWithFirstVisit(db, Date.now());
		expect((await fresh()).showPublic).toBe(false);

		await insert("page_views", validPageView((await fresh()).id));
		expect(await showProjectsWithFirstVisit(db, Date.now())).toBeGreaterThanOrEqual(1);
		expect(await fresh()).toMatchObject({ showPublic: true, showOnFirstVisit: false });
	});

	it("keeps your own choice: saving the switch ends the wait for the first visit", async () => {
		const result = await core.startProjectCore(db, idle, { name: "Kept hidden", site_url: "https://kept.example" });
		const project = (await getProjectBySlug(db, result.state.setup!.slug))!;
		await core.visibilityCore(db, idle, { project_id: String(project.id) });
		await insert("page_views", validPageView(project.id));
		await showProjectsWithFirstVisit(db, Date.now());
		expect(await getProjectBySlug(db, project.slug)).toMatchObject({ showPublic: false, showOnFirstVisit: false });
	});
});

describe("project order", () => {
	it("is saved from About this project and used for the admin and public lists", async () => {
		const a = await createProject({ slug: "order-a", name: "A", sort_order: 50 });
		await createProject({ slug: "order-b", name: "B", sort_order: 60 });
		const before = (await listRealProjects(db)).map((p) => p.slug);
		expect(before.indexOf("order-a")).toBeLessThan(before.indexOf("order-b"));

		const saved = await core.saveDetailsCore(db, idle, { project_id: String(a), name: "A", status: "live", tagline: "", site_url: "", sort_order: "70" }, { logos: [], now: NOW });
		expect(saved.state.status).toBe("ok");
		const after = (await listRealProjects(db)).map((p) => p.slug);
		expect(after.indexOf("order-a")).toBeGreaterThan(after.indexOf("order-b"));
		const shown = (await listPublicProjects(db)).map((p) => p.slug);
		expect(shown.indexOf("order-a")).toBeGreaterThan(shown.indexOf("order-b"));
	});

	it("refuses anything but a whole number", async () => {
		const id = await createProject({ slug: "order-bad", name: "Bad" });
		for (const sort_order of ["1.5", "2abc", "5000"]) {
			const result = await core.saveDetailsCore(db, idle, { project_id: String(id), name: "Bad", status: "live", sort_order }, { logos: [], now: NOW });
			expect(result.state.errors?.sort_order, sort_order).toBe("Use a whole number between -1000 and 1000.");
		}
	});

	it("puts a new project at the end", async () => {
		const result = await core.startProjectCore(db, idle, { name: "Last one", site_url: "https://last.example" });
		const slugs = (await listRealProjects(db)).map((p) => p.slug);
		expect(slugs.at(-1)).toBe(result.state.setup!.slug);
	});
});
