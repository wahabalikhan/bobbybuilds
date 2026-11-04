import { LOGOS } from "@/lib/logos.generated";

/**
 * A project's logo comes automatically from public/logos/<slug>.* (any shape: a circle, a rounded
 * square…). The old logo_path column is only a fallback. Null: the initial is shown.
 */
export function logoFor(project: { slug: string; logoPath: string | null }): string | null {
	return LOGOS.find((path) => path.replace(/\.[a-z]+$/, "") === `/logos/${project.slug}`) ?? project.logoPath ?? null;
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
