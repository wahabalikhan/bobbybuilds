import { NewProjectWizard } from "@/components/admin/new-project-wizard";
import { Breadcrumb } from "@/components/admin/ui";
import { adminHref } from "@/lib/site";
import { startProjectAction } from "../../actions";

export default function NewProject() {
	return (
		<div className="max-w-2xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Settings", href: adminHref("/settings") }, { label: "New project" }]} />
				<h1 className="text-2xl font-semibold tracking-tight">New project</h1>
			</div>
			<NewProjectWizard action={startProjectAction} />
		</div>
	);
}
