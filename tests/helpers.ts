import { env } from "cloudflare:test";
import { expect } from "vitest";

export const db = env.DB;

const HEX64 = "a".repeat(64);
export const VISITOR_ID = HEX64;

let counter = 0;

/** Inserts a valid project with a unique slug and returns its id. */
export async function createProject(overrides: Record<string, unknown> = {}): Promise<number> {
	counter += 1;
	const values: Record<string, unknown> = { slug: `test-${counter}-${Date.now()}`, name: "Test", status: "live", ...overrides };
	const columns = Object.keys(values);
	const row = await db
		.prepare(
			`INSERT INTO projects (${columns.join(", ")}) VALUES (${columns.map((_, i) => `?${i + 1}`).join(", ")}) RETURNING id`,
		)
		.bind(...Object.values(values))
		.first<{ id: number }>();
	return row!.id;
}

/** Inserts one row; column names come from the test itself, values are always bound. */
export function insert(table: string, values: Record<string, unknown>) {
	const columns = Object.keys(values);
	return db
		.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `?${i + 1}`).join(", ")})`)
		.bind(...Object.values(values))
		.run();
}

export async function expectRejected(promise: Promise<unknown>, reason: RegExp = /CHECK constraint failed/) {
	await expect(promise).rejects.toThrow(reason);
}

export function validPageView(projectId: number, overrides: Record<string, unknown> = {}) {
	return {
		project_id: projectId,
		ts: Date.UTC(2026, 10, 2, 12),
		day: "2026-11-02",
		visitor_id: VISITOR_ID,
		path: "/case-studies/hiring",
		referrer_domain: "linkedin.com",
		ref: "linkedin-post-3",
		utm_source: "linkedin",
		utm_medium: "social",
		utm_campaign: "launch_week",
		country: "GB",
		device: "desktop",
		browser: "chrome",
		os: "macos",
		screen: "large",
		language: "en",
		engaged_ms: 42_000,
		scroll_pct: 80,
		...overrides,
	};
}
