import { SelectField, TextField } from "@/components/admin/form";
import type { Project } from "@/lib/db/projects";
import { LOGOS } from "@/lib/logos.generated";

/**
 * The Basics fields in a project's settings. Fields that aren't here (slug, description, lesson,
 * links, order) keep their saved values when the form is saved.
 */
export function ProjectFields({ project }: { project: Project }) {
	return (
		<>
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField name="name" label="Name" defaultValue={project.name} maxLength={60} required />
				<SelectField
					name="status"
					label="Status"
					defaultValue={project.status}
					options={[
						{ value: "live", label: "Live" },
						{ value: "building", label: "Building" },
						{ value: "idea", label: "Idea" },
						{ value: "retired", label: "Retired" },
					]}
				/>
			</div>
			<TextField name="tagline" label="Tagline" defaultValue={project.tagline} maxLength={120} hint="One line, up to 120 characters. Shown on the public card." />
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField type="url" name="site_url" label="Site address" defaultValue={project.siteUrl ?? ""} placeholder="https://" hint="Where the public card links to." />
				<SelectField
					name="logo_path"
					label="Logo"
					defaultValue={project.logoPath ?? ""}
					hint={LOGOS.length ? `Image files from public/logos/. "Automatic" uses public/logos/${project.slug}.* if there is one.` : "Add square images to public/logos/ and rebuild to choose one."}
					options={[{ value: "", label: "Automatic" }, ...LOGOS.map((path) => ({ value: path, label: path.replace("/logos/", "") }))]}
				/>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField type="url" name="health_url" label="Health address (for uptime)" defaultValue={project.healthUrl ?? ""} placeholder="https://" hint="Checked every 5 minutes. Leave blank to skip." />
				<TextField name="github_repo" label="GitHub repo" defaultValue={project.githubRepo ?? ""} placeholder="owner/repo" hint="For commits on the Home card." />
			</div>
		</>
	);
}
