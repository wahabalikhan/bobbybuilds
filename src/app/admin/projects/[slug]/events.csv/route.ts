import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminRequestFrom } from "@/lib/admin/access";
import { handleEventsCsv } from "@/lib/admin/events-csv";

// GET /admin/projects/[slug]/events.csv?from&to&name&source. Logic: src/lib/admin/events-csv.ts.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
	if (!(await isAdminRequestFrom(request))) return new Response("Sorry, you don't have access to this.", { status: 403 });
	const { env } = await getCloudflareContext({ async: true });
	return handleEventsCsv(env.DB, (await params).slug, new URL(request.url).searchParams);
}
