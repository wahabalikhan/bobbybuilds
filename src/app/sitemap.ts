import type { MetadataRoute } from "next";
import { getSnapshot } from "@/lib/public/get";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Home, plus the journey and every published entry when it's shown (site.showJourney). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const snapshot = await getSnapshot();
	const updated = new Date(snapshot.generatedAt);
	return [
		{ url: `${site.url}/`, lastModified: updated, changeFrequency: "daily", priority: 1 },
		...(site.showJourney ? [{ url: `${site.url}/journey`, lastModified: updated, changeFrequency: "weekly" as const, priority: 0.6 }] : []),
		...(site.showJourney ? snapshot.journey : []).map((e) => ({ url: `${site.url}/journey/${e.slug}`, lastModified: new Date(e.publishedAt), changeFrequency: "monthly" as const, priority: 0.5 })),
	];
}
