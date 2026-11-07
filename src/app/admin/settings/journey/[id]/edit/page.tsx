import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BackLink } from "@/components/admin/back-link";
import { JourneyForm } from "@/components/admin/journey-form";
import { EntryStatus, PageHeader } from "@/components/admin/ui";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { listProjects } from "@/lib/db/projects";
import { getJourney } from "@/lib/db/settings";
import { adminHref } from "@/lib/site";

export const metadata: Metadata = { title: "Edit entry" };

/** Editing an entry: its status as a dot at the top, then the one-column form. */
export default async function EditJourneyEntry({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { env } = await getCloudflareContext({ async: true });
	const entryId = Number.parseInt(id, 10);
	const entry = Number.isInteger(entryId) ? await getJourney(env.DB, entryId) : null;
	if (!entry) return <AdminNotFoundMessage what="That journey entry doesn't exist." />;
	const projects = await listProjects(env.DB);
	return (
		<div className="max-w-xl space-y-6">
			<div className="space-y-3">
				<BackLink href={adminHref("/settings/journey")}>Journey</BackLink>
				<PageHeader title="Edit entry" subtitle={<EntryStatus published={entry.isPublished} />} />
			</div>
			<section className="rounded-2xl border border-line bg-card p-4">
				<JourneyForm entry={entry} projects={projects} />
			</section>
		</div>
	);
}
