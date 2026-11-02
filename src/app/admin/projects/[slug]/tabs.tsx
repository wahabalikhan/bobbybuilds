import Link from "next/link";
import { CopyButton } from "@/components/admin/copy-button";
import { Card, Delta, Empty, RawNote, StatTile } from "@/components/admin/ui";
import { ColumnChart, FunnelChart, RankedList, StatusBadge, TimeSeriesChart, UptimeStrip, type Point, type Status } from "@/components/charts";
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
	rawBreakdown,
	shipping,
	uptimeChecks,
	uptimeDays,
	vitalsSeries,
	vitalsSummary,
	type DayValue,
} from "@/lib/db/dashboard";
import { formDropOff, funnel, parseFunnel } from "@/lib/db/funnel";
import type { Project } from "@/lib/db/projects";
import { change, formatCount, formatDay, formatDuration, formatMs, formatPercent, formatTime, msAxis } from "@/lib/format";
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

function flag(country: string): string {
	if (!/^[A-Z]{2}$/.test(country)) return "";
	return String.fromCodePoint(...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });
function countryName(code: string): string {
	if (!code) return "Unknown";
	try {
		return regionNames.of(code) ?? code;
	} catch {
		return code;
	}
}

// --- Traffic ---------------------------------------------------------------------------

export async function TrafficTab({ db, project, range }: TabProps) {
	const [totals, previous, visitors, previousVisitors, pages, referrers, recent, metrics] = await Promise.all([
		rangeTotals(db, project.id, range.from, range.to),
		rangeTotals(db, project.id, range.previousFrom, range.previousTo),
		dailySeries(db, project.id, "visitors", range.from, range.to),
		dailySeries(db, project.id, "visitors", range.previousFrom, range.previousTo),
		ranked(db, "pages", project.id, range.from, range.to),
		ranked(db, "referrers", project.id, range.from, range.to),
		listEvents(db, { projectId: project.id, from: addDays(range.to, -90), to: range.to }),
		listMetrics(db, project.id),
	]);
	const returning = metrics.find((m) => m.key === "returning_users" && m.source === "product");
	const returningFigure = returning ? await metricFigure(db, returning, range.to) : null;
	const period = "the period before";

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<StatTile label="Visitors" value={formatCount(totals.visitors)} delta={<Delta value={change(totals.visitors, previous.visitors)} period={period} />} />
				<StatTile label="Page views" value={formatCount(totals.pageviews)} delta={<Delta value={change(totals.pageviews, previous.pageviews)} period={period} />} />
				<StatTile
					label="Came back the same day"
					value={formatPercent(totals.visitors ? totals.repeatVisitors / totals.visitors : null)}
					hint={`${formatCount(totals.repeatVisitors)} visitors returned after 30+ minutes away`}
				/>
				<StatTile label="Average engaged time" value={formatDuration(totals.avgEngagedMs)} hint="Time with the tab visible, per page view" />
				<StatTile label="Average scroll depth" value={formatPercent(totals.avgScrollPct === null ? null : totals.avgScrollPct / 100)} />
			</div>
			{returningFigure && (
				<p className="text-sm text-ink-2">
					Returning users, as {project.name} counts them: <span className="font-medium text-ink">{returningFigure.value === null ? "not sent yet" : formatCount(returningFigure.value)}</span>{" "}
					<span className="text-muted">({returningFigure.period})</span>
				</p>
			)}
			<Card title="Visitors per day" note={`${range.label}, with the ${range.days} days before in grey.`}>
				<TimeSeriesChart
					title={`${project.name} visitors per day`}
					series={[
						{ label: range.label, points: toPoints(visitors) },
						{ label: "Previous period", points: toPoints(previousVisitors), tone: "previous" },
					]}
					unitLabel="visitors"
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
			</div>
			<Card title="Recent events" note="The latest 20. See the Events tab for everything, with filters and CSV.">
				<EventTable rows={recent.rows.slice(0, 20)} />
			</Card>
		</div>
	);
}

// --- Campaigns -------------------------------------------------------------------------

export async function CampaignsTab({ db, project, range, query, hrefFor }: TabProps) {
	const [refs, utm] = await Promise.all([ranked(db, "refs", project.id, range.from, range.to, 20), campaigns(db, project.id, range.from, range.to)]);

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

	return (
		<div className="space-y-6">
			<Card title="Tracked links" note="Visits that arrived with ?ref= in the address. Kept forever in the roll-ups.">
				<RankedList title="Tracked links" keyLabel="Ref" rows={refs.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }))} emptyText="No tracked links used in this range yet. Make one below." />
			</Card>
			<Card title="Campaigns" note="UTM source, medium and campaign, cleaned to lower case.">
				{utm.length === 0 ? (
					<Empty>No campaign visits in this range.</Empty>
				) : (
					<table className="w-full text-sm tabular">
						<thead className="text-left text-muted">
							<tr>
								<th className="pb-1 font-medium">Source</th>
								<th className="pb-1 font-medium">Medium</th>
								<th className="pb-1 font-medium">Campaign</th>
								<th className="pb-1 text-right font-medium">Visitors</th>
								<th className="pb-1 text-right font-medium">Views</th>
							</tr>
						</thead>
						<tbody>
							{utm.map((c) => (
								<tr key={`${c.source}|${c.medium}|${c.campaign}`} className="border-t border-line">
									<td className="py-1.5">{c.source || "–"}</td>
									<td className="py-1.5">{c.medium || "–"}</td>
									<td className="py-1.5">{c.campaign || "–"}</td>
									<td className="py-1.5 text-right">{formatCount(c.visitors)}</td>
									<td className="py-1.5 text-right text-ink-2">{formatCount(c.pageviews)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>
			<Card title="Make a tracked link" note="Add a ref for a single post or place, or UTM values for a campaign.">
				<form method="get" className="grid gap-3 sm:grid-cols-2">
					<input type="hidden" name="tab" value="campaigns" />
					<input type="hidden" name="build" value="1" />
					{query.range && <input type="hidden" name="range" value={query.range} />}
					<label className="text-sm sm:col-span-2">
						<span className="text-ink-2">Page address</span>
						<input name="url" type="url" required defaultValue={base} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">Ref (e.g. linkedin-post-12)</span>
						<input name="ref" defaultValue={query.ref ?? ""} maxLength={40} pattern="[A-Za-z0-9\-]*" className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">utm_source (e.g. linkedin)</span>
						<input name="utm_source" defaultValue={query.utm_source ?? ""} maxLength={50} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">utm_medium (e.g. social)</span>
						<input name="utm_medium" defaultValue={query.utm_medium ?? ""} maxLength={50} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2" />
					</label>
					<label className="text-sm">
						<span className="text-ink-2">utm_campaign (e.g. launch-week)</span>
						<input name="utm_campaign" defaultValue={query.utm_campaign ?? ""} maxLength={50} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2" />
					</label>
					<div className="flex items-center gap-3 sm:col-span-2">
						<button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">Make link</button>
						<Link href={hrefFor({ tab: "campaigns", build: "", url: "", ref: "", utm_source: "", utm_medium: "", utm_campaign: "" })} className="text-sm text-muted underline underline-offset-2">
							Clear
						</Link>
					</div>
				</form>
				{problem && <p className="mt-3 text-sm text-critical">{problem}</p>}
				{built && (
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<input readOnly value={built} aria-label="Your tracked link" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm" />
						<CopyButton text={built} />
					</div>
				)}
			</Card>
		</div>
	);
}

// --- Audience --------------------------------------------------------------------------

export async function AudienceTab({ db, project, range, today }: TabProps) {
	const raw = clampToRaw(range, today);
	const [countries, totals, browsers, systems, screens, languages] = await Promise.all([
		ranked(db, "countries", project.id, range.from, range.to, 15),
		rangeTotals(db, project.id, range.from, range.to),
		rawBreakdown(db, project.id, "browser", raw.from, raw.to),
		rawBreakdown(db, project.id, "os", raw.from, raw.to),
		rawBreakdown(db, project.id, "screen", raw.from, raw.to),
		rawBreakdown(db, project.id, "language", raw.from, raw.to),
	]);
	const devices = [
		{ key: "Desktop", value: totals.devices.desktop },
		{ key: "Mobile", value: totals.devices.mobile },
		{ key: "Tablet", value: totals.devices.tablet },
		{ key: "Other", value: totals.devices.other },
	].filter((d) => d.value > 0);
	const screenLabel: Record<string, string> = {
		small: "Small (under 640px)",
		medium: "Medium (640–1023px)",
		large: "Large (1024–1439px)",
		xlarge: "Extra large (1440px+)",
		unknown: "Unknown",
	};
	const rows = (list: { key: string; visitors: number; pageviews: number }[]) => list.map((r) => ({ key: r.key, value: r.visitors, secondary: r.pageviews }));

	return (
		<div className="space-y-6">
			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Countries" note="From Cloudflare. Kept forever in the roll-ups.">
					<RankedList
						title="Countries"
						keyLabel="Country"
						rows={rows(countries)}
						formatKey={(key) => (
							<>
								<span aria-hidden>{flag(key)} </span>
								{countryName(key)}
							</>
						)}
					/>
				</Card>
				<Card title="Devices" note="Visitors by device type.">
					<RankedList title="Devices" keyLabel="Device" rows={devices} />
				</Card>
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Browsers" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Browsers" keyLabel="Browser" rows={rows(browsers)} formatKey={capitalise} />
				</Card>
				<Card title="Operating systems" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Operating systems" keyLabel="System" rows={rows(systems)} formatKey={osName} />
				</Card>
				<Card title="Screen sizes" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Screen sizes" keyLabel="Screen" rows={rows(screens)} formatKey={(k) => screenLabel[k] ?? k} />
				</Card>
				<Card title="Languages" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Languages" keyLabel="Language" rows={rows(languages)} formatKey={languageName} />
				</Card>
			</div>
		</div>
	);
}

const capitalise = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : "Unknown");
const OS_NAMES: Record<string, string> = { windows: "Windows", macos: "macOS", ios: "iOS", android: "Android", linux: "Linux", chromeos: "ChromeOS", other: "Other" };
const osName = (value: string) => OS_NAMES[value] ?? value;
const languageNames = new Intl.DisplayNames(["en-GB"], { type: "language" });
function languageName(code: string): string {
	if (!code) return "Unknown";
	try {
		return languageNames.of(code) ?? code;
	} catch {
		return code;
	}
}

// --- Funnel ----------------------------------------------------------------------------

export async function FunnelTab({ db, project, range, today }: TabProps) {
	const raw = clampToRaw(range, today);
	const steps = parseFunnel(project.funnel);
	const [result, forms] = await Promise.all([funnel(db, project.id, steps, raw.from, raw.to), formDropOff(db, project.id, raw.from, raw.to)]);
	const first = result[0]?.visitors ?? 0;
	const lastStep = result.at(-1);

	return (
		<div className="space-y-6">
			<Card
				title="Funnel"
				note={
					<>
						Each step counts visitors who did it after the step before, on the same day (visitor IDs reset daily). <RawNote clipped={raw.clipped} />
					</>
				}
			>
				{steps.length === 0 ? (
					<Empty>No funnel steps yet. You&rsquo;ll be able to add them in settings (coming in the next part).</Empty>
				) : (
					<>
						<FunnelChart steps={result} />
						{lastStep && first > 0 && (
							<p className="mt-4 text-sm text-ink-2">
								{formatPercent(lastStep.visitors / first, 1)} of visitors who started made it to the last step.
							</p>
						)}
					</>
				)}
			</Card>
			<Card title="Form drop-off" note="Visitors who sent form_started, and how many then sent form_submitted the same day.">
				{forms.length === 0 ? (
					<Empty>No form events yet. Send bobby.track(&quot;form_started&quot;, &#123; form: &quot;contact&quot; &#125;) and form_submitted from your forms.</Empty>
				) : (
					<table className="w-full text-sm tabular">
						<thead className="text-left text-muted">
							<tr>
								<th className="pb-1 font-medium">Form</th>
								<th className="pb-1 text-right font-medium">Started</th>
								<th className="pb-1 text-right font-medium">Submitted</th>
								<th className="pb-1 text-right font-medium">Completion</th>
							</tr>
						</thead>
						<tbody>
							{forms.map((f) => (
								<tr key={f.form} className="border-t border-line">
									<td className="py-1.5">{f.form}</td>
									<td className="py-1.5 text-right">{formatCount(f.started)}</td>
									<td className="py-1.5 text-right">{formatCount(f.submitted)}</td>
									<td className="py-1.5 text-right">{formatPercent(f.rate)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>
		</div>
	);
}

// --- Performance -----------------------------------------------------------------------

/** Google's Core Web Vitals thresholds (at the 75th percentile). */
export const VITALS = {
	lcp: { name: "Largest Contentful Paint", short: "LCP", good: 2500, poor: 4000, format: formatMs },
	cls: { name: "Cumulative Layout Shift", short: "CLS", good: 100, poor: 250, format: (milli: number) => (milli / 1000).toFixed(2) },
	inp: { name: "Interaction to Next Paint", short: "INP", good: 200, poor: 500, format: formatMs },
} as const;

export function vitalStatus(kind: keyof typeof VITALS, value: number | null): Status {
	if (value === null) return "none";
	const t = VITALS[kind];
	return value <= t.good ? "good" : value <= t.poor ? "warning" : "serious";
}

export async function PerformanceTab({ db, project, range, today }: TabProps) {
	const raw = clampToRaw(range, today);
	const [series, summary, notFound, outbound, downloads] = await Promise.all([
		vitalsSeries(db, project.id, range.from, range.to),
		vitalsSummary(db, project.id, raw.from, raw.to),
		eventBreakdown(db, project.id, "not_found", raw.from, raw.to),
		eventBreakdown(db, project.id, "outbound_click", raw.from, raw.to),
		eventBreakdown(db, project.id, "file_download", raw.from, raw.to),
	]);

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-3">
				{(Object.keys(VITALS) as (keyof typeof VITALS)[]).map((kind) => {
					const value = summary[kind];
					return (
						<StatTile
							key={kind}
							label={`${VITALS[kind].name} (${VITALS[kind].short})`}
							value={value === null ? "–" : VITALS[kind].format(value)}
							delta={<StatusBadge status={vitalStatus(kind, value)} />}
							hint={`75th percentile from ${formatCount(summary.samples)} page loads. Good is ${VITALS[kind].format(VITALS[kind].good)} or less.`}
						/>
					);
				})}
			</div>
			{(Object.keys(VITALS) as (keyof typeof VITALS)[]).map((kind) => (
				<Card key={kind} title={`${VITALS[kind].short} per day`} note="75th percentile each day. The lines mark Google's good and poor thresholds.">
					<TimeSeriesChart
						title={`${VITALS[kind].name} per day`}
						series={[{ label: VITALS[kind].short, points: series.map((d) => ({ day: d.day, value: d.samples ? d[kind] : null })) }]}
						format={VITALS[kind].format}
						axisFormat={kind === "cls" ? undefined : msAxis}
						height={160}
						references={[
							{ value: VITALS[kind].good, label: "Good" },
							{ value: VITALS[kind].poor, label: "Poor" },
						]}
					/>
				</Card>
			))}
			<div className="grid gap-6 lg:grid-cols-3">
				<Card title="Pages not found" note={<RawNote clipped={raw.clipped} />}>
					<RankedList title="Pages not found" keyLabel="Path" valueLabel="Times" rows={notFound.map((r) => ({ key: r.key, value: r.count }))} emptyText="No 404s recorded." />
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

// --- Uptime ----------------------------------------------------------------------------

export async function UptimeTab({ db, project, today, now }: TabProps) {
	if (!project.healthUrl) return <Empty>This project has no health URL, so it isn&rsquo;t being checked.</Empty>;
	const [days, checks] = await Promise.all([uptimeDays(db, project.id, addDays(today, -89), today), uptimeChecks(db, project.id, now - 30 * 86_400_000)]);
	const last24 = checks.filter((c) => c.checkedAt >= now - 86_400_000);
	const latest = checks.at(-1);
	const found = outages(checks).slice(0, 10);
	const upChecks = days.reduce((t, d) => t + d.up, 0);
	const allChecks = days.reduce((t, d) => t + d.checks, 0);

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-3">
				<StatTile
					label="Right now"
					value={latest ? (latest.up ? "Up" : "Down") : "–"}
					delta={<StatusBadge status={latest ? (latest.up ? "good" : "critical") : "none"} label={latest ? `Checked ${formatTime(latest.checkedAt)}` : "No checks yet"} />}
					hint={project.healthUrl}
				/>
				<StatTile label="Uptime, last 90 days" value={formatPercent(allChecks ? upChecks / allChecks : null, 2)} hint={`${formatCount(allChecks)} checks, every 5 minutes`} />
				<StatTile label="Average response, last 24 hours" value={formatMs(avg(last24.filter((c) => c.up).map((c) => c.responseMs ?? 0)))} />
			</div>
			<Card title="Daily uptime" note="Last 90 days. Hover a day for the detail.">
				<UptimeStrip days={days} />
			</Card>
			<Card title="Response time" note="Average of successful checks each day.">
				<TimeSeriesChart title="Average response time per day" series={[{ label: "Response time", points: days.map((d) => ({ day: d.day, value: d.avgResponseMs })) }]} format={formatMs} axisFormat={msAxis} height={160} />
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
		</div>
	);
}

function avg(values: number[]): number | null {
	return values.length ? values.reduce((t, v) => t + v, 0) / values.length : null;
}

// --- Shipping --------------------------------------------------------------------------

export async function ShippingTab({ db, project, today }: TabProps) {
	if (!project.githubRepo) return <Empty>This project has no GitHub repo set.</Empty>;
	const { weeks, streak, synced } = await shipping(db, project.id, today);
	if (!synced) return <Empty>No commits synced yet. The daily job fetches them at 00:10 UTC.</Empty>;
	const thisWeek = weeks.at(-1)!;

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-3">
				<StatTile label="Current streak" value={`${streak.current} week${streak.current === 1 ? "" : "s"}`} hint="Weeks in a row with at least one commit (Monday to Sunday, UTC)" />
				<StatTile label="Longest streak" value={`${streak.longest} week${streak.longest === 1 ? "" : "s"}`} />
				<StatTile label="Commits this week" value={formatCount(thisWeek.commits)} hint="So far. The week isn't over yet." />
			</div>
			<Card title="Commits per week" note={`${project.githubRepo}, default branch, last 26 weeks. The last column is this week so far.`}>
				<ColumnChart
					title="Commits per week"
					bars={weeks.map((w) => ({ label: formatDay(w.week), detail: `Week of ${formatDay(w.week, true)}`, value: w.commits }))}
				/>
			</Card>
		</div>
	);
}

// --- Product numbers -------------------------------------------------------------------

export async function NumbersTab({ db, project, range }: TabProps) {
	const metrics = await listMetrics(db, project.id);
	if (metrics.length === 0) return <Empty>No numbers set up for this project.</Empty>;
	const data = await Promise.all(metrics.map(async (m) => ({ metric: m, series: await metricSeries(db, m, range.from, range.to), figure: await metricFigure(db, m, range.to) })));
	const SOURCE: Record<string, string> = { collector: "From page views", event: "From events", product: `Sent by ${project.name}` };

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			{data.map(({ metric, series, figure }) => (
				<Card
					key={metric.id}
					title={metric.label}
					note={
						<>
							{SOURCE[metric.source]}
							{metric.eventName ? ` (${metric.eventName})` : ""} · {metric.isPublic ? (metric.isHeadline ? "Public, shown on the card" : "Public") : "Private"}
						</>
					}
				>
					<p className="mb-2 text-2xl font-semibold tracking-tight">
						{figure.value === null ? "–" : formatCount(figure.value)}
						{metric.unit && <span className="text-base font-normal text-ink-2"> {metric.unit}</span>}{" "}
						<span className="text-sm font-normal text-muted">{metric.source === "product" ? "latest" : `in ${range.label.toLowerCase()}: ${formatCount(sum(series))}`}</span>
					</p>
					<TimeSeriesChart title={`${metric.label} per day`} series={[{ label: metric.label, points: toPoints(series) }]} height={140} />
				</Card>
			))}
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
							<td className="max-w-48 truncate py-1.5 pr-3" title={e.path ?? ""}>{e.path ?? "–"}</td>
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
				<a href={`${adminHref(`/projects/${project.slug}/events.csv`)}?${csv}`} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-[var(--accent-wash)]" download>
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
					<select name="name" defaultValue={name ?? ""} className="mt-1 rounded-lg border border-line bg-card px-2 py-1.5">
						<option value="">All events</option>
						{names.map((n) => (
							<option key={n} value={n}>{n}</option>
						))}
					</select>
				</label>
				<label>
					<span className="block text-ink-2">From</span>
					<select name="source" defaultValue={source ?? ""} className="mt-1 rounded-lg border border-line bg-card px-2 py-1.5">
						<option value="">Browser and server</option>
						<option value="browser">Browser</option>
						<option value="server">Server</option>
					</select>
				</label>
				<button className="rounded-lg border border-line px-3 py-1.5 hover:bg-[var(--accent-wash)]">Filter</button>
			</form>
			<EventTable rows={rows} />
			{pages > 1 && (
				<nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
					{page > 1 ? <Link className="underline underline-offset-2" href={hrefFor({ page: String(page - 1) })}>Newer</Link> : <span />}
					<span className="text-muted">Page {page} of {pages}</span>
					{page < pages ? <Link className="underline underline-offset-2" href={hrefFor({ page: String(page + 1) })}>Older</Link> : <span />}
				</nav>
			)}
		</Card>
	);
}
