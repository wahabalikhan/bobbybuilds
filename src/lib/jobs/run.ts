import { addDays, utcDay, weekStart } from "@/lib/days";
import { sha256Hex } from "@/lib/keys";
import { type Fetch, syncGithubWeekly } from "./github";
import { cleanUp, rotateDailySecret } from "./maintenance";
import { rollupDay } from "./rollup";
import { pingAll } from "./uptime";

/**
 * The two scheduled tasks, triggered by the cron Worker (cron/):
 * - frequent (every 5 minutes): uptime pings; today's roll-up every 15 minutes
 * - daily (00:10 UTC): finalise yesterday's roll-up, refresh today's, rotate the daily
 *   secret, 90-day clean-up, GitHub weekly commits
 */

export const TASKS = ["daily", "frequent"] as const;
export type JobTask = (typeof TASKS)[number];

export type JobDeps = { db: D1Database; fetch: Fetch; githubToken?: string; now?: () => number };
export type JobResult = { ok: boolean; task: JobTask; summary: Record<string, unknown> };

async function frequent(deps: JobDeps, at: number) {
	const uptime = await pingAll(deps.db, deps.fetch, at);
	const summary: Record<string, unknown> = {
		uptime: uptime.map((check) => ({ project: check.projectId, up: check.up, ms: check.responseMs, status: check.statusCode })),
	};
	if (new Date(at).getUTCMinutes() % 15 === 0) summary.rollup = await rollupDay(deps.db, utcDay(at), at);
	return summary;
}

async function daily(deps: JobDeps, at: number) {
	const today = utcDay(at);
	return {
		rollups: [await rollupDay(deps.db, addDays(today, -1), at), await rollupDay(deps.db, today, at)],
		secret: await rotateDailySecret(deps.db, today),
		cleanup: await cleanUp(deps.db, today),
		github: await syncGithubWeekly(deps.db, deps.fetch, weekStart(today), deps.githubToken, at),
	};
}

/** Runs a task and records it in job_runs. Never throws: failures come back as ok: false. */
export async function runTask(task: JobTask, deps: JobDeps, scheduledTime?: number): Promise<JobResult> {
	const startedAt = deps.now?.() ?? Date.now();
	const at = scheduledTime ?? startedAt;
	const run = await deps.db
		.prepare("INSERT INTO job_runs (task, started_at) VALUES (?1, ?2) RETURNING id")
		.bind(task, startedAt)
		.first<{ id: number }>();

	let result: JobResult;
	try {
		result = { ok: true, task, summary: task === "daily" ? await daily(deps, at) : await frequent(deps, at) };
	} catch (error) {
		result = { ok: false, task, summary: { error: error instanceof Error ? error.message : "Unknown error" } };
	}

	let summary = JSON.stringify(result.summary);
	if (summary.length > 8000) summary = JSON.stringify({ truncated: true, ok: result.ok });
	await deps.db
		.prepare("UPDATE job_runs SET finished_at = ?2, ok = ?3, summary = ?4 WHERE id = ?1")
		.bind(run!.id, Math.max(startedAt, deps.now?.() ?? Date.now()), result.ok ? 1 : 0, summary)
		.run();
	return result;
}

/** Compares secrets in constant time (hashing first makes the lengths equal). */
async function secretsMatch(given: string, expected: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
	// Workers-only API; the DOM types in tsconfig hide it.
	const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean };
	return subtle.timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

const notFound = () => new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * POST /internal/jobs with Authorization: Bearer <ROLLUP_SECRET> and { task, scheduledTime? }.
 * Anything without the right secret gets a plain 404, so the route stays hidden.
 */
export async function handleJobRequest(request: Request, deps: JobDeps & { secret: string | undefined }): Promise<Response> {
	if (request.method !== "POST" || !deps.secret) return notFound();
	const token = /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "")?.[1];
	if (!token || !(await secretsMatch(token, deps.secret))) return notFound();

	let body: { task?: unknown; scheduledTime?: unknown };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Body must be JSON." }, { status: 400 });
	}
	if (!TASKS.includes(body.task as JobTask)) return Response.json({ error: 'task must be "daily" or "frequent".' }, { status: 400 });

	const now = deps.now?.() ?? Date.now();
	const scheduledTime = body.scheduledTime;
	if (scheduledTime !== undefined && (typeof scheduledTime !== "number" || Math.abs(scheduledTime - now) > 86_400_000)) {
		return Response.json({ error: "scheduledTime must be within a day of now." }, { status: 400 });
	}

	const result = await runTask(body.task as JobTask, deps, scheduledTime as number | undefined);
	return Response.json(result, { status: result.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
