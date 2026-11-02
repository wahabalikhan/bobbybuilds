import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/admin/ui";
import { SiteFooter } from "@/components/public/footer";
import { ContributionGraph } from "@/components/public/github";
import { HeadlineCard } from "@/components/public/headline-card";
import { ArrowIcon, GitHubIcon } from "@/components/public/icons";
import { ProfileCard } from "@/components/public/profile";
import { ProjectCard } from "@/components/public/project-card";
import { SkipLink } from "@/components/public/site-header";
import { formatDay } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { owner, site } from "@/lib/site";

// Reads the public snapshot (rebuilt from the roll-ups every 10 minutes) on each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: { absolute: `${owner.name}: ${site.name}` },
	description: `${owner.firstName}'s free, honest tools, built in public from ${owner.from}.`,
	alternates: { canonical: "/" },
};

export default async function Home() {
	const snapshot = await getSnapshot();
	const main = snapshot.projects.filter((p) => p.status === "live" || p.status === "building");
	const withVisitors = snapshot.projects.filter((p) => p.monthly).map((p) => ({ slug: p.slug, name: p.name, logoPath: p.logoPath, monthly: p.monthly! }));
	const latest = snapshot.journey.slice(0, 3);
	const projectBySlug = new Map(snapshot.projects.map((p) => [p.slug, p]));

	return (
		<>
			<SkipLink />
			<div className="mx-auto max-w-[1040px] px-5 py-8 sm:px-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 lg:py-12">
				<aside className="mb-10 lg:sticky lg:top-12 lg:mb-0 lg:self-start">
					<ProfileCard />
				</aside>
				<main id="content" className="min-w-0 space-y-12">
					{withVisitors.length > 0 && <HeadlineCard projects={withVisitors} />}

					<section aria-labelledby="projects-heading">
						<SectionHeading id="projects-heading" aside={main.length} relaxed>
							My projects
						</SectionHeading>
						<div className="grid gap-4 md:grid-cols-2">
							{main.map((p) => (
								<ProjectCard key={p.slug} project={p} />
							))}
						</div>
					</section>

					{snapshot.github && (
						<section aria-labelledby="github-heading">
							<SectionHeading
								id="github-heading"
								relaxed
								aside={
									<a href={`https://github.com/${snapshot.github.login}`} target="_blank" rel="noopener noreferrer me" className="inline-flex items-center gap-1.5 hover:text-ink">
										<GitHubIcon /> {snapshot.github.login} <ArrowIcon />
										<span className="sr-only">(opens in a new tab)</span>
									</a>
								}
							>
								GitHub
							</SectionHeading>
							<div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
								<ContributionGraph github={snapshot.github} />
							</div>
						</section>
					)}

					{site.showJourney && latest.length > 0 && (
						<section aria-labelledby="journey-heading">
							<SectionHeading
								id="journey-heading"
								relaxed
								aside={
									<Link href="/journey" className="link">
										All entries
									</Link>
								}
							>
								Journey
							</SectionHeading>
							<ul className="space-y-4">
								{latest.map((e) => (
									<li key={e.slug}>
										<Link href={`/journey/${e.slug}`} className="group block">
											<span className="text-sm text-muted">
												{formatDay(new Date(e.publishedAt).toISOString().slice(0, 10), true)}
												{e.projectSlug && ` · ${projectBySlug.get(e.projectSlug)?.name ?? e.projectName}`}
											</span>
											<span className="block font-medium group-hover:underline">{e.title}</span>
											<span className="block text-sm text-ink-2">{e.excerpt}</span>
										</Link>
									</li>
								))}
							</ul>
						</section>
					)}
				</main>
			</div>
			<SiteFooter year={Number(snapshot.today.slice(0, 4))} />
		</>
	);
}
