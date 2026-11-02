/**
 * Local-only way into the admin area while there's no Cloudflare Access in front of it.
 *
 * Both must be true:
 * 1. The request is to a loopback host (localhost, 127.0.0.1, [::1]). Cloudflare's edge
 *    only routes real hostnames to the Worker, so a live request can never match this.
 * 2. Either this is `next dev`, or LOCAL_ADMIN_PREVIEW is "on". The flag belongs only in
 *    .dev.vars, which `wrangler deploy` never uploads. check-env refuses to build or deploy
 *    if the flag appears in a .env file (which would bake it into the bundle),
 *    in wrangler.jsonc, or among the Worker's deployed secrets.
 */

export const LOCAL_ADMIN_FLAG = "LOCAL_ADMIN_PREVIEW";

// Set by the middleware for admin pages to show a "local preview" banner.
// Any copy sent by a client is removed first.
export const LOCAL_ADMIN_HEADER = "x-bobby-local-admin";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLoopbackHost(hostname: string): boolean {
	return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function isLocalAdminAllowed(hostname: string): boolean {
	if (!isLoopbackHost(hostname)) return false;
	return process.env.NODE_ENV === "development" || process.env[LOCAL_ADMIN_FLAG] === "on";
}
