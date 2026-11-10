/**
 * Card styles for a project's card on the public page, chosen in the project's Settings (On the
 * public page → Card style) and stored as projects.card_theme (migration 0024). '' is the standard
 * card. A theme is mostly CSS: its class in globals.css (.card-theme-<id>) resets the card's colour
 * tokens, so the chart, status and hover follow without a second code path.
 *
 * To add one: add it here, add its .card-theme-<id> block to globals.css, and check every text
 * colour's contrast on it (4.5:1, or 3:1 for chart lines). No migration is needed.
 */
export type CardTheme = {
	id: string;
	label: string;
	/** Plain words for the Card style field's hint. */
	hint: string;
	/** Use the project's white logo, public/logos/<slug>-reversed.*, when there is one. */
	reversedLogo?: boolean;
	/** Decorative comment pins under the content (CardPins). */
	pins?: boolean;
};

export const CARD_THEMES: readonly CardTheme[] = [
	{ id: "", label: "Standard", hint: "The usual white card." },
	{
		id: "realtechjobs-blue",
		label: "RealTechJobs blue",
		// The white logo comes from public/logos/<slug>-reversed.* when there is one.
		hint: "Solid brand blue, with the logo and everything else in white.",
		reversedLogo: true,
	},
	{ id: "portfolio-pins", label: "Portfolio", hint: "A soft blue tint from the top-left corner, with comment pins like the portfolio's.", pins: true },
];

/** The theme for a stored id; an unknown id is the standard card. */
export function cardTheme(id: string): CardTheme {
	return CARD_THEMES.find((t) => t.id === id) ?? CARD_THEMES[0];
}

export function isCardTheme(id: string): boolean {
	return CARD_THEMES.some((t) => t.id === id);
}
