import type { Metadata } from "next";
import { SiteFooter } from "@/components/public/footer";
import { FeaturedProjectCard, GitHubCard, IntroCard, LatestJourneyCard, NowCard, ProjectCard } from "@/components/public/home";
import { NumberTiles, type TilesData } from "@/components/public/number-tiles";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { PublicTracker } from "@/components/public/tracker";
import { formatDay, formatLongMonth, formatMonth } from "@/lib/format";
import { daysBuilding } from "@/lib/days";
import { PUBLIC_PAGE } from "@/lib/layout";
import { getSnapshot } from "@/lib/public/get";
import { journeyPosts } from "@/lib/public/journey";
import { homeTitle, owner } from "@/lib/site";

// Reads the public snapshot (rebuilt from the roll-ups every 10 minutes) on each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: { absolute: homeTitle },
	openGraph: { title: homeTitle },
	twitter: { title: homeTitle },
	description: owner.bio,
	alternates: { canonical: "/" },
};

/** Statuses shown on the public page. Ideas and retired projects aren't, for now. */
const SHOWN = new Set(["live", "building", "paused"]);

/** The card style that makes a project the tall blue featured card. */
const FEATURED_THEME = "realtechjobs-blue";

/**
 * The bento home page: a 6-column grid from lg (one column on phones, the number tiles two per row).
 * Row by row on desktop: the intro (4 columns) beside the featured project (2 columns, 2 rows tall);
 * the number tiles under the intro (with "Where the money goes" under them when it's open); the other
 * projects and Now (3 columns each); GitHub activity (4) and the latest from the journey (2).
 * Everything comes from the public snapshot, plus content/now.ts and the journey post files.
 */
export default async function Home() {
	const snapshot = await getSnapshot();
	const projects = snapshot.projects.filter((p) => SHOWN.has(p.status));
	const featured = projects.find((p) => p.theme === FEATURED_THEME) ?? null;
	const others = projects.filter((p) => p !== featured);
	const posts = journeyPosts(snapshot);
	const { profile, money, today } = snapshot;
	// With a featured project, the intro and tiles share its rows; without one they're full width.
	const left = featured ? "lg:col-span-4" : "lg:col-span-6";

	const tiles: TilesData = {
		building: profile.buildingSince && profile.buildingSince <= today ? { days: daysBuilding(profile.buildingSince, today), since: formatDay(profile.buildingSince) } : null,
		visitors: { value: snapshot.visitors30, previous: snapshot.visitorsPrev30, daily: snapshot.visitorsDaily.map((d) => d.value) },
		money: money
			? {
					monthShort: formatMonth(money.month).slice(0, 3),
					monthLong: formatLongMonth(money.month),
					runningPence: money.runningPence,
					toolsPence: money.toolsPence,
					revenuePence: money.revenuePence,
					running: money.running,
					tools: money.tools,
				}
			: null,
	};

	return (
		<div className="public-theme min-h-screen bg-page font-sans text-ink">
			<PublicTracker />
			<SkipLink />
			<SiteHeader />
			<main id="content" className={`${PUBLIC_PAGE} grid grid-cols-1 gap-4 lg:grid-cols-6`}>
				<IntroCard className={left} />
				{featured && <FeaturedProjectCard project={featured} number={projects.indexOf(featured) + 1} today={today} className="lg:col-span-2 lg:row-span-2" />}
				<NumberTiles data={tiles} tilesClass={left} panelClass="lg:col-span-6" />
				{others.map((p, i) => (
					<ProjectCard key={p.slug} project={p} number={projects.indexOf(p) + 1} anchor={!featured && i === 0} className="lg:col-span-3" />
				))}
				<NowCard className="lg:col-span-3" />
				<GitHubCard github={snapshot.activity?.github ?? null} className={posts.length ? "lg:col-span-4" : "lg:col-span-6"} />
				{posts.length > 0 && <LatestJourneyCard posts={posts} className="lg:col-span-2" />}
			</main>
			<SiteFooter year={Number(today.slice(0, 4))} />
		</div>
	);
}
