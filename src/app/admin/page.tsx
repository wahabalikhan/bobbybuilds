import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Card, Delta, Empty, StatusPill } from "@/components/admin/ui";
import { ColumnChart, Sparkline, StatusBadge, type Status } from "@/components/charts";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { attentionItems, jobHealth, monthlyVisitors, projectSummaries, type JobRun } from "@/lib/db/dashboard";
import { change, formatCount, formatMonth, formatPercent, formatTime, timeAgo } from "@/lib/format";
import { adminHref } from "@/lib/site";

export default async function AdminOverview() {
	const { env } = await getCloudflareContext({ async: true });
	const now = requestTime();
	const today = utcDay(now);
	const [summaries, months, attention, jobs] = await Promise.all([
		projectSummaries(env.DB, today),
		monthlyVisitors(env.DB, today),
		attentionItems(env.DB, now),
		jobHealth(env.DB),
	]);
	const yearTotal = months.reduce((t, m) => t + m.value, 0);

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
				<p className="text-sm text-muted">
					All times and days are UTC. Visitors are counted per day, so someone who visits on two days counts twice.
				</p>
			</div>

			<Card title="Needs attention">
				{attention.length === 0 ? (
					<StatusBadge status="good" label="All good. Nothing needs you right now." />
				) : (
					<ul className="space-y-2">
						{attention.map((item, i) => (
							<li key={i} className="flex flex-wrap items-center gap-2">
								<StatusBadge status={item.level as Status} label={item.level === "critical" ? "Down" : item.level === "serious" ? "Problem" : "Check"} />
								<span className="text-sm">
									{item.projectSlug ? <Link className="underline underline-offset-2" href={adminHref(`/projects/${item.projectSlug}`)}>{item.message}</Link> : item.message}
								</span>
							</li>
						))}
					</ul>
				)}
			</Card>

			<section aria-labelledby="projects-heading">
				<h2 id="projects-heading" className="mb-3 font-semibold tracking-tight">
					Projects <span className="text-muted">({summaries.length})</span>
				</h2>
				<div className="grid gap-4 md:grid-cols-2">
					{summaries.map((s) => {
						const uptime: Status = s.uptime.lastUp === null ? "none" : s.uptime.lastUp ? "good" : "critical";
						return (
							<Link key={s.project.id} href={adminHref(`/projects/${s.project.slug}`)} className="block rounded-2xl border border-line bg-card p-5 transition hover:border-[var(--accent)]">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="font-semibold">{s.project.name}</p>
										<p className="text-sm text-muted">{s.project.tagline}</p>
									</div>
									<StatusPill status={s.project.status} />
								</div>
								<div className="mt-4 flex items-end justify-between gap-4">
									<div>
										<p className="text-sm text-ink-2">Visitors, last 30 days</p>
										<p className="text-3xl font-semibold tracking-tight">{formatCount(s.visitors30)}</p>
										<Delta value={change(s.visitors30, s.visitors30Previous)} period="the 30 days before" />
									</div>
									<Sparkline points={s.sparkline} label={`Visitors per day for the last 30 days, ${formatCount(s.visitors30)} in total`} />
								</div>
								<dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
									<div><dt className="text-muted">Today</dt><dd className="tabular">{formatCount(s.visitorsToday)}</dd></div>
									<div><dt className="text-muted">7 days</dt><dd className="tabular">{formatCount(s.visitors7)}</dd></div>
									<div><dt className="text-muted">Commits this week</dt><dd className="tabular">{s.commitsThisWeek}</dd></div>
									<div><dt className="text-muted">Streak</dt><dd className="tabular">{s.streak.current} wk</dd></div>
								</dl>
								<div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
									<StatusBadge
										status={uptime}
										label={s.uptime.lastUp === null ? "No recent checks" : `${s.uptime.lastUp ? "Up" : "Down"} · ${formatPercent(s.uptime.uptime7, 2)} over 7 days`}
									/>
									{s.headline && (
										<span className="text-ink-2">
											{s.headline.label}: <span className="font-medium text-ink">{s.headline.value === null ? "–" : formatCount(s.headline.value)}{s.headline.unit ? ` ${s.headline.unit}` : ""}</span>{" "}
											<span className="text-muted">({s.headline.period})</span>
										</span>
									)}
								</div>
							</Link>
						);
					})}
				</div>
			</section>

			<Card title="Visitors across all projects" note={`Last 12 months by month: ${formatCount(yearTotal)} in total. This month so far is the last column.`}>
				<ColumnChart
					title="Visitors per month across all projects"
					bars={months.map((m) => ({ label: formatMonth(m.month).slice(0, 3), detail: formatMonth(m.month), value: m.value }))}
				/>
			</Card>

			<Card title="Job health" note="The cron Worker runs the 5-minute job and the 00:10 UTC daily job.">
				<dl className="grid gap-3 text-sm sm:grid-cols-2">
					<JobLine label="5-minute job" run={jobs.lastFrequent} now={now} />
					<JobLine label="Daily job" run={jobs.lastDaily} now={now} />
				</dl>
				{jobs.failures.length > 0 && (
					<div className="mt-4">
						<h3 className="mb-2 text-sm font-medium">Recent failures</h3>
						<ul className="space-y-1 text-sm">
							{jobs.failures.map((run) => (
								<li key={run.id} className="text-ink-2">
									<span className="tabular">{formatTime(run.startedAt)}</span> · {run.task} · <code className="text-xs">{run.summary.slice(0, 160)}</code>
								</li>
							))}
						</ul>
					</div>
				)}
				{!jobs.lastFrequent && !jobs.lastDaily && <Empty>No job runs recorded yet.</Empty>}
			</Card>
		</div>
	);
}

function JobLine({ label, run, now }: { label: string; run: JobRun | null; now: number }) {
	return (
		<div>
			<dt className="text-muted">{label}</dt>
			<dd className="mt-1">
				{run ? (
					<StatusBadge status={run.ok === false ? "critical" : run.ok ? "good" : "none"} label={`${run.ok === false ? "Failed" : run.ok ? "OK" : "Running"} · ${timeAgo(run.startedAt, now)}`} />
				) : (
					<StatusBadge status="none" label="Never run" />
				)}
			</dd>
		</div>
	);
}
