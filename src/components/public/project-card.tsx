import type { ReactNode } from "react";
import { Pill, ProjectLogo, StatusPill } from "@/components/admin/ui";
import { WeekSparkline } from "@/components/public/charts";
import { ArrowIcon } from "@/components/public/icons";
import { formatCount } from "@/lib/format";
import type { PublicProject } from "@/lib/public/snapshot";

export function pillText(pill: NonNullable<PublicProject["pill"]>): string {
	return `${formatCount(pill.value)} ${pill.unit || pill.label.toLowerCase()}`;
}

/** Opens the project's own site in a new tab; without a site URL, it isn't a link. */
function ProjectLink({ project, className, children }: { project: PublicProject; className: string; children: ReactNode }) {
	if (!project.siteUrl) return <div className={className}>{children}</div>;
	return (
		<a href={project.siteUrl} target="_blank" rel="noopener noreferrer" className={className}>
			{children}
		</a>
	);
}

/** Logo, name (↗ when it links out), status, pill number, tagline and a 12-week sparkline. */
export function ProjectCard({ project }: { project: PublicProject }) {
	return (
		<ProjectLink project={project} className="group block rounded-2xl border border-line bg-card p-5 transition-colors hover:border-[var(--axis)]">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
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
					<StatusPill status={project.status} />
				</div>
				{project.pill && <Pill title={`${project.pill.label}, ${project.pill.period}`}>{pillText(project.pill)}</Pill>}
			</div>
			<p className="mt-2 text-sm text-ink-2">{project.tagline}</p>
			{project.weekly && (
				<div className="mt-5">
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
