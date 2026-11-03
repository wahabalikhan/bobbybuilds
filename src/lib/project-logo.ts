import { LOGOS } from "@/lib/logos.generated";

/** The logo chosen in Settings, or public/logos/<slug>.* when none is chosen (else null: the initial is shown). */
export function logoFor(project: { slug: string; logoPath: string | null }): string | null {
	return project.logoPath ?? LOGOS.find((path) => path.replace(/\.[a-z]+$/, "") === `/logos/${project.slug}`) ?? null;
}
