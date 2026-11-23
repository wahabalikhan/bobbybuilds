/**
 * Card styles for a project's card on the public page, chosen in the project's Settings (On the
 * public page → Card style) and stored as projects.card_theme (migration 0024). '' is the standard
 * card. Since the bento redesign (Phase 12), "realtechjobs-blue" makes a project the home page's
 * tall blue featured card (src/app/page.tsx); the others show as the standard white card.
 *
 * To add one: add it here and give it a look in src/components/public/home.tsx, checking every text
 * colour's contrast on it (4.5:1). No migration is needed.
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
	{ id: "", label: "Standard", hint: "A white card, with the screenshot under the tagline." },
	{
		id: "realtechjobs-blue",
		label: "RealTechJobs blue",
		// The white logo comes from public/logos/<slug>-reversed.* when there is one.
		hint: "The tall blue card beside your intro, with its live numbers and the screenshot rising from the bottom (a phone screenshot works best). Use it for one project.",
		reversedLogo: true,
	},
	{ id: "portfolio-pins", label: "Portfolio", hint: "The standard white card for now: its tint and comment pins aren't in the new design.", pins: true },
];

/** The theme for a stored id; an unknown id is the standard card. */
export function cardTheme(id: string): CardTheme {
	return CARD_THEMES.find((t) => t.id === id) ?? CARD_THEMES[0];
}

export function isCardTheme(id: string): boolean {
	return CARD_THEMES.some((t) => t.id === id);
}
