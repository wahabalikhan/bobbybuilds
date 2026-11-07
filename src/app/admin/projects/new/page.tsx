import type { Metadata } from "next";
import { NewProjectWizard } from "@/components/admin/new-project-wizard";
import { PageHeader } from "@/components/admin/ui";
import { startProjectAction } from "../../settings/actions";

export const metadata: Metadata = { title: "New project" };

export default function NewProject() {
	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<PageHeader title="New project" subtitle="Connect a site in three steps." />
			</div>
			<NewProjectWizard action={startProjectAction} />
		</div>
	);
}
