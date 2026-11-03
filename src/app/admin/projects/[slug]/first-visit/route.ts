import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminRequestFrom } from "@/lib/admin/access";
import { getProjectBySlug, projectsWithVisits } from "@/lib/db/projects";

// GET /admin/settings/projects/[slug]/first-visit: { arrived } for the new project setup's step 3.
// Admin only, like every route under the admin path.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
	if (!(await isAdminRequestFrom(request))) return new Response("Sorry, you don't have access to this.", { status: 403 });
	const { env } = await getCloudflareContext({ async: true });
	const project = await getProjectBySlug(env.DB, (await params).slug);
	if (!project) return Response.json({ arrived: false, error: "No such project." }, { status: 404, headers: { "Cache-Control": "no-store" } });
	const arrived = (await projectsWithVisits(env.DB)).has(project.id);
	return Response.json({ arrived }, { headers: { "Cache-Control": "no-store" } });
}
