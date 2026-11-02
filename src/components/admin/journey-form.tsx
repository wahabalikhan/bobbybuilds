import { CheckboxField, Hidden, SelectField, SettingsForm, TextField } from "@/components/admin/form";
import { JourneyBody } from "@/components/admin/journey-editor";
import { journeyAction } from "@/app/admin/settings/actions";
import type { Project } from "@/lib/db/projects";
import type { JourneyEntry } from "@/lib/db/settings";

export function JourneyForm({ entry, projects }: { entry?: JourneyEntry; projects: Project[] }) {
	const publishedOn = entry?.publishedAt ? new Date(entry.publishedAt).toISOString().slice(0, 10) : "";
	return (
		<SettingsForm action={journeyAction} submitLabel={entry ? "Save" : "Create entry"}>
			{entry && <Hidden name="entry_id" value={entry.id} />}
			<TextField name="title" label="Title" defaultValue={entry?.title} maxLength={120} />
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField name="slug" label="Slug" defaultValue={entry?.slug} maxLength={80} hint="Leave blank to make one from the title." />
				<SelectField
					name="project_id"
					label="Project"
					defaultValue={entry?.projectId ? String(entry.projectId) : ""}
					options={[{ value: "", label: "General (no project)" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]}
				/>
			</div>
			<JourneyBody defaultValue={entry?.bodyMd ?? ""} />
			<div className="grid gap-4 sm:grid-cols-2">
				<CheckboxField name="publish" label="Published" defaultChecked={entry?.isPublished} hint="Unticked entries are drafts, never shown publicly." />
				<TextField type="date" name="published_on" label="Publish date" defaultValue={publishedOn} hint="Leave blank for today." />
			</div>
		</SettingsForm>
	);
}
