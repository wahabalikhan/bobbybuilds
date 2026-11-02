import { utcDay } from "@/lib/days";
import { authenticateBrowser } from "./auth";
import { type CollectorDeps, clientIp, error, privacySignalOn, readJsonBody, reply, userAgent } from "./http";
import { browserGroup, deviceGroup, isBot, osGroup } from "./ua";
import {
	cleanCountry,
	cleanLanguage,
	cleanReferrer,
	cleanRef,
	cleanUtm,
	isPath,
	isWholeNumber,
	screenGroup,
} from "./validate";
import { getDailySecret, rateLimitKey, visitorId } from "./visitor";

const ENGAGED_CAP_MS = 1_800_000;

/**
 * POST /v1/pv from t.js. Two message types:
 * - view:  records a page view and replies { v: <view id> }
 * - leave: adds engaged time, scroll depth and Core Web Vitals to that view. Only the same
 *          visitor (recomputed from this request) can update it, and values only go up.
 */
export async function handlePageView(request: Request, deps: CollectorDeps): Promise<Response> {
	if (request.method !== "POST") return error(405, "Use POST.");
	if (privacySignalOn(request)) return reply(204);

	const parsed = await readJsonBody(request);
	if (!parsed.ok) return parsed.response;
	const body = parsed.body;

	const auth = await authenticateBrowser(deps.db, request, body.key);
	if (!auth.ok) return auth.response;
	const { project, origin } = auth;

	const ua = userAgent(request);
	if (isBot(ua)) return reply(204, null, origin);

	const now = deps.now?.() ?? Date.now();
	const day = utcDay(now);
	const ip = clientIp(request);
	const secret = await getDailySecret(deps.db, day);

	const { success } = await deps.limiter.limit({ key: await rateLimitKey(secret, ip, project.id) });
	if (!success) return error(429, "Too many requests. Try again in a minute.", origin);

	const visitor = await visitorId(secret, ip, ua, project.id);

	if (body.type === "view") {
		if (!isPath(body.path)) return error(400, "path must start with / and be at most 200 characters, with no query string.", origin);
		const width = body.width ?? null;
		if (width !== null && !isWholeNumber(width, 0, 10_000)) return error(400, "width must be a whole number of pixels.", origin);

		const row = await deps.db
			.prepare(
				`INSERT INTO page_views
				 (project_id, ts, day, visitor_id, path, referrer_domain, ref, utm_source, utm_medium, utm_campaign,
				  country, device, browser, os, screen, language)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
				 RETURNING id`,
			)
			.bind(
				project.id,
				now,
				day,
				visitor,
				body.path,
				cleanReferrer(body.referrer, origin),
				cleanRef(body.ref),
				cleanUtm(body.utm_source),
				cleanUtm(body.utm_medium),
				cleanUtm(body.utm_campaign),
				cleanCountry(deps.country),
				deviceGroup(ua, request.headers.get("Sec-CH-UA-Mobile")),
				browserGroup(ua),
				osGroup(ua),
				screenGroup(width),
				cleanLanguage(body.language),
			)
			.first<{ id: number }>();
		return reply(200, { v: row?.id ?? null }, origin);
	}

	if (body.type === "leave") {
		if (!isWholeNumber(body.view, 1, Number.MAX_SAFE_INTEGER)) return error(400, "view must be the id from the page view.", origin);
		if (!isWholeNumber(body.engaged_ms, 0, 86_400_000)) return error(400, "engaged_ms must be a whole number.", origin);
		if (!isWholeNumber(body.scroll_pct, 0, 100)) return error(400, "scroll_pct must be a whole number from 0 to 100.", origin);

		const lcp = vital(body.lcp_ms, 60_000);
		const cls = typeof body.cls === "number" && body.cls >= 0 && body.cls <= 10 ? Math.round(body.cls * 1000) : null;
		const inp = vital(body.inp_ms, 60_000);

		await deps.db
			.prepare(
				`UPDATE page_views SET
				   engaged_ms = MAX(COALESCE(engaged_ms, 0), ?5),
				   scroll_pct = MAX(COALESCE(scroll_pct, 0), ?6),
				   lcp_ms = COALESCE(lcp_ms, ?7),
				   cls_milli = CASE WHEN ?8 IS NULL THEN cls_milli ELSE MAX(COALESCE(cls_milli, 0), ?8) END,
				   inp_ms = CASE WHEN ?9 IS NULL THEN inp_ms ELSE MAX(COALESCE(inp_ms, 0), ?9) END
				 WHERE id = ?1 AND project_id = ?2 AND visitor_id = ?3 AND day = ?4`,
			)
			.bind(body.view, project.id, visitor, day, Math.min(body.engaged_ms, ENGAGED_CAP_MS), body.scroll_pct, lcp, cls, inp)
			.run();
		// Same reply whether or not a view matched, so nobody can probe other visitors' views.
		return reply(204, null, origin);
	}

	return error(400, 'type must be "view" or "leave".', origin);
}

/** A vital in milliseconds, rounded; null if missing or out of range. */
function vital(value: unknown, max: number): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value) : null;
}
