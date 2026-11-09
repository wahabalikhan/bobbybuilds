import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/public/footer";
import { JourneyList } from "@/components/public/journey";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { PublicTracker } from "@/components/public/tracker";
import { JOURNEY_TYPES, type JourneyType } from "@/lib/journey-types";
import { PAGE } from "@/lib/layout";
import { getSnapshot } from "@/lib/public/get";
import type { PublicEntry } from "@/lib/public/snapshot";
import { site } from "@/lib/site";

// Reads the public snapshot (rebuilt from the roll-ups every 10 minutes) on each request.
export const dynamic = "force-dynamic";

const INTRO = "Everything I’ve shipped, decided and learned, in public.";

// "Journey · BobbyBuilds" (the layout adds the brand). Noindex comes from the root layout while site.indexable is false.
export const metadata: Metadata = {
	title: "Journey",
	description: INTRO,
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "November 2026" from 'YYYY-MM-DD'. */
function monthName(day: string): string {
	return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
}

/** Entries (already newest first) in runs of the same month. */
function byMonth(entries: PublicEntry[]): { month: string; entries: PublicEntry[] }[] {
	const groups: { month: string; entries: PublicEntry[] }[] = [];
	for (const e of entries) {
		const month = e.day.slice(0, 7);
		if (groups.at(-1)?.month === month) groups.at(-1)!.entries.push(e);
		else groups.push({ month, entries: [e] });
	}
	return groups;
}

const entriesLabel = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "entry" : "entries"}`;

const CHIP =
	"inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-pill hover:text-ink aria-[current=true]:border-ink aria-[current=true]:bg-ink aria-[current=true]:text-page";

/**
 * The full journey: every published entry, newest first, grouped by month, with type filters kept
 * in the URL (/journey?type=decision), so they work without JavaScript and can be linked to. Reads
 * only the public snapshot.
 */
export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
	const [snapshot, query] = await Promise.all([getSnapshot(), searchParams]);
	const all = snapshot.journey;
	const selected = JOURNEY_TYPES.find((t) => t.value === query.type) ?? null;
	const entries = selected ? all.filter((e) => e.type === selected.value) : all;
	const count = (type: JourneyType) => all.filter((e) => e.type === type).length;
	// Chips for the types that have entries, plus the selected one (so a link to an empty type still shows which it is).
	const chips = JOURNEY_TYPES.filter((t) => count(t.value) > 0 || t.value === selected?.value);

	return (
		<div className="public-theme min-h-screen bg-page text-ink">
			<PublicTracker />
			<SkipLink />
			<SiteHeader sticky />
			<main id="content" className={`${PAGE} pb-16 pt-10 sm:pt-12`}>
				<Link href="/" className="link text-sm">
					<span aria-hidden>‹ </span>Back to {site.name}
				</Link>

				<h1 className="mt-6 text-3xl font-bold tracking-tight">
					Journey <span className="font-normal text-muted">· {entriesLabel(all.length)}</span>
				</h1>
				<p className="mt-2 text-ink-2">{INTRO}</p>

				{chips.length > 0 && (
					<nav aria-label="Show entries of one type" className="mt-8">
						<ul className="flex flex-wrap gap-2">
							<li>
								<Link href="/journey" scroll={false} aria-current={selected ? undefined : "true"} className={CHIP}>
									All <span className="tabular opacity-70">{all.length}</span>
								</Link>
							</li>
							{chips.map((t) => (
								<li key={t.value}>
									<Link href={`/journey?type=${t.value}`} scroll={false} aria-current={selected?.value === t.value ? "true" : undefined} className={CHIP}>
										<span aria-hidden>{t.emoji}</span>
										{t.label} <span className="tabular opacity-70">{count(t.value)}</span>
									</Link>
								</li>
							))}
						</ul>
					</nav>
				)}

				{selected && (
					<p className="mt-4 text-sm text-muted" role="status">
						Showing {entries.length.toLocaleString("en-GB")} of {all.length.toLocaleString("en-GB")} ·{" "}
						<Link href="/journey" scroll={false} className="link">
							Show all
						</Link>
					</p>
				)}

				<div className="mt-6">
					{entries.length === 0 ? (
						<p className="text-ink-2">{selected ? EMPTY[selected.value] : "No entries yet."}</p>
					) : (
						<div className="space-y-12">
							{byMonth(entries).map((group) => (
								<section key={group.month} aria-labelledby={`month-${group.month}`}>
									<h2 id={`month-${group.month}`} className="mb-4 text-base font-medium tracking-tight sm:text-lg">
										{monthName(group.entries[0].day)}
									</h2>
									<JourneyList entries={group.entries} />
								</section>
							))}
						</div>
					)}
				</div>
			</main>
			<SiteFooter year={Number(snapshot.today.slice(0, 4))} />
		</div>
	);
}
