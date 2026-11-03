import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { JourneyForm } from "@/components/admin/journey-form";
import { listProjects } from "@/lib/db/projects";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { adminHref, site } from "@/lib/site";

export default async function NewJourneyEntry() {
	// Hidden until the journey comes back (site.showJourney); the code and table stay. Shown as
	// "not found" inside the admin layout, like any unknown admin address.
	if (!site.showJourney) return <AdminNotFoundMessage />;
	const { env } = await getCloudflareContext({ async: true });
	const projects = await listProjects(env.DB);
	return (
		<div className="max-w-3xl space-y-6">
			<div>
				<Link href={adminHref("/settings/journey")} className="text-sm text-muted hover:text-ink">
					← Journey
				</Link>
				<h1 className="mt-2 text-2xl font-semibold tracking-tight">New entry</h1>
			</div>
			<section className="rounded-2xl border border-line bg-card p-5">
				<JourneyForm projects={projects} />
			</section>
		</div>
	);
}
