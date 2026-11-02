import type { NextConfig } from "next";
import { site } from "./src/lib/site";

const nextConfig: NextConfig = {
	// Don't advertise the framework. Security headers are set in src/middleware.ts.
	poweredByHeader: false,
	// Project pages were removed: project cards open the project itself. Old links land on the home page.
	async redirects() {
		return [
			{ source: "/p/:path*", destination: "/", permanent: true },
			// The journey is hidden for now (site.showJourney); temporary, so it can come back.
			...(site.showJourney ? [] : [{ source: "/journey/:path*", destination: "/", permanent: false }]),
		];
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
