import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass, Card, Pill, ProjectLogo, quietButtonClass, SectionHeading, StatusPill } from "@/components/admin/ui";
import { TimeSeriesChart } from "@/components/charts";
import { ArrowIcon } from "@/components/public/icons";
import { pillText } from "@/components/public/project-card";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { formatCount, formatDay } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { owner } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params;
	const project = (await getSnapshot()).projects.find((p) => p.slug === slug);
	if (!project) return { title: "Not found" };
	return { title: project.name, description: project.tagline || `${project.name}, by ${owner.name}.`, alternates: { canonical: `/p/${project.slug}` } };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const snapshot = await getSnapshot();
	const project = snapshot.projects.find((p) => p.slug === slug);
	if (!project) notFound();
	const entries = snapshot.journey.filter((e) => e.projectSlug === project.slug);

	return (
		<>
			<SkipLink />
			<SiteHeader />
			<main id="content" className="mx-auto max-w-3xl space-y-12 px-5 py-10 sm:px-6">
				<header>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex flex-wrap items-center gap-3">
							<ProjectLogo name={project.name} logoPath={project.logoPath} size={44} />
							<h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
							<StatusPill status={project.status} />
						</div>
						{project.pill && <Pill title={`${project.pill.label}, ${project.pill.period}`}>{pillText(project.pill)}</Pill>}
					</div>
					{project.tagline && <p className="mt-3 text-lg text-ink-2">{project.tagline}</p>}
					{(project.siteUrl || project.links.length > 0) && (
						<ul className="mt-5 flex flex-wrap gap-2" aria-label="Links">
							{project.siteUrl && (
								<li>
									<a href={project.siteUrl} rel="noopener noreferrer" className={buttonClass}>
										Visit {new URL(project.siteUrl).host} <ArrowIcon />
									</a>
								</li>
							)}
							{project.links.map((link) => (
								<li key={link.url}>
									<a href={link.url} rel="noopener noreferrer" className={quietButtonClass}>
										{link.label} <ArrowIcon />
									</a>
								</li>
							))}
						</ul>
					)}
					{project.status === "retired" && project.lesson && <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm"><span className="font-medium">Lesson:</span> {project.lesson}</p>}
				</header>

				{project.descriptionHtml.trim() && (
					<section aria-label="About">
						{/* Safe: rendered by src/lib/markdown.ts, which never passes raw HTML through. */}
						<div className="prose-bobby max-w-none text-ink-2" dangerouslySetInnerHTML={{ __html: project.descriptionHtml }} />
					</section>
				)}

				{project.numbers.length > 0 && (
					<section aria-labelledby="numbers-heading">
						<SectionHeading id="numbers-heading">In numbers</SectionHeading>
						<div className="grid gap-4 sm:grid-cols-2">
							{project.numbers.map((n) => (
								<Card key={n.key}>
									<p className="text-sm text-muted">{n.label}</p>
									<p className="mt-1 text-2xl font-bold tracking-tight">
										{n.figure === null ? "–" : formatCount(n.figure)}
										{n.unit && <span className="text-base font-normal text-ink-2"> {n.unit}</span>}{" "}
										<span className="text-sm font-normal text-muted">{n.period}</span>
									</p>
									<div className="mt-3">
										<TimeSeriesChart
											title={`${n.label}, ${n.seriesKind === "weekly" ? "per week for 12 weeks" : "per day for 90 days"}`}
											series={[{ label: n.label, points: n.series }]}
											height={170}
											viewWidth={360}
											unfinishedLast
											unitLabel={n.unit || undefined}
										/>
									</div>
									<p className="mt-1 text-xs text-muted">{n.seriesKind === "weekly" ? "Per week (Monday to Sunday). This week so far is dashed." : "Per day. Today so far is dashed."}</p>
								</Card>
							))}
						</div>
					</section>
				)}

				{project.milestones.length > 0 && (
					<section aria-labelledby="milestones-heading">
						<SectionHeading id="milestones-heading" aside={project.milestones.length}>
							Milestones
						</SectionHeading>
						<ol className="relative space-y-6 border-l border-line pl-6">
							{project.milestones.map((m, i) => (
								<li key={`${m.day}-${i}`} className="relative">
									<span aria-hidden className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-page bg-ink" />
									<p className="text-sm text-muted">{formatDay(m.day, true)}</p>
									<p className="font-medium">{m.title}</p>
									{m.note && <p className="text-sm text-ink-2">{m.note}</p>}
								</li>
							))}
						</ol>
					</section>
				)}

				{entries.length > 0 && (
					<section aria-labelledby="journey-heading">
						<SectionHeading id="journey-heading" aside={entries.length}>
							From the journey
						</SectionHeading>
						<ul className="space-y-4">
							{entries.map((e) => (
								<li key={e.slug}>
									<Link href={`/journey/${e.slug}`} className="group block">
										<span className="text-sm text-muted">{formatDay(new Date(e.publishedAt).toISOString().slice(0, 10), true)}</span>
										<span className="block font-medium group-hover:underline">{e.title}</span>
										<span className="block text-sm text-ink-2">{e.excerpt}</span>
									</Link>
								</li>
							))}
						</ul>
					</section>
				)}
			</main>
		</>
	);
}
