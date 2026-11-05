import { StatusDot } from "@/components/status-dot";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { Breadcrumb, ProjectLogo, Tabs } from "@/components/admin/ui";
import { ArrowIcon } from "@/components/public/icons";
import { parseRange } from "@/lib/admin/range";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { latestUptime, publicProductNumbers } from "@/lib/db/dashboard";
import { getProjectBySlug } from "@/lib/db/projects";
import { logoFor } from "@/lib/project-logo";
import { productLine } from "@/lib/public/product-line";
import { adminHref } from "@/lib/site";
import { Overview } from "./overview";
import { ProjectSettingsTab } from "./settings";
import { PROJECT_TABS, tabFor } from "./tabs";

/** "Tech Jobs · BobbyBuilds HQ", or "Tech Jobs settings · BobbyBuilds HQ" on the Settings tab. */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
	const [{ slug }, query] = await Promise.all([params, searchParams]);
	const { env } = await getCloudflareContext({ async: true });
	const project = await getProjectBySlug(env.DB, slug);
	if (!project) return { title: "Not found" };
	return { title: tabFor(typeof query.tab === "string" ? query.tab : undefined) === "settings" ? `${project.name} settings` : project.name };
}

/** A project: Overview (at a glance, with detail tucked away) and Settings. */
export default async function ProjectPage({
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
	const tab = tabFor(query.tab);
	const base = adminHref(`/projects/${project.slug}`);
	const hrefFor = (changes: Record<string, string>) => {
		const next = new URLSearchParams({ ...query, ...changes });
		if (changes.range && changes.range !== "custom") {
			next.delete("from");
			next.delete("to");
		}
		if (!("page" in changes)) next.delete("page");
		next.delete("tab");
		for (const [key, value] of [...next]) if (value === "") next.delete(key);
		const search = next.toString();
		return search ? `${base}?${search}` : base;
	};
	const numbers = productLine(await publicProductNumbers(env.DB, project.id, today), today);
	const up = (await latestUptime(env.DB, now)).get(project.id) ?? null;

	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: project.name }]} />
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-3">
						<ProjectLogo name={project.name} logoPath={logoFor(project)} size={36} />
						<h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
						<StatusDot status={project.status} up={up} />
						{!project.showPublic && <span className="text-sm text-muted">Not on your public page</span>}
						{project.siteUrl && (
							<a href={project.siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
								Visit site <ArrowIcon />
								<span className="sr-only">(opens in a new tab)</span>
							</a>
						)}
					</div>
					{numbers && (
						<p className="text-sm font-semibold tabular text-ink" title="Its public numbers, as the public card shows them">
							{numbers}
						</p>
					)}
				</div>
			</div>
			<div className="border-b border-line pb-4">
				<Tabs tabs={[...PROJECT_TABS]} current={tab} hrefFor={(key) => (key === "settings" ? `${base}?tab=settings` : base)} />
			</div>
			{tab === "settings" ? (
				<ProjectSettingsTab project={project} />
			) : (
				<Overview project={project} range={parseRange(query, today)} today={today} now={now} query={query} hrefFor={hrefFor} />
			)}
		</div>
	);
}
