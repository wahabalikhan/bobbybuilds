import { headers } from "next/headers";
import { ACCESS_JWT_HEADER, isValidAccessJwt, readAccessConfig } from "@/lib/security/access";
import { isLocalAdminAllowed } from "@/lib/security/local-admin";

/**
 * The admin check, done again inside every admin action and route. The middleware's
 * path check isn't enough on its own: Next.js server actions can be called from any page.
 */

/** "localhost:8787" → "localhost", "[::1]:8787" → "[::1]" */
export function hostnameFromHost(host: string | null): string {
	if (!host) return "";
	if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
	return host.split(":")[0];
}

export async function isAdminRequest(host: string | null, token: string | null): Promise<boolean> {
	if (isLocalAdminAllowed(hostnameFromHost(host))) return true;
	return isValidAccessJwt(token, readAccessConfig());
}

export class NotAllowedError extends Error {
	constructor() {
		super("Sorry, you don't have access to this.");
	}
}

/** Throws unless the current request is from the admin. */
export async function requireAdmin(): Promise<void> {
	const h = await headers();
	if (!(await isAdminRequest(h.get("host"), h.get(ACCESS_JWT_HEADER)))) throw new NotAllowedError();
}

/** For route handlers that have the Request. */
export async function isAdminRequestFrom(request: Request): Promise<boolean> {
	return isAdminRequest(new URL(request.url).host || request.headers.get("host"), request.headers.get(ACCESS_JWT_HEADER));
}

/** True when the local admin is reading the live database (npm run admin:live). */
export function isLiveData(): boolean {
	return process.env.ADMIN_DATA === "live";
}
