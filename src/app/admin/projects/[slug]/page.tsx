import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { Pill, ProjectLogo, RangePicker, StatusPill, Tabs } from "@/components/admin/ui";
import { parseRange } from "@/lib/admin/range";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { listMetrics, metricFigure } from "@/lib/db/dashboard";
import { getProjectBySlug } from "@/lib/db/projects";
import { formatCount } from "@/lib/format";
import { adminHref } from "@/lib/site";
import { AudienceTab, CampaignsTab, EventsTab, FunnelTab, NumbersTab, PerformanceTab, ShippingTab, TrafficTab, UptimeTab, type TabProps } from "./tabs";

const TABS = [
	{ key: "traffic", label: "Traffic" },
	{ key: "campaigns", label: "Campaigns" },
	{ key: "audience", label: "Audience" },
	{ key: "funnel", label: "Funnel" },
	{ key: "performance", label: "Performance" },
	{ key: "uptime", label: "Uptime" },
	{ key: "shipping", label: "Shipping" },
	{ key: "numbers", label: "Product numbers" },
	{ key: "events", label: "Events" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const RENDER: Record<TabKey, (props: TabProps) => Promise<React.ReactNode>> = {
	traffic: TrafficTab,
	campaigns: CampaignsTab,
	audience: AudienceTab,
	funnel: FunnelTab,
	performance: PerformanceTab,
	uptime: UptimeTab,
	shipping: ShippingTab,
	numbers: NumbersTab,
	events: EventsTab,
};

// Tabs whose content doesn't depend on the date range.
const NO_RANGE: TabKey[] = ["uptime", "shipping"];

export default async function ProjectDashboard({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { slug } = await params;
	const raw = await searchParams;
	const query: Record<string, string> = {};
	for (const [key, value] of Object.entries(raw)) if (typeof value === "string") query[key] = value.slice(0, 200);

	const { env } = await getCloudflareContext({ async: true });
	const project = await getProjectBySlug(env.DB, slug);
	if (!project) return <AdminNotFoundMessage what={`There’s no project called “${slug.slice(0, 60)}”.`} />;

	const now = requestTime();
	const today = utcDay(now);
	const range = parseRange(query, today);
	const tab: TabKey = TABS.some((t) => t.key === query.tab) ? (query.tab as TabKey) : "traffic";

	const base = adminHref(`/projects/${project.slug}`);
	const hrefFor = (changes: Record<string, string>) => {
		const next = new URLSearchParams({ ...query, ...changes });
		if (changes.range && changes.range !== "custom") {
			next.delete("from");
			next.delete("to");
		}
		if (!("page" in changes)) next.delete("page");
		return `${base}?${next}`;
	};

	const Tab = RENDER[tab];
	const headlineMetric = (await listMetrics(env.DB, project.id)).find((m) => m.isHeadline);
	const headline = headlineMetric ? await metricFigure(env.DB, headlineMetric, today) : null;

	return (
		<div className="space-y-6">
			<div>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-3">
						<ProjectLogo name={project.name} logoPath={project.logoPath} size={36} />
						<h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
						<StatusPill status={project.status} />
					</div>
					{headlineMetric && headline?.value !== null && headline && (
						<Pill title={`${headlineMetric.label}, ${headline.period}`}>
							{formatCount(headline.value!)} {headlineMetric.unit || headlineMetric.label.toLowerCase()} · {headline.period}
						</Pill>
					)}
				</div>
				<p className="mt-2 text-ink-2">
					{project.tagline}
					{project.siteUrl && (
						<>
							{" · "}
							<a className="underline decoration-line underline-offset-4 hover:decoration-ink" href={project.siteUrl} rel="noopener noreferrer" target="_blank">
								{new URL(project.siteUrl).host}
							</a>
						</>
					)}
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
				<Tabs tabs={[...TABS]} current={tab} hrefFor={(key) => hrefFor({ tab: key })} />
				{!NO_RANGE.includes(tab) && <RangePicker range={range} hrefFor={hrefFor} hidden={{ tab }} />}
			</div>
			<Tab db={env.DB} project={project} range={range} today={today} now={now} query={query} hrefFor={hrefFor} />
		</div>
	);
}
