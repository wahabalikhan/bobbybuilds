import { utcDay } from "@/lib/days";
import { authenticateBrowser, authenticateServer } from "./auth";
import { type CollectorDeps, clientIp, error, privacySignalOn, readJsonBody, reply, userAgent } from "./http";
import { isBot } from "./ua";
import { BUILT_IN_EVENTS, isEventName, isPath, type Props, validateProps } from "./validate";
import { getDailySecret, rateLimitKey, visitorId } from "./visitor";

/**
 * POST /v1/events
 * - From the browser (bobby.track in t.js): public key + registered origin. The name must be a
 *   built-in event (outbound_click, file_download, not_found, form_started, form_submitted)
 *   or on the project's browser event allowlist.
 * - From a server: Authorization: Bearer sk_…. Any valid name; no visitor ID.
 */
export async function handleEvent(request: Request, deps: CollectorDeps): Promise<Response> {
	if (request.method !== "POST") return error(405, "Use POST.");
	const fromServer = request.headers.has("Authorization");
	if (!fromServer && privacySignalOn(request)) return reply(204);

	const parsed = await readJsonBody(request);
	if (!parsed.ok) return parsed.response;
	const body = parsed.body;
	const now = deps.now?.() ?? Date.now();
	const day = utcDay(now);

	if (fromServer) {
		const auth = await authenticateServer(deps.db, request);
		if (!auth.ok) return auth.response;
		const { project } = auth;

		const { success } = await deps.limiter.limit({ key: `${project.id}:server` });
		if (!success) return error(429, "Too many requests. Try again in a minute.");

		const checked = checkEvent(body, { pathRequired: false });
		if (typeof checked === "string") return error(400, checked);
		await insertEvent(deps.db, { projectId: project.id, now, day, source: "server", visitor: null, ...checked });
		return reply(204);
	}

	const auth = await authenticateBrowser(deps.db, request, body.key);
	if (!auth.ok) return auth.response;
	const { project, origin } = auth;

	const ua = userAgent(request);
	if (isBot(ua)) return reply(204, null, origin);

	const ip = clientIp(request);
	const secret = await getDailySecret(deps.db, day);
	const { success } = await deps.limiter.limit({ key: await rateLimitKey(secret, ip, project.id) });
	if (!success) return error(429, "Too many requests. Try again in a minute.", origin);

	const checked = checkEvent(body, { pathRequired: true });
	if (typeof checked === "string") return error(400, checked, origin);
	if (!(checked.name in BUILT_IN_EVENTS) && !project.browserEvents.includes(checked.name)) {
		return error(403, `"${checked.name}" isn't on this project's list of browser events.`, origin);
	}

	await insertEvent(deps.db, {
		projectId: project.id,
		now,
		day,
		source: "browser",
		visitor: await visitorId(secret, ip, ua, project.id),
		...checked,
	});
	return reply(204, null, origin);
}

type CheckedEvent = { name: string; path: string | null; props: Props };

function checkEvent(body: Record<string, unknown>, { pathRequired }: { pathRequired: boolean }): CheckedEvent | string {
	if (!isEventName(body.name)) return "name must be lower-case letters, numbers, _ . or -, up to 64 characters.";

	const path = body.path ?? null;
	if ((pathRequired || path !== null) && !isPath(path)) {
		return "path must start with / and be at most 200 characters, with no query string.";
	}

	const props = validateProps(body.props);
	if (!props.ok) return props.message;

	const builtIn = BUILT_IN_EVENTS[body.name];
	if (builtIn) {
		const problem = builtIn(props.props);
		if (problem) return problem;
	}
	return { name: body.name, path: path as string | null, props: props.props };
}

async function insertEvent(
	db: D1Database,
	event: CheckedEvent & { projectId: number; now: number; day: string; source: "browser" | "server"; visitor: string | null },
) {
	await db
		.prepare(
			"INSERT INTO events (project_id, ts, day, source, visitor_id, name, path, props) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
		)
		.bind(event.projectId, event.now, event.day, event.source, event.visitor, event.name, event.path, JSON.stringify(event.props))
		.run();
}
