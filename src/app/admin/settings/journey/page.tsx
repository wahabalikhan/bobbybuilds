import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { JourneyBrowser } from "@/components/admin/journey-browser";
import { ToastOnLoad } from "@/components/admin/toast";
import { buttonClass, EmptyState, iconButtonClass, PageHeader, PlusIcon, Tooltip } from "@/components/admin/ui";
import { listProjects } from "@/lib/db/projects";
import { listJourney } from "@/lib/db/settings";
import { formatLongDay } from "@/lib/format";
import { JOURNEY_TYPES, journeyType } from "@/lib/journey-types";
import { adminHref } from "@/lib/site";

export const metadata: Metadata = { title: "Journey" };

/**
 * The journey: short, dated entries for the public page, newest first, with one row of filters
 * (search, Type, Status) that update as you choose (JourneyBrowser). Each entry opens its view, as
 * it looks on the public page.
 */
export default async function JourneyList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	const { env } = await getCloudflareContext({ async: true });
	const [entries, projects, params] = await Promise.all([listJourney(env.DB), listProjects(env.DB), searchParams]);
	const projectName = new Map(projects.map((p) => [p.id, p.name]));
	const initial = {
		q: (params.q ?? "").slice(0, 100),
		type: JOURNEY_TYPES.some((t) => t.value === params.type) ? (params.type as string) : "",
		status: params.status === "published" || params.status === "draft" ? params.status : "",
	};

	return (
		<div className="space-y-6">
			{params.deleted && <ToastOnLoad tone="info" text="Entry deleted." param="deleted" />}
			<PageHeader
				title="Journey"
				subtitle="Short, dated entries for your public page."
				action={
					<Tooltip text="Add an entry">
						<Link href={adminHref("/settings/journey/new")} aria-label="Add an entry" className={iconButtonClass}>
							<PlusIcon />
						</Link>
					</Tooltip>
				}
			/>

			{entries.length === 0 ? (
				<EmptyState
					icon="🚀"
					title="No entries yet"
					action={
						<Link href={adminHref("/settings/journey/new")} className={buttonClass}>
							Add an entry
						</Link>
					}
				>
					Add the first thing you shipped, decided or learned. It shows on your public page once it&rsquo;s published.
				</EmptyState>
			) : (
				<JourneyBrowser
					initial={initial}
					types={JOURNEY_TYPES.filter((t) => entries.some((e) => e.type === t.value)).map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))}
					entries={entries.map((e) => {
						const t = journeyType(e.type);
						const project = e.projectId ? (projectName.get(e.projectId) ?? "") : "";
						return {
							id: e.id,
							href: adminHref(`/settings/journey/${e.id}`),
							title: e.title,
							type: e.type,
							typeLabel: t.label,
							emoji: t.emoji,
							detail: [t.label, e.publishedAt ? formatLongDay(new Date(e.publishedAt).toISOString().slice(0, 10)) : null, project || null].filter(Boolean).join(" · "),
							published: e.isPublished,
							// What the search looks through: the title, text, type and project.
							text: `${e.title} ${e.bodyMd} ${t.label} ${project}`.toLowerCase(),
						};
					})}
				/>
			)}
		</div>
	);
}
