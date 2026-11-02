import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/admin/ui";
import { HeadlineCard } from "@/components/public/headline-card";
import { ProfileCard } from "@/components/public/profile";
import { MinorList, ProjectCard } from "@/components/public/project-card";
import { SkipLink } from "@/components/public/site-header";
import { formatDay } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { owner, site } from "@/lib/site";

// Reads the public snapshot (rebuilt from the roll-ups every 10 minutes) on each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: { absolute: `${owner.name}: ${site.name}` },
	description: `${owner.firstName}'s free, honest tools, built in public from ${owner.location}.`,
	alternates: { canonical: "/" },
};

export default async function Home() {
	const snapshot = await getSnapshot();
	const main = snapshot.projects.filter((p) => p.status === "live" || p.status === "building");
	const minor = snapshot.projects.filter((p) => p.status === "idea" || p.status === "retired");
	const withVisitors = snapshot.projects.filter((p) => p.monthly).map((p) => ({ slug: p.slug, name: p.name, monthly: p.monthly! }));
	const latest = snapshot.journey.slice(0, 3);

	return (
		<>
			<SkipLink />
			<div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10 lg:py-12">
				<aside className="mb-10 lg:sticky lg:top-12 lg:mb-0 lg:self-start">
					<ProfileCard />
				</aside>
				<main id="content" className="min-w-0 space-y-12">
					{withVisitors.length > 0 && <HeadlineCard all={snapshot.monthly} projects={withVisitors} />}

					<section aria-labelledby="projects-heading">
						<SectionHeading id="projects-heading" aside={main.length}>
							My projects
						</SectionHeading>
						<div className="grid gap-4 md:grid-cols-2">
							{main.map((p) => (
								<ProjectCard key={p.slug} project={p} />
							))}
						</div>
					</section>

					{minor.length > 0 && (
						<section aria-labelledby="minor-heading">
							<SectionHeading id="minor-heading" aside={minor.length}>
								Ideas and retired
							</SectionHeading>
							<MinorList projects={minor} />
						</section>
					)}

					{latest.length > 0 && (
						<section aria-labelledby="journey-heading">
							<SectionHeading
								id="journey-heading"
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
												{e.projectName && ` · ${e.projectName}`}
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
		</>
	);
}
