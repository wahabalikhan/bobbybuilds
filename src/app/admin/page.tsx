import Link from "next/link";
import { StatusDot } from "@/components/status-dot";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { OtherSites } from "@/components/admin/count-my-visits";
import { SettingsForm, TextField } from "@/components/admin/form";
import { profileAction } from "./settings/actions";
import type { ReactNode } from "react";
import { daysBetween } from "@/lib/admin/range";
import { journeyType } from "@/lib/journey-types";
import { Delta, EntryStatus, iconButtonClass, PlusIcon, ProjectLogo, Tooltip } from "@/components/admin/ui";
import { StatusStrip } from "@/components/admin/status-menu";
import { ArrowRightIcon } from "@/components/public/icons";
import { WeekChart } from "@/components/public/mono-charts";
import { HeadlineCard } from "@/components/public/headline-card";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { attentionItems, listMetrics, monthlyVisitors, projectSummaries, publicProductNumbers, type ProjectSummary } from "@/lib/db/dashboard";
import { listPublicProjects } from "@/lib/db/projects";
import { listMonth } from "@/lib/db/money";
import { getProfile } from "@/lib/db/profile";
import { listJourney } from "@/lib/db/settings";
import { change, formatCount, formatDay, formatLongDay, formatLongMonth, formatPence, formatPercent, formatWhole } from "@/lib/format";
import { adminIcons } from "@/lib/admin/icons";
import { productLine } from "@/lib/public/product-line";
import { CARD_HEIGHT } from "@/lib/layout";
import { trackingNote } from "@/lib/trend";
import { adminHref, site } from "@/lib/site";

/**
 * Home, top to bottom: the problems (only when something needs attention), visitors in 12 months
 * (public projects only, so it matches the public total), my projects, the journey (the 3 latest
 * entries), costs and revenue, and a small Settings card (when you started building, and turning
 * off counting on your other sites). Your own visits to BobbyBuilds are never counted while you're
 * signed in here (OwnVisitsNotCounted, in the layout).
 */
export default async function AdminHome() {
	const { env } = await getCloudflareContext({ async: true });
	const now = requestTime();
	const today = utcDay(now);
	const [summaries, iconFor, attention, publicProjects, metrics] = await Promise.all([projectSummaries(env.DB, today), adminIcons(env.DB), attentionItems(env.DB, now), listPublicProjects(env.DB), listMetrics(env.DB)]);
	// The same projects as the public total: on the public page, with their visitors public.
	const publicIds = new Set(publicProjects.map((p) => p.id));
	const counted = summaries.filter((s) => publicIds.has(s.project.id) && metrics.some((m) => m.projectId === s.project.id && m.source === "collector" && m.key === "visitors" && m.isPublic));
	const chart = await Promise.all(
		counted.map(async (s) => ({ slug: s.project.slug, name: s.project.name, logoPath: iconFor(s.project), monthly: await monthlyVisitors(env.DB, today, s.project.id) })),
	);
	const main = summaries.filter((s) => ["live", "building", "paused"].includes(s.project.status));
	// Turning off counting: a one-time link for each site other than this one.
	const otherSites = summaries.flatMap((s) => {
		const origin = s.project.siteUrl ? new URL(s.project.siteUrl).origin : null;
		return origin && origin !== site.url ? [{ name: s.project.name, origin }] : [];
	});
	const [profile, journey, money] = await Promise.all([getProfile(env.DB), listJourney(env.DB), listMonth(env.DB, today.slice(0, 7))]);
	const sum = (kind: "cost" | "revenue") => money.filter((r) => r.kind === kind).reduce((t, r) => t + r.amountPence, 0);
	const projectName = new Map(summaries.map((s) => [s.project.id, s.project.name]));
	const latest = journey.slice(0, 3);
	const days = profile.buildingSince && profile.buildingSince <= today ? daysBetween(profile.buildingSince, today).length : 1;
	const lines = new Map(await Promise.all(main.map(async (s) => [s.project.id, productLine(await publicProductNumbers(env.DB, s.project.id, today), today)] as const)));

	return (
		<div className="space-y-12">
			<StatusStrip items={attention} />

			{chart.length > 0 && (
				<section aria-label="Visitors in 12 months" className="space-y-2">
					<HeadlineCard projects={chart} />
					<p className="text-xs text-muted">Only projects shown on your public page, so it matches the public total.</p>
				</section>
			)}

			<section aria-labelledby="projects-heading">
				<HeadingRow id="projects-heading" title={<>My projects <span className="font-normal text-muted">({main.length})</span></>} add={{ href: adminHref("/projects/new"), label: "Add a project" }} />
				<div className="grid auto-rows-fr gap-4 md:grid-cols-2">
					{main.map((s) => (
						<ProjectCard key={s.project.id} summary={s} numbers={lines.get(s.project.id) ?? null} logoPath={iconFor(s.project)} />
					))}
				</div>
			</section>

			<section aria-labelledby="journey-heading">
				<HeadingRow id="journey-heading" title={<>Journey <span className="font-normal text-muted">({journey.length})</span></>} add={{ href: adminHref("/settings/journey/new"), label: "Add an entry" }} />
				{latest.length === 0 ? (
					<p className="text-sm text-muted">No entries yet.</p>
				) : (
					<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
						{latest.map((e) => {
							const t = journeyType(e.type);
							return (
								<li key={e.id} className="relative flex items-center gap-3 px-4 py-3.5 hover:bg-surface">
									<span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-pill text-base">
										{t.emoji}
									</span>
									<div className="min-w-0 flex-1">
										<Link href={adminHref(`/settings/journey/${e.id}`)} className="block truncate font-semibold outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
											{e.title}
										</Link>
										<p className="mt-0.5 truncate text-[13px] text-muted">
											{[t.label, e.publishedAt ? formatLongDay(new Date(e.publishedAt).toISOString().slice(0, 10)) : null, e.projectId ? projectName.get(e.projectId) : null].filter(Boolean).join(" · ")}
										</p>
									</div>
									<EntryStatus published={e.isPublished} />
								</li>
							);
						})}
					</ul>
				)}
				{journey.length > 0 && (
					<p className="mt-3 text-sm">
						<Link href={adminHref("/settings/journey")} className="link">
							All entries
						</Link>
					</p>
				)}
			</section>

			<section aria-labelledby="money-heading">
				<h2 id="money-heading" className="mb-4 text-[15px] font-medium tracking-tight">
					Costs and revenue
				</h2>
				<Link href={adminHref("/settings/money")} className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-3.5 hover:bg-surface">
					<span className="min-w-0">
						<span className="font-medium group-hover:underline">{formatLongMonth(today.slice(0, 7))}</span>
						<span className="block truncate text-sm text-muted">
							Costs {formatPence(sum("cost"))} · revenue {formatPence(sum("revenue"))}
						</span>
					</span>
					<span aria-hidden className="shrink-0 text-muted">
						→
					</span>
				</Link>
			</section>

			<div className="space-y-3">
				<section aria-labelledby="settings-heading" className="space-y-4 rounded-2xl border border-line bg-card p-4">
					<h2 id="settings-heading" className="text-[15px] font-medium tracking-tight">
						Settings
					</h2>
					<SettingsForm action={profileAction}>
						<TextField type="date" name="building_since" label="Started building" defaultValue={profile.buildingSince ?? ""} hint={`Shown as “Day ${formatWhole(days)}” on your public page.`} />
					</SettingsForm>
					{otherSites.length > 0 && <OtherSites sites={otherSites} />}
				</section>
				<p className="text-xs text-muted">Detailed records are deleted after 90 days. Daily totals are kept. No cookies, and no IP addresses, names or emails are stored.</p>
			</div>
		</div>
	);
}

/** A section's heading row: the heading on the left, its "+" icon button at the far right (with its tooltip and accessible name). */
function HeadingRow({ id, title, add }: { id: string; title: ReactNode; add: { href: string; label: string } }) {
	return (
		<div className="mb-4 flex items-center justify-between gap-3">
			<h2 id={id} className="text-[15px] font-medium tracking-tight">
				{title}
			</h2>
			<Tooltip text={add.label}>
				<Link href={add.href} aria-label={add.label} className={iconButtonClass}>
					<PlusIcon />
				</Link>
			</Tooltip>
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
function ProjectCard({ summary: s, numbers, logoPath }: { summary: ProjectSummary; numbers: string | null; logoPath: string | null }) {
	const project = { slug: s.project.slug, name: s.project.name, logoPath };
	return (
		<article
			data-project-card
			aria-labelledby={`admin-project-${project.slug}`}
			className={`group relative flex h-full min-w-0 flex-col rounded-2xl border border-line bg-card p-4 transition-colors hover:border-[var(--axis)] has-[a[data-card-link]:focus-visible]:border-[var(--axis)] has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-solid has-[a[data-card-link]:focus-visible]:outline-[var(--accent)] ${CARD_HEIGHT}`}
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
					{!s.project.showPublic && <span className="text-xs text-muted">{s.project.showOnFirstVisit ? "Hidden until its first visit" : "Hidden from public page"}</span>}
					{/* Uptime is folded into the dot ("Down" when the latest check failed), with the last 7 days on hover. */}
					<span title={s.uptime.lastUp === null ? "Uptime not checked yet" : s.uptime.uptime7 === null ? undefined : `Up ${formatPercent(s.uptime.uptime7, 2)} over the last 7 days`}>
						<StatusDot status={s.project.status} up={s.uptime.lastUp} />
					</span>
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
			{/* Above the card's link overlay, so its hover card works; raised while it's hovered or focused, so the hover card stays on top of the next row's cards. */}
			<div className="relative z-10 mt-auto pt-5 focus-within:z-20 hover:z-20">
				<WeekChart
					height={40}
					period={s.trend.period}
					compact
					note={trackingNote(s.trackingSince, s.project.startedOn, formatDay)}
					since={s.trackingSince ?? s.project.startedOn}
					weeks={s.trend.points}
					label={`${project.name}: visitors per ${s.trend.period} since ${formatDay(s.trend.points[0]?.day ?? "", true)}, ${formatCount(s.trend.points.reduce((t, w) => t + w.value, 0))} in total. ${s.trend.period === "day" ? "Today" : "This week"} so far is dashed.`}
				/>
			</div>
		</article>
	);
}
