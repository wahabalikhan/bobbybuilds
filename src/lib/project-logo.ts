import { LOGOS } from "@/lib/logos.generated";

/**
 * A project's logo comes automatically from public/logos/<slug>.* (any shape: a circle, a rounded
 * square…). The old logo_path column is only a fallback. Null: the initial is shown.
 */
export function logoFor(project: { slug: string; logoPath: string | null }): string | null {
	return LOGOS.find((path) => path.replace(/\.[a-z]+$/, "") === `/logos/${project.slug}`) ?? project.logoPath ?? null;
}

/**
 * Projects whose file in public/logos is shown everywhere (HQ and the public page) in place of the
 * icon fetched from their site. RealTechJobs: its new icon lives here; its site still serves the old one.
 */
export const PINNED_LOGOS: readonly string[] = ["realtechjobs"];

/** True when the project's own logo file is pinned (and exists), so the fetched icon isn't used. */
export function hasPinnedLogo(project: { slug: string }): boolean {
	return PINNED_LOGOS.includes(project.slug) && LOGOS.some((path) => path.replace(/\.[a-z]+$/, "") === `/logos/${project.slug}`);
}

/** Below this size (px), a logo's simpler `-small` version is used when there is one. */
export const SMALL_LOGO_BELOW = 32;

/** The file to draw at this size: /logos/x-small.svg for /logos/x.svg below 32px, when it exists. */
export function logoAtSize(logoPath: string, size: number): string {
	if (size >= SMALL_LOGO_BELOW) return logoPath;
	const small = logoPath.replace(/(\.[a-z]+)$/, "-small$1");
	return small !== logoPath && LOGOS.includes(small) ? small : logoPath;
}

/**
 * Round logos are drawn 1.1× inside the same box, because a circle looks smaller than a square of
 * the same width (it covers only ~79% of it). The scale doesn't change the box, so nothing moves.
 * Add a logo's path here when its file is a circle.
 */
export const ROUND_LOGOS: readonly string[] = ["/logos/portfolio.png"];
export const ROUND_LOGO_SCALE = 1.1;

/** How much bigger to draw a logo than its box: ROUND_LOGO_SCALE for round logos, else 1. */
export function logoScale(logoPath: string): number {
	return ROUND_LOGOS.includes(logoPath) ? ROUND_LOGO_SCALE : 1;
}
