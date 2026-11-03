import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Delta, ProjectLogo, SectionHeading, StatusPill } from "@/components/admin/ui";
import { StatusBadge, type Status } from "@/components/charts";
import { WeekSparkline } from "@/components/public/charts";
import { HeadlineCard } from "@/components/public/headline-card";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { attentionItems, monthlyVisitors, projectSummaries, publicProductNumbers, type Attention, type ProjectSummary } from "@/lib/db/dashboard";
import { change, formatCount, formatPercent } from "@/lib/format";
import { logoFor } from "@/lib/project-logo";
import { productLine } from "@/lib/public/product-line";
import { adminHref } from "@/lib/site";

/**
 * Home: is everything OK (Needs attention), how are the projects doing (visitors chart and
 * project cards). Test projects (loopback-only, like Playground) are left out.
 */
export default async function AdminHome() {
	const { env } = await getCloudflareContext({ async: true });
	const now = requestTime();
	const today = utcDay(now);
	const [summaries, attention] = await Promise.all([projectSummaries(env.DB, today), attentionItems(env.DB, now)]);
	const chart = await Promise.all(
		summaries.map(async (s) => ({ slug: s.project.slug, name: s.project.name, logoPath: logoFor(s.project), monthly: await monthlyVisitors(env.DB, today, s.project.id) })),
	);
	const main = summaries.filter((s) => s.project.status === "live" || s.project.status === "building");
	const lines = new Map(await Promise.all(main.map(async (s) => [s.project.id, productLine(await publicProductNumbers(env.DB, s.project.id, today), today)] as const)));

	return (
		<div className="space-y-12">
			<NeedsAttention items={attention} />

			{chart.length > 0 && <HeadlineCard projects={chart} />}

			<section aria-labelledby="projects-heading">
				<SectionHeading id="projects-heading" aside={main.length} relaxed>
					My projects
				</SectionHeading>
				<div className="grid gap-4 md:grid-cols-2">
					{main.map((s) => (
						<ProjectCard key={s.project.id} summary={s} numbers={lines.get(s.project.id) ?? null} />
					))}
				</div>
			</section>
		</div>
	);
}

const LABEL: Record<Attention["level"], string> = { critical: "Down", serious: "Problem", warning: "Check" };

/** Only shown when something's wrong; otherwise one quiet line. */
function NeedsAttention({ items }: { items: Attention[] }) {
	if (items.length === 0) {
		return (
			<p role="status" className="flex items-center gap-2 text-sm text-ink-2">
				<StatusBadge status="good" label="Everything's running normally." />
			</p>
		);
	}
	return (
		<section aria-labelledby="attention-heading" className="rounded-2xl border border-line bg-card p-5">
			<h2 id="attention-heading" className="mb-3 text-[15px] font-medium tracking-tight">
				Needs attention <span className="font-normal text-muted">{items.length}</span>
			</h2>
			<ul className="space-y-2">
				{items.map((item, i) => (
					<li key={i} className="flex flex-wrap items-center gap-2 text-sm">
						<StatusBadge status={item.level as Status} label={LABEL[item.level]} />
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
	);
}

/** Visitors and change, sparkline, uptime and the public numbers, with commits as a small detail. Opens the dashboard. */
function ProjectCard({ summary: s, numbers }: { summary: ProjectSummary; numbers: string | null }) {
	const uptime: Status = s.uptime.lastUp === null ? "none" : s.uptime.lastUp ? "good" : "critical";
	const project = { slug: s.project.slug, name: s.project.name, logoPath: logoFor(s.project) };
	return (
		<Link href={adminHref(`/projects/${s.project.slug}`)} className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition-colors hover:border-[var(--axis)]">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<ProjectLogo name={project.name} logoPath={project.logoPath} />
					<span className="font-semibold group-hover:underline">{project.name}</span>
				</div>
				<StatusPill status={s.project.status} />
			</div>
			<p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-sm text-ink-2">
				<span className="text-xl font-semibold tracking-tight tabular text-ink">{formatCount(s.visitors30)}</span>
				visitors in 30 days
				<span className="[&>span]:text-xs">
					<Delta value={change(s.visitors30, s.visitors30Previous)} />
				</span>
			</p>
			{numbers && <p className="mt-1 text-sm font-medium tabular text-ink">{numbers}</p>}
			<div className="mt-auto pt-5">
				<WeekSparkline
					project={project}
					weeks={s.weekly}
					label={`Visitors per week for the last 12 weeks, ${formatCount(s.weekly.reduce((t, w) => t + w.value, 0))} in total. This week so far is dashed.`}
				/>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-muted">
				<span title={s.uptime.uptime7 === null ? undefined : `${formatPercent(s.uptime.uptime7, 2)} up over 7 days`} className="[&_span]:text-xs">
					<StatusBadge status={uptime} label={s.uptime.lastUp === null ? "Not checked" : s.uptime.lastUp ? "Up" : "Down"} />
				</span>
				<span>
					{formatCount(s.commitsThisWeek)} commit{s.commitsThisWeek === 1 ? "" : "s"} this week
				</span>
			</div>
		</Link>
	);
}
