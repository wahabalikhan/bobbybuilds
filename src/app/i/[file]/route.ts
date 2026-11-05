import { getSnapshot } from "@/lib/public/get";

/**
 * A project's stored icon (fetched from its own site by the daily job or "Refresh icon now"), from the
 * public snapshot: /i/<slug>-<hash12>.<ext>. The hash is in the URL, so a new icon gets a new URL and
 * this one can be cached for a year. Strict headers, because an SVG from another site is served here:
 * it can't run scripts or load anything even if opened directly. Outside the page middleware (the
 * matcher skips image extensions), so the headers are set here.
 */
export const dynamic = "force-dynamic";

const HEADERS = {
	"X-Content-Type-Options": "nosniff",
	"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
	"Cross-Origin-Resource-Policy": "same-origin",
	"Referrer-Policy": "no-referrer",
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
	const { file } = await params;
	if (!/^[a-z0-9-]+-[0-9a-f]{12}\.(svg|png|ico|jpg|webp)$/.test(file)) return new Response("Not found", { status: 404, headers: HEADERS });
	const icon = (await getSnapshot()).icons?.[`/i/${file}`];
	if (!icon) return new Response("Not found", { status: 404, headers: { ...HEADERS, "Cache-Control": "no-store" } });
	const bytes = Uint8Array.from(atob(icon.base64), (c) => c.charCodeAt(0));
	return new Response(bytes, { headers: { ...HEADERS, "Content-Type": icon.contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
}
