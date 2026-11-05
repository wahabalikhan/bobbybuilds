/**
 * The one page container, public and admin: the public page's width (900px), side padding and
 * centring, at every screen size, so nothing shifts when moving between them. Use it for every
 * page's outer box (and the admin top bar), never a different max width.
 */
export const PAGE = "mx-auto w-full max-w-[900px] px-5 sm:px-6";

/**
 * One height for every card on the public page (project cards and both Activity cards) when they're
 * side by side (md and up), so they all line up. On phones they're stacked and keep their own height.
 */
export const CARD_HEIGHT = "md:h-[216px]";
