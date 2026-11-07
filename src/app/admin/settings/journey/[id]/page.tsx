import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CheckboxField, Hidden, SettingsForm } from "@/components/admin/form";
import { JourneyForm } from "@/components/admin/journey-form";
import { Breadcrumb } from "@/components/admin/ui";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { listProjects } from "@/lib/db/projects";
import { getJourney } from "@/lib/db/settings";
import { adminHref } from "@/lib/site";
import { journeyAction } from "../../actions";

export const metadata: Metadata = { title: "Journey entry" };

export default async function EditJourneyEntry({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
	const { id } = await params;
	const query = await searchParams;
	const { env } = await getCloudflareContext({ async: true });
	const entryId = Number.parseInt(id, 10);
	const entry = Number.isInteger(entryId) ? await getJourney(env.DB, entryId) : null;
	if (!entry) return <AdminNotFoundMessage what="That journey entry doesn't exist." />;
	const projects = await listProjects(env.DB);
	return (
		<div className="max-w-3xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Journey", href: adminHref("/settings/journey") }, { label: entry.title }]} />
				<h1 className="text-3xl font-bold tracking-tight">{entry.title}</h1>
				{query.created && <p role="status" className="mt-1 text-sm text-good-ink">✓ Entry created.</p>}
			</div>
			<section className="rounded-2xl border border-line bg-card p-4">
				<JourneyForm entry={entry} projects={projects} />
			</section>
			<details className="rounded-2xl border border-line bg-card p-4">
				<summary className="text-[15px] font-medium tracking-tight">Delete this entry</summary>
				<div className="mt-4">
					<SettingsForm action={journeyAction} submitLabel="Delete entry for good" danger>
						<Hidden name="entry_id" value={entry.id} />
						<Hidden name="intent" value="delete" />
						<CheckboxField name="confirm" label="Delete it, and take it off your public page. This can't be undone." />
					</SettingsForm>
				</div>
			</details>
		</div>
	);
}
