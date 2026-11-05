import { ProjectLogo } from "@/components/admin/ui";
import { CARD_HEIGHT } from "@/lib/layout";
import { formatCount } from "@/lib/format";
import type { TaglinePart } from "@/lib/public/product-line";
import type { PublicProject } from "@/lib/public/snapshot";
import { StatusDot } from "@/components/status-dot";
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

/** Same site: the same host, ignoring "www." (so Portfolio's case study link, its own site, isn't repeated). */
function sameSite(a: string | null, b: string | null): boolean {
	if (!a || !b) return false;
	try {
		const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
		return host(a) === host(b);
	} catch {
		return false;
	}
}

/**
 * Logo and name with the status on the right; the tagline (two lines, cut with "…"); the outcomes in
 * words on one line ("4,868 jobs made clear · 838 companies hiring"); the optional "Now:" line,
 * small and grey; the 12-week visitors chart (with its hover card) pinned near the bottom; and
 * "Read the case study" when it's set and on another site than the project.
 *
 * The whole card opens the project's site in a new tab: the name is the real link, stretched over
 * the card with an overlay (::after), so there are no nested interactive elements. The chart and
 * the case study link sit above the overlay, so the chart's hover card works and they keep their
 * own behaviour. On hover or keyboard focus the name underlines, a ↗ appears after it (its space is
 * always kept, so nothing shifts) and the border darkens; focus also draws an outline round the card.
 * Every card is the same height: each line keeps its space even when it's empty.
 */
export function ProjectCard({ project }: { project: PublicProject }) {
	const outcomes = project.outcomes.map(text).join(" · ");
	const link = project.siteUrl;
	const caseStudy = project.caseStudyUrl && !sameSite(project.caseStudyUrl, project.siteUrl) ? project.caseStudyUrl : null;
	return (
		<article
			data-project-card
			aria-labelledby={`project-${project.slug}`}
			className={`group relative flex h-full min-w-0 flex-col rounded-2xl border border-line bg-card p-4 transition-colors ${CARD_HEIGHT} ${
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
				<StatusDot status={project.status} />
			</div>
			<p className="mt-2 line-clamp-2 h-[2lh] text-sm leading-relaxed text-ink-2" title={project.tagline || undefined}>
				<Parts parts={project.taglineParts} />
			</p>
			<p className="mt-1 h-[1lh] truncate text-sm leading-relaxed text-ink-2" title={outcomes || undefined}>
				{project.outcomes.map((parts, i) => (
					<span key={i}>
						{i > 0 && (
							<span aria-hidden className="mx-1.5 text-muted">
								·
							</span>
						)}
						<Parts parts={parts} />
					</span>
				))}
			</p>
			<p className="mt-1 h-[1lh] truncate text-xs leading-relaxed text-muted" title={project.now ? `Now: ${project.now}` : undefined}>
				{project.now && (
					<>
						<span className="font-medium text-ink-2">Now:</span> {project.now}
					</>
				)}
			</p>
			{/* Above the card's link overlay, so its hover card works. */}
			<div className="relative z-10 mt-auto pt-3">
				{project.weekly ? (
					<WeekChart
						height={36}
						weeks={project.weekly}
						label={`${project.name}: visitors per week for the last 12 weeks, ${formatCount(project.weekly.reduce((t, w) => t + w.value, 0))} in total. This week so far is dashed.`}
					/>
				) : (
					<div aria-hidden className="h-9" />
				)}
			</div>
			{caseStudy && (
				<div className="relative z-10 mt-4">
					<a href={caseStudy} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-pill">
						Read the case study <ArrowIcon />
						<span className="sr-only">(opens in a new tab)</span>
					</a>
				</div>
			)}
		</article>
	);
}
