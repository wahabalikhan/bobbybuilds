import Link from "next/link";
import { formatDay } from "@/lib/format";
import { journeyType } from "@/lib/journey-types";
import type { PublicEntry } from "@/lib/public/snapshot";
import { EntryBody } from "./entry-body";
import { ArrowIcon } from "./icons";

/** How many entries the home page shows; the rest are on /journey. */
export const HOME_JOURNEY_COUNT = 5;

export type JourneyEntryData = Pick<PublicEntry, "slug" | "type" | "day" | "title" | "html" | "linkUrl" | "projectName">;

function domain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "Link";
	}
}

/**
 * Entries on a timeline, newest first: the date, type emoji and label and project name; the title;
 * the text cut to two lines with "Read more" (EntryBody); and the link (shown as its domain). The
 * same design on the home page and /journey.
 */
export function JourneyList({ entries }: { entries: JourneyEntryData[] }) {
	return (
		<ol className="space-y-8 border-l border-line pl-6 sm:space-y-10 sm:pl-8">
			{entries.map((e) => {
				const t = journeyType(e.type);
				return (
					<li key={e.slug} className="relative">
						<span aria-hidden className="absolute -left-[29px] top-2 h-2 w-2 rounded-full border border-line bg-page ring-4 ring-page sm:-left-[37px]" />
						<p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
							<time dateTime={e.day}>{formatDay(e.day, true)}</time>
							<span aria-hidden>·</span>
							<span className="text-ink-2">
								<span aria-hidden>{t.emoji} </span>
								{t.label}
							</span>
							{e.projectName && (
								<>
									<span aria-hidden>·</span>
									<span>{e.projectName}</span>
								</>
							)}
						</p>
						<h3 className="mt-1.5 text-lg font-semibold tracking-tight">{e.title}</h3>
						{e.html && <EntryBody html={e.html} />}
						{e.linkUrl && (
							<div className="mt-2.5">
								<a href={e.linkUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-sm">
									{domain(e.linkUrl)} <ArrowIcon />
									<span className="sr-only">(opens in a new tab)</span>
								</a>
							</div>
						)}
					</li>
				);
			})}
		</ol>
	);
}

/** The home page's journey: the latest 5 published entries, then "See the full journey →" when there are more. */
export function Journey({ entries }: { entries: JourneyEntryData[] }) {
	return (
		<>
			<JourneyList entries={entries.slice(0, HOME_JOURNEY_COUNT)} />
			{entries.length > HOME_JOURNEY_COUNT && (
				<p className="mt-10">
					<Link href="/journey" className="link text-sm font-medium">
						See the full journey <span aria-hidden>→</span>
					</Link>
				</p>
			)}
		</>
	);
}
