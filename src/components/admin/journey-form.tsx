import { CheckboxField, Hidden, SelectField, SettingsForm, TextField } from "@/components/admin/form";
import { JourneyBody } from "@/components/admin/journey-editor";
import { journeyAction } from "@/app/admin/settings/actions";
import type { Project } from "@/lib/db/projects";
import type { JourneyEntry } from "@/lib/db/settings";
import { JOURNEY_TYPES } from "@/lib/journey-types";

/** A short, dated timeline entry: type, title, a few sentences, an optional link and project. */
export function JourneyForm({ entry, projects }: { entry?: JourneyEntry; projects: Project[] }) {
	const date = entry?.publishedAt ? new Date(entry.publishedAt).toISOString().slice(0, 10) : "";
	return (
		<SettingsForm action={journeyAction} submitLabel={entry ? "Save" : "Create entry"}>
			{entry && <Hidden name="entry_id" value={entry.id} />}
			<div className="grid gap-4 sm:grid-cols-2">
				<SelectField name="type" label="Type" defaultValue={entry?.type ?? "shipped"} options={JOURNEY_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))} />
				<TextField type="date" name="published_on" label="Date" defaultValue={date} hint="Leave blank for today." />
			</div>
			<TextField name="title" label="Title" defaultValue={entry?.title} maxLength={120} />
			<JourneyBody defaultValue={entry?.bodyMd ?? ""} />
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField type="url" name="link_url" label="Link (optional)" defaultValue={entry?.linkUrl ?? ""} placeholder="https://" hint="A post, release or the thing that inspired you." />
				<SelectField
					name="project_id"
					label="Project (optional)"
					defaultValue={entry?.projectId ? String(entry.projectId) : ""}
					options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]}
				/>
			</div>
			<CheckboxField name="publish" label="Published" defaultChecked={entry ? entry.isPublished : true} hint="Unticked entries are drafts, never shown publicly." />
		</SettingsForm>
	);
}
