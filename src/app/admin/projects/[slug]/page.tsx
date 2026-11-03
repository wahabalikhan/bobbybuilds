import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { Breadcrumb, Pill, ProjectLogo, RangePicker, StatusPill, Tabs } from "@/components/admin/ui";
import { ArrowIcon } from "@/components/public/icons";
import { parseRange } from "@/lib/admin/range";
import { requestTime } from "@/lib/admin/clock";
import { addDays, utcDay } from "@/lib/days";
import { hasEvent, listMetrics, publicProductNumbers } from "@/lib/db/dashboard";
import { parseFunnel } from "@/lib/db/funnel";
import { getProjectBySlug } from "@/lib/db/projects";
import { logoFor } from "@/lib/project-logo";
import { productLine } from "@/lib/public/product-line";
import { adminHref } from "@/lib/site";
import { availableTabs, type TabKey } from "./tab-list";
import { EventsTab, FunnelTab, HealthTab, NumbersTab, SearchesTab, TrackedLinksTab, TrafficTab, type TabProps } from "./tabs";

const RENDER: Record<TabKey, (props: TabProps) => Promise<React.ReactNode>> = {
	traffic: TrafficTab,
	links: TrackedLinksTab,
	searches: SearchesTab,
	funnel: FunnelTab,
	numbers: NumbersTab,
	health: HealthTab,
	events: EventsTab,
};

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
	const metrics = await listMetrics(env.DB, project.id);
	const tabs = availableTabs({
		hasSearches: await hasEvent(env.DB, project.id, "search", addDays(today, -90), today),
		hasFunnel: parseFunnel(project.funnel).length > 0,
		hasProductNumbers: metrics.some((m) => m.source === "product"),
	});
	// Old tab names from bookmarks land on their new home.
	const requested = ({ campaigns: "links", uptime: "health", performance: "health" } as Record<string, string>)[query.tab] ?? query.tab;
	const tab: TabKey = tabs.some((t) => t.key === requested) ? (requested as TabKey) : "traffic";

	const base = adminHref(`/projects/${project.slug}`);
	const hrefFor = (changes: Record<string, string>) => {
		const next = new URLSearchParams({ ...query, ...changes });
		if (changes.range && changes.range !== "custom") {
			next.delete("from");
			next.delete("to");
		}
		if (!("page" in changes)) next.delete("page");
		for (const [key, value] of [...next]) if (value === "") next.delete(key);
		return `${base}?${next}`;
	};

	const Tab = RENDER[tab];
	const numbers = productLine(await publicProductNumbers(env.DB, project.id, today), today);

	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: project.name }]} />
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-3">
						<ProjectLogo name={project.name} logoPath={logoFor(project)} size={36} />
						<h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
						<StatusPill status={project.status} />
						{project.siteUrl && (
							<a href={project.siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
								Visit site <ArrowIcon />
								<span className="sr-only">(opens in a new tab)</span>
							</a>
						)}
					</div>
					{numbers && <Pill title="Its public numbers, as the public card shows them">{numbers}</Pill>}
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
				<Tabs tabs={tabs} current={tab} hrefFor={(key) => hrefFor({ tab: key })} />
				<RangePicker range={range} hrefFor={hrefFor} hidden={{ tab }} />
			</div>
			<Tab db={env.DB} project={project} range={range} today={today} now={now} query={query} hrefFor={hrefFor} />
		</div>
	);
}
