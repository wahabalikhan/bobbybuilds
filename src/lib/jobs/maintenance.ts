import { addDays } from "@/lib/days";
import { randomHex } from "@/lib/keys";

/** Raw data older than this many days is deleted. Roll-ups are kept. */
export const RETENTION_DAYS = 90;

const CHUNK = 5000;

/**
 * Makes sure today's secret exists, then deletes every other one. After this, visitor IDs
 * from earlier days can never be recreated or linked to today's.
 */
export async function rotateDailySecret(db: D1Database, today: string): Promise<{ deleted: number }> {
	const [, deleted] = await db.batch([
		db.prepare("INSERT OR IGNORE INTO daily_secret (day, secret) VALUES (?1, ?2)").bind(today, randomHex(32)),
		db.prepare("DELETE FROM daily_secret WHERE day <> ?1").bind(today),
	]);
	return { deleted: deleted.meta.changes };
}

/** Deletes in chunks so a big backlog never becomes one huge statement. */
async function deleteInChunks(db: D1Database, table: string, where: string, value: string | number): Promise<number> {
	let total = 0;
	for (;;) {
		const result = await db
			.prepare(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE ${where} LIMIT ${CHUNK})`)
			.bind(value)
			.run();
		total += result.meta.changes;
		if (result.meta.changes < CHUNK) return total;
	}
}

export type CleanupSummary = { before: string; pageViews: number; events: number; uptimeChecks: number; jobRuns: number };

/**
 * Keeps the last 90 days of raw data: a row from exactly 90 days ago stays, 91 days ago goes.
 */
export async function cleanUp(db: D1Database, today: string): Promise<CleanupSummary> {
	const before = addDays(today, -RETENTION_DAYS);
	const beforeMs = Date.parse(`${before}T00:00:00Z`);
	return {
		before,
		pageViews: await deleteInChunks(db, "page_views", "day < ?1", before),
		events: await deleteInChunks(db, "events", "day < ?1", before),
		uptimeChecks: await deleteInChunks(db, "uptime_checks", "checked_at < ?1", beforeMs),
		jobRuns: await deleteInChunks(db, "job_runs", "started_at < ?1", beforeMs),
	};
}
