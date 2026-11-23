/**
 * The home page's "Now" card and the green pill in the intro: what I'm working on this week.
 * Edit this file, then deploy. Keep it short and in plain UK English.
 */
export const now: Now = {
	/** The green pill under my name in the intro ("Building RealTechJobs"). Empty to hide it. */
	status: "Building RealTechJobs",
	/** The card's heading. */
	title: "Tidying every job ad into one clear layout",
	/** A sentence or two under it. */
	text: "The engine only goes live for a company once it’s right 98% of the time. It now covers most jobs on the board.",
	/** Optional: a progress bar at the bottom. Leave it out (or set it to null) to hide the bar. */
	progress: { label: "Jobs with the clear layout", percent: 74 },
};

export type Now = {
	status: string;
	title: string;
	text: string;
	progress?: { label: string; percent: number } | null;
};
