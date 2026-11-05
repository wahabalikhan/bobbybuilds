import type { MetadataRoute } from "next";
import { getSnapshot } from "@/lib/public/get";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The home page is the only public page (the journey is a section of it). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const snapshot = await getSnapshot();
	return [{ url: `${site.url}/`, lastModified: new Date(snapshot.generatedAt), changeFrequency: "daily", priority: 1 }];
}
