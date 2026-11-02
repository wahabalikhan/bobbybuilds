import Link from "next/link";
import { Pill, ProjectLogo, StatusPill } from "@/components/admin/ui";
import { Sparkline } from "@/components/charts";
import { formatCount } from "@/lib/format";
import type { PublicProject } from "@/lib/public/snapshot";

export function pillText(pill: NonNullable<PublicProject["pill"]>): string {
	return `${formatCount(pill.value)} ${pill.unit || pill.label.toLowerCase()}`;
}

/** Logo, name, status, pill number, tagline and a 12-week sparkline; the whole card links to the project page. */
export function ProjectCard({ project }: { project: PublicProject }) {
	return (
		<Link href={`/p/${project.slug}`} className="group block rounded-2xl border border-line bg-card p-5 transition-colors hover:border-[var(--axis)]">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<ProjectLogo name={project.name} logoPath={project.logoPath} />
					<h3 className="truncate font-semibold group-hover:underline">{project.name}</h3>
					<StatusPill status={project.status} />
				</div>
				{project.pill && <Pill title={`${project.pill.label}, ${project.pill.period}`}>{pillText(project.pill)}</Pill>}
			</div>
			<p className="mt-2 text-sm text-ink-2">{project.tagline}</p>
			{project.weekly && (
				<div className="mt-5">
					<Sparkline
						points={project.weekly}
						unfinishedLast
						label={`${project.name}: visitors per week for the last 12 weeks, ${formatCount(project.weekly.reduce((t, w) => t + w.value, 0))} in total. This week so far is dashed.`}
					/>
				</div>
			)}
		</Link>
	);
}

/** The compact three-column list for ideas and retired projects. */
export function MinorList({ projects }: { projects: PublicProject[] }) {
	return (
		<ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
			{projects.map((p) => (
				<li key={p.slug}>
					<Link href={`/p/${p.slug}`} className="group flex gap-3">
						<ProjectLogo name={p.name} logoPath={p.logoPath} size={24} />
						<span>
							<span className="flex flex-wrap items-center gap-2 font-medium group-hover:underline">
								{p.name}
								<Pill>{p.status === "retired" ? "Retired" : "Idea"}</Pill>
							</span>
							<span className="mt-0.5 block text-sm text-muted">{p.tagline}</span>
							{p.status === "retired" && p.lesson && <span className="mt-0.5 block text-sm text-ink-2">Lesson: {p.lesson}</span>}
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
}
