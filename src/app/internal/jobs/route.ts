import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleJobRequest } from "@/lib/jobs/run";

// Called by the cron Worker (cron/) through a service binding. Logic: src/lib/jobs/run.ts.
export async function POST(request: Request) {
	const { env } = await getCloudflareContext({ async: true });
	return handleJobRequest(request, {
		db: env.DB,
		fetch: (input, init) => fetch(input, init),
		secret: env.ROLLUP_SECRET,
		githubToken: env.GITHUB_TOKEN,
		kv: env.PUBLIC_CACHE,
	});
}
