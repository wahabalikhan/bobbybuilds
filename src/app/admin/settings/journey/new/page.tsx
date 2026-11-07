import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BackLink } from "@/components/admin/back-link";
import { JourneyForm } from "@/components/admin/journey-form";
import { EntryStatus, PageHeader } from "@/components/admin/ui";
import { listProjects } from "@/lib/db/projects";
import { adminHref } from "@/lib/site";

export const metadata: Metadata = { title: "New journey entry" };

export default async function NewJourneyEntry() {
	const { env } = await getCloudflareContext({ async: true });
	const projects = await listProjects(env.DB);
	return (
		<div className="max-w-xl space-y-6">
			<div className="space-y-3">
				<BackLink href={adminHref("/settings/journey")}>Journey</BackLink>
				<PageHeader title="New entry" subtitle={<EntryStatus published={false} />} />
			</div>
			<section className="rounded-2xl border border-line bg-card p-4">
				<JourneyForm projects={projects} />
			</section>
		</div>
	);
}
