import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { Card, Delta, Pill, ProjectLogo, SectionHeading, StatusPill } from "@/components/admin/ui";
import { ColumnChart, Sparkline, StatusBadge, type Status } from "@/components/charts";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { attentionItems, jobHealth, monthlyVisitors, projectSummaries, type JobRun, type ProjectSummary } from "@/lib/db/dashboard";
import { change, formatCount, formatMonth, formatPercent, formatTime, formatWhole, timeAgo } from "@/lib/format";
import { adminHref } from "@/lib/site";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const { env } = await getCloudflareContext({ async: true });
	const now = requestTime();
	const today = utcDay(now);
	const params = await searchParams;
	const summaries = await projectSummaries(env.DB, today);
	const chosen = summaries.find((s) => s.project.slug === params.project)?.project ?? null;
	const [months, attention, jobs] = await Promise.all([monthlyVisitors(env.DB, today, chosen?.id), attentionItems(env.DB, now), jobHealth(env.DB)]);
	const yearTotal = months.reduce((t, m) => t + m.value, 0);

	const main = summaries.filter((s) => s.project.status === "live" || s.project.status === "building");
	const minor = summaries.filter((s) => s.project.status === "idea" || s.project.status === "retired");

	return (
		<div className="space-y-12">
			<section aria-label="Visitors in the last 12 months" className="rounded-2xl border border-line bg-card p-5">
				<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
					<p className="text-ink-2">
						<span className="text-[28px] font-bold tracking-tight text-ink">{formatWhole(yearTotal)}</span> visitors in 12 months
						{chosen && <span className="text-muted"> · {chosen.name}</span>}
					</p>
					<AutoSubmitSelect
						name="project"
						label="Show visitors for"
						value={chosen?.slug ?? ""}
						options={[{ value: "", label: `All projects (${summaries.length})` }, ...summaries.map((s) => ({ value: s.project.slug, label: s.project.name }))]}
					/>
				</div>
				<ColumnChart
					title={`Visitors per month${chosen ? ` for ${chosen.name}` : " across all projects"}`}
					bars={months.map((m) => ({ label: formatMonth(m.month).slice(0, 3), detail: formatMonth(m.month), value: m.value }))}
					unfinishedLast
					height={220}
				/>
				<p className="mt-1 text-xs text-muted">Visitors are counted per day (UTC), so someone who visits on two days counts twice. This month so far is the lighter bar.</p>
			</section>

			{attention.length > 0 && (
				<section aria-labelledby="attention-heading">
					<SectionHeading id="attention-heading" aside={attention.length}>Needs attention</SectionHeading>
					<ul className="space-y-2">
						{attention.map((item, i) => (
							<li key={i} className="flex flex-wrap items-center gap-2 text-sm">
								<StatusBadge status={item.level as Status} label={item.level === "critical" ? "Down" : item.level === "serious" ? "Problem" : "Check"} />
								{item.projectSlug ? (
									<Link className="underline decoration-line underline-offset-4 hover:decoration-ink" href={adminHref(`/projects/${item.projectSlug}`)}>
										{item.message}
									</Link>
								) : (
									<span>{item.message}</span>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			<section aria-labelledby="projects-heading">
				<SectionHeading id="projects-heading" aside={main.length}>My projects</SectionHeading>
				<div className="grid gap-4 md:grid-cols-2">
					{main.map((s) => (
						<ProjectCard key={s.project.id} summary={s} />
					))}
				</div>
			</section>

			{minor.length > 0 && (
				<section aria-labelledby="minor-heading">
					<SectionHeading id="minor-heading" aside={minor.length}>Ideas and retired</SectionHeading>
					<ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
						{minor.map((s) => (
							<li key={s.project.id}>
								<Link href={adminHref(`/projects/${s.project.slug}`)} className="group flex gap-3">
									<ProjectLogo name={s.project.name} logoPath={s.project.logoPath} size={24} />
									<span>
										<span className="flex items-center gap-2 font-medium group-hover:underline">
											{s.project.name}
											<Pill>{s.project.status === "retired" ? "Retired" : "Idea"}</Pill>
										</span>
										<span className="mt-0.5 block text-sm text-muted">{s.project.tagline}</span>
										{s.project.lesson && <span className="mt-0.5 block text-sm text-ink-2">Lesson: {s.project.lesson}</span>}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}

			<section aria-labelledby="jobs-heading">
				<SectionHeading id="jobs-heading" aside="00:10 UTC daily · every 5 minutes">Job health</SectionHeading>
				<div className="grid gap-4 sm:grid-cols-2">
					<JobCard label="5-minute job" detail="Uptime pings and today's roll-up" run={jobs.lastFrequent} now={now} />
					<JobCard label="Daily job" detail="Roll-ups, secret rotation, clean-up, GitHub" run={jobs.lastDaily} now={now} />
				</div>
				{jobs.failures.length > 0 && (
					<Card className="mt-4" title="Recent failures">
						<ul className="space-y-1 text-sm">
							{jobs.failures.map((run) => (
								<li key={run.id} className="text-ink-2">
									<span className="tabular">{formatTime(run.startedAt)}</span> · {run.task} · <code className="text-xs">{run.summary.slice(0, 160)}</code>
								</li>
							))}
						</ul>
					</Card>
				)}
			</section>
		</div>
	);
}

function headlinePill(s: ProjectSummary): string | null {
	if (!s.headline || s.headline.value === null) return null;
	return `${formatCount(s.headline.value)} ${s.headline.unit || s.headline.label.toLowerCase()}`;
}

function ProjectCard({ summary: s }: { summary: ProjectSummary }) {
	const pill = headlinePill(s);
	const uptime: Status = s.uptime.lastUp === null ? "none" : s.uptime.lastUp ? "good" : "critical";
	return (
		<Link href={adminHref(`/projects/${s.project.slug}`)} className="block rounded-2xl border border-line bg-card p-5 transition-colors hover:border-[var(--axis)]">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<ProjectLogo name={s.project.name} logoPath={s.project.logoPath} />
					<span className="truncate font-semibold">{s.project.name}</span>
					<StatusPill status={s.project.status} />
				</div>
				{pill && <Pill title={`${s.headline!.label}, ${s.headline!.period}`}>{pill}</Pill>}
			</div>
			<p className="mt-2 text-sm text-ink-2">{s.project.tagline}</p>
			<div className="mt-5">
				<Sparkline
					points={s.weekly}
					unfinishedLast
					label={`Visitors per week for the last 12 weeks, ${formatCount(s.weekly.reduce((t, w) => t + w.value, 0))} in total. This week so far is dashed.`}
				/>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
				<span className="flex items-center gap-1.5">
					<span>
						<span className="font-medium text-ink">{formatCount(s.visitors30)}</span> visitors in 30 days
					</span>
					<span className="[&>span]:text-xs">
						<Delta value={change(s.visitors30, s.visitors30Previous)} />
					</span>
				</span>
				<span className="flex items-center gap-3 [&_span]:text-xs" title={s.uptime.uptime7 === null ? undefined : `${formatPercent(s.uptime.uptime7, 2)} up over 7 days`}>
					<StatusBadge status={uptime} label={s.uptime.lastUp === null ? "Not checked" : s.uptime.lastUp ? "Up" : "Down"} />
					<span>
						<span className="font-medium text-ink">{s.streak.current} wk</span> streak
					</span>
				</span>
			</div>
		</Link>
	);
}

function JobCard({ label, detail, run, now }: { label: string; detail: string; run: JobRun | null; now: number }) {
	return (
		<div className="rounded-2xl border border-line bg-card p-4">
			<p className="font-medium">{label}</p>
			<p className="text-sm text-muted">{detail}</p>
			<div className="mt-2">
				{run ? (
					<StatusBadge status={run.ok === false ? "critical" : run.ok ? "good" : "none"} label={`${run.ok === false ? "Failed" : run.ok ? "OK" : "Running"} · ${timeAgo(run.startedAt, now)}`} />
				) : (
					<StatusBadge status="none" label="Never run" />
				)}
			</div>
		</div>
	);
}
