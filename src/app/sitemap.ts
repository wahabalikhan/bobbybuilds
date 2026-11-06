import type { MetadataRoute } from "next";
import { getSnapshot } from "@/lib/public/get";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The public pages: home and the full journey. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const snapshot = await getSnapshot();
	const lastModified = new Date(snapshot.generatedAt);
	return [
		{ url: `${site.url}/`, lastModified, changeFrequency: "daily", priority: 1 },
		{ url: `${site.url}/journey`, lastModified, changeFrequency: "weekly", priority: 0.6 },
	];
}
