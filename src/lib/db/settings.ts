/**
 * Writes for the settings pages. Every query uses bound parameters; multi-step changes go in one
 * D1 batch (a transaction).
 */
import type { JourneyInput, MilestoneInput, NewMetric, ProjectDetails } from "@/lib/admin/validate";
import type { FunnelStep } from "./funnel";

export class SlugTakenError extends Error {}

const now = () => Date.now();

function isUniqueSlugError(error: unknown): boolean {
	return error instanceof Error && /UNIQUE constraint failed: (projects|journey_entries)\.slug/.test(error.message);
}

// --- Projects ---------------------------------------------------------------------------

export async function createProject(db: D1Database, details: ProjectDetails): Promise<number> {
	try {
		const row = await db
			.prepare(
				`INSERT INTO projects (slug, name, tagline, description_md, status, lesson, logo_path, site_url, health_url, github_repo, links, sort_order)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) RETURNING id`,
			)
			.bind(
				details.slug,
				details.name,
				details.tagline,
				details.descriptionMd,
				details.status,
				details.lesson,
				details.logoPath,
				details.siteUrl,
				details.healthUrl,
				details.githubRepo,
				JSON.stringify(details.links),
				details.sortOrder,
			)
			.first<{ id: number }>();
		// Every project starts with visitors as its public headline number.
		await db
			.prepare("INSERT INTO metrics (project_id, key, label, source, is_public, is_headline, sort_order) VALUES (?1, 'visitors', 'Visitors', 'collector', 1, 1, 1)")
			.bind(row!.id)
			.run();
		return row!.id;
	} catch (error) {
		if (isUniqueSlugError(error)) throw new SlugTakenError();
		throw error;
	}
}

export async function updateProjectDetails(db: D1Database, id: number, details: ProjectDetails): Promise<void> {
	try {
		await db
			.prepare(
				`UPDATE projects SET slug = ?2, name = ?3, tagline = ?4, description_md = ?5, status = ?6, lesson = ?7, logo_path = ?8,
				   site_url = ?9, health_url = ?10, github_repo = ?11, links = ?12, sort_order = ?13, updated_at = ?14
				 WHERE id = ?1`,
			)
			.bind(
				id,
				details.slug,
				details.name,
				details.tagline,
				details.descriptionMd,
				details.status,
				details.lesson,
				details.logoPath,
				details.siteUrl,
				details.healthUrl,
				details.githubRepo,
				JSON.stringify(details.links),
				details.sortOrder,
				now(),
			)
			.run();
	} catch (error) {
		if (isUniqueSlugError(error)) throw new SlugTakenError();
		throw error;
	}
}

export async function setOrigins(db: D1Database, id: number, origins: string[]): Promise<void> {
	await db.prepare("UPDATE projects SET allowed_origins = ?2, updated_at = ?3 WHERE id = ?1").bind(id, JSON.stringify(origins), now()).run();
}

export async function setBrowserEvents(db: D1Database, id: number, events: string[]): Promise<void> {
	await db.prepare("UPDATE projects SET browser_events = ?2, updated_at = ?3 WHERE id = ?1").bind(id, JSON.stringify(events), now()).run();
}

export async function setFunnel(db: D1Database, id: number, steps: FunnelStep[]): Promise<void> {
	await db.prepare("UPDATE projects SET funnel = ?2, updated_at = ?3 WHERE id = ?1").bind(id, JSON.stringify(steps), now()).run();
}

/** "Show on my public page": whether the project appears on the public page at all. */
export async function setShowPublic(db: D1Database, id: number, show: boolean): Promise<void> {
	await db.prepare("UPDATE projects SET show_public = ?2, updated_at = ?3 WHERE id = ?1").bind(id, show ? 1 : 0, now()).run();
}

/** Deletes a project and, through the foreign keys, all of its data. Journey entries are kept. */
export async function deleteProject(db: D1Database, id: number): Promise<void> {
	await db.prepare("DELETE FROM projects WHERE id = ?1").bind(id).run();
}

// --- Numbers ----------------------------------------------------------------------------

export async function addMetric(db: D1Database, projectId: number, metric: NewMetric): Promise<"added" | "exists"> {
	const result = await db
		.prepare(
			`INSERT OR IGNORE INTO metrics (project_id, key, label, unit, source, event_name, sort_order)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, (SELECT COALESCE(max(sort_order), 0) + 1 FROM metrics WHERE project_id = ?1))`,
		)
		.bind(projectId, metric.key, metric.label, metric.unit, metric.source, metric.eventName)
		.run();
	return result.meta.changes === 1 ? "added" : "exists";
}

/**
 * Sets which numbers are public and which one is the headline, in one transaction.
 * The headline is always made public (it's shown on the public card).
 */
export async function setMetricVisibility(db: D1Database, projectId: number, publicIds: number[], headlineId: number | null): Promise<void> {
	const ids = new Set(publicIds);
	if (headlineId !== null) ids.add(headlineId);
	const { results } = await db.prepare("SELECT id FROM metrics WHERE project_id = ?1").bind(projectId).all<{ id: number }>();
	const statements = [db.prepare("UPDATE metrics SET is_headline = 0 WHERE project_id = ?1").bind(projectId)];
	for (const { id } of results) {
		statements.push(db.prepare("UPDATE metrics SET is_public = ?3 WHERE id = ?1 AND project_id = ?2").bind(id, projectId, ids.has(id) ? 1 : 0));
	}
	if (headlineId !== null && results.some((r) => r.id === headlineId)) {
		statements.push(db.prepare("UPDATE metrics SET is_headline = 1 WHERE id = ?1 AND project_id = ?2").bind(headlineId, projectId));
	}
	await db.batch(statements);
}

export async function deleteMetric(db: D1Database, projectId: number, metricId: number): Promise<void> {
	await db.prepare("DELETE FROM metrics WHERE id = ?1 AND project_id = ?2").bind(metricId, projectId).run();
}

// --- Journey entries --------------------------------------------------------------------

export type JourneyEntry = {
	id: number;
	slug: string;
	title: string;
	bodyMd: string;
	projectId: number | null;
	isPublished: boolean;
	publishedAt: number | null;
	updatedAt: number;
};

type JourneyRow = { id: number; slug: string; title: string; body_md: string; project_id: number | null; is_published: number; published_at: number | null; updated_at: number };
const toEntry = (r: JourneyRow): JourneyEntry => ({
	id: r.id,
	slug: r.slug,
	title: r.title,
	bodyMd: r.body_md,
	projectId: r.project_id,
	isPublished: r.is_published === 1,
	publishedAt: r.published_at,
	updatedAt: r.updated_at,
});

export async function listJourney(db: D1Database): Promise<JourneyEntry[]> {
	const { results } = await db.prepare("SELECT * FROM journey_entries ORDER BY COALESCE(published_at, updated_at) DESC, id DESC").all<JourneyRow>();
	return results.map(toEntry);
}

export async function getJourney(db: D1Database, id: number): Promise<JourneyEntry | null> {
	const row = await db.prepare("SELECT * FROM journey_entries WHERE id = ?1").bind(id).first<JourneyRow>();
	return row ? toEntry(row) : null;
}

export async function saveJourney(db: D1Database, id: number | null, input: JourneyInput): Promise<number> {
	try {
		if (id === null) {
			const row = await db
				.prepare(
					`INSERT INTO journey_entries (slug, title, body_md, project_id, is_published, published_at, created_at, updated_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) RETURNING id`,
				)
				.bind(input.slug, input.title, input.bodyMd, input.projectId, input.publish ? 1 : 0, input.publishedAt, now())
				.first<{ id: number }>();
			return row!.id;
		}
		await db
			.prepare(
				`UPDATE journey_entries SET slug = ?2, title = ?3, body_md = ?4, project_id = ?5, is_published = ?6,
				   published_at = CASE WHEN ?6 = 1 THEN COALESCE(?7, published_at) ELSE NULL END, updated_at = ?8
				 WHERE id = ?1`,
			)
			.bind(id, input.slug, input.title, input.bodyMd, input.projectId, input.publish ? 1 : 0, input.publishedAt, now())
			.run();
		return id;
	} catch (error) {
		if (isUniqueSlugError(error)) throw new SlugTakenError();
		throw error;
	}
}

export async function deleteJourney(db: D1Database, id: number): Promise<void> {
	await db.prepare("DELETE FROM journey_entries WHERE id = ?1").bind(id).run();
}

// --- Milestones -------------------------------------------------------------------------

export type Milestone = { id: number; projectId: number; day: string; title: string; note: string; isPublic: boolean };

export async function listMilestones(db: D1Database, projectId: number): Promise<Milestone[]> {
	const { results } = await db
		.prepare("SELECT id, project_id, day, title, note, is_public FROM milestones WHERE project_id = ?1 ORDER BY day DESC, id DESC")
		.bind(projectId)
		.all<{ id: number; project_id: number; day: string; title: string; note: string; is_public: number }>();
	return results.map((r) => ({ id: r.id, projectId: r.project_id, day: r.day, title: r.title, note: r.note, isPublic: r.is_public === 1 }));
}

export async function saveMilestone(db: D1Database, projectId: number, id: number | null, input: MilestoneInput): Promise<void> {
	if (id === null) {
		await db
			.prepare("INSERT INTO milestones (project_id, day, title, note, is_public) VALUES (?1, ?2, ?3, ?4, ?5)")
			.bind(projectId, input.day, input.title, input.note, input.isPublic ? 1 : 0)
			.run();
		return;
	}
	await db
		.prepare("UPDATE milestones SET day = ?3, title = ?4, note = ?5, is_public = ?6 WHERE id = ?1 AND project_id = ?2")
		.bind(id, projectId, input.day, input.title, input.note, input.isPublic ? 1 : 0)
		.run();
}

export async function deleteMilestone(db: D1Database, projectId: number, id: number): Promise<void> {
	await db.prepare("DELETE FROM milestones WHERE id = ?1 AND project_id = ?2").bind(id, projectId).run();
}
