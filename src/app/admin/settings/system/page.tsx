import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Card, SectionHeading } from "@/components/admin/ui";
import { StatusBadge } from "@/components/charts";
import { formatTime } from "@/lib/format";
import { RETENTION_DAYS } from "@/lib/jobs/maintenance";
import { adminHref, site } from "@/lib/site";

async function size(assets: Fetcher | undefined, path: string): Promise<string> {
	if (!assets) return "–";
	try {
		const response = await assets.fetch(new Request(`${site.url}${path}`));
		if (!response.ok) return "not built";
		const bytes = (await response.arrayBuffer()).byteLength;
		return `${(bytes / 1024).toFixed(1)} KB`;
	} catch {
		return "–";
	}
}

export default async function System() {
	const { env } = await getCloudflareContext({ async: true });
	const [runs, tracker, vitals] = await Promise.all([
		env.DB.prepare("SELECT id, task, started_at, finished_at, ok, summary FROM job_runs ORDER BY started_at DESC LIMIT 40").all<{
			id: number;
			task: string;
			started_at: number;
			finished_at: number | null;
			ok: number | null;
			summary: string;
		}>(),
		size(env.ASSETS, "/t.js"),
		size(env.ASSETS, "/t-vitals.js"),
	]);

	return (
		<div className="max-w-3xl space-y-10">
			<div>
				<Link href={adminHref("/settings")} className="text-sm text-muted hover:text-ink">
					← Settings
				</Link>
				<h1 className="mt-2 text-2xl font-semibold tracking-tight">System</h1>
			</div>

			<section>
				<SectionHeading>Data kept</SectionHeading>
				<ul className="space-y-1 text-sm text-ink-2">
					<li>Raw page views, events, uptime checks and job runs: the last {RETENTION_DAYS} days.</li>
					<li>Daily roll-ups (visitors, pages, referrers, campaigns, countries, events, uptime, Core Web Vitals): kept for good.</li>
					<li>Daily visitor secret: today&rsquo;s only. Yesterday&rsquo;s is deleted at 00:10 UTC.</li>
					<li>No cookies, IP addresses, names or emails are stored.</li>
				</ul>
			</section>

			<section>
				<SectionHeading>Tracker</SectionHeading>
				<div className="grid gap-4 sm:grid-cols-2">
					<Card title="t.js">
						<p className="text-2xl font-semibold tracking-tight">{tracker}</p>
						<p className="text-sm text-muted">Loaded by every connected site.</p>
					</Card>
					<Card title="t-vitals.js">
						<p className="text-2xl font-semibold tracking-tight">{vitals}</p>
						<p className="text-sm text-muted">Core Web Vitals, loaded after the page.</p>
					</Card>
				</div>
			</section>

			<section>
				<SectionHeading aside={`last ${runs.results.length}`}>Job runs</SectionHeading>
				<ul className="divide-y divide-line rounded-2xl border border-line bg-card">
					{runs.results.map((run) => (
						<li key={run.id} className="px-5 py-3">
							<details>
								<summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
									<StatusBadge status={run.ok === 0 ? "critical" : run.ok === 1 ? "good" : "none"} label={run.ok === 0 ? "Failed" : run.ok === 1 ? "OK" : "Running"} />
									<span className="font-medium">{run.task === "daily" ? "Daily job" : "5-minute job"}</span>
									<span className="tabular text-muted">{formatTime(run.started_at)}</span>
									{run.finished_at && <span className="text-muted">{((run.finished_at - run.started_at) / 1000).toFixed(1)} s</span>}
								</summary>
								<pre className="mt-2 overflow-x-auto rounded-xl bg-surface p-3 text-xs">{JSON.stringify(JSON.parse(run.summary || "{}"), null, 2)}</pre>
							</details>
						</li>
					))}
					{runs.results.length === 0 && <li className="px-5 py-4 text-sm text-muted">No job runs yet.</li>}
				</ul>
			</section>
		</div>
	);
}
