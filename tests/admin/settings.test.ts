import { describe, expect, it } from "vitest";
import { authenticateServer } from "@/lib/collector/auth";
import type { FormState } from "@/lib/admin/form-state";
import * as core from "@/lib/admin/settings-core";
import { slugify, validateBrowserEvents, validateFunnel, validateJourney, validateOrigins, validateProjectDetails } from "@/lib/admin/validate";
import { listMetrics } from "@/lib/db/dashboard";
import { getProjectBySlug } from "@/lib/db/projects";
import { getJourney, listMilestones } from "@/lib/db/settings";
import { db, insert, validPageView } from "../helpers";

const idle: FormState = { status: "idle", version: 0 };
const ctx = { logos: ["/logos/portfolio.png"], now: Date.UTC(2026, 10, 2, 12) };
let counter = 0;
const uniqueSlug = (base: string) => `${base}-${(counter += 1)}-${crypto.randomUUID().slice(0, 6)}`;

async function newProject(extra: Record<string, string> = {}) {
	const slug = uniqueSlug("settings");
	const result = await core.createProjectCore(db, idle, { name: "Settings test", slug, status: "building", tagline: "A test", ...extra }, ctx);
	expect(result.state.status).toBe("ok");
	return (await getProjectBySlug(db, slug))!;
}

describe("validation", () => {
	it("makes slugs from names", () => {
		expect(slugify("Job Board!")).toBe("job-board");
		expect(slugify("  Café — Ideas  ")).toBe("cafe-ideas");
	});

	it("checks project details field by field", () => {
		const result = validateProjectDetails({ name: "", slug: "Bad Slug", tagline: "x".repeat(121), status: "paused", site_url: "http://x.com", github_repo: "nope", logo_path: "/logos/missing.png", links: "Just a label" }, []);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["github_repo", "links", "logo_path", "name", "site_url", "slug", "status", "tagline"]);
	});

	it("tidies good project details", () => {
		const result = validateProjectDetails({ name: "Job Board", status: "live", github_repo: "https://github.com/wahabalikhan/job_board/", links: "Site | https://example.com\nEmail | mailto:hi@example.com", sort_order: "2" }, []);
		expect(result).toMatchObject({ ok: true, value: { slug: "job-board", githubRepo: "wahabalikhan/job_board", sortOrder: 2, links: [{ label: "Site", url: "https://example.com/" }, { label: "Email", url: "mailto:hi@example.com" }] } });
	});

	it("accepts exact origins only", () => {
		expect(validateOrigins("https://example.com\nhttps://www.example.com/\nhttp://localhost:5555", "https://example.com")).toEqual({ ok: true, value: ["https://example.com", "https://www.example.com", "http://localhost:5555"], notes: [] });
		for (const bad of ["https://example.com/path", "http://example.com", "example.com", "https://example.com?x=1", "ftp://example.com"]) {
			expect(validateOrigins(bad, null).ok, bad).toBe(false);
		}
		expect(validateOrigins("https://other.example", "https://example.com")).toMatchObject({ ok: true, notes: [expect.stringContaining("https://example.com")] });
	});

	it("drops built-in events and refuses bad names", () => {
		expect(validateBrowserEvents("case_study_read, contact_click\noutbound_click")).toMatchObject({ ok: true, value: ["case_study_read", "contact_click"], notes: [expect.stringContaining("outbound_click")] });
		expect(validateBrowserEvents("Bad Name").ok).toBe(false);
	});

	it("reads funnel rows, skipping blanks", () => {
		const result = validateFunnel({ step_label_0: "Home", step_kind_0: "page", step_value_0: "/", step_label_2: "Contact", step_kind_2: "event", step_value_2: "contact_click" });
		expect(result).toEqual({ ok: true, value: [{ label: "Home", path: "/" }, { label: "Contact", event: "contact_click" }] });
		expect(validateFunnel({ step_label_0: "Home", step_kind_0: "page", step_value_0: "home?x=1" }).ok).toBe(false);
	});

	it("publishes journey entries now unless a date is given", () => {
		expect(validateJourney({ title: "Week one", publish: "on" }, [], ctx.now)).toMatchObject({ ok: true, value: { slug: "week-one", publish: true, publishedAt: ctx.now } });
		expect(validateJourney({ title: "Week one", publish: "on", published_on: "2026-10-01" }, [], ctx.now)).toMatchObject({ ok: true, value: { publishedAt: Date.parse("2026-10-01T09:00:00Z") } });
		expect(validateJourney({ title: "Week one", project_id: "999" }, [1], ctx.now).ok).toBe(false);
	});
});

describe("projects", () => {
	it("creates a project with visitors as its public headline, and goes to its keys", async () => {
		const slug = uniqueSlug("new");
		const result = await core.createProjectCore(db, idle, { name: "New thing", slug, status: "idea" }, ctx);
		expect(result.redirectTo).toBe(`/admin/settings/projects/${slug}?section=keys`);
		const project = await getProjectBySlug(db, slug);
		expect(project?.status).toBe("idea");
		expect((await listMetrics(db, project!.id)).map((m) => [m.key, m.isPublic, m.isHeadline])).toEqual([["visitors", true, true]]);
	});

	it("refuses a slug that's taken, keeping what was typed", async () => {
		const result = await core.createProjectCore(db, idle, { name: "Clash", slug: "portfolio", status: "live" }, ctx);
		expect(result.state).toMatchObject({ status: "error", errors: { slug: expect.stringContaining("already") }, values: { name: "Clash" } });
	});

	it("saves details and follows a slug change", async () => {
		const project = await newProject();
		const newSlug = uniqueSlug("renamed");
		const result = await core.saveDetailsCore(db, idle, { project_id: String(project.id), name: "Renamed", slug: newSlug, status: "live", logo_path: "/logos/portfolio.png" }, ctx);
		expect(result.redirectTo).toBe(`/admin/settings/projects/${newSlug}?section=details`);
		expect(await getProjectBySlug(db, newSlug)).toMatchObject({ name: "Renamed", logoPath: "/logos/portfolio.png" });
	});

	it("says so when the project has gone", async () => {
		const result = await core.saveDetailsCore(db, idle, { project_id: "999999", name: "X", status: "live" }, ctx);
		expect(result.state).toMatchObject({ status: "error", message: "That project no longer exists." });
	});

	it("only deletes after the slug is typed, and takes its data with it", async () => {
		const project = await newProject();
		await insert("page_views", validPageView(project.id));
		const refused = await core.deleteProjectCore(db, idle, { project_id: String(project.id), confirm_slug: "wrong" });
		expect(refused.state.status).toBe("error");
		expect(await getProjectBySlug(db, project.slug)).not.toBeNull();

		const deleted = await core.deleteProjectCore(db, idle, { project_id: String(project.id), confirm_slug: project.slug });
		expect(deleted.redirectTo).toBe("/admin/settings?deleted=1");
		expect(await getProjectBySlug(db, project.slug)).toBeNull();
		const left = await db.prepare("SELECT count(*) AS n FROM page_views WHERE project_id = ?1").bind(project.id).first<{ n: number }>();
		expect(left?.n).toBe(0);
	});
});

describe("keys", () => {
	it("creates keys once, shows the secret once, and only stores its hash", async () => {
		const project = await newProject();
		const result = await core.keysCore(db, idle, { project_id: String(project.id) });
		const secret = result.state.secret!;
		expect(secret).toMatch(/^sk_/);
		const stored = await db.prepare("SELECT * FROM projects WHERE id = ?1").bind(project.id).first<Record<string, string>>();
		expect(JSON.stringify(stored)).not.toContain(secret);
		const auth = await authenticateServer(db, new Request("https://x", { headers: { Authorization: `Bearer ${secret}` } }));
		expect(auth.ok).toBe(true);
	});

	it("needs confirmation to rotate, keeps the public key, and stops the old secret", async () => {
		const project = await newProject();
		const first = (await core.keysCore(db, idle, { project_id: String(project.id) })).state.secret!;
		const publicKey = (await getProjectBySlug(db, project.slug))!.publicKey;

		const refused = await core.keysCore(db, idle, { project_id: String(project.id) });
		expect(refused.state).toMatchObject({ status: "error", errors: { confirm_rotate: expect.any(String) } });
		expect(refused.state.secret).toBeUndefined();

		const second = (await core.keysCore(db, idle, { project_id: String(project.id), confirm_rotate: "on" })).state.secret!;
		expect(second).not.toBe(first);
		expect((await getProjectBySlug(db, project.slug))!.publicKey).toBe(publicKey);
		const header = (key: string) => new Request("https://x", { headers: { Authorization: `Bearer ${key}` } });
		expect((await authenticateServer(db, header(first))).ok).toBe(false);
		expect((await authenticateServer(db, header(second))).ok).toBe(true);
	});
});

describe("origins, events and funnel", () => {
	it("saves origins and warns when the site's own origin is missing", async () => {
		const project = await newProject({ site_url: "https://thing.example" });
		const result = await core.originsCore(db, idle, { project_id: String(project.id), origins: "https://other.example" });
		expect(result.state).toMatchObject({ status: "ok", notes: [expect.stringContaining("https://thing.example")] });
		expect((await getProjectBySlug(db, project.slug))!.allowedOrigins).toEqual(["https://other.example"]);
		expect((await core.originsCore(db, idle, { project_id: String(project.id), origins: "https://x.example/path" })).state.status).toBe("error");
	});

	it("saves browser events and the funnel", async () => {
		const project = await newProject();
		await core.eventsCore(db, idle, { project_id: String(project.id), browser_events: "case_study_read\nnot_found" });
		await core.funnelCore(db, idle, { project_id: String(project.id), step_label_0: "Home", step_kind_0: "page", step_value_0: "/" });
		const saved = (await getProjectBySlug(db, project.slug))!;
		expect(saved.browserEvents).toEqual(["case_study_read"]);
		expect(saved.funnel).toEqual([{ label: "Home", path: "/" }]);
	});
});

describe("public numbers", () => {
	it("adds numbers, sets which are public, and keeps one headline that's always public", async () => {
		const project = await newProject();
		expect((await core.addMetricCore(db, idle, { project_id: String(project.id), source: "product", label: "Jobs listed" })).state.status).toBe("ok");
		expect((await core.addMetricCore(db, idle, { project_id: String(project.id), source: "product", label: "Jobs listed" })).state).toMatchObject({ errors: { key: expect.any(String) } });
		expect((await core.addMetricCore(db, idle, { project_id: String(project.id), source: "event", label: "Reads" })).state).toMatchObject({ errors: { event_name: expect.any(String) } });

		const [visitors, jobs] = await listMetrics(db, project.id);
		expect(jobs).toMatchObject({ key: "jobs_listed", isPublic: false });
		const result = await core.visibilityCore(db, idle, { project_id: String(project.id), headline: String(jobs.id) });
		expect(result.state.notes).toEqual([expect.stringContaining("made public")]);
		const after = await listMetrics(db, project.id);
		expect(after.map((m) => [m.key, m.isPublic, m.isHeadline])).toEqual([
			["visitors", false, false],
			["jobs_listed", true, true],
		]);
		expect(visitors.id).toBeGreaterThan(0);

		expect((await core.deleteMetricCore(db, idle, { project_id: String(project.id), metric_id: String(jobs.id) })).state.status).toBe("error");
		await core.deleteMetricCore(db, idle, { project_id: String(project.id), metric_id: String(jobs.id), confirm: "on" });
		expect((await listMetrics(db, project.id)).map((m) => m.key)).toEqual(["visitors"]);
	});

	it("can't change another project's numbers", async () => {
		const mine = await newProject();
		const theirs = await newProject();
		const [theirMetric] = await listMetrics(db, theirs.id);
		await core.deleteMetricCore(db, idle, { project_id: String(mine.id), metric_id: String(theirMetric.id), confirm: "on" });
		expect(await listMetrics(db, theirs.id)).toHaveLength(1);
	});
});

describe("milestones and journey", () => {
	it("adds, edits and deletes milestones", async () => {
		const project = await newProject();
		const id = String(project.id);
		expect((await core.milestoneCore(db, idle, { project_id: id, day: "2026-11-02", title: "Launched", is_public: "on" })).state.status).toBe("ok");
		const [milestone] = await listMilestones(db, project.id);
		await core.milestoneCore(db, idle, { project_id: id, milestone_id: String(milestone.id), day: "2026-11-01", title: "Launched (soft)" });
		expect(await listMilestones(db, project.id)).toEqual([{ id: milestone.id, projectId: project.id, day: "2026-11-01", title: "Launched (soft)", note: "", isPublic: false }]);
		await core.milestoneCore(db, idle, { project_id: id, milestone_id: String(milestone.id), intent: "delete" });
		expect(await listMilestones(db, project.id)).toEqual([]);
		expect((await core.milestoneCore(db, idle, { project_id: id, day: "not a date", title: "" })).state.errors).toMatchObject({ day: expect.any(String), title: expect.any(String) });
	});

	it("creates drafts, publishes, refuses taken slugs and deletes", async () => {
		const created = await core.journeyCore(db, idle, { title: "Week one", body_md: "Hello" }, ctx);
		const id = Number(created.redirectTo!.match(/journey\/(\d+)/)![1]);
		expect(await getJourney(db, id)).toMatchObject({ slug: "week-one", isPublished: false, publishedAt: null });

		await core.journeyCore(db, idle, { entry_id: String(id), title: "Week one", slug: "week-one", body_md: "Hello again", publish: "on" }, ctx);
		expect(await getJourney(db, id)).toMatchObject({ isPublished: true, publishedAt: ctx.now, bodyMd: "Hello again" });

		await core.journeyCore(db, idle, { entry_id: String(id), title: "Week one", slug: "week-one", body_md: "Unpublished" }, ctx);
		expect(await getJourney(db, id)).toMatchObject({ isPublished: false, publishedAt: null });

		expect((await core.journeyCore(db, idle, { title: "Another", slug: "week-one" }, ctx)).state.errors).toMatchObject({ slug: expect.any(String) });

		const deleted = await core.journeyCore(db, idle, { entry_id: String(id), intent: "delete" }, ctx);
		expect(deleted.redirectTo).toBe("/admin/settings/journey?deleted=1");
		expect(await getJourney(db, id)).toBeNull();
	});

	it("keeps journey entries when their project is deleted", async () => {
		const project = await newProject();
		const created = await core.journeyCore(db, idle, { title: uniqueSlug("kept"), project_id: String(project.id) }, ctx);
		const id = Number(created.redirectTo!.match(/journey\/(\d+)/)![1]);
		await core.deleteProjectCore(db, idle, { project_id: String(project.id), confirm_slug: project.slug });
		expect(await getJourney(db, id)).toMatchObject({ projectId: null });
	});
});

it("refuses a project id that isn't a number", async () => {
	expect((await core.originsCore(db, idle, { project_id: "1 OR 1=1", origins: "" })).state.message).toBe("That project no longer exists.");
});
