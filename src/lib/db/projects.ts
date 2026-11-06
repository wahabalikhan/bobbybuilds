/**
 * Project queries. Every query uses bound parameters.
 * JSON columns are parsed here so callers get plain arrays.
 */

/** "paused" is stored as is_paused (migration 0012) and shown instead of the stored status. */
export type ProjectStatus = "live" | "building" | "paused" | "idea" | "retired";

export type ProjectLink = { label: string; url: string };

export type Project = {
	id: number;
	slug: string;
	name: string;
	/** May hold {key} placeholders for public product numbers (see fillTagline). */
	tagline: string;
	/** Shown instead when the tagline's placeholders can't be filled. */
	taglineFallback: string;
	descriptionMd: string;
	status: ProjectStatus;
	lesson: string | null;
	logoPath: string | null;
	siteUrl: string | null;
	healthUrl: string | null;
	githubRepo: string | null;
	links: ProjectLink[];
	allowedOrigins: string[];
	browserEvents: string[];
	/** Raw funnel steps; use parseFunnel() from ./funnel to read them. */
	funnel: unknown[];
	publicKey: string | null;
	secretKeyHint: string | null;
	sortOrder: number;
	/** Whether it appears on the public page at all (card, chart, totals, share images). */
	showPublic: boolean;
	/** New projects: hidden until their first visit, then shown by the 5-minute job (migration 0020). */
	showOnFirstVisit: boolean;
	/** Shown before the name on the public page, e.g. "💼". "" = none. */
	emoji: string;
	/** The hero screenshot: a file in public/screenshots/ (always with alt text). */
	screenshotPath: string | null;
	screenshotAlt: string;
	caseStudyUrl: string | null;
	/** Up to 3 lines with {key} placeholders, e.g. "{open_jobs} jobs made clear". */
	outcomes: string[];
	/** What's happening now ("building the CV fit"), shown after "Now:" on the public card. "" = none. */
	nowText: string;
	/** 'YYYY-MM-DD': its charts start here, or when its tracking began if that's later. */
	startedOn: string | null;
};

type ProjectRow = {
	id: number;
	slug: string;
	name: string;
	tagline: string;
	tagline_fallback: string;
	description_md: string;
	status: ProjectStatus;
	lesson: string | null;
	logo_path: string | null;
	site_url: string | null;
	health_url: string | null;
	github_repo: string | null;
	links: string;
	allowed_origins: string;
	browser_events: string;
	funnel: string;
	public_key: string | null;
	secret_key_hint: string | null;
	sort_order: number;
	show_public: number;
	show_on_first_visit: number;
	is_paused: number;
	emoji: string;
	screenshot_path: string | null;
	screenshot_alt: string;
	case_study_url: string | null;
	outcomes: string;
	now_text: string;
	started_on: string | null;
};

// secret_key_hash is deliberately never selected into a Project.
const PROJECT_COLUMNS = `id, slug, name, tagline, tagline_fallback, description_md, status, lesson, logo_path, site_url, health_url,
	github_repo, links, allowed_origins, browser_events, funnel, public_key, secret_key_hint, sort_order, show_public, show_on_first_visit,
	is_paused, emoji, screenshot_path, screenshot_alt, case_study_url, outcomes, now_text, started_on`;

function parseJsonArray<T>(value: string): T[] {
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

function toProject(row: ProjectRow): Project {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		tagline: row.tagline,
		taglineFallback: row.tagline_fallback,
		descriptionMd: row.description_md,
		status: row.is_paused === 1 ? "paused" : row.status,
		lesson: row.lesson,
		logoPath: row.logo_path,
		siteUrl: row.site_url,
		healthUrl: row.health_url,
		githubRepo: row.github_repo,
		links: parseJsonArray<ProjectLink>(row.links),
		allowedOrigins: parseJsonArray<string>(row.allowed_origins),
		browserEvents: parseJsonArray<string>(row.browser_events),
		funnel: parseJsonArray<unknown>(row.funnel),
		publicKey: row.public_key,
		secretKeyHint: row.secret_key_hint,
		sortOrder: row.sort_order,
		showPublic: row.show_public === 1,
		showOnFirstVisit: row.show_on_first_visit === 1,
		emoji: row.emoji,
		screenshotPath: row.screenshot_path,
		screenshotAlt: row.screenshot_alt,
		caseStudyUrl: row.case_study_url,
		outcomes: parseJsonArray<unknown>(row.outcomes).filter((o): o is string => typeof o === "string"),
		nowText: row.now_text,
		startedOn: row.started_on,
	};
}

export async function listProjects(db: D1Database): Promise<Project[]> {
	const { results } = await db
		.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY sort_order, id`)
		.all<ProjectRow>();
	return results.map(toProject);
}

/**
 * A test project (like the local Playground) only accepts loopback origins. Test projects are
 * hidden from the admin lists, Needs attention and the public page.
 */
export function isTestProject(project: Pick<Project, "allowedOrigins">): boolean {
	return project.allowedOrigins.length > 0 && project.allowedOrigins.every((origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin));
}

/** Every project except test projects, in display order. */
export async function listRealProjects(db: D1Database): Promise<Project[]> {
	return (await listProjects(db)).filter((p) => !isTestProject(p));
}

/** Projects for the public page: real projects with "Show on my public page" on, in display order. */
export async function listPublicProjects(db: D1Database): Promise<Project[]> {
	return (await listRealProjects(db)).filter((p) => p.showPublic);
}

/** Each project's first day with page views (its tracking began), from the roll-ups and today's raw views. */
export async function firstTrackedDays(db: D1Database): Promise<Map<number, string>> {
	const { results } = await db
		.prepare(
			`SELECT project_id, min(day) AS day FROM (
			   SELECT project_id, day FROM daily_totals WHERE pageviews > 0
			   UNION ALL SELECT project_id, day FROM page_views
			 ) GROUP BY project_id`,
		)
		.all<{ project_id: number; day: string }>();
	return new Map(results.map((r) => [r.project_id, r.day]));
}

/** Ids of projects that have had at least one page view ever (today's raw views or any roll-up). */
export async function projectsWithVisits(db: D1Database): Promise<Set<number>> {
	const { results } = await db
		.prepare("SELECT project_id FROM daily_totals WHERE pageviews > 0 UNION SELECT DISTINCT project_id FROM page_views")
		.all<{ project_id: number }>();
	return new Set(results.map((r) => r.project_id));
}

/** Connected: it has keys and data has arrived. */
export function isConnected(project: Pick<Project, "id" | "publicKey">, withVisits: Set<number>): boolean {
	return Boolean(project.publicKey) && withVisits.has(project.id);
}

export async function getProjectBySlug(db: D1Database, slug: string): Promise<Project | null> {
	const row = await db.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE slug = ?1`).bind(slug).first<ProjectRow>();
	return row ? toProject(row) : null;
}

export async function getProjectByPublicKey(db: D1Database, publicKey: string): Promise<Project | null> {
	const row = await db
		.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE public_key = ?1`)
		.bind(publicKey)
		.first<ProjectRow>();
	return row ? toProject(row) : null;
}

/** Looks a project up by the hash of a secret key. Pass the hash, never the key. */
export async function getProjectBySecretKeyHash(db: D1Database, secretKeyHash: string): Promise<Project | null> {
	const row = await db
		.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE secret_key_hash = ?1`)
		.bind(secretKeyHash)
		.first<ProjectRow>();
	return row ? toProject(row) : null;
}

export type NewKeys = { publicKey?: string; secretKeyHash: string; secretKeyHint: string };

/** Sets a project's keys. Leaves the public key alone when `publicKey` is omitted (secret rotation). */
export async function setProjectKeys(db: D1Database, slug: string, keys: NewKeys): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE projects
			 SET public_key = COALESCE(?2, public_key),
			     secret_key_hash = ?3,
			     secret_key_hint = ?4,
			     keys_created_at = ?5,
			     updated_at = ?5
			 WHERE slug = ?1`,
		)
		.bind(slug, keys.publicKey ?? null, keys.secretKeyHash, keys.secretKeyHint, Date.now())
		.run();
	return result.meta.changes === 1;
}
