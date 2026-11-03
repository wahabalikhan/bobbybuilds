import Link from "next/link";
import { CopyButton } from "@/components/admin/copy-button";
import { buttonClass, Card, Delta, Empty, quietButtonClass, RawNote, StatTile } from "@/components/admin/ui";
import { FunnelChart, RankedList, StatusBadge, TimeSeriesChart, UptimeStrip, type Point } from "@/components/charts";
import { clampToRaw, type DateRange } from "@/lib/admin/range";
import { addDays } from "@/lib/days";
import {
	campaigns,
	dailySeries,
	EVENTS_PAGE_SIZE,
	eventBreakdown,
	eventNames,
	listEvents,
	listMetrics,
	metricFigure,
	metricSeries,
	outages,
	ranked,
	rangeTotals,
	refPages,
	searchCounts,
	searchTerms,
	uptimeChecks,
	uptimeDays,
	type DayValue,
} from "@/lib/db/dashboard";
import { funnel, parseFunnel } from "@/lib/db/funnel";
import type { Project } from "@/lib/db/projects";
import { change, formatCount, formatDuration, formatMs, formatPercent, formatTime } from "@/lib/format";
import { adminHref } from "@/lib/site";

export type TabProps = {
	db: D1Database;
	project: Project;
	range: DateRange;
	today: string;
	now: number;
	query: Record<string, string>;
	hrefFor: (changes: Record<string, string>) => string;
};

const toPoints = (values: DayValue[]): Point[] => values.map((v) => ({ day: v.day, value: v.value }));
const sum = (values: DayValue[]) => values.reduce((t, v) => t + v.value, 0);

// --- Traffic ---------------------------------------------------------------------------

export async function TrafficTab({ db, project, range, today }: TabProps) {
	const raw = clampToRaw(range, today);
	const [totals, previous, visitors, previousVisitors, pages, referrers, outbound, downloads] = await Promise.all([
		rangeTotals(db, project.id, range.from, range.to),
		rangeTotals(db, project.id, range.previousFrom, range.previousTo),
		dailySeries(db, project.id, "visitors", range.from, range.to),
		dailySeries(db, project.id, "visitors", range.previousFrom, range.previousTo),
		ranked(db, "pages", project.id, range.from, range.to),
		ranked(db, "referrers", project.id, range.from, range.to),
		eventBreakdown(db, project.id, "outbound_click", raw.from, raw.to),
		eventBreakdown(db, project.id, "file_download", raw.from, raw.to),
	]);
	const period = "previous";

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile label="Visitors" value={formatCount(totals.visitors)} delta={<Delta value={change(totals.visitors, previous.visitors)} period={period} />} />
				<StatTile label="Page views" value={formatCount(totals.pageviews)} delta={<Delta value={change(totals.pageviews, previous.pageviews)} period={period} />} />
				<StatTile label="Average engaged time" value={formatDuration(totals.avgEngagedMs)} hint="Time with the tab visible, per page view" />
				<StatTile label="Average scroll depth" value={formatPercent(totals.avgScrollPct === null ? null : totals.avgScrollPct / 100)} />
			</div>
			<Card title="Visitors per day" note={`${range.label}, with the ${range.days} days before in grey.`}>
				<TimeSeriesChart
					title={`${project.name} visitors per day`}
					series={[
						{ label: range.label, points: toPoints(visitors) },
						{ label: "Previous period", points: toPoints(previousVisitors), tone: "previous" },
					]}
					unitLabel="visitors"
					unfinishedLast={range.to === today}
				/>
			</Card>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Top pages">
					<RankedList title="Top pages" keyLabel="Page" rows={pages.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))} />
				</Card>
				<Card title="Referrers" note="Domain only. Direct means no referrer was sent.">
					<RankedList
						title="Referrers"
						keyLabel="Referrer"
						rows={referrers.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))}
						formatKey={(key) => key || "Direct or unknown"}
					/>
				</Card>
				<Card title="Outbound clicks" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Outbound clicks" keyLabel="Domain" valueLabel="Clicks" rows={outbound.map((r) => ({ key: r.key, value: r.count }))} emptyText="No outbound clicks yet." />
				</Card>
				<Card title="Downloads" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Downloads" keyLabel="File" valueLabel="Downloads" rows={downloads.map((r) => ({ key: r.key, value: r.count }))} emptyText="No downloads yet." />
				</Card>
			</div>
		</div>
	);
}

// --- Tracked links ---------------------------------------------------------------------

/** A ref as typed in a link: letters, numbers and hyphens, up to 40. */
const isRef = (value: string | undefined): value is string => Boolean(value && /^[A-Za-z0-9-]{1,40}$/.test(value));

export async function TrackedLinksTab({ db, project, range, today, query, hrefFor }: TabProps) {
	const raw = clampToRaw(range, today);
	const reading = isRef(query.read) ? query.read : null;
	const [refs, utm, read] = await Promise.all([
		ranked(db, "refs", project.id, range.from, range.to, 20),
		campaigns(db, project.id, range.from, range.to),
		reading ? refPages(db, project.id, reading, raw.from, raw.to) : Promise.resolve(null),
	]);

	const base = query.url || project.siteUrl || "";
	let built: string | null = null;
	let problem: string | null = null;
	if (query.build) {
		try {
			const url = new URL(base);
			if (!/^https?:$/.test(url.protocol)) throw new Error();
			const clean = (v: string | undefined) => (v ?? "").trim();
			if (clean(query.ref)) {
				if (!isRef(clean(query.ref))) problem = "A ref can only use letters, numbers and hyphens, up to 40.";
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

	return (
		<div className="space-y-6">
			<Card title="Tracked links" note="Visits that arrived with ?ref= in the address. Choose one to see what it read.">
				{refs.length === 0 ? (
					<Empty>No tracked links used in this range yet. Make one below.</Empty>
				) : (
					<table className="w-full text-sm tabular">
						<thead className="text-left text-muted">
							<tr>
								<th className="pb-1 font-medium">Ref</th>
								<th className="pb-1 text-right font-medium">Visitors</th>
								<th className="pb-1 text-right font-medium">Views</th>
							</tr>
						</thead>
						<tbody>
							{refs.map((r) => (
								<tr key={r.key} className="border-t border-line">
									<td className="py-1.5">
										<Link href={hrefFor({ tab: "links", read: r.key === reading ? "" : r.key })} className={`underline decoration-line underline-offset-4 hover:decoration-ink ${r.key === reading ? "font-semibold" : ""}`} aria-current={r.key === reading ? "true" : undefined}>
											{r.key}
										</Link>
									</td>
									<td className="py-1.5 text-right">{formatCount(r.visitors)}</td>
									<td className="py-1.5 text-right text-ink-2">{formatCount(r.pageviews)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>
			{reading && read && (
				<Card
					title={`What ${reading} read`}
					note={
						<>
							Pages viewed by visitors who arrived with ?ref={reading}. <RawNote clipped={raw.clipped} />
						</>
					}
				>
					<RankedList title={`Pages read from ${reading}`} keyLabel="Page" rows={read.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))} emptyText="No page views with this ref in the last 90 days." />
				</Card>
			)}
			<Card title="Make a tracked link" note="Add a ref for a single post or place, or UTM values for a campaign.">
				<form method="get" className="grid gap-3 sm:grid-cols-2">
					<input type="hidden" name="tab" value="links" />
					<input type="hidden" name="build" value="1" />
					{query.range && <input type="hidden" name="range" value={query.range} />}
					<label className="text-sm sm:col-span-2">
						<span className="text-ink-2">Page address</span>
						<input name="url" type="url" required defaultValue={base} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">Ref (e.g. linkedin-post-12)</span>
						<input name="ref" defaultValue={query.ref ?? ""} maxLength={40} pattern="[A-Za-z0-9\-]*" className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">utm_source (e.g. linkedin)</span>
						<input name="utm_source" defaultValue={query.utm_source ?? ""} maxLength={50} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">utm_medium (e.g. social)</span>
						<input name="utm_medium" defaultValue={query.utm_medium ?? ""} maxLength={50} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">utm_campaign (e.g. launch-week)</span>
						<input name="utm_campaign" defaultValue={query.utm_campaign ?? ""} maxLength={50} className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2" />
					</label>
					<div className="flex items-center gap-3 sm:col-span-2">
						<button className={buttonClass}>Make link</button>
						<Link href={hrefFor({ tab: "links", build: "", url: "", ref: "", utm_source: "", utm_medium: "", utm_campaign: "" })} className="text-sm text-muted underline underline-offset-2">
							Clear
						</Link>
					</div>
				</form>
				{problem && <p className="mt-3 text-sm text-critical">{problem}</p>}
				{built && (
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<input readOnly value={built} aria-label="Your tracked link" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm" />
						<CopyButton text={built} />
					</div>
				)}
			</Card>
			<section aria-labelledby="utm-heading">
				<h3 id="utm-heading" className="mb-2 text-sm font-medium text-ink-2">
					UTM campaigns
				</h3>
				{utm.length === 0 ? (
					<p className="text-sm text-muted">No campaign visits in this range.</p>
				) : (
					<table className="w-full text-sm tabular">
						<thead className="text-left text-muted">
							<tr>
								<th className="pb-1 font-medium">Source</th>
								<th className="pb-1 font-medium">Medium</th>
								<th className="pb-1 font-medium">Campaign</th>
								<th className="pb-1 text-right font-medium">Visitors</th>
							</tr>
						</thead>
						<tbody>
							{utm.map((c) => (
								<tr key={`${c.source}|${c.medium}|${c.campaign}`} className="border-t border-line">
									<td className="py-1.5">{c.source || "–"}</td>
									<td className="py-1.5">{c.medium || "–"}</td>
									<td className="py-1.5">{c.campaign || "–"}</td>
									<td className="py-1.5 text-right">{formatCount(c.visitors)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>
		</div>
	);
}

// --- Searches --------------------------------------------------------------------------

export async function SearchesTab({ db, project, range, today }: TabProps) {
	const raw = clampToRaw(range, today);
	const [counts, top, empty] = await Promise.all([
		searchCounts(db, project.id, raw.from, raw.to),
		searchTerms(db, project.id, "search", raw.from, raw.to),
		searchTerms(db, project.id, "search_no_results", raw.from, raw.to),
	]);
	const words = (w: string) => w || "(filters only, no words)";

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-3">
				<StatTile label="Searches" value={formatCount(counts.searches)} />
				<StatTile label="Found nothing" value={formatCount(counts.noResults)} />
				<StatTile label="Share that found nothing" value={formatPercent(counts.searches ? counts.noResults / counts.searches : null)} />
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Most common searches" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Most common searches" keyLabel="Search" valueLabel="Searches" rows={top.map((t) => ({ key: t.words, value: t.count }))} formatKey={words} emptyText="No searches in this range." />
				</Card>
				<Card title="Searches with no results" note="Worth checking: roles people want that aren't listed.">
					<RankedList title="Searches with no results" keyLabel="Search" valueLabel="Searches" rows={empty.map((t) => ({ key: t.words, value: t.count }))} formatKey={words} emptyText="Every search found something." />
				</Card>
			</div>
		</div>
	);
}

// --- Funnel ----------------------------------------------------------------------------

export async function FunnelTab({ db, project, range, today }: TabProps) {
	const raw = clampToRaw(range, today);
	const steps = parseFunnel(project.funnel);
	const result = await funnel(db, project.id, steps, raw.from, raw.to);
	const first = result[0]?.visitors ?? 0;
	const lastStep = result.at(-1);

	return (
		<Card
			title="Funnel"
			note={
				<>
					Each step counts visitors who did it after the step before, on the same day (visitor IDs reset daily). <RawNote clipped={raw.clipped} />
				</>
			}
		>
			<FunnelChart steps={result} />
			{lastStep && first > 0 && <p className="mt-4 text-sm text-ink-2">{formatPercent(lastStep.visitors / first, 1)} of visitors who started made it to the last step.</p>}
		</Card>
	);
}

// --- Product numbers -------------------------------------------------------------------

export async function NumbersTab({ db, project, range, today }: TabProps) {
	const metrics = (await listMetrics(db, project.id)).filter((m) => m.source === "product");
	if (metrics.length === 0) return <Empty>{project.name} doesn&rsquo;t send any product numbers.</Empty>;
	const data = await Promise.all(metrics.map(async (m) => ({ metric: m, series: await metricSeries(db, m, range.from, range.to), figure: await metricFigure(db, m, range.to) })));

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			{data.map(({ metric, series, figure }) => (
				<Card key={metric.id} title={metric.label} note={`Sent by ${project.name} · ${metric.isPublic ? "public" : "private"}`}>
					<p className="mb-2 text-2xl font-semibold tracking-tight">
						{figure.value === null ? "–" : formatCount(figure.value)}
						{metric.unit && <span className="text-base font-normal text-ink-2"> {metric.unit}</span>} <span className="text-sm font-normal text-muted">latest</span>
					</p>
					<TimeSeriesChart title={`${metric.label} per day`} series={[{ label: metric.label, points: toPoints(series) }]} height={140} unfinishedLast={range.to === today} />
					{series.length > 0 && <p className="sr-only">Total over the range: {formatCount(sum(series))}</p>}
				</Card>
			))}
		</div>
	);
}

// --- Health ----------------------------------------------------------------------------

export async function HealthTab({ db, project, range, today, now }: TabProps) {
	const raw = clampToRaw(range, today);
	const [notFound, days, checks] = await Promise.all([
		eventBreakdown(db, project.id, "not_found", raw.from, raw.to),
		project.healthUrl ? uptimeDays(db, project.id, addDays(today, -89), today) : Promise.resolve([]),
		project.healthUrl ? uptimeChecks(db, project.id, now - 30 * 86_400_000) : Promise.resolve([]),
	]);
	const latest = checks.at(-1);
	const found = outages(checks).slice(0, 10);
	const upChecks = days.reduce((t, d) => t + d.up, 0);
	const allChecks = days.reduce((t, d) => t + d.checks, 0);
	const last24 = checks.filter((c) => c.checkedAt >= now - 86_400_000 && c.up);
	const avgMs = last24.length ? last24.reduce((t, c) => t + (c.responseMs ?? 0), 0) / last24.length : null;

	return (
		<div className="space-y-6">
			<Card title="Pages not found" note={<RawNote clipped={raw.clipped} />}>
				<RankedList title="Pages not found" keyLabel="Path" valueLabel="Times" rows={notFound.map((r) => ({ key: r.key, value: r.count }))} emptyText="No 404s recorded." />
			</Card>
			{!project.healthUrl ? (
				<Empty>This project has no health address, so its uptime isn&rsquo;t checked. Add one in Settings.</Empty>
			) : (
				<>
					<div className="grid gap-3 sm:grid-cols-3">
						<StatTile
							label="Right now"
							value={latest ? (latest.up ? "Up" : "Down") : "–"}
							delta={<StatusBadge status={latest ? (latest.up ? "good" : "critical") : "none"} label={latest ? `Checked ${formatTime(latest.checkedAt)}` : "No checks yet"} />}
							hint={project.healthUrl}
						/>
						<StatTile label="Uptime, last 90 days" value={formatPercent(allChecks ? upChecks / allChecks : null, 2)} hint={`${formatCount(allChecks)} checks, every 5 minutes`} />
						<StatTile label="Average response, last 24 hours" value={formatMs(avgMs)} />
					</div>
					<Card title="Daily uptime" note="Last 90 days. Hover a day for the detail.">
						<UptimeStrip days={days} />
					</Card>
					<Card title="Recent outages" note="Runs of failed checks in the last 30 days.">
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
					</Card>
				</>
			)}
		</div>
	);
}

// --- Events ----------------------------------------------------------------------------

function EventTable({ rows }: { rows: { id: number; ts: number; source: string; name: string; path: string | null; props: string }[] }) {
	if (rows.length === 0) return <Empty>No events in this range.</Empty>;
	return (
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
	);
}

export async function EventsTab({ db, project, range, today, query, hrefFor }: TabProps) {
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
			note={
				<>
					{formatCount(total)} events. <RawNote clipped={raw.clipped} />
				</>
			}
			action={
				<a href={`${adminHref(`/projects/${project.slug}/events.csv`)}?${csv}`} className={quietButtonClass} download>
					Download CSV
				</a>
			}
		>
			<form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
				<input type="hidden" name="tab" value="events" />
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
			<EventTable rows={rows} />
			{pages > 1 && (
				<nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
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
