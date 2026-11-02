/**
 * The one place for the site's name, address and admin path.
 * Change a value here and everything else follows.
 * (If you move the site to a new domain, also update the Cloudflare Access application.)
 */
export const site = {
	name: "Bobby Builds",
	url: "https://bobbybuilds.wahab-ali-khan.workers.dev",
	adminPath: "/admin",
} as const;

/** Builds an admin URL path, e.g. adminHref("/settings") → "/admin/settings". */
export function adminHref(path = ""): string {
	return `${site.adminPath}${path}`;
}
