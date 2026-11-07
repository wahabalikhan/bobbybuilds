import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BackLink } from "@/components/admin/back-link";
import { EntryActions } from "@/components/admin/entry-actions";
import { ToastOnLoad } from "@/components/admin/toast";
import { EntryStatus } from "@/components/admin/ui";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { JourneyList } from "@/components/public/journey";
import { requestTime } from "@/lib/admin/clock";
import { utcDay } from "@/lib/days";
import { listProjects } from "@/lib/db/projects";
import { getJourney } from "@/lib/db/settings";
import { renderMarkdown } from "@/lib/markdown";
import { adminHref } from "@/lib/site";

export const metadata: Metadata = { title: "Journey entry" };

/**
 * An entry as it looks on the public page (the public journey's own entry design), with its status
 * as a dot and its three actions: Edit, Publish or Unpublish, and Delete (which asks first).
 */
export default async function JourneyEntryView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
	const [{ id }, query] = await Promise.all([params, searchParams]);
	const { env } = await getCloudflareContext({ async: true });
	const entryId = Number.parseInt(id, 10);
	const entry = Number.isInteger(entryId) ? await getJourney(env.DB, entryId) : null;
	if (!entry) return <AdminNotFoundMessage what="That journey entry doesn't exist." />;
	const projects = await listProjects(env.DB);
	// The public page names only public projects.
	const project = entry.projectId ? projects.find((p) => p.id === entry.projectId && p.showPublic) : undefined;
	const day = entry.publishedAt ? new Date(entry.publishedAt).toISOString().slice(0, 10) : utcDay(requestTime());
	return (
		<div className="space-y-6">
			{query.created && <ToastOnLoad tone="success" text={entry.isPublished ? "Entry published." : "Draft saved."} param="created" />}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<BackLink href={adminHref("/settings/journey")}>Journey</BackLink>
				<EntryStatus published={entry.isPublished} />
			</div>
			<section aria-label="As it looks on your public page" className="rounded-2xl border border-line bg-card p-6">
				<JourneyList entries={[{ slug: entry.slug, type: entry.type, day, title: entry.title, html: renderMarkdown(entry.bodyMd), linkUrl: entry.linkUrl, projectName: project?.name ?? null }]} />
			</section>
			<EntryActions id={entry.id} published={entry.isPublished} editHref={adminHref(`/settings/journey/${entry.id}/edit`)} />
		</div>
	);
}
