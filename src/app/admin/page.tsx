import Link from "next/link";
import { StatusDot } from "@/components/status-dot";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CountMyVisits } from "@/components/admin/count-my-visits";
import { Delta, ProjectLogo } from "@/components/admin/ui";
import { StatusBadge, type Status } from "@/components/charts";
import { ArrowRightIcon } from "@/components/public/icons";
import { WeekChart } from "@/components/public/mono-charts";
import { HeadlineCard } from "@/components/public/headline-card";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { monthlyVisitors, projectSummaries, publicProductNumbers, type ProjectSummary } from "@/lib/db/dashboard";
import { listMonth } from "@/lib/db/money";
import { getProfile } from "@/lib/db/profile";
import { listJourney } from "@/lib/db/settings";
import { change, formatCount, formatMonth, formatPence, formatPercent } from "@/lib/format";
import { logoFor } from "@/lib/project-logo";
import { productLine } from "@/lib/public/product-line";
import { CARD_HEIGHT } from "@/lib/layout";
import { adminHref, site } from "@/lib/site";

/** Home: the visitors chart, then the projects. Whether everything's OK is the pill in the top bar. */
export default async function AdminHome() {
	const { env } = await getCloudflareContext({ async: true });
	const today = utcDay(requestTime());
	const summaries = await projectSummaries(env.DB, today);
	const chart = await Promise.all(
		summaries.map(async (s) => ({ slug: s.project.slug, name: s.project.name, logoPath: logoFor(s.project), monthly: await monthlyVisitors(env.DB, today, s.project.id) })),
	);
	const main = summaries.filter((s) => ["live", "building", "paused"].includes(s.project.status));
	// "Don't count my visits": a one-time link for each site other than this one.
	const otherSites = summaries.flatMap((s) => {
		const origin = s.project.siteUrl ? new URL(s.project.siteUrl).origin : null;
		return origin && origin !== site.url ? [{ name: s.project.name, origin }] : [];
	});
	const [profile, journey, money] = await Promise.all([getProfile(env.DB), listJourney(env.DB), listMonth(env.DB, today.slice(0, 7))]);
	const published = journey.filter((e) => e.isPublished).length;
	const sum = (kind: "cost" | "revenue") => money.filter((r) => r.kind === kind).reduce((t, r) => t + r.amountPence, 0);
	const publicPage = [
		{ href: adminHref("/settings/profile"), label: "Profile", detail: [profile.buildingSince ? `building since ${profile.buildingSince}` : "no start date yet", profile.showActivity ? "Activity shown" : "Activity hidden"].join(" · ") },
		{ href: adminHref("/settings/journey"), label: "Journey", detail: journey.length ? `${published} published${journey.length > published ? `, ${journey.length - published} draft${journey.length - published === 1 ? "" : "s"}` : ""}` : "No entries yet" },
		{ href: adminHref("/settings/money"), label: "Costs and revenue", detail: `${formatMonth(today.slice(0, 7))}: costs ${formatPence(sum("cost"))} · revenue ${formatPence(sum("revenue"))}` },
	];
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
				<div className="grid auto-rows-fr gap-4 md:grid-cols-2">
					{main.map((s) => (
						<ProjectCard key={s.project.id} summary={s} numbers={lines.get(s.project.id) ?? null} />
					))}
				</div>
			</section>

			<section aria-labelledby="public-page-heading">
				<h2 id="public-page-heading" className="mb-4 border-b border-line pb-3.5 text-[15px] font-medium tracking-tight">
					My public page
				</h2>
				<ul className="divide-y divide-line rounded-2xl border border-line bg-card">
					{publicPage.map((item) => (
						<li key={item.href}>
							<Link href={item.href} className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-surface">
								<span className="min-w-0">
									<span className="font-medium group-hover:underline">{item.label}</span>
									<span className="block truncate text-sm text-muted">{item.detail}</span>
								</span>
								<span aria-hidden className="shrink-0 text-muted">
									→
								</span>
							</Link>
						</li>
					))}
				</ul>
			</section>

			<CountMyVisits sites={otherSites} />

			<p className="text-xs text-muted">
				Raw page views, events, uptime checks and job runs are deleted after 90 days. Daily totals are kept. No cookies, and no IP addresses, names or emails are stored.
			</p>
		</div>
	);
}

/**
 * The public project card's design, with the admin's figures: logo and name with the status on the
 * right; visitors in 30 days (a bold figure) with the change and the public numbers on one line;
 * the 12-week chart with its hover card; and uptime. The whole card opens the project's dashboard:
 * the name is the real link, stretched over the card, so nothing is nested; on hover and focus the
 * name and a → turn blue, the border darkens, and focus draws an outline round the card. Every card
 * is the same height (CARD_HEIGHT from md up).
 */
function ProjectCard({ summary: s, numbers }: { summary: ProjectSummary; numbers: string | null }) {
	const uptime: Status = s.uptime.lastUp === null ? "none" : s.uptime.lastUp ? "good" : "critical";
	const project = { slug: s.project.slug, name: s.project.name, logoPath: logoFor(s.project) };
	return (
		<article
			data-project-card
			aria-labelledby={`admin-project-${project.slug}`}
			className={`group relative flex h-full min-w-0 flex-col rounded-2xl border border-line bg-card p-5 transition-colors hover:border-[var(--axis)] has-[a[data-card-link]:focus-visible]:border-[var(--axis)] has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-solid has-[a[data-card-link]:focus-visible]:outline-[var(--accent)] ${CARD_HEIGHT}`}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<ProjectLogo name={project.name} logoPath={project.logoPath} />
					<h3 id={`admin-project-${project.slug}`} className="min-w-0 font-semibold">
						<Link href={adminHref(`/projects/${project.slug}`)} data-card-link className="flex min-w-0 items-center gap-1 outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']">
							<span className="truncate underline-offset-4 group-hover:text-accent group-hover:underline group-has-[a[data-card-link]:focus-visible]:text-accent group-has-[a[data-card-link]:focus-visible]:underline">{project.name}</span>
							{/* Always there, so nothing shifts when it appears. */}
							<ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100 group-has-[a[data-card-link]:focus-visible]:opacity-100" />
						</Link>
					</h3>
				</div>
				<span className="flex shrink-0 items-center gap-3">
					{!s.project.showPublic && <span className="text-xs text-muted">Not on public page</span>}
					<StatusDot status={s.project.status} />
				</span>
			</div>
			{/* One line, so every card is the same height: the public numbers follow the visitors and are cut with "…" if there's no room (full text on hover). */}
			<p className="mt-3 flex items-baseline gap-x-2 whitespace-nowrap text-sm text-ink-2">
				<span className="text-2xl font-semibold tracking-tight tabular text-ink">{formatCount(s.visitors30)}</span>
				<span className="shrink-0">visitors in 30 days</span>
				<span className="shrink-0 [&>span]:text-xs">
					<Delta value={change(s.visitors30, s.visitors30Previous)} />
				</span>
				{numbers && (
					<span className="min-w-0 truncate font-medium tabular text-ink" title={numbers}>
						<span aria-hidden className="mr-2 font-normal text-muted">·</span>
						{numbers}
					</span>
				)}
			</p>
			{/* Above the card's link overlay, so its hover card works. */}
			<div className="relative z-10 mt-auto pt-5">
				<WeekChart
					height={40}
					weeks={s.weekly}
					label={`${project.name}: visitors per week for the last 12 weeks, ${formatCount(s.weekly.reduce((t, w) => t + w.value, 0))} in total. This week so far is dashed.`}
				/>
			</div>
			<div className="mt-4 text-xs text-muted [&_span]:text-xs" title={s.uptime.uptime7 === null ? undefined : `${formatPercent(s.uptime.uptime7, 2)} up over 7 days`}>
				<StatusBadge status={uptime} label={s.uptime.lastUp === null ? "Not checked yet" : s.uptime.lastUp ? "Up" : "Down"} />
			</div>
		</article>
	);
}
