import type { Metadata } from "next";
import { SectionHeading } from "@/components/admin/ui";
import { SiteFooter } from "@/components/public/footer";
import { HonestNumbers } from "@/components/public/honest-numbers";
import { Journey } from "@/components/public/journey";
import { Activity } from "@/components/public/activity";
import { Me } from "@/components/public/me";
import { ProjectCard } from "@/components/public/project-card";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { PublicTracker } from "@/components/public/tracker";
import { getSnapshot } from "@/lib/public/get";
import { homeTitle, owner } from "@/lib/site";
import { PAGE, PUBLIC_SECTION_DIVIDERS } from "@/lib/layout";

// Reads the public snapshot (rebuilt from the roll-ups every 10 minutes) on each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: { absolute: homeTitle },
	openGraph: { title: homeTitle },
	twitter: { title: homeTitle },
	description: `${owner.firstName}'s free, honest tools, built in public.`,
	alternates: { canonical: "/" },
};

/** Statuses shown on the public page. Ideas and retired projects aren't, for now. */
const SHOWN = new Set(["live", "building", "paused"]);

/**
 * Top to bottom: Me (a short intro), Projects (two columns on desktop), The honest numbers,
 * Activity (only when "Show my activity" is on in Profile), and The journey last, because it keeps
 * growing. Everything comes from the
 * public snapshot. Each section has a stable anchor to link to: #projects, #numbers, #activity, #journey.
 */
export default async function Home() {
	const snapshot = await getSnapshot();
	const projects = snapshot.projects.filter((p) => SHOWN.has(p.status));

	return (
		<div className="public-theme min-h-screen bg-page text-ink">
			<PublicTracker />
			<SkipLink />
			<SiteHeader showAfter="projects" />
			<main id="content" className={`${PAGE} space-y-20 pb-16 pt-[72px] sm:space-y-24 sm:pt-[88px]`}>
				{/* No dividers: space alone separates the sections. The hero has 64px below it (80px from sm),
				    and the other sections are 80px apart (96px from sm). */}
				<div className="mb-16! sm:mb-20!">
					<Me />
				</div>

				{projects.length > 0 && (
					<section id="projects" aria-labelledby="projects-heading" className="scroll-mt-20">
						<SectionHeading id="projects-heading" aside={projects.length} relaxed divider={PUBLIC_SECTION_DIVIDERS}>
							Projects
						</SectionHeading>
						<div className="grid auto-rows-fr gap-3 md:grid-cols-2">
							{projects.map((p) => (
								<ProjectCard key={p.slug} project={p} />
							))}
						</div>
					</section>
				)}

				<HonestNumbers snapshot={snapshot} />

				{snapshot.activity && <Activity activity={snapshot.activity} />}

				{snapshot.journey.length > 0 && (
					<section id="journey" aria-labelledby="journey-heading" className="scroll-mt-20">
						<SectionHeading id="journey-heading" aside={snapshot.journey.length} relaxed divider={PUBLIC_SECTION_DIVIDERS}>
							The journey
						</SectionHeading>
						<Journey
							entries={snapshot.journey.map(({ slug, type, day, title, html, linkUrl, projectName }) => ({
								slug,
								type,
								day,
								title,
								html,
								linkUrl,
								projectName,
							}))}
						/>
					</section>
				)}
			</main>
			<SiteFooter year={Number(snapshot.today.slice(0, 4))} />
		</div>
	);
}
