import { redirect } from "next/navigation";
import { adminHref } from "@/lib/site";

// The old project settings page: now the project's Settings tab.
export default async function OldProjectSettings({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	redirect(adminHref(`/projects/${encodeURIComponent(slug)}?tab=settings`));
}
