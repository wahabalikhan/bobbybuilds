/**
 * Project queries. Every query uses bound parameters.
 * JSON columns are parsed here so callers get plain arrays.
 */

export type ProjectStatus = "live" | "building" | "idea" | "retired";

export type ProjectLink = { label: string; url: string };

export type Project = {
	id: number;
	slug: string;
	name: string;
	tagline: string;
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
	publicKey: string | null;
	secretKeyHint: string | null;
	sortOrder: number;
};

type ProjectRow = {
	id: number;
	slug: string;
	name: string;
	tagline: string;
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
	public_key: string | null;
	secret_key_hint: string | null;
	sort_order: number;
};

// secret_key_hash is deliberately never selected into a Project.
const PROJECT_COLUMNS = `id, slug, name, tagline, description_md, status, lesson, logo_path, site_url, health_url,
	github_repo, links, allowed_origins, browser_events, public_key, secret_key_hint, sort_order`;

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
		descriptionMd: row.description_md,
		status: row.status,
		lesson: row.lesson,
		logoPath: row.logo_path,
		siteUrl: row.site_url,
		healthUrl: row.health_url,
		githubRepo: row.github_repo,
		links: parseJsonArray<ProjectLink>(row.links),
		allowedOrigins: parseJsonArray<string>(row.allowed_origins),
		browserEvents: parseJsonArray<string>(row.browser_events),
		publicKey: row.public_key,
		secretKeyHint: row.secret_key_hint,
		sortOrder: row.sort_order,
	};
}

export async function listProjects(db: D1Database): Promise<Project[]> {
	const { results } = await db
		.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY sort_order, id`)
		.all<ProjectRow>();
	return results.map(toProject);
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
