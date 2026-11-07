import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { JourneyForm } from "@/components/admin/journey-form";
import { Breadcrumb, PageHeader } from "@/components/admin/ui";
import { listProjects } from "@/lib/db/projects";
import { adminHref } from "@/lib/site";

export const metadata: Metadata = { title: "New journey entry" };

export default async function NewJourneyEntry() {
	const { env } = await getCloudflareContext({ async: true });
	const projects = await listProjects(env.DB);
	return (
		<div className="max-w-3xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Journey", href: adminHref("/settings/journey") }, { label: "New entry" }]} />
				<PageHeader title="New entry" subtitle="Something you shipped, decided or learned." />
			</div>
			<section className="rounded-2xl border border-line bg-card p-4">
				<JourneyForm projects={projects} />
			</section>
		</div>
	);
}
