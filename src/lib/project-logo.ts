import { LOGOS } from "@/lib/logos.generated";

/**
 * A project's logo comes automatically from public/logos/<slug>.* (any shape: a circle, a rounded
 * square…). The old logo_path column is only a fallback. Null: the initial is shown.
 */
export function logoFor(project: { slug: string; logoPath: string | null }): string | null {
	return LOGOS.find((path) => path.replace(/\.[a-z]+$/, "") === `/logos/${project.slug}`) ?? project.logoPath ?? null;
}
