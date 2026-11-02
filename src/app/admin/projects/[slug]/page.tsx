import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { RangePicker, StatusPill, Tabs } from "@/components/admin/ui";
import { parseRange } from "@/lib/admin/range";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { getProjectBySlug } from "@/lib/db/projects";
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
	if (!project) notFound();

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

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
						<StatusPill status={project.status} />
					</div>
					<p className="text-sm text-muted">
						{project.tagline}
						{project.siteUrl && (
							<>
								{" · "}
								<a className="underline underline-offset-2" href={project.siteUrl} rel="noopener noreferrer" target="_blank">
									{new URL(project.siteUrl).host}
								</a>
							</>
						)}
					</p>
				</div>
				{!NO_RANGE.includes(tab) && <RangePicker range={range} hrefFor={hrefFor} hidden={{ tab }} />}
			</div>
			<Tabs tabs={[...TABS]} current={tab} hrefFor={(key) => hrefFor({ tab: key })} />
			<Tab db={env.DB} project={project} range={range} today={today} now={now} query={query} hrefFor={hrefFor} />
		</div>
	);
}
