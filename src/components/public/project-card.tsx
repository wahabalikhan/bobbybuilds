import { ProjectLogo } from "@/components/admin/ui";
import { PROJECT_CARD_HEIGHT } from "@/lib/layout";
import { formatCount, formatDay } from "@/lib/format";
import type { TaglinePart } from "@/lib/public/product-line";
import type { PublicProject } from "@/lib/public/snapshot";
import { StatusDot } from "@/components/status-dot";
import { trackingNote } from "@/lib/trend";
import { ArrowIcon } from "./icons";
import { WeekChart } from "./mono-charts";

/** Text with its numbers in bold ink. */
function Parts({ parts }: { parts: TaglinePart[] }) {
	return (
		<>
			{parts.map((part, i) =>
				part.number ? (
					<strong key={i} className="font-semibold tabular text-ink">
						{part.text}
					</strong>
				) : (
					<span key={i}>{part.text}</span>
				),
			)}
		</>
	);
}

const text = (parts: TaglinePart[]) => parts.map((p) => p.text).join("");

/**
 * Only the essentials: logo and name with the status on the right, the tagline (two lines' space,
 * cut with "…"), then the visitors chart filling the rest of the card: "<n> max" above it on the
 * right, and under it "Tracking since … · live since …" (or "Since …" when there's no room) and "Today". The outcomes ("4,868 jobs made
 * clear") are in the chart's hover card. The Now line and the case study link are still saved in
 * Settings, but not shown on the card for now.
 *
 * The whole card opens the project's site in a new tab: the name is the real link, stretched over
 * the card with an overlay (::after), so there are no nested interactive elements. The chart and
 * the case study link sit above the overlay, so the chart's hover card works and they keep their
 * own behaviour. On hover or keyboard focus the name underlines, a ↗ appears after it (its space is
 * always kept, so nothing shifts) and the border darkens; focus also draws an outline round the card.
 * Every card is the same height: each line keeps its space even when it's empty.
 */
export function ProjectCard({ project }: { project: PublicProject }) {
	const link = project.siteUrl;
	return (
		<article
			data-project-card
			aria-labelledby={`project-${project.slug}`}
			className={`group relative flex min-w-0 flex-col rounded-2xl border border-line bg-card p-4 transition-colors ${PROJECT_CARD_HEIGHT} ${
				link ? "hover:border-[var(--axis)] has-[a[data-card-link]:focus-visible]:border-[var(--axis)] has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-[var(--accent)] has-[a[data-card-link]:focus-visible]:outline-solid" : ""
			}`}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<ProjectLogo name={project.name} logoPath={project.logoPath} />
					<h3 id={`project-${project.slug}`} className="min-w-0 font-semibold">
						{link ? (
							<a
								href={link}
								target="_blank"
								rel="noopener noreferrer"
								data-card-link
								className="flex min-w-0 items-center gap-1 outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']"
							>
								<span className="truncate underline-offset-4 group-hover:text-accent group-hover:underline group-has-[a[data-card-link]:focus-visible]:text-accent group-has-[a[data-card-link]:focus-visible]:underline">{project.name}</span>
								{/* Always there, so nothing shifts when it appears. */}
								<ArrowIcon className="h-3.5 w-3.5 shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100 group-has-[a[data-card-link]:focus-visible]:opacity-100" />
								<span className="sr-only">(opens in a new tab)</span>
							</a>
						) : (
							<span className="block truncate">{project.name}</span>
						)}
					</h3>
				</div>
				<StatusDot status={project.status} up={project.up} />
			</div>
			{/* Always two lines' space (cut with "…" after two), so every chart starts at the same height. */}
			<p className="mt-2 line-clamp-2 h-[2lh] text-sm leading-relaxed text-ink-2" title={project.tagline || undefined}>
				<Parts parts={project.taglineParts} />
			</p>
			{/* The rest of the card is the chart. Above the card's link overlay, so its hover card works. */}
			{/* Raised while it's hovered or focused, so a tall hover card stays on top of the next row's cards. */}
			<div className="relative z-10 min-h-0 flex-1 pt-3 focus-within:z-20 hover:z-20">
				{project.trend && (
					<WeekChart
						height="fill"
						period={project.trend.period}
						note={trackingNote(project.trackingSince, project.liveSince, formatDay)}
						noteShort={project.trackingSince ?? project.liveSince ? `Since ${formatDay((project.trackingSince ?? project.liveSince)!, true)}` : null}
						endLabel="Today"
						details={project.outcomes.map(text)}
						weeks={project.trend.points}
						label={`${project.name}: visitors per ${project.trend.period} since ${formatDay(project.trend.points[0]?.day ?? "", true)}, ${formatCount(project.trend.points.reduce((t, w) => t + w.value, 0))} in total.${project.outcomes.length ? ` ${project.outcomes.map(text).join(". ")}.` : ""} ${project.trend.period === "day" ? "Today" : "This week"} so far is dashed.`}
					/>
				)}
			</div>
		</article>
	);
}
