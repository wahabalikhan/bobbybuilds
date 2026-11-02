import { getCloudflareContext } from "@opennextjs/cloudflare";

// Proves the D1 binding works. Returns no data beyond "ok".
export async function GET() {
	const { env } = await getCloudflareContext({ async: true });
	try {
		const row = await env.DB.prepare("SELECT ?1 AS ok").bind(1).first<{ ok: number }>();
		return Response.json({ ok: row?.ok === 1, db: "connected" }, { headers: { "Cache-Control": "no-store" } });
	} catch {
		return Response.json({ ok: false, db: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
	}
}
