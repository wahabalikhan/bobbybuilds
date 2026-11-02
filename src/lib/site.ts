/**
 * The one place for the site's name, address and admin path.
 * Change a value here and everything else follows.
 * (If you move the site to a new domain, also update the Cloudflare Access application.)
 */
export const site = {
	name: "Bobby Builds",
	url: "https://bobbybuilds.wahab-ali-khan.workers.dev",
	adminPath: "/admin",
	/** Search engines stay out until launch: set to true to allow indexing. */
	indexable: false,
} as const;

/** The person behind the site, shown on the public pages. */
export const owner = {
	name: "Wahab \u201cBobby\u201d Khan",
	firstName: "Wahab",
	location: "Leeds, UK",
	// Photo: add a square public/profile.png or public/profile.jpg (detected at build). Until then, the initial is shown.
	bio: "I'm Wahab, a product designer from Leeds with five years of experience designing B2B software, and a computer science degree that means I build what I design. After being made redundant in June 2026, I started building the tools I wished I'd had. They're free, they're honest about what they do, and I'm building every one of them in public. Follow along with me on LinkedIn!",
	links: [
		{ label: "LinkedIn", url: "https://linkedin.com/in/wahabalikhan" },
		{ label: "GitHub", url: "https://github.com/wahabalikhan" },
	],
} as const;

/** Builds an admin URL path, e.g. adminHref("/settings") → "/admin/settings". */
export function adminHref(path = ""): string {
	return `${site.adminPath}${path}`;
}
