import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/public/footer";
import { EntryCard, FeaturedEntryCard, NextEntryCard, WideEntryCard } from "@/components/public/journey-cards";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { PublicTracker } from "@/components/public/tracker";
import { JOURNEY_TYPES, type JourneyTone, type JourneyType } from "@/lib/journey-types";
import { CARD, EYEBROW, PUBLIC_PAGE } from "@/lib/layout";
import { getSnapshot } from "@/lib/public/get";
import { byMonth, journeyPosts, monthName, type JourneyPost } from "@/lib/public/journey";

// Reads the public snapshot (rebuilt from the roll-ups every 10 minutes) on each request.
export const dynamic = "force-dynamic";

const HEADLINE = "Everything I’ve shipped, decided and learned.";

// "Journey · BobbyBuilds" (the layout adds the brand). Noindex comes from the root layout while site.indexable is false.
export const metadata: Metadata = {
	title: "Journey",
	description: HEADLINE,
	alternates: { canonical: "/journey" },
};

/** What each filter says when it has no entries. */
const EMPTY: Record<JourneyType, string> = {
	shipped: "Nothing shipped yet.",
	building: "Nothing in progress right now.",
	decision: "No decisions written up yet.",
	lesson: "No lessons written up yet.",
	post: "No posts yet.",
	inspired: "Nothing here yet.",
	report: "No monthly reports yet.",
};

/** Each type's filter in its colours; the chosen one is ink. */
const CHIP_TONES: Record<JourneyTone, string> = {
	shipped: "bg-shipped-bg text-shipped",
	building: "bg-building-bg text-building",
	decision: "bg-decision-bg text-decision",
	inspired: "bg-inspired-bg text-inspired",
	plain: "bg-plain-bg text-plain",
	ink: "bg-plain-bg text-ink",
};
const CHIP = "inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[16px] font-medium transition-[filter] hover:brightness-95";
const CHOSEN = "bg-ink text-white";

const entriesLabel = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "entry" : "entries"}`;

type Slot = { kind: "featured" | "wide" | "card"; post: JourneyPost } | { kind: "next" };

/**
 * How a month's entries sit in its 3-column grid: the featured entry (the newest with an image)
 * first, 2 columns by 2 rows; an entry with an image alone in its month as the wide card; the rest
 * as cards. The "Next entry" card goes in the first gap at the end of a month, newest month first,
 * or after the latest month when there's no gap.
 */
function layout(posts: JourneyPost[]) {
	const featured = posts.find((p) => p.image) ?? null;
	const months = byMonth(posts).map(({ month, posts: inMonth }) => {
		const slots: Slot[] = [];
		if (featured && inMonth.includes(featured)) slots.push({ kind: "featured", post: featured });
		for (const post of inMonth) {
			if (post === featured) continue;
			slots.push({ kind: post.image && inMonth.length === 1 ? "wide" : "card", post });
		}
		return { month, day: inMonth[0].day, slots };
	});
	const cells = (slots: Slot[]) => slots.reduce((t, s) => t + (s.kind === "featured" ? 4 : s.kind === "wide" ? 3 : 1), 0);
	const withGap = months.find((m) => cells(m.slots) % 3 !== 0) ?? months[0];
	withGap?.slots.push({ kind: "next" });
	return months;
}

/**
 * The full journey: a header card with the type filters (links kept in the URL, /journey?type=decision,
 * so they work without JavaScript and can be shared), then every published entry, newest first,
 * grouped by month in a 3-column grid. Every card opens its post (/journey/<slug>). Reads only the
 * public snapshot and the journey post files.
 */
export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
	const [snapshot, query] = await Promise.all([getSnapshot(), searchParams]);
	const all = journeyPosts(snapshot);
	const selected = JOURNEY_TYPES.find((t) => t.value === query.type) ?? null;
	const posts = selected ? all.filter((p) => p.type === selected.value) : all;
	const count = (type: JourneyType) => all.filter((p) => p.type === type).length;
	// Filters for the types that have entries, plus the chosen one (so a link to an empty type still shows which it is).
	const chips = JOURNEY_TYPES.filter((t) => count(t.value) > 0 || t.value === selected?.value);

	return (
		<div className="public-theme min-h-screen bg-page font-sans text-ink">
			<PublicTracker />
			<SkipLink />
			<SiteHeader current="journey" />
			<main id="content" className={PUBLIC_PAGE}>
				<header className={`${CARD} p-7 sm:p-10`}>
					<p className={`${EYEBROW} text-muted`}>Journey · {entriesLabel(all.length)}</p>
					<h1 className="mt-4 max-w-[760px] text-[clamp(2.375rem,10vw,3.5rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">{HEADLINE}</h1>
					{chips.length > 0 && (
						<nav aria-label="Show entries of one type" className="mt-8">
							<ul className="flex flex-wrap gap-2">
								<li>
									<Link href="/journey" scroll={false} aria-current={selected ? undefined : "page"} className={`${CHIP} ${selected ? "bg-plain-bg text-ink" : CHOSEN}`}>
										All <span className="tabular">{all.length}</span>
									</Link>
								</li>
								{chips.map((t) => {
									const chosen = selected?.value === t.value;
									return (
										<li key={t.value}>
											<Link href={`/journey?type=${t.value}`} scroll={false} aria-current={chosen ? "page" : undefined} className={`${CHIP} ${chosen ? CHOSEN : CHIP_TONES[t.tone]}`}>
												{t.label} <span className="tabular">{count(t.value)}</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</nav>
					)}
					{selected && (
						<p className="mt-5 text-[15px] text-muted" role="status">
							Showing {posts.length.toLocaleString("en-GB")} of {all.length.toLocaleString("en-GB")} ·{" "}
							<Link href="/journey" scroll={false} className="font-medium text-ink underline underline-offset-4 hover:text-accent">
								Show all
							</Link>
						</p>
					)}
				</header>

				{posts.length === 0 ? (
					<p className="mt-10 text-[17px] text-ink-2">{selected ? EMPTY[selected.value] : "No entries yet."}</p>
				) : (
					layout(posts).map((group) => (
						<section key={group.month} aria-labelledby={`month-${group.month}`} className="mt-12">
							<h2 id={`month-${group.month}`} className={`${EYEBROW} mb-4 text-[15px] text-muted`}>
								{monthName(group.day)}
							</h2>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
								{group.slots.map((slot) =>
									slot.kind === "next" ? (
										<NextEntryCard key="next" />
									) : slot.kind === "featured" ? (
										<FeaturedEntryCard key={slot.post.slug} post={slot.post} type={selected?.value} />
									) : slot.kind === "wide" ? (
										<WideEntryCard key={slot.post.slug} post={slot.post} type={selected?.value} />
									) : (
										<EntryCard key={slot.post.slug} post={slot.post} type={selected?.value} />
									),
								)}
							</div>
						</section>
					))
				)}
			</main>
			<SiteFooter year={Number(snapshot.today.slice(0, 4))} />
		</div>
	);
}
