import { listRealProjects, type Project } from "@/lib/db/projects";
import { saveIconCheck, type SaveResult } from "@/lib/db/icons";
import { findIcon, type Fetch } from "./find";

/** Checks one project's live site for its current icon and stores it if it changed. */
export async function refreshProjectIcon(db: D1Database, fetchFn: Fetch, project: Pick<Project, "id" | "siteUrl">, now: number): Promise<SaveResult> {
	if (!project.siteUrl) return saveIconCheck(db, project.id, { error: "No site address, so there's nowhere to look." }, now);
	return saveIconCheck(db, project.id, await findIcon(fetchFn, project.siteUrl), now);
}

/** The daily job's step: every real project with a site address, one at a time. */
export async function refreshAllIcons(db: D1Database, fetchFn: Fetch, now: number): Promise<Record<string, SaveResult["status"]>> {
	const summary: Record<string, SaveResult["status"]> = {};
	for (const project of (await listRealProjects(db)).filter((p) => p.siteUrl)) {
		summary[project.slug] = (await refreshProjectIcon(db, fetchFn, project, now)).status;
	}
	return summary;
}
