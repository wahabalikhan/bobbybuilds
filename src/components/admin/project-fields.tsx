import { SelectField, TextArea, TextField } from "@/components/admin/form";
import type { Project } from "@/lib/db/projects";
import { LOGOS } from "@/lib/logos.generated";

/** The project details fields, shared by "New project" and the Details section. */
export function ProjectFields({ project }: { project?: Project }) {
	return (
		<>
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField name="name" label="Name" defaultValue={project?.name} maxLength={60} required />
				<TextField name="slug" label="Slug" defaultValue={project?.slug} maxLength={40} hint="Used in addresses. Leave blank to make one from the name." />
			</div>
			<TextField name="tagline" label="Tagline" defaultValue={project?.tagline} maxLength={120} hint="One line, up to 120 characters." />
			<div className="grid gap-4 sm:grid-cols-2">
				<SelectField
					name="status"
					label="Status"
					defaultValue={project?.status ?? "building"}
					options={[
						{ value: "live", label: "Live" },
						{ value: "building", label: "Building" },
						{ value: "idea", label: "Idea" },
						{ value: "retired", label: "Retired" },
					]}
				/>
				<SelectField
					name="logo_path"
					label="Logo"
					defaultValue={project?.logoPath ?? ""}
					hint={LOGOS.length ? "Image files from public/logos/." : "Add square images to public/logos/ and rebuild to choose one."}
					options={[{ value: "", label: "First letter" }, ...LOGOS.map((path) => ({ value: path, label: path.replace("/logos/", "") }))]}
				/>
			</div>
			<TextField name="lesson" label="Lesson (for retired projects)" defaultValue={project?.lesson ?? ""} maxLength={160} hint="One line on what you learned. Shown in the compact list." />
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField type="url" name="site_url" label="Site address" defaultValue={project?.siteUrl ?? ""} placeholder="https://" />
				<TextField type="url" name="health_url" label="Health address (for uptime)" defaultValue={project?.healthUrl ?? ""} placeholder="https://" hint="Checked every 5 minutes. Leave blank to skip." />
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField name="github_repo" label="GitHub repo" defaultValue={project?.githubRepo ?? ""} placeholder="owner/repo" hint="For weekly commits and the shipping streak." />
				<TextField type="number" name="sort_order" label="Order" defaultValue={String(project?.sortOrder ?? 0)} hint="Lower numbers come first." />
			</div>
			<TextArea
				name="links"
				label="Links"
				rows={3}
				mono
				defaultValue={project?.links.map((l) => `${l.label} | ${l.url}`).join("\n")}
				hint='One per line, like "Website | https://example.com". Up to 8.'
			/>
			<TextArea name="description_md" label="Description" rows={8} defaultValue={project?.descriptionMd} hint="Markdown. Shown on the public project page." />
		</>
	);
}
