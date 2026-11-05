import { iconDataUrl, listIcons } from "@/lib/db/icons";
import { logoFor } from "@/lib/project-logo";

/**
 * The admin's icon for each project: its stored copy (fetched from its own site) as a data: URL, so
 * it's always the latest and hidden projects are covered too; else its file in public/logos; else
 * null (the initial is shown).
 */
export async function adminIcons(db: D1Database): Promise<(project: { id: number; slug: string; logoPath: string | null }) => string | null> {
	const icons = await listIcons(db);
	return (project) => {
		const icon = icons.get(project.id);
		return icon ? iconDataUrl(icon) : logoFor(project);
	};
}
