/**
 * The one place for the site's name, address and admin path.
 * Change a value here and everything else follows.
 * (If you move the site to a new domain, also update the Cloudflare Access application.)
 */
export const site = {
	name: "Bobby Builds",
	url: "https://bobbybuilds.app",
	adminPath: "/admin",
	/**
	 * The public journey (home page section, /journey and /journey/[slug], sitemap entries).
	 * While false they're hidden and /journey/* redirects to /. Entries are still written in admin.
	 */
	showJourney: false,
	/** Search engines stay out until launch: set to true to allow indexing. */
	indexable: false,
} as const;

/** The person behind the site, shown on the public pages. */
export const owner = {
	name: "Wahab \u201cBobby\u201d Khan",
	firstName: "Wahab",
	/** For the copyright line. */
	fullName: "Wahab Ali Khan",
	/** The GitHub account behind the public GitHub section (contribution calendar). */
	githubLogin: "wahabalikhan",
	// Photo: add a square public/profile.png or public/profile.jpg (detected at build). Until then, the initial is shown.
	bio: "I'm Wahab, a product designer with 4+ years of B2B experience designing enterprise SaaS for technical users, and a BSc in Computer Science that means I build what I design. After being made redundant in June 2026, I started building the tools I wished I'd had. They're free, they're honest about what they do, and I'm building every one of them in public. Follow along with me on LinkedIn!",
	links: [
		{ label: "LinkedIn", url: "https://linkedin.com/in/wahabalikhan" },
		{ label: "GitHub", url: "https://github.com/wahabalikhan" },
	],
} as const;

/** Builds an admin URL path, e.g. adminHref("/settings") → "/admin/settings". */
export function adminHref(path = ""): string {
	return `${site.adminPath}${path}`;
}
