import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/admin/copy-button";
import { buttonClass, Card, Delta, Empty, quietButtonClass, RangePicker } from "@/components/admin/ui";
import { FunnelChart, RankedList, StatusBadge, UptimeStrip, type Status } from "@/components/charts";
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
import { WeekChart } from "@/components/public/mono-charts";
import { funnel, parseFunnel } from "@/lib/db/funnel";
import type { Project } from "@/lib/db/projects";
import { change, formatCount, formatDay, formatDuration, formatPercent, formatTime, formatWhole } from "@/lib/format";
import { adminHref } from "@/lib/site";

export type OverviewProps = {
	project: Project;
	range: DateRange;
	today: string;
	now: number;
	query: Record<string, string>;
	hrefFor: (changes: Record<string, string>) => string;
};

/** Query values that mean "More detail" was being used, so it opens again after the page reloads. */
const DETAIL_PARAMS = ["build", "name", "source", "page"];

/**
 * A project at a glance, one scrolling page: visitors, top pages and sources, tracked links,
 * searches, the funnel and health, each only when there's something to show. Everything else
 * is in "More detail", closed by default.
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
		ranked(db, "pages", project.id, range.from, range.to, 10),
		ranked(db, "referrers", project.id, range.from, range.to, 10),
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
	const detailOpen = DETAIL_PARAMS.some((key) => query[key]);

	return (
		<div className="space-y-8">
			<Headline project={project} range={range} today={today} visitors={totals.visitors} previous={previous.visitors} series={visitors} hrefFor={hrefFor} />

			<div className="grid gap-6 md:grid-cols-2">
				<Top title="Top pages" rows={pages.slice(0, 5).map((p) => ({ label: p.key, value: p.visitors }))} empty="No page views in this range." />
				<Top title="Top sources" rows={sources.slice(0, 5).map((r) => ({ label: sourceName(r.key), value: r.visitors }))} empty="No visits in this range." />
			</div>

			{links.length > 0 && (
				<Section title="Tracked links" note="Visitors who arrived through a tagged link, and what they read.">
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
				</Section>
			)}

			{searches && (
				<Section title="Searches" note={`${formatWhole(searches.searches)} searches in ${range.label.toLowerCase()}${searches.noResults ? `, ${formatWhole(searches.noResults)} found nothing` : ""}.`}>
					<div className="grid gap-6 md:grid-cols-2">
						<Top title="Top searches" rows={topSearches.slice(0, 5).map((t) => ({ label: t.words || "(filters only)", value: t.count }))} empty="No searches in this range." />
						<Top title="Found nothing" rows={emptySearches.slice(0, 5).map((t) => ({ label: t.words || "(filters only)", value: t.count }))} empty="Every search found something." />
					</div>
				</Section>
			)}

			<SearchHealth numbers={numbers} today={today} />

			{funnelResult.length > 0 && (
				<Section title="Funnel">
					<p className="text-sm text-ink-2">{funnelResult.map((step) => `${step.label} ${formatWhole(step.visitors)}`).join(" → ")}</p>
				</Section>
			)}

			<Health project={project} days={days} latestUp={checks.at(-1)?.up ?? null} broken={broken} />

			<details open={detailOpen} className="group rounded-2xl border border-line bg-card">
				<summary className="flex list-none items-center justify-between gap-3 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
					More detail
					<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="text-muted transition-transform group-open:rotate-180">
						<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</summary>
				<div className="space-y-6 border-t border-line p-5">
					<MoreDetail project={project} range={range} today={today} now={now} query={query} hrefFor={hrefFor} pages={pages} sources={sources} topSearches={topSearches} emptySearches={emptySearches} funnelResult={funnelResult} days={days} checks={checks} />
				</div>
			</details>
		</div>
	);
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
	return (
		<section>
			<h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
			{note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
			<div className="mt-3">{children}</div>
		</section>
	);
}

/** A short ranked list: label on the left, visitors (or count) on the right. */
function Top({ title, rows, empty }: { title: string; rows: { label: string; value: number }[]; empty: string }) {
	return (
		<section>
			<h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
			{rows.length === 0 ? (
				<p className="mt-2 text-sm text-muted">{empty}</p>
			) : (
				<ol className="mt-2 divide-y divide-line text-sm">
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
		<section aria-label="Visitors" className="rounded-2xl border border-line bg-card p-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<p className="flex flex-wrap items-baseline gap-x-2 text-ink-2">
					<span className="text-3xl font-semibold tracking-tight tabular text-ink">{formatWhole(visitors)}</span>
					visitors, {range.label.toLowerCase()}
					<Delta value={change(visitors, previous)} period="previous" />
				</p>
				<div className="text-xs [&_a]:text-xs">
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

/** One line: uptime over 90 days and broken links. Amber or red only when there's a problem. */
function Health({ project, days, latestUp, broken }: { project: Project; days: { checks: number; up: number }[]; latestUp: boolean | null; broken: number }) {
	const checks = days.reduce((t, d) => t + d.checks, 0);
	const up = days.reduce((t, d) => t + d.up, 0);
	const ratio = checks ? up / checks : null;
	const status: Status = latestUp === false ? "critical" : (ratio !== null && ratio < 0.99) || broken > 0 ? "warning" : ratio === null ? "none" : "good";
	const parts = [
		!project.siteUrl ? "No site address, so uptime isn't checked" : ratio === null ? "Not checked yet" : `Up ${formatPercent(ratio, ratio >= 0.9995 ? 0 : 2)} in the last 90 days`,
		`${formatWhole(broken)} broken link${broken === 1 ? "" : "s"}`,
	];
	if (latestUp === false) parts.unshift("Down right now");
	return (
		<Section title="Health">
			<p className={`text-sm ${status === "good" || status === "none" ? "text-ink-2" : ""}`}>
				{status === "good" || status === "none" ? parts.join(" · ") : <StatusBadge status={status} label={parts.join(" · ")} />}
			</p>
		</Section>
	);
}

/**
 * Search health as one line, from the product numbers a project's server sends each day
 * (Tech Jobs: searches_failed, median_search_ms). Admin only. Only when either has a value; amber
 * when any search failed.
 */
function SearchHealth({ numbers, today }: { numbers: Map<string, { value: number; day: string }>; today: string }) {
	const failed = numbers.get("searches_failed");
	const median = numbers.get("median_search_ms");
	if (!failed && !median) return null;
	const day = [failed?.day, median?.day].filter((d): d is string => !!d).sort().at(-1)!;
	const when = day === today ? "today" : day === addDays(today, -1) ? "yesterday" : `on ${formatDay(day)}`;
	const parts = [
		failed && `${formatWhole(failed.value)} failed search${failed.value === 1 ? "" : "es"}`,
		median && `median search time ${formatWhole(median.value)} ms`,
	].filter((p): p is string => !!p);
	const text = `${parts.join(" · ").replace(/^./, (c) => c.toUpperCase())} ${when}`;
	return (
		<Section title="Search health">
			<p className={`text-sm ${failed && failed.value > 0 ? "" : "text-ink-2"}`}>{failed && failed.value > 0 ? <StatusBadge status="warning" label={text} /> : text}</p>
		</Section>
	);
}

// --- More detail -------------------------------------------------------------------------

async function MoreDetail({
	project,
	range,
	today,
	query,
	hrefFor,
	pages,
	sources,
	topSearches,
	emptySearches,
	funnelResult,
	days,
	checks,
}: OverviewProps & {
	pages: { key: string; visitors: number; pageviews: number }[];
	sources: { key: string; visitors: number; pageviews: number }[];
	topSearches: { words: string; count: number }[];
	emptySearches: { words: string; count: number }[];
	funnelResult: Awaited<ReturnType<typeof funnel>>;
	days: Awaited<ReturnType<typeof uptimeDays>>;
	checks: Awaited<ReturnType<typeof uptimeChecks>>;
}) {
	const db = (await getCloudflareContext({ async: true })).env.DB;
	const raw = clampToRaw(range, today);
	const [outbound, downloads, notFound, totals] = await Promise.all([
		eventBreakdown(db, project.id, "outbound_click", raw.from, raw.to),
		eventBreakdown(db, project.id, "file_download", raw.from, raw.to),
		eventBreakdown(db, project.id, "not_found", raw.from, raw.to),
		rangeTotals(db, project.id, range.from, range.to),
	]);
	const found = outages(checks).slice(0, 10);
	const words = (w: string) => w || "(filters only)";
	const rawNote = raw.clipped ? "From the last 90 days (detail older than that is deleted)." : undefined;

	return (
		<>
			<p className="text-sm text-ink-2">
				{formatCount(totals.pageviews)} page views · average engaged time {formatDuration(totals.avgEngagedMs)} · average scroll depth{" "}
				{formatPercent(totals.avgScrollPct === null ? null : totals.avgScrollPct / 100)}
			</p>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Pages">
					<RankedList title="Pages" keyLabel="Page" rows={pages.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))} />
				</Card>
				<Card title="Sources" note="Where visitors came from. Direct means no referrer was sent.">
					<RankedList title="Sources" keyLabel="Source" rows={sources.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))} formatKey={sourceName} />
				</Card>
				<Card title="Outbound clicks" note={rawNote}>
					<RankedList title="Outbound clicks" keyLabel="Domain" valueLabel="Clicks" rows={outbound.map((r) => ({ key: r.key, value: r.count }))} emptyText="No outbound clicks yet." />
				</Card>
				<Card title="Downloads" note={rawNote}>
					<RankedList title="Downloads" keyLabel="File" valueLabel="Downloads" rows={downloads.map((r) => ({ key: r.key, value: r.count }))} emptyText="No downloads yet." />
				</Card>
				{(topSearches.length > 0 || emptySearches.length > 0) && (
					<>
						<Card title="All searches" note={rawNote}>
							<RankedList title="All searches" keyLabel="Search" valueLabel="Searches" rows={topSearches.map((t) => ({ key: t.words, value: t.count }))} formatKey={words} />
						</Card>
						<Card title="Searches that found nothing">
							<RankedList title="Searches that found nothing" keyLabel="Search" valueLabel="Searches" rows={emptySearches.map((t) => ({ key: t.words, value: t.count }))} formatKey={words} emptyText="Every search found something." />
						</Card>
					</>
				)}
				<Card title="Pages not found" note={rawNote}>
					<RankedList title="Pages not found" keyLabel="Path" valueLabel="Times" rows={notFound.map((r) => ({ key: r.key, value: r.count }))} emptyText="No 404s recorded." />
				</Card>
			</div>
			{funnelResult.length > 0 && (
				<Card title="Funnel" note="Each step counts visitors who did it after the step before, on the same day.">
					<FunnelChart steps={funnelResult} />
				</Card>
			)}
			<Card title="Uptime" note="The last 90 days, checking the site address every 5 minutes. Hover a day for the detail.">
				<UptimeStrip days={days} />
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
			<LinkBuilder project={project} query={query} hrefFor={hrefFor} />
			<Events project={project} range={range} today={today} query={query} hrefFor={hrefFor} />
		</>
	);
}

/** A ref for a single post or place, or UTM values for a campaign. */
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
				if (!/^[A-Za-z0-9-]{1,40}$/.test(clean(query.ref))) problem = "A ref can only use letters, numbers and hyphens, up to 40.";
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
		<Card title="Make a tracked link" note="Add a ref for a single post or place, or UTM values (source, medium, name).">
			<form method="get" className="grid gap-3 sm:grid-cols-2">
				<input type="hidden" name="build" value="1" />
				{query.range && <input type="hidden" name="range" value={query.range} />}
				<label className="text-sm sm:col-span-2">
					<span className="text-ink-2">Page address</span>
					<input name="url" type="url" required defaultValue={base} className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">Ref (e.g. linkedin-post-12)</span>
					<input name="ref" defaultValue={query.ref ?? ""} maxLength={40} pattern="[A-Za-z0-9\-]*" className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">utm_source (e.g. linkedin)</span>
					<input name="utm_source" defaultValue={query.utm_source ?? ""} maxLength={50} className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">utm_medium (e.g. social)</span>
					<input name="utm_medium" defaultValue={query.utm_medium ?? ""} maxLength={50} className={input} />
				</label>
				<label className="text-sm">
					<span className="text-ink-2">utm_campaign (e.g. launch-post)</span>
					<input name="utm_campaign" defaultValue={query.utm_campaign ?? ""} maxLength={50} className={input} />
				</label>
				<div className="flex items-center gap-3 sm:col-span-2">
					<button className={buttonClass}>Make link</button>
					<Link href={hrefFor({ build: "", url: "", ref: "", utm_source: "", utm_medium: "", utm_campaign: "" })} className="text-sm text-muted underline underline-offset-2">
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
		</Card>
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
					<select name="name" defaultValue={name ?? ""} className="mt-1 rounded-full border border-line bg-card px-3 py-1.5">
						<option value="">All events</option>
						{names.map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</select>
				</label>
				<label>
					<span className="block text-ink-2">From</span>
					<select name="source" defaultValue={source ?? ""} className="mt-1 rounded-full border border-line bg-card px-3 py-1.5">
						<option value="">Browser and server</option>
						<option value="browser">Browser</option>
						<option value="server">Server</option>
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
								<th className="pb-1 pr-3 font-medium">Time (UTC)</th>
								<th className="pb-1 pr-3 font-medium">Event</th>
								<th className="pb-1 pr-3 font-medium">Path</th>
								<th className="pb-1 pr-3 font-medium">From</th>
								<th className="pb-1 font-medium">Details</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((e) => (
								<tr key={e.id} className="border-t border-line align-top">
									<td className="whitespace-nowrap py-1.5 pr-3 tabular text-ink-2">{formatTime(e.ts)}</td>
									<td className="py-1.5 pr-3 font-medium">{e.name}</td>
									<td className="max-w-48 truncate py-1.5 pr-3" title={e.path ?? ""}>
										{e.path ?? "–"}
									</td>
									<td className="py-1.5 pr-3 text-ink-2">{e.source === "browser" ? "Browser" : "Server"}</td>
									<td className="py-1.5 font-mono text-xs text-ink-2">{e.props === "{}" ? "–" : e.props}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{pages > 1 && (
				<nav aria-label="Event pages" className="mt-4 flex items-center justify-between text-sm">
					{page > 1 ? (
						<Link className="underline underline-offset-2" href={hrefFor({ page: String(page - 1) })}>
							Newer
						</Link>
					) : (
						<span />
					)}
					<span className="text-muted">
						Page {page} of {pages}
					</span>
					{page < pages ? (
						<Link className="underline underline-offset-2" href={hrefFor({ page: String(page + 1) })}>
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
