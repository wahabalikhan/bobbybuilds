import type { Metadata } from "next";
import { NewProjectWizard } from "@/components/admin/new-project-wizard";
import { Breadcrumb, PageHeader } from "@/components/admin/ui";
import { adminHref } from "@/lib/site";
import { startProjectAction } from "../../settings/actions";

export const metadata: Metadata = { title: "New project" };

export default function NewProject() {
	return (
		<div className="max-w-2xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "New project" }]} />
				<PageHeader title="New project" subtitle="Connect a site in three steps." />
			</div>
			<NewProjectWizard action={startProjectAction} />
		</div>
	);
}
