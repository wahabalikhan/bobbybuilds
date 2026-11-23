/**
 * The one page container, public and admin: the public page's width (900px), side padding and
 * centring, at every screen size, so nothing shifts when moving between them. Use it for every
 * page's outer box (and the admin top bar), never a different max width.
 */
export const PAGE = "mx-auto w-full max-w-[900px] px-5 sm:px-6";

/**
 * The public pages' container (Phase 12, the bento redesign): 1200px of content with 24px side
 * padding at every size. The admin keeps PAGE (900px).
 */
export const PUBLIC_PAGE = "mx-auto w-full max-w-[1248px] px-6";

/** Public cards: large ones (the bento's cards) have 28px corners, small ones (number tiles, sidebar cards) 24px; a 1px outline, no heavy shadow. */
export const CARD = "rounded-[28px] border border-line bg-card";
export const CARD_SMALL = "rounded-[24px] border border-line bg-card";

/** Small labels, dates and eyebrows: Geist Mono, uppercase, slightly spaced. */
export const EYEBROW = "font-mono text-[13px] uppercase tracking-[0.08em]";

/**
 * One height for every card on the public page (project cards and both Activity cards) when they're
 * side by side (md and up), so they all line up. On phones they're stacked and keep their own height.
 */
export const CARD_HEIGHT = "md:h-[216px]";

/**
 * Project cards (public and admin Home) are this height at every screen size, phones included, so
 * the chart that fills their lower part always gets the same room.
 */
export const PROJECT_CARD_HEIGHT = "h-[216px]";

/**
 * The hairline under the public page's section headings (Projects, Honest numbers, Activity,
 * Journey). Off for now; set to true to bring the lines back. The admin's headings keep theirs.
 */
export const PUBLIC_SECTION_DIVIDERS = false;
