/**
 * Triggers HQ's scheduled tasks. All the logic lives in the main app (src/lib/jobs/).
 */

export type CronEnv = { HQ: Fetcher; ROLLUP_SECRET: string };

export const SCHEDULES: Record<string, "daily" | "frequent"> = {
	"*/5 * * * *": "frequent",
	"10 0 * * *": "daily",
};

export async function trigger(cron: string, scheduledTime: number, env: CronEnv): Promise<void> {
	const task = SCHEDULES[cron];
	if (!task) throw new Error(`No task for cron "${cron}"`);
	if (!env.ROLLUP_SECRET) throw new Error("ROLLUP_SECRET isn't set on bobbybuilds-cron");

	// The host is ignored by the service binding; only the path matters.
	const response = await env.HQ.fetch("https://bobbybuilds.internal/internal/jobs", {
		method: "POST",
		headers: { Authorization: `Bearer ${env.ROLLUP_SECRET}`, "Content-Type": "application/json" },
		body: JSON.stringify({ task, scheduledTime }),
	});
	const text = await response.text();
	if (!response.ok) throw new Error(`HQ ${task} task failed (${response.status}): ${text.slice(0, 500)}`);
	console.log(`HQ ${task} task done: ${text.slice(0, 500)}`);
}

export default {
	async scheduled(controller: ScheduledController, env: CronEnv): Promise<void> {
		await trigger(controller.cron, controller.scheduledTime, env);
	},
	async fetch(): Promise<Response> {
		return new Response("Not found.", { status: 404 });
	},
} satisfies ExportedHandler<CronEnv>;
