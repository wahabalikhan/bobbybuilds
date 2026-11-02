import { setProjectKeys } from "@/lib/db/projects";
import type { CollectorDeps } from "@/lib/collector/http";
import { createPublicKey, createSecretKey, hashSecretKey, secretKeyHint } from "@/lib/keys";
import { createProject, db } from "../helpers";

export const IP = "203.0.113.7";
export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
export const UA_IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
export const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
export const ORIGIN = "https://example.com";

export type KeyedProject = { id: number; slug: string; publicKey: string; secretKey: string };

let counter = 0;

/** A project with keys, registered origins and a browser event allowlist. */
export async function keyedProject(overrides: Record<string, unknown> = {}): Promise<KeyedProject> {
	counter += 1;
	const slug = `collector-${counter}-${crypto.randomUUID().slice(0, 8)}`;
	const id = await createProject({
		slug,
		allowed_origins: JSON.stringify([ORIGIN, "https://www.example.com"]),
		browser_events: '["case_study_read","contact_click","comment_posted"]',
		...overrides,
	});
	const publicKey = createPublicKey();
	const secretKey = createSecretKey();
	await setProjectKeys(db, slug, { publicKey, secretKeyHash: await hashSecretKey(secretKey), secretKeyHint: secretKeyHint(secretKey) });
	return { id, slug, publicKey, secretKey };
}

export function fakeLimiter(allow = true) {
	const keys: string[] = [];
	return {
		keys,
		async limit({ key }: { key: string }) {
			keys.push(key);
			return { success: allow };
		},
	};
}

export function testDeps(overrides: Partial<CollectorDeps> = {}): CollectorDeps {
	return { db, limiter: fakeLimiter(), country: "GB", now: () => NOW, ...overrides };
}

type RequestOptions = { origin?: string | null; headers?: Record<string, string>; rawBody?: string };

export function browserRequest(path: string, body: unknown, { origin = ORIGIN, headers = {}, rawBody }: RequestOptions = {}) {
	const allHeaders: Record<string, string> = {
		"Content-Type": "text/plain",
		"CF-Connecting-IP": IP,
		"User-Agent": UA,
		...headers,
	};
	if (origin) allHeaders.Origin = origin;
	return new Request(`https://bobby.test${path}`, { method: "POST", headers: allHeaders, body: rawBody ?? JSON.stringify(body) });
}

export function serverRequest(path: string, body: unknown, secretKey: string, headers: Record<string, string> = {}) {
	return new Request(`https://bobby.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${secretKey}`, ...headers },
		body: JSON.stringify(body),
	});
}

export async function count(table: string, projectId: number): Promise<number> {
	const row = await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE project_id = ?1`).bind(projectId).first<{ n: number }>();
	return row?.n ?? 0;
}

export async function rows<T = Record<string, unknown>>(table: string, projectId: number): Promise<T[]> {
	const { results } = await db.prepare(`SELECT * FROM ${table} WHERE project_id = ?1 ORDER BY id`).bind(projectId).all<T>();
	return results;
}
