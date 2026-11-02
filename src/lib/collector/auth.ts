import { getProjectByPublicKey, getProjectBySecretKeyHash, type Project } from "@/lib/db/projects";
import { hashSecretKey, PUBLIC_KEY_PATTERN, SECRET_KEY_PATTERN } from "@/lib/keys";
import { error } from "./http";

export type BrowserAuth = { ok: true; project: Project; origin: string } | { ok: false; response: Response };
export type ServerAuth = { ok: true; project: Project } | { ok: false; response: Response };

// One message for a wrong key and a wrong origin, so a reply never says which was wrong.
const NOT_ALLOWED = "This site isn't allowed to send data with this key.";

/**
 * Browser requests: a public key plus an Origin header that exactly matches one of the
 * project's registered origins (scheme, host and port).
 */
export async function authenticateBrowser(db: D1Database, request: Request, key: unknown): Promise<BrowserAuth> {
	const origin = request.headers.get("Origin");
	if (!origin || origin === "null" || typeof key !== "string" || !PUBLIC_KEY_PATTERN.test(key)) {
		return { ok: false, response: error(403, NOT_ALLOWED) };
	}
	const project = await getProjectByPublicKey(db, key);
	if (!project || !project.allowedOrigins.includes(origin)) {
		return { ok: false, response: error(403, NOT_ALLOWED) };
	}
	return { ok: true, project, origin };
}

/**
 * Server requests: `Authorization: Bearer sk_…`, looked up by its hash.
 * A secret key arriving with an Origin header means it's in browser code: refused.
 */
export async function authenticateServer(db: D1Database, request: Request): Promise<ServerAuth> {
	const match = /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "");
	if (!match) return { ok: false, response: error(401, "Send your secret key as: Authorization: Bearer sk_…") };

	const secretKey = match[1];
	if (request.headers.get("Origin")) {
		return {
			ok: false,
			response: error(403, "Secret keys must only be used from your server, never from a browser. Rotate this key."),
		};
	}
	if (!SECRET_KEY_PATTERN.test(secretKey)) return { ok: false, response: error(401, "That secret key isn't valid.") };

	const project = await getProjectBySecretKeyHash(db, await hashSecretKey(secretKey));
	if (!project) return { ok: false, response: error(401, "That secret key isn't valid.") };
	return { ok: true, project };
}
