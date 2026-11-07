import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/admin/copy-button";
import { buttonClass, Card, Delta, Empty, quietButtonClass, RangePicker } from "@/components/admin/ui";
import { RankedList, StatusBadge, UptimeStrip, type Status } from "@/components/charts";
import { clampToRaw, type DateRange } from "@/lib/admin/range";
import { sourceName } from "@/lib/admin/sources";
import { addDays } from "@/lib/days";
import {
	brokenLinks,
	dailySeries,
	EVENTS_PAGE_SIZE,
	eventBreakdown,
	eventNames,
	hasEvent,
	latestProductNumbers,
	listEvents,
	outages,
	ranked,
	rangeTotals,
	searchCounts,
	searchTerms,
	trackedLinks,
	uptimeChecks,
	uptimeDays,
} from "@/lib/db/dashboard";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ArrowIcon } from "@/components/public/icons";
import { WeekChart } from "@/components/public/mono-charts";
import { funnel, parseFunnel } from "@/lib/db/funnel";
import type { Project } from "@/lib/db/projects";
import { change, formatCount, formatDay, formatDuration, formatPercent, formatSeconds, formatTime, formatUkTime, formatWhole } from "@/lib/format";
import { adminHref } from "@/lib/site";

export type OverviewProps = {
	project: Project;
	range: DateRange;
	today: string;
	now: number;
	query: Record<string, string>;
	hrefFor: (changes: Record<string, string>) => string;
};

/** Query values that mean "Advanced" (the events table) was being used, so it opens again after the page reloads. */
const ADVANCED_PARAMS = ["name", "source", "page"];

/**
 * A project at a glance, one scrolling page, top to bottom: visitors; top pages and sources (each
 * with "See all"); Searches (projects that send them, like Tech Jobs: counts and search health on
 * one line, top searches, found nothing, and companies waiting for review); tracked links, with
 * "Make a link"; the funnel as one line; uptime as one line. Then "All the detail" and "Advanced",
 * both closed.
 */
export async function Overview({ project, range, today, now, query, hrefFor }: OverviewProps) {
	// The database is read here rather than passed in: in dev, React tries to serialise a
	// server component's props for its debug info, and the D1 binding can't be serialised.
	const { env } = await getCloudflareContext({ async: true });
	const db = env.DB;
	const raw = clampToRaw(range, today);
	const steps = parseFunnel(project.funnel);
	const ninetyDaysAgo = addDays(today, -89);
	const [totals, previous, visitors, pages, sources, links, sendsSearches, funnelResult, days, checks, broken, numbers] = await Promise.all([
		rangeTotals(db, project.id, range.from, range.to),
		rangeTotals(db, project.id, range.previousFrom, range.previousTo),
		dailySeries(db, project.id, "visitors", range.from, range.to),
		ranked(db, "pages", project.id, range.from, range.to, 50),
		ranked(db, "referrers", project.id, range.from, range.to, 50),
		trackedLinks(db, project.id, range.from, range.to, raw.from, raw.to),
		hasEvent(db, project.id, "search", ninetyDaysAgo, today),
		steps.length ? funnel(db, project.id, steps, raw.from, raw.to) : Promise.resolve([]),
		uptimeDays(db, project.id, ninetyDaysAgo, today),
		uptimeChecks(db, project.id, now - 30 * 86_400_000),
		brokenLinks(db, project.id, ninetyDaysAgo, today),
		latestProductNumbers(db, project.id, today),
	]);
	const [searches, topSearches, emptySearches] = sendsSearches
		? await Promise.all([searchCounts(db, project.id, raw.from, raw.to), searchTerms(db, project.id, "search", raw.from, raw.to), searchTerms(db, project.id, "search_no_results", raw.from, raw.to)])
		: [null, [], []];
	const rawNote = raw.clipped ? "From the last 90 days (detail older than that is deleted)." : undefined;

	return (
		<div className="space-y-12">
			<Headline project={project} range={range} today={today} visitors={totals.visitors} previous={previous.visitors} series={visitors} hrefFor={hrefFor} />

			<div className="grid gap-6 md:grid-cols-2">
				<Top
					title="Top pages"
					rows={pages.slice(0, 5).map((p) => ({ label: p.key, value: p.visitors }))}
					empty="No page views in this range."
					all={<RankedList title="All pages" keyLabel="Page" rows={pages.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))} />}
				/>
				<Top
					title="Top sources"
					rows={sources.slice(0, 5).map((r) => ({ label: sourceName(r.key), value: r.visitors }))}
					empty="No visits in this range."
					all={
						<>
							<p className="mb-2 text-sm text-muted">Direct means we couldn&rsquo;t tell (typed in, bookmarked, or an app).</p>
							<RankedList title="All sources" keyLabel="Source" rows={sources.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))} formatKey={sourceName} />
						</>
					}
				/>
			</div>

			<Searches project={project} range={range} today={today} searches={searches} topSearches={topSearches} emptySearches={emptySearches} numbers={numbers} rawNote={rawNote} />

			<TrackedLinks links={links} project={project} query={query} hrefFor={hrefFor} />

			{funnelResult.length > 0 && (
				<Section title="Funnel" note="Each step counts people who did it after the step before, on the same day.">
					<p className="text-sm text-ink-2">
						{funnelResult.map((step) => `${step.label} ${formatWhole(step.visitors)}${step.fromPrevious === null ? "" : ` (${formatPercent(step.fromPrevious)})`}`).join(" → ")}
					</p>
				</Section>
			)}

			<Uptime project={project} days={days} latestUp={checks.at(-1)?.up ?? null} broken={broken} />

			<Disclosure title="All the detail">
				<AllTheDetail project={project} range={range} today={today} days={days} checks={checks} rawNote={rawNote} />
			</Disclosure>

			<Disclosure title="Advanced" open={ADVANCED_PARAMS.some((key) => query[key])}>
				<Events project={project} range={range} today={today} query={query} hrefFor={hrefFor} />
			</Disclosure>
		</div>
	);
}

/** A closed section with a chevron: "All the detail" and "Advanced". */
function Disclosure({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
	return (
		<details open={open} className="group rounded-2xl border border-line bg-card">
			<summary className="flex list-none items-center justify-between gap-3 px-4 py-4 text-[15px] font-medium tracking-tight [&::-webkit-details-marker]:hidden">
				{title}
				<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="text-muted transition-transform group-open:rotate-180">
					<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</summary>
			<div className="space-y-6 border-t border-line p-4">{children}</div>
		</details>
	);
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
	return (
		<section>
			<h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
			{note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
			<div className="mt-4">{children}</div>
		</section>
	);
}

/**
 * A short ranked list: label on the left, visitors (or count) on the right. With `all`, "See all"
 * opens the full table in its place ("Show fewer" closes it).
 */
function Top({ title, rows, empty, all }: { title: string; rows: { label: string; value: number }[]; empty: string; all?: ReactNode }) {
	return (
		<section className="[&:has(>details[open])>ol]:hidden">
			<h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
			{rows.length === 0 ? (
				<p className="mt-4 text-sm text-muted">{empty}</p>
			) : (
				<ol className="mt-4 divide-y divide-line text-sm">
					{rows.map((r, i) => (
						<li key={`${r.label}-${i}`} className="flex items-baseline justify-between gap-4 py-1.5">
							<span className="min-w-0 truncate" title={r.label}>
								{r.label}
							</span>
							<span className="tabular text-ink-2">{formatCount(r.value)}</span>
						</li>
					))}
				</ol>
			)}
			{all && rows.length > 0 && (
				<details className="group/all mt-2">
					<summary className="link list-none text-sm [&::-webkit-details-marker]:hidden">
						<span className="group-open/all:hidden">See all</span>
						<span className="hidden group-open/all:inline">Show fewer</span>
					</summary>
					<div className="mt-2">{all}</div>
				</details>
			)}
		</section>
	);
}

function Headline({
	project,
	range,
	today,
	visitors,
	previous,
	series,
	hrefFor,
}: {
	project: Project;
	range: DateRange;
	today: string;
	visitors: number;
	previous: number;
	series: { day: string; value: number }[];
	hrefFor: (changes: Record<string, string>) => string;
}) {
	return (
		<section aria-label="Visitors" className="rounded-2xl border border-line bg-card p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<p className="flex flex-wrap items-baseline gap-x-2 text-ink-2">
					<span className="text-3xl font-semibold tracking-tight tabular text-ink">{formatWhole(visitors)}</span>
					visitors, {range.label.toLowerCase()}
					<Delta value={change(visitors, previous)} period="previous" />
				</p>
				<div className="text-xs [&_a]:text-xs [&_summary]:text-xs">
					<RangePicker range={range} hrefFor={hrefFor} />
				</div>
			</div>
			<div className="mt-4">
				<WeekChart
					period="day"
					height={80}
					unfinishedLast={range.to === today}
					weeks={series}
					label={`${project.name}: visitors per day, ${range.label.toLowerCase()}, ${formatCount(visitors)} in total.${range.to === today ? " Today so far is dashed." : ""}`}
				/>
			</div>
		</section>
	);
}

/** One line: uptime over 90 days and pages not found. Amber or red only when there's a problem. */
function Uptime({ project, days, latestUp, broken }: { project: Project; days: { checks: number; up: number }[]; latestUp: boolean | null; broken: number }) {
	const checks = days.reduce((t, d) => t + d.checks, 0);
	const up = days.reduce((t, d) => t + d.up, 0);
	const ratio = checks ? up / checks : null;
	const status: Status = latestUp === false ? "critical" : (ratio !== null && ratio < 0.99) || broken > 0 ? "warning" : ratio === null ? "none" : "good";
	const parts = [
		!project.siteUrl ? "No site address, so uptime isn't checked" : ratio === null ? "Not checked yet" : `Up ${formatPercent(ratio, ratio >= 0.9995 ? 0 : 2)} in the last 90 days`,
		`${formatWhole(broken)} page${broken === 1 ? "" : "s"} not found`,
	];
	if (latestUp === false) parts.unshift("Down right now");
	return (
		<Section title="Uptime">
			<p className={`text-sm ${status === "good" || status === "none" ? "text-ink-2" : ""}`}>
				{status === "good" || status === "none" ? parts.join(" · ") : <StatusBadge status={status} label={parts.join(" · ")} />}
			</p>
		</Section>
	);
}

/**
 * Searches, for projects that send them (Tech Jobs): the counts and search health on one line
 * (amber when a search failed), top searches and found nothing (each with "See all"), and
 * companies waiting for review at the end, linking to the project's own admin.
 */
function Searches({
	project,
	range,
	today,
	searches,
	topSearches,
	emptySearches,
	numbers,
	rawNote,
}: {
	project: Project;
	range: DateRange;
	today: string;
	searches: { searches: number; noResults: number } | null;
	topSearches: { words: string; count: number }[];
	emptySearches: { words: string; count: number }[];
	numbers: Map<string, { value: number; day: string }>;
	rawNote?: string;
}) {
	const failed = numbers.get("searches_failed");
	const median = numbers.get("median_search_ms");
	const waiting = numbers.get("review_waiting");
	if (!searches && !failed && !median && !waiting) return null;
	const counts = searches ? `${formatWhole(searches.searches)} searches in ${range.label.toLowerCase()}${searches.noResults ? `, ${formatWhole(searches.noResults)} found nothing` : ""}` : null;
	let health: string | null = null;
	if (failed || median) {
		const day = [failed?.day, median?.day].filter((d): d is string => !!d).sort().at(-1)!;
		const when = day === today ? "today" : day === addDays(today, -1) ? "yesterday" : `on ${formatDay(day)}`;
		health = `${[failed && `${formatWhole(failed.value)} failed search${failed.value === 1 ? "" : "es"}`, median && `searches typically take ${formatSeconds(median.value)}`].filter(Boolean).join(" · ")} ${when}`;
	}
	const words = (w: string) => w || "(no words, just filters)";
	const admin = waiting && project.siteUrl ? `${new URL(project.siteUrl).origin}/admin` : null;
	return (
		<Section title="Searches">
			{(counts || health) && (
				<p className="text-sm text-ink-2">
					{counts}
					{counts && health && " · "}
					{health && (failed && failed.value > 0 ? <StatusBadge status="warning" label={health} /> : health)}
				</p>
			)}
			{searches && (
				<div className="mt-4 grid gap-6 md:grid-cols-2">
					<Top
						title="Top searches"
						rows={topSearches.slice(0, 5).map((t) => ({ label: words(t.words), value: t.count }))}
						empty="No searches in this range."
						all={
							<>
								{rawNote && <p className="mb-2 text-sm text-muted">{rawNote}</p>}
								<RankedList title="All searches" keyLabel="Search" valueLabel="Searches" rows={topSearches.map((t) => ({ key: t.words, value: t.count }))} formatKey={words} />
							</>
						}
					/>
					<Top
						title="Found nothing"
						rows={emptySearches.slice(0, 5).map((t) => ({ label: words(t.words), value: t.count }))}
						empty="Every search found something."
						all={<RankedList title="Searches that found nothing" keyLabel="Search" valueLabel="Searches" rows={emptySearches.map((t) => ({ key: t.words, value: t.count }))} formatKey={words} />}
					/>
				</div>
			)}
			{waiting && (
				<p className="mt-4 text-sm text-ink-2" title={`Sent ${formatDay(waiting.day, true)}`}>
					{admin ? (
						<a href={admin} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
							Companies waiting for review: {formatWhole(waiting.value)} <ArrowIcon />
							<span className="sr-only">(opens {project.name}&rsquo;s admin in a new tab)</span>
						</a>
					) : (
						`Companies waiting for review: ${formatWhole(waiting.value)}`
					)}
				</p>
			)}
		</Section>
	);
}

/** Visitors who arrived through a tagged link, and what they read, with "Make a link" (open while it's being used). */
function TrackedLinks({ links, project, query, hrefFor }: { links: Awaited<ReturnType<typeof trackedLinks>>; project: Project; query: Record<string, string>; hrefFor: OverviewProps["hrefFor"] }) {
	return (
		<Section title="Tracked links" note="Visitors who arrived through a tagged link, and what they read.">
			{links.length > 0 ? (
				<ul className="divide-y divide-line rounded-2xl border border-line bg-card">
					{links.map((l) => (
						<li key={`${l.kind}:${l.label}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
							<span className="min-w-0">
								<span className="font-medium">{l.label}</span>
								{l.read.length > 0 && <span className="block truncate text-muted">Read {l.read.join(", ")}</span>}
							</span>
							<span className="tabular text-ink-2">
								{formatCount(l.visitors)} visitor{l.visitors === 1 ? "" : "s"}
							</span>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted">No visits from tracked links in this range.</p>
			)}
			<details open={Boolean(query.build)} className="group mt-3 rounded-2xl border border-line bg-card">
				<summary className="flex list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
					Make a link
					<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="text-muted transition-transform group-open:rotate-180">
						<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</summary>
				<div className="border-t border-line p-4">
					<LinkBuilder project={project} query={query} hrefFor={hrefFor} />
				</div>
			</details>
		</Section>
	);
}

/** An event's props as "domain: github.com · type: pdf", or "–" when it has none. */
function extraInfo(props: string): string {
	try {
		const entries = Object.entries(JSON.parse(props) as Record<string, unknown>);
		return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "–";
	} catch {
		return props || "–";
	}
}

// --- All the detail ----------------------------------------------------------------------

/** Outbound clicks, downloads, pages not found, and the uptime strip with its outages (both the last 30 days). */
async function AllTheDetail({
	project,
	range,
	today,
	days,
	checks,
	rawNote,
}: Pick<OverviewProps, "project" | "range" | "today"> & { days: Awaited<ReturnType<typeof uptimeDays>>; checks: Awaited<ReturnType<typeof uptimeChecks>>; rawNote?: string }) {
	const db = (await getCloudflareContext({ async: true })).env.DB;
	const raw = clampToRaw(range, today);
	const [outbound, downloads, notFound, totals] = await Promise.all([
		eventBreakdown(db, project.id, "outbound_click", raw.from, raw.to),
		eventBreakdown(db, project.id, "file_download", raw.from, raw.to),
		eventBreakdown(db, project.id, "not_found", raw.from, raw.to),
		rangeTotals(db, project.id, range.from, range.to),
	]);
	const found = outages(checks).slice(0, 10);

	return (
		<>
			<p className="text-sm text-ink-2">
				{formatCount(totals.pageviews)} page views · time on page {formatDuration(totals.avgEngagedMs)} · how far people scroll{" "}
				{formatPercent(totals.avgScrollPct === null ? null : totals.avgScrollPct / 100)}
			</p>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Outbound clicks" note={rawNote}>
					<RankedList title="Outbound clicks" keyLabel="Domain" valueLabel="Clicks" rows={outbound.map((r) => ({ key: r.key, value: r.count }))} emptyText="No outbound clicks yet." />
				</Card>
				<Card title="Downloads" note={rawNote}>
					<RankedList title="Downloads" keyLabel="File" valueLabel="Downloads" rows={downloads.map((r) => ({ key: r.key, value: r.count }))} emptyText="No downloads yet." />
				</Card>
				<Card title="Pages not found" note={rawNote}>
					<RankedList title="Pages not found" keyLabel="Path" valueLabel="Times" rows={notFound.map((r) => ({ key: r.key, value: r.count }))} emptyText="No missing pages visited." />
				</Card>
			</div>
			<Card title="Uptime" note="The last 30 days, checking the site every 5 minutes. Hover a day to see it.">
				<UptimeStrip days={days.slice(-30)} />
				<div className="mt-4">
					{found.length === 0 ? (
						<StatusBadge status="good" label="No outages in the last 30 days." />
					) : (
						<ul className="space-y-1 text-sm">
							{found.map((o) => (
								<li key={o.start}>
									<StatusBadge status="critical" label={`${formatTime(o.start)}: ${o.end ? `down for about ${formatDuration(o.end - o.start)}` : "still down"} (${o.checks} failed check${o.checks === 1 ? "" : "s"})`} />
								</li>
							))}
						</ul>
					)}
				</div>
			</Card>
		</>
	);
}

/** "Make a link": a ref for a single post or place, or UTM values for a campaign. Saves nothing. */
function LinkBuilder({ project, query, hrefFor }: { project: Project; query: Record<string, string>; hrefFor: OverviewProps["hrefFor"] }) {
	const base = query.url || project.siteUrl || "";
	let built: string | null = null;
	let problem: string | null = null;
	if (query.build) {
		try {
			const url = new URL(base);
			if (!/^https?:$/.test(url.protocol)) throw new Error();
			const clean = (v: string | undefined) => (v ?? "").trim();
			if (clean(query.ref)) {
				if (!/^[A-Za-z0-9-]{1,40}$/.test(clean(query.ref))) problem = "A name can only use letters, numbers and hyphens, up to 40.";
				else url.searchParams.set("ref", clean(query.ref));
			}
			for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
				const value = clean(query[key]).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");
				if (value) url.searchParams.set(key, value.slice(0, 50));
			}
			built = problem ? null : url.toString();
		} catch {
			problem = "Enter a full web address, starting with https://.";
		}
	}
	const input = "mt-1 w-full rounded-xl border border-line bg-card px-3 py-2";
	return (
		<div>
			<p className="mb-3 text-sm text-muted">Give it a name for one post, or say where it&rsquo;s shared (site, type, campaign).</p>
			<form method="get" className="grid gap-3 sm:grid-cols-2">
				<input type="hidden" name="build" value="1" />
				{query.range && <input type="hidden" name="range" value={query.range} />}
				<label className="text-sm sm:col-span-2">
					<span className="text-ink-2">Page address</span>
					<input name="url" type="url" required defaultValue={base} className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">Name (like linkedin-post-12)</span>
					<input name="ref" defaultValue={query.ref ?? ""} maxLength={40} pattern="[A-Za-z0-9\-]*" className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">Site (like linkedin)</span>
					<input name="utm_source" defaultValue={query.utm_source ?? ""} maxLength={50} className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">Type (like social)</span>
					<input name="utm_medium" defaultValue={query.utm_medium ?? ""} maxLength={50} className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">Campaign (like launch)</span>
					<input name="utm_campaign" defaultValue={query.utm_campaign ?? ""} maxLength={50} className={input} />
				</label>
				<div className="flex items-center gap-3 sm:col-span-2">
					<button className={buttonClass}>Make link</button>
					<Link href={hrefFor({ build: "", url: "", ref: "", utm_source: "", utm_medium: "", utm_campaign: "" })} className="link text-sm">
						Clear
					</Link>
				</div>
			</form>
			{problem && <p className="mt-3 text-sm text-critical-ink">{problem}</p>}
			{built && (
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<input readOnly value={built} aria-label="Your tracked link" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm" />
					<CopyButton text={built} />
				</div>
			)}
		</div>
	);
}

async function Events({ project, range, today, query, hrefFor }: Pick<OverviewProps, "project" | "range" | "today" | "query" | "hrefFor">) {
	const db = (await getCloudflareContext({ async: true })).env.DB;
	const raw = clampToRaw(range, today);
	const name = query.name && /^[a-z][a-z0-9_.-]{0,63}$/.test(query.name) ? query.name : null;
	const source: "browser" | "server" | null = query.source === "browser" || query.source === "server" ? query.source : null;
	const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
	const filter = { projectId: project.id, from: raw.from, to: raw.to, name, source };
	const [{ rows, total }, names] = await Promise.all([listEvents(db, filter, page), eventNames(db, project.id, addDays(today, -90))]);
	const pages = Math.max(1, Math.ceil(total / EVENTS_PAGE_SIZE));
	const csv = new URLSearchParams({ from: raw.from, to: raw.to });
	if (name) csv.set("name", name);
	if (source) csv.set("source", source);

	return (
		<Card
			title="Events"
			note={`${formatCount(total)} events. ${raw.clipped ? "From the last 90 days." : ""}`}
			action={
				<a href={`${adminHref(`/projects/${project.slug}/events.csv`)}?${csv}`} className={quietButtonClass} download>
					Download CSV
				</a>
			}
		>
			<form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
				{query.range && <input type="hidden" name="range" value={query.range} />}
				{query.from && <input type="hidden" name="from" value={query.from} />}
				{query.to && <input type="hidden" name="to" value={query.to} />}
				<label>
					<span className="block text-ink-2">Event</span>
					<select name="name" defaultValue={name ?? ""} className="select-pill mt-1 border border-line bg-card py-1.5 pl-3.5">
						<option value="">All events</option>
						{names.map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</select>
				</label>
				<label>
					<span className="block text-ink-2">Sent by</span>
					<select name="source" defaultValue={source ?? ""} className="select-pill mt-1 border border-line bg-card py-1.5 pl-3.5">
						<option value="">The site and its server</option>
						<option value="browser">The site</option>
						<option value="server">Its server</option>
					</select>
				</label>
				<button className={quietButtonClass}>Filter</button>
			</form>
			{rows.length === 0 ? (
				<Empty>No events in this range.</Empty>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-muted">
							<tr>
								<th className="pb-1 pr-3 font-medium">Time</th>
								<th className="pb-1 pr-3 font-medium">Event</th>
								<th className="pb-1 pr-3 font-medium">Page</th>
								<th className="pb-1 pr-3 font-medium">Sent by</th>
								<th className="pb-1 font-medium">Extra info</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((e) => (
								<tr key={e.id} className="border-t border-line align-top">
									<td className="whitespace-nowrap py-1.5 pr-3 tabular text-ink-2">{formatUkTime(e.ts)}</td>
									<td className="py-1.5 pr-3 font-medium">{e.name}</td>
									<td className="max-w-48 truncate py-1.5 pr-3" title={e.path ?? ""}>
										{e.path ?? "–"}
									</td>
									<td className="py-1.5 pr-3 text-ink-2">{e.source === "browser" ? "The site" : "Its server"}</td>
									<td className="py-1.5 text-xs text-ink-2">{extraInfo(e.props)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{pages > 1 && (
				<nav aria-label="Event pages" className="mt-4 flex items-center justify-between text-sm">
					{page > 1 ? (
						<Link className="link" href={hrefFor({ page: String(page - 1) })}>
							Newer
						</Link>
					) : (
						<span />
					)}
					<span className="text-muted">
						Page {page} of {pages}
					</span>
					{page < pages ? (
						<Link className="link" href={hrefFor({ page: String(page + 1) })}>
							Older
						</Link>
					) : (
						<span />
					)}
				</nav>
			)}
		</Card>
	);
}
