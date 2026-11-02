import { addDays, isDay, utcDay } from "@/lib/days";
import { getProjectBySlug } from "@/lib/db/projects";
import { eventsCsv } from "./csv";

/** Builds the CSV download for one project's events (raw, so 90 days at most). */
export async function handleEventsCsv(db: D1Database, slug: string, params: URLSearchParams, today: string = utcDay()): Promise<Response> {
	const project = await getProjectBySlug(db, slug);
	if (!project) return new Response("Not found.", { status: 404 });

	const earliest = addDays(today, -90);
	const from = params.get("from") ?? earliest;
	const to = params.get("to") ?? today;
	if (!isDay(from) || !isDay(to) || from > to) return new Response("from and to must be days (YYYY-MM-DD), with from first.", { status: 400 });

	const name = params.get("name");
	if (name && !/^[a-z][a-z0-9_.-]{0,63}$/.test(name)) return new Response("That event name isn't valid.", { status: 400 });
	const source = params.get("source");
	if (source && source !== "browser" && source !== "server") return new Response('source must be "browser" or "server".', { status: 400 });

	const filter = { projectId: project.id, from: from < earliest ? earliest : from, to, name, source: source as "browser" | "server" | null };
	const filename = `${project.slug}-events-${filter.from}-to-${filter.to}${name ? `-${name}` : ""}.csv`;
	return new Response(eventsCsv(db, filter), {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
