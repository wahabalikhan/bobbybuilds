import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verifies the signed JWT that Cloudflare Access adds to every request it lets through.
 * Access already blocks people at the edge; this check means /admin stays shut even if
 * Access is misconfigured, switched off, or someone reaches the Worker another way.
 */

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

type AccessConfig = { teamDomain: string; aud: string };

// Cached per team domain so the signing keys are fetched once per isolate, not per request.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Normalises "myteam.cloudflareaccess.com" or "https://myteam.cloudflareaccess.com/" */
export function normaliseTeamDomain(value: string): string {
	const trimmed = value.trim().replace(/\/+$/, "");
	if (!trimmed) return "";
	return trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

export function readAccessConfig(): AccessConfig | null {
	const teamDomain = normaliseTeamDomain(process.env.ACCESS_TEAM_DOMAIN ?? "");
	const aud = (process.env.ACCESS_AUD ?? "").trim();
	if (!teamDomain || !aud) return null;
	return { teamDomain, aud };
}

export async function isValidAccessJwt(token: string | null, config: AccessConfig | null): Promise<boolean> {
	if (!token || !config) return false;

	let keySet = keySets.get(config.teamDomain);
	if (!keySet) {
		keySet = createRemoteJWKSet(new URL(`${config.teamDomain}/cdn-cgi/access/certs`));
		keySets.set(config.teamDomain, keySet);
	}

	try {
		// Checks the signature, audience, issuer and expiry.
		await jwtVerify(token, keySet, {
			issuer: config.teamDomain,
			audience: config.aud,
			algorithms: ["RS256"],
		});
		return true;
	} catch {
		return false;
	}
}
