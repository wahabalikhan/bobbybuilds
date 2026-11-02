import Link from "next/link";
import { SettingsForm } from "@/components/admin/form";
import { ProjectFields } from "@/components/admin/project-fields";
import { adminHref } from "@/lib/site";
import { createProjectAction } from "../../actions";

export default function NewProject() {
	return (
		<div className="max-w-2xl space-y-6">
			<div>
				<Link href={adminHref("/settings")} className="text-sm text-muted hover:text-ink">
					← Settings
				</Link>
				<h1 className="mt-2 text-2xl font-semibold tracking-tight">New project</h1>
				<p className="text-ink-2">You&rsquo;ll set up keys and origins next.</p>
			</div>
			<section className="rounded-2xl border border-line bg-card p-5">
				<SettingsForm action={createProjectAction} submitLabel="Create project">
					<ProjectFields />
				</SettingsForm>
			</section>
		</div>
	);
}
