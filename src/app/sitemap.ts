import type { MetadataRoute } from "next";
import { getSnapshot } from "@/lib/public/get";
import { postHref } from "@/lib/public/journey";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The public pages: home, the full journey and each journey post. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const snapshot = await getSnapshot();
	const lastModified = new Date(snapshot.generatedAt);
	return [
		{ url: `${site.url}/`, lastModified, changeFrequency: "daily", priority: 1 },
		{ url: `${site.url}/journey`, lastModified, changeFrequency: "weekly", priority: 0.6 },
		...snapshot.journey.map((e) => ({ url: `${site.url}${postHref(e.slug)}`, lastModified: new Date(e.publishedAt), changeFrequency: "monthly" as const, priority: 0.5 })),
	];
}
