/** Shared HTTP plumbing for the /v1 collector routes. */

export type CollectorDeps = {
	db: D1Database;
	limiter: RateLimit;
	/** Two-letter country from Cloudflare's request.cf, if any. */
	country: string | null;
	now?: () => number;
};

export const MAX_BODY_BYTES = 2048;

const BASE_HEADERS = {
	"Cache-Control": "no-store",
	"X-Content-Type-Options": "nosniff",
	"Content-Type": "application/json; charset=utf-8",
};

/**
 * JSON response. CORS headers are added only when `allowedOrigin` is given, which is only
 * after the origin has been matched against the project's registered origins.
 */
export function reply(status: number, body: unknown = null, allowedOrigin: string | null = null): Response {
	const headers = new Headers(BASE_HEADERS);
	headers.set("Vary", "Origin");
	if (allowedOrigin) {
		headers.set("Access-Control-Allow-Origin", allowedOrigin);
		headers.set("Cross-Origin-Resource-Policy", "cross-origin");
	}
	if (status === 204 || body === null) return new Response(null, { status: status === 200 ? 204 : status, headers });
	return new Response(JSON.stringify(body), { status, headers });
}

export function error(status: number, message: string, allowedOrigin: string | null = null): Response {
	return reply(status, { error: message }, allowedOrigin);
}

/** GPC or Do Not Track: the request is answered but nothing is stored. */
export function privacySignalOn(request: Request): boolean {
	return request.headers.get("Sec-GPC") === "1" || request.headers.get("DNT") === "1";
}

export type BodyResult = { ok: true; body: Record<string, unknown> } | { ok: false; response: Response };

/** Reads a JSON object body of at most MAX_BODY_BYTES. Accepts text/plain (no CORS preflight). */
export async function readJsonBody(request: Request): Promise<BodyResult> {
	const declared = Number(request.headers.get("Content-Length") ?? "0");
	if (declared > MAX_BODY_BYTES) return { ok: false, response: error(413, "Body too large.") };

	const text = await request.text();
	if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
		return { ok: false, response: error(413, "Body too large.") };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, response: error(400, "Body must be JSON.") };
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return { ok: false, response: error(400, "Body must be a JSON object.") };
	}
	return { ok: true, body: parsed as Record<string, unknown> };
}

export function clientIp(request: Request): string {
	return request.headers.get("CF-Connecting-IP") ?? "";
}

export function userAgent(request: Request): string {
	return (request.headers.get("User-Agent") ?? "").slice(0, 512);
}
