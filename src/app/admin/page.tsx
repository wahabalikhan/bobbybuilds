import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CountMyVisits } from "@/components/admin/count-my-visits";
import { Delta, ProjectLogo, StatusPill } from "@/components/admin/ui";
import { StatusBadge, type Status } from "@/components/charts";
import { WeekSparkline } from "@/components/public/charts";
import { HeadlineCard } from "@/components/public/headline-card";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { monthlyVisitors, projectSummaries, publicProductNumbers, type ProjectSummary } from "@/lib/db/dashboard";
import { change, formatCount, formatPercent } from "@/lib/format";
import { logoFor } from "@/lib/project-logo";
import { productLine } from "@/lib/public/product-line";
import { adminHref, site } from "@/lib/site";

/** Home: the visitors chart, then the projects. Whether everything's OK is the pill in the top bar. */
export default async function AdminHome() {
	const { env } = await getCloudflareContext({ async: true });
	const today = utcDay(requestTime());
	const summaries = await projectSummaries(env.DB, today);
	const chart = await Promise.all(
		summaries.map(async (s) => ({ slug: s.project.slug, name: s.project.name, logoPath: logoFor(s.project), monthly: await monthlyVisitors(env.DB, today, s.project.id) })),
	);
	const main = summaries.filter((s) => s.project.status === "live" || s.project.status === "building");
	// "Don't count my visits": a one-time link for each site other than this one.
	const otherSites = summaries.flatMap((s) => {
		const origin = s.project.siteUrl ? new URL(s.project.siteUrl).origin : null;
		return origin && origin !== site.url ? [{ name: s.project.name, origin }] : [];
	});
	const lines = new Map(await Promise.all(main.map(async (s) => [s.project.id, productLine(await publicProductNumbers(env.DB, s.project.id, today), today)] as const)));

	return (
		<div className="space-y-10">
			{chart.length > 0 && <HeadlineCard projects={chart} />}

			<section aria-labelledby="projects-heading">
				<div className="mb-6 flex items-center justify-between gap-3 border-b border-line pb-3.5">
					<h2 id="projects-heading" className="text-[15px] font-medium tracking-tight">
						My projects <span className="font-normal text-muted">({main.length})</span>
					</h2>
					<Link
						href={adminHref("/projects/new")}
						aria-label="New project"
						title="New project"
						className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-lg leading-none text-ink hover:bg-pill"
					>
						<span aria-hidden>+</span>
					</Link>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					{main.map((s) => (
						<ProjectCard key={s.project.id} summary={s} numbers={lines.get(s.project.id) ?? null} />
					))}
				</div>
			</section>

			<CountMyVisits sites={otherSites} />

			<p className="text-xs text-muted">
				Raw page views, events, uptime checks and job runs are deleted after 90 days. Daily totals are kept. No cookies, and no IP addresses, names or emails are stored.
			</p>
		</div>
	);
}

/** Visitors and change, the public numbers, a sparkline and uptime. Opens the project. */
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
				<span className="flex shrink-0 items-center gap-2">
					{!s.project.showPublic && <span className="text-xs text-muted">Not on public page</span>}
					<StatusPill status={s.project.status} />
				</span>
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
			<div className="mt-4 text-xs text-muted [&_span]:text-xs" title={s.uptime.uptime7 === null ? undefined : `${formatPercent(s.uptime.uptime7, 2)} up over 7 days`}>
				<StatusBadge status={uptime} label={s.uptime.lastUp === null ? "Not checked yet" : s.uptime.lastUp ? "Up" : "Down"} />
			</div>
		</Link>
	);
}
