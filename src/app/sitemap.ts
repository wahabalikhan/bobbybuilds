import type { MetadataRoute } from "next";
import { getSnapshot } from "@/lib/public/get";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Home, every project page, the journey and every published entry. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const snapshot = await getSnapshot();
	const updated = new Date(snapshot.generatedAt);
	return [
		{ url: `${site.url}/`, lastModified: updated, changeFrequency: "daily", priority: 1 },
		...snapshot.projects.map((p) => ({ url: `${site.url}/p/${p.slug}`, lastModified: updated, changeFrequency: "daily" as const, priority: 0.8 })),
		{ url: `${site.url}/journey`, lastModified: updated, changeFrequency: "weekly", priority: 0.6 },
		...snapshot.journey.map((e) => ({ url: `${site.url}/journey/${e.slug}`, lastModified: new Date(e.publishedAt), changeFrequency: "monthly" as const, priority: 0.5 })),
	];
}
