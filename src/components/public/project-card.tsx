import type { ReactNode } from "react";
import { ProjectLogo, StatusPill } from "@/components/admin/ui";
import { WeekSparkline } from "@/components/public/charts";
import { ArrowIcon } from "@/components/public/icons";
import { formatCount } from "@/lib/format";
import { productLine } from "@/lib/public/product-line";
import type { PublicProject } from "@/lib/public/snapshot";

/** Opens the project's own site in a new tab; without a site URL, it isn't a link. */
function ProjectLink({ project, className, children }: { project: PublicProject; className: string; children: ReactNode }) {
	if (!project.siteUrl) return <div className={className}>{children}</div>;
	return (
		<a href={project.siteUrl} target="_blank" rel="noopener noreferrer" className={className}>
			{children}
		</a>
	);
}

/** Logo and name (↗ when it links out) with the status on the right, the tagline, any public product numbers, and a 12-week sparkline pinned to the bottom. */
export function ProjectCard({ project, today }: { project: PublicProject; today: string }) {
	const numbers = productLine(project.numbers, today);
	return (
		<ProjectLink project={project} className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition-colors hover:border-[var(--axis)]">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<ProjectLogo name={project.name} logoPath={project.logoPath} />
					<h3 className="flex items-center gap-1 font-semibold">
						<span className="group-hover:underline">{project.name}</span>
						{project.siteUrl && (
							<>
								<ArrowIcon className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
								<span className="sr-only">(opens in a new tab)</span>
							</>
						)}
					</h3>
				</div>
				<StatusPill status={project.status} />
			</div>
			<p className="mt-2 text-sm leading-relaxed text-ink-2">{project.tagline}</p>
			{numbers && <p className="mt-1.5 text-sm font-medium tabular text-ink">{numbers}</p>}
			{project.weekly && (
				<div className="mt-auto pt-5">
					<WeekSparkline
						project={project}
						weeks={project.weekly}
						label={`${project.name}: visitors per week for the last 12 weeks, ${formatCount(project.weekly.reduce((t, w) => t + w.value, 0))} in total. This week so far is dashed.`}
					/>
				</div>
			)}
		</ProjectLink>
	);
}
