import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Until launch (site.indexable), everything is disallowed.
export default function robots(): MetadataRoute.Robots {
	if (!site.indexable) return { rules: { userAgent: "*", disallow: "/" } };
	return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/v1/", "/internal/"] }, sitemap: `${site.url}/sitemap.xml` };
}
