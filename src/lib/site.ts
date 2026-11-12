/**
 * The one place for the site's name, address and admin path.
 * Change a value here and everything else follows.
 * (If you move the site to a new domain, also update the Cloudflare Access application.)
 */
export const site = {
	name: "BobbyBuilds",
	/** The wordmark's two halves, both semibold: the first in ink, the second in the accent blue. Joined, they're `name`. */
	wordmark: ["Bobby", "Builds"],
	url: "https://bobbybuilds.app",
	adminPath: "/admin",
	/**
	 * The BobbyBuilds project's public key, for t.js on the public pages (never /admin). Not a
	 * secret: it's in every page's HTML. Set in migrations/0010_bobbybuilds_project.sql.
	 */
	trackerKey: "pk_ocrQh00fwJXI1yFLCW7DaCN3",
	/** The BobbyBuilds project's slug: it tracks itself, shown in the admin only. */
	selfSlug: "bobbybuilds",
	/** Search engines stay out until launch: set to true to allow indexing. */
	indexable: false,
} as const;

/** The person behind the site, shown on the public pages. */
export const owner = {
	name: "Wahab (Bobby) Khan",
	firstName: "Wahab",
	/** For the copyright line. */
	fullName: "Wahab Ali Khan",
	/** The GitHub account behind the public GitHub section (contribution calendar). */
	githubLogin: "wahabalikhan",
	// Photo: add a square public/profile.png or public/profile.jpg (detected at build). Until then, the initial is shown.
	bio: "Product designer with 4+ years in B2B SaaS, also designing and building tools that make everyday things easier, in public.",
	/** The profile's links, in order, each an icon with its label. */
	links: [
		{ label: "LinkedIn", url: "https://linkedin.com/in/wahabalikhan" },
		{ label: "X", url: "https://x.com/heybobbybuilds" },
		{ label: "GitHub", url: "https://github.com/wahabalikhan" },
		{ label: "Email", url: "mailto:hello@bobbybuilds.app" },
	],
} as const;

/**
 * Tab titles put the page first, then the brand ("Journey · BobbyBuilds"). The public layout's
 * template adds " · BobbyBuilds" and the admin layout's " · BobbyBuilds HQ", so pages only set
 * their own name. The home page is the brand first: "BobbyBuilds · Wahab (Bobby) Khan".
 */
export const homeTitle = `${site.name} · ${owner.name}`;
export const adminName = `${site.name} HQ`;

/** Builds an admin URL path, e.g. adminHref("/settings") → "/admin/settings". */
export function adminHref(path = ""): string {
	return `${site.adminPath}${path}`;
}
