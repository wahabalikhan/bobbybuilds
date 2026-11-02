import { utcDay } from "@/lib/days";
import { randomHex, sha256Hex } from "@/lib/keys";

/**
 * Daily visitor ID = SHA-256(today's secret | IP | user agent | project).
 * The secret is replaced every day and the old one deleted (Phase 4), so yesterday's IDs can't
 * be recreated or linked to today's. IPs and user agents are only ever inputs to the hash.
 */

const secretCache = new Map<string, string>();

/** Today's secret. Created on first use if the daily job hasn't made it yet. */
export async function getDailySecret(db: D1Database, day: string): Promise<string> {
	const cached = secretCache.get(day);
	if (cached) return cached;

	await db.prepare("INSERT OR IGNORE INTO daily_secret (day, secret) VALUES (?1, ?2)").bind(day, randomHex(32)).run();
	const row = await db.prepare("SELECT secret FROM daily_secret WHERE day = ?1").bind(day).first<{ secret: string }>();
	if (!row) throw new Error("Daily secret missing after insert");

	secretCache.clear(); // only ever keep today's
	secretCache.set(day, row.secret);
	return row.secret;
}

/** Test helper: forget cached secrets. */
export function clearSecretCache(): void {
	secretCache.clear();
}

export async function visitorId(secret: string, ip: string, ua: string, projectId: number): Promise<string> {
	return sha256Hex(`${secret}|${ip}|${ua}|${projectId}`);
}

/** Rate-limit key: a hash, so the limiter never sees a raw IP. */
export async function rateLimitKey(secret: string, ip: string, projectId: number): Promise<string> {
	return `${projectId}:${(await sha256Hex(`${secret}|rl|${ip}`)).slice(0, 32)}`;
}

export function today(now: () => number = Date.now): string {
	return utcDay(now());
}
